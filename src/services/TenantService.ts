import { z } from 'zod'

import {
  OrganizationRepository,
  RepositoryFactory,
  RoleRepository,
  TenantRepository,
  UserRepository,
} from '@/libs/Repository'

// Validation schemas
const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

const UpdateTenantSchema = CreateTenantSchema.partial()

const CreateOrganizationSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  industry: z.string().optional(),
  size: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']).optional(),
  website: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

const CreateUserSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roleIds: z.array(z.string().uuid()).optional(),
  preferences: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

const CreateRoleSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  isSystem: z.boolean().optional().default(false),
})

export interface TenantServiceOptions {
  tenantId?: string
  userId?: string
  organizationId?: string
}

export class TenantService {
  private tenantRepository: TenantRepository
  private organizationRepository: OrganizationRepository
  private userRepository: UserRepository
  private roleRepository: RoleRepository

  constructor(_options: TenantServiceOptions = {}) {
    this.tenantRepository = RepositoryFactory.getTenantRepository()
    this.organizationRepository = RepositoryFactory.getOrganizationRepository()
    this.userRepository = RepositoryFactory.getUserRepository()
    this.roleRepository = RepositoryFactory.getRoleRepository()
  }

  // Tenant Management
  async createTenant(data: z.infer<typeof CreateTenantSchema>) {
    try {
      const validatedData = CreateTenantSchema.parse(data)

      // Check if slug is already taken
      const existingTenant = await this.tenantRepository.findBySlug(validatedData.slug)
      if (existingTenant) {
        throw new Error(`Slug '${validatedData.slug}' is already taken`)
      }

      const tenant = await this.tenantRepository.create({
        ...validatedData,
        status: 'active',
        settings: validatedData.settings || {},
        metadata: validatedData.metadata || {},
      })

      console.log('Tenant created successfully', { tenantId: tenant.id, name: tenant.name })
      return tenant
    } catch (error) {
      console.error('Failed to create tenant', { error, data })
      throw error
    }
  }

  async updateTenant(tenantId: string, data: z.infer<typeof UpdateTenantSchema>) {
    try {
      const validatedData = UpdateTenantSchema.parse(data)

      // If slug is being updated, check if it's available
      if (validatedData.slug) {
        const existingTenant = await this.tenantRepository.findBySlug(validatedData.slug)
        if (existingTenant && existingTenant.id !== tenantId) {
          throw new Error(`Slug '${validatedData.slug}' is already taken`)
        }
      }

      const tenant = await this.tenantRepository.update(tenantId, validatedData)
      if (!tenant) {
        throw new Error('Tenant not found')
      }

      console.log('Tenant updated successfully', { tenantId, changes: Object.keys(validatedData) })
      return tenant
    } catch (error) {
      console.error('Failed to update tenant', { error, tenantId, data })
      throw error
    }
  }

  async getTenant(tenantId: string) {
    try {
      const tenant = await this.tenantRepository.findById(tenantId)
      if (!tenant) {
        throw new Error('Tenant not found')
      }
      return tenant
    } catch (error) {
      console.error('Failed to get tenant', { error, tenantId })
      throw error
    }
  }

  async getTenantBySlug(slug: string) {
    try {
      const tenant = await this.tenantRepository.findBySlug(slug)
      return tenant
    } catch (error) {
      console.error('Failed to get tenant by slug', { error, slug })
      throw error
    }
  }

  async listTenants(
    options: {
      page?: number
      limit?: number
      status?: string
      search?: string
    } = {}
  ) {
    try {
      const { page = 1, limit = 20, status, search } = options

      const filters: any = {}
      if (status) filters.status = status
      if (search) filters.name = `%${search}%`

      const result = await this.tenantRepository.findMany({
        filters,
        pagination: { page, limit },
      })

      return result
    } catch (error) {
      console.error('Failed to list tenants', { error, options })
      throw error
    }
  }

  async deactivateTenant(tenantId: string) {
    try {
      const tenant = await this.tenantRepository.update(tenantId, {
        status: 'inactive',
      })

      if (!tenant) {
        throw new Error('Tenant not found')
      }

      console.log('Tenant deactivated successfully', { tenantId })
      return tenant
    } catch (error) {
      console.error('Failed to deactivate tenant', { error, tenantId })
      throw error
    }
  }

  // Organization Management
  async createOrganization(data: z.infer<typeof CreateOrganizationSchema>) {
    try {
      const validatedData = CreateOrganizationSchema.parse(data)

      // Verify tenant exists
      const tenant = await this.tenantRepository.findById(validatedData.tenantId)
      if (!tenant) {
        throw new Error('Tenant not found')
      }

      const organization = await this.organizationRepository.create({
        ...validatedData,
        settings: validatedData.settings || {},
      })

      console.log('Organization created successfully', {
        organizationId: organization.id,
        tenantId: validatedData.tenantId,
        name: organization.name,
      })
      return organization
    } catch (error) {
      console.error('Failed to create organization', { error, data })
      throw error
    }
  }

  async getOrganization(organizationId: string, tenantId?: string) {
    try {
      const organization = await this.organizationRepository.findById(organizationId)
      if (!organization) {
        throw new Error('Organization not found')
      }

      // If tenantId is provided, ensure the organization belongs to that tenant
      if (tenantId && organization.tenantId !== tenantId) {
        throw new Error('Organization not found in specified tenant')
      }

      return organization
    } catch (error) {
      console.error('Failed to get organization', { error, organizationId, tenantId })
      throw error
    }
  }

