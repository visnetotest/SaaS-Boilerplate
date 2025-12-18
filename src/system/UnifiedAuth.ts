// =============================================================================
// UNIFIED AUTHENTICATION SERVICE
// =============================================================================

import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'crypto'
import { EventBus } from './UnifiedSystem'

// =============================================================================
// INTERFACES
// =============================================================================

interface AuthToken {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

interface AuthUser {
  id: string
  email: string
  tenantId: string
  roles: string[]
  permissions: string[]
  metadata?: Record<string, any>
}

interface AuthConfig {
  jwtSecret: string
  jwtExpiration: string
  refreshExpiration: string
  issuer: string
  audience: string
  passwordPolicy: {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumbers: boolean
    requireSpecialChars: boolean
  }
  sessionConfig: {
    maxSessions: number
    idleTimeout: number
    absoluteTimeout: number
  }
}

interface ServiceAuthContext {
  serviceName: string
  permissions: string[]
  authToken: string
  expiresAt: Date
}

// =============================================================================
// UNIFIED AUTHENTICATION MANAGER
// =============================================================================

export class UnifiedAuthManager {
  private config: AuthConfig
  private eventBus: EventBus
  private tokenStore: Map<string, AuthToken> = new Map()
  private sessionStore: Map<string, AuthUser> = new Map()
  private serviceAuthStore: Map<string, ServiceAuthContext> = new Map()

  constructor(config: AuthConfig, eventBus: EventBus) {
    this.config = config
    this.eventBus = eventBus
    this.initializeTokenCleanup()
  }

  // =============================================================================
  // USER AUTHENTICATION
  // =============================================================================

  async authenticateUser(credentials: {
    email: string
    password: string
    tenantId: string
  }): Promise<AuthToken> {
    try {
      // Validate user credentials against auth service
      const user = await this.validateUserCredentials(credentials)
      
      if (!user) {
        await this.eventBus.publish('auth.failed', {
          email: credentials.email,
          tenantId: credentials.tenantId,
          reason: 'invalid_credentials',
          timestamp: new Date().toISOString()
        })
        throw new Error('Invalid credentials')
      }

      // Generate authentication tokens
      const tokens = await this.generateUserTokens(user)
      
      // Store session
      this.sessionStore.set(tokens.accessToken, user)
      
      // Publish authentication event
      await this.eventBus.publish('auth.user.authenticated', {
        userId: user.id,
        tenantId: user.tenantId,
        timestamp: new Date().toISOString()
      })

      return tokens
    } catch (error) {
      console.error('User authentication failed:', error)
      throw error
    }
  }

  async refreshUserToken(refreshToken: string): Promise<AuthToken> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.config.jwtSecret) as any
      
      // Get user from auth service
      const user = await this.getUserById(payload.userId)
      
      if (!user) {
        throw new Error('User not found')
      }

      // Generate new tokens
      const tokens = await this.generateUserTokens(user)
      
      // Update session
      this.sessionStore.set(tokens.accessToken, user)
      
