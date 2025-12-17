// =============================================================================
// PLUGIN LIFECYCLE MANAGER
// =============================================================================

import { EventEmitter } from 'events'
import {
  PluginInstance,
  PluginManifest,
  PluginStatus,
  PluginError
} from '@/types/plugin'

/**
 * Plugin Lifecycle Manager
 * 
 * Manages the complete lifecycle of plugins including:
 * - Installation and registration
 * - Activation and deactivation
 * - Error handling and recovery
 * - Dependencies management
 * - Event broadcasting
 */
export class PluginLifecycleManager extends EventEmitter {
  private plugins = new Map<string, PluginInstance>()
  private dependencies = new Map<string, string[]>() // plugin -> dependencies
  private dependents = new Map<string, string[]>() // plugin -> dependents
  private operationQueue: Array<() => Promise<void>> = []
  private isProcessing = false

  constructor() {
    super()
    this.setupEventHandlers()
  }

  // =============================================================================
  // PLUGIN INSTALLATION LIFECYCLE
  // =============================================================================

  /**
   * Install plugin with full lifecycle management
   */
  async installPlugin(manifest: PluginManifest, tenantId?: string): Promise<PluginInstance> {
    const pluginId = this.generatePluginId(manifest.slug)
    
    const operation = async () => {
      
      try {
        // Emit pre-install event
        this.emit('plugin:pre-install', { manifest, tenantId })

        // Create plugin instance
        const instance: PluginInstance = {
          id: pluginId,
          pluginId: manifest.slug,
          tenantId,
          status: PluginStatus.LOADING,
          config: {},
          manifest,
          executionCount: 0,
          exports: {},
          handlers: {},
        }

        // Register plugin
        this.plugins.set(pluginId, instance)
        
        // Handle dependencies
        await this.resolveDependencies(instance)
        
        // Update status
        instance.status = PluginStatus.INSTALLED
        
        // Emit post-install event
        this.emit('plugin:installed', { instance, tenantId })
        
        console.log(`Plugin installed successfully: ${manifest.name} (${pluginId})`)
        
      } catch (error) {
        // Cleanup on failure
        const instance = this.plugins.get(pluginId)
        if (instance) {
          instance.status = PluginStatus.ERROR
          instance.lastError = {
            code: 'INSTALLATION_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            context: { manifest: manifest.name, tenantId }
          }
        }
        
        this.emit('plugin:install-error', { 
          pluginId, 
          error: error instanceof Error ? error : new Error('Unknown error'),
          manifest,
          tenantId 
        })
        
        throw error
      }
    }

    return this.queueOperation(operation).then(() => {
      return this.plugins.get(pluginId)!
    })
  }

  /**
   * Uninstall plugin with dependency cleanup
   */
  async uninstallPlugin(pluginId: string, force = false): Promise<void> {
    const operation = async () => {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      try {
        // Emit pre-uninstall event
        this.emit('plugin:pre-uninstall', { plugin })

        // Check for dependents
        const dependents = this.dependents.get(pluginId) || []
        if (dependents.length > 0 && !force) {
          throw new Error(
            `Cannot uninstall plugin ${pluginId}: has active dependents: ${dependents.join(', ')}`
          )
        }

        // Deactivate if active
        if (plugin.status === PluginStatus.ACTIVE) {
          await this.deactivatePlugin(pluginId)
        }

        // Remove from registries
        this.plugins.delete(pluginId)
        this.dependencies.delete(pluginId)
        this.dependents.delete(pluginId)

        // Update dependent mappings
        for (const [, deps] of this.dependencies) {
          const index = deps.indexOf(pluginId)
          if (index !== -1) {
            deps.splice(index, 1)
          }
        }

        plugin.status = PluginStatus.INACTIVE

        // Emit post-uninstall event
        this.emit('plugin:uninstalled', { plugin })
        
        console.log(`Plugin uninstalled successfully: ${pluginId}`)
        
      } catch (error) {
        plugin.status = PluginStatus.ERROR
        plugin.lastError = {
          code: 'UNINSTALLATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          context: { pluginId }
        }

        this.emit('plugin:uninstall-error', { 
          pluginId, 
          error: error instanceof Error ? error : new Error('Unknown error')
        })
        
        throw error
      }
    }

    return this.queueOperation(operation)
  }

