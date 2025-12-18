// =============================================================================
// MULTI-TENANT HIERARCHY MANAGEMENT
// =============================================================================

import { Pool } from 'pg'
import { EventEmitter } from 'events'
import { createHash } from 'crypto'

// =============================================================================
// INTERFACES
// =============================================================================

interface Tenant {
  id: string
  name: string
  slug: string
  parentId?: string
  level: number
  hierarchyPath: string
  settings: TenantSettings
  metadata: TenantMetadata
  status: 'active' | 'suspended' | 'pending'
  createdAt: Date
  updatedAt: Date
  createdBy: string
  plan: TenantPlan
  billing: TenantBilling
  limits: TenantLimits
}

interface TenantSettings {
  allowSubTenants: boolean
  maxSubTenants: number
  inheritParentSettings: boolean
  customBranding: {
    enabled: boolean
    logo?: string
    colors: Record<string, string>
    customCSS?: string
  }
  features: Record<string, any>
  integrations: Record<string, any>
}

interface TenantMetadata {
  industry?: string
  size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  region: string
  timezone: string
  language: string
  currency: string
  contact: {
    name: string
    email: string
    phone?: string
    address?: string
  }
}

interface TenantPlan {
  id: string
  name: string
  type: 'free' | 'starter' | 'professional' | 'enterprise' | 'custom'
  price: number
  billingCycle: 'monthly' | 'yearly'
  features: string[]
  limits: TenantLimits
  isActive: boolean
}

interface TenantBilling {
  billingEmail: string
  billingAddress?: string
  paymentMethod: {
    type: 'credit_card' | 'bank_transfer' | 'invoice'
    details: Record<string, any>
  }
  subscriptionId?: string
  nextBillingDate?: Date
  lastPaymentDate?: Date
}

interface TenantLimits {
  users: number
  storage: number // in MB
  apiCalls: number // per month
  plugins: number
  subTenants: number
  bandwidth: number // in GB per month
  features: Record<string, any>
}

interface TenantHierarchyNode {
  tenant: Tenant
  children: TenantHierarchyNode[]
  depth: number
  totalUsers: number
  totalSubTenants: number
  totalStorage: number
  activeUsers: number
  revenue: number
}

interface TenantHierarchyOperation {
  id: string
  type: 'create' | 'move' | 'merge' | 'split' | 'delete'
  sourceTenantId?: string
  targetTenantId?: string
  metadata: Record<string, any>
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  createdBy: string
  createdAt: Date
  completedAt?: Date
  error?: string
}

interface TenantInheritanceRule {
  id: string
  parentId: string
  childId: string
  setting: string
  value: any
  overrideType: 'inherit' | 'override' | 'merge'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// MULTI-TENANT HIERARCHY MANAGER
// =============================================================================

export class MultiTenantHierarchyManager extends EventEmitter {
  private db: Pool

  constructor(db: Pool) {
    super()
    this.db = db
    this.initializeDatabaseSchema()
  }

  // =============================================================================
  // TENANT HIERARCHY OPERATIONS
  // =============================================================================

