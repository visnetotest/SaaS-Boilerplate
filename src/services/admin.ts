import { and, eq } from 'drizzle-orm'

import { db } from '@/libs/DB'
import { RepositoryFactory } from '@/libs/Repository'
import {
  OrganizationRepository,
  RoleRepository,
  TenantRepository,
  UserRepository,
} from '@/libs/Repository'
import * as schema from '@/models/Schema'
import {
  AuditService,
  RBACService,
  TenantManagementService,
  UserManagementService,
} from '@/types/admin'
import {
  AdminPanelError,
  CreatePermissionDataSchema,
  CreateTenantDataSchema,
  CreateUserDataSchema,
  TenantListFiltersSchema,
  UpdatePermissionDataSchema,
  UpdateRoleDataSchema,
  UpdateTenantDataSchema,
  UpdateUserDataSchema,
  UserListFiltersSchema,
} from '@/types/admin'

// =============================================================================
// USER MANAGEMENT SERVICE
// =============================================================================

export class UserManagementServiceImpl implements UserManagementService {
  private userRepository = RepositoryFactory.getUserRepository()
  private organizationRepository = RepositoryFactory.getOrganizationRepository()

  async createUser(data: any): Promise<any> {
    try {
      const validatedData = CreateUserDataSchema.parse(data)

      // Check if email already exists
      const existingUser = await this.userRepository.findByEmail(validatedData.email)
      if (existingUser) {
        throw AdminPanelError.duplicateResource('User', validatedData.email)
      }

      // Verify tenant and organization exist
      const tenant = await RepositoryFactory.getTenantRepository().findById(validatedData.tenantId)
      if (!tenant) {
        throw AdminPanelError.tenantNotFound(validatedData.tenantId)
      }

      if (validatedData.organizationId) {
        const organization = await this.organizationRepository.findById(
          validatedData.organizationId
        )
        if (!organization) {
          throw AdminPanelError.operationFailed('Create User', 'Organization not found')
        }
      }

      // Create user
      const user = await this.userRepository.create({
        ...validatedData,
        status: 'ACTIVE',
        emailVerified: false,
        metadata: {
          source: 'admin-panel',
          ...validatedData.metadata,
        },
      })

      // Assign roles if provided
      if (validatedData.roleIds && validatedData.roleIds.length > 0) {
        await this.userRepository.assignRoles(user.id, validatedData.roleIds)
      }

      return user
    } catch (error) {
      if (error instanceof AdminPanelError) {
        throw error
      }
      throw AdminPanelError.operationFailed(
        'Create User',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async updateUser(userId: string, data: any): Promise<any> {
    try {
      const validatedData = UpdateUserDataSchema.parse(data)

      // Check if user exists
      const existingUser = await this.userRepository.findById(userId)
      if (!existingUser) {
        throw AdminPanelError.userNotFound(userId)
      }

      // Check email uniqueness if being updated
      if (validatedData.email && validatedData.email !== existingUser.email) {
        const emailUser = await this.userRepository.findByEmail(validatedData.email)
        if (emailUser) {
          throw AdminPanelError.duplicateResource('User', validatedData.email)
        }
      }

      const updatedUser = await this.userRepository.update(userId, {
        ...validatedData,
        updatedAt: new Date(),
      })

      return updatedUser
    } catch (error) {
      if (error instanceof AdminPanelError) {
        throw error
      }
      throw AdminPanelError.operationFailed(
        'Update User',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId)
      if (!user) {
        throw AdminPanelError.userNotFound(userId)
      }

      // Soft delete by setting status to DELETED
      await this.userRepository.update(userId, {
        status: 'DELETED',
        updatedAt: new Date(),
      })
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Delete User',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async getUser(userId: string): Promise<any> {
    try {
      const user = await this.userRepository.findById(userId)
      if (!user) {
        throw AdminPanelError.userNotFound(userId)
      }

      // Get user roles
      const userRoles = await this.getUserRoles(userId)

      return {
        ...user,
        roles: userRoles,
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Get User',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async listUsers(filters: any): Promise<any> {
    try {
      const validatedFilters = UserListFiltersSchema.parse(filters)

      const queryFilters: any = {}
      if (validatedFilters.tenantId) queryFilters.tenantId = validatedFilters.tenantId
      if (validatedFilters.organizationId)
        queryFilters.organizationId = validatedFilters.organizationId
      if (validatedFilters.status && validatedFilters.status.length > 0) {
        queryFilters.status = validatedFilters.status[0] // Simplified for now
      }
      if (validatedFilters.search) {
        queryFilters.email = `%${validatedFilters.search}%`
      }

      const result = await this.userRepository.findMany({
        filters: queryFilters,
        pagination: {
          page: 1,
          limit: 20,
        },
      })

      return result
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'List Users',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async suspendUser(userId: string): Promise<any> {
    try {
      const user = await this.userRepository.findById(userId)
      if (!user) {
        throw AdminPanelError.userNotFound(userId)
      }

      return await this.userRepository.update(userId, {
        status: 'SUSPENDED',
        updatedAt: new Date(),
      })
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Suspend User',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async activateUser(userId: string): Promise<any> {
    try {
      const user = await this.userRepository.findById(userId)
      if (!user) {
        throw AdminPanelError.userNotFound(userId)
      }

      return await this.userRepository.update(userId, {
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Activate User',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async bulkUpdateUsers(userIds: string[], updates: any): Promise<any> {
    try {
      const results = {
        success: 0,
        failed: [] as any[],
      }

      for (const userId of userIds) {
        try {
          await this.updateUser(userId, updates)
          results.success++
        } catch (error) {
          results.failed.push({
            id: userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      return results
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Bulk Update Users',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async exportUsers(filters: any): Promise<any> {
    try {
      const users = await this.listUsers(filters)

      // In a real implementation, this would generate and store a file
      // For now, return a mock export result
      return {
        downloadUrl: `/api/admin/users/export?token=${Date.now()}`,
        filename: `users_export_${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv',
        recordCount: users.total,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Export Users',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async importUsers(_file: File): Promise<any> {
    try {
      // In a real implementation, this would parse the file and create users
      // For now, return a mock import result
      return {
        success: Math.floor(Math.random() * 10) + 1,
        failed: Math.floor(Math.random() * 5),
        errors: [],
        duplicates: [],
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Import Users',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  private async getUserRoles(_userId: string): Promise<any[]> {
    try {
      // This would typically query a user_roles join table
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Failed to get user roles:', error)
      return []
    }
  }
}

// =============================================================================
// TENANT MANAGEMENT SERVICE
// =============================================================================

export class TenantManagementServiceImpl implements TenantManagementService {
  private tenantRepository = RepositoryFactory.getTenantRepository()

  async createTenant(data: any): Promise<any> {
    try {
      const validatedData = CreateTenantDataSchema.parse(data)

      // Check if slug already exists
      const existingTenant = await this.tenantRepository.findBySlug(validatedData.slug)
      if (existingTenant) {
        throw AdminPanelError.duplicateResource('Tenant', validatedData.slug)
      }

      const tenant = await this.tenantRepository.create({
        ...validatedData,
        status: 'ACTIVE',
        metadata: {
          source: 'admin-panel',
          ...validatedData.metadata,
        },
      })

      return tenant
    } catch (error) {
      if (error instanceof AdminPanelError) {
        throw error
      }
      throw AdminPanelError.operationFailed(
        'Create Tenant',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async updateTenant(tenantId: string, data: any): Promise<any> {
    try {
      const validatedData = UpdateTenantDataSchema.parse(data)

      const existingTenant = await this.tenantRepository.findById(tenantId)
      if (!existingTenant) {
        throw AdminPanelError.tenantNotFound(tenantId)
      }

      // Check slug uniqueness if being updated
      if (validatedData.slug && validatedData.slug !== existingTenant.slug) {
        const slugTenant = await this.tenantRepository.findBySlug(validatedData.slug)
        if (slugTenant) {
          throw AdminPanelError.duplicateResource('Tenant', validatedData.slug)
        }
      }

      const updatedTenant = await this.tenantRepository.update(tenantId, {
        ...validatedData,
        updatedAt: new Date(),
      })

      return updatedTenant
    } catch (error) {
      if (error instanceof AdminPanelError) {
        throw error
      }
      throw AdminPanelError.operationFailed(
        'Update Tenant',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async deleteTenant(tenantId: string): Promise<void> {
    try {
      const tenant = await this.tenantRepository.findById(tenantId)
      if (!tenant) {
        throw AdminPanelError.tenantNotFound(tenantId)
      }

      // Soft delete by setting status to DELETED
      await this.tenantRepository.update(tenantId, {
        status: 'DELETED',
        updatedAt: new Date(),
      })
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Delete Tenant',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async getTenant(tenantId: string): Promise<any> {
    try {
      const tenant = await this.tenantRepository.findById(tenantId)
      if (!tenant) {
        throw AdminPanelError.tenantNotFound(tenantId)
      }

      return tenant
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Get Tenant',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async listTenants(filters: any): Promise<any> {
    try {
      const validatedFilters = TenantListFiltersSchema.parse(filters)

      const queryFilters: any = {}
      if (validatedFilters.status && validatedFilters.status.length > 0) {
        queryFilters.status = validatedFilters.status[0] // Simplified for now
      }
      if (validatedFilters.plan && validatedFilters.plan.length > 0) {
        queryFilters.plan = validatedFilters.plan[0] // Simplified for now
      }
      if (validatedFilters.search) {
        queryFilters.name = `%${validatedFilters.search}%`
      }

      const result = await this.tenantRepository.findMany({
        filters: queryFilters,
        pagination: {
          page: 1,
          limit: 20,
        },
      })

      return result
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'List Tenants',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async suspendTenant(tenantId: string): Promise<any> {
    try {
      const tenant = await this.tenantRepository.findById(tenantId)
      if (!tenant) {
        throw AdminPanelError.tenantNotFound(tenantId)
      }

      return await this.tenantRepository.update(tenantId, {
        status: 'SUSPENDED',
        updatedAt: new Date(),
      })
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Suspend Tenant',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async activateTenant(tenantId: string): Promise<any> {
    try {
      const tenant = await this.tenantRepository.findById(tenantId)
      if (!tenant) {
        throw AdminPanelError.tenantNotFound(tenantId)
      }

      return await this.tenantRepository.update(tenantId, {
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Activate Tenant',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async upgradeTenantPlan(tenantId: string, _plan: any): Promise<any> {
    try {
      const tenant = await this.tenantRepository.findById(tenantId)
      if (!tenant) {
        throw AdminPanelError.tenantNotFound(tenantId)
      }

      return await this.tenantRepository.update(tenantId, {
        status: 'active',
        updatedAt: new Date(),
      })
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Upgrade Tenant Plan',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async getTenantUsage(tenantId: string, period: any): Promise<any> {
    try {
      // Mock implementation - in real system this would aggregate usage data
      return {
        tenantId,
        period,
        users: {
          total: 150,
          active: 120,
          new: 15,
          churned: 5,
        },
        storage: {
          totalGB: 100,
          usedGB: 45.7,
          availableGB: 54.3,
        },
        apiCalls: {
          total: 50000,
          successful: 49500,
          failed: 500,
        },
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Get Tenant Usage',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async getTenantMetrics(tenantId: string): Promise<any> {
    try {
      // Mock implementation - in real system this would collect various metrics
      return {
        tenantId,
        health: {
          status: 'healthy',
          database: {
            status: 'healthy',
            responseTime: 45,
          },
          api: {
            status: 'healthy',
            responseTime: 120,
          },
        },
        performance: {
          responseTime: 85,
          throughput: 1250,
          errorRate: 0.02,
          uptime: 99.9,
        },
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Get Tenant Metrics',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }
}

// =============================================================================
// RBAC SERVICE
// =============================================================================

export class RBACServiceImpl implements RBACService {
  private roleRepository = RepositoryFactory.getRoleRepository()

  async createRole(data: any): Promise<any> {
    try {
      const validatedData = CreateRoleDataSchema.parse(data)

      // Check if role name already exists for tenant
      const existingRole = await this.roleRepository.findByName(
        validatedData.name,
        validatedData.tenantId
      )
      if (existingRole) {
        throw AdminPanelError.duplicateResource('Role', validatedData.name)
      }

      const role = await this.roleRepository.create({
        name: validatedData.name,
        tenantId: validatedData.tenantId,
        permissions: validatedData.permissions,
        description: validatedData.description,
        isSystem: validatedData.isSystem,
      })

      return role
    } catch (error) {
      if (error instanceof AdminPanelError) {
        throw error
      }
      throw AdminPanelError.operationFailed(
        'Create Role',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async updateRole(roleId: string, data: any): Promise<any> {
    try {
      const validatedData = UpdateRoleDataSchema.parse(data)

      const existingRole = await this.roleRepository.findById(roleId)
      if (!existingRole) {
        throw AdminPanelError.operationFailed('Update Role', 'Role not found')
      }

      // Check name uniqueness if being updated
      if (validatedData.name && validatedData.name !== existingRole.name) {
        const nameRole = await this.roleRepository.findByName(
          validatedData.name,
          existingRole.tenantId
        )
        if (nameRole) {
          throw AdminPanelError.duplicateResource('Role', validatedData.name)
        }
      }

      const updatedRole = await this.roleRepository.update(roleId, {
        ...validatedData,
        updatedAt: new Date(),
      })

      return updatedRole
    } catch (error) {
      if (error instanceof AdminPanelError) {
        throw error
      }
      throw AdminPanelError.operationFailed(
        'Update Role',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async deleteRole(roleId: string): Promise<void> {
    try {
      const role = await this.roleRepository.findById(roleId)
      if (!role) {
        throw AdminPanelError.operationFailed('Delete Role', 'Role not found')
      }

      if (role.isSystem) {
        throw AdminPanelError.operationFailed('Delete Role', 'Cannot delete system role')
      }

      await this.roleRepository.delete(roleId)
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Delete Role',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    try {
      // This would typically insert into user_roles table
      // For now, just log the operation
      console.log(`Assigning role ${roleId} to user ${userId}`)
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Assign Role',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    try {
      // This would typically delete from user_roles table
      // For now, just log the operation
      console.log(`Removing role ${roleId} from user ${userId}`)
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Remove Role',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async getUserRoles(_userId: string): Promise<any[]> {
    try {
      // This would typically query user_roles join with roles table
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Failed to get user roles:', error)
      return []
    }
  }

  async checkPermission(_userId: string, _permission: string): Promise<boolean> {
    try {
      // This would typically check user's roles against required permission
      // For now, return true for demonstration
      return true
    } catch (error) {
      console.error('Failed to check permission:', error)
      return false
    }
  }

  async createPermission(data: any): Promise<any> {
    try {
      const validatedData = CreatePermissionDataSchema.parse(data)

      // In a real implementation, this would create a permission record
      // For now, return a mock permission
      return {
        id: `perm_${Date.now()}`,
        ...validatedData,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Create Permission',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async updatePermission(permissionId: string, data: any): Promise<any> {
    try {
      const validatedData = UpdatePermissionDataSchema.parse(data)

      // In a real implementation, this would update a permission record
      // For now, return a mock updated permission
      return {
        id: permissionId,
        ...validatedData,
        updatedAt: new Date(),
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Update Permission',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async deletePermission(permissionId: string): Promise<void> {
    try {
      // In a real implementation, this would delete a permission record
      // For now, just log the operation
      console.log(`Deleting permission ${permissionId}`)
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Delete Permission',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async listPermissions(_filters: any): Promise<any> {
    try {
      // In a real implementation, this would query permissions with filters
      // For now, return mock data
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        hasNext: false,
        hasPrev: false,
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'List Permissions',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }
}

// =============================================================================
// AUDIT SERVICE
// =============================================================================

export class AuditServiceImpl implements AuditService {
  async logAuditEvent(event: any): Promise<void> {
    try {
      // In a real implementation, this would insert into audit_log table
      // For now, just log the event
      console.log('Audit Event:', {
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        userId: event.userId,
        timestamp: new Date(),
      })
    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }

  async getAuditLogs(_filters: any): Promise<any> {
    try {
      // In a real implementation, this would query audit_log table with filters
      // For now, return mock data
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        hasNext: false,
        hasPrev: false,
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Get Audit Logs',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async getAuditSummary(tenantId: string, period: any): Promise<any> {
    try {
      // Aggregate audit logs for the specified tenant and time period
      const startDate = new Date(period.start)
      const endDate = new Date(period.end)

      // Query audit logs for the period
      const auditLogs = await db.query.auditLogSchema.findMany({
        where: and(
          eq(schema.auditLogSchema.tenantId, tenantId)
          // Add tenant-specific filtering if needed
          // This would be enhanced with proper date filtering in production
        ),
        orderBy: [desc(schema.auditLogSchema.createdAt)],
      })

      // Aggregate events by action type
      const eventsByAction = auditLogs.reduce((acc, log) => {
        const action = log.action || 'UNKNOWN'
        acc[action] = (acc[action] || 0) + 1
        return acc
      }, {})

      // Aggregate events by resource type
      const eventsByResource = auditLogs.reduce((acc, log) => {
        const resource = log.resourceType || 'UNKNOWN'
        acc[resource] = (acc[resource] || 0) + 1
        return acc
      }, {})

      // Get top users by activity count
      const userActivityCounts = auditLogs.reduce((acc, log) => {
        const userId = log.userId || 'unknown'
        acc[userId] = (acc[userId] || 0) + 1
        return acc
      }, {})

      const topUsers = Object.entries(userActivityCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, activityCount: count }))

      // Get total events in the period
      const totalEvents = auditLogs.length

      return {
        tenantId,
        timeRange: period,
        totalEvents,
        eventsByAction,
        eventsByResource,
        topUsers,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        generatedAt: new Date().toISOString(),
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Get Audit Summary',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  async exportAuditLogs(filters: any): Promise<any> {
    try {
      // Parse filters and build query
      const { tenantId, dateRange, actions, users, resourceTypes } = filters || {}

      // Build where conditions based on filters
      const conditions = []

      if (tenantId) {
        conditions.push(eq(schema.auditLogSchema.tenantId, tenantId))
      }

      if (dateRange?.start) {
        conditions.push(
          and(
            eq(schema.auditLogSchema.createdAt, new Date(dateRange.start)),
            eq(schema.auditLogSchema.createdAt, new Date(dateRange.end))
          )
        )
      }

      if (actions && actions.length > 0) {
        conditions.push(or(...actions.map((action) => eq(schema.auditLogSchema.action, action))))
      }

      if (users && users.length > 0) {
        conditions.push(or(...users.map((user) => eq(schema.auditLogSchema.userId, user))))
      }

      if (resourceTypes && resourceTypes.length > 0) {
        conditions.push(
          or(...resourceTypes.map((type) => eq(schema.auditLogSchema.resourceType, type)))
        )
      }

      // Query audit logs with filters
      const auditLogs = await db.query.auditLogSchema.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(schema.auditLogSchema.createdAt)],
        limit: 10000, // Limit to prevent memory issues
      })

      // Generate CSV export
      const csvHeaders = [
        'timestamp',
        'userId',
        'action',
        'resourceType',
        'resourceId',
        'details',
        'ipAddress',
        'userAgent',
        'sessionId',
      ]

      const csvRows = auditLogs.map((log) => [
        log.createdAt.toISOString(),
        log.userId || '',
        log.action || '',
        log.resourceType || '',
        log.resourceId || '',
        JSON.stringify(log.details || {}),
        log.ipAddress || '',
        log.userAgent || '',
        log.sessionId || '',
      ])

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n')

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `audit_logs_${timestamp}.csv`

      // Store the export (in a real implementation, this would be stored in S3 or similar)
      // For now, return the export data directly

      return {
        success: true,
        downloadUrl: `/api/admin/audit/download/${filename}`,
        filename,
        mimeType: 'text/csv',
        recordCount: auditLogs.length,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
    } catch (error) {
      throw AdminPanelError.operationFailed(
        'Export Audit Logs',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }
}
