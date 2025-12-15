import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { tenantService } from '@/services/TenantService'

const CreateUserSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roleIds: z.array(z.string().uuid()).optional(),
  preferences: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

// GET /api/users - List users for a tenant
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant ID is required',
        },
        { status: 400 }
      )
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const organizationId = searchParams.get('organizationId') || undefined
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined

    const result = await tenantService.listUsers(tenantId, {
      page,
      limit,
      organizationId,
      search,
      status,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Failed to list users:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list users',
      },
      { status: 500 }
    )
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateUserSchema.parse(body)

    const user = await tenantService.createUser(validatedData)

    return NextResponse.json(
      {
        success: true,
        data: user,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create user:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      },
      { status: 500 }
    )
  }
}
