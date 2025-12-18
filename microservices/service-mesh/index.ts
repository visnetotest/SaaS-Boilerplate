// =============================================================================
// SERVICE MESH IMPLEMENTATION
// =============================================================================

import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import consul from 'consul'
import axios from 'axios'
import { EventEmitter } from 'events'

// =============================================================================
// INTERFACES
// =============================================================================

interface ServiceInstance {
  id: string
  name: string
  host: string
  port: number
  protocol: 'http' | 'https'
  health: 'healthy' | 'unhealthy' | 'unknown'
  metadata: Record<string, any>
  lastHealthCheck: Date
  weight: number
  zone?: string
  version?: string
}

interface LoadBalancingStrategy {
  name: string
  select(instances: ServiceInstance[]): ServiceInstance | null
}

interface ServiceMeshConfig {
  name: string
  namespace: string
  loadBalancing: LoadBalancingStrategy
  healthCheck: {
    interval: number
    timeout: number
    retries: number
  }
  tracing: {
    enabled: boolean
    endpoint: string
  }
  metrics: {
    enabled: boolean
    endpoint: string
  }
}

// =============================================================================
// LOAD BALANCING STRATEGIES
// =============================================================================

class RoundRobinStrategy implements LoadBalancingStrategy {
  private currentIndex = 0
  name = 'round_robin'

  select(instances: ServiceInstance[]): ServiceInstance | null {
    const healthyInstances = instances.filter(i => i.health === 'healthy')
    if (healthyInstances.length === 0) return null

    const instance = healthyInstances[this.currentIndex % healthyInstances.length]
    this.currentIndex++
    return instance
  }
}

class WeightedRoundRobinStrategy implements LoadBalancingStrategy {
  private weightedInstances: Array<{ instance: ServiceInstance; weight: number }> = []
  name = 'weighted_round_robin'

  select(instances: ServiceInstance[]): ServiceInstance | null {
    const healthyInstances = instances.filter(i => i.health === 'healthy')
    if (healthyInstances.length === 0) return null

    // Initialize weighted instances if needed
    if (this.weightedInstances.length === 0) {
      this.weightedInstances = healthyInstances.map(instance => ({
        instance,
        weight: instance.weight || 1
      }))
    }

    // Select based on weight
    let totalWeight = this.weightedInstances.reduce((sum, wi) => sum + wi.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const { instance, weight } of this.weightedInstances) {
      random -= weight
      if (random <= 0) {
        return instance
      }
    }

    return this.weightedInstances[0].instance
  }
}

class LeastConnectionsStrategy implements LoadBalancingStrategy {
  name = 'least_connections'

  select(instances: ServiceInstance[]): ServiceInstance | null {
    const healthyInstances = instances.filter(i => i.health === 'healthy')
    if (healthyInstances.length === 0) return null

    return healthyInstances.reduce((min, current) => {
      const minConnections = min.metadata.activeConnections || 0
      const currentConnections = current.metadata.activeConnections || 0
      return currentConnections < minConnections ? current : min
    })
  }
}

// =============================================================================
// SERVICE DISCOVERY
// =============================================================================

class ServiceDiscovery {
  private consulClient: consul.Consul
  private services: Map<string, ServiceInstance[]> = new Map()

  constructor(consulHost: string = 'localhost', consulPort: number = 8500) {
    this.consulClient = consul({
      host: consulHost,
      port: consulPort,
      promisify: true
    })
  }

  async registerService(service: ServiceInstance): Promise<void> {
    await this.consulClient.agent.service.register({
      id: service.id,
      name: service.name,
      address: service.host,
      port: service.port,
      check: {
        http: `${service.protocol}://${service.host}:${service.port}/health`,
        interval: '10s',
        timeout: '5s'
      }
    })

    // Update local cache
    if (!this.services.has(service.name)) {
      this.services.set(service.name, [])
    }
    this.services.get(service.name)!.push(service)
  }

