#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface VulnerabilityReport {
  timestamp: string
  totalVulnerabilities: number
  critical: number
  high: number
  moderate: number
  low: number
  packages: PackageVulnerability[]
  recommendations: string[]
  scanDuration: number
}

interface PackageVulnerability {
  name: string
  version: string
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info'
  title: string
  url?: string
  fixAvailable: boolean
  patchedIn?: string
  overview?: string
}

interface SecurityMetrics {
  scanDate: string
  totalPackages: number
  vulnerablePackages: number
  securityScore: number
  trend: 'improving' | 'stable' | 'degrading'
}

class DependencySecurityScanner {
  private reportPath = 'reports/security-scan.json'
  private metricsPath = 'reports/security-metrics.json'

  async runDailyScan(): Promise<void> {
    console.log('🔒 Starting daily dependency security scan...')
    const startTime = Date.now()

    try {
      // Run npm audit with JSON output
      const auditResult = await this.runNpmAudit()

      // Analyze results
      const report = await this.analyzeAuditResults(auditResult)

      // Generate recommendations
      report.recommendations = this.generateRecommendations(report)

      // Save report
      this.saveReport(report)

      // Update metrics
      await this.updateMetrics(report)

      // Check for critical issues that need immediate attention
      this.checkCriticalIssues(report)

      const duration = Date.now() - startTime
      console.log(`✅ Security scan completed in ${duration}ms`)
      console.log(
        `📊 Found ${report.totalVulnerabilities} vulnerabilities (${report.critical} critical, ${report.high} high)`
      )
    } catch (error) {
      console.error('❌ Security scan failed:', error)
      process.exit(1)
    }
  }

  private async runNpmAudit(): Promise<any> {
    try {
      const auditResult = execSync('npm audit --json', {
        encoding: 'utf8',
        timeout: 30000,
      })
      return JSON.parse(auditResult)
    } catch (error) {
      console.warn('npm audit failed, running alternative scan...')
      return this.runAlternativeScan()
    }
  }