  // =============================================================================
  // PLUGIN ACTIVATION LIFECYCLE
  // =============================================================================

  /**
   * Activate plugin with dependency resolution
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const operation = async () => {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      if (plugin.status === PluginStatus.ACTIVE) {
        return // Already active
      }

      try {
        // Emit pre-activation event
        this.emit('plugin:pre-activate', { plugin })

        // Check and activate dependencies
        await this.activateDependencies(pluginId)

        // Update status
        plugin.status = PluginStatus.LOADING

        // This would be handled by PluginRegistry's load method
        // For now, just update status
        plugin.status = PluginStatus.ACTIVE
        plugin.loadedAt = new Date()
        plugin.executionCount++

        // Emit post-activation event
        this.emit('plugin:activated', { plugin })
        
        console.log(`Plugin activated successfully: ${pluginId}`)
        
      } catch (error) {
        plugin.status = PluginStatus.ERROR
        plugin.lastError = {
          code: 'ACTIVATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          context: { pluginId }
        }

        this.emit('plugin:activate-error', { 
          pluginId, 
          error: error instanceof Error ? error : new Error('Unknown error')
        })
        
        throw error
      }
    }

    return this.queueOperation(operation)
  }

  /**
   * Deactivate plugin with dependent handling
   */
  async deactivatePlugin(pluginId: string, force = false): Promise<void> {
    const operation = async () => {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      if (plugin.status !== PluginStatus.ACTIVE) {
        return // Not active
      }

      try {
        // Emit pre-deactivation event
        this.emit('plugin:pre-deactivate', { plugin })

        // Check for active dependents
        const dependents = this.dependents.get(pluginId) || []
        if (dependents.length > 0 && !force) {
          throw new Error(
            `Cannot deactivate plugin ${pluginId}: has active dependents: ${dependents.join(', ')}`
          )
        }

        // Update status
        plugin.status = PluginStatus.UNLOADING

        // This would be handled by PluginRegistry's unload method
        // For now, just update status
        plugin.status = PluginStatus.INACTIVE

        // Emit post-deactivation event
        this.emit('plugin:deactivated', { plugin })
        
        console.log(`Plugin deactivated successfully: ${pluginId}`)
        
      } catch (error) {
        plugin.status = PluginStatus.ERROR
        plugin.lastError = {
          code: 'DEACTIVATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          context: { pluginId }
        }

        this.emit('plugin:deactivate-error', { 
          pluginId, 
          error: error instanceof Error ? error : new Error('Unknown error')
        })
        
        throw error
      }
    }

    return this.queueOperation(operation)
  }

  // =============================================================================
  // PLUGIN UPDATE LIFECYCLE
  // =============================================================================

  /**
   * Update plugin with version migration
   */
  async updatePlugin(pluginId: string, newManifest: PluginManifest): Promise<void> {
    const operation = async () => {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      try {
        // Emit pre-update event
        this.emit('plugin:pre-update', { plugin, newManifest })

        const oldVersion = plugin.manifest.version
        const newVersion = newManifest.version

        // Deactivate plugin
        if (plugin.status === PluginStatus.ACTIVE) {
          await this.deactivatePlugin(pluginId)
        }

        // Update manifest
        plugin.manifest = newManifest
        plugin.status = PluginStatus.UPDATING

        // Run migration if needed
        if (oldVersion !== newVersion) {
          await this.runMigration(plugin, oldVersion, newVersion)
        }

        // Reactivate if it was active before update
        if (plugin.status === PluginStatus.UPDATING) {
          await this.activatePlugin(pluginId)
        }

        // Emit post-update event
        this.emit('plugin:updated', { plugin, oldVersion, newVersion })
        
        console.log(`Plugin updated successfully: ${pluginId} (${oldVersion} -> ${newVersion})`)
        
      } catch (error) {
        plugin.status = PluginStatus.ERROR
        plugin.lastError = {
          code: 'UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          context: { pluginId, oldVersion: plugin.manifest.version, newVersion: newManifest.version }
        }

        this.emit('plugin:update-error', { 
          pluginId, 
          error: error instanceof Error ? error : new Error('Unknown error'),
          newManifest
        })
        
        throw error
      }
    }

    return this.queueOperation(operation)
  }

