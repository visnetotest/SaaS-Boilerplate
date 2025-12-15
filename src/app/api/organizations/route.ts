import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { tenantService } from '@/services/TenantService'

const CreateOrganizationSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  industry: z.string().optional(),
  size: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']).optional(),
  website: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

// GET /api/organizations - List organizations for a tenant
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

    const result = await tenantService.listOrganizations(tenantId, {
      page,
      limit,
      search,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Failed to list organizations:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list organizations',
      },
      { status: 500 }
    )
  }
}

// POST /api/organizations - Create a new organization
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateOrganizationSchema.parse(body)

    const organization = await tenantService.createOrganization(validatedData)

    return NextResponse.json(
      {
        success: true,
        data: organization,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create organization:', error)

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
        error: error instanceof Error ? error.message : 'Failed to create organization',
      },
      { status: 500 }
    )
  }
}
