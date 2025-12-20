// =============================================================================
// NOTIFICATION SERVICE MICROSERVICE
// =============================================================================

import compression from 'compression'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { createClient } from 'redis'

// =============================================================================
// INTERFACES
// =============================================================================

interface Notification {
  id: string
  userId: string
  type: 'email' | 'push' | 'sms' | 'in_app'
  title: string
  message: string
  data?: Record<string, any>
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  sentAt?: Date
  deliveredAt?: Date
  failedAt?: Date
  retryCount: number
  metadata?: {
    template?: string
    variables?: Record<string, any>
    trackingId?: string
  }
  createdAt: Date
  updatedAt: Date
}

interface CreateNotificationRequest {
  userId: string
  type: 'email' | 'push' | 'sms' | 'in_app'
  title: string
  message: string
  data?: Record<string, any>
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  scheduleFor?: Date
  metadata?: Notification['metadata']
}

interface SendSmsRequest {
  to: string
  message: string
  from?: string
}

interface SendPushRequest {
  userId: string
  title: string
  message: string
  data?: Record<string, any>
  priority?: 'low' | 'normal' | 'high'
}

interface NotificationTemplate {
  id: string
  name: string
  type: 'email' | 'sms' | 'push'
  subject?: string
  htmlContent?: string
  textContent?: string
  pushContent?: string
  variables: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// NOTIFICATION SERVICE CLASS
// =============================================================================

class NotificationService {
  private app: express.Application
  private redis: any
  private notifications: Map<string, Notification> = new Map()
  private templates: Map<string, NotificationTemplate> = new Map()
  private PORT: number
  private SENDGRID_API_KEY: string
  private PUSH_SERVICE_KEY?: string

  constructor() {
    this.app = express()
    this.PORT = parseInt(process.env.PORT || '3005')
    this.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || ''
    this.PUSH_SERVICE_KEY = process.env.PUSH_SERVICE_KEY

    this.initializeMiddleware()
    this.initializeRoutes()
    this.initializeDefaultTemplates()
  }