  async deregisterService(serviceId: string): Promise<void> {
    await this.consulClient.agent.service.deregister(serviceId)

    // Update local cache
    for (const [serviceName, instances] of this.services.entries()) {
      const filtered = instances.filter(i => i.id !== serviceId)
      this.services.set(serviceName, filtered)
    }
  }

  async discoverServices(serviceName: string): Promise<ServiceInstance[]> {
    try {
      const services = await this.consulClient.health.service({
        service: serviceName,
        passing: true
      })

      const instances: ServiceInstance[] = services.map(entry => ({
        id: entry.Service.ID,
        name: entry.Service.Service,
        host: entry.Service.Address,
        port: entry.Service.Port,
        protocol: 'http',
        health: entry.Checks.every(check => check.Status === 'passing') ? 'healthy' : 'unhealthy',
        metadata: entry.Service.Meta || {},
        lastHealthCheck: new Date(),
        weight: 1
      }))

      this.services.set(serviceName, instances)
      return instances
    } catch (error) {
      console.error(`Failed to discover services for ${serviceName}:`, error)
      return this.services.get(serviceName) || []
    }
  }

  async getAllServices(): Promise<Map<string, ServiceInstance[]>> {
    const serviceNames = Array.from(this.services.keys())
    for (const name of serviceNames) {
      await this.discoverServices(name)
    }
    return this.services
  }
}

// =============================================================================
// HEALTH CHECKER
// =============================================================================

class HealthChecker extends EventEmitter {
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private discovery: ServiceDiscovery

  constructor(discovery: ServiceDiscovery) {
    super()
    this.discovery = discovery
  }

  startHealthCheck(service: ServiceInstance, interval: number = 30000): void {
    const checkInterval = setInterval(async () => {
      try {
        const response = await axios.get(
          `${service.protocol}://${service.host}:${service.port}/health`,
          { timeout: 5000 }
        )
        
        const newHealth = response.status === 200 ? 'healthy' : 'unhealthy'
        if (service.health !== newHealth) {
          service.health = newHealth
          service.lastHealthCheck = new Date()
          this.emit('healthChanged', service)
        }
      } catch (error) {
        if (service.health !== 'unhealthy') {
          service.health = 'unhealthy'
          service.lastHealthCheck = new Date()
          this.emit('healthChanged', service)
        }
      }
    }, interval)

    this.intervals.set(service.id, checkInterval)
  }

  stopHealthCheck(serviceId: string): void {
    const interval = this.intervals.get(serviceId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(serviceId)
    }
  }

  stopAllHealthChecks(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval)
    }
    this.intervals.clear()
  }
}

// =============================================================================
// SERVICE MESH CORE
// =============================================================================

export class ServiceMesh extends EventEmitter {
  private app: express.Application
  private discovery: ServiceDiscovery
  private healthChecker: HealthChecker
  private config: ServiceMeshConfig
  private strategies: Map<string, LoadBalancingStrategy> = new Map()

  constructor(config: ServiceMeshConfig) {
    super()
    this.config = config
    this.app = express()
    this.discovery = new ServiceDiscovery()
    this.healthChecker = new HealthChecker(this.discovery)

    this.initializeStrategies()
    this.setupMiddleware()
    this.setupRoutes()

    this.healthChecker.on('healthChanged', (service) => {
      this.emit('serviceHealthChanged', service)
    })
  }

  private initializeStrategies(): void {
    this.strategies.set('round_robin', new RoundRobinStrategy())
    this.strategies.set('weighted_round_robin', new WeightedRoundRobinStrategy())
    this.strategies.set('least_connections', new LeastConnectionsStrategy())
  }

