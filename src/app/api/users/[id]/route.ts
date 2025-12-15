import { NextRequest, NextResponse } from 'next/server'

import { tenantService } from '@/services/TenantService'

// GET /api/users/[id] - Get a specific user
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const { id } = await params

    const user = await tenantService.getUser(id, tenantId || undefined)

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('Failed to get user:', error)

    if (error instanceof Error && error.message === 'User not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user',
      },
      { status: 500 }
    )
  }
}
