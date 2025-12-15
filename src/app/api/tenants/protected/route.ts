import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  ApiError,
  createSuccessResponse,
  withAuth,
  withErrorHandler,
  withTenant,
  withValidation,
} from '@/libs/ApiMiddleware'
import { tenantService } from '@/services/TenantService'

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

// Example of using middleware composition
export const GET = withErrorHandler(
  withAuth({ required: true, roles: ['admin'] })(
    withTenant()(async (_request: NextRequest, user: any, tenant: any) => {
      // Your logic here
      return createSuccessResponse({
        message: 'Hello from protected endpoint!',
        user: user.email,
        tenant: tenant.id,
      })
    })
  )
)

export const POST = withErrorHandler(
  withValidation(
    CreateTenantSchema,
    'body'
  )(
    withAuth({ required: true, roles: ['admin'] })(
      async (_request: NextRequest, data: any, user: any) => {
        try {
          // Check if slug is already taken
          const existingTenant = await tenantService.getTenantBySlug(data.slug)
          if (existingTenant) {
            throw ApiError.conflict(`Slug '${data.slug}' is already taken`)
          }

          const tenant = await tenantService.createTenant({
            ...data,
            status: 'active',
            settings: data.settings || {},
            metadata: data.metadata || {},
          })

          return createSuccessResponse(tenant, {
            message: 'Tenant created successfully',
            user: user.email,
          })
        } catch (error) {
          if (error instanceof Error) {
            throw error
          }
          throw ApiError.internal('Failed to create tenant')
        }
      }
    )
  )
)
