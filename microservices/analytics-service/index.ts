// =============================================================================
// ANALYTICS MICROSERVICE
// =============================================================================

import express from 'express'
import { collectDefaultMetrics, Counter, Histogram, Gauge, Registry } from 'prom-client'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { EventEmitter } from 'events'

// =============================================================================
// INTERFACES
// =============================================================================

interface AnalyticsEvent {
  id?: string
  userId?: string
  tenantId?: string
  sessionId?: string
  eventType: string
  eventName: string
  properties: Record<string, any>
  timestamp: Date
  userAgent?: string
  ip?: string
  referrer?: string
  service?: string
}

interface MetricData {
  name: string
  value: number
  labels?: Record<string, string>
  timestamp: Date
  type: 'counter' | 'gauge' | 'histogram'
}

interface Report {
  id: string
  name: string
  description: string
  query: string
  parameters: Record<string, any>
  schedule?: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

interface Dashboard {
  id: string
  name: string
  description: string
  widgets: Widget[]
  layout: LayoutConfig
  tenantId: string
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

interface Widget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'text'
  title: string
  query: string
  visualization: {
    type: 'line' | 'bar' | 'pie' | 'table' | 'single-stat'
    config: Record<string, any>
  }
  position: { x: number; y: number; w: number; h: number }
}

interface LayoutConfig {
  columns: number
  rowHeight: number
  margin: { x: number; y: number }
}

// =============================================================================
// METRICS REGISTRY
// =============================================================================

class MetricsRegistry {
  private registry = new Registry()
  private metrics = new Map<string, any>()

  constructor() {
    collectDefaultMetrics({ register: this.registry })
    
    // Initialize default metrics
    this.initializeMetrics()
  }

  private initializeMetrics(): void {
    // HTTP metrics
    this.createMetric('http_requests_total', 'counter', 'Total HTTP requests', ['method', 'route', 'status'])
    this.createMetric('http_request_duration_seconds', 'histogram', 'HTTP request duration', ['method', 'route'])
    
    // Analytics metrics
    this.createMetric('analytics_events_total', 'counter', 'Total analytics events', ['eventType', 'eventName'])
    this.createMetric('analytics_event_processing_duration_seconds', 'histogram', 'Event processing duration')
    
    // Database metrics
    this.createMetric('db_queries_total', 'counter', 'Total database queries', ['operation', 'table'])
    this.createMetric('db_query_duration_seconds', 'histogram', 'Database query duration', ['operation'])
    
    // Business metrics
    this.createMetric('active_users', 'gauge', 'Number of active users', ['tenantId'])
    this.createMetric('user_sessions_active', 'gauge', 'Number of active sessions', ['tenantId'])
  }

  createMetric(name: string, type: string, help: string, labelNames?: string[]): any {
    let metric
    
    switch (type) {
      case 'counter':
        metric = new Counter({ name, help, labelNames, registers: [this.registry] })
        break
      case 'gauge':
        metric = new Gauge({ name, help, labelNames, registers: [this.registry] })
        break
      case 'histogram':
        metric = new Histogram({ name, help, labelNames, registers: [this.registry] })
        break
      default:
        throw new Error(`Unknown metric type: ${type}`)
    }
    
    this.metrics.set(name, metric)
    return metric
  }

  getMetric(name: string): any {
    return this.metrics.get(name)
  }

  getRegistry(): Registry {
    return this.registry
  }

  recordEvent(event: AnalyticsEvent): void {
    const eventCounter = this.getMetric('analytics_events_total')
    if (eventCounter) {
      eventCounter.inc({ eventType: event.eventType, eventName: event.eventName })
    }
  }

  recordProcessingDuration(duration: number): void {
    const durationHistogram = this.getMetric('analytics_event_processing_duration_seconds')
    if (durationHistogram) {
      durationHistogram.observe(duration)
    }
  }
}

// =============================================================================
// EVENT PROCESSOR
// =============================================================================

class EventProcessor extends EventEmitter {
  private db: Pool
  private redis: Redis
  private metrics: MetricsRegistry
  private batchSize = 100
  private batchTimeout = 5000
  private eventBuffer: AnalyticsEvent[] = []

  constructor(db: Pool, redis: Redis, metrics: MetricsRegistry) {
    super()
    this.db = db
    this.redis = redis
    this.metrics = metrics
    this.startBatchProcessing()
  }

  async processEvent(event: AnalyticsEvent): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Add to buffer for batch processing
      this.eventBuffer.push(event)
      