  // =============================================================================
  // DEPENDENCY MANAGEMENT
  // =============================================================================

  /**
   * Resolve and validate plugin dependencies
   */
  private async resolveDependencies(plugin: PluginInstance): Promise<void> {
    const deps = plugin.manifest.dependencies || {}
    const dependencyIds: string[] = []

    for (const [depName, version] of Object.entries(deps)) {
      // Find dependency plugin
      let dependencyPlugin: PluginInstance | null = null
      
    for (const p of this.plugins.values()) {
      if (p.manifest.slug === depName || p.manifest.name === depName) {
        dependencyPlugin = p
        break
      }
    }

      if (!dependencyPlugin) {
        if (plugin.manifest.requires.some(req => req.name === depName && !req.optional)) {
          throw new Error(`Required dependency ${depName} not found`)
        }
        continue // Skip optional dependencies
      }

      // Validate version compatibility
      if (!this.isVersionCompatible(dependencyPlugin.manifest.version, version)) {
        throw new Error(
          `Dependency version mismatch: ${depName} requires ${version}, but ${dependencyPlugin.manifest.version} is installed`
        )
      }

      dependencyIds.push(dependencyPlugin.id)
    }

    // Store dependencies
    this.dependencies.set(plugin.id, dependencyIds)

    // Update dependents mapping
    for (const depId of dependencyIds) {
      const currentDependents = this.dependents.get(depId) || []
      currentDependents.push(plugin.id)
      this.dependents.set(depId, currentDependents)
    }
  }

  /**
   * Activate all dependencies of a plugin
   */
  private async activateDependencies(pluginId: string): Promise<void> {
    const dependencies = this.dependencies.get(pluginId) || []
    
    for (const depId of dependencies) {
      const dep = this.plugins.get(depId)
      if (dep && dep.status !== PluginStatus.ACTIVE) {
        await this.activatePlugin(depId)
      }
    }
  }

  /**
   * Check version compatibility (simple semver)
   */
  private isVersionCompatible(installed: string, required: string): boolean {
    // Simple version check - in real implementation, use semver library
    const installedParts = installed.split('.').map(Number)
    const requiredParts = required.split('.').map(Number)
    
    for (let i = 0; i < Math.max(installedParts.length, requiredParts.length); i++) {
      const installedPart = installedParts[i] || 0
      const requiredPart = requiredParts[i] || 0
      
      if (installedPart > requiredPart) return true
      if (installedPart < requiredPart) return false
    }
    
    return true
  }

  // =============================================================================
  // MIGRATION SUPPORT
  // =============================================================================

  /**
   * Run plugin migration between versions
   */
  private async runMigration(plugin: PluginInstance, fromVersion: string, toVersion: string): Promise<void> {
    console.log(`Running migration for plugin ${plugin.id}: ${fromVersion} -> ${toVersion}`)
    
    // Emit migration event
    this.emit('plugin:migrate', { plugin, fromVersion, toVersion })
    
    // In a real implementation, this would:
    // 1. Check for migration scripts in plugin
    // 2. Execute migration in a transaction
    // 3. Handle migration errors
    // 4. Update plugin state
    
    // For now, just log the migration
    plugin.executionCount++
  }

  // =============================================================================
  // OPERATION QUEUE MANAGEMENT
  // =============================================================================

