import { z } from 'zod'

// =============================================================================
// ADMIN PANEL CORE INTERFACES
// =============================================================================

export interface UserManagementService {
  createUser(data: CreateUserData): Promise<User>
  updateUser(userId: string, data: UpdateUserData): Promise<User>
  deleteUser(userId: string): Promise<void>
  getUser(userId: string): Promise<User | null>
  listUsers(filters: UserListFilters): Promise<PaginatedResponse<User>>
  suspendUser(userId: string): Promise<User>
  activateUser(userId: string): Promise<User>
  bulkUpdateUsers(userIds: string[], updates: BulkUserUpdate): Promise<BulkOperationResult>
  exportUsers(filters: UserExportFilters): Promise<UserExportResult>
  importUsers(file: File): Promise<UserImportResult>
}

export interface TenantManagementService {
  createTenant(data: CreateTenantData): Promise<Tenant>
  updateTenant(tenantId: string, data: UpdateTenantData): Promise<Tenant>
  deleteTenant(tenantId: string): Promise<void>
  getTenant(tenantId: string): Promise<Tenant | null>
  listTenants(filters: TenantListFilters): Promise<PaginatedResponse<Tenant>>
  suspendTenant(tenantId: string): Promise<Tenant>
  activateTenant(tenantId: string): Promise<Tenant>
  upgradeTenantPlan(tenantId: string, plan: TenantPlan): Promise<Tenant>
  getTenantUsage(tenantId: string, period: UsagePeriod): Promise<TenantUsage>
  getTenantMetrics(tenantId: string): Promise<TenantMetrics>
}

export interface RBACService {
  createRole(data: CreateRoleData): Promise<Role>
  updateRole(roleId: string, data: UpdateRoleData): Promise<Role>
  deleteRole(roleId: string): Promise<void>
  assignRole(userId: string, roleId: string): Promise<void>
  removeRole(userId: string, roleId: string): Promise<void>
  getUserRoles(userId: string): Promise<Role[]>
  checkPermission(userId: string, permission: string): Promise<boolean>
  createPermission(data: CreatePermissionData): Promise<Permission>
  updatePermission(permissionId: string, data: UpdatePermissionData): Promise<Permission>
  deletePermission(permissionId: string): Promise<void>
  listPermissions(filters: PermissionListFilters): Promise<PaginatedResponse<Permission>>
}

export interface AuditService {
  logAuditEvent(event: AuditEvent): Promise<void>
  getAuditLogs(filters: AuditLogFilters): Promise<PaginatedResponse<AuditLog>>
  getAuditSummary(tenantId: string, period: DateRange): Promise<AuditSummary>
  exportAuditLogs(filters: AuditLogFilters): Promise<AuditExportResult>
}

// =============================================================================
// DATA TRANSFER OBJECTS
// =============================================================================

export interface CreateUserData {
  tenantId: string
  organizationId?: string
  email: string
  firstName: string
  lastName: string
  roleIds?: string[]
  profile?: UserProfile
  preferences?: UserPreferences
  metadata?: Record<string, any>
}

export interface UpdateUserData {
  email?: string
  firstName?: string
  lastName?: string
  profile?: Partial<UserProfile>
  preferences?: Partial<UserPreferences>
  metadata?: Record<string, any>
  status?: UserStatus
}

export interface UserListFilters {
  tenantId?: string
  organizationId?: string
  status?: UserStatus[]
  roleIds?: string[]
  search?: string
  createdAfter?: Date
  createdBefore?: Date
  lastActiveAfter?: Date
  emailVerified?: boolean
}

export interface BulkUserUpdate {
  status?: UserStatus
  roleIds?: string[]
  organizationId?: string
  metadata?: Record<string, any>
}

export interface UserExportFilters {
  tenantId?: string
  organizationId?: string
  status?: UserStatus[]
  format?: 'csv' | 'xlsx' | 'json'
  fields?: string[]
}

