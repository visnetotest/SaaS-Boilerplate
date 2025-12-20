// =============================================================================
// ENHANCED API GATEWAY WITH INTELLIGENT LOAD BALANCING
// =============================================================================

import compression from 'compression'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { createClient } from 'redis'

// =============================================================================
// INTERFACES
// =============================================================================

interface ServiceInstance {
  id: string
  name: string
  baseUrl: string
  healthEndpoint: string
  status: 'active' | 'inactive' | 'error'
  responseTime: number
  requestCount: number
  errorCount: number
  lastHealthCheck: Date
  weight: number
  zone?: string
  region?: string
}

interface LoadBalancingStrategy {
  name: string
  selectInstance: (instances: ServiceInstance[]) => ServiceInstance | null
}

interface RoutingMetrics {
  totalRequests: number
  totalResponseTime: number
  totalErrors: number
  activeConnections: number
  instancesHealth: Map<string, boolean>
}

// =============================================================================
// LOAD BALANCING STRATEGIES
// =============================================================================

class LoadBalancer {
  private strategies: Map<string, LoadBalancingStrategy> = new Map()
  private metrics: RoutingMetrics = {
    totalRequests: 0,
    totalResponseTime: 0,
    totalErrors: 0,
    activeConnections: 0,
    instancesHealth: new Map(),
  }
  private currentStrategy: string = 'round-robin'
  private roundRobinIndex: number = 0

  constructor() {
    this.initializeStrategies()
  }

  private initializeStrategies() {
    // Round Robin Strategy
    this.strategies.set('round-robin', {
      name: 'round-robin',
      selectInstance: (instances: ServiceInstance[]) => {
        const activeInstances = instances.filter((i) => i.status === 'active')
        if (activeInstances.length === 0) return null

        const instance = activeInstances[this.roundRobinIndex % activeInstances.length]
        this.roundRobinIndex++
        return instance || null
      },
    })

    // Least Connections Strategy
    this.strategies.set('least-connections', {
      name: 'least-connections',
      selectInstance: (instances: ServiceInstance[]) => {
        const activeInstances = instances.filter((i) => i.status === 'active')
        if (activeInstances.length === 0) return null

        return (
          activeInstances.reduce((min, current) =>
            current.requestCount < min.requestCount ? current : min
          ) ||
          activeInstances[0] ||
          null
        )
      },
    })

    // Weighted Round Robin Strategy
    this.strategies.set('weighted-round-robin', {
      name: 'weighted-round-robin',
      selectInstance: (instances: ServiceInstance[]) => {
        const activeInstances = instances.filter((i) => i.status === 'active')
        if (activeInstances.length === 0) return null

        const totalWeight = activeInstances.reduce((sum, i) => sum + i.weight, 0)
        let random = Math.random() * totalWeight

        for (const instance of activeInstances) {
          random -= instance.weight
          if (random <= 0) {
            return instance
          }
        }

        return activeInstances[0] || null
      },
    })

    // Response Time Based Strategy
    this.strategies.set('response-time', {
      name: 'response-time',
      selectInstance: (instances: ServiceInstance[]) => {
        const activeInstances = instances.filter((i) => i.status === 'active')
        if (activeInstances.length === 0) return null

        return (
          activeInstances.reduce((fastest, current) =>
            current.responseTime < fastest.responseTime ? current : fastest
          ) ||
          activeInstances[0] ||
          null
        )
      },
    })

    // Health Score Strategy (combined metrics)
    this.strategies.set('health-score', {
      name: 'health-score',
      selectInstance: (instances: ServiceInstance[]) => {
        const activeInstances = instances.filter((i) => i.status === 'active')
        if (activeInstances.length === 0) return null

        // Calculate health score for each instance
        const scoredInstances = activeInstances.map((instance) => {
          const errorRate =
            instance.requestCount > 0 ? instance.errorCount / instance.requestCount : 0
          const responseTimeScore = Math.max(0, 1 - instance.responseTime / 1000) // Normalize to 0-1
          const errorRateScore = Math.max(0, 1 - errorRate) // Normalize to 0-1

          // Combined score (can be adjusted)
          const healthScore = responseTimeScore * 0.6 + errorRateScore * 0.4

          return { instance, healthScore }
        })

        // Select instance with highest health score
        if (scoredInstances.length === 0) return null
        const result = scoredInstances.reduce((best, current) =>
          current.healthScore > best.healthScore ? current : best
        )
        return result?.instance || null
      },
    })
  }

  setStrategy(strategyName: string): boolean {
    if (this.strategies.has(strategyName)) {
      this.currentStrategy = strategyName
      console.log(`Load balancing strategy changed to: ${strategyName}`)
      return true
    }
    return false
  }

