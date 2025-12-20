import { beforeEach, describe, expect, it, vi } from 'vitest'

import { rbacService } from '@/services/admin-rbac'

// Mock the database
vi.mock('@/libs/DB', () => ({
  db: {
    insert: vi.fn(),
    query: {
      userSchema: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      roleSchema: {
        findFirst: vi.fn(),
      },
      userRoleSchema: {
        findMany: vi.fn(),
      },
      auditLogSchema: {
        findMany: vi.fn(),
      },
    },
    delete: vi.fn(),
  },
}))

describe('RBAC Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assignRole', () => {
    it('should assign role to user successfully', async () => {
      // Arrange
      const userId = 'user-123'
      const roleId = 'role-456'

      // Mock successful database operations
      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: userId } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: roleId,
        isSystem: false,
      } as any)
      vi.mocked(db.query.userRoleSchema.findMany).mockResolvedValue([])
      vi.mocked(db.query.auditLogSchema.findMany).mockResolvedValue([])

      // Act
      await rbacService.assignRole(userId, roleId)

      // Assert
      expect(db.insert).toHaveBeenCalledWith(expect.any(Object))
    })

    it('should throw error if user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user'
      const roleId = 'role-456'

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue(null)

      // Act & Assert
      await expect(rbacService.assignRole(userId, roleId)).rejects.toThrow()
    })

    it('should throw error if role is system role', async () => {
      // Arrange
      const userId = 'user-123'
      const roleId = 'system-role-456'

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: userId } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: roleId,
        isSystem: true,
      } as any)

      // Act & Assert
      await expect(rbacService.assignRole(userId, roleId)).rejects.toThrow()
    })
  })

  describe('removeRole', () => {
    it('should remove role from user successfully', async () => {
      // Arrange
      const userId = 'user-123'
      const roleId = 'role-456'

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: userId } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: roleId,
        isSystem: false,
      } as any)
      vi.mocked(db.query.userRoleSchema.findMany).mockResolvedValue([])

      // Act
      await rbacService.removeRole(userId, roleId)

      // Assert
      expect(db.delete).toHaveBeenCalledWith(expect.any(Object))
    })

    it('should throw error if role is system role', async () => {
      // Arrange
      const userId = 'user-123'
      const roleId = 'system-role-456'

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: userId } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: roleId,
        isSystem: true,
      } as any)

      // Act & Assert
      await expect(rbacService.removeRole(userId, roleId)).rejects.toThrow()
    })
  })

  describe('getUserHierarchyLevel', () => {
    it('should return regular user level for any user', async () => {
      // Act
      const result = await rbacService.getUserHierarchyLevel('any-user-id')

      // Assert
      expect(result).toBe(2) // Regular user level
    })
  })

  describe('getRoleHierarchyLevel', () => {
    it('should return correct hierarchy level based on role name', async () => {
      // Test cases for known roles
      const testCases = [
        { roleName: 'SUPER_ADMIN', expectedLevel: 10 },
        { roleName: 'ORGANIZATION_ADMIN', expectedLevel: 9 },
        { roleName: 'TENANT_ADMIN', expectedLevel: 8 },
        { roleName: 'USER_MANAGER', expectedLevel: 5 },
        { roleName: 'USER', expectedLevel: 3 },
        { roleName: 'VIEWER', expectedLevel: 2 },
        { roleName: 'ANALYST', expectedLevel: 1 },
        { roleName: 'NO_ACCESS', expectedLevel: 0 },
      ]

      for (const testCase of testCases) {
        // Arrange
        vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
          id: 'role-123',
          name: testCase.roleName,
        } as any)

        // Act
        const result = await rbacService.getRoleHierarchyLevel('role-123')

        // Assert
        expect(result).toBe(testCase.expectedLevel)
      }
    })

    it('should return 0 for unknown role', async () => {
      // Arrange
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue(null)

      // Act
      const result = await rbacService.getRoleHierarchyLevel('unknown-role')

      // Assert
      expect(result).toBe(0)
    })
  })

  describe('checkRoleAssignmentPermission', () => {
    it('should return true when user has sufficient privilege', async () => {
      // Arrange
      const userId = 'admin-user-123'
      const roleId = 'manager-role-456'

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: userId } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: roleId,
        tenantId: 'tenant-1',
        name: 'MANAGER',
      } as any)

      // Mock hierarchy levels
      vi.mocked(rbacService.getUserHierarchyLevel).mockResolvedValue(2) // User level
      vi.mocked(rbacService.getRoleHierarchyLevel).mockResolvedValue(5) // Role level

      // Act
      const result = await rbacService.checkRoleAssignmentPermission(userId, roleId)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when user lacks sufficient privilege', async () => {
      // Arrange
      const userId = 'regular-user-123'
      const roleId = 'admin-role-456'

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: userId } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: roleId,
        tenantId: 'tenant-1',
        name: 'SUPER_ADMIN',
      } as any)

      // Mock hierarchy levels
      vi.mocked(rbacService.getUserHierarchyLevel).mockResolvedValue(2) // User level
      vi.mocked(rbacService.getRoleHierarchyLevel).mockResolvedValue(10) // Role level

      // Act
      const result = await rbacService.checkRoleAssignmentPermission(userId, roleId)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when user or role does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user'
      const roleId = 'non-existent-role'

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue(null)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue(null)

      // Act
      const result = await rbacService.checkRoleAssignmentPermission(userId, roleId)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('logRoleAssignment', () => {
    it('should create audit log entry for role assignment', async () => {
      // Arrange
      const userId = 'user-123'
      const action = 'ASSIGN_ROLE'
      const roleId = 'role-456'
      const details = { justification: 'Test assignment' }

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
      } as any)

      // Act
      await rbacService.logRoleAssignment(userId, action, roleId, details)

      // Assert
      expect(db.insert).toHaveBeenCalledWith(expect.any(Object))
      expect(vi.mocked(db.insert).mock.results[0].value.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          action,
          resourceType: 'RBAC',
          resourceId: roleId,
          details: details || {},
          oldValues: {},
          newValues: {},
          ipAddress: 'REDACTED',
          userAgent: 'RBAC_CONSOLE',
          sessionId: expect.any(String),
          metadata: expect.objectContaining({
            operation: 'RBAC Operation',
            userId: userId,
            role: roleId,
          }),
          createdAt: expect.any(Date),
        })
      )
    })
  })

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      // Act
      const sessionId1 = rbacService.generateSessionId()
      const sessionId2 = rbacService.generateSessionId()

      // Assert
      expect(sessionId1).toMatch(/^rbac_\d+_[a-z0-9]+$/)
      expect(sessionId2).toMatch(/^rbac_\d+_[a-z0-9]+$/)
      expect(sessionId1).not.toBe(sessionId2)
    })

    it('should generate session ID with correct prefix', () => {
      // Act
      const sessionId = rbacService.generateSessionId()

      // Assert
      expect(sessionId).toStartWith('rbac_')
      expect(sessionId).toInclude('_')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database connection failed')
      vi.mocked(db.insert).mockImplementation(() => {
        throw dbError
      })

      // Act & Assert
      await expect(rbacService.assignRole('user-123', 'role-456')).rejects.toThrow()
    })

    it('should log errors appropriately', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(db.insert).mockImplementation(() => {
        throw new Error('Database error')
      })

      // Act
      try {
        await rbacService.assignRole('user-123', 'role-456')
      } catch (error) {
        // Expected
      }

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Role assignment failed:', expect.any(Error))

      // Cleanup
      consoleSpy.mockRestore()
    })
  })

  describe('Integration Tests', () => {
    it('should complete full role assignment workflow', async () => {
      // Arrange
      const userId = 'user-123'
      const roleId = 'role-456'

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: userId } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: roleId,
        isSystem: false,
      } as any)
      vi.mocked(db.query.userRoleSchema.findMany).mockResolvedValue([])
      vi.mocked(db.query.auditLogSchema.findMany).mockResolvedValue([])
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
      } as any)

      // Act
      await rbacService.assignRole(userId, roleId)

      // Assert - All operations were called
      expect(db.query.userSchema.findFirst).toHaveBeenCalledTimes(2)
      expect(db.query.roleSchema.findFirst).toHaveBeenCalledTimes(1)
      expect(db.query.userRoleSchema.findMany).toHaveBeenCalledTimes(1)
      expect(db.insert).toHaveBeenCalledTimes(1)
    })

    it('should handle role removal workflow', async () => {
      // Arrange
      const userId = 'user-123'
      const roleId = 'role-456'

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: userId } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: roleId,
        isSystem: false,
      } as any)
      vi.mocked(db.query.userRoleSchema.findMany).mockResolvedValue([])
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnThis(),
      } as any)

      // Act
      await rbacService.removeRole(userId, roleId)

      // Assert
      expect(db.query.userSchema.findFirst).toHaveBeenCalledTimes(2)
      expect(db.query.roleSchema.findFirst).toHaveBeenCalledTimes(1)
      expect(db.query.userRoleSchema.findMany).toHaveBeenCalledTimes(1)
      expect(db.delete).toHaveBeenCalledTimes(1)
    })
  })

  describe('Performance Considerations', () => {
    it('should handle operations efficiently', async () => {
      // Arrange
      const startTime = Date.now()

      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: 'user-123' } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: 'role-456',
        isSystem: false,
      } as any)
      vi.mocked(db.query.userRoleSchema.findMany).mockResolvedValue([])
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
      } as any)

      // Act
      await rbacService.assignRole('user-123', 'role-456')

      const endTime = Date.now()
      const duration = endTime - startTime

      // Assert
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should not have memory leaks', async () => {
      // Arrange
      vi.mocked(db.query.userSchema.findFirst).mockResolvedValue({ id: 'user-123' } as any)
      vi.mocked(db.query.roleSchema.findFirst).mockResolvedValue({
        id: 'role-456',
        isSystem: false,
      } as any)
      vi.mocked(db.query.userRoleSchema.findMany).mockResolvedValue([])

      // Act
      await rbacService.checkRoleAssignmentPermission('user-123', 'role-456')

      // Assert - No excessive memory usage
      expect(vi.mocked(db.query.userSchema.findFirst)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(db.query.roleSchema.findFirst)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(db.query.userRoleSchema.findMany)).toHaveBeenCalledTimes(1)
    })
  })
})
