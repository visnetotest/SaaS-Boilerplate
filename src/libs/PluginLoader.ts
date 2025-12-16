import fs from 'fs/promises'
import path from 'path'

import {
  PluginCategory,
  PluginError,
  PluginLoader as IPluginLoader,
  PluginManifest,
  PluginValidationResult,
} from '@/types/plugin'

export class PluginLoader implements IPluginLoader {
  private readonly pluginDirectory: string
  private readonly manifestFile = 'plugin.json'
  private readonly packageJsonFile = 'package.json'

  constructor(pluginDirectory?: string) {
    this.pluginDirectory = pluginDirectory || path.join(process.cwd(), 'plugins')
  }

  async loadFromPath(pluginPath: string): Promise<PluginManifest> {
    try {
      const manifestPath = path.join(pluginPath, this.manifestFile)
      const packageJsonPath = path.join(pluginPath, this.packageJsonFile)

      // Check if manifest exists
      const manifestExists = await fs
        .access(manifestPath)
        .then(() => true)
        .catch(() => false)
      if (!manifestExists) {
        throw new Error(`Plugin manifest not found at ${manifestPath}`)
      }

      // Read manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8')
      let manifest: PluginManifest

      try {
        manifest = JSON.parse(manifestContent)
      } catch (error) {
        throw new Error(`Invalid JSON in plugin manifest: ${error}`)
      }

      // Merge with package.json if exists
      const packageExists = await fs
        .access(packageJsonPath)
        .then(() => true)
        .catch(() => false)
      if (packageExists) {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(packageContent)

        // Override manifest with package.json data
        manifest = {
          ...manifest,
          name: manifest.name || packageJson.name,
          version: manifest.version || packageJson.version,
          description: manifest.description || packageJson.description,
          author: manifest.author || packageJson.author,
          repository: manifest.repository || packageJson.repository,
          homepage: manifest.homepage || packageJson.homepage,
          dependencies: manifest.dependencies || packageJson.dependencies,
        }
      }

      // Validate manifest
      const validation = await this.validate(manifest)
      if (!validation.valid) {
        throw new Error(
          `Invalid plugin manifest: ${validation.errors.map((e) => e.message).join(', ')}`
        )
      }

      // Resolve relative paths
      manifest.main = this.resolvePath(pluginPath, manifest.main)
      if (manifest.server) {
        manifest.server = this.resolvePath(pluginPath, manifest.server)
      }
      if (manifest.client) {
        manifest.client = this.resolvePath(pluginPath, manifest.client)
      }

      console.log(`Plugin loaded from ${pluginPath}: ${manifest.name} v${manifest.version}`)
      return manifest
    } catch (error) {
      const pluginError: PluginError = {
        code: 'LOAD_FROM_PATH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { pluginPath },
      }
      throw pluginError
    }
  }

  async loadFromRegistry(name: string, version?: string): Promise<PluginManifest> {
    try {
      // In a real implementation, this would:
      // 1. Query plugin registry API
      // 2. Download plugin package
      // 3. Extract and load manifest

      // For now, return a mock implementation
      const mockManifest: PluginManifest = {
        name: name,
        slug: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        version: version || '1.0.0',
        description: `Plugin ${name} loaded from registry`,
        author: 'Registry Author',
        repository: `https://github.com/plugins/${name}`,
        homepage: `https://plugins.example.com/${name}`,
        category: PluginCategory.UTILITY,
        tags: [name, 'plugin'],
        dependencies: {},
        provides: [],
        requires: [],
        main: 'index.js',
        permissions: [],
        sandbox: {
          enabled: true,
          timeout: 30000,
          memory: 128 * 1024 * 1024,
        },
      }

      console.log(`Plugin loaded from registry: ${mockManifest.name} v${mockManifest.version}`)
      return mockManifest
    } catch (error) {
      const pluginError: PluginError = {
        code: 'LOAD_FROM_REGISTRY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { name, version },
      }
      throw pluginError
    }
  }

