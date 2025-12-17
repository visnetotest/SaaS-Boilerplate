// =============================================================================
// REAL-TIME ANALYTICS SERVICE
// =============================================================================

import { useEffect, useState } from 'react'
import { Env } from '@/libs/Env'

// Type-safe interfaces
interface AnalyticsEvent {
  type: 'metric' | 'alert' | 'user_activity'
  timestamp: string
  data: unknown
}

interface RealtimeMetrics {
  timestamp: Date
  userCount: number
  activeUsers: number
  apiCalls: number
  errorRate: number
  avgResponseTime: number
  cpuUsage: number
  memoryUsage: number
}

interface UserSession {
  userId: string
  startTime: Date
  currentEndpoint?: string
  activities: Array<{
    endpoint: string
    timestamp: Date
    duration: number
    status: 'active' | 'completed' | 'error'
  }>
}

interface SystemAlert {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  message: string
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  acknowledged?: boolean
  resolved?: boolean
}

// Service implementation
export class RealtimeAnalyticsService {
  private ws: WebSocket | null = null
  private subscribers: Set<(event: AnalyticsEvent) => void> = new Set()
  private metrics: RealtimeMetrics = {
    timestamp: new Date(),
    userCount: 0,
    activeUsers: 0,
    apiCalls: 0,
    errorRate: 0,
    avgResponseTime: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  }
  private alerts: SystemAlert[] = []
  private userSessions: Map<string, UserSession> = new Map()
  private subscribersTimeout: NodeJS.Timeout | null = null

  // WebSocket connection
  async connect(): Promise<void> {
    try {
      const wsUrl = Env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080'
      this.ws = new WebSocket(wsUrl)

      this.ws.addEventListener('open', () => {
        console.log('🟢 Realtime analytics connected')
        this.startMetricsCollection()
        this.startUserActivityTracking()
      })

      this.ws.addEventListener('message', (data: MessageEvent) => {
        try {
          const parsedData = JSON.parse(data.data)
          this.handleRealtimeEvent(parsedData)
        } catch (error) {
          console.error('Failed to parse realtime event:', error)
        }
      })

      this.ws.addEventListener('close', () => {
        console.log('🔌 Realtime analytics disconnected')
        if (this.subscribersTimeout) {
          clearTimeout(this.subscribersTimeout)
          this.subscribersTimeout = null
        }
      })

      this.ws.addEventListener('error', (error: Event) => {
        console.error('Realtime analytics WebSocket error:', error)
        this.addAlert({
          type: 'error',
          message: 'Realtime analytics connection failed',
          severity: 'high',
          acknowledged: true,
        })
      })
    } catch (error) {
      console.error('Failed to connect to realtime analytics:', error)
      // Fallback to polling mode
      this.startPollingMode()
    }
  }

