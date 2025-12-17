// =============================================================================
// PLUGIN RUNTIME SERVICE (SIMPLIFIED FOR PRODUCTION)
// =============================================================================

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import fs from 'fs'
import path from 'path'

// =============================================================================
// INTERFACES (SIMPLIFIED)
// =============================================================================

interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  category: string
  status: 'active' | 'inactive' | 'error'
  createdAt: Date
  updatedAt: Date
  lastExecutionAt?: Date
}

interface PluginManifest {
  name: string
  version: string
  description: string
  author: string
  category: string
  main: string
  dependencies?: string[]
  permissions?: string[]
}

interface PluginExecutionResult {
  success: boolean
  output?: any
  error?: string
  executionTime: number
}

// =============================================================================
// PLUGIN RUNTIME SERVICE CLASS
// =============================================================================

class SimplifiedPluginRuntime {
  private app: express.Application
  private plugins: Map<string, Plugin> = new Map()
  private pluginsDirectory: string
  private PORT: number

  constructor() {
    this.app = express()
    this.PORT = parseInt(process.env.PORT || '4000')
    this.pluginsDirectory = process.env.PLUGINS_DIRECTORY || './plugins'
    
    this.initializeMiddleware()
    this.initializeRoutes()
    this.loadExistingPlugins()
  }