export interface CreateTenantData {
  name: string
  slug: string
  domain?: string
  plan: TenantPlan
  settings?: TenantSettings
  metadata?: Record<string, any>
  billing?: TenantBillingInfo
}

export interface UpdateTenantData {
  name?: string
  domain?: string
  settings?: Partial<TenantSettings>
  metadata?: Record<string, any>
  status?: TenantStatus
}

export interface TenantListFilters {
  status?: TenantStatus[]
  plan?: TenantPlan[]
  search?: string
  createdAfter?: Date
  createdBefore?: Date
  hasActiveUsers?: boolean
  minUserCount?: number
  maxUserCount?: number
}

export interface CreateRoleData {
  tenantId: string
  name: string
  description?: string
  permissions: string[]
  isSystem?: boolean
  metadata?: Record<string, any>
}

export interface UpdateRoleData {
  name?: string
  description?: string
  permissions?: string[]
  metadata?: Record<string, any>
}

export interface CreatePermissionData {
  name: string
  description?: string
  resource: string
  action: string
  category?: string
  metadata?: Record<string, any>
}

export interface UpdatePermissionData {
  name?: string
  description?: string
  category?: string
  metadata?: Record<string, any>
}

export interface PermissionListFilters {
  resource?: string
  action?: string
  category?: string
  search?: string
}

export interface AuditEvent {
  tenantId?: string
  userId?: string
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, any>
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  metadata?: Record<string, any>
}

export interface AuditLogFilters {
  tenantId?: string
  userId?: string
  action?: string[]
  resourceType?: string[]
  createdAfter?: Date
  createdBefore?: Date
  ipAddress?: string
  sessionId?: string
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
  filters?: any
}

export interface BulkOperationResult {
  success: number
  failed: number
  errors: Array<{
    id: string
    error: string
  }>
}

export interface UserExportResult {
  downloadUrl: string
  filename: string
  mimeType: string
  recordCount: number
  expiresAt: Date
}

export interface UserImportResult {
  success: number
  failed: number
  errors: Array<{
    row: number
    error: string
    data?: any
  }>
  duplicates: Array<{
    row: number
    data: any
  }>
}

export interface AuditExportResult {
  downloadUrl: string
  filename: string
  mimeType: string
  recordCount: number
  expiresAt: Date
}

// =============================================================================
// ENTITY TYPES
// =============================================================================

