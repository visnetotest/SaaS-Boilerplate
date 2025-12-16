'use client'

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Service {
  id: string
  name: string
  slug: string
  version: string
  baseUrl: string
  healthEndpoint: string
  description?: string
  category?: string
  tags?: string[]
  status: 'active' | 'inactive' | 'degraded' | 'down'
  isInternal: boolean
  lastHealthCheck?: string
  responseTime?: number
  uptime?: number
  createdAt: string
  updatedAt: string
}

export default function ServiceHealthDashboard() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/admin/services')
      if (response.ok) {
        const data = await response.json()
        setServices(data.services || [])
      }
    } catch (error) {
      console.error('Failed to fetch services:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const performHealthCheck = async (serviceId: string) => {
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/health-check`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        // Update service in list with new health status
        setServices((prev) =>
          prev.map((service) => (service.id === serviceId ? data.service : service))
        )
      }
    } catch (error) {
      console.error('Failed to perform health check:', error)
    }
  }

  const refreshAllServices = async () => {
    setRefreshing(true)
    await fetchServices()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'down':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className='h-4 w-4 text-green-600' />
      case 'degraded':
        return <AlertTriangle className='h-4 w-4 text-yellow-600' />
      case 'down':
        return <XCircle className='h-4 w-4 text-red-600' />
      case 'inactive':
        return <Activity className='h-4 w-4 text-gray-600' />
      default:
        return <Clock className='h-4 w-4 text-gray-600' />
    }
  }

  const formatResponseTime = (responseTime?: number) => {
    if (!responseTime) return '-'
    if (responseTime < 1000) return `${responseTime}ms`
    return `${(responseTime / 1000).toFixed(2)}s`
  }

  const formatUptime = (uptime?: number) => {
    if (!uptime) return '-'
    const hours = Math.floor(uptime / 3600)
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return `${days}d ${remainingHours}h`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  useEffect(() => {
    fetchServices()
  }, [])

  const activeServices = services.filter((s) => s.status === 'active').length
  const degradedServices = services.filter((s) => s.status === 'degraded').length
  const downServices = services.filter((s) => s.status === 'down').length
  const totalServices = services.length

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Service Health Dashboard</h1>
          <p className='text-muted-foreground'>
            Monitor and manage microservices health and performance
          </p>
        </div>
        <Button
          onClick={refreshAllServices}
          disabled={refreshing}
          className='flex items-center gap-2'
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Services</CardTitle>
            <Server className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalServices}</div>
            <p className='text-xs text-muted-foreground'>Registered services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active</CardTitle>
            <CheckCircle2 className='h-4 w-4 text-green-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>{activeServices}</div>
            <p className='text-xs text-muted-foreground'>
              {totalServices > 0 ? Math.round((activeServices / totalServices) * 100) : 0}% uptime
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Degraded</CardTitle>
            <AlertTriangle className='h-4 w-4 text-yellow-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-yellow-600'>{degradedServices}</div>
            <p className='text-xs text-muted-foreground'>Performance issues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Down</CardTitle>
            <XCircle className='h-4 w-4 text-red-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>{downServices}</div>
            <p className='text-xs text-muted-foreground'>Service unavailable</p>
          </CardContent>
        </Card>
      </div>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <CardDescription>Health status of all registered microservices</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex items-center justify-center py-8'>
              <RefreshCw className='h-6 w-6 animate-spin' />
              <span className='ml-2'>Loading services...</span>
            </div>
          ) : services.length === 0 ? (
            <div className='text-center py-8'>
              <Server className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
              <h3 className='text-lg font-semibold mb-2'>No services registered</h3>
              <p className='text-muted-foreground'>
                Get started by registering your first microservice.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Last Check</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div>
                        <div className='font-medium'>{service.name}</div>
                        <div className='text-sm text-muted-foreground'>
                          v{service.version} • {service.category || 'Uncategorized'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant='outline'
                        className={`flex items-center gap-1 w-fit ${getStatusColor(service.status)}`}
                      >
                        {getStatusIcon(service.status)}
                        {service.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-1'>
                        <Clock className='h-3 w-3 text-muted-foreground' />
                        {formatResponseTime(service.responseTime)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='text-sm'>{formatUptime(service.uptime)}</div>
                    </TableCell>
                    <TableCell>
                      <div className='text-sm text-muted-foreground'>
                        {formatDate(service.lastHealthCheck)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => performHealthCheck(service.id)}
                          className='flex items-center gap-1'
                        >
                          <RefreshCw className='h-3 w-3' />
                          Check
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => setSelectedService(service)}
                          className='flex items-center gap-1'
                        >
                          <Eye className='h-3 w-3' />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Service Detail Modal/Sidebar */}
      {selectedService && (
        <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
          <Card className='w-full max-w-2xl max-h-[90vh] overflow-auto'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <Server className='h-5 w-5' />
                    {selectedService.name}
                  </CardTitle>
                  <CardDescription>{selectedService.description}</CardDescription>
                </div>
                <Button variant='ghost' size='sm' onClick={() => setSelectedService(null)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='text-sm font-medium'>Version</label>
                  <p className='text-sm'>{selectedService.version}</p>
                </div>
                <div>
                  <label className='text-sm font-medium'>Status</label>
                  <Badge
                    variant='outline'
                    className={`flex items-center gap-1 w-fit mt-1 ${getStatusColor(selectedService.status)}`}
                  >
                    {getStatusIcon(selectedService.status)}
                    {selectedService.status}
                  </Badge>
                </div>
                <div>
                  <label className='text-sm font-medium'>Category</label>
                  <p className='text-sm'>{selectedService.category || 'Uncategorized'}</p>
                </div>
                <div>
                  <label className='text-sm font-medium'>Internal</label>
                  <p className='text-sm'>{selectedService.isInternal ? 'Yes' : 'No'}</p>
                </div>
              </div>

              <div>
                <label className='text-sm font-medium'>Base URL</label>
                <p className='text-sm font-mono bg-muted p-2 rounded'>{selectedService.baseUrl}</p>
              </div>

              <div>
                <label className='text-sm font-medium'>Health Endpoint</label>
                <p className='text-sm font-mono bg-muted p-2 rounded'>
                  {selectedService.healthEndpoint}
                </p>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='text-sm font-medium'>Response Time</label>
                  <p className='text-sm'>{formatResponseTime(selectedService.responseTime)}</p>
                </div>
                <div>
                  <label className='text-sm font-medium'>Uptime</label>
                  <p className='text-sm'>{formatUptime(selectedService.uptime)}</p>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='text-sm font-medium'>Created</label>
                  <p className='text-sm'>{formatDate(selectedService.createdAt)}</p>
                </div>
                <div>
                  <label className='text-sm font-medium'>Last Updated</label>
                  <p className='text-sm'>{formatDate(selectedService.updatedAt)}</p>
                </div>
              </div>

              {selectedService.tags && selectedService.tags.length > 0 && (
                <div>
                  <label className='text-sm font-medium'>Tags</label>
                  <div className='flex flex-wrap gap-1 mt-1'>
                    {selectedService.tags.map((tag, index) => (
                      <Badge key={index} variant='secondary' className='text-xs'>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
