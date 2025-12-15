import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

export interface ApiErrorResponse {
  code: string
  message: string
  details?: any
  statusCode: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: any
  meta?: {
    timestamp: string
    requestId: string
    version: string
  }
}

export class ApiError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: any

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  static badRequest(message: string, details?: any): ApiError {
    return new ApiError(message, 400, 'BAD_REQUEST', details)
  }

  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(message, 401, 'UNAUTHORIZED')
  }

  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(message, 403, 'FORBIDDEN')
  }

  static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(message, 404, 'NOT_FOUND')
  }

  static conflict(message: string, details?: any): ApiError {
    return new ApiError(message, 409, 'CONFLICT', details)
  }

  static validation(message: string, details?: any): ApiError {
    return new ApiError(message, 422, 'VALIDATION_ERROR', details)
  }

  static internal(message: string = 'Internal server error', details?: any): ApiError {
    return new ApiError(message, 500, 'INTERNAL_ERROR', details)
  }

  static serviceUnavailable(message: string = 'Service unavailable'): ApiError {
    return new ApiError(message, 503, 'SERVICE_UNAVAILABLE')
  }

  static tooManyRequests(message: string = 'Too many requests'): ApiError {
    return new ApiError(message, 429, 'TOO_MANY_REQUESTS')
  }
}

export function createSuccessResponse<T>(data: T, meta?: any): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      version: '1.0.0',
      ...meta,
    },
  })
}

export function createErrorResponse(error: ApiError | Error | ZodError): NextResponse<ApiResponse> {
  let statusCode = 500
  let message = 'Internal server error'
  let code = 'INTERNAL_ERROR'
  let details: any

  if (error instanceof ApiError) {
    statusCode = error.statusCode
    message = error.message
    code = error.code
    details = error.details
  } else if (error instanceof ZodError) {
    statusCode = 422
    message = 'Validation failed'
    code = 'VALIDATION_ERROR'
    details = error.errors
  } else if (error instanceof Error) {
    message = error.message
    code = 'INTERNAL_ERROR'
  }

  // Log error for debugging
  console.error('API Error:', {
    message,
    code,
    statusCode,
    details,
    stack: error instanceof Error ? error.stack : undefined,
  })

  return NextResponse.json(
    {
      success: false,
      error: message,
      details,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0',
      },
    },
    { status: statusCode }
  )
}

export function withErrorHandler(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args)
    } catch (error) {
      return createErrorResponse(error as Error)
    }
  }
}

export function withValidation<T>(schema: any, target: 'body' | 'query' | 'params' = 'body') {
  return function (handler: (req: NextRequest, data: T, ...args: any[]) => Promise<NextResponse>) {
    return withErrorHandler(async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
      let data: any

      try {
        switch (target) {
          case 'body':
            data = await req.json()
            break
          case 'query':
            const { searchParams } = new URL(req.url)
            data = Object.fromEntries(searchParams.entries())
            break
          case 'params':
            // params are passed as arguments in Next.js 13+ app router
            data = args[0] || {}
            break
          default:
            throw ApiError.badRequest(`Invalid validation target: ${target}`)
        }

        const validatedData = schema.parse(data)
        return await handler(req, validatedData, ...args.slice(1))
      } catch (error) {
        if (error instanceof ZodError) {
          throw ApiError.validation('Validation failed', error.errors)
        }
        throw error
      }
    })
  }
}

export function withAuth(options: { required?: boolean; roles?: string[] } = {}) {
  return function (
    handler: (req: NextRequest, user: any, ...args: any[]) => Promise<NextResponse>
  ) {
    return withErrorHandler(async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
      // TODO: Implement actual authentication logic
      // This is a placeholder that should integrate with your auth system (Clerk, Auth0, etc.)

      const authHeader = req.headers.get('authorization')
      if (!authHeader && options.required !== false) {
        throw ApiError.unauthorized('Authorization header required')
      }

      // Mock user for now - replace with actual auth logic
      const user = {
        id: 'mock-user-id',
        email: 'user@example.com',
        roles: ['user'],
        tenantId: 'mock-tenant-id',
      }

      // Check role requirements
      if (options.roles && options.roles.length > 0) {
        const hasRequiredRole = options.roles.some((role) => user.roles.includes(role))
        if (!hasRequiredRole) {
          throw ApiError.forbidden('Insufficient permissions')
        }
      }

      return await handler(req, user, ...args)
    })
  }
}

export function withTenant() {
  return function (
    handler: (req: NextRequest, tenant: any, ...args: any[]) => Promise<NextResponse>
  ) {
    return withErrorHandler(async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
      const { searchParams } = new URL(req.url)
      const tenantId = searchParams.get('tenantId')

      if (!tenantId) {
        throw ApiError.badRequest('Tenant ID is required')
      }

      // TODO: Verify tenant exists and user has access
      const tenant = {
        id: tenantId,
        name: 'Mock Tenant',
      }

      return await handler(req, tenant, ...args)
    })
  }
}

export function withRateLimit(options: { windowMs: number; max: number }) {
  const requests = new Map<string, { count: number; resetTime: number }>()

  return function (handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return withErrorHandler(async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
      const clientId =
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      const now = Date.now()

      // Clean up expired entries
      for (const [key, value] of requests.entries()) {
        if (now > value.resetTime) {
          requests.delete(key)
        }
      }

      // Check rate limit
      const clientData = requests.get(clientId)
      if (clientData) {
        if (now < clientData.resetTime) {
          if (clientData.count >= options.max) {
            throw ApiError.tooManyRequests(
              `Rate limit exceeded. Try again in ${Math.ceil((clientData.resetTime - now) / 1000)} seconds`
            )
          }
          clientData.count++
        } else {
          clientData.count = 1
          clientData.resetTime = now + options.windowMs
        }
      } else {
        requests.set(clientId, {
          count: 1,
          resetTime: now + options.windowMs,
        })
      }

      return await handler(req, ...args)
    })
  }
}

export function withCors(
  options: {
    origins?: string[]
    methods?: string[]
    headers?: string[]
    credentials?: boolean
  } = {}
) {
  const {
    origins = ['*'],
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = true,
  } = options

  return function (handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
      const origin = req.headers.get('origin')

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 200 })

        if (origins.includes('*') || origins.includes(origin || '')) {
          response.headers.set('Access-Control-Allow-Origin', origin || '*')
        }

        response.headers.set('Access-Control-Allow-Methods', methods.join(', '))
        response.headers.set('Access-Control-Allow-Headers', headers.join(', '))

        if (credentials) {
          response.headers.set('Access-Control-Allow-Credentials', 'true')
        }

        return response
      }

      const response = await handler(req, ...args)

      if (origins.includes('*') || origins.includes(origin || '')) {
        response.headers.set('Access-Control-Allow-Origin', origin || '*')
      }

      if (credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true')
      }

      return response
    }
  }
}

export function withCache(options: { ttl: number; key?: string }) {
  const cache = new Map<string, { data: any; expiry: number }>()

  return function (handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return withErrorHandler(async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
      const cacheKey = options.key || `${req.method}:${req.url}`
      const now = Date.now()

      // Check cache
      const cached = cache.get(cacheKey)
      if (cached && now < cached.expiry) {
        return createSuccessResponse(cached.data, { cached: true })
      }

      // Execute handler
      const response = await handler(req, ...args)

      // Cache successful responses
      if (response.status === 200) {
        const responseData = await response.json()
        cache.set(cacheKey, {
          data: responseData.data,
          expiry: now + options.ttl * 1000,
        })
      }

      return response
    })
  }
}
