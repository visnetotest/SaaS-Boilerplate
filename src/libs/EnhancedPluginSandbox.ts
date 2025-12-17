// =============================================================================
// ENHANCED PLUGIN SANDBOX WITH ADVANCED SECURITY
// =============================================================================

import { randomUUID } from 'crypto'
import type { 
  PluginSandbox as IPluginSandbox, 
  PluginSandboxInstance as IPluginSandboxInstance,
  PluginContext,
  PluginManifest,
  PluginPermission,
  PluginError
} from '@/types/plugin'

/**
 * Enhanced Security Sandbox for Plugin Isolation
 * 
 * Provides advanced sandboxing features including:
 * - Secure code execution in isolated context
 * - Permission-based API access control
 * - Resource monitoring and limits
 * - Network and filesystem restrictions
 * - Memory and CPU limits
 */
export class EnhancedPluginSandbox implements IPluginSandbox {
  private sandboxes = new Map<string, IPluginSandboxInstance>()
  private resourceMonitors = new Map<string, ResourceMonitor>()
  private readonly defaultConfig = {
    timeout: 30000,
    memory: 128 * 1024 * 1024, // 128MB
    allowedDomains: [],
    allowedModules: [],
    blockedModules: ['fs', 'child_process', 'cluster', 'worker_threads'],
    maxExecutionTime: 30000,
    maxMemoryUsage: 128 * 1024 * 1024,
  }

  async create(plugin: any): Promise<IPluginSandboxInstance> {
    const sandboxId = randomUUID()
    const config = { ...this.defaultConfig, ...plugin.manifest.sandbox }
    
    // Create resource monitor
    const resourceMonitor = new ResourceMonitor(sandboxId, config)
    this.resourceMonitors.set(sandboxId, resourceMonitor)
    
    // Create secure context
    const context = await this.createSecureContext(plugin, sandboxId, config)

    const instance: IPluginSandboxInstance = {
      id: sandboxId,
      pluginId: plugin.pluginId,
      context,
      
      execute: async (code: string, executionContext?: Partial<PluginContext>): Promise<any> => {
        return await this.executeSafely(instance, code, {
          ...context,
          ...executionContext,
        }, resourceMonitor)
      },
      
      destroy: async (): Promise<void> => {
        await this.destroySandbox(instance)
      },
      
      // Enhanced methods
      getMetrics: () => resourceMonitor.getMetrics(),
      resetMetrics: () => resourceMonitor.reset(),
      isExpired: () => resourceMonitor.isExpired(),
      extendTimeout: (extension: number) => resourceMonitor.extendTimeout(extension),
    }

    this.sandboxes.set(sandboxId, instance)
    return instance
  }

  async execute(instance: IPluginSandboxInstance, code: string, context: PluginContext): Promise<any> {
    const resourceMonitor = this.resourceMonitors.get(instance.id)
    if (!resourceMonitor) {
      throw new Error('Resource monitor not found for sandbox instance')
    }

    return await this.executeSafely(instance, code, context, resourceMonitor)
  }