  selectInstance(instances: ServiceInstance[]): ServiceInstance | null {
    const strategy = this.strategies.get(this.currentStrategy)
    return strategy ? strategy.selectInstance(instances) : null
  }

  updateMetrics(_instanceId: string, responseTime: number, isError: boolean = false) {
    this.metrics.totalRequests++
    this.metrics.totalResponseTime += responseTime

    if (isError) {
      this.metrics.totalErrors++
    }
  }

  getMetrics(): RoutingMetrics {
    return {
      ...this.metrics,
      averageResponseTime:
        this.metrics.totalRequests > 0
          ? this.metrics.totalResponseTime / this.metrics.totalRequests
          : 0,
    } as any
  }
}

// =============================================================================
// API GATEWAY CLASS
// =============================================================================

class EnhancedApiGateway {
  private app: express.Application
  private redis: any
  private loadBalancer: LoadBalancer
  private services: Map<string, ServiceInstance[]> = new Map()
  private healthCheckInterval: any
  private PORT: number

  constructor() {
    this.app = express()
    this.redis = null
    this.loadBalancer = new LoadBalancer()
    this.PORT = parseInt(process.env.PORT || '3002')

    this.initializeMiddleware()
    this.initializeRoutes()
  }

  private async initializeMiddleware() {
    this.app.use(helmet())
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
      })
    )

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to requests
      message: { error: 'Too many requests from this IP' },
    })
    this.app.use('/api/', limiter)

    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))
    this.app.use(compression())

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now()

      res.on('finish', () => {
        const responseTime = Date.now() - start
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`)
      })

      next()
    })
  }

  private initializeRoutes() {
    // Health check
    this.app.get('/health', (_, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        version: '2.0.0',
        strategy: this.loadBalancer['currentStrategy'],
        metrics: this.loadBalancer.getMetrics(),
      })
    })

    // Get load balancing strategies
    this.app.get('/api/gateway/strategies', (_, res) => {
      res.json({
        currentStrategy: this.loadBalancer['currentStrategy'],
        availableStrategies: [
          'round-robin',
          'least-connections',
          'weighted-round-robin',
          'response-time',
          'health-score',
        ],
      })
    })

    // Change load balancing strategy
    this.app.post('/api/gateway/strategies', (req, res) => {
      const { strategy } = req.body

      if (!strategy) {
        return res.status(400).json({ error: 'Strategy name is required' })
      }

      const success = this.loadBalancer.setStrategy(strategy)

      if (success) {
        return res.json({ message: `Load balancing strategy changed to ${strategy}` })
      } else {
        return res.status(400).json({
          error: 'Invalid strategy',
          availableStrategies: [
            'round-robin',
            'least-connections',
            'weighted-round-robin',
            'response-time',
            'health-score',
          ],
        })
      }
    })

    // Get gateway metrics
    this.app.get('/api/gateway/metrics', (_, res) => {
      res.json(this.loadBalancer.getMetrics())
    })

    // Get services status
    this.app.get('/api/gateway/services', (_, res) => {
      const servicesStatus = Array.from(this.services.entries()).map(
        ([serviceName, instances]) => ({
          serviceName,
          instances: instances.map((instance) => ({
            id: instance.id,
            status: instance.status,
            responseTime: instance.responseTime,
            requestCount: instance.requestCount,
            errorCount: instance.errorCount,
            lastHealthCheck: instance.lastHealthCheck,
          })),
        })
      )

      res.json({ services: servicesStatus })
    })

    // Dynamic routing
    this.app.use('/api/:serviceName/*', async (req, res, _next) => {
      try {
        const serviceName = req.params.serviceName
        const instances = this.services.get(serviceName)

        if (!instances || instances.length === 0) {
          return res.status(404).json({
            error: `Service ${serviceName} not found`,
          })
        }

        const selectedInstance = this.loadBalancer.selectInstance(instances)

        if (!selectedInstance) {
          return res.status(503).json({
            error: `No healthy instances available for service ${serviceName}`,
          })
        }

        // Proxy request to selected instance
        await this.proxyRequest(req, res, selectedInstance)
        return
      } catch (error) {
        console.error('Routing error:', error)
        return res.status(500).json({ error: 'Internal routing error' })
      }
    })

    // Fallback for unknown routes
    this.app.use('*', (_req, res) => {
      res.status(404).json({
        error: 'Route not found',
        availableServices: Array.from(this.services.keys()),
      })
    })
  }

  private async proxyRequest(
    req: express.Request,
    res: express.Response,
    instance: ServiceInstance
  ) {
    const startTime = Date.now()

    try {
      // Update request count for selected instance
      instance.requestCount++

      // In a real implementation, use http-proxy-middleware or similar
      // For now, simulate proxy behavior
      const targetUrl = `${instance.baseUrl}${req.originalUrl.replace(`/api/${req.params.serviceName}`, '')}`

      console.log(`Proxying ${req.method} ${req.originalUrl} to ${targetUrl}`)

      // Simulate response
      res.json({
        message: 'Request proxied successfully',
        targetUrl,
        instanceId: instance.id,
        loadBalancingStrategy: this.loadBalancer['currentStrategy'],
      })

      // Update metrics
      const responseTime = Date.now() - startTime
      this.loadBalancer.updateMetrics(instance.id, responseTime, false)
    } catch (error) {
      console.error('Proxy error:', error)

      // Update error metrics
      const responseTime = Date.now() - startTime
      instance.errorCount++
      this.loadBalancer.updateMetrics(instance.id, responseTime, true)

      res.status(502).json({ error: 'Service unavailable' })
    }
  }

  // Service registration methods
  registerService(serviceName: string, instances: ServiceInstance[]) {
    this.services.set(serviceName, instances)
    console.log(`Service ${serviceName} registered with ${instances.length} instances`)
  }

  updateServiceInstance(
    serviceName: string,
    instanceId: string,
    updates: Partial<ServiceInstance>
  ) {
    const instances = this.services.get(serviceName)
    if (!instances) return false

    const instance = instances.find((i) => i.id === instanceId)
    if (!instance) return false

    Object.assign(instance, updates)
    return true
  }

  // Health checking
  private async performHealthCheck(instance: ServiceInstance): Promise<boolean> {
    try {
      const startTime = Date.now()

      // In a real implementation, make HTTP request to health endpoint
      // For now, simulate health check
      const isHealthy = Math.random() > 0.1 // 90% health rate for simulation
      const responseTime = Date.now() - startTime

      instance.responseTime = responseTime
      instance.status = isHealthy ? 'active' : 'error'
      instance.lastHealthCheck = new Date()

      return isHealthy
    } catch (error) {
      instance.status = 'error'
      instance.lastHealthCheck = new Date()
      return false
    }
  }

  async startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      for (const [_serviceName, instances] of this.services.entries()) {
        for (const instance of instances) {
          await this.performHealthCheck(instance)
        }
      }
    }, 30000) // Check every 30 seconds
  }

  async start() {
    try {
      // Initialize Redis if available
      if (process.env.REDIS_URL) {
        this.redis = await createClient({ url: process.env.REDIS_URL })
        await this.redis.connect()
        console.log('🔄 Redis connected for distributed caching')
      }

      // Start health checks
      await this.startHealthChecks()

      // Start server
      this.app.listen(this.PORT, () => {
        console.log(`🚀 Enhanced API Gateway running on port ${this.PORT}`)
        console.log(`📊 Health check: http://localhost:${this.PORT}/health`)
        console.log(`⚖️  Load balancing strategy: ${this.loadBalancer['currentStrategy']}`)
        console.log(`📡 Dynamic routing enabled`)
      })
    } catch (error) {
      console.error('Failed to start API Gateway:', error)
      process.exit(1)
    }
  }

  async stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    if (this.redis) {
      await this.redis.quit()
    }
  }
}

