import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// The migration is automatically applied during the next database interaction,
// so there's no need to run it manually or restart the Next.js server.

// =============================================================================
// TENANT & ORGANIZATION MANAGEMENT
// =============================================================================

export const tenantSchema = pgTable(
  'tenant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    domain: varchar('domain', { length: 255 }),
    status: varchar('status', { length: 50 }).default('active').notNull(), // active, suspended, deleted
    settings: jsonb('settings').$type<Record<string, any>>(),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('tenant_slug_idx').on(table.slug),
    statusIdx: index('tenant_status_idx').on(table.status),
  })
)

export const organizationSchema = pgTable(
  'organization',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantSchema.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    logo: varchar('logo', { length: 500 }),
    website: varchar('website', { length: 500 }),

    // Stripe billing information
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripeSubscriptionPriceId: text('stripe_subscription_price_id'),
    stripeSubscriptionStatus: text('stripe_subscription_status'),
    stripeSubscriptionCurrentPeriodEnd: bigint('stripe_subscription_current_period_end', {
      mode: 'number',
    }),

    // Organization settings
    settings: jsonb('settings').$type<Record<string, any>>(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('organization_tenant_id_idx').on(table.tenantId),
    stripeCustomerIdIdx: uniqueIndex('organization_stripe_customer_id_idx').on(
      table.stripeCustomerId
    ),
  })
)

// =============================================================================
// USER MANAGEMENT & AUTHENTICATION
// =============================================================================

export const userSchema = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantSchema.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizationSchema.id, {
      onDelete: 'cascade',
    }),

    // Basic user information
    email: varchar('email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    avatar: varchar('avatar', { length: 500 }),

    // Authentication
    passwordHash: varchar('password_hash', { length: 255 }),
    emailVerified: boolean('email_verified').default(false),
    emailVerificationToken: varchar('email_verification_token', { length: 255 }),
    passwordResetToken: varchar('password_reset_token', { length: 255 }),
    passwordResetExpires: timestamp('password_reset_expires', { mode: 'date' }),

    // External authentication
    externalId: varchar('external_id', { length: 255 }), // For OAuth providers
    provider: varchar('provider', { length: 50 }), // google, github, etc.

    // User status and preferences
    status: varchar('status', { length: 50 }).default('active').notNull(), // active, inactive, suspended
    locale: varchar('locale', { length: 10 }).default('en'),
    timezone: varchar('timezone', { length: 50 }).default('UTC'),
    preferences: jsonb('preferences').$type<Record<string, any>>(),

    // Metadata
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    lastLoginAt: timestamp('last_login_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('user_tenant_id_idx').on(table.tenantId),
    organizationIdIdx: index('user_organization_id_idx').on(table.organizationId),
    emailIdx: uniqueIndex('user_email_idx').on(table.email),
    externalIdIdx: index('user_external_id_idx').on(table.externalId, table.provider),
    statusIdx: index('user_status_idx').on(table.status),
  })
)

export const roleSchema = pgTable(
  'role',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantSchema.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    permissions: jsonb('permissions').$type<string[]>().notNull(),
    isSystem: boolean('is_system').default(false), // System roles cannot be deleted
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('role_tenant_id_idx').on(table.tenantId),
    tenantNameIdx: uniqueIndex('role_tenant_name_idx').on(table.tenantId, table.name),
  })
)

export const userRoleSchema = pgTable(
  'user_role',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roleSchema.id, { onDelete: 'cascade' }),
    assignedBy: uuid('assigned_by').references(() => userSchema.id),
    assignedAt: timestamp('assigned_at', { mode: 'date' }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }),
  },
  (table) => ({
    userIdIdx: index('user_role_user_id_idx').on(table.userId),
    roleIdIdx: index('user_role_role_id_idx').on(table.roleId),
    userRoleIdx: uniqueIndex('user_role_user_role_idx').on(table.userId, table.roleId),
  })
)

// =============================================================================
// PLUGIN SYSTEM
// =============================================================================

export const pluginSchema = pgTable(
  'plugin',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    version: varchar('version', { length: 50 }).notNull(),
    description: text('description'),
    author: varchar('author', { length: 255 }),
    repository: varchar('repository', { length: 500 }),
    homepage: varchar('homepage', { length: 500 }),

    // Plugin configuration
    category: varchar('category', { length: 100 }),
    tags: jsonb('tags').$type<string[]>(),
    dependencies: jsonb('dependencies').$type<Record<string, string>>(),

    // Plugin status
    status: varchar('status', { length: 50 }).default('inactive').notNull(), // active, inactive, error
    isSystem: boolean('is_system').default(false), // System plugins cannot be uninstalled

    // Plugin metadata
    manifest: jsonb('manifest').$type<Record<string, any>>(),
    settings: jsonb('settings').$type<Record<string, any>>(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('plugin_slug_idx').on(table.slug),
    statusIdx: index('plugin_status_idx').on(table.status),
    categoryIdx: index('plugin_category_idx').on(table.category),
  })
)

