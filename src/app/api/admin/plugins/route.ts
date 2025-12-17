import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { pluginSchema, tenantPluginSchema } from '@/models/Schema'
import { pluginRuntime } from '@/services/PluginRuntime'
import { z } from 'z'

// Schemas
const PluginListFiltersSchema = z.object({
  status: z.enum(['active', 'inactive', 'error']).optional(),
  category: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

const RegisterPluginSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  repository: z.string().url().optional(),
  homepage: z.string().url().optional(),
  category: z.string(),
  tags: z.array(z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  main: z.string().optional(),
  server: z.string().optional(),
  client: z.string().optional(),
  permissions: z.array(z.object({
    resource: z.string(),
    actions: z.array(z.string()),
    description: z.string().optional(),
  })).optional(),
  sandbox: z.object({
    enabled: z.boolean().optional(),
    timeout: z.number().optional(),
    memory: z.number().optional(),
    allowedDomains: z.array(z.string()).optional(),
    allowedModules: z.array(z.string()).optional(),
    blockedModules: z.array(z.string()).optional(),
  }).optional(),
  hooks: z.array(z.object({
    name: z.string(),
    event: z.string(),
    priority: z.number().optional(),
    handler: z.string(),
  })).optional(),
})

const PluginActionSchema = z.object({
  action: z.enum(['load', 'unload', 'enable', 'disable', 'unregister']),
  tenantId: z.string().uuid().optional(),
})

// GET /api/admin/plugins - List plugins
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions (simplified)
    // TODO: Implement proper RBAC check

    const { searchParams } = new URL(request.url)
    const filters = PluginListFiltersSchema.parse(Object.fromEntries(searchParams))

    // Build query
    const conditions = []
    if (filters.status) {
      conditions.push(eq(pluginSchema.status, filters.status))
    }
    if (filters.category) {
      conditions.push(eq(pluginSchema.category, filters.category))
    }
    if (filters.tenantId) {
      // Query tenant_plugins for tenant-specific installations
      const tenantPlugins = await db
        .select({
          id: tenantPluginSchema.id,
          pluginId: tenantPluginSchema.pluginId,
          status: tenantPluginSchema.status,
          version: tenantPluginSchema.version,
          config: tenantPluginSchema.config,
          settings: tenantPluginSchema.settings,
          installedAt: tenantPluginSchema.installedAt,
          activatedAt: tenantPluginSchema.activatedAt,
        })
        .from(tenantPluginSchema)
        .where(eq(tenantPluginSchema.tenantId, filters.tenantId))
        .leftJoin(pluginSchema, eq(tenantPluginSchema.pluginId, pluginSchema.id))

      return NextResponse.json({
        success: true,
        data: tenantPlugins,
        type: 'tenant-plugins'
      })
    }

    const whereClause = conditions.length > 0 ? conditions.reduce((acc, condition) => acc && condition) : undefined

    const plugins = await db
      .select()
      .from(pluginSchema)
      .where(whereClause)
      .orderBy(pluginSchema.name)

    return NextResponse.json({
      success: true,
      data: plugins,
      type: 'system-plugins'
    })

  } catch (error) {
    console.error('Failed to list plugins:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list plugins' },
      { status: 500 }
    )
  }
}

// POST /api/admin/plugins - Register new plugin
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Implement admin permission check
    const body = await request.json()
    const validatedData = RegisterPluginSchema.parse(body)

    // Check for existing plugin
    const existing = await db
      .select()
      .from(pluginSchema)
      .where(eq(pluginSchema.slug, validatedData.slug))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Plugin with this slug already exists' },
        { status: 409 }
      )
    }

    // Register plugin with runtime
    const pluginId = await pluginRuntime.registerPlugin(validatedData.slug, validatedData)

    return NextResponse.json({
      success: true,
      data: { pluginId },
      message: 'Plugin registered successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to register plugin:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to register plugin' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/plugins/[pluginId]/[action] - Plugin lifecycle actions
export async function PUT(
  request: NextRequest,
  { params }: { params: { pluginId: string; action: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pluginId, action } = params
    const body = await request.json()
    const { tenantId } = PluginActionSchema.parse(body)

    // TODO: Implement admin permission check

    switch (action) {
      case 'load':
        await pluginRuntime.loadPlugin(pluginId, tenantId)
        break

      case 'unload':
        await pluginRuntime.unloadPlugin(pluginId, tenantId)
        break

      case 'enable':
        await pluginRuntime.enablePlugin(pluginId, tenantId)
        break

      case 'disable':
        await pluginRuntime.disablePlugin(pluginId, tenantId)
        break

      case 'unregister':
        await pluginRuntime.unregisterPlugin(pluginId)
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `Plugin ${action} action completed successfully`
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error(`Failed to ${action} plugin:`, error)
    return NextResponse.json(
      { success: false, error: `Failed to ${action} plugin` },
      { status: 500 }
    )
  }
}

// GET /api/admin/plugins/[pluginId] - Get plugin details
export async function GET_PLUGIN(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pluginId } = params
    const { searchParams } = new URL(request.url)
    const { tenantId } = Object.fromEntries(searchParams)

    const plugin = pluginRuntime.getPlugin(pluginId)
    if (!plugin) {
      return NextResponse.json(
        { success: false, error: 'Plugin not found' },
        { status: 404 }
      )
    }

    // Get additional tenant-specific data if requested
    let tenantPlugin = null
    if (tenantId) {
      tenantPlugin = await db
        .select()
        .from(tenantPluginSchema)
        .where(
          and(
            eq(tenantPluginSchema.pluginId, plugin.id),
            eq(tenantPluginSchema.tenantId, tenantId)
          )
        )
        .limit(1)
        .then(rows => rows[0] || null)
    }

    const health = pluginRuntime.getPluginHealth(pluginId)

    return NextResponse.json({
      success: true,
      data: {
        ...plugin,
        tenantPlugin,
        health,
      }
    })

  } catch (error) {
    console.error('Failed to get plugin details:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get plugin details' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/plugins/[pluginId] - Unregister plugin
export async function DELETE_PLUGIN(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pluginId } = params

    // Check if plugin exists
    const plugin = pluginRuntime.getPlugin(pluginId)
    if (!plugin) {
      return NextResponse.json(
        { success: false, error: 'Plugin not found' },
        { status: 404 }
      )
    }

    // Unregister plugin
    await pluginRuntime.unregisterPlugin(pluginId)

    return NextResponse.json({
      success: true,
      message: 'Plugin unregistered successfully'
    })

  } catch (error) {
    console.error('Failed to unregister plugin:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to unregister plugin' },
      { status: 500 }
    )
  }
}