import {
  ApiResponse,
  ExecutionContext,
  ExecutionError,
  Workflow,
  WorkflowExecution,
  WorkflowStep,
} from '@/features/workflow-automation/types'

/**
 * Core Workflow Engine Service
 * Handles workflow orchestration, execution, and state management
 */
export class WorkflowEngine {
  private executions = new Map<string, WorkflowExecution>()
  private stepExecutors = new Map<string, StepExecutor>()
  private eventHandlers = new Map<string, Function[]>()

  constructor(
    private executionTracker: ExecutionTracker,
    private integrationService: IntegrationService
  ) {
    this.initializeStepExecutors()
  }

  /**
   * Start executing a workflow
   */
  async startWorkflow(
    workflow: Workflow,
    context: ExecutionContext,
    initialData?: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    // Create execution record
    const execution: WorkflowExecution = {
      id: this.generateId(),
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      tenantId: workflow.tenantId,
      status: 'pending',
      currentStep: undefined,
      completedSteps: [],
      data: initialData || {},
      variables: this.initializeVariables(workflow.variables, initialData),
      context,
      startTime: new Date(),
      metadata: {
        attemptNumber: 1,
        retryCount: 0,
        approvals: [],
        approvalRequired: workflow.settings.requireApproval,
      },
    }

    // Store execution
    this.executions.set(execution.id, execution)

    // Track execution
    await this.executionTracker.create(execution)

    // Start execution asynchronously
    this.executeWorkflow(workflow, execution).catch((error) => {
      console.error(`Workflow execution failed: ${execution.id}`, error)
    })

    return execution
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflow(workflow: Workflow, execution: WorkflowExecution): Promise<void> {
    try {
      // Update status to running
      execution.status = 'running'
      await this.executionTracker.update(execution)

      // Emit start event
      this.emitEvent('workflow.started', { workflow, execution })

      // Find starting step (step with no incoming connections)
      const startStep = this.findStartStep(workflow)
      if (!startStep) {
        throw new Error('No starting step found in workflow')
      }

      // Execute steps starting from the start step
      await this.executeStep(workflow, execution, startStep)

      // Check if workflow completed successfully
      if (execution.status === 'running') {
        execution.status = 'completed'
        execution.endTime = new Date()
        execution.duration = Math.floor(
          (execution.endTime.getTime() - execution.startTime.getTime()) / 1000
        )
        await this.executionTracker.update(execution)
        this.emitEvent('workflow.completed', { workflow, execution })
      }
    } catch (error) {
      // Handle execution error
      await this.handleExecutionError(workflow, execution, error)
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    workflow: Workflow,
    execution: WorkflowExecution,
    step: WorkflowStep
  ): Promise<void> {
    // Update current step
    execution.currentStep = step.id
    await this.executionTracker.update(execution)

    try {
      // Emit step start event
      this.emitEvent('step.started', { workflow, execution, step })

      // Check if step has approval requirements
      if (step.type === 'approval') {
        await this.handleApprovalStep(workflow, execution, step)
        return // Wait for approval
      }

      // Get step executor
      const executor = this.stepExecutors.get(step.type)
      if (!executor) {
        throw new Error(`No executor found for step type: ${step.type}`)
      }

      // Execute step with timeout
      const timeout = step.timeout || workflow.settings.timeout || 300 // 5 minutes default
      await this.executeWithTimeout(() => executor.execute(step, execution), timeout * 1000)

      // Mark step as completed
      execution.completedSteps.push(step.id)
      await this.executionTracker.update(execution)

      // Emit step completion event
      this.emitEvent('step.completed', { workflow, execution, step })

      // Determine next steps
      const nextSteps = this.getNextSteps(workflow, execution, step)

      if (nextSteps.length === 0) {
        // No more steps, workflow may be complete
        return
      }

      if (nextSteps.length === 1) {
        // Single next step, execute sequentially
        const nextStep = workflow.steps.find((s) => s.id === nextSteps[0])
        if (nextStep) {
          await this.executeStep(workflow, execution, nextStep)
        }
      } else {
        // Multiple next steps, check if they can run in parallel
        const parallelGroups = this.groupParallelSteps(workflow, nextSteps)

        if (parallelGroups.length === 1) {
          // All steps can run in parallel
          await this.executeParallelSteps(workflow, execution, parallelGroups[0])
        } else {
          // Execute parallel groups sequentially
          for (const group of parallelGroups) {
            await this.executeParallelSteps(workflow, execution, group)
          }
        }
      }
    } catch (error) {
      // Handle step error
      await this.handleStepError(workflow, execution, step, error)
      throw error
    }
  }

  /**
   * Execute multiple steps in parallel
   */
  private async executeParallelSteps(
    workflow: Workflow,
    execution: WorkflowExecution,
    stepIds: string[]
  ): Promise<void> {
    const stepPromises = stepIds.map(async (stepId) => {
      const step = workflow.steps.find((s) => s.id === stepId)
      if (!step) {
        throw new Error(`Step not found: ${stepId}`)
      }

      // Create a copy of execution for parallel execution
      const parallelExecution = { ...execution }

      return this.executeStep(workflow, parallelExecution, step)
    })

    // Wait for all parallel steps to complete
    await Promise.all(stepPromises)
  }

  /**
   * Handle approval step
   */
  private async handleApprovalStep(
    workflow: Workflow,
    execution: WorkflowExecution,
    step: WorkflowStep
  ): Promise<void> {
    // Create approval record
    const approval = {
      id: this.generateId(),
      stepId: step.id,
      userId: execution.context.userId,
      status: 'pending' as const,
      timestamp: new Date(),
    }

    execution.metadata.approvals.push(approval)
    await this.executionTracker.update(execution)

    // Pause execution waiting for approval
    execution.status = 'paused'
    await this.executionTracker.update(execution)

    // Emit approval request event
    this.emitEvent('approval.requested', { workflow, execution, step, approval })
  }

  /**
   * Submit approval for a workflow
   */
  async submitApproval(
    executionId: string,
    stepId: string,
    userId: string,
    approved: boolean,
    comment?: string
  ): Promise<void> {
    const execution = this.executions.get(executionId)
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`)
    }

    // Find approval record
    const approval = execution.metadata.approvals.find(
      (a) => a.stepId === stepId && a.userId === userId
    )

    if (!approval) {
      throw new Error(`Approval record not found`)
    }

    // Update approval
    approval.status = approved ? 'approved' : 'rejected'
    approval.comment = comment
    approval.timestamp = new Date()

    await this.executionTracker.update(execution)

    // If approved, resume execution
    if (approved) {
      execution.status = 'running'
      const workflow = await this.getWorkflow(execution.workflowId)
      const step = workflow.steps.find((s) => s.id === stepId)

      if (step) {
        await this.executeStep(workflow, execution, step)
      }
    } else {
      // If rejected, fail the workflow
      execution.status = 'failed'
      execution.error = {
        code: 'APPROVAL_REJECTED',
        message: `Step approval rejected: ${stepId}`,
        stepId,
        timestamp: new Date(),
        context: { comment },
      }
      await this.executionTracker.update(execution)
    }

    // Emit approval event
    this.emitEvent('approval.submitted', { execution, stepId, approved, comment })
  }

  /**
   * Cancel workflow execution
   */
  async cancelExecution(executionId: string, reason?: string): Promise<void> {
    const execution = this.executions.get(executionId)
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`)
    }

    execution.status = 'cancelled'
    execution.endTime = new Date()
    execution.duration = Math.floor(
      (execution.endTime.getTime() - execution.startTime.getTime()) / 1000
    )

    if (reason) {
      execution.error = {
        code: 'CANCELLED',
        message: reason,
        timestamp: new Date(),
      }
    }

    await this.executionTracker.update(execution)
    this.emitEvent('execution.cancelled', { execution, reason })
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId)
  }

  /**
   * Get all executions for a workflow
   */
  getWorkflowExecutions(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(
      (execution) => execution.workflowId === workflowId
    )
  }

  /**
   * Handle execution errors with retry logic
   */
  private async handleExecutionError(
    workflow: Workflow,
    execution: WorkflowExecution,
    error: Error
  ): Promise<void> {
    execution.status = 'failed'
    execution.endTime = new Date()
    execution.duration = Math.floor(
      (execution.endTime.getTime() - execution.startTime.getTime()) / 1000
    )
    execution.error = {
      code: 'EXECUTION_ERROR',
      message: error.message,
      timestamp: new Date(),
      stack: error.stack,
    }

    await this.executionTracker.update(execution)
    this.emitEvent('workflow.failed', { workflow, execution, error })

    // Check if we should retry
    if (execution.metadata.retryCount < 3) {
      execution.metadata.retryCount++
      execution.metadata.attemptNumber++
      execution.status = 'pending'
      execution.error = undefined

      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, execution.metadata.retryCount) * 1000
      setTimeout(() => {
        this.executeWorkflow(workflow, execution)
      }, delay)
    }
  }

  /**
   * Handle step errors
   */
  private async handleStepError(
    workflow: Workflow,
    execution: WorkflowExecution,
    step: WorkflowStep,
    error: Error
  ): Promise<void> {
    const executionError: ExecutionError = {
      code: 'STEP_ERROR',
      message: error.message,
      stepId: step.id,
      timestamp: new Date(),
      stack: error.stack,
    }

    this.emitEvent('step.failed', { workflow, execution, step, error: executionError })
  }

  /**
   * Find the starting step in a workflow
   */
  private findStartStep(workflow: Workflow): WorkflowStep | undefined {
    // A step is a start step if no other step points to it
    const allNextSteps = workflow.steps.flatMap((step) => step.nextSteps || [])
    const startStep = workflow.steps.find((step) => !allNextSteps.includes(step.id))
    return startStep
  }

  /**
   * Get next steps based on conditions
   */
  private getNextSteps(
    workflow: Workflow,
    execution: WorkflowExecution,
    currentStep: WorkflowStep
  ): string[] {
    const nextStepIds = currentStep.nextSteps || []

    if (!currentStep.conditions || currentStep.conditions.length === 0) {
      return nextStepIds
    }

    // Evaluate conditions
    const passedConditions = currentStep.conditions.filter((condition) =>
      this.evaluateCondition(condition, execution)
    )

    // Return steps that pass conditions
    return nextStepIds.filter((stepId) => {
      const step = workflow.steps.find((s) => s.id === stepId)
      return step && this.stepPassesConditions(step, passedConditions)
    })
  }

  /**
   * Evaluate a condition against execution data
   */
  private evaluateCondition(condition: any, execution: WorkflowExecution): boolean {
    const value = this.getNestedValue(execution.data, condition.field)
    return this.compareValues(value, condition.operator, condition.value)
  }

  /**
   * Check if a step passes given conditions
   */
  private stepPassesConditions(step: WorkflowStep, conditions: any[]): boolean {
    // This is a simplified implementation
    // In reality, you'd need more sophisticated condition matching
    return true
  }

  /**
   * Group steps that can run in parallel
   */
  private groupParallelSteps(workflow: Workflow, stepIds: string[]): string[][] {
    // Simplified parallel grouping logic
    // In reality, you'd need to analyze dependencies
    if (workflow.settings.parallelExecution) {
      return [stepIds]
    }
    return stepIds.map((id) => [id])
  }

  /**
   * Initialize workflow variables
   */
  private initializeVariables(
    variables: any[],
    initialData?: Record<string, unknown>
  ): Record<string, unknown> {
    const initialized: Record<string, unknown> = {}

    for (const variable of variables) {
      initialized[variable.name] = initialData?.[variable.name] ?? variable.defaultValue
    }

    return initialized
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Step execution timeout')), timeoutMs)
      ),
    ])
  }

  /**
   * Compare values for condition evaluation
   */
  private compareValues(actual: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected
      case 'ne':
        return actual !== expected
      case 'gt':
        return Number(actual) > Number(expected)
      case 'gte':
        return Number(actual) >= Number(expected)
      case 'lt':
        return Number(actual) < Number(expected)
      case 'lte':
        return Number(actual) <= Number(expected)
      case 'contains':
        return String(actual).includes(String(expected))
      case 'in':
        return Array.isArray(expected) && expected.includes(actual)
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual)
      default:
        return false
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current: any, key) => current?.[key], obj)
  }

  /**
   * Initialize step executors
   */
  private initializeStepExecutors(): void {
    // Register built-in step executors
    this.stepExecutors.set('data-entry', new DataEntryStepExecutor())
    this.stepExecutors.set('document-gen', new DocumentGenerationStepExecutor())
    this.stepExecutors.set('decision', new DecisionStepExecutor())
    this.stepExecutors.set('integration', new IntegrationStepExecutor(this.integrationService))
    this.stepExecutors.set('approval', new ApprovalStepExecutor())
    this.stepExecutors.set('notification', new NotificationStepExecutor())
  }

  /**
   * Emit event to registered handlers
   */
  private emitEvent(eventType: string, data: unknown): void {
    const handlers = this.eventHandlers.get(eventType) || []
    handlers.forEach((handler) => {
      try {
        handler(data)
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error)
      }
    })
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: Function): void {
    const handlers = this.eventHandlers.get(eventType) || []
    handlers.push(handler)
    this.eventHandlers.set(eventType, handlers)
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID()
  }

  /**
   * Get workflow by ID (placeholder - would fetch from database)
   */
  private async getWorkflow(workflowId: string): Promise<Workflow> {
    // This would fetch from database in real implementation
    throw new Error('Not implemented')
  }
}

// Abstract base class for step executors
abstract class StepExecutor {
  abstract execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void>
}

// Implementation would go here for each step type
class DataEntryStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    // Implementation for data entry steps
  }
}

class DocumentGenerationStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    // Implementation for document generation
  }
}

class DecisionStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    // Implementation for decision logic
  }
}

class IntegrationStepExecutor extends StepExecutor {
  constructor(private integrationService: IntegrationService) {
    super()
  }

  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    // Implementation for integration steps
  }
}

class ApprovalStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    // Implementation for approval steps
  }
}

class NotificationStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    // Implementation for notification steps
  }
}

// Service interfaces (would be implemented separately)
interface ExecutionTracker {
  create(execution: WorkflowExecution): Promise<void>
  update(execution: WorkflowExecution): Promise<void>
}

interface IntegrationService {
  executeIntegration(config: any, data: any): Promise<any>
}
