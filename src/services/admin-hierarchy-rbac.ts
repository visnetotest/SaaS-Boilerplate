import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '../libs/DB'
import type { Role, Tenant } from '../models/Schema'
import { roleSchema, tenantSchema, userRoleSchema, userSchema } from '../models/Schema'

export interface HierarchyScope {
  type: 'tenant' | 'organization' | 'subtree'
  id: string
  depth?: number
}

export interface Permission {
  resource: string
  action: string
  conditions?: Record<string, any>
}

export interface HierarchyPermissionCheck {
  userId: string
  targetTenantId: string
  permission: string
  resourceType?: string
  resourceId?: string
}

export interface RoleAssignment {
  userId: string
  roleId: string
  scope: HierarchyScope
  assignedBy?: string
  expiresAt?: Date
}

export class HierarchyRBACService {
  /**
   * Check if a user has a specific permission in a hierarchy context
   */
  async checkHierarchyPermission(
    userId: string,
    targetTenantId: string,
    permission: string,
    resourceType?: string,
    resourceId?: string
  ): Promise<boolean> {
    // Get user's roles and permissions
    const userRoles = await this.getUserRoles(userId)

    if (userRoles.length === 0) return false

    // Check direct permissions
    for (const userRole of userRoles) {
      const permissions = userRole.role.permissions || []

      // Direct permission match
      if (permissions.includes(permission)) {
        // Check if permission applies to this scope
        if (await this.permissionAppliesToScope(userRole, targetTenantId)) {
          return true
        }
      }

      // Wildcard permissions
      if (permissions.includes(`${permission.split(':')[0]}:*`)) {
        if (await this.permissionAppliesToScope(userRole, targetTenantId)) {
          return true
        }
      }

      // Hierarchy-level permissions
      if (permissions.includes('admin:hierarchy:access_all')) return true
      if (
        permissions.includes('admin:hierarchy:access_children') &&
        (await this.canAccessChildren(userId, targetTenantId))
      )
        return true
      if (
        permissions.includes('admin:hierarchy:access_parent') &&
        (await this.canAccessParent(userId, targetTenantId))
      )
        return true
    }

    return false
  }

  /**
   * Get all effective permissions for a user in a specific tenant
   */
  async getEffectivePermissions(userId: string, tenantId: string): Promise<Permission[]> {
    const userRoles = await this.getUserRoles(userId)
    const permissions: Permission[] = []

    for (const userRole of userRoles) {
      const rolePermissions = userRole.role.permissions || []

      for (const permissionString of rolePermissions) {
        const [resource, action] = permissionString.split(':')
        permissions.push({
          resource: resource || permissionString,
          action: action || '*',
          conditions: {
            scope: { type: 'tenant', id: tenantId },
            inherited: false,
            source: 'direct',
          },
        })
      }
    }

    return permissions
  }

  /**
   * Get all tenants a user can access based on their roles
   */
  async getAccessibleTenants(userId: string, permission?: string): Promise<Tenant[]> {
    const user = await db.query.userSchema.findFirst({
      where: eq(userSchema.id, userId),
    })

    if (!user) return []

    // Start with user's own tenant
    const accessibleTenants = [user.tenantId]

    // Get user's roles
    const userRoles = await this.getUserRoles(userId)

    for (const userRole of userRoles) {
      const permissions = userRole.role.permissions || []

      // Check for hierarchy access permissions
      if (permissions.includes('admin:hierarchy:access_all')) {
        // Return all tenants
        return await db.select().from(tenantSchema)
      }

      if (permissions.includes('admin:hierarchy:access_children')) {
        // Add child tenants
        const children = await this.getChildTenants(user.tenantId)
        accessibleTenants.push(...children.map((t) => t.id))
      }

      if (permissions.includes('admin:hierarchy:access_parent')) {
        // Add parent tenants
        const ancestors = await this.getTenantAncestors(user.tenantId)
        accessibleTenants.push(...ancestors.map((t) => t.id))
      }
    }

    // Remove duplicates and get unique tenants
    const uniqueTenantIds = [...new Set(accessibleTenants)]

    return await db.select().from(tenantSchema).where(inArray(tenantSchema.id, uniqueTenantIds))
  }

  /**
   * Check if a user can access child resources
   */
  async canAccessChildren(userId: string, tenantId: string): Promise<boolean> {
    const user = await db.query.userSchema.findFirst({
      where: eq(userSchema.id, userId),
    })

    if (!user) return false

    const userTenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, user.tenantId),
    })

    const targetTenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, tenantId),
    })

    if (!userTenant || !targetTenant) return false

    // Check if target tenant is a child of user's tenant
    return (
      targetTenant.path &&
      userTenant.path &&
      targetTenant.path.startsWith(userTenant.path + '/') &&
      (targetTenant.hierarchyLevel || 0) > (userTenant.hierarchyLevel || 0)
    )
  }

  /**
   * Check if a user can access parent resources
   */
  async canAccessParent(userId: string, tenantId: string): Promise<boolean> {
    const user = await db.query.userSchema.findFirst({
      where: eq(userSchema.id, userId),
    })

    if (!user) return false

    const userTenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, user.tenantId),
    })

    const targetTenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, tenantId),
    })

    if (!userTenant || !targetTenant) return false

    // Check if target tenant is a parent of user's tenant
    return (
      userTenant.path &&
      targetTenant.path &&
      userTenant.path.startsWith(targetTenant.path + '/') &&
      (targetTenant.hierarchyLevel || 0) < (userTenant.hierarchyLevel || 0)
    )
  }

  /**
   * Assign a role with hierarchy scope
   */
  async assignHierarchyRole(
    userId: string,
    roleId: string,
    scope: HierarchyScope,
    assignedBy?: string,
    expiresAt?: Date
  ): Promise<void> {
    // Validate role exists
    const role = await db.query.roleSchema.findFirst({
      where: eq(roleSchema.id, roleId),
    })

    if (!role) {
      throw new Error(`Role ${roleId} not found`)
    }

    // Assign role
    await db.insert(userRoleSchema).values({
      userId,
      roleId,
      assignedBy,
      expiresAt,
      assignedAt: new Date(),
    })

    // Log assignment
    console.log(`Role ${roleId} assigned to user ${userId} with scope ${scope.type}:${scope.id}`)
  }

  // Private helper methods

  private async getUserRoles(userId: string) {
    return await db.query.userRoleSchema.findMany({
      where: eq(userRoleSchema.userId, userId),
      with: {
        role: true,
      },
    })
  }

  private async permissionAppliesToScope(userRole: any, targetTenantId: string): Promise<boolean> {
    // For now, all permissions apply to the user's own tenant
    // In a full implementation, this would check scope restrictions
    return true
  }

  private async getChildTenants(tenantId: string): Promise<Tenant[]> {
    return await db.select().from(tenantSchema).where(eq(tenantSchema.parentTenantId, tenantId))
  }

  private async getTenantAncestors(tenantId: string): Promise<Tenant[]> {
    const tenant = await db.query.tenantSchema.findFirst({
      where: eq(tenantSchema.id, tenantId),
    })

    if (!tenant || !tenant.path) return []

    const pathParts = tenant.path.split('/').filter(Boolean)
    const ancestorPaths = pathParts.map((_, index) => `/${pathParts.slice(0, index + 1).join('/')}`)

    return await db
      .select()
      .from(tenantSchema)
      .where(and(inArray(tenantSchema.path, ancestorPaths), sql`${tenantSchema.id} != ${tenantId}`))
      .orderBy(tenantSchema.hierarchyLevel)
  }
}

export const hierarchyRBACService = new HierarchyRBACService()
