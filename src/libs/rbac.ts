// =============================================================================
// RBAC AUTHORIZATION MIDDLEWARE
// =============================================================================

import { eq } from 'drizzle-orm'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { ForbiddenError, UnauthorizedError } from '@/libs/microservices-errors'
import { roleSchema, userRoleSchema, userSchema } from '@/models/Schema'

// Role and Permission Definitions
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  DEVELOPER: 'developer',
  ANALYST: 'analyst',
} as const

export const PERMISSIONS = {
  // Service Management
  SERVICE_READ: 'service:read',
  SERVICE_CREATE: 'service:create',
  SERVICE_UPDATE: 'service:update',
  SERVICE_DELETE: 'service:delete',
  SERVICE_HEALTH_CHECK: 'service:health_check',

  // Gateway Management
  GATEWAY_READ: 'gateway:read',
  GATEWAY_CREATE: 'gateway:create',
  GATEWAY_UPDATE: 'gateway:update',
  GATEWAY_DELETE: 'gateway:delete',
  GATEWAY_TEST: 'gateway:test',

  // Metrics and Analytics
  METRICS_READ: 'metrics:read',
  METRICS_CREATE: 'metrics:create',
  ANALYTICS_VIEW: 'analytics:view',

  // Error Management
  ERRORS_READ: 'errors:read',
  ERRORS_CREATE: 'errors:create',
  ERRORS_RESOLVE: 'errors:resolve',

  // User and Tenant Management
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  TENANTS_READ: 'tenants:read',
  TENANTS_CREATE: 'tenants:create',
  TENANTS_UPDATE: 'tenants:update',
  TENANTS_DELETE: 'tenants:delete',

  // System Administration
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',
  SYSTEM_LOGS: 'system:logs',
} as const

// Default Role-Permission Mapping
export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_CREATE,
    PERMISSIONS.SERVICE_UPDATE,
    PERMISSIONS.SERVICE_HEALTH_CHECK,
    PERMISSIONS.GATEWAY_READ,
    PERMISSIONS.GATEWAY_CREATE,
    PERMISSIONS.GATEWAY_UPDATE,
    PERMISSIONS.GATEWAY_TEST,
    PERMISSIONS.METRICS_READ,
    PERMISSIONS.METRICS_CREATE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ERRORS_READ,
    PERMISSIONS.ERRORS_CREATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.TENANTS_READ,
    PERMISSIONS.TENANTS_UPDATE,
  ],
  [ROLES.DEVELOPER]: [
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_CREATE,
    PERMISSIONS.SERVICE_UPDATE,
    PERMISSIONS.SERVICE_HEALTH_CHECK,
    PERMISSIONS.GATEWAY_READ,
    PERMISSIONS.GATEWAY_CREATE,
    PERMISSIONS.GATEWAY_UPDATE,
    PERMISSIONS.GATEWAY_TEST,
    PERMISSIONS.METRICS_READ,
    PERMISSIONS.METRICS_CREATE,
    PERMISSIONS.ERRORS_READ,
    PERMISSIONS.ERRORS_CREATE,
  ],
  [ROLES.ANALYST]: [
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_HEALTH_CHECK,
    PERMISSIONS.GATEWAY_READ,
    PERMISSIONS.METRICS_READ,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ERRORS_READ,
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_HEALTH_CHECK,
    PERMISSIONS.GATEWAY_READ,
    PERMISSIONS.ERRORS_READ,
    PERMISSIONS.ERRORS_RESOLVE,
  ],
} as const

export interface UserWithPermissions {
  id: string
  email: string
  roles: string[]
  permissions: string[]
  tenantId?: string
}

export class RBACService {
  // Get user with roles and permissions
  static async getUserWithPermissions(userId: string): Promise<UserWithPermissions | null> {
    try {
      // Get user with roles
      const userWithRoles = await db
        .select({
          id: userSchema.id,
          email: userSchema.email,
          tenantId: userSchema.tenantId,
          roles: {
            name: roleSchema.name,
          },
        })
        .from(userSchema)
        .leftJoin(userRoleSchema, eq(userSchema.id, userRoleSchema.userId))
        .leftJoin(roleSchema, eq(userRoleSchema.roleId, roleSchema.id))
        .where(eq(userSchema.id, userId))

      if (!userWithRoles.length) {
        return null
      }

      const roles = userWithRoles.filter((row) => row.roles).map((row) => row.roles!.name)

      // For now, use default permissions from roles
      // In a real implementation, this would query from role_permissions table
      const permissionList = roles.flatMap(
        (role) => DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS] || []
      )

      // Remove duplicates
      const uniquePermissions = [...new Set(permissionList)]

      const userData = userWithRoles[0]
      if (!userData) return null

      return {
        id: userData.id,
        email: userData.email,
        tenantId: userData.tenantId,
        roles,
        permissions: uniquePermissions,
      }
    } catch (error) {
      console.error('Error getting user permissions:', error)
      return null
    }
  }

  // Check if user has specific permission
  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    const user = await this.getUserWithPermissions(userId)
    if (!user) return false

    return user.permissions.includes(permission)
  }

  // Check if user has any of the specified permissions
  static async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const user = await this.getUserWithPermissions(userId)
    if (!user) return false

    return permissions.some((permission) => user.permissions.includes(permission))
  }

  // Check if user has specific role
  static async hasRole(userId: string, role: string): Promise<boolean> {
    const user = await this.getUserWithPermissions(userId)
    if (!user) return false

    return user.roles.includes(role)
  }

  // Check if user has any of the specified roles
  static async hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
    const user = await this.getUserWithPermissions(userId)
    if (!user) return false

    return roles.some((role) => user.roles.includes(role))
  }

  // Get all permissions for a user
  static async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.getUserWithPermissions(userId)
    return user?.permissions || []
  }

  // Get all roles for a user
  static async getUserRoles(userId: string): Promise<string[]> {
    const user = await this.getUserWithPermissions(userId)
    return user?.roles || []
  }
}

