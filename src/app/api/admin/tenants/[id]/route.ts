import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { tenantSchema } from '@/models/Schema'

// Schema for updating tenants
const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  domain: z.string().url().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

// Update tenant
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()
    const validatedData = UpdateTenantSchema.parse(body)

    // Check if tenant exists
    const existingTenant = await db
      .select()
      .from(tenantSchema)
      .where(eq(tenantSchema.id, id))
      .limit(1)
    if (!existingTenant[0]) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Check slug uniqueness if being updated
    if (validatedData.slug) {
      const slugTenant = await db
        .select()
        .from(tenantSchema)
        .where(eq(tenantSchema.slug, validatedData.slug))
        .limit(1)
      if (slugTenant[0] && slugTenant[0].id !== id) {
        return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
      }
    }

    // Update tenant
    const [updatedTenant] = await db
      .update(tenantSchema)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(tenantSchema.id, id))
      .returning()

    return NextResponse.json({
      success: true,
      data: updatedTenant,
      message: 'Tenant updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating tenant:', error)
    return NextResponse.json({ success: false, error: 'Failed to update tenant' }, { status: 500 })
  }
}

// Delete tenant
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams

    // Check if tenant exists
    const existingTenant = await db
      .select()
      .from(tenantSchema)
      .where(eq(tenantSchema.id, id))
      .limit(1)
    if (!existingTenant[0]) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Soft delete by setting status to deleted
    await db
      .update(tenantSchema)
      .set({
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(tenantSchema.id, id))

    return NextResponse.json({
      success: true,
      message: 'Tenant deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting tenant:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete tenant' }, { status: 500 })
  }
}