  async createSubTenant(
    parentTenantId: string,
    subTenantData: Omit<Tenant, 'id' | 'parentId' | 'level' | 'hierarchyPath' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const parentTenant = await this.getTenant(parentTenantId)
    
    if (!parentTenant) {
      throw new Error('Parent tenant not found')
    }

    if (!parentTenant.settings.allowSubTenants) {
      throw new Error('Parent tenant does not allow sub-tenants')
    }

    if (parentTenant.level >= 4) {
      throw new Error('Maximum hierarchy depth reached')
    }

    const existingSubTenants = await this.getSubTenants(parentTenantId)
    if (existingSubTenants.length >= parentTenant.settings.maxSubTenants) {
      throw new Error('Maximum sub-tenants limit reached')
    }

    const subTenant: Tenant = {
      id: this.generateTenantId(),
      name: subTenantData.name,
      slug: this.generateTenantSlug(subTenantData.name, parentTenantId),
      parentId: parentTenantId,
      level: parentTenant.level + 1,
      hierarchyPath: `${parentTenant.hierarchyPath}/${parentTenantId}`,
      settings: {
        ...subTenantData.settings,
        inheritParentSettings: subTenantData.settings.inheritParentSettings ?? true
      },
      metadata: subTenantData.metadata,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: subTenantData.createdBy,
      plan: subTenantData.plan,
      billing: subTenantData.billing,
      limits: subTenantData.limits
    }

    // Start hierarchy operation
    const operationId = await this.startHierarchyOperation({
      type: 'create',
      targetTenantId: subTenant.id,
      metadata: { parentTenantId, subTenantData }
    }, subTenantData.createdBy)

    try {
      await this.createTenant(subTenant)
      
      // Apply inheritance rules if enabled
      if (subTenant.settings.inheritParentSettings) {
        await this.applyInheritanceRules(parentTenantId, subTenant.id)
      }

      // Update operation status
      await this.completeHierarchyOperation(operationId)

      // Publish event
      this.emit('subTenant.created', { subTenant, parentTenant, operationId })

      return subTenant.id
    } catch (error) {
      await this.failHierarchyOperation(operationId, error.message)
      throw error
    }
  }

  async moveSubTenant(
    subTenantId: string,
    newParentTenantId: string,
    reason?: string
  ): Promise<void> {
    const operationId = await this.startHierarchyOperation({
      type: 'move',
      sourceTenantId: subTenantId,
      targetTenantId: newParentTenantId,
      metadata: { reason }
    }, 'system')

    try {
      const subTenant = await this.getTenant(subTenantId)
      const newParent = await this.getTenant(newParentTenantId)
      
      if (!subTenant || !newParent) {
        throw new Error('Tenant not found')
      }

      const oldParentId = subTenant.parentId
      const oldHierarchyPath = subTenant.hierarchyPath
      const newLevel = newParent.level + 1

      // Update tenant hierarchy
      await this.db.query(`
        UPDATE tenants 
        SET parent_id = $1, level = $2, hierarchy_path = $3, updated_at = $4
        WHERE id = $5
      `, [
        newParentTenantId,
        newLevel,
        `${newParent.hierarchyPath}/${newParentTenantId}`,
        new Date(),
        subTenantId
      ])

      // Update all descendants
      await this.updateDescendantPaths(subTenantId, `${newParent.hierarchyPath}/${newParentTenantId}`)

      // Update inheritance
      await this.removeInheritanceRules(subTenantId)
      if (subTenant.settings.inheritParentSettings) {
        await this.applyInheritanceRules(newParentTenantId, subTenantId)
      }

      await this.completeHierarchyOperation(operationId)

      this.emit('subTenant.moved', { 
        subTenant, 
        oldParentId, 
        newParent, 
        operationId,
        reason
      })
    } catch (error) {
      await this.failHierarchyOperation(operationId, error.message)
      throw error
    }
  }

  async mergeTenants(
    sourceTenantId: string,
    targetTenantId: string,
    mergeData: {
      mergeUsers: boolean
      mergeSettings: boolean
      mergeBilling: boolean
      reason: string
    }
  ): Promise<string> {
    const operationId = await this.startHierarchyOperation({
      type: 'merge',
      sourceTenantId,
      targetTenantId,
      metadata: mergeData
    }, 'system')

    try {
      const sourceTenant = await this.getTenant(sourceTenantId)
      const targetTenant = await this.getTenant(targetTenantId)

      if (!sourceTenant || !targetTenant) {
        throw new Error('Tenant not found')
      }

      // Merge users if requested
      if (mergeData.mergeUsers) {
        await this.mergeTenantUsers(sourceTenantId, targetTenantId)
      }

      // Merge settings if requested
      if (mergeData.mergeSettings) {
        await this.mergeTenantSettings(sourceTenantId, targetTenantId)
      }

      // Handle billing merge
      if (mergeData.mergeBilling) {
        await this.mergeTenantBilling(sourceTenantId, targetTenantId)
      }

      // Update source tenant status to merged
      await this.db.query(`
        UPDATE tenants 
        SET status = 'merged', updated_at = $1
        WHERE id = $2
      `, [new Date(), sourceTenantId])

      await this.completeHierarchyOperation(operationId)

      this.emit('tenants.merged', {
        sourceTenant,
        targetTenant,
        mergeData,
        operationId
      })

      return targetTenantId
    } catch (error) {
      await this.failHierarchyOperation(operationId, error.message)
      throw error
    }
  }

