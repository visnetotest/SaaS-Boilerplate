import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { serviceRegistry } from '@/services/ServiceRegistry'

// Validation schemas
const CreateServiceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  repository: z.string().url().optional(),
  homepage: z.string().url().optional(),
  category: z.string(),
  tags: z.array(z.string()).optional(),
  baseUrl: z.string().url(),
  healthEndpoint: z.string().url().optional(),
  docsEndpoint: z.string().url().optional(),
  isInternal: z.boolean().optional().default(false),
})

const UpdateServiceSchema = CreateServiceSchema.partial().omit({
  name: true,
  slug: true,
  version: true,
  baseUrl: true,
})

const ServiceActionSchema = z.enum(['activate', 'deactivate', 'restart', 'update-config'])

// GET /api/admin/services - List all services
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = {
      status: searchParams.get('status'),
      category: searchParams.get('category'),
      author: searchParams.get('author'),
      isInternal: searchParams.get('isInternal'),
    }

    const services = await serviceRegistry.getServices(filters)

    return NextResponse.json({
      success: true,
      data: services,
      type: 'service-list',
    })

  } catch (error) {
    console.error('Failed to list services:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list services' },
      { status: 500 }
    )
  }
  }
}

// POST /api/admin/services - Register new service
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = CreateServiceSchema.parse(body)

    // Check admin permissions
    // TODO: Implement proper RBAC check

    const serviceId = await serviceRegistry.register(validatedData)

    return NextResponse.json({
      success: true,
      data: { serviceId },
      message: 'Service registered successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to register service:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to register service' },
      { status: 500 }
    )
  }
  }
}

// PUT /api/admin/services/[serviceId] - Update service
export async function PUT(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = UpdateServiceSchema.parse(body)

    // Check admin permissions
    // TODO: Implement proper RBAC check

    const serviceId = params.serviceId
    await serviceRegistry.updateService(serviceId, validatedData)

    return NextResponse.json({
      success: true,
      message: `Service ${serviceId} updated successfully`
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to update service:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update service' },
      { status: 500 }
    )
    }
  }
}

// DELETE /api/admin/services/[serviceId] - Unregister service
export async function DELETE(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceId = params.serviceId

    // Check admin permissions
    // TODO: Implement proper RBAC check

    await serviceRegistry.unregister(serviceId)

    return NextResponse.json({
      success: true,
      message: `Service ${serviceId} unregistered successfully`
    })

  } catch (error) {
    console.error('Failed to unregister service:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to unregister service' },
      { status: 500 }
    )
    }
  }
}

// GET /api/admin/services/[serviceId]/health - Get service health status
export async function GET_HEALTH(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceId = params.serviceId

    // Check admin permissions
    // TODO: Implement proper RBAC check

    const healthStatus = await serviceRegistry.getHealthStatus(serviceId)

    return NextResponse.json({
      success: true,
      data: {
        serviceId,
        health: healthStatus,
        timestamp: new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error('Failed to get service health:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get service health' },
      { status: 500 }
    )
    }
  }
}

// GET /api/admin/services/[serviceId]/config - Get service configuration
export async function GET_CONFIG(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceId = params.serviceId

    // Check admin permissions
    // TODO: Implement proper RBAC check

    const service = serviceRegistry.getService(serviceId)
    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        serviceId: service.id,
        config: service.config,
        secrets: service.secrets,
      },
      })

    } catch (error) {
    console.error('Failed to get service config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get service config' },
      { status: 500 }
    )
    }
  }

// PUT /api/admin/services/[serviceId]/config - Update service configuration
export async function PUT_CONFIG(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = UpdateServiceSchema.parse(body)

    const serviceId = params.serviceId

    // Check admin permissions
    // TODO: Implement proper RBAC check

    const service = serviceRegistry.getService(serviceId)
    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      )
    }

    // Validate configuration update
    this.validateServiceConfig(validatedData.config)

    // Update service configuration
    await serviceRegistry.updateConfig(serviceId, validatedData.config)

    return NextResponse.json({
      success: true,
      message: `Service ${serviceId} configuration updated`
    })

    } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to update service config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update service config' },
      { status: 500 }
    )
    }
  }

// =============================================================================
// PRIVATE HELPER METHODS
// =============================================================================

private validateServiceConfig(config: any): void {
  // Basic validation rules for service configuration
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object')
  }

  // Check for sensitive data in public config
  const sensitiveKeys = ['password', 'secret', 'key', 'private']
  const hasSensitiveData = Object.keys(config).some(key => 
    sensitiveKeys.some(sensitiveKey => config[key] && config[key] !== ''))
  
  if (hasSensitiveData) {
    throw new Error('Configuration contains sensitive data')
  }

  // Validate URL format
  if (config.baseUrl && !this.isValidUrl(config.baseUrl)) {
    throw new Error('Invalid baseUrl format')
  }

  // Validate arrays
  const arrayFields = ['tags']
  arrayFields.forEach(field => {
    if (Array.isArray(config[field]) {
      const arrayValue = config[field]
      if (!arrayValue.every(item => typeof item === 'string')) {
        throw new Error(`Field ${field} must be an array of strings`)
      }
    })
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const serviceRegistry = new ServiceRegistryImpl()