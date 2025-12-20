// @ts-nocheck
// =============================================================================
// ADMIN PANEL MICROSERVICES INTEGRATION
// =============================================================================

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// INTERFACES
// =============================================================================

interface MicroservicesResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface ServiceHealth {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  lastCheck: string
  details?: Record<string, any>
}

interface IntegrationConfig {
  apiGateway: string
  auth: string
  user: string
  notification: string
  pluginRuntime: string
  analytics: string
  timeout: number
  retries: number
}

// =============================================================================
// MICROSERVICES CLIENT
// =============================================================================

class MicroservicesClient {
  private config: IntegrationConfig
  private authToken?: string
  private onAuthError?: () => void

  constructor(config: IntegrationConfig, onAuthError?: () => void) {
    this.config = config
    this.onAuthError = onAuthError
  }

  setAuthToken(token: string): void {
    this.authToken = token
  }

  clearAuthToken(): void {
    this.authToken = undefined
  }

  private async request<T>(
    service: keyof IntegrationConfig,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const serviceUrl = this.config[service]
    if (!serviceUrl) {
      throw new Error(`Service ${service} not configured`)
    }

    const url = `${serviceUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0',
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    let attempt = 0
    const maxRetries = this.config.retries

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: { ...headers, ...options.headers },
          signal: AbortSignal.timeout(this.config.timeout),
        })

        if (response.status === 401 && this.onAuthError) {
          this.onAuthError()
          throw new Error('Authentication required')
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        attempt++

        if (attempt > maxRetries) {
          throw new Error(`Request failed after ${maxRetries} attempts: ${error.message}`)
        }

        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000))
      }
    }

    throw new Error('Request failed')
  }

  // =============================================================================
  // AUTHENTICATION SERVICE CLIENT
  // =============================================================================

  async login(credentials: {
    email: string
    password: string
    tenantId: string
  }): Promise<MicroservicesResponse<{ token: string; refreshToken: string }>> {
    return this.request('auth', '/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async logout(): Promise<MicroservicesResponse> {
    return this.request('auth', '/api/v1/auth/logout', {
      method: 'POST',
    })
  }

  async refreshToken(refreshToken: string): Promise<MicroservicesResponse<{ token: string }>> {
    return this.request('auth', '/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
  }

  async getCurrentUser(): Promise<MicroservicesResponse<any>> {
    return this.request('auth', '/api/v1/auth/me')
  }

  async hasPermission(
    permission: string,
    resourceId?: string
  ): Promise<MicroservicesResponse<{ hasPermission: boolean }>> {
    const params = resourceId
      ? `?permission=${permission}&resourceId=${resourceId}`
      : `?permission=${permission}`
    return this.request('auth', `/api/v1/auth/check${params}`)
  }

  // =============================================================================
  // USER SERVICE CLIENT
  // =============================================================================

  async getUsers(filters?: {
    page?: number
    limit?: number
    search?: string
    role?: string
    tenantId?: string
  }): Promise<
    MicroservicesResponse<{ users: any[]; total: number; page: number; totalPages: number }>
  > {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, value.toString())
      })
    }

    return this.request('user', `/api/v1/users?${params.toString()}`)
  }

  async createUser(userData: any): Promise<MicroservicesResponse<{ user: any }>> {
    return this.request('user', '/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async updateUser(userId: string, userData: any): Promise<MicroservicesResponse<{ user: any }>> {
    return this.request('user', `/api/v1/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  }

  async deleteUser(userId: string): Promise<MicroservicesResponse> {
    return this.request('user', `/api/v1/users/${userId}`, {
      method: 'DELETE',
    })
  }

  async getUserProfile(userId: string): Promise<MicroservicesResponse<{ profile: any }>> {
    return this.request('user', `/api/v1/users/${userId}/profile`)
  }

  async updateUserProfile(
    userId: string,
    profileData: any
  ): Promise<MicroservicesResponse<{ profile: any }>> {
    return this.request('user', `/api/v1/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    })
  }

  // =============================================================================
  // TENANT MANAGEMENT (via User Service)
  // =============================================================================

  async getTenants(filters?: {
    page?: number
    limit?: number
    search?: string
    status?: string
  }): Promise<
    MicroservicesResponse<{ tenants: any[]; total: number; page: number; totalPages: number }>
  > {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, value.toString())
      })
    }

    return this.request('user', `/api/v1/tenants?${params.toString()}`)
  }

  async createTenant(tenantData: any): Promise<MicroservicesResponse<{ tenant: any }>> {
    return this.request('user', '/api/v1/tenants', {
      method: 'POST',
      body: JSON.stringify(tenantData),
    })
  }

  async updateTenant(
    tenantId: string,
    tenantData: any
  ): Promise<MicroservicesResponse<{ tenant: any }>> {
    return this.request('user', `/api/v1/tenants/${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(tenantData),
    })
  }

