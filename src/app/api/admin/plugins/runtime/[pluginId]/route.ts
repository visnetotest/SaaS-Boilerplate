import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'
import { PluginService } from '@/services/plugins'

// GET /api/admin/plugins/runtime - Get plugin runtime status
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const pluginId = searchParams.get('pluginId')

    let response

    if (pluginId) {
      // Get specific plugin runtime status
      const runtime = await PluginService.getPluginRuntime(pluginId, tenantId)
      const health = await PluginService.getPluginHealth(pluginId, tenantId)
      const metrics = await PluginService.getPluginMetrics(pluginId, tenantId)
      const violations = await PluginService.getPluginViolations(pluginId, tenantId)

      response = {
        pluginId,
        runtime: runtime || null,
        health: health || null,
        metrics: metrics || null,
        violations: violations || [],
      }
    } else if (tenantId) {
      // Get all plugin runtimes for tenant
      const runtimes = await PluginService.getPluginRuntimes(tenantId)
      response = {
        tenantId,
        plugins: runtimes,
        total: runtimes.length,
        active: runtimes.filter(r => r.status === 'active').length,
        error: runtimes.filter(r => r.status === 'error').length,
      }
    } else {
      // Get all plugin runtimes (system admin view)
      const runtimes = await PluginService.getPluginRuntimes()
      response = {
        total: runtimes.length,
        active: runtimes.filter(r => r.status === 'active').length,
        error: runtimes.filter(r => r.status === 'error').length,
        systemPlugins: runtimes.filter(r => !r.pluginId.includes('tenant-')),
        tenantPlugins: runtimes.filter(r => r.pluginId.includes('tenant-')),
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Plugin runtime API error:', error)
    return NextResponse.json(
      { error: 'Failed to get plugin runtime status' },
      { status: 500 }
    )
  }
}

// POST /api/admin/plugins/runtime/[pluginId]/activate - Activate plugin
export async function POST_ACTIVATE(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const config = await request.json()

    await PluginService.activatePluginRuntime(params.pluginId, tenantId, config)

    return NextResponse.json({
      success: true,
      message: `Plugin ${params.pluginId} activated successfully`
    })
  } catch (error) {
    console.error('Plugin activation API error:', error)
    return NextResponse.json(
      { error: 'Failed to activate plugin' },
      { status: 500 }
    )
  }
}

// POST /api/admin/plugins/runtime/[pluginId]/deactivate - Deactivate plugin
export async function POST_DEACTIVATE(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    await PluginService.deactivatePluginRuntime(params.pluginId, tenantId)

    return NextResponse.json({
      success: true,
      message: `Plugin ${params.pluginId} deactivated successfully`
    })
  } catch (error) {
    console.error('Plugin deactivation API error:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate plugin' },
      { status: 500 }
    )
  }
}

// POST /api/admin/plugins/runtime/[pluginId]/configure - Configure plugin
export async function POST_CONFIGURE(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const config = await request.json()

    await PluginService.configurePluginRuntime(params.pluginId, tenantId, config)

    return NextResponse.json({
      success: true,
      message: `Plugin ${params.pluginId} configured successfully`
    })
  } catch (error) {
    console.error('Plugin configuration API error:', error)
    return NextResponse.json(
      { error: 'Failed to configure plugin' },
      { status: 500 }
    )
  }
}

// POST /api/admin/plugins/runtime/[pluginId]/execute - Execute plugin action
export async function POST_EXECUTE(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const userId = searchParams.get('userId')
    const { action, data } = await request.json()

    const result = await PluginService.executePluginAction(
      params.pluginId,
      action,
      data,
      tenantId,
      userId
    )

    return NextResponse.json({
      success: true,
      result,
      message: `Action ${action} executed successfully on plugin ${params.pluginId}`
    })
  } catch (error) {
    console.error('Plugin execution API error:', error)
    return NextResponse.json(
      { error: 'Failed to execute plugin action' },
      { status: 500 }
    )
  }
}

// GET /api/admin/plugins/runtime/[pluginId]/health - Get plugin health
export async function GET_HEALTH(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    const health = await PluginService.getPluginHealth(params.pluginId, tenantId)

    return NextResponse.json({
      pluginId: params.pluginId,
      tenantId,
      health,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Plugin health check API error:', error)
    return NextResponse.json(
      { error: 'Failed to check plugin health' },
      { status: 500 }
    )
  }
}

// GET /api/admin/plugins/runtime/[pluginId]/metrics - Get plugin metrics
export async function GET_METRICS(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    const metrics = await PluginService.getPluginMetrics(params.pluginId, tenantId)
    const sandboxMetrics = await PluginService.getPluginSandboxMetrics()

    return NextResponse.json({
      pluginId: params.pluginId,
      tenantId,
      metrics,
      sandbox: sandboxMetrics,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Plugin metrics API error:', error)
    return NextResponse.json(
      { error: 'Failed to get plugin metrics' },
      { status: 500 }
    )
  }
}