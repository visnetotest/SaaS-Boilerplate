import { NextRequest, NextResponse } from 'next/server'

// Type definitions to avoid import issues
interface WorkflowIntegration {
  id: string
  name: string
  type: 'rest-api' | 'webhook' | 'database' | 'file-storage' | 'email' | 'calendar'
  provider: string
  config: Record<string, unknown>
  credentials: Record<string, string>
  isActive: boolean
  lastTested?: Date
  testStatus?: 'success' | 'failed' | 'pending'
  rateLimit?: {
    requestsPerSecond: number
    requestsPerMinute: number
    requestsPerHour: number
    burstLimit: number
  }
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
const mockIntegrations: WorkflowIntegration[] = [
  {
    id: 'integration-1',
    name: 'Google Workspace',
    type: 'rest-api',
    provider: 'google',
    config: {
      baseUrl: 'https://workspace.googleapis.com',
      endpoints: {
        drive: '/drive/v3/files',
        sheets: '/v4/spreadsheets',
        gmail: '/gmail/v1/messages',
      },
      scopes: ['drive.readonly', 'spreadsheets.readonly', 'gmail.send'],
      timeout: 30000,
    },
    credentials: {
      oauth2: 'google-oauth-credentials',
      clientId: 'google-client-id',
      clientSecret: '***encrypted***',
    },
    isActive: true,
    lastTested: new Date('2024-06-15T10:30:00Z'),
    testStatus: 'success',
    rateLimit: {
      requestsPerSecond: 10,
      requestsPerMinute: 600,
      requestsPerHour: 36000,
      burstLimit: 100,
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-06-20'),
  },
  {
    id: 'integration-2',
    name: 'Slack Workspace',
    type: 'webhook',
    provider: 'slack',
    config: {
      webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000XXXXXX',
      events: ['message', 'file_share', 'workflow_completed'],
      retryAttempts: 3,
      timeout: 5000,
    },
    credentials: {
      signingSecret: '***encrypted***',
      botToken: '***encrypted***',
    },
    isActive: true,
    lastTested: new Date('2024-06-10T14:20:00Z'),
    testStatus: 'success',
    rateLimit: {
      requestsPerSecond: 1,
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10,
    },
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-05-22'),
  },
  {
    id: 'integration-3',
    name: 'SendGrid Email',
    type: 'email',
    provider: 'sendgrid',
    config: {
      apiKey: '***encrypted***',
      defaultSender: 'noreply@company.com',
      templatesPath: '/email-templates',
      bounceTracking: true,
      clickTracking: true,
    },
    credentials: {
      apiKey: '***encrypted***',
    },
    isActive: true,
    lastTested: new Date('2024-06-18T09:15:00Z'),
    testStatus: 'success',
    rateLimit: {
      requestsPerSecond: 100,
      requestsPerMinute: 6000,
      requestsPerHour: 100000,
      burstLimit: 1000,
    },
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-06-18'),
  },
]

/**
 * API handler for getting workflow integrations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const provider = searchParams.get('provider')
    const active = searchParams.get('active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    let filteredIntegrations = mockIntegrations

    if (type) {
      filteredIntegrations = filteredIntegrations.filter(
        (i) => i.type.toLowerCase() === type.toLowerCase()
      )
    }

    if (provider) {
      filteredIntegrations = filteredIntegrations.filter(
        (i) => i.provider.toLowerCase() === provider.toLowerCase()
      )
    }

    if (active !== null) {
      const isActive = active === 'true'
      filteredIntegrations = filteredIntegrations.filter((i) => i.isActive === isActive)
    }

    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const integrations = filteredIntegrations.slice(startIndex, endIndex)

    const response: ApiResponse<WorkflowIntegration[]> = {
      success: true,
      data: integrations,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching integrations:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch integrations',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * API handler for creating workflow integration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const integrationData: Partial<WorkflowIntegration> = body

    // Validate required fields
    if (!integrationData.name || !integrationData.type || !integrationData.provider) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Integration name, type, and provider are required',
          },
        },
        { status: 400 }
      )
    }

    // Create integration
    const integration: WorkflowIntegration = {
      id: crypto.randomUUID(),
      name: integrationData.name!,
      type: integrationData.type!,
      provider: integrationData.provider!,
      config: integrationData.config || {},
      credentials: integrationData.credentials || {},
      isActive: integrationData.isActive !== undefined ? integrationData.isActive : true,
      lastTested: undefined,
      testStatus: 'pending',
      rateLimit: integrationData.rateLimit || {
        requestsPerSecond: 10,
        requestsPerMinute: 600,
        requestsPerHour: 36000,
        burstLimit: 100,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockIntegrations.push(integration)

    const response: ApiResponse<WorkflowIntegration> = {
      success: true,
      data: integration,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating integration:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create integration',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * API handler for testing integration
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const integrationId = params.id
    const body = await request.json()
    const { testConfig } = body

    // Find integration
    const integrationIndex = mockIntegrations.findIndex((i) => i.id === integrationId)
    if (integrationIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Integration not found',
          },
        },
        { status: 404 }
      )
    }

    const integration = mockIntegrations[integrationIndex]

    // Simulate integration test
    const testResult = {
      success: true,
      responseTime: 245, // ms
      testData: testConfig,
      timestamp: new Date(),
      details: {
        message: 'Integration test successful',
        endpoint: '/test',
        statusCode: 200,
      },
    }

    // Update integration with test results
    mockIntegrations[integrationIndex] = {
      ...integration,
      lastTested: new Date(),
      testStatus: testResult.success ? 'success' : 'failed',
    }

    const response: ApiResponse = {
      success: true,
      data: testResult,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error testing integration:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to test integration',
        },
      },
      { status: 500 }
    )
  }
}
