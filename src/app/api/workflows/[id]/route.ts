import { NextRequest, NextResponse } from 'next/server'

// Type definitions to avoid import issues
interface WorkflowStep {
  id: string
  type: 'data-entry' | 'document-gen' | 'decision' | 'integration' | 'approval' | 'notification'
  name: string
  description?: string
  config: Record<string, unknown>
  position?: { x: number; y: number }
  nextSteps?: string[]
  parallelGroups?: string[]
  conditions?: any[]
  timeout?: number
}

interface WorkflowVariable {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array'
  defaultValue?: unknown
  required: boolean
  description?: string
}

interface WorkflowSettings {
  timeout?: number
  retryPolicy: 'none' | 'steps' | 'entire'
  parallelExecution: boolean
  requireApproval: boolean
  notificationSettings: {
    onStart: boolean
    onComplete: boolean
    onError: boolean
    recipients: string[]
    channels: ('email' | 'sms' | 'webhook' | 'in-app')[]
  }
  securitySettings: {
    requireAuthentication: boolean
    allowedRoles: string[]
    dataEncryption: boolean
    auditLogging: boolean
  }
}

interface WorkflowMetadata {
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  estimatedDuration?: number
  tags: string[]
  dependencies: string[]
  integrationRequirements: string[]
}

interface Workflow {
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

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
    timestamp?: Date
  }
  metadata?: {
    requestId: string
    timestamp: Date
    version: string
  }
}

// Mock data for development
const mockWorkflows: Workflow[] = []

/**
 * API handler for getting individual workflow
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id

    // Find workflow in mock data
    const workflow = mockWorkflows.find((w) => w.id === workflowId)

    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Workflow not found',
          },
        },
        { status: 404 }
      )
    }

    const response: ApiResponse<Workflow> = {
      success: true,
      data: workflow,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching workflow:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch workflow',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * API handler for updating workflow
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id
    const body = await request.json()

    // Find workflow in mock data
    const workflowIndex = mockWorkflows.findIndex((w) => w.id === workflowId)

    if (workflowIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Workflow not found',
          },
        },
        { status: 404 }
      )
    }

    // Update workflow
    const updatedWorkflow = {
      ...mockWorkflows[workflowIndex],
      ...body,
      id: workflowId, // Ensure ID doesn't change
      updatedAt: new Date(),
    }

    mockWorkflows[workflowIndex] = updatedWorkflow

    const response: ApiResponse<Workflow> = {
      success: true,
      data: updatedWorkflow,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error updating workflow:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update workflow',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * API handler for deleting workflow
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id

    // Find workflow in mock data
    const workflowIndex = mockWorkflows.findIndex((w) => w.id === workflowId)

    if (workflowIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Workflow not found',
          },
        },
        { status: 404 }
      )
    }

    // Remove workflow
    mockWorkflows.splice(workflowIndex, 1)

    const response: ApiResponse = {
      success: true,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error deleting workflow:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete workflow',
        },
      },
      { status: 500 }
    )
  }
}
