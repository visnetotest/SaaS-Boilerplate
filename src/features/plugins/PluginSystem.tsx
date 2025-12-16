'use client'

import { AlertTriangle, Download, Plus, Power, Search, Settings, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  category?: string
  tags?: string[]
  status: 'active' | 'inactive' | 'error'
  isSystem: boolean
  manifest?: Record<string, any>
  settings?: Record<string, any>
  createdAt: string
  updatedAt: string
}

interface TenantPlugin {
  id: string
  tenantId: string
  pluginId: string
  status: 'installed' | 'activated' | 'deactivated' | 'error'
  version: string
  config?: Record<string, any>
  settings?: Record<string, any>
  installedBy?: string
  installedAt: string
  activatedAt?: string
  lastUsedAt?: string
}

// Mock data
const mockPlugins: Plugin[] = [
  {
    id: 'plugin-1',
    name: 'Analytics Dashboard',
    slug: 'analytics-dashboard',
    version: '1.2.0',
    description: 'Advanced analytics and reporting dashboard',
    author: 'SaaS Team',
    category: 'Analytics',
    tags: ['dashboard', 'analytics', 'reporting'],
    status: 'active',
    isSystem: false,
    repository: 'https://github.com/saas/analytics-plugin',
    homepage: 'https://analytics-plugin.saas.com',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'plugin-2',
    name: 'Email Templates',
    slug: 'email-templates',
    version: '2.1.0',
    description: 'Custom email template system',
    author: 'SaaS Team',
    category: 'Communication',
    tags: ['email', 'templates', 'marketing'],
    status: 'inactive',
    isSystem: false,
    repository: 'https://github.com/saas/email-templates',
    homepage: 'https://email-templates.saas.com',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
  {
    id: 'plugin-3',
    name: 'Workflow Automation',
    slug: 'workflow-automation',
    version: '1.0.0',
    description: 'Automated workflow builder and executor',
    author: 'SaaS Team',
    category: 'Automation',
    tags: ['workflow', 'automation', 'business-logic'],
    status: 'active',
    isSystem: false,
    repository: 'https://github.com/saas/workflow-plugin',
    homepage: 'https://workflow-plugin.saas.com',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
  },
]

const mockTenantPlugins: TenantPlugin[] = [
  {
    id: 'tenant-plugin-1',
    tenantId: 'tenant-1',
    pluginId: 'plugin-1',
    status: 'activated',
    version: '1.2.0',
    config: { refreshInterval: '5m', defaultDashboard: 'overview' },
    settings: { enableAdvancedFeatures: true, exportFormat: 'pdf' },
    installedAt: '2024-01-02T00:00:00Z',
    activatedAt: '2024-01-02T01:00:00Z',
    lastUsedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 'tenant-plugin-2',
    tenantId: 'tenant-1',
    pluginId: 'plugin-3',
    status: 'installed',
    version: '1.0.0',
    config: { maxWorkflows: 10, timeoutMs: 30000 },
    settings: {},
    installedAt: '2024-01-08T00:00:00Z',
  },
]

// Components
export function PluginManagement() {
  const [plugins] = useState<Plugin[]>(mockPlugins)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredPlugins = plugins.filter((plugin) => {
    const matchesSearch =
      plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = categoryFilter === 'all' || plugin.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || plugin.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const handleInstallPlugin = (pluginId: string) => {
    console.log('Install plugin:', pluginId)
  }

  const handleConfigurePlugin = (pluginId: string) => {
    console.log('Configure plugin:', pluginId)
  }

  const handleUninstallPlugin = (pluginId: string) => {
    console.log('Uninstall plugin:', pluginId)
  }

  const getPluginIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Power className='h-4 w-4 text-green-500' />
      case 'inactive':
        return <Power className='h-4 w-4 text-gray-400' />
      case 'error':
        return <AlertTriangle className='h-4 w-4 text-red-500' />
      default:
        return <Settings className='h-4 w-4' />
    }
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Plugin Marketplace</h2>
        <Button onClick={() => handleInstallPlugin('')} className='flex items-center gap-2'>
          <Plus className='h-4 w-4' />
          Install Plugin
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
                <input
                  type='text'
                  placeholder='Search plugins...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className='h-10 rounded-md border px-3 py-2'
            >
              <option value='all'>All Categories</option>
              <option value='Analytics'>Analytics</option>
              <option value='Communication'>Communication</option>
              <option value='Automation'>Automation</option>
              <option value='Integration'>Integration</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='h-10 rounded-md border px-3 py-2'
            >
              <option value='all'>All Status</option>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
              <option value='error'>Error</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {filteredPlugins.map((plugin) => (
          <Card key={plugin.id} className='hover:shadow-lg transition-shadow'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  {getPluginIcon(plugin.status)}
                  <div>
                    <h3 className='font-semibold'>{plugin.name}</h3>
                    <p className='text-sm text-gray-600'>{plugin.version}</p>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <Badge variant='outline'>{plugin.category}</Badge>
                  {plugin.isSystem && <Badge variant='secondary'>System</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                {plugin.description && (
                  <p className='text-sm text-gray-600'>{plugin.description}</p>
                )}

                {plugin.author && <div className='text-sm text-gray-500'>By {plugin.author}</div>}

                {plugin.tags && plugin.tags.length > 0 && (
                  <div className='flex flex-wrap gap-1'>
                    {plugin.tags.map((tag) => (
                      <Badge key={tag} variant='secondary' className='text-xs'>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => window.open(plugin.repository, '_blank')}
                  >
                    <Download className='h-4 w-4 mr-2' />
                    Source
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => window.open(plugin.homepage, '_blank')}
                  >
                    <Settings className='h-4 w-4 mr-2' />
                    Docs
                  </Button>
                  {plugin.status === 'inactive' ? (
                    <Button size='sm' onClick={() => handleInstallPlugin(plugin.id)}>
                      <Plus className='h-4 w-4 mr-2' />
                      Install
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleConfigurePlugin(plugin.id)}
                      >
                        <Settings className='h-4 w-4 mr-2' />
                        Configure
                      </Button>
                      {!plugin.isSystem && (
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={() => handleUninstallPlugin(plugin.id)}
                        >
                          <Trash2 className='h-4 w-4 mr-2' />
                          Uninstall
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function TenantPluginManagement() {
  const [tenantPlugins] = useState<TenantPlugin[]>(mockTenantPlugins)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredPlugins = tenantPlugins.filter((tenantPlugin) => {
    // Get plugin name from mock data for display
    const plugin = mockPlugins.find((p) => p.id === tenantPlugin.pluginId)
    if (!plugin) return false

    const matchesSearch =
      plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tenantPlugin.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getPluginName = (pluginId: string) => {
    const plugin = mockPlugins.find((p) => p.id === pluginId)
    return plugin?.name || 'Unknown Plugin'
  }

  const getPluginIcon = (status: string) => {
    switch (status) {
      case 'activated':
        return <Power className='h-4 w-4 text-green-500' />
      case 'installed':
        return <Settings className='h-4 w-4 text-blue-500' />
      case 'deactivated':
        return <Power className='h-4 w-4 text-gray-400' />
      case 'error':
        return <AlertTriangle className='h-4 w-4 text-red-500' />
      default:
        return <Settings className='h-4 w-4' />
    }
  }

  const handleActivatePlugin = (pluginId: string) => {
    console.log('Activate plugin:', pluginId)
  }

  const handleDeactivatePlugin = (pluginId: string) => {
    console.log('Deactivate plugin:', pluginId)
  }

  const handleConfigurePlugin = (pluginId: string) => {
    console.log('Configure plugin:', pluginId)
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Installed Plugins</h2>
        <Button className='flex items-center gap-2'>
          <Plus className='h-4 w-4' />
          Browse Marketplace
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
                <input
                  type='text'
                  placeholder='Search installed plugins...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='h-10 rounded-md border px-3 py-2'
            >
              <option value='all'>All Status</option>
              <option value='activated'>Activated</option>
              <option value='installed'>Installed</option>
              <option value='deactivated'>Deactivated</option>
              <option value='error'>Error</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className='space-y-4'>
        {filteredPlugins.map((tenantPlugin) => (
          <Card key={tenantPlugin.id}>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  {getPluginIcon(tenantPlugin.status)}
                  <div>
                    <h3 className='font-semibold'>{getPluginName(tenantPlugin.pluginId)}</h3>
                    <p className='text-sm text-gray-600'>v{tenantPlugin.version}</p>
                  </div>
                </div>
                <Badge variant={tenantPlugin.status === 'activated' ? 'default' : 'secondary'}>
                  {tenantPlugin.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                <div className='text-sm text-gray-600'>
                  Installed {new Date(tenantPlugin.installedAt).toLocaleDateString()}
                </div>

                {tenantPlugin.activatedAt && (
                  <div className='text-sm text-gray-600'>
                    Activated {new Date(tenantPlugin.activatedAt).toLocaleDateString()}
                  </div>
                )}

                {tenantPlugin.lastUsedAt && (
                  <div className='text-sm text-gray-600'>
                    Last used {new Date(tenantPlugin.lastUsedAt).toLocaleDateString()}
                  </div>
                )}

                <div className='flex gap-2'>
                  {tenantPlugin.status === 'installed' && (
                    <Button size='sm' onClick={() => handleActivatePlugin(tenantPlugin.id)}>
                      <Power className='h-4 w-4 mr-2' />
                      Activate
                    </Button>
                  )}
                  {tenantPlugin.status === 'activated' && (
                    <>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleConfigurePlugin(tenantPlugin.id)}
                      >
                        <Settings className='h-4 w-4 mr-2' />
                        Configure
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleDeactivatePlugin(tenantPlugin.id)}
                      >
                        <Power className='h-4 w-4 mr-2' />
                        Deactivate
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Main Plugin System Component
export function PluginSystem() {
  const [activeSection, setActiveSection] = useState('marketplace')

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <div className='flex items-center gap-4 mb-8'>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center'>
            <Power className='h-4 w-4 text-white' />
          </div>
        </div>
        <h1 className='text-3xl font-bold'>Plugin System</h1>
      </div>

      <div className='flex gap-4 mb-6 border-b'>
        <button
          onClick={() => setActiveSection('marketplace')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeSection === 'marketplace'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Marketplace
        </button>
        <button
          onClick={() => setActiveSection('installed')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeSection === 'installed'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Installed Plugins
        </button>
      </div>

      <div className='space-y-6'>
        {activeSection === 'marketplace' && <PluginManagement />}
        {activeSection === 'installed' && <TenantPluginManagement />}
      </div>
    </div>
  )
}
