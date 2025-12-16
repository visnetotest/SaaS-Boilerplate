import { and, count, desc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { apiGatewaySchema, serviceRegistrySchema } from '@/models/Schema'

// GET /api/admin/gateway - List all gateway routes
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const serviceId = searchParams.get('serviceId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
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

    return NextResponse.json({
      routes,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching gateway routes:', error)
    return NextResponse.json({ error: 'Failed to fetch gateway routes' }, { status: 500 })
  }
}

// POST /api/admin/gateway - Create new gateway route
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
      return NextResponse.json(
        { error: 'Missing required fields: name, slug, path, method, targetServiceId' },
        { status: 400 }
      )
    }

    // Check if route slug already exists
    const existingRoute = await db
      .select()
      .from(apiGatewaySchema)
      .where(eq(apiGatewaySchema.slug, slug))
      .limit(1)

    if (existingRoute.length > 0) {
      return NextResponse.json({ error: 'Route with this slug already exists' }, { status: 409 })
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
      return NextResponse.json(
        { error: 'Route with this path and method already exists' },
        { status: 409 }
      )
    }

    // Create new route
    const [newRoute] = await db
      .insert(apiGatewaySchema)
      .values({
        name,
        slug,
        path,
        method: method.toUpperCase(),
        targetServiceId,
        rateLimit,
        burstLimit,
        requiresAuth: requiresAuth !== undefined ? requiresAuth : true,
        allowedRoles,
        description,
        config: config || {},
        status: 'active',
      })
      .returning()

    return NextResponse.json(newRoute, { status: 201 })
  } catch (error) {
    console.error('Error creating gateway route:', error)
    return NextResponse.json({ error: 'Failed to create gateway route' }, { status: 500 })
  }
}
