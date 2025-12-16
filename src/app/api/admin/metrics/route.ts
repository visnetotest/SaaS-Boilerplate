import { and, count, desc, eq, gte, lte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { performanceMetricsSchema, serviceRegistrySchema } from '@/models/Schema'

// GET /api/admin/metrics - Get performance metrics
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')
    const metricName = searchParams.get('metricName')
    const metricType = searchParams.get('metricType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
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
      whereConditions.push(gte(performanceMetricsSchema.timestamp, new Date(startDate)))
    }

    if (endDate) {
      whereConditions.push(lte(performanceMetricsSchema.timestamp, new Date(endDate)))
    }

    const metrics = await db
      .select({
        id: performanceMetricsSchema.id,
        serviceId: performanceMetricsSchema.serviceId,
        metricName: performanceMetricsSchema.metricName,
        metricType: performanceMetricsSchema.metricType,
        value: performanceMetricsSchema.value,
        unit: performanceMetricsSchema.unit,
        tags: performanceMetricsSchema.tags,
        timestamp: performanceMetricsSchema.timestamp,
        service: {
          name: serviceRegistrySchema.name,
          slug: serviceRegistrySchema.slug,
        },
      })
      .from(performanceMetricsSchema)
      .leftJoin(
        serviceRegistrySchema,
        eq(performanceMetricsSchema.serviceId, serviceRegistrySchema.id)
      )
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(performanceMetricsSchema.timestamp))
      .limit(limit)
      .offset(offset)

    const totalCountResult = await db
      .select({ count: count() })
      .from(performanceMetricsSchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

    const totalCount = totalCountResult[0]?.count || 0

    return NextResponse.json({
      metrics,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}

// POST /api/admin/metrics - Record a new metric
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { serviceId, metricName, metricType, value, unit, tags } = body

    // Validate required fields
    if (!serviceId || !metricName || !metricType || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceId, metricName, metricType, value' },
        { status: 400 }
      )
    }

    // Validate metric type
    const validMetricTypes = ['counter', 'gauge', 'histogram', 'timer']
    if (!validMetricTypes.includes(metricType)) {
      return NextResponse.json(
        { error: `Invalid metric type. Must be one of: ${validMetricTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if service exists
    const service = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.id, serviceId))
      .limit(1)

    if (service.length === 0) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Create new metric
    const [newMetric] = await db
      .insert(performanceMetricsSchema)
      .values({
        serviceId,
        metricName,
        metricType,
        value,
        unit: unit || null,
        tags: tags || {},
        timestamp: new Date(),
      })
      .returning()

    return NextResponse.json(newMetric, { status: 201 })
  } catch (error) {
    console.error('Error recording metric:', error)
    return NextResponse.json({ error: 'Failed to record metric' }, { status: 500 })
  }
}

// GET /api/admin/metrics/summary - Get metrics summary
export async function GET_SUMMARY(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(_request.url)
    const serviceId = searchParams.get('serviceId')
    const period = searchParams.get('period') || '24h' // Default to last 24 hours

    // Calculate date range based on period
    const now = new Date()
    let startDate = new Date()

    switch (period) {
      case '1h':
        startDate.setHours(now.getHours() - 1)
        break
      case '24h':
        startDate.setDate(now.getDate() - 1)
        break
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      default:
        startDate.setDate(now.getDate() - 1)
    }

    // Get aggregated metrics
    const summary = await db
      .select({
        metricName: performanceMetricsSchema.metricName,
        metricType: performanceMetricsSchema.metricType,
        avg: performanceMetricsSchema.value,
        min: performanceMetricsSchema.value,
        max: performanceMetricsSchema.value,
        count: count(),
      })
      .from(performanceMetricsSchema)
      .where(serviceId ? and(eq(performanceMetricsSchema.serviceId, serviceId)) : undefined)
      .groupBy(performanceMetricsSchema.metricName, performanceMetricsSchema.metricType)
      .orderBy(desc(count()))

    return NextResponse.json({
      summary,
      period,
      dateRange: {
        start: startDate,
        end: now,
      },
    })
  } catch (error) {
    console.error('Error fetching metrics summary:', error)
    return NextResponse.json({ error: 'Failed to fetch metrics summary' }, { status: 500 })
  }
}
