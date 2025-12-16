'use client'

import { Building, Edit, Plus, Search, Settings, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent } from '@/components/ui/select'

// Types
interface Tenant {
  id: string
  name: string
  slug: string
  status: 'active' | 'inactive' | 'suspended'
  domain?: string
  createdAt: string
  userCount?: number
}

interface TenantsResponse {
  success: boolean
  data: Tenant[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

// Simple alert helper
const alert = (message: string) => {
  window.alert(message)
}

export function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  })

  // Fetch tenants
  const fetchTenants = async (page = 1, search = '', status = '') => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (search) params.append('search', search)
      if (status && status !== 'all') params.append('status', status)

      const response = await fetch(`/api/admin/tenants?${params}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tenants')
      }

      const data: TenantsResponse = await response.json()
      setTenants(data.data || [])
      setPagination(data.pagination)
    } catch (error) {
      alert('Failed to fetch tenants')
      console.error('Error fetching tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  // Create tenant
  const handleCreateTenant = () => {
    alert('Tenant creation dialog would open here')
  }

  // Edit tenant
  const handleEditTenant = (tenantId: string) => {
    alert(`Edit tenant dialog would open for tenant: ${tenantId}`)
  }

  // Toggle tenant status
  const handleToggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update tenant status')
      }

      alert(`Tenant ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`)
      fetchTenants(pagination.page, searchTerm, statusFilter)
    } catch (error) {
      alert('Failed to update tenant status')
      console.error('Error updating tenant:', error)
    }
  }

  // View tenant details
  const handleViewTenant = (tenantId: string) => {
    alert(`View tenant details for: ${tenantId}`)
  }

  // Initial fetch
  useEffect(() => {
    fetchTenants()
  }, [])

  // Handle search and filters
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTenants(1, searchTerm, statusFilter)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, statusFilter])

  if (loading && tenants.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-muted-foreground'>Loading tenants...</div>
      </div>
    )
  }

  const TenantCard = ({ tenant }: { tenant: Tenant }) => (
    <Card>
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
          {tenant.domain && <div className='text-sm text-muted-foreground'>{tenant.domain}</div>}
          <div className='flex items-center gap-2 text-sm'>
            <Users className='h-4 w-4 text-muted-foreground' />
            <span>{tenant.userCount || 0} users</span>
          </div>
          <div className='text-sm text-muted-foreground'>
            Created {new Date(tenant.createdAt).toLocaleDateString()}
          </div>
          <div className='flex gap-2 pt-2'>
            <Button variant='outline' size='sm' onClick={() => handleEditTenant(tenant.id)}>
              <Settings className='h-4 w-4 mr-2' />
              Manage
            </Button>
            <Button variant='outline' size='sm' onClick={() => handleViewTenant(tenant.id)}>
              <Users className='h-4 w-4 mr-2' />
              Users
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const TenantTableRow = ({ tenant }: { tenant: Tenant }) => (
    <tr className='border-b'>
      <td className='font-medium'>{tenant.name}</td>
      <td>
        <code className='bg-muted px-2 py-1 rounded text-sm'>{tenant.slug}</code>
      </td>
      <td>
        <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
          {tenant.status}
        </Badge>
      </td>
      <td>{tenant.domain || 'N/A'}</td>
      <td>{tenant.userCount || 0}</td>
      <td>{new Date(tenant.createdAt).toLocaleDateString()}</td>
      <td>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => handleEditTenant(tenant.id)}>
            <Edit className='h-4 w-4 mr-2' />
            Edit
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleToggleTenantStatus(tenant.id, tenant.status)}
          >
            {tenant.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </td>
    </tr>
  )

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Tenant Management</h2>
        <div className='flex gap-2'>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setViewMode('table')}
          >
            Table
          </Button>
          <Button onClick={handleCreateTenant} className='flex items-center gap-2'>
            <Plus className='h-4 w-4' />
            Add Tenant
          </Button>
        </div>
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
            <div className='w-40'>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                <div className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm'>
                  <span className='block truncate'>
                    {statusFilter === 'all'
                      ? 'All Status'
                      : statusFilter === 'active'
                        ? 'Active'
                        : statusFilter === 'inactive'
                          ? 'Inactive'
                          : 'Suspended'}
                  </span>
                </div>
                <SelectContent>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setStatusFilter('all')}
                  >
                    All Status
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setStatusFilter('active')}
                  >
                    Active
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setStatusFilter('inactive')}
                  >
                    Inactive
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setStatusFilter('suspended')}
                  >
                    Suspended
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenants ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {viewMode === 'grid' ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {tenants.map((tenant) => (
                <TenantCard key={tenant.id} tenant={tenant} />
              ))}
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b'>
                    <th className='text-left py-2'>Name</th>
                    <th className='text-left py-2'>Slug</th>
                    <th className='text-left py-2'>Status</th>
                    <th className='text-left py-2'>Domain</th>
                    <th className='text-left py-2'>Users</th>
                    <th className='text-left py-2'>Created</th>
                    <th className='text-left py-2'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <TenantTableRow key={tenant.id} tenant={tenant} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className='flex items-center justify-between space-x-2 py-4'>
              <div className='text-sm text-muted-foreground'>
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className='flex space-x-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => fetchTenants(pagination.page - 1, searchTerm, statusFilter)}
                  disabled={!pagination.hasPrevious}
                >
                  Previous
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => fetchTenants(pagination.page + 1, searchTerm, statusFilter)}
                  disabled={!pagination.hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
