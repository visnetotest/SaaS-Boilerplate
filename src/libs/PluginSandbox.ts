// =============================================================================
// PLUGIN SANDBOX
// =============================================================================

import { randomUUID } from 'crypto'

import type { PluginContext, PluginSandbox, PluginSandboxInstance } from '../types/plugin'

export class PluginSandboxImpl implements PluginSandbox {
  private sandboxes = new Map<string, PluginSandboxInstance>()

  async create(plugin: any): Promise<PluginSandboxInstance> {
    const sandboxId = randomUUID()

    const context = {
      id: sandboxId,
      pluginId: plugin.pluginId,
      tenantId: plugin.tenantId || 'default',
      config: plugin.config || {},
      permissions: [],
      api: this.createRestrictedAPI(),
      logger: this.createSandboxLogger(plugin.pluginId),
      storage: this.createSandboxStorage(plugin.pluginId),
    }

    const instance: PluginSandboxInstance = {
      id: sandboxId,
      pluginId: plugin.pluginId,
      context,

      execute: async (code: string, executionContext?: Partial<PluginContext>): Promise<any> => {
        return await this.executeSafely(instance, code, {
          ...context,
          ...executionContext,
        })
      },

      destroy: async (): Promise<void> => {
        await this.destroySandbox(instance)
        this.sandboxes.delete(sandboxId)
      },
    }

    this.sandboxes.set(sandboxId, instance)
    return instance
  }

  async execute(
    instance: PluginSandboxInstance,
    code: string,
    context: PluginContext
  ): Promise<any> {
    return await this.executeSafely(instance, code, context)
  }

  async destroy(instance: PluginSandboxInstance): Promise<void> {
    await this.destroySandbox(instance)
  }