export interface User {
  id: string
  tenantId: string
  organizationId?: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
  status: UserStatus
  emailVerified: boolean
  profile: UserProfile
  preferences: UserPreferences
  metadata: Record<string, any>
  roles: Role[]
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

export interface UserProfile {
  avatarUrl?: string
  bio?: string
  timezone: string
  language: string
  phone?: string
  address?: UserAddress
  socialLinks?: Record<string, string>
}

export interface UserAddress {
  street?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  notifications: NotificationPreferences
  privacy: PrivacyPreferences
}

export interface NotificationPreferences {
  email: boolean
  push: boolean
  sms: boolean
  marketing: boolean
  security: boolean
  product: boolean
}

export interface PrivacyPreferences {
  profileVisibility: 'public' | 'private' | 'team'
  showEmail: boolean
  showPhone: boolean
  allowDirectMessages: boolean
}

export interface Tenant {
  id: string
  name: string
  slug: string
  domain?: string
  status: TenantStatus
  plan: TenantPlan
  settings: TenantSettings
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface TenantSettings {
  theme: 'light' | 'dark' | 'auto'
  timezone: string
  language: string
  branding: TenantBranding
  security: TenantSecuritySettings
  integrations: TenantIntegrations
  limits: TenantLimits
}

export interface TenantBranding {
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  customCSS?: string
  faviconUrl?: string
}

export interface TenantSecuritySettings {
  require2FA: boolean
  passwordPolicy: PasswordPolicy
  sessionTimeout: number
  allowedIPs?: string[]
  blockedIPs?: string[]
}

export interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
  maxAge: number
}

export interface TenantIntegrations {
  slack?: SlackIntegration
  github?: GitHubIntegration
  google?: GoogleIntegration
  microsoft?: MicrosoftIntegration
  custom: Record<string, any>
}

export interface SlackIntegration {
  enabled: boolean
  webhookUrl?: string
  botToken?: string
  channelId?: string
}

export interface GitHubIntegration {
  enabled: boolean
  clientId?: string
  clientSecret?: string
  organization?: string
}

export interface GoogleIntegration {
  enabled: boolean
  clientId?: string
  clientSecret?: string
  domain?: string
}

export interface MicrosoftIntegration {
  enabled: boolean
  clientId?: string
  clientSecret?: string
  tenantId?: string
}

export interface TenantLimits {
  maxUsers: number
  maxOrganizations: number
  maxStorageGB: number
  maxApiCallsPerMinute: number
  features: string[]
}

export interface TenantBillingInfo {
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  billingEmail?: string
  taxId?: string
  address?: BillingAddress
}

export interface BillingAddress {
  street?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

export interface Role {
  id: string
  tenantId: string
  name: string
  description?: string
  permissions: Permission[]
  isSystem: boolean
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface Permission {
  id: string
  name: string
  description?: string
  resource: string
  action: string
  category: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface AuditLog {
  id: string
  tenantId?: string
  userId?: string
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, any>
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface TenantUsage {
  tenantId: string
  period: UsagePeriod
  users: UserUsageMetrics
  storage: StorageUsageMetrics
  apiCalls: ApiUsageMetrics
  bandwidth: BandwidthUsageMetrics
  features: FeatureUsageMetrics
}

export interface UserUsageMetrics {
  total: number
  active: number
  new: number
  churned: number
  averageSessionDuration: number
  topActiveUsers: Array<{
    userId: string
    email: string
    sessionCount: number
    duration: number
  }>
}

export interface StorageUsageMetrics {
  totalGB: number
  usedGB: number
  availableGB: number
  breakdown: Record<string, number>
}

export interface ApiUsageMetrics {
  total: number
  successful: number
  failed: number
  averageResponseTime: number
  topEndpoints: Array<{
    endpoint: string
    count: number
    avgResponseTime: number
  }>
}

export interface BandwidthUsageMetrics {
  totalGB: number
  uploadGB: number
  downloadGB: number
  peakUsage: Array<{
    timestamp: Date
    usageMbps: number
  }>
}

export interface FeatureUsageMetrics {
  features: Record<
    string,
    {
      usage: number
      limit?: number
      users: number
    }
  >
}

export interface TenantMetrics {
  tenantId: string
  health: TenantHealth
  performance: TenantPerformance
  security: TenantSecurity
  compliance: TenantCompliance
}

export interface TenantHealth {
  status: 'healthy' | 'warning' | 'critical'
  database: DatabaseHealth
  api: ApiHealth
  services: ServiceHealth[]
  lastCheck: Date
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'down'
  responseTime: number
  connectionCount: number
  errorRate: number
}

export interface ApiHealth {
  status: 'healthy' | 'degraded' | 'down'
  responseTime: number
  errorRate: number
  requestsPerMinute: number
}

export interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  responseTime?: number
  lastCheck: Date
  error?: string
}

export interface TenantPerformance {
  responseTime: number
  throughput: number
  errorRate: number
  uptime: number
  peakLoad: {
    timestamp: Date
    requestsPerMinute: number
  }
}

export interface TenantSecurity {
  lastSecurityScan: Date
  vulnerabilities: SecurityVulnerability[]
  failedLogins: FailedLoginAttempt[]
  suspiciousActivity: SuspiciousActivity[]
}

export interface SecurityVulnerability {
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  component: string
  discoveredAt: Date
  fixedAt?: Date
}

export interface FailedLoginAttempt {
  timestamp: Date
  ipAddress: string
  userAgent?: string
  userId?: string
  reason: string
}

export interface SuspiciousActivity {
  timestamp: Date
  userId?: string
  ipAddress: string
  activity: string
  risk: 'low' | 'medium' | 'high'
  description: string
}

export interface TenantCompliance {
  gdpr: ComplianceStatus
  soc2: ComplianceStatus
  hipaa: ComplianceStatus
  pci: ComplianceStatus
  lastAudit: Date
  nextAudit: Date
}

export interface ComplianceStatus {
  status: 'compliant' | 'non-compliant' | 'pending' | 'not-applicable'
  score?: number
  issues: ComplianceIssue[]
  lastChecked: Date
}

export interface ComplianceIssue {
  category: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  remediation: string
  dueDate?: Date
}

export interface AuditSummary {
  totalEvents: number
  eventsByAction: Record<string, number>
  eventsByResource: Record<string, number>
  eventsByUser: Array<{
    userId: string
    email: string
    eventCount: number
  }>
  topUsers: Array<{
    userId: string
    email: string
    eventCount: number
  }>
  timeRange: DateRange
}

export interface DateRange {
  start: Date
  end: Date
}

// =============================================================================
// ENUMS
// =============================================================================

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  DELETED = 'deleted',
}

export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  DELETED = 'deleted',
}

export enum TenantPlan {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom',
}

export enum UsagePeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const CreateUserDataSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roleIds: z.array(z.string().uuid()).optional(),
  profile: z
    .object({
      avatarUrl: z.string().url().optional(),
      bio: z.string().max(500).optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      phone: z.string().optional(),
      address: z
        .object({
          street: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          country: z.string().optional(),
          postalCode: z.string().optional(),
        })
        .optional(),
      socialLinks: z.record(z.string().url()).optional(),
    })
    .optional(),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'auto']).optional(),
      language: z.string().optional(),
      timezone: z.string().optional(),
      notifications: z
        .object({
          email: z.boolean().optional(),
          push: z.boolean().optional(),
          sms: z.boolean().optional(),
          marketing: z.boolean().optional(),
          security: z.boolean().optional(),
          product: z.boolean().optional(),
        })
        .optional(),
      privacy: z
        .object({
          profileVisibility: z.enum(['public', 'private', 'team']).optional(),
          showEmail: z.boolean().optional(),
          showPhone: z.boolean().optional(),
          allowDirectMessages: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
})

