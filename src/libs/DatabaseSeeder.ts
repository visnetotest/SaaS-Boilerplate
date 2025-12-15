import { RepositoryFactory } from '@/libs/Repository'

export interface SeedData {
  tenants?: any[]
  organizations?: any[]
  users?: any[]
  roles?: any[]
  plugins?: any[]
}

export class DatabaseSeeder {
  private tenantRepository = RepositoryFactory.getTenantRepository()
  private organizationRepository = RepositoryFactory.getOrganizationRepository()
  private userRepository = RepositoryFactory.getUserRepository()
  private roleRepository = RepositoryFactory.getRoleRepository()
  private pluginRepository = RepositoryFactory.getPluginRepository()

  async seedAll(): Promise<void> {
    console.log('🌱 Starting database seeding...')

    try {
      await this.seedTenants()
      await this.seedOrganizations()
      await this.seedRoles()
      await this.seedUsers()
      await this.seedPlugins()

      console.log('✅ Database seeding completed successfully')
    } catch (error) {
      console.error('❌ Database seeding failed:', error)
      throw error
    }
  }

  async seedTenants(): Promise<void> {
    console.log('🏢 Seeding tenants...')

    const tenants = [
      {
        name: 'Demo Corporation',
        slug: 'demo-corp',
        status: 'active',
        settings: {
          theme: 'light',
          timezone: 'UTC',
          language: 'en',
        },
        metadata: {
          source: 'seed',
          environment: 'development',
        },
      },
      {
        name: 'Test Startup',
        slug: 'test-startup',
        status: 'active',
        settings: {
          theme: 'dark',
          timezone: 'America/New_York',
          language: 'en',
        },
        metadata: {
          source: 'seed',
          environment: 'development',
        },
      },
      {
        name: 'Sample Organization',
        slug: 'sample-org',
        status: 'inactive',
        settings: {
          theme: 'auto',
          timezone: 'Europe/London',
          language: 'en',
        },
        metadata: {
          source: 'seed',
          environment: 'development',
        },
      },
    ]

    for (const tenantData of tenants) {
      try {
        const existingTenant = await this.tenantRepository.findBySlug(tenantData.slug)
        if (!existingTenant) {
          await this.tenantRepository.create(tenantData)
          console.log(`  ✓ Created tenant: ${tenantData.name}`)
        } else {
          console.log(`  ⏭ Tenant already exists: ${tenantData.name}`)
        }
      } catch (error) {
        console.error(`  ❌ Failed to create tenant ${tenantData.name}:`, error)
      }
    }
  }

  async seedOrganizations(): Promise<void> {
    console.log('🏢 Seeding organizations...')

    // Get tenants to associate with organizations
    const demoCorp = await this.tenantRepository.findBySlug('demo-corp')
    const testStartup = await this.tenantRepository.findBySlug('test-startup')

    if (!demoCorp || !testStartup) {
      console.log('  ⚠️ Skipping organization seeding - required tenants not found')
      return
    }

    const organizations = [
      {
        tenantId: demoCorp.id,
        name: 'Engineering Department',
        description: 'Main engineering team',
        website: 'https://demo-corp.com/engineering',
        settings: {
          department: 'engineering',
          budget: 500000,
        },
      },
      {
        tenantId: demoCorp.id,
        name: 'Marketing Department',
        description: 'Marketing and sales team',
        website: 'https://demo-corp.com/marketing',
        settings: {
          department: 'marketing',
          budget: 250000,
        },
      },
      {
        tenantId: testStartup.id,
        name: 'Product Team',
        description: 'Product development and management',
        website: 'https://test-startup.com/product',
        settings: {
          department: 'product',
          budget: 100000,
        },
      },
    ]

    for (const orgData of organizations) {
      try {
        const existingOrg = await this.organizationRepository.findByName(
          orgData.name,
          orgData.tenantId
        )
        if (!existingOrg) {
          await this.organizationRepository.create(orgData)
          console.log(`  ✓ Created organization: ${orgData.name}`)
        } else {
          console.log(`  ⏭ Organization already exists: ${orgData.name}`)
        }
      } catch (error) {
        console.error(`  ❌ Failed to create organization ${orgData.name}:`, error)
      }
    }
  }

