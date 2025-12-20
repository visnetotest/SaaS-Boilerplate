// =============================================================================
// AUTHENTICATION SERVICE MICROSERVICE
// =============================================================================

import bcrypt from 'bcryptjs'
import compression from 'compression'
import cors from 'cors'
import crypto from 'crypto'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'

// =============================================================================
// INTERFACES
// =============================================================================

interface User {
  id: string
  email: string
  password: string
  name: string
  role: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

interface LoginRequest {
  email: string
  password: string
}

interface RegisterRequest {
  email: string
  password: string
  name: string
  role?: string
}

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

const app = express()
const PORT = process.env.PORT || 3003
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12')

// In-memory user database (in production, use PostgreSQL)
const users = new Map<string, User>()
const refreshTokens = new Map<string, { userId: string; expiresAt: Date }>()

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(helmet())
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  })
)

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP' },
})
app.use('/api/', limiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(compression())

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const generateTokens = (userId: string): AuthTokens => {
  const accessToken = jwt.sign({ userId, type: 'access' }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions)

  const refreshToken = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  } as jwt.SignOptions)

  const expiresInSeconds = 24 * 60 * 60 // 24 hours

  // Store refresh token
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

  refreshTokens.set(refreshToken, {
    userId,
    expiresAt,
  })

  return {
    accessToken,
    refreshToken,
    expiresIn: expiresInSeconds,
  }
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    version: '1.0.0',
    uptime: process.uptime(),
  })
})

// =============================================================================
// API ROUTES
// =============================================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role = 'user' }: RegisterRequest = req.body

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' })
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // Create user
    const user: User = {
      id: crypto.randomUUID(),
      email,
      password: hashedPassword,
      name,
      role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    users.set(user.id, user)

    // Generate tokens
    const tokens = generateTokens(user.id)

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      tokens,
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Registration failed' })
    return
  }
})

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password }: LoginRequest = req.body

    // Validate input
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    // Find user
    const user = Array.from(users.values()).find((u) => u.email === email)
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Update last login
    user.lastLoginAt = new Date()
    user.updatedAt = new Date()

    // Generate tokens
    const tokens = generateTokens(user.id)

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
      },
      tokens,
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
    return
  }
})

// =============================================================================
// START SERVER
// =============================================================================

async function startServer() {
  try {
    // Create sample admin user for testing
    const adminPassword = await bcrypt.hash('admin123', BCRYPT_ROUNDS)
    const adminUser: User = {
      id: crypto.randomUUID(),
      email: 'admin@example.com',
      password: adminPassword,
      name: 'System Administrator',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    users.set(adminUser.id, adminUser)

    app.listen(PORT, () => {
      console.log(`🚀 Authentication Service running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`)
      console.log(`👤 Admin user created: admin@example.com / admin123`)
    })
  } catch (error) {
    console.error('Failed to start Authentication Service:', error)
    process.exit(1)
  }
}

startServer()
