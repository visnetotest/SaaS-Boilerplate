'use client'

import {
  AlertCircle,
  Code,
  Eye,
  Loader2,
  Package,
  Plus,
  Power,
  Search,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react'
import React, { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { pluginRuntime } from '@/services/PluginRuntime'

// Types
interface Plugin {
  id: string
  name: string
  slug: string
  version: string
  description: string
  author: string
  category: string
  status: 'active' | 'inactive' | 'error'
  tags: string[]
  createdAt: string
  installedAt?: string
  lastUsedAt?: string
  health: 'healthy' | 'warning' | 'error'
  executionCount: number
}

function PluginCard({
  plugin,
  onToggle,
  onConfigure,
  onUninstall,
}: {
  plugin: Plugin
  onToggle: (id: string, status: string) => void
  onConfigure: (id: string) => void
  onUninstall: (id: string) => void
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'analytics':
        return 'bg-blue-100 text-blue-800'
      case 'authentication':
        return 'bg-purple-100 text-purple-800'
      case 'payment':
        return 'bg-green-100 text-green-800'
      case 'communication':
        return 'bg-orange-100 text-orange-800'
      case 'integration':
        return 'bg-indigo-100 text-indigo-800'
      case 'automation':
        return 'bg-pink-100 text-pink-800'
      case 'ui':
        return 'bg-cyan-100 text-cyan-800'
      case 'security':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className='relative'>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div>
            <CardTitle className='text-lg'>{plugin.name}</CardTitle>
            <p className='text-sm text-muted-foreground'>
              {plugin.description || 'No description available'}
            </p>
            <div className='flex items-center gap-2 mt-2'>
              <Badge className={getCategoryColor(plugin.category)}>{plugin.category}</Badge>
              <Badge variant='outline'>v{plugin.version}</Badge>
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Badge className={getStatusColor(plugin.status)}>{plugin.status}</Badge>

          <Button variant='ghost' size='sm'>
            <Settings className='h-4 w-4' />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className='space-y-4'>
          {/* Plugin Metadata */}
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='font-medium'>Author:</span>
              <span className='text-muted-foreground'>{plugin.author || 'Unknown'}</span>
            </div>
            <div>
              <span className='font-medium'>Created:</span>
              <span className='text-muted-foreground'>
                {new Date(plugin.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className='font-medium'>Health:</span>
              <span className={getHealthColor(plugin.health)}>
                <div className='flex items-center gap-1'>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      plugin.health === 'healthy'
                        ? 'bg-green-500'
                        : plugin.health === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                  />
                  {plugin.health}
                </div>
              </span>
            </div>
            <div>
              <span className='font-medium'>Executions:</span>
              <span className='text-muted-foreground'>{plugin.executionCount}</span>
            </div>
          </div>
        </div>

        {/* Plugin Actions */}
        <div className='flex gap-2 pt-4'>
          <Button
            variant={plugin.status === 'active' ? 'outline' : 'default'}
            size='sm'
            onClick={() => onToggle(plugin.id, plugin.status)}
          >
            {plugin.status === 'active' ? 'Disable' : 'Enable'}
          </Button>

          <Button variant='outline' size='sm' onClick={() => onConfigure(plugin.id)}>
            <Settings className='h-4 w-4 mr-2' />
            Configure
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={() => onUninstall(plugin.id)}
            className='text-red-600 hover:text-red-700'
          >
            <Trash2 className='h-4 w-4 mr-2' />
            Uninstall
          </Button>
        </div>

        {/* Tags */}
        {plugin.tags.length > 0 && (
          <div className='flex flex-wrap gap-1 pt-2'>
            {plugin.tags.map((tag) => (
              <Badge key={tag} variant='secondary' className='text-xs'>
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Installation Info */}
        {plugin.installedAt && (
          <div className='text-xs text-muted-foreground border-t pt-3 mt-3'>
            <div>Installed: {new Date(plugin.installedAt).toLocaleString()}</div>
            {plugin.lastUsedAt && (
              <div>Last Used: {new Date(plugin.lastUsedAt).toLocaleString()}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PluginManagement() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Mock data
  const mockPlugins: Plugin[] = [
    {
      id: '1',
      name: 'Analytics Dashboard',
      slug: 'analytics-dashboard',
      version: '1.0.0',
      description: 'Enhanced analytics dashboard with real-time metrics',
      author: 'System',
      category: 'analytics',
      status: 'active',
      tags: ['analytics', 'dashboard', 'metrics'],
      createdAt: '2024-01-15',
      installedAt: '2024-01-15',
      lastUsedAt: '2024-01-20',
      health: 'healthy',
      executionCount: 1250,
    },
    {
      id: '2',
      name: 'Email Notifications',
      slug: 'email-notifications',
      version: '2.1.0',
      description: 'Send email notifications for various events',
      author: 'System',
      category: 'communication',
      status: 'active',
      tags: ['email', 'notifications', 'smtp'],
      createdAt: '2024-01-10',
      installedAt: '2024-01-10',
      lastUsedAt: '2024-01-19',
      health: 'healthy',
      executionCount: 890,
    },
    {
      id: '3',
      name: 'User Management',
      slug: 'user-management',
      version: '1.2.0',
      description: 'Advanced user management with RBAC',
      author: 'System',
      category: 'authentication',
      status: 'inactive',
      tags: ['users', 'rbac', 'management'],
      createdAt: '2024-01-05',
      installedAt: '2024-01-05',
      lastUsedAt: '2024-01-18',
      health: 'warning',
      executionCount: 450,
    },
    {
      id: '4',
      name: 'Payment Gateway',
      slug: 'payment-gateway',
      version: '1.0.0',
      description: 'Stripe integration for payment processing',
      author: 'ThirdParty',
      category: 'payment',
      status: 'error',
      tags: ['payment', 'stripe', 'billing'],
      createdAt: '2024-01-20',
      installedAt: '2024-01-20',
      lastUsedAt: '2024-01-22',
      health: 'error',
      executionCount: 0,
    },
  ]

  // Load plugins
  const loadPlugins = async () => {
    try {
      setLoading(true)
      // In a real implementation, this would call the plugin runtime API
      const pluginList = pluginRuntime.listPlugins()

      // Transform to expected format
      const transformedPlugins: Plugin[] = pluginList.map((plugin) => ({
        id: plugin.id,
        name: plugin.manifest?.name || plugin.pluginId,
        slug: plugin.pluginId,
        version: plugin.manifest?.version || '1.0.0',
        description: plugin.manifest?.description || '',
        author: plugin.manifest?.author || 'Unknown',
        category: plugin.manifest?.category || 'utility',
        status: plugin.status as 'active' | 'inactive' | 'error',
        tags: plugin.manifest?.tags || [],
        createdAt: plugin.loadedAt?.toISOString() || new Date().toISOString(),
        installedAt: plugin.loadedAt?.toISOString(),
        lastUsedAt: plugin.loadedAt?.toISOString(),
        health: 'healthy', // Would be determined by health checks
        executionCount: plugin.executionCount || 0,
      }))

      setPlugins(transformedPlugins)
    } catch (error) {
      console.error('Failed to load plugins:', error)
      // Set mock data as fallback
      setPlugins(mockPlugins)
    } finally {
      setLoading(false)
    }
  }

  // Plugin actions
  const handleTogglePlugin = async (pluginId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'active') {
        await pluginRuntime.disablePlugin(pluginId)
      } else {
        await pluginRuntime.enablePlugin(pluginId)
      }
      await loadPlugins() // Refresh list
    } catch (error) {
      console.error('Failed to toggle plugin:', error)
    }
  }

  const handleConfigurePlugin = (pluginId: string) => {
    // Open configuration dialog or navigate to config page
    console.log('Configure plugin:', pluginId)
  }

  const handleUninstallPlugin = async (pluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) {
      return
    }

    try {
      await pluginRuntime.unregisterPlugin(pluginId)
      await loadPlugins() // Refresh list
    } catch (error) {
      console.error('Failed to uninstall plugin:', error)
    }
  }

  const handleInstallPlugin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const manifestFile = formData.get('manifest') as File

    if (!manifestFile) {
      return
    }

    try {
      setUploading(true)

      // Read and validate plugin manifest
      const manifestText = await manifestFile.text()
      JSON.parse(manifestText) // Validate JSON format

      // Install plugin
      await pluginRuntime.registerPlugin('', undefined) // In real implementation, pass manifest file path

      setShowInstallDialog(false)
      await loadPlugins() // Refresh list
    } catch (error) {
      console.error('Failed to install plugin:', error)
    } finally {
      setUploading(false)
    }
  }

  // Filter plugins
  const filteredPlugins = plugins.filter((plugin) => {
    const matchesSearch =
      !searchTerm ||
      plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'all' || plugin.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || plugin.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
  })

  // Initialize
  React.useEffect(() => {
    loadPlugins()
  }, [])

  if (loading && plugins.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='flex items-center gap-2'>
          <Loader2 className='h-4 w-4 animate-spin' />
          <span className='text-muted-foreground'>Loading plugins...</span>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Plugin Management</h2>
        <div className='flex gap-2'>
          <Button onClick={() => setShowInstallDialog(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Install Plugin
          </Button>
          <Button variant='outline'>
            <Upload className='h-4 w-4 mr-2' />
            Browse Marketplace
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
        <Card>
          <CardContent className='p-4 text-center'>
            <Package className='h-8 w-8 mx-auto mb-2 text-blue-600' />
            <div className='text-2xl font-bold'>{plugins.length}</div>
            <div className='text-sm text-muted-foreground'>Total Plugins</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4 text-center'>
            <Power className='h-8 w-8 mx-auto mb-2 text-green-600' />
            <div className='text-2xl font-bold'>
              {plugins.filter((p) => p.status === 'active').length}
            </div>
            <div className='text-sm text-muted-foreground'>Active</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4 text-center'>
            <AlertCircle className='h-8 w-8 mx-auto mb-2 text-yellow-600' />
            <div className='text-2xl font-bold'>
              {plugins.filter((p) => p.status === 'error').length}
            </div>
            <div className='text-sm text-muted-foreground'>Error</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4 text-center'>
            <Eye className='h-8 w-8 mx-auto mb-2 text-purple-600' />
            <div className='text-2xl font-bold'>{filteredPlugins.length}</div>
            <div className='text-sm text-muted-foreground'>Filtered</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
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
                  placeholder='Search plugins...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>

            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <span className='block truncate'>
                    {statusFilter === 'all'
                      ? 'All Status'
                      : statusFilter === 'active'
                        ? 'Active'
                        : statusFilter === 'inactive'
                          ? 'Inactive'
                          : 'Error'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Status</SelectItem>
                  <SelectItem value='active'>Active</SelectItem>
                  <SelectItem value='inactive'>Inactive</SelectItem>
                  <SelectItem value='error'>Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <span className='block truncate'>
                    {categoryFilter === 'all'
                      ? 'All Categories'
                      : categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Categories</SelectItem>
                  <SelectItem value='analytics'>Analytics</SelectItem>
                  <SelectItem value='authentication'>Authentication</SelectItem>
                  <SelectItem value='payment'>Payment</SelectItem>
                  <SelectItem value='communication'>Communication</SelectItem>
                  <SelectItem value='integration'>Integration</SelectItem>
                  <SelectItem value='automation'>Automation</SelectItem>
                  <SelectItem value='ui'>UI</SelectItem>
                  <SelectItem value='security'>Security</SelectItem>
                  <SelectItem value='monitoring'>Monitoring</SelectItem>
                  <SelectItem value='storage'>Storage</SelectItem>
                  <SelectItem value='utility'>Utility</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plugin Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {filteredPlugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onToggle={handleTogglePlugin}
            onConfigure={handleConfigurePlugin}
            onUninstall={handleUninstallPlugin}
          />
        ))}
      </div>

      {/* Install Plugin Dialog */}
      {showInstallDialog && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <div className='fixed inset-0 bg-black/50' onClick={() => setShowInstallDialog(false)} />
          <div className='relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold'>Install Plugin</h3>
              <Button variant='ghost' size='sm' onClick={() => setShowInstallDialog(false)}>
                ×
              </Button>
            </div>

            <form onSubmit={handleInstallPlugin}>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium mb-1'>Plugin Manifest File</label>
                  <Input
                    type='file'
                    name='manifest'
                    accept='.json'
                    required
                    className='file:mt-0'
                  />
                </div>

                <div className='text-sm text-muted-foreground'>
                  Upload a plugin.json file or select from the marketplace
                </div>
              </div>

              <div className='flex justify-end gap-2 pt-4'>
                <Button variant='outline' onClick={() => setShowInstallDialog(false)}>
                  Cancel
                </Button>
                <Button type='submit' disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Code className='h-4 w-4 mr-2' />
                      Install Plugin
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
