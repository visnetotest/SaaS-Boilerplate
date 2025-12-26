// =============================================================================
// SaaS BOILERPLATE PLUGIN SDK
// =============================================================================

import type {
  PluginAPI,
  PluginComponent,
  PluginConfigUpdate,
  PluginCredentials,
  PluginDevContext,
  PluginEventHandler,
  PluginLogger,
  PluginOptions,
  PluginSchema,
  PluginSDKContext,
  PluginStorage,
  PluginToken,
  PluginWebhookHandler,
} from '../types/plugin'

/**
 * Plugin Development SDK
 *
 * Provides utilities, helpers, and abstractions for plugin development
 * Makes it easier to create robust, secure, and well-behaved plugins
 */

// =============================================================================
// CORE SDK CLASSES
// =============================================================================

/**
 * Plugin Base Class
 *
 * All plugins should extend this class for compatibility
 */
export class Plugin {
  context: PluginSDKContext
  name: string
  version: string
  logger: PluginLogger
  storage: PluginStorage
  api: PluginAPI

  constructor(context: PluginSDKContext) {
    this.context = context
    this.name = context.config?.name || 'Unknown Plugin'
    this.version = context.config?.version || '1.0.0'
    this.logger = context.logger || console
    this.storage = context.storage || ({} as PluginStorage)
    this.api = context.api || ({} as PluginAPI)
  }

  // =============================================================================
  // LIFECYCLE METHODS (to be overridden by plugins)
  // =============================================================================

  async onInitialize() {
    this.logger.info(`Plugin ${this.name} initialized`)
  }

  async onActivate() {
    this.logger.info(`Plugin ${this.name} activated`)
  }

  async onDeactivate() {
    this.logger.info(`Plugin ${this.name} deactivated`)
  }

  async onCleanup() {
    this.logger.info(`Plugin ${this.name} cleaned up`)
  }

  async onConfigUpdate(config) {
    this.logger.info(`Plugin ${this.name} configuration updated`)
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Emit an event
   */
  async emit(event, data) {
    if (this.api.events?.emit) {
      await this.api.events.emit(`${this.name}:${event}`, data)
    }
  }

  /**
   * Listen to events
   */
  async on(event, handler) {
    if (this.api.events?.on) {
      await this.api.events.on(event, handler)
    }
  }

  /**
   * Store data in plugin storage
   */
  async set(key, value) {
    if (this.storage?.set) {
      await this.storage.set(key, value)
    }
  }

  /**
   * Get data from plugin storage
   */
  async get(key) {
    if (this.storage?.get) {
      return await this.storage.get(key)
    }
    return null
  }

  /**
   * Delete data from plugin storage
   */
  async delete(key) {
    if (this.storage?.delete) {
      await this.storage.delete(key)
    }
  }

  /**
   * Check if plugin has permission
   */
  hasPermission(resource, action) {
    const permission = `${resource}:${action}`
    return this.context?.permissions?.includes(permission) || false
  }

  /**
   * Get plugin configuration
   */
  async getConfig(key) {
    return await this.get(`config:${key}`)
  }

  /**
   * Set plugin configuration
   */
  async setConfig(key, value) {
    await this.set(`config:${key}`, value)
    await this.onConfigUpdate({ [key]: value })
  }

  // =============================================================================
  // API HELPERS
  // =============================================================================

  /**
   * Safe HTTP GET request
   */
  async httpGet(url, options) {
    if (!this.hasPermission('network', 'read')) {
      throw new Error('Permission denied: network:read required')
    }
    return await this.api.http.get(url, options)
  }

  /**
   * Safe HTTP POST request
   */
  async httpPost(url, data, options) {
    if (!this.hasPermission('network', 'write')) {
      throw new Error('Permission denied: network:write required')
    }
    return await this.api.http.post(url, data, options)
  }

  /**
   * Safe database query
   */
  async dbQuery(sql, params) {
    if (!this.hasPermission('database', 'read')) {
      throw new Error('Permission denied: database:read required')
    }
    return await this.api.db.query(sql, params)
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    if (!this.hasPermission('user', 'read')) {
      throw new Error('Permission denied: user:read required')
    }
    return await this.api.user.getCurrent()
  }

  /**
   * Get configuration value
   */
  async getConfigValue(key: string) {
    if (!this.hasPermission('config', 'read')) {
      throw new Error('Permission denied: config:read required')
    }
    return await this.api.config.get(key)
  }

  /**
   * Set configuration value
   */
  async setConfigValue(key, value) {
    if (!this.hasPermission('config', 'write')) {
      throw new Error('Permission denied: config:write required')
    }
    return await this.api.config.set(key, value)
  }
}

// =============================================================================
// SPECIALIZED PLUGIN BASES
// =============================================================================

/**
 * Authentication Plugin Base
 */
export class AuthenticationPlugin extends Plugin {
  async onInitialize() {
    await super.onInitialize()
    this.registerAuthProvider()
  }

