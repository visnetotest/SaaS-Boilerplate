import { WorkflowExecution, WorkflowStep } from '../../features/workflow-automation/types'

/**
 * Step Executor Service
 * Handles execution of individual workflow steps
 */
export class StepExecutorService {
  private executors = new Map<string, StepExecutor>()

  constructor() {
    this.registerBuiltinExecutors()
  }

  /**
   * Execute a workflow step
   */
  async executeStep(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    const executor = this.executors.get(step.type)

    if (!executor) {
      throw new Error(`No executor found for step type: ${step.type}`)
    }

    // Validate step configuration
    this.validateStep(step)

    // Execute step with timeout
    const timeout = step.timeout || 300 // 5 minutes default
    await this.executeWithTimeout(() => executor.execute(step, execution), timeout * 1000)

    // Log step execution
    console.log(`Step executed: ${step.id} (${step.type}) for execution: ${execution.id}`)
  }

  /**
   * Register a step executor
   */
  registerExecutor(type: string, executor: StepExecutor): void {
    this.executors.set(type, executor)
  }

  /**
   * Get all registered executor types
   */
  getExecutorTypes(): string[] {
    return Array.from(this.executors.keys())
  }

  /**
   * Validate step configuration
   */
  private validateStep(step: WorkflowStep): void {
    if (!step.id || !step.name || !step.type) {
      throw new Error('Step must have id, name, and type')
    }

    const executor = this.executors.get(step.type)
    if (!executor) {
      throw new Error(`Invalid step type: ${step.type}`)
    }

    // Let the executor validate its specific configuration
    executor.validateConfig(step.config)
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
   * Register built-in step executors
   */
  private registerBuiltinExecutors(): void {
    this.registerExecutor('data-entry', new DataEntryStepExecutor())
    this.registerExecutor('document-gen', new DocumentGenerationStepExecutor())
    this.registerExecutor('decision', new DecisionStepExecutor())
    this.registerExecutor('integration', new IntegrationStepExecutor())
    this.registerExecutor('approval', new ApprovalStepExecutor())
    this.registerExecutor('notification', new NotificationStepExecutor())
  }
}

/**
 * Abstract base class for step executors
 */
export abstract class StepExecutor {
  /**
   * Execute the step
   */
  abstract execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void>

  /**
   * Validate step configuration
   */
  abstract validateConfig(config: Record<string, unknown>): void

  /**
   * Get step configuration schema
   */
  abstract getConfigSchema(): Record<string, unknown>
}

/**
 * Data Entry Step Executor
 * Handles user input and data collection
 */
export class DataEntryStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    const config = step.config as unknown as DataEntryConfig

    // In a real implementation, this would:
    // 1. Create a data entry form based on the schema
    // 2. Wait for user input
    // 3. Validate the input
    // 4. Store the data in execution.data

    // For now, simulate data entry
    const inputData = await this.collectUserData(config, execution)

    // Validate input data
    this.validateInputData(inputData, config)

