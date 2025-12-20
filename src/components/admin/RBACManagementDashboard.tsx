'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Edit, Key, Plus, Settings, Shield, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const CreateRoleFormSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  description: z.string().max(500).optional(),
  tenantId: z.string().min(1, 'Tenant is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
  isSystem: z.boolean().default(false),
})

type CreateRoleFormData = z.infer<typeof CreateRoleFormSchema>

// const CreatePermissionFormSchema = z.object({
//   name: z.string().min(1, 'Permission name is required').max(100),
//   description: z.string().max(500).optional(),
//   resource: z.string().min(1, 'Resource is required').max(100),
//   action: z.string().min(1, 'Action is required').max(100),
//   category: z.string().max(50).optional(),
// })

// type CreatePermissionFormData = z.infer<typeof CreatePermissionFormSchema>

interface Role {
  id: string
  name: string
  description?: string
  tenantId: string
  tenantName: string
  permissions: Permission[]
  isSystem: boolean
  userCount: number
  createdAt: string
}

interface Permission {
  id: string
  name: string
  description?: string
  resource: string
  action: string
  category: string
  createdAt: string
}

interface UserRoleAssignment {
  userId: string
  userName: string
  userEmail: string
  roles: Role[]
}

function CreateRoleDialog({
  open,
  onOpenChange,
  onSubmit,
  tenants,
  permissions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateRoleFormData) => Promise<void>
  tenants: Array<{ id: string; name: string; slug: string }>
  permissions: Permission[]
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateRoleFormData>({
    resolver: zodResolver(CreateRoleFormSchema),
    defaultValues: {
      isSystem: false,
      permissions: [],
    },
  })

  const handleSubmit = async (data: CreateRoleFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create role:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  const availablePermissions = permissions.filter((p) => !form.watch('permissions')?.includes(p.id))

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div className='fixed inset-0 bg-black/50' onClick={() => onOpenChange(false)} />
      <div className='relative z-50 w-full max-w-2xl rounded-lg border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto'>
        <div className='flex flex-col space-y-1.5 text-center sm:text-left'>
          <h2 className='text-lg font-semibold leading-none tracking-tight'>Create New Role</h2>
          <p className='text-sm text-muted-foreground'>
            Define a new role with specific permissions for your tenant.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6 mt-6'>
          <div className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='text-sm font-medium'>Role Name</label>
                <Input placeholder='e.g., Manager, Admin, Viewer' {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className='text-sm text-red-500'>{form.formState.errors.name.message}</p>
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
            </div>

            <div>
              <label className='text-sm font-medium'>Description</label>
              <Input
                placeholder='Describe the purpose of this role'
                {...form.register('description')}
              />
              {form.formState.errors.description && (
                <p className='text-sm text-red-500'>{form.formState.errors.description.message}</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium mb-2 block'>Permissions</label>
              <div className='border rounded-lg p-4 max-h-40 overflow-y-auto'>
                {availablePermissions.map((permission) => (
                  <div key={permission.id} className='flex items-center space-x-2 mb-2'>
                    <input
                      type='checkbox'
                      id={permission.id}
                      value={permission.id}
                      {...form.register('permissions')}
                    />
                    <label htmlFor={permission.id} className='text-sm flex-1'>
                      <div>
                        <span className='font-medium'>{permission.name}</span>
                        <div className='text-muted-foreground'>
                          {permission.resource}:{permission.action}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              {form.formState.errors.permissions && (
                <p className='text-sm text-red-500'>{form.formState.errors.permissions.message}</p>
              )}
            </div>

            <div className='flex items-center space-x-2'>
              <input type='checkbox' id='isSystem' {...form.register('isSystem')} />
              <label htmlFor='isSystem' className='text-sm'>
                This is a system role (cannot be deleted)
              </label>
            </div>
          </div>

          <div className='flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2'>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Creating Role...' : 'Create Role'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PermissionCard({ permission }: { permission: Permission }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between'>
          <div className='flex-1'>
            <h4 className='font-medium'>{permission.name}</h4>
            <p className='text-sm text-muted-foreground mt-1'>
              {permission.description || 'No description provided'}
            </p>
            <div className='flex items-center gap-2 mt-2'>
              <Badge variant='outline'>{permission.resource}</Badge>
              <Badge variant='outline'>{permission.action}</Badge>
              <Badge variant='secondary'>{permission.category}</Badge>
            </div>
          </div>
          <div className='flex items-center gap-1'>
            <Button variant='ghost' size='sm'>
              <Edit className='h-4 w-4' />
            </Button>
            <Button variant='ghost' size='sm' className='text-red-600'>
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RoleCard({ role }: { role: Role }) {
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg'>{role.name}</CardTitle>
          <div className='flex items-center gap-2'>
            {role.isSystem && <Badge variant='secondary'>System</Badge>}
            <Badge variant='outline'>
              <Users className='h-3 w-3 mr-1' />
              {role.userCount}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {role.description && <p className='text-sm text-muted-foreground'>{role.description}</p>}

          <div>
            <div className='text-sm font-medium mb-2'>Permissions ({role.permissions.length})</div>
            <div className='flex flex-wrap gap-1'>
              {role.permissions.slice(0, 4).map((permission) => (
                <Badge key={permission.id} variant='outline' className='text-xs'>
                  {permission.name}
                </Badge>
              ))}
              {role.permissions.length > 4 && (
                <Badge variant='outline' className='text-xs'>
                  +{role.permissions.length - 4} more
                </Badge>
              )}
            </div>
          </div>

          <div className='text-xs text-muted-foreground'>
            Tenant: {role.tenantName} • Created {new Date(role.createdAt).toLocaleDateString()}
          </div>

          <div className='flex gap-2 pt-2'>
            <Button variant='outline' size='sm' className='flex-1'>
              <Edit className='h-4 w-4 mr-2' />
              Edit
            </Button>
            <Button variant='outline' size='sm' className='flex-1'>
              <Users className='h-4 w-4 mr-2' />
              Assign Users
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RBACManagementDashboard() {
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'assignments'>('roles')
  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false)
  const [_showCreatePermissionDialog, _setShowCreatePermissionDialog] = useState(false)

  // Mock data
  const [roles] = useState<Role[]>([
    {
      id: '1',
      name: 'Super Admin',
      description: 'Full system access with all permissions',
      tenantId: '1',
      tenantName: 'System',
      permissions: [
        {
          id: '1',
          name: 'All Access',
          resource: '*',
          action: '*',
          category: 'system',
          createdAt: '2024-01-01',
        },
      ],
      isSystem: true,
      userCount: 2,
      createdAt: '2024-01-01',
    },
    {
      id: '2',
      name: 'Tenant Admin',
      description: 'Full access to tenant resources',
      tenantId: '2',
      tenantName: 'Acme Corp',
      permissions: [
        {
          id: '2',
          name: 'Manage Users',
          resource: 'users',
          action: '*',
          category: 'users',
          createdAt: '2024-01-05',
        },
        {
          id: '3',
          name: 'Manage Billing',
          resource: 'billing',
          action: '*',
          category: 'billing',
          createdAt: '2024-01-05',
        },
      ],
      isSystem: false,
      userCount: 5,
      createdAt: '2024-01-05',
    },
    {
      id: '3',
      name: 'Viewer',
      description: 'Read-only access to tenant resources',
      tenantId: '2',
      tenantName: 'Acme Corp',
      permissions: [
        {
          id: '4',
          name: 'View Users',
          resource: 'users',
          action: 'read',
          category: 'users',
          createdAt: '2024-01-10',
        },
        {
          id: '5',
          name: 'View Reports',
          resource: 'reports',
          action: 'read',
          category: 'reports',
          createdAt: '2024-01-10',
        },
      ],
      isSystem: false,
      userCount: 15,
      createdAt: '2024-01-10',
    },
  ])

  const [permissions] = useState<Permission[]>([
    {
      id: '1',
      name: 'All Access',
      resource: '*',
      action: '*',
      category: 'system',
      createdAt: '2024-01-01',
    },
    {
      id: '2',
      name: 'Manage Users',
      resource: 'users',
      action: '*',
      category: 'users',
      createdAt: '2024-01-05',
    },
    {
      id: '3',
      name: 'Manage Billing',
      resource: 'billing',
      action: '*',
      category: 'billing',
      createdAt: '2024-01-05',
    },
    {
      id: '4',
      name: 'View Users',
      resource: 'users',
      action: 'read',
      category: 'users',
      createdAt: '2024-01-10',
    },
    {
      id: '5',
      name: 'View Reports',
      resource: 'reports',
      action: 'read',
      category: 'reports',
      createdAt: '2024-01-10',
    },
    {
      id: '6',
      name: 'Create Content',
      resource: 'content',
      action: 'create',
      category: 'content',
      createdAt: '2024-01-15',
    },
    {
      id: '7',
      name: 'Edit Content',
      resource: 'content',
      action: 'update',
      category: 'content',
      createdAt: '2024-01-15',
    },
    {
      id: '8',
      name: 'Delete Content',
      resource: 'content',
      action: 'delete',
      category: 'content',
      createdAt: '2024-01-15',
    },
  ])

  const [userAssignments] = useState<UserRoleAssignment[]>([
    {
      userId: '1',
      userName: 'John Doe',
      userEmail: 'john@acme.com',
      roles: [
        {
          id: '2',
          name: 'Tenant Admin',
          tenantId: '2',
          tenantName: 'Acme Corp',
          permissions: [],
          isSystem: false,
          userCount: 0,
          createdAt: '2024-01-05',
        },
      ],
    },
    {
      userId: '2',
      userName: 'Jane Smith',
      userEmail: 'jane@acme.com',
      roles: [
        {
          id: '3',
          name: 'Viewer',
          tenantId: '2',
          tenantName: 'Acme Corp',
          permissions: [],
          isSystem: false,
          userCount: 0,
          createdAt: '2024-01-10',
        },
      ],
    },
  ])

  const tenants = [
    { id: '1', name: 'System', slug: 'system' },
    { id: '2', name: 'Acme Corp', slug: 'acme' },
    { id: '3', name: 'Beta Inc', slug: 'beta' },
  ]

  const handleCreateRole = async (data: CreateRoleFormData) => {
    console.log('Creating role:', data)
    // API call would go here
  }

  // TODO: Implement handleCreatePermission
  // const _handleCreatePermission = async (data: CreatePermissionFormData) => {
  //   console.log('Creating permission:', data)
  //   // API call would go here
  // }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>RBAC Management</h2>
        <div className='flex gap-2'>
          <Button onClick={() => _setShowCreatePermissionDialog(true)}>
            <Key className='h-4 w-4 mr-2' />
            Add Permission
          </Button>
          <Button onClick={() => setShowCreateRoleDialog(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Add Role
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className='flex space-x-1 bg-muted p-1 rounded-lg w-fit'>
        {[
          { id: 'roles', label: 'Roles', icon: Shield },
          { id: 'permissions', label: 'Permissions', icon: Key },
          { id: 'assignments', label: 'User Assignments', icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className='h-4 w-4' />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div>
          <div className='mb-4'>
            <p className='text-sm text-muted-foreground'>
              Manage roles and their associated permissions. Roles define what users can do within
              the system.
            </p>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div>
          <div className='mb-4'>
            <p className='text-sm text-muted-foreground'>
              Manage system permissions. Permissions are the building blocks that define what
              actions can be performed on resources.
            </p>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {permissions.map((permission) => (
              <PermissionCard key={permission.id} permission={permission} />
            ))}
          </div>
        </div>
      )}

      {/* User Assignments Tab */}
      {activeTab === 'assignments' && (
        <div>
          <div className='mb-4'>
            <p className='text-sm text-muted-foreground'>
              View and manage user role assignments. Users can have multiple roles across different
              tenants.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>User Role Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {userAssignments.map((assignment) => (
                  <div
                    key={assignment.userId}
                    className='flex items-center justify-between p-4 border rounded-lg'
                  >
                    <div>
                      <div className='font-medium'>{assignment.userName}</div>
                      <div className='text-sm text-muted-foreground'>{assignment.userEmail}</div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {assignment.roles.map((role) => (
                        <Badge key={role.id} variant='outline'>
                          {role.name}
                        </Badge>
                      ))}
                      <Button variant='outline' size='sm'>
                        <Settings className='h-4 w-4 mr-2' />
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Role Dialog */}
      <CreateRoleDialog
        open={showCreateRoleDialog}
        onOpenChange={setShowCreateRoleDialog}
        onSubmit={handleCreateRole}
        tenants={tenants}
        permissions={permissions}
      />
    </div>
  )
}
