// =============================================================================
// SECURITY UTILITY FUNCTIONS
// =============================================================================

import { ilike, or } from 'drizzle-orm'

/**
 * Sanitize user input to prevent SQL injection
 */
export function sanitizeSearchInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }
  
  // Remove potentially dangerous SQL characters
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/["'%;]/g, '') // Remove quotes and semicolons
    .replace(/[\\]/g, '\\\\') // Escape backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comments
    .trim()
    .slice(0, 100) // Limit length
}

/**
 * Create a safe search condition for user input
 */
export function createSearchCondition(
  table: any,
  searchFields: string[],
  searchTerm: string
) {
  if (!searchTerm || searchFields.length === 0) {
    return undefined // No search term provided
  }
  
  const sanitizedTerm = sanitizeSearchInput(searchTerm)
  const searchPattern = `%${sanitizedTerm}%`
  
  // Create OR conditions for each field
  const conditions = searchFields.map(field => 
    ilike(table[field], searchPattern)
  )
  
  // Return OR condition if multiple fields, otherwise single field condition
  return conditions.length > 1 ? or(...conditions) : conditions[0]
}

/**
 * Validate email format (basic validation)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email)
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  return uuidRegex.test(uuid)
}

/**
 * Sanitize user input for display
 */
export function sanitizeForDisplay(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }
  
  // Allow basic HTML tags for safe display (if needed)
  const allowed = ['<b>', '</b>', '<i>', '</i>', '<em>', '</em>']
  let output = input
  
  // Sanitize dangerous characters
  output = output
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500) // Limit length

  // Reconstruct allowed HTML tags
  allowed.forEach(tag => {
    output = output.replace(new RegExp(`&lt;${tag.slice(1)}&gt;`, 'g'), tag)
    output = output.replace(new RegExp(`&lt;${tag.slice(-1)}&gt;`, 'g'), tag)
  })

  return output
}

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  DEFAULT: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests. Please try again later.',
  },
  
  STRICT: {
    windowMs: 10000, // 10 seconds
    maxRequests: 20,
    message: 'Rate limit exceeded. Please wait before making another request.',
  },
  
  CRITICAL: {
    windowMs: 5000, // 5 seconds
    maxRequests: 5,
    message: 'Critical rate limit exceeded. Account temporarily locked.',
  },
}

/**
 * CORS configuration for admin endpoints
 */
export const ADMIN_CORS = {
  origin: process.env.ADMIN_CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Admin-Request',
  ],
}

/**
 * Input validation schemas
 */
export const VALIDATION_RULES = {
  USER_NAME: {
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z\s'-]+$/,
    forbidden: ['admin', 'root', 'system', 'null'],
  },
  USER_EMAIL: {
    required: true,
    format: 'email',
    maxLength: 255,
  },
  USER_STATUS: {
    required: true,
    enum: ['active', 'inactive', 'suspended'],
  },
  PASSWORD: {
    required: true,
    minLength: 8,
    maxLength: 128,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,128}$/,
  },
  PAGE_NUMBER: {
    required: true,
    min: 1,
    max: 100,
  },
  LIMIT: {
    required: true,
    min: 1,
    max: 100,
  },
}

/**
 * Security headers for responses
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';",
}