// =============================================================================
// PLUGIN API INTERFACES AND BASE CLASSES
// =============================================================================

import type {
  PluginContext,
  PluginManifest,
  PluginStatus,
  PluginHook,
  PluginPermission,
  PluginAPI
} from '@/types/plugin'

/**
 * Base Plugin Class
 * 
 * All plugins should extend this class to ensure compatibility
 * with the plugin system
 */
export abstract class BasePlugin {
  protected context?: PluginContext
  protected manifest: PluginManifest
  protected isInitialized = false
  protected isActive = false

  constructor(manifest: PluginManifest) {
    this.manifest = manifest
  }

  // =============================================================================
  // LIFECYCLE HOOKS (to be overridden by plugins)
  // =============================================================================

  /**
   * Called when plugin is initialized
   */
  async onInitialize(context: PluginContext): Promise<void> {
    this.context = context
    this.isInitialized = true
    context.logger.info(`Plugin ${this.manifest.name} initialized`)
  }

  /**
   * Called when plugin is activated
   */
  async onActivate(): Promise<void> {
    this.isActive = true
    if (this.context) {
      this.context.logger.info(`Plugin ${this.manifest.name} activated`)
    }
  }

  /**
   * Called when plugin is deactivated
   */
  async onDeactivate(): Promise<void> {
    this.isActive = false
    if (this.context) {
      this.context.logger.info(`Plugin ${this.manifest.name} deactivated`)
    }
  }

  /**
   * Called when plugin is cleaned up
   */
  async onCleanup(): Promise<void> {
    this.isInitialized = false
    this.isActive = false
    console.log(`Plugin ${this.manifest.name} cleaned up`)
  }

