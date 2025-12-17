import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'

// GET /api/admin/plugins/runtime/[pluginId] - Get plugin runtime status
export async function GET(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pluginId = params.pluginId

    // TODO: Implement plugin runtime status check
    return NextResponse.json({
      pluginId,
      status: 'temporarily_disabled',
      message: 'Plugin runtime API temporarily disabled'
    })
  } catch (error) {
    console.error('Plugin runtime status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}