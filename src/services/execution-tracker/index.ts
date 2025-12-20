import {
  ApiResponse,
  ExecutionMetadata,
  WorkflowExecution,
} from '../../features/workflow-automation/types'

/**
 * Execution Tracker Service
 * Tracks and manages workflow execution state
 */
export class ExecutionTracker {
  private executions = new Map<string, WorkflowExecution>()
  private eventListeners = new Map<string, Function[]>()

  /**
   * Create a new workflow execution record
   */
  async create(execution: WorkflowExecution): Promise<void> {
    // Store in memory (in production, this would be database)
    this.executions.set(execution.id, execution)

    // Emit creation event
    this.emitEvent('execution.created', execution)

    // Log execution start
    console.log(`Execution started: ${execution.id} for workflow: ${execution.workflowId}`)
  }

  /**
   * Update an existing execution
   */
  async update(execution: WorkflowExecution): Promise<void> {
    const existing = this.executions.get(execution.id)
    if (!existing) {
      throw new Error(`Execution not found: ${execution.id}`)
    }

    // Store updated execution
    this.executions.set(execution.id, execution)

    // Emit update event
    this.emitEvent('execution.updated', execution)

    // Log important status changes
    if (existing.status !== execution.status) {
      console.log(
        `Execution ${execution.id} status changed: ${existing.status} -> ${execution.status}`
      )
    }
  }

  /**
   * Get execution by ID
   */
  async get(executionId: string): Promise<WorkflowExecution | null> {
    return this.executions.get(executionId) || null
  }

