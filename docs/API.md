# SaaS Boilerplate API Documentation

## Overview

This document describes the RESTful API for the SaaS Boilerplate platform. The API provides endpoints for managing tenants, organizations, users, and roles in a multi-tenant SaaS application.

## Base URL

```
https://api.yourdomain.com
```

## Authentication

The API uses Bearer token authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

API requests are limited to 100 requests per minute per IP address.

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid-v4",
    "version": "1.0.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "details": {
    // Additional error details (for validation errors)
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid-v4",
    "version": "1.0.0"
  }
}
```

## HTTP Status Codes

- `200` - OK: Request successful
- `201` - Created: Resource created successfully
- `400` - Bad Request: Invalid request data
- `401` - Unauthorized: Authentication required or invalid
- `403` - Forbidden: Insufficient permissions
- `404` - Not Found: Resource not found
- `409` - Conflict: Resource already exists
- `422` - Unprocessable Entity: Validation failed
- `429` - Too Many Requests: Rate limit exceeded
- `500` - Internal Server Error: Server error

## API Endpoints

### Tenants

#### List Tenants

```http
GET /api/tenants
```

**Query Parameters:**

- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `status` (string, optional): Filter by status (`active`, `inactive`, `suspended`)
- `search` (string, optional): Search by name

**Example Request:**

```bash
curl -X GET "https://api.yourdomain.com/api/tenants?page=1&limit=10&status=active" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid-v4",
        "name": "Demo Corporation",
        "slug": "demo-corp",
        "domain": "demo-corp.com",
        "status": "active",
        "settings": {
          "theme": "light"
        },
        "metadata": {},
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### Create Tenant

```http
POST /api/tenants
```

**Request Body:**

```json
{
  "name": "New Tenant",
  "slug": "new-tenant",
  "settings": {
    "theme": "dark",
    "timezone": "UTC"
  },
  "metadata": {
    "source": "api"
  }
}
```

**Example Request:**

```bash
curl -X POST "https://api.yourdomain.com/api/tenants" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Tenant",
    "slug": "new-tenant"
  }'
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "name": "New Tenant",
    "slug": "new-tenant",
    "status": "active",
    "settings": {
      "theme": "dark",
      "timezone": "UTC"
    },
    "metadata": {
      "source": "api"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get Tenant

```http
GET /api/tenants/{id}
```

**Path Parameters:**

- `id` (string, required): Tenant ID

**Example Request:**

```bash
curl -X GET "https://api.yourdomain.com/api/tenants/uuid-v4" \
  -H "Authorization: Bearer <token>"
```

#### Update Tenant

```http
PUT /api/tenants/{id}
```

**Request Body:**

```json
{
  "name": "Updated Tenant Name",
  "settings": {
    "theme": "light"
  }
}
```

#### Delete Tenant

```http
DELETE /api/tenants/{id}
```

**Note:** This deactivates the tenant rather than permanently deleting it.

### Organizations

#### List Organizations

```http
GET /api/organizations
```

**Query Parameters:**

- `tenantId` (string, required): Tenant ID
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `search` (string, optional): Search by name

**Example Request:**

```bash
curl -X GET "https://api.yourdomain.com/api/organizations?tenantId=uuid-v4&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

#### Create Organization

```http
POST /api/organizations
```

**Request Body:**

```json
{
  "tenantId": "uuid-v4",
  "name": "Engineering Department",
  "description": "Main engineering team",
  "website": "https://example.com/engineering",
  "industry": "Technology",
  "size": "51-200",
  "settings": {
    "budget": 500000
  }
}
```

#### Get Organization

```http
GET /api/organizations/{id}
```

**Query Parameters:**

- `tenantId` (string, optional): Tenant ID for access control

### Users

#### List Users

```http
GET /api/users
```

**Query Parameters:**

- `tenantId` (string, required): Tenant ID
- `organizationId` (string, optional): Organization ID
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `search` (string, optional): Search by email or name
- `status` (string, optional): Filter by status

#### Create User

```http
POST /api/users
```

**Request Body:**

```json
{
  "tenantId": "uuid-v4",
  "organizationId": "uuid-v4",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "roleIds": ["role-uuid-1", "role-uuid-2"],
  "preferences": {
    "theme": "dark",
    "notifications": true
  }
}
```

#### Get User

```http
GET /api/users/{id}
```

