import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { tenantService } from '@/services/TenantService'

const UpdateTenantSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    settings: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .partial()

// GET /api/tenants/[id] - Get a specific tenant
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenant = await tenantService.getTenant(id)

    return NextResponse.json({
      success: true,
      data: tenant,
    })
  } catch (error) {
    console.error('Failed to get tenant:', error)

    if (error instanceof Error && error.message === 'Tenant not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tenant',
      },
      { status: 500 }
    )
  }
}

// PUT /api/tenants/[id] - Update a tenant
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const validatedData = UpdateTenantSchema.parse(body)
    const { id } = await params

    const tenant = await tenantService.updateTenant(id, validatedData)

    return NextResponse.json({
      success: true,
      data: tenant,
    })
  } catch (error) {
    console.error('Failed to update tenant:', error)

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

    if (error instanceof Error && error.message === 'Tenant not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update tenant',
      },
      { status: 500 }
    )
  }
}

// DELETE /api/tenants/[id] - Deactivate a tenant
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tenant = await tenantService.deactivateTenant(id)

    return NextResponse.json({
      success: true,
      data: tenant,
    })
  } catch (error) {
    console.error('Failed to deactivate tenant:', error)

    if (error instanceof Error && error.message === 'Tenant not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate tenant',
      },
      { status: 500 }
    )
  }
}