  /**
   * Get all executions for a workflow
   */
  async getWorkflowExecutions(workflowId: string): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values()).filter(
      (execution) => execution.workflowId === workflowId
    )
  }

  /**
   * Get executions by status
   */
  async getExecutionsByStatus(status: WorkflowExecution['status']): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values()).filter((execution) => execution.status === status)
  }

  /**
   * Get active executions (running or paused)
   */
  async getActiveExecutions(): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values()).filter((execution) =>
      ['running', 'paused'].includes(execution.status)
    )
  }

  /**
   * Get executions for a tenant
   */
  async getTenantExecutions(tenantId: string): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values()).filter(
      (execution) => execution.tenantId === tenantId
    )
  }

  /**
   * Get execution metrics
   */
  async getExecutionMetrics(workflowId?: string): Promise<{
    total: number
    completed: number
    failed: number
    running: number
    paused: number
    cancelled: number
    averageDuration: number
  }> {
    const executions = workflowId
      ? await this.getWorkflowExecutions(workflowId)
      : Array.from(this.executions.values())

    const completed = executions.filter((e) => e.status === 'completed')
    const averageDuration =
      completed.length > 0
        ? completed.reduce((sum, e) => sum + (e.duration || 0), 0) / completed.length
        : 0

    return {
      total: executions.length,
      completed: executions.filter((e) => e.status === 'completed').length,
      failed: executions.filter((e) => e.status === 'failed').length,
      running: executions.filter((e) => e.status === 'running').length,
      paused: executions.filter((e) => e.status === 'paused').length,
      cancelled: executions.filter((e) => e.status === 'cancelled').length,
      averageDuration,
    }
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(limit: number = 50, offset: number = 0): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(offset, offset + limit)
  }

  /**
   * Delete old executions (cleanup)
   */
  async cleanupOldExecutions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    let deletedCount = 0

    for (const [id, execution] of this.executions.entries()) {
      const isCompletedOrFailed = ['completed', 'failed', 'cancelled'].includes(execution.status)
      const isOlderThanCutoff = execution.endTime
        ? execution.endTime < cutoffDate
        : execution.startTime < cutoffDate

      if (isCompletedOrFailed && isOlderThanCutoff) {
        this.executions.delete(id)
        deletedCount++
      }
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old executions`)
    }

    return deletedCount
  }

  /**
   * Get execution statistics for dashboard
   */
  async getDashboardStats(tenantId?: string): Promise<{
    totalExecutions: number
    activeExecutions: number
    successRate: number
    averageExecutionTime: number
    executionsToday: number
    executionsThisWeek: number
    executionsThisMonth: number
  }> {
    const executions = tenantId
      ? await this.getTenantExecutions(tenantId)
      : Array.from(this.executions.values())

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const completed = executions.filter((e) => e.status === 'completed')
    const totalCompleted = completed.length
    const totalFinished = executions.filter((e) =>
      ['completed', 'failed', 'cancelled'].includes(e.status)
    ).length

    return {
      totalExecutions: executions.length,
      activeExecutions: executions.filter((e) => ['running', 'paused'].includes(e.status)).length,
      successRate: totalFinished > 0 ? (totalCompleted / totalFinished) * 100 : 0,
      averageExecutionTime:
        totalCompleted > 0
          ? completed.reduce((sum, e) => sum + (e.duration || 0), 0) / totalCompleted
          : 0,
      executionsToday: executions.filter((e) => e.startTime >= today).length,
      executionsThisWeek: executions.filter((e) => e.startTime >= weekAgo).length,
      executionsThisMonth: executions.filter((e) => e.startTime >= monthAgo).length,
    }
  }

  /**
   * Search executions
   */
  async searchExecutions(query: {
    workflowId?: string
    status?: WorkflowExecution['status']
    userId?: string
    startDate?: Date
    endDate?: Date
    tenantId?: string
  }): Promise<WorkflowExecution[]> {
    let executions = Array.from(this.executions.values())

    if (query.workflowId) {
      executions = executions.filter((e) => e.workflowId === query.workflowId)
    }

    if (query.status) {
      executions = executions.filter((e) => e.status === query.status)
    }

    if (query.userId) {
      executions = executions.filter((e) => e.context.userId === query.userId)
    }

    if (query.startDate) {
      executions = executions.filter((e) => e.startTime >= query.startDate!)
    }

    if (query.endDate) {
      executions = executions.filter((e) => e.startTime <= query.endDate!)
    }

    if (query.tenantId) {
      executions = executions.filter((e) => e.tenantId === query.tenantId)
    }

    return executions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  }

  /**
   * Get execution errors
   */
  async getExecutionErrors(limit: number = 100): Promise<
    Array<{
      executionId: string
      workflowId: string
      error: string
      timestamp: Date
      stepId?: string
    }>
  > {
    const failedExecutions = Array.from(this.executions.values())
      .filter((e) => e.status === 'failed' && e.error)
      .sort((a, b) => (b.endTime || b.startTime).getTime() - (a.endTime || a.startTime).getTime())
      .slice(0, limit)

    return failedExecutions.map((execution) => ({
      executionId: execution.id,
      workflowId: execution.workflowId,
      error: execution.error?.message || 'Unknown error',
      timestamp: execution.endTime || execution.startTime,
      stepId: execution.error?.stepId,
    }))
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event) || []
    listeners.push(callback)
    this.eventListeners.set(event, listeners)
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event) || []
    const index = listeners.indexOf(callback)
    if (index > -1) {
      listeners.splice(index, 1)
      this.eventListeners.set(event, listeners)
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach((listener) => {
      try {
        listener(data)
      } catch (error) {
        console.error(`Error in execution tracker event listener for ${event}:`, error)
      }
    })
  }

  /**
   * Get execution count by status for charts
   */
  async getExecutionCountByStatus(workflowId?: string): Promise<Record<string, number>> {
    const executions = workflowId
      ? await this.getWorkflowExecutions(workflowId)
      : Array.from(this.executions.values())

    const statusCounts: Record<string, number> = {}

    for (const execution of executions) {
      statusCounts[execution.status] = (statusCounts[execution.status] || 0) + 1
    }

    return statusCounts
  }

  /**
   * Get execution count over time for charts
   */
  async getExecutionCountOverTime(
    days: number = 30,
    workflowId?: string
  ): Promise<Array<{ date: string; completed: number; failed: number; total: number }>> {
    const executions = workflowId
      ? await this.getWorkflowExecutions(workflowId)
      : Array.from(this.executions.values())

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const dailyStats: Record<string, { completed: number; failed: number; total: number }> = {}

    // Initialize all days with zero
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateKey = date.toISOString().split('T')[0]
      dailyStats[dateKey] = { completed: 0, failed: 0, total: 0 }
    }

    // Count executions per day
    for (const execution of executions) {
      if (execution.startTime >= startDate) {
        const dateKey = execution.startTime.toISOString().split('T')[0]

        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = { completed: 0, failed: 0, total: 0 }
        }

        dailyStats[dateKey].total++

        if (execution.status === 'completed') {
          dailyStats[dateKey].completed++
        } else if (execution.status === 'failed') {
          dailyStats[dateKey].failed++
        }
      }
    }

    return Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}