      // Process real-time metrics
      await this.updateRealTimeMetrics(event)
      
      this.metrics.recordProcessingDuration((Date.now() - startTime) / 1000)
      this.emit('eventProcessed', event)
      
    } catch (error) {
      console.error('Error processing analytics event:', error)
      this.emit('eventProcessingError', event, error)
    }
  }

  private async updateRealTimeMetrics(event: AnalyticsEvent): Promise<void> {
    if (event.eventType === 'user_login' && event.userId && event.tenantId) {
      const key = `active_users:${event.tenantId}`
      await this.redis.sadd(key, event.userId)
      await this.redis.expire(key, 1800) // 30 minutes
      
      const activeCount = await this.redis.scard(key)
      const activeUsersGauge = this.metrics.getMetric('active_users')
      if (activeUsersGauge) {
        activeUsersGauge.set({ tenantId: event.tenantId }, activeCount)
      }
    }
    
    if (event.eventType === 'session_start' && event.sessionId && event.tenantId) {
      const key = `active_sessions:${event.tenantId}`
      await this.redis.sadd(key, event.sessionId)
      await this.redis.expire(key, 1800)
      
      const sessionCount = await this.redis.scard(key)
      const sessionsGauge = this.metrics.getMetric('user_sessions_active')
      if (sessionsGauge) {
        sessionsGauge.set({ tenantId: event.tenantId }, sessionCount)
      }
    }
  }

  private startBatchProcessing(): void {
    setInterval(async () => {
      if (this.eventBuffer.length === 0) return
      
      const batch = this.eventBuffer.splice(0, this.batchSize)
      await this.processBatch(batch)
    }, this.batchTimeout)
  }

  private async processBatch(events: AnalyticsEvent[]): Promise<void> {
    const startTime = Date.now()
    
    try {
      const query = `
        INSERT INTO analytics_events (
          id, user_id, tenant_id, session_id, event_type, event_name,
          properties, timestamp, user_agent, ip, referrer, service
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) ON CONFLICT (id) DO NOTHING
      `
      
      for (const event of events) {
        await this.db.query(query, [
          event.id || this.generateId(),
          event.userId,
          event.tenantId,
          event.sessionId,
          event.eventType,
          event.eventName,
          JSON.stringify(event.properties),
          event.timestamp,
          event.userAgent,
          event.ip,
          event.referrer,
          event.service
        ])
        
        this.metrics.recordEvent(event)
      }
      
      console.log(`Processed batch of ${events.length} analytics events in ${Date.now() - startTime}ms`)
      
    } catch (error) {
      console.error('Error processing analytics batch:', error)
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...events)
    }
  }

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// =============================================================================
// QUERY ENGINE
// =============================================================================

class QueryEngine {
  private db: Pool
  private redis: Redis

  constructor(db: Pool, redis: Redis) {
    this.db = db
    this.redis = redis
  }

  async executeQuery(query: string, parameters: any[] = [], cacheKey?: string): Promise<any> {
    // Check cache first
    if (cacheKey) {
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    }

    const startTime = Date.now()
    let result
    
    try {
      result = await this.db.query(query, parameters)
      
      // Cache successful queries
      if (cacheKey && result.rows.length > 0) {
        await this.redis.setex(cacheKey, 300, JSON.stringify(result.rows)) // 5 minutes cache
      }
      
    } catch (error) {
      console.error('Error executing analytics query:', error)
      throw error
    }

    const duration = Date.now() - startTime
    console.log(`Query executed in ${duration}ms: ${query.substring(0, 100)}...`)
    
    return result.rows
  }

  // Pre-defined query templates
  async getUserActivity(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT 
        DATE_TRUNC('day', timestamp) as date,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_events
      FROM analytics_events
      WHERE tenant_id = $1
        AND timestamp BETWEEN $2 AND $3
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date DESC
    `
    
    const cacheKey = `user_activity:${tenantId}:${startDate.getTime()}:${endDate.getTime()}`
    return this.executeQuery(query, [tenantId, startDate, endDate], cacheKey)
  }

  async getEventBreakdown(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT 
        event_type,
        event_name,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM analytics_events
      WHERE tenant_id = $1
        AND timestamp BETWEEN $2 AND $3
      GROUP BY event_type, event_name
      ORDER BY count DESC
      LIMIT 20
    `
    
    const cacheKey = `event_breakdown:${tenantId}:${startDate.getTime()}:${endDate.getTime()}`
    return this.executeQuery(query, [tenantId, startDate, endDate], cacheKey)
  }

