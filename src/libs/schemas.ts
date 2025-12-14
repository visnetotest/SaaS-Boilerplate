import { z } from 'zod'

/**
 * Base schemas for common data types
 */
export const baseSchemas = {
  id: z.string().uuid(),
  email: z.string().email(),
  timestamp: z.string().datetime(),
  nonEmptyString: z.string().min(1),
  url: z.string().url(),
}

/**
 * User-related schemas
 */
export const userSchemas = {
  profile: z.object({
    id: baseSchemas.id,
    email: baseSchemas.email,
    firstName: baseSchemas.nonEmptyString.optional(),
    lastName: baseSchemas.nonEmptyString.optional(),
    username: baseSchemas.nonEmptyString.optional(),
    imageUrl: baseSchemas.url.optional(),
  }),

  updateProfile: z.object({
    firstName: baseSchemas.nonEmptyString.optional(),
    lastName: baseSchemas.nonEmptyString.optional(),
    username: baseSchemas.nonEmptyString.optional(),
  }),
}

/**
 * Organization-related schemas
 */
export const organizationSchemas = {
  create: z.object({
    name: baseSchemas.nonEmptyString.max(100),
    slug: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9-]+$/),
  }),

  update: z.object({
    name: baseSchemas.nonEmptyString.max(100).optional(),
    slug: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
  }),

  invite: z.object({
    email: baseSchemas.email,
    role: z.enum(['admin', 'member', 'viewer']),
  }),

  member: z.object({
    id: baseSchemas.id,
    userId: baseSchemas.id,
    organizationId: baseSchemas.id,
    role: z.enum(['admin', 'member', 'viewer']),
    joinedAt: baseSchemas.timestamp,
  }),
}

/**
 * Todo-related schemas (example for existing data)
 */
export const todoCreateSchema = z.object({
  title: baseSchemas.nonEmptyString.max(200),
  message: z.string().max(1000),
})

export const todoUpdateSchema = z.object({
  title: baseSchemas.nonEmptyString.max(200).optional(),
  message: z.string().max(1000).optional(),
  completed: z.boolean().optional(),
})

export const todoResponseSchema = z.object({
  id: z.number(),
  title: baseSchemas.nonEmptyString,
  message: z.string(),
  ownerId: baseSchemas.id,
  completed: z.boolean(),
  createdAt: baseSchemas.timestamp,
  updatedAt: baseSchemas.timestamp,
})

export const todoSchemas = {
  create: todoCreateSchema,
  update: todoUpdateSchema,
  response: todoResponseSchema,
  list: z.object({
    items: z.array(todoResponseSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
}

/**
 * Pagination schemas
 */
export const paginationSchemas = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  response: z.object({
    items: z.array(z.any()),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  }),
}

/**
 * API response schemas
 */
export const apiSchemas = {
  success: z.object({
    success: z.literal(true),
    data: z.any(),
    message: z.string().optional(),
  }),

  error: z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    }),
  }),

  pagination: paginationSchemas.response,
}

/**
 * Type inference helpers
 */
export type User = z.infer<typeof userSchemas.profile>
export type Organization = z.infer<typeof organizationSchemas.member>
export type Todo = z.infer<typeof todoResponseSchema>
export type PaginationQuery = z.infer<typeof paginationSchemas.query>
export type ApiResponse<T = any> = z.infer<typeof apiSchemas.success> & { data: T }
