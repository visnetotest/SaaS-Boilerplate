import { and, count, desc, eq, gte, lte } from 'drizzle-orm'

import { db } from '@/libs/DB'
import {
  apiGatewaySchema,
  errorTrackingSchema,
  NewApiGateway,
  NewErrorTracking,
  NewPerformanceMetrics,
  NewServiceRegistry,
  performanceMetricsSchema,
  serviceRegistrySchema,
} from '@/models/Schema'

export class MicroservicesService {
  // Service Registry Operations
  static async getServices(
    options: {
      status?: string
      category?: string
      page?: number
      limit?: number
    } = {}
  ) {
    const { status, category, page = 1, limit = 10 } = options
    const offset = (page - 1) * limit

    let whereConditions = []

    if (status) {
      whereConditions.push(eq(serviceRegistrySchema.status, status))
    }

    if (category) {
      whereConditions.push(eq(serviceRegistrySchema.category, category))
    }

    const services = await db
      .select({
        id: serviceRegistrySchema.id,
        name: serviceRegistrySchema.name,
        slug: serviceRegistrySchema.slug,
        version: serviceRegistrySchema.version,
        baseUrl: serviceRegistrySchema.baseUrl,
        healthEndpoint: serviceRegistrySchema.healthEndpoint,
        docsEndpoint: serviceRegistrySchema.docsEndpoint,
        description: serviceRegistrySchema.description,
        category: serviceRegistrySchema.category,
        tags: serviceRegistrySchema.tags,
        status: serviceRegistrySchema.status,
        isInternal: serviceRegistrySchema.isInternal,
        lastHealthCheck: serviceRegistrySchema.lastHealthCheck,
        responseTime: serviceRegistrySchema.responseTime,
        uptime: serviceRegistrySchema.uptime,
        createdAt: serviceRegistrySchema.createdAt,
        updatedAt: serviceRegistrySchema.updatedAt,
      })
      .from(serviceRegistrySchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(serviceRegistrySchema.createdAt))
      .limit(limit)
      .offset(offset)

    const totalCountResult = await db
      .select({ count: count() })
      .from(serviceRegistrySchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

    const totalCount = totalCountResult[0]?.count || 0

    return {
      services,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }
  }

  static async getServiceById(id: string) {
    const services = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.id, id))
      .limit(1)

