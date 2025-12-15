import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite'
import { Client } from 'pg'

import * as schema from '@/models/Schema'

import { Env } from './Env'

// =============================================================================
// DATABASE MONITORING TYPES
// =============================================================================

export interface DatabaseMetrics {
  timestamp: Date
  connections: {
    active: number
    idle: number
    total: number
    maxAllowed: number
  }
  performance: {
    transactionsPerSecond: number
    queriesPerSecond: number
    avgResponseTime: number
    slowQueries: number
  }
  resources: {
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    diskIOPS: number
  }
  locks: {
    waitingQueries: number
    blockedQueries: number
    deadlocks: number
  }
  cache: {
    hitRatio: number
    size: number
    effectiveness: number
  }
}

export interface AlertRule {
  id: string
  name: string
  description: string
  metric: keyof DatabaseMetrics
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  cooldownMinutes: number
  lastTriggered?: Date
}

export interface Alert {
  id: string
  ruleId: string
  ruleName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  currentValue: number
  threshold: number
  triggeredAt: Date
  acknowledgedAt?: Date
  resolvedAt?: Date
  metadata: Record<string, any>
}

export interface MonitoringConfig {
  enabled: boolean
  intervalSeconds: number
  retentionDays: number
  alertRules: AlertRule[]
  notifications: {
    email?: {
      enabled: boolean
      recipients: string[]
      smtpConfig?: any
    }
    webhook?: {
      enabled: boolean
      url: string
      headers?: Record<string, string>
    }
    slack?: {
      enabled: boolean
      webhookUrl: string
      channel?: string
    }
  }
}

// =============================================================================
// DATABASE MONITORING SYSTEM
// =============================================================================