  // Subscription management
  subscribe(callback: (event: AnalyticsEvent) => void): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private notifySubscribers(event: AnalyticsEvent): void {
    this.subscribers.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error('Subscriber error:', error)
      }
    })
  }

  // Metrics collection
  private startMetricsCollection(): void {
    const collectMetrics = () => {
      this.metrics = {
        timestamp: new Date(),
        userCount: this.userSessions.size,
        activeUsers: this.getActiveUserCount(),
        apiCalls: this.getApiCallCount(),
        errorRate: this.getErrorRate(),
        avgResponseTime: this.getAverageResponseTime(),
        cpuUsage: this.getCpuUsage(),
        memoryUsage: this.getMemoryUsage(),
      }

      this.notifySubscribers({
        type: 'metric',
        timestamp: new Date().toISOString(),
        data: this.metrics,
      })
    }

    // Collect every 5 seconds
    this.subscribersTimeout = setInterval(collectMetrics, 5000)
  }

  private startUserActivityTracking(): void {
    setInterval(() => {
      this.updateUserSessions()
    }, 10000) // Every 10 seconds
  }

  private handleRealtimeEvent(event: unknown): void {
    if (!this.isValidAnalyticsEvent(event)) {
      console.error('Invalid analytics event:', event)
      return
    }

    switch (event.type) {
      case 'user_activity':
        this.handleUserActivity(event.data)
        break
      case 'metric':
        this.updateMetric(event.data)
        break
      case 'alert':
        this.addAlert(event.data)
        break
      default:
        console.log('Unknown event type:', event.type)
    }
  }

  private isValidAnalyticsEvent(event: unknown): event is AnalyticsEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      typeof (event as any).type === 'string'
    )
  }

  private handleUserActivity(data: unknown): void {
    if (!this.isValidUserActivityData(data)) {
      return
    }

    const activityData = data as {
      userId: string
      endpoint: string
      duration: number
      status: string
    }

    let session = this.userSessions.get(activityData.userId)
    if (!session) {
      session = {
        userId: activityData.userId,
        startTime: new Date(),
        activities: [],
      }
      this.userSessions.set(activityData.userId, session)
    }

    session.activities.push({
      endpoint: activityData.endpoint,
      timestamp: new Date(),
      duration: activityData.duration,
      status: activityData.status as 'active' | 'completed' | 'error',
    })

    // Update current endpoint
    if (activityData.status === 'active') {
      session.currentEndpoint = activityData.endpoint
    } else if (activityData.status === 'completed') {
      session.currentEndpoint = undefined
    }
  }

  private isValidUserActivityData(data: unknown): data is {
    userId: string
    endpoint: string
    duration?: number
    status: string
  } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'userId' in data &&
      'endpoint' in data &&
      typeof (data as any).userId === 'string' &&
      typeof (data as any).endpoint === 'string' &&
      ('status' in data && typeof (data as any).status === 'string')
    )
  }

  private updateMetric(data: unknown): void {
    if (!this.isValidMetricData(data)) {
      return
    }

    const metricData = data as {
      metricType: string
      value: number
    }

    if (typeof this.metrics[metricData.metricType as keyof RealtimeMetrics] === 'number') {
      (this.metrics as any)[metricData.metricType] = metricData.value
    }
  }

  private isValidMetricData(data: unknown): data is {
    metricType: string
    value: number
  } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'metricType' in data &&
      'value' in data &&
      typeof (data as any).metricType === 'string' &&
      typeof (data as any).value === 'number'
    )
  }

  // Helper methods for metrics calculations
  private getActiveUserCount(): number {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    
    let activeCount = 0
    this.userSessions.forEach(session => {
      const recentActivities = session.activities.filter(
        activity => activity.timestamp > fiveMinutesAgo
      )
      if (recentActivities.length > 0) {
        activeCount++
      }
    })
    
    return activeCount
  }

  private getApiCallCount(): number {
    let count = 0
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    
    this.userSessions.forEach(session => {
      count += session.activities.filter(
        activity => activity.timestamp > oneMinuteAgo
      ).length
    })
    
    return count
  }

  private getErrorRate(): number {
    let totalCalls = 0
    let errorCalls = 0
    
    this.userSessions.forEach(session => {
      session.activities.forEach(activity => {
        totalCalls++
        if (activity.status === 'error') {
          errorCalls++
        }
      })
    })
    
    return totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0
  }

  private getAverageResponseTime(): number {
    let totalDuration = 0
    let count = 0
    
    this.userSessions.forEach(session => {
      session.activities.forEach(activity => {
        if (activity.duration) {
          totalDuration += activity.duration
          count++
        }
      })
    })
    
    return count > 0 ? totalDuration / count : 0
  }

  private getCpuUsage(): number {
    // Simulate CPU usage - in production, get from system monitoring
    return Math.random() * 100
  }

  private getMemoryUsage(): number {
    // Simulate memory usage - in production, get from system monitoring
    return Math.random() * 100
  }

  private updateUserSessions(): void {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    
    for (const [userId, session] of this.userSessions.entries()) {
      const recentActivities = session.activities.filter(
        activity => activity.timestamp > thirtyMinutesAgo
      )
      
      if (recentActivities.length === 0) {
        this.userSessions.delete(userId)
      }
    }
  }

  private startPollingMode(): void {
    console.log('📡 Using polling mode for analytics')
    
    const pollMetrics = () => {
      this.metrics = {
        timestamp: new Date(),
        userCount: this.userSessions.size,
        activeUsers: this.getActiveUserCount(),
        apiCalls: this.getApiCallCount(),
        errorRate: this.getErrorRate(),
        avgResponseTime: this.getAverageResponseTime(),
        cpuUsage: this.getCpuUsage(),
        memoryUsage: this.getMemoryUsage(),
      }

      this.notifySubscribers({
        type: 'metric',
        timestamp: new Date().toISOString(),
        data: this.metrics,
      })
    }

    // Poll every 5 seconds as fallback
    this.subscribersTimeout = setInterval(pollMetrics, 5000)
  }

  // Alert management
  addAlert(alert: Omit<SystemAlert, 'id' | 'timestamp'>): void {
    const systemAlert: SystemAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...alert,
    }

    this.alerts.push(systemAlert)
    
    this.notifySubscribers({
      type: 'alert',
      timestamp: new Date().toISOString(),
      data: systemAlert,
    })
  }

  // Public API methods
  getMetrics(): RealtimeMetrics {
    return { ...this.metrics }
  }

  getAlerts(): SystemAlert[] {
    return [...this.alerts]
  }

  getActiveUsers(): number {
    return this.getActiveUserCount()
  }

  // Cleanup
  disconnect(): void {
    if (this.subscribersTimeout) {
      clearInterval(this.subscribersTimeout)
      this.subscribersTimeout = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.subscribers.clear()
    console.log('🔌 Realtime analytics disconnected')
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: any
  }> {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return {
          status: 'healthy',
          details: {
            connection: 'websocket',
            subscribers: this.subscribers.size,
            userSessions: this.userSessions.size,
          },
        }
      } else if (this.subscribersTimeout) {
        return {
          status: 'degraded',
          details: {
            connection: 'polling',
            subscribers: this.subscribers.size,
            userSessions: this.userSessions.size,
          },
        }
      } else {
        return {
          status: 'unhealthy',
          details: 'No active connection or polling',
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }
}

// React hook for consuming real-time analytics
export function useRealtimeAnalytics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null)
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const analyticsService = new RealtimeAnalyticsService()
    
    // Connect to analytics service
    analyticsService.connect()
    setConnected(true)
    
    // Subscribe to events
    const unsubscribeMetrics = analyticsService.subscribe((event) => {
      if (event.type === 'metric') {
        setMetrics(event.data as RealtimeMetrics)
      } else if (event.type === 'alert') {
        setAlerts(prev => [event.data as SystemAlert, ...prev.slice(0, 9)]) // Keep last 10 alerts
      }
    })

    return () => {
      unsubscribeMetrics()
      analyticsService.disconnect()
      setConnected(false)
    }
  }, [])

  return {
    metrics,
    alerts,
    connected,
    acknowledgeAlert: analyticsService.addAlert.bind(analyticsService),
    resolveAlert: (alertId: string) => {
      const alert = alerts.find(a => a.id === alertId)
      if (alert && !alert.resolved) {
        analyticsService.addAlert({ id: alertId, resolved: true })
        setAlerts(prev => prev.map(a => 
          a.id === alertId ? { ...a, resolved: true } : a
        ))
      }
    },
    addAlert: analyticsService.addAlert.bind(analyticsService),
  }
}