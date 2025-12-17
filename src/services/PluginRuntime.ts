// =============================================================================
// PLUGIN RUNTIME SERVICE
// =============================================================================

import { PluginSandboxImpl } from '../libs/PluginSandbox'
import { PluginRegistry, PluginLoader, PluginSandbox } from '@/types/plugin'

/**
 * Plugin Runtime Service
 * 
 * Provides high-level plugin management functionality including:
 * - Plugin registration and lifecycle management
 * - Plugin loading and unloading
 * - Hook and event system
 * - Sandboxed execution environment
 * - Plugin discovery and validation
 */
export class PluginRuntime {
  private registry: PluginRegistry
  private loader: PluginLoader
  private sandbox: PluginSandbox

  constructor() {
    this.registry = new PluginRegistry()
    this.sandbox = new PluginSandboxImpl()
    
    // In a real implementation, we would inject the actual API dependencies
    this.loader = new (null as any)()
  }

  // =============================================================================
  // PLUGIN LIFECYCLE MANAGEMENT
  // =============================================================================

  /**
   * Register a new plugin from manifest
   */
  async registerPlugin(manifestPath: string, tenantId?: string): Promise<string> {
    try {
      // Load plugin manifest
      const manifest = await this.loader.loadFromPath(manifestPath)
      
      // Validate and register plugin
      const instance = await this.registry.register(manifest)
      
      console.log(`Plugin registered: ${manifest.name} (${manifest.slug})`)
      return instance.id
    } catch (error) {
      console.error('Failed to register plugin:', error)
      throw error
    }
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    try {
      await this.registry.unregister(pluginId)
      console.log(`Plugin unregistered: ${pluginId}`)
    } catch (error) {
      console.error('Failed to unregister plugin:', error)
      throw error
    }
  }

  /**
   * Load a plugin (make it active)
   */
  async loadPlugin(pluginId: string, tenantId?: string): Promise<void> {
    try {
      await this.registry.load(pluginId, tenantId)
      console.log(`Plugin loaded: ${pluginId}`)
    } catch (error) {
      console.error('Failed to load plugin:', error)
      throw error
    }
  }