  async listOrganizations(
    tenantId: string,
    options: {
      page?: number
      limit?: number
      search?: string
    } = {}
  ) {
    try {
      const { page = 1, limit = 20, search } = options

      const filters: any = { tenantId }
      if (search) filters.name = `%${search}%`

      const result = await this.organizationRepository.findMany({
        filters,
        pagination: { page, limit },
      })

      return result
    } catch (error) {
      console.error('Failed to list organizations', { error, tenantId, options })
      throw error
    }
  }

  // User Management
  async createUser(data: z.infer<typeof CreateUserSchema>) {
    try {
      const validatedData = CreateUserSchema.parse(data)

      // Verify tenant and organization exist
      const tenant = await this.tenantRepository.findById(validatedData.tenantId)
      if (!tenant) {
        throw new Error('Tenant not found')
      }

      const organization = await this.organizationRepository.findById(validatedData.organizationId)
      if (!organization) {
        throw new Error('Organization not found')
      }

      // Check if email is already taken
      const existingUser = await this.userRepository.findByEmail(validatedData.email)
      if (existingUser) {
        throw new Error(`Email '${validatedData.email}' is already registered`)
      }

      const user = await this.userRepository.create({
        ...validatedData,
        status: 'active',
        emailVerified: false,
        preferences: validatedData.preferences || {},
        metadata: validatedData.metadata || {},
      })

      // Assign roles if provided
      if (validatedData.roleIds && validatedData.roleIds.length > 0) {
        await this.userRepository.assignRoles(user.id, validatedData.roleIds)
      }

      console.log('User created successfully', {
        userId: user.id,
        email: user.email,
        tenantId: validatedData.tenantId,
        organizationId: validatedData.organizationId,
      })
      return user
    } catch (error) {
      console.error('Failed to create user', { error, data })
      throw error
    }
  }

  async getUser(userId: string, tenantId?: string) {
    try {
      const user = await this.userRepository.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      // If tenantId is provided, ensure the user belongs to that tenant
      if (tenantId && user.tenantId !== tenantId) {
        throw new Error('User not found in specified tenant')
      }

      return user
    } catch (error) {
      console.error('Failed to get user', { error, userId, tenantId })
      throw error
    }
  }

  async getUserByEmail(email: string, tenantId?: string) {
    try {
      const user = await this.userRepository.findByEmail(email)
      if (!user) {
        return null
      }

      // If tenantId is provided, ensure the user belongs to that tenant
      if (tenantId && user.tenantId !== tenantId) {
        return null
      }

      return user
    } catch (error) {
      console.error('Failed to get user by email', { error, email, tenantId })
      throw error
    }
  }

  async listUsers(
    tenantId: string,
    options: {
      page?: number
      limit?: number
      organizationId?: string
      search?: string
      status?: string
    } = {}
  ) {
    try {
      const { page = 1, limit = 20, organizationId, search, status } = options

      const filters: any = { tenantId }
      if (organizationId) filters.organizationId = organizationId
      if (search) filters.email = `%${search}%`
      if (status) filters.status = status

      const result = await this.userRepository.findMany({
        filters,
        pagination: { page, limit },
      })

      return result
    } catch (error) {
      console.error('Failed to list users', { error, tenantId, options })
      throw error
    }
  }

  // Role Management
  async createRole(data: z.infer<typeof CreateRoleSchema>) {
    try {
      const validatedData = CreateRoleSchema.parse(data)

      // Verify tenant exists
      const tenant = await this.tenantRepository.findById(validatedData.tenantId)
      if (!tenant) {
        throw new Error('Tenant not found')
      }

      // Check if role name is unique within the tenant
      const existingRole = await this.roleRepository.findByName(
        validatedData.name,
        validatedData.tenantId
      )
      if (existingRole) {
        throw new Error(`Role name '${validatedData.name}' is already taken`)
      }

      const role = await this.roleRepository.create({
        ...validatedData,
      })

      console.log('Role created successfully', {
        roleId: role.id,
        tenantId: validatedData.tenantId,
        name: role.name,
      })
      return role
    } catch (error) {
      console.error('Failed to create role', { error, data })
      throw error
    }
  }

  async listRoles(
    tenantId: string,
    options: {
      page?: number
      limit?: number
      search?: string
    } = {}
  ) {
    try {
      const { page = 1, limit = 20, search } = options

      const filters: any = { tenantId }
      if (search) filters.name = `%${search}%`

      const result = await this.roleRepository.findMany({
        filters,
        pagination: { page, limit },
      })

      return result
    } catch (error) {
      console.error('Failed to list roles', { error, tenantId, options })
      throw error
    }
  }

  // Tenant Statistics
  async getTenantStats(tenantId: string) {
    try {
      const [userCount, organizationCount, roleCount] = await Promise.all([
        this.userRepository.count({ tenantId }),
        this.organizationRepository.count({ tenantId }),
        this.roleRepository.count({ tenantId }),
      ])

      return {
        users: userCount,
        organizations: organizationCount,
        roles: roleCount,
        activePlugins: 0, // TODO: Implement plugin counting
      }
    } catch (error) {
      console.error('Failed to get tenant stats', { error, tenantId })
      throw error
    }
  }
}

// Export singleton instance
export const tenantService = new TenantService()
