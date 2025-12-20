#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { performance } from 'perf_hooks'

interface PerformanceMetrics {
  timestamp: string
  buildTime: number
  bundleSize: {
    total: number
    compressed: number
    chunks: number
  }
  lighthouseScore: {
    performance: number
    accessibility: number
    bestPractices: number
    seo: number
  }
  firstContentfulPaint: number
  largestContentfulPaint: number
  timeToInteractive: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private buildStartTime: number = 0
  private metricsFile: string = join(process.cwd(), 'performance-metrics.json')

  constructor() {
    this.loadExistingMetrics()
    this.startBuild()
  }

  private loadExistingMetrics() {
    if (existsSync(this.metricsFile)) {
      try {
        const data = readFileSync(this.metricsFile, 'utf8')
        this.metrics = JSON.parse(data)
        console.log(`📊 Loaded ${this.metrics.length} existing metrics`)
      } catch (error) {
        console.log('⚠️  Could not load existing metrics, starting fresh')
        this.metrics = []
      }
    }
  }

  startBuild() {
    this.buildStartTime = performance.now()
    console.log('⏱️  Monitoring build performance...')

    // Set up exit handler to capture metrics when build completes
    process.on('exit', () => this.captureMetrics())
    process.on('SIGINT', () => {
      this.captureMetrics()
      process.exit(0)
    })
    process.on('SIGTERM', () => {
      this.captureMetrics()
      process.exit(0)
    })
  }

  private async captureMetrics() {
    const buildEndTime = performance.now()
    const buildTime = buildEndTime - this.buildStartTime

    console.log('📈 Capturing performance metrics...')

    const currentMetrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      buildTime: Math.round(buildTime),
      bundleSize: this.getBundleSize(),
      lighthouseScore: await this.getLighthouseScore(),
      firstContentfulPaint: 0, // Would be populated by Lighthouse
      largestContentfulPaint: 0, // Would be populated by Lighthouse
      timeToInteractive: 0, // Would be populated by Lighthouse
    }

