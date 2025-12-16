import {
  AuthAPI,
  ConfigAPI,
  CryptoAPI,
  DatabaseAPI,
  EventAPI,
  HttpAPI,
  PluginAPI,
  PluginCategory,
  PluginContext,
  PluginError,
  PluginEvent,
  PluginFilters,
  PluginHookHandler,
  PluginInstance,
  PluginManifest,
  PluginRegistry as IPluginRegistry,
  PluginStatus,
  PluginValidationError,
  PluginValidationResult,
  TenantAPI,
  TimeAPI,
  UserAPI,
} from '@/types/plugin'

// =============================================================================
// PLUGIN LOGGER
// =============================================================================

class PluginLoggerImpl {
  constructor(private pluginId: string) {}

  debug(message: string, meta?: any): void {
    console.debug(`[${this.pluginId}] DEBUG: ${message}`, meta)
  }

  info(message: string, meta?: any): void {
    console.info(`[${this.pluginId}] INFO: ${message}`, meta)
  }

  warn(message: string, meta?: any): void {
    console.warn(`[${this.pluginId}] WARN: ${message}`, meta)
  }

  error(message: string, error?: Error, meta?: any): void {
    console.error(`[${this.pluginId}] ERROR: ${message}`, error, meta)
  }
}

// =============================================================================
// PLUGIN STORAGE
// =============================================================================

class PluginStorageImpl {
  private storagePrefix: string

  constructor(pluginId: string, tenantId?: string) {
    this.storagePrefix = `plugin_${tenantId || 'system'}_${pluginId}_`
  }

  async get(key: string): Promise<any> {
    if (typeof window === 'undefined') {
      // Server-side storage (database)
      // In real implementation, this would store to database
      return null
    } else {
      // Client-side storage (localStorage)
      const value = localStorage.getItem(this.storagePrefix + key)
      return value ? JSON.parse(value) : null
    }
  }

  async set(key: string, value: any): Promise<void> {
    const serialized = JSON.stringify(value)

    if (typeof window === 'undefined') {
      // Server-side storage
      // In real implementation, this would store to database
    } else {
      // Client-side storage
      localStorage.setItem(this.storagePrefix + key, serialized)
    }
  }

  async delete(key: string): Promise<void> {
    if (typeof window === 'undefined') {
      // Server-side storage
      // In real implementation, this would delete from database
    } else {
      // Client-side storage
      localStorage.removeItem(this.storagePrefix + key)
    }
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined') {
      // Server-side storage
      // In real implementation, this would clear from database
    } else {
      // Client-side storage
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(this.storagePrefix))
      keys.forEach((key) => localStorage.removeItem(key))
    }
  }

  async keys(): Promise<string[]> {
    if (typeof window === 'undefined') {
      // Server-side storage
      // In real implementation, this would query database
      return []
    } else {
      // Client-side storage
      const prefixLength = this.storagePrefix.length
      return Object.keys(localStorage)
        .filter((k) => k.startsWith(this.storagePrefix))
        .map((k) => k.substring(prefixLength))
    }
  }

  async size(): Promise<number> {
    const keys = await this.keys()
    let size = 0

    if (typeof window === 'undefined') {
      // Server-side storage
      // In real implementation, this would calculate database size
      return 0
    } else {
      // Client-side storage
      for (const key of keys) {
        const value = localStorage.getItem(this.storagePrefix + key)
        if (value) {
          size += value.length
        }
      }
    }

    return size
  }
}

// =============================================================================
// PLUGIN REGISTRY IMPLEMENTATION
// =============================================================================

export class PluginRegistry implements IPluginRegistry {
  public plugins = new Map<string, PluginInstance>()
  public hooks = new Map<string, PluginHookHandler[]>()
  public events = new Map<string, Function[]>()

  constructor(
    private userAPI: UserAPI,
    private tenantAPI: TenantAPI,
    private authAPI: AuthAPI,
    private databaseAPI: DatabaseAPI,
    private eventAPI: EventAPI,
    private configAPI: ConfigAPI,
    private httpAPI: HttpAPI,
    private cryptoAPI: CryptoAPI,
    private timeAPI: TimeAPI
  ) {}

