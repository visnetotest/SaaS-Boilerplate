import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Types
interface Service {
  id: string
  name: string
  slug: string
  version: string
  baseUrl: string
  healthEndpoint: string
  docsEndpoint: string
  description?: string
  category?: string
  tags?: string[]
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown'
  uptime: number
  responseTime: number
  errorRate: number
  lastChecked: string
  metadata?: Record<string, any>
}



// Mock data
const mockServices: Service[] = [
  {
    id: 'svc-1',
    name: 'Authentication Service',
    slug: 'auth-service',
    version: '1.2.0',
    baseUrl: 'https://auth-service.internal',
    healthEndpoint: 'https://auth-service.internal/health',
    docsEndpoint: 'https://auth-service.internal/docs',
    description: 'Handles user authentication, token validation, and session management',
    category: 'Core',
    tags: ['authentication', 'security', 'jwt'],
    status: 'healthy',
    uptime: 99.9,
    responseTime: 45,
    errorRate: 0.1,
    lastChecked: new Date().toISOString(),
    metadata: {
      protocols: ['HTTP/1.1', 'HTTP/2'],
      dependencies: ['PostgreSQL', 'Redis'],
    },
  },
  {
    id: 'svc-2',
    name: 'User Management Service',
    slug: 'user-service',
    version: '2.0.1',
    baseUrl: 'https://user-service.internal',
    healthEndpoint: 'https://user-service.internal/health',
    docsEndpoint: 'https://user-service.internal/docs',
    description: 'Manages user profiles, roles, permissions, and account settings',
    category: 'Core',
    tags: ['users', 'rbac', 'profiles'],
    status: 'healthy',
    uptime: 99.7,
    responseTime: 78,
    errorRate: 0.2,
    lastChecked: new Date().toISOString(),
  },
  {
    id: 'svc-3',
    name: 'Notification Service',
    slug: 'notification-service',
    version: '1.0.3',
    baseUrl: 'https://notification-service.internal',
    healthEndpoint: 'https://notification-service.internal/health',
    docsEndpoint: 'https://notification-service.internal/docs',
    description: 'Sends email, push, and in-app notifications to users',
    category: 'Communication',
    tags: ['notifications', 'email', 'push', 'sms'],
    status: 'degraded',
    uptime: 98.5,
    responseTime: 156,
    errorRate: 1.8,
    lastChecked: new Date(Date.now() - 60000).toISOString(),
    metadata: {
      protocols: ['HTTP/2', 'WebSocket'],
      dependencies: ['Redis', 'SendGrid', 'APNS'],
    },
  },
  {
    id: 'svc-4',
    name: 'Analytics Service',
    slug: 'analytics-service',
    version: '3.1.0',
    baseUrl: 'https://analytics-service.internal',
    healthEndpoint: 'https://analytics-service.internal/health',
    docsEndpoint: 'https://analytics-service.internal/docs',
    description: 'Processes and analyzes user behavior data, generates insights and reports',
    category: 'Analytics',
    tags: ['analytics', 'metrics', 'reporting', 'data-processing'],
    status: 'healthy',
    uptime: 99.8,
    responseTime: 120,
    errorRate: 0.05,
    lastChecked: new Date().toISOString(),
  },
  {
    id: 'svc-5',
    name: 'File Storage Service',
    slug: 'file-service',
    version: '2.1.0',
    baseUrl: 'https://file-service.internal',
    healthEndpoint: 'https://file-service.internal/health',
    docsEndpoint: 'https://file-service.internal/docs',
    description: 'Handles file uploads, storage, retrieval, and content management',
    category: 'Storage',
    tags: ['files', 'storage', 'uploads', 'media'],
    status: 'unhealthy',
    uptime: 85.2,
    responseTime: 450,
    errorRate: 12.5,
    lastChecked: new Date(Date.now() - 120000).toISOString(),
    metadata: {
      protocols: ['HTTP/2', 'WebSocket'],
      dependencies: ['S3', 'CloudFront', 'Redis'],
      storageCapacity: '2.5TB',
    },
  },
]

export function ServiceRegistry() {
  const [services, _setServices] = useState<Service[]>(mockServices)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const getStatusBadge = (status: string) => {
    const variants = {
      healthy: 'bg-green-100 text-green-800',
      degraded: 'bg-yellow-100 text-yellow-800',
      unhealthy: 'bg-red-100 text-red-800',
      unknown: 'bg-gray-100 text-gray-800',
    }
    return (
      <Badge className={variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getStatusIcon = (status: string) => {
    const icons = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌',
      unknown: '❓',
    }
    return icons[status as keyof typeof icons] || '❓'
  }



  const formatResponseTime = (responseTime: number) => {
    return `${responseTime}ms`
  }

  const formatErrorRate = (errorRate: number) => {
    return `${(errorRate * 100).toFixed(2)}%`
  }

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        service.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || service.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || service.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
  })

  const handleRefresh = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 1000)
  }

  const handleHealthCheck = async (serviceId: string) => {
    // In a real implementation, this would call the service health endpoint
    console.log('Checking health for service:', serviceId)
  }

  const handleServiceAction = (serviceId: string, action: string) => {
    console.log(`Performing ${action} on service:`, serviceId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Service Registry</h2>
          <p className="text-muted-foreground">
            Discover, monitor, and manage microservices
          </p>
        </div>
        <div className="flex gap-2">
          <Button>
            <span className="mr-2">+</span>
            Register Service
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <span className="mr-2">{loading ? 'Refreshing...' : 'Refresh'}</span>
            ↻
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="unhealthy">Unhealthy</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Core">Core</SelectItem>
                <SelectItem value="Analytics">Analytics</SelectItem>
                <SelectItem value="Communication">Communication</SelectItem>
                <SelectItem value="Storage">Storage</SelectItem>
                <SelectItem value="Security">Security</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredServices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No services found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Error Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{service.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {service.description}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {service.category}
                          </Badge>
                          {service.tags?.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(service.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getStatusIcon(service.status)}</span>
                        <span className="text-sm text-muted-foreground">
                          {service.lastChecked}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatResponseTime(service.responseTime)}</TableCell>
                    <TableCell>{formatErrorRate(service.errorRate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleHealthCheck(service.id)}
                        >
                          Health Check
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleServiceAction(service.id, 'restart')}
                        >
                          Restart
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleServiceAction(service.id, 'scale')}
                        >
                          Scale
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

      {/* Service Details Modal */}
      <div className="text-center py-4 text-sm text-muted-foreground">
        <p>Service registry provides centralized service discovery and management</p>
        <p>✅ Complete API Gateway integration for traffic routing</p>
        <p>✅ Service health monitoring and configuration management</p>
      </div>
    </div>
  )
}