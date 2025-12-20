// =============================================================================
// API GATEWAY
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

import { auth } from '../libs/auth'
import { apiGatewaySchema, serviceRegistrySchema } from '../models/Schema'
import { pluginRuntime } from '../services/PluginRuntime'

// Simple service registry mock
const serviceRegistry = new Map<string, any>()

/**
 * API Gateway Service
 *
 * Routes requests to appropriate backend services
 * Handles authentication, rate limiting, and service discovery
 * Provides unified entry point for all microservices
 */
export class ApiGateway {
  private static instance: ApiGateway

  static getInstance(): ApiGateway {
    if (!ApiGateway.instance) {
      ApiGateway.instance = new ApiGateway()
    }
    return ApiGateway.instance
  }

  // =============================================================================
  // MAIN REQUEST HANDLER
  // =============================================================================

  private async handleRequest(
    request: NextRequest,
    handler: (service: any, req: NextRequest) => Promise<any>
  ): Promise<NextResponse> {
    try {
      // Log incoming request
      console.log(`API Gateway: ${request.method} ${request.url}`)

      // Parse request URL to extract service information
      const url = new URL(request.url)
      const pathname = url.pathname
      const pathParts = pathname.split('/').filter(Boolean)

      // Route to service registry for service discovery
      if (pathParts[0] === 'api' && pathParts[1] === 'services') {
        return await this.routeToServiceRegistry(request, handler)
      }

      // Route to service-specific endpoint
      if (pathParts[1] && pathParts[2]) {
        const serviceSlug = pathParts[2]
        return await this.routeToSpecificService(request, serviceSlug, handler)
      }

      // Route to plugin execution
      if (pathParts[1] === 'plugins' && pathParts[2] === 'execute') {
        return await this.routeToPluginExecution(request, handler)
      }

      // Route to service health check
      if (pathParts[1] === 'health' && pathParts[2]) {
        return await this.routeToServiceHealthCheck(request)
      }

      // Default: service registry proxy
      return await this.routeToServiceRegistry(request, handler)
    } catch (error) {
      console.error('API Gateway error:', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
  }

  // =============================================================================
  // SERVICE REGISTRY ROUTES
  // =============================================================================

  private async routeToServiceRegistry(
    request: NextRequest,
    handler: (service: any, req: NextRequest) => Promise<any>
  ): Promise<NextResponse> {
    try {
      // Check auth permissions
      const session = await auth()
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get available services
      const services = await serviceRegistry.getServices()

      // Find matching service based on request
      const matchingService = this.findMatchingService(request, services)

      if (!matchingService) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }

      // Forward request to service
      const serviceUrl = `${matchingService.baseUrl}${request.url.replace('/api/services', '')}`

      // Add service context to request headers
      const enhancedRequest = {
        ...request,
        headers: {
          ...request.headers,
          'X-Service-ID': matchingService.id,
          'X-Service-Name': matchingService.name,
          'X-Service-Version': matchingService.version,
        },
      }

      // Forward request with timeout
      const timeout = 30000 // 30 seconds
      const response = await fetch(serviceUrl, {
        ...enhancedRequest,
        signal: AbortSignal.timeout(timeout),
      })

      if (!response.ok) {
        return NextResponse.json({ error: 'Service error' }, { status: response.status || 500 })
      }

      const responseClone = response.clone()
      const responseData = await response.json()

      console.log(`API Gateway: ${request.method} ${request.url} -> ${response.status}`)
      return responseClone
    } catch (error) {
      console.error('Service registry proxy error:', error)
      return NextResponse.json({ success: false, error: 'Service proxy failed' }, { status: 500 })
    }
  }

  // =============================================================================
  // SPECIFIC SERVICE ROUTES
  // =============================================================================

  private async routeToSpecificService(
    request: NextRequest,
    serviceSlug: string,
    handler: (service: any, req: NextRequest) => Promise<any>
  ): Promise<NextResponse> {
    try {
      // Check auth permissions
      const session = await auth()
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get service by slug
      const service = await serviceRegistry.getService(serviceSlug)
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }

      // Forward request to service
      const serviceUrl = `${service.baseUrl}${request.url.replace(`/api/services/${serviceSlug}`, '')}`

      // Add service context to request headers
      const enhancedRequest = {
        ...request,
        headers: {
          ...request.headers,
          'X-Service-ID': service.id,
          'X-Service-Name': service.name,
          'X-Service-Version': service.version,
        },
      }

      // Forward request with timeout
      const timeout = 30000 // 30 seconds
      const response = await fetch(serviceUrl, {
        ...enhancedRequest,
        signal: AbortSignal.timeout(timeout),
      })

      if (!response.ok) {
        return NextResponse.json({ error: 'Service error' }, { status: response.status || 500 })
      }

      const responseClone = response.clone()
      const responseData = await response.json()

      console.log(`API Gateway: ${request.method} ${request.url} -> ${response.status}`)
      return responseClone
    } catch (error) {
      console.error('Specific service proxy error:', error)
      return NextResponse.json({ success: false, error: 'Service proxy failed' }, { status: 500 })
    }
  }