  async seedRoles(): Promise<void> {
    console.log('👥 Seeding roles...')

    // Get tenants to associate with roles
    const demoCorp = await this.tenantRepository.findBySlug('demo-corp')
    const testStartup = await this.tenantRepository.findBySlug('test-startup')

    if (!demoCorp || !testStartup) {
      console.log('  ⚠️ Skipping role seeding - required tenants not found')
      return
    }

    const roles = [
      // Demo Corp roles
      {
        tenantId: demoCorp.id,
        name: 'Super Admin',
        description: 'Full system access',
        permissions: ['*'],
        isSystem: true,
      },
      {
        tenantId: demoCorp.id,
        name: 'Admin',
        description: 'Administrative access',
        permissions: [
          'users.read',
          'users.write',
          'users.delete',
          'organizations.read',
          'organizations.write',
          'tenants.read',
          'tenants.write',
          'roles.read',
          'roles.write',
        ],
      },
      {
        tenantId: demoCorp.id,
        name: 'Manager',
        description: 'Team management access',
        permissions: ['users.read', 'users.write', 'organizations.read', 'roles.read'],
      },
      {
        tenantId: demoCorp.id,
        name: 'User',
        description: 'Basic user access',
        permissions: ['users.read', 'organizations.read'],
      },
      // Test Startup roles
      {
        tenantId: testStartup.id,
        name: 'Founder',
        description: 'Company founder with full access',
        permissions: ['*'],
        isSystem: true,
      },
      {
        tenantId: testStartup.id,
        name: 'Developer',
        description: 'Development team access',
        permissions: [
          'users.read',
          'users.write',
          'organizations.read',
          'organizations.write',
          'projects.read',
          'projects.write',
          'deployments.read',
          'deployments.write',
        ],
      },
      {
        tenantId: testStartup.id,
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['users.read', 'organizations.read', 'projects.read', 'deployments.read'],
      },
    ]

    for (const roleData of roles) {
      try {
        const existingRole = await this.roleRepository.findByName(roleData.name, roleData.tenantId)
        if (!existingRole) {
          await this.roleRepository.create(roleData)
          console.log(`  ✓ Created role: ${roleData.name}`)
        } else {
          console.log(`  ⏭ Role already exists: ${roleData.name}`)
        }
      } catch (error) {
        console.error(`  ❌ Failed to create role ${roleData.name}:`, error)
      }
    }
  }

