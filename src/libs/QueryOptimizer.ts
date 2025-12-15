import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite'
import { Client } from 'pg'

import * as schema from '@/models/Schema'

import { Env } from './Env'

// =============================================================================
// QUERY PERFORMANCE TYPES
// =============================================================================

export interface QueryMetrics {
  query: string
  executionTimeMs: number
  rowsAffected?: number
  timestamp: Date
  parameters?: any[]
  error?: string
  cacheHit?: boolean
  indexUsage?: IndexUsageInfo[]
}

export interface IndexUsageInfo {
  indexName: string
  tableName: string
  usageCount: number
  sizeBytes: number
  isUsed: boolean
}

export interface SlowQuery {
  query: string
  executionTimeMs: number
  frequency: number
  avgExecutionTimeMs: number
  maxExecutionTimeMs: number
  lastExecuted: Date
  parameters?: any[]
  suggestions: QueryOptimizationSuggestion[]
}

export interface QueryOptimizationSuggestion {
  type: 'index' | 'query_rewrite' | 'partition' | 'materialized_view'
  description: string
  impact: 'high' | 'medium' | 'low'
  estimatedImprovement: number // percentage
  sql?: string
}

export interface PerformanceReport {
  period: {
    start: Date
    end: Date
  }
  totalQueries: number
  avgExecutionTimeMs: number
  slowQueries: SlowQuery[]
  indexUsage: IndexUsageInfo[]
  topSlowQueries: SlowQuery[]
  recommendations: QueryOptimizationSuggestion[]
}

// =============================================================================
// QUERY OPTIMIZATION FRAMEWORK
// =============================================================================

export class QueryOptimizer {
  private db: ReturnType<typeof drizzlePg> | PgliteDatabase<typeof schema>
  private metrics: QueryMetrics[] = []
  private maxMetricsSize: number = 10000
  private slowQueryThreshold: number = 1000 // 1 second

  constructor() {
    this.db = this.getDatabase()
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
    const logMessage = `[${timestamp}] [QueryOptimizer:${level.toUpperCase()}] ${message}`
    if (data) {
      console.log(logMessage, data)
    } else {
      console.log(logMessage)
    }
  }

  // =============================================================================
  // QUERY EXECUTION WITH MONITORING
  // =============================================================================

  async executeQuery<T = any>(
    query: string,
    parameters: any[] = [],
    options: {
      cache?: boolean
      timeout?: number
      analyze?: boolean
    } = {}
  ): Promise<T[]> {
    const startTime = Date.now()
    let result: T[] = []
    let error: Error | undefined

    try {
      // Check cache first if enabled
      if (options.cache) {
        const cached = await this.checkCache(query, parameters)
        if (cached) {
          const metrics: QueryMetrics = {
            query,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date(),
            parameters,
            cacheHit: true,
          }
          this.recordMetrics(metrics)
          return cached
        }
      }

      // Execute query with optional EXPLAIN ANALYZE
      if (options.analyze) {
        const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
        const explainResult = await this.db.execute(explainQuery)
        this.log('info', 'Query analysis', explainResult)
      }

      // Execute actual query
      const queryResult = await this.db.execute(query)
      result = queryResult.rows as T[]

      // Store in cache if enabled
      if (options.cache) {
        await this.storeCache(query, parameters, result)
      }
    } catch (err) {
      error = err as Error
      this.log('error', 'Query execution failed', { query, error: error.message })
      throw error
    } finally {
      const executionTime = Date.now() - startTime

      const metrics: QueryMetrics = {
        query,
        executionTimeMs: executionTime,
        rowsAffected: result.length,
        timestamp: new Date(),
        parameters,
        error: error?.message,
        cacheHit: false,
      }

      this.recordMetrics(metrics)

      // Alert on slow queries
      if (executionTime > this.slowQueryThreshold) {
        this.handleSlowQuery(metrics)
      }
    }

    return result
  }

  private async checkCache(query: string, parameters: any[]): Promise<any[] | null> {
    // Simple in-memory cache implementation
    // In production, use Redis or similar
    this.generateCacheKey(query, parameters)
    return null // Placeholder for cache implementation
  }

  private async storeCache(query: string, parameters: any[], _result: any[]): Promise<void> {
    // Simple in-memory cache implementation
    // In production, use Redis or similar
    this.generateCacheKey(query, parameters)
    // Store result with TTL
  }

  private generateCacheKey(query: string, parameters: any[]): string {
    return `${query}:${JSON.stringify(parameters)}`
  }

  private recordMetrics(metrics: QueryMetrics): void {
    this.metrics.push(metrics)

    // Keep metrics size manageable
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics = this.metrics.slice(-this.maxMetricsSize)
    }