  async authenticate(credentials) {
    throw new Error('authenticate method must be implemented')
  }

  async authorize(token) {
    throw new Error('authorize method must be implemented')
  }

  async logout(token) {
    throw new Error('logout method must be implemented')
  }

  registerAuthProvider() {
    this.emit('auth:provider-register', {
      name: this.name,
      type: 'custom',
      authenticate: this.authenticate.bind(this),
      authorize: this.authorize.bind(this),
      logout: this.logout.bind(this),
    })
  }
}

/**
 * UI Plugin Base
 */
export class UIPlugin extends Plugin {
  components: Map<string, PluginComponent>
  routes: Map<string, any>

  constructor(context: PluginSDKContext) {
    super(context)
    this.components = new Map()
    this.routes = new Map()
  }

  async onInitialize() {
    await super.onInitialize()
    this.registerUIComponents()
  }

  registerComponent(name, component) {
    this.components.set(name, component)
    this.emit('ui:component-register', {
      name: `${this.name}:${name}`,
      component,
    })
  }

  registerRoute(path, component) {
    this.routes.set(path, component)
    this.emit('ui:route-register', {
      path: path,
      component,
      plugin: this.name,
    })
  }

  registerUIComponents() {
    const componentEntries = Array.from(this.components.entries())
    for (const [name, component] of componentEntries) {
      this.registerComponent(name, component)
    }

    const routeEntries = Array.from(this.routes.entries())
    for (const [path, component] of routeEntries) {
      this.registerRoute(path, component)
    }
  }

  getComponent(name) {
    return this.components.get(name)
  }

  getRoutes() {
    return Object.fromEntries(this.routes)
  }
}

/**
 * Data Plugin Base
 */
export class DataPlugin extends Plugin {
  dataHandlers: Map<string, PluginWebhookHandler>
  models: Map<string, PluginSchema>

  constructor(context: PluginSDKContext) {
    super(context)
    this.dataHandlers = new Map()
    this.models = new Map()
  }

  registerDataModel(name, schema) {
    this.models.set(name, schema)
    this.emit('data:model-register', {
      name: `${this.name}:${name}`,
      schema,
      plugin: this.name,
    })
  }

  registerDataHandler(type, handler) {
    this.dataHandlers.set(type, handler)
    this.emit('data:handler-register', {
      type,
      handler,
      plugin: this.name,
    })
  }

  async processData(type: string, data: any): Promise<any> {
    const handler = this.dataHandlers.get(type)
    if (handler) {
      return await handler(type, data)
    }
    throw new Error(`No handler found for data type: ${type}`)
  }

