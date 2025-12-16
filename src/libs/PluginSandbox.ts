import { randomBytes } from 'crypto'

import {
  PluginContext,
  PluginError,
  PluginInstance,
  PluginSandbox as IPluginSandbox,
  PluginSandboxConfig,
  PluginSandboxInstance,
} from '@/types/plugin'

// =============================================================================
// PLUGIN SANDBOX IMPLEMENTATION (BROWSER-COMPATIBLE)
// =============================================================================

export class PluginSandbox implements IPluginSandbox {
  private activeSandboxes = new Map<string, PluginSandboxInstance>()

  async create(plugin: PluginInstance): Promise<PluginSandboxInstance> {
    try {
      // const config = plugin.manifest.sandbox
      const sandboxId = this.generateSandboxId(plugin.id)

      const instance: PluginSandboxInstance = {
        id: sandboxId,
        pluginId: plugin.id,
        context: await this.createSandboxContext(plugin),

        execute: async (code: string, context?: Partial<PluginContext>) => {
          return await this.executeInSandbox(instance, code, context)
        },

        destroy: async () => {
          return await this.destroySandbox(instance)
        },
      }

      this.activeSandboxes.set(sandboxId, instance)

      console.log(`Sandbox created for plugin ${plugin.id}`)
      return instance
    } catch (error) {
      const pluginError: PluginError = {
        code: 'SANDBOX_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { pluginId: plugin.id },
      }
      throw pluginError
    }
  }

  async execute(
    instance: PluginSandboxInstance,
    code: string,
    context: PluginContext
  ): Promise<any> {
    return await this.executeInSandbox(instance, code, context)
  }