    // Store in execution data
    execution.data[config.dataKey || 'userInput'] = inputData
  }

  validateConfig(config: Record<string, unknown>): void {
    const dataEntryConfig = config as unknown as DataEntryConfig

    if (!dataEntryConfig.fields || !Array.isArray(dataEntryConfig.fields)) {
      throw new Error('Data entry step must have fields array')
    }

    for (const field of dataEntryConfig.fields) {
      if (!field.name || !field.type) {
        throw new Error('Each field must have name and type')
      }
    }
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      required: ['fields'],
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'type'],
            properties: {
              name: { type: 'string' },
              type: {
                type: 'string',
                enum: ['text', 'number', 'email', 'date', 'select', 'checkbox'],
              },
              label: { type: 'string' },
              required: { type: 'boolean' },
              options: { type: 'array', items: { type: 'string' } },
              validation: { type: 'object' },
            },
          },
        },
        dataKey: { type: 'string' },
        description: { type: 'string' },
      },
    }
  }

  private async collectUserData(
    config: DataEntryConfig,
    execution: WorkflowExecution
  ): Promise<Record<string, unknown>> {
    // In a real implementation, this would present a form to the user
    // For now, return mock data
    const data: Record<string, unknown> = {}

    for (const field of config.fields) {
      data[field.name] = this.generateMockData(field)
    }

    return data
  }

  private validateInputData(data: Record<string, unknown>, config: DataEntryConfig): void {
    for (const field of config.fields) {
      const value = data[field.name]

      if (field.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Required field ${field.name} is missing`)
      }

      if (value !== undefined && value !== null) {
        this.validateFieldValue(value, field)
      }
    }
  }

  private validateFieldValue(value: unknown, field: DataEntryField): void {
    switch (field.type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(String(value))) {
          throw new Error(`Invalid email format for field ${field.name}`)
        }
        break
      case 'number':
        if (isNaN(Number(value))) {
          throw new Error(`Invalid number for field ${field.name}`)
        }
        break
      // Add more validations as needed
    }
  }

  private generateMockData(field: DataEntryField): unknown {
    switch (field.type) {
      case 'text':
        return `Sample ${field.name}`
      case 'number':
        return 42
      case 'email':
        return `user@example.com`
      case 'date':
        return new Date().toISOString().split('T')[0]
      case 'select':
        return field.options?.[0] || ''
      case 'checkbox':
        return false
      default:
        return null
    }
  }
}

/**
 * Document Generation Step Executor
 * Generates documents from templates
 */
export class DocumentGenerationStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    const config = step.config as unknown as DocumentGenConfig

    // Generate document from template
    const document = await this.generateDocument(config, execution)

    // Store document reference
    execution.data[config.outputKey || 'document'] = {
      url: document.url,
      name: document.name,
      type: config.format || 'pdf',
      createdAt: new Date(),
    }
  }

  validateConfig(config: Record<string, unknown>): void {
    const docConfig = config as unknown as DocumentGenConfig

    if (!docConfig.template) {
      throw new Error('Document generation step must have a template')
    }
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      required: ['template'],
      properties: {
        template: { type: 'string' },
        format: { type: 'string', enum: ['pdf', 'docx', 'html'] },
        outputKey: { type: 'string' },
        variables: { type: 'object' },
      },
    }
  }

  private async generateDocument(
    config: DocumentGenConfig,
    execution: WorkflowExecution
  ): Promise<{ url: string; name: string }> {
    // In a real implementation, this would:
    // 1. Load the template
    // 2. Replace variables with execution data
    // 3. Generate the document in the specified format
    // 4. Store it and return a URL

    return {
      url: `https://example.com/documents/${execution.id}-${Date.now()}.${config.format || 'pdf'}`,
      name: `${config.template.replace(/\.[^/.]+$/, '')}_${execution.id}.${config.format || 'pdf'}`,
    }
  }
}

/**
 * Decision Step Executor
 * Evaluates conditions and determines next steps
 */
export class DecisionStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    const config = step.config as unknown as DecisionConfig

    // Evaluate conditions
    const result = this.evaluateConditions(config.conditions, execution)

    // Store decision result
    execution.data[config.outputKey || 'decision'] = {
      result,
      evaluatedAt: new Date(),
      conditions: config.conditions,
    }
  }

  validateConfig(config: Record<string, unknown>): void {
    const decisionConfig = config as unknown as DecisionConfig

    if (!decisionConfig.conditions || !Array.isArray(decisionConfig.conditions)) {
      throw new Error('Decision step must have conditions array')
    }
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      required: ['conditions'],
      properties: {
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['field', 'operator', 'value'],
            properties: {
              field: { type: 'string' },
              operator: {
                type: 'string',
                enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'not_in'],
              },
              value: {},
              logicalOperator: { type: 'string', enum: ['AND', 'OR'] },
            },
          },
        },
        outputKey: { type: 'string' },
      },
    }
  }

  private evaluateConditions(conditions: any[], execution: WorkflowExecution): boolean {
    if (conditions.length === 0) return true

    let result = this.evaluateCondition(conditions[0], execution)

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i]
      const conditionResult = this.evaluateCondition(condition, execution)

      if (condition.logicalOperator === 'OR') {
        result = result || conditionResult
      } else {
        result = result && conditionResult
      }
    }

    return result
  }

  private evaluateCondition(condition: any, execution: WorkflowExecution): boolean {
    const value = this.getNestedValue(execution.data, condition.field)
    return this.compareValues(value, condition.operator, condition.value)
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current: any, key) => current?.[key], obj)
  }

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
}

/**
 * Integration Step Executor
 * Executes external API integrations
 */