  async splitTenant(
    tenantId: string,
    splitData: {
      name: string
      settings: Omit<TenantSettings, 'allowSubTenants' | 'maxSubTenants'>
      plan?: TenantPlan
    }
  ): Promise<string> {
    const originalTenant = await this.getTenant(tenantId)
    
    if (!originalTenant) {
      throw new Error('Tenant not found')
    }

    const operationId = await this.startHierarchyOperation({
      type: 'split',
      sourceTenantId: tenantId,
      metadata: { splitData }
    }, 'system')

    try {
      const newTenant: Tenant = {
        ...originalTenant,
        id: this.generateTenantId(),
        name: splitData.name,
        slug: this.generateTenantSlug(splitData.name, originalTenant.parentId || 'root'),
        parentId: originalTenant.parentId,
        level: originalTenant.level,
        hierarchyPath: originalTenant.hierarchyPath,
        settings: {
          ...originalTenant.settings,
          allowSubTenants: true,
          maxSubTenants: 10,
          ...splitData.settings
        },
        plan: splitData.plan || originalTenant.plan,
        updatedAt: new Date()
      }

      await this.createTenant(newTenant)

      await this.completeHierarchyOperation(operationId)

      this.emit('tenant.split', {
        originalTenant,
        newTenant,
        splitData,
        operationId
      })

      return newTenant.id
    } catch (error) {
      await this.failHierarchyOperation(operationId, error.message)
      throw error
    }
  }

  async deleteTenant(tenantId: string, reason?: string): Promise<void> {
    const operationId = await this.startHierarchyOperation({
      type: 'delete',
      sourceTenantId: tenantId,
      metadata: { reason }
    }, 'system')

    try {
      const tenant = await this.getTenant(tenantId)
      
      if (!tenant) {
        throw new Error('Tenant not found')
      }

      // Check if tenant has sub-tenants
      const subTenants = await this.getSubTenants(tenantId)
      if (subTenants.length > 0) {
        throw new Error('Cannot delete tenant with active sub-tenants')
      }

      // Archive tenant data instead of hard delete
      await this.archiveTenant(tenantId)

      await this.completeHierarchyOperation(operationId)

      this.emit('tenant.deleted', { tenant, reason, operationId })
    } catch (error) {
      await this.failHierarchyOperation(operationId, error.message)
      throw error
    }
  }

  // =============================================================================
  // HIERARCHY RETRIEVAL
  // =============================================================================

  async getTenantHierarchy(rootTenantId?: string): Promise<TenantHierarchyNode> {
    let query = `
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND status = 'active') as user_count,
        (SELECT COUNT(*) FROM tenants WHERE parent_id = t.id AND status = 'active') as sub_tenant_count
      FROM tenants t
      WHERE t.status = 'active'
    `
    const params: any[] = []

    if (rootTenantId) {
      query += ` AND (t.hierarchy_path LIKE $1 OR t.id = $1)`
      params.push(`${rootTenantId}%`, rootTenantId)
    } else {
      query += ` AND t.parent_id IS NULL`
    }

    query += ` ORDER BY t.level, t.name`

    const result = await this.db.query(query, params)
    const tenants = result.rows

    if (tenants.length === 0) {
      throw new Error('No tenants found')
    }

    // Build hierarchy tree
    const root = tenants.find(t => !t.parent_id)
    if (!root) {
      throw new Error('Root tenant not found')
    }

    return this.buildHierarchyNode(root, tenants)
  }

