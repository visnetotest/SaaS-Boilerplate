import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/libs/auth'
import { PluginService } from '@/services/plugins'

// Schema for query parameters
const TenantPluginFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['installed', 'activated', 'deactivated', 'error']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  tenantId: z.string().uuid(),
})

// Schema for installing plugins
const InstallPluginSchema = z.object({
  pluginId: z.string().uuid(),
  version: z.string().default('1.0.0'),
  config: z.record(z.any()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = TenantPluginFiltersSchema.parse(Object.fromEntries(searchParams))

    // Verify tenant access - would check session.tenantId matches filters.tenantId
    const result = await PluginService.getTenantPlugins(filters)

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('Error fetching tenant plugins:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tenant plugins' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = InstallPluginSchema.parse(body)

    const tenantPlugin = await PluginService.installPlugin(
      'tenant-1', // Would come from session
      validatedData.pluginId,
      validatedData.version,
      validatedData.config
    )

    return NextResponse.json({
      success: true,
      data: tenantPlugin,
      message: 'Plugin installed successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error installing plugin:', error)
    return NextResponse.json({ success: false, error: 'Failed to install plugin' }, { status: 500 })
  }
}
