# High Concurrency & Horizontal Scaling Guide

EchoSenseiX is designed for **massive scale** - supporting thousands of simultaneous users and agents with ease.

---

## 🚀 Scalability Features

### **1. Multi-Core Processing (Clustering)**

Use all CPU cores automatically:

```bash
# Enable clustering (auto-detects CPU cores)
CLUSTER_ENABLED=true

# Or specify worker count
CLUSTER_WORKERS=8
```

**How it works:**
- Primary process spawns worker processes (one per CPU core)
- Load balanced across all workers automatically
- Automatic worker restart on failure
- Graceful shutdown handling

**Configuration:**
```bash
CLUSTER_ENABLED=true           # Enable/disable (default: true)
CLUSTER_WORKERS=auto           # Number of workers (default: CPU cores)
CLUSTER_RESTART_DELAY=1000     # Delay before restart (ms)
CLUSTER_MAX_RESTARTS=10        # Max restart attempts
CLUSTER_SHUTDOWN_TIMEOUT=30000 # Graceful shutdown timeout (ms)
```

---

### **2. Distributed Caching (Redis)**

High-performance caching for concurrent requests:

```bash
# Use Redis for distributed cache
CACHE_PROVIDER=redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Cache configuration
CACHE_TTL=3600              # Default TTL (seconds)
CACHE_MAX_SIZE=10000        # Max items (memory provider)
```

**Supported Providers:**
- `memory` - In-memory LRU cache (single instance)
- `redis` - Distributed Redis cache (multi-instance)

**Usage in code:**
```typescript
import { getCache, Cached } from './cache/distributed-cache';

// Manual caching
const cache = await getCache();
await cache.set('key', value, 3600);
const value = await cache.get('key');

// Decorator-based caching
class MyService {
  @Cached(3600)
  async getExpensiveData() {
    // This result will be cached for 1 hour
  }
}
```

---

### **3. Job Queue System**

Async background processing:

```bash
# Use Redis/Bull for distributed queue
QUEUE_PROVIDER=redis          # or: memory
REDIS_HOST=localhost
REDIS_PORT=6379

# Queue configuration
QUEUE_CONCURRENCY=10          # Concurrent job processors
QUEUE_MAX_RETRIES=3           # Max retry attempts
```

**Supported Providers:**
- `memory` - In-memory queue (single instance)
- `redis` / `bull` - Distributed Bull queue (multi-instance)

**Usage:**
```typescript
import { getQueue } from './queue/queue-manager';

const queue = await getQueue();

// Register job handler
queue.registerHandler('process-document', async (job) => {
  // Process document asynchronously
  await processDocument(job.data);
});

// Add jobs
await queue.addJob('process-document', {
  documentId: '123',
  userId: '456',
}, { priority: 10 });

// Check status
const stats = await queue.getStats();
```

---

### **4. Database Connection Pooling**

Optimized for high concurrency:

```typescript
// PostgreSQL
DATABASE_URL=postgresql://...
DATABASE_MAX_CONNECTIONS=100   # Increased from 50
DATABASE_MIN_CONNECTIONS=10    # Keep warm connections

// MongoDB
DATABASE_URL=mongodb://...
DATABASE_MAX_CONNECTIONS=100
```

**Settings:**
- **Max Connections**: 100 (supports 100+ concurrent queries)
- **Min Connections**: 10 (keeps warm pool)
- **Statement Timeout**: 30s (prevents long-running queries)
- **Acquire Timeout**: 10s (timeout for getting connection)

---

### **5. Health Checks & Monitoring**

Built-in endpoints for load balancers:

```bash
# Liveness probe (is service running?)
GET /health/live

# Readiness probe (is service ready for traffic?)
GET /health/ready

# Detailed health + metrics
GET /health

# Prometheus metrics
GET /metrics
```

**Response Example:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": { "status": "pass", "responseTime": 5 },
    "cache": { "status": "pass", "responseTime": 1 },
    "queue": { "status": "pass" },
    "memory": { "status": "pass", "message": "Heap: 45% used" }
  }
}
```

---

## 📊 Deployment Architectures

### **Single Server (Vertical Scaling)**

```
┌─────────────────────────────────┐
│      EchoSenseiX Server         │
│  ┌───────────────────────────┐  │
│  │  Cluster (8 workers)      │  │
│  │  ├─ Worker 1              │  │
│  │  ├─ Worker 2              │  │
│  │  ├─ Worker 3              │  │
│  │  └─ ...                   │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │  Redis (cache + queue)    │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │  PostgreSQL (pooled)      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Handles:** 1,000-5,000 concurrent connections

**Environment:**
```bash
CLUSTER_ENABLED=true
CLUSTER_WORKERS=auto
CACHE_PROVIDER=redis
QUEUE_PROVIDER=redis
DATABASE_MAX_CONNECTIONS=100
```

---

### **Multi-Server (Horizontal Scaling)**

```
                    Load Balancer
                    (NGINX/HAProxy)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
    Server 1          Server 2          Server 3
    (8 workers)       (8 workers)       (8 workers)
        │                 │                 │
        └─────────────────┴─────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
   Redis Cluster                    PostgreSQL
(cache + queue + sessions)      (primary + replicas)
```

**Handles:** 10,000-100,000+ concurrent connections