  // Private methods
  private async executeSafely(
    instance: PluginSandboxInstance,
    code: string,
    context: PluginContext
  ): Promise<any> {
    try {
      // Create sandboxed execution environment
      const sandboxedContext = this.createSandboxedContext(instance.context, context)

      // Wrap plugin code in a sandbox function
      const sandboxedCode = this.wrapPluginCode(code, sandboxedContext)

      // Execute with timeout
      const timeout = instance.context.config.sandbox?.timeout || 30000
      const result = await this.executeWithTimeout(sandboxedCode, timeout)

      return result
    } catch (error) {
      instance.context.logger.error('Plugin execution failed', error as Error)
      throw new Error(
        `Plugin execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async destroySandbox(instance: PluginSandboxInstance): Promise<void> {
    try {
      // Cleanup any resources
      instance.context.logger.info('Sandbox destroyed for plugin', instance.pluginId)
    } catch (error) {
      console.error('Failed to destroy sandbox:', error)
    }
  }

  private createSandboxedContext(
    originalContext: PluginContext,
    executionContext?: Partial<PluginContext>
  ): PluginContext {
    return {
      ...originalContext,
      ...executionContext,

      // Restrict dangerous APIs
      api: this.createRestrictedAPI(),

      // Override storage to be sandboxed
      storage: this.createSandboxStorage(originalContext.config?.tenantId || 'system'),
    }
  }

  private wrapPluginCode(code: string, context: PluginContext): string {
    // Create a sandboxed execution environment
    return `
      (function() {
        'use strict';
        
        // Create sandboxed context
        const __sandboxContext = ${JSON.stringify(context)};
        
        // Mock global objects that could be dangerous
        const __globalOverrides = {
          process: undefined,
          require: undefined,
          global: undefined,
          window: undefined,
          document: undefined,
          fetch: undefined,
          setTimeout: undefined,
          setInterval: undefined,
        };
        
        // Create safe execution function
        const __executePlugin = function(pluginCode, context) {
          const __module = { exports: {} };
          
          // Execute plugin code in controlled environment
          try {
            const pluginFunction = new Function('context', 'module', 'require', 'process', 
              'with (__sandboxContext, __module, __globalOverrides.require, __globalOverrides.process) {' +
              pluginCode + '\\n' +
              '}');
            
            return pluginFunction();
          } catch (error) {
            throw error;
          }
        };
        
        // Execute and return result
        return __executePlugin(\`${code.replace(/`/g, '\\`')}\`, __sandboxContext);
      })();
    `
  }

  private async executeWithTimeout(code: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Plugin execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      try {
        // Execute the sandboxed code
        const result = eval(code)

        // Clear timeout if execution completes
        clearTimeout(timeoutId)

        resolve(result)
      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  private createRestrictedAPI() {
    return {
      // Provide restricted access to core APIs
      user: {
        getCurrent: async () => null,
        getById: async () => null,
        getByEmail: async () => null,
        create: async (_data: any) => {
          throw new Error('Access denied in sandbox')
        },
        update: async (_id: string, _data: any) => {
          throw new Error('Access denied in sandbox')
        },
        delete: async (_id: string) => {
          throw new Error('Access denied in sandbox')
        },
        list: async (_filters: any) => ({
          data: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        }),
      },

      tenant: {
        getCurrent: async () => null,
        getById: async () => null,
        getBySlug: async () => null,
        create: async (_data: any) => {
          throw new Error('Access denied in sandbox')
        },
        update: async (_id: string, _data: any) => {
          throw new Error('Access denied in sandbox')
        },
        delete: async (_id: string) => {
          throw new Error('Access denied in sandbox')
        },
        list: async (_filters: any) => ({
          data: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        }),
      },

      auth: {
        verify: async (_token: string) => null,
        generate: async (_user: any) => {
          throw new Error('Access denied in sandbox')
        },
        invalidate: async (_userId: string) => {
          throw new Error('Access denied in sandbox')
        },
        checkPermission: async (_userId: string, _permission: string) => false,
      },

      db: {
        query: async (_sql: any, _params: any) => [],
        transaction: async (_callback: any) => {
          throw new Error('Access denied in sandbox')
        },
      },

      events: {
        emit: async (event: string, data?: any) => {
          console.log(`[Sandbox Event] ${event}:`, data)
        },
        on: async (_event: string, _handler: Function) => {
          console.log(`[Sandbox Event Handler] Registered`)
        },
        off: async (_event: string, _handler: Function) => {
          console.log(`[Sandbox Event Handler] Removed`)
        },
        once: async (_event: string, _handler: Function) => {
          console.log(`[Sandbox Event Handler] Registered once`)
        },
      },

      config: {
        get: async (key: string) => {
          // Allow config access but with restrictions
          const sensitiveKeys = ['database_url', 'secret_key', 'private_key', 'password']
          if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
            throw new Error('Access denied: sensitive configuration key')
          }
          return null // Would be loaded from database in real implementation
        },
        set: async (key: string, value: any) => {
          // Allow config setting but with restrictions
          console.log(`[Sandbox Config] Setting ${key}:`, value)
        },
        delete: async (key: string) => {
          console.log(`[Sandbox Config] Deleting ${key}`)
        },
        all: async () => {
          return {}
        },
      },

      http: {
        get: async (url: string, options?: any) => {
          // Restrict HTTP calls to certain domains or require explicit permission
          const allowedDomains = ['api.example.com', 'plugins.example.com']
          const urlObj = new URL(url)

          if (!allowedDomains.includes(urlObj.hostname)) {
            throw new Error(`Access denied: HTTP requests to ${urlObj.hostname} not allowed`)
          }

          // In a real implementation, this would make a controlled HTTP request
          console.log(`[Sandbox HTTP] GET ${url}:`, options)
          return new Response('{}', { status: 200, statusText: 'OK' })
        },
        post: async (url: string, data?: any, options?: any) => {
          console.log(`[Sandbox HTTP] POST ${url}:`, data, options)
          return new Response('{}', { status: 200, statusText: 'OK' })
        },
        put: async (url: string, data?: any, options?: any) => {
          console.log(`[Sandbox HTTP] PUT ${url}:`, data, options)
          return new Response('{}', { status: 200, statusText: 'OK' })
        },
        delete: async (url: string, options?: any) => {
          console.log(`[Sandbox HTTP] DELETE ${url}:`, options)
          return new Response('{}', { status: 200, statusText: 'OK' })
        },
      },

      crypto: {
        hash: async (data: string) => {
          console.log(`[Sandbox Crypto] Hashing data`)
          return 'hashed_' + data
        },
        verify: async (data: string, hash: string) => {
          console.log(`[Sandbox Crypto] Verifying hash`)
          return hash === 'hashed_' + data
        },
        encrypt: async (_data: string, _key: string) => {
          console.log(`[Sandbox Crypto] Encrypting data`)
          return 'encrypted_mock'
        },
        decrypt: async (_data: string, _key: string) => {
          console.log(`[Sandbox Crypto] Decrypting data`)
          return 'decrypted_mock'
        },
        generateKey: async () => {
          console.log(`[Sandbox Crypto] Generating key`)
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

  private createSandboxLogger(pluginId: string) {
    return {
      debug: (message: string, meta?: any) => {
        console.log(`[Sandbox-${pluginId}] DEBUG: ${message}`, meta)
      },
      info: (message: string, meta?: any) => {
        console.log(`[Sandbox-${pluginId}] INFO: ${message}`, meta)
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[Sandbox-${pluginId}] WARN: ${message}`, meta)
      },
      error: (message: string, error?: Error, meta?: any) => {
        console.error(`[Sandbox-${pluginId}] ERROR: ${message}`, error, meta)
      },
    }
  }

  private createSandboxStorage(pluginId: string) {
    const storagePrefix = `sandbox_${pluginId}_`

    return {
      get: async (key: string) => {
        if (typeof window !== 'undefined') {
          // Client-side: use localStorage with namespace
          const value = localStorage.getItem(storagePrefix + key)
          return value ? JSON.parse(value) : null
        } else {
          // Server-side: use in-memory storage (in real implementation, use database)
          console.log(`[Sandbox Storage] Get ${storagePrefix + key}`)
          return null
        }
      },

      set: async (key: string, value: any) => {
        const serialized = JSON.stringify(value)

        if (typeof window !== 'undefined') {
          localStorage.setItem(storagePrefix + key, serialized)
        } else {
          console.log(`[Sandbox Storage] Set ${storagePrefix + key}:`, value)
        }
      },

      delete: async (key: string) => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(storagePrefix + key)
        } else {
          console.log(`[Sandbox Storage] Delete ${storagePrefix + key}`)
        }
      },

      clear: async () => {
        if (typeof window !== 'undefined') {
          const keys = Object.keys(localStorage).filter((k) => k.startsWith(storagePrefix))
          keys.forEach((key) => localStorage.removeItem(key))
        } else {
          console.log(`[Sandbox Storage] Clear ${storagePrefix}`)
        }
      },

      keys: async () => {
        if (typeof window !== 'undefined') {
          const prefixLength = storagePrefix.length
          return Object.keys(localStorage)
            .filter((k) => k.startsWith(storagePrefix))
            .map((k) => k.substring(prefixLength))
        } else {
          return []
        }
      },

      size: async () => {
        const storageObj = this.createSandboxStorage('temp') // Get storage object to access its methods
        const storageKeys = await storageObj.keys()
        let size = 0

        if (typeof window !== 'undefined') {
          for (const key of storageKeys) {
            const value = localStorage.getItem('sandbox_temp_' + key)
            if (value) {
              size += value.length
            }
          }
        }

        return size
      },
    }
  }
}
