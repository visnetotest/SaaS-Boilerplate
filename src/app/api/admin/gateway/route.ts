import { and, count, desc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import {
  GatewayRouteConflictError,
  handleMicroservicesError,
  ServiceValidationError,
} from '@/libs/microservices-errors'
import { addSecurityHeaders, InputValidator, RateLimiter } from '@/libs/security-utils'
import { apiGatewaySchema, serviceRegistrySchema } from '@/models/Schema'

// GET /api/admin/gateway - List all gateway routes
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResult = RateLimiter.isAllowed(
      `gateway:${session.user.id}`,
      100, // 100 requests per minute
      60000 // 1 minute window
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const serviceId = searchParams.get('serviceId')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const offset = (page - 1) * limit

    // Validate inputs
    if (status && !['active', 'inactive', 'deprecated'].includes(status)) {
      throw new ServiceValidationError('Invalid status value', 'status')
    }

    if (serviceId && !InputValidator.validateEmail(serviceId)) {
      // Simple UUID validation - in production would be more strict
      throw new ServiceValidationError('Invalid service ID format', 'serviceId')
    }

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

    const response = NextResponse.json({
      routes,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })

    return addSecurityHeaders(response)
  } catch (error) {
    return handleMicroservicesError(error)
  }
}

// POST /api/admin/gateway - Create new gateway route
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting for route creation
    const rateLimitResult = RateLimiter.isAllowed(
      `gateway-create:${session.user.id}`,
      10, // 10 route creations per minute
      60000 // 1 minute window
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded for route creation' }, { status: 429 })
    }

    const body = await request.json()
    const {
      name,
      slug,
      path,
      method,
      targetServiceId,
      rateLimit,
      burstLimit,
      requiresAuth,
      allowedRoles,
      description,
      config,
    } = body

    // Validate required fields
    if (!name || !slug || !path || !method || !targetServiceId) {
      throw new ServiceValidationError(
        'Missing required fields: name, slug, path, method, targetServiceId'
      )
    }

    // Validate inputs
    if (!InputValidator.validateSlug(slug)) {
      throw new ServiceValidationError('Invalid slug format')
    }

    if (!InputValidator.validatePath(path)) {
      throw new ServiceValidationError('Invalid path format')
    }

    if (!InputValidator.validateHTTPMethod(method)) {
      throw new ServiceValidationError('Invalid HTTP method')
    }

    if (rateLimit && !InputValidator.validateRateLimit(rateLimit)) {
      throw new ServiceValidationError('Invalid rate limit value (1-10000)')
    }

    if (burstLimit && !InputValidator.validateRateLimit(burstLimit)) {
      throw new ServiceValidationError('Invalid burst limit value (1-10000)')
    }

    // Check if route slug already exists
    const existingRoute = await db
      .select()
      .from(apiGatewaySchema)
      .where(eq(apiGatewaySchema.slug, slug))
      .limit(1)

    if (existingRoute.length > 0) {
      throw new GatewayRouteConflictError(slug, '')
    }

    // Check if path+method combination already exists
    const existingPathMethod = await db
      .select()
      .from(apiGatewaySchema)
      .where(
        and(eq(apiGatewaySchema.path, path), eq(apiGatewaySchema.method, method.toUpperCase()))
      )
      .limit(1)

    if (existingPathMethod.length > 0) {
      throw new GatewayRouteConflictError(path, method)
    }

    // Create new route
    const [newRoute] = await db
      .insert(apiGatewaySchema)
      .values({
        name: InputValidator.sanitizeString(name, 255),
        slug: InputValidator.sanitizeString(slug, 100),
        path: InputValidator.sanitizeString(path, 500),
        method: method.toUpperCase(),
        targetServiceId,
        rateLimit: rateLimit ? Number(rateLimit) : null,
        burstLimit: burstLimit ? Number(burstLimit) : null,
        requiresAuth: requiresAuth !== undefined ? Boolean(requiresAuth) : true,
        allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : [],
        description: description ? InputValidator.sanitizeString(description, 1000) : null,
        config: config && typeof config === 'object' ? config : {},
        status: 'active',
      })
      .returning()

    const response = NextResponse.json(newRoute, { status: 201 })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleMicroservicesError(error)
  }
}
