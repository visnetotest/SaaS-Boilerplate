import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite'
import fs from 'fs/promises'
import path from 'path'
import { Client } from 'pg'

import * as schema from '@/models/Schema'

import { Env } from './Env'

// =============================================================================
// MIGRATION TYPES AND INTERFACES
// =============================================================================

export interface MigrationFile {
  id: string
  name: string
  sql: string
  rollbackSql?: string
  timestamp: Date
  version: string
}

export interface MigrationRecord {
  id: string
  name: string
  version: string
  executed_at: Date
  execution_time_ms: number
  success: boolean
  rollback_sql?: string
}

export interface MigrationOptions {
  dryRun?: boolean
  force?: boolean
  toVersion?: string
  step?: number
}

export interface MigrationResult {
  success: boolean
  executed: MigrationRecord[]
  skipped: MigrationFile[]
  errors: Error[]
  executionTimeMs: number
}

// =============================================================================
// MIGRATION MANAGER
// =============================================================================

export class MigrationManager {
  private db: ReturnType<typeof drizzlePg> | PgliteDatabase<typeof schema>
  private migrationsPath: string

  constructor(migrationsPath: string = './migrations') {
    this.migrationsPath = path.resolve(migrationsPath)
    this.db = this.getDatabase()
  }

  private getDatabase() {
    if (Env.DATABASE_URL) {
      const client = new Client({
        connectionString: Env.DATABASE_URL,
      })
      client.connect()
      return drizzlePg(client, { schema })
    } else {
      const global = globalThis as unknown as {
        client: PGlite
        drizzle: PgliteDatabase<typeof schema>
      }
      if (!global.client) {
        global.client = new PGlite()
        global.client.waitReady
      }
      return global.drizzle || drizzlePglite(global.client, { schema })
    }
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [MigrationManager:${level.toUpperCase()}] ${message}`
    if (data) {
      console.log(logMessage, data)
    } else {
      console.log(logMessage)
    }
  }

  // =============================================================================
  // MIGRATION DISCOVERY
  // =============================================================================

  async getMigrationFiles(): Promise<MigrationFile[]> {
    try {
      const files = await fs.readdir(this.migrationsPath)
      const sqlFiles = files.filter((file) => file.endsWith('.sql'))

      const migrations: MigrationFile[] = []

      for (const file of sqlFiles.sort()) {
        const filePath = path.join(this.migrationsPath, file)
        const content = await fs.readFile(filePath, 'utf-8')

        // Parse migration file to extract version and rollback
        const migration = this.parseMigrationFile(file, content)
        migrations.push(migration)
      }

      return migrations
    } catch (error) {
      this.log('error', 'Failed to read migration files', error)
      throw error
    }
  }

  private parseMigrationFile(filename: string, content: string): MigrationFile {
    const parts = filename.split('_')
    const version = parts[0] ?? ''
    const name = filename.replace('.sql', '').replace(`${version}_`, '').replace(/_/g, ' ')

    // Extract rollback SQL if present
    const rollbackMatch = content.match(/-- ROLLBACK\s*\n([\s\S]*?)(?=\n-- |\n$|$)/i)
    const rollbackSql = rollbackMatch?.[1]?.trim()

    // Remove rollback section from main SQL
    const sql = content.replace(/-- ROLLBACK\s*\n[\s\S]*?(?=\n-- |\n$|$)/i, '').trim()

    return {
      id: filename,
      name,
      sql,
      rollbackSql,
      timestamp: new Date(),
      version,
    }
  }

  // =============================================================================
  // MIGRATION EXECUTION
  // =============================================================================

  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now()
    const result: MigrationResult = {
      success: true,
      executed: [],
      skipped: [],
      errors: [],
      executionTimeMs: 0,
    }

    try {
      this.log('info', 'Starting migration process', options)

      // Ensure migration table exists
      await this.ensureMigrationTable()

      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations()
      const executedVersions = new Set(executedMigrations.map((m) => m.version))

      // Get available migration files
      const availableMigrations = await this.getMigrationFiles()

      // Filter migrations to execute
      const pendingMigrations = availableMigrations.filter(
        (migration) => !executedVersions.has(migration.version)
      )

      if (pendingMigrations.length === 0) {
        this.log('info', 'No pending migrations found')
        result.executionTimeMs = Date.now() - startTime
        return result
      }

      // Execute migrations
      for (const migration of pendingMigrations) {
        try {
          if (options.dryRun) {
            this.log('info', `[DRY RUN] Would execute migration: ${migration.name}`)
            result.skipped.push(migration)
            continue
          }

          const migrationStart = Date.now()
          await this.executeMigration(migration)
          const executionTime = Date.now() - migrationStart

          const record: MigrationRecord = {
            id: migration.id,
            name: migration.name,
            version: migration.version,
            executed_at: new Date(),
            execution_time_ms: executionTime,
            success: true,
            rollback_sql: migration.rollbackSql,
          }

          await this.recordMigration(record)
          result.executed.push(record)

          this.log(
            'info',
            `Migration executed successfully: ${migration.name} (${executionTime}ms)`
          )
        } catch (error) {
          this.log('error', `Migration failed: ${migration.name}`, error)
          result.errors.push(error as Error)
          result.success = false

          if (!options.force) {
            break
          }
        }
      }

      result.executionTimeMs = Date.now() - startTime
      this.log('info', 'Migration process completed', {
        executed: result.executed.length,
        skipped: result.skipped.length,
        errors: result.errors.length,
        executionTime: result.executionTimeMs,
      })

      return result
    } catch (error) {
      this.log('error', 'Migration process failed', error)
      result.success = false
      result.errors.push(error as Error)
      result.executionTimeMs = Date.now() - startTime
      return result
    }
  }

  private async executeMigration(migration: MigrationFile): Promise<void> {
    const statements = migration.sql.split(';').filter((stmt) => stmt.trim())

    for (const statement of statements) {
      if (statement.trim()) {
        await this.db.execute(statement.trim())
      }
    }
  }

  // =============================================================================
  // ROLLBACK FUNCTIONALITY
  // =============================================================================

  async rollback(
    options: { steps?: number; toVersion?: string; dryRun?: boolean } = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    const result: MigrationResult = {
      success: true,
      executed: [],
      skipped: [],
      errors: [],
      executionTimeMs: 0,
    }

    try {
      this.log('info', 'Starting rollback process', options)

      const executedMigrations = await this.getExecutedMigrations()

      if (executedMigrations.length === 0) {
        this.log('info', 'No migrations to rollback')
        result.executionTimeMs = Date.now() - startTime
        return result
      }

      // Sort by execution date (newest first)
      const sortedMigrations = executedMigrations.sort(
        (a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
      )

      let migrationsToRollback: MigrationRecord[] = []

      if (options.toVersion) {
        // Rollback to specific version
        const targetIndex = sortedMigrations.findIndex((m) => m.version === options.toVersion)
        migrationsToRollback = sortedMigrations.slice(0, targetIndex)
      } else if (options.steps) {
        // Rollback specific number of steps
        migrationsToRollback = sortedMigrations.slice(0, options.steps)
      } else {
        // Rollback last migration
        migrationsToRollback = sortedMigrations.slice(0, 1)
      }

      for (const migration of migrationsToRollback) {
        try {
          if (!migration.rollback_sql) {
            this.log('warn', `No rollback SQL available for migration: ${migration.name}`)
            result.skipped.push({
              id: migration.id,
              name: migration.name,
              sql: '',
              version: migration.version,
              timestamp: migration.executed_at,
            })
            continue
          }

          if (options.dryRun) {
            this.log('info', `[DRY RUN] Would rollback migration: ${migration.name}`)
            result.skipped.push({
              id: migration.id,
              name: migration.name,
              sql: migration.rollback_sql,
              version: migration.version,
              timestamp: migration.executed_at,
            })
            continue
          }

          const rollbackStart = Date.now()
          await this.executeRollback(migration.rollback_sql)
          const executionTime = Date.now() - rollbackStart

          await this.removeMigrationRecord(migration.id)

          result.executed.push({
            ...migration,
            execution_time_ms: executionTime,
          })

          this.log(
            'info',
            `Migration rolled back successfully: ${migration.name} (${executionTime}ms)`
          )
        } catch (error) {
          this.log('error', `Rollback failed: ${migration.name}`, error)
          result.errors.push(error as Error)
          result.success = false
          break
        }
      }

      result.executionTimeMs = Date.now() - startTime
      this.log('info', 'Rollback process completed', {
        executed: result.executed.length,
        skipped: result.skipped.length,
        errors: result.errors.length,
        executionTime: result.executionTimeMs,
      })

      return result
    } catch (error) {
      this.log('error', 'Rollback process failed', error)
      result.success = false
      result.errors.push(error as Error)
      result.executionTimeMs = Date.now() - startTime
      return result
    }
  }

  private async executeRollback(rollbackSql: string): Promise<void> {
    const statements = rollbackSql.split(';').filter((stmt) => stmt.trim())

    for (const statement of statements) {
      if (statement.trim()) {
        await this.db.execute(statement.trim())
      }
    }
  }

  // =============================================================================
  // MIGRATION TRACKING
  // =============================================================================

  private async ensureMigrationTable(): Promise<void> {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER NOT NULL,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        rollback_sql TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at ON schema_migrations(executed_at);
    `

    await this.db.execute(createTableSql)
  }

  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    try {
      const result = await this.db.execute(`
        SELECT * FROM schema_migrations 
        WHERE success = TRUE 
        ORDER BY executed_at ASC
      `)

      return result.rows.map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        version: String(row.version),
        executed_at: new Date(row.executed_at),
        execution_time_ms: Number(row.execution_time_ms),
        success: Boolean(row.success),
        rollback_sql: row.rollback_sql ? String(row.rollback_sql) : undefined,
      }))
    } catch (error) {
      // Table doesn't exist yet
      return []
    }
  }

  private async recordMigration(record: MigrationRecord): Promise<void> {
    const escapedRollbackSql = record.rollback_sql
      ? record.rollback_sql.replace(/'/g, "''")
      : 'NULL'

    await this.db.execute(`
      INSERT INTO schema_migrations (
        id, name, version, executed_at, execution_time_ms, success, rollback_sql
      ) VALUES (
        '${record.id}',
        '${record.name}',
        '${record.version}',
        '${record.executed_at.toISOString()}',
        ${record.execution_time_ms},
        ${record.success},
        ${escapedRollbackSql === 'NULL' ? 'NULL' : `'${escapedRollbackSql}'`}
      )
    `)
  }

  private async removeMigrationRecord(migrationId: string): Promise<void> {
    await this.db.execute(`
      DELETE FROM schema_migrations WHERE id = '${migrationId}'
    `)
  }

  // =============================================================================
  // STATUS AND VALIDATION
  // =============================================================================

  async getStatus(): Promise<{
    current: MigrationRecord[]
    pending: MigrationFile[]
    total: number
  }> {
    await this.ensureMigrationTable()

    const [executed, available] = await Promise.all([
      this.getExecutedMigrations(),
      this.getMigrationFiles(),
    ])

    const executedVersions = new Set(executed.map((m) => m.version))
    const pending = available.filter((m) => !executedVersions.has(m.version))

    return {
      current: executed,
      pending,
      total: available.length,
    }
  }

  async validate(): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const migrations = await this.getMigrationFiles()
      const status = await this.getStatus()

      // Check for duplicate versions
      const versions = migrations.map((m) => m.version)
      const duplicateVersions = versions.filter((v, i) => versions.indexOf(v) !== i)
      if (duplicateVersions.length > 0) {
        errors.push(`Duplicate migration versions: ${duplicateVersions.join(', ')}`)
      }

      // Check for missing rollback SQL
      const withoutRollback = migrations.filter((m) => !m.rollbackSql)
      if (withoutRollback.length > 0) {
        warnings.push(
          `Migrations without rollback: ${withoutRollback.map((m) => m.name).join(', ')}`
        )
      }

      // Check for failed migrations
      const failedMigrations = status.current.filter((m) => !m.success)
      if (failedMigrations.length > 0) {
        errors.push(`Failed migrations: ${failedMigrations.map((m) => m.name).join(', ')}`)
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      }
    } catch (error) {
      errors.push(`Validation failed: ${(error as Error).message}`)
      return {
        valid: false,
        errors,
        warnings,
      }
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  async reset(): Promise<void> {
    this.log('warn', 'Resetting all migrations - this will drop all data')

    // Drop migration table
    await this.db.execute('DROP TABLE IF EXISTS schema_migrations')

    // Run all migrations from scratch
    await this.migrate()
  }

  async createMigration(name: string, rollbackSql?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0]
    const version = timestamp
    const filename = `${version}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`

    let content = `-- Migration: ${name}\n`
    content += `-- Created: ${new Date().toISOString()}\n`
    content += `-- Version: ${version}\n\n`

    // Add placeholder for UP migration
    content += `-- Add your migration SQL here\n`
    content += `-- Example:\n`
    content += `-- ALTER TABLE users ADD COLUMN new_column VARCHAR(255);\n\n`

    if (rollbackSql) {
      content += `-- ROLLBACK\n`
      content += rollbackSql
    } else {
      content += `-- ROLLBACK\n`
      content += `-- Add your rollback SQL here\n`
      content += `-- Example:\n`
      content += `-- ALTER TABLE users DROP COLUMN new_column;\n`
    }

    const filePath = path.join(this.migrationsPath, filename)
    await fs.writeFile(filePath, content, 'utf-8')

    this.log('info', `Migration created: ${filename}`)
    return filename
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export async function runMigrations(options?: MigrationOptions): Promise<MigrationResult> {
  const manager = new MigrationManager()
  return await manager.migrate(options)
}

export async function rollbackMigrations(options?: {
  steps?: number
  toVersion?: string
  dryRun?: boolean
}): Promise<MigrationResult> {
  const manager = new MigrationManager()
  return await manager.rollback(options)
}

export async function getMigrationStatus() {
  const manager = new MigrationManager()
  return await manager.getStatus()
}

export async function validateMigrations() {
  const manager = new MigrationManager()
  return await manager.validate()
}

export async function createMigration(name: string, rollbackSql?: string): Promise<string> {
  const manager = new MigrationManager()
  return await manager.createMigration(name, rollbackSql)
}
