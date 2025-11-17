# Performance Optimization Integration Guide

## Overview

This guide explains how the performance optimization systems have been integrated into the WorkshopsAI CMS application and how to use them effectively.

## 🚀 Integrated Systems

### 1. Performance Monitoring System
- **Location**: `src/services/enhanced-performance-monitoring-service.ts`
- **Routes**: `/api/v1/performance/*`
- **Features**: Real-time metrics, anomaly detection, performance trends

### 2. Multi-Level Caching System
- **Location**: `src/services/enhanced-caching-service.ts`
- **Tiers**: L1 (Memory), L2 (Redis), L3 (Database)
- **Features**: Predictive caching, intelligent invalidation

### 3. Database Optimization System
- **Location**: `src/services/database-optimization-integration.ts`
- **Features**: Query optimization, index management, connection pooling

### 4. Streaming LLM Worker
- **Location**: `src/services/streaming-llm-worker.ts`
- **Features**: Memory-optimized streaming, real-time progress updates

## 📊 API Endpoints

### Performance Monitoring
```bash
GET /api/v1/performance/metrics          # Real-time performance metrics
GET /api/v1/performance/trends           # Historical performance trends
GET /api/v1/performance/anomalies        # Performance anomaly detection
GET /api/v1/performance/recommendations  # Optimization recommendations
GET /api/v1/performance/dashboard        # Complete dashboard data
```

### Caching Management
```bash
GET /api/v1/performance/cache/stats      # Cache statistics
POST /api/v1/performance/cache/warm      # Warm cache with data
DELETE /api/v1/performance/cache/clear   # Clear cache tiers
GET /api/v1/performance/cache/analytics  # Cache performance analytics
```

### Database Optimization
```bash
GET /api/v1/performance/database/queries # Slow query analysis
GET /api/v1/performance/database/indexes # Index usage statistics
POST /api/v1/performance/database/optimize # Run optimization tasks
GET /api/v1/performance/database/health  # Database health metrics
```

## 🔧 Configuration

### Environment Variables
```bash
# Performance System
PERFORMANCE_MONITORING_ENABLED=true
PERFORMANCE_ALERT_THRESHOLD=1000
PERFORMANCE_SAMPLE_RATE=1.0

# Caching Configuration
CACHE_TTL_DEFAULT=300
CACHE_MAX_MEMORY_SIZE=100
CACHE_PREDICTION_ENABLED=true

# Database Optimization
DB_SLOW_QUERY_THRESHOLD=1000
DB_CONNECTION_POOL_SIZE=20
DB_AUTO_OPTIMIZE=true
```

### Performance Integration
```typescript
import { initializePerformanceSystem } from './config/performance-integration';

// Initialize in your main application
const performanceSystem = initializePerformanceSystem(app, server);
```

## 📈 Monitoring Dashboard

### Key Metrics
- **Response Time**: Average API response time (target: <500ms)
- **Throughput**: Requests per second (target: >100 req/s)
- **Error Rate**: Percentage of failed requests (target: <1%)
- **Memory Usage**: Application memory consumption (target: <512MB)
- **Cache Hit Rate**: Percentage of requests served from cache (target: >80%)

### Real-time Alerts
- High response time alerts (>2s)
- Memory usage warnings (>400MB)
- Error rate spikes (>5%)
- Cache miss rate warnings (>30%)

## 🚦 Performance Tiers

### L1 Cache (Memory)
- **Size**: 100MB default
- **TTL**: 5 minutes default
- **Use Case**: Hot data, frequently accessed

### L2 Cache (Redis)
- **Size**: Configurable
- **TTL**: 1 hour default
- **Use Case**: Warm data, computed results

### L3 Cache (Database)
- **Size**: Query result cache
- **TTL**: 24 hours default
- **Use Case**: Cold data, complex queries

## 🔄 Usage Examples

