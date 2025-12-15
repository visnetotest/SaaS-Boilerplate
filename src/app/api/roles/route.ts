import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { tenantService } from '@/services/TenantService'

const CreateRoleSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  isSystem: z.boolean().optional().default(false),
})

// GET /api/roles - List roles for a tenant
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
    const search = searchParams.get('search') || undefined

    const result = await tenantService.listRoles(tenantId, {
      page,
      limit,
      search,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Failed to list roles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list roles',
      },
      { status: 500 }
    )
  }
}

// POST /api/roles - Create a new role
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateRoleSchema.parse(body)

    const role = await tenantService.createRole(validatedData)

    return NextResponse.json(
      {
        success: true,
        data: role,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create role:', error)

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
        error: error instanceof Error ? error.message : 'Failed to create role',
      },
      { status: 500 }
    )
  }
}