export const tenantPluginSchema = pgTable(
  'tenant_plugin',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantSchema.id, { onDelete: 'cascade' }),
    pluginId: uuid('plugin_id')
      .notNull()
      .references(() => pluginSchema.id, { onDelete: 'cascade' }),

    // Installation status
    status: varchar('status', { length: 50 }).default('installed').notNull(), // installed, activated, deactivated, error
    version: varchar('version', { length: 50 }).notNull(),

    // Plugin configuration for this tenant
    config: jsonb('config').$type<Record<string, any>>(),
    settings: jsonb('settings').$type<Record<string, any>>(),

    // Installation metadata
    installedBy: uuid('installed_by').references(() => userSchema.id),
    installedAt: timestamp('installed_at', { mode: 'date' }).defaultNow().notNull(),
    activatedAt: timestamp('activated_at', { mode: 'date' }),
    lastUsedAt: timestamp('last_used_at', { mode: 'date' }),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('tenant_plugin_tenant_id_idx').on(table.tenantId),
    pluginIdIdx: index('tenant_plugin_plugin_id_idx').on(table.pluginId),
    tenantPluginIdx: uniqueIndex('tenant_plugin_tenant_plugin_idx').on(
      table.tenantId,
      table.pluginId
    ),
    statusIdx: index('tenant_plugin_status_idx').on(table.status),
  })
)

// =============================================================================
// AUDIT LOGGING & ACTIVITY TRACKING
// =============================================================================

export const auditLogSchema = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenantSchema.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => userSchema.id),

    // Action details
    action: varchar('action', { length: 100 }).notNull(), // create, update, delete, login, etc.
    resourceType: varchar('resource_type', { length: 100 }).notNull(), // user, organization, plugin, etc.
    resourceId: varchar('resource_id', { length: 255 }),

    // Action details
    details: jsonb('details').$type<Record<string, any>>(),
    oldValues: jsonb('old_values').$type<Record<string, any>>(),
    newValues: jsonb('new_values').$type<Record<string, any>>(),

    // Request context
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 compatible
    userAgent: text('user_agent'),
    sessionId: varchar('session_id', { length: 255 }),

    // Metadata
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index('audit_log_tenant_id_idx').on(table.tenantId),
    userIdIdx: index('audit_log_user_id_idx').on(table.userId),
    actionIdx: index('audit_log_action_idx').on(table.action),
    resourceTypeIdx: index('audit_log_resource_type_idx').on(table.resourceType),
    createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
  })
)

// =============================================================================
// ANALYTICS & METRICS
// =============================================================================

export const analyticsEventSchema = pgTable(
  'analytics_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenantSchema.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => userSchema.id),
    sessionId: varchar('session_id', { length: 255 }),

    // Event details
    eventName: varchar('event_name', { length: 100 }).notNull(),
    category: varchar('category', { length: 100 }),
    properties: jsonb('properties').$type<Record<string, any>>(),

    // Event context
    url: varchar('url', { length: 1000 }),
    referrer: varchar('referrer', { length: 1000 }),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),

    // Event value
    value: integer('value'),
    currency: varchar('currency', { length: 3 }),

    // Timestamps
    timestamp: timestamp('timestamp', { mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index('analytics_event_tenant_id_idx').on(table.tenantId),
    userIdIdx: index('analytics_event_user_id_idx').on(table.userId),
    eventNameIdx: index('analytics_event_event_name_idx').on(table.eventName),
    categoryIdx: index('analytics_event_category_idx').on(table.category),
    timestampIdx: index('analytics_event_timestamp_idx').on(table.timestamp),
  })
)

// =============================================================================
// SYSTEM CONFIGURATION
// =============================================================================

export const systemConfigSchema = pgTable(
  'system_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 255 }).notNull().unique(),
    value: jsonb('value').$type<any>(),
    description: text('description'),
    category: varchar('category', { length: 100 }),
    isPublic: boolean('is_public').default(false), // Whether this config can be exposed to frontend
    isEncrypted: boolean('is_encrypted').default(false), // Whether the value should be encrypted
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    keyIdx: uniqueIndex('system_config_key_idx').on(table.key),
    categoryIdx: index('system_config_category_idx').on(table.category),
  })
)

// =============================================================================
// LEGACY COMPATIBILITY (for backward compatibility)
// =============================================================================

export const todoSchema = pgTable('todo', {
  id: serial('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Tenant = typeof tenantSchema.$inferSelect
export type NewTenant = typeof tenantSchema.$inferInsert

export type Organization = typeof organizationSchema.$inferSelect
export type NewOrganization = typeof organizationSchema.$inferInsert

export type User = typeof userSchema.$inferSelect
export type NewUser = typeof userSchema.$inferInsert

export type Role = typeof roleSchema.$inferSelect
export type NewRole = typeof roleSchema.$inferInsert

export type UserRole = typeof userRoleSchema.$inferSelect
export type NewUserRole = typeof userRoleSchema.$inferInsert

export type Plugin = typeof pluginSchema.$inferSelect
export type NewPlugin = typeof pluginSchema.$inferInsert

export type TenantPlugin = typeof tenantPluginSchema.$inferSelect
export type NewTenantPlugin = typeof tenantPluginSchema.$inferInsert

export type AuditLog = typeof auditLogSchema.$inferSelect
export type NewAuditLog = typeof auditLogSchema.$inferInsert

export type AnalyticsEvent = typeof analyticsEventSchema.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEventSchema.$inferInsert

export type SystemConfig = typeof systemConfigSchema.$inferSelect
export type NewSystemConfig = typeof systemConfigSchema.$inferInsert

export type Todo = typeof todoSchema.$inferSelect
export type NewTodo = typeof todoSchema.$inferInsert