      return tokens
    } catch (error) {
      await this.eventBus.publish('auth.refresh.failed', {
        refreshToken,
        reason: error.message,
        timestamp: new Date().toISOString()
      })
      throw new Error('Invalid refresh token')
    }
  }

  async logoutUser(accessToken: string): Promise<void> {
    const user = this.sessionStore.get(accessToken)
    
    if (user) {
      // Remove session
      this.sessionStore.delete(accessToken)
      
      // Publish logout event
      await this.eventBus.publish('auth.user.logged_out', {
        userId: user.id,
        tenantId: user.tenantId,
        timestamp: new Date().toISOString()
      })
    }
  }

  async validateUserToken(accessToken: string): Promise<AuthUser | null> {
    try {
      // Check if session exists
      const user = this.sessionStore.get(accessToken)
      
      if (!user) {
        return null
      }

      // Verify JWT token
      const payload = jwt.verify(accessToken, this.config.jwtSecret) as any
      
      // Check if token is expired
      if (Date.now() > payload.exp * 1000) {
        this.sessionStore.delete(accessToken)
        return null
      }

      return user
    } catch (error) {
      console.error('Token validation failed:', error)
      return null
    }
  }

  // =============================================================================
  // SERVICE AUTHENTICATION
  // =============================================================================

  async authenticateService(serviceName: string, serviceSecret: string): Promise<ServiceAuthContext> {
    try {
      // Validate service credentials (in real implementation, this would check against database)
      const isValidService = await this.validateServiceCredentials(serviceName, serviceSecret)
      
      if (!isValidService) {
        throw new Error('Invalid service credentials')
      }

      // Generate service token
      const authToken = this.generateServiceToken(serviceName)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      const serviceAuth: ServiceAuthContext = {
        serviceName,
        permissions: await this.getServicePermissions(serviceName),
        authToken,
        expiresAt
      }

      // Store service auth context
      this.serviceAuthStore.set(authToken, serviceAuth)

      // Publish service authentication event
      await this.eventBus.publish('auth.service.authenticated', {
        serviceName,
        timestamp: new Date().toISOString()
      })

      return serviceAuth
    } catch (error) {
      await this.eventBus.publish('auth.service.failed', {
        serviceName,
        reason: error.message,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  async validateServiceToken(authToken: string): Promise<ServiceAuthContext | null> {
    const serviceAuth = this.serviceAuthStore.get(authToken)
    
    if (!serviceAuth) {
      return null
    }

    // Check if token is expired
    if (Date.now() > serviceAuth.expiresAt.getTime()) {
      this.serviceAuthStore.delete(authToken)
      return null
    }

    return serviceAuth
  }

  // =============================================================================
  // PERMISSIONS AND AUTHORIZATION
  // =============================================================================

  async checkUserPermission(userId: string, permission: string, resourceId?: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId)
      
      if (!user) {
        return false
      }

      // Check direct permissions
      if (user.permissions.includes(permission)) {
        return true
      }

      // Check role-based permissions
      for (const role of user.roles) {
        const rolePermissions = await this.getRolePermissions(role)
        if (rolePermissions.includes(permission)) {
          return true
        }
      }

      // Check resource-specific permissions
      if (resourceId) {
        const resourcePermissions = await this.getUserResourcePermissions(userId, resourceId)
        if (resourcePermissions.includes(permission)) {
          return true
        }
      }

      return false
    } catch (error) {
      console.error('Permission check failed:', error)
      return false
    }
  }

  async checkServicePermission(serviceName: string, permission: string): Promise<boolean> {
    const serviceAuth = Array.from(this.serviceAuthStore.values())
      .find(ctx => ctx.serviceName === serviceName)
    
    if (!serviceAuth) {
      return false
    }

    return serviceAuth.permissions.includes(permission)
  }

  // =============================================================================
  // TOKEN MANAGEMENT
  // =============================================================================

  private async generateUserTokens(user: AuthUser): Promise<AuthToken> {
    const now = Math.floor(Date.now() / 1000)
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      type: 'user',
      iat: now,
      exp: now + this.parseExpiration(this.config.jwtExpiration)
    }

    const accessToken = jwt.sign(jwtPayload, this.config.jwtSecret, {
      issuer: this.config.issuer,
      audience: this.config.audience
    })

    const refreshPayload = {
      sub: user.id,
      type: 'refresh',
      iat: now,
      exp: now + this.parseExpiration(this.config.refreshExpiration)
    }

    const refreshToken = jwt.sign(refreshPayload, this.config.jwtSecret)

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiration(this.config.jwtExpiration),
      tokenType: 'Bearer'
    }
  }

  private generateServiceToken(serviceName: string): string {
    const payload = {
      sub: serviceName,
      type: 'service',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
    }

    return jwt.sign(payload, this.config.jwtSecret, {
      issuer: this.config.issuer,
      audience: this.config.audience
    })
  }

  private parseExpiration(expiration: string): number {
    const units: Record<string, number> = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400
    }

    const match = expiration.match(/^(\d+)([smhd])$/)
    if (!match) {
      throw new Error(`Invalid expiration format: ${expiration}`)
    }

    const [, value, unit] = match
    return parseInt(value) * (units[unit] || 1)
  }

  // =============================================================================
  // USER AND SERVICE LOOKUP
  // =============================================================================

  private async validateUserCredentials(credentials: {
    email: string
    password: string
    tenantId: string
  }): Promise<AuthUser | null> {
    // In a real implementation, this would call the auth service
    // For now, return mock user if credentials are valid
    if (credentials.email === 'admin@example.com' && credentials.password === 'password') {
      return {
        id: 'user_123',
        email: credentials.email,
        tenantId: credentials.tenantId,
        roles: ['admin'],
        permissions: ['read', 'write', 'delete', 'admin']
      }
    }
    return null
  }

  private async getUserById(userId: string): Promise<AuthUser | null> {
    // In a real implementation, this would call the user service
    if (userId === 'user_123') {
      return {
        id: userId,
        email: 'admin@example.com',
        tenantId: 'tenant_456',
        roles: ['admin'],
        permissions: ['read', 'write', 'delete', 'admin']
      }
    }
    return null
  }

  private async validateServiceCredentials(serviceName: string, serviceSecret: string): Promise<boolean> {
    // In a real implementation, this would check against database
    const validServices: Record<string, string> = {
      'auth-service': 'auth-secret',
      'user-service': 'user-secret',
      'notification-service': 'notification-secret',
      'plugin-runtime': 'plugin-secret',
      'analytics-service': 'analytics-service',
      'api-gateway': 'gateway-secret'
    }

    return validServices[serviceName] === serviceSecret
  }

  private async getServicePermissions(serviceName: string): Promise<string[]> {
    // In a real implementation, this would come from database
    const servicePermissions: Record<string, string[]> = {
      'auth-service': ['auth.read', 'auth.write', 'user.create', 'user.read', 'user.update', 'user.delete'],
      'user-service': ['user.read', 'user.write', 'user.update', 'profile.read', 'profile.write'],
      'notification-service': ['notification.read', 'notification.write', 'notification.send'],
      'plugin-runtime': ['plugin.read', 'plugin.write', 'plugin.execute', 'plugin.manage'],
      'analytics-service': ['analytics.read', 'analytics.write', 'reports.read', 'reports.generate'],
      'api-gateway': ['gateway.read', 'gateway.write', 'route.manage', 'policy.manage']
    }

    return servicePermissions[serviceName] || []
  }

  private async getRolePermissions(role: string): Promise<string[]> {
    // In a real implementation, this would come from database
    const rolePermissions: Record<string, string[]> = {
      'admin': ['read', 'write', 'delete', 'admin', 'manage'],
      'user': ['read', 'write'],
      'viewer': ['read']
    }

    return rolePermissions[role] || []
  }

  private async getUserResourcePermissions(userId: string, resourceId: string): Promise<string[]> {
    // In a real implementation, this would check resource-specific permissions
    return []
  }

  // =============================================================================
  // SESSION MANAGEMENT
  // =============================================================================

  private initializeTokenCleanup(): void {
    // Clean up expired tokens every hour
    setInterval(() => {
      this.cleanupExpiredTokens()
    }, 60 * 60 * 1000)
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now()
    
    // Clean user sessions
    for (const [token, user] of this.sessionStore.entries()) {
      try {
        const payload = jwt.verify(token, this.config.jwtSecret) as any
        if (payload.exp * 1000 < now) {
          this.sessionStore.delete(token)
        }
      } catch {
        this.sessionStore.delete(token)
      }
    }

    // Clean service auth contexts
    for (const [token, serviceAuth] of this.serviceAuthStore.entries()) {
      if (serviceAuth.expiresAt.getTime() < now) {
        this.serviceAuthStore.delete(token)
      }
    }
  }

  // =============================================================================
  // PASSWORD MANAGEMENT
  // =============================================================================

  hashPassword(password: string): string {
    return createHash('sha256').update(password + this.config.jwtSecret).digest('hex')
  }

  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    const policy = this.config.passwordPolicy

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`)
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  generatePasswordResetToken(userId: string): string {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Store reset token (in real implementation, this would be in database)
    console.log(`Password reset token generated for user ${userId}: ${token} (expires: ${expiresAt})`)

    return token
  }

  // =============================================================================
  // ADMINISTRATION
  // =============================================================================

  async revokeAllUserSessions(userId: string): Promise<void> {
    const revokedTokens: string[] = []

    for (const [token, user] of this.sessionStore.entries()) {
      if (user.id === userId) {
        revokedTokens.push(token)
        this.sessionStore.delete(token)
      }
    }

    await this.eventBus.publish('auth.user.sessions.revoked', {
      userId,
      revokedTokens,
      timestamp: new Date().toISOString()
    })
  }

  async revokeServiceTokens(serviceName: string): Promise<void> {
    const revokedTokens: string[] = []

    for (const [token, serviceAuth] of this.serviceAuthStore.entries()) {
      if (serviceAuth.serviceName === serviceName) {
        revokedTokens.push(token)
        this.serviceAuthStore.delete(token)
      }
    }

    await this.eventBus.publish('auth.service.tokens.revoked', {
      serviceName,
      revokedTokens,
      timestamp: new Date().toISOString()
    })
  }

  getAuthStats(): {
    activeUserSessions: number
    activeServiceAuths: number
    totalTokensIssued: number
  } {
    return {
      activeUserSessions: this.sessionStore.size,
      activeServiceAuths: this.serviceAuthStore.size,
      totalTokensIssued: this.tokenStore.size + this.sessionStore.size + this.serviceAuthStore.size
    }
  }
}

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

export const createAuthMiddleware = (authManager: UnifiedAuthManager) => {
  return async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' })
      }

      const token = authHeader.substring(7)
      
      // Try user authentication first
      const user = await authManager.validateUserToken(token)
      if (user) {
        req.user = user
        req.authType = 'user'
        return next()
      }

      // Try service authentication
      const serviceAuth = await authManager.validateServiceToken(token)
      if (serviceAuth) {
        req.service = serviceAuth
        req.authType = 'service'
        return next()
      }

      return res.status(401).json({ error: 'Invalid or expired token' })
    } catch (error) {
      console.error('Auth middleware error:', error)
      return res.status(500).json({ error: 'Authentication error' })
    }
  }
}

export const createPermissionMiddleware = (authManager: UnifiedAuthManager, requiredPermission: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      let hasPermission = false

      if (req.authType === 'user' && req.user) {
        hasPermission = await authManager.checkUserPermission(
          req.user.id,
          requiredPermission,
          req.params.resourceId
        )
      } else if (req.authType === 'service' && req.service) {
        hasPermission = await authManager.checkServicePermission(
          req.service.serviceName,
          requiredPermission
        )
      }

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      next()
    } catch (error) {
      console.error('Permission middleware error:', error)
      return res.status(500).json({ error: 'Permission check error' })
    }
  }
}

export default UnifiedAuthManager