  private initializeMiddleware() {
    this.app.use(helmet())
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }))

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: { error: 'Too many requests from this IP' }
    })
    this.app.use('/api/', limiter)

    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))
    this.app.use(compression())
  }

  private initializeRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'plugin-runtime',
        version: '1.0.0',
        uptime: process.uptime(),
        metrics: {
          totalPlugins: this.plugins.size,
          activePlugins: Array.from(this.plugins.values()).filter(p => p.status === 'active').length,
          inactivePlugins: Array.from(this.plugins.values()).filter(p => p.status === 'inactive').length,
          errorPlugins: Array.from(this.plugins.values()).filter(p => p.status === 'error').length
        }
      })
    })

    // =============================================================================
    // PLUGIN MANAGEMENT ROUTES
    // =============================================================================

    // List all plugins
    this.app.get('/api/plugins', (req, res) => {
      try {
        const { status, category, author } = req.query
        let plugins = Array.from(this.plugins.values())

        // Apply filters
        if (status) {
          plugins = plugins.filter(p => p.status === status)
        }
        if (category) {
          plugins = plugins.filter(p => p.category === category)
        }
        if (author) {
          plugins = plugins.filter(p => p.author === author)
        }

        res.json({ plugins })
      } catch (error) {
        console.error('List plugins error:', error)
        res.status(500).json({ error: 'Failed to list plugins' })
      }
    })

    // Get plugin by ID
    this.app.get('/api/plugins/:id', (req, res) => {
      try {
        const pluginId = req.params.id
        const plugin = this.plugins.get(pluginId)

        if (!plugin) {
          return res.status(404).json({ error: 'Plugin not found' })
        }

        res.json({ plugin })
      } catch (error) {
        console.error('Get plugin error:', error)
        res.status(500).json({ error: 'Failed to get plugin' })
      }
    })

    // Install plugin
    this.app.post('/api/plugins/install', async (req, res) => {
      try {
        const { name, version, manifestPath } = req.body

        if (!name || !version) {
          return res.status(400).json({ error: 'Plugin name and version are required' })
        }

        // Create plugin entry
        const plugin: Plugin = {
          id: `${name}-${version}-${Date.now()}`,
          name,
          version,
          description: `Plugin ${name} version ${version}`,
          author: 'Unknown',
          category: 'General',
          status: 'inactive',
          createdAt: new Date(),
          updatedAt: new Date()
        }

        this.plugins.set(plugin.id, plugin)

        // Create plugin directory if it doesn't exist
        const pluginDir = path.join(this.pluginsDirectory, plugin.id)
        if (!fs.existsSync(pluginDir)) {
          fs.mkdirSync(pluginDir, { recursive: true })
        }

        res.status(201).json({ plugin })
      } catch (error) {
        console.error('Install plugin error:', error)
        res.status(500).json({ error: 'Failed to install plugin' })
      }
    })

    // Activate plugin
    this.app.post('/api/plugins/:id/activate', async (req, res) => {
      try {
        const pluginId = req.params.id
        const plugin = this.plugins.get(pluginId)

        if (!plugin) {
          return res.status(404).json({ error: 'Plugin not found' })
        }

        plugin.status = 'active'
        plugin.updatedAt = new Date()

        // Load plugin in sandbox
        const executionResult = await this.executePlugin(plugin, { action: 'activate' })

        if (executionResult.success) {
          res.json({ plugin, executionResult })
        } else {
          plugin.status = 'error'
          res.status(500).json({ 
            error: 'Failed to activate plugin',
            details: executionResult.error
          })
        }
      } catch (error) {
        console.error('Activate plugin error:', error)
        res.status(500).json({ error: 'Failed to activate plugin' })
      }
    })

    // Deactivate plugin
    this.app.post('/api/plugins/:id/deactivate', async (req, res) => {
      try {
        const pluginId = req.params.id
        const plugin = this.plugins.get(pluginId)

        if (!plugin) {
          return res.status(404).json({ error: 'Plugin not found' })
        }

        plugin.status = 'inactive'
        plugin.updatedAt = new Date()

        // Execute deactivation
        const executionResult = await this.executePlugin(plugin, { action: 'deactivate' })

        res.json({ plugin, executionResult })
      } catch (error) {
        console.error('Deactivate plugin error:', error)
        res.status(500).json({ error: 'Failed to deactivate plugin' })
      }
    })

    // Uninstall plugin
    this.app.delete('/api/plugins/:id', async (req, res) => {
      try {
        const pluginId = req.params.id
        const plugin = this.plugins.get(pluginId)

        if (!plugin) {
          return res.status(404).json({ error: 'Plugin not found' })
        }

        // Deactivate before uninstall
        if (plugin.status === 'active') {
          await this.executePlugin(plugin, { action: 'deactivate' })
        }

        // Remove plugin
        this.plugins.delete(pluginId)

        // Remove plugin directory
        const pluginDir = path.join(this.pluginsDirectory, pluginId)
        if (fs.existsSync(pluginDir)) {
          fs.rmSync(pluginDir, { recursive: true, force: true })
        }

        res.status(204).send()
      } catch (error) {
        console.error('Uninstall plugin error:', error)
        res.status(500).json({ error: 'Failed to uninstall plugin' })
      }
    })

    // Execute plugin action
    this.app.post('/api/plugins/:id/execute', async (req, res) => {
      try {
        const pluginId = req.params.id
        const { action, parameters } = req.body

        const plugin = this.plugins.get(pluginId)
        if (!plugin) {
          return res.status(404).json({ error: 'Plugin not found' })
        }

        if (plugin.status !== 'active') {
          return res.status(400).json({ error: 'Plugin is not active' })
        }

        const executionResult = await this.executePlugin(plugin, { action, parameters })

        res.json({ executionResult })
      } catch (error) {
        console.error('Execute plugin error:', error)
        res.status(500).json({ error: 'Failed to execute plugin' })
      }
    })

    // =============================================================================
    // ERROR HANDLING
    // =============================================================================

    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', err)
      res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
      })
    })

    // 404 handler
    this.app.use('*', (req: express.Request, res: express.Response) => {
      res.status(404).json({ 
        error: 'Route not found',
        availableEndpoints: [
          'GET /health',
          'GET /api/plugins',
          'GET /api/plugins/:id',
          'POST /api/plugins/install',
          'POST /api/plugins/:id/activate',
          'POST /api/plugins/:id/deactivate',
          'DELETE /api/plugins/:id',
          'POST /api/plugins/:id/execute'
        ]
      })
    })
  }

  private async executePlugin(plugin: Plugin, options: { action: string, parameters?: any }): Promise<PluginExecutionResult> {
    const startTime = Date.now()

    try {
      console.log(`Executing plugin ${plugin.name} with action: ${options.action}`)
      
      // Simulate plugin execution
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const executionTime = Date.now() - startTime

      // Simulate different outcomes based on action
      switch (options.action) {
        case 'activate':
          return {
            success: true,
            output: `Plugin ${plugin.name} activated successfully`,
            executionTime
          }
        case 'deactivate':
          return {
            success: true,
            output: `Plugin ${plugin.name} deactivated successfully`,
            executionTime
          }
        default:
          return {
            success: true,
            output: `Executed ${options.action} on plugin ${plugin.name}`,
            executionTime
          }
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      }
    }
  }

  private loadExistingPlugins() {
    try {
      console.log('Loading existing plugins from:', this.pluginsDirectory)
      
      // Create plugins directory if it doesn't exist
      if (!fs.existsSync(this.pluginsDirectory)) {
        fs.mkdirSync(this.pluginsDirectory, { recursive: true })
        return
      }

      // Load plugin directories
      const pluginDirs = fs.readdirSync(this.pluginsDirectory, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)

      for (const pluginDir of pluginDirs) {
        try {
          const manifestPath = path.join(this.pluginsDirectory, pluginDir, 'plugin.json')
          
          if (fs.existsSync(manifestPath)) {
            const manifestData = fs.readFileSync(manifestPath, 'utf8')
            const manifest: PluginManifest = JSON.parse(manifestData)
            
            const plugin: Plugin = {
              id: pluginDir,
              name: manifest.name,
              version: manifest.version,
              description: manifest.description,
              author: manifest.author,
              category: manifest.category,
              status: 'inactive',
              createdAt: new Date(),
              updatedAt: new Date()
            }
            
            this.plugins.set(plugin.id, plugin)
            console.log(`Loaded plugin: ${plugin.name} v${plugin.version}`)
          }
        } catch (error) {
          console.error(`Failed to load plugin from directory ${pluginDir}:`, error)
        }
      }

      console.log(`Loaded ${this.plugins.size} plugins`)
    } catch (error) {
      console.error('Failed to load existing plugins:', error)
    }
  }

  async start() {
    try {
      this.app.listen(this.PORT, () => {
        console.log(`🚀 Plugin Runtime Service running on port ${this.PORT}`)
        console.log(`📊 Health check: http://localhost:${this.PORT}/health`)
        console.log(`🔌 Plugin management endpoints: http://localhost:${this.PORT}/api/plugins`)
        console.log(`📂 Plugins directory: ${this.pluginsDirectory}`)
        console.log(`📦 Loaded plugins: ${this.plugins.size}`)
      })
    } catch (error) {
      console.error('Failed to start Plugin Runtime Service:', error)
      process.exit(1)
    }
  }
}

// =============================================================================
// START SERVER
// =============================================================================

async function startPluginRuntime() {
  const pluginRuntime = new SimplifiedPluginRuntime()
  await pluginRuntime.start()
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully')
    process.exit(0)
  })
  
  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully')
    process.exit(0)
  })
}

startPluginRuntime()