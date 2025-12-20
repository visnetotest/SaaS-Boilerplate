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

    // Hierarchy fields - self-reference handled via migration
    parentTenantId: uuid('parent_tenant_id'),
    hierarchyLevel: integer('hierarchy_level').default(0), // 0 = root level
    path: text('path'), // Materialized path for efficient tree queries: /root/parent/child

    settings: jsonb('settings').$type<Record<string, any>>(),
    settingsInheritance: jsonb('settings_inheritance').$type<Record<string, any>>(), // Which settings inherit from parent
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
    parentTenantIdIdx: index('tenant_parent_tenant_id_idx').on(table.parentTenantId),
    hierarchyLevelIdx: index('tenant_hierarchy_level_idx').on(table.hierarchyLevel),
    pathIdx: index('tenant_path_idx').on(table.path),
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

    // Hierarchy fields - self-reference handled via migration
    parentOrganizationId: uuid('parent_organization_id'),
    hierarchyLevel: integer('hierarchy_level').default(0), // 0 = root level within tenant
    path: text('path'), // Materialized path: /tenant/org1/suborg1

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
    settingsInheritance: jsonb('settings_inheritance').$type<Record<string, any>>(), // Inheritance rules

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
    parentOrganizationIdIdx: index('organization_parent_organization_id_idx').on(
      table.parentOrganizationId
    ),
    hierarchyLevelIdx: index('organization_hierarchy_level_idx').on(table.hierarchyLevel),
    pathIdx: index('organization_path_idx').on(table.path),
  })
)

// =============================================================================
// TENANT & ORGANIZATION HIERARCHY
// =============================================================================

export const tenantHierarchySchema = pgTable(
  'tenant_hierarchy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantSchema.id, { onDelete: 'cascade' }),
    parentTenantId: uuid('parent_tenant_id').references(() => tenantSchema.id, {
      onDelete: 'cascade',
    }),
    hierarchyLevel: integer('hierarchy_level').notNull().default(0),
    path: text('path').notNull(), // Materialized path: /root/parent/child

    // Inheritance settings
    canAccessChildren: boolean('can_access_children').default(false),
    canAccessParent: boolean('can_access_parent').default(false),
    inheritedPermissions: jsonb('inherited_permissions').$type<Record<string, any>>(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('tenant_hierarchy_tenant_id_idx').on(table.tenantId),
    parentTenantIdIdx: index('tenant_hierarchy_parent_tenant_id_idx').on(table.parentTenantId),
    hierarchyLevelIdx: index('tenant_hierarchy_hierarchy_level_idx').on(table.hierarchyLevel),
    pathIdx: index('tenant_hierarchy_path_idx').on(table.path),
    tenantParentIdx: uniqueIndex('tenant_hierarchy_tenant_parent_idx').on(
      table.tenantId,
      table.parentTenantId
    ),
  })
)

export const organizationHierarchySchema = pgTable(
  'organization_hierarchy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationSchema.id, { onDelete: 'cascade' }),
    parentOrganizationId: uuid('parent_organization_id').references(() => organizationSchema.id, {
      onDelete: 'cascade',
    }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantSchema.id, { onDelete: 'cascade' }),
    hierarchyLevel: integer('hierarchy_level').notNull().default(0),
    path: text('path').notNull(), // Materialized path: /tenant/org1/suborg1

    // Inheritance settings
    canAccessChildren: boolean('can_access_children').default(false),
    canAccessParent: boolean('can_access_parent').default(false),
    inheritedPermissions: jsonb('inherited_permissions').$type<Record<string, any>>(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    organizationIdIdx: index('organization_hierarchy_organization_id_idx').on(table.organizationId),
    parentOrganizationIdIdx: index('organization_hierarchy_parent_organization_id_idx').on(
      table.parentOrganizationId
    ),
    tenantIdIdx: index('organization_hierarchy_tenant_id_idx').on(table.tenantId),
    hierarchyLevelIdx: index('organization_hierarchy_hierarchy_level_idx').on(table.hierarchyLevel),
    pathIdx: index('organization_hierarchy_path_idx').on(table.path),
    orgParentIdx: uniqueIndex('organization_hierarchy_org_parent_idx').on(
      table.organizationId,
      table.parentOrganizationId
    ),
  })
)

