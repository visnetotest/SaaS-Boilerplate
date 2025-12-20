import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/libs/DB'
import type { NewTenant, Tenant } from '@/models/Schema'
import {
  roleSchema,
  tenantHierarchySchema,
  tenantSchema,
  userRoleSchema,
  userSchema,
} from '@/models/Schema'

export interface TenantTree {
  id: string
  name: string
  slug: string
  status: string
  hierarchyLevel: number
  path: string
  settings: Record<string, any>
  metadata: Record<string, any>
  children: TenantTree[]
  parent?: TenantTree
}

export interface CreateTenantData {
  name: string
  slug: string
  domain?: string
  parentTenantId?: string
  settings?: Record<string, any>
  settingsInheritance?: Record<string, any>
  metadata?: Record<string, any>
}

export interface InheritanceRules {
  settings: string[]
  permissions: string[]
  plugins: string[]
  custom?: Record<string, boolean>
}

export class TenantHierarchyService {
  /**
   * Create a new tenant with hierarchy support
   */
  async createTenant(data: CreateTenantData): Promise<Tenant> {
    let hierarchyLevel = 0
    let path = `/${data.slug}`

    // If this is a child tenant, calculate hierarchy level and path
    if (data.parentTenantId) {
      const parentTenant = await db.query.tenantSchema.findFirst({
        where: eq(tenantSchema.id, data.parentTenantId),
      })

      if (!parentTenant) {
        throw new Error(`Parent tenant ${data.parentTenantId} not found`)
      }

      hierarchyLevel = (parentTenant.hierarchyLevel || 0) + 1
      const parentPath = parentTenant.path || `/${parentTenant.slug}`
      path = `${parentPath}/${data.slug}`
    }

    // Create tenant
    const [tenant] = await db
      .insert(tenantSchema)
      .values({
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        settings: data.settings || {},
        metadata: data.metadata || {},
        hierarchyLevel,
        path,
        settingsInheritance: data.settingsInheritance || {},
      })
      .returning()

    // Create hierarchy record
    if (data.parentTenantId) {
      await db.insert(tenantHierarchySchema).values({
        tenantId: tenant.id,
        parentTenantId: data.parentTenantId,
        hierarchyLevel,
        path,
        canAccessChildren: false,
        canAccessParent: false,
        inheritedPermissions: {},
      })
    }

    return tenant
  }