  async getSubTenants(tenantId: string, includeDescendants = false): Promise<Tenant[]> {
    let query: string
    let params: any[]

    if (includeDescendants) {
      query = `SELECT * FROM tenants WHERE hierarchy_path LIKE $1 AND status = 'active' ORDER BY level, name`
      params.push(`${tenantId}/%`)
    } else {
      query = `SELECT * FROM tenants WHERE parent_id = $1 AND status = 'active' ORDER BY name`
      params.push(tenantId)
    }

    const result = await this.db.query(query, params)
    return result.rows
  }

  async getTenantPath(tenantId: string): Promise<Tenant[]> {
    const tenant = await this.getTenant(tenantId)
    
    if (!tenant) {
      throw new Error('Tenant not found')
    }

    const pathIds = tenant.hierarchyPath.split('/').filter(id => id)
    
    if (pathIds.length === 0) {
      return [tenant]
    }

    const placeholders = pathIds.map((_, index) => `$${index + 1}`).join(', ')
    const query = `
      SELECT * FROM tenants 
      WHERE id IN (${placeholders}) 
      ORDER BY level
    `

    const result = await this.db.query(query, pathIds)
    return result.rows
  }

  // =============================================================================
  // INHERITANCE MANAGEMENT
  // =============================================================================

  async setInheritanceRule(
    parentId: string,
    childId: string,
    setting: string,
    value: any,
    overrideType: TenantInheritanceRule['overrideType'] = 'inherit'
  ): Promise<void> {
    const rule: TenantInheritanceRule = {
      id: this.generateRuleId(),
      parentId,
      childId,
      setting,
      value: JSON.stringify(value),
      overrideType,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await this.db.query(`
      INSERT INTO tenant_inheritance_rules (
        id, parent_id, child_id, setting, value, override_type, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      rule.id,
      rule.parentId,
      rule.childId,
      rule.setting,
      rule.value,
      rule.overrideType,
      rule.isActive,
      rule.createdAt,
      rule.updatedAt
    ])

    this.emit('inheritance.rule.set', { rule })
  }

  async getEffectiveSettings(tenantId: string): Promise<TenantSettings> {
    const tenant = await this.getTenant(tenantId)
    
    if (!tenant) {
      throw new Error('Tenant not found')
    }

    let effectiveSettings = { ...tenant.settings }

    if (tenant.settings.inheritParentSettings && tenant.parentId) {
      const inheritedSettings = await this.getInheritedSettings(tenantId)
      effectiveSettings = this.mergeSettings(effectiveSettings, inheritedSettings)
    }

    return effectiveSettings
  }

  async getInheritedSettings(tenantId: string): Promise<Record<string, any>> {
    const query = `
      SELECT setting, value, override_type
      FROM tenant_inheritance_rules tir
      JOIN tenants t ON tir.parent_id = t.id
      WHERE tir.child_id = $1 AND tir.is_active = true
    `

    const result = await this.db.query(query, [tenantId])
    const inheritedSettings: Record<string, any> = {}

    for (const rule of result.rows) {
      const value = JSON.parse(rule.value)
      
      switch (rule.override_type) {
        case 'inherit':
          inheritedSettings[rule.setting] = value
          break
        case 'override':
          inheritedSettings[rule.setting] = value
          break
        case 'merge':
          inheritedSettings[rule.setting] = {
            ...inheritedSettings[rule.setting],
            ...value
          }
          break
      }
    }

    return inheritedSettings
  }

  // =============================================================================
  // ANALYTICS AND REPORTING
  // =============================================================================

  async getHierarchyAnalytics(rootTenantId?: string): Promise<{
    totalTenants: number
    totalUsers: number
    totalSubTenants: number
    hierarchyLevels: number
    tenantsByLevel: Record<number, number>
    tenantsByPlan: Record<string, number>
    storageUsage: number
    bandwidthUsage: number
    revenue: number
  }> {
    const hierarchy = await this.getTenantHierarchy(rootTenantId)
    
    const analytics = {
      totalTenants: 0,
      totalUsers: 0,
      totalSubTenants: 0,
      hierarchyLevels: hierarchy.depth,
      tenantsByLevel: {},
      tenantsByPlan: {},
      storageUsage: 0,
      bandwidthUsage: 0,
      revenue: 0
    }

    this.calculateNodeAnalytics(hierarchy, analytics)

    return analytics
  }

  async getHierarchyReport(rootTenantId: string, reportType: 'structure' | 'usage' | 'billing'): Promise<any> {
    const hierarchy = await this.getTenantHierarchy(rootTenantId)

    switch (reportType) {
      case 'structure':
        return this.generateStructureReport(hierarchy)
      case 'usage':
        return this.generateUsageReport(hierarchy)
      case 'billing':
        return this.generateBillingReport(hierarchy)
      default:
        throw new Error('Invalid report type')
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private async initializeDatabaseSchema(): Promise<void> {
    const schema = `
      -- Tenant hierarchy operations table
      CREATE TABLE IF NOT EXISTS tenant_hierarchy_operations (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        source_tenant_id VARCHAR(255),
        target_tenant_id VARCHAR(255),
        metadata JSONB,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        error TEXT
      );

      -- Tenant inheritance rules table
      CREATE TABLE IF NOT EXISTS tenant_inheritance_rules (
        id VARCHAR(255) PRIMARY KEY,
        parent_id VARCHAR(255) NOT NULL,
        child_id VARCHAR(255) NOT NULL,
        setting VARCHAR(255) NOT NULL,
        value JSONB,
        override_type VARCHAR(50) NOT NULL DEFAULT 'inherit',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_tenants_hierarchy_path ON tenants(hierarchy_path);
      CREATE INDEX IF NOT EXISTS idx_tenants_parent_id ON tenants(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
      CREATE INDEX IF NOT EXISTS idx_hierarchy_operations_status ON tenant_hierarchy_operations(status);
      CREATE INDEX IF NOT EXISTS idx_inheritance_rules_child ON tenant_inheritance_rules(child_id, is_active);
    `

    await this.db.query(schema)
  }

  private async createTenant(tenant: Tenant): Promise<void> {
    await this.db.query(`
      INSERT INTO tenants (
        id, name, slug, parent_id, level, hierarchy_path, settings,
        metadata, status, created_at, updated_at, created_by,
        plan_id, billing_data, limits_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
    `, [
      tenant.id,
      tenant.name,
      tenant.slug,
      tenant.parentId,
      tenant.level,
      tenant.hierarchyPath,
      JSON.stringify(tenant.settings),
      JSON.stringify(tenant.metadata),
      tenant.status,
      tenant.createdAt,
      tenant.updatedAt,
      tenant.createdBy,
      JSON.stringify(tenant.plan),
      JSON.stringify(tenant.billing),
      JSON.stringify(tenant.limits)
    ])
  }

  private async getTenant(tenantId: string): Promise<Tenant | null> {
    const result = await this.db.query(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId]
    )
    
    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parent_id,
      level: row.level,
      hierarchyPath: row.hierarchy_path,
      settings: row.settings ? JSON.parse(row.settings) : {},
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      plan: row.plan_id ? JSON.parse(row.plan_id) : null,
      billing: row.billing_data ? JSON.parse(row.billing_data) : null,
      limits: row.limits_data ? JSON.parse(row.limits_data) : null
    }
  }

  private buildHierarchyNode(root: any, allTenants: any[]): TenantHierarchyNode {
    const children = allTenants.filter(t => t.parent_id === root.id)
    
    return {
      tenant: {
        id: root.id,
        name: root.name,
        slug: root.slug,
        parentId: root.parent_id,
        level: root.level,
        hierarchyPath: root.hierarchy_path,
        settings: root.settings ? JSON.parse(root.settings) : {},
        metadata: root.metadata ? JSON.parse(root.metadata) : {},
        status: root.status,
        createdAt: root.created_at,
        updatedAt: root.updated_at,
        createdBy: root.created_by,
        plan: root.plan_id ? JSON.parse(root.plan_id) : null,
        billing: root.billing_data ? JSON.parse(root.billing_data) : null,
        limits: root.limits_data ? JSON.parse(root.limits_data) : null
      },
      children: children.map(child => this.buildHierarchyNode(child, allTenants)),
      depth: Math.max(0, ...children.map(child => this.calculateDepth(child.id, allTenants))),
      totalUsers: parseInt(root.user_count) || 0,
      totalSubTenants: parseInt(root.sub_tenant_count) || 0,
      totalStorage: 0, // Would need to calculate from actual usage
      activeUsers: 0, // Would need to calculate from user activity
      revenue: 0 // Would need to calculate from billing data
    }
  }

  private calculateDepth(tenantId: string, allTenants: any[]): number {
    let depth = 0
    let current = tenantId
    
    while (current) {
      const tenant = allTenants.find(t => t.id === current)
      if (!tenant || !tenant.parent_id) break
      
      current = tenant.parent_id
      depth++
    }
    
    return depth
  }

  private calculateNodeAnalytics(node: TenantHierarchyNode, analytics: any): void {
    analytics.totalTenants++
    analytics.totalUsers += node.totalUsers
    analytics.totalSubTenants += node.totalSubTenants
    analytics.storageUsage += node.totalStorage
    analytics.bandwidthUsage += node.bandwidthUsage
    analytics.revenue += node.revenue

    // Count by level
    if (!analytics.tenantsByLevel[node.depth]) {
      analytics.tenantsByLevel[node.depth] = 0
    }
    analytics.tenantsByLevel[node.depth]++

    // Count by plan
    const planName = node.tenant.plan?.name || 'unknown'
    if (!analytics.tenantsByPlan[planName]) {
      analytics.tenantsByPlan[planName] = 0
    }
    analytics.tenantsByPlan[planName]++

    // Recursively process children
    for (const child of node.children) {
      this.calculateNodeAnalytics(child, analytics)
    }
  }

  private async applyInheritanceRules(parentId: string, childId: string): Promise<void> {
    // Apply default inheritance rules for common settings
    const defaultRules = [
      { setting: 'features.features', value: {} },
      { setting: 'integrations', value: {} },
      { setting: 'customBranding.enabled', value: false }
    ]

    for (const rule of defaultRules) {
      await this.setInheritanceRule(parentId, childId, rule.setting, rule.value, 'inherit')
    }
  }

  private async removeInheritanceRules(tenantId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM tenant_inheritance_rules WHERE child_id = $1',
      [tenantId]
    )
  }

  private async updateDescendantPaths(tenantId: string, newHierarchyPath: string): Promise<void> {
    const descendants = await this.getSubTenants(tenantId, true)
    
    for (const descendant of descendants) {
      const oldPath = descendant.hierarchy_path
      const newPath = oldPath.replace(tenantId, newHierarchyPath)
      
      await this.db.query(`
        UPDATE tenants 
        SET hierarchy_path = $1, updated_at = $2
        WHERE id = $3
      `, [newPath, new Date(), descendant.id])
    }
  }

  private async mergeTenantUsers(sourceTenantId: string, targetTenantId: string): Promise<void> {
    await this.db.query(`
      UPDATE users 
      SET tenant_id = $1, updated_at = $2
      WHERE tenant_id = $3
    `, [targetTenantId, new Date(), sourceTenantId])
  }

  private async mergeTenantSettings(sourceTenantId: string, targetTenantId: string): Promise<void> {
    const sourceSettings = await this.db.query(
      'SELECT settings FROM tenants WHERE id = $1',
      [sourceTenantId]
    )

    if (sourceSettings.rows.length > 0) {
      const mergedSettings = this.mergeSettings(
        sourceSettings.rows[0].settings ? JSON.parse(sourceSettings.rows[0].settings) : {},
        {}
      )

      await this.db.query(`
        UPDATE tenants 
        SET settings = $1, updated_at = $2
        WHERE id = $3
      `, [JSON.stringify(mergedSettings), new Date(), targetTenantId])
    }
  }

  private async mergeTenantBilling(sourceTenantId: string, targetTenantId: string): Promise<void> {
    // Implement billing merge logic
    console.log(`Merging billing from ${sourceTenantId} to ${targetTenantId}`)
  }

  private async archiveTenant(tenantId: string): Promise<void> {
    await this.db.query(`
      UPDATE tenants 
      SET status = 'archived', updated_at = $1
      WHERE id = $2
    `, [new Date(), tenantId])
  }

  private mergeSettings(base: any, override: any): any {
    return {
      ...base,
      ...override,
      customBranding: {
        ...base.customBranding,
        ...override.customBranding
      },
      features: {
        ...base.features,
        ...override.features
      },
      integrations: {
        ...base.integrations,
        ...override.integrations
      }
    }
  }

  private generateTenantId(): string {
    return `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateTenantSlug(name: string, parentId: string): string {
    const baseSlug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    
    return parentId === 'root' ? baseSlug : `${parentId}-${baseSlug}`
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async startHierarchyOperation(
    operation: Omit<TenantHierarchyOperation, 'id' | 'createdAt' | 'status'>,
    createdBy: string
  ): Promise<string> {
    const operationId = this.generateOperationId()
    
    const fullOperation: TenantHierarchyOperation = {
      id: operationId,
      ...operation,
      status: 'pending',
      createdAt: new Date(),
      createdBy
    }

    await this.db.query(`
      INSERT INTO tenant_hierarchy_operations (
        id, type, source_tenant_id, target_tenant_id, metadata,
        status, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      fullOperation.id,
      fullOperation.type,
      fullOperation.sourceTenantId,
      fullOperation.targetTenantId,
      JSON.stringify(fullOperation.metadata),
      fullOperation.status,
      fullOperation.createdBy,
      fullOperation.createdAt
    ])

    return operationId
  }

  private async completeHierarchyOperation(operationId: string): Promise<void> {
    await this.db.query(`
      UPDATE tenant_hierarchy_operations
      SET status = 'completed', completed_at = $1
      WHERE id = $2
    `, [new Date(), operationId])
  }

  private async failHierarchyOperation(operationId: string, error: string): Promise<void> {
    await this.db.query(`
      UPDATE tenant_hierarchy_operations
      SET status = 'failed', error = $1, completed_at = $2
      WHERE id = $3
    `, [error, new Date(), operationId])
  }

  private generateStructureReport(hierarchy: TenantHierarchyNode): any {
    return {
      type: 'hierarchy_structure',
      generatedAt: new Date().toISOString(),
      summary: {
        totalTenants: this.countNodes(hierarchy),
        maxDepth: hierarchy.depth,
        averageSubTenantsPerNode: this.calculateAverageSubTenants(hierarchy)
      },
      structure: this.flattenHierarchy(hierarchy)
    }
  }

  private generateUsageReport(hierarchy: TenantHierarchyNode): any {
    return {
      type: 'usage_statistics',
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: this.sumNodes(hierarchy, 'totalUsers'),
        totalStorage: this.sumNodes(hierarchy, 'totalStorage'),
        totalBandwidth: this.sumNodes(hierarchy, 'totalBandwidth')
      },
      byLevel: this.calculateUsageByLevel(hierarchy),
      byPlan: this.calculateUsageByPlan(hierarchy)
    }
  }

  private generateBillingReport(hierarchy: TenantHierarchyNode): any {
    return {
      type: 'billing_summary',
      generatedAt: new Date().toISOString(),
      summary: {
        totalRevenue: this.sumNodes(hierarchy, 'revenue'),
        tenantsByPlan: this.calculateRevenueByPlan(hierarchy),
        projectedRevenue: this.calculateProjectedRevenue(hierarchy)
      },
      details: this.calculateBillingDetails(hierarchy)
    }
  }

  private countNodes(node: TenantHierarchyNode): number {
    return 1 + node.children.reduce((sum, child) => sum + this.countNodes(child), 0)
  }

  private sumNodes(node: TenantHierarchyNode, field: keyof TenantHierarchyNode): number {
    const nodeValue = (node as any)[field] || 0
    return nodeValue + node.children.reduce((sum, child) => sum + this.sumNodes(child, field), 0)
  }

  private calculateAverageSubTenants(hierarchy: TenantHierarchyNode): number {
    const nodesWithChildren = this.flattenHierarchy(hierarchy).filter((n: any) => n.children && n.children.length > 0)
    if (nodesWithChildren.length === 0) return 0
    
    const totalSubTenants = nodesWithChildren.reduce((sum, node) => sum + node.children.length, 0)
    return totalSubTenants / nodesWithChildren.length
  }

  private flattenHierarchy(node: TenantHierarchyNode): any[] {
    return [node, ...node.children.flatMap(child => this.flattenHierarchy(child))]
  }

  private calculateUsageByLevel(hierarchy: TenantHierarchyNode): Record<number, any> {
    const usage: Record<number, any> = {}
    this.calculateUsageByLevelRecursive(hierarchy, usage)
    return usage
  }

  private calculateUsageByLevelRecursive(node: TenantHierarchyNode, usage: Record<number, any>): void {
    if (!usage[node.level]) {
      usage[node.level] = { users: 0, storage: 0, bandwidth: 0, subTenants: node.children.length }
    }

    usage[node.level].users += node.totalUsers
    usage[node.level].storage += node.totalStorage
    usage[node.level].bandwidth += node.totalBandwidth

    for (const child of node.children) {
      this.calculateUsageByLevelRecursive(child, usage)
    }
  }

  private calculateUsageByPlan(hierarchy: TenantHierarchyNode): Record<string, any> {
    const usage: Record<string, any> = {}
    this.calculateUsageByPlanRecursive(hierarchy, usage)
    return usage
  }

  private calculateUsageByPlanRecursive(node: TenantHierarchyNode, usage: Record<string, any>): void {
    const planName = node.tenant.plan?.name || 'unknown'
    
    if (!usage[planName]) {
      usage[planName] = { users: 0, storage: 0, bandwidth: 0, tenants: 0 }
    }

    usage[planName].users += node.totalUsers
    usage[planName].storage += node.totalStorage
    usage[planName].bandwidth += node.totalBandwidth
    usage[planName].tenants += 1

    for (const child of node.children) {
      this.calculateUsageByPlanRecursive(child, usage)
    }
  }

  private calculateRevenueByPlan(hierarchy: TenantHierarchyNode): Record<string, number> {
    const revenue: Record<string, number> = {}
    this.calculateRevenueByPlanRecursive(hierarchy, revenue)
    return revenue
  }

  private calculateRevenueByPlanRecursive(node: TenantHierarchyNode, revenue: Record<string, number>): void {
    const planName = node.tenant.plan?.name || 'unknown'
    
    if (!revenue[planName]) {
      revenue[planName] = 0
    }

    revenue[planName] += node.revenue

    for (const child of node.children) {
      this.calculateRevenueByPlanRecursive(child, revenue)
    }
  }

  private calculateProjectedRevenue(hierarchy: TenantHierarchyNode): number {
    // Simple projection: current monthly revenue * 12
    const currentMonthlyRevenue = this.sumNodes(hierarchy, 'revenue')
    return currentMonthlyRevenue * 12
  }

  private calculateBillingDetails(hierarchy: TenantHierarchyNode): any[] {
    // Return detailed billing information for each tenant
    return this.flattenHierarchy(hierarchy).map(node => ({
      tenantId: node.tenant.id,
      tenantName: node.tenant.name,
      plan: node.tenant.plan,
      billing: node.tenant.billing,
      monthlyRevenue: node.revenue,
      yearlyRevenue: node.revenue * 12
    }))
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default MultiTenantHierarchyManager