  validateData(modelName, data) {
    const schema = this.models.get(modelName)
    if (!schema) {
      throw new Error(`Model ${modelName} not found`)
    }

    // Basic validation (in real implementation, use schema validation library)
    for (const [field, rules] of Object.entries(schema)) {
      if (rules.required && !data[field]) {
        throw new Error(`Required field missing: ${field}`)
      }
      if (rules.type && typeof data[field] !== rules.type) {
        throw new Error(`Invalid type for field ${field}: expected ${rules.type}`)
      }
    }

    return true
  }
}

/**
 * Integration Plugin Base
 */
export class IntegrationPlugin extends Plugin {
  endpoints: Map<string, PluginOptions>
  webhooks: Map<string, PluginWebhookHandler>

  constructor(context: PluginSDKContext) {
    super(context)
    this.endpoints = new Map()
    this.webhooks = new Map()
  }

  registerEndpoint(name, config) {
    this.endpoints.set(name, config)
    this.emit('integration:endpoint-register', {
      name: `${this.name}:${name}`,
      config,
      plugin: this.name,
    })
  }

  registerWebhook(event, handler) {
    this.webhooks.set(event, handler)
    this.emit('integration:webhook-register', {
      event,
      handler,
      plugin: this.name,
    })
  }

  async callEndpoint(name, data) {
    const endpoint = this.endpoints.get(name)
    if (!endpoint) {
      throw new Error(`Endpoint ${name} not found`)
    }

    return await this.httpPost(endpoint.url, data, endpoint.options)
  }

