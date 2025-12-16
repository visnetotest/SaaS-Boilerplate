import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { apiGatewaySchema, serviceRegistrySchema } from '@/models/Schema'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/services/[id] - Get specific service details
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const service = await db
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
        config: serviceRegistrySchema.config,
        createdAt: serviceRegistrySchema.createdAt,
        updatedAt: serviceRegistrySchema.updatedAt,
        gatewayRoutes: {
          id: apiGatewaySchema.id,
          name: apiGatewaySchema.name,
          path: apiGatewaySchema.path,
          method: apiGatewaySchema.method,
          status: apiGatewaySchema.status,
          rateLimit: apiGatewaySchema.rateLimit,
          requiresAuth: apiGatewaySchema.requiresAuth,
        },
      })
      .from(serviceRegistrySchema)
      .leftJoin(apiGatewaySchema, eq(serviceRegistrySchema.id, apiGatewaySchema.targetServiceId))
      .where(eq(serviceRegistrySchema.id, id))
      .limit(1)

    if (service.length === 0) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    return NextResponse.json(service[0])
  } catch (error) {
    console.error('Error fetching service:', error)
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
  }
}

// PUT /api/admin/services/[id] - Update service details
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      name,
      version,
      baseUrl,
      healthEndpoint,
      docsEndpoint,
      description,
      category,
      tags,
      status,
      config,
      secrets,
    } = body

    // Check if service exists
    const existingService = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.id, id))
      .limit(1)

    if (existingService.length === 0) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Update service
    const [updatedService] = await db
      .update(serviceRegistrySchema)
      .set({
        ...(name && { name }),
        ...(version && { version }),
        ...(baseUrl && { baseUrl }),
        ...(healthEndpoint && { healthEndpoint }),
        ...(docsEndpoint !== undefined && { docsEndpoint }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags }),
        ...(status !== undefined && { status }),
        ...(config !== undefined && { config }),
        ...(secrets !== undefined && { secrets }),
        updatedAt: new Date(),
      })
      .where(eq(serviceRegistrySchema.id, id))
      .returning()

    return NextResponse.json(updatedService)
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}

// DELETE /api/admin/services/[id] - Delete service
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if service exists
    const existingService = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.id, id))
      .limit(1)

    if (existingService.length === 0) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Delete service (cascade will delete related gateway routes)
    await db.delete(serviceRegistrySchema).where(eq(serviceRegistrySchema.id, id))

    return NextResponse.json({ message: 'Service deleted successfully' })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}

// POST /api/admin/services/[id]/health-check - Perform health check
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get service details
    const service = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.id, id))
      .limit(1)

    if (service.length === 0) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    const serviceData = service[0]
    if (!serviceData) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }
    const healthUrl = serviceData.baseUrl + (serviceData.healthEndpoint || '/health')

    // Perform health check
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
    const [updatedService] = await db
      .update(serviceRegistrySchema)
      .set({
        status,
        lastHealthCheck: new Date(),
        responseTime,
        updatedAt: new Date(),
      })
      .where(eq(serviceRegistrySchema.id, id))
      .returning()

    return NextResponse.json({
      service: updatedService,
      healthCheck: {
        status,
        responseTime,
        error,
        checkedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Error performing health check:', error)
    return NextResponse.json({ error: 'Failed to perform health check' }, { status: 500 })
  }
}
