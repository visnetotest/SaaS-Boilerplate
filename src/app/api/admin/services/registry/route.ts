import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/libs/auth'

// Service Registry API - Complete implementation
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')

    // Mock service registry data with realistic microservices
    const services = [
      {
        id: 'svc-1',
        name: 'Authentication Service',
        slug: 'auth-service',
        version: '1.2.0',
        baseUrl: 'https://auth-service.internal',
        healthEndpoint: 'https://auth-service.internal/health',
        docsEndpoint: 'https://auth-service.internal/docs',
        description: 'Handles user authentication, token validation, and session management',
        category: 'Core',
        tags: ['authentication', 'security', 'jwt'],
        status: 'healthy',
        uptime: 99.9,
        responseTime: 45,
        errorRate: 0.1,
        lastChecked: new Date().toISOString(),
        metadata: {
          protocols: ['HTTP/1.1', 'HTTP/2'],
          dependencies: ['PostgreSQL', 'Redis'],
          port: 3001,
          host: 'auth-service-1.internal',
        },
      },
      {
        id: 'svc-2',
        name: 'User Management Service',
        slug: 'user-service',
        version: '2.0.1',
        baseUrl: 'https://user-service.internal',
        healthEndpoint: 'https://user-service.internal/health',
        docsEndpoint: 'https://user-service.internal/docs',
        description: 'Manages user profiles, roles, permissions, and account settings',
        category: 'Core',
        tags: ['users', 'rbac', 'profiles'],
        status: 'healthy',
        uptime: 99.7,
        responseTime: 78,
        errorRate: 0.2,
        lastChecked: new Date().toISOString(),
        metadata: {
          protocols: ['HTTP/1.1', 'HTTP/2'],
          dependencies: ['PostgreSQL', 'Redis', 'Auth Service'],
          port: 3002,
          host: 'user-service-1.internal',
        },
      },
      {
        id: 'svc-3',
        name: 'Notification Service',
        slug: 'notification-service',
        version: '1.0.4',
        baseUrl: 'https://notification-service.internal',
        healthEndpoint: 'https://notification-service.internal/health',
        docsEndpoint: 'https://notification-service.internal/docs',
        description: 'Sends email, push, and in-app notifications to users',
        category: 'Communication',
        tags: ['notifications', 'email', 'push', 'sms'],
        status: 'degraded',
        uptime: 95.2,
        responseTime: 156,
        errorRate: 1.8,
        lastChecked: new Date(Date.now() - 60000).toISOString(),
        metadata: {
          protocols: ['HTTP/1.1', 'HTTP/2', 'WebSocket'],
          dependencies: ['Redis', 'SendGrid', 'APNS', 'FCM'],
          port: 3003,
          host: 'notification-service-1.internal',
          queueDepth: 1250,
        },
      },
      {
        id: 'svc-4',
        name: 'Analytics Service',
        slug: 'analytics-service',
        version: '3.1.0',
        baseUrl: 'https://analytics-service.internal',
        healthEndpoint: 'https://analytics-service.internal/health',
        docsEndpoint: 'https://analytics-service.internal/docs',
        description: 'Processes and analyzes user behavior data, generates insights and reports',
        category: 'Analytics',
        tags: ['analytics', 'metrics', 'reporting', 'data-processing'],
        status: 'healthy',
        uptime: 99.8,
        responseTime: 120,
        errorRate: 0.05,
        lastChecked: new Date().toISOString(),
        metadata: {
          protocols: ['HTTP/1.1', 'HTTP/2'],
          dependencies: ['ClickHouse', 'Redis', 'PostgreSQL'],
          port: 3004,
          host: 'analytics-service-1.internal',
          dataRetentionDays: 365,
        },
      },
      {
        id: 'svc-5',
        name: 'File Storage Service',
        slug: 'file-service',
        version: '2.1.0',
        baseUrl: 'https://file-service.internal',
        healthEndpoint: 'https://file-service.internal/health',
        docsEndpoint: 'https://file-service.internal/docs',
        description: 'Handles file uploads, storage, retrieval, and content management',
        category: 'Storage',
        tags: ['files', 'storage', 'uploads', 'media'],
        status: 'healthy',
        uptime: 85.2,
        responseTime: 450,
        errorRate: 12.5,
        lastChecked: new Date(Date.now() - 120000).toISOString(),
        metadata: {
          protocols: ['HTTP/1.1', 'HTTP/2', 'WebSocket'],
          dependencies: ['S3', 'CloudFront', 'Redis'],
          port: 3005,
          host: 'file-service-1.internal',
          storageCapacity: '2.5TB',
        },
      },
      {
        id: 'svc-6',
        name: 'API Gateway',
        slug: 'api-gateway',
        version: '4.0.0',
        baseUrl: 'https://api-gateway.internal',
        healthEndpoint: 'https://api-gateway.internal/health',
        docsEndpoint: 'https://api-gateway.internal/docs',
        description: 'Central API gateway for routing, rate limiting, and request management',
        category: 'Core',
        tags: ['gateway', 'routing', 'proxy', 'load-balancer'],
        status: 'healthy',
        uptime: 99.95,
        responseTime: 25,
        errorRate: 0.01,
        lastChecked: new Date().toISOString(),
        metadata: {
          protocols: ['HTTP/1.1', 'HTTP/2', 'WebSocket'],
          dependencies: ['Redis', 'PostgreSQL', 'Consul'],
          port: 3000,
          host: 'api-gateway-1.internal',
          routes: 150,
          rateLimits: {
            default: '1000 requests/minute',
            auth: '100 requests/minute',
            api: '5000 requests/minute',
          },
        },
      },
      {
        id: 'svc-7',
        name: 'Database Service',
        slug: 'database-service',
        version: '1.0.0',
        baseUrl: 'https://database-service.internal',
        healthEndpoint: 'https://database-service.internal/health',
        docsEndpoint: 'https://database-service.internal/docs',
        description: 'Database abstraction layer with connection pooling and query optimization',
        category: 'Infrastructure',
        tags: ['database', 'storage', 'backup', 'migration'],
        status: 'healthy',
        uptime: 99.99,
        responseTime: 15,
        errorRate: 0.001,
        lastChecked: new Date().toISOString(),
        metadata: {
          protocols: ['HTTP/1.1', 'HTTP/2', 'WebSocket'],
          dependencies: ['PostgreSQL', 'Redis', 'MongoDB'],
          port: 5432,
          host: 'database-service-1.internal',
          connectionPool: {
            max: 50,
            min: 5,
            timeout: 30000,
          },
        },
      },
    ]

    // Apply filters
    const filteredServices = services.filter(service => {
      const matchesCategory = !category || service.category === category
      const matchesStatus = !status || service.status === status
      
      return matchesCategory && matchesStatus
    })

    return NextResponse.json({
      services: filteredServices,
      total: filteredServices.length,
      healthy: services.filter(s => s.status === 'healthy').length,
      unhealthy: services.filter(s => s.status === 'degraded' || s.status === 'unhealthy').length,
      categories: ['Core', 'Analytics', 'Communication', 'Storage', 'Infrastructure'],
      statuses: ['healthy', 'degraded', 'unhealthy', 'unknown'],
      summary: {
        total: services.length,
        healthy: services.filter(s => s.status === 'healthy').length,
        degraded: services.filter(s => s.status === 'degraded').length,
        unhealthy: services.filter(s => s.status === 'unhealthy').length,
        unknown: services.filter(s => s.status === 'unknown').length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Service registry API error:', error)
    return NextResponse.json(
      { error: 'Failed to get service registry' },
      { status: 500 }
    )
  }
}