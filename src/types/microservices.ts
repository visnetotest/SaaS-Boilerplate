export interface Service {
  id: string
  name: string
  slug: string
  description: string
  category: string
  status: 'active' | 'degraded' | 'down' | 'inactive'
  version: string
  endpoint: string
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  uptime: number
  lastCheck: string
  errorMessage?: string
}

export interface ServiceRegistry {
  services: Service[]
  totalServices: number
  activeServices: number
  healthyServices: number
  degradedServices: number
  unhealthyServices: number
}

export interface ServiceRegistryEntry {
  service: Service
  health: ServiceHealth
  registeredAt: string
  lastHealthCheck: string
}

export interface ApiGateway {
  id: string
  name: string
  version: string
  status: 'active' | 'inactive' | 'degraded'
  routes: Array<{
    path: string
    method: string
    targetService: string
    rateLimit: number
    authentication: boolean
  }>
  config: Record<string, any>
}

export interface PerformanceMetrics {
  responseTime: number
  throughput: number
  errorRate: number
  requestCount: number
  successRate: number
  timestamp: string
}

export interface ErrorTracking {
  id: string
  serviceId: string
  type: string
  message: string
  stackTrace?: string
  timestamp: string
  resolvedAt?: string
}
