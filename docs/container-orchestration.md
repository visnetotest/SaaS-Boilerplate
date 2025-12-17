# =============================================================================
# CONTAINER ORCHESTRATION AND MICROSERVICES MIGRATION
# =============================================================================

## 🎯 **Overview**

This document covers the complete container orchestration setup and microservices migration strategy for the SaaS Boilerplate platform.

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX (Load Balancer)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │    App      │  │ API Gateway  │  │   Service   │   │
│  │  (Next.js)  │  │   (Router)  │  │  Registry   │   │
│  │   :3000     │  │   :3002     │  │   :3001     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Auth      │  │    User     │  │Notification │   │
│  │  Service    │  │   Service   │  │   Service   │   │
│  │   :3003     │  │   :3004     │  │   :3005     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ PostgreSQL  │  │    Redis    │  │ Prometheus  │   │
│  │   Database  │  │    Cache    │  │ Monitoring  │   │
│  │   :5432     │  │   :6379     │  │   :9090     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                         │
│  ┌─────────────┐                                         │
│  │   Grafana   │                                         │
│  │ Dashboard  │                                         │
│  │   :3006     │                                         │
│  └─────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 **Container Configuration**

### Main Application
- **Base Image**: `node:18-alpine`
- **Port**: `3000`
- **Health Check**: `/api/health`
- **Replicas**: `2` (production)

### Microservices

#### Service Registry
- **Port**: `3001`
- **Purpose**: Service discovery and lifecycle management
- **Features**: 
  - Service registration/deregistration
  - Health monitoring
  - Configuration management
  - Multi-tenant support

#### API Gateway  
- **Port**: `3002`
- **Purpose**: Intelligent request routing and load balancing
- **Load Balancing Strategies**:
  - Round Robin
  - Least Connections
  - Weighted Round Robin
  - Response Time Based
  - Health Score (recommended)

#### Authentication Service
- **Port**: `3003`
- **Purpose**: User authentication and authorization
- **Features**:
  - JWT tokens (access + refresh)
  - Password hashing with bcrypt
  - Rate limiting
  - Account management

#### User Management Service
- **Port**: `3004`
- **Purpose**: User profile and role management
- **Features**:
  - Profile CRUD operations
  - Role-based access control (RBAC)
  - Tenant isolation

#### Notification Service
- **Port**: `3005`
- **Purpose**: Multi-channel notifications
- **Features**:
  - Email notifications (SendGrid)
  - Push notifications
  - SMS support
  - In-app notifications

## 🚀 **Deployment Options**

### 1. Docker Compose (Development)

```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f

# Stop environment
docker-compose down

# Scale services
docker-compose up -d --scale auth-service=3 --scale user-service=2
```

### 2. Docker Compose Production

```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# With environment file
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### 3. Kubernetes Deployment

```bash
# Apply namespaces
kubectl apply -f k8s/namespaces/

# Apply configmaps
kubectl apply -f k8s/configmaps/

# Apply deployments
kubectl apply -f k8s/deployments/

# Apply services
kubectl apply -f k8s/services/

# Apply ingress
kubectl apply -f k8s/ingress/
```

## 🔧 **Environment Variables**

### Required Environment Variables

```bash
# Application
NODE_ENV=production
NEXTAUTH_SECRET=your-super-secret-jwt-key
NEXTAUTH_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://username:password@host:5432/database
POSTGRES_PASSWORD=secure_password

# Redis
REDIS_URL=redis://host:6379

# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# Services
SENDGRID_API_KEY=your-sendgrid-key
GRAFANA_PASSWORD=admin_password
```

### Optional Environment Variables

```bash
# Load Balancing
DEFAULT_LOAD_BALANCING_STRATEGY=health-score
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=15

# Health Checks
HEALTH_CHECK_INTERVAL=30
HEALTH_CHECK_TIMEOUT=5
HEALTH_CHECK_RETRIES=3

# Resources
CPU_LIMIT=1000m
MEMORY_LIMIT=1G
CPU_RESERVATION=500m
MEMORY_RESERVATION=512M
```

## 📊 **Monitoring and Observability**

### Prometheus Metrics

All services expose Prometheus-compatible metrics at `/metrics`:

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `http_response_status_codes` - Response status distribution
- `service_health_status` - Service health status
- `active_connections` - Active connections count

### Grafana Dashboards

Pre-configured dashboards available:

1. **Service Overview**
   - Service health status
   - Request rates
   - Error rates
   - Response times

2. **Infrastructure**
   - CPU and memory usage
   - Network traffic
   - Database connections
   - Redis operations

3. **Business Metrics**
   - User registrations
   - Authentication events
   - Notification deliveries
   - API usage patterns

### Health Check Endpoints

Each service provides comprehensive health information:

```json
GET /health