  async seedUsers(): Promise<void> {
    console.log('👤 Seeding users...')

    // Get tenants and organizations
    const demoCorp = await this.tenantRepository.findBySlug('demo-corp')
    const testStartup = await this.tenantRepository.findBySlug('test-startup')

    if (!demoCorp || !testStartup) {
      console.log('  ⚠️ Skipping user seeding - required tenants not found')
      return
    }

    const engineeringOrg = await this.organizationRepository.findByName(
      'Engineering Department',
      demoCorp.id
    )
    const marketingOrg = await this.organizationRepository.findByName(
      'Marketing Department',
      demoCorp.id
    )
    const productOrg = await this.organizationRepository.findByName('Product Team', testStartup.id)

    if (!engineeringOrg || !marketingOrg || !productOrg) {
      console.log('  ⚠️ Skipping user seeding - required organizations not found')
      return
    }

    const users = [
      {
        tenantId: demoCorp.id,
        organizationId: engineeringOrg.id,
        email: 'admin@demo-corp.com',
        firstName: 'Super',
        lastName: 'Admin',
        preferences: {
          theme: 'light',
          notifications: true,
          language: 'en',
        },
        metadata: {
          source: 'seed',
          role: 'super-admin',
        },
      },
      {
        tenantId: demoCorp.id,
        organizationId: engineeringOrg.id,
        email: 'john.engineer@demo-corp.com',
        firstName: 'John',
        lastName: 'Engineer',
        preferences: {
          theme: 'dark',
          notifications: true,
          language: 'en',
        },
        metadata: {
          source: 'seed',
          role: 'developer',
        },
      },
      {
        tenantId: demoCorp.id,
        organizationId: marketingOrg.id,
        email: 'sarah.marketer@demo-corp.com',
        firstName: 'Sarah',
        lastName: 'Marketer',
        preferences: {
          theme: 'light',
          notifications: true,
          language: 'en',
        },
        metadata: {
          source: 'seed',
          role: 'marketing',
        },
      },
      {
        tenantId: testStartup.id,
        organizationId: productOrg.id,
        email: 'founder@test-startup.com',
        firstName: 'Tech',
        lastName: 'Founder',
        preferences: {
          theme: 'auto',
          notifications: true,
          language: 'en',
        },
        metadata: {
          source: 'seed',
          role: 'founder',
        },
      },
      {
        tenantId: testStartup.id,
        organizationId: productOrg.id,
        email: 'dev@test-startup.com',
        firstName: 'Code',
        lastName: 'Developer',
        preferences: {
          theme: 'dark',
          notifications: false,
          language: 'en',
        },
        metadata: {
          source: 'seed',
          role: 'developer',
        },
      },
    ]

    for (const userData of users) {
      try {
        const existingUser = await this.userRepository.findByEmail(userData.email)
        if (!existingUser) {
          await this.userRepository.create({
            ...userData,
            status: 'active',
            emailVerified: true,
          })

          // Assign roles (simplified - in real implementation you'd match by role names)
          console.log(`  ✓ Created user: ${userData.email}`)
        } else {
          console.log(`  ⏭ User already exists: ${userData.email}`)
        }
      } catch (error) {
        console.error(`  ❌ Failed to create user ${userData.email}:`, error)
      }
    }
  }

  async seedPlugins(): Promise<void> {
    console.log('🔌 Seeding plugins...')

    const plugins = [
      {
        name: 'Analytics Dashboard',
        slug: 'analytics-dashboard',
        version: '1.0.0',
        description: 'Comprehensive analytics and reporting dashboard',
        author: 'Demo Corp',
        repository: 'https://github.com/demo/analytics-dashboard',
        homepage: 'https://demo.com/analytics',
        category: 'analytics',
        tags: ['dashboard', 'analytics', 'reports'],
        status: 'active',
        isSystem: false,
        manifest: {
          name: 'Analytics Dashboard',
          version: '1.0.0',
          description: 'Analytics plugin for SaaS platform',
          author: 'Demo Corp',
          license: 'MIT',
          main: 'index.js',
          dependencies: {
            'chart.js': '^3.9.0',
            'date-fns': '^2.29.0',
          },
        },
        settings: {
          refreshInterval: 300,
          defaultTimeRange: '7d',
          enableRealTime: true,
        },
      },
      {
        name: 'User Management',
        slug: 'user-management',
        version: '2.1.0',
        description: 'Advanced user management and authentication',
        author: 'Demo Corp',
        repository: 'https://github.com/demo/user-management',
        homepage: 'https://demo.com/user-management',
        category: 'authentication',
        tags: ['users', 'auth', 'management'],
        status: 'active',
        isSystem: true,
        manifest: {
          name: 'User Management',
          version: '2.1.0',
          description: 'User management plugin',
          author: 'Demo Corp',
          license: 'MIT',
          main: 'index.js',
          dependencies: {
            bcrypt: '^5.1.0',
            jsonwebtoken: '^9.0.0',
          },
        },
        settings: {
          passwordMinLength: 8,
          sessionTimeout: 3600,
          enable2FA: true,
        },
      },
      {
        name: 'Billing System',
        slug: 'billing-system',
        version: '1.5.0',
        description: 'Subscription and billing management',
        author: 'Demo Corp',
        repository: 'https://github.com/demo/billing',
        homepage: 'https://demo.com/billing',
        category: 'billing',
        tags: ['billing', 'subscriptions', 'payments'],
        status: 'inactive',
        isSystem: false,
        manifest: {
          name: 'Billing System',
          version: '1.5.0',
          description: 'Billing and subscription management',
          author: 'Demo Corp',
          license: 'MIT',
          main: 'index.js',
          dependencies: {
            stripe: '^12.0.0',
            nodemailer: '^6.9.0',
          },
        },
        settings: {
          currency: 'USD',
          taxRate: 0.08,
          enableInvoicing: true,
        },
      },
    ]

    for (const pluginData of plugins) {
      try {
        const existingPlugin = await this.pluginRepository.findByName(pluginData.name)
        if (!existingPlugin) {
          await this.pluginRepository.create(pluginData)
          console.log(`  ✓ Created plugin: ${pluginData.name}`)
        } else {
          console.log(`  ⏭ Plugin already exists: ${pluginData.name}`)
        }
      } catch (error) {
        console.error(`  ❌ Failed to create plugin ${pluginData.name}:`, error)
      }
    }
  }

