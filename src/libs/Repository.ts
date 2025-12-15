import { PGlite } from '@electric-sql/pglite'
import { and, count, eq, like } from 'drizzle-orm'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite'
import { Client } from 'pg'

import * as schema from '@/models/Schema'

import { Env } from './Env'

// =============================================================================
// REPOSITORY TYPES AND INTERFACES
// =============================================================================

export interface PaginationOptions {
  page: number
  limit: number
  offset?: number
}

export interface SortOptions {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilterOptions {
  field: string
  operator:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'like'
    | 'ilike'
    | 'in'
    | 'notIn'
    | 'isNull'
    | 'isNotNull'
  value: any
}

export interface QueryOptions {
  pagination?: PaginationOptions
  sort?: SortOptions[]
  filters?: FilterOptions[]
  include?: string[]
  select?: string[]
  tenantId?: string
}

export interface RepositoryResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

export interface RepositoryError extends Error {
  code: string
  details?: any
}

// =============================================================================
// DATABASE MANAGER
// =============================================================================

class DatabaseManager {
  private static instance: DatabaseManager
  private db: any

  private constructor() {
    this.initializeDatabase()
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  private async initializeDatabase() {
    if (Env.DATABASE_URL) {
      const client = new Client({
        connectionString: Env.DATABASE_URL,
      })
      await client.connect()
      this.db = drizzlePg(client, { schema })
    } else {
      const global = globalThis as unknown as {
        client: PGlite
        drizzle: PgliteDatabase<typeof schema>
      }

      if (!global.client) {
        global.client = new PGlite()
        await global.client.waitReady
        global.drizzle = drizzlePglite(global.client, { schema })
      }

      this.db = global.drizzle
    }
  }

  getDb() {
    return this.db
  }
}

// =============================================================================
// BASE REPOSITORY
// =============================================================================

export abstract class BaseRepository<T> {
  protected db = DatabaseManager.getInstance().getDb()

  abstract create(data: any): Promise<T>
  abstract findById(id: string): Promise<T | null>
  abstract findMany(options?: QueryOptions): Promise<RepositoryResult<T>>
  abstract update(id: string, data: Partial<any>): Promise<T | null>
  abstract delete(id: string): Promise<boolean>
  abstract count(filters?: any): Promise<number>

  protected buildWhereClause(filters: any): any[] {
    const conditions: any[] = []

    if (!filters) return conditions

    Object.entries(filters).forEach(([field, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && value.includes('%')) {
          conditions.push(like(this.getColumn(field), value))
        } else {
          conditions.push(eq(this.getColumn(field), value))
        }
      }
    })

    return conditions
  }

  protected abstract getColumn(field: string): any

  protected async executeQuery(query: any, options?: QueryOptions): Promise<any> {
    if (options?.pagination) {
      const { page, limit } = options.pagination
      const offset = (page - 1) * limit
      query = query.limit(limit).offset(offset)
    }

    return await query
  }
}

// =============================================================================
// TENANT REPOSITORY
// =============================================================================

export class TenantRepository extends BaseRepository<schema.Tenant> {
  protected getColumn(field: string): any {
    const columnMap: Record<string, any> = {
      id: schema.tenantSchema.id,
      name: schema.tenantSchema.name,
      slug: schema.tenantSchema.slug,
      domain: schema.tenantSchema.domain,
      status: schema.tenantSchema.status,
      createdAt: schema.tenantSchema.createdAt,
      updatedAt: schema.tenantSchema.updatedAt,
    }
    return columnMap[field]
  }

  async create(data: schema.NewTenant): Promise<schema.Tenant> {
    try {
      const result = await this.db.insert(schema.tenantSchema).values(data).returning()
      return result[0]
    } catch (error) {
      console.error('Failed to create tenant:', error)
      throw error
    }
  }

