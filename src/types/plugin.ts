// =============================================================================
// PLUGIN SYSTEM CORE INTERFACES
// =============================================================================

export interface PluginManifest {
  name: string
  slug: string
  version: string
  description?: string
  author?: string
  repository?: string
  homepage?: string
  category: PluginCategory
  tags: string[]
  dependencies: Record<string, string>

  // Plugin capabilities
  provides: PluginCapability[]
  requires: PluginRequirement[]

  // Entry points
  main: string
  server?: string
  client?: string

  // Configuration schema
  config?: PluginConfigSchema

  // Security and permissions
  permissions: PluginPermission[]
  sandbox: PluginSandboxConfig

  // Lifecycle hooks
  hooks?: PluginHook[]
}

export interface PluginCapability {
  type: string
  description?: string
  endpoint?: string
  methods?: string[]
}

export interface PluginRequirement {
  type: 'plugin' | 'system' | 'api' | 'database'
  name: string
  version?: string
  optional: boolean
}

export interface PluginPermission {
  resource: string
  actions: string[]
  description?: string
}

export interface PluginSandboxConfig {
  enabled: boolean
  timeout?: number
  memory?: number
  allowedDomains?: string[]
  allowedModules?: string[]
  blockedModules?: string[]
}

export interface PluginConfigSchema {
  type: 'object'
  properties: Record<string, PluginConfigProperty>
  required?: string[]
}

export interface PluginConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  default?: any
  enum?: any[]
  minimum?: number
  maximum?: number
  format?: string
}

export interface PluginHook {
  name: string
  event: string
  priority: number
  handler: string
}

export interface PluginInstance {
  id: string
  pluginId: string
  tenantId?: string
  status: PluginStatus
  config: Record<string, any>
  manifest: PluginManifest

  // Runtime state
  loadedAt?: Date
  lastError?: PluginError
  executionCount: number

  // Plugin exports
  exports: Record<string, any>

  // Event handlers
  handlers: Record<string, Function[]>
}

export interface PluginError {
  code: string
  message: string
  stack?: string
  timestamp: Date
  context?: Record<string, any>
}

export enum PluginStatus {
  INSTALLED = 'installed',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  LOADING = 'loading',
  UNLOADING = 'unloading',
  UPDATING = 'updating',
}

export enum PluginCategory {
  AUTHENTICATION = 'authentication',
  PAYMENT = 'payment',
  ANALYTICS = 'analytics',
  COMMUNICATION = 'communication',
  INTEGRATION = 'integration',
  AUTOMATION = 'automation',
  UI = 'ui',
  SECURITY = 'security',
  MONITORING = 'monitoring',
  STORAGE = 'storage',
  UTILITY = 'utility',
  DEVELOPER = 'developer',
}

export interface PluginContext {
  tenantId: string
  userId?: string
  request?: Request
  config: Record<string, any>
  permissions: string[]
  api: PluginAPI
  logger: PluginLogger
  storage: PluginStorage
}

export interface PluginAPI {
  // Core API access
  user: UserAPI
  tenant: TenantAPI
  auth: AuthAPI

  // Database access
  db: DatabaseAPI

  // Event system
  events: EventAPI

  // Configuration
  config: ConfigAPI

  // External integrations
  http: HttpAPI

  // Utilities
  crypto: CryptoAPI
  time: TimeAPI
}

export interface UserAPI {
  getCurrent(): Promise<User | null>
  getById(id: string): Promise<User | null>
  getByEmail(email: string): Promise<User | null>
  create(data: CreateUser): Promise<User>
  update(id: string, data: UpdateUser): Promise<User>
  delete(id: string): Promise<void>
  list(filters: UserFilters): Promise<PaginatedResponse<User>>
}

export interface TenantAPI {
  getCurrent(): Promise<Tenant | null>
  getById(id: string): Promise<Tenant | null>
  getBySlug(slug: string): Promise<Tenant | null>
  create(data: CreateTenant): Promise<Tenant>
  update(id: string, data: UpdateTenant): Promise<Tenant>
  delete(id: string): Promise<void>
  list(filters: TenantFilters): Promise<PaginatedResponse<Tenant>>
}

export interface AuthAPI {
  verify(token: string): Promise<User | null>
  generate(user: User): Promise<string>
  invalidate(userId: string): Promise<void>
  checkPermission(userId: string, permission: string): Promise<boolean>
}

export interface DatabaseAPI {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>
  transaction<T>(callback: (db: DatabaseAPI) => Promise<T>): Promise<T>
}

export interface EventAPI {
  emit(event: string, data?: any): Promise<void>
  on(event: string, handler: Function): Promise<void>
  off(event: string, handler: Function): Promise<void>
  once(event: string, handler: Function): Promise<void>
}