  /**
   * Unload a plugin (make it inactive)
   */
  async unloadPlugin(pluginId: string, tenantId?: string): Promise<void> {
    try {
      await this.registry.unload(pluginId, tenantId)
      console.log(`Plugin unloaded: ${pluginId}`)
    } catch (error) {
      console.error('Failed to unload plugin:', error)
      throw error
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string, tenantId?: string): Promise<void> {
    try {
      await this.registry.enable(pluginId, tenantId)
      console.log(`Plugin enabled: ${pluginId}`)
    } catch (error) {
      console.error('Failed to enable plugin:', error)
      throw error
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string, tenantId?: string): Promise<void> {
    try {
      await this.registry.disable(pluginId, tenantId)
      console.log(`Plugin disabled: ${pluginId}`)
    } catch (error) {
      console.error('Failed to disable plugin:', error)
      throw error
    }
  }

  // =============================================================================
  // PLUGIN DISCOVERY
  // =============================================================================

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string) {
    return this.registry.get(pluginId)
  }

  /**
   * List all plugins with optional filtering
   */
  listPlugins(filters?: any) {
    return this.registry.list(filters)
  }

  /**
   * Search plugins by query
   */
  searchPlugins(query: string) {
    return this.registry.search(query)
  }

  // =============================================================================
  // PLUGIN HOOKS AND EVENTS
  // =============================================================================

  /**
   * Add a hook handler
   */
  async addHook(event: string, handler: any): Promise<void> {
    try {
      await this.registry.addHook(event, handler)
      console.log(`Hook added for event: ${event}`)
    } catch (error) {
      console.error('Failed to add hook:', error)
      throw error
    }
  }

  /**
   * Remove a hook handler
   */
  async removeHook(event: string, handler: any): Promise<void> {
    try {
      await this.registry.removeHook(event, handler)
      console.log(`Hook removed for event: ${event}`)
    } catch (error) {
      console.error('Failed to remove hook:', error)
      throw error
    }
  }

  /**
   * Execute a hook with data
   */
  async executeHook(event: string, data: any): Promise<any[]> {
    try {
      return await this.registry.executeHook(event, data)
    } catch (error) {
      console.error('Failed to execute hook:', error)
      throw error
    }
  }

  /**
   * Emit an event to all listeners
   */
  async emitEvent(event: string, data?: any): Promise<void> {
    try {
      await this.registry.emit(event, data)
      console.log(`Event emitted: ${event}`)
    } catch (error) {
      console.error('Failed to emit event:', error)
      throw error
    }
  }

  /**
   * Register an event listener
   */
  async onEvent(event: string, handler: Function): Promise<void> {
    try {
      await this.registry.on(event, handler)
      console.log(`Event listener registered for: ${event}`)
    } catch (error) {
      console.error('Failed to register event listener:', error)
      throw error
    }
  }

  /**
   * Unregister an event listener
   */
  async offEvent(event: string, handler: Function): Promise<void> {
    try {
      await this.registry.off(event, handler)
      console.log(`Event listener unregistered for: ${event}`)
    } catch (error) {
      console.error('Failed to unregister event listener:', error)
      throw error
    }
  }

  // =============================================================================
  // PLUGIN VALIDATION
  // =============================================================================

  /**
   * Validate plugin manifest
   */
  async validatePlugin(manifestPath: string): Promise<boolean> {
    try {
      const manifest = await this.loader.loadFromPath(manifestPath)
      const validation = await this.loader.validate(manifest)
      
      if (!validation.valid) {
        console.error('Plugin validation failed:', validation.errors)
        return false
      }
      
      if (validation.warnings.length > 0) {
        console.warn('Plugin validation warnings:', validation.warnings)
      }
      
      return true
    } catch (error) {
      console.error('Failed to validate plugin:', error)
      return false
    }
  }

  // =============================================================================
  // PLUGIN EXECUTION
  // =============================================================================

  /**
   * Execute plugin code in sandbox
   */
  async executePlugin(pluginId: string, code: string, context?: any): Promise<any> {
    try {
      const plugin = this.registry.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      if (plugin.status !== 'active') {
        throw new Error(`Plugin ${pluginId} is not active`)
      }

      const sandboxInstance = await this.sandbox.create(plugin)
      return await sandboxInstance.execute(code, context)
    } catch (error) {
      console.error('Failed to execute plugin:', error)
      throw error
    }
  }

  /**
   * Execute a specific plugin method
   */
  async executePluginMethod(
    pluginId: string,
    methodName: string,
    args: any[] = [],
    context?: any
  ): Promise<any> {
    try {
      const plugin = this.registry.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      if (!plugin.exports[methodName]) {
        throw new Error(`Method ${methodName} not found in plugin ${pluginId}`)
      }

      const method = plugin.exports[methodName]
      
      // Execute method with provided arguments
      const result = await method(...args)
      
      console.log(`Plugin method executed: ${pluginId}.${methodName}`)
      return result
    } catch (error) {
      console.error('Failed to execute plugin method:', error)
      throw error
    }
  }

  // =============================================================================
  // PLUGIN HEALTH AND MONITORING
  // =============================================================================

  /**
   * Get plugin health status
   */
  getPluginHealth(pluginId: string) {
    const plugin = this.registry.get(pluginId)
    
    if (!plugin) {
      return {
        status: 'not_found',
        error: null,
        lastExecution: null,
        executionCount: 0,
      }
    }

    return {
      status: plugin.status,
      error: plugin.lastError || null,
      lastExecution: plugin.loadedAt || null,
      executionCount: plugin.executionCount || 0,
    }
  }

  /**
   * Get runtime statistics
   */
  getRuntimeStats() {
    const plugins = this.registry.list()
    
    return {
      totalPlugins: plugins.length,
      activePlugins: plugins.filter(p => p.status === 'active').length,
      inactivePlugins: plugins.filter(p => p.status === 'inactive').length,
      errorPlugins: plugins.filter(p => p.status === 'error').length,
      
      categories: this.getPluginCategories(plugins),
      lastUpdated: new Date().toISOString(),
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private getPluginCategories(plugins: any[]) {
    const categories = new Map<string, number>()
    
    for (const plugin of plugins) {
      const category = plugin.manifest?.category || 'unknown'
      categories.set(category, (categories.get(category) || 0) + 1)
    }
    
    return Object.fromEntries(categories)
  }

  /**
   * Cleanup plugin resources
   */
  async cleanup(): Promise<void> {
    try {
      // Unload all active plugins
      const plugins = this.registry.list({ status: 'active' })
      
      for (const plugin of plugins) {
        try {
          await this.unloadPlugin(plugin.id)
        } catch (error) {
          console.error(`Failed to cleanup plugin ${plugin.id}:`, error)
        }
      }
      
      console.log('Plugin runtime cleanup completed')
    } catch (error) {
      console.error('Failed to cleanup plugin runtime:', error)
      throw error
    }
  }
}

// =============================================================================
// EXPORT SINGLETON INSTANCE
// =============================================================================

export const pluginRuntime = new PluginRuntime()