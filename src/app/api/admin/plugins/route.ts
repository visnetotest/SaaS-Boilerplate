import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { pluginSchema, tenantPluginSchema } from '@/models/Schema'
import { pluginRuntime } from '@/services/PluginRuntime'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

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
  manifestPath: z.string().min(1),
  config: z.record(z.any()).optional(),
  secrets: z.record(z.any()).optional(),
  hooks: z.array(z.record(z.any())).optional(),
})



// GET /api/admin/plugins - List all plugins
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = {
      status: searchParams.get('status'),
      category: searchParams.get('category'),
      tenantId: searchParams.get('tenantId'),
      author: searchParams.get('author'),
      tags: searchParams.get('tags')?.split(',').filter(Boolean),
    }

    const validatedFilters = PluginListFiltersSchema.parse(filters)

    // If tenantId is provided, get tenant-specific plugins
    if (validatedFilters.tenantId) {
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
        .where(eq(tenantPluginSchema.tenantId, validatedFilters.tenantId))
        .leftJoin(pluginSchema, eq(tenantPluginSchema.pluginId, pluginSchema.id))

      return NextResponse.json({
        success: true,
        data: tenantPlugins,
        type: 'tenant-plugins'
      })
    }

    // Build where conditions
    const whereConditions = []
    
    if (validatedFilters.status) {
      whereConditions.push(eq(pluginSchema.status, validatedFilters.status))
    }
    
    if (validatedFilters.category) {
      whereConditions.push(eq(pluginSchema.category, validatedFilters.category))
    }
    
    if (validatedFilters.author) {
      whereConditions.push(eq(pluginSchema.author, validatedFilters.author))
    }

    const plugins = await db
      .select()
      .from(pluginSchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(pluginSchema.name)

    return NextResponse.json({
      success: true,
      data: plugins,
      type: 'plugin-list'
    })

  } catch (error) {
    console.error('Failed to list plugins:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list plugins' },
      { status: 500 }
    )
  }
}

// POST /api/admin/plugins - Register a new plugin
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = RegisterPluginSchema.parse(body)

    // TODO: Implement proper permission check

    // Register plugin with runtime
    const pluginId = await pluginRuntime.registerPlugin(validatedData.slug)

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