// =============================================================================
// START SERVER
// =============================================================================

async function startGateway() {
  const gateway = new EnhancedApiGateway()

  // Register sample services for demonstration
  gateway.registerService('user-service', [
    {
      id: 'user-service-1',
      name: 'user-service',
      baseUrl: 'http://user-service-1:3004',
      healthEndpoint: '/health',
      status: 'active',
      responseTime: 45,
      requestCount: 0,
      errorCount: 0,
      lastHealthCheck: new Date(),
      weight: 1,
      zone: 'us-east-1a',
      region: 'us-east-1',
    },
    {
      id: 'user-service-2',
      name: 'user-service',
      baseUrl: 'http://user-service-2:3004',
      healthEndpoint: '/health',
      status: 'active',
      responseTime: 52,
      requestCount: 0,
      errorCount: 0,
      lastHealthCheck: new Date(),
      weight: 1,
      zone: 'us-east-1b',
      region: 'us-east-1',
    },
  ])

  gateway.registerService('notification-service', [
    {
      id: 'notification-service-1',
      name: 'notification-service',
      baseUrl: 'http://notification-service:3005',
      healthEndpoint: '/health',
      status: 'active',
      responseTime: 120,
      requestCount: 0,
      errorCount: 0,
      lastHealthCheck: new Date(),
      weight: 2,
      zone: 'us-east-1a',
      region: 'us-east-1',
    },
  ])

  await gateway.start()

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully')
    await gateway.stop()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully')
    await gateway.stop()
    process.exit(0)
  })
}

startGateway()