export class IntegrationStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    const config = step.config as unknown as IntegrationConfig

    // Execute integration
    const result = await this.executeIntegration(config, execution)

    // Store result
    execution.data[config.outputKey || 'integration'] = {
      success: true,
      data: result,
      executedAt: new Date(),
    }
  }

  validateConfig(config: Record<string, unknown>): void {
    const integrationConfig = config as unknown as IntegrationConfig

    if (!integrationConfig.url) {
      throw new Error('Integration step must have a URL')
    }
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        headers: { type: 'object' },
        body: { type: 'object' },
        outputKey: { type: 'string' },
      },
    }
  }

  private async executeIntegration(
    config: IntegrationConfig,
    execution: WorkflowExecution
  ): Promise<unknown> {
    // In a real implementation, this would make HTTP requests
    // For now, return mock data
    return {
      status: 'success',
      message: 'Integration executed successfully',
      timestamp: new Date(),
    }
  }
}

/**
 * Approval Step Executor
 * Handles approval workflows
 */
export class ApprovalStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    const config = step.config as unknown as ApprovalConfig

    // Create approval request
    const approval = {
      id: `approval_${Date.now()}`,
      stepId: step.id,
      userId: execution.context.userId,
      status: 'pending' as const,
      approvers: config.approvers,
      timestamp: new Date(),
    }

    // Store approval in metadata
    execution.metadata.approvals.push(approval)

    // Emit approval request event
    // In a real implementation, this would send notifications
  }

  validateConfig(config: Record<string, unknown>): void {
    const approvalConfig = config as unknown as ApprovalConfig

    if (!approvalConfig.approvers || !Array.isArray(approvalConfig.approvers)) {
      throw new Error('Approval step must have approvers array')
    }
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      required: ['approvers'],
      properties: {
        approvers: {
          type: 'array',
          items: { type: 'string' },
        },
        requireAll: { type: 'boolean' },
        timeout: { type: 'number' },
      },
    }
  }
}

/**
 * Notification Step Executor
 * Sends notifications via various channels
 */
export class NotificationStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    const config = step.config as unknown as NotificationConfig

    // Send notifications
    await this.sendNotifications(config, execution)

    // Store notification record
    execution.data[config.outputKey || 'notification'] = {
      sent: true,
      channels: config.channels,
      recipients: config.recipients,
      sentAt: new Date(),
    }
  }

  validateConfig(config: Record<string, unknown>): void {
    const notificationConfig = config as unknown as NotificationConfig

    if (!notificationConfig.recipients || !Array.isArray(notificationConfig.recipients)) {
      throw new Error('Notification step must have recipients array')
    }

    if (!notificationConfig.channels || !Array.isArray(notificationConfig.channels)) {
      throw new Error('Notification step must have channels array')
    }
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      required: ['recipients', 'channels'],
      properties: {
        recipients: { type: 'array', items: { type: 'string' } },
        channels: {
          type: 'array',
          items: { type: 'string', enum: ['email', 'sms', 'webhook', 'in-app'] },
        },
        subject: { type: 'string' },
        message: { type: 'string' },
        outputKey: { type: 'string' },
      },
    }
  }

  private async sendNotifications(
    config: NotificationConfig,
    execution: WorkflowExecution
  ): Promise<void> {
    // In a real implementation, this would send actual notifications
    console.log(
      `Sending ${config.channels.join(', ')} notifications to ${config.recipients.join(', ')}`
    )
  }
}

// Type definitions for step configurations
interface DataEntryConfig {
  fields: DataEntryField[]
  dataKey?: string
  description?: string
}

interface DataEntryField {
  name: string
  type: 'text' | 'number' | 'email' | 'date' | 'select' | 'checkbox'
  label?: string
  required?: boolean
  options?: string[]
  validation?: Record<string, unknown>
}

interface DocumentGenConfig {
  template: string
  format?: 'pdf' | 'docx' | 'html'
  outputKey?: string
  variables?: Record<string, unknown>
}

interface DecisionConfig {
  conditions: any[]
  outputKey?: string
}

interface IntegrationConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: Record<string, unknown>
  outputKey?: string
}

interface ApprovalConfig {
  approvers: string[]
  requireAll?: boolean
  timeout?: number
}

interface NotificationConfig {
  recipients: string[]
  channels: ('email' | 'sms' | 'webhook' | 'in-app')[]
  subject?: string
  message?: string
  outputKey?: string
}
