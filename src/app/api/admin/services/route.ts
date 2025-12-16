import { and, count, desc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import {
  handleMicroservicesError,
  ServiceAlreadyExistsError,
  ServiceValidationError,
} from '@/libs/microservices-errors'
import {
  addSecurityHeaders,
  InputValidator,
  RateLimiter,
  URLValidator,
} from '@/libs/security-utils'
import { apiGatewaySchema, serviceRegistrySchema } from '@/models/Schema'

// GET /api/admin/services - List all services
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResult = RateLimiter.isAllowed(
      `services:${session.user.id}`,
      100, // 100 requests per minute
      60000 // 1 minute window
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const offset = (page - 1) * limit

    // Validate inputs
    if (status && !['active', 'inactive', 'degraded', 'down'].includes(status)) {
      throw new ServiceValidationError('Invalid status value', 'status')
    }

    if (category && !InputValidator.validateCategory(category)) {
      throw new ServiceValidationError('Invalid category value', 'category')
    }

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
        gatewayRoutes: {
          id: apiGatewaySchema.id,
          name: apiGatewaySchema.name,
          path: apiGatewaySchema.path,
          method: apiGatewaySchema.method,
          status: apiGatewaySchema.status,
        },
      })
      .from(serviceRegistrySchema)
      .leftJoin(apiGatewaySchema, eq(serviceRegistrySchema.id, apiGatewaySchema.targetServiceId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(serviceRegistrySchema.createdAt))
      .limit(limit)
      .offset(offset)

    const totalCountResult = await db
      .select({ count: count() })
      .from(serviceRegistrySchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

    const totalCount = totalCountResult[0]?.count || 0

    const response = NextResponse.json({
      services,
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

// POST /api/admin/services - Register a new service
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      slug,
      version,
      baseUrl,
      healthEndpoint,
      docsEndpoint,
      description,
      category,
      tags,
      isInternal,
      config,
      secrets,
    } = body

    // Validate required fields
    if (!name || !slug || !version || !baseUrl || !healthEndpoint) {
      throw new ServiceValidationError(
        'Missing required fields: name, slug, version, baseUrl, healthEndpoint'
      )
    }

    // Validate inputs
    if (!InputValidator.validateSlug(slug)) {
      throw new ServiceValidationError('Invalid slug format')
    }

    if (!InputValidator.validateVersion(version)) {
      throw new ServiceValidationError('Invalid version format (use semantic versioning)')
    }

    if (category && !InputValidator.validateCategory(category)) {
      throw new ServiceValidationError('Invalid category')
    }

    // Validate URLs
    const baseUrlValidation = URLValidator.validateServiceURL(baseUrl)
    if (!baseUrlValidation.valid) {
      throw new ServiceValidationError(`Invalid base URL: ${baseUrlValidation.error}`)
    }

    const sanitizedBaseUrl = baseUrlValidation.sanitizedUrl!

    // Check if service slug already exists
    const existingService = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.slug, slug))
      .limit(1)

    if (existingService.length > 0) {
      throw new ServiceAlreadyExistsError(slug)
    }

    // Create new service
    const [newService] = await db
      .insert(serviceRegistrySchema)
      .values({
        name: InputValidator.sanitizeString(name, 255),
        slug: InputValidator.sanitizeString(slug, 100),
        version: InputValidator.sanitizeString(version, 50),
        baseUrl: sanitizedBaseUrl,
        healthEndpoint: InputValidator.sanitizeString(healthEndpoint, 500),
        docsEndpoint: docsEndpoint ? InputValidator.sanitizeString(docsEndpoint, 500) : null,
        description: description ? InputValidator.sanitizeString(description, 1000) : null,
        category: category ? InputValidator.sanitizeString(category, 100) : null,
        tags: Array.isArray(tags) ? tags.map((tag) => InputValidator.sanitizeString(tag, 50)) : [],
        isInternal: Boolean(isInternal),
        config: config && typeof config === 'object' ? config : {},
        secrets: secrets && typeof secrets === 'object' ? secrets : {},
        status: 'inactive',
      })
      .returning()

    const response = NextResponse.json(newService, { status: 201 })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleMicroservicesError(error)
  }
}