  private setupMiddleware(): void {
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))

    // Request tracing middleware
    this.app.use((req, res, next) => {
      const traceId = req.headers['x-trace-id'] || this.generateTraceId()
      req.headers['x-trace-id'] = traceId
      res.setHeader('x-trace-id', traceId)
      next()
    })

    // Metrics middleware
    this.app.use((req, res, next) => {
      const start = Date.now()
      res.on('finish', () => {
        const duration = Date.now() - start
        this.emit('requestCompleted', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          traceId: req.headers['x-trace-id']
        })
      })
      next()
    })
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', mesh: this.config.name, timestamp: new Date().toISOString() })
    })

    // Service discovery endpoint
    this.app.get('/services', async (req, res) => {
      try {
        const services = await this.discovery.getAllServices()
        const result = Object.fromEntries(services)
        res.json(result)
      } catch (error) {
        res.status(500).json({ error: 'Failed to discover services' })
      }
    })

    // Service registration endpoint
    this.app.post('/services/:serviceName/register', async (req, res) => {
      try {
        const { serviceName } = req.params
        const serviceData: ServiceInstance = {
          id: req.body.id || `${serviceName}-${Date.now()}`,
          name: serviceName,
          host: req.body.host,
          port: req.body.port,
          protocol: req.body.protocol || 'http',
          health: 'unknown',
          metadata: req.body.metadata || {},
          lastHealthCheck: new Date(),
          weight: req.body.weight || 1
        }

        await this.discovery.registerService(serviceData)
        this.healthChecker.startHealthCheck(serviceData, this.config.healthCheck.interval)

        res.json({ success: true, service: serviceData })
      } catch (error) {
        res.status(500).json({ error: 'Failed to register service' })
      }
    })

    // Dynamic route for service proxy
    this.app.use('/api/:serviceName/*', async (req, res, next) => {
      const { serviceName } = req.params
      const path = req.params[0] // Get the rest of the path

      try {
        const instances = await this.discovery.discoverServices(serviceName)
        if (instances.length === 0) {
          return res.status(404).json({ error: `Service ${serviceName} not found` })
        }

        const strategy = this.strategies.get(this.config.loadBalancing.name) || this.strategies.get('round_robin')!
        const selectedInstance = strategy.select(instances)

        if (!selectedInstance) {
          return res.status(503).json({ error: `No healthy instances for service ${serviceName}` })
        }

        const target = `${selectedInstance.protocol}://${selectedInstance.host}:${selectedInstance.port}/${path}`

        const proxy = createProxyMiddleware({
          target: target,
          changeOrigin: true,
          pathRewrite: { [`^/api/${serviceName}`]: '' },
          onProxyReq: (proxyReq, req, res) => {
            proxyReq.setHeader('X-Forwarded-For', req.ip)
            proxyReq.setHeader('X-Trace-ID', req.headers['x-trace-id'])
          },
          onError: (err, req, res) => {
            console.error('Proxy error:', err)
            res.status(502).json({ error: 'Service unavailable' })
          }
        })

        proxy(req, res, next)
      } catch (error) {
        console.error('Service mesh error:', error)
        res.status(500).json({ error: 'Internal service mesh error' })
      }
    })
  }

  async start(port: number = 3000): Promise<void> {
    this.app.listen(port, () => {
      console.log(`Service Mesh ${this.config.name} listening on port ${port}`)
    })
  }

  async stop(): Promise<void> {
    this.healthChecker.stopAllHealthChecks()
  }

  private generateTraceId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
}

// =============================================================================
// CONFIGURATION AND FACTORY
// =============================================================================

export const createServiceMesh = (config: Partial<ServiceMeshConfig> = {}): ServiceMesh => {
  const defaultConfig: ServiceMeshConfig = {
    name: 'saas-mesh',
    namespace: 'default',
    loadBalancing: new RoundRobinStrategy(),
    healthCheck: {
      interval: 30000,
      timeout: 5000,
      retries: 3
    },
    tracing: {
      enabled: true,
      endpoint: 'http://jaeger-collector:14268/api/traces'
    },
    metrics: {
      enabled: true,
      endpoint: 'http://prometheus:9090'
    }
  }

  return new ServiceMesh({ ...defaultConfig, ...config })
}

export default ServiceMesh