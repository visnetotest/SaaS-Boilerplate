// =============================================================================
// MICROSERVICES ERROR HANDLING
// =============================================================================

export class MicroservicesError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'MicroservicesError'
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: new Date().toISOString(),
      },
    }
  }
}

// Service Registry Errors
export class ServiceNotFoundError extends MicroservicesError {
  constructor(serviceId: string) {
    super('SERVICE_NOT_FOUND', `Service with ID '${serviceId}' not found`, 404, { serviceId })
  }
}

export class ServiceAlreadyExistsError extends MicroservicesError {
  constructor(slug: string) {
    super('SERVICE_ALREADY_EXISTS', `Service with slug '${slug}' already exists`, 409, { slug })
  }
}

export class ServiceValidationError extends MicroservicesError {
  constructor(message: string, field?: string) {
    super('SERVICE_VALIDATION_ERROR', message, 400, { field })
  }
}

// API Gateway Errors
export class GatewayRouteNotFoundError extends MicroservicesError {
  constructor(routeId: string) {
    super('GATEWAY_ROUTE_NOT_FOUND', `Gateway route with ID '${routeId}' not found`, 404, {
      routeId,
    })
  }
}

export class GatewayRouteConflictError extends MicroservicesError {
  constructor(path: string, method: string) {
    super(
      'GATEWAY_ROUTE_CONFLICT',
      `Route with path '${path}' and method '${method}' already exists`,
      409,
      { path, method }
    )
  }
}

// Health Check Errors
export class HealthCheckTimeoutError extends MicroservicesError {
  constructor(serviceId: string, timeout: number) {
    super(
      'HEALTH_CHECK_TIMEOUT',
      `Health check for service '${serviceId}' timed out after ${timeout}ms`,
      504,
      { serviceId, timeout }
    )
  }
}

export class HealthCheckFailedError extends MicroservicesError {
  constructor(serviceId: string, error: string) {
    super('HEALTH_CHECK_FAILED', `Health check failed for service '${serviceId}': ${error}`, 503, {
      serviceId,
      error,
    })
  }
}

// Security Errors
export class UnauthorizedError extends MicroservicesError {
  constructor(message: string = 'Unauthorized access') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends MicroservicesError {
  constructor(message: string = 'Access forbidden') {
    super('FORBIDDEN', message, 403)
  }
}

export class SSRFProtectionError extends MicroservicesError {
  constructor(url: string) {
    super('SSRF_PROTECTION', `URL '${url}' is not allowed for security reasons`, 400, { url })
  }
}

// Validation Errors
export class ValidationError extends MicroservicesError {
  constructor(message: string, field?: string, value?: any) {
    super('VALIDATION_ERROR', message, 400, { field, value })
  }
}

export class InvalidURLError extends ValidationError {
  constructor(url: string, reason: string) {
    super(`Invalid URL: ${reason}`, 'url', url)
  }
}

// Performance & Metrics Errors
export class MetricValidationError extends ValidationError {
  constructor(message: string) {
    super(`Metric validation error: ${message}`, 'metric')
  }
}

// Error Response Helper
export function createErrorResponse(error: MicroservicesError): Response {
  return new Response(JSON.stringify(error.toJSON()), {
    status: error.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': error.code,
    },
  })
}

// Error Handler Middleware
export function handleMicroservicesError(error: unknown): Response {
  console.error('Microservices error:', error)

  if (error instanceof MicroservicesError) {
    return createErrorResponse(error)
  }

  if (error instanceof Error) {
    const microservicesError = new MicroservicesError('INTERNAL_ERROR', error.message, 500, {
      stack: error.stack,
    })
    return createErrorResponse(microservicesError)
  }

  const unknownError = new MicroservicesError('UNKNOWN_ERROR', 'An unknown error occurred', 500)
  return createErrorResponse(unknownError)
}

// Error Type Guards
export function isMicroservicesError(error: any): error is MicroservicesError {
  return error instanceof MicroservicesError
}

// Error Logging Helper
export function logError(error: MicroservicesError, context?: any): void {
  const logData = {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    context,
    timestamp: new Date().toISOString(),
    stack: error.stack,
  }

  if (error.statusCode >= 500) {
    console.error('[MICROSERVICES_ERROR]', logData)
  } else {
    console.warn('[MICROSERVICES_WARNING]', logData)
  }
}
