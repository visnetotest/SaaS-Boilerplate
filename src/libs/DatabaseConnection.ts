// =============================================================================
// DATABASE CONNECTION POOLING
// =============================================================================

// Connection Pool Configuration
export interface PoolConfig {
  max: number // Maximum number of connections
  min: number // Minimum number of connections
  idleTimeoutMillis: number // How long a connection can be idle before being closed
  acquireTimeoutMillis: number // How long to wait for a connection
  createTimeoutMillis: number // How long to wait when creating a connection
  destroyTimeoutMillis: number // How long to wait when destroying a connection
  reapIntervalMillis: number // How often to check for idle connections
  createRetryIntervalMillis: number // How long to wait between retry attempts
}

export const DEFAULT_POOL_CONFIG: PoolConfig = {
  max: 20, // Max 20 connections
  min: 5, // Keep 5 connections ready
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  acquireTimeoutMillis: 2000, // Wait max 2s for connection
  createTimeoutMillis: 5000, // Wait max 5s for new connection
  destroyTimeoutMillis: 1000, // Wait max 1s to destroy
  reapIntervalMillis: 1000, // Check every second
  createRetryIntervalMillis: 200, // Retry every 200ms
}

// Environment-based pool sizing
export function getPoolConfig(): PoolConfig {
  const nodeEnv =
    (process.env.NODE_ENV as 'development' | 'production' | 'test' | 'staging') || 'development'

  switch (nodeEnv) {
    case 'production':
      return {
        ...DEFAULT_POOL_CONFIG,
        max: 50, // More connections for production
        min: 10, // Keep more ready connections
        idleTimeoutMillis: 60000, // Longer idle timeout for production
      }

    case 'staging':
      return {
        ...DEFAULT_POOL_CONFIG,
        max: 30,
        min: 8,
      }

    case 'development':
    default:
      return {
        ...DEFAULT_POOL_CONFIG,
        max: 10, // Fewer connections for development
        min: 2,
        idleTimeoutMillis: 15000,
      }
  }
}

// Alternative Database Connection Options
export enum DatabaseBackend {
  POSTGRESQL = 'postgresql',
  NEON = 'neon', // Serverless PostgreSQL
  PLANETSCALE = 'planetscale', // Serverless MySQL
  TIDB = 'tidb', // Distributed SQL
  COCKROACHDB = 'cockroachdb', // Distributed SQL
}

// Connection Strategy Recommendations
export interface ConnectionStrategy {
  backend: DatabaseBackend
  config: PoolConfig
  features: string[]
  useCases: string[]
}

export const DATABASE_STRATEGIES: Record<DatabaseBackend, ConnectionStrategy> = {
  [DatabaseBackend.POSTGRESQL]: {
    backend: DatabaseBackend.POSTGRESQL,
    config: getPoolConfig(),
    features: ['ACID compliance', 'JSON support', 'Full-text search', 'Window functions', 'CTEs'],
    useCases: [
      'Production workloads',
      'Complex transactions',
      'Data integrity requirements',
      'Analytics with window functions',
    ],
  },

  [DatabaseBackend.NEON]: {
    backend: DatabaseBackend.NEON,
    config: {
      ...getPoolConfig(),
      max: 100, // Neon supports higher concurrency
      min: 5,
    },
    features: [
      'Serverless scaling',
      'Auto-scaling storage',
      'Branch-based deployments',
      'PostgreSQL compatibility',
      'Built-in connection pooling',
    ],
    useCases: [
      'Variable workloads',
      'Serverless applications',
      'Development environments',
      'Cost-optimized deployments',
    ],
  },

  [DatabaseBackend.PLANETSCALE]: {
    backend: DatabaseBackend.PLANETSCALE,
    config: {
      ...DEFAULT_POOL_CONFIG,
      max: 30,
      min: 3,
      idleTimeoutMillis: 45000,
    },
    features: [
      'Serverless MySQL',
      'Auto-sharding',
      'Vitess compatibility',
      'Global distribution',
      'Real-time analytics',
    ],
    useCases: [
      'High-read workloads',
      'Global applications',
      'MySQL compatibility required',
      'Real-time data needs',
    ],
  },

  [DatabaseBackend.TIDB]: {
    backend: DatabaseBackend.TIDB,
    config: {
      ...DEFAULT_POOL_CONFIG,
      max: 40,
      min: 5,
      idleTimeoutMillis: 60000,
    },
    features: [
      'HTAP workloads',
      'Distributed transactions',
      'Real-time analytics',
      'MySQL compatibility',
      'Auto-scaling',
    ],
    useCases: [
      'Hybrid transactional/analytical',
      'Large-scale analytics',
      'Real-time dashboards',
      'High concurrency needs',
    ],
  },

  [DatabaseBackend.COCKROACHDB]: {
    backend: DatabaseBackend.COCKROACHDB,
    config: {
      ...DEFAULT_POOL_CONFIG,
      max: 25,
      min: 5,
      idleTimeoutMillis: 45000,
    },
    features: [
      'Distributed ACID',
      'Automatic sharding',
      'Geo-partitioning',
      'Survivability',
      'PostgreSQL compatibility',
    ],
    useCases: [
      'Global distributed apps',
      'High availability requirements',
      'Multi-region deployments',
      'Disaster recovery needs',
    ],
  },
}

// Database Backend Selection Helper
export function selectDatabaseBackend(requirements: {
  workloadType: 'transactional' | 'analytical' | 'hybrid'
  scale: 'small' | 'medium' | 'large' | 'enterprise'
  budget: 'cost-optimized' | 'performance' | 'balanced'
  geography: 'single-region' | 'multi-region' | 'global'
  compliance: 'none' | 'hipaa' | 'gdpr' | 'soc2'
}): DatabaseBackend {
  const { workloadType, scale, budget, geography, compliance } = requirements

  // Decision matrix for backend selection
  if (geography === 'global' || compliance === 'gdpr') {
    return DatabaseBackend.COCKROACHDB
  }

  if (workloadType === 'hybrid' && scale === 'large') {
    return DatabaseBackend.TIDB
  }

  if (budget === 'cost-optimized' || scale === 'small') {
    return DatabaseBackend.NEON
  }

  if (workloadType === 'analytical' && geography === 'single-region') {
    return DatabaseBackend.PLANETSCALE
  }

  // Default to PostgreSQL for most use cases
  return DatabaseBackend.POSTGRESQL
}

// Connection Pool Monitoring
export interface PoolMetrics {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  waitingClients: number
  maxConnections: number
  averageWaitTime: number
  totalRequests: number
  totalErrors: number
}

export class DatabasePoolMonitor {
  private metrics: PoolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    maxConnections: 0,
    averageWaitTime: 0,
    totalRequests: 0,
    totalErrors: 0,
  }

  recordConnectionEvent(event: 'acquired' | 'released' | 'created' | 'destroyed'): void {
    switch (event) {
      case 'acquired':
        this.metrics.activeConnections++
        this.metrics.totalRequests++
        break
      case 'released':
        this.metrics.activeConnections--
        this.metrics.idleConnections++
        break
      case 'created':
        this.metrics.totalConnections++
        break
      case 'destroyed':
        this.metrics.totalConnections--
        this.metrics.idleConnections--
        break
    }

    this.metrics.maxConnections = Math.max(
      this.metrics.maxConnections,
      this.metrics.totalConnections
    )
  }

  recordError(): void {
    this.metrics.totalErrors++
  }

  recordWaitTime(waitTime: number): void {
    // Calculate running average
    this.metrics.averageWaitTime = (this.metrics.averageWaitTime + waitTime) / 2
  }

  getMetrics(): PoolMetrics {
    return { ...this.metrics }
  }

  reset(): void {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      maxConnections: 0,
      averageWaitTime: 0,
      totalRequests: 0,
      totalErrors: 0,
    }
  }
}

// Recommendations for Redis Integration
export interface RedisCachingStrategy {
  defaultTTL: number // Default TTL in seconds
  maxMemory: string // Maximum memory allocation
  evictionPolicy: string // Redis eviction policy
  persistence: boolean // Whether to enable persistence
  clustering: boolean // Whether to use Redis clustering
}

export const REDIS_STRATEGIES: Record<string, RedisCachingStrategy> = {
  development: {
    defaultTTL: 300, // 5 minutes
    maxMemory: '256mb',
    evictionPolicy: 'allkeys-lru',
    persistence: false,
    clustering: false,
  },

  staging: {
    defaultTTL: 600, // 10 minutes
    maxMemory: '512mb',
    evictionPolicy: 'allkeys-lru',
    persistence: true,
    clustering: false,
  },

  production: {
    defaultTTL: 3600, // 1 hour
    maxMemory: '2gb',
    evictionPolicy: 'volatile-lru',
    persistence: true,
    clustering: true, // Enable for high availability
  },
}

// Redis Key Patterns for Optimal Performance
export const REDIS_KEY_PATTERNS = {
  USER_SESSION: 'session:user:{userId}',
  RATE_LIMIT: 'ratelimit:{identifier}:{window}',
  CACHE_TTL: 'cache:{service}:{resource}:{id}',
  METRICS_AGGREGATE: 'metrics:agg:{service}:{metric}:{period}',
  SEARCH_INDEX: 'search:index:{entity}',
  LOCK: 'lock:{resource}:{id}',
  QUEUE: 'queue:{service}:{priority}',
}

// TTL Recommendations by Data Type
export const CACHE_TTL_RECOMMENDATIONS = {
  // Short-term caches (seconds)
  USER_PERMISSIONS: 300, // 5 minutes
  RATE_LIMIT: 60, // 1 minute
  SESSION_DATA: 1800, // 30 minutes

  // Medium-term caches (seconds)
  SERVICE_REGISTRY: 600, // 10 minutes
  API_RESPONSES: 300, // 5 minutes
  CONFIGURATION: 3600, // 1 hour

  // Long-term caches (seconds)
  USER_PROFILES: 7200, // 2 hours
  TENANT_SETTINGS: 14400, // 4 hours
  ANALYTICS_SUMMARY: 28800, // 8 hours

  // Static data (hours)
  SYSTEM_CONFIG: 24, // 24 hours
  GEOGRAPHICAL_DATA: 168, // 7 days
  PLUGIN_METADATA: 720, // 30 days
}
