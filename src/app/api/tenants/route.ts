import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { tenantService } from '@/services/TenantService'

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

// GET /api/tenants - List all tenants
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined

    const result = await tenantService.listTenants({
      page,
      limit,
      status,
      search,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Failed to list tenants:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list tenants',
      },
      { status: 500 }
    )
  }
}

// POST /api/tenants - Create a new tenant
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateTenantSchema.parse(body)

    const tenant = await tenantService.createTenant(validatedData)

    return NextResponse.json(
      {
        success: true,
        data: tenant,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create tenant:', error)

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
        error: error instanceof Error ? error.message : 'Failed to create tenant',
      },
      { status: 500 }
    )
  }
}
