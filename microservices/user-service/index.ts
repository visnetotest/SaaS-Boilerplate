// =============================================================================
// USER MANAGEMENT SERVICE MICROSERVICE
// =============================================================================

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { createClient } from 'redis'

// =============================================================================
// INTERFACES
// =============================================================================

interface User {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  isEmailVerified: boolean
  tenantId?: string
  profile: UserProfile
  preferences: UserPreferences
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

interface UserProfile {
  firstName?: string
  lastName?: string
  avatar?: string
  phone?: string
  timezone?: string
  language?: string
  bio?: string
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
  }
  privacy: {
    profileVisibility: 'public' | 'private' | 'team'
    showEmail: boolean
    showPhone: boolean
  }
}

interface CreateUserRequest {
  email: string
  password: string
  name: string
  role?: string
  tenantId?: string
  profile?: Partial<UserProfile>
}

interface UpdateUserRequest {
  name?: string
  role?: string
  isActive?: boolean
  profile?: Partial<UserProfile>
  preferences?: Partial<UserPreferences>
}

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface Permission {
  id: string
  name: string
  resource: string
  action: string
  description: string
}

// =============================================================================
// USER MANAGEMENT SERVICE CLASS
// =============================================================================

class UserManagementService {
  private app: express.Application
  private redis: any
  private users: Map<string, User> = new Map()
  private roles: Map<string, Role> = new Map()
  private permissions: Map<string, Permission> = new Map()
  private PORT: number
  private AUTH_SERVICE_URL: string

  constructor() {
    this.app = express()
    this.PORT = parseInt(process.env.PORT || '3004')
    this.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3003'
    
    this.initializeMiddleware()
    this.initializeRoutes()
    this.initializeDefaultRoles()
  }

