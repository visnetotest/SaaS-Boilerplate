import { NextRequest, NextResponse } from 'next/server'

import { tenantService } from '@/services/TenantService'

// GET /api/organizations/[id] - Get a specific organization
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const { id } = await params

    const organization = await tenantService.getOrganization(id, tenantId || undefined)

    return NextResponse.json({
      success: true,
      data: organization,
    })
  } catch (error) {
    console.error('Failed to get organization:', error)

    if (error instanceof Error && error.message === 'Organization not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get organization',
      },
      { status: 500 }
    )
  }
}