  async handleWebhook(event: string, data: any): Promise<any> {
    const handler = this.webhooks.get(event)
    if (handler) {
      return await handler(event, data)
    }
    this.logger.warn(`No handler found for webhook event: ${event}`)
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a plugin manifest
 */
export function createManifest(options) {
  return {
    name: options.name,
    slug: options.slug || options.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    version: options.version || '1.0.0',
    description: options.description || '',
    author: options.author || 'Plugin Developer',
    category: options.category || 'utility',
    tags: options.tags || [],
    main: options.main || 'src/index.js',
    permissions: options.permissions || [],
    sandbox: options.sandbox || { enabled: true, timeout: 30000 },
    dependencies: options.dependencies || {},
    provides: options.provides || [],
    requires: options.requires || [],
    config: options.config || { type: 'object', properties: {} },
    hooks: options.hooks || [],
  }
}

/**
 * Validate plugin manifest
 */
export function validateManifest(manifest: any): any {
  const errors: string[] = []
  const warnings: string[] = []

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

  if (!manifest.main || manifest.main.trim().length === 0) {
    errors.push('Plugin main entry point is required')
  }

  if (!manifest.description) {
    warnings.push('Plugin description is recommended')
  }

  if (!manifest.author) {
    warnings.push('Plugin author is recommended')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Create plugin instance
 */
export function createPlugin(manifest, context) {
  const PluginClass = class extends Plugin {
    constructor() {
      super(context)
      this.name = manifest.name
      this.version = manifest.version
    }

    async onInitialize() {
      await super.onInitialize()
      // Load plugin-specific configuration
      const config = await this.getConfig()
      if (this.context?.config) {
        Object.assign(this.context.config, config)
      }
    }
  }

  return new PluginClass()
}

/**
 * Generate plugin ID
 */
export function generatePluginId(slug) {
  return `plugin_${slug}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Check plugin compatibility
 */
export function checkCompatibility(pluginVersion, requiredVersion) {
  const pluginParts = pluginVersion.split('.').map(Number)
  const requiredParts = requiredVersion.split('.').map(Number)

  for (let i = 0; i < Math.max(pluginParts.length, requiredParts.length); i++) {
    const pluginPart = pluginParts[i] || 0
    const requiredPart = requiredParts[i] || 0

    if (pluginPart > requiredPart) return 'compatible'
    if (pluginPart < requiredPart) return 'incompatible'
  }

  return 'compatible'
}

/**
 * Create safe plugin context
 */
export function createSafeContext(baseContext, overrides = {}) {
  const safeContext = JSON.parse(JSON.stringify(baseContext))

  // Apply overrides
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      safeContext[key] = value
    }
  }

  return safeContext
}

/**
 * Plugin decorator
 */
export function plugin(metadata) {
  return function (target) {
    target.prototype._pluginMetadata = metadata
    return target
  }
}

/**
 * Hook decorator
 */
export function hook(event, priority = 0) {
  return function (target, propertyKey, descriptor) {
    if (!target._hooks) {
      target._hooks = []
    }

    target._hooks.push({
      event,
      method: propertyKey,
      priority,
      handler: descriptor.value,
    })

    return descriptor
  }
}

/**
 * Permission decorator
 */
export function requirePermission(resource, actions) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args) {
      // Check permissions before executing
      if (!this.hasPermission(resource, actions[0])) {
        throw new Error(`Permission denied: ${actions.join(', ')} required for ${resource}`)
      }

      // Call original method
      return await originalMethod.apply(this, args)
    }

    return descriptor
  }
}

// =============================================================================
// PLUGIN DEVELOPMENT HELPERS
// =============================================================================

/**
 * Create a development plugin instance
 */
export function createDevPlugin(name, config = {}) {
  const mockContext = {
    id: `dev-plugin-${name}`,
    pluginId: name,
    tenantId: 'dev',
    config,
    permissions: ['*'], // Dev plugins have all permissions
    api: {
      user: {
        getCurrent: async () => ({ id: 'dev-user', name: 'Dev User' }),
        getById: async () => ({ id: 'dev-user', name: 'Dev User' }),
      },
      config: {
        get: async (key) => config[key] || null,
        set: async (key, value) => {
          config[key] = value
        },
      },
      events: {
        emit: async (event, data) => console.log(`[Event] ${event}:`, data),
        on: async (event, handler) => console.log(`[Listener] ${event} registered`),
      },
      http: {
        get: async (url) => ({ status: 200, data: { mock: true, url } }),
        post: async (url, data) => ({ status: 200, data: { mock: true, url, data } }),
      },
      db: {
        query: async (sql, params) => ({ mock: true, sql, params }),
      },
    },
    logger: {
      info: (msg, meta) => console.log(`[${name}] INFO: ${msg}`, meta),
      warn: (msg, meta) => console.warn(`[${name}] WARN: ${msg}`, meta),
      error: (msg, error, meta) => console.error(`[${name}] ERROR: ${msg}`, error, meta),
    },
    storage: {
      get: async (key) => config.storage?.[key] || null,
      set: async (key, value) => {
        if (!config.storage) config.storage = {}
        config.storage[key] = value
      },
      delete: async (key) => {
        if (config.storage) delete config.storage[key]
      },
    },
  }

  return createPlugin(
    createManifest({
      name,
      version: '1.0.0-dev',
      description: `Development plugin: ${name}`,
      category: 'developer',
    }),
    mockContext
  )
}

/**
 * Run plugin in development mode
 */
export async function runDevPlugin(pluginInstance) {
  try {
    console.log(`🚀 Starting development plugin: ${pluginInstance.name}`)

    // Initialize
    await pluginInstance.onInitialize()

    // Activate
    await pluginInstance.onActivate()

    console.log(`✅ Development plugin started successfully`)
    console.log('Available commands:')
    console.log('  - Press Ctrl+C to stop')

    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\\n🛑 Stopping development plugin...')
      await pluginInstance.onDeactivate()
      await pluginInstance.onCleanup()
      process.exit(0)
    })
  } catch (error) {
    console.error('❌ Failed to start development plugin:', error)
    process.exit(1)
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  Plugin,
  AuthenticationPlugin,
  UIPlugin,
  DataPlugin,
  IntegrationPlugin,
  createManifest,
  validateManifest,
  createPlugin,
  generatePluginId,
  checkCompatibility,
  createSafeContext,
  plugin,
  hook,
  requirePermission,
  createDevPlugin,
  runDevPlugin,
}

// Re-export utilities
export {
  createSafeContext as createContext,
  createManifest as createPluginManifest,
  generatePluginId as generateId,
  checkCompatibility as isCompatible,
  validateManifest as validatePluginManifest,
}