### Roles

#### List Roles

```http
GET /api/roles
```

**Query Parameters:**

- `tenantId` (string, required): Tenant ID
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `search` (string, optional): Search by name

#### Create Role

```http
POST /api/roles
```

**Request Body:**

```json
{
  "tenantId": "uuid-v4",
  "name": "Manager",
  "description": "Team management access",
  "permissions": ["users.read", "users.write", "organizations.read"],
  "isSystem": false
}
```

## Error Handling

### Validation Errors

When request data fails validation, the API returns a 422 status with detailed error information:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "code": "too_small",
      "message": "Name must be at least 1 character(s)",
      "path": ["name"]
    },
    {
      "code": "invalid_string",
      "message": "Slug must match pattern: /^[a-z0-9-]+$/",
      "path": ["slug"]
    }
  ]
}
```

### Common Error Scenarios

#### Duplicate Resource

```json
{
  "success": false,
  "error": "Slug 'demo-corp' is already taken"
}
```

#### Resource Not Found

```json
{
  "success": false,
  "error": "Tenant not found"
}
```

#### Insufficient Permissions

```json
{
  "success": false,
  "error": "Forbidden: Insufficient permissions to access this resource"
}
```

## Pagination

List endpoints support pagination. The response includes pagination metadata:

```json
{
  "data": {
    "data": [...],
    "total": 150,
    "page": 2,
    "limit": 20,
    "hasNext": true,
    "hasPrev": true
  }
}
```

- `total`: Total number of items
- `page`: Current page number (1-based)
- `limit`: Items per page
- `hasNext`: Whether there are more pages
- `hasPrev`: Whether there are previous pages

## Multi-Tenancy

The API is designed for multi-tenancy. Most endpoints require a `tenantId` parameter to ensure data isolation:

1. **Tenant Isolation**: Each tenant's data is completely isolated
2. **User Scoping**: Users can only access data within their tenant
3. **Role-Based Access**: Permissions are enforced within tenant boundaries

## SDK and Libraries

### JavaScript/TypeScript

```bash
npm install @your-org/saas-api-client
```

```typescript
import { SaaSClient } from '@your-org/saas-api-client'

const client = new SaaSClient({
  baseURL: 'https://api.yourdomain.com',
  apiKey: 'your-api-key',
})

const tenants = await client.tenants.list({ page: 1, limit: 10 })
const tenant = await client.tenants.create({
  name: 'New Tenant',
  slug: 'new-tenant',
})
```

### Python

```bash
pip install saas-api-client
```

```python
from saas_api_client import SaaSClient

client = SaaSClient(
    base_url='https://api.yourdomain.com',
    api_key='your-api-key'
)

tenants = client.tenants.list(page=1, limit=10)
tenant = client.tenants.create(
    name='New Tenant',
    slug='new-tenant'
)
```

## Webhooks

The API supports webhooks for real-time notifications:

### Configure Webhooks

Send a POST request to `/api/webhooks` with:

```json
{
  "url": "https://your-domain.com/webhook",
  "events": ["user.created", "tenant.updated"],
  "secret": "webhook-secret"
}
```

### Webhook Events

- `tenant.created`
- `tenant.updated`
- `tenant.deleted`
- `user.created`
- `user.updated`
- `user.deleted`
- `organization.created`
- `organization.updated`
- `organization.deleted`

### Webhook Payload

```json
{
  "event": "user.created",
  "data": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "signature": "sha256=..."
}
```

## Rate Limits

| Endpoint          | Rate Limit    | Window   |
| ----------------- | ------------- | -------- |
| All endpoints     | 100 requests  | 1 minute |
| Auth endpoints    | 10 requests   | 1 minute |
| Webhook endpoints | 1000 requests | 1 hour   |

Rate limit headers are included in responses:

- `X-RateLimit-Limit`: Rate limit ceiling
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when rate limit resets

## Support

For API support and questions:

- **Documentation**: https://docs.yourdomain.com
- **Status Page**: https://status.yourdomain.com
- **Support Email**: api-support@yourdomain.com
- **GitHub Issues**: https://github.com/your-org/saas-boilerplate/issues

## Changelog

### v1.0.0 (2024-01-01)

- Initial API release
- Tenant management endpoints
- Organization management endpoints
- User management endpoints
- Role management endpoints
- Multi-tenancy support
- Webhook support