export const UpdateUserDataSchema = CreateUserDataSchema.partial()

export const CreateTenantDataSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  domain: z.string().url().optional(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise', 'custom']),
  settings: z
    .object({
      theme: z.enum(['light', 'dark', 'auto']).optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      branding: z
        .object({
          logoUrl: z.string().url().optional(),
          primaryColor: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/i)
            .optional(),
          secondaryColor: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/i)
            .optional(),
          customCSS: z.string().optional(),
          faviconUrl: z.string().url().optional(),
        })
        .optional(),
      security: z
        .object({
          require2FA: z.boolean().optional(),
          passwordPolicy: z
            .object({
              minLength: z.number().min(6).max(128).optional(),
              requireUppercase: z.boolean().optional(),
              requireLowercase: z.boolean().optional(),
              requireNumbers: z.boolean().optional(),
              requireSpecialChars: z.boolean().optional(),
              maxAge: z.number().min(30).max(365).optional(),
            })
            .optional(),
          sessionTimeout: z.number().min(300).max(86400).optional(),
          allowedIPs: z.array(z.string()).optional(),
          blockedIPs: z.array(z.string()).optional(),
        })
        .optional(),
      integrations: z
        .object({
          slack: z
            .object({
              enabled: z.boolean().optional(),
              webhookUrl: z.string().url().optional(),
              botToken: z.string().optional(),
              channelId: z.string().optional(),
            })
            .optional(),
          github: z
            .object({
              enabled: z.boolean().optional(),
              clientId: z.string().optional(),
              clientSecret: z.string().optional(),
              organization: z.string().optional(),
            })
            .optional(),
          google: z
            .object({
              enabled: z.boolean().optional(),
              clientId: z.string().optional(),
              clientSecret: z.string().optional(),
              domain: z.string().optional(),
            })
            .optional(),
          microsoft: z
            .object({
              enabled: z.boolean().optional(),
              clientId: z.string().optional(),
              clientSecret: z.string().optional(),
              tenantId: z.string().optional(),
            })
            .optional(),
          custom: z.record(z.any()).optional(),
        })
        .optional(),
      limits: z
        .object({
          maxUsers: z.number().min(1).optional(),
          maxOrganizations: z.number().min(1).optional(),
          maxStorageGB: z.number().min(1).optional(),
          maxApiCallsPerMinute: z.number().min(1).optional(),
          features: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
  billing: z
    .object({
      stripeCustomerId: z.string().optional(),
      stripeSubscriptionId: z.string().optional(),
      billingEmail: z.string().email().optional(),
      taxId: z.string().optional(),
      address: z
        .object({
          street: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          country: z.string().optional(),
          postalCode: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
})

export const UpdateTenantDataSchema = CreateTenantDataSchema.partial()

export const CreateRoleDataSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()),
  isSystem: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
})

export const UpdateRoleDataSchema = CreateRoleDataSchema.partial()

export const CreatePermissionDataSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  resource: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
  category: z.string().min(1).max(50).optional(),
  metadata: z.record(z.any()).optional(),
})

