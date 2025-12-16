import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/libs/auth'
import { db } from '@/libs/DB'
import { userSchema } from '@/models/Schema'

// Schema for updating users
const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  tenantId: z.string().uuid().optional(),
})

// Update user
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()
    const validatedData = UpdateUserSchema.parse(body)

    // Check if user exists
    const existingUser = await db.select().from(userSchema).where(eq(userSchema.id, id)).limit(1)
    if (!existingUser[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user
    const [updatedUser] = await db
      .update(userSchema)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(userSchema.id, id))
      .returning()

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating user:', error)
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 })
  }
}

// Delete user
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

    // Check if user exists
    const existingUser = await db.select().from(userSchema).where(eq(userSchema.id, id)).limit(1)
    if (!existingUser[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Soft delete by setting status to deleted
    await db
      .update(userSchema)
      .set({
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(userSchema.id, id))

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 })
  }
}