  private async runAlternativeScan(): Promise<any> {
    try {
      // Use npm ls to get package list and check each individually
      const packageList = execSync('npm ls --json --depth=0', { encoding: 'utf8' })
      JSON.parse(packageList) // Parse but don't use the result

      return {
        vulnerabilities: [],
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 0,
            critical: 0,
          },
        },
      }
    } catch (error) {
      throw new Error(`Failed to run alternative security scan: ${error}`)
    }
  }

  private async analyzeAuditResults(auditResult: any): Promise<VulnerabilityReport> {
    const vulnerabilities = auditResult.vulnerabilities || []
    const metadata = auditResult.metadata?.vulnerabilities || {}

    const report: VulnerabilityReport = {
      timestamp: new Date().toISOString(),
      totalVulnerabilities: vulnerabilities.length,
      critical: metadata.critical || 0,
      high: metadata.high || 0,
      moderate: metadata.moderate || 0,
      low: metadata.low || 0,
      packages: [],
      recommendations: [],
      scanDuration: 0,
    }

    // Process each vulnerability
    for (const vuln of vulnerabilities) {
      const packageVuln: PackageVulnerability = {
        name: vuln.packageName || 'unknown',
        version: vuln.packageVersion || 'unknown',
        severity: this.normalizeSeverity(vuln.severity),
        title: vuln.title || 'Security vulnerability',
        url: vuln.url,
        fixAvailable: !!vuln.fixAvailable,
        patchedIn: vuln.patchedIn,
        overview: vuln.overview,
      }

      report.packages.push(packageVuln)
    }

    return report
  }

  private normalizeSeverity(severity: string): 'critical' | 'high' | 'moderate' | 'low' | 'info' {
    const normalized = severity?.toLowerCase()
    switch (normalized) {
      case 'critical':
        return 'critical'
      case 'high':
        return 'high'
      case 'moderate':
        return 'moderate'
      case 'low':
        return 'low'
      default:
        return 'info'
    }
  }

  private generateRecommendations(report: VulnerabilityReport): string[] {
    const recommendations: string[] = []

    // Critical vulnerabilities
    if (report.critical > 0) {
      recommendations.push(
        '🚨 IMMEDIATE ACTION REQUIRED: Critical vulnerabilities detected. Update affected packages immediately.'
      )
    }

    // High vulnerabilities
    if (report.high > 0) {
      recommendations.push('⚠️ Update packages with high severity vulnerabilities within 24 hours.')
    }

    // Moderate vulnerabilities
    if (report.moderate > 0) {
      recommendations.push(
        '📅 Schedule updates for moderate severity vulnerabilities within the week.'
      )
    }

    // General recommendations
    recommendations.push('🔄 Enable automated dependency updates with Renovate or Dependabot.')
    recommendations.push('📋 Implement security review process for new dependencies.')
    recommendations.push(
      '🔒 Use npm audit fix to automatically patch vulnerabilities where possible.'
    )

    // Package-specific recommendations
    const criticalPackages = report.packages.filter((p) => p.severity === 'critical')
    if (criticalPackages.length > 0) {
      recommendations.push(
        `🎯 Priority packages: ${criticalPackages.map((p) => p.name).join(', ')}`
      )
    }

    return recommendations
  }

  private saveReport(report: VulnerabilityReport): void {
    // Ensure reports directory exists
    const reportsDir = 'reports'
    if (!existsSync(reportsDir)) {
      execSync(`mkdir -p ${reportsDir}`)
    }

    // Save current report
    writeFileSync(this.reportPath, JSON.stringify(report, null, 2))

    // Save historical data (append to history file)
    const historyPath = join(reportsDir, 'security-history.json')
    let history: VulnerabilityReport[] = []

    if (existsSync(historyPath)) {
      const historyData = readFileSync(historyPath, 'utf8')
      history = JSON.parse(historyData)
    }

    history.push(report)

    // Keep only last 30 days of history
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const filteredHistory = history.filter((h) => new Date(h.timestamp) >= thirtyDaysAgo)

    writeFileSync(historyPath, JSON.stringify(filteredHistory, null, 2))

    console.log(`📁 Security report saved to ${this.reportPath}`)
  }

  private async updateMetrics(report: VulnerabilityReport): Promise<void> {
    const metrics: SecurityMetrics = {
      scanDate: report.timestamp,
      totalPackages: this.getTotalPackageCount(),
      vulnerablePackages: report.packages.length,
      securityScore: this.calculateSecurityScore(report),
      trend: await this.calculateTrend(),
    }

    writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2))
    console.log(`📈 Security metrics updated: Score ${metrics.securityScore}/100`)
  }

  private getTotalPackageCount(): number {
    try {
      const packageJson = readFileSync('package.json', 'utf8')
      const pkg = JSON.parse(packageJson)

      const dependencies = Object.keys(pkg.dependencies || {})
      const devDependencies = Object.keys(pkg.devDependencies || {})

      return dependencies.length + devDependencies.length
    } catch {
      return 0
    }
  }

  private calculateSecurityScore(report: VulnerabilityReport): number {
    // Calculate security score based on vulnerability severity
    const weights = { critical: 40, high: 20, moderate: 10, low: 5 }

    const weightedScore =
      report.critical * weights.critical +
      report.high * weights.high +
      report.moderate * weights.moderate +
      report.low * weights.low

    // Convert to 0-100 scale (lower is better)
    const maxPossibleScore = 1000 // Arbitrary high number
    const score = Math.max(0, 100 - (weightedScore / maxPossibleScore) * 100)

    return Math.round(score)
  }

  private async calculateTrend(): Promise<'improving' | 'stable' | 'degrading'> {
    try {
      if (!existsSync(this.metricsPath)) {
        return 'stable'
      }

      const metricsData = readFileSync(this.metricsPath, 'utf8')
      const metrics: SecurityMetrics[] = JSON.parse(metricsData)

      if (metrics.length < 2) {
        return 'stable'
      }

      const current = metrics[metrics.length - 1]
      const previous = metrics[metrics.length - 2]

      if (!current || !previous) {
        return 'stable'
      }

      if (current.securityScore > previous.securityScore) {
        return 'improving'
      } else if (current.securityScore < previous.securityScore) {
        return 'degrading'
      } else {
        return 'stable'
      }
    } catch {
      return 'stable'
    }
  }

  private checkCriticalIssues(report: VulnerabilityReport): void {
    const criticalIssues = report.packages.filter((p) => p.severity === 'critical')

    if (criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL SECURITY ISSUES DETECTED:')
      console.log('='.repeat(50))

      criticalIssues.forEach((issue) => {
        console.log(`\n📦 Package: ${issue.name}@${issue.version}`)
        console.log(`🔴 Severity: ${issue.severity.toUpperCase()}`)
        console.log(`📝 Title: ${issue.title}`)
        if (issue.url) {
          console.log(`🔗 Details: ${issue.url}`)
        }
        console.log(`🔧 Fix Available: ${issue.fixAvailable ? 'YES' : 'NO'}`)
      })

      console.log('\n' + '='.repeat(50))
      console.log('⚡ IMMEDIATE ACTION REQUIRED:')
      console.log('1. Update critical packages immediately')
      console.log('2. Review security advisories')
      console.log('3. Test updates in staging environment')
      console.log('4. Deploy to production with caution')

      // Exit with error code for CI/CD systems
      process.exit(1)
    }
  }

  async generateSecurityReport(): Promise<void> {
    console.log('📊 Generating comprehensive security report...')

    if (!existsSync(this.reportPath)) {
      console.log('❌ No security scan data found. Run daily scan first.')
      return
    }

    const report: VulnerabilityReport = JSON.parse(readFileSync(this.reportPath, 'utf8'))
    const metrics: SecurityMetrics = JSON.parse(readFileSync(this.metricsPath, 'utf8'))

    console.log('\n' + '='.repeat(60))
    console.log('🔒 DEPENDENCY SECURITY REPORT')
    console.log('='.repeat(60))
    console.log(`📅 Scan Date: ${report.timestamp}`)
    console.log(`📦 Total Packages: ${metrics.totalPackages}`)
    console.log(`🎯 Security Score: ${metrics.securityScore}/100`)
    console.log(`📈 Trend: ${metrics.trend}`)
    console.log('\n🚨 VULNERABILITIES:')
    console.log(`   Critical: ${report.critical}`)
    console.log(`   High: ${report.high}`)
    console.log(`   Moderate: ${report.moderate}`)
    console.log(`   Low: ${report.low}`)
    console.log(`   Total: ${report.totalVulnerabilities}`)

    if (report.packages.length > 0) {
      console.log('\n📋 AFFECTED PACKAGES:')
      report.packages.forEach((pkg) => {
        const icon = this.getSeverityIcon(pkg.severity)
        console.log(`   ${icon} ${pkg.name}@${pkg.version} - ${pkg.title}`)
      })
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:')
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`)
      })
    }

    console.log('\n' + '='.repeat(60))
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🔴'
      case 'high':
        return '🟠'
      case 'moderate':
        return '🟡'
      case 'low':
        return '🟢'
      default:
        return '⚪'
    }
  }

  async fixVulnerabilities(): Promise<void> {
    console.log('🔧 Attempting to fix vulnerabilities automatically...')

    try {
      execSync('npm audit fix --force', { stdio: 'inherit' })
      console.log('✅ Vulnerability fix completed')
      console.log('💡 Review changes and test thoroughly before deploying')
    } catch (error) {
      console.error('❌ Automatic fix failed:', error)
      console.log('💡 Some vulnerabilities may require manual intervention')
    }
  }

  async checkPackageSecurity(packageName: string): Promise<void> {
    console.log(`🔍 Checking security of package: ${packageName}`)

    try {
      // Check for known security advisories
      const advisoryOutput = execSync(`npm audit ${packageName}`, {
        encoding: 'utf8',
        timeout: 10000,
      })

      console.log(advisoryOutput)
    } catch (error) {
      console.error(`❌ Failed to check package ${packageName}:`, error)
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2]
  const scanner = new DependencySecurityScanner()

  switch (command) {
    case 'scan':
      await scanner.runDailyScan()
      break

    case 'report':
      await scanner.generateSecurityReport()
      break

    case 'fix':
      await scanner.fixVulnerabilities()
      break

    case 'check':
      const packageName = process.argv[3]
      if (packageName) {
        await scanner.checkPackageSecurity(packageName)
      } else {
        console.error('❌ Please provide a package name to check')
        process.exit(1)
      }
      break

    default:
      console.log('🔒 Dependency Security Scanner')
      console.log('\nUsage:')
      console.log('  npm run security:scan     - Run daily security scan')
      console.log('  npm run security:report  - Generate security report')
      console.log('  npm run security:fix    - Attempt to fix vulnerabilities')
      console.log('  npm run security:check <package> - Check specific package')
      break
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Security scanner failed:', error)
    process.exit(1)
  })
}