  async deleteTenant(tenantId: string): Promise<MicroservicesResponse> {
    return this.request('user', `/api/v1/tenants/${tenantId}`, {
      method: 'DELETE',
    })
  }

  // =============================================================================
  // NOTIFICATION SERVICE CLIENT
  // =============================================================================

  async getNotifications(filters?: {
    page?: number
    limit?: number
    type?: string
    status?: string
    userId?: string
  }): Promise<MicroservicesResponse<{ notifications: any[]; total: number }>> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, value.toString())
      })
    }

    return this.request('notification', `/api/v1/notifications?${params.toString()}`)
  }

  async sendNotification(
    notificationData: any
  ): Promise<MicroservicesResponse<{ notification: any }>> {
    return this.request('notification', '/api/v1/notifications/send', {
      method: 'POST',
      body: JSON.stringify(notificationData),
    })
  }

  async markNotificationRead(notificationId: string): Promise<MicroservicesResponse> {
    return this.request('notification', `/api/v1/notifications/${notificationId}/read`, {
      method: 'PUT',
    })
  }

  async getNotificationTemplates(): Promise<MicroservicesResponse<{ templates: any[] }>> {
    return this.request('notification', '/api/v1/notifications/templates')
  }

  // =============================================================================
  // PLUGIN RUNTIME CLIENT
  // =============================================================================

  async getPlugins(filters?: {
    page?: number
    limit?: number
    status?: string
    category?: string
  }): Promise<MicroservicesResponse<{ plugins: any[]; total: number }>> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, value.toString())
      })
    }

    return this.request('pluginRuntime', `/api/v1/plugins?${params.toString()}`)
  }

  async installPlugin(pluginData: any): Promise<MicroservicesResponse<{ plugin: any }>> {
    return this.request('pluginRuntime', '/api/v1/plugins/install', {
      method: 'POST',
      body: JSON.stringify(pluginData),
    })
  }

  async enablePlugin(pluginId: string): Promise<MicroservicesResponse> {
    return this.request('pluginRuntime', `/api/v1/plugins/${pluginId}/enable`, {
      method: 'PUT',
    })
  }

  async disablePlugin(pluginId: string): Promise<MicroservicesResponse> {
    return this.request('pluginRuntime', `/api/v1/plugins/${pluginId}/disable`, {
      method: 'PUT',
    })
  }

  async uninstallPlugin(pluginId: string): Promise<MicroservicesResponse> {
    return this.request('pluginRuntime', `/api/v1/plugins/${pluginId}/uninstall`, {
      method: 'DELETE',
    })
  }

  async getPluginConfig(pluginId: string): Promise<MicroservicesResponse<{ config: any }>> {
    return this.request('pluginRuntime', `/api/v1/plugins/${pluginId}/config`)
  }

  async updatePluginConfig(pluginId: string, config: any): Promise<MicroservicesResponse> {
    return this.request('pluginRuntime', `/api/v1/plugins/${pluginId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    })
  }

  // =============================================================================
  // ANALYTICS SERVICE CLIENT
  // =============================================================================

  async getAnalyticsDashboard(
    tenantId: string,
    dateRange?: {
      startDate: string
      endDate: string
    }
  ): Promise<MicroservicesResponse<{ dashboard: any }>> {
    const params = new URLSearchParams()
    params.append('tenantId', tenantId)

    if (dateRange) {
      params.append('startDate', dateRange.startDate)
      params.append('endDate', dateRange.endDate)
    }

    return this.request('analytics', `/api/v1/dashboard?${params.toString()}`)
  }

  async getAnalyticsReport(
    reportType: string,
    params: Record<string, any>
  ): Promise<MicroservicesResponse<{ report: any }>> {
    const queryParams = new URLSearchParams()
    queryParams.append('type', reportType)

    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, value.toString())
    })

    return this.request('analytics', `/api/v1/reports?${queryParams.toString()}`)
  }

  async getAnalyticsMetrics(
    tenantId: string,
    metrics: string[]
  ): Promise<MicroservicesResponse<{ metrics: Record<string, any> }>> {
    return this.request('analytics', '/api/v1/metrics', {
      method: 'POST',
      body: JSON.stringify({ tenantId, metrics }),
    })
  }

  async exportAnalyticsData(
    tenantId: string,
    exportConfig: {
      format: 'csv' | 'json' | 'xlsx'
      dateRange: {
        startDate: string
        endDate: string
      }
      metrics: string[]
    }
  ): Promise<MicroservicesResponse<{ downloadUrl: string }>> {
    return this.request('analytics', '/api/v1/export', {
      method: 'POST',
      body: JSON.stringify({ tenantId, ...exportConfig }),
    })
  }

  // =============================================================================
  // HEALTH CHECKS
  // =============================================================================

  async getServiceHealth(
    services?: string[]
  ): Promise<MicroservicesResponse<{ health: ServiceHealth[] }>> {
    const serviceList = services || ['auth', 'user', 'notification', 'pluginRuntime', 'analytics']
    const healthPromises = serviceList.map(async (service) => {
      try {
        const startTime = Date.now()
        const response = await this.request(service, '/health')
        const responseTime = Date.now() - startTime

        return {
          service,
          status: 'healthy',
          responseTime,
          lastCheck: new Date().toISOString(),
          details: response,
        }
      } catch (error) {
        return {
          service,
          status: 'unhealthy',
          responseTime: -1,
          lastCheck: new Date().toISOString(),
          details: { error: error.message },
        }
      }
    })

    const healthResults = await Promise.all(healthPromises)

    return {
      success: true,
      data: { health: healthResults },
    }
  }

  async getSystemHealth(): Promise<
    MicroservicesResponse<{
      status: 'healthy' | 'degraded' | 'unhealthy'
      services: ServiceHealth[]
      timestamp: string
    }>
  > {
    const healthResponse = await this.getServiceHealth()

    if (!healthResponse.success) {
      return {
        success: false,
        error: 'Failed to get service health',
      }
    }

    const services = healthResponse.data?.health || []
    const unhealthyServices = services.filter((s) => s.status === 'unhealthy')
    const degradedServices = services.filter((s) => s.status === 'degraded')

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy'
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded'
    }

    return {
      success: true,
      data: {
        status: overallStatus,
        services,
        timestamp: new Date().toISOString(),
      },
    }
  }
}

// =============================================================================
// REACT HOOKS FOR MICROSERVICES INTEGRATION
// =============================================================================

export const useMicroservicesClient = (config: IntegrationConfig, onAuthError?: () => void) => {
  const [client] = useState(() => new MicroservicesClient(config, onAuthError))

  const setAuthToken = useCallback(
    (token: string) => {
      client.setAuthToken(token)
    },
    [client]
  )

  const clearAuthToken = useCallback(() => {
    client.clearAuthToken()
  }, [client])

  return {
    client,
    setAuthToken,
    clearAuthToken,
  }
}

export const useServiceHealth = (client: MicroservicesClient, interval = 30000) => {
  const [health, setHealth] = useState<ServiceHealth[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await client.getServiceHealth()
        if (response.success && response.data) {
          setHealth(response.data.health)
          setError(null)
        } else {
          setError(response.error || 'Health check failed')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    checkHealth()
    const intervalId = setInterval(checkHealth, interval)

    return () => clearInterval(intervalId)
  }, [client, interval])

  return { health, isLoading, error }
}

export const useAuthentication = (client: MicroservicesClient) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(
    async (credentials: { email: string; password: string; tenantId: string }) => {
      setIsLoading(true)
      try {
        const response = await client.login(credentials)

        if (response.success && response.data) {
          client.setAuthToken(response.data.token)
          setIsAuthenticated(true)

          // Get user details
          const userResponse = await client.getCurrentUser()
          if (userResponse.success) {
            setUser(userResponse.data)
          }
        } else {
          throw new Error(response.error || 'Login failed')
        }
      } finally {
        setIsLoading(false)
      }
    },
    [client]
  )

  const logout = useCallback(async () => {
    try {
      await client.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      client.clearAuthToken()
      setIsAuthenticated(false)
      setUser(null)
    }
  }, [client])

  const refreshToken = useCallback(
    async (refreshToken: string) => {
      try {
        const response = await client.refreshToken(refreshToken)

        if (response.success && response.data) {
          client.setAuthToken(response.data.token)
          return true
        }
        return false
      } catch (error) {
        console.error('Token refresh error:', error)
        return false
      }
    },
    [client]
  )

  return {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
    refreshToken,
  }
}

export default MicroservicesClient
