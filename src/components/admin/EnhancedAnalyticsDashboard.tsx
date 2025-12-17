'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  Building, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Server,
  Database,
  Zap
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  unit?: string
}

function MetricCard({ title, value, change, icon, unit }: MetricCardProps) {
  const isPositive = change && change > 0
  const isNegative = change && change < 0
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">
              {value}
              {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-muted">
              {icon}
            </div>
            {change !== undefined && (
              <div className={`flex items-center text-sm ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'}`}>
                {isPositive && <TrendingUp className="h-4 w-4 mr-1" />}
                {isNegative && <TrendingDown className="h-4 w-4 mr-1" />}
                <span className="font-medium">
                  {change > 0 ? '+' : ''}{change}%
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface SystemAlert {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  message: string
  timestamp: Date
  severity: 'critical' | 'high' | 'medium' | 'low'
}

function SystemAlerts({ alerts }: { alerts: SystemAlert[] }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'info': return <Activity className="h-4 w-4" />
      case 'success': return <CheckCircle className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          System Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active alerts</p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 ${getSeverityColor(alert.severity)} bg-background`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div className="text-muted-foreground mt-1">{getTypeIcon(alert.type)}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : 'secondary'}>
                    {alert.severity}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface QuickStatProps {
  title: string
  stats: Array<{
    label: string
    value: string | number
    change?: number
  }>
}

function QuickStat({ title, stats }: QuickStatProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stats.map((stat, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{stat.value}</span>
                {stat.change !== undefined && (
                  <span className={`text-xs ${stat.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change > 0 ? '+' : ''}{stat.change}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function EnhancedAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [alerts] = useState<SystemAlert[]>([
    {
      id: '1',
      type: 'warning',
      message: 'Database connection pool running at 85% capacity',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      severity: 'medium',
    },
    {
      id: '2',
      type: 'info',
      message: 'Scheduled backup completed successfully',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      severity: 'low',
    },
    {
      id: '3',
      type: 'error',
      message: 'API response time degradation detected in user service',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      severity: 'high',
    },
  ])

  const metrics = {
    totalUsers: 1247,
    activeUsers: 892,
    totalTenants: 48,
    apiCalls: 45678,
    errorRate: 0.8,
    avgResponseTime: 145,
    uptime: 99.9,
  }

  const userStats = [
    { label: 'Total Users', value: metrics.totalUsers, change: 12.5 },
    { label: 'Active Now', value: 892, change: 8.2 },
    { label: 'New Today', value: 47, change: -3.1 },
    { label: 'Churn Rate', value: '2.3%', change: -0.8 },
  ]

  const systemStats = [
    { label: 'API Calls/min', value: 1247, change: 15.4 },
    { label: 'Avg Response Time', value: '145ms', change: -8.7 },
    { label: 'Error Rate', value: '0.8%', change: -12.3 },
    { label: 'System Uptime', value: '99.9%', change: 0.1 },
  ]

  const resourceStats = [
    { label: 'CPU Usage', value: '45%', change: 5.2 },
    { label: 'Memory Usage', value: '67%', change: 8.9 },
    { label: 'Disk Usage', value: '23%', change: 2.1 },
    { label: 'Network I/O', value: '124 MB/s', change: -4.5 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <div className="flex items-center gap-2">
          {['24h', '7d', '30d'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range as any)}
            >
              {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers}
          change={12.5}
          icon={<Users className="h-5 w-5 text-blue-600" />}
        />
        <MetricCard
          title="Active Tenants"
          value={metrics.totalTenants}
          change={8.2}
          icon={<Building className="h-5 w-5 text-green-600" />}
        />
        <MetricCard
          title="API Calls"
          value={45678}
          change={-3.4}
          icon={<Activity className="h-5 w-5 text-purple-600" />}
        />
        <MetricCard
          title="Error Rate"
          value={metrics.errorRate}
          change={-15.7}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          unit="%"
        />
      </div>

      {/* Detailed Stats and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Statistics */}
        <QuickStat title="User Statistics" stats={userStats} />

        {/* System Performance */}
        <QuickStat title="System Performance" stats={systemStats} />

        {/* System Alerts */}
        <SystemAlerts alerts={alerts} />
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickStat title="Resource Usage" stats={resourceStats} />
        
        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Database</span>
                </div>
                <Badge variant="default">Healthy</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">API Gateway</span>
                </div>
                <Badge variant="default">Healthy</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Cache Service</span>
                </div>
                <Badge variant="secondary">Degraded</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Authentication</span>
                </div>
                <Badge variant="default">Healthy</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: 'New user registered', user: 'john.doe@example.com', time: '2 minutes ago', type: 'success' },
              { action: 'Tenant configuration updated', user: 'admin@acme.com', time: '15 minutes ago', type: 'info' },
              { action: 'Failed login attempt', user: 'unknown@malicious.com', time: '32 minutes ago', type: 'error' },
              { action: 'Database backup completed', user: 'system', time: '1 hour ago', type: 'success' },
              { action: 'API rate limit exceeded', user: 'api-client-123', time: '2 hours ago', type: 'warning' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'success' ? 'bg-green-500' :
                    activity.type === 'error' ? 'bg-red-500' :
                    activity.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.user}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}