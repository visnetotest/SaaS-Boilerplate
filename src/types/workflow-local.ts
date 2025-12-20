// Create a type definition file to resolve import issues
export interface WorkflowStep {
  id: string;
  type: 'data-entry' | 'document-gen' | 'decision' | 'integration' | 'approval' | 'notification';
  name: string;
  description?: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
  nextSteps?: string[];
  parallelGroups?: string[];
  conditions?: any[];
  timeout?: number;
}

export interface Connection {
  id: string;
  fromStepId: string;
  toStepId: string;
  fromPoint: { x: number; y: number };
  toPoint: { x: number; y: number };
  type: 'normal' | 'conditional' | 'error' | 'success';
}

export interface Point {
  x: number;
  y: number;
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