  async getTopPages(tenantId: string, startDate: Date, endDate: Date, limit = 10): Promise<any> {
    const query = `
      SELECT 
        properties->>'page_url' as page_url,
        properties->>'page_title' as page_title,
        COUNT(*) as views,
        COUNT(DISTINCT user_id) as unique_visitors
      FROM analytics_events
      WHERE tenant_id = $1
        AND event_type = 'page_view'
        AND timestamp BETWEEN $2 AND $3
        AND properties->>'page_url' IS NOT NULL
      GROUP BY properties->>'page_url', properties->>'page_title'
      ORDER BY views DESC
      LIMIT $4
    `
    
    const cacheKey = `top_pages:${tenantId}:${startDate.getTime()}:${endDate.getTime()}:${limit}`
    return this.executeQuery(query, [tenantId, startDate, endDate, limit], cacheKey)
  }

  async getUserRetention(tenantId: string, cohortDate: Date): Promise<any> {
    const query = `
      WITH cohort_users AS (
        SELECT DISTINCT user_id
        FROM analytics_events
        WHERE tenant_id = $1
          AND event_type = 'user_login'
          AND DATE(timestamp) = $2
      ),
      retention_data AS (
        SELECT 
          cu.user_id,
          DATE_TRUNC('week', ae.timestamp) as week,
          DATE_PART('week', ae.timestamp) - DATE_PART('week', $2::timestamp) as week_number
        FROM cohort_users cu
        LEFT JOIN analytics_events ae ON cu.user_id = ae.user_id
          AND ae.event_type = 'user_login'
          AND ae.timestamp >= $2::timestamp
          AND ae.timestamp < $2::timestamp + INTERVAL '8 weeks'
      )
      SELECT 
        week_number,
        COUNT(DISTINCT user_id) as retained_users,
        COUNT(DISTINCT user_id) * 100.0 / (SELECT COUNT(*) FROM cohort_users) as retention_rate
      FROM retention_data
      WHERE week_number >= 0
      GROUP BY week_number
      ORDER BY week_number
    `
    
    const cacheKey = `user_retention:${tenantId}:${cohortDate.getTime()}`
    return this.executeQuery(query, [tenantId, cohortDate], cacheKey)
  }
}

// =============================================================================
// ANALYTICS SERVICE
// =============================================================================

export class AnalyticsService {
  private app: express.Application
  private db: Pool
  private redis: Redis
  private metrics: MetricsRegistry
  private eventProcessor: EventProcessor
  private queryEngine: QueryEngine

  constructor() {
    this.app = express()
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
    
    this.redis = new Redis(process.env.REDIS_URL)
    this.metrics = new MetricsRegistry()
    this.eventProcessor = new EventProcessor(this.db, this.redis, this.metrics)
    this.queryEngine = new QueryEngine(this.db, this.redis)
    
    this.setupMiddleware()
    this.setupRoutes()
    this.setupDatabase()
  }