  async validate(manifest: PluginManifest): Promise<PluginValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields validation
    if (!manifest.name || typeof manifest.name !== 'string' || manifest.name.trim().length === 0) {
      errors.push('Plugin name is required and must be a non-empty string')
    }

    if (!manifest.slug || typeof manifest.slug !== 'string' || manifest.slug.trim().length === 0) {
      errors.push('Plugin slug is required and must be a non-empty string')
    } else if (!/^[a-z0-9-]+$/.test(manifest.slug)) {
      errors.push('Plugin slug must contain only lowercase letters, numbers, and hyphens')
    }

    if (
      !manifest.version ||
      typeof manifest.version !== 'string' ||
      manifest.version.trim().length === 0
    ) {
      errors.push('Plugin version is required and must be a non-empty string')
    } else if (!this.isValidVersion(manifest.version)) {
      errors.push('Plugin version must follow semantic versioning (e.g., 1.0.0)')
    }

    if (!manifest.main || typeof manifest.main !== 'string' || manifest.main.trim().length === 0) {
      errors.push('Plugin main entry point is required and must be a non-empty string')
    }

    // Optional fields validation
    if (manifest.homepage && !this.isValidUrl(manifest.homepage)) {
      warnings.push('Plugin homepage URL format is invalid')
    }

    if (manifest.repository && !this.isValidUrl(manifest.repository)) {
      warnings.push('Plugin repository URL format is invalid')
    }

    // Dependencies validation
    if (manifest.dependencies) {
      for (const [depName, version] of Object.entries(manifest.dependencies)) {
        if (!depName || typeof depName !== 'string') {
          errors.push(`Invalid dependency name: ${depName}`)
        }
        if (!version || typeof version !== 'string') {
          errors.push(`Invalid version for dependency ${depName}: ${version}`)
        }
      }
    }

    // Configuration validation
    if (manifest.config) {
      if (!this.isValidConfigSchema(manifest.config)) {
        errors.push('Plugin configuration schema is invalid')
      }
    }

    // Permissions validation
    if (manifest.permissions) {
      for (const permission of manifest.permissions) {
        if (!permission.resource || typeof permission.resource !== 'string') {
          errors.push(`Invalid permission resource: ${permission.resource}`)
        }
        if (
          !permission.actions ||
          !Array.isArray(permission.actions) ||
          permission.actions.length === 0
        ) {
          errors.push(`Invalid permission actions for ${permission.resource}`)
        }
      }
    }

    // Sandbox validation
    if (manifest.sandbox) {
      if (
        manifest.sandbox.timeout &&
        (typeof manifest.sandbox.timeout !== 'number' || manifest.sandbox.timeout < 1000)
      ) {
        warnings.push('Sandbox timeout should be at least 1000ms')
      }
      if (
        manifest.sandbox.memory &&
        (typeof manifest.sandbox.memory !== 'number' || manifest.sandbox.memory < 1024 * 1024)
      ) {
        warnings.push('Sandbox memory limit should be at least 1MB')
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.map((message) => ({
        field: 'validation',
        code: 'VALIDATION_ERROR',
        message,
        severity: 'error' as const,
      })),
      warnings: warnings.map((message) => ({
        field: 'validation',
        code: 'VALIDATION_WARNING',
        message,
        severity: 'warning' as const,
      })),
    }
  }

  async install(manifest: PluginManifest): Promise<void> {
    try {
      // In a real implementation, this would:
      // 1. Download plugin files
      // 2. Install dependencies
      // 3. Set up plugin directory
      // 4. Store manifest in database

      const installPath = path.join(this.pluginDirectory, manifest.slug)

      // Create plugin directory
      await fs.mkdir(installPath, { recursive: true })

      // Write manifest
      const manifestPath = path.join(installPath, this.manifestFile)
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

      // Create basic plugin structure
      await this.createPluginStructure(installPath, manifest)

      console.log(`Plugin installed: ${manifest.name} v${manifest.version} to ${installPath}`)
    } catch (error) {
      const pluginError: PluginError = {
        code: 'INSTALL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { manifest: manifest.name },
      }
      throw pluginError
    }
  }

