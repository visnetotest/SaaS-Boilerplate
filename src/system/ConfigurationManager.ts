// =============================================================================
// CENTRALIZED CONFIGURATION SERVICE
// =============================================================================

import { createHash } from 'crypto'
import { EventEmitter } from 'events'
import Redis from 'ioredis'
import { Pool } from 'pg'

// =============================================================================
// INTERFACES
// =============================================================================

interface ConfigValue {
  key: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  environment: 'development' | 'staging' | 'production'
  tenantId?: string
  service?: string
  encrypted: boolean
  version: number
  createdAt: Date
  updatedAt: Date
  updatedBy?: string
}

interface ConfigSchema {
  key: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  defaultValue?: any
  validation?: {
    min?: number
    max?: number
    pattern?: string
    enum?: any[]
    custom?: string
  }
  description: string
  category: string
  environment: string[]
  tenantSpecific?: boolean
  serviceSpecific?: boolean
}

interface ConfigChange {
  key: string
  oldValue: any
  newValue: any
  changedBy: string
  reason?: string
  timestamp: Date
  metadata?: Record<string, any>
}

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

class ConfigValidator {
  static validate(
    key: string,
    value: any,
    schema: ConfigSchema
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Type validation
    if (!this.validateType(value, schema.type)) {
      errors.push(`Invalid type for ${key}. Expected ${schema.type}, got ${typeof value}`)
    }

    // Required validation
    if (schema.required && (value === null || value === undefined)) {
      errors.push(`Required configuration ${key} is missing`)
    }

    // Enum validation
    if (schema.validation?.enum && !schema.validation.enum.includes(value)) {
      errors.push(`Invalid value for ${key}. Must be one of: ${schema.validation.enum.join(', ')}`)
    }

    // Numeric validation
    if (schema.type === 'number') {
      if (schema.validation?.min !== undefined && value < schema.validation.min) {
        errors.push(`Value for ${key} must be at least ${schema.validation.min}`)
      }
      if (schema.validation?.max !== undefined && value > schema.validation.max) {
        errors.push(`Value for ${key} must be at most ${schema.validation.max}`)
      }
    }

    // String pattern validation
    if (schema.type === 'string' && schema.validation?.pattern) {
      const regex = new RegExp(schema.validation.pattern)
      if (!regex.test(value)) {
        errors.push(`Value for ${key} does not match required pattern`)
      }
    }

    // Custom validation
    if (schema.validation?.custom) {
      // In a real implementation, this would call a custom validation function
      console.log(`Custom validation for ${key}: ${schema.validation.custom}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  private static validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null
      case 'array':
        return Array.isArray(value)
      default:
        return true
    }
  }
}

// =============================================================================
// CENTRALIZED CONFIGURATION MANAGER
// =============================================================================

export class CentralizedConfigurationManager extends EventEmitter {
  private db: Pool
  private redis: Redis
  private environment: string
  private schema: Map<string, ConfigSchema> = new Map()
  private cache: Map<string, ConfigValue> = new Map()
  private encryptionKey: string

  constructor(db: Pool, redis: Redis, environment: string, encryptionKey: string) {
    super()
    this.db = db
    this.redis = redis
    this.environment = environment
    this.encryptionKey = encryptionKey
    this.initializeSchema()
    this.startCacheRefresh()
  }

  private initializeSchema(): void {
    // Database Configuration
    this.addSchema({
      key: 'database.url',
      type: 'string',
      required: true,
      description: 'Database connection URL',
      category: 'database',
      environment: ['development', 'staging', 'production'],
      encrypted: true,
    })

    this.addSchema({
      key: 'database.url',
      type: 'string',
      defaultValue: 'postgresql://localhost:5432/saas',
      validation: { pattern: /^postgres(ql)?:\/\/.+/ },
      description: 'Database connection URL',
      category: 'database',
      environment: ['development', 'staging', 'production'],
    } as any)

    // Security Configuration
    this.addSchema({
      key: 'security.jwt.secret',
      type: 'string',
      required: true,
      validation: { min: 32 },
      description: 'JWT secret key for token signing',
      category: 'security',
      environment: ['staging', 'production'],
    })

    this.addSchema({
      key: 'security.jwt.expiration',
      type: 'string',
      defaultValue: '24h',
      validation: { pattern: '^\\d+[smhd]$' },
      description: 'JWT token expiration time',
      category: 'security',
      environment: ['development', 'staging', 'production'],
    })

    // Microservices Configuration
    this.addSchema({
      key: 'microservices.apiGateway.url',
      type: 'string',
      required: true,
      defaultValue: 'http://localhost:3000',
      description: 'API Gateway service URL',
      category: 'microservices',
      environment: ['development', 'staging', 'production'],
    })

    this.addSchema({
      key: 'microservices.auth.url',
      type: 'string',
      required: true,
      defaultValue: 'http://localhost:3001',
      description: 'Authentication service URL',
      category: 'microservices',
      environment: ['development', 'staging', 'production'],
    })

    // Plugin Configuration
    this.addSchema({
      key: 'security.rateLimiting.enabled',
      type: 'boolean',
      required: true,
      defaultValue: false,
      description: 'Enable rate limiting',
      category: 'security',
      environment: ['development', 'staging', 'production'],
    })

    this.addSchema({
      key: 'plugins.sandbox.memoryLimit',
      type: 'string',
      defaultValue: '512MB',
      validation: { pattern: '^\\d+[KMGT]?B$' },
      description: 'Plugin sandbox memory limit',
      category: 'plugins',
      environment: ['staging', 'production'],
    })

    // Analytics Configuration
    this.addSchema({
      key: 'analytics.enabled',
      type: 'boolean',
      defaultValue: true,
      description: 'Enable analytics collection',
      category: 'analytics',
      environment: ['development', 'staging', 'production'],
    })

    this.addSchema({
      key: 'analytics.batchSize',
      type: 'number',
      defaultValue: 100,
      validation: { min: 10, max: 1000 },
      description: 'Analytics event batch size',
      category: 'analytics',
      environment: ['development', 'staging', 'production'],
    })
  }

  private addSchema(schema: ConfigSchema): void {
    this.schema.set(schema.key, schema as any)
    this.validateSchema(schema)
  }

  // =============================================================================
  // CONFIGURATION ACCESS METHODS
  // =============================================================================

  async get<T>(
    key: string,
    defaultValue?: T,
    options?: {
      tenantId?: string
      service?: string
    }
  ): Promise<T> {
    const cacheKey = this.getCacheKey(key, options?.tenantId, options?.service)

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const config = this.cache.get(cacheKey)!
      return config.value as T
    }

    // Check Redis cache
    const redisValue = await this.redis.get(cacheKey)
    if (redisValue) {
      const config = JSON.parse(redisValue) as ConfigValue
      this.cache.set(cacheKey, config)
      return config.value as T
    }

    // Load from database
    const config = await this.loadFromDatabase(key, options)

    if (config) {
      this.cache.set(cacheKey, config)
      await this.redis.setex(cacheKey, 300, JSON.stringify(config)) // 5 minutes cache
      return config.value as T
    }

    // Return default value
    const schema = this.schema.get(key)
    if (schema?.defaultValue !== undefined) {
      return schema.defaultValue as T
    }

    return defaultValue as T
  }

  async set(
    key: string,
    value: any,
    options?: {
      tenantId?: string
      service?: string
      changedBy?: string
      reason?: string
    }
  ): Promise<void> {
    const schema = this.schema.get(key)

    if (!schema) {
      throw new Error(`Unknown configuration key: ${key}`)
    }

    // Validate value
    const validation = ConfigValidator.validate(key, value, schema)
    if (!validation.isValid) {
      throw new Error(`Invalid configuration value for ${key}: ${validation.errors.join(', ')}`)
    }

    const cacheKey = this.getCacheKey(key, options?.tenantId, options?.service)
    const oldValue = (await this.get(key, undefined, options)) as any

    const configValue: ConfigValue = {
      key,
      value: value,
      type: schema.type,
      environment: this.environment as any,
      tenantId: options?.tenantId,
      service: options?.service,
      encrypted: schema.encrypted as any,
      version: Date.now(),
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: options?.changedBy || 'system',
    }

    // Save to database
    await this.saveToDatabase(configValue)

    // Update caches
    this.cache.set(cacheKey, configValue)
    await this.redis.setex(cacheKey, 300, JSON.stringify(configValue))

    // Publish change event
    const change: ConfigChange = {
      key,
      oldValue,
      newValue: value,
      changedBy: options?.changedBy || 'system',
      reason: options?.reason,
      timestamp: new Date(),
      metadata: {
        tenantId: options?.tenantId,
        service: options?.service,
      },
    }

    await this.publishChange(change)
  }

  async watch(
    key: string,
    callback: (value: any, change: ConfigChange) => void,
    options?: {
      tenantId?: string
      service?: string
    }
  ): Promise<() => void> {
    const eventName = this.getChangeEvent(key, options?.tenantId, options?.service)

    const handler = (change: ConfigChange) => {
      if (change.key === key) {
        callback(change.newValue, change)
      }
    }

    this.on(eventName, handler)

    // Return unsubscribe function
    return () => {
      this.off(eventName, handler)
    }
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  async getAll(
    category?: string,
    options?: {
      tenantId?: string
      service?: string
    }
  ): Promise<Record<string, any>> {
    const configs: Record<string, any> = {}

    for (const [key, schema] of this.schema.entries()) {
      if (category && schema.category !== category) {
        continue
      }

      if (schema.environment.length > 0 && !schema.environment.includes(this.environment)) {
        continue
      }

      try {
        const value = await this.get(key, undefined, options)
        configs[key] = value
      } catch (error) {
        console.warn(`Failed to load config ${key}:`, error)
      }
    }

    return configs
  }

  async setBulk(
    configs: Record<string, any>,
    options?: {
      tenantId?: string
      service?: string
      changedBy?: string
      reason?: string
    }
  ): Promise<void> {
    const changes: ConfigChange[] = []

    for (const [key, value] of Object.entries(configs)) {
      try {
        const oldValue = await this.get(key, undefined, options)
        await this.set(key, value, options)

        changes.push({
          key,
          oldValue,
          newValue: value,
          changedBy: options?.changedBy || 'system',
          reason: options?.reason,
          timestamp: new Date(),
        })
      } catch (error) {
        console.error(`Failed to set config ${key}:`, error)
        throw error
      }
    }

    // Publish bulk change event
    await this.publishBulkChange(changes)
  }

  // =============================================================================
  // TENANT AND SERVICE SPECIFIC CONFIGURATION
  // =============================================================================

  async getTenantConfig(tenantId: string): Promise<Record<string, any>> {
    return this.getAll(undefined, { tenantId })
  }

  async setTenantConfig(
    tenantId: string,
    configs: Record<string, any>,
    options?: {
      changedBy?: string
      reason?: string
    }
  ): Promise<void> {
    return this.setBulk(configs, { tenantId, ...options })
  }

  async getServiceConfig(service: string): Promise<Record<string, any>> {
    return this.getAll(undefined, { service })
  }

  async setServiceConfig(
    service: string,
    configs: Record<string, any>,
    options?: {
      changedBy?: string
      reason?: string
    }
  ): Promise<void> {
    return this.setBulk(configs, { service, ...options })
  }

  // =============================================================================
  // CONFIGURATION SCHEMA MANAGEMENT
  // =============================================================================

  getSchema(key?: string): ConfigSchema | Map<string, ConfigSchema> {
    if (key) {
      return this.schema.get(key)!
    }
    return this.schema
  }

  async addSchemaField(schema: ConfigSchema): Promise<void> {
    this.validateSchema(schema)
    this.schema.set(schema.key, schema)

    // Save schema to database
    await this.saveSchemaToDatabase(schema)

    this.emit('schema.added', schema)
  }

  async removeSchemaField(key: string): Promise<void> {
    if (!this.schema.has(key)) {
      throw new Error(`Schema field ${key} does not exist`)
    }

    this.schema.delete(key)

    // Remove from database
    await this.removeSchemaFromDatabase(key)

    this.emit('schema.removed', { key })
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private getCacheKey(key: string, tenantId?: string, service?: string): string {
    const parts = ['config', this.environment, key]
    if (tenantId) parts.push('tenant', tenantId)
    if (service) parts.push('service', service)
    return parts.join(':')
  }

  private getChangeEvent(key: string, tenantId?: string, service?: string): string {
    return `config.changed:${this.getCacheKey(key, tenantId, service)}`
  }

  private async loadFromDatabase(
    key: string,
    options?: {
      tenantId?: string
      service?: string
    }
  ): Promise<ConfigValue | null> {
    try {
      const query = `
        SELECT * FROM configuration_values
        WHERE key = $1
          AND environment = $2
          AND ($3::text IS NULL OR tenant_id = $3)
          AND ($4::text IS NULL OR service = $4)
        ORDER BY version DESC
        LIMIT 1
      `

      const result = await this.db.query(query, [
        key,
        this.environment,
        options?.tenantId || null,
        options?.service || null,
      ])

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]
      const config: ConfigValue = {
        key: row.key,
        value: row.encrypted ? JSON.parse(this.decrypt(row.value)) : row.value,
        type: row.type,
        environment: row.environment,
        tenantId: row.tenant_id,
        service: row.service,
        encrypted: row.encrypted,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      }

      return config
    } catch (error) {
      console.error(`Failed to load config ${key} from database:`, error)
      return null
    }
  }

  private async saveToDatabase(config: ConfigValue): Promise<void> {
    try {
      const query = `
        INSERT INTO configuration_values (
          key, value, type, environment, tenant_id, service,
          encrypted, version, created_at, updated_at, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        ON CONFLICT (key, environment, tenant_id, service)
        DO UPDATE SET
          value = EXCLUDED.value,
          type = EXCLUDED.type,
          encrypted = EXCLUDED.encrypted,
          version = EXCLUDED.version,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by
      `

      await this.db.query(query, [
        config.key,
        config.encrypted ? this.encrypt(JSON.stringify(config.value)) : config.value,
        config.type,
        config.environment,
        config.tenantId || null,
        config.service || null,
        config.encrypted,
        config.version,
        config.createdAt,
        config.updatedAt,
        config.updatedBy || null,
      ])

      console.log(`Configuration ${config.key} saved to database`)
    } catch (error) {
      console.error(`Failed to save config ${config.key} to database:`, error)
      throw error
    }
  }

  private async saveSchemaToDatabase(schema: ConfigSchema): Promise<void> {
    try {
      const query = `
        INSERT INTO configuration_schema (
          key, type, required, default_value, validation,
          description, category, environment, tenant_specific,
          service_specific
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        ON CONFLICT (key) DO UPDATE SET
          type = EXCLUDED.type,
          required = EXCLUDED.required,
          default_value = EXCLUDED.default_value,
          validation = EXCLUDED.validation,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          environment = EXCLUDED.environment,
          tenant_specific = EXCLUDED.tenant_specific,
          service_specific = EXCLUDED.service_specific
      `

      await this.db.query(query, [
        schema.key,
        schema.type,
        schema.required,
        schema.defaultValue ? JSON.stringify(schema.defaultValue) : null,
        schema.validation ? JSON.stringify(schema.validation) : null,
        schema.description,
        JSON.stringify(schema.environment),
        schema.tenantSpecific || false,
        schema.serviceSpecific || false,
      ])
    } catch (error) {
      console.error(`Failed to save schema ${schema.key} to database:`, error)
      throw error
    }
  }

  private async removeSchemaFromDatabase(key: string): Promise<void> {
    try {
      await this.db.query('DELETE FROM configuration_schema WHERE key = $1', [key])
    } catch (error) {
      console.error(`Failed to remove schema ${key} from database:`, error)
      throw error
    }
  }

  private async publishChange(change: ConfigChange): Promise<void> {
    this.emit('config.changed', change)

    // Publish to Redis for cross-service communication
    await this.redis.publish('config.changed', JSON.stringify(change))
  }

  private async publishBulkChange(changes: ConfigChange[]): Promise<void> {
    this.emit('config.bulk.changed', changes)

    // Publish to Redis
    await this.redis.publish('config.bulk.changed', JSON.stringify(changes))
  }

  private startCacheRefresh(): void {
    // Refresh cache every 5 minutes
    setInterval(
      async () => {
        await this.refreshCache()
      },
      5 * 60 * 1000
    )
  }

  private async refreshCache(): Promise<void> {
    // In a real implementation, this would refresh cache from database
    console.log('Refreshing configuration cache...')
  }

  // =============================================================================
  // ENCRYPTION
  // =============================================================================

  private encrypt(text: string): string {
    const cipher = createHash('sha256')
    cipher.update(text + this.encryptionKey)
    return cipher.digest('hex')
  }

  private decrypt(hash: string): string {
    // In a real implementation, this would decrypt the hash
    // For now, this is a placeholder
    return hash
  }

  private validateSchema(schema: ConfigSchema): void {
    if (!schema.key) {
      throw new Error('Schema key is required')
    }

    if (!schema.type || !['string', 'number', 'boolean', 'object', 'array'].includes(schema.type)) {
      throw new Error('Schema type is required and must be valid')
    }

    if (!schema.description) {
      throw new Error('Schema description is required')
    }

    if (!schema.category) {
      throw new Error('Schema category is required')
    }
  }

  // =============================================================================
  // ADMINISTRATION
  // =============================================================================

  async getConfigHistory(
    key: string,
    options?: {
      tenantId?: string
      service?: string
      limit?: number
    }
  ): Promise<ConfigChange[]> {
    try {
      const query = `
        SELECT 
          key,
          value,
          updated_by,
          updated_at
        FROM configuration_values
        WHERE key = $1
          AND environment = $2
          AND ($3::text IS NULL OR tenant_id = $3)
          AND ($4::text IS NULL OR service = $4)
        ORDER BY version DESC
        LIMIT $5
      `

      const result = await this.db.query(query, [
        key,
        this.environment,
        options?.tenantId || null,
        options?.service || null,
        options?.limit || 10,
      ])

      return result.rows.map((row: any) => ({
        key: row.key,
        oldValue: row.encrypted ? this.decrypt(row.value) : row.value,
        newValue: null, // Would need to calculate from previous version
        changedBy: row.updated_by,
        timestamp: row.updated_at,
      }))
    } catch (error) {
      console.error(`Failed to get config history for ${key}:`, error)
      return []
    }
  }

  async exportConfigs(options?: {
    tenantId?: string
    service?: string
    category?: string
  }): Promise<Record<string, any>> {
    const configs = await this.getAll(options?.category, {
      tenantId: options?.tenantId,
      service: options?.service,
    })

    // Filter out sensitive values for export
    const exportConfigs: Record<string, any> = {}

    for (const [key, value] of Object.entries(configs)) {
      const schema = this.schema.get(key)
      if (schema?.encrypted) {
        exportConfigs[key] = '[ENCRYPTED]'
      } else {
        exportConfigs[key] = value
      }
    }

    return exportConfigs
  }

  async importConfigs(
    configs: Record<string, any>,
    options?: {
      tenantId?: string
      service?: string
      changedBy?: string
      overwrite?: boolean
    }
  ): Promise<{ success: string[]; errors: string[] }> {
    const results = { success: [] as string[], errors: [] as string[] }

    for (const [key, value] of Object.entries(configs)) {
      try {
        const schema = this.schema.get(key)

        if (!schema) {
          results.errors.push(`Unknown configuration key: ${key}`)
          continue
        }

        if (schema.encrypted && value === '[ENCRYPTED]') {
          continue // Skip encrypted placeholder values
        }

        const existing = await this.get(key, undefined, options)

        if (existing !== undefined && !options?.overwrite) {
          results.errors.push(`Configuration ${key} already exists and overwrite is false`)
          continue
        }

        await this.set(key, value, options)
        results.success.push(key)
      } catch (error) {
        results.errors.push(`Failed to import ${key}: ${error.message}`)
      }
    }

    return results
  }
}

export default CentralizedConfigurationManager
