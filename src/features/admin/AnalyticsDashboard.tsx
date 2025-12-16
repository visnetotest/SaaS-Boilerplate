// =============================================================================
// ANALYTICS DASHBOARD COMPONENT
// =============================================================================

import { Activity, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react'
import React from 'react'
import { useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectItem } from '@/components/ui/select'
import { useRealtimeAnalytics } from '@/services/RealtimeAnalytics'

import { AdvancedReportBuilder } from './AdvancedReportBuilder'

// Sample data generator
const generateSampleData = () => {
  const now = new Date()
  const data = []

  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
    data.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(Math.random() * 100) + 50,
    })
  }

  return data
}

// Metric Grid Component
function MetricGridCard({
  metric,
  unit,
  current,
  change,
  trend,
}: {
  metric: string
  unit: string
  current: number
  change: number
  trend: 'up' | 'down' | 'stable'
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : Activity
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'

  return (
    <Card>
      <CardContent className='p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium text-gray-600'>{metric}</p>
            <p className='text-2xl font-bold'>
              {current}
              <span className='text-sm font-normal text-gray-500 ml-1'>{unit}</span>
            </p>
          </div>
          <div className={`flex items-center space-x-1 ${trendColor}`}>
            <TrendIcon className='h-4 w-4' />
            <span className='text-sm font-medium'>
              {change > 0 ? '+' : ''}
              {change}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Alerts Component
function SystemAlerts() {
  const { alerts, acknowledgeAlert, resolveAlert } = useRealtimeAnalytics()

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className='h-4 w-4' />
      case 'warning':
        return <AlertTriangle className='h-4 w-4' />
      case 'info':
        return <Activity className='h-4 w-4' />
      case 'success':
        return <CheckCircle className='h-4 w-4' />
      default:
        return <Activity className='h-4 w-4' />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <AlertTriangle className='h-5 w-5' />
          System Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {alerts.length === 0 ? (
            <p className='text-sm text-gray-500 text-center py-4'>No active alerts</p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 ${getSeverityColor(alert.severity)} bg-white`}
              >
                <div className='flex items-start justify-between'>
                  <div className='flex items-start gap-2'>
                    <div className='text-gray-600 mt-1'>{getTypeIcon(alert.type)}</div>
                    <div className='flex-1'>
                      <p className='text-sm font-medium'>{alert.message}</p>
                      <p className='text-xs text-gray-500 mt-1'>
                        {alert.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge variant={alert.acknowledged ? 'secondary' : 'destructive'}>
                      {alert.acknowledged ? 'Acknowledged' : 'New'}
                    </Badge>
                    {!alert.acknowledged && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {alert.acknowledged && !alert.resolved && (
                      <Button size='sm' variant='outline' onClick={() => resolveAlert(alert.id)}>
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Custom Select implementation for this component
function CustomSelect({
  value,
  onValueChange,
  children,
  placeholder,
}: {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className='relative w-full'>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
      >
        <span className='block truncate'>{value || placeholder}</span>
        <svg className='h-4 w-4 opacity-50' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
        </svg>
      </button>

      {isOpen && (
        <div className='absolute top-full z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md'>
          <div className='max-h-60 overflow-auto p-1'>
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child as React.ReactElement<any>, {
                  onClick: () => {
                    if (onValueChange) {
                      onValueChange((child as any).props.value || (child as any).props.children)
                    }
                    setIsOpen(false)
                  },
                })
              }
              return child
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Main Analytics Dashboard Component
export function AnalyticsDashboard() {
  const { metrics, connected } = useRealtimeAnalytics()
  const [selectedMetric, setSelectedMetric] = useState('userCount')
  const [activeTab, setActiveTab] = useState<'realtime' | 'reports'>('realtime')

  const metricOptions = [
    { value: 'userCount', label: 'Total Users', unit: 'users' },
    { value: 'activeUsers', label: 'Active Users', unit: 'users' },
    { value: 'apiCalls', label: 'API Calls', unit: 'calls/min' },
    { value: 'errorRate', label: 'Error Rate', unit: '%' },
    { value: 'avgResponseTime', label: 'Avg Response Time', unit: 'ms' },
    { value: 'cpuUsage', label: 'CPU Usage', unit: '%' },
    { value: 'memoryUsage', label: 'Memory Usage', unit: '%' },
  ]

  const chartData = generateSampleData()

  return (
    <div className='space-y-6'>
      {/* Tab Navigation */}
      <div className='flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit'>
        <button
          onClick={() => setActiveTab('realtime')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'realtime'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Real-time Analytics
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'reports'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Report Builder
        </button>
      </div>

      {activeTab === 'realtime' ? (
        <div className='space-y-6'>
          {/* Connection Status */}
          <div className='flex items-center justify-between'>
            <h2 className='text-2xl font-bold'>Real-time Analytics</h2>
            <div className='flex items-center gap-2'>
              <div
                className={`h-3 w-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className='text-sm text-gray-600'>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <MetricGridCard
              metric='Total Users'
              unit='users'
              current={metrics?.userCount || 0}
              change={12.5}
              trend='up'
            />
            <MetricGridCard
              metric='Active Users'
              unit='users'
              current={metrics?.activeUsers || 0}
              change={8.2}
              trend='up'
            />
            <MetricGridCard
              metric='API Calls'
              unit='calls/min'
              current={metrics?.apiCalls || 0}
              change={-3.4}
              trend='down'
            />
            <MetricGridCard
              metric='Error Rate'
              unit='%'
              current={Math.round(metrics?.errorRate || 0)}
              change={-15.7}
              trend='stable'
            />
          </div>

          {/* Chart and Alerts */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <div className='lg:col-span-2'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Activity className='h-5 w-5' />
                      Metrics Chart
                    </div>
                    <CustomSelect
                      value={selectedMetric}
                      onValueChange={setSelectedMetric}
                      placeholder='Select metric'
                    >
                      {metricOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </CustomSelect>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='h-64'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray='3 3' />
                        <XAxis
                          dataKey='timestamp'
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                          formatter={(value: any) => [`${value}`, 'Value']}
                        />
                        <Legend />
                        <Line
                          type='monotone'
                          dataKey='value'
                          stroke='#3b82f6'
                          strokeWidth={2}
                          name='Metric'
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Alerts */}
            <div className='lg:col-span-1'>
              <SystemAlerts />
            </div>
          </div>
        </div>
      ) : (
        /* Advanced Report Builder */
        <AdvancedReportBuilder />
      )}
    </div>
  )
}