export interface ConfigAPI {
  get(key: string): Promise<any>
  set(key: string, value: any): Promise<void>
  delete(key: string): Promise<void>
  all(): Promise<Record<string, any>>
}

export interface HttpAPI {
  get(url: string, options?: RequestOptions): Promise<Response>
  post(url: string, data?: any, options?: RequestOptions): Promise<Response>
  put(url: string, data?: any, options?: RequestOptions): Promise<Response>
  delete(url: string, options?: RequestOptions): Promise<Response>
}

export interface HttpPluginAPI {
  fetch(url: string, options?: RequestOptions): Promise<any>
  get(url: string, options?: RequestOptions): Promise<any>
  post(url: string, data?: any, options?: RequestOptions): Promise<any>
  put(url: string, data?: any, options?: RequestOptions): Promise<any>
  delete(url: string, options?: RequestOptions): Promise<any>
}

export interface CryptoAPI {
  hash(data: string): Promise<string>
  verify(data: string, hash: string): Promise<boolean>
  encrypt(data: string, key: string): Promise<string>
  decrypt(data: string, key: string): Promise<string>
  generateKey(): Promise<string>
}

export interface TimeAPI {
  now(): Date
  format(date: Date, format: string): string
  parse(dateString: string): Date
  add(date: Date, amount: number, unit: string): Date
  diff(date1: Date, date2: Date): number
}

export interface PluginLogger {
  debug(message: string, meta?: any): void
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, error?: Error, meta?: any): void
}

export interface PluginStorage {
  get(key: string): Promise<any>
  set(key: string, value: any): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  keys(): Promise<string[]>
  size(): Promise<number>
}

export interface PluginEvent {
  name: string
  data: any
  source?: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface PluginHookHandler {
  pluginId: string
  handler: Function
  priority: number
  filter?: Function
}

export interface PluginRegistry {
  plugins: Map<string, PluginInstance>
  hooks: Map<string, PluginHookHandler[]>
  events: Map<string, Function[]>

  // Plugin lifecycle
  register(manifest: PluginManifest): Promise<PluginInstance>
  unregister(pluginId: string): Promise<void>
  load(pluginId: string, tenantId?: string): Promise<PluginInstance>
  unload(pluginId: string, tenantId?: string): Promise<void>
  enable(pluginId: string, tenantId?: string): Promise<void>
  disable(pluginId: string, tenantId?: string): Promise<void>

  // Discovery
  get(pluginId: string): PluginInstance | null
  list(filters?: PluginFilters): PluginInstance[]
  search(query: string): PluginInstance[]

  // Hooks
  addHook(event: string, handler: PluginHookHandler): Promise<void>
  removeHook(event: string, handler: PluginHookHandler): Promise<void>
  executeHook(event: string, data: any): Promise<any[]>

  // Events
  emit(event: string, data?: any): Promise<void>
  on(event: string, handler: Function): Promise<void>
  off(event: string, handler: Function): Promise<void>
}

export interface PluginFilters {
  status?: PluginStatus
  category?: PluginCategory
  tenantId?: string
  author?: string
  tags?: string[]
}

export interface PluginLoader {
  loadFromPath(path: string): Promise<PluginManifest>
  loadFromRegistry(name: string, version?: string): Promise<PluginManifest>
  validate(manifest: PluginManifest): Promise<PluginValidationResult>
  install(manifest: PluginManifest): Promise<void>
  uninstall(pluginId: string): Promise<void>
  update(pluginId: string, version?: string): Promise<void>
}

export interface PluginValidationResult {
  valid: boolean
  errors: PluginValidationError[]
  warnings: PluginValidationError[]
}

export interface PluginValidationError {
  field: string
  code: string
  message: string
  severity: 'error' | 'warning'
}

export interface PluginSandbox {
  create(plugin: PluginInstance): Promise<PluginSandboxInstance>
  execute(instance: PluginSandboxInstance, code: string, context: PluginContext): Promise<any>
  destroy(instance: PluginSandboxInstance): Promise<void>
}

export interface PluginSandboxInstance {
  id: string
  pluginId: string
  context: PluginContext

  execute(code: string, context?: Partial<PluginContext>): Promise<any>
  destroy(): Promise<void>
}

// =============================================================================
// TYPES REUSED FROM OTHER MODULES
// =============================================================================

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  tenantId: string
  createdAt: Date
  updatedAt: Date
}

export interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateUser {
  email: string
  firstName: string
  lastName: string
  tenantId: string
}

export interface UpdateUser {
  email?: string
  firstName?: string
  lastName?: string
  status?: string
}

export interface CreateTenant {
  name: string
  slug: string
}

export interface UpdateTenant {
  name?: string
  slug?: string
  status?: string
}

export interface UserFilters {
  tenantId?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}

export interface TenantFilters {
  status?: string
  search?: string
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  timeout?: number
  retries?: number
}