    return services[0] || null
  }

  static async getServiceBySlug(slug: string) {
    const services = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.slug, slug))
      .limit(1)

    return services[0] || null
  }

  static async createService(data: NewServiceRegistry) {
    const [newService] = await db.insert(serviceRegistrySchema).values(data).returning()

    return newService
  }

  static async updateService(id: string, data: Partial<NewServiceRegistry>) {
    const [updatedService] = await db
      .update(serviceRegistrySchema)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceRegistrySchema.id, id))
      .returning()

    return updatedService
  }

  static async deleteService(id: string) {
    await db.delete(serviceRegistrySchema).where(eq(serviceRegistrySchema.id, id))
  }

  static async performHealthCheck(id: string) {
    const service = await this.getServiceById(id)
    if (!service) {
      throw new Error('Service not found')
    }

    const healthUrl = service.baseUrl + (service.healthEndpoint || '/health')

    const startTime = Date.now()
    let status = 'active'
    let responseTime = 0
    let error = null

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      responseTime = Date.now() - startTime

      if (!response.ok) {
        status = 'degraded'
        error = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (err) {
      status = 'down'
      responseTime = Date.now() - startTime
      error = err instanceof Error ? err.message : 'Unknown error'
    }

    // Update service with health check results
    const updatedService = await this.updateService(id, {
      status,
      lastHealthCheck: new Date(),
      responseTime,
    })

    return {
      service: updatedService,
      healthCheck: {
        status,
        responseTime,
        error,
        checkedAt: new Date(),
      },
    }
  }

  // API Gateway Operations
  static async getGatewayRoutes(
    options: {
      status?: string
      serviceId?: string
      page?: number
      limit?: number
    } = {}
  ) {
    const { status, serviceId, page = 1, limit = 10 } = options
    const offset = (page - 1) * limit

    let whereConditions = []

    if (status) {
      whereConditions.push(eq(apiGatewaySchema.status, status))
    }

    if (serviceId) {
      whereConditions.push(eq(apiGatewaySchema.targetServiceId, serviceId))
    }

    const routes = await db
      .select({
        id: apiGatewaySchema.id,
        name: apiGatewaySchema.name,
        slug: apiGatewaySchema.slug,
        path: apiGatewaySchema.path,
        method: apiGatewaySchema.method,
        rateLimit: apiGatewaySchema.rateLimit,
        burstLimit: apiGatewaySchema.burstLimit,
        requiresAuth: apiGatewaySchema.requiresAuth,
        allowedRoles: apiGatewaySchema.allowedRoles,
        status: apiGatewaySchema.status,
        description: apiGatewaySchema.description,
        config: apiGatewaySchema.config,
        createdAt: apiGatewaySchema.createdAt,
        updatedAt: apiGatewaySchema.updatedAt,
        targetService: {
          id: serviceRegistrySchema.id,
          name: serviceRegistrySchema.name,
          slug: serviceRegistrySchema.slug,
          baseUrl: serviceRegistrySchema.baseUrl,
          status: serviceRegistrySchema.status,
        },
      })
      .from(apiGatewaySchema)
      .leftJoin(
        serviceRegistrySchema,
        eq(apiGatewaySchema.targetServiceId, serviceRegistrySchema.id)
      )
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(apiGatewaySchema.createdAt))
      .limit(limit)
      .offset(offset)

    const totalCountResult = await db
      .select({ count: count() })
      .from(apiGatewaySchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

    const totalCount = totalCountResult[0]?.count || 0

    return {
      routes,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }
  }

  static async getGatewayRouteById(id: string) {
    const routes = await db
      .select({
        id: apiGatewaySchema.id,
        name: apiGatewaySchema.name,
        slug: apiGatewaySchema.slug,
        path: apiGatewaySchema.path,
        method: apiGatewaySchema.method,
        rateLimit: apiGatewaySchema.rateLimit,
        burstLimit: apiGatewaySchema.burstLimit,
        requiresAuth: apiGatewaySchema.requiresAuth,
        allowedRoles: apiGatewaySchema.allowedRoles,
        status: apiGatewaySchema.status,
        description: apiGatewaySchema.description,
        config: apiGatewaySchema.config,
        createdAt: apiGatewaySchema.createdAt,
        updatedAt: apiGatewaySchema.updatedAt,
        targetService: {
          id: serviceRegistrySchema.id,
          name: serviceRegistrySchema.name,
          slug: serviceRegistrySchema.slug,
          baseUrl: serviceRegistrySchema.baseUrl,
          status: serviceRegistrySchema.status,
        },
      })
      .from(apiGatewaySchema)
      .leftJoin(
        serviceRegistrySchema,
        eq(apiGatewaySchema.targetServiceId, serviceRegistrySchema.id)
      )
      .where(eq(apiGatewaySchema.id, id))
      .limit(1)

    return routes[0] || null
  }

  static async createGatewayRoute(data: NewApiGateway) {
    const [newRoute] = await db.insert(apiGatewaySchema).values(data).returning()

    return newRoute
  }

  static async updateGatewayRoute(id: string, data: Partial<NewApiGateway>) {
    const [updatedRoute] = await db
      .update(apiGatewaySchema)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(apiGatewaySchema.id, id))
      .returning()

    return updatedRoute
  }

  static async deleteGatewayRoute(id: string) {
    await db.delete(apiGatewaySchema).where(eq(apiGatewaySchema.id, id))
  }

  // Performance Metrics Operations
  static async recordMetric(data: NewPerformanceMetrics) {
    const [metric] = await db.insert(performanceMetricsSchema).values(data).returning()

    return metric
  }

  static async getMetrics(
    options: {
      serviceId?: string
      metricName?: string
      metricType?: string
      startDate?: Date
      endDate?: Date
      page?: number
      limit?: number
    } = {}
  ) {
    const { serviceId, metricName, metricType, startDate, endDate, page = 1, limit = 100 } = options
    const offset = (page - 1) * limit

    let whereConditions = []

    if (serviceId) {
      whereConditions.push(eq(performanceMetricsSchema.serviceId, serviceId))
    }

    if (metricName) {
      whereConditions.push(eq(performanceMetricsSchema.metricName, metricName))
    }

    if (metricType) {
      whereConditions.push(eq(performanceMetricsSchema.metricType, metricType))
    }

    if (startDate) {
      whereConditions.push(gte(performanceMetricsSchema.timestamp, startDate))
    }

    if (endDate) {
      whereConditions.push(lte(performanceMetricsSchema.timestamp, endDate))
    }

    const metrics = await db
      .select()
      .from(performanceMetricsSchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(performanceMetricsSchema.timestamp))
      .limit(limit)
      .offset(offset)

    const totalCountResult = await db
      .select({ count: count() })
      .from(performanceMetricsSchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

    const totalCount = totalCountResult[0]?.count || 0

    return {
      metrics,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }
  }

  // Error Tracking Operations
  static async recordError(data: NewErrorTracking) {
    const [error] = await db.insert(errorTrackingSchema).values(data).returning()

    return error
  }

  static async getErrors(
    options: {
      serviceId?: string
      errorType?: string
      severity?: string
      startDate?: Date
      endDate?: Date
      page?: number
      limit?: number
    } = {}
  ) {
    const { serviceId, errorType, severity, startDate, endDate, page = 1, limit = 50 } = options
    const offset = (page - 1) * limit

    let whereConditions = []

    if (serviceId) {
      whereConditions.push(eq(errorTrackingSchema.serviceId, serviceId))
    }

    if (errorType) {
      whereConditions.push(eq(errorTrackingSchema.errorType, errorType))
    }

    if (severity) {
      whereConditions.push(eq(errorTrackingSchema.severity, severity))
    }

    if (startDate) {
      whereConditions.push(gte(errorTrackingSchema.timestamp, startDate))
    }

    if (endDate) {
      whereConditions.push(lte(errorTrackingSchema.timestamp, endDate))
    }

    const errors = await db
      .select()
      .from(errorTrackingSchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(errorTrackingSchema.timestamp))
      .limit(limit)
      .offset(offset)

    const totalCountResult = await db
      .select({ count: count() })
      .from(errorTrackingSchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

    const totalCount = totalCountResult[0]?.count || 0

    return {
      errors,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }
  }
}
