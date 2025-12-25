'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const CreateUserFormSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  status: z.enum(['active', 'inactive']),
})

type CreateUserFormData = z.infer<typeof CreateUserFormSchema>

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateUserFormData) => Promise<void>
  tenants: Array<{ id: string; name: string; slug: string }>
}

export function CreateUserDialog({ open, onOpenChange, onSubmit, tenants }: CreateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(CreateUserFormSchema),
    defaultValues: {
      status: 'active',
    },
  })

  const handleSubmit = async (data: CreateUserFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create user:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div className='fixed inset-0 bg-black/50' onClick={() => onOpenChange(false)} />
      <div className='relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg'>
        <div className='flex flex-col space-y-1.5 text-center sm:text-left'>
          <h2 className='text-lg font-semibold leading-none tracking-tight'>Create New User</h2>
          <p className='text-sm text-muted-foreground'>
            Add a new user to the system. They will receive an email invitation.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6 mt-6'>
          <div className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='text-sm font-medium'>First Name</label>
                <Input placeholder='Enter first name' {...form.register('firstName')} />
                {form.formState.errors.firstName && (
                  <p className='text-sm text-red-500'>{form.formState.errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label className='text-sm font-medium'>Last Name</label>
                <Input placeholder='Enter last name' {...form.register('lastName')} />
                {form.formState.errors.lastName && (
                  <p className='text-sm text-red-500'>{form.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className='text-sm font-medium'>Email Address</label>
              <Input type='email' placeholder='Enter email address' {...form.register('email')} />
              {form.formState.errors.email && (
                <p className='text-sm text-red-500'>{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium'>Tenant</label>
              <select
                className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                {...form.register('tenantId')}
              >
                <option value=''>Select tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
              {form.formState.errors.tenantId && (
                <p className='text-sm text-red-500'>{form.formState.errors.tenantId.message}</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium'>Status</label>
              <select
                className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                {...form.register('status')}
              >
                <option value='active'>Active</option>
                <option value='inactive'>Inactive</option>
              </select>
              {form.formState.errors.status && (
                <p className='text-sm text-red-500'>{form.formState.errors.status.message}</p>
              )}
            </div>
          </div>

          <div className='flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2'>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Creating User...' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function UserManagementDashboard() {
  const [users] = useState([
    {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      status: 'active',
      tenantName: 'Acme Corp',
      createdAt: '2024-01-15',
      lastLoginAt: '2024-01-20',
    },
    {
      id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      status: 'inactive',
      tenantName: 'Beta Inc',
      createdAt: '2024-01-10',
      lastLoginAt: '2024-01-18',
    },
  ])

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [tenants] = useState([
    { id: '1', name: 'Acme Corp', slug: 'acme' },
    { id: '2', name: 'Beta Inc', slug: 'beta' },
  ])

  const handleCreateUser = async (data: any) => {
    console.log('Creating user:', data)
    // API call would go here
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>User Management</h2>
        <Button onClick={() => setShowCreateDialog(true)}>Add User</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <div className='grid grid-cols-6 border-b bg-muted/50 p-3 text-sm font-medium'>
              <div>Name</div>
              <div>Email</div>
              <div>Status</div>
              <div>Tenant</div>
              <div>Last Login</div>
              <div>Created</div>
            </div>
            {users.map((user) => (
              <div key={user.id} className='grid grid-cols-6 border-b p-3 text-sm'>
                <div className='font-medium'>
                  {user.firstName} {user.lastName}
                </div>
                <div>{user.email}</div>
                <div>
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                    {user.status}
                  </Badge>
                </div>
                <div>{user.tenantName}</div>
                <div>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                </div>
                <div>{new Date(user.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateUser}
        tenants={tenants}
      />
    </div>
  )
}