  /**
   * Called when plugin configuration is updated
   */
  async onConfigUpdate(newConfig: Record<string, any>): Promise<void> {
    if (this.context) {
      this.context.logger.info(`Plugin ${this.manifest.name} configuration updated`)
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Get plugin manifest
   */
  getManifest(): PluginManifest {
    return this.manifest
  }

  /**
   * Get plugin status
   */
  getStatus(): {
    initialized: boolean
    active: boolean
    version: string
    name: string
  } {
    return {
      initialized: this.isInitialized,
      active: this.isActive,
      version: this.manifest.version,
      name: this.manifest.name
    }
  }

  /**
   * Check if plugin has permission
   */
  hasPermission(resource: string, action: string): boolean {
    if (!this.context) return false
    
    const permission = `${resource}:${action}`
    return this.context.permissions.includes(permission)
  }

  /**
   * Get context API
   */
  getAPI(): PluginAPI | null {
    return this.context?.api || null
  }

  /**
   * Get context logger
   */
  getLogger(): any {
    return this.context?.logger || console
  }

  /**
   * Get context storage
   */
  getStorage(): any {
    return this.context?.storage || null
  }

  // =============================================================================
  // ABSTRACT METHODS (to be implemented by plugins)
  // =============================================================================

  /**
   * Get plugin exports - what the plugin provides to other plugins
   */
  abstract getExports(): Record<string, any>

  /**
   * Get plugin hooks - what events the plugin listens to
   */
  abstract getHooks(): PluginHook[]

  /**
   * Validate plugin configuration
   */
  abstract validateConfig(config: Record<string, any>): boolean
}

// =============================================================================
// SPECIALIZED PLUGIN BASE CLASSES
// =============================================================================

/**
 * Authentication Plugin Base Class
 */
export abstract class AuthenticationPlugin extends BasePlugin {
  async onInitialize(context: PluginContext): Promise<void> {
    await super.onInitialize(context)
    // Auto-register authentication hooks
    this.registerAuthHooks()
  }

  abstract authenticate(credentials: any): Promise<any>
  abstract authorize(token: string): Promise<any>
  abstract logout(token: string): Promise<void>

  protected registerAuthHooks(): void {
    if (this.context) {
      // Register authentication hooks
      this.context.api.events.on('auth:login', this.handleAuthEvent.bind(this))
      this.context.api.events.on('auth:logout', this.handleAuthEvent.bind(this))
    }
  }

  private handleAuthEvent(event: any): void {
    this.getLogger().info('Auth event:', event)
  }
}

/**
 * Payment Plugin Base Class
 */
export abstract class PaymentPlugin extends BasePlugin {
  async onInitialize(context: PluginContext): Promise<void> {
    await super.onInitialize(context)
    // Auto-register payment hooks
    this.registerPaymentHooks()
  }

  abstract processPayment(paymentData: any): Promise<any>
  abstract refundPayment(paymentId: string): Promise<any>
  abstract getPaymentMethods(): Promise<any[]>

  protected registerPaymentHooks(): void {
    if (this.context) {
      this.context.api.events.on('payment:process', this.handlePaymentEvent.bind(this))
      this.context.api.events.on('payment:refund', this.handlePaymentEvent.bind(this))
    }
  }

  private handlePaymentEvent(event: any): void {
    this.getLogger().info('Payment event:', event)
  }
}

/**
 * Analytics Plugin Base Class
 */
export abstract class AnalyticsPlugin extends BasePlugin {
  async onInitialize(context: PluginContext): Promise<void> {
    await super.onInitialize(context)
    // Auto-register analytics hooks
    this.registerAnalyticsHooks()
  }

  abstract trackEvent(event: string, data?: any): Promise<void>
  abstract trackPageView(page: string, data?: any): Promise<void>
  abstract trackUser(userId: string, properties?: any): Promise<void>

  protected registerAnalyticsHooks(): void {
    if (this.context) {
      this.context.api.events.on('analytics:event', this.handleAnalyticsEvent.bind(this))
      this.context.api.events.on('analytics:pageview', this.handleAnalyticsEvent.bind(this))
      this.context.api.events.on('analytics:user', this.handleAnalyticsEvent.bind(this))
    }
  }

  private handleAnalyticsEvent(event: any): void {
    this.getLogger().info('Analytics event:', event)
  }
}

/**
 * UI Plugin Base Class
 */
export abstract class UIPlugin extends BasePlugin {
  protected components = new Map<string, any>()
  protected routes = new Map<string, any>()

  async onInitialize(context: PluginContext): Promise<void> {
    await super.onInitialize(context)
    // Auto-register UI hooks
    this.registerUIHooks()
  }

  abstract registerComponent(name: string, component: any): void
  abstract registerRoute(path: string, component: any): void
  abstract getComponent(name: string): any
  abstract getRoutes(): Record<string, any>

  protected registerUIHooks(): void {
    if (this.context) {
      this.context.api.events.on('ui:register-component', this.handleUIEvent.bind(this))
      this.context.api.events.on('ui:register-route', this.handleUIEvent.bind(this))
    }
  }

  private handleUIEvent(event: any): void {
    this.getLogger().info('UI event:', event)
  }
}

// =============================================================================
// PLUGIN DECORATORS
// =============================================================================

/**
 * Plugin decorator for metadata
 */
export function Plugin(metadata: Partial<PluginManifest>) {
  return function<T extends new (...args: any[]) => BasePlugin>(constructor: T) {
    return class extends constructor {
      manifest: PluginManifest = {
        name: metadata.name || constructor.name,
        slug: metadata.slug || constructor.name.toLowerCase(),
        version: metadata.version || '1.0.0',
        description: metadata.description || '',
        author: metadata.author || 'Unknown',
        category: metadata.category || 'utility',
        tags: metadata.tags || [],
        dependencies: metadata.dependencies || {},
        provides: metadata.provides || [],
        requires: metadata.requires || [],
        main: metadata.main || 'index.js',
        permissions: metadata.permissions || [],
        sandbox: metadata.sandbox || { enabled: true },
        hooks: metadata.hooks || [],
        config: metadata.config,
      }
    }
  }
}

/**
 * Hook decorator for plugin hooks
 */
export function Hook(event: string, priority = 0) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function(...args: any[]) {
      // Register this method as a hook handler
      if (this.context && this.context.api.events) {
        await this.context.api.events.on(event, originalMethod.bind(this))
      }
      
      // Call original method
      return originalMethod.apply(this, args)
    }
    
    // Store hook metadata
    if (!target.constructor._hooks) {
      target.constructor._hooks = []
    }
    target.constructor._hooks.push({
      event,
      method: propertyKey,
      priority,
      handler: originalMethod
    })
  }
}

/**
 * Permission decorator for plugin permissions
 */
export function RequirePermission(resource: string, actions: string[]) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function(...args: any[]) {
      // Check permissions before executing
      if (!this.hasPermission(resource, actions[0])) {
        throw new Error(`Permission denied: ${actions.join(', ')} required for ${resource}`)
      }
      
      // Call original method
      return originalMethod.apply(this, args)
    }
  }
}

// =============================================================================
// PLUGIN FACTORY
// =============================================================================

/**
 * Plugin Factory for creating plugin instances
 */
export class PluginFactory {
  private static pluginRegistry = new Map<string, typeof BasePlugin>()

  /**
   * Register a plugin class
   */
  static register(pluginClass: typeof BasePlugin): void {
    const instance = new pluginClass({} as PluginManifest)
    const pluginId = instance.getManifest().slug
    
    this.pluginRegistry.set(pluginId, pluginClass)
    console.log(`Plugin registered: ${pluginId}`)
  }

  /**
   * Create plugin instance
   */
  static create(manifest: PluginManifest): BasePlugin {
    const pluginClass = this.pluginRegistry.get(manifest.slug)
    
    if (!pluginClass) {
      throw new Error(`Plugin class not found for: ${manifest.slug}`)
    }

    return new pluginClass(manifest)
  }

  /**
   * Get all registered plugins
   */
  static getRegisteredPlugins(): string[] {
    return Array.from(this.pluginRegistry.keys())
  }

  /**
   * Check if plugin is registered
   */
  static isRegistered(pluginId: string): boolean {
    return this.pluginRegistry.has(pluginId)
  }

  /**
   * Unregister plugin
   */
  static unregister(pluginId: string): boolean {
    return this.pluginRegistry.delete(pluginId)
  }
}

// =============================================================================
// PLUGIN MIXINS
// =============================================================================

/**
 * Configurable mixin for plugins
 */
export function Configurable<TBase extends new (...args: any[]) => BasePlugin>(Base: TBase) {
  return class extends Base {
    private config: Record<string, any> = {}

    async setConfig(key: string, value: any): Promise<void> {
      this.config[key] = value
      
      if (this.context?.storage) {
        await this.context.storage.set(`config:${key}`, value)
      }
      
      await this.onConfigUpdate({ ...this.config, [key]: value })
    }

    async getConfig(key: string): Promise<any> {
      if (this.config[key] !== undefined) {
        return this.config[key]
      }

      if (this.context?.storage) {
        const stored = await this.context.storage.get(`config:${key}`)
        if (stored !== undefined) {
          this.config[key] = stored
          return stored
        }
      }

      return this.getManifest().config?.properties?.[key]?.default
    }

    async getAllConfig(): Promise<Record<string, any>> {
      return this.config
    }
  }
}

/**
 * Event-emitting mixin for plugins
 */
export function EventEmitter<TBase extends new (...args: any[]) => BasePlugin>(Base: TBase) {
  return class extends Base {
    private eventListeners = new Map<string, Function[]>()

    async emit(event: string, data?: any): Promise<void> {
      const listeners = this.eventListeners.get(event) || []
      
      for (const listener of listeners) {
        try {
          await listener.call(this, data)
        } catch (error) {
          this.getLogger().error(`Event listener error for ${event}:`, error)
        }
      }

      // Also emit through global event system
      if (this.context?.api.events) {
        await this.context.api.events.emit(`${this.getManifest().slug}:${event}`, data)
      }
    }

    on(event: string, listener: Function): void {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, [])
      }
      this.eventListeners.get(event)!.push(listener)
    }

    off(event: string, listener: Function): void {
      const listeners = this.eventListeners.get(event) || []
      const index = listeners.indexOf(listener)
      
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }

    once(event: string, listener: Function): void {
      const onceWrapper = (data: any) => {
        listener.call(this, data)
        this.off(event, onceWrapper)
      }
      this.on(event, onceWrapper)
    }
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create plugin manifest from package.json
 */
export function createManifestFromPackage(packageJson: any): Partial<PluginManifest> {
  return {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    author: packageJson.author,
    repository: packageJson.repository?.url || packageJson.repository,
    homepage: packageJson.homepage,
    main: packageJson.main || 'index.js',
    dependencies: packageJson.dependencies,
    tags: packageJson.keywords || [],
  }
}

/**
 * Validate plugin manifest
 */
export function validateManifest(manifest: PluginManifest): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!manifest.name || manifest.name.trim().length === 0) {
    errors.push('Plugin name is required')
  }

  if (!manifest.slug || manifest.slug.trim().length === 0) {
    errors.push('Plugin slug is required')
  } else if (!/^[a-z0-9-]+$/.test(manifest.slug)) {
    errors.push('Plugin slug must contain only lowercase letters, numbers, and hyphens')
  }

  if (!manifest.version || manifest.version.trim().length === 0) {
    errors.push('Plugin version is required')
  }

  // Optional fields
  if (!manifest.description) {
    warnings.push('Plugin description is recommended')
  }

  if (!manifest.author) {
    warnings.push('Plugin author is recommended')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Get plugin version compatibility
 */
export function checkCompatibility(
  pluginVersion: string,
  requiredVersion: string
): 'compatible' | 'incompatible' | 'unknown' {
  try {
    const pluginParts = pluginVersion.split('.').map(Number)
    const requiredParts = requiredVersion.split('.').map(Number)

    for (let i = 0; i < Math.max(pluginParts.length, requiredParts.length); i++) {
      const pluginPart = pluginParts[i] || 0
      const requiredPart = requiredParts[i] || 0

      if (pluginPart > requiredPart) return 'compatible'
      if (pluginPart < requiredPart) return 'incompatible'
    }

    return 'compatible'
  } catch {
    return 'unknown'
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from '@/types/plugin'

// Re-export commonly used types and utilities
export type {
  PluginContext,
  PluginManifest,
  PluginStatus,
  PluginHook,
  PluginPermission,
  PluginAPI
} from '@/types/plugin'