export const hierarchyRoleSchema = pgTable(
  'hierarchy_role',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenantSchema.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizationSchema.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    permissions: jsonb('permissions').$type<string[]>().notNull(),

    // Hierarchy scope
    scopeType: varchar('scope_type', { length: 50 }).notNull(), // tenant, organization, subtree
    scopeId: uuid('scope_id'), // ID of the tenant/organization this role applies to
    appliesToChildren: boolean('applies_to_children').default(false),
    maxDepth: integer('max_depth'), // Maximum depth this role applies to

    isSystem: boolean('is_system').default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('hierarchy_role_tenant_id_idx').on(table.tenantId),
    organizationIdIdx: index('hierarchy_role_organization_id_idx').on(table.organizationId),
    scopeTypeIdx: index('hierarchy_role_scope_type_idx').on(table.scopeType),
    scopeIdIdx: index('hierarchy_role_scope_id_idx').on(table.scopeId),
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
// MICROSERVICES SUPPORT & HEALTH MONITORING
// =============================================================================

export const serviceRegistrySchema = pgTable(
  'service_registry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    version: varchar('version', { length: 50 }).notNull(),

    // Service endpoints
    baseUrl: varchar('base_url', { length: 500 }).notNull(),
    healthEndpoint: varchar('health_endpoint', { length: 500 }),
    docsEndpoint: varchar('docs_endpoint', { length: 500 }),

    // Service metadata
    description: text('description'),
    category: varchar('category', { length: 100 }),
    tags: jsonb('tags').$type<string[]>(),

    // Service status
    status: varchar('status', { length: 50 }).default('inactive').notNull(), // active, inactive, degraded, down
    isInternal: boolean('is_internal').default(false),

    // Health monitoring
    lastHealthCheck: timestamp('last_health_check', { mode: 'date' }),
    responseTime: integer('response_time'), // in milliseconds
    uptime: integer('uptime'), // in seconds

    // Configuration
    config: jsonb('config').$type<Record<string, any>>(),
    secrets: jsonb('secrets').$type<Record<string, string>>(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('service_registry_slug_idx').on(table.slug),
    statusIdx: index('service_registry_status_idx').on(table.status),
    categoryIdx: index('service_registry_category_idx').on(table.category),
  })
)

export const apiGatewaySchema = pgTable(
  'api_gateway',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),

    // Route configuration
    path: varchar('path', { length: 500 }).notNull(),
    method: varchar('method', { length: 10 }).notNull(), // GET, POST, PUT, DELETE, etc.
    targetServiceId: uuid('target_service_id')
      .notNull()
      .references(() => serviceRegistrySchema.id, { onDelete: 'cascade' }),

    // Rate limiting
    rateLimit: integer('rate_limit'), // requests per minute
    burstLimit: integer('burst_limit'), // burst capacity

    // Authentication & authorization
    requiresAuth: boolean('requires_auth').default(true),
    allowedRoles: jsonb('allowed_roles').$type<string[]>(),

    // Status
    status: varchar('status', { length: 50 }).default('active').notNull(),

    // Metadata
    description: text('description'),
    config: jsonb('config').$type<Record<string, any>>(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('api_gateway_slug_idx').on(table.slug),
    targetServiceIdIdx: index('api_gateway_target_service_id_idx').on(table.targetServiceId),
    pathMethodIdx: uniqueIndex('api_gateway_path_method_idx').on(table.path, table.method),
    statusIdx: index('api_gateway_status_idx').on(table.status),
  })
)

// =============================================================================
// ADVANCED ANALYTICS & PERFORMANCE MONITORING
// =============================================================================

export const performanceMetricsSchema = pgTable(
  'performance_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenantSchema.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').references(() => serviceRegistrySchema.id),

    // Metric details
    metricName: varchar('metric_name', { length: 100 }).notNull(),
    metricType: varchar('metric_type', { length: 50 }).notNull(), // counter, gauge, histogram, timing
    value: bigint('value', { mode: 'number' }).notNull(),
    unit: varchar('unit', { length: 20 }), // ms, bytes, requests, etc.

    // Context
    endpoint: varchar('endpoint', { length: 500 }),
    userId: uuid('user_id').references(() => userSchema.id),
    sessionId: varchar('session_id', { length: 255 }),

    // Dimensions
    tags: jsonb('tags').$type<Record<string, string>>(),
    metadata: jsonb('metadata').$type<Record<string, any>>(),

    // Timestamps
    timestamp: timestamp('timestamp', { mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index('performance_metrics_tenant_id_idx').on(table.tenantId),
    serviceIdIdx: index('performance_metrics_service_id_idx').on(table.serviceId),
    metricNameIdx: index('performance_metrics_metric_name_idx').on(table.metricName),
    timestampIdx: index('performance_metrics_timestamp_idx').on(table.timestamp),
    metricTypeIdx: index('performance_metrics_metric_type_idx').on(table.metricType),
  })
)

