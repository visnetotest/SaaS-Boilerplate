// SERVICE REGISTRY - STANDALONE MICROSERVICE
// =============================================================================

import compression from 'compression'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'

// Simple Service Registry implementation
class ServiceRegistry {
  private services: Map<string, any> = new Map()

  async register(service: any): Promise<void> {
    this.services.set(service.id, service)
  }

  async discover(name: string): Promise<any[]> {
    return Array.from(this.services.values()).filter(s => s.name === name)
  }

  async list(): Promise<any[]> {
    return Array.from(this.services.values())
  }

  async updateHealth(name: string, healthy: boolean): Promise<void> {
    // Simple health update implementation
    console.log(`Health updated for ${name}: ${healthy}`)
  }
}

// Create Express app
const app = express()
const PORT = process.env.SERVICE_REGISTRY_PORT || 3005

// Middleware
app.use(helmet())
app.use(compression())
app.use(cors())
app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
app.use(limiter)

// Service registry instance
const serviceRegistry = new ServiceRegistry()

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'service-registry' })
})

// Service registration
app.post('/api/services/register', async (req, res) => {
  try {
    const service = req.body
    await serviceRegistry.register(service)
    res.json({ success: true, service })
  } catch (error) {
    res.status(500).json({ error: 'Failed to register service' })
  }
})

// Service discovery
app.get('/api/services/:name', async (req, res) => {
  try {
    const services = await serviceRegistry.discover(req.params.name)
    res.json({ services })
  } catch (error) {
    res.status(500).json({ error: 'Failed to discover services' })
  }
})

// List all services
app.get('/api/services', async (req, res) => {
  try {
    const services = await serviceRegistry.list()
    res.json({ services })
  } catch (error) {
    res.status(500).json({ error: 'Failed to list services' })
  }
})

// Service health update
app.put('/api/services/:name/health', async (req, res) => {
  try {
    const { healthy } = req.body
    await serviceRegistry.updateHealth(req.params.name, healthy)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service health' })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Service Registry running on port ${PORT}`)
})

export default app