  private async initializeMiddleware() {
    this.app.use(helmet())
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
      })
    )

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200, // limit each IP to 200 requests per windowMs
      message: { error: 'Too many requests from this IP' },
    })
    this.app.use('/api/', limiter)

    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))
    this.app.use(compression())

    // Redis for caching and queue
    if (process.env.REDIS_URL) {
      this.redis = await createClient({ url: process.env.REDIS_URL })
      await this.redis.connect()
      console.log('🔄 Redis connected for notification caching')
    }
  }

  private initializeDefaultTemplates() {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'welcome_email',
        name: 'Welcome Email',
        type: 'email',
        subject: 'Welcome to {{companyName}}!',
        htmlContent: `
          <h1>Welcome {{userName}}!</h1>
          <p>Thank you for joining {{companyName}}. We're excited to have you on board.</p>
          <p>Click <a href="{{loginUrl}}">here</a> to get started.</p>
        `,
        variables: ['userName', 'companyName', 'loginUrl'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'password_reset',
        name: 'Password Reset',
        type: 'email',
        subject: 'Reset your password',
        htmlContent: `
          <h1>Password Reset Request</h1>
          <p>Hi {{userName}},</p>
          <p>We received a request to reset your password. Click the link below to reset it:</p>
          <p><a href="{{resetUrl}}">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
        `,
        variables: ['userName', 'resetUrl'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'account_suspended',
        name: 'Account Suspended',
        type: 'email',
        subject: 'Your account has been suspended',
        htmlContent: `
          <h1>Account Suspension</h1>
          <p>Hi {{userName}},</p>
          <p>Your account has been suspended due to: {{reason}}</p>
          <p>If you believe this is an error, please contact support.</p>
        `,
        variables: ['userName', 'reason'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    defaultTemplates.forEach((template) => {
      this.templates.set(template.id, template)
    })
  }

  private initializeRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'notification-service',
        version: '1.0.0',
        uptime: process.uptime(),
        metrics: {
          totalNotifications: this.notifications.size,
          pendingNotifications: Array.from(this.notifications.values()).filter(
            (n) => n.status === 'pending'
          ).length,
          failedNotifications: Array.from(this.notifications.values()).filter(
            (n) => n.status === 'failed'
          ).length,
          totalTemplates: this.templates.size,
        },
      })
    })

    // =============================================================================
    // NOTIFICATION MANAGEMENT ROUTES
    // =============================================================================

    // Create notification
    this.app.post('/api/notifications', async (req: express.Request, res: express.Response) => {
      try {
        const notificationReq: CreateNotificationRequest = req.body

        // Validate required fields
        if (
          !notificationReq.userId ||
          !notificationReq.type ||
          !notificationReq.title ||
          !notificationReq.message
        ) {
          return res.status(400).json({ error: 'userId, type, title, and message are required' })
        }

        const notification: Notification = {
          id: crypto.randomUUID(),
          userId: notificationReq.userId,
          type: notificationReq.type,
          title: notificationReq.title,
          message: notificationReq.message,
          data: notificationReq.data,
          priority: notificationReq.priority || 'normal',
          status: 'pending',
          retryCount: 0,
          metadata: notificationReq.metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        this.notifications.set(notification.id, notification)

        // Schedule notification if requested
        if (notificationReq.scheduleFor && notificationReq.scheduleFor > new Date()) {
          await this.scheduleNotification(notification, notificationReq.scheduleFor)
        } else {
          // Send immediately
          await this.sendNotification(notification)
        }

        res.status(201).json({ notification })
      } catch (error) {
        console.error('Create notification error:', error)
        res.status(500).json({ error: 'Failed to create notification' })
      }
    })

    // Get notifications for user
    this.app.get(
      '/api/notifications/user/:userId',
      async (req: express.Request, res: express.Response) => {
        try {
          const userId = req.params.userId
          const page = parseInt(req.query.page as string) || 1
          const limit = parseInt(req.query.limit as string) || 20
          const status = req.query.status as string
          const type = req.query.type as string

          let notifications = Array.from(this.notifications.values()).filter(
            (n) => n.userId === userId
          )

          // Apply filters
          if (status) {
            notifications = notifications.filter((n) => n.status === status)
          }
          if (type) {
            notifications = notifications.filter((n) => n.type === type)
          }

          // Sort by creation date (newest first)
          notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

          // Paginate
          const startIndex = (page - 1) * limit
          const endIndex = startIndex + limit
          const paginatedNotifications = notifications.slice(startIndex, endIndex)

          res.json({
            notifications: paginatedNotifications,
            pagination: {
              page,
              limit,
              total: notifications.length,
              totalPages: Math.ceil(notifications.length / limit),
              hasNext: endIndex < notifications.length,
              hasPrev: page > 1,
            },
          })
        } catch (error) {
          console.error('Get notifications error:', error)
          res.status(500).json({ error: 'Failed to get notifications' })
        }
      }
    )

    // Mark notification as read
    this.app.put(
      '/api/notifications/:id/read',
      async (req: express.Request, res: express.Response) => {
        try {
          const notificationId = req.params.id
          const notification = this.notifications.get(notificationId)

          if (!notification) {
            return res.status(404).json({ error: 'Notification not found' })
          }

          if (notification.status === 'delivered') {
            notification.status = 'read'
            notification.updatedAt = new Date()
          }

          res.json({ notification })
        } catch (error) {
          console.error('Mark notification read error:', error)
          res.status(500).json({ error: 'Failed to mark notification as read' })
        }
      }
    )

    // Delete notification
    this.app.delete(
      '/api/notifications/:id',
      async (req: express.Request, res: express.Response) => {
        try {
          const notificationId = req.params.id
          const notification = this.notifications.get(notificationId)

          if (!notification) {
            return res.status(404).json({ error: 'Notification not found' })
          }

          this.notifications.delete(notificationId)

          res.status(204).send()
        } catch (error) {
          console.error('Delete notification error:', error)
          res.status(500).json({ error: 'Failed to delete notification' })
        }
      }
    )

    // =============================================================================
    // BATCH NOTIFICATION ROUTES
    // =============================================================================

    // Send bulk notifications
    this.app.post(
      '/api/notifications/bulk',
      async (req: express.Request, res: express.Response) => {
        try {
          const { userIds, notification } = req.body

          if (!userIds || !Array.isArray(userIds) || !notification) {
            return res
              .status(400)
              .json({ error: 'userIds array and notification object are required' })
          }

          const notifications: Notification[] = []

          for (const userId of userIds) {
            const newNotification: Notification = {
              id: crypto.randomUUID(),
              userId,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              data: notification.data,
              priority: notification.priority || 'normal',
              status: 'pending',
              retryCount: 0,
              metadata: notification.metadata,
              createdAt: new Date(),
              updatedAt: new Date(),
            }

            this.notifications.set(newNotification.id, newNotification)
            notifications.push(newNotification)

            // Send notification asynchronously
            this.sendNotification(newNotification)
          }

          res.status(201).json({
            message: `Created ${notifications.length} notifications`,
            notifications,
          })
        } catch (error) {
          console.error('Bulk notification error:', error)
          res.status(500).json({ error: 'Failed to create bulk notifications' })
        }
      }
    )

    // =============================================================================
    // TEMPLATE MANAGEMENT ROUTES
    // =============================================================================

    // Get all templates
    this.app.get('/api/templates', async (req: express.Request, res: express.Response) => {
      try {
        const type = req.query.type as string
        let templates = Array.from(this.templates.values())

        if (type) {
          templates = templates.filter((t) => t.type === type)
        }

        res.json({ templates })
      } catch (error) {
        console.error('Get templates error:', error)
        res.status(500).json({ error: 'Failed to get templates' })
      }
    })

    // Create template
    this.app.post('/api/templates', async (req: express.Request, res: express.Response) => {
      try {
        const templateData = req.body

        const template: NotificationTemplate = {
          id: crypto.randomUUID(),
          name: templateData.name,
          type: templateData.type,
          subject: templateData.subject,
          htmlContent: templateData.htmlContent,
          textContent: templateData.textContent,
          pushContent: templateData.pushContent,
          variables: templateData.variables || [],
          isActive: templateData.isActive !== false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        this.templates.set(template.id, template)

        res.status(201).json({ template })
      } catch (error) {
        console.error('Create template error:', error)
        res.status(500).json({ error: 'Failed to create template' })
      }
    })

    // =============================================================================
    // ERROR HANDLING
    // =============================================================================

    this.app.use(
      (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('Unhandled error:', err)
        res.status(500).json({
          error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        })
      }
    )

    // 404 handler
    this.app.use('*', (req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'Route not found',
        availableEndpoints: [
          'GET /health',
          'POST /api/notifications',
          'GET /api/notifications/user/:userId',
          'PUT /api/notifications/:id/read',
          'DELETE /api/notifications/:id',
          'POST /api/notifications/bulk',
          'GET /api/templates',
          'POST /api/templates',
        ],
      })
    })
  }

  // =============================================================================
  // NOTIFICATION SENDING METHODS
  // =============================================================================

  private async sendNotification(notification: Notification): Promise<boolean> {
    try {
      notification.status = 'sent'
      notification.sentAt = new Date()
      notification.updatedAt = new Date()

      let success = false

      switch (notification.type) {
        case 'email':
          success = await this.sendEmail(notification)
          break
        case 'sms':
          success = await this.sendSms(notification)
          break
        case 'push':
          success = await this.sendPush(notification)
          break
        case 'in_app':
          success = await this.sendInApp(notification)
          break
      }

      if (success) {
        notification.status = 'delivered'
        notification.deliveredAt = new Date()
        notification.updatedAt = new Date()
      } else {
        notification.status = 'failed'
        notification.failedAt = new Date()
        notification.updatedAt = new Date()

        // Schedule retry if retry count < 3
        if (notification.retryCount < 3) {
          notification.retryCount++
          setTimeout(
            () => this.sendNotification(notification),
            5000 * Math.pow(2, notification.retryCount)
          )
        }
      }

      // Cache notification status
      if (this.redis) {
        await this.redis.setEx(
          `notification:${notification.id}`,
          86400,
          JSON.stringify(notification)
        )
      }

      return success
    } catch (error) {
      console.error('Send notification error:', error)
      notification.status = 'failed'
      notification.failedAt = new Date()
      notification.updatedAt = new Date()
      return false
    }
  }

  private async sendEmail(notification: Notification): Promise<boolean> {
    try {
      if (!this.SENDGRID_API_KEY) {
        console.warn('SendGrid API key not configured, simulating email send')
        return true
      }

      // In a real implementation, use SendGrid API
      console.log(`📧 Sending email to user ${notification.userId}: ${notification.title}`)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      return true
    } catch (error) {
      console.error('Send email error:', error)
      return false
    }
  }

  private async sendSms(notification: Notification): Promise<boolean> {
    try {
      console.log(`📱 Sending SMS to user ${notification.userId}: ${notification.title}`)

      // Simulate SMS send
      await new Promise((resolve) => setTimeout(resolve, 500))

      return true
    } catch (error) {
      console.error('Send SMS error:', error)
      return false
    }
  }

  private async sendPush(notification: Notification): Promise<boolean> {
    try {
      console.log(
        `📲 Sending push notification to user ${notification.userId}: ${notification.title}`
      )

      // In a real implementation, use Firebase Cloud Messaging or similar
      await new Promise((resolve) => setTimeout(resolve, 300))

      return true
    } catch (error) {
      console.error('Send push error:', error)
      return false
    }
  }

  private async sendInApp(notification: Notification): Promise<boolean> {
    try {
      console.log(
        `🔔 Creating in-app notification for user ${notification.userId}: ${notification.title}`
      )

      // Store in Redis for real-time delivery
      if (this.redis) {
        await this.redis.lpush(`notifications:${notification.userId}`, JSON.stringify(notification))
        await this.redis.expire(`notifications:${notification.userId}`, 86400) // 24 hours
      }

      return true
    } catch (error) {
      console.error('Send in-app error:', error)
      return false
    }
  }

  private async scheduleNotification(notification: Notification, scheduleFor: Date): Promise<void> {
    const delay = scheduleFor.getTime() - Date.now()

    if (delay > 0) {
      setTimeout(() => this.sendNotification(notification), delay)
      console.log(`⏰ Scheduled notification ${notification.id} for ${scheduleFor.toISOString()}`)
    } else {
      await this.sendNotification(notification)
    }
  }

  async start() {
    try {
      this.app.listen(this.PORT, () => {
        console.log(`🚀 Notification Service running on port ${this.PORT}`)
        console.log(`📊 Health check: http://localhost:${this.PORT}/health`)
        console.log(`📧 Notification endpoints: http://localhost:${this.PORT}/api/notifications`)
        console.log(`📝 Template endpoints: http://localhost:${this.PORT}/api/templates`)
        console.log(`📧 Email service: ${this.SENDGRID_API_KEY ? 'Configured' : 'Not configured'}`)
      })
    } catch (error) {
      console.error('Failed to start Notification Service:', error)
      process.exit(1)
    }
  }

  async stop() {
    if (this.redis) {
      await this.redis.quit()
    }
  }
}

// =============================================================================
// START SERVER
// =============================================================================

async function startNotificationService() {
  const notificationService = new NotificationService()
  await notificationService.start()

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully')
    await notificationService.stop()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully')
    await notificationService.stop()
    process.exit(0)
  })
}

startNotificationService()
