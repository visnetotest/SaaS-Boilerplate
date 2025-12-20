// Workflow automation type definitions
export interface WorkflowStep {
  id: string;
  type: 'data-entry' | 'document-gen' | 'decision' | 'integration' | 'approval' | 'notification';
  name: string;
  description?: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
  nextSteps?: string[];
  parallelGroups?: string[];
  conditions?: WorkflowCondition[];
  timeout?: number;
  retryConfig?: RetryConfig;
}

export interface WorkflowCondition {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'not_in';
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
}

export interface RetryConfig {
  maxAttempts: number;
  backoffType: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay?: number;
}

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  category?: string;
  tags?: string[];
  steps: WorkflowStep[];
  variables: WorkflowVariable[];
  settings: WorkflowSettings;
  metadata: WorkflowMetadata;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface WorkflowVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  defaultValue?: unknown;
  required: boolean;
  description?: string;
  validation?: VariableValidation;
}

export interface VariableValidation {
  pattern?: string;
  min?: number;
  max?: number;
  options?: unknown[];
  custom?: string;
}

export interface WorkflowSettings {
  timeout?: number;
  retryPolicy: 'none' | 'steps' | 'entire';
  parallelExecution: boolean;
  requireApproval: boolean;
  notificationSettings: NotificationSettings;
  securitySettings: SecuritySettings;
}

export interface NotificationSettings {
  onStart: boolean;
  onComplete: boolean;
  onError: boolean;
  recipients: string[];
  channels: ('email' | 'sms' | 'webhook' | 'in-app')[];
}

export interface SecuritySettings {
  requireAuthentication: boolean;
  allowedRoles: string[];
  dataEncryption: boolean;
  auditLogging: boolean;
}

export interface WorkflowMetadata {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration?: number;
  tags: string[];
  dependencies: string[];
  integrationRequirements: string[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: number;
  tenantId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  currentStep?: string;
  completedSteps: string[];
  data: Record<string, unknown>;
  variables: Record<string, unknown>;
  context: ExecutionContext;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  error?: ExecutionError;
  metadata: ExecutionMetadata;
}

export interface ExecutionContext {
  userId: string;
  userRole: string;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  requestId: string;
  parentExecutionId?: string;
  rootExecutionId?: string;
}

export interface ExecutionError {
  code: string;
  message: string;
  stepId?: string;
  timestamp: Date;
  stack?: string;
  context?: Record<string, unknown>;
}

export interface ExecutionMetadata {
  attemptNumber: number;
  retryCount: number;
  parallelGroup?: string;
  loopIteration?: number;
  subWorkflowId?: string;
  approvalRequired: boolean;
  approvals: ApprovalRecord[];
}

export interface ApprovalRecord {
  id: string;
  stepId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  comment?: string;
  timestamp: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: {
    requestId: string;
    timestamp: Date;
    version: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface WorkflowMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  executionsByDay: Array<{ date: string; count: number }>;
  topPerformingWorkflows: Array<{
    workflowId: string;
    workflowName: string;
    executionCount: number;
    successRate: number;
  }>;
}

export interface SystemMetrics {
  activeExecutions: number;
  queuedExecutions: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  };
  errorRate: number;
  averageResponseTime: number;
}