  private setupMiddleware(): void {
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))
    
    // Metrics middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now()
      
      res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000
        const requestsCounter = this.metrics.getMetric('http_requests_total')
        const durationHistogram = this.metrics.getMetric('http_request_duration_seconds')
        
        if (requestsCounter) {
          requestsCounter.inc({ method: req.method, route: req.route?.path || req.path, status: res.statusCode.toString() })
        }
        
        if (durationHistogram) {
          durationHistogram.observe({ method: req.method, route: req.route?.path || req.path }, duration)
        }
      })
      
      next()
    })
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'analytics-service', timestamp: new Date().toISOString() })
    })

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', this.metrics.getRegistry().contentType)
      res.end(await this.metrics.getRegistry().metrics())
    })

    // Event collection
    this.app.post('/api/v1/events', async (req, res) => {
      try {
        const events: AnalyticsEvent[] = Array.isArray(req.body) ? req.body : [req.body]
        
        for (const event of events) {
          await this.eventProcessor.processEvent({
            ...event,
            timestamp: event.timestamp ? new Date(event.timestamp) : new Date()
          })
        }
        
        res.json({ success: true, processed: events.length })
      } catch (error) {
        console.error('Error processing events:', error)
        res.status(500).json({ error: 'Failed to process events' })
      }
    })

    // Query endpoints
    this.app.post('/api/v1/query', async (req, res) => {
      try {
        const { query, parameters, cacheKey } = req.body
        const results = await this.queryEngine.executeQuery(query, parameters, cacheKey)
        res.json({ data: results })
      } catch (error) {
        console.error('Error executing query:', error)
        res.status(500).json({ error: 'Failed to execute query' })
      }
    })

    // Pre-defined reports
    this.app.get('/api/v1/reports/user-activity', async (req, res) => {
      try {
        const { tenantId, startDate, endDate } = req.query
        
        if (!tenantId || !startDate || !endDate) {
          return res.status(400).json({ error: 'Missing required parameters' })
        }
        
        const results = await this.queryEngine.getUserActivity(
          tenantId as string,
          new Date(startDate as string),
          new Date(endDate as string)
        )
        
        res.json({ data: results })
      } catch (error) {
        console.error('Error generating user activity report:', error)
        res.status(500).json({ error: 'Failed to generate report' })
      }
    })

    this.app.get('/api/v1/reports/event-breakdown', async (req, res) => {
      try {
        const { tenantId, startDate, endDate } = req.query
        
        if (!tenantId || !startDate || !endDate) {
          return res.status(400).json({ error: 'Missing required parameters' })
        }
        
        const results = await this.queryEngine.getEventBreakdown(
          tenantId as string,
          new Date(startDate as string),
          new Date(endDate as string)
        )
        
        res.json({ data: results })
      } catch (error) {
        console.error('Error generating event breakdown report:', error)
        res.status(500).json({ error: 'Failed to generate report' })
      }
    })

    this.app.get('/api/v1/reports/top-pages', async (req, res) => {
      try {
        const { tenantId, startDate, endDate, limit = 10 } = req.query
        
        if (!tenantId || !startDate || !endDate) {
          return res.status(400).json({ error: 'Missing required parameters' })
        }
        
        const results = await this.queryEngine.getTopPages(
          tenantId as string,
          new Date(startDate as string),
          new Date(endDate as string),
          parseInt(limit as string)
        )
        
        res.json({ data: results })
      } catch (error) {
        console.error('Error generating top pages report:', error)
        res.status(500).json({ error: 'Failed to generate report' })
      }
    })

    this.app.get('/api/v1/reports/user-retention', async (req, res) => {
      try {
        const { tenantId, cohortDate } = req.query
        
        if (!tenantId || !cohortDate) {
          return res.status(400).json({ error: 'Missing required parameters' })
        }
        
        const results = await this.queryEngine.getUserRetention(
          tenantId as string,
          new Date(cohortDate as string)
        )
        
        res.json({ data: results })
      } catch (error) {
        console.error('Error generating user retention report:', error)
        res.status(500).json({ error: 'Failed to generate report' })
      }
    })
  }

  private async setupDatabase(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS analytics_events (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        tenant_id VARCHAR(255) NOT NULL,
        session_id VARCHAR(255),
        event_type VARCHAR(100) NOT NULL,
        event_name VARCHAR(100) NOT NULL,
        properties JSONB,
        timestamp TIMESTAMP NOT NULL,
        user_agent TEXT,
        ip INET,
        referrer TEXT,
        service VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_timestamp (tenant_id, timestamp),
        INDEX idx_user_id (user_id),
        INDEX idx_event_type (event_type),
        INDEX idx_session_id (session_id)
      );
      
      CREATE TABLE IF NOT EXISTS analytics_reports (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        query TEXT NOT NULL,
        parameters JSONB,
        schedule VARCHAR(100),
        enabled BOOLEAN DEFAULT true,
        tenant_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS analytics_dashboards (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        widgets JSONB,
        layout JSONB,
        tenant_id VARCHAR(255) NOT NULL,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `

    try {
      await this.db.query(createTableQuery)
      console.log('Analytics database tables created/verified')
    } catch (error) {
      console.error('Error setting up analytics database:', error)
    }
  }

  async start(port: number = 3005): Promise<void> {
    this.app.listen(port, () => {
      console.log(`Analytics service listening on port ${port}`)
    })
  }

  async stop(): Promise<void> {
    await this.db.end()
    this.redis.disconnect()
  }
}

// =============================================================================
// STARTUP
// =============================================================================

if (require.main === module) {
  const analyticsService = new AnalyticsService()
  
  process.on('SIGTERM', async () => {
    console.log('Shutting down analytics service...')
    await analyticsService.stop()
    process.exit(0)
  })
  
  process.on('SIGINT', async () => {
    console.log('Shutting down analytics service...')
    await analyticsService.stop()
    process.exit(0)
  })
  
  const port = parseInt(process.env.PORT || '3005')
  analyticsService.start(port)
}

export default AnalyticsService