  // =============================================================================
  // PLUGIN LIFECYCLE
  // =============================================================================

  async register(manifest: PluginManifest): Promise<PluginInstance> {
    try {
      // Validate manifest
      const validation = await this.validate(manifest)
      if (!validation.valid) {
        throw new Error(
          `Invalid plugin manifest: ${validation.errors.map((e) => e.message).join(', ')}`
        )
      }

      // Check for duplicates
      if (this.plugins.has(manifest.slug)) {
        throw new Error(`Plugin ${manifest.slug} is already registered`)
      }

      const pluginId = this.generatePluginId(manifest.slug)

      const instance: PluginInstance = {
        id: pluginId,
        pluginId: manifest.slug,
        status: PluginStatus.INSTALLED,
        config: {},
        manifest,
        executionCount: 0,
        exports: {},
        handlers: {},
      }

      this.plugins.set(pluginId, instance)

      console.log(`Plugin ${manifest.slug} registered successfully`)
      return instance
    } catch (error) {
      const pluginError: PluginError = {
        code: 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { manifest: manifest.name },
      }
      console.error('Plugin registration failed:', pluginError)
      throw pluginError
    }
  }

  async unregister(pluginId: string): Promise<void> {
    try {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      // Unload if active
      if (plugin.status === PluginStatus.ACTIVE) {
        await this.unload(pluginId)
      }

      // Remove from registry
      this.plugins.delete(pluginId)

      // Clean up hooks
      for (const [event, handlers] of this.hooks) {
        const filteredHandlers = handlers.filter((h) => h.pluginId !== pluginId)
        if (filteredHandlers.length === 0) {
          this.hooks.delete(event)
        } else {
          this.hooks.set(event, filteredHandlers)
        }
      }

      console.log(`Plugin ${pluginId} unregistered successfully`)
    } catch (error) {
      const pluginError: PluginError = {
        code: 'UNREGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { pluginId },
      }
      console.error('Plugin unregistration failed:', pluginError)
      throw pluginError
    }
  }

  async load(pluginId: string, tenantId?: string): Promise<PluginInstance> {
    try {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      if (plugin.status === PluginStatus.ACTIVE) {
        return plugin
      }

      plugin.status = PluginStatus.LOADING

      // Create plugin context
      const context = await this.createPluginContext(plugin, tenantId)

      // Load plugin module (in real implementation, this would dynamically import)
      const pluginModule = await this.loadPluginModule(plugin)

      // Initialize plugin
      if (pluginModule.initialize) {
        await pluginModule.initialize(context)
      }

      // Register hooks
      if (plugin.manifest.hooks) {
        for (const hook of plugin.manifest.hooks) {
          await this.addHook(hook.event, {
            pluginId: plugin.id,
            handler: pluginModule[hook.handler],
            priority: hook.priority,
          })
        }
      }

      plugin.status = PluginStatus.ACTIVE
      plugin.loadedAt = new Date()
      plugin.exports = pluginModule.exports || {}

      console.log(`Plugin ${pluginId} loaded successfully`)

      return plugin
    } catch (error) {
      const plugin = this.plugins.get(pluginId)
      if (plugin) {
        plugin.status = PluginStatus.ERROR
        plugin.lastError = {
          code: 'LOAD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          context: { pluginId, tenantId },
        }
      }

      const pluginError: PluginError = {
        code: 'LOAD_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { pluginId, tenantId },
      }
      console.error('Plugin load failed:', pluginError)
      throw pluginError
    }
  }

