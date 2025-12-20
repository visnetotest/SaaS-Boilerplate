'use client'

import { Activity, Building2, GitBranch, Plus, Settings, Shield, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CreateTenantDialog, TenantHierarchyTree } from '@/components/admin/TenantHierarchyTree'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TenantTree } from '@/services/admin-tenant-hierarchy'
import { tenantHierarchyService } from '@/services/admin-tenant-hierarchy'

export default function TenantHierarchyManagement() {
  const [hierarchy, setHierarchy] = useState<TenantTree | null>(null)
  const [selectedTenant, setSelectedTenant] = useState<TenantTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    loadHierarchy()
  }, [])

  const loadHierarchy = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get root tenants (those without parent)
      // For now, we'll create a mock hierarchy
      const mockHierarchy: TenantTree = {
        id: 'root-1',
        name: 'Acme Corporation',
        slug: 'acme-corp',
        status: 'active',
        hierarchyLevel: 0,
        path: '/acme-corp',
        settings: {
          theme: 'dark',
          timezone: 'UTC',
          locale: 'en',
        },
        metadata: {
          description: 'Main corporate tenant',
          industry: 'Technology',
        },
        children: [
          {
            id: 'child-1',
            name: 'North America Region',
            slug: 'acme-corp-na',
            status: 'active',
            hierarchyLevel: 1,
            path: '/acme-corp/acme-corp-na',
            settings: {
              timezone: 'America/New_York',
              locale: 'en-US',
            },
            metadata: {
              description: 'North American operations',
              region: 'NA',
            },
            children: [
              {
                id: 'child-1-1',
                name: 'US East Division',
                slug: 'acme-corp-na-east',
                status: 'active',
                hierarchyLevel: 2,
                path: '/acme-corp/acme-corp-na/acme-corp-na-east',
                settings: {},
                metadata: {},
                children: [],
              },
              {
                id: 'child-1-2',
                name: 'US West Division',
                slug: 'acme-corp-na-west',
                status: 'active',
                hierarchyLevel: 2,
                path: '/acme-corp/acme-corp-na/acme-corp-na-west',
                settings: {},
                metadata: {},
                children: [],
              },
            ],
          },
          {
            id: 'child-2',
            name: 'Europe Region',
            slug: 'acme-corp-eu',
            status: 'active',
            hierarchyLevel: 1,
            path: '/acme-corp/acme-corp-eu',
            settings: {
              timezone: 'Europe/London',
              locale: 'en-GB',
            },
            metadata: {
              description: 'European operations',
              region: 'EU',
            },
            children: [],
          },
        ],
      }

      setHierarchy(mockHierarchy)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hierarchy')
    } finally {
      setLoading(false)
    }
  }

  const handleTenantSelect = (tenant: TenantTree) => {
    setSelectedTenant(tenant)
  }

  const handleTenantCreate = async (parentId: string, data: any) => {
    try {
      await tenantHierarchyService.createTenant({
        ...data,
        parentTenantId: parentId,
      })
      await loadHierarchy() // Refresh hierarchy
    } catch (err) {
      console.error('Failed to create tenant:', err)
    }
  }

  const handleTenantMove = async (tenantId: string, newParentId?: string) => {
    try {
      await tenantHierarchyService.moveTenant(tenantId, newParentId)
      await loadHierarchy() // Refresh hierarchy
    } catch (err) {
      console.error('Failed to move tenant:', err)
    }
  }

  const handleTenantDelete = async (tenantId: string) => {
    if (!confirm('Are you sure you want to delete this tenant and all its children?')) {
      return
    }

    try {
      // TODO: Implement delete functionality
      console.log('Delete tenant:', tenantId)
      await loadHierarchy() // Refresh hierarchy
    } catch (err) {
      console.error('Failed to delete tenant:', err)
    }
  }

  if (loading) {
    return (
      <div className='container mx-auto p-6'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-lg'>Loading tenant hierarchy...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='container mx-auto p-6'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-lg text-destructive'>Error: {error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className='container mx-auto p-6'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold mb-2'>Tenant Hierarchy Management</h1>
        <p className='text-muted-foreground'>
          Manage multi-tenant hierarchy with inheritance and role-based access control
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Hierarchy Tree */}
        <div className='lg:col-span-2'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between'>
              <CardTitle className='flex items-center gap-2'>
                <Building2 className='h-5 w-5' />
                Tenant Hierarchy
              </CardTitle>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className='h-4 w-4 mr-2' />
                Create Root Tenant
              </Button>
            </CardHeader>
            <CardContent className='p-0'>
              {hierarchy ? (
                <div className='p-4'>
                  <TenantHierarchyTree
                    tenant={hierarchy}
                    canManage={true}
                    onTenantSelect={handleTenantSelect}
                    onTenantCreate={handleTenantCreate}
                    onTenantMove={handleTenantMove}
                    onTenantDelete={handleTenantDelete}
                  />
                </div>
              ) : (
                <div className='p-8 text-center text-muted-foreground'>
                  No hierarchy data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tenant Details */}
        <div className='lg:col-span-1'>
          {selectedTenant && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Settings className='h-5 w-5' />
                  Tenant Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value='overview' className='w-full'>
                  <TabsList className='grid w-full grid-cols-3'>
                    <TabsTrigger value='overview'>Overview</TabsTrigger>
                    <TabsTrigger value='users'>Users</TabsTrigger>
                    <TabsTrigger value='settings'>Settings</TabsTrigger>
                  </TabsList>

                  <TabsContent value='overview' className='space-y-4'>
                    <div>
                      <h3 className='font-semibold'>{selectedTenant.name}</h3>
                      <p className='text-sm text-muted-foreground'>{selectedTenant.slug}</p>
                    </div>

                    <div className='space-y-2'>
                      <div className='flex justify-between'>
                        <span className='text-sm'>Status:</span>
                        <Badge
                          variant={selectedTenant.status === 'active' ? 'default' : 'secondary'}
                        >
                          {selectedTenant.status}
                        </Badge>
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-sm'>Hierarchy Level:</span>
                        <span className='text-sm'>{selectedTenant.hierarchyLevel}</span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-sm'>Children:</span>
                        <span className='text-sm'>{selectedTenant.children.length}</span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-sm'>Path:</span>
                        <span className='text-sm font-mono'>{selectedTenant.path}</span>
                      </div>
                    </div>

                    {selectedTenant.metadata && Object.keys(selectedTenant.metadata).length > 0 && (
                      <div>
                        <h4 className='font-medium mb-2'>Metadata</h4>
                        <div className='space-y-1'>
                          {Object.entries(selectedTenant.metadata).map(([key, value]) => (
                            <div key={key} className='flex justify-between text-sm'>
                              <span>{key}:</span>
                              <span>{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value='users' className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <h4 className='font-medium'>Users</h4>
                      <Button size='sm' variant='outline'>
                        <Users className='h-4 w-4 mr-1' />
                        Manage Users
                      </Button>
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      User management for this tenant will be implemented with RBAC integration.
                    </p>
                  </TabsContent>

                  <TabsContent value='settings' className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <h4 className='font-medium'>Settings</h4>
                      <Button size='sm' variant='outline'>
                        <Settings className='h-4 w-4 mr-1' />
                        Configure
                      </Button>
                    </div>
                    {selectedTenant.settings && Object.keys(selectedTenant.settings).length > 0 ? (
                      <div className='space-y-2'>
                        {Object.entries(selectedTenant.settings).map(([key, value]) => (
                          <div key={key} className='flex justify-between text-sm'>
                            <span>{key}:</span>
                            <span>{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className='text-sm text-muted-foreground'>
                        No custom settings configured.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {!selectedTenant && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Activity className='h-5 w-5' />
                  Hierarchy Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex items-center gap-2'>
                    <Building2 className='h-4 w-4 text-blue-500' />
                    <span className='text-sm'>Root Tenants: 1</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <GitBranch className='h-4 w-4 text-green-500' />
                    <span className='text-sm'>Total Branches: 3</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Shield className='h-4 w-4 text-purple-500' />
                    <span className='text-sm'>Max Depth: 3 levels</span>
                  </div>

                  <div className='pt-4 border-t'>
                    <p className='text-sm text-muted-foreground'>
                      Select a tenant from the hierarchy to view details and manage settings.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showCreateDialog && (
        <CreateTenantDialog
          availableParents={[]}
          onTenantCreate={(parentId, data) => {
            handleTenantCreate(parentId || '', data)
            setShowCreateDialog(false)
          }}
          trigger={null}
        />
      )}
    </div>
  )
}