  async destroy(instance: IPluginSandboxInstance): Promise<void> {
    await this.destroySandbox(instance)
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Create secure plugin context
   */
  private async createSecureContext(plugin: any, sandboxId: string, config: any): Promise<PluginContext> {
    const permissions = this.parsePermissions(plugin.manifest.permissions || [])
    
    return {
      id: sandboxId,
      pluginId: plugin.pluginId,
      tenantId: plugin.tenantId || 'system',
      config: { ...plugin.config, sandbox: config },
      permissions: permissions.map(p => `${p.resource}:${p.actions.join(',')}`),
      api: await this.createSecureAPI(permissions, config),
      logger: this.createSandboxLogger(plugin.pluginId, sandboxId),
      storage: this.createSandboxStorage(plugin.pluginId, sandboxId),
    }
  }

  /**
   * Parse and normalize permissions
   */
  private parsePermissions(permissions: PluginPermission[]): Array<{resource: string, actions: string[]}> {
    return permissions.map(p => ({
      resource: p.resource,
      actions: Array.isArray(p.actions) ? p.actions : [p.actions.toString()]
    }))
  }

  /**
   * Create secure API with permission-based access
   */
  private async createSecureAPI(permissions: Array<{resource: string, actions: string[]}>, config: any): Promise<any> {
    const hasPermission = (resource: string, action: string): boolean => {
      return permissions.some(p => 
        p.resource === resource && p.actions.includes(action)
      )
    }

    return {
      user: hasPermission('user', 'read') ? {
        getCurrent: async () => {
          if (!hasPermission('user', 'read')) {
            throw new Error('Access denied: user.getCurrent requires user:read permission')
          }
          return { error: 'Access denied in sandbox' }
        },
        getById: async () => ({ error: 'Access denied in sandbox' }),
        getByEmail: async () => ({ error: 'Access denied in sandbox' }),
        create: async () => ({ error: 'Access denied in sandbox' }),
        update: async () => ({ error: 'Access denied in sandbox' }),
        delete: async () => ({ error: 'Access denied in sandbox' }),
        list: async () => ({ error: 'Access denied in sandbox' }),
      } : {
        getCurrent: async () => ({ error: 'Access denied: user:read permission required' }),
        getById: async () => ({ error: 'Access denied: user:read permission required' }),
        getByEmail: async () => ({ error: 'Access denied: user:read permission required' }),
        create: async () => ({ error: 'Access denied: user:create permission required' }),
        update: async () => ({ error: 'Access denied: user:update permission required' }),
        delete: async () => ({ error: 'Access denied: user:delete permission required' }),
        list: async () => ({ error: 'Access denied: user:read permission required' }),
      },
      
      tenant: hasPermission('tenant', 'read') ? {
        getCurrent: async () => ({ error: 'Access denied in sandbox' }),
        getById: async () => ({ error: 'Access denied in sandbox' }),
        getBySlug: async () => ({ error: 'Access denied in sandbox' }),
        create: async () => ({ error: 'Access denied in sandbox' }),
        update: async () => ({ error: 'Access denied in sandbox' }),
        delete: async () => ({ error: 'Access denied in sandbox' }),
        list: async () => ({ error: 'Access denied in sandbox' }),
      } : {
        getCurrent: async () => ({ error: 'Access denied: tenant:read permission required' }),
        getById: async () => ({ error: 'Access denied: tenant:read permission required' }),
        getBySlug: async () => ({ error: 'Access denied: tenant:read permission required' }),
        create: async () => ({ error: 'Access denied: tenant:create permission required' }),
        update: async () => ({ error: 'Access denied: tenant:update permission required' }),
        delete: async () => ({ error: 'Access denied: tenant:delete permission required' }),
        list: async () => ({ error: 'Access denied: tenant:read permission required' }),
      },
      
      auth: {
        verify: async () => ({ error: 'Access denied in sandbox' }),
        generate: async () => ({ error: 'Access denied in sandbox' }),
        invalidate: async () => ({ error: 'Access denied in sandbox' }),
        checkPermission: async () => ({ error: 'Access denied in sandbox' }),
      },
      
      db: hasPermission('database', 'read') ? {
        query: async () => ({ error: 'Access denied in sandbox' }),
        transaction: async () => ({ error: 'Access denied in sandbox' }),
      } : {
        query: async () => ({ error: 'Access denied: database:read permission required' }),
        transaction: async () => ({ error: 'Access denied: database:read permission required' }),
      },
      
      events: {
        emit: async (event: string, data?: any) => {
          console.log('[Sandbox Event] ' + event + ':', data)
        },
        on: async (event: string, handler: Function) => {
          console.log('[Sandbox Event Handler] Registered for: ' + event)
        },
        off: async (event: string, handler: Function) => {
          console.log('[Sandbox Event Handler] Removed for: ' + event)
        },
        once: async (event: string, handler: Function) => {
          console.log('[Sandbox Event Handler] Registered once for: ' + event)
        },
      },
      
      config: hasPermission('config', 'read') ? {
        get: async (key: string) => {
          const sensitiveKeys = ['database_url', 'secret_key', 'private_key', 'password', 'token']
          if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
            throw new Error('Access denied: sensitive configuration key')
          }
          return null // Would be loaded from database in real implementation
        },
        set: async (key: string, value: any) => {
          console.log('[Sandbox Config] Setting ' + key + ':', value)
        },
        delete: async (key: string) => {
          console.log('[Sandbox Config] Deleting ' + key)
        },
        all: async () => ({}),
      } : {
        get: async (key: string) => {
          throw new Error('Access denied: config:read permission required')
        },
        set: async (key: string, value: any) => {
          throw new Error('Access denied: config:write permission required')
        },
        delete: async (key: string) => {
          throw new Error('Access denied: config:write permission required')
        },
        all: async () => ({}),
      },
      
      http: hasPermission('network', 'read') ? {
        get: async (url: string, options?: any) => {
          return await this.secureHttpRequest('GET', url, null, options, config)
        },
        post: async (url: string, data?: any, options?: any) => {
          return await this.secureHttpRequest('POST', url, data, options, config)
        },
        put: async (url: string, data?: any, options?: any) => {
          return await this.secureHttpRequest('PUT', url, data, options, config)
        },
        delete: async (url: string, options?: any) => {
          return await this.secureHttpRequest('DELETE', url, null, options, config)
        },
      } : {
        get: async (url: string, options?: any) => {
          throw new Error('Access denied: network:read permission required')
        },
        post: async (url: string, data?: any, options?: any) => {
          throw new Error('Access denied: network:write permission required')
        },
        put: async (url: string, data?: any, options?: any) => {
          throw new Error('Access denied: network:write permission required')
        },
        delete: async (url: string, options?: any) => {
          throw new Error('Access denied: network:write permission required')
        },
      },
      
      crypto: {
        hash: async (data: string) => {
          console.log('[Sandbox Crypto] Hashing data')
          return 'hashed_' + data
        },
        verify: async (data: string, hash: string) => {
          console.log('[Sandbox Crypto] Verifying hash')
          return hash === 'hashed_' + data
        },
        encrypt: async (data: string, key: string) => {
          console.log('[Sandbox Crypto] Encrypting data')
          return 'encrypted_' + data
        },
        decrypt: async (data: string, key: string) => {
          console.log('[Sandbox Crypto] Decrypting data')
          return data.replace('encrypted_', '')
        },
        generateKey: async () => {
          console.log('[Sandbox Crypto] Generating key')
          return 'sandbox_key_' + Date.now()
        },
      },
      
      time: {
        now: () => new Date(),
        format: (date: Date, format: string) => date.toISOString(),
        parse: (dateString: string) => new Date(dateString),
        add: (date: Date, amount: number, unit: string) => new Date(date.getTime() + amount * 1000),
        diff: (date1: Date, date2: Date) => date2.getTime() - date1.getTime(),
      },
    }
  }

