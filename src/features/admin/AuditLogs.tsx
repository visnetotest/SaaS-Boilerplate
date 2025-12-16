'use client'

import { Activity, Calendar, Download, Filter, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
interface AuditLog {
  id: string
  tenantId?: string
  tenantName?: string
  userId?: string
  userName?: string
  userEmail?: string
  action: string
  resourceType: string
  resourceId?: string
  details?: string
  ipAddress?: string
  userAgent?: string
  status: 'success' | 'failure' | 'warning'
  createdAt: string
}

interface AuditFilters {
  action?: string
  resourceType?: string
  status?: string
  tenantId?: string
  userId?: string
  dateRange?: string
}

// Simple alert helper
const alert = (message: string) => {
  window.alert(message)
}

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<AuditFilters>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  })

  // Mock data fetch (in real app, this would be API calls)
  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setLoading(true)

        // Mock audit logs
        const mockLogs: AuditLog[] = [
          {
            id: '1',
            tenantId: 'tenant-1',
            tenantName: 'Acme Corporation',
            userId: 'user-1',
            userName: 'John Doe',
            userEmail: 'john@acme.com',
            action: 'user.create',
            resourceType: 'User',
            resourceId: 'user-123',
            details: 'Created new user "Jane Smith"',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            status: 'success',
            createdAt: '2024-01-15T10:30:00Z',
          },
          {
            id: '2',
            tenantId: 'tenant-1',
            tenantName: 'Acme Corporation',
            userId: 'user-1',
            userName: 'John Doe',
            userEmail: 'john@acme.com',
            action: 'user.update',
            resourceType: 'User',
            resourceId: 'user-456',
            details: 'Updated user email address',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            status: 'success',
            createdAt: '2024-01-15T11:15:00Z',
          },
          {
            id: '3',
            tenantId: 'tenant-2',
            tenantName: 'Tech Startup LLC',
            userId: 'user-2',
            userName: 'Jane Smith',
            userEmail: 'jane@tech.com',
            action: 'auth.login.failed',
            resourceType: 'Auth',
            details: 'Failed login attempt - invalid password',
            ipAddress: '10.0.0.50',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            status: 'failure',
            createdAt: '2024-01-15T12:00:00Z',
          },
          {
            id: '4',
            tenantId: 'tenant-1',
            tenantName: 'Acme Corporation',
            userId: 'user-3',
            userName: 'System',
            userEmail: 'system@company.com',
            action: 'tenant.suspend',
            resourceType: 'Tenant',
            resourceId: 'tenant-3',
            details: 'Automated suspension due to payment failure',
            status: 'warning',
            createdAt: '2024-01-15T13:45:00Z',
          },
          {
            id: '5',
            tenantId: 'tenant-1',
            tenantName: 'Acme Corporation',
            userId: 'user-1',
            userName: 'John Doe',
            userEmail: 'john@acme.com',
            action: 'role.assign',
            resourceType: 'Role',
            resourceId: 'role-789',
            details: 'Assigned "User Manager" role to user',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            status: 'success',
            createdAt: '2024-01-15T14:30:00Z',
          },
        ]

        setLogs(mockLogs)
        setPagination({
          page: 1,
          limit: 50,
          total: mockLogs.length,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        })
      } catch (error) {
        alert('Failed to fetch audit logs')
        console.error('Error fetching audit logs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAuditLogs()
  }, [filters, searchTerm, pagination.page])

  // Handle export
  const handleExport = (format: 'csv' | 'json' | 'excel') => {
    alert(`Export audit logs as ${format.toUpperCase()}`)
  }

  // Handle clear filters
  const handleClearFilters = () => {
    setFilters({})
    setSearchTerm('')
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'default'
      case 'failure':
        return 'destructive'
      case 'warning':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  // Format action for display
  const formatAction = (action: string) => {
    return action.replace('.', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilters =
      (!filters.action || log.action.includes(filters.action)) &&
      (!filters.resourceType || log.resourceType === filters.resourceType) &&
      (!filters.status || log.status === filters.status) &&
      (!filters.tenantId || log.tenantId === filters.tenantId)

    return matchesSearch && matchesFilters
  })

  if (loading && logs.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-muted-foreground'>Loading audit logs...</div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Audit Logs</h2>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => handleExport('csv')}>
            <Download className='h-4 w-4 mr-2' />
            Export CSV
          </Button>
          <Button variant='outline' onClick={() => handleExport('json')}>
            <Download className='h-4 w-4 mr-2' />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Filter className='h-4 w-4' />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <div>
              <label className='text-sm font-medium mb-2 block'>Search</label>
              <div className='relative'>
                <Search className='absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search logs...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>

            <div>
              <label className='text-sm font-medium mb-2 block'>Action</label>
              <Select
                value={filters.action || ''}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, action: value }))}
              >
                <div className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm'>
                  <span className='block truncate'>{filters.action || 'All Actions'}</span>
                </div>
                <SelectContent>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, action: '' }))}
                  >
                    All Actions
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, action: 'create' }))}
                  >
                    Create Actions
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, action: 'update' }))}
                  >
                    Update Actions
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, action: 'delete' }))}
                  >
                    Delete Actions
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className='text-sm font-medium mb-2 block'>Resource Type</label>
              <Select
                value={filters.resourceType || ''}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, resourceType: value }))}
              >
                <div className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm'>
                  <span className='block truncate'>{filters.resourceType || 'All Resources'}</span>
                </div>
                <SelectContent>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, resourceType: '' }))}
                  >
                    All Resources
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, resourceType: 'User' }))}
                  >
                    User
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, resourceType: 'Tenant' }))}
                  >
                    Tenant
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, resourceType: 'Role' }))}
                  >
                    Role
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, resourceType: 'Auth' }))}
                  >
                    Auth
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className='text-sm font-medium mb-2 block'>Status</label>
              <Select
                value={filters.status || ''}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              >
                <div className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm'>
                  <span className='block truncate'>{filters.status || 'All Status'}</span>
                </div>
                <SelectContent>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, status: '' }))}
                  >
                    All Status
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, status: 'success' }))}
                  >
                    Success
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, status: 'failure' }))}
                  >
                    Failure
                  </div>
                  <div
                    className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                    onClick={() => setFilters((prev) => ({ ...prev, status: 'warning' }))}
                  >
                    Warning
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(filters.action || filters.resourceType || filters.status || searchTerm) && (
            <div className='mt-4'>
              <Button variant='outline' onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Activity className='h-4 w-4' />
            Logs ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Calendar className='h-4 w-4 text-muted-foreground' />
                      <div>
                        <div className='text-sm'>
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className='font-mono text-sm'>{formatAction(log.action)}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{log.resourceType}</Badge>
                  </TableCell>
                  <TableCell>
                    {log.userName && (
                      <div>
                        <div className='font-medium'>{log.userName}</div>
                        <div className='text-sm text-muted-foreground'>{log.userEmail}</div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{log.tenantName || 'System'}</TableCell>
                  <TableCell className='max-w-xs truncate' title={log.details}>
                    {log.details || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(log.status)}>{log.status}</Badge>
                  </TableCell>
                  <TableCell className='font-mono text-sm'>{log.ipAddress || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className='flex items-center justify-between space-x-2 py-4'>
              <div className='text-sm text-muted-foreground'>
                Showing {filteredLogs.length} of {pagination.total} logs
              </div>
              <div className='flex space-x-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={!pagination.hasPrevious}
                >
                  Previous
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
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