export const UpdatePermissionDataSchema = CreatePermissionDataSchema.partial()

export const UserListFiltersSchema = z.object({
  tenantId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.array(z.enum(['active', 'inactive', 'suspended', 'pending', 'deleted'])).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  search: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  lastActiveAfter: z.date().optional(),
  emailVerified: z.boolean().optional(),
})

export const TenantListFiltersSchema = z.object({
  status: z.array(z.enum(['active', 'inactive', 'suspended', 'pending', 'deleted'])).optional(),
  plan: z.array(z.enum(['free', 'starter', 'pro', 'enterprise', 'custom'])).optional(),
  search: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  hasActiveUsers: z.boolean().optional(),
  minUserCount: z.number().min(0).optional(),
  maxUserCount: z.number().min(0).optional(),
})

export const AuditLogFiltersSchema = z.object({
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.array(z.string()).optional(),
  resourceType: z.array(z.string()).optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  ipAddress: z.string().optional(),
  sessionId: z.string().optional(),
})

// =============================================================================
// ERROR TYPES
// =============================================================================

export class AdminPanelError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: any

  constructor(message: string, code: string, statusCode: number = 500, details?: any) {
    super(message)
    this.name = 'AdminPanelError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }

  static userNotFound(userId: string): AdminPanelError {
    return new AdminPanelError(`User with ID ${userId} not found`, 'USER_NOT_FOUND', 404)
  }

  static tenantNotFound(tenantId: string): AdminPanelError {
    return new AdminPanelError(`Tenant with ID ${tenantId} not found`, 'TENANT_NOT_FOUND', 404)
  }

  static insufficientPermissions(permission: string): AdminPanelError {
    return new AdminPanelError(
      `Insufficient permissions. Required: ${permission}`,
      'INSUFFICIENT_PERMISSIONS',
      403
    )
  }

  static validationError(message: string, details?: any): AdminPanelError {
    return new AdminPanelError(message, 'VALIDATION_ERROR', 400, details)
  }

  static duplicateResource(resource: string, identifier: string): AdminPanelError {
    return new AdminPanelError(
      `${resource} with ${identifier} already exists`,
      'DUPLICATE_RESOURCE',
      409
    )
  }

  static operationFailed(operation: string, reason: string): AdminPanelError {
    return new AdminPanelError(`Failed to ${operation}: ${reason}`, 'OPERATION_FAILED', 500)
  }
}
