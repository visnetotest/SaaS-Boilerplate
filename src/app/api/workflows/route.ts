import { NextRequest, NextResponse } from 'next/server'

import { ApiResponse, Workflow, WorkflowExecution } from '@/features/workflow-automation/types'

// Mock data for development
const mockWorkflows: Workflow[] = []

/**
 * API handler for creating workflows
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const workflowData: Partial<Workflow> = body

    // Validate required fields
    if (!workflowData.name) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Workflow name is required',
          },
        },
        { status: 400 }
      )
    }

    // Create workflow
    const workflow: Workflow = {
      id: crypto.randomUUID(),
      tenantId: workflowData.tenantId || 'default-tenant',
      name: workflowData.name!,
      description: workflowData.description || '',
      version: 1,
      isActive: false,
      category: workflowData.category || 'general',
      tags: workflowData.tags || [],
      steps: workflowData.steps || [],
      variables: workflowData.variables || [],
      settings: {
        timeout: 300,
        retryPolicy: 'steps',
        parallelExecution: false,
        requireApproval: false,
        notificationSettings: {
          onStart: true,
          onComplete: true,
          onError: true,
          recipients: [],
          channels: ['in-app'],
        },
        securitySettings: {
          requireAuthentication: true,
          allowedRoles: [],
          dataEncryption: true,
          auditLogging: true,
        },
      },
      metadata: {
        category: workflowData.category || 'general',
        priority: 'medium',
        tags: workflowData.tags || [],
        dependencies: [],
        integrationRequirements: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: workflowData.createdBy || 'user-id',
      updatedBy: workflowData.updatedBy || 'user-id',
    }

    mockWorkflows.push(workflow)

    const response: ApiResponse<Workflow> = {
      success: true,
      data: workflow,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating workflow:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create workflow',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * API handler for getting workflows
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const workflows = mockWorkflows.slice(startIndex, endIndex)

    const response: ApiResponse<Workflow[]> = {
      success: true,
      data: workflows,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching workflows:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch workflows',
        },
      },
      { status: 500 }
    )
  }
}