  async findById(id: string): Promise<schema.Tenant | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.tenantSchema)
        .where(eq(schema.tenantSchema.id, id))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find tenant by ID:', error)
      throw error
    }
  }

  async findBySlug(slug: string): Promise<schema.Tenant | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.tenantSchema)
        .where(eq(schema.tenantSchema.slug, slug))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find tenant by slug:', error)
      throw error
    }
  }

  async findBySubdomain(subdomain: string): Promise<schema.Tenant | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.tenantSchema)
        .where(eq(schema.tenantSchema.slug, subdomain))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find tenant by subdomain:', error)
      throw error
    }
  }

  async findMany(options: QueryOptions = {}): Promise<RepositoryResult<schema.Tenant>> {
    try {
      let query = this.db.select().from(schema.tenantSchema)

      // Apply filters
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      // Get total count
      const totalQuery = this.db.select({ count: count() }).from(schema.tenantSchema)
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          totalQuery.where(and(...conditions))
        }
      }
      const totalResult = await totalQuery
      const total = totalResult[0]?.count || 0

      // Apply pagination and sorting
      const data = await this.executeQuery(query, options)

      return {
        data,
        total,
        page: options.pagination?.page || 1,
        limit: options.pagination?.limit || data.length,
        hasNext: options.pagination
          ? options.pagination.page * options.pagination.limit < total
          : false,
        hasPrev: options.pagination ? options.pagination.page > 1 : false,
      }
    } catch (error) {
      console.error('Failed to find tenants:', error)
      throw error
    }
  }

  async update(id: string, data: Partial<schema.NewTenant>): Promise<schema.Tenant | null> {
    try {
      const result = await this.db
        .update(schema.tenantSchema)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.tenantSchema.id, id))
        .returning()
      return result[0] || null
    } catch (error) {
      console.error('Failed to update tenant:', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(schema.tenantSchema).where(eq(schema.tenantSchema.id, id))
      return result.rowCount > 0
    } catch (error) {
      console.error('Failed to delete tenant:', error)
      throw error
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      let query = this.db.select({ count: count() }).from(schema.tenantSchema)

      if (filters) {
        const conditions = this.buildWhereClause(filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      const result = await query
      return result[0]?.count || 0
    } catch (error) {
      console.error('Failed to count tenants:', error)
      throw error
    }
  }
}

// =============================================================================
// USER REPOSITORY
// =============================================================================

export class UserRepository extends BaseRepository<schema.User> {
  protected getColumn(field: string): any {
    const columnMap: Record<string, any> = {
      id: schema.userSchema.id,
      tenantId: schema.userSchema.tenantId,
      organizationId: schema.userSchema.organizationId,
      email: schema.userSchema.email,
      firstName: schema.userSchema.firstName,
      lastName: schema.userSchema.lastName,
      status: schema.userSchema.status,
      emailVerified: schema.userSchema.emailVerified,
      createdAt: schema.userSchema.createdAt,
      updatedAt: schema.userSchema.updatedAt,
    }
    return columnMap[field]
  }

  async create(data: schema.NewUser): Promise<schema.User> {
    try {
      const result = await this.db.insert(schema.userSchema).values(data).returning()
      return result[0]
    } catch (error) {
      console.error('Failed to create user:', error)
      throw error
    }
  }

  async findById(id: string): Promise<schema.User | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.userSchema)
        .where(eq(schema.userSchema.id, id))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find user by ID:', error)
      throw error
    }
  }

  async findByEmail(email: string): Promise<schema.User | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.userSchema)
        .where(eq(schema.userSchema.email, email))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find user by email:', error)
      throw error
    }
  }

  async findMany(options: QueryOptions = {}): Promise<RepositoryResult<schema.User>> {
    try {
      let query = this.db.select().from(schema.userSchema)

      // Apply filters
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      // Get total count
      const totalQuery = this.db.select({ count: count() }).from(schema.userSchema)
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          totalQuery.where(and(...conditions))
        }
      }
      const totalResult = await totalQuery
      const total = totalResult[0]?.count || 0

      // Apply pagination and sorting
      const data = await this.executeQuery(query, options)

      return {
        data,
        total,
        page: options.pagination?.page || 1,
        limit: options.pagination?.limit || data.length,
        hasNext: options.pagination
          ? options.pagination.page * options.pagination.limit < total
          : false,
        hasPrev: options.pagination ? options.pagination.page > 1 : false,
      }
    } catch (error) {
      console.error('Failed to find users:', error)
      throw error
    }
  }

  async update(id: string, data: Partial<schema.NewUser>): Promise<schema.User | null> {
    try {
      const result = await this.db
        .update(schema.userSchema)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.userSchema.id, id))
        .returning()
      return result[0] || null
    } catch (error) {
      console.error('Failed to update user:', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(schema.userSchema).where(eq(schema.userSchema.id, id))
      return result.rowCount > 0
    } catch (error) {
      console.error('Failed to delete user:', error)
      throw error
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      let query = this.db.select({ count: count() }).from(schema.userSchema)

      if (filters) {
        const conditions = this.buildWhereClause(filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      const result = await query
      return result[0]?.count || 0
    } catch (error) {
      console.error('Failed to count users:', error)
      throw error
    }
  }

  async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    try {
      const userRoleData = roleIds.map((roleId) => ({
        userId,
        roleId,
        assignedAt: new Date(),
        assignedBy: 'system', // This should come from the current user context
      }))

      await this.db.insert(schema.userRoleSchema).values(userRoleData)
    } catch (error) {
      console.error('Failed to assign roles to user:', error)
      throw error
    }
  }
}

