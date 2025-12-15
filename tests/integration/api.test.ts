import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

// Mock the service layer
vi.mock('@/services/TenantService', () => ({
  tenantService: {
    listTenants: vi.fn(),
    createTenant: vi.fn(),
    getTenant: vi.fn(),
    updateTenant: vi.fn(),
    deactivateTenant: vi.fn(),
  },
}))

// Import after mocking
import { GET, POST } from '@/app/api/tenants/route'
import { tenantService } from '@/services/TenantService'

describe('Tenant API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/tenants', () => {
    it('should return list of tenants successfully', async () => {
      const mockTenants = {
        data: [
          {
            id: '1',
            name: 'Tenant 1',
            slug: 'tenant-1',
            domain: null,
            status: 'active',
            settings: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '2',
            name: 'Tenant 2',
            slug: 'tenant-2',
            domain: null,
            status: 'active',
            settings: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
        hasNext: false,
        hasPrev: false,
      }

      vi.mocked(tenantService.listTenants).mockResolvedValue(mockTenants)

      const mockRequest = new NextRequest('http://localhost:3000/api/tenants?page=1&limit=20')
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockTenants)
      expect(tenantService.listTenants).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: undefined,
        search: undefined,
      })
    })

    it('should handle service errors', async () => {
      const errorMessage = 'Database connection failed'
      vi.mocked(tenantService.listTenants).mockRejectedValue(new Error(errorMessage))

      const mockRequest = new NextRequest('http://localhost:3000/api/tenants')
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe(errorMessage)
    })

    it('should parse query parameters correctly', async () => {
      const mockTenants = { data: [], total: 0, page: 1, limit: 10, hasNext: false, hasPrev: false }
      vi.mocked(tenantService.listTenants).mockResolvedValue(mockTenants)

      const mockRequest = new NextRequest(
        'http://localhost:3000/api/tenants?page=2&limit=10&status=active&search=test'
      )
      await GET(mockRequest)

      expect(tenantService.listTenants).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        status: 'active',
        search: 'test',
      })
    })
  })

  describe('POST /api/tenants', () => {
    it('should create tenant successfully', async () => {
      const tenantData = {
        name: 'New Tenant',
        slug: 'new-tenant',
        settings: { theme: 'dark' },
      }

      const createdTenant = {
        id: '3',
        name: tenantData.name,
        slug: tenantData.slug,
        domain: null,
        status: 'active',
        settings: tenantData.settings,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(tenantService.createTenant).mockResolvedValue(createdTenant)

      const mockRequest = new NextRequest('http://localhost:3000/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantData),
      })

      // Mock the json method
      mockRequest.json = vi.fn().mockResolvedValue(tenantData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(createdTenant)
      expect(tenantService.createTenant).toHaveBeenCalledWith(tenantData)
    })

    it('should handle validation errors', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
        slug: 'invalid-tenant',
      }

      const mockRequest = new NextRequest('http://localhost:3000/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      })

      mockRequest.json = vi.fn().mockResolvedValue(invalidData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation failed')
      expect(data.details).toBeDefined()
    })

    it('should handle service errors during creation', async () => {
      const tenantData = {
        name: 'New Tenant',
        slug: 'new-tenant',
      }

      const errorMessage = 'Slug already exists'
      vi.mocked(tenantService.createTenant).mockRejectedValue(new Error(errorMessage))

      const mockRequest = new NextRequest('http://localhost:3000/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantData),
      })

      mockRequest.json = vi.fn().mockResolvedValue(tenantData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe(errorMessage)
    })

    it('should handle malformed JSON', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      mockRequest.json = vi.fn().mockRejectedValue(new Error('Unexpected token'))

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unexpected token')
    })
  })
})

describe('Tenant API Route with ID', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Import the ID route
  let tenantIdRoutes: any

  beforeAll(async () => {
    // Dynamic import for the route with ID parameter
    const routeModule = await import('@/app/api/tenants/[id]/route')
    tenantIdRoutes = routeModule
  })

  describe('GET /api/tenants/[id]', () => {
    it('should return tenant by ID', async () => {
      const tenantId = 'tenant-123'
      const mockTenant = {
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        domain: null,
        status: 'active',
        settings: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(tenantService.getTenant).mockResolvedValue(mockTenant)

      const mockRequest = new NextRequest(`http://localhost:3000/api/tenants/${tenantId}`)
      const response = await tenantIdRoutes.GET(mockRequest, { params: { id: tenantId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockTenant)
      expect(tenantService.getTenant).toHaveBeenCalledWith(tenantId)
    })

    it('should handle not found error', async () => {
      const tenantId = 'non-existent'
      const error = new Error('Tenant not found')
      vi.mocked(tenantService.getTenant).mockRejectedValue(error)

      const mockRequest = new NextRequest(`http://localhost:3000/api/tenants/${tenantId}`)
      const response = await tenantIdRoutes.GET(mockRequest, { params: { id: tenantId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Tenant not found')
    })
  })

  describe('PUT /api/tenants/[id]', () => {
    it('should update tenant successfully', async () => {
      const tenantId = 'tenant-123'
      const updateData = {
        name: 'Updated Tenant Name',
      }

      const updatedTenant = {
        id: tenantId,
        name: 'Updated Tenant Name',
        slug: 'test-tenant',
        domain: null,
        status: 'active',
        settings: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(tenantService.updateTenant).mockResolvedValue(updatedTenant)

      const mockRequest = new NextRequest(`http://localhost:3000/api/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      mockRequest.json = vi.fn().mockResolvedValue(updateData)

      const response = await tenantIdRoutes.PUT(mockRequest, { params: { id: tenantId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(updatedTenant)
      expect(tenantService.updateTenant).toHaveBeenCalledWith(tenantId, updateData)
    })
  })

  describe('DELETE /api/tenants/[id]', () => {
    it('should deactivate tenant successfully', async () => {
      const tenantId = 'tenant-123'
      const deactivatedTenant = {
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        domain: null,
        status: 'inactive',
        settings: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(tenantService.deactivateTenant).mockResolvedValue(deactivatedTenant)

      const mockRequest = new NextRequest(`http://localhost:3000/api/tenants/${tenantId}`, {
        method: 'DELETE',
      })

      const response = await tenantIdRoutes.DELETE(mockRequest, { params: { id: tenantId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(deactivatedTenant)
      expect(tenantService.deactivateTenant).toHaveBeenCalledWith(tenantId)
    })
  })
})
