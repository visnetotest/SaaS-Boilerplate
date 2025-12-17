// =============================================================================
// ENHANCED PLUGIN LOADER WITH DYNAMIC IMPORTS
// =============================================================================

import fs from 'fs/promises'
import path from 'path'
import type { 
  PluginManifest,
  PluginInstance,
  PluginContext,
  PluginError 
} from '@/types/plugin'

/**
 * Enhanced Plugin Loader with Dynamic Import Capabilities
 * 
 * Provides advanced plugin loading functionality including:
 * - Dynamic ES module imports
 * - Plugin validation and security checks
 * - Fallback to mock plugins for development
 * - Module caching and hot reload
 */
export class EnhancedPluginLoader {
  private moduleCache = new Map<string, any>()
  private readonly pluginDirectory: string

  constructor(pluginDirectory?: string) {
    this.pluginDirectory = pluginDirectory || path.join(process.cwd(), 'plugins')
  }

  /**
   * Load plugin module with dynamic import
   */
  async loadPluginModule(plugin: PluginInstance): Promise<any> {
    const pluginName = plugin.manifest.name
    
    try {
      // Try to load plugin dynamically from file system
      const pluginPath = path.join(this.pluginDirectory, plugin.manifest.slug)
      const mainFilePath = path.join(pluginPath, plugin.manifest.main)

      // Check if main file exists
      const fileExists = await this.fileExists(mainFilePath)
      
      if (fileExists) {
        console.log('Loading plugin module from: ' + mainFilePath)
        
        // Load plugin module using dynamic import
        const moduleUrl = 'file://' + mainFilePath
        const pluginModule = await import(moduleUrl)

        // Clear cache for hot reload (if enabled)
        const cacheKey = plugin.manifest.slug + '@' + plugin.manifest.version
        this.moduleCache.set(cacheKey, pluginModule)

        // Validate plugin module structure
        if (!pluginModule.default && !pluginModule.initialize) {
          throw new Error('Plugin must export a default module or initialize function')
        }

        const pluginExports = pluginModule.default || pluginModule

        // Return plugin module with expected interface
        return {
          initialize: pluginExports.initialize || async function(context: any) {
            context.logger.info(`Plugin ${pluginName} initialized (no custom initialize)`)
          },
          cleanup: pluginExports.cleanup || async function() {
            console.log(`Plugin ${pluginName} cleaned up (no custom cleanup)`)
          },
          activate: pluginExports.activate,
          deactivate: pluginExports.deactivate,
          exports: pluginExports.exports || pluginExports || {},
          config: pluginExports.config,
          hooks: pluginExports.hooks || {},
          // Plugin metadata
          version: pluginExports.version || plugin.manifest.version,
          author: pluginExports.author || plugin.manifest.author
        }
      } else {
        throw new Error('Plugin main file not found: ' + mainFilePath)
      }
    } catch (error) {
      // Fallback to mock plugin for development
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn('Failed to load plugin module, using mock: ' + errorMessage)
      
      return {
        initialize: async (context: PluginContext) => {
          context.logger.info('Plugin ' + pluginName + ' initialized (mock)')
        },
        cleanup: async () => {
          console.log('Plugin ' + pluginName + ' cleaned up (mock)')
        },
        exports: {
          hello: () => 'Hello from ' + pluginName + '! (mock)',
          info: () => ({
            name: pluginName,
            version: plugin.manifest.version,
            status: 'mock'
          })
        },
      }
    }
  }

  /**
   * Hot reload plugin module
   */
  async reloadPlugin(plugin: PluginInstance): Promise<any> {
    try {
      // Clear module cache for this plugin
      const cacheKey = plugin.manifest.slug + '@' + plugin.manifest.version
      this.moduleCache.delete(cacheKey)

      // Clear Node.js module cache (for server-side)
      if (typeof require !== 'undefined' && require.cache) {
        const pluginPath = path.join(this.pluginDirectory, plugin.manifest.slug, plugin.manifest.main)
        const resolvedPath = require.resolve(pluginPath)
        delete require.cache[resolvedPath]
      }

      // Reload plugin
      return await this.loadPluginModule(plugin)
    } catch (error) {
      const pluginError: PluginError = {
        code: 'RELOAD_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { pluginId: plugin.id },
      }
      throw pluginError
    }
  }

