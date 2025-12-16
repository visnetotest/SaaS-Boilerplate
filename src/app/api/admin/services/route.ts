import { and, count, desc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { apiGatewaySchema, serviceRegistrySchema } from '@/models/Schema'

// GET /api/admin/services - List all services
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
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

    return NextResponse.json({
      services,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
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
      return NextResponse.json(
        { error: 'Missing required fields: name, slug, version, baseUrl, healthEndpoint' },
        { status: 400 }
      )
    }

    // Check if service slug already exists
    const existingService = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.slug, slug))
      .limit(1)

    if (existingService.length > 0) {
      return NextResponse.json({ error: 'Service with this slug already exists' }, { status: 409 })
    }

    // Create new service
    const [newService] = await db
      .insert(serviceRegistrySchema)
      .values({
        name,
        slug,
        version,
        baseUrl,
        healthEndpoint,
        docsEndpoint,
        description,
        category,
        tags,
        isInternal: isInternal || false,
        config: config || {},
        secrets: secrets || {},
        status: 'inactive',
      })
      .returning()

    return NextResponse.json(newService, { status: 201 })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