    // Store metrics in database for long-term analysis
    this.persistMetrics(metrics)
  }

  private async persistMetrics(metrics: QueryMetrics): Promise<void> {
    try {
      // Store in analytics_event table for long-term analysis
      const properties = JSON.stringify({
        query: metrics.query,
        executionTimeMs: metrics.executionTimeMs,
        rowsAffected: metrics.rowsAffected,
        cacheHit: metrics.cacheHit,
        error: metrics.error,
        timestamp: metrics.timestamp,
      })

      await this.db.execute(`
        INSERT INTO analytics_event (
          tenant_id, event_name, category, properties
        ) VALUES (
          NULL, 'query_executed', 'database_performance', 
          '${properties}'
        )
      `)
    } catch (error) {
      this.log('error', 'Failed to persist query metrics', error)
    }
  }

  private handleSlowQuery(metrics: QueryMetrics): void {
    this.log('warn', 'Slow query detected', {
      query: metrics.query,
      executionTimeMs: metrics.executionTimeMs,
      parameters: metrics.parameters,
    })

    // Generate optimization suggestions
    const suggestions = this.generateOptimizationSuggestions(metrics)

    if (suggestions.length > 0) {
      this.log('info', 'Optimization suggestions', suggestions)
    }
  }

  // =============================================================================
  // QUERY OPTIMIZATION ANALYSIS
  // =============================================================================

  async analyzeQueryPerformance(
    query: string,
    _parameters: any[] = []
  ): Promise<{
    executionPlan: any
    suggestions: QueryOptimizationSuggestion[]
    estimatedCost: number
    indexes: IndexUsageInfo[]
  }> {
    try {
      // Get execution plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
      const explainResult = await this.db.execute(explainQuery)
      const planData = explainResult.rows[0] as any
      const executionPlan = planData?.['QUERY PLAN']

      // Analyze execution plan
      const analysis = this.analyzeExecutionPlan(executionPlan)

      // Get index usage information
      const indexes = await this.getIndexUsage(query)

      // Generate optimization suggestions
      const suggestions = [
        ...this.generateIndexSuggestions(executionPlan, indexes),
        ...this.generateQueryRewriteSuggestions(executionPlan),
      ]

      return {
        executionPlan,
        suggestions,
        estimatedCost: analysis.estimatedCost,
        indexes,
      }
    } catch (error) {
      this.log('error', 'Failed to analyze query performance', error)
      throw error
    }
  }

  private analyzeExecutionPlan(executionPlan: any): {
    estimatedCost: number
    actualTime: number
    planningTime: number
    executionTime: number
  } {
    const plan = Array.isArray(executionPlan) ? executionPlan[0] : executionPlan

    return {
      estimatedCost: Number(plan['Total Cost']) || 0,
      actualTime: Number(plan['Actual Total Time']) || 0,
      planningTime: Number(plan['Planning Time']) || 0,
      executionTime: Number(plan['Execution Time']) || 0,
    }
  }

  private async getIndexUsage(_query: string): Promise<IndexUsageInfo[]> {
    try {
      // Get index usage statistics
      const indexQuery = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `

      const result = await this.db.execute(indexQuery)

      return result.rows.map((row: any) => ({
        indexName: String(row.indexname),
        tableName: String(row.tablename),
        usageCount: parseInt(String(row.idx_scan)),
        sizeBytes: this.parseSizeToBytes(String(row.index_size)),
        isUsed: parseInt(String(row.idx_scan)) > 0,
      }))
    } catch (error) {
      this.log('error', 'Failed to get index usage', error)
      return []
    }
  }

  private parseSizeToBytes(sizeStr: string): number {
    const units: { [key: string]: number } = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    }

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(\w+)$/)
    if (!match) return 0

    const [, value, unit] = match
    const unitValue = unit ? (units[unit] ?? 1) : 1
    return parseFloat(value ?? '0') * unitValue
  }

  private generateIndexSuggestions(
    executionPlan: any,
    indexes: IndexUsageInfo[]
  ): QueryOptimizationSuggestion[] {
    const suggestions: QueryOptimizationSuggestion[] = []
    const plan = Array.isArray(executionPlan) ? executionPlan[0] : executionPlan

    // Check for sequential scans on large tables
    if (plan['Node Type'] === 'Seq Scan' && plan['Actual Rows'] > 1000) {
      const tableName = this.extractTableNameFromPlan(plan)
      suggestions.push({
        type: 'index',
        description: `Consider adding an index on table ${tableName} to avoid sequential scan`,
        impact: 'high',
        estimatedImprovement: 80,
        sql: `CREATE INDEX CONCURRENTLY idx_${tableName}_optimized ON ${tableName} (column_name);`,
      })
    }

    // Check for unused indexes
    const unusedIndexes = indexes.filter((idx) => !idx.isUsed && idx.sizeBytes > 1024 * 1024) // > 1MB
    for (const index of unusedIndexes) {
      suggestions.push({
        type: 'index',
        description: `Consider dropping unused index ${index.indexName} on table ${index.tableName}`,
        impact: 'medium',
        estimatedImprovement: 10,
        sql: `DROP INDEX ${index.indexName};`,
      })
    }

    return suggestions
  }

  private generateQueryRewriteSuggestions(executionPlan: any): QueryOptimizationSuggestion[] {
    const suggestions: QueryOptimizationSuggestion[] = []
    const plan = Array.isArray(executionPlan) ? executionPlan[0] : executionPlan

    // Check for expensive operations
    if (plan['Node Type'] === 'Hash Join' && plan['Actual Total Time'] > 1000) {
      suggestions.push({
        type: 'query_rewrite',
        description: 'Consider rewriting query to avoid expensive hash join',
        impact: 'medium',
        estimatedImprovement: 40,
      })
    }

    // Check for sort operations
    if (plan['Node Type'] === 'Sort' && plan['Actual Rows'] > 10000) {
      suggestions.push({
        type: 'index',
        description: 'Consider adding an index to avoid expensive sort operation',
        impact: 'high',
        estimatedImprovement: 60,
      })
    }

    return suggestions
  }

  private extractTableNameFromPlan(plan: any): string {
    // Extract table name from execution plan
    const relationName = plan['Relation Name'] as string | undefined
    return relationName || 'unknown'
  }

  private generateOptimizationSuggestions(metrics: QueryMetrics): QueryOptimizationSuggestion[] {
    const suggestions: QueryOptimizationSuggestion[] = []

    // Basic suggestions based on query patterns
    if (metrics.query.includes('SELECT') && metrics.query.includes('WHERE')) {
      suggestions.push({
        type: 'index',
        description: 'Ensure WHERE clause columns are properly indexed',
        impact: 'high',
        estimatedImprovement: 70,
      })
    }

    if (metrics.query.includes('ORDER BY') && !metrics.query.includes('LIMIT')) {
      suggestions.push({
        type: 'query_rewrite',
        description: 'Consider adding LIMIT clause to ORDER BY queries',
        impact: 'medium',
        estimatedImprovement: 30,
      })
    }

    return suggestions
  }

  // =============================================================================
  // PERFORMANCE REPORTING
  // =============================================================================

  async generatePerformanceReport(startDate: Date, endDate: Date): Promise<PerformanceReport> {
    try {
      // Get query metrics from database
      const metricsQuery = `
        SELECT properties, timestamp
        FROM analytics_event
        WHERE event_name = 'query_executed'
        AND timestamp >= $1 AND timestamp <= $2
        ORDER BY timestamp DESC
      `

      const result = await this.db.execute(metricsQuery)
      const queryMetrics: QueryMetrics[] = result.rows.map((row: any) => ({
        ...JSON.parse(row.properties),
        timestamp: new Date(row.timestamp),
      }))

      // Analyze slow queries
      const slowQueries = this.identifySlowQueries(queryMetrics)

      // Get index usage
      const indexUsage = await this.getIndexUsage('')

      // Generate recommendations
      const recommendations = this.generateRecommendations(slowQueries, indexUsage)

      return {
        period: { start: startDate, end: endDate },
        totalQueries: queryMetrics.length,
        avgExecutionTimeMs: this.calculateAverageExecutionTime(queryMetrics),
        slowQueries,
        indexUsage,
        topSlowQueries: slowQueries.slice(0, 10),
        recommendations,
      }
    } catch (error) {
      this.log('error', 'Failed to generate performance report', error)
      throw error
    }
  }

  private identifySlowQueries(metrics: QueryMetrics[]): SlowQuery[] {
    const queryGroups = new Map<string, QueryMetrics[]>()

    // Group similar queries
    for (const metric of metrics) {
      const normalizedQuery = this.normalizeQuery(metric.query)
      if (!queryGroups.has(normalizedQuery)) {
        queryGroups.set(normalizedQuery, [])
      }
      queryGroups.get(normalizedQuery)!.push(metric)
    }

    // Analyze each group
    const slowQueries: SlowQuery[] = []
    for (const [query, queryMetrics] of queryGroups) {
      const executionTimes = queryMetrics.map((m) => m.executionTimeMs)
      const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      const maxExecutionTime = Math.max(...executionTimes)
      const lastExecuted = new Date(Math.max(...queryMetrics.map((m) => m.timestamp.getTime())))

      if (avgExecutionTime > this.slowQueryThreshold) {
        slowQueries.push({
          query,
          executionTimeMs: avgExecutionTime,
          frequency: queryMetrics.length,
          avgExecutionTimeMs: avgExecutionTime,
          maxExecutionTimeMs: maxExecutionTime,
          lastExecuted,
          parameters: queryMetrics[0]?.parameters,
          suggestions: this.generateOptimizationSuggestions(queryMetrics[0]!),
        })
      }
    }

    return slowQueries.sort((a, b) => b.avgExecutionTimeMs - a.avgExecutionTimeMs)
  }

  private normalizeQuery(query: string): string {
    // Remove parameter values and normalize whitespace
    return query
      .replace(/\$\d+/g, '?')
      .replace(/\d+/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private calculateAverageExecutionTime(metrics: QueryMetrics[]): number {
    if (metrics.length === 0) return 0
    const totalTime = metrics.reduce((sum, m) => sum + m.executionTimeMs, 0)
    return totalTime / metrics.length
  }

  private generateRecommendations(
    slowQueries: SlowQuery[],
    indexUsage: IndexUsageInfo[]
  ): QueryOptimizationSuggestion[] {
    const recommendations: QueryOptimizationSuggestion[] = []

    // Add recommendations from slow queries
    for (const slowQuery of slowQueries) {
      recommendations.push(...slowQuery.suggestions)
    }

    // Add index-related recommendations
    const unusedIndexes = indexUsage.filter(
      (idx) => !idx.isUsed && idx.sizeBytes > 10 * 1024 * 1024
    ) // > 10MB
    for (const index of unusedIndexes) {
      recommendations.push({
        type: 'index',
        description: `Drop unused index ${index.indexName} to save ${Math.round(index.sizeBytes / 1024 / 1024)}MB`,
        impact: 'medium',
        estimatedImprovement: 5,
        sql: `DROP INDEX ${index.indexName};`,
      })
    }

    // Remove duplicates and sort by impact
    const uniqueRecommendations = recommendations.filter(
      (rec, index, arr) => arr.findIndex((r) => r.description === rec.description) === index
    )

    return uniqueRecommendations.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 }
      return impactOrder[b.impact] - impactOrder[a.impact]
    })
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  async createIndex(
    tableName: string,
    columns: string[],
    options: {
      unique?: boolean
      partial?: string
      concurrently?: boolean
    } = {}
  ): Promise<void> {
    const uniqueClause = options.unique ? 'UNIQUE' : ''
    const concurrentClause = options.concurrently ? 'CONCURRENTLY' : ''
    const partialClause = options.partial ? `WHERE ${options.partial}` : ''

    const sql = `
      CREATE ${uniqueClause} INDEX ${concurrentClause} 
      idx_${tableName}_${columns.join('_')} 
      ON ${tableName} (${columns.join(', ')})
      ${partialClause}
    `

    try {
      await this.db.execute(sql)
      this.log('info', `Index created successfully: idx_${tableName}_${columns.join('_')}`)
    } catch (error) {
      this.log('error', 'Failed to create index', { tableName, columns, error })
      throw error
    }
  }

  async analyzeTable(tableName: string): Promise<void> {
    try {
      await this.db.execute(`ANALYZE ${tableName}`)
      this.log('info', `Table analyzed: ${tableName}`)
    } catch (error) {
      this.log('error', 'Failed to analyze table', { tableName, error })
      throw error
    }
  }

  async vacuumTable(tableName: string): Promise<void> {
    try {
      await this.db.execute(`VACUUM ANALYZE ${tableName}`)
      this.log('info', `Table vacuumed: ${tableName}`)
    } catch (error) {
      this.log('error', 'Failed to vacuum table', { tableName, error })
      throw error
    }
  }

  setSlowQueryThreshold(thresholdMs: number): void {
    this.slowQueryThreshold = thresholdMs
    this.log('info', `Slow query threshold set to ${thresholdMs}ms`)
  }

  getMetrics(): QueryMetrics[] {
    return [...this.metrics]
  }

  clearMetrics(): void {
    this.metrics = []
    this.log('info', 'Query metrics cleared')
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export const queryOptimizer = new QueryOptimizer()

export async function executeQuery<T = any>(
  query: string,
  parameters: any[] = [],
  options?: {
    cache?: boolean
    timeout?: number
    analyze?: boolean
  }
): Promise<T[]> {
  return await queryOptimizer.executeQuery<T>(query, parameters, options)
}

export async function analyzeQueryPerformance(query: string, parameters: any[] = []) {
  return await queryOptimizer.analyzeQueryPerformance(query, parameters)
}

export async function generatePerformanceReport(startDate: Date, endDate: Date) {
  return await queryOptimizer.generatePerformanceReport(startDate, endDate)
}

export async function createIndex(
  tableName: string,
  columns: string[],
  options?: {
    unique?: boolean
    partial?: string
    concurrently?: boolean
  }
): Promise<void> {
  return await queryOptimizer.createIndex(tableName, columns, options)
}
