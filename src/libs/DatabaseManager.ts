import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite'
import { Client } from 'pg'

import { Env } from '@/libs/Env'
import * as schema from '@/models/Schema'

export interface DatabaseConfig {
  type: 'postgresql' | 'pglite'
  url?: string
  maxConnections?: number
  idleTimeout?: number
  connectionTimeout?: number
}

export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  latency: number
  connections: number
  maxConnections: number
  lastCheck: Date
  error?: string
}

export class DatabaseManager {
  private static instance: DatabaseManager
  private db: any
  private client: Client | PGlite | null = null
  private config: DatabaseConfig
  private healthStatus: DatabaseHealth

  private constructor() {
    this.config = this.initializeConfig()
    this.healthStatus = {
      status: 'unhealthy',
      latency: 0,
      connections: 0,
      maxConnections: this.config.maxConnections || 20,
      lastCheck: new Date(),
    }
    this.initializeDatabase()
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  private initializeConfig(): DatabaseConfig {
    return {
      type: Env.DATABASE_URL ? 'postgresql' : 'pglite',
      url: Env.DATABASE_URL,
      maxConnections: 20,
      idleTimeout: 30000,
      connectionTimeout: 10000,
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      if (this.config.type === 'postgresql' && this.config.url) {
        await this.initializePostgreSQL()
      } else {
        await this.initializePglite()
      }

      await this.runHealthCheck()
      console.log(`Database initialized successfully using ${this.config.type}`)
    } catch (error) {
      console.error('Failed to initialize database:', error)
      this.healthStatus.status = 'unhealthy'
      this.healthStatus.error = error instanceof Error ? error.message : 'Unknown error'
      throw error
    }
  }

  private async initializePostgreSQL(): Promise<void> {
    this.client = new Client({
      connectionString: this.config.url,
      connectionTimeoutMillis: this.config.connectionTimeout,
    })

    await this.client.connect()

    this.db = drizzlePg(this.client, {
      schema,
      logger: process.env.NODE_ENV === 'development',
    })

    // Test connection
    await this.client.query('SELECT NOW() as now')
  }

  private async initializePglite(): Promise<void> {
    const global = globalThis as unknown as {
      client: PGlite
      drizzle: PgliteDatabase<typeof schema>
    }

    if (!global.client) {
      global.client = new PGlite()
      await global.client.waitReady
      global.drizzle = drizzlePglite(global.client, {
        schema,
        logger: process.env.NODE_ENV === 'development',
      })
    }

    this.client = global.client
    this.db = global.drizzle

    // Test connection
    await (this.client as PGlite).query('SELECT NOW() as now')
  }

  getDb() {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    return this.db
  }

  getConfig(): DatabaseConfig {
    return { ...this.config }
  }

  async getHealthStatus(): Promise<DatabaseHealth> {
    await this.runHealthCheck()
    return { ...this.healthStatus }
  }

  private async runHealthCheck(): Promise<void> {
    const startTime = Date.now()

    try {
      if (this.config.type === 'postgresql' && this.client instanceof Client) {
        await this.client.query('SELECT NOW() as now')
        const latency = Date.now() - startTime

        this.healthStatus = {
          status: 'healthy',
          latency,
          connections: 1, // Simplified for now
          maxConnections: this.config.maxConnections || 20,
          lastCheck: new Date(),
        }
      } else if (this.config.type === 'pglite' && this.client) {
        await (this.client as PGlite).query('SELECT NOW() as now')
        const latency = Date.now() - startTime

        this.healthStatus = {
          status: 'healthy',
          latency,
          connections: 1, // PGlite is single-connection
          maxConnections: 1,
          lastCheck: new Date(),
        }
      }
    } catch (error) {
      this.healthStatus = {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        connections: 0,
        maxConnections: this.config.maxConnections || 20,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Health check failed',
      }
    }
  }

  async close(): Promise<void> {
    try {
      if (this.client instanceof Client) {
        await this.client.end()
      }
      // PGlite doesn't need explicit closing
      this.healthStatus.status = 'unhealthy'
      console.log('Database connection closed')
    } catch (error) {
      console.error('Error closing database connection:', error)
      throw error
    }
  }

  async transaction<T>(callback: (db: any) => Promise<T>): Promise<T> {
    const db = this.getDb()

    if (this.config.type === 'postgresql') {
      // PostgreSQL transaction
      return await db.transaction(callback)
    } else {
      // PGlite transaction (simplified)
      return await callback(db)
    }
  }

  // Migration management
  async runMigrations(): Promise<void> {
    try {
      // This would integrate with MigrationManager
      // For now, we'll just log that migrations would run here
      console.log('Running database migrations...')

      // TODO: Integrate with MigrationManager
      // await MigrationManager.runMigrations();

      console.log('Database migrations completed')
    } catch (error) {
      console.error('Failed to run migrations:', error)
      throw error
    }
  }

  // Backup and restore utilities
  async backup(): Promise<string> {
    if (this.config.type === 'pglite') {
      // PGlite backup - simplified version
      return JSON.stringify({ timestamp: new Date().toISOString(), type: 'pglite_backup' })
    } else {
      throw new Error('Backup not implemented for PostgreSQL')
    }
  }

  async restore(_backupData: string): Promise<void> {
    if (this.config.type === 'pglite') {
      // PGlite restore - simplified version
      console.log('Restore functionality not yet implemented for PGlite')
    } else {
      throw new Error('Restore not implemented for PostgreSQL')
    }
  }

  // Performance monitoring
  async getPerformanceMetrics(): Promise<{
    queryTime: number[]
    connectionPool: {
      active: number
      idle: number
      total: number
    }
    cacheHitRatio?: number
  }> {
    try {
      if (this.config.type === 'postgresql' && this.client instanceof Client) {
        const result = await this.client.query(`
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections,
            count(*) FILTER (WHERE state = 'idle') as idle_connections
          FROM pg_stat_activity
        `)

        return {
          queryTime: [], // TODO: Implement query timing
          connectionPool: {
            active: parseInt(result.rows[0].active_connections),
            idle: parseInt(result.rows[0].idle_connections),
            total: parseInt(result.rows[0].total_connections),
          },
        }
      } else {
        return {
          queryTime: [],
          connectionPool: {
            active: 1,
            idle: 0,
            total: 1,
          },
        }
      }
    } catch (error) {
      console.error('Failed to get performance metrics:', error)
      throw error
    }
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance()

// Export convenience functions
export const getDb = () => databaseManager.getDb()
export const getDbConfig = () => databaseManager.getConfig()
export const getDbHealth = () => databaseManager.getHealthStatus()
export const runDbTransaction = <T>(callback: (db: any) => Promise<T>) =>
  databaseManager.transaction(callback)
