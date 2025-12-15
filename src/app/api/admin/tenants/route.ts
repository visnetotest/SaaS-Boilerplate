import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { tenantSchema, userSchema } from '@/models/Schema'

// Schema for query parameters
const TenantFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = TenantFiltersSchema.parse(Object.fromEntries(searchParams))

    const conditions = []

    if (filters.status) conditions.push(eq(tenantSchema.status, filters.status))
    if (filters.search) {
      conditions.push(ilike(tenantSchema.name, `%${filters.search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const totalResult = await db.select({ count: count() }).from(tenantSchema).where(whereClause)
    const total = totalResult[0]?.count || 0

    // Get paginated data
    const offset = (filters.page - 1) * filters.limit
    const tenants = await db
      .select()
      .from(tenantSchema)
      .where(whereClause)
      .orderBy(desc(tenantSchema.createdAt))
      .limit(filters.limit)
      .offset(offset)

    // Add user count for each tenant
    const tenantsWithUserCount = await Promise.all(
      tenants.map(async (tenant) => {
        const userCountResult = await db
          .select({ count: count() })
          .from(userSchema)
          .where(eq(userSchema.tenantId, tenant.id))

        return {
          ...tenant,
          userCount: userCountResult[0]?.count || 0,
        }
      })
    )

    const result = {
      data: tenantsWithUserCount,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
        hasNext: filters.page * filters.limit < total,
        hasPrevious: filters.page > 1,
      },
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('Error fetching tenants:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch tenants' }, { status: 500 })
  }
}

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  domain: z.string().url().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = CreateTenantSchema.parse(body)

    const [tenant] = await db.insert(tenantSchema).values(validatedData).returning()

    return NextResponse.json({
      success: true,
      data: tenant,
      message: 'Tenant created successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating tenant:', error)
    return NextResponse.json({ success: false, error: 'Failed to create tenant' }, { status: 500 })
  }
}