**Environment (per server):**
```bash
CLUSTER_ENABLED=true
CLUSTER_WORKERS=auto

# Shared Redis
CACHE_PROVIDER=redis
QUEUE_PROVIDER=redis
REDIS_HOST=redis-cluster.internal
SESSION_STORE=redis

# Shared Database
DATABASE_URL=postgresql://...
DATABASE_MAX_CONNECTIONS=50  # Per server

# Load balancer health checks
HEALTH_CHECK_ENABLED=true
```

---

### **Kubernetes/Docker (Container Orchestration)**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echosenseix
spec:
  replicas: 5  # Scale to 5 instances
  template:
    spec:
      containers:
      - name: echosenseix
        image: echosenseix:latest
        env:
        - name: CLUSTER_ENABLED
          value: "false"  # K8s handles clustering
        - name: CACHE_PROVIDER
          value: "redis"
        - name: REDIS_HOST
          value: "redis-service"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 5000
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 5000
```

**Handles:** Unlimited (auto-scales)

---

## ⚡ Performance Optimization Tips

### **1. Enable All Concurrent Features**

```bash
# Full concurrency stack
CLUSTER_ENABLED=true
CLUSTER_WORKERS=auto

CACHE_PROVIDER=redis
QUEUE_PROVIDER=redis

DATABASE_MAX_CONNECTIONS=100
DATABASE_MIN_CONNECTIONS=20
```

### **2. Optimize Redis**

```bash
# Redis configuration (redis.conf)
maxmemory 2gb
maxmemory-policy allkeys-lru
tcp-backlog 511
timeout 0
tcp-keepalive 300
```

### **3. Database Tuning**

PostgreSQL:
```sql
-- Increase max connections
ALTER SYSTEM SET max_connections = 200;

-- Optimize for concurrency
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '16MB';

-- Connection pooling
ALTER SYSTEM SET max_prepared_transactions = 100;
```

### **4. OS Limits**

```bash
# Increase file descriptors
ulimit -n 65536

# Increase socket backlog
sysctl -w net.core.somaxconn=65536
sysctl -w net.ipv4.tcp_max_syn_backlog=8192
```

---

## 📈 Load Testing

Test your setup with Apache Bench or k6:

```bash
# Simple load test
ab -n 10000 -c 100 http://localhost:5000/health/ready

# WebSocket load test
npm install -g artillery
artillery quick --count 100 --num 1000 ws://localhost:5000/
```

---

## 🔍 Monitoring

### **Built-in Metrics**

```bash
# Get metrics
curl http://localhost:5000/metrics

# Response (Prometheus format)
process_uptime_seconds 3600
process_memory_heap_used_bytes 45678901
cache_hits_total 1234
cache_misses_total 56
queue_pending_total 0
queue_processing_total 3
```

### **External Monitoring**

Integrate with:
- **Prometheus** - Metrics collection
- **Grafana** - Dashboards
- **Datadog** - APM & monitoring
- **New Relic** - Performance monitoring
- **CloudWatch** - AWS monitoring

---

## 🎯 Scaling Checklist

**For 1,000 concurrent users:**
- [x] Enable clustering
- [x] Use Redis cache
- [x] Connection pooling (50+)

**For 10,000 concurrent users:**
- [x] Multi-server deployment
- [x] Load balancer (NGINX/HAProxy)
- [x] Redis cluster
- [x] Database read replicas
- [x] CDN for static assets
- [x] Connection pooling (100+)

**For 100,000+ concurrent users:**
- [x] Kubernetes/ECS orchestration
- [x] Auto-scaling groups
- [x] Multi-region deployment
- [x] Database sharding
- [x] Message queue (Redis/RabbitMQ/Kafka)
- [x] Distributed tracing
- [x] APM monitoring

---

## 🚨 Common Issues

### **Memory Leaks**

Monitor with:
```bash
# Check memory usage
GET /health

# If heap > 90%, investigate:
- Long-running connections
- Cached data not expiring
- Event listener leaks
```

### **Connection Pool Exhaustion**

Symptoms:
- Timeouts acquiring connections
- 503 errors

Solutions:
```bash
# Increase pool size
DATABASE_MAX_CONNECTIONS=150

# Add connection timeout
DATABASE_ACQUIRE_TIMEOUT=10000

# Monitor with /health
```

### **Redis Connection Issues**

```bash
# Check Redis
redis-cli ping

# Monitor connections
redis-cli info clients

# Increase max clients
maxclients 10000
```

---

## 📚 Related Documentation

- [Platform-Agnostic Architecture](./PLATFORM_AGNOSTIC_ARCHITECTURE.md)
- [Database Integration Guide](./DATABASE_INTEGRATION_GUIDE.md)
- [File Upload Guide](./FILE_UPLOAD_GUIDE.md)

---

## 🎓 Best Practices

1. **Always enable clustering** in production
2. **Use Redis** for cache and sessions in multi-server setups
3. **Monitor health endpoints** with your load balancer
4. **Set appropriate timeouts** to prevent hanging connections
5. **Use job queues** for CPU-intensive tasks
6. **Scale horizontally** before vertically
7. **Test under load** before going to production
8. **Monitor metrics** continuously

---

**EchoSenseiX is built to scale from 1 to 1,000,000 users.** 🚀