  async destroy(instance: PluginSandboxInstance): Promise<void> {
    try {
      // Clean up sandbox resources
      this.activeSandboxes.delete(instance.id)

      console.log(`Sandbox destroyed for plugin ${instance.pluginId}`)
    } catch (error) {
      const pluginError: PluginError = {
        code: 'SANDBOX_DESTROY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { sandboxId: instance.id },
      }
      throw pluginError
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private generateSandboxId(pluginId: string): string {
    const randomPart = randomBytes(8).toString('hex')
    return `sandbox_${pluginId}_${randomPart}`
  }

  private async createSandboxContext(plugin: PluginInstance): Promise<PluginContext> {
    const config = plugin.manifest.sandbox

    // Create secure context with limited globals
    const sandboxedGlobals: any = {
      console: this.createSecureConsole(plugin.id),
      setTimeout: this.createSecureTimeout(plugin.id, config.timeout),
      clearTimeout: global.clearTimeout,
      Buffer: Buffer,
      JSON: JSON,
      Date: Date,
      Math: Math,
      RegExp: RegExp,
      String: String,
      Number: Number,
      Array: Array,
      Object: Object,
      Boolean: Boolean,

      // Plugin-specific context
      __plugin: {
        id: plugin.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        config: plugin.config,
        storage: this.createSecureStorage(plugin.id),
      },
    }

    // Allow specific modules based on configuration
    if (config.allowedModules) {
      for (const moduleName of config.allowedModules) {
        if (this.isModuleAllowed(moduleName, config)) {
          sandboxedGlobals[moduleName] = (global as any)[moduleName]
        }
      }
    }

    return sandboxedGlobals
  }

  private async executeInSandbox(
    instance: PluginSandboxInstance,
    code: string,
    additionalContext?: Partial<PluginContext>
  ): Promise<any> {
    try {
      const config = this.getPluginSandboxConfig(instance.pluginId)

      // Merge additional context
      const context = { ...instance.context, ...additionalContext }

      // Security check the code
      const securityCheck = SandboxSecurity.isCodeSafe(code)
      if (!securityCheck.safe) {
        throw new Error(`Code security check failed: ${securityCheck.violations.join(', ')}`)
      }

      // Set up execution timeout
      const timeoutMs = config.timeout || 30000 // 30 seconds default

      // Execute code in sandboxed environment
      const result = await this.executeWithTimeout(
        () => this.createSandboxedFunction(code, context),
        timeoutMs
      )

      return result
    } catch (error) {
      const pluginError: PluginError = {
        code: 'SANDBOX_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: {
          sandboxId: instance.id,
          pluginId: instance.pluginId,
        },
      }
      throw pluginError
    }
  }

  private async destroySandbox(instance: PluginSandboxInstance): Promise<void> {
    // Clean up any running timers
    const timers = (global as any).__pluginTimers?.[instance.id]
    if (timers) {
      for (const timer of timers) {
        clearTimeout(timer)
      }
      delete (global as any).__pluginTimers?.[instance.id]
    }

    // Remove sandbox from active sandboxes
    this.activeSandboxes.delete(instance.id)
  }

  private createSecureConsole(pluginId: string): any {
    return {
      log: (...args: any[]) => {
        console.log(`[Plugin ${pluginId}]`, ...args)
      },
      warn: (...args: any[]) => {
        console.warn(`[Plugin ${pluginId}]`, ...args)
      },
      error: (...args: any[]) => {
        console.error(`[Plugin ${pluginId}]`, ...args)
      },
      debug: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[Plugin ${pluginId}]`, ...args)
        }
      },
    }
  }

  private createSecureTimeout(pluginId: string, timeoutMs?: number): any {
    return (callback: Function, delay: number) => {
      if (timeoutMs && delay > timeoutMs) {
        throw new Error(`Timeout delay exceeds maximum allowed ${timeoutMs}ms`)
      }

      const timer = setTimeout(callback, delay)

      // Track timer for cleanup
      if (!(global as any).__pluginTimers) {
        ;(global as any).__pluginTimers = {}
      }
      if (!(global as any).__pluginTimers[pluginId]) {
        ;(global as any).__pluginTimers[pluginId] = []
      }
      ;(global as any).__pluginTimers[pluginId].push(timer)

      return timer
    }
  }

  private createSecureStorage(pluginId: string): any {
    const storageKey = `plugin_storage_${pluginId}`

    return {
      get: (key: string): any => {
        try {
          const data = (global as any)[storageKey] || {}
          return data[key]
        } catch {
          return undefined
        }
      },

      set: (key: string, value: any): void => {
        try {
          const data = (global as any)[storageKey] || {}
          data[key] = value
          ;(global as any)[storageKey] = data
        } catch (error) {
          console.error(`Plugin ${pluginId} storage set failed:`, error)
        }
      },

      delete: (key: string): void => {
        try {
          const data = (global as any)[storageKey] || {}
          delete data[key]
          ;(global as any)[storageKey] = data
        } catch (error) {
          console.error(`Plugin ${pluginId} storage delete failed:`, error)
        }
      },

      clear: (): void => {
        try {
          delete (global as any)[storageKey]
        } catch (error) {
          console.error(`Plugin ${pluginId} storage clear failed:`, error)
        }
      },

      keys: (): string[] => {
        try {
          const data = (global as any)[storageKey] || {}
          return Object.keys(data)
        } catch {
          return []
        }
      },
    }
  }

  private isModuleAllowed(moduleName: string, config: PluginSandboxConfig): boolean {
    if (!config.allowedModules) {
      return false
    }

    if (config.blockedModules && config.blockedModules.includes(moduleName)) {
      return false
    }

    return config.allowedModules.includes(moduleName)
  }

  private getPluginSandboxConfig(pluginId: string): PluginSandboxConfig {
    const instance = this.activeSandboxes.get(pluginId)
    if (!instance) {
      throw new Error(`Sandbox for plugin ${pluginId} not found`)
    }

    // Default sandbox configuration
    return {
      enabled: true,
      timeout: 30000, // 30 seconds
      memory: 128 * 1024 * 1024, // 128MB
      allowedModules: ['console', 'Date', 'Math', 'JSON'],
      blockedModules: ['fs', 'child_process', 'cluster', 'worker_threads'],
    }
  }

  private createSandboxedFunction(code: string, _context: any): Function {
    // Create a function with sandboxed context
    const sandboxedCode = `
      "use strict";
      const __context = this;
      return (function() {
        ${code}
      }).apply(__context);
    `

    try {
      return new Function('context', sandboxedCode)
    } catch (error) {
      throw new Error(`Failed to create sandboxed function: ${error}`)
    }
  }

  private async executeWithTimeout<T>(fn: () => T, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Plugin execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }
}

// =============================================================================
// SANDBOX SECURITY
// =============================================================================

export class SandboxSecurity {
  // List of dangerous modules that are blocked in sandbox
  // Note: This list can be used for future security implementations

  private static readonly DANGEROUS_GLOBALS = [
    'process',
    'global',
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
    'Buffer',
    'setImmediate',
    'clearImmediate',
    'queueMicrotask',
  ]

  static isCodeSafe(code: string): { safe: boolean; violations: string[] } {
    const violations: string[] = []

    // Check for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/g,
      /import\s+.*\s+from/g,
      /eval\s*\(/g,
      /Function\s*\(/g,
      /process\./g,
      /global\./g,
      /__dirname/g,
      /__filename/g,
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        violations.push(`Potentially dangerous pattern detected: ${pattern.source}`)
      }
    }

    // Check for attempts to access dangerous globals
    for (const globalName of this.DANGEROUS_GLOBALS) {
      if (code.includes(globalName)) {
        violations.push(`Access to dangerous global: ${globalName}`)
      }
    }

    return {
      safe: violations.length === 0,
      violations,
    }
  }

  static validatePermissions(
    requested: string[],
    allowed: string[]
  ): { valid: boolean; violations: string[] } {
    const violations: string[] = []

    for (const permission of requested) {
      if (!allowed.includes(permission) && !allowed.includes('*')) {
        violations.push(`Permission not allowed: ${permission}`)
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    }
  }

  static sanitizeContext(context: any): any {
    const sanitized: any = {}

    // Only allow safe properties
    const allowedProperties = [
      'console',
      'Date',
      'Math',
      'JSON',
      'String',
      'Number',
      'Boolean',
      'Array',
      'Object',
      'RegExp',
    ]

    for (const prop of allowedProperties) {
      if (context[prop]) {
        sanitized[prop] = context[prop]
      }
    }

    return sanitized
  }

  static validateResourceAccess(
    resource: string,
    allowedDomains?: string[]
  ): { allowed: boolean; reason?: string } {
    if (!allowedDomains || allowedDomains.length === 0) {
      return { allowed: false, reason: 'No allowed domains configured' }
    }

    // Check if resource URL is from allowed domain
    try {
      const url = new URL(resource)
      const isAllowed = allowedDomains.some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      )

      return {
        allowed: isAllowed,
        reason: isAllowed ? undefined : `Domain ${url.hostname} not in allowed list`,
      }
    } catch {
      return { allowed: false, reason: 'Invalid resource URL' }
    }
  }

  static checkMemoryUsage(): { usage: number; limit: number; percentage: number } {
    const usage = process.memoryUsage()
    const heapUsed = usage.heapUsed
    const limit = 128 * 1024 * 1024 // 128MB limit
    const percentage = (heapUsed / limit) * 100

    return {
      usage: heapUsed,
      limit,
      percentage,
    }
  }

  static enforceMemoryLimit(limitBytes: number): boolean {
    const { usage } = this.checkMemoryUsage()
    return usage <= limitBytes
  }
}
