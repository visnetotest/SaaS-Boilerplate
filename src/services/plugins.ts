import { and, count, desc, eq, ilike } from 'drizzle-orm'

import { db } from '@/libs/DB'
import {
  type NewPlugin,
  type Plugin,
  pluginSchema,
  type TenantPlugin,
  tenantPluginSchema,
} from '@/models/Schema'

export interface PluginFilters {
  search?: string
  category?: string
  status?: 'active' | 'inactive' | 'error'
  isSystem?: boolean
  page?: number
  limit?: number
}

export interface TenantPluginFilters {
  search?: string
  status?: 'installed' | 'activated' | 'deactivated' | 'error'
  page?: number
  limit?: number
  tenantId?: string
}

export interface PaginatedPluginResponse {
  data: Plugin[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

export interface PaginatedTenantPluginResponse {
  data: TenantPlugin[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

export class PluginService {
  // Plugin Management
  static async getPlugins(filters: PluginFilters = {}): Promise<PaginatedPluginResponse> {
    const { search, category, status, isSystem, page = 1, limit = 20 } = filters

    const conditions = []

    if (status) conditions.push(eq(pluginSchema.status, status))
    if (category) conditions.push(eq(pluginSchema.category, category))
    if (isSystem !== undefined) conditions.push(eq(pluginSchema.isSystem, isSystem))
    if (search) {
      conditions.push(ilike(pluginSchema.name, `%${search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const totalResult = await db.select({ count: count() }).from(pluginSchema).where(whereClause)
    const total = totalResult[0]?.count || 0

    // Get paginated data
    const offset = (page - 1) * limit
    const plugins = await db
      .select()
      .from(pluginSchema)
      .where(whereClause)
      .orderBy(desc(pluginSchema.createdAt))
      .limit(limit)
      .offset(offset)

    return {
      data: plugins,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    }
  }

  static async getPluginById(pluginId: string): Promise<Plugin | null> {
    const plugin = await db
      .select()
      .from(pluginSchema)
      .where(eq(pluginSchema.id, pluginId))
      .limit(1)

    return plugin[0] || null
  }

  static async createPlugin(pluginData: NewPlugin): Promise<Plugin> {
    const plugin = await db.insert(pluginSchema).values(pluginData).returning()

    if (!plugin[0]) {
      throw new Error('Failed to create plugin')
    }
    return plugin[0]
  }

  static async updatePlugin(pluginId: string, updates: Partial<Plugin>): Promise<Plugin | null> {
    const [plugin] = await db
      .update(pluginSchema)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pluginSchema.id, pluginId))
      .returning()

    return plugin || null
  }

  static async deletePlugin(pluginId: string): Promise<boolean> {
    await db.delete(pluginSchema).where(eq(pluginSchema.id, pluginId))
    return true
  }

  // Tenant Plugin Management
  static async getTenantPlugins(
    filters: TenantPluginFilters = {}
  ): Promise<PaginatedTenantPluginResponse> {
    const { search, status, page = 1, limit = 20, tenantId } = filters

    const conditions = [eq(tenantPluginSchema.tenantId, tenantId || '')]

    if (status) conditions.push(eq(tenantPluginSchema.status, status))
    if (search) {
      // Get plugin names from plugin table
      const pluginNames = await db
        .select({ name: pluginSchema.name, id: pluginSchema.id })
        .from(pluginSchema)
        .where(ilike(pluginSchema.name, `%${search}%`))

      const pluginIds = pluginNames.map((p) => p.id)
      if (pluginIds.length > 0) {
        // Add individual conditions for each plugin ID
        pluginIds.forEach((id) => conditions.push(eq(tenantPluginSchema.pluginId, id)))
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(tenantPluginSchema)
      .where(whereClause)
    const total = totalResult[0]?.count || 0

    // Get paginated data
    const offset = (page - 1) * limit
    const tenantPlugins = await db
      .select({
        id: tenantPluginSchema.id,
        tenantId: tenantPluginSchema.tenantId,
        pluginId: tenantPluginSchema.pluginId,
        status: tenantPluginSchema.status,
        version: tenantPluginSchema.version,
        config: tenantPluginSchema.config,
        settings: tenantPluginSchema.settings,
        installedBy: tenantPluginSchema.installedBy,
        installedAt: tenantPluginSchema.installedAt,
        activatedAt: tenantPluginSchema.activatedAt,
        lastUsedAt: tenantPluginSchema.lastUsedAt,
        createdAt: tenantPluginSchema.createdAt,
        updatedAt: tenantPluginSchema.updatedAt,
        // Join with plugin table to get plugin info
      })
      .from(tenantPluginSchema)
      .innerJoin(pluginSchema, eq(tenantPluginSchema.pluginId, pluginSchema.id))
      .where(whereClause)
      .orderBy(desc(tenantPluginSchema.installedAt))
      .limit(limit)
      .offset(offset)

    return {
      data: tenantPlugins,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    }
  }

  static async getTenantPluginById(tenantPluginId: string): Promise<TenantPlugin | null> {
    const tenantPlugins = await db
      .select()
      .from(tenantPluginSchema)
      .where(eq(tenantPluginSchema.id, tenantPluginId))
      .limit(1)

    return tenantPlugins[0] || null
  }

  static async installPlugin(
    tenantId: string,
    pluginId: string,
    version: string,
    config?: Record<string, any>
  ): Promise<TenantPlugin> {
    // Get plugin details
    const plugin = await this.getPluginById(pluginId)
    if (!plugin) {
      throw new Error('Plugin not found')
    }

    const tenantPlugin = await db
      .insert(tenantPluginSchema)
      .values({
        tenantId,
        pluginId,
        status: 'installed',
        version,
        config: config || {},
        settings: {},
        installedBy: 'system', // Would come from session
      })
      .returning()

    if (!tenantPlugin[0]) {
      throw new Error('Failed to install plugin')
    }
    return tenantPlugin[0]
  }

  static async activatePlugin(tenantPluginId: string): Promise<TenantPlugin | null> {
    const [tenantPlugin] = await db
      .update(tenantPluginSchema)
      .set({
        status: 'activated',
        activatedAt: new Date(),
        lastUsedAt: new Date(),
      })
      .where(eq(tenantPluginSchema.id, tenantPluginId))
      .returning()

    return tenantPlugin || null
  }

  static async deactivatePlugin(tenantPluginId: string): Promise<TenantPlugin | null> {
    const [tenantPlugin] = await db
      .update(tenantPluginSchema)
      .set({
        status: 'deactivated',
      })
      .where(eq(tenantPluginSchema.id, tenantPluginId))
      .returning()

    return tenantPlugin || null
  }

  static async uninstallPlugin(tenantPluginId: string): Promise<boolean> {
    await db.delete(tenantPluginSchema).where(eq(tenantPluginSchema.id, tenantPluginId))
    return true
  }

  static async updatePluginConfig(
    tenantPluginId: string,
    config: Record<string, any>
  ): Promise<TenantPlugin | null> {
    const [tenantPlugin] = await db
      .update(tenantPluginSchema)
      .set({
        config,
        updatedAt: new Date(),
      })
      .where(eq(tenantPluginSchema.id, tenantPluginId))
      .returning()

    return tenantPlugin || null
  }

  static async updatePluginSettings(
    tenantPluginId: string,
    settings: Record<string, any>
  ): Promise<TenantPlugin | null> {
    const [tenantPlugin] = await db
      .update(tenantPluginSchema)
      .set({
        settings,
        updatedAt: new Date(),
      })
      .where(eq(tenantPluginSchema.id, tenantPluginId))
      .returning()

    return tenantPlugin || null
  }

  // Plugin Validation
  static async validatePlugin(pluginData: NewPlugin): Promise<{
    isValid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // Validate required fields
    if (!pluginData.name || pluginData.name.length < 1 || pluginData.name.length > 255) {
      errors.push('Plugin name must be between 1 and 255 characters')
    }

    if (!pluginData.slug || pluginData.slug.length < 1 || pluginData.slug.length > 100) {
      errors.push('Plugin slug must be between 1 and 100 characters')
    }

    if (!pluginData.version || pluginData.version.length < 1 || pluginData.version.length > 50) {
      errors.push('Plugin version must be between 1 and 50 characters')
    }

    // Validate slug format (alphanumeric and hyphens only)
    const slugRegex = /^[a-z0-9-]+$/
    if (pluginData.slug && !slugRegex.test(pluginData.slug)) {
      errors.push('Plugin slug can only contain lowercase letters, numbers, and hyphens')
    }

    // Check for duplicate slug
    const existingPlugin = await db
      .select()
      .from(pluginSchema)
      .where(eq(pluginSchema.slug, pluginData.slug))
      .limit(1)

    if (existingPlugin && existingPlugin[0] && existingPlugin[0].id !== pluginData.id) {
      errors.push('Plugin slug must be unique')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  // Plugin Dependencies
  static async checkDependencies(dependencies: Record<string, string>): Promise<{
    canInstall: boolean
    missingDependencies: string[]
  }> {
    const missingDependencies: string[] = []

    for (const [dependencyName, requiredVersion] of Object.entries(dependencies)) {
      const dependency = await db
        .select()
        .from(pluginSchema)
        .where(eq(pluginSchema.slug, dependencyName))
        .limit(1)

      if (!dependency) {
        missingDependencies.push(`${dependencyName}@${requiredVersion}`)
      }
    }

    return {
      canInstall: missingDependencies.length === 0,
      missingDependencies,
    }
  }

  // Plugin Statistics
  static async getPluginStats(tenantId?: string): Promise<{
    total: number
    active: number
    inactive: number
    error: number
    installed: number
    activated: number
  }> {
    const [totalResult, activeResult, inactiveResult, errorResult] = await Promise.all([
      db.select({ count: count() }).from(pluginSchema),
      db.select({ count: count() }).from(pluginSchema).where(eq(pluginSchema.status, 'active')),
      db.select({ count: count() }).from(pluginSchema).where(eq(pluginSchema.status, 'inactive')),
      db.select({ count: count() }).from(pluginSchema).where(eq(pluginSchema.status, 'error')),
    ])

    let installed = 0
    let activated = 0

    if (tenantId) {
      const [installedResult, activatedResult] = await Promise.all([
        db
          .select({ count: count() })
          .from(tenantPluginSchema)
          .where(and(eq(tenantPluginSchema.tenantId, tenantId))),
        db
          .select({ count: count() })
          .from(tenantPluginSchema)
          .where(
            and(
              eq(tenantPluginSchema.tenantId, tenantId),
              eq(tenantPluginSchema.status, 'activated')
            )
          ),
      ])

      installed = installedResult[0]?.count || 0
      activated = activatedResult[0]?.count || 0
    }

    return {
      total: totalResult[0]?.count || 0,
      active: activeResult[0]?.count || 0,
      inactive: inactiveResult[0]?.count || 0,
      error: errorResult[0]?.count || 0,
      installed,
      activated,
    }
  }
}