  async uninstall(pluginId: string): Promise<void> {
    try {
      const pluginPath = path.join(this.pluginDirectory, pluginId)

      // Check if plugin exists
      const exists = await fs
        .access(pluginPath)
        .then(() => true)
        .catch(() => false)
      if (!exists) {
        throw new Error(`Plugin ${pluginId} not found at ${pluginPath}`)
      }

      // Remove plugin directory
      await fs.rm(pluginPath, { recursive: true, force: true })

      console.log(`Plugin uninstalled: ${pluginId}`)
    } catch (error) {
      const pluginError: PluginError = {
        code: 'UNINSTALL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { pluginId },
      }
      throw pluginError
    }
  }

  async update(pluginId: string, version?: string): Promise<void> {
    try {
      // In a real implementation, this would:
      // 1. Check for updates
      // 2. Download new version
      // 3. Backup current version
      // 4. Install new version
      // 5. Migrate data if needed

      console.log(`Plugin update initiated: ${pluginId} to ${version || 'latest'}`)

      // For now, just simulate the update process
      await new Promise((resolve) => setTimeout(resolve, 1000))

      console.log(`Plugin updated: ${pluginId}`)
    } catch (error) {
      const pluginError: PluginError = {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { pluginId, version },
      }
      throw pluginError
    }
  }

  async listInstalled(): Promise<string[]> {
    try {
      const exists = await fs
        .access(this.pluginDirectory)
        .then(() => true)
        .catch(() => false)
      if (!exists) {
        return []
      }

      const entries = await fs.readdir(this.pluginDirectory, { withFileTypes: true })
      const plugins: string[] = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(this.pluginDirectory, entry.name, this.manifestFile)
          const manifestExists = await fs
            .access(manifestPath)
            .then(() => true)
            .catch(() => false)

          if (manifestExists) {
            plugins.push(entry.name)
          }
        }
      }

      return plugins
    } catch (error) {
      const pluginError: PluginError = {
        code: 'LIST_INSTALLED_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { pluginDirectory: this.pluginDirectory },
      }
      throw pluginError
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private resolvePath(basePath: string, relativePath?: string): string {
    if (!relativePath) {
      return ''
    }

    if (path.isAbsolute(relativePath)) {
      throw new Error('Plugin paths must be relative to plugin directory')
    }

    return path.resolve(basePath, relativePath)
  }

  private isValidVersion(version: string): boolean {
    // Basic semantic version validation
    const parts = version.split('.')
    if (parts.length !== 3) return false

    for (const part of parts) {
      const num = parseInt(part.replace(/[^\d]/g, ''))
      if (isNaN(num)) return false
    }

    return true
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private isValidConfigSchema(config: any): boolean {
    if (!config || typeof config !== 'object') {
      return false
    }

    if (!config.type || config.type !== 'object') {
      return false
    }

    if (!config.properties || typeof config.properties !== 'object') {
      return false
    }

    return true
  }

  private async createPluginStructure(pluginPath: string, manifest: PluginManifest): Promise<void> {
    // Create basic directory structure
    const directories = ['src', 'dist', 'tests', 'docs']

    for (const dir of directories) {
      const dirPath = path.join(pluginPath, dir)
      await fs.mkdir(dirPath, { recursive: true })
    }

    // Create basic package.json if it doesn't exist
    const packageJsonPath = path.join(pluginPath, this.packageJsonFile)
    const packageExists = await fs
      .access(packageJsonPath)
      .then(() => true)
      .catch(() => false)

    if (!packageExists) {
      const packageJson = {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        main: manifest.main,
        author: manifest.author,
        repository: manifest.repository,
        homepage: manifest.homepage,
        keywords: manifest.tags,
        scripts: {
          build: 'echo "Build command would go here"',
          test: 'echo "Test command would go here"',
          dev: 'echo "Dev command would go here"',
        },
        dependencies: manifest.dependencies || {},
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0',
        },
      }

      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
    }

    // Create basic main file
    const mainFilePath = path.join(pluginPath, 'src', 'index.ts')
    const mainExists = await fs
      .access(mainFilePath)
      .then(() => true)
      .catch(() => false)

    if (!mainExists) {
      const mainContent = this.generateMainPluginCode(manifest)
      await fs.writeFile(mainFilePath, mainContent)
    }
  }

  private generateMainPluginCode(manifest: PluginManifest): string {
    return `
// Auto-generated plugin main file for ${manifest.name}
export interface PluginContext {
  config: Record<string, any>
  logger: {
    info: (message: string) => void
    warn: (message: string) => void
    error: (message: string) => void
  }
  storage: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
  }
}

export interface PluginExports {
  hello: () => string
  [key: string]: any
}

export async function initialize(context: PluginContext): Promise<void> {
  context.logger.info('Plugin ${manifest.name} initialized')
}

export async function cleanup(): Promise<void> {
  console.log('Plugin ${manifest.name} cleaned up')
}

export const exports: PluginExports = {
  hello: () => 'Hello from ${manifest.name} plugin!'
}

export default {
  initialize,
  cleanup,
  exports
}
`
  }
}