  /**
   * Move a tenant to a new parent
   */
  async moveTenant(tenantId: string, newParentId?: string): Promise<Tenant> {
    const tenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, tenantId),
    })

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`)
    }

    // Check for circular reference
    if (newParentId && (await this.wouldCreateCircularReference(tenantId, newParentId))) {
      throw new Error('Moving tenant would create circular reference')
    }

    let hierarchyLevel = 0
    let path = `/${tenant.slug}`

    if (newParentId) {
      const parentTenant = await db.query.tenantSchema.findFirst({
        where: eq(tenantSchema.id, newParentId),
      })

      if (!parentTenant) {
        throw new Error(`Parent tenant ${newParentId} not found`)
      }

      hierarchyLevel = (parentTenant.hierarchyLevel || 0) + 1
      const parentPath = parentTenant.path || `/${parentTenant.slug}`
      path = `${parentPath}/${tenant.slug}`
    }

    // Update tenant hierarchy info
    await db
      .update(tenantSchema)
      .set({
        parentTenantId: newParentId,
        hierarchyLevel,
        path,
        updatedAt: new Date(),
      })
      .where(eq(tenantSchema.id, tenantId))

    // Update hierarchy record
    if (newParentId) {
      const existingHierarchy = await db.query.tenantHierarchySchema.findFirst({
        where: eq(tenantHierarchySchema.tenantId, tenantId),
      })

      if (existingHierarchy) {
        await db
          .update(tenantHierarchySchema)
          .set({
            parentTenantId: newParentId,
            hierarchyLevel,
            path,
            updatedAt: new Date(),
          })
          .where(eq(tenantHierarchySchema.tenantId, tenantId))
      } else {
        await db.insert(tenantHierarchySchema).values({
          tenantId,
          parentTenantId: newParentId,
          hierarchyLevel,
          path,
          canAccessChildren: false,
          canAccessParent: false,
          inheritedPermissions: {},
        })
      }

      // Update all children paths and levels
      await this.updateChildrenHierarchy(tenantId, path, hierarchyLevel)
    } else {
      // Remove hierarchy record if moving to root
      await db.delete(tenantHierarchySchema).where(eq(tenantHierarchySchema.tenantId, tenantId))

      // Update all children paths and levels
      await this.updateChildrenHierarchy(tenantId, path, hierarchyLevel)
    }

    const updatedTenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, tenantId),
    })

    if (!updatedTenant) {
      throw new Error(`Failed to update tenant ${tenantId}`)
    }

    return updatedTenant
  }

  /**
   * Get tenant hierarchy tree
   */
  async getTenantHierarchy(tenantId: string): Promise<TenantTree | null> {
    const tenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, tenantId),
    })

    if (!tenant) return null

    const children = await this.getChildTenants(tenantId)

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      hierarchyLevel: tenant.hierarchyLevel || 0,
      path: tenant.path || `/${tenant.slug}`,
      settings: tenant.settings || {},
      metadata: tenant.metadata || {},
      children: children.map((child) => ({
        ...child,
        children: [], // Will be populated recursively if needed
      })),
    }
  }

  /**
   * Get all ancestors of a tenant
   */
  async getTenantAncestors(tenantId: string): Promise<Tenant[]> {
    const tenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, tenantId),
    })

    if (!tenant || !tenant.path) return []

    const pathParts = tenant.path.split('/').filter(Boolean)
    const ancestorPaths = pathParts.map((_, index) => `/${pathParts.slice(0, index + 1).join('/')}`)

    const ancestors = await db
      .select()
      .from(tenantSchema)
      .where(and(inArray(tenantSchema.path, ancestorPaths), sql`${tenantSchema.id} != ${tenantId}`))
      .orderBy(tenantSchema.hierarchyLevel)

    return ancestors
  }

  /**
   * Get all descendants of a tenant
   */
  async getTenantDescendants(tenantId: string, maxDepth?: number): Promise<Tenant[]> {
    const tenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, tenantId),
    })

    if (!tenant || !tenant.path) return []

    const baseLevel = tenant.hierarchyLevel || 0
    const maxHierarchyLevel = maxDepth ? baseLevel + maxDepth : 999

    return await db
      .select()
      .from(tenantSchema)
      .where(
        and(
          sql`${tenantSchema.path} LIKE ${tenant.path + '%'}`,
          sql`${tenantSchema.id} != ${tenantId}`,
          sql`${tenantSchema.hierarchyLevel} <= ${maxHierarchyLevel}`
        )
      )
      .orderBy(tenantSchema.hierarchyLevel, tenantSchema.name)
  }

  /**
   * Get inherited settings for a tenant
   */
  async getInheritedSettings(tenantId: string): Promise<Record<string, any>> {
    const tenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, tenantId),
    })

    if (!tenant) return {}

    const ancestors = await this.getTenantAncestors(tenantId)
    const inheritedSettings: Record<string, any> = {}

    // Merge inherited settings from ancestors
    for (const ancestor of ancestors.reverse()) {
      // Start from root
      const ancestorInheritance = ancestor.settingsInheritance || {}
      const ancestorSettings = ancestor.settings || {}

      // Apply inherited settings based on rules
      for (const [key, inherit] of Object.entries(ancestorInheritance)) {
        if (inherit && ancestorSettings[key] !== undefined) {
          inheritedSettings[key] = ancestorSettings[key]
        }
      }
    }

    return {
      ...inheritedSettings,
      ...tenant.settings, // Tenant's own settings override inherited ones
    }
  }

  /**
   * Set inheritance rules for a tenant
   */
  async setInheritanceRules(tenantId: string, rules: InheritanceRules): Promise<void> {
    await db
      .update(tenantSchema)
      .set({
        settingsInheritance: {
          settings: rules.settings || [],
          permissions: rules.permissions || [],
          plugins: rules.plugins || [],
          ...rules.custom,
        },
        updatedAt: new Date(),
      })
      .where(eq(tenantSchema.id, tenantId))
  }

  /**
   * Propagate settings to children tenants
   */
  async propagateSettings(tenantId: string, settings: Partial<Record<string, any>>): Promise<void> {
    const children = await this.getTenantDescendants(tenantId, 1)

    for (const child of children) {
      const currentSettings = child.settings || {}
      const updatedSettings = { ...currentSettings, ...settings }

      await db
        .update(tenantSchema)
        .set({
          settings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(tenantSchema.id, child.id))
    }
  }

  /**
   * Check if a user has access to a tenant based on hierarchy
   */
  async canAccessTenant(userId: string, targetTenantId: string): Promise<boolean> {
    const user = await db.query.userSchema.findFirst({
      where: eq(userSchema.id, userId),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    })

    if (!user) return false

    // Direct access to own tenant
    if (user.tenantId === targetTenantId) return true

    // Check hierarchy permissions
    const userTenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, user.tenantId),
    })

    const targetTenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, targetTenantId),
    })

    if (!userTenant || !targetTenant) return false

    // Check if user can access parent/child based on hierarchy
    for (const userRole of user.userRoles) {
      const permissions = userRole.role.permissions || []

      // Check if user has hierarchy access permissions
      if (permissions.includes('admin:hierarchy:access_all')) return true
      if (
        permissions.includes('admin:hierarchy:access_children') &&
        this.isParentOf(userTenant, targetTenant)
      )
        return true
      if (
        permissions.includes('admin:hierarchy:access_parent') &&
        this.isParentOf(targetTenant, userTenant)
      )
        return true
    }

    return false
  }

  /**
   * Get all tenants accessible to a user
   */
  async getAccessibleTenants(userId: string): Promise<Tenant[]> {
    const user = await db.query.userSchema.findFirst({
      where: eq(userSchema.id, userId),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    })

    if (!user) return []

    const allPermissions = user.userRoles.flatMap((ur) => ur.role.permissions || [])

    // If user has access all permissions, return all tenants
    if (allPermissions.includes('admin:hierarchy:access_all')) {
      return await db.select().from(tenantSchema)
    }

    // Start with user's own tenant
    const userTenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, user.tenantId),
    })

    if (!userTenant) return []

    const accessibleTenants: Tenant[] = [userTenant]

    // Add children if user has children access
    if (allPermissions.includes('admin:hierarchy:access_children')) {
      const children = await this.getTenantDescendants(user.tenantId)
      accessibleTenants.push(...children)
    }

    // Add parent if user has parent access
    if (allPermissions.includes('admin:hierarchy:access_parent')) {
      const ancestors = await this.getTenantAncestors(user.tenantId)
      accessibleTenants.push(...ancestors)
    }

    // Remove duplicates
    const uniqueTenants = accessibleTenants.filter(
      (tenant, index, self) => index === self.findIndex((t) => t.id === tenant.id)
    )

    return uniqueTenants
  }

  // Private helper methods

  private async getChildTenants(tenantId: string): Promise<TenantTree[]> {
    const children = await db
      .select()
      .from(tenantSchema)
      .where(eq(tenantSchema.parentTenantId, tenantId))
      .orderBy(tenantSchema.name)

    return children.map((child) => ({
      id: child.id,
      name: child.name,
      slug: child.slug,
      status: child.status,
      hierarchyLevel: child.hierarchyLevel || 0,
      path: child.path || `/${child.slug}`,
      settings: child.settings || {},
      metadata: child.metadata || {},
      children: [],
    }))
  }

  private async wouldCreateCircularReference(
    tenantId: string,
    newParentId: string
  ): Promise<boolean> {
    const descendants = await this.getTenantDescendants(tenantId)
    return descendants.some((descendant) => descendant.id === newParentId)
  }

  private isParentOf(parent: Tenant, child: Tenant): boolean {
    if (!parent.path || !child.path) return false
    return (
      child.path.startsWith(parent.path + '/') &&
      (parent.hierarchyLevel || 0) < (child.hierarchyLevel || 0)
    )
  }

  private async updateChildrenHierarchy(
    parentId: string,
    parentPath: string,
    parentLevel: number
  ): Promise<void> {
    const children = await this.getTenantDescendants(parentId, 1)

    for (const child of children) {
      const childPath = `${parentPath}/${child.slug}`
      const childLevel = parentLevel + 1

      await db
        .update(tenantSchema)
        .set({
          path: childPath,
          hierarchyLevel: childLevel,
          updatedAt: new Date(),
        })
        .where(eq(tenantSchema.id, child.id))

      // Recursively update grandchildren
      await this.updateChildrenHierarchy(child.id, childPath, childLevel)
    }
  }
}

export const tenantHierarchyService = new TenantHierarchyService()
