import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/libs/auth'
import { PluginService } from '@/services/plugins'

// Schema for query parameters
const PluginFiltersSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['active', 'inactive', 'error']).optional(),
  isSystem: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// Schema for creating plugins
const CreatePluginSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  version: z.string().min(1).max(50),
  description: z.string().optional(),
  author: z.string().max(255),
  repository: z.string().url().optional(),
  homepage: z.string().url().optional(),
  category: z.string().max(100),
  tags: z.array(z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  manifest: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
})

// Get plugins from marketplace
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = PluginFiltersSchema.parse(Object.fromEntries(searchParams))

    const result = await PluginService.getPlugins(filters)

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('Error fetching plugins:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch plugins' }, { status: 500 })
  }
}

// Create new plugin (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = CreatePluginSchema.parse(body)

    // Validate plugin uniqueness
    const validation = await PluginService.validatePlugin(validatedData)
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const plugin = await PluginService.createPlugin(validatedData)

    return NextResponse.json({
      success: true,
      data: plugin,
      message: 'Plugin created successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating plugin:', error)
    return NextResponse.json({ success: false, error: 'Failed to create plugin' }, { status: 500 })
  }
}