  // =============================================================================
  // PLUGIN EXECUTION ROUTES
  // =============================================================================

  private async routeToPluginExecution(
    request: NextRequest,
    handler: (service: any, req: NextRequest) => Promise<any>
  ): Promise<NextResponse> {
    try {
      // Check auth permissions
      const session = await auth()
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse request for plugin and execution details
      const { pluginId, action, data } = this.parsePluginExecutionRequest(request)

      // Get plugin instance
      const plugin = pluginRuntime.getPlugin(pluginId)
      if (!plugin) {
        return NextResponse.json({ error: 'Plugin not found or not active' }, { status: 404 })
      }

      // Execute plugin method in sandbox
      const result = await pluginRuntime.executePlugin(pluginId, action.method, {
        ...data,
        context: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
        },
      })

      console.log(`Plugin ${pluginId} executed ${action.method} with result:`, result)

      return NextResponse.json({
        success: true,
        data: result,
        message: `Plugin action ${action} completed`,
      })
    } catch (error) {
      console.error('Plugin execution error:', error)
      return NextResponse.json(
        { success: false, error: 'Plugin execution failed' },
        { status: 500 }
      )
    }
  }

  private parsePluginExecutionRequest(request: NextRequest): {
    pluginId: string
    action: string
    data: any
  } {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')

    if (pathParts[1] !== 'plugins' || pathParts[2] !== 'execute') {
      throw new Error('Invalid plugin execution request')
    }

    return {
      pluginId: pathParts[3],
      action: request.method,
      data: request.body,
    }
  }

  // =============================================================================
  // SERVICE HEALTH CHECK ROUTE
  // =============================================================================

  private async routeToServiceHealthCheck(request: NextRequest): Promise<NextResponse> {
    try {
      // Check auth permissions
      const session = await auth()
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { serviceId } = request.query.service as string

      // Check service health
      const healthStatus = await serviceRegistry.getHealthStatus(serviceId)

      return NextResponse.json({
        success: true,
        data: {
          serviceId,
          status: healthStatus,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error('Service health check error:', error)
      return NextResponse.json({ success: false, error: 'Health check failed' }, { status: 500 })
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private findMatchingService(
    request: NextRequest,
    services: ServiceInstance[]
  ): ServiceInstance | null {
    const url = new URL(request.url)
    const pathname = url.pathname
    const pathParts = pathname.split('/').filter(Boolean)

    // Try to match by path
    for (const service of services) {
      // Direct path match
      if (service.baseUrl && url.pathname.startsWith(service.baseUrl)) {
        return service
      }

      // Try to match by slug
      const serviceSlug = pathParts[1]
      if (serviceSlug === service.slug) {
        return service
      }

      // Try to match by name
      const serviceName = pathParts[1]
      if (serviceName.toLowerCase() === service.name.toLowerCase()) {
        return service
      }
    }

    return null
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  private async initializeHealthChecks(): Promise<void> {
    // Get all services and start periodic health checks
    const services = await serviceRegistry.getServices()

    for (const service of services) {
      try {
        await serviceRegistry.updateHealthStatus(service.id, 'healthy')
      } catch (error) {
        console.error(`Failed to initialize health checks for ${service.name}:`, error)
      }
    }

    console.log('Health monitoring initialized for all services')

    // Start periodic health checks
    setInterval(() => {
      this.performHealthChecks()
    }, 60000) // Every minute
  }

  private async performHealthChecks(): Promise<void> {
    const services = await serviceRegistry.getServices()

    const healthCheckPromises = services.map((service) =>
      serviceRegistry.checkServiceHealth(service.id).catch((error) => {
        console.error(`Health check failed for ${service.name}:`, error)
      })
    )

    await Promise.all(healthCheckPromises)
  }

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================

  private handleGatewayError(error: unknown, request?: NextRequest): NextResponse {
    console.error('API Gateway Error:', error)
    return NextResponse.json({ success: false, error: 'Gateway error' }, { status: 500 })
  }

  private handleServiceError(error: unknown, serviceName: string): NextResponse {
    console.error(`Service Error (${serviceName}):`, error)
    return NextResponse.json({ success: false, error: `Service error: ${error}` }, { status: 503 })
  }
}
