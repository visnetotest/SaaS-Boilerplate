import { NextRequest, NextResponse } from 'next/server'

// Type definitions to avoid import issues
interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  steps: any[]
  variables: any[]
  settings: {
    timeout?: number
    retryPolicy: 'none' | 'steps' | 'entire'
    parallelExecution: boolean
    requireApproval: boolean
  }
  metadata: {
    category: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    tags: string[]
    integrationRequirements: string[]
  }
  isPublic: boolean
  usageCount: number
  rating: number
  createdAt: Date
  updatedAt: Date
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
const mockTemplates: WorkflowTemplate[] = [
  {
    id: 'template-1',
    name: 'Employee Onboarding',
    description:
      'Complete employee onboarding workflow with IT provisioning, HR paperwork, and team introduction',
    category: 'HR',
    steps: [
      {
        type: 'data-entry',
        name: 'Collect Employee Information',
        config: {
          fields: [
            { name: 'firstName', type: 'text', required: true, label: 'First Name' },
            { name: 'lastName', type: 'text', required: true, label: 'Last Name' },
            { name: 'email', type: 'email', required: true, label: 'Work Email' },
            {
              name: 'department',
              type: 'select',
              required: true,
              options: ['Engineering', 'Sales', 'Marketing', 'HR', 'Operations'],
            },
          ],
        },
      },
      {
        type: 'integration',
        name: 'Create User Accounts',
        config: {
          integration: 'active-directory',
          action: 'create-user',
          fields: ['firstName', 'lastName', 'email', 'department'],
        },
      },
      {
        type: 'notification',
        name: 'Send Welcome Email',
        config: {
          recipients: ['{{email}}'],
          subject: 'Welcome to {{company}}!',
          template: 'welcome-email',
        },
      },
    ],
    variables: [
      { name: 'firstName', type: 'string', required: true },
      { name: 'lastName', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'department', type: 'string', required: true },
    ],
    settings: {
      timeout: 1800,
      retryPolicy: 'steps',
      parallelExecution: false,
      requireApproval: false,
    },
    metadata: {
      category: 'HR',
      priority: 'high',
      tags: ['onboarding', 'hr', 'new-hire'],
      integrationRequirements: ['active-directory', 'email-service'],
    },
    isPublic: true,
    usageCount: 1250,
    rating: 4.7,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-06-20'),
  },
  {
    id: 'template-2',
    name: 'Invoice Processing',
    description:
      'Automated invoice processing workflow with validation, approval, and payment integration',
    category: 'Finance',
    steps: [
      {
        type: 'data-entry',
        name: 'Extract Invoice Data',
        config: {
          fields: [
            { name: 'invoiceNumber', type: 'text', required: true },
            { name: 'amount', type: 'number', required: true },
            { name: 'vendor', type: 'text', required: true },
            { name: 'dueDate', type: 'date', required: true },
          ],
        },
      },
      {
        type: 'decision',
        name: 'Validate Amount',
        config: {
          conditions: [
            { field: 'amount', operator: 'lte', value: 10000 },
            { field: 'vendor', operator: 'in', value: ['Approved Vendors'] },
          ],
        },
      },
      {
        type: 'approval',
        name: 'Manager Approval',
        config: {
          approvers: ['manager', 'finance-team'],
          requireAll: false,
        },
      },
      {
        type: 'integration',
        name: 'Process Payment',
        config: {
          integration: 'payment-gateway',
          action: 'charge-card',
          fields: ['amount', 'invoiceNumber'],
        },
      },
    ],
    variables: [
      { name: 'invoiceNumber', type: 'string', required: true },
      { name: 'amount', type: 'number', required: true },
      { name: 'vendor', type: 'string', required: true },
      { name: 'dueDate', type: 'date', required: true },
    ],
    settings: {
      timeout: 3600,
      retryPolicy: 'steps',
      parallelExecution: false,
      requireApproval: true,
    },
    metadata: {
      category: 'Finance',
      priority: 'high',
      tags: ['invoice', 'payment', 'approval'],
      integrationRequirements: ['payment-gateway', 'email-service'],
    },
    isPublic: true,
    usageCount: 890,
    rating: 4.3,
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-05-15'),
  },
]

/**
 * API handler for getting workflow templates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    let filteredTemplates = mockTemplates

    if (category) {
      filteredTemplates = filteredTemplates.filter(
        (t) => t.category.toLowerCase() === category.toLowerCase()
      )
    }

    if (search) {
      filteredTemplates = filteredTemplates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
      )
    }

    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const templates = filteredTemplates.slice(startIndex, endIndex)

    const response: ApiResponse<WorkflowTemplate[]> = {
      success: true,
      data: templates,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch templates',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * API handler for creating workflow from template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateId, customizations } = body

    // Validate required fields
    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Template ID is required',
          },
        },
        { status: 400 }
      )
    }

    // Find template
    const template = mockTemplates.find((t) => t.id === templateId)
    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Template not found',
          },
        },
        { status: 404 }
      )
    }

    // Create workflow from template
    const workflow = {
      id: crypto.randomUUID(),
      name: customizations?.name || template.name,
      description: customizations?.description || template.description,
      category: template.category,
      steps: customizations?.steps || template.steps,
      variables: customizations?.variables || template.variables,
      settings: {
        ...template.settings,
        ...customizations?.settings,
      },
      metadata: template.metadata,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const response: ApiResponse = {
      success: true,
      data: workflow,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    // Increment template usage count
    template.usageCount++
    template.updatedAt = new Date()

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating workflow from template:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create workflow from template',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}
