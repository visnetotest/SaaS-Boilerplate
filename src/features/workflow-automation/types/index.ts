/**
 * Core Types for Workflow Automation System
 * Based on technical requirements specification
 */

export interface WorkflowStep {
  id: string
  type: 'data-entry' | 'document-gen' | 'decision' | 'integration' | 'approval' | 'notification'
  name: string
  description?: string
  config: Record<string, unknown>
  position?: { x: number; y: number }
  nextSteps?: string[]
  parallelGroups?: string[]
  conditions?: WorkflowCondition[]
  timeout?: number // in seconds
  retryConfig?: RetryConfig
}

export interface WorkflowCondition {
  id: string
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'not_in'
  value: unknown
  logicalOperator?: 'AND' | 'OR'
}

export interface RetryConfig {
  maxAttempts: number
  backoffType: 'fixed' | 'exponential' | 'linear'
  initialDelay: number // in seconds
  maxDelay?: number // in seconds
}

export interface Workflow {
  id: string
  tenantId: string
  name: string
  description?: string
  version: number
  isActive: boolean
  category?: string
  tags?: string[]
  steps: WorkflowStep[]
  variables: WorkflowVariable[]
  settings: WorkflowSettings
  metadata: WorkflowMetadata
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
}

export interface WorkflowVariable {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array'
  defaultValue?: unknown
  required: boolean
  description?: string
  validation?: VariableValidation
}

export interface VariableValidation {
  pattern?: string // regex pattern
  min?: number
  max?: number
  options?: unknown[]
  custom?: string // custom validation function
}

export interface WorkflowSettings {
  timeout?: number // overall workflow timeout in seconds
  retryPolicy: 'none' | 'steps' | 'entire'
  parallelExecution: boolean
  requireApproval: boolean
  notificationSettings: NotificationSettings
  securitySettings: SecuritySettings
}

export interface NotificationSettings {
  onStart: boolean
  onComplete: boolean
  onError: boolean
  recipients: string[]
  channels: ('email' | 'sms' | 'webhook' | 'in-app')[]
}

export interface SecuritySettings {
  requireAuthentication: boolean
  allowedRoles: string[]
  dataEncryption: boolean
  auditLogging: boolean
}

export interface WorkflowMetadata {
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  estimatedDuration?: number // in minutes
  tags: string[]
  dependencies: string[] // workflow IDs
  integrationRequirements: string[]
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  workflowVersion: number
  tenantId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
  currentStep?: string
  completedSteps: string[]
  data: Record<string, unknown>
  variables: Record<string, unknown>
  context: ExecutionContext
  startTime: Date
  endTime?: Date
  duration?: number // in seconds
  error?: ExecutionError
  metadata: ExecutionMetadata
}

export interface ExecutionContext {
  userId: string
  userRole: string
  ipAddress: string
  userAgent: string
  sessionId: string
  requestId: string
  parentExecutionId?: string
  rootExecutionId?: string
}

export interface ExecutionError {
  code: string
  message: string
  stepId?: string
  timestamp: Date
  stack?: string
  context?: Record<string, unknown>
}

export interface ExecutionMetadata {
  attemptNumber: number
  retryCount: number
  parallelGroup?: string
  loopIteration?: number
  subWorkflowId?: string
  approvalRequired: boolean
  approvals: ApprovalRecord[]
}

export interface ApprovalRecord {
  id: string
  stepId: string
  userId: string
  status: 'pending' | 'approved' | 'rejected'
  comment?: string
  timestamp: Date
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  steps: Omit<WorkflowStep, 'id'>[]
  variables: Omit<WorkflowVariable, 'id'>[]
  settings: WorkflowSettings
  metadata: Omit<WorkflowMetadata, 'dependencies'>
  isPublic: boolean
  usageCount: number
  rating: number
  createdAt: Date
  updatedAt: Date
}

// Integration Types
export interface Integration {
  id: string
  name: string
  type: 'rest-api' | 'webhook' | 'database' | 'file-storage' | 'email' | 'calendar'
  provider: string // e.g., 'google', 'microsoft', 'slack', etc.
  config: IntegrationConfig
  credentials: IntegrationCredentials
  isActive: boolean
  lastTested?: Date
  testStatus?: 'success' | 'failed' | 'pending'
}

export interface IntegrationConfig {
  baseUrl?: string
  endpoints: Record<string, string>
  headers?: Record<string, string>
  timeout: number
  retryConfig: RetryConfig
  rateLimit?: RateLimitConfig
}

export interface RateLimitConfig {
  requestsPerSecond: number
  requestsPerMinute: number
  requestsPerHour: number
  burstLimit: number
}

export interface IntegrationCredentials {
  type: 'api-key' | 'oauth2' | 'basic' | 'bearer'
  credentials: Record<string, string> // encrypted
  expiresAt?: Date
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  metadata?: {
    requestId: string
    timestamp: Date
    version: string
  }
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp: Date
}

// Pagination Types
export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Dashboard and Analytics Types
export interface WorkflowMetrics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  executionsByStatus: Record<string, number>
  executionsByDay: Array<{ date: string; count: number }>
  topPerformingWorkflows: Array<{
    workflowId: string
    workflowName: string
    executionCount: number
    successRate: number
  }>
}

export interface SystemMetrics {
  activeExecutions: number
  queuedExecutions: number
  resourceUsage: {
    cpu: number
    memory: number
    storage: number
  }
  errorRate: number
  averageResponseTime: number
}

// RBAC and Tenant Types
export interface Tenant {
  id: string
  name: string
  domain: string
  parentId?: string
  settings: TenantSettings
  subscription: TenantSubscription
  createdAt: Date
  updatedAt: Date
}

export interface TenantSettings {
  maxWorkflows: number
  maxExecutionsPerMonth: number
  allowedIntegrations: string[]
  securityPolicies: SecurityPolicy[]
  branding?: BrandingSettings
}

export interface SecurityPolicy {
  id: string
  name: string
  rules: SecurityRule[]
  isActive: boolean
}

export interface SecurityRule {
  type: 'data-encryption' | 'audit-logging' | 'access-control' | 'retention'
  config: Record<string, unknown>
}

export interface BrandingSettings {
  logo: string
  primaryColor: string
  secondaryColor: string
  customCSS?: string
}

export interface TenantSubscription {
  plan: 'free' | 'starter' | 'professional' | 'enterprise'
  status: 'active' | 'inactive' | 'suspended' | 'cancelled'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  limits: SubscriptionLimits
}

export interface SubscriptionLimits {
  workflows: number
  executionsPerMonth: number
  storage: number // in MB
  users: number
  integrations: number
  apiCalls: number
}