  async clearAll(): Promise<void> {
    console.log('🧹 Clearing all seeded data...')

    try {
      // Clear in reverse order of dependencies
      await this.clearPlugins()
      await this.clearUsers()
      await this.clearRoles()
      await this.clearOrganizations()
      await this.clearTenants()

      console.log('✅ Database cleared successfully')
    } catch (error) {
      console.error('❌ Failed to clear database:', error)
      throw error
    }
  }

  private async clearTenants(): Promise<void> {
    const tenants = await this.tenantRepository.findMany()
    for (const tenant of tenants.data) {
      if (tenant.metadata?.source === 'seed') {
        await this.tenantRepository.delete(tenant.id)
      }
    }
  }

  private async clearOrganizations(): Promise<void> {
    const organizations = await this.organizationRepository.findMany()
    for (const org of organizations.data) {
      if (org.settings?.department) {
        await this.organizationRepository.delete(org.id)
      }
    }
  }

  private async clearRoles(): Promise<void> {
    const roles = await this.roleRepository.findMany()
    for (const role of roles.data) {
      if (!role.isSystem || role.name.includes('Demo') || role.name.includes('Test')) {
        await this.roleRepository.delete(role.id)
      }
    }
  }

  private async clearUsers(): Promise<void> {
    const users = await this.userRepository.findMany()
    for (const user of users.data) {
      if (user.metadata?.source === 'seed') {
        await this.userRepository.delete(user.id)
      }
    }
  }

  private async clearPlugins(): Promise<void> {
    const plugins = await this.pluginRepository.findMany()
    for (const plugin of plugins.data) {
      if (!plugin.isSystem || plugin.author === 'Demo Corp') {
        await this.pluginRepository.delete(plugin.id)
      }
    }
  }

  async getSeedStatus(): Promise<{
    tenantsCount: number
    organizationsCount: number
    usersCount: number
    rolesCount: number
    pluginsCount: number
  }> {
    const [tenants, organizations, users, roles, plugins] = await Promise.all([
      this.tenantRepository.findMany({ pagination: { page: 1, limit: 1000 } }),
      this.organizationRepository.findMany({ pagination: { page: 1, limit: 1000 } }),
      this.userRepository.findMany({ pagination: { page: 1, limit: 1000 } }),
      this.roleRepository.findMany({ pagination: { page: 1, limit: 1000 } }),
      this.pluginRepository.findMany({ pagination: { page: 1, limit: 1000 } }),
    ])

    return {
      tenantsCount: tenants.total,
      organizationsCount: organizations.total,
      usersCount: users.total,
      rolesCount: roles.total,
      pluginsCount: plugins.total,
    }
  }
}

// Export singleton instance
export const databaseSeeder = new DatabaseSeeder()

// Export convenience functions
export const seedDatabase = () => databaseSeeder.seedAll()
export const clearDatabase = () => databaseSeeder.clearAll()
export const getSeedStatus = () => databaseSeeder.getSeedStatus()
