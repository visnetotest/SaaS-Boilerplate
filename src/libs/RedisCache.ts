// =============================================================================
// REDIS CACHING SERVICE
// =============================================================================

import Redis from 'ioredis'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  namespace?: string // Key namespace
  tags?: string[] // Cache tags for invalidation
}

export interface CacheMetrics {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  hitRate: number
  memoryUsage: number
}

export class RedisCacheService {
  private redis: Redis
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
    memoryUsage: 0,
  }
  private metricsInterval: NodeJS.Timeout | null = null

  constructor() {
    // Redis connection configuration
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    const redisPassword = process.env.REDIS_PASSWORD

    this.redis = new Redis(redisUrl, {
      password: redisPassword,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keyPrefix: 'saas:',
      // Connection pool settings
      family: 4,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    })

    // Handle Redis events
    this.redis.on('connect', () => {
      console.log('✅ Redis connected')
    })

    this.redis.on('error', (error: Error) => {
      console.error('❌ Redis error:', error)
      this.metrics.errors++
    })

    this.redis.on('close', () => {
      console.log('🔌 Redis connection closed')
    })

    // Start metrics collection
    this.startMetricsCollection()
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const total = this.metrics.hits + this.metrics.misses
      this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0

      // Log metrics every minute
      if (process.env.NODE_ENV === 'production') {
        console.log('📊 Cache Metrics:', this.metrics)
      }
    }, 60000) // Every minute
  }

  // Basic cache operations
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.namespace)
      const value = await this.redis.get(fullKey)

      if (value === null) {
        this.metrics.misses++
        return null
      }

      this.metrics.hits++
      return JSON.parse(value) as T
    } catch (error) {
      this.metrics.errors++
      console.error('Cache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.namespace)
      const serializedValue = JSON.stringify(value)
      const ttl = options?.ttl || 300 // Default 5 minutes

      const result = await this.redis.setex(fullKey, ttl, serializedValue)

      if (options?.tags) {
        // Store tags for cache invalidation
        await this.setTags(fullKey, options.tags)
      }

      this.metrics.sets++
      return result === 'OK'
    } catch (error) {
      this.metrics.errors++
      console.error('Cache set error:', error)
      return false
    }
  }

  async del(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.namespace)
      const result = await this.redis.del(fullKey)

      // Clean up tags
      await this.removeTags(fullKey)

      this.metrics.deletes++
      return result > 0
    } catch (error) {
      this.metrics.errors++
      console.error('Cache delete error:', error)
      return false
    }
  }

  // Advanced cache operations
  async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map((key) => this.buildKey(key, options?.namespace))
      const values = await this.redis.mget(fullKeys)

      return values.map((value) => {
        if (value === null) {
          this.metrics.misses++
          return null
        }
        this.metrics.hits++
        return JSON.parse(value) as T
      })
    } catch (error) {
      this.metrics.errors++
      console.error('Cache mget error:', error)
      return keys.map(() => null)
    }
  }

  async mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline()

      for (const entry of entries) {
        const fullKey = this.buildKey(entry.key, options?.namespace)
        const serializedValue = JSON.stringify(entry.value)
        const ttl = entry.ttl || options?.ttl || 300

        pipeline.setex(fullKey, ttl, serializedValue)
      }

      const results = await pipeline.exec()

      this.metrics.sets += entries.length

      return results?.every((result) => !result[0]) || false
    } catch (error) {
      this.metrics.errors++
      console.error('Cache mset error:', error)
      return false
    }
  }

  // Cache invalidation by tags
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const tagKey = this.buildTagKey(tag)
      const keys = await this.redis.smembers(tagKey)

      if (keys.length === 0) {
        return 0
      }

      // Delete all keys with this tag
      const pipeline = this.redis.pipeline()
      pipeline.del(...keys)
      pipeline.del(tagKey) // Clean up the tag set

      const results = await pipeline.exec()

      return (results?.length || 0) - 1 // Number of cache keys deleted
    } catch (error) {
      this.metrics.errors++
      console.error('Cache invalidation error:', error)
      return 0
    }
  }

  // Distributed locking
  async acquireLock(
    resource: string,
    ttl: number = 30,
    retries: number = 3
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const lockKey = this.buildLockKey(resource)
        const lockValue = `${Date.now()}-${Math.random()}`

        const result = await this.redis.set(
          lockKey,
          lockValue,
          'PX',
          ttl * 1000, // TTL in milliseconds
          'NX' // Only set if not exists
        )

        if (result === 'OK') {
          return lockValue
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100))
        }
      } catch (error) {
        console.error(`Lock acquisition attempt ${attempt} failed:`, error)
      }
    }

    return null
  }

  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    try {
      const lockKey = this.buildLockKey(resource)

      // Use Lua script to ensure atomic release
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `

      const result = await this.redis.eval(luaScript, 1, lockKey, lockValue)
      return result === 1
    } catch (error) {
      console.error('Lock release error:', error)
      return false
    }
  }

  // Cache warming
  async warmCache(
    entries: Array<{ key: string; value: any; ttl?: number }>,
    concurrency: number = 10
  ): Promise<void> {
    try {
      const chunks = []
      for (let i = 0; i < entries.length; i += concurrency) {
        chunks.push(entries.slice(i, i + concurrency))
      }

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map((entry) => this.set(entry.key, entry.value, { ttl: entry.ttl }))
        )
      }
    } catch (error) {
      console.error('Cache warming error:', error)
    }
  }

  // Cache analytics
  async getCacheInfo(): Promise<any> {
    try {
      const info = await this.redis.info('memory')
      const keyspace = await this.redis.info('keyspace')

      return {
        redis: this.parseRedisInfo(info),
        metrics: this.metrics,
        keyspace: this.parseRedisInfo(keyspace),
      }
    } catch (error) {
      console.error('Cache info error:', error)
      return null
    }
  }

  // Utility methods
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key
  }

  private buildTagKey(tag: string): string {
    return `tag:${tag}`
  }

  private buildLockKey(resource: string): string {
    return `lock:${resource}`
  }

  private async setTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline()

    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag)
      pipeline.sadd(tagKey, key)
      pipeline.expire(tagKey, 3600) // Tag entries expire after 1 hour
    }

    await pipeline.exec()
  }

  private async removeTags(_key: string): Promise<void> {
    // Find all tags that contain this key and remove it
    // This is a simplified implementation
    // In production, you'd maintain an index of key->tags mapping
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const lines = info.split('\r\n')
    const parsed: Record<string, string> = {}

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':')
        if (key && value) {
          parsed[key.trim()] = value.trim()
        }
      }
    }

    return parsed
  }

  // Connection management
  async connect(): Promise<void> {
    try {
      await this.redis.connect()
    } catch (error) {
      console.error('Redis connection failed:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval)
      }
      await this.redis.quit()
    } catch (error) {
      console.error('Redis disconnect error:', error)
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      console.error('Redis ping error:', error)
      return false
    }
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: any
  }> {
    try {
      const ping = await this.ping()
      const info = await this.getCacheInfo()

      if (!ping) {
        return { status: 'unhealthy', details: 'Redis not responding' }
      }

      const memoryUsage = parseFloat(info.redis?.used_memory_human || '0')
      const maxMemory = parseFloat(info.redis?.maxmemory_human || '1gb')
      const memoryPressure = memoryUsage / maxMemory

      if (memoryPressure > 0.9) {
        return {
          status: 'degraded',
          details: `High memory usage: ${(memoryPressure * 100).toFixed(1)}%`,
        }
      }

      return {
        status: 'healthy',
        details: { ping, memoryUsage, memoryPressure, metrics: this.metrics },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses
    return {
      ...this.metrics,
      hitRate: total > 0 ? (this.metrics.hits / total) * 100 : 0,
    }
  }

  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      memoryUsage: 0,
    }
  }
}

// Singleton instance
export const redisCache = new RedisCacheService()

// Cache wrapper with fallback to memory
export class FallbackCache {
  private memoryCache = new Map<string, { value: any; expiry: number }>()

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      // Try Redis first
      const redisValue = await redisCache.get<T>(key, options)
      if (redisValue !== null) {
        return redisValue
      }

      // Fallback to memory cache
      const fullKey = options?.namespace ? `${options.namespace}:${key}` : key
      const cached = this.memoryCache.get(fullKey)

      if (cached && cached.expiry > Date.now()) {
        return cached.value
      }

      return null
    } catch (error) {
      console.error('Fallback cache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      // Try Redis first
      const redisSuccess = await redisCache.set(key, value, options)

      if (redisSuccess) {
        return true
      }

      // Fallback to memory cache
      const fullKey = options?.namespace ? `${options.namespace}:${key}` : key
      const ttl = options?.ttl || 300
      const expiry = Date.now() + ttl * 1000

      this.memoryCache.set(fullKey, { value, expiry })
      return true
    } catch (error) {
      console.error('Fallback cache set error:', error)
      return false
    }
  }
}

export const fallbackCache = new FallbackCache()
