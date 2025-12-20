'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const CreateUserFormSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  organizationId: z.string().optional(),
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  status: z.enum(['active', 'inactive']),
  roleIds: z.array(z.string()).optional(),
  profile: z
    .object({
      timezone: z.string().default('UTC'),
      language: z.string().default('en'),
      phone: z.string().optional(),
      bio: z.string().max(500).optional(),
    })
    .optional(),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'auto']).default('auto'),
      notifications: z.object({
        email: z.boolean().default(true),
        push: z.boolean().default(true),
        marketing: z.boolean().default(false),
        security: z.boolean().default(true),
      }),
    })
    .optional(),
})

type CreateUserFormData = z.infer<typeof CreateUserFormSchema>

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateUserFormData) => Promise<void>
  tenants: Array<{ id: string; name: string; slug: string }>
  organizations: Array<{ id: string; name: string; tenantId: string }>
  roles: Array<{ id: string; name: string; tenantId: string }>
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
  tenants,
  organizations,
  roles,
}: CreateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<string>('')

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(CreateUserFormSchema),
    values: {
      tenantId: '',
      email: '',
      firstName: '',
      lastName: '',
      status: 'active',
      profile: {
        timezone: 'UTC',
        language: 'en',
      },
      preferences: {
        theme: 'auto',
        notifications: {
          email: true,
          push: true,
          marketing: false,
          security: true,
        },
      },
    },
  })

  const filteredOrganizations = organizations.filter(
    (org) => !selectedTenant || org.tenantId === selectedTenant
  )

  const filteredRoles = roles.filter((role) => !selectedTenant || role.tenantId === selectedTenant)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system. They will receive an email invitation to set up their
            account.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6'>
            {/* Basic Information */}
            <div className='space-y-4'>
              <h3 className='text-lg font-medium'>Basic Information</h3>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='firstName'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder='Enter first name' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='lastName'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder='Enter last name' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type='email' placeholder='Enter email address' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select status' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='active'>Active</SelectItem>
                        <SelectItem value='inactive'>Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Organization Assignment */}
            <div className='space-y-4'>
              <h3 className='text-lg font-medium'>Organization Assignment</h3>

              <FormField
                control={form.control}
                name='tenantId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        setSelectedTenant(value)
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select tenant' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name} ({tenant.slug})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {filteredOrganizations.length > 0 && (
                <FormField
                  control={form.control}
                  name='organizationId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select organization' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value=''>No Organization</SelectItem>
                          {filteredOrganizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {filteredRoles.length > 0 && (
                <FormField
                  control={form.control}
                  name='roleIds'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roles</FormLabel>
                      <div className='space-y-2'>
                        {filteredRoles.map((role) => (
                          <div key={role.id} className='flex items-center space-x-2'>
                            <input
                              type='checkbox'
                              id={role.id}
                              checked={field.value?.includes(role.id) || false}
                              onChange={(e) => {
                                const updatedRoles = e.target.checked
                                  ? [...(field.value || []), role.id]
                                  : (field.value || []).filter((id) => id !== role.id)
                                field.onChange(updatedRoles)
                              }}
                            />
                            <label htmlFor={role.id} className='text-sm'>
                              {role.name}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Profile Settings */}
            <div className='space-y-4'>
              <h3 className='text-lg font-medium'>Profile Settings</h3>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='profile.timezone'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select timezone' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='UTC'>UTC</SelectItem>
                          <SelectItem value='America/New_York'>Eastern Time</SelectItem>
                          <SelectItem value='America/Los_Angeles'>Pacific Time</SelectItem>
                          <SelectItem value='Europe/London'>London</SelectItem>
                          <SelectItem value='Asia/Tokyo'>Tokyo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='profile.language'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select language' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='en'>English</SelectItem>
                          <SelectItem value='es'>Spanish</SelectItem>
                          <SelectItem value='fr'>French</SelectItem>
                          <SelectItem value='de'>German</SelectItem>
                          <SelectItem value='ja'>Japanese</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='profile.phone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder='Enter phone number' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='profile.bio'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Enter a short biography'
                        className='resize-none'
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notification Preferences */}
            <div className='space-y-4'>
              <h3 className='text-lg font-medium'>Notification Preferences</h3>

              <div className='space-y-3'>
                <FormField
                  control={form.control}
                  name='preferences.notifications.email'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between'>
                      <div className='space-y-0.5'>
                        <FormLabel>Email Notifications</FormLabel>
                        <div className='text-sm text-muted-foreground'>
                          Receive notifications via email
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='preferences.notifications.push'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between'>
                      <div className='space-y-0.5'>
                        <FormLabel>Push Notifications</FormLabel>
                        <div className='text-sm text-muted-foreground'>
                          Receive push notifications in browser
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='preferences.notifications.marketing'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between'>
                      <div className='space-y-0.5'>
                        <FormLabel>Marketing Emails</FormLabel>
                        <div className='text-sm text-muted-foreground'>
                          Receive marketing and promotional emails
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='preferences.notifications.security'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between'>
                      <div className='space-y-0.5'>
                        <FormLabel>Security Alerts</FormLabel>
                        <div className='text-sm text-muted-foreground'>
                          Receive security-related notifications
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Creating User...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
