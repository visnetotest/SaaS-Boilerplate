'use client'

import {
  Check,
  Clock,
  Code,
  Download,
  Package,
  Play,
  Plus,
  Search,
  Settings,
  Shield,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
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
import { Table, TableCell, TableRow } from '@/components/ui/table'

// Types
interface Plugin {
  id: string
  name: string
  slug: string
  version: string
  description?: string
  author?: string
  repository?: string
  homepage?: string
  category: string
  tags: string[]
  status: 'active' | 'inactive' | 'error'
  isSystem: boolean
  manifest: Record<string, any>
  settings: Record<string, any>
  createdAt: string
  updatedAt: string
  installationCount?: number
}

interface TenantPlugin {
  id: string
  tenantId: string
  pluginId: string
  status: 'installed' | 'activated' | 'deactivated' | 'error'
  config: Record<string, any>
  version: string
  settings: Record<string, any>
  installedBy?: string
  installedAt: string
  activatedAt?: string
  lastUsedAt?: string
  plugin: Plugin
}

interface PluginsResponse {
  success: boolean
  data: Plugin[]
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

export function PluginManagement() {
  const [activeTab, setActiveTab] = useState<'available' | 'installed' | 'marketplace'>('available')
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [tenantPlugins, setTenantPlugins] = useState<TenantPlugin[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false)
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [pluginConfig, setPluginConfig] = useState<Record<string, any>>({})
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  })

  // Mock categories
  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'authentication', label: 'Authentication' },
    { value: 'payment', label: 'Payment' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'communication', label: 'Communication' },
    { value: 'integration', label: 'Integration' },
    { value: 'automation', label: 'Automation' },
    { value: 'ui', label: 'UI' },
    { value: 'security', label: 'Security' },
    { value: 'monitoring', label: 'Monitoring' },
    { value: 'storage', label: 'Storage' },
    { value: 'utility', label: 'Utility' },
    { value: 'developer', label: 'Developer' },
  ]

  // Fetch available plugins
  const fetchPlugins = async (page = 1, search = '', category = '', status = '') => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (search) params.append('search', search)
      if (category) params.append('category', category)
      if (status) params.append('status', status)

      const response = await fetch(`/api/admin/plugins?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch plugins')
      }

      const data: PluginsResponse = await response.json()
      if (data.success) {
        setPlugins(data.data || [])
        setPagination(data.pagination)
      }
    } catch (error) {
      alert('Failed to fetch plugins')
      console.error('Error fetching plugins:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch tenant plugins
  const fetchTenantPlugins = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/admin/tenant-plugins', {
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tenant plugins')
      }

      const data = await response.json()
      if (data.success) {
        setTenantPlugins(data.data || [])
      }
    } catch (error) {
      alert('Failed to fetch tenant plugins')
      console.error('Error fetching tenant plugins:', error)
    } finally {
      setLoading(false)
    }
  }

  // Install plugin
  const handleInstallPlugin = async (pluginId: string) => {
    try {
      const response = await fetch('/api/admin/tenant-plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId,
          version: 'latest',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to install plugin')
      }

      const data = await response.json()
      if (data.success) {
        alert('Plugin installed successfully!')
        fetchTenantPlugins()
      }
    } catch (error) {
      alert('Failed to install plugin')
      console.error('Error installing plugin:', error)
    }
  }

  // Activate plugin
  const handleActivatePlugin = async (tenantPluginId: string) => {
    try {
      const response = await fetch(`/api/admin/tenant-plugins/${tenantPluginId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to activate plugin')
      }

      alert('Plugin activated successfully!')
      fetchTenantPlugins()
    } catch (error) {
      alert('Failed to activate plugin')
      console.error('Error activating plugin:', error)
    }
  }

  // Deactivate plugin
  const handleDeactivatePlugin = async (tenantPluginId: string) => {
    try {
      const response = await fetch(`/api/admin/tenant-plugins/${tenantPluginId}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to deactivate plugin')
      }

      alert('Plugin deactivated successfully!')
      fetchTenantPlugins()
    } catch (error) {
      alert('Failed to deactivate plugin')
      console.error('Error deactivating plugin:', error)
    }
  }

  // Configure plugin
  const handleConfigurePlugin = (plugin: Plugin) => {
    setSelectedPlugin(plugin)
    setPluginConfig(plugin.settings || {})
    setIsConfigDialogOpen(true)
  }

  // Save plugin configuration
  const handleSaveConfig = async () => {
    if (!selectedPlugin) return

    try {
      const response = await fetch(`/api/admin/tenant-plugins/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: selectedPlugin.id,
          config: pluginConfig,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save plugin configuration')
      }

      alert('Plugin configuration saved successfully!')
      setIsConfigDialogOpen(false)
      setSelectedPlugin(null)
      fetchTenantPlugins()
    } catch (error) {
      alert('Failed to save plugin configuration')
      console.error('Error saving plugin config:', error)
    }
  }

  // Uninstall plugin
  const handleUninstallPlugin = async (tenantPluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) return

    try {
      const response = await fetch(`/api/admin/tenant-plugins/${tenantPluginId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to uninstall plugin')
      }

      alert('Plugin uninstalled successfully!')
      fetchTenantPlugins()
    } catch (error) {
      alert('Failed to uninstall plugin')
      console.error('Error uninstalling plugin:', error)
    }
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
      case 'activated':
        return 'default'
      case 'inactive':
      case 'deactivated':
        return 'secondary'
      case 'error':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'activated':
        return <Check className='h-4 w-4' />
      case 'inactive':
      case 'deactivated':
        return <Square className='h-4 w-4' />
      case 'error':
        return <X className='h-4 w-4' />
      default:
        return <Clock className='h-4 w-4' />
    }
  }

  // Initial fetch
  useEffect(() => {
    if (activeTab === 'available' || activeTab === 'marketplace') {
      fetchPlugins(1, searchTerm, categoryFilter, statusFilter)
    } else if (activeTab === 'installed') {
      fetchTenantPlugins()
    }
  }, [activeTab])

  // Handle search and filters
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'available' || activeTab === 'marketplace') {
        fetchPlugins(1, searchTerm, categoryFilter, statusFilter)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, categoryFilter, statusFilter, activeTab])

  if (loading && plugins.length === 0 && tenantPlugins.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-muted-foreground'>Loading plugins...</div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Plugin Management</h2>
        <Button onClick={() => setIsInstallDialogOpen(true)} className='flex items-center gap-2'>
          <Upload className='h-4 w-4' />
          Install Plugin
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className='flex space-x-1 border-b'>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'available'
              ? 'border-b-2 border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('available')}
        >
          Available Plugins
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'installed'
              ? 'border-b-2 border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('installed')}
        >
          Installed Plugins
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'marketplace'
              ? 'border-b-2 border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('marketplace')}
        >
          Plugin Marketplace
        </button>
      </div>

      {/* Available Plugins Tab */}
      {(activeTab === 'available' || activeTab === 'marketplace') && (
        <Card>
          <CardHeader>
            <CardTitle>Available Plugins ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className='flex gap-4 mb-6'>
              <div className='flex-1'>
                <div className='relative'>
                  <Search className='absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
                  <Input
                    placeholder='Search plugins...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-10'
                  />
                </div>
              </div>
              <div className='w-48'>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <div className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm'>
                    <span className='block truncate'>
                      {categories.find((cat) => cat.value === categoryFilter)?.label ||
                        'All Categories'}
                    </span>
                  </div>
                  <SelectContent>
                    {categories.map((cat) => (
                      <div
                        key={cat.value}
                        className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                        onClick={() => setCategoryFilter(cat.value)}
                      >
                        {cat.label}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='w-32'>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <div className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm'>
                    <span className='block truncate'>{statusFilter || 'All Status'}</span>
                  </div>
                  <SelectContent>
                    <div
                      className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                      onClick={() => setStatusFilter('')}
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
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Plugin Grid */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {plugins.map((plugin) => (
                <Card key={plugin.id} className='hover:shadow-md transition-shadow'>
                  <CardHeader className='pb-3'>
                    <div className='flex items-center justify-between'>
                      <CardTitle className='text-lg'>{plugin.name}</CardTitle>
                      <Badge variant={getStatusBadgeVariant(plugin.status)}>{plugin.status}</Badge>
                      {plugin.isSystem && (
                        <Badge variant='outline' className='ml-2'>
                          <Shield className='h-3 w-3 mr-1' />
                          System
                        </Badge>
                      )}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      v{plugin.version} • {plugin.category}
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <p className='text-sm text-muted-foreground line-clamp-2'>
                      {plugin.description || 'No description available'}
                    </p>

                    <div className='flex items-center justify-between text-sm'>
                      <span>by {plugin.author || 'Unknown'}</span>
                      <div className='flex gap-2'>
                        {plugin.homepage && (
                          <Button variant='outline' size='sm'>
                            <Package className='h-4 w-4 mr-1' />
                            Details
                          </Button>
                        )}
                        <Button size='sm' onClick={() => handleInstallPlugin(plugin.id)}>
                          <Download className='h-4 w-4 mr-1' />
                          Install
                        </Button>
                      </div>
                    </div>

                    {plugin.tags.length > 0 && (
                      <div className='flex flex-wrap gap-1'>
                        {plugin.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant='outline' className='text-xs'>
                            {tag}
                          </Badge>
                        ))}
                        {plugin.tags.length > 3 && (
                          <Badge variant='outline' className='text-xs'>
                            +{plugin.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className='flex items-center justify-between space-x-2 pt-4'>
                <div className='text-sm text-muted-foreground'>
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className='flex space-x-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      fetchPlugins(pagination.page - 1, searchTerm, categoryFilter, statusFilter)
                    }
                    disabled={!pagination.hasPrevious}
                  >
                    Previous
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      fetchPlugins(pagination.page + 1, searchTerm, categoryFilter, statusFilter)
                    }
                    disabled={!pagination.hasNext}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Installed Plugins Tab */}
      {activeTab === 'installed' && (
        <Card>
          <CardHeader>
            <CardTitle>Installed Plugins ({tenantPlugins.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <thead>
                <tr>
                  <th>Plugin</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Last Used</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenantPlugins.map((tenantPlugin) => (
                  <TableRow key={tenantPlugin.id}>
                    <TableCell className='font-medium'>
                      <div className='flex items-center gap-2'>
                        {tenantPlugin.plugin.name}
                        {tenantPlugin.plugin.isSystem && (
                          <Badge variant='outline' className='ml-2'>
                            <Shield className='h-3 w-3 mr-1' />
                            System
                          </Badge>
                        )}
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        by {tenantPlugin.plugin.author || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>v{tenantPlugin.version}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        {getStatusIcon(tenantPlugin.status)}
                        <Badge variant={getStatusBadgeVariant(tenantPlugin.status)}>
                          {tenantPlugin.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenantPlugin.lastUsedAt
                        ? new Date(tenantPlugin.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' className='h-8 w-8 p-0'>
                            <Settings className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleConfigurePlugin(tenantPlugin.plugin)}
                          >
                            <Settings className='mr-2 h-4 w-4' />
                            Configure
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {tenantPlugin.status === 'activated' ? (
                            <DropdownMenuItem
                              onClick={() => handleDeactivatePlugin(tenantPlugin.id)}
                            >
                              <Square className='mr-2 h-4 w-4' />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleActivatePlugin(tenantPlugin.id)}>
                              <Play className='mr-2 h-4 w-4' />
                              Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleUninstallPlugin(tenantPlugin.id)}
                            className='text-destructive'
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Uninstall
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>

            {tenantPlugins.length === 0 && (
              <div className='text-center py-8'>
                <Package className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
                <h3 className='text-lg font-semibold mb-2'>No plugins installed</h3>
                <p className='text-muted-foreground mb-4'>
                  Install plugins to extend the functionality of your application.
                </p>
                <Button onClick={() => setIsInstallDialogOpen(true)}>
                  <Plus className='mr-2 h-4 w-4' />
                  Browse Available Plugins
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plugin Configuration Dialog */}
      {isConfigDialogOpen && selectedPlugin && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-background rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold'>Configure {selectedPlugin.name}</h3>
              <Button variant='ghost' onClick={() => setIsConfigDialogOpen(false)}>
                <X className='h-4 w-4' />
              </Button>
            </div>

            <div className='space-y-4'>
              <div>
                <h4 className='font-medium mb-2'>Plugin Information</h4>
                <div className='grid grid-cols-2 gap-4 text-sm'>
                  <div>
                    <span className='text-muted-foreground'>Version:</span>
                    <div>v{selectedPlugin.version}</div>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Author:</span>
                    <div>{selectedPlugin.author || 'Unknown'}</div>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Category:</span>
                    <div>{selectedPlugin.category}</div>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Status:</span>
                    <div>
                      <Badge variant={getStatusBadgeVariant(selectedPlugin.status)}>
                        {selectedPlugin.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {selectedPlugin.description && (
                <div>
                  <h4 className='font-medium mb-2'>Description</h4>
                  <p className='text-sm text-muted-foreground'>{selectedPlugin.description}</p>
                </div>
              )}

              <div>
                <h4 className='font-medium mb-2'>Configuration</h4>
                <div className='space-y-3'>
                  {Object.entries(selectedPlugin.settings || {}).map(([key, _value]) => (
                    <div key={key} className='flex items-center justify-between'>
                      <label className='text-sm font-medium'>{key}</label>
                      <Input
                        value={pluginConfig[key]?.toString() || ''}
                        onChange={(e) =>
                          setPluginConfig((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className='w-48'
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className='flex justify-end space-x-2 mt-6'>
              <Button variant='outline' onClick={() => setIsConfigDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveConfig}>Save Configuration</Button>
            </div>
          </div>
        </div>
      )}

      {/* Install Plugin Dialog (Placeholder) */}
      {isInstallDialogOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-background rounded-lg p-6 w-full max-w-md'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold'>Install Plugin</h3>
              <Button variant='ghost' onClick={() => setIsInstallDialogOpen(false)}>
                <X className='h-4 w-4' />
              </Button>
            </div>

            <div className='text-center py-8'>
              <Code className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
              <p className='text-muted-foreground mb-4'>
                Plugin installation from file will be available in the next version.
              </p>
              <p className='text-sm text-muted-foreground'>
                For now, you can install plugins from the Available Plugins tab.
              </p>
            </div>

            <div className='flex justify-end'>
              <Button onClick={() => setIsInstallDialogOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