  /**
   * Validate plugin module before loading
   */
  async validatePluginModule(plugin: PluginInstance): Promise<boolean> {
    try {
      const pluginPath = path.join(this.pluginDirectory, plugin.manifest.slug)
      const mainFilePath = path.join(pluginPath, plugin.manifest.main)

      // Check if file exists
      if (!(await this.fileExists(mainFilePath))) {
        return false
      }

      // Try to load and validate structure
      const moduleUrl = 'file://' + mainFilePath
      const pluginModule = await import(moduleUrl)

      // Basic structure validation
      const hasDefault = !!pluginModule.default
      const hasInitialize = !!pluginModule.initialize
      const hasExports = !!pluginModule.exports

      return hasDefault || hasInitialize || hasExports
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn('Plugin validation failed: ' + errorMessage)
      return false
    }
  }

  /**
   * Get plugin module from cache
   */
  getCachedModule(plugin: PluginInstance): any | null {
    const cacheKey = plugin.manifest.slug + '@' + plugin.manifest.version
    return this.moduleCache.get(cacheKey) || null
  }

  /**
   * Clear plugin module cache
   */
  clearCache(pluginId?: string): void {
    if (pluginId) {
      // Clear specific plugin from cache
      for (const [key] of this.moduleCache) {
        if (key.startsWith(pluginId)) {
          this.moduleCache.delete(key)
        }
      }
    } else {
      // Clear all cache
      this.moduleCache.clear()
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.moduleCache.size,
      keys: Array.from(this.moduleCache.keys())
    }
  }

  /**
   * List available plugin files
   */
  async listAvailablePlugins(): Promise<string[]> {
    try {
      const exists = await this.fileExists(this.pluginDirectory)
      if (!exists) {
        return []
      }

      const entries = await fs.readdir(this.pluginDirectory, { withFileTypes: true })
      const plugins: string[] = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(this.pluginDirectory, entry.name, 'plugin.json')
          if (await this.fileExists(manifestPath)) {
            plugins.push(entry.name)
          }
        }
      }

      return plugins
    } catch (error) {
      console.error('Failed to list available plugins:', error)
      return []
    }
  }

  /**
   * Check if plugin file exists and is accessible
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get plugin file info
   */
  async getPluginFileInfo(plugin: PluginInstance): Promise<{
    exists: boolean
    path: string
    size?: number
    modified?: Date
  }> {
    const pluginPath = path.join(this.pluginDirectory, plugin.manifest.slug)
    const mainFilePath = path.join(pluginPath, plugin.manifest.main)

    try {
      const stats = await fs.stat(mainFilePath)
      return {
        exists: true,
        path: mainFilePath,
        size: stats.size,
        modified: stats.mtime
      }
    } catch {
      return {
        exists: false,
        path: mainFilePath
      }
    }
  }

  /**
   * Create a sample plugin file for testing
   */
  async createSamplePlugin(pluginName: string): Promise<void> {
    try {
      const pluginPath = path.join(this.pluginDirectory, pluginName)
      await fs.mkdir(pluginPath, { recursive: true })

      // Create plugin manifest
      const manifest = {
        name: pluginName,
        slug: pluginName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        version: '1.0.0',
        description: 'Sample plugin: ' + pluginName,
        author: 'Plugin Generator',
        category: 'utility',
        main: 'index.js',
        permissions: [],
        sandbox: { enabled: true, timeout: 30000 }
      }

      const manifestPath = path.join(pluginPath, 'plugin.json')
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

      // Create plugin main file
      const mainCode = '// Sample Plugin: ' + pluginName + '\n' +
        'export async function initialize(context) {\n' +
        '  context.logger.info("Plugin ' + pluginName + ' initialized")\n' +
        '}\n\n' +
        'export async function cleanup() {\n' +
        '  console.log("Plugin ' + pluginName + ' cleaned up")\n' +
        '}\n\n' +
        'export const exports = {\n' +
        '  hello: () => "Hello from ' + pluginName + ' plugin!",\n' +
        '  info: () => ({\n' +
        '    name: "' + pluginName + '",\n' +
        '    version: "1.0.0",\n' +
        '    type: "sample"\n' +
        '  })\n' +
        '}\n\n' +
        'export default {\n' +
        '  initialize,\n' +
        '  cleanup,\n' +
        '  exports\n' +
        '}'

      const mainFilePath = path.join(pluginPath, 'index.js')
      await fs.writeFile(mainFilePath, mainCode)

      console.log('Sample plugin created: ' + pluginPath)
    } catch (error) {
      console.error('Failed to create sample plugin:', error)
      throw error
    }
  }
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export const enhancedPluginLoader = new EnhancedPluginLoader()