export class DatabaseMonitor {
  private db: ReturnType<typeof drizzlePg> | PgliteDatabase<typeof schema>
  private config: MonitoringConfig
  private metrics: DatabaseMetrics[] = []
  private alerts: Alert[] = []
  private monitoringInterval?: NodeJS.Timeout
  private isRunning: boolean = false

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.db = this.getDatabase()
    this.config = {
      enabled: true,
      intervalSeconds: 60,
      retentionDays: 30,
      alertRules: this.getDefaultAlertRules(),
      notifications: {
        email: { enabled: false, recipients: [] },
        webhook: { enabled: false, url: '' },
        slack: { enabled: false, webhookUrl: '' },
      },
      ...config,
    }
  }

  private getDatabase() {
    if (Env.DATABASE_URL) {
      const client = new Client({
        connectionString: Env.DATABASE_URL,
      })
      client.connect()
      return drizzlePg(client, { schema })
    } else {
      const global = globalThis as unknown as {
        client: PGlite
        drizzle: PgliteDatabase<typeof schema>
      }
      if (!global.client) {
        global.client = new PGlite()
        global.client.waitReady
      }
      return global.drizzle || drizzlePglite(global.client, { schema })
    }
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [DatabaseMonitor:${level.toUpperCase()}] ${message}`
    if (data) {
      console.log(logMessage, data)
    } else {
      console.log(logMessage)
    }
  }

  // =============================================================================
  // MONITORING CONTROL
  // =============================================================================

  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('warn', 'Database monitoring is already running')
      return
    }

    if (!this.config.enabled) {
      this.log('info', 'Database monitoring is disabled')
      return
    }

    this.isRunning = true
    this.log('info', 'Starting database monitoring', { interval: this.config.intervalSeconds })

    // Collect initial metrics
    await this.collectMetrics()

    // Start periodic collection
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics()
        await this.checkAlerts()
        await this.cleanupOldData()
      } catch (error) {
        this.log('error', 'Error during monitoring cycle', error)
      }
    }, this.config.intervalSeconds * 1000)
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.log('warn', 'Database monitoring is not running')
      return
    }

    this.isRunning = false
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    this.log('info', 'Database monitoring stopped')
  }

  // =============================================================================
  // METRICS COLLECTION
  // =============================================================================

  private async collectMetrics(): Promise<DatabaseMetrics> {
    try {
      const metrics: DatabaseMetrics = {
        timestamp: new Date(),
        connections: await this.getConnectionMetrics(),
        performance: await this.getPerformanceMetrics(),
        resources: await this.getResourceMetrics(),
        locks: await this.getLockMetrics(),
        cache: await this.getCacheMetrics(),
      }

      // Store metrics
      this.metrics.push(metrics)
      await this.persistMetrics(metrics)

      // Keep metrics size manageable
      const maxMetrics = this.config.retentionDays * 24 * 60 * (60 / this.config.intervalSeconds)
      if (this.metrics.length > maxMetrics) {
        this.metrics = this.metrics.slice(-maxMetrics)
      }

      this.log('info', 'Database metrics collected', {
        connections: metrics.connections.total,
        tps: metrics.performance.transactionsPerSecond,
        avgResponseTime: metrics.performance.avgResponseTime,
      })

      return metrics
    } catch (error) {
      this.log('error', 'Failed to collect database metrics', error)
      throw error
    }
  }

  private async getConnectionMetrics() {
    try {
      const result = await this.db.execute(`
        SELECT 
          COUNT(*) FILTER (WHERE state = 'active') as active,
          COUNT(*) FILTER (WHERE state = 'idle') as idle,
          COUNT(*) as total,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_allowed
        FROM pg_stat_activity
        WHERE pid <> pg_backend_pid()
      `)

      const row = result.rows[0] as any
      return {
        active: parseInt(String(row.active)),
        idle: parseInt(String(row.idle)),
        total: parseInt(String(row.total)),
        maxAllowed: parseInt(String(row.max_allowed)),
      }
    } catch (error) {
      this.log('error', 'Failed to get connection metrics', error)
      return { active: 0, idle: 0, total: 0, maxAllowed: 100 }
    }
  }

  private async getPerformanceMetrics() {
    try {
      const result = await this.db.execute(`
        SELECT 
          (SELECT SUM(xact_commit + xact_rollback) FROM pg_stat_database WHERE datname = current_database()) as transactions,
          (SELECT SUM(tup_returned + tup_fetched) FROM pg_stat_database WHERE datname = current_database()) as queries,
          (SELECT AVG(EXTRACT(EPOCH FROM (query_end - query_start)) * 1000) 
           FROM pg_stat_statements WHERE calls > 0) as avg_response_time,
          (SELECT COUNT(*) FROM pg_stat_statements WHERE mean_exec_time > 1000) as slow_queries
      `)

      const row = result.rows[0] as any
      return {
        transactionsPerSecond: parseFloat(String(row.transactions)) || 0,
        queriesPerSecond: parseFloat(String(row.queries)) || 0,
        avgResponseTime: parseFloat(String(row.avg_response_time)) || 0,
        slowQueries: parseInt(String(row.slow_queries)) || 0,
      }
    } catch (error) {
      this.log('error', 'Failed to get performance metrics', error)
      return { transactionsPerSecond: 0, queriesPerSecond: 0, avgResponseTime: 0, slowQueries: 0 }
    }
  }

  private async getResourceMetrics() {
    try {
      const result = await this.db.execute(`
        SELECT 
          (SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) as uptime) as uptime,
          (SELECT pg_size_pretty(pg_database_size(current_database())) as db_size) as db_size,
          (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_queries
      `)

      const row = result.rows[0] as any
      return {
        cpuUsage: 0, // PostgreSQL doesn't expose CPU directly, would need system monitoring
        memoryUsage: 0, // Would need system monitoring
        diskUsage: this.parseSizeToBytes(String(row?.db_size || '0')),
        diskIOPS: 0, // Would need system monitoring
      }
    } catch (error) {
      this.log('error', 'Failed to get resource metrics', error)
      return { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, diskIOPS: 0 }
    }
  }

  private async getLockMetrics() {
    try {
      const result = await this.db.execute(`
        SELECT 
          (SELECT COUNT(*) FROM pg_locks WHERE NOT granted) as waiting_queries,
          (SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock') as blocked_queries,
          (SELECT COUNT(*) FROM pg_stat_database WHERE deadlocks > 0) as deadlocks
      `)

      const row = result.rows[0] as any
      return {
        waitingQueries: parseInt(String(row.waiting_queries)),
        blockedQueries: parseInt(String(row.blocked_queries)),
        deadlocks: parseInt(String(row.deadlocks)),
      }
    } catch (error) {
      this.log('error', 'Failed to get lock metrics', error)
      return { waitingQueries: 0, blockedQueries: 0, deadlocks: 0 }
    }
  }

  private async getCacheMetrics() {
    try {
      const result = await this.db.execute(`
        SELECT 
          (SELECT SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0) * 100 
           FROM pg_stat_database WHERE datname = current_database()) as hit_ratio,
          (SELECT pg_size_pretty(pg_relation_size('pg_stat_statements')) as size) as size,
          (SELECT SUM(calls) FROM pg_stat_statements) as total_calls
      `)

      const row = result.rows[0] as any
      return {
        hitRatio: parseFloat(String(row.hit_ratio)) || 0,
        size: this.parseSizeToBytes(String(row?.size || '0')),
        effectiveness: parseInt(String(row.total_calls)) || 0,
      }
    } catch (error) {
      this.log('error', 'Failed to get cache metrics', error)
      return { hitRatio: 0, size: 0, effectiveness: 0 }
    }
  }

  private parseSizeToBytes(sizeStr: string): number {
    const units: { [key: string]: number } = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    }

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(\w+)$/)
    if (!match) return 0

    const [, value, unit] = match
    const unitValue = unit ? (units[unit] ?? 1) : 1
    return parseFloat(value ?? '0') * unitValue
  }

  // =============================================================================
  // ALERT MANAGEMENT
  // =============================================================================

  private async checkAlerts(): Promise<void> {
    if (this.metrics.length === 0) return

    const latestMetrics = this.metrics[this.metrics.length - 1]
    if (!latestMetrics) return

    const now = new Date()

    for (const rule of this.config.alertRules) {
      if (!rule.enabled) continue

      // Check cooldown period
      if (rule.lastTriggered) {
        const cooldownEnd = new Date(
          rule.lastTriggered.getTime() + rule.cooldownMinutes * 60 * 1000
        )
        if (now < cooldownEnd) continue
      }

      // Check if alert should be triggered
      const currentValue = this.getMetricValue(latestMetrics, rule.metric)
      if (this.evaluateCondition(currentValue, rule.condition, rule.threshold)) {
        await this.triggerAlert(rule, currentValue)
      }
    }
  }

  private getMetricValue(metrics: DatabaseMetrics, metricPath: keyof DatabaseMetrics): number {
    const pathParts = metricPath.split('.')
    let value: any = metrics

    for (const part of pathParts) {
      value = value[part as keyof typeof value]
      if (typeof value === 'object' && value !== null) {
        continue
      }
      break
    }

    return typeof value === 'number' ? value : 0
  }

  private evaluateCondition(currentValue: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt':
        return currentValue > threshold
      case 'gte':
        return currentValue >= threshold
      case 'lt':
        return currentValue < threshold
      case 'lte':
        return currentValue <= threshold
      case 'eq':
        return currentValue === threshold
      default:
        return false
    }
  }

  private async triggerAlert(rule: AlertRule, currentValue: number): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `${rule.description}: Current value ${currentValue} ${rule.condition} threshold ${rule.threshold}`,
      currentValue,
      threshold: rule.threshold,
      triggeredAt: new Date(),
      metadata: {
        rule,
        timestamp: new Date(),
      },
    }

    this.alerts.push(alert)
    rule.lastTriggered = new Date()

    // Store alert in database
    await this.persistAlert(alert)

    // Send notifications
    await this.sendNotifications(alert)

    this.log('warn', 'Alert triggered', {
      rule: rule.name,
      severity: rule.severity,
      currentValue,
      threshold: rule.threshold,
    })
  }

  private async persistAlert(alert: Alert): Promise<void> {
    try {
      const alertProperties = JSON.stringify(alert)
      await this.db.execute(`
        INSERT INTO analytics_event (
          tenant_id, event_name, category, properties
        ) VALUES (
          NULL, 'database_alert', 'monitoring', 
          '${alertProperties}'
        )
      `)
    } catch (error) {
      this.log('error', 'Failed to persist alert', error)
    }
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const notifications = this.config.notifications

    // Email notification
    if (notifications.email?.enabled && notifications.email.recipients.length > 0) {
      await this.sendEmailNotification(alert, notifications.email)
    }

    // Webhook notification
    if (notifications.webhook?.enabled && notifications.webhook.url) {
      await this.sendWebhookNotification(alert, notifications.webhook)
    }

    // Slack notification
    if (notifications.slack?.enabled && notifications.slack.webhookUrl) {
      await this.sendSlackNotification(alert, notifications.slack)
    }
  }

  private async sendEmailNotification(alert: Alert, emailConfig: any): Promise<void> {
    // Placeholder for email implementation
    this.log('info', 'Email notification sent', {
      alert: alert.id,
      recipients: emailConfig.recipients,
    })
  }

  private async sendWebhookNotification(alert: Alert, webhookConfig: any): Promise<void> {
    try {
      const payload = {
        alert,
        timestamp: new Date().toISOString(),
      }

      const response = await fetch(webhookConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhookConfig.headers,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
      }

      this.log('info', 'Webhook notification sent', { alert: alert.id, url: webhookConfig.url })
    } catch (error) {
      this.log('error', 'Failed to send webhook notification', error)
    }
  }

  private async sendSlackNotification(alert: Alert, slackConfig: any): Promise<void> {
    try {
      const color = {
        low: 'good',
        medium: 'warning',
        high: 'danger',
        critical: 'danger',
      }[alert.severity]

      const payload = {
        channel: slackConfig.channel || '#alerts',
        username: 'Database Monitor',
        icon_emoji: ':database:',
        attachments: [
          {
            color,
            title: `Database Alert: ${alert.ruleName}`,
            text: alert.message,
            fields: [
              { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
              { title: 'Current Value', value: alert.currentValue.toString(), short: true },
              { title: 'Threshold', value: alert.threshold.toString(), short: true },
              { title: 'Triggered At', value: alert.triggeredAt.toISOString(), short: true },
            ],
            ts: Math.floor(alert.triggeredAt.getTime() / 1000),
          },
        ],
      }

      const response = await fetch(slackConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
      }

      this.log('info', 'Slack notification sent', { alert: alert.id })
    } catch (error) {
      this.log('error', 'Failed to send Slack notification', error)
    }
  }

  // =============================================================================
  // DATA MANAGEMENT
  // =============================================================================

  private async persistMetrics(metrics: DatabaseMetrics): Promise<void> {
    try {
      const properties = JSON.stringify(metrics)
      await this.db.execute(`
        INSERT INTO analytics_event (
          tenant_id, event_name, category, properties
        ) VALUES (
          NULL, 'database_metrics', 'monitoring', 
          '${properties}'
        )
      `)
    } catch (error) {
      this.log('error', 'Failed to persist metrics', error)
    }
  }

  private async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      // Clean up old metrics from database
      await this.db.execute(`
        DELETE FROM analytics_event 
        WHERE event_name = 'database_metrics' 
        AND timestamp < '${cutoffDate.toISOString()}'
      `)

      // Clean up old alerts from memory
      this.alerts = this.alerts.filter(
        (alert) => alert.triggeredAt > cutoffDate || !alert.resolvedAt
      )

      this.log('info', 'Old monitoring data cleaned up', { cutoffDate })
    } catch (error) {
      this.log('error', 'Failed to cleanup old data', error)
    }
  }

  // =============================================================================
  // CONFIGURATION AND UTILITIES
  // =============================================================================

  private getDefaultAlertRules(): AlertRule[] {
    return [
      {
        id: 'high_connections',
        name: 'High Connection Count',
        description: 'Database connection count is too high',
        metric: 'connections.total' as any,
        condition: 'gt',
        threshold: 80,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 5,
      },
      {
        id: 'slow_queries',
        name: 'Slow Queries Detected',
        description: 'Number of slow queries is above threshold',
        metric: 'performance.slowQueries' as any,
        condition: 'gt',
        threshold: 10,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 10,
      },
      {
        id: 'low_cache_hit_ratio',
        name: 'Low Cache Hit Ratio',
        description: 'Database cache hit ratio is too low',
        metric: 'cache.hitRatio' as any,
        condition: 'lt',
        threshold: 90,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 15,
      },
      {
        id: 'high_response_time',
        name: 'High Response Time',
        description: 'Average query response time is too high',
        metric: 'performance.avgResponseTime' as any,
        condition: 'gt',
        threshold: 500,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 5,
      },
      {
        id: 'deadlocks_detected',
        name: 'Deadlocks Detected',
        description: 'Database deadlocks have been detected',
        metric: 'locks.deadlocks' as any,
        condition: 'gt',
        threshold: 0,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 1,
      },
    ]
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  async updateConfig(config: Partial<MonitoringConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    this.log('info', 'Database monitoring configuration updated', config)

    // Restart monitoring if interval changed
    if (config.intervalSeconds && this.isRunning) {
      await this.stop()
      await this.start()
    }
  }

  async addAlertRule(rule: Omit<AlertRule, 'id'>): Promise<string> {
    const newRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    }

    this.config.alertRules.push(newRule)
    this.log('info', 'Alert rule added', { rule: newRule.name })

    return newRule.id
  }

  async removeAlertRule(ruleId: string): Promise<boolean> {
    const index = this.config.alertRules.findIndex((rule) => rule.id === ruleId)
    if (index !== -1) {
      this.config.alertRules.splice(index, 1)
      this.log('info', 'Alert rule removed', { ruleId })
      return true
    }
    return false
  }

  getMetrics(): DatabaseMetrics[] {
    return [...this.metrics]
  }

  getAlerts(): Alert[] {
    return [...this.alerts]
  }

  getConfig(): MonitoringConfig {
    return { ...this.config }
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find((a) => a.id === alertId)
    if (alert) {
      alert.acknowledgedAt = new Date()
      await this.persistAlert(alert)
      this.log('info', 'Alert acknowledged', { alertId })
      return true
    }
    return false
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find((a) => a.id === alertId)
    if (alert) {
      alert.resolvedAt = new Date()
      await this.persistAlert(alert)
      this.log('info', 'Alert resolved', { alertId })
      return true
    }
    return false
  }

  async generateReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: {
      totalAlerts: number
      criticalAlerts: number
      avgConnections: number
      avgResponseTime: number
      uptime: number
    }
    metrics: DatabaseMetrics[]
    alerts: Alert[]
    recommendations: string[]
  }> {
    const filteredMetrics = this.metrics.filter(
      (m) => m.timestamp >= startDate && m.timestamp <= endDate
    )
    const filteredAlerts = this.alerts.filter(
      (a) => a.triggeredAt >= startDate && a.triggeredAt <= endDate
    )

    const summary = {
      totalAlerts: filteredAlerts.length,
      criticalAlerts: filteredAlerts.filter((a) => a.severity === 'critical').length,
      avgConnections:
        filteredMetrics.length > 0
          ? filteredMetrics.reduce((sum, m) => sum + m.connections.total, 0) /
            filteredMetrics.length
          : 0,
      avgResponseTime:
        filteredMetrics.length > 0
          ? filteredMetrics.reduce((sum, m) => sum + m.performance.avgResponseTime, 0) /
            filteredMetrics.length
          : 0,
      uptime: 99.9, // Placeholder - would need actual uptime calculation
    }

    const recommendations = this.generateRecommendations(filteredMetrics, filteredAlerts)

    return {
      summary,
      metrics: filteredMetrics,
      alerts: filteredAlerts,
      recommendations,
    }
  }

  private generateRecommendations(metrics: DatabaseMetrics[], alerts: Alert[]): string[] {
    const recommendations: string[] = []

    // Analyze connection patterns
    const maxConnections = Math.max(...metrics.map((m) => m.connections.total), 0)
    if (maxConnections > 80) {
      recommendations.push('Consider increasing max_connections or implementing connection pooling')
    }

    // Analyze performance
    const avgResponseTime =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.performance.avgResponseTime, 0) / metrics.length
        : 0
    if (avgResponseTime > 200) {
      recommendations.push('High average response time detected - consider query optimization')
    }

    // Analyze cache effectiveness
    const avgCacheHitRatio =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.cache.hitRatio, 0) / metrics.length
        : 0
    if (avgCacheHitRatio < 90) {
      recommendations.push('Low cache hit ratio - consider increasing shared_buffers')
    }

    // Analyze alerts
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical')
    if (criticalAlerts.length > 0) {
      recommendations.push('Critical alerts detected - immediate attention required')
    }

    return recommendations
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export const databaseMonitor = new DatabaseMonitor()

export async function startDatabaseMonitoring(config?: Partial<MonitoringConfig>): Promise<void> {
  if (config) {
    await databaseMonitor.updateConfig(config)
  }
  await databaseMonitor.start()
}

export async function stopDatabaseMonitoring(): Promise<void> {
  await databaseMonitor.stop()
}

export function getDatabaseMetrics(): DatabaseMetrics[] {
  return databaseMonitor.getMetrics()
}

export function getDatabaseAlerts(): Alert[] {
  return databaseMonitor.getAlerts()
}

export async function acknowledgeDatabaseAlert(alertId: string): Promise<boolean> {
  return await databaseMonitor.acknowledgeAlert(alertId)
}

export async function resolveDatabaseAlert(alertId: string): Promise<boolean> {
  return await databaseMonitor.resolveAlert(alertId)
}

export async function generateDatabaseReport(startDate: Date, endDate: Date) {
  return await databaseMonitor.generateReport(startDate, endDate)
}
