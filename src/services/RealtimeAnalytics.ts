// =============================================================================
// REAL-TIME ANALYTICS SERVICE
// =============================================================================

import { useEffect, useState } from 'react'

import { Env } from '@/libs/Env'

// Types
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
  private subscribers: Set<(data: any) => void> = new Set()
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
  subscribe(callback: (data: any) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private notifySubscribers(data: any): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(data)
      } catch (error) {
        console.error('Error notifying subscriber:', error)
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
        type: 'metrics',
        data: this.metrics,
      })
    }

    // Collect metrics every 5 seconds
    this.subscribersTimeout = setInterval(collectMetrics, 5000)
  }

  private startUserActivityTracking(): void {
    // Track user activities in real-time
    setInterval(() => {
      this.updateUserSessions()
    }, 10000) // Every 10 seconds
  }

  private handleRealtimeEvent(event: any): void {
    switch (event.type) {
      case 'user_activity':
        this.handleUserActivity(event.data)
        break
      case 'system_alert':
        this.handleSystemAlert(event.data)
        break
      case 'performance_metric':
        this.handlePerformanceMetric(event.data)
        break
      default:
        console.log('Unknown event type:', event.type)
    }
  }

  private handleUserActivity(data: any): void {
    const { userId, endpoint, duration, status } = data

    let session = this.userSessions.get(userId)
    if (!session) {
      session = {
        userId,
        startTime: new Date(),
        activities: [],
      }
      this.userSessions.set(userId, session)
    }

    session.activities.push({
      endpoint,
      timestamp: new Date(),
      duration,
      status,
    })

    if (status === 'completed') {
      session.currentEndpoint = undefined
    } else {
      session.currentEndpoint = endpoint
    }

    this.notifySubscribers({
      type: 'user_activity',
      data: session,
    })
  }

  private handleSystemAlert(alertData: any): void {
    const alert: SystemAlert = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...alertData,
    }

    this.alerts.push(alert)
    this.notifySubscribers({
      type: 'alert',
      data: alert,
    })
  }

  private handlePerformanceMetric(metricData: any): void {
    // Update performance metrics
    this.notifySubscribers({
      type: 'performance',
      data: metricData,
    })
  }

  // Helper methods
  private getActiveUserCount(): number {
    let count = 0
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    this.userSessions.forEach((session) => {
      if (session.activities.some((activity) => activity.timestamp > fiveMinutesAgo)) {
        count++
      }
    })

    return count
  }

  private getApiCallCount(): number {
    let count = 0
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)

    this.userSessions.forEach((session) => {
      count += session.activities.filter((activity) => activity.timestamp > oneMinuteAgo).length
    })

    return count
  }

  private getErrorRate(): number {
    let total = 0
    let errors = 0
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    this.userSessions.forEach((session) => {
      session.activities.forEach((activity) => {
        if (activity.timestamp > fiveMinutesAgo) {
          total++
          if (activity.status === 'error') {
            errors++
          }
        }
      })
    })

    return total > 0 ? (errors / total) * 100 : 0
  }

  private getAverageResponseTime(): number {
    let totalTime = 0
    let count = 0
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    this.userSessions.forEach((session) => {
      session.activities.forEach((activity) => {
        if (activity.timestamp > fiveMinutesAgo && activity.duration) {
          totalTime += activity.duration
          count++
        }
      })
    })

    return count > 0 ? totalTime / count : 0
  }

  private getCpuUsage(): number {
    // Simulate CPU usage - in production, this would come from actual monitoring
    return Math.random() * 100
  }

  private getMemoryUsage(): number {
    // Simulate memory usage - in production, this would come from actual monitoring
    return Math.random() * 100
  }

  private updateUserSessions(): void {
    // Clean up old sessions (older than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

    this.userSessions.forEach((session, userId) => {
      const recentActivities = session.activities.filter(
        (activity) => activity.timestamp > thirtyMinutesAgo
      )

      if (recentActivities.length === 0) {
        this.userSessions.delete(userId)
      } else {
        session.activities = recentActivities
      }
    })
  }

  private startPollingMode(): void {
    console.log('📡 Starting polling mode for analytics')
    setInterval(() => {
      this.startMetricsCollection()
    }, 5000)
  }

  // Public API
  getMetrics(): RealtimeMetrics {
    return { ...this.metrics }
  }

  getAlerts(): SystemAlert[] {
    return [...this.alerts]
  }

  getActiveUsers(): UserSession[] {
    return Array.from(this.userSessions.values())
  }

  addAlert(alert: Omit<SystemAlert, 'id' | 'timestamp'>): void {
    const systemAlert: SystemAlert = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...alert,
    }

    this.alerts.push(systemAlert)
    this.notifySubscribers({
      type: 'alert',
      data: systemAlert,
    })
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      this.notifySubscribers({
        type: 'alert_updated',
        data: alert,
      })
    }
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId)
    if (alert) {
      alert.resolved = true
      this.notifySubscribers({
        type: 'alert_updated',
        data: alert,
      })
    }
  }

  // Cleanup
  disconnect(): void {
    if (this.subscribersTimeout) {
      clearTimeout(this.subscribersTimeout)
      this.subscribersTimeout = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.subscribers.clear()
    console.log('🔌 Realtime analytics disconnected')
  }

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
            alerts: this.alerts.length,
          },
        }
      } else {
        return {
          status: 'degraded',
          details: {
            connection: 'polling',
            subscribers: this.subscribers.size,
            userSessions: this.userSessions.size,
            alerts: this.alerts.length,
          },
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

// Singleton instance
export const realtimeAnalytics = new RealtimeAnalyticsService()

// React hook for consuming real-time analytics
export function useRealtimeAnalytics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null)
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    const initializeConnection = async () => {
      try {
        await realtimeAnalytics.connect()
        setConnected(true)

        // Subscribe to metrics updates
        unsubscribe = realtimeAnalytics.subscribe((data) => {
          switch (data.type) {
            case 'metrics':
              setMetrics(data.data)
              break
            case 'alert':
              setAlerts((prev) => [data.data, ...prev.slice(0, 9)]) // Keep last 10 alerts
              break
            case 'alert_updated':
              setAlerts((prev) =>
                prev.map((alert) => (alert.id === data.data.id ? data.data : alert))
              )
              break
          }
        })
      } catch (error) {
        console.error('Failed to initialize real-time analytics:', error)
        setConnected(false)
      }
    }

    initializeConnection()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  return {
    metrics,
    alerts,
    connected,
    acknowledgeAlert: realtimeAnalytics.acknowledgeAlert.bind(realtimeAnalytics),
    resolveAlert: realtimeAnalytics.resolveAlert.bind(realtimeAnalytics),
    addAlert: realtimeAnalytics.addAlert.bind(realtimeAnalytics),
  }
}
