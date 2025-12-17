'use client'

import { useState } from 'react'

import { Activity, BarChart3, Building, Package, Server, Settings, Shield, Users } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { EnhancedAnalyticsDashboard } from '@/components/admin/EnhancedAnalyticsDashboard'
import { ServiceRegistry } from './ServiceRegistry'
import { RBACManagementDashboard } from '@/components/admin/RBACManagementDashboard'
import { AuditLogs } from './AuditLogs'
import { PluginManagement } from './PluginManagement'
import { UserManagementDashboard } from '@/components/admin/UserManagementDashboard'
import { TenantManagementDashboard } from '@/components/admin/TenantManagementDashboard'

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <div className='flex items-center gap-4 mb-8'>
        <Settings className='h-8 w-8 text-primary' />
        <h1 className='text-3xl font-bold'>Admin Panel</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
        <TabsList className='grid w-full grid-cols-6'>
          <TabsTrigger value='overview' className='flex items-center gap-2'>
            <BarChart3 className='h-4 w-4' />
            Overview
          </TabsTrigger>
          <TabsTrigger value='users' className='flex items-center gap-2'>
            <Users className='h-4 w-4' />
            Users
          </TabsTrigger>
          <TabsTrigger value='tenants' className='flex items-center gap-2'>
            <Building className='h-4 w-4' />
            Tenants
          </TabsTrigger>
          <TabsTrigger value='rbac' className='flex items-center gap-2'>
            <Shield className='h-4 w-4' />
            RBAC
          </TabsTrigger>
          <TabsTrigger value='audit' className='flex items-center gap-2'>
            <Activity className='h-4 w-4' />
            Audit
          </TabsTrigger>
          <TabsTrigger value='plugins' className='flex items-center gap-2'>
            <Package className='h-4 w-4' />
            Plugins
          </TabsTrigger>
          <TabsTrigger value='services' className='flex items-center gap-2'>
            <Server className='h-4 w-4' />
            Services
          </TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='mt-6'>
          <EnhancedAnalyticsDashboard />
        </TabsContent>
        
        <TabsContent value='users' className='mt-6'>
          <UserManagementDashboard />
        </TabsContent>
        
        <TabsContent value='tenants' className='mt-6'>
          <TenantManagementDashboard />
        </TabsContent>
        
        <TabsContent value='rbac' className='mt-6'>
          <RBACManagementDashboard />
        </TabsContent>
        
        <TabsContent value='audit' className='mt-6'>
          <AuditLogs />
        </TabsContent>
        
        <TabsContent value='plugins' className='mt-6'>
          <PluginManagement />
        </TabsContent>
        
        <TabsContent value='services' className='mt-6'>
          <ServiceRegistry />
        </TabsContent>
      </Tabs>
    </div>
  )
}