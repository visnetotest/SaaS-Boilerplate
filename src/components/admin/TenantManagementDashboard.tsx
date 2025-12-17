'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const CreateTenantFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  domain: z.string().url().optional().or(z.literal('')),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
  status: z.enum(['active', 'inactive']),
})

type CreateTenantFormData = z.infer<typeof CreateTenantFormSchema>

interface CreateTenantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateTenantFormData) => Promise<void>
}

export function CreateTenantDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateTenantDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateTenantFormData>({
    resolver: zodResolver(CreateTenantFormSchema),
    defaultValues: {
      plan: 'starter',
      status: 'active',
    },
  })

  const handleSubmit = async (data: CreateTenantFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create tenant:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Create New Tenant
          </h2>
          <p className="text-sm text-muted-foreground">
            Add a new tenant to the system with custom configuration.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="Enter tenant name"
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Slug</label>
                <Input
                  placeholder="tenant-slug"
                  {...form.register('slug')}
                />
                {form.formState.errors.slug && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.slug.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Domain (Optional)</label>
              <Input
                type="url"
                placeholder="https://example.com"
                {...form.register('domain')}
              />
              {form.formState.errors.domain && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.domain.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Plan</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  {...form.register('plan')}
                >
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
                {form.formState.errors.plan && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.plan.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  {...form.register('status')}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {form.formState.errors.status && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.status.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Tenant...' : 'Create Tenant'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function TenantManagementDashboard() {
  const [tenants] = useState([
    {
      id: '1',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      domain: 'https://acme.example.com',
      status: 'active' as const,
      plan: 'enterprise' as const,
      userCount: 150,
      createdAt: '2024-01-10',
    },
    {
      id: '2',
      name: 'Beta Industries',
      slug: 'beta-industries',
      domain: '',
      status: 'active' as const,
      plan: 'pro' as const,
      userCount: 45,
      createdAt: '2024-01-15',
    },
    {
      id: '3',
      name: 'Gamma Startups',
      slug: 'gamma-startups',
      domain: 'https://gamma.example.com',
      status: 'inactive' as const,
      plan: 'starter' as const,
      userCount: 12,
      createdAt: '2024-01-20',
    },
  ])

  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const handleCreateTenant = async (data: any) => {
    console.log('Creating tenant:', data)
    // API call would go here
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'bg-gray-100 text-gray-800'
      case 'starter': return 'bg-blue-100 text-blue-800'
      case 'pro': return 'bg-purple-100 text-purple-800'
      case 'enterprise': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tenant Management</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          Add Tenant
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tenants.map((tenant) => (
          <Card key={tenant.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{tenant.name}</CardTitle>
                <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                  {tenant.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    {tenant.slug}
                  </code>
                </div>
                
                {tenant.domain && (
                  <div className="text-sm text-muted-foreground truncate">
                    {tenant.domain}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Badge className={getPlanColor(tenant.plan)}>
                    {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {tenant.userCount} users
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Created {new Date(tenant.createdAt).toLocaleDateString()}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Manage
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    View Users
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateTenantDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateTenant}
      />
    </div>
  )
}