  async unload(pluginId: string, tenantId?: string): Promise<void> {
    try {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      if (plugin.status !== PluginStatus.ACTIVE) {
        return
      }

      plugin.status = PluginStatus.UNLOADING

      // Call plugin cleanup
      if (plugin.exports.cleanup) {
        await plugin.exports.cleanup()
      }

      // Remove hooks
      for (const [event, handlers] of this.hooks) {
        const filteredHandlers = handlers.filter((h) => h.pluginId !== pluginId)
        if (filteredHandlers.length === 0) {
          this.hooks.delete(event)
        } else {
          this.hooks.set(event, filteredHandlers)
        }
      }

      plugin.status = PluginStatus.INACTIVE

      console.log(`Plugin ${pluginId} unloaded successfully`)
    } catch (error) {
      const pluginError: PluginError = {
        code: 'UNLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { pluginId, tenantId },
      }
      console.error('Plugin unload failed:', pluginError)
      throw pluginError
    }
  }

  async enable(pluginId: string, tenantId?: string): Promise<void> {
    await this.load(pluginId, tenantId)
  }

  async disable(pluginId: string, tenantId?: string): Promise<void> {
    await this.unload(pluginId, tenantId)
  }

  // =============================================================================
  // PLUGIN DISCOVERY
  // =============================================================================

  get(pluginId: string): PluginInstance | null {
    return this.plugins.get(pluginId) || null
  }

  list(filters?: PluginFilters): PluginInstance[] {
    let plugins = Array.from(this.plugins.values())

    if (filters) {
      if (filters.status) {
        plugins = plugins.filter((p) => p.status === filters.status)
      }
      if (filters.category) {
        plugins = plugins.filter((p) => p.manifest.category === filters.category)
      }
      if (filters.tenantId) {
        plugins = plugins.filter((p) => p.tenantId === filters.tenantId)
      }
      if (filters.author) {
        plugins = plugins.filter((p) => p.manifest.author === filters.author)
      }
      if (filters.tags && filters.tags.length > 0) {
        plugins = plugins.filter((p) => filters.tags!.some((tag) => p.manifest.tags.includes(tag)))
      }
    }

    return plugins
  }

  search(query: string): PluginInstance[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.plugins.values()).filter(
      (plugin) =>
        plugin.manifest.name.toLowerCase().includes(lowerQuery) ||
        plugin.manifest.slug.toLowerCase().includes(lowerQuery) ||
        plugin.manifest.description?.toLowerCase().includes(lowerQuery) ||
        plugin.manifest.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    )
  }

  // =============================================================================
  // PLUGIN HOOKS
  // =============================================================================

  async addHook(event: string, handler: PluginHookHandler): Promise<void> {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, [])
    }

    const handlers = this.hooks.get(event)!
    handlers.push(handler)

    // Sort by priority (higher first)
    handlers.sort((a, b) => b.priority - a.priority)
  }

  async removeHook(event: string, handler: PluginHookHandler): Promise<void> {
    if (!this.hooks.has(event)) {
      return
    }

    const handlers = this.hooks.get(event)!
    const index = handlers.findIndex(
      (h) => h.pluginId === handler.pluginId && h.handler === handler.handler
    )

    if (index !== -1) {
      handlers.splice(index, 1)
    }
  }

  async executeHook(event: string, data: any): Promise<any[]> {
    const handlers = this.hooks.get(event) || []
    const results: any[] = []

    for (const handler of handlers) {
      try {
        const result = await handler.handler(data)
        results.push(result)
      } catch (error) {
        console.error(`Hook handler error for ${event}:`, error)
        results.push({ error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  }

  // =============================================================================
  // PLUGIN EVENTS
  // =============================================================================

  async emit(event: string, data?: any): Promise<void> {
    const eventData: PluginEvent = {
      name: event,
      data,
      timestamp: new Date(),
    }

    console.log('Plugin event emitted:', eventData)

    // Call registered event handlers
    const handlers = this.events.get(event) || []
    for (const handler of handlers) {
      try {
        await handler(eventData)
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error)
      }
    }
  }

  async on(event: string, handler: Function): Promise<void> {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }

    this.events.get(event)!.push(handler)
  }

  async off(event: string, handler: Function): Promise<void> {
    if (!this.events.has(event)) {
      return
    }

    const handlers = this.events.get(event)!
    const index = handlers.indexOf(handler)

    if (index !== -1) {
      handlers.splice(index, 1)
    }
  }

  // =============================================================================
  // PLUGIN VALIDATION
  // =============================================================================

  async validate(manifest: PluginManifest): Promise<PluginValidationResult> {
    const errors: PluginValidationError[] = []
    const warnings: PluginValidationError[] = []

    // Required fields
    if (!manifest.name || manifest.name.trim().length === 0) {
      errors.push({
        field: 'name',
        code: 'REQUIRED',
        message: 'Plugin name is required',
        severity: 'error',
      })
    }

    if (!manifest.slug || manifest.slug.trim().length === 0) {
      errors.push({
        field: 'slug',
        code: 'REQUIRED',
        message: 'Plugin slug is required',
        severity: 'error',
      })
    } else if (!/^[a-z0-9-]+$/.test(manifest.slug)) {
      errors.push({
        field: 'slug',
        code: 'INVALID_FORMAT',
        message: 'Plugin slug must contain only lowercase letters, numbers, and hyphens',
        severity: 'error',
      })
    }

    if (!manifest.version || manifest.version.trim().length === 0) {
      errors.push({
        field: 'version',
        code: 'REQUIRED',
        message: 'Plugin version is required',
        severity: 'error',
      })
    }

    if (!manifest.main || manifest.main.trim().length === 0) {
      errors.push({
        field: 'main',
        code: 'REQUIRED',
        message: 'Plugin main entry point is required',
        severity: 'error',
      })
    }

    // Category validation
    if (manifest.category && !Object.values(PluginCategory).includes(manifest.category)) {
      errors.push({
        field: 'category',
        code: 'INVALID_VALUE',
        message: `Invalid category. Must be one of: ${Object.values(PluginCategory).join(', ')}`,
        severity: 'error',
      })
    }

    // URL validation
    if (manifest.homepage && !this.isValidUrl(manifest.homepage)) {
      warnings.push({
        field: 'homepage',
        code: 'INVALID_FORMAT',
        message: 'Invalid homepage URL format',
        severity: 'warning',
      })
    }

    if (manifest.repository && !this.isValidUrl(manifest.repository)) {
      warnings.push({
        field: 'repository',
        code: 'INVALID_FORMAT',
        message: 'Invalid repository URL format',
        severity: 'warning',
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private generatePluginId(slug: string): string {
    return `plugin_${slug}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private async createPluginContext(
    plugin: PluginInstance,
    tenantId?: string
  ): Promise<PluginContext> {
    const api: PluginAPI = {
      user: this.userAPI,
      tenant: this.tenantAPI,
      auth: this.authAPI,
      db: this.databaseAPI,
      events: this.eventAPI,
      config: this.configAPI,
      http: this.httpAPI,
      crypto: this.cryptoAPI,
      time: this.timeAPI,
    }

    return {
      tenantId: tenantId || 'system',
      config: plugin.config,
      permissions: plugin.manifest.permissions.map((p) => `${p.resource}:${p.actions.join(',')}`),
      api,
      logger: new PluginLoggerImpl(plugin.id),
      storage: new PluginStorageImpl(plugin.id, tenantId),
    }
  }

  private async loadPluginModule(plugin: PluginInstance): Promise<any> {
    // In a real implementation, this would:
    // 1. Load the plugin file from disk or registry
    // 2. Execute it in a sandboxed environment
    // 3. Return the module exports

    // For now, return a mock plugin module
    return {
      initialize: async (context: PluginContext) => {
        context.logger.info(`Plugin ${plugin.manifest.name} initialized`)
      },
      cleanup: async () => {
        console.log(`Plugin ${plugin.manifest.name} cleaned up`)
      },
      exports: {
        hello: () => `Hello from ${plugin.manifest.name}!`,
      },
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type { PluginLoggerImpl as PluginLogger }
export type { PluginStorageImpl as PluginStorage }
