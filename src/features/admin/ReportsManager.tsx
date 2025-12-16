'use client'

import { Download, MoreHorizontal, RefreshCw, TrendingUp } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Types
interface Report {
  id: string
  name: string
  type: 'users' | 'tenants' | 'revenue' | 'usage' | 'custom'
  status: 'generating' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  size?: string
  downloadUrl?: string
}

export function ReportsManager() {
  const [reports] = useState<Report[]>([
    {
      id: '1',
      name: 'Monthly User Activity Report',
      type: 'users',
      status: 'completed',
      createdAt: '2025-12-15T10:00:00Z',
      completedAt: '2025-12-15T10:05:00Z',
      size: '2.4 MB',
      downloadUrl: '/api/admin/reports/download/1',
    },
    {
      id: '2',
      name: 'Tenant Usage Analytics',
      type: 'usage',
      status: 'generating',
      createdAt: '2025-12-15T11:00:00Z',
    },
    {
      id: '3',
      name: 'Revenue Summary Q4 2025',
      type: 'revenue',
      status: 'failed',
      createdAt: '2025-12-15T09:00:00Z',
    },
  ])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const handleRefresh = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 1000)
  }

  const handleDownload = (report: Report) => {
    if (report.downloadUrl) {
      window.open(report.downloadUrl, '_blank')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'bg-green-100 text-green-800',
      generating: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
    }
    return (
      <Badge className={variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getTypeIcon = (type: string) => {
    const icons = {
      users: '👥',
      tenants: '🏢',
      revenue: '💰',
      usage: '📊',
      custom: '🔧',
    }
    return icons[type as keyof typeof icons] || '📄'
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>Reports Manager</h2>
          <p className='text-muted-foreground'>Manage and download generated reports</p>
        </div>
        <Button>
          <TrendingUp className='mr-2 h-4 w-4' />
          Create Report
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className='p-6'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center'>
            <div className='flex-1'>
              <Input
                placeholder='Search reports...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full'
              />
            </div>
            <Button variant='outline' onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex items-center justify-center h-32'>
              <RefreshCw className='h-6 w-6 animate-spin' />
              <span className='ml-2'>Loading reports...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className='text-center py-8'>
              <p className='text-muted-foreground'>No reports found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className='font-medium'>{report.name}</TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <span className='text-lg'>{getTypeIcon(report.type)}</span>
                        <span className='capitalize'>{report.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell>{new Date(report.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {report.completedAt ? new Date(report.completedAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>{report.size || '-'}</TableCell>
                    <TableCell className='text-right'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='sm'>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          {report.status === 'completed' && report.downloadUrl && (
                            <>
                              <DropdownMenuItem onClick={() => handleDownload(report)}>
                                <Download className='mr-2 h-4 w-4' />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