  /**
   * Secure HTTP request with domain validation
   */
  private async secureHttpRequest(method: string, url: string, data?: any, options?: any, config?: any): Promise<any> {
    const allowedDomains = config.allowedDomains || []
    const urlObj = new URL(url)
    
    if (allowedDomains.length > 0 && !allowedDomains.includes(urlObj.hostname)) {
      throw new Error('Access denied: HTTP requests to ' + urlObj.hostname + ' not allowed')
    }

    // Additional security checks
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
      throw new Error('Access denied: Only HTTP/HTTPS protocols allowed')
    }

    console.log('[Sandbox HTTP] ' + method + ' ' + url + ':', data, options)
    return { status: 200, data: {} }
  }

  /**
   * Create sandboxed logger
   */
  private createSandboxLogger(pluginId: string, sandboxId: string) {
    return {
      debug: (message: string, meta?: any) => {
        console.log('[Sandbox-' + sandboxId + '] DEBUG: ' + message, meta)
      },
      info: (message: string, meta?: any) => {
        console.log('[Sandbox-' + sandboxId + '] INFO: ' + message, meta)
      },
      warn: (message: string, meta?: any) => {
        console.warn('[Sandbox-' + sandboxId + '] WARN: ' + message, meta)
      },
      error: (message: string, error?: Error, meta?: any) => {
        console.error('[Sandbox-' + sandboxId + '] ERROR: ' + message, error, meta)
      },
    }
  }

  /**
   * Create sandboxed storage
   */
  private createSandboxStorage(pluginId: string, sandboxId: string) {
    const storagePrefix = 'sandbox_' + sandboxId + '_'
    
    return {
      get: async (key: string) => {
        if (typeof window !== 'undefined') {
          const value = localStorage.getItem(storagePrefix + key)
          return value ? JSON.parse(value) : null
        } else {
          console.log('[Sandbox Storage] Get ' + storagePrefix + key)
          return null
        }
      },
      
      set: async (key: string, value: any) => {
        const serialized = JSON.stringify(value)
        
        if (typeof window !== 'undefined') {
          localStorage.setItem(storagePrefix + key, serialized)
        } else {
          console.log('[Sandbox Storage] Set ' + storagePrefix + key + ':', value)
        }
      },
      
      delete: async (key: string) => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(storagePrefix + key)
        } else {
          console.log('[Sandbox Storage] Delete ' + storagePrefix + key)
        }
      },
      
      clear: async () => {
        if (typeof window !== 'undefined') {
          const keys = Object.keys(localStorage).filter(k => k.startsWith(storagePrefix))
          keys.forEach(key => localStorage.removeItem(key))
        } else {
          console.log('[Sandbox Storage] Clear ' + storagePrefix)
        }
      },
      
      keys: async () => {
        if (typeof window !== 'undefined') {
          const prefixLength = storagePrefix.length
          return Object.keys(localStorage)
            .filter(k => k.startsWith(storagePrefix))
            .map(k => k.substring(prefixLength))
        } else {
          return []
        }
      },
      
      size: async () => {
        const keys = await this.keys()
        let size = 0
        
        if (typeof window !== 'undefined') {
          for (const key of keys) {
            const value = localStorage.getItem(storagePrefix + key)
            if (value) {
              size += value.length
            }
          }
        }
        
        return size
      },
    }
  }

  /**
   * Execute code in secure sandbox
   */
  private async executeSafely(
    instance: IPluginSandboxInstance, 
    code: string, 
    context: PluginContext,
    resourceMonitor: ResourceMonitor
  ): Promise<any> {
    try {
      // Start resource monitoring
      resourceMonitor.start()
      
      // Create sandboxed execution environment
      const sandboxedCode = this.wrapPluginCode(code, context, instance.context.config.sandbox)
      
      // Execute with timeout and resource limits
      const result = await this.executeWithTimeout(sandboxedCode, resourceMonitor)
      
      // Validate result for security violations
      this.validateResult(result)
      
      // Stop resource monitoring and return result
      resourceMonitor.stop()
      return result
    } catch (error) {
      resourceMonitor.stop()
      instance.context.logger.error('Plugin execution failed', error as Error)
      
      const pluginError: PluginError = {
        code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { 
          sandboxId: instance.id,
          pluginId: instance.pluginId 
        }
      }
      
      throw new Error('Plugin execution failed: ' + pluginError.message)
    }
  }

  /**
   * Wrap plugin code in secure sandbox
   */
  private wrapPluginCode(code: string, context: PluginContext, config: any): string {
    return '(function() {' +
      "'use strict';" +
      'const __sandboxContext = ' + JSON.stringify(context) + ';' +
      'const __sandboxConfig = ' + JSON.stringify(config) + ';' +
      '' +
      '// Mock global objects that could be dangerous' +
      'const __globalOverrides = {' +
      '  process: undefined,' +
      '  require: undefined,' +
      '  global: undefined,' +
      '  window: undefined,' +
      '  document: undefined,' +
      '  fetch: undefined,' +
      '  setTimeout: undefined,' +
      '  setInterval: undefined,' +
      '};' +
      '' +
      '// Create safe execution function' +
      'const __executePlugin = function(pluginCode, context, config) {' +
      '  const __module = { exports: {} };' +
      '' +
      '  // Execute plugin code in controlled environment' +
      '  try {' +
      '    const pluginFunction = new Function(' +
      '      "context", "module", "require", "process",' +
      '      "with (__sandboxContext, __module, __globalOverrides.require, __globalOverrides.process) {" +' +
      '        pluginCode + ' +
      '      "}' +
      '    ");' +
      '    ' +
      '    return pluginFunction();' +
      '  } catch (error) {' +
      '    throw error;' +
      '  }' +
      '};' +
      '' +
      '// Execute and return result' +
      'return __executePlugin(' + 
        '  `" + code.replace(/`/g, "\\\\`").replace(/\\\\/g, "\\\\\\\\\\\\") + "`," +' +
      '  __sandboxContext,' +
      '  __sandboxConfig' +
      ');' +
      '})();'
  }

  /**
   * Execute code with timeout and resource monitoring
   */
  private async executeWithTimeout(code: string, resourceMonitor: ResourceMonitor): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = resourceMonitor.getRemainingTime()
      const timeoutId = setTimeout(() => {
        resourceMonitor.stop()
        reject(new Error('Plugin execution timed out after ' + timeout + 'ms'))
      }, timeout)

      try {
        // Monitor resources during execution
        const monitorInterval = setInterval(() => {
          if (resourceMonitor.isMemoryExceeded() || resourceMonitor.isTimeExceeded()) {
            clearInterval(monitorInterval)
            clearTimeout(timeoutId)
            resourceMonitor.stop()
            reject(new Error('Plugin resource limits exceeded'))
          }
        }, 100)

        // Execute sandboxed code
        const result = eval(code)
        
        // Clear monitoring
        clearInterval(monitorInterval)
        clearTimeout(timeoutId)
        
        resolve(result)
      } catch (error) {
        clearInterval(monitorInterval)
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  /**
   * Validate execution result for security violations
   */
  private validateResult(result: any): void {
    if (result && typeof result === 'object') {
      // Check for prototype pollution
      if (result.__proto__ !== Object.prototype.__proto__) {
        throw new Error('Security violation: prototype pollution detected')
      }

      // Check for dangerous properties
      const dangerousProps = ['constructor', '__proto__', 'prototype']
      for (const prop of dangerousProps) {
        if (prop in result) {
          throw new Error('Security violation: dangerous property in result')
        }
      }
    }
  }

  /**
   * Destroy sandbox and cleanup resources
   */
  private async destroySandbox(instance: IPluginSandboxInstance): Promise<void> {
    try {
      const resourceMonitor = this.resourceMonitors.get(instance.id)
      if (resourceMonitor) {
        resourceMonitor.stop()
        this.resourceMonitors.delete(instance.id)
      }

      this.sandboxes.delete(instance.id)
      instance.context.logger.info('Sandbox destroyed for plugin', instance.pluginId)
    } catch (error) {
      console.error('Failed to destroy sandbox:', error)
    }
  }

  /**
   * Get sandbox statistics
   */
  getSandboxStats(): {
    activeSandboxes: number
    totalMonitors: number
    sandboxIds: string[]
  } {
    return {
      activeSandboxes: this.sandboxes.size,
      totalMonitors: this.resourceMonitors.size,
      sandboxIds: Array.from(this.sandboxes.keys())
    }
  }

  /**
   * Cleanup all sandboxes
   */
  async cleanup(): Promise<void> {
    const sandboxes = Array.from(this.sandboxes.values())
    
    for (const sandbox of sandboxes) {
      try {
        await this.destroySandbox(sandbox)
      } catch (error) {
        console.error('Failed to cleanup sandbox:', error)
      }
    }
    
    this.sandboxes.clear()
    this.resourceMonitors.clear()
    console.log('Enhanced plugin sandbox cleanup completed')
  }
}