// =============================================================================
// PLUGIN CLI UTILITIES
// =============================================================================

export class PluginCLI {
  private static loader = new PluginLoader()

  static async create(pluginName: string): Promise<void> {
    try {
      const installPath = path.join(process.cwd(), 'plugins', pluginName)

      // Create plugin directory
      await fs.mkdir(installPath, { recursive: true })

      // Generate basic manifest
      const manifest: Partial<PluginManifest> = {
        name: pluginName,
        slug: pluginName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        version: '1.0.0',
        description: `Plugin ${pluginName}`,
        author: 'Plugin Author',
        category: PluginCategory.UTILITY,
        tags: [pluginName],
        main: 'src/index.js',
        permissions: [],
        sandbox: {
          enabled: true,
          timeout: 30000,
          memory: 128 * 1024 * 1024,
        },
      }

      await PluginCLI.loader.install(manifest as PluginManifest)

      console.log(`Plugin ${pluginName} created successfully!`)
      console.log(`Plugin location: ${installPath}`)
    } catch (error) {
      console.error('Failed to create plugin:', error)
      process.exit(1)
    }
  }

  static async install(packageName: string): Promise<void> {
    try {
      console.log(`Installing plugin: ${packageName}`)

      // This would typically download from a registry
      // For now, just simulate
      await new Promise((resolve) => setTimeout(resolve, 1000))

      console.log(`Plugin ${packageName} installed successfully!`)
    } catch (error) {
      console.error('Failed to install plugin:', error)
      process.exit(1)
    }
  }

  static async list(): Promise<void> {
    try {
      const loader = new PluginLoader()
      const plugins = await loader.listInstalled()

      if (plugins.length === 0) {
        console.log('No plugins installed.')
        return
      }

      console.log('Installed plugins:')
      for (const plugin of plugins) {
        console.log(`  - ${plugin}`)
      }
    } catch (error) {
      console.error('Failed to list plugins:', error)
      process.exit(1)
    }
  }

  static async validate(pluginPath: string): Promise<void> {
    try {
      const loader = new PluginLoader()
      const manifest = await loader.loadFromPath(pluginPath)
      const validation = await loader.validate(manifest)

      console.log(`Plugin validation for: ${manifest.name}`)

      if (validation.valid) {
        console.log('✅ Plugin manifest is valid')

        if (validation.warnings.length > 0) {
          console.log('\\nWarnings:')
          for (const warning of validation.warnings) {
            console.log(`  ⚠️  ${warning.message}`)
          }
        }
      } else {
        console.log('❌ Plugin manifest validation failed')
        console.log('\\nErrors:')
        for (const error of validation.errors) {
          console.log(`  🚫 ${error.message}`)
        }
        process.exit(1)
      }
    } catch (error) {
      console.error('Failed to validate plugin:', error)
      process.exit(1)
    }
  }
}
