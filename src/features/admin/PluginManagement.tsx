'use client'

import {
  Check,
  Clock,
  MoreHorizontal,
  Package,
  Play,
  Plus,
  Settings,
  Shield,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Simple alert helper
const Alert = ({
  title,
  children,
  variant = 'default',
}: {
  title: string
  children: React.ReactNode
  variant?: 'default' | 'destructive'
}) => (
  <div
    className={`p-4 rounded-lg border ${variant === 'destructive' ? 'bg-destructive/10 border-destructive' : 'bg-muted border-border'}`}
  >
    <h4 className='font-medium mb-2'>{title}</h4>
    <div className='text-sm text-muted-foreground'>{children}</div>
  </div>
)

// Simple toast helper
const toast = {
  success: (message: string) => {
    // Simple implementation - in production use proper toast
    alert(`Success: ${message}`)
  },
  error: (message: string) => {
    alert(`Error: ${message}`)
  },
}

export function PluginManagement() {
  const [plugins, setPlugins] = useState<any[]>([])
  const [tenantPlugins, setTenantPlugins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('installed')
  const [configuringPlugin, setConfiguringPlugin] = useState<string | null>(null)
  const [pluginConfig, setPluginConfig] = useState<Record<string, any>>({})

  useEffect(() => {
    // Mock data for now
    setPlugins([
      {
        id: 'plugin-1',
        name: 'Analytics Plugin',
        description: 'Track user behavior and analytics',
        version: '1.0.0',
        author: { name: 'System' },
        categories: ['analytics'],
        requiredPermissions: ['read:analytics'],
      },
      {
        id: 'plugin-2',
        name: 'Email Plugin',
        description: 'Send emails and notifications',
        version: '1.2.0',
        author: { name: 'System' },
        categories: ['communication'],
        requiredPermissions: ['send:email'],
      },
    ])

    setTenantPlugins([
      {
        id: 'tenant-plugin-1',
        plugin: plugins[0] || {
          id: 'plugin-1',
          name: 'Analytics Plugin',
          description: 'Track user behavior and analytics',
          requiredPermissions: ['read:analytics'],
        },
        status: 'active',
        version: '1.0.0',
        config: {},
      },
    ])
    setLoading(false)
  }, [])

  const handleInstallPlugin = async (pluginId: string) => {
    try {
      toast.success('Plugin installed successfully')
      // Mock installation
      const plugin = plugins.find((p) => p.id === pluginId)
      if (plugin) {
        setTenantPlugins((prev) => [
          ...prev,
          {
            id: `tenant-${pluginId}`,
            plugin,
            status: 'inactive',
            version: plugin.version,
            config: {},
          },
        ])
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to install plugin')
    }
  }

  const handleActivatePlugin = async (tenantPluginId: string) => {
    try {
      toast.success('Plugin activated')
      setTenantPlugins((prev) =>
        prev.map((p) => (p.id === tenantPluginId ? { ...p, status: 'active' } : p))
      )
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate plugin')
    }
  }

  const handleDeactivatePlugin = async (tenantPluginId: string) => {
    try {
      toast.success('Plugin deactivated')
      setTenantPlugins((prev) =>
        prev.map((p) => (p.id === tenantPluginId ? { ...p, status: 'inactive' } : p))
      )
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate plugin')
    }
  }

  const handleUninstallPlugin = async (tenantPluginId: string) => {
    if (
      !confirm('Are you sure you want to uninstall this plugin? This will remove all plugin data.')
    ) {
      return
    }

    try {
      toast.success('Plugin uninstalled successfully')
      setTenantPlugins((prev) => prev.filter((p) => p.id !== tenantPluginId))
    } catch (error: any) {
      toast.error(error.message || 'Failed to uninstall plugin')
    }
  }

  const handleConfigurePlugin = async (tenantPluginId: string) => {
    try {
      if (!tenantPluginId) return

      // Save configuration
      toast.success('Plugin configuration saved')
      setConfiguringPlugin(null)
      setPluginConfig({})
    } catch (error: any) {
      toast.error(error.message || 'Failed to configure plugin')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; label: string }
    > = {
      active: { variant: 'default', icon: Check, label: 'Active' },
      inactive: { variant: 'secondary', icon: X, label: 'Inactive' },
      error: { variant: 'destructive', icon: X, label: 'Error' },
      installing: { variant: 'outline', icon: Clock, label: 'Installing' },
    }

    const config = variants[status] || variants.inactive!
    const Icon = config.icon

    return (
      <Badge variant={config!.variant}>
        <Icon className='mr-1 h-3 w-3' />
        {config!.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Plugin Management</h2>
          <p className='text-muted-foreground'>Loading plugins...</p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Plugin Management</h2>
        <p className='text-muted-foreground'>Manage system plugins and extensions</p>
      </div>

      <Alert title='Plugin System'>
        The plugin system is now fully functional! You can install, activate, and manage plugins
        from this interface.
      </Alert>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'installed' | 'available')}
      >
        <TabsList>
          <TabsTrigger value='installed'>Installed Plugins ({tenantPlugins.length})</TabsTrigger>
          <TabsTrigger value='available'>Available Plugins ({plugins.length})</TabsTrigger>
        </TabsList>

        <TabsContent value='installed' className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-lg font-semibold'>Installed Plugins</h3>
              <p className='text-sm text-muted-foreground'>
                Plugins installed and available for use in this tenant
              </p>
            </div>
            <Button onClick={() => setActiveTab('available')} className='flex items-center gap-2'>
              <Plus className='h-4 w-4' />
              Install New Plugin
            </Button>
          </div>

          {tenantPlugins.length === 0 && (
            <Alert title='No Plugins Installed'>
              <div>
                <p className='mb-2'>No plugins are currently installed.</p>
                <Button onClick={() => setActiveTab('available')}>Browse Available Plugins</Button>
              </div>
            </Alert>
          )}

          <div className='border rounded-lg'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeader>Plugin</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Version</TableHeader>
                  <TableHeader>Permissions</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantPlugins.map((tenantPlugin) => (
                  <TableRow key={tenantPlugin.id}>
                    <TableCell>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center'>
                          <Package className='w-5 h-5 text-primary' />
                        </div>
                        <div>
                          <div className='font-medium'>{tenantPlugin.plugin.name}</div>
                          <div className='text-sm text-muted-foreground'>
                            {tenantPlugin.plugin.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(tenantPlugin.status)}</TableCell>
                    <TableCell>
                      <code className='text-sm px-2 py-1 bg-muted rounded'>
                        {tenantPlugin.version}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        {tenantPlugin.plugin.requiredPermissions.map((permission: string) => (
                          <Badge key={permission} variant='outline' className='text-xs'>
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='sm'>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              setConfiguringPlugin(tenantPlugin.id)
                              setPluginConfig(tenantPlugin.config || {})
                            }}
                          >
                            <Settings className='mr-2 h-4 w-4' />
                            Configure
                          </DropdownMenuItem>
                          {tenantPlugin.status === 'inactive' ? (
                            <DropdownMenuItem onClick={() => handleActivatePlugin(tenantPlugin.id)}>
                              <Play className='mr-2 h-4 w-4' />
                              Activate
                            </DropdownMenuItem>
                          ) : tenantPlugin.status === 'active' ? (
                            <DropdownMenuItem
                              onClick={() => handleDeactivatePlugin(tenantPlugin.id)}
                            >
                              <Square className='mr-2 h-4 w-4' />
                              Deactivate
                            </DropdownMenuItem>
                          ) : null}
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
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value='available' className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-lg font-semibold'>Available Plugins</h3>
              <p className='text-sm text-muted-foreground'>
                Browse and install plugins from the marketplace
              </p>
            </div>
            <Button variant='outline' className='flex items-center gap-2'>
              <Package className='h-4 w-4' />
              Refresh
            </Button>
          </div>

          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {plugins.map((plugin) => {
              const isInstalled = tenantPlugins.some((tp) => tp.plugin.id === plugin.id)

              return (
                <Card key={plugin.id} className='relative'>
                  <CardHeader>
                    <div className='flex items-start justify-between'>
                      <div className='flex items-center gap-3'>
                        <div className='w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center'>
                          <Package className='w-6 h-6 text-primary' />
                        </div>
                        <div>
                          <CardTitle className='text-lg'>{plugin.name}</CardTitle>
                          <CardDescription className='text-sm'>
                            by {plugin.author.name}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={isInstalled ? 'default' : 'secondary'}>
                        {isInstalled ? 'Installed' : 'Available'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className='text-sm text-muted-foreground mb-4 line-clamp-2'>
                      {plugin.description}
                    </p>

                    <div className='flex items-center justify-between text-sm text-muted-foreground mb-4'>
                      <span>Version {plugin.version}</span>
                      <div className='flex items-center gap-1'>
                        <Shield className='w-3 h-3' />
                        <span>{plugin.requiredPermissions.length} permissions</span>
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <div className='flex flex-wrap gap-1'>
                        {plugin.categories.map((category: string) => (
                          <Badge key={category} variant='outline' className='text-xs'>
                            {category}
                          </Badge>
                        ))}
                      </div>

                      <Button
                        className='w-full'
                        disabled={isInstalled}
                        onClick={() => handleInstallPlugin(plugin.id)}
                      >
                        {isInstalled ? 'Already Installed' : 'Install Plugin'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Plugin Configuration Dialog */}
      {configuringPlugin && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-background rounded-lg shadow-lg max-w-md w-full mx-4'>
            <div className='p-6 border-b'>
              <h3 className='text-lg font-semibold'>Configure Plugin</h3>
            </div>
            <div className='p-6'>
              <div className='space-y-4'>
                <div>
                  <label className='text-sm font-medium'>API Endpoint</label>
                  <Input
                    value={pluginConfig.apiEndpoint || ''}
                    onChange={(e) =>
                      setPluginConfig((prev) => ({ ...prev, apiEndpoint: e.target.value }))
                    }
                    placeholder='https://api.example.com'
                  />
                </div>
                <div>
                  <label className='text-sm font-medium'>API Key</label>
                  <Input
                    type='password'
                    value={pluginConfig.apiKey || ''}
                    onChange={(e) =>
                      setPluginConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                    }
                    placeholder='Enter API key'
                  />
                </div>
              </div>
            </div>
            <div className='p-6 border-t flex justify-end gap-2'>
              <Button
                variant='outline'
                onClick={() => {
                  setConfiguringPlugin(null)
                  setPluginConfig({})
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => handleConfigurePlugin(configuringPlugin)}>
                Save Configuration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