// Authorization Middleware Functions
export function requirePermission(permission: string) {
  return async (userId: string): Promise<void> => {
    const hasPermission = await RBACService.hasPermission(userId, permission)
    if (!hasPermission) {
      throw new ForbiddenError(`Insufficient permissions. Required: ${permission}`)
    }
  }
}

export function requireAnyPermission(permissions: string[]) {
  return async (userId: string): Promise<void> => {
    const hasAnyPermission = await RBACService.hasAnyPermission(userId, permissions)
    if (!hasAnyPermission) {
      throw new ForbiddenError(
        `Insufficient permissions. Required any of: ${permissions.join(', ')}`
      )
    }
  }
}

export function requireRole(role: string) {
  return async (userId: string): Promise<void> => {
    const hasRole = await RBACService.hasRole(userId, role)
    if (!hasRole) {
      throw new ForbiddenError(`Insufficient role. Required: ${role}`)
    }
  }
}

export function requireAnyRole(roles: string[]) {
  return async (userId: string): Promise<void> => {
    const hasAnyRole = await RBACService.hasAnyRole(userId, roles)
    if (!hasAnyRole) {
      throw new ForbiddenError(`Insufficient role. Required any of: ${roles.join(', ')}`)
    }
  }
}

// Higher-order middleware for API routes
export function withAuthAndPermission(permission: string) {
  return async (handler: Function) => {
    return async (request: Request, ...args: any[]) => {
      try {
        // Authenticate user
        const session = await auth()
        if (!session?.user?.id) {
          throw new UnauthorizedError()
        }

        // Check permission
        await requirePermission(permission)(session.user.id)

        // Call the original handler
        return await handler(request, ...args)
      } catch (error) {
        throw error
      }
    }
  }
}

export function withAuthAndRole(role: string) {
  return async (handler: Function) => {
    return async (request: Request, ...args: any[]) => {
      try {
        // Authenticate user
        const session = await auth()
        if (!session?.user?.id) {
          throw new UnauthorizedError()
        }

        // Check role
        await requireRole(role)(session.user.id)

        // Call the original handler
        return await handler(request, ...args)
      } catch (error) {
        throw error
      }
    }
  }
}

// Permission sets for common operations
export const MICROSERVICES_PERMISSIONS = {
  // Service Registry
  SERVICES_READ: [PERMISSIONS.SERVICE_READ],
  SERVICES_WRITE: [PERMISSIONS.SERVICE_CREATE, PERMISSIONS.SERVICE_UPDATE],
  SERVICES_DELETE: [PERMISSIONS.SERVICE_DELETE],
  SERVICES_MANAGE: [
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_CREATE,
    PERMISSIONS.SERVICE_UPDATE,
    PERMISSIONS.SERVICE_DELETE,
  ],
  SERVICES_HEALTH: [PERMISSIONS.SERVICE_HEALTH_CHECK],

  // API Gateway
  GATEWAY_READ: [PERMISSIONS.GATEWAY_READ],
  GATEWAY_WRITE: [PERMISSIONS.GATEWAY_CREATE, PERMISSIONS.GATEWAY_UPDATE],
  GATEWAY_DELETE: [PERMISSIONS.GATEWAY_DELETE],
  GATEWAY_MANAGE: [
    PERMISSIONS.GATEWAY_READ,
    PERMISSIONS.GATEWAY_CREATE,
    PERMISSIONS.GATEWAY_UPDATE,
    PERMISSIONS.GATEWAY_DELETE,
  ],
  GATEWAY_TEST: [PERMISSIONS.GATEWAY_TEST],

  // Metrics
  METRICS_READ: [PERMISSIONS.METRICS_READ],
  METRICS_WRITE: [PERMISSIONS.METRICS_CREATE],
  METRICS_MANAGE: [PERMISSIONS.METRICS_READ, PERMISSIONS.METRICS_CREATE],

  // Error Tracking
  ERRORS_READ: [PERMISSIONS.ERRORS_READ],
  ERRORS_WRITE: [PERMISSIONS.ERRORS_CREATE],
  ERRORS_MANAGE: [PERMISSIONS.ERRORS_READ, PERMISSIONS.ERRORS_CREATE, PERMISSIONS.ERRORS_RESOLVE],
} as const