// =============================================================================
// ORGANIZATION REPOSITORY
// =============================================================================

export class OrganizationRepository extends BaseRepository<schema.Organization> {
  protected getColumn(field: string): any {
    const columnMap: Record<string, any> = {
      id: schema.organizationSchema.id,
      tenantId: schema.organizationSchema.tenantId,
      name: schema.organizationSchema.name,
      createdAt: schema.organizationSchema.createdAt,
      updatedAt: schema.organizationSchema.updatedAt,
    }
    return columnMap[field]
  }

  async create(data: schema.NewOrganization): Promise<schema.Organization> {
    try {
      const result = await this.db.insert(schema.organizationSchema).values(data).returning()
      return result[0]
    } catch (error) {
      console.error('Failed to create organization:', error)
      throw error
    }
  }

  async findById(id: string): Promise<schema.Organization | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.organizationSchema)
        .where(eq(schema.organizationSchema.id, id))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find organization by ID:', error)
      throw error
    }
  }

  async findByName(name: string, tenantId: string): Promise<schema.Organization | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.organizationSchema)
        .where(
          and(
            eq(schema.organizationSchema.name, name),
            eq(schema.organizationSchema.tenantId, tenantId)
          )
        )
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find organization by name:', error)
      throw error
    }
  }

  async findMany(options: QueryOptions = {}): Promise<RepositoryResult<schema.Organization>> {
    try {
      let query = this.db.select().from(schema.organizationSchema)

      // Apply filters
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      // Get total count
      const totalQuery = this.db.select({ count: count() }).from(schema.organizationSchema)
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          totalQuery.where(and(...conditions))
        }
      }
      const totalResult = await totalQuery
      const total = totalResult[0]?.count || 0

      // Apply pagination and sorting
      const data = await this.executeQuery(query, options)

      return {
        data,
        total,
        page: options.pagination?.page || 1,
        limit: options.pagination?.limit || data.length,
        hasNext: options.pagination
          ? options.pagination.page * options.pagination.limit < total
          : false,
        hasPrev: options.pagination ? options.pagination.page > 1 : false,
      }
    } catch (error) {
      console.error('Failed to find organizations:', error)
      throw error
    }
  }

  async update(
    id: string,
    data: Partial<schema.NewOrganization>
  ): Promise<schema.Organization | null> {
    try {
      const result = await this.db
        .update(schema.organizationSchema)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.organizationSchema.id, id))
        .returning()
      return result[0] || null
    } catch (error) {
      console.error('Failed to update organization:', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(schema.organizationSchema)
        .where(eq(schema.organizationSchema.id, id))
      return result.rowCount > 0
    } catch (error) {
      console.error('Failed to delete organization:', error)
      throw error
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      let query = this.db.select({ count: count() }).from(schema.organizationSchema)

      if (filters) {
        const conditions = this.buildWhereClause(filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      const result = await query
      return result[0]?.count || 0
    } catch (error) {
      console.error('Failed to count organizations:', error)
      throw error
    }
  }
}

// =============================================================================
// ROLE REPOSITORY
// =============================================================================

export class RoleRepository extends BaseRepository<schema.Role> {
  protected getColumn(field: string): any {
    const columnMap: Record<string, any> = {
      id: schema.roleSchema.id,
      tenantId: schema.roleSchema.tenantId,
      name: schema.roleSchema.name,
      isSystem: schema.roleSchema.isSystem,
      createdAt: schema.roleSchema.createdAt,
      updatedAt: schema.roleSchema.updatedAt,
    }
    return columnMap[field]
  }

  async create(data: schema.NewRole): Promise<schema.Role> {
    try {
      const result = await this.db.insert(schema.roleSchema).values(data).returning()
      return result[0]
    } catch (error) {
      console.error('Failed to create role:', error)
      throw error
    }
  }

  async findById(id: string): Promise<schema.Role | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.roleSchema)
        .where(eq(schema.roleSchema.id, id))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find role by ID:', error)
      throw error
    }
  }

  async findByName(name: string, tenantId: string): Promise<schema.Role | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.roleSchema)
        .where(and(eq(schema.roleSchema.name, name), eq(schema.roleSchema.tenantId, tenantId)))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find role by name:', error)
      throw error
    }
  }

  async findMany(options: QueryOptions = {}): Promise<RepositoryResult<schema.Role>> {
    try {
      let query = this.db.select().from(schema.roleSchema)

      // Apply filters
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      // Get total count
      const totalQuery = this.db.select({ count: count() }).from(schema.roleSchema)
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          totalQuery.where(and(...conditions))
        }
      }
      const totalResult = await totalQuery
      const total = totalResult[0]?.count || 0

      // Apply pagination and sorting
      const data = await this.executeQuery(query, options)

      return {
        data,
        total,
        page: options.pagination?.page || 1,
        limit: options.pagination?.limit || data.length,
        hasNext: options.pagination
          ? options.pagination.page * options.pagination.limit < total
          : false,
        hasPrev: options.pagination ? options.pagination.page > 1 : false,
      }
    } catch (error) {
      console.error('Failed to find roles:', error)
      throw error
    }
  }

  async update(id: string, data: Partial<schema.NewRole>): Promise<schema.Role | null> {
    try {
      const result = await this.db
        .update(schema.roleSchema)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.roleSchema.id, id))
        .returning()
      return result[0] || null
    } catch (error) {
      console.error('Failed to update role:', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(schema.roleSchema).where(eq(schema.roleSchema.id, id))
      return result.rowCount > 0
    } catch (error) {
      console.error('Failed to delete role:', error)
      throw error
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      let query = this.db.select({ count: count() }).from(schema.roleSchema)

      if (filters) {
        const conditions = this.buildWhereClause(filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      const result = await query
      return result[0]?.count || 0
    } catch (error) {
      console.error('Failed to count roles:', error)
      throw error
    }
  }
}

// =============================================================================
// PLUGIN REPOSITORY
// =============================================================================

export class PluginRepository extends BaseRepository<schema.Plugin> {
  protected getColumn(field: string): any {
    const columnMap: Record<string, any> = {
      id: schema.pluginSchema.id,
      name: schema.pluginSchema.name,
      version: schema.pluginSchema.version,
      status: schema.pluginSchema.status,
      isSystem: schema.pluginSchema.isSystem,
      createdAt: schema.pluginSchema.createdAt,
      updatedAt: schema.pluginSchema.updatedAt,
    }
    return columnMap[field]
  }

  async create(data: schema.NewPlugin): Promise<schema.Plugin> {
    try {
      const result = await this.db.insert(schema.pluginSchema).values(data).returning()
      return result[0]
    } catch (error) {
      console.error('Failed to create plugin:', error)
      throw error
    }
  }

  async findById(id: string): Promise<schema.Plugin | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.pluginSchema)
        .where(eq(schema.pluginSchema.id, id))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find plugin by ID:', error)
      throw error
    }
  }

  async findByName(name: string): Promise<schema.Plugin | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.pluginSchema)
        .where(eq(schema.pluginSchema.name, name))
        .limit(1)
      return result[0] || null
    } catch (error) {
      console.error('Failed to find plugin by name:', error)
      throw error
    }
  }

  async findMany(options: QueryOptions = {}): Promise<RepositoryResult<schema.Plugin>> {
    try {
      let query = this.db.select().from(schema.pluginSchema)

      // Apply filters
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      // Get total count
      const totalQuery = this.db.select({ count: count() }).from(schema.pluginSchema)
      if (options.filters) {
        const conditions = this.buildWhereClause(options.filters)
        if (conditions.length > 0) {
          totalQuery.where(and(...conditions))
        }
      }
      const totalResult = await totalQuery
      const total = totalResult[0]?.count || 0

      // Apply pagination and sorting
      const data = await this.executeQuery(query, options)

      return {
        data,
        total,
        page: options.pagination?.page || 1,
        limit: options.pagination?.limit || data.length,
        hasNext: options.pagination
          ? options.pagination.page * options.pagination.limit < total
          : false,
        hasPrev: options.pagination ? options.pagination.page > 1 : false,
      }
    } catch (error) {
      console.error('Failed to find plugins:', error)
      throw error
    }
  }

  async update(id: string, data: Partial<schema.NewPlugin>): Promise<schema.Plugin | null> {
    try {
      const result = await this.db
        .update(schema.pluginSchema)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.pluginSchema.id, id))
        .returning()
      return result[0] || null
    } catch (error) {
      console.error('Failed to update plugin:', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(schema.pluginSchema).where(eq(schema.pluginSchema.id, id))
      return result.rowCount > 0
    } catch (error) {
      console.error('Failed to delete plugin:', error)
      throw error
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      let query = this.db.select({ count: count() }).from(schema.pluginSchema)

      if (filters) {
        const conditions = this.buildWhereClause(filters)
        if (conditions.length > 0) {
          query = query.where(and(...conditions))
        }
      }

      const result = await query
      return result[0]?.count || 0
    } catch (error) {
      console.error('Failed to count plugins:', error)
      throw error
    }
  }
}

// =============================================================================
// REPOSITORY FACTORY
// =============================================================================

export class RepositoryFactory {
  private static tenantRepository: TenantRepository
  private static userRepository: UserRepository
  private static organizationRepository: OrganizationRepository
  private static roleRepository: RoleRepository
  private static pluginRepository: PluginRepository

  static getTenantRepository(): TenantRepository {
    if (!this.tenantRepository) {
      this.tenantRepository = new TenantRepository()
    }
    return this.tenantRepository
  }

  static getUserRepository(): UserRepository {
    if (!this.userRepository) {
      this.userRepository = new UserRepository()
    }
    return this.userRepository
  }

  static getOrganizationRepository(): OrganizationRepository {
    if (!this.organizationRepository) {
      this.organizationRepository = new OrganizationRepository()
    }
    return this.organizationRepository
  }

  static getRoleRepository(): RoleRepository {
    if (!this.roleRepository) {
      this.roleRepository = new RoleRepository()
    }
    return this.roleRepository
  }

  static getPluginRepository(): PluginRepository {
    if (!this.pluginRepository) {
      this.pluginRepository = new PluginRepository()
    }
    return this.pluginRepository
  }
}