  /**
   * Queue an operation to prevent race conditions
   */
  private async queueOperation(operation: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push(async () => {
        try {
          await operation()
          resolve()
        } catch (error) {
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }

  /**
   * Process the operation queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.operationQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift()!
      try {
        await operation()
      } catch (error) {
        console.error('Operation failed:', error)
      }
    }

    this.isProcessing = false
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): PluginInstance | null {
    return this.plugins.get(pluginId) || null
  }

  /**
   * Get all plugins with optional filtering
   */
  getPlugins(status?: PluginStatus): PluginInstance[] {
    const plugins = Array.from(this.plugins.values())
    
    if (status !== undefined) {
      return plugins.filter(p => p.status === status)
    }
    
    return plugins
  }

  /**
   * Get plugin dependencies
   */
  getPluginDependencies(pluginId: string): string[] {
    return this.dependencies.get(pluginId) || []
  }

  /**
   * Get plugin dependents
   */
  getPluginDependents(pluginId: string): string[] {
    return this.dependents.get(pluginId) || []
  }

  /**
   * Check if plugin can be safely uninstalled
   */
  canUninstallPlugin(pluginId: string): boolean {
    const dependents = this.dependents.get(pluginId) || []
    return dependents.length === 0
  }

  /**
   * Check if plugin can be safely deactivated
   */
  canDeactivatePlugin(pluginId: string): boolean {
    const dependents = this.dependents.get(pluginId) || []
    const activeDependents = dependents.filter(depId => {
      const dep = this.plugins.get(depId)
      return dep && dep.status === PluginStatus.ACTIVE
    })
    return activeDependents.length === 0
  }

  /**
   * Get plugin health status
   */
  getPluginHealth(pluginId: string): {
    status: PluginStatus
    lastError?: PluginError
    executionCount: number
    loadedAt?: Date
    dependents: string[]
    dependencies: string[]
  } | null {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      return null
    }

    return {
      status: plugin.status,
      lastError: plugin.lastError,
      executionCount: plugin.executionCount,
      loadedAt: plugin.loadedAt,
      dependents: this.getPluginDependents(pluginId),
      dependencies: this.getPluginDependencies(pluginId)
    }
  }

  /**
   * Get lifecycle statistics
   */
  getLifecycleStats(): {
    total: number
    active: number
    inactive: number
    error: number
    loading: number
  } {
    const plugins = Array.from(this.plugins.values())
    
    return {
      total: plugins.length,
      active: plugins.filter(p => p.status === PluginStatus.ACTIVE).length,
      inactive: plugins.filter(p => p.status === PluginStatus.INACTIVE).length,
      error: plugins.filter(p => p.status === PluginStatus.ERROR).length,
      loading: plugins.filter(p => p.status === PluginStatus.LOADING).length,
    }
  }

  /**
   * Setup event handlers for logging
   */
  private setupEventHandlers(): void {
    this.on('plugin:installed', (data) => {
      console.log('📦 Plugin installed:', data.instance.manifest.name)
    })
    
    this.on('plugin:uninstalled', (data) => {
      console.log('🗑️  Plugin uninstalled:', data.plugin.manifest.name)
    })
    
    this.on('plugin:activated', (data) => {
      console.log('✅ Plugin activated:', data.plugin.manifest.name)
    })
    
    this.on('plugin:deactivated', (data) => {
      console.log('⏸️  Plugin deactivated:', data.plugin.manifest.name)
    })
    
    this.on('plugin:error', (data) => {
      console.error('❌ Plugin error:', data)
    })
  }

  /**
   * Generate unique plugin ID
   */
  private generatePluginId(slug: string): string {
    return `plugin_${slug}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    const plugins = Array.from(this.plugins.values())
    
    // Deactivate all active plugins in reverse dependency order
    for (const plugin of plugins.reverse()) {
      if (plugin.status === PluginStatus.ACTIVE) {
        try {
          await this.deactivatePlugin(plugin.id, true) // Force deactivate
        } catch (error) {
          console.error(`Failed to deactivate plugin ${plugin.id}:`, error)
        }
      }
    }
    
    // Clear all mappings
    this.plugins.clear()
    this.dependencies.clear()
    this.dependents.clear()
    this.operationQueue.length = 0
    this.isProcessing = false
    
    console.log('Plugin lifecycle manager cleanup completed')
  }
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export const pluginLifecycleManager = new PluginLifecycleManager()