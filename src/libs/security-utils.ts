// =============================================================================
// SECURITY & VALIDATION UTILITIES
// =============================================================================

import { URL } from 'url'

// URL Validation and SSRF Protection
export class URLValidator {
  private static readonly ALLOWED_PROTOCOLS = ['https:', 'http:']
  private static readonly BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '192.168.',
    '169.254.',
    'metadata.google.internal',
    '169.254.169.254',
    'ec2metadata',
  ]
  private static readonly ALLOWED_PORTS = [80, 443, 8080, 3000, 8000, 5000]

  static validateServiceURL(url: string): {
    valid: boolean
    error?: string
    sanitizedUrl?: string
  } {
    try {
      // Basic URL parsing
      if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL is required and must be a string' }
      }

      // Prevent protocol-relative URLs
      if (url.startsWith('//')) {
        return { valid: false, error: 'Protocol-relative URLs are not allowed' }
      }

      // Parse URL
      let parsedURL: URL
      try {
        parsedURL = new URL(url)
      } catch (error) {
        return { valid: false, error: 'Invalid URL format' }
      }

      // Check protocol
      if (!this.ALLOWED_PROTOCOLS.includes(parsedURL.protocol)) {
        return { valid: false, error: `Protocol '${parsedURL.protocol}' is not allowed` }
      }

      // Check hostname
      if (!parsedURL.hostname) {
        return { valid: false, error: 'Hostname is required' }
      }

      // Convert to lowercase for comparison
      const hostname = parsedURL.hostname.toLowerCase()

      // Check for blocked hosts/IP ranges
      if (this.BLOCKED_HOSTS.some((blocked) => hostname.startsWith(blocked))) {
        return { valid: false, error: `Hostname '${hostname}' is not allowed for security reasons` }
      }

      // Check for private IP ranges
      if (this.isPrivateIP(hostname)) {
        return { valid: false, error: `Private IP '${hostname}' is not allowed` }
      }

      // Check port
      const port = parsedURL.port
        ? parseInt(parsedURL.port)
        : parsedURL.protocol === 'https:'
          ? 443
          : 80
      if (port && !this.ALLOWED_PORTS.includes(port)) {
        return { valid: false, error: `Port '${port}' is not allowed` }
      }

      // Check for suspicious URLs
      if (this.isSuspiciousURL(url)) {
        return { valid: false, error: 'URL contains suspicious patterns' }
      }

      // Sanitize URL
      const sanitized = this.sanitizeURL(parsedURL)

      return {
        valid: true,
        sanitizedUrl: sanitized,
      }
    } catch (error) {
      return { valid: false, error: 'URL validation failed' }
    }
  }

  private static isPrivateIP(hostname: string): boolean {
    // IPv4 private ranges
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipv4Regex.test(hostname)) {
      const parts = hostname.split('.').map(Number)
      if (parts && parts[0] === 10) return true // 10.0.0.0/8
      if (parts && parts[0] === 172 && parts[1] && parts[1] >= 16 && parts[1] <= 31) return true // 172.16.0.0/12
      if (parts && parts[0] === 192 && parts[1] && parts[1] === 168) return true // 192.168.0.0/16
    }

    // IPv6 private ranges
    if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true // fc00::/7
    if (hostname === '::1') return true // localhost
    if (hostname.startsWith('fe80::')) return true // link-local

    return false
  }

  private static isSuspiciousURL(url: string): boolean {
    const suspiciousPatterns = [
      /\.\.\//, // Path traversal
      /%2e%2e%2f/, // URL encoded path traversal
      /file:/, // File protocol
      /ftp:/, // FTP protocol
      /data:/, // Data protocol
      /javascript:/, // JavaScript protocol
      /vbscript:/, // VBScript protocol
      /@/, // Potential credential injection
      /\x00/, // Null byte injection
      /<script/i, // Script tags
      /on\w+\s*=/i, // Event handlers
    ]

    return suspiciousPatterns.some((pattern) => pattern.test(url))
  }

  private static sanitizeURL(url: URL): string {
    // Remove fragment
    url.hash = ''

    // Remove suspicious query parameters
    const searchParams = new URLSearchParams(url.search)

    for (const [key] of searchParams.entries()) {
      if (
        key.toLowerCase().includes('callback') ||
        key.toLowerCase().includes('redirect') ||
        key.toLowerCase().includes('return')
      ) {
        searchParams.delete(key)
      }
    }

    url.search = searchParams.toString()

    return url.toString()
  }
}

// Input Validation Utilities
export class InputValidator {
  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (!input) return ''

    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }

  static validateSlug(slug: string): boolean {
    // Allow alphanumeric, hyphens, and underscores
    const slugRegex = /^[a-zA-Z0-9_-]+$/
    return slugRegex.test(slug) && slug.length >= 1 && slug.length <= 50
  }

  static validateVersion(version: string): boolean {
    // Semantic versioning pattern
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9\-]+)?(\+[a-zA-Z0-9\-]+)?$/
    return versionRegex.test(version)
  }

  static validatePath(path: string): boolean {
    // API path validation
    const pathRegex = /^\/[a-zA-Z0-9\-_\/]*$/
    return pathRegex.test(path) && path.length <= 255
  }

  static validateHTTPMethod(method: string): boolean {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
    return validMethods.includes(method.toUpperCase())
  }

  static validateRateLimit(rateLimit: number): boolean {
    return Number.isInteger(rateLimit) && rateLimit > 0 && rateLimit <= 10000
  }

  static validateSeverity(severity: string): boolean {
    const validSeverities = ['debug', 'info', 'warning', 'error', 'critical']
    return validSeverities.includes(severity.toLowerCase())
  }

  static validateMetricType(metricType: string): boolean {
    const validTypes = ['counter', 'gauge', 'histogram', 'timer']
    return validTypes.includes(metricType.toLowerCase())
  }

  static validateCategory(category: string): boolean {
    // Allow common categories
    const validCategories = [
      'auth',
      'database',
      'cache',
      'queue',
      'storage',
      'monitoring',
      'logging',
      'network',
      'compute',
      'other',
    ]
    return validCategories.includes(category.toLowerCase())
  }
}

// Rate Limiting Helper
export class RateLimiter {
  private static requests = new Map<string, { count: number; resetTime: number }>()

  static isAllowed(
    identifier: string,
    limit: number,
    windowMs: number
  ): { allowed: boolean; resetTime: number; remaining: number } {
    const now = Date.now()

    // Clean up old entries
    for (const [key, data] of this.requests.entries()) {
      if (data.resetTime < now) {
        this.requests.delete(key)
      }
    }

    const current = this.requests.get(identifier)

    if (!current || current.resetTime < now) {
      // New window or expired
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      })
      return {
        allowed: true,
        resetTime: now + windowMs,
        remaining: limit - 1,
      }
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        resetTime: current.resetTime,
        remaining: 0,
      }
    }

    current.count++
    return {
      allowed: true,
      resetTime: current.resetTime,
      remaining: limit - current.count,
    }
  }
}

// Security Headers Helper
export function addSecurityHeaders(response: Response): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  return response
}
