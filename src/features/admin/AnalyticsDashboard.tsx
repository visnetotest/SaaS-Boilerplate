'use client'

import { Activity, BarChart, Download, Eye, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent } from '@/components/ui/select'

// Types
interface AnalyticsStats {
  totalUsers: number
  activeUsers: number
  totalTenants: number
  activeTenants: number
  totalRoles: number
  auditLogsToday: number
  userGrowthRate: number
  tenantGrowthRate: number
  systemUptime: number
  errorRate: number
}

interface UserActivity {
  date: string
  activeUsers: number
  newUsers: number
  totalUsers: number
}

interface TenantUsage {
  id: string
  name: string
  users: number
  apiCalls: number
  storageGB: number
  lastActive: string
}

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null)
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [topTenants, setTopTenants] = useState<TenantUsage[]>([])
  const [timeRange, setTimeRange] = useState('7d')
  const [loading, setLoading] = useState(true)

  // Mock data fetch (in real app, this would be API calls)
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)

        // Mock stats
        setStats({
          totalUsers: 1247,
          activeUsers: 892,
          totalTenants: 45,
          activeTenants: 42,
          totalRoles: 128,
          auditLogsToday: 1847,
          userGrowthRate: 12.4,
          tenantGrowthRate: 8.2,
          systemUptime: 99.9,
          errorRate: 0.02,
        })

        // Mock user activity
        const mockActivity: UserActivity[] = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          mockActivity.push({
            date: date.toISOString().split('T')[0] || '',
            activeUsers: Math.floor(Math.random() * 200) + 700,
            newUsers: Math.floor(Math.random() * 20) + 5,
            totalUsers: 1247 - i * 5,
          })
        }
        setUserActivity(mockActivity)

        // Mock top tenants
        setTopTenants([
          {
            id: '1',
            name: 'Acme Corporation',
            users: 125,
            apiCalls: 54230,
            storageGB: 12.4,
            lastActive: '2 hours ago',
          },
          {
            id: '2',
            name: 'Tech Startup LLC',
            users: 89,
            apiCalls: 32150,
            storageGB: 8.7,
            lastActive: '5 minutes ago',
          },
          {
            id: '3',
            name: 'Global Enterprise',
            users: 234,
            apiCalls: 89450,
            storageGB: 45.2,
            lastActive: '1 hour ago',
          },
          {
            id: '4',
            name: 'Innovation Labs',
            users: 67,
            apiCalls: 21340,
            storageGB: 6.8,
            lastActive: '3 hours ago',
          },
          {
            id: '5',
            name: 'Digital Agency',
            users: 98,
            apiCalls: 41280,
            storageGB: 11.3,
            lastActive: '30 minutes ago',
          },
        ])
      } catch (error) {
        console.error('Error fetching analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [timeRange])

  const handleExport = (type: 'users' | 'tenants' | 'activity') => {
    alert(`Export ${type} data for ${timeRange} period`)
  }

  if (loading && !stats) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-muted-foreground'>Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Analytics Dashboard</h2>
        <div className='flex gap-2'>
          <div className='w-40'>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <div className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm'>
                <span className='block truncate'>
                  {timeRange === '1d'
                    ? 'Last 24 hours'
                    : timeRange === '7d'
                      ? 'Last 7 days'
                      : timeRange === '30d'
                        ? 'Last 30 days'
                        : timeRange === '90d'
                          ? 'Last 90 days'
                          : 'Custom'}
                </span>
              </div>
              <SelectContent>
                <div
                  className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                  onClick={() => setTimeRange('1d')}
                >
                  Last 24 hours
                </div>
                <div
                  className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                  onClick={() => setTimeRange('7d')}
                >
                  Last 7 days
                </div>
                <div
                  className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                  onClick={() => setTimeRange('30d')}
                >
                  Last 30 days
                </div>
                <div
                  className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground'
                  onClick={() => setTimeRange('90d')}
                >
                  Last 90 days
                </div>
              </SelectContent>
            </Select>
          </div>
          <Button variant='outline' onClick={() => handleExport('activity')}>
            <Download className='h-4 w-4 mr-2' />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Users</CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.totalUsers || 0}</div>
            <p className='text-xs text-muted-foreground'>
              <span className='text-green-600'>+{stats?.userGrowthRate || 0}%</span> from last
              period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active Users</CardTitle>
            <Activity className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.activeUsers || 0}</div>
            <p className='text-xs text-muted-foreground'>
              {stats?.totalUsers ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% of
              total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Tenants</CardTitle>
            <BarChart className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.totalTenants || 0}</div>
            <p className='text-xs text-muted-foreground'>
              <span className='text-green-600'>+{stats?.tenantGrowthRate || 0}%</span> from last
              period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>System Uptime</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.systemUptime || 0}%</div>
            <p className='text-xs text-muted-foreground'>Error rate: {stats?.errorRate || 0}%</p>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* User Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='h-64 flex items-center justify-center bg-muted rounded'>
              <div className='text-center text-muted-foreground'>
                <BarChart className='h-12 w-12 mx-auto mb-4' />
                <p>Activity chart would render here</p>
                <p className='text-sm'>Integrate with Chart.js or Recharts</p>
              </div>
            </div>
            <div className='mt-4 space-y-2'>
              {userActivity.slice(0, 5).map((activity) => (
                <div key={activity.date} className='flex items-center justify-between text-sm'>
                  <span>{new Date(activity.date).toLocaleDateString()}</span>
                  <div className='flex gap-4'>
                    <span>Active: {activity.activeUsers}</span>
                    <span>New: {activity.newUsers}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Tenants */}
        <Card>
          <CardHeader>
            <CardTitle>Top Tenants by Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {topTenants.map((tenant) => (
                <div key={tenant.id} className='flex items-center justify-between'>
                  <div>
                    <div className='font-medium'>{tenant.name}</div>
                    <div className='text-sm text-muted-foreground'>
                      {tenant.users} users • {tenant.apiCalls.toLocaleString()} API calls
                    </div>
                  </div>
                  <div className='text-right'>
                    <Badge variant='outline'>{tenant.storageGB} GB</Badge>
                    <div className='text-xs text-muted-foreground mt-1'>
                      Last active: {tenant.lastActive}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              <div className='flex justify-between'>
                <span>Database</span>
                <Badge variant='default'>Healthy</Badge>
              </div>
              <div className='flex justify-between'>
                <span>API Services</span>
                <Badge variant='default'>Operational</Badge>
              </div>
              <div className='flex justify-between'>
                <span>Cache</span>
                <Badge variant='default'>Normal</Badge>
              </div>
              <div className='flex justify-between'>
                <span>Background Jobs</span>
                <Badge variant='default'>Running</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className='flex justify-between text-sm'>
                <span>Audit logs today</span>
                <span>{stats?.auditLogsToday || 0}</span>
              </div>
              <div className='flex justify-between text-sm'>
                <span>New users today</span>
                <span>23</span>
              </div>
              <div className='flex justify-between text-sm'>
                <span>Login attempts</span>
                <span>1,847</span>
              </div>
              <div className='flex justify-between text-sm'>
                <span>Failed logins</span>
                <span>12</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <Button
                variant='outline'
                className='w-full justify-start'
                onClick={() => handleExport('users')}
              >
                <Eye className='h-4 w-4 mr-2' />
                Export User Report
              </Button>
              <Button
                variant='outline'
                className='w-full justify-start'
                onClick={() => handleExport('tenants')}
              >
                <Eye className='h-4 w-4 mr-2' />
                Export Tenant Report
              </Button>
              <Button
                variant='outline'
                className='w-full justify-start'
                onClick={() => handleExport('activity')}
              >
                <BarChart className='h-4 w-4 mr-2' />
                Generate Insights
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
