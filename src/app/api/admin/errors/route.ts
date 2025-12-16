import { and, count, desc, eq, gte, lte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { errorTrackingSchema, serviceRegistrySchema } from '@/models/Schema'

// GET /api/admin/errors - Get error tracking data
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')
    const errorType = searchParams.get('errorType')
    const severity = searchParams.get('severity')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
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
      whereConditions.push(gte(errorTrackingSchema.timestamp, new Date(startDate)))
    }

    if (endDate) {
      whereConditions.push(lte(errorTrackingSchema.timestamp, new Date(endDate)))
    }

    const errors = await db
      .select({
        id: errorTrackingSchema.id,
        serviceId: errorTrackingSchema.serviceId,
        errorType: errorTrackingSchema.errorType,
        severity: errorTrackingSchema.severity,
        errorMessage: errorTrackingSchema.errorMessage,
        stackTrace: errorTrackingSchema.stackTrace,
        context: errorTrackingSchema.context,
        timestamp: errorTrackingSchema.timestamp,
        service: {
          name: serviceRegistrySchema.name,
          slug: serviceRegistrySchema.slug,
        },
      })
      .from(errorTrackingSchema)
      .leftJoin(serviceRegistrySchema, eq(errorTrackingSchema.serviceId, serviceRegistrySchema.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(errorTrackingSchema.timestamp))
      .limit(limit)
      .offset(offset)

    const totalCountResult = await db
      .select({ count: count() })
      .from(errorTrackingSchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

    const totalCount = totalCountResult[0]?.count || 0

    return NextResponse.json({
      errors,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching errors:', error)
    return NextResponse.json({ error: 'Failed to fetch errors' }, { status: 500 })
  }
}

// POST /api/admin/errors - Record a new error
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { errorType, severity, errorMessage, stackTrace, context } = body

    // Validate required fields
    if (!errorType || !severity || !errorMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: errorType, severity, errorMessage' },
        { status: 400 }
      )
    }

    // Validate severity
    const validSeverities = ['debug', 'info', 'warning', 'error', 'critical']
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      )
    }

    // Create new error record
    const [newError] = await db
      .insert(errorTrackingSchema)
      .values({
        errorType,
        severity,
        errorMessage,
        stackTrace: stackTrace || null,
        context: context || {},
        timestamp: new Date(),
      })
      .returning()

    return NextResponse.json(newError, { status: 201 })
  } catch (error) {
    console.error('Error recording error:', error)
    return NextResponse.json({ error: 'Failed to record error' }, { status: 500 })
  }
}