{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "service-name",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "database": "healthy",
    "redis": "healthy"
  },
  "metrics": {
    "requests_total": 1250,
    "errors_total": 12,
    "avg_response_time": 145
  }
}
```

## 🔒 **Security Configuration**

### Network Security

- All services run in isolated Docker networks
- Internal service communication via service names
- External access only through NGINX reverse proxy
- TLS termination at load balancer

### Authentication & Authorization

- JWT-based authentication with refresh tokens
- Rate limiting on authentication endpoints
- CORS properly configured
- Security headers (Helmet.js)

### Secrets Management

```bash
# Kubernetes secrets
kubectl create secret generic saas-secrets \
  --from-literal=jwt-secret=your-secret \
  --from-literal=database-password=your-password \
  --from-literal=sendgrid-key=your-api-key

# Docker Compose secrets
echo "JWT_SECRET=your-secret" >> .env
echo "DATABASE_PASSWORD=your-password" >> .env
```

## 🚨 **Scaling Strategies**

### Horizontal Scaling

#### Manual Scaling
```bash
# Docker Compose
docker-compose up -d --scale auth-service=5

# Kubernetes
kubectl scale deployment auth-service --replicas=5
```

#### Auto Scaling
```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Load Balancing Optimization

#### Strategy Selection Guidelines:

1. **Round Robin**: Default, good for equal-capacity instances
2. **Least Connections**: Best for long-running requests
3. **Weighted Round Robin**: When instances have different capacities
4. **Response Time**: For latency-sensitive applications
5. **Health Score**: **Recommended** - combines response time and error rate

#### Dynamic Strategy Switching

```bash
# Change load balancing strategy via API
curl -X POST http://api-gateway:3002/api/gateway/strategies \
  -H "Content-Type: application/json" \
  -d '{"strategy": "health-score"}'
```

## 🔄 **Service Migration Process**

### Phase 1: Infrastructure Setup
1. ✅ Containerize main application
2. ✅ Create service registry
3. ✅ Implement API gateway
4. ✅ Set up monitoring

### Phase 2: Core Services Migration
1. 🔄 Authentication service (in progress)
2. ⏳ User management service
3. ⏳ Notification service
4. ⏳ File storage service

### Phase 3: Business Logic Migration
1. ⏳ Analytics service
2. ⏳ Billing service
3. ⏳ Reporting service
4. ⏳ Plugin execution service

### Migration Checklist

For each service to migrate:

- [ ] Extract business logic to separate service
- [ ] Define service contracts (API interfaces)
- [ ] Implement health checks
- [ ] Add monitoring/metrics
- [ ] Create Docker configuration
- [ ] Write Kubernetes manifests
- [ ] Update API gateway routing
- [ ] Test integration
- [ ] Update documentation
- [ ] Deploy to staging
- [ ] Perform blue-green deployment

## 🛠️ **Development Workflow**

### Local Development

```bash
# Start all services
make dev-up

# Start individual service
make dev-service SERVICE=auth

# View logs
make dev-logs SERVICE=auth

# Stop all services
make dev-down
```

### Testing

```bash
# Run unit tests
make test

# Run integration tests
make test-integration

# Run E2E tests
make test-e2e

# Load testing
make test-load
```

### Deployment

```bash
# Build Docker images
make build

# Deploy to staging
make deploy-staging

# Deploy to production
make deploy-production

# Rollback deployment
make rollback
```

## 📈 **Performance Optimization**

### Database Optimization

- Connection pooling
- Read replicas for read-heavy services
- Query optimization
- Index strategy

### Caching Strategy

- Redis for session storage
- Application-level caching
- CDN for static assets
- Edge caching for APIs

### Resource Management

- CPU/memory limits per service
- Horizontal pod autoscaling
- Cluster autoscaling
- Resource monitoring and alerts

## 🚨 **Troubleshooting**

### Common Issues

1. **Service Discovery Problems**
   - Check service registry health
   - Verify network connectivity
   - Review service registration

2. **Load Balancing Issues**
   - Check API gateway health
   - Verify service health status
   - Review load balancing strategy

3. **Authentication Failures**
   - Check JWT secret consistency
   - Verify Redis connectivity
   - Review token expiration

### Debug Commands

```bash
# Check service status
kubectl get pods -n saas-platform

# View service logs
kubectl logs -f deployment/auth-service -n saas-platform

# Check health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health

# Monitor metrics
curl http://localhost:9090/targets
```

## 📚 **Additional Resources**

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/docs/)
- [NGINX Configuration](https://nginx.org/en/docs/)

## 🔄 **Continuous Integration**

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: make test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker images
        run: make build
      - name: Push to registry
        run: make push

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: make deploy-production
```

This comprehensive container orchestration setup provides a production-ready microservices architecture with intelligent load balancing, comprehensive monitoring, and automated scaling capabilities.