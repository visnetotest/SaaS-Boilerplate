import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { userSchema } from '@/models/Schema'

// Schema for query parameters
const UserFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  tenantId: z.string().uuid().optional(),
  role: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// Schema for creating users
const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  tenantId: z.string().uuid(),
  passwordHash: z.string().min(8).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  locale: z.string().default('en'),
  timezone: z.string().default('UTC'),
})

// Get users
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = UserFiltersSchema.parse(Object.fromEntries(searchParams))

    const conditions = []

    if (filters.status) conditions.push(eq(userSchema.status, filters.status))
    if (filters.tenantId) conditions.push(eq(userSchema.tenantId, filters.tenantId))
    if (filters.search) {
      conditions.push(ilike(userSchema.email, `%${filters.search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const totalResult = await db.select({ count: count() }).from(userSchema).where(whereClause)
    const total = totalResult[0]?.count || 0

    // Get paginated data
    const offset = (filters.page - 1) * filters.limit
    const users = await db
      .select()
      .from(userSchema)
      .where(whereClause)
      .orderBy(desc(userSchema.createdAt))
      .limit(filters.limit)
      .offset(offset)

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
        hasNext: filters.page * filters.limit < total,
        hasPrevious: filters.page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 })
  }
}

// Create user
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = CreateUserSchema.parse(body)

    const [user] = await db.insert(userSchema).values(validatedData).returning()

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User created successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating user:', error)
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 })
  }
}
