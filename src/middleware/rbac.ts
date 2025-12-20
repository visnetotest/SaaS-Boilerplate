// =============================================================================
// RBAC MIDDLEWARE - PERMISSION CHECKING
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

// Permission definitions
export enum Permissions {
  // User Management
  ADMIN_USER_READ = 'admin:user:read',
  ADMIN_USER_WRITE = 'admin:user:write',
  ADMIN_USER_DELETE = 'admin:user:delete',

  // Tenant Management
  ADMIN_TENANT_READ = 'admin:tenant:read',
  ADMIN_TENANT_WRITE = 'admin:tenant:write',
  ADMIN_TENANT_DELETE = 'admin:tenant:delete',

  // Analytics & Reports
  ADMIN_ANALYTICS_READ = 'admin:analytics:read',
  ADMIN_ANALYTICS_EXPORT = 'admin:analytics:export',

  // System Management
  ADMIN_SYSTEM_READ = 'admin:system:read',
  ADMIN_SYSTEM_WRITE = 'admin:system:write',
}

// Simple permission check (you can enhance this later)
async function checkUserPermission(_userId: string, _permission: Permissions): Promise<boolean> {
  // This is a simplified version - implement based on your auth system
  // For now, return true for all authenticated users (NOT PRODUCTION READY)
  // In production, you would check against a database of user roles/permissions
  return true
}

// Middleware to check user permissions
export async function withRBAC(
  request: NextRequest,
  requiredPermissions: Permissions | Permissions[],
  options: {
    requireAll?: boolean
    tenantScoped?: boolean
  } = {}
) {
  try {
    // Get user session (implement based on your auth system)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        {
          error: 'Unauthorized - Missing authentication header',
        },
        { status: 401 }
      )
    }

    // Extract user info from token (implement based on your auth system)
    const user = await getUserFromToken(authHeader)
    if (!user) {
      return NextResponse.json(
        {
          error: 'Unauthorized - Invalid token',
        },
        { status: 401 }
      )
    }

    // Check if user is active
    if (user.status !== 'active') {
      return NextResponse.json(
        {
          error: 'Forbidden - Account is not active',
        },
        { status: 403 }
      )
    }

    // Check permissions
    const requiredArray = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions]

    let hasRequiredPermission = false

    if (options.requireAll) {
      // User must have ALL specified permissions
      hasRequiredPermission = requiredArray.every(
        async (permission) => await checkUserPermission(user.id, permission)
      )
    } else {
      // User needs ANY of the specified permissions
      hasRequiredPermission = requiredArray.some(
        async (permission) => await checkUserPermission(user.id, permission)
      )
    }

    if (!hasRequiredPermission) {
      const permissionNames = requiredArray.map((p) => p)

      return NextResponse.json(
        {
          error: 'Forbidden - Insufficient permissions',
          requiredPermissions: permissionNames,
        },
        { status: 403 }
      )
    }

    // Check tenant-scoped permissions if required
    if (options.tenantScoped && user.tenantId) {
      const url = new URL(request.url)
      const requestedTenantId = url.searchParams.get('tenantId')

      if (requestedTenantId && requestedTenantId !== user.tenantId) {
        return NextResponse.json(
          {
            error: 'Forbidden - Cannot access other tenant data',
          },
          { status: 403 }
        )
      }
    }

    // User has all required permissions, allow request to proceed
    return null // Continue with the request
  } catch (error) {
    console.error('RBAC middleware error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// Helper function to extract user from token (implement based on your auth system)
async function getUserFromToken(token: string): Promise<{
  id: string
  email: string
  status: string
  tenantId?: string
  permissions: Permissions[]
}> {
  try {
    // This is a placeholder - implement based on your actual auth system
    // For example, if using JWT:
    const jwt = require('jsonwebtoken')
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any

    // For now, return admin user with all permissions
    return {
      id: decoded.userId,
      email: decoded.email,
      status: decoded.status || 'active',
      tenantId: decoded.tenantId,
      permissions: Object.values(Permissions), // Admin with all permissions
    }
  } catch (error) {
    console.error('Error extracting user from token:', error)
    throw error
  }
}

// Higher-order function for easy usage
export function requirePermission(
  permissions: Permissions | Permissions[],
  options?: {
    requireAll?: boolean
    tenantScoped?: boolean
  }
) {
  return async (request: NextRequest) => {
    const result = await withRBAC(request, permissions, options)
    if (result) {
      return result // Return the error response
    }

    // If we reach here, user has permission - continue to the actual handler
    return null
  }
}

// Specific permission check functions for common admin operations
export const requireUserReadPermission = requirePermission(Permissions.ADMIN_USER_READ)
export const requireUserWritePermission = requirePermission(Permissions.ADMIN_USER_WRITE)
export const requireUserDeletePermission = requirePermission(Permissions.ADMIN_USER_DELETE)

export const requireTenantReadPermission = requirePermission(Permissions.ADMIN_TENANT_READ)
export const requireTenantWritePermission = requirePermission(Permissions.ADMIN_TENANT_WRITE)
export const requireTenantDeletePermission = requirePermission(Permissions.ADMIN_TENANT_DELETE)

export const requireAnalyticsReadPermission = requirePermission(Permissions.ADMIN_ANALYTICS_READ)
export const requireAnalyticsExportPermission = requirePermission(
  Permissions.ADMIN_ANALYTICS_EXPORT
)

export const requireSystemReadPermission = requirePermission(Permissions.ADMIN_SYSTEM_READ)
export const requireSystemWritePermission = requirePermission(Permissions.ADMIN_SYSTEM_WRITE)