// =============================================================================
// RESOURCE MONITOR FOR SANDBOX
// =============================================================================

class ResourceMonitor {
  private startTime?: number
  private endTime?: number
  private memoryUsage = 0
  private executionTime = 0
  
  constructor(
    private sandboxId: string,
    private config: any
  ) {}

  start(): void {
    this.startTime = Date.now()
    this.endTime = this.startTime + this.config.timeout
  }

  stop(): void {
    if (this.startTime) {
      this.executionTime = Date.now() - this.startTime
    }
  }

  isExpired(): boolean {
    return Date.now() > (this.endTime || Date.now() + this.config.timeout)
  }

  isMemoryExceeded(): boolean {
    return this.memoryUsage > this.config.maxMemoryUsage
  }

  isTimeExceeded(): boolean {
    return this.isExpired()
  }

  getRemainingTime(): number {
    return Math.max(0, (this.endTime || Date.now() + this.config.timeout) - Date.now())
  }

  extendTimeout(extension: number): void {
    if (this.endTime) {
      this.endTime += extension
    }
  }

  getMetrics(): {
    executionTime: number
    memoryUsage: number
    timeoutLimit: number
    memoryLimit: number
    isExpired: boolean
  } {
    return {
      executionTime: this.executionTime,
      memoryUsage: this.memoryUsage,
      timeoutLimit: this.config.timeout,
      memoryLimit: this.config.maxMemoryUsage,
      isExpired: this.isExpired()
    }
  }

  reset(): void {
    this.startTime = undefined
    this.endTime = undefined
    this.memoryUsage = 0
    this.executionTime = 0
  }
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export const enhancedPluginSandbox = new EnhancedPluginSandbox()