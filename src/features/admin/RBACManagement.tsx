'use client'

import { Edit, Key, Plus, Settings, Shield, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Types
interface Role {
  id: string
  name: string
  description?: string
  permissions: Permission[]
  isSystem: boolean
  tenantId: string
  tenantName?: string
  userCount?: number
  createdAt: string
  updatedAt: string
}

interface Permission {
  id: string
  name: string
  description?: string
  resource: string
  action: string
  category: string
}

interface UserRole {
  id: string
  userId: string
  userName: string
  userEmail: string
  roleId: string
  roleName: string
  tenantId: string
  tenantName: string
  assignedAt: string
}

// Simple alert helper
const alert = (message: string) => {
  window.alert(message)
}

export function RBACManagement() {
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'user-roles'>('roles')
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [tenantFilter, setTenantFilter] = useState<string>('all')

  // Mock data fetch (in real app, this would be API calls)
  useEffect(() => {
    const fetchRBACData = async () => {
      try {
        setLoading(true)

        // Mock roles
        const mockRoles: Role[] = [
          {
            id: '1',
            name: 'Super Admin',
            description: 'Full system access',
            permissions: [],
            isSystem: true,
            tenantId: 'system',
            tenantName: 'System',
            userCount: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: '2',
            name: 'Tenant Admin',
            description: 'Full tenant access',
            permissions: [],
            isSystem: false,
            tenantId: 'tenant-1',
            tenantName: 'Acme Corporation',
            userCount: 5,
            createdAt: '2024-01-05T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
          },
          {
            id: '3',
            name: 'User Manager',
            description: 'Can manage users',
            permissions: [],
            isSystem: false,
            tenantId: 'tenant-1',
            tenantName: 'Acme Corporation',
            userCount: 8,
            createdAt: '2024-01-10T00:00:00Z',
            updatedAt: '2024-01-20T00:00:00Z',
          },
        ]
        setRoles(mockRoles)

        // Mock permissions
        const mockPermissions: Permission[] = [
          {
            id: '1',
            name: 'user:create',
            description: 'Create new users',
            resource: 'user',
            action: 'create',
            category: 'User Management',
          },
          {
            id: '2',
            name: 'user:read',
            description: 'View user information',
            resource: 'user',
            action: 'read',
            category: 'User Management',
          },
          {
            id: '3',
            name: 'user:update',
            description: 'Update user information',
            resource: 'user',
            action: 'update',
            category: 'User Management',
          },
          {
            id: '4',
            name: 'user:delete',
            description: 'Delete users',
            resource: 'user',
            action: 'delete',
            category: 'User Management',
          },
          {
            id: '5',
            name: 'tenant:create',
            description: 'Create new tenants',
            resource: 'tenant',
            action: 'create',
            category: 'Tenant Management',
          },
        ]
        setPermissions(mockPermissions)

        // Mock user roles
        const mockUserRoles: UserRole[] = [
          {
            id: '1',
            userId: 'user-1',
            userName: 'John Doe',
            userEmail: 'john@acme.com',
            roleId: '2',
            roleName: 'Tenant Admin',
            tenantId: 'tenant-1',
            tenantName: 'Acme Corporation',
            assignedAt: '2024-01-05T10:00:00Z',
          },
          {
            id: '2',
            userId: 'user-2',
            userName: 'Jane Smith',
            userEmail: 'jane@acme.com',
            roleId: '3',
            roleName: 'User Manager',
            tenantId: 'tenant-1',
            tenantName: 'Acme Corporation',
            assignedAt: '2024-01-10T14:30:00Z',
          },
        ]
        setUserRoles(mockUserRoles)
      } catch (error) {
        alert('Failed to load RBAC data')
        console.error('Error fetching RBAC data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRBACData()
  }, [])

  // Role management
  const handleCreateRole = () => {
    alert('Create role dialog would open here')
  }

  const handleEditRole = (roleId: string) => {
    alert(`Edit role dialog would open for role: ${roleId}`)
  }

  const handleDeleteRole = (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return
    alert(`Delete role: ${roleId}`)
  }

  // Permission management
  const handleCreatePermission = () => {
    alert('Create permission dialog would open here')
  }

  const handleEditPermission = (permissionId: string) => {
    alert(`Edit permission dialog would open for permission: ${permissionId}`)
  }

  // User role management
  const handleAssignRole = () => {
    alert('Assign role dialog would open here')
  }

  const handleRevokeRole = (userRoleId: string) => {
    if (!confirm('Are you sure you want to revoke this role assignment?')) return
    alert(`Revoke role assignment: ${userRoleId}`)
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-muted-foreground'>Loading RBAC data...</div>
      </div>
    )
  }

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (tenantFilter === 'all' || role.tenantId === tenantFilter)
  )

  const filteredPermissions = permissions.filter(
    (permission) =>
      permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredUserRoles = userRoles.filter(
    (userRole) =>
      userRole.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userRole.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userRole.roleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userRole.tenantName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>RBAC Management</h2>
        <div className='flex gap-2'>
          <div className='w-40'>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <div className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm'>
                <span className='block truncate'>
                  {tenantFilter === 'all' ? 'All Tenants' : 'Selected Tenant'}
                </span>
              </div>
              <SelectContent>
                <div
                  className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                  onClick={() => setTenantFilter('all')}
                >
                  All Tenants
                </div>
                <div
                  className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                  onClick={() => setTenantFilter('tenant-1')}
                >
                  Acme Corporation
                </div>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder='Search...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='w-64'
          />
        </div>
      </div>

      {/* Tabs */}
      <div className='flex space-x-1 border-b'>
        <Button
          variant={activeTab === 'roles' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('roles')}
          className='rounded-b-none'
        >
          <Shield className='h-4 w-4 mr-2' />
          Roles
        </Button>
        <Button
          variant={activeTab === 'permissions' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('permissions')}
          className='rounded-b-none'
        >
          <Key className='h-4 w-4 mr-2' />
          Permissions
        </Button>
        <Button
          variant={activeTab === 'user-roles' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('user-roles')}
          className='rounded-b-none'
        >
          <Users className='h-4 w-4 mr-2' />
          User Roles
        </Button>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>Roles ({filteredRoles.length})</CardTitle>
              <Button onClick={handleCreateRole} className='flex items-center gap-2'>
                <Plus className='h-4 w-4' />
                Add Role
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className='font-medium'>{role.name}</TableCell>
                    <TableCell>{role.description || 'N/A'}</TableCell>
                    <TableCell>{role.tenantName || 'System'}</TableCell>
                    <TableCell>{role.userCount || 0}</TableCell>
                    <TableCell>
                      <Badge variant={role.isSystem ? 'destructive' : 'default'}>
                        {role.isSystem ? 'System' : 'Custom'}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(role.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className='text-right'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' className='h-8 w-8 p-0'>
                            <Settings className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditRole(role.id)}>
                            <Edit className='mr-2 h-4 w-4' />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteRole(role.id)}
                            className='text-destructive'
                            disabled={role.isSystem}
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>Permissions ({filteredPermissions.length})</CardTitle>
              <Button onClick={handleCreatePermission} className='flex items-center gap-2'>
                <Plus className='h-4 w-4' />
                Add Permission
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPermissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell className='font-mono text-sm'>{permission.name}</TableCell>
                    <TableCell>{permission.description || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant='outline'>{permission.resource}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>{permission.action}</Badge>
                    </TableCell>
                    <TableCell>{permission.category}</TableCell>
                    <TableCell className='text-right'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' className='h-8 w-8 p-0'>
                            <Settings className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditPermission(permission.id)}>
                            <Edit className='mr-2 h-4 w-4' />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* User Roles Tab */}
      {activeTab === 'user-roles' && (
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>User Role Assignments ({filteredUserRoles.length})</CardTitle>
              <Button onClick={handleAssignRole} className='flex items-center gap-2'>
                <Plus className='h-4 w-4' />
                Assign Role
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUserRoles.map((userRole) => (
                  <TableRow key={userRole.id}>
                    <TableCell className='font-medium'>{userRole.userName}</TableCell>
                    <TableCell>{userRole.userEmail}</TableCell>
                    <TableCell>
                      <Badge variant='default'>{userRole.roleName}</Badge>
                    </TableCell>
                    <TableCell>{userRole.tenantName}</TableCell>
                    <TableCell>{new Date(userRole.assignedAt).toLocaleDateString()}</TableCell>
                    <TableCell className='text-right'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' className='h-8 w-8 p-0'>
                            <Settings className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleRevokeRole(userRole.id)}
                            className='text-destructive'
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Revoke Role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
