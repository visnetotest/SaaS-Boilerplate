'use client'

import { Building, Edit, Plus, Search, Settings, Trash2, Users } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

// Types
interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  status: 'active' | 'inactive' | 'suspended'
  role?: string
  tenantId?: string
  lastLoginAt?: string
  createdAt: string
}

interface Tenant {
  id: string
  name: string
  slug: string
  status: 'active' | 'inactive' | 'suspended'
  domain?: string
  createdAt: string
  userCount?: number
}

// Mock data
const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    status: 'active',
    role: 'super_admin',
    tenantId: 'tenant-1',
    lastLoginAt: '2024-01-15T10:30:00Z',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    email: 'user@example.com',
    firstName: 'Regular',
    lastName: 'User',
    status: 'active',
    role: 'user',
    tenantId: 'tenant-1',
    lastLoginAt: '2024-01-14T15:45:00Z',
    createdAt: '2024-01-05T00:00:00Z',
  },
]

const mockTenants: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    status: 'active',
    domain: 'acme.example.com',
    createdAt: '2024-01-01T00:00:00Z',
    userCount: 25,
  },
  {
    id: 'tenant-2',
    name: 'Tech Startup LLC',
    slug: 'tech-startup',
    status: 'active',
    domain: 'tech.example.com',
    createdAt: '2024-01-10T00:00:00Z',
    userCount: 12,
  },
]

// Components
export function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleCreateUser = () => {
    console.log('Create user')
  }

  const handleEditUser = (userId: string) => {
    console.log('Edit user:', userId)
  }

  const handleDeleteUser = (userId: string) => {
    console.log('Delete user:', userId)
  }

  const handleToggleUserStatus = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    setUsers(
      users.map((user) => (user.id === userId ? { ...user, status: newStatus as any } : user))
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>User Management</h2>
        <Button onClick={handleCreateUser} className='flex items-center gap-2'>
          <Plus className='h-4 w-4' />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex gap-4 items-center'>
            <div className='flex-1'>
              <div className='relative'>
                <Search className='absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search users...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='w-40 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            >
              <option value='all'>All Status</option>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
              <option value='suspended'>Suspended</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className='flex items-center justify-between p-4 border rounded-lg'
              >
                <div>
                  <div className='font-medium'>
                    {user.firstName} {user.lastName}
                  </div>
                  <div className='text-sm text-muted-foreground'>{user.email}</div>
                </div>
                <div className='flex items-center gap-4'>
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                    {user.status}
                  </Badge>
                  <Badge variant='outline'>{user.role}</Badge>
                  <div className='flex gap-2'>
                    <Button variant='ghost' size='sm' onClick={() => handleEditUser(user.id)}>
                      <Edit className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleToggleUserStatus(user.id, user.status)}
                    >
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleDeleteUser(user.id)}
                      className='text-destructive hover:text-destructive'
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function TenantManagement() {
  const tenants = useState<Tenant[]>(mockTenants)[0]
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleCreateTenant = () => {
    console.log('Create tenant')
  }

  const handleEditTenant = (tenantId: string) => {
    console.log('Edit tenant:', tenantId)
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Tenant Management</h2>
        <Button onClick={handleCreateTenant} className='flex items-center gap-2'>
          <Plus className='h-4 w-4' />
          Add Tenant
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex gap-4 items-center'>
            <div className='flex-1'>
              <div className='relative'>
                <Search className='absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search tenants...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='w-40 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            >
              <option value='all'>All Status</option>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
              <option value='suspended'>Suspended</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {filteredTenants.map((tenant) => (
          <Card key={tenant.id}>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-lg'>{tenant.name}</CardTitle>
                <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                  {tenant.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                <div className='flex items-center gap-2 text-sm'>
                  <Building className='h-4 w-4 text-muted-foreground' />
                  <span className='font-mono'>{tenant.slug}</span>
                </div>
                {tenant.domain && (
                  <div className='text-sm text-muted-foreground'>{tenant.domain}</div>
                )}
                <div className='flex items-center gap-2 text-sm'>
                  <Users className='h-4 w-4 text-muted-foreground' />
                  <span>{tenant.userCount} users</span>
                </div>
                <div className='text-sm text-muted-foreground'>
                  Created {new Date(tenant.createdAt).toLocaleDateString()}
                </div>
                <div className='flex gap-2 pt-2'>
                  <Button variant='outline' size='sm' onClick={() => handleEditTenant(tenant.id)}>
                    <Settings className='h-4 w-4 mr-2' />
                    Manage
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Main Admin Panel Component
export function AdminPanel() {
  const [activeSection, setActiveSection] = useState('users')

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <div className='flex items-center gap-4 mb-8'>
        <Settings className='h-8 w-8 text-primary' />
        <h1 className='text-3xl font-bold'>Admin Panel</h1>
      </div>

      <div className='flex gap-4 mb-6 border-b'>
        <button
          onClick={() => setActiveSection('users')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeSection === 'users'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className='h-4 w-4 mr-2 inline' />
          Users
        </button>
        <a
          href='/admin/plugins'
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeSection === 'plugins'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className='h-4 w-4 mr-2 inline' />
          Plugins
        </a>
      </div>

      <div className='space-y-6'>
        {activeSection === 'users' && <UserManagement />}
        {activeSection === 'tenants' && <TenantManagement />}
      </div>
    </div>
  )
}