export const errorTrackingSchema = pgTable(
  'error_tracking',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenantSchema.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => userSchema.id),
    serviceId: uuid('service_id').references(() => serviceRegistrySchema.id),

    // Error details
    errorType: varchar('error_type', { length: 100 }).notNull(),
    errorMessage: text('error_message').notNull(),
    stackTrace: text('stack_trace'),

    // Context
    endpoint: varchar('endpoint', { length: 500 }),
    method: varchar('method', { length: 10 }),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),

    // Severity
    severity: varchar('severity', { length: 20 }).default('error').notNull(), // debug, info, warning, error, critical

    // Metadata
    context: jsonb('context').$type<Record<string, any>>(),
    tags: jsonb('tags').$type<string[]>(),

    // Timestamps
    timestamp: timestamp('timestamp', { mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index('error_tracking_tenant_id_idx').on(table.tenantId),
    userIdIdx: index('error_tracking_user_id_idx').on(table.userId),
    serviceIdIdx: index('error_tracking_service_id_idx').on(table.serviceId),
    errorTypeIdx: index('error_tracking_error_type_idx').on(table.errorType),
    severityIdx: index('error_tracking_severity_idx').on(table.severity),
    timestampIdx: index('error_tracking_timestamp_idx').on(table.timestamp),
  })
)

// =============================================================================
// WORKFLOW AUTOMATION & BUSINESS PROCESSES
// =============================================================================

export const workflowSchema = pgTable(
  'workflow',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantSchema.id, { onDelete: 'cascade' }),

    // Workflow details
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }),

    // Workflow configuration
    definition: jsonb('definition').$type<Record<string, any>>().notNull(), // Workflow definition/steps
    triggers: jsonb('triggers').$type<Record<string, any>>().notNull(), // Event triggers

    // Status
    status: varchar('status', { length: 50 }).default('draft').notNull(), // draft, active, paused, archived
    version: varchar('version', { length: 50 }).default('1.0.0').notNull(),

    // Settings
    settings: jsonb('settings').$type<Record<string, any>>(),

    // Metadata
    createdBy: uuid('created_by').references(() => userSchema.id),
    updatedBy: uuid('updated_by').references(() => userSchema.id),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('workflow_tenant_id_idx').on(table.tenantId),
    statusIdx: index('workflow_status_idx').on(table.status),
    categoryIdx: index('workflow_category_idx').on(table.category),
    createdByIdx: index('workflow_created_by_idx').on(table.createdBy),
  })
)

export const workflowExecutionSchema = pgTable(
  'workflow_execution',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflowSchema.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantSchema.id, { onDelete: 'cascade' }),

    // Execution details
    triggeredBy: varchar('triggered_by', { length: 100 }), // event, manual, scheduled
    triggeredById: uuid('triggered_by_id').references(() => userSchema.id),

    // Status
    status: varchar('status', { length: 50 }).default('running').notNull(), // running, completed, failed, cancelled

    // Progress
    currentStep: varchar('current_step', { length: 255 }),
    progress: integer('progress').default(0), // 0-100 percentage

    // Results
    result: jsonb('result').$type<Record<string, any>>(),
    error: text('error'),

    // Timing
    startedAt: timestamp('started_at', { mode: 'date' }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    duration: integer('duration'), // in seconds

    // Context
    context: jsonb('context').$type<Record<string, any>>(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    workflowIdIdx: index('workflow_execution_workflow_id_idx').on(table.workflowId),
    tenantIdIdx: index('workflow_execution_tenant_id_idx').on(table.tenantId),
    statusIdx: index('workflow_execution_status_idx').on(table.status),
    startedAtIdx: index('workflow_execution_started_at_idx').on(table.startedAt),
    triggeredByIdIdx: index('workflow_execution_triggered_by_id_idx').on(table.triggeredById),
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

export type ServiceRegistry = typeof serviceRegistrySchema.$inferSelect
export type NewServiceRegistry = typeof serviceRegistrySchema.$inferInsert

export type ApiGateway = typeof apiGatewaySchema.$inferSelect
export type NewApiGateway = typeof apiGatewaySchema.$inferInsert

export type PerformanceMetrics = typeof performanceMetricsSchema.$inferSelect
export type NewPerformanceMetrics = typeof performanceMetricsSchema.$inferInsert

export type ErrorTracking = typeof errorTrackingSchema.$inferSelect
export type NewErrorTracking = typeof errorTrackingSchema.$inferInsert

export type Workflow = typeof workflowSchema.$inferSelect
export type NewWorkflow = typeof workflowSchema.$inferInsert

export type WorkflowExecution = typeof workflowExecutionSchema.$inferSelect
export type NewWorkflowExecution = typeof workflowExecutionSchema.$inferInsert

export type Todo = typeof todoSchema.$inferSelect
export type NewTodo = typeof todoSchema.$inferInsert

// Hierarchy types
export type TenantHierarchy = typeof tenantHierarchySchema.$inferSelect
export type NewTenantHierarchy = typeof tenantHierarchySchema.$inferInsert

export type OrganizationHierarchy = typeof organizationHierarchySchema.$inferSelect
export type NewOrganizationHierarchy = typeof organizationHierarchySchema.$inferInsert

export type HierarchyRole = typeof hierarchyRoleSchema.$inferSelect
export type NewHierarchyRole = typeof hierarchyRoleSchema.$inferInsert