    this.metrics.push(currentMetrics)
    this.saveMetrics()
    this.displayMetrics(currentMetrics)
    this.checkPerformanceThresholds(currentMetrics)
  }

  private getBundleSize() {
    try {
      const buildPath = join(process.cwd(), '.next')

      if (!existsSync(buildPath)) {
        return { total: 0, compressed: 0, chunks: 0 }
      }

      // Analyze static files
      const staticPath = join(buildPath, 'static')
      let totalSize = 0
      let chunksCount = 0

      if (existsSync(staticPath)) {
        const { execSync: exec } = require('child_process')
        try {
          const result = exec(`du -sb ${staticPath}`, { encoding: 'utf8' })
          totalSize = parseInt(result.split('\t')[0])
        } catch {
          totalSize = 0
        }
      }

      // Count chunks
      try {
        const jsPath = join(buildPath, 'static', 'chunks')
        if (existsSync(jsPath)) {
          const { execSync: exec } = require('child_process')
          const result = exec(`find ${jsPath} -name "*.js" | wc -l`, { encoding: 'utf8' })
          chunksCount = parseInt(result.trim())
        }
      } catch {
        chunksCount = 0
      }

      // Estimate compressed size (typical gzip compression ratio ~70%)
      const compressedSize = Math.round(totalSize * 0.3)

      return {
        total: Math.round(totalSize / 1024), // Convert to KB
        compressed: Math.round(compressedSize / 1024), // Convert to KB
        chunks: chunksCount,
      }
    } catch (error) {
      console.error('❌ Error analyzing bundle size:', error)
      return { total: 0, compressed: 0, chunks: 0 }
    }
  }

  private async getLighthouseScore() {
    try {
      // Check if Lighthouse CLI is available
      const { execSync: exec } = require('child_process')
      exec('which lighthouse', { stdio: 'ignore' })

      console.log('🔍 Running Lighthouse audit...')

      // Run Lighthouse programmatically
      const result = exec('lighthouse http://localhost:3000 --output=json --quiet', {
        encoding: 'utf8',
        timeout: 30000,
      })

      const lhr = JSON.parse(result)

      return {
        performance: Math.round(lhr.lhr.categories.performance.score * 100),
        accessibility: Math.round(lhr.lhr.categories.accessibility.score * 100),
        bestPractices: Math.round(lhr.lhr.categories['best-practices'].score * 100),
        seo: Math.round(lhr.lhr.categories.seo.score * 100),
      }
    } catch (error) {
      console.log('⚠️  Lighthouse audit failed (requires dev server running on :3000)')
      return {
        performance: 0,
        accessibility: 0,
        bestPractices: 0,
        seo: 0,
      }
    }
  }

  private saveMetrics() {
    try {
      writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2))
      console.log(`💾 Metrics saved to ${this.metricsFile}`)
    } catch (error) {
      console.error('❌ Error saving metrics:', error)
    }
  }

  private displayMetrics(metrics: PerformanceMetrics) {
    console.log('\n📊 Performance Report:')
    console.log('─'.repeat(50))
    console.log(`Build Time: ${metrics.buildTime}ms`)
    console.log(
      `Bundle Size: ${metrics.bundleSize.total}KB (${metrics.bundleSize.compressed}KB compressed)`
    )
    console.log(`Chunks: ${metrics.bundleSize.chunks}`)
    console.log(`Lighthouse Performance: ${metrics.lighthouseScore.performance}`)
    console.log(`Lighthouse Accessibility: ${metrics.lighthouseScore.accessibility}`)
    console.log(`Lighthouse Best Practices: ${metrics.lighthouseScore.bestPractices}`)
    console.log(`Lighthouse SEO: ${metrics.lighthouseScore.seo}`)
    console.log('─'.repeat(50))

    if (this.metrics.length > 1) {
      this.showTrends()
    }
  }

  private showTrends() {
    if (this.metrics.length < 2) return

    const latest = this.metrics[this.metrics.length - 1]!
    const previous = this.metrics[this.metrics.length - 2]!

    console.log('\n📈 Trends (compared to previous build):')
    console.log('─'.repeat(50))

    const buildTimeDiff = latest.buildTime - previous.buildTime
    const bundleSizeDiff = latest.bundleSize.total - previous.bundleSize.total
    const performanceDiff =
      latest.lighthouseScore.performance - previous.lighthouseScore.performance

    console.log(`Build Time: ${buildTimeDiff >= 0 ? '+' : ''}${buildTimeDiff}ms`)
    console.log(`Bundle Size: ${bundleSizeDiff >= 0 ? '+' : ''}${bundleSizeDiff}KB`)
    console.log(`Performance Score: ${performanceDiff >= 0 ? '+' : ''}${performanceDiff}`)
    console.log('─'.repeat(50))
  }

  private checkPerformanceThresholds(metrics: PerformanceMetrics) {
    console.log('\n🎯 Performance Thresholds Check:')
    console.log('─'.repeat(50))

    const thresholds = {
      buildTime: 30000, // 30 seconds
      bundleSize: 500, // 500KB
      performance: 90, // Lighthouse score
    }

    // Build time check
    if (metrics.buildTime > thresholds.buildTime) {
      console.log(
        `🐌 Build time exceeds threshold: ${metrics.buildTime}ms > ${thresholds.buildTime}ms`
      )
    } else {
      console.log(`✅ Build time within threshold: ${metrics.buildTime}ms`)
    }

    // Bundle size check
    if (metrics.bundleSize.total > thresholds.bundleSize) {
      console.log(
        `📦 Bundle size exceeds threshold: ${metrics.bundleSize.total}KB > ${thresholds.bundleSize}KB`
      )
    } else {
      console.log(`✅ Bundle size within threshold: ${metrics.bundleSize.total}KB`)
    }

    // Performance score check
    if (
      metrics.lighthouseScore.performance > 0 &&
      metrics.lighthouseScore.performance < thresholds.performance
    ) {
      console.log(
        `🎯 Performance score below threshold: ${metrics.lighthouseScore.performance} < ${thresholds.performance}`
      )
    } else if (metrics.lighthouseScore.performance > 0) {
      console.log(`✅ Performance score within threshold: ${metrics.lighthouseScore.performance}`)
    } else {
      console.log('⚠️  Performance score unavailable (run with dev server on :3000)')
    }

    console.log('─'.repeat(50))
  }

  // Method to generate performance report
  generateReport() {
    if (this.metrics.length === 0) {
      console.log('❌ No metrics available for report generation')
      return
    }

    const avgBuildTime = Math.round(
      this.metrics.reduce((sum, m) => sum + m.buildTime, 0) / this.metrics.length
    )

    const avgBundleSize = Math.round(
      this.metrics.reduce((sum, m) => sum + m.bundleSize.total, 0) / this.metrics.length
    )

    const avgPerformanceScore = Math.round(
      this.metrics.reduce((sum, m) => sum + m.lighthouseScore.performance, 0) /
        this.metrics.filter((m) => m.lighthouseScore.performance > 0).length
    )

    console.log('\n📋 Performance Summary Report:')
    console.log('═'.repeat(50))
    console.log(`Total Builds: ${this.metrics.length}`)
    console.log(`Average Build Time: ${avgBuildTime}ms`)
    console.log(`Average Bundle Size: ${avgBundleSize}KB`)
    console.log(`Average Performance Score: ${avgPerformanceScore}`)
    console.log('═'.repeat(50))
  }
}

// Check if running in build context
if (process.argv.includes('--report')) {
  const monitor = new PerformanceMonitor()
  monitor.generateReport()
} else {
  new PerformanceMonitor()
}
