import { NextRequest, NextResponse } from 'next/server'

import { ApiResponse, WorkflowExecution } from '@/features/workflow-automation/types'

// Mock data for development
const mockExecutions: WorkflowExecution[] = []

/**
 * API handler for creating workflow executions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workflowId, initialData } = body

    // Validate required fields
    if (!workflowId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Workflow ID is required',
          },
        },
        { status: 400 }
      )
    }

    // Create execution
    const execution: WorkflowExecution = {
      id: crypto.randomUUID(),
      workflowId,
      workflowVersion: 1,
      tenantId: 'default-tenant',
      status: 'pending',
      currentStep: undefined,
      completedSteps: [],
      data: initialData || {},
      variables: {},
      context: {
        userId: 'user-id',
        userRole: 'admin',
        ipAddress: '127.0.0.1',
        userAgent: request.headers.get('user-agent') || 'unknown',
        sessionId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
      },
      startTime: new Date(),
      metadata: {
        attemptNumber: 1,
        retryCount: 0,
        approvals: [],
        approvalRequired: false,
      },
    }

    mockExecutions.push(execution)

    const response: ApiResponse<WorkflowExecution> = {
      success: true,
      data: execution,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating execution:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create execution',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * API handler for getting workflow executions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    let filteredExecutions = mockExecutions

    if (workflowId) {
      filteredExecutions = filteredExecutions.filter((e) => e.workflowId === workflowId)
    }

    if (status) {
      filteredExecutions = filteredExecutions.filter((e) => e.status === status)
    }

    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const executions = filteredExecutions.slice(startIndex, endIndex)

    const response: ApiResponse<WorkflowExecution[]> = {
      success: true,
      data: executions,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching executions:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch executions',
        },
      },
      { status: 500 }
    )
  }
}
