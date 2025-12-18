import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '@/libs/DB'
import type { ServiceRegistry, NewServiceRegistry } from '@/models/Schema'
import { serviceRegistrySchema } from '@/models/Schema'
import {
  ServiceAlreadyExistsError,
  ServiceNotFoundError,
  ServiceValidationError,
} from '@/libs/microservices-errors'
import {
  InputValidator,
  URLValidator,
} from '@/libs/security-utils'

/**
 * Service Registry class for managing microservices
 */
export class ServiceRegistryImpl {
  /**
   * Register a new service
   */
  async register(data: NewServiceRegistry): Promise<string> {
    // Validate required fields
    if (!data.name || !data.slug || !data.version || !data.baseUrl || !data.healthEndpoint) {
      throw new ServiceValidationError(
        'Missing required fields: name, slug, version, baseUrl, healthEndpoint'
      )
    }

    // Validate inputs
    if (!InputValidator.validateSlug(data.slug)) {
      throw new ServiceValidationError('Invalid slug format')
    }

    if (!InputValidator.validateVersion(data.version)) {
      throw new ServiceValidationError('Invalid version format (use semantic versioning)')
    }

    if (data.category && !InputValidator.validateCategory(data.category)) {
      throw new ServiceValidationError('Invalid category')
    }

    // Validate URLs
    const baseUrlValidation = URLValidator.validateServiceURL(data.baseUrl)
    if (!baseUrlValidation.valid) {
      throw new ServiceValidationError(`Invalid base URL: ${baseUrlValidation.error}`)
    }

    // Check if service slug already exists
    const existingService = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.slug, data.slug))
      .limit(1)

    if (existingService.length > 0) {
      throw new ServiceAlreadyExistsError(data.slug)
    }

    // Create new service
    const [newService] = await db
      .insert(serviceRegistrySchema)
      .values({
        name: InputValidator.sanitizeString(data.name, 255),
        slug: InputValidator.sanitizeString(data.slug, 100),
        version: InputValidator.sanitizeString(data.version, 50),
        baseUrl: baseUrlValidation.sanitizedUrl!,
        healthEndpoint: InputValidator.sanitizeString(data.healthEndpoint, 500),
        docsEndpoint: data.docsEndpoint ? InputValidator.sanitizeString(data.docsEndpoint, 500) : null,
        description: data.description ? InputValidator.sanitizeString(data.description, 1000) : null,
        category: data.category ? InputValidator.sanitizeString(data.category, 100) : null,
        tags: Array.isArray(data.tags) ? data.tags.map((tag) => InputValidator.sanitizeString(tag, 50)) : [],
        isInternal: Boolean(data.isInternal),
        config: data.config && typeof data.config === 'object' ? data.config : {},
        secrets: data.secrets && typeof data.secrets === 'object' ? data.secrets : {},
        status: 'inactive',
      })
      .returning()

    return newService.id
  }

  /**
   * Get all services with optional filtering
   */
  async getServices(filters: {
    status?: string
    category?: string
    author?: string
    isInternal?: string
  }): Promise<ServiceRegistry[]> {
    let whereConditions = []

    if (filters.status) {
      whereConditions.push(eq(serviceRegistrySchema.status, filters.status))
    }

    if (filters.category) {
      whereConditions.push(eq(serviceRegistrySchema.category, filters.category))
    }

    return await db
      .select()
      .from(serviceRegistrySchema)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(serviceRegistrySchema.createdAt))
  }

  /**
   * Get a single service by ID
   */
  async getService(id: string): Promise<ServiceRegistry | null> {
    const services = await db
      .select()
      .from(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.id, id))
      .limit(1)

    return services[0] || null
  }

  /**
   * Update a service
   */
  async updateService(id: string, data: Partial<NewServiceRegistry>): Promise<void> {
    const existingService = await this.getService(id)
    if (!existingService) {
      throw new ServiceNotFoundError(id)
    }

    // Prepare update data
    const updateData: any = {}

    if (data.description !== undefined) {
      updateData.description = data.description ? InputValidator.sanitizeString(data.description, 1000) : null
    }

    if (data.category !== undefined) {
      updateData.category = data.category ? InputValidator.sanitizeString(data.category, 100) : null
    }

    if (data.tags !== undefined) {
      updateData.tags = Array.isArray(data.tags) ? data.tags.map((tag) => InputValidator.sanitizeString(tag, 50)) : []
    }

    if (data.config !== undefined) {
      updateData.config = data.config && typeof data.config === 'object' ? data.config : {}
    }

    if (data.secrets !== undefined) {
      updateData.secrets = data.secrets && typeof data.secrets === 'object' ? data.secrets : {}
    }

    await db
      .update(serviceRegistrySchema)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(serviceRegistrySchema.id, id))
  }

  /**
   * Unregister (delete) a service
   */
  async unregister(id: string): Promise<void> {
    const existingService = await this.getService(id)
    if (!existingService) {
      throw new ServiceNotFoundError(id)
    }

    await db
      .delete(serviceRegistrySchema)
      .where(eq(serviceRegistrySchema.id, id))
  }

  /**
   * Get service health status
   */
  async getHealthStatus(id: string): Promise<{
    status: string
    lastHealthCheck: Date | null
    responseTime: number | null
    uptime: number | null
  }> {
    const service = await this.getService(id)
    if (!service) {
      throw new ServiceNotFoundError(id)
    }

    return {
      status: service.status,
      lastHealthCheck: service.lastHealthCheck,
      responseTime: service.responseTime,
      uptime: service.uptime,
    }
  }

  /**
   * Update service configuration
   */
  async updateConfig(id: string, config: any): Promise<void> {
    this.validateServiceConfig(config)

    await db
      .update(serviceRegistrySchema)
      .set({ 
        config: config,
        updatedAt: new Date()
      })
      .where(eq(serviceRegistrySchema.id, id))
  }

  /**
   * Validate service configuration
   */
  private validateServiceConfig(config: any): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object')
    }

    // Check for sensitive data in public config
    const sensitiveKeys = ['password', 'secret', 'key', 'private']
    const hasSensitiveData = Object.keys(config).some(key => 
      sensitiveKeys.some(sensitiveKey => config[key] && config[key] !== ''))
    
    if (hasSensitiveData) {
      throw new Error('Configuration contains sensitive data')
    }

    // Validate URL format
    if (config.baseUrl && !this.isValidUrl(config.baseUrl)) {
      throw new Error('Invalid baseUrl format')
    }

    // Validate arrays
    const arrayFields = ['tags']
    arrayFields.forEach(field => {
      if (Array.isArray(config[field])) {
        const arrayValue = config[field]
        if (!arrayValue.every(item => typeof item === 'string')) {
          throw new Error(`Field ${field} must be an array of strings`)
        }
      }
    })
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const serviceRegistry = new ServiceRegistryImpl()