  private async initializeMiddleware() {
    this.app.use(helmet())
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }))

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: { error: 'Too many requests from this IP' }
    })
    this.app.use('/api/', limiter)

    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))
    this.app.use(compression())

    // Redis for caching
    if (process.env.REDIS_URL) {
      this.redis = await createClient({ url: process.env.REDIS_URL })
      await this.redis.connect()
      console.log('🔄 Redis connected for user management caching')
    }
  }

  private initializeDefaultRoles() {
    // Default permissions
    const defaultPermissions: Permission[] = [
      { id: 'users.read', name: 'Read Users', resource: 'users', action: 'read', description: 'View user information' },
      { id: 'users.write', name: 'Write Users', resource: 'users', action: 'write', description: 'Create and update users' },
      { id: 'users.delete', name: 'Delete Users', resource: 'users', action: 'delete', description: 'Delete user accounts' },
      { id: 'roles.read', name: 'Read Roles', resource: 'roles', action: 'read', description: 'View role information' },
      { id: 'roles.write', name: 'Write Roles', resource: 'roles', action: 'write', description: 'Create and update roles' },
      { id: 'analytics.read', name: 'Read Analytics', resource: 'analytics', action: 'read', description: 'View analytics data' },
      { id: 'plugins.read', name: 'Read Plugins', resource: 'plugins', action: 'read', description: 'View plugin information' },
      { id: 'plugins.write', name: 'Write Plugins', resource: 'plugins', action: 'write', description: 'Install and manage plugins' },
    ]

    defaultPermissions.forEach(permission => {
      this.permissions.set(permission.id, permission)
    })

    // Default roles
    const defaultRoles: Role[] = [
      {
        id: 'super_admin',
        name: 'Super Admin',
        description: 'Full system access',
        permissions: defaultPermissions.map(p => p.id),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'admin',
        name: 'Admin',
        description: 'Administrative access to user management',
        permissions: ['users.read', 'users.write', 'roles.read', 'analytics.read', 'plugins.read'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'user',
        name: 'User',
        description: 'Standard user access',
        permissions: ['users.read'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['users.read', 'analytics.read'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    defaultRoles.forEach(role => {
      this.roles.set(role.id, role)
    })
  }

  private async authenticateRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' })
      }

      const token = authHeader.substring(7)
      
      // Verify token with auth service
      const response = await fetch(`${this.AUTH_SERVICE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        return res.status(401).json({ error: 'Invalid token' })
      }

      const { user } = await response.json()
      req.user = user
      next()
    } catch (error) {
      console.error('Authentication error:', error)
      res.status(401).json({ error: 'Authentication failed' })
    }
  }

  private checkPermission(user: any, requiredPermission: string): boolean {
    const userRole = this.roles.get(user.role)
    if (!userRole) return false

    return userRole.permissions.includes(requiredPermission) || user.role === 'super_admin'
  }

  private initializeRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'user-service',
        version: '1.0.0',
        uptime: process.uptime(),
        metrics: {
          totalUsers: this.users.size,
          totalRoles: this.roles.size,
          totalPermissions: this.permissions.size
        }
      })
    })

    // =============================================================================
    // USER MANAGEMENT ROUTES
    // =============================================================================

    // Create user
    this.app.post('/api/users', async (req: express.Request, res: express.Response) => {
      try {
        const createUserReq: CreateUserRequest = req.body
        
        // Validate required fields
        if (!createUserReq.email || !createUserReq.password || !createUserReq.name) {
          return res.status(400).json({ error: 'Email, password, and name are required' })
        }

        // Check if user already exists
        const existingUser = Array.from(this.users.values()).find(u => u.email === createUserReq.email)
        if (existingUser) {
          return res.status(409).json({ error: 'User with this email already exists' })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(createUserReq.password, 12)

        // Create user
        const user: User = {
          id: crypto.randomUUID(),
          email: createUserReq.email,
          name: createUserReq.name,
          role: createUserReq.role || 'user',
          isActive: true,
          isEmailVerified: false,
          tenantId: createUserReq.tenantId,
          profile: {
            firstName: createUserReq.profile?.firstName,
            lastName: createUserReq.profile?.lastName,
            timezone: createUserReq.profile?.timezone || 'UTC',
            language: createUserReq.profile?.language || 'en'
          },
          preferences: {
            theme: 'light',
            notifications: {
              email: true,
              push: true,
              sms: false
            },
            privacy: {
              profileVisibility: 'public',
              showEmail: false,
              showPhone: false
            },
            ...createUserReq.preferences
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }

        this.users.set(user.id, user)

        // Cache user in Redis
        if (this.redis) {
          await this.redis.setEx(`user:${user.id}`, 3600, JSON.stringify(user))
        }

        res.status(201).json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            tenantId: user.tenantId,
            profile: user.profile,
            preferences: user.preferences,
            createdAt: user.createdAt
          }
        })
      } catch (error) {
        console.error('Create user error:', error)
        res.status(500).json({ error: 'Failed to create user' })
      }
    })

    // Get all users (with pagination and filtering)
    this.app.get('/api/users', async (req: express.Request, res: express.Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 20
        const search = req.query.search as string
        const role = req.query.role as string
        const isActive = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined
        const tenantId = req.query.tenantId as string

        let users = Array.from(this.users.values())

        // Apply filters
        if (search) {
          users = users.filter(user => 
            user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase()) ||
            user.profile.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            user.profile.lastName?.toLowerCase().includes(search.toLowerCase())
          )
        }

        if (role) {
          users = users.filter(user => user.role === role)
        }

        if (isActive !== undefined) {
          users = users.filter(user => user.isActive === isActive)
        }

        if (tenantId) {
          users = users.filter(user => user.tenantId === tenantId)
        }

        // Sort by created date
        users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        // Paginate
        const startIndex = (page - 1) * limit
        const endIndex = startIndex + limit
        const paginatedUsers = users.slice(startIndex, endIndex)

        res.json({
          users: paginatedUsers.map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            tenantId: user.tenantId,
            profile: user.profile,
            preferences: user.preferences,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt
          })),
          pagination: {
            page,
            limit,
            total: users.length,
            totalPages: Math.ceil(users.length / limit),
            hasNext: endIndex < users.length,
            hasPrev: page > 1
          }
        })
      } catch (error) {
        console.error('Get users error:', error)
        res.status(500).json({ error: 'Failed to get users' })
      }
    })

    // Get user by ID
    this.app.get('/api/users/:id', async (req: express.Request, res: express.Response) => {
      try {
        const userId = req.params.id
        const user = this.users.get(userId)

        if (!user) {
          return res.status(404).json({ error: 'User not found' })
        }

        res.json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            tenantId: user.tenantId,
            profile: user.profile,
            preferences: user.preferences,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt
          }
        })
      } catch (error) {
        console.error('Get user error:', error)
        res.status(500).json({ error: 'Failed to get user' })
      }
    })

    // Update user
    this.app.put('/api/users/:id', async (req: express.Request, res: express.Response) => {
      try {
        const userId = req.params.id
        const updateReq: UpdateUserRequest = req.body

        const user = this.users.get(userId)
        if (!user) {
          return res.status(404).json({ error: 'User not found' })
        }

        // Update user fields
        if (updateReq.name) user.name = updateReq.name
        if (updateReq.role) user.role = updateReq.role
        if (updateReq.isActive !== undefined) user.isActive = updateReq.isActive
        if (updateReq.tenantId) user.tenantId = updateReq.tenantId

        // Update profile
        if (updateReq.profile) {
          user.profile = { ...user.profile, ...updateReq.profile }
        }

        // Update preferences
        if (updateReq.preferences) {
          user.preferences = { ...user.preferences, ...updateReq.preferences }
        }

        user.updatedAt = new Date()

        // Update cache
        if (this.redis) {
          await this.redis.setEx(`user:${user.id}`, 3600, JSON.stringify(user))
        }

        res.json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            tenantId: user.tenantId,
            profile: user.profile,
            preferences: user.preferences,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt
          }
        })
      } catch (error) {
        console.error('Update user error:', error)
        res.status(500).json({ error: 'Failed to update user' })
      }
    })

    // Delete user
    this.app.delete('/api/users/:id', async (req: express.Request, res: express.Response) => {
      try {
        const userId = req.params.id
        const user = this.users.get(userId)

        if (!user) {
          return res.status(404).json({ error: 'User not found' })
        }

        this.users.delete(userId)

        // Remove from cache
        if (this.redis) {
          await this.redis.del(`user:${userId}`)
        }

        res.status(204).send()
      } catch (error) {
        console.error('Delete user error:', error)
        res.status(500).json({ error: 'Failed to delete user' })
      }
    })

    // =============================================================================
    // ROLE MANAGEMENT ROUTES
    // =============================================================================

    // Get all roles
    this.app.get('/api/roles', async (req: express.Request, res: express.Response) => {
      try {
        const roles = Array.from(this.roles.values()).map(role => ({
          ...role,
          permissions: role.permissions.map(permId => this.permissions.get(permId))
        }))

        res.json({ roles })
      } catch (error) {
        console.error('Get roles error:', error)
        res.status(500).json({ error: 'Failed to get roles' })
      }
    })

    // Create role
    this.app.post('/api/roles', async (req: express.Request, res: express.Response) => {
      try {
        const { name, description, permissions } = req.body

        if (!name || !description || !permissions) {
          return res.status(400).json({ error: 'Name, description, and permissions are required' })
        }

        const role: Role = {
          id: crypto.randomUUID(),
          name,
          description,
          permissions,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        this.roles.set(role.id, role)

        res.status(201).json({ role })
      } catch (error) {
        console.error('Create role error:', error)
        res.status(500).json({ error: 'Failed to create role' })
      }
    })

    // =============================================================================
    // SEARCH AND FILTERING ROUTES
    // =============================================================================

    // Search users
    this.app.get('/api/search/users', async (req: express.Request, res: express.Response) => {
      try {
        const query = req.query.q as string
        if (!query || query.length < 2) {
          return res.status(400).json({ error: 'Search query must be at least 2 characters' })
        }

        const users = Array.from(this.users.values())
        const searchResults = users.filter(user => 
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.email.toLowerCase().includes(query.toLowerCase()) ||
          user.profile.firstName?.toLowerCase().includes(query.toLowerCase()) ||
          user.profile.lastName?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 20) // Limit to 20 results

        res.json({
          query,
          results: searchResults.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            profile: user.profile,
            role: user.role
          })),
          total: searchResults.length
        })
      } catch (error) {
        console.error('Search users error:', error)
        res.status(500).json({ error: 'Search failed' })
      }
    })

    // =============================================================================
    // ERROR HANDLING
    // =============================================================================

    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', err)
      res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
      })
    })

    // 404 handler
    this.app.use('*', (req: express.Request, res: express.Response) => {
      res.status(404).json({ 
        error: 'Route not found',
        availableEndpoints: [
          'GET /health',
          'GET /api/users',
          'POST /api/users',
          'GET /api/users/:id',
          'PUT /api/users/:id',
          'DELETE /api/users/:id',
          'GET /api/roles',
          'POST /api/roles',
          'GET /api/search/users'
        ]
      })
    })
  }

  async start() {
    try {
      // Create sample admin user for testing
      const adminPassword = await bcrypt.hash('admin123', 12)
      const adminUser: User = {
        id: crypto.randomUUID(),
        email: 'admin@user-service.com',
        name: 'System Administrator',
        role: 'super_admin',
        isActive: true,
        isEmailVerified: true,
        profile: {
          firstName: 'System',
          lastName: 'Administrator',
          timezone: 'UTC',
          language: 'en'
        },
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: true,
            sms: false
          },
          privacy: {
            profileVisibility: 'public',
            showEmail: false,
            showPhone: false
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      this.users.set(adminUser.id, adminUser)

      this.app.listen(this.PORT, () => {
        console.log(`🚀 User Management Service running on port ${this.PORT}`)
        console.log(`📊 Health check: http://localhost:${this.PORT}/health`)
        console.log(`👥 User management endpoints: http://localhost:${this.PORT}/api/users`)
        console.log(`🔐 Admin user created: admin@user-service.com / admin123`)
      })
    } catch (error) {
      console.error('Failed to start User Management Service:', error)
      process.exit(1)
    }
  }

  async stop() {
    if (this.redis) {
      await this.redis.quit()
    }
  }
}

// =============================================================================
// START SERVER
// =============================================================================

async function startUserService() {
  const userService = new UserManagementService()
  
  await userService.start()
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully')
    await userService.stop()
    process.exit(0)
  })
  
  process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully')
    await userService.stop()
    process.exit(0)
  })
}

startUserService()