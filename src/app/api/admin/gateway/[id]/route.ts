import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { apiGatewaySchema } from '@/models/Schema'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/gateway/[id] - Get specific gateway route
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const route = await db
      .select()
      .from(apiGatewaySchema)
      .where(eq(apiGatewaySchema.id, id))
      .limit(1)

    if (route.length === 0) {
      return NextResponse.json({ error: 'Gateway route not found' }, { status: 404 })
    }

    return NextResponse.json(route[0])
  } catch (error) {
    console.error('Error fetching gateway route:', error)
    return NextResponse.json({ error: 'Failed to fetch gateway route' }, { status: 500 })
  }
}

// PUT /api/admin/gateway/[id] - Update gateway route
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
      path,
      method,
      targetServiceId,
      rateLimit,
      burstLimit,
      requiresAuth,
      allowedRoles,
      description,
      config,
      status,
    } = body

    // Check if route exists
    const existingRoute = await db
      .select()
      .from(apiGatewaySchema)
      .where(eq(apiGatewaySchema.id, id))
      .limit(1)

    if (existingRoute.length === 0) {
      return NextResponse.json({ error: 'Gateway route not found' }, { status: 404 })
    }

    // Update route
    const [updatedRoute] = await db
      .update(apiGatewaySchema)
      .set({
        ...(name && { name }),
        ...(path && { path }),
        ...(method && { method: method.toUpperCase() }),
        ...(targetServiceId && { targetServiceId }),
        ...(rateLimit !== undefined && { rateLimit }),
        ...(burstLimit !== undefined && { burstLimit }),
        ...(requiresAuth !== undefined && { requiresAuth }),
        ...(allowedRoles !== undefined && { allowedRoles }),
        ...(description !== undefined && { description }),
        ...(config !== undefined && { config }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      })
      .where(eq(apiGatewaySchema.id, id))
      .returning()

    return NextResponse.json(updatedRoute)
  } catch (error) {
    console.error('Error updating gateway route:', error)
    return NextResponse.json({ error: 'Failed to update gateway route' }, { status: 500 })
  }
}

// DELETE /api/admin/gateway/[id] - Delete gateway route
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if route exists
    const existingRoute = await db
      .select()
      .from(apiGatewaySchema)
      .where(eq(apiGatewaySchema.id, id))
      .limit(1)

    if (existingRoute.length === 0) {
      return NextResponse.json({ error: 'Gateway route not found' }, { status: 404 })
    }

    // Delete route
    await db.delete(apiGatewaySchema).where(eq(apiGatewaySchema.id, id))

    return NextResponse.json({ message: 'Gateway route deleted successfully' })
  } catch (error) {
    console.error('Error deleting gateway route:', error)
    return NextResponse.json({ error: 'Failed to delete gateway route' }, { status: 500 })
  }
}

// POST /api/admin/gateway/[id]/test - Test gateway route
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get route details with service info
    const route = await db
      .select({
        id: apiGatewaySchema.id,
        path: apiGatewaySchema.path,
        method: apiGatewaySchema.method,
        config: apiGatewaySchema.config,
        requiresAuth: apiGatewaySchema.requiresAuth,
        status: apiGatewaySchema.status,
      })
      .from(apiGatewaySchema)
      .where(eq(apiGatewaySchema.id, id))
      .limit(1)

    if (route.length === 0) {
      return NextResponse.json({ error: 'Gateway route not found' }, { status: 404 })
    }

    const routeData = route[0]
    if (!routeData) {
      return NextResponse.json({ error: 'Gateway route not found' }, { status: 404 })
    }

    // Test the route by making a request to the current application
    const startTime = Date.now()
    let testStatus = 'success'
    let responseTime = 0
    let error = null
    let responseStatus = null
    let responseBody = null

    try {
      const testUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${routeData.path}`

      const response = await fetch(testUrl, {
        method: routeData.method,
        headers: {
          'Content-Type': 'application/json',
          // Add test auth header if required
          ...(routeData.requiresAuth && {
            Authorization: 'Bearer test-token',
          }),
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      responseTime = Date.now() - startTime
      responseStatus = response.status

      if (!response.ok) {
        testStatus = 'error'
        error = `HTTP ${response.status}: ${response.statusText}`
      }

      // Try to parse response body
      try {
        responseBody = await response.text()
      } catch {
        responseBody = null
      }
    } catch (err) {
      testStatus = 'error'
      responseTime = Date.now() - startTime
      error = err instanceof Error ? err.message : 'Unknown error'
    }

    return NextResponse.json({
      route: routeData,
      test: {
        status: testStatus,
        responseTime,
        responseStatus,
        error,
        responseBody: responseBody ? responseBody.substring(0, 500) : null, // Limit response body size
        testedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Error testing gateway route:', error)
    return NextResponse.json({ error: 'Failed to test gateway route' }, { status: 500 })
  }
}