### Monitoring Performance
```typescript
// Get current performance metrics
const response = await fetch('/api/v1/performance/metrics');
const metrics = await response.json();

console.log('Average Response Time:', metrics.responseTime);
console.log('Cache Hit Rate:', metrics.cacheHitRate);
console.log('Error Rate:', metrics.errorRate);
```

### Warming Cache
```typescript
// Warm cache with frequently accessed data
await fetch('/api/v1/performance/cache/warm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patterns: ['questionnaires', 'responses', 'analyses']
  })
});
```

### Database Optimization
```typescript
// Run database optimization
await fetch('/api/v1/performance/database/optimize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    analyzeIndexes: true,
    optimizeQueries: true,
    updateStatistics: true
  })
});
```

## 📊 Health Check Integration

The enhanced health check now includes performance optimization status:

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "database": "connected",
  "redis": "connected",
  "llmServices": {
    "embeddings": { "status": "active" },
    "analysisWorker": { "status": "active" },
    "streamingWorker": { "status": "active", "activeJobs": 3 },
    "performanceSystem": { "status": "active" },
    "dbOptimization": { "status": "active" }
  }
}
```

## 🔍 Troubleshooting

### Common Issues

#### Performance System Not Starting
```bash
# Check logs for initialization errors
npm run dev | grep "Performance"

# Verify Redis connection
npm run health-check
```

#### High Memory Usage
```bash
# Check cache memory usage
curl http://localhost:3001/api/v1/performance/cache/stats

# Clear L1 cache if needed
curl -X DELETE http://localhost:3001/api/v1/performance/cache/clear?tier=l1
```

#### Slow Database Queries
```bash
# Analyze slow queries
curl http://localhost:3001/api/v1/performance/database/queries?slow=true

# Optimize database
curl -X POST http://localhost:3001/api/v1/performance/database/optimize
```

### Performance Tuning

#### Adjust Cache Settings
```typescript
// In performance-integration.ts
const cacheConfig = {
  l1: { maxSize: 200, ttl: 600 }, // Increase memory cache
  l2: { ttl: 7200 }, // Increase Redis TTL
  l3: { ttl: 86400 } // 24-hour database cache
};
```

#### Optimize Database Pool
```typescript
// In database configuration
const poolConfig = {
  min: 5,
  max: 30, // Increase pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
```

## 📚 Advanced Usage

### Custom Performance Metrics
```typescript
import { performanceSystem } from './config/performance-integration';

// Track custom metrics
performanceSystem.trackMetric('custom_operation', {
  duration: 150,
  success: true,
  metadata: { userId: '123', operation: 'analysis' }
});
```

### Cache Event Listeners
```typescript
import { cachingService } from './services/enhanced-caching-service';

// Listen to cache events
cachingService.on('cache_miss', (key) => {
  console.log(`Cache miss for key: ${key}`);
});

cachingService.on('cache_hit', (key) => {
  console.log(`Cache hit for key: ${key}`);
});
```

### Database Query Enhancement
```typescript
import { dbOptimization } from './services/database-optimization-integration';

// Enhance queries automatically
const enhancedQuery = dbOptimization.enhanceQuery(
  'SELECT * FROM responses WHERE questionnaireId = ?',
  ['questionnaire-123']
);
```

## 🎯 Best Practices

1. **Monitor Regularly**: Check performance metrics daily
2. **Cache Strategically**: Cache frequently accessed data
3. **Optimize Queries**: Use query enhancement for complex operations
4. **Set Alerts**: Configure alerts for performance degradation
5. **Test Performance**: Use the performance test suite regularly
6. **Review Logs**: Monitor performance logs for issues
7. **Update Configuration**: Adjust settings based on usage patterns

## 📞 Support

For performance optimization issues:
1. Check the health endpoint: `/health`
2. Review performance logs
3. Monitor the performance dashboard
4. Run optimization tasks manually if needed
5. Check documentation in `/docs/` directory

The performance optimization system is now fully integrated and ready for production use!