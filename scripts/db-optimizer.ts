#!/usr/bin/env tsx

import { sql } from 'drizzle-orm'
import { writeFileSync } from 'fs'
import { join } from 'path'

import { db } from '../src/libs/DB'

interface SlowQuery {
  query: string
  mean_time: number
  calls: number
  total_time: number
}

interface IndexSuggestion {
  tableName: string
  columns: string[]
  type: 'btree' | 'hash' | 'gin' | 'gist'
  reason: string
  estimatedImpact: 'high' | 'medium' | 'low'
}

class DatabaseOptimizer {
  private readonly indexesFile: string
  private slowQueries: SlowQuery[] = []
  private suggestions: IndexSuggestion[] = []

  constructor() {
    this.indexesFile = join(process.cwd(), 'database-optimizations.sql')
  }

  async runOptimization() {
    console.log('🔧 Starting Database Optimization...')

    try {
      await this.analyzeQueries()
      await this.checkExistingIndexes()
      this.generateSuggestions()
      await this.createOptimalIndexes()
      this.saveOptimizations()

      console.log('✅ Database optimization completed successfully')
    } catch (error) {
      console.error('❌ Error during optimization:', error)
      process.exit(1)
    }
  }

  private async analyzeQueries() {
    console.log('🔍 Analyzing slow queries...')

    try {
      // Check if pg_stat_statements is enabled
      const extensionCheck = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM pg_extension 
        WHERE extname = 'pg_stat_statements'
      `)

      const extensionCheckRows = extensionCheck as unknown as any[]
      const hasExtension = extensionCheckRows[0]?.count > 0

      if (!hasExtension) {
        console.log('⚠️  pg_stat_statements extension not found. Installing...')
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`)
      }

      // Get slow queries
      const slowQueries = await db.execute(sql`
        SELECT 
          query,
          mean_exec_time as mean_time,
          calls,
          total_exec_time as total_time
        FROM pg_stat_statements 
        WHERE mean_exec_time > 100 
          AND calls > 5
        ORDER BY mean_exec_time DESC 
        LIMIT 20
      `)

      this.slowQueries = (slowQueries as unknown as any[]).map((row: any) => ({
        query: row.query,
        mean_time: Math.round(row.mean_time * 100) / 100,
        calls: row.calls,
        total_time: Math.round(row.total_time * 100) / 100,
      }))

      if (this.slowQueries.length > 0) {
        console.log(`🐌 Found ${this.slowQueries.length} slow queries:`)
        this.slowQueries.forEach((q, i) => {
          console.log(
            `  ${i + 1}. ${q.query.substring(0, 80)}... (${q.mean_time}ms avg, ${q.calls} calls)`
          )
        })
      } else {
        console.log('✅ No slow queries found')
      }
    } catch (error) {
      console.log('⚠️  Could not analyze slow queries (insufficient permissions?):', error)
    }
  }

  private async checkExistingIndexes() {
    console.log('📋 Checking existing indexes...')

    try {
      const existingIndexes = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
        ORDER BY tablename, indexname
      `)

      console.log(`📊 Found ${(existingIndexes as unknown as any[]).length} existing indexes`)
    } catch (error) {
      console.error('❌ Error checking existing indexes:', error)
    }
  }

  private generateSuggestions() {
    console.log('💡 Generating optimization suggestions...')

    // Common table patterns that need indexes
    const commonPatterns = [
      {
        pattern: /todo.*owner_id/i,
        tableName: 'todo',
        columns: ['owner_id'],
        reason: 'Frequent filtering by user ownership',
        estimatedImpact: 'high' as const,
      },
      {
        pattern: /todo.*created_at.*desc/i,
        tableName: 'todo',
        columns: ['owner_id', 'created_at'],
        reason: 'User todos sorted by creation date',
        estimatedImpact: 'high' as const,
      },
      {
        pattern: /organization.*stripe_subscription_status/i,
        tableName: 'organization',
        columns: ['stripe_subscription_status'],
        reason: 'Frequent subscription status checks',
        estimatedImpact: 'medium' as const,
      },
      {
        pattern: /user.*email/i,
        tableName: 'user',
        columns: ['email'],
        reason: 'User authentication lookups',
        estimatedImpact: 'high' as const,
      },
      {
        pattern: /session.*user_id.*expires_at/i,
        tableName: 'session',
        columns: ['user_id', 'expires_at'],
        reason: 'Session validation and cleanup',
        estimatedImpact: 'high' as const,
      },
    ]

    // Analyze slow queries for patterns
    this.slowQueries.forEach((query) => {
      commonPatterns.forEach((pattern) => {
        if (pattern.pattern.test(query.query)) {
          const existingSuggestion = this.suggestions.find(
            (s) =>
              s.tableName === pattern.tableName && s.columns.join(',') === pattern.columns.join(',')
          )

          if (!existingSuggestion) {
            this.suggestions.push({
              tableName: pattern.tableName,
              columns: pattern.columns,
              type: 'btree',
              reason: pattern.reason,
              estimatedImpact: pattern.estimatedImpact,
            })
          }
        }
      })
    })

    // Add generic suggestions based on common table structures
    const genericSuggestions: IndexSuggestion[] = [
      {
        tableName: 'todo',
        columns: ['completed'],
        reason: 'Filtering completed vs active todos',
        estimatedImpact: 'medium',
        type: 'btree',
      },
      {
        tableName: 'organization',
        columns: ['name'],
        reason: 'Organization name searches',
        estimatedImpact: 'low',
        type: 'btree',
      },
    ]

    genericSuggestions.forEach((suggestion) => {
      const existing = this.suggestions.find(
        (s) =>
          s.tableName === suggestion.tableName &&
          s.columns.join(',') === suggestion.columns.join(',')
      )

      if (!existing) {
        this.suggestions.push(suggestion)
      }
    })

    if (this.suggestions.length > 0) {
      console.log(`💡 Generated ${this.suggestions.length} index suggestions:`)
      this.suggestions.forEach((s, i) => {
        console.log(
          `  ${i + 1}. ${s.tableName}(${s.columns.join(', ')}) - ${s.reason} [${s.estimatedImpact} impact]`
        )
      })
    } else {
      console.log('✅ No additional index suggestions')
    }
  }

  private async createOptimalIndexes() {
    console.log('🏗️  Creating optimal indexes...')

    const indexesToCreate = this.suggestions.filter(
      (s) => s.estimatedImpact === 'high' || s.estimatedImpact === 'medium'
    )

    for (const suggestion of indexesToCreate) {
      try {
        const indexName = `idx_${suggestion.tableName}_${suggestion.columns.join('_')}`
        const columnsDefinition = suggestion.columns.join(', ')

        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS ${sql.raw(indexName)} 
          ON ${sql.raw(suggestion.tableName)}(${sql.raw(columnsDefinition)})
        `)

        console.log(`✅ Created index: ${indexName}`)
      } catch (error) {
        console.error(
          `❌ Failed to create index for ${suggestion.tableName}(${suggestion.columns.join(', ')}):`,
          error
        )
      }
    }
  }

  private saveOptimizations() {
    console.log('💾 Saving optimization report...')

    const report = {
      timestamp: new Date().toISOString(),
      slowQueries: this.slowQueries,
      suggestions: this.suggestions,
      appliedIndexes: this.suggestions.filter((s) => s.estimatedImpact !== 'low'),
      sqlCommands: this.generateSQLCommands(),
    }

    // Save JSON report
    const jsonReport = JSON.stringify(report, null, 2)
    writeFileSync(this.indexesFile.replace('.sql', '.json'), jsonReport)

    // Save SQL commands
    const sqlCommands = this.generateSQLCommands()
    writeFileSync(this.indexesFile, sqlCommands)

    console.log(`📄 Optimization report saved to ${this.indexesFile}`)
    console.log(`📄 SQL commands saved to ${this.indexesFile}`)

    this.displaySummary()
  }

  private generateSQLCommands(): string {
    let sql = `-- Database Optimization SQL Commands
-- Generated on ${new Date().toISOString()}

-- Indexes for high-impact tables
`

    this.suggestions
      .filter((s) => s.estimatedImpact === 'high' || s.estimatedImpact === 'medium')
      .forEach((suggestion) => {
        const indexName = `idx_${suggestion.tableName}_${suggestion.columns.join('_')}`
        const columnsDefinition = suggestion.columns.join(', ')

        sql += `
-- ${suggestion.reason} [${suggestion.estimatedImpact} impact]
CREATE INDEX IF NOT EXISTS ${indexName} ON ${suggestion.tableName}(${columnsDefinition});
`
      })

    sql += `
-- Optimization completed. Consider running ANALYZE to update statistics:
ANALYZE;

-- Monitor query performance after optimization:
-- SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
`

    return sql
  }

  private displaySummary() {
    console.log('\n📊 Database Optimization Summary:')
    console.log('═'.repeat(50))
    console.log(`Slow Queries Found: ${this.slowQueries.length}`)
    console.log(`Index Suggestions Generated: ${this.suggestions.length}`)
    console.log(
      `High Impact Indexes: ${this.suggestions.filter((s) => s.estimatedImpact === 'high').length}`
    )
    console.log(
      `Medium Impact Indexes: ${this.suggestions.filter((s) => s.estimatedImpact === 'medium').length}`
    )
    console.log(
      `Low Impact Indexes: ${this.suggestions.filter((s) => s.estimatedImpact === 'low').length}`
    )

    if (this.slowQueries.length > 0) {
      const totalSlowTime = this.slowQueries.reduce((sum, q) => sum + q.total_time, 0)
      console.log(`Total Slow Query Time: ${Math.round(totalSlowTime * 100) / 100}s`)
    }

    console.log('═'.repeat(50))
    console.log('\n💡 Next Steps:')
    console.log('1. Monitor query performance after index creation')
    console.log('2. Run ANALYZE to update table statistics')
    console.log('3. Consider connection pooling with PgBouncer')
    console.log('4. Set up read replicas for heavy read workloads')
  }

  // Method to analyze specific tables
  async analyzeTable(tableName: string) {
    console.log(`🔍 Analyzing table: ${tableName}`)

    try {
      const tableStats = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE tablename = ${tableName}
      `)

      const tableStatsRows = tableStats as unknown as any[]
      if (tableStatsRows.length > 0) {
        const stats = tableStatsRows[0]
        console.log(`📊 Table Statistics for ${tableName}:`)
        console.log(`  Live tuples: ${stats.live_tuples}`)
        console.log(`  Dead tuples: ${stats.dead_tuples}`)
        console.log(`  Total operations: ${stats.inserts + stats.updates + stats.deletes}`)

        if (stats.dead_tuples > stats.live_tuples * 0.1) {
          console.log('⚠️  High dead tuple ratio - consider VACUUM')
        }
      }
    } catch (error) {
      console.error(`❌ Error analyzing table ${tableName}:`, error)
    }
  }
}

// CLI interface
const args = process.argv.slice(2)

if (args.includes('--table') && args[1]) {
  const optimizer = new DatabaseOptimizer()
  optimizer.analyzeTable(args[1])
} else {
  const optimizer = new DatabaseOptimizer()
  optimizer.runOptimization()
}
