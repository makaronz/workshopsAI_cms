# Performance Monitoring and Caching System Guide

This comprehensive guide explains how to use the Performance Monitoring and Caching System implemented for the WorkshopsAI CMS project.

## Overview

The system consists of several interconnected components:

1. **Enhanced Performance Monitoring Service** - Real-time metrics collection and analysis
2. **Enhanced Multi-Level Caching Service** - Intelligent caching across multiple tiers
3. **Enhanced Performance Middleware** - Request-level performance tracking
4. **Performance Analytics Dashboard API** - RESTful API for performance data
5. **Performance Integration Configuration** - Easy setup and configuration

## Features

### Performance Monitoring Service
- Real-time metrics collection (response times, memory usage, error rates)
- Performance trend analysis and anomaly detection
- Alert system for performance degradation
- Performance bottleneck identification
- Automated optimization recommendations
- Event-driven architecture for real-time monitoring
- WebSocket support for live updates

### Multi-Level Caching System
- **L1**: In-memory cache with LRU eviction
- **L2**: Redis cache with configurable TTL
- **L3**: Database query result caching
- Advanced cache warming strategies
- Intelligent cache invalidation
- Predictive cache preloading
- Memory-efficient data structures

### Performance Analytics Dashboard
- Real-time performance metrics API
- Historical performance data analysis
- Performance bottleneck identification
- Automated optimization recommendations
- Comprehensive cache analytics

## Quick Start

### 1. Basic Integration

```typescript
import express from 'express';
import { createServer } from 'http';
import { initializePerformanceSystem, configureForEnvironment } from './config/performance-integration';

const app = express();
const server = createServer(app);

// Initialize performance system
const config = configureForEnvironment(process.env.NODE_ENV);
await initializePerformanceSystem(app, server, config);

app.listen(3001, () => {
  console.log('Server running on port 3001 with performance monitoring');
});
```

### 2. Using Enhanced Middleware

```typescript
import {
  enhancedRequestTiming,
  intelligentCache,
  adaptiveRateLimit
} from './config/performance-integration';

// Apply to specific routes
app.use('/api/workshops', [
  enhancedRequestTiming(),
  intelligentCache({ ttl: 600 }), // 10 minutes cache
  adaptiveRateLimit({ max: 100 })
]);
```

### 3. Custom Monitoring

```typescript
import { enhancedPerformanceMonitoringService } from './services/enhanced-performance-monitoring-service';

// Track custom metrics
enhancedPerformanceMonitoringService.trackEndpoint('/api/custom', 250, 200);

// Get current metrics
const metrics = enhancedPerformanceMonitoringService.getCurrentMetrics();
console.log('Current performance:', metrics);

// Get health score
const healthScore = enhancedPerformanceMonitoringService.getHealthScore();
console.log('System health:', healthScore);
```

### 4. Advanced Caching

```typescript
import { enhancedCachingService } from './services/enhanced-caching-service';

// Cache with intelligent tier selection
const data = await enhancedCachingService.getOrSet(
  'user:123:profile',
  async () => await getUserProfile(123),
  {
    ttl: 3600,
    priority: 'high',
    predictive: true,
    tags: ['user', 'profile']
  }
);

// Warm cache with custom strategy
enhancedCachingService.addWarmingStrategy({
  name: 'popular_workshops',
  description: 'Warm cache with popular workshop data',
  enabled: true,
  patterns: ['workshop:popular:*'],
  priority: 1,
  warmupFunction: async () => {
    const workshops = await getPopularWorkshops();
    for (const workshop of workshops) {
      await enhancedCachingService.set(
        `workshop:${workshop.id}`,
        workshop,
        { ttl: 1800, priority: 'high' }
      );
    }
  }
});
```

## API Endpoints

### Performance Dashboard

#### GET `/api/performance/enhanced/dashboard`
Get comprehensive dashboard data with all metrics.

**Response:**
```json
{
  "overview": {
    "healthScore": 85,
    "status": "healthy",
    "lastUpdated": "2024-01-15T10:30:00Z"
  },
  "keyMetrics": {
    "responseTime": 245,
    "errorRate": 0.02,
    "memoryUsage": 65.5,
    "requestsPerSecond": 12.3,
    "cacheHitRate": 78.9
  },
  "alerts": {
    "active": 2,
    "critical": 0,
    "recent": [...]
  },
  "bottlenecks": {
    "count": 1,
    "critical": 0,
    "top3": [...]
  },
  "recommendations": [...],
  "cache": {...}
}
```

#### GET `/api/performance/enhanced/health`
Get system health status.

#### GET `/api/performance/enhanced/metrics`
Get detailed performance metrics.

#### GET `/api/performance/enhanced/bottlenecks`
Get identified performance bottlenecks.

#### GET `/api/performance/enhanced/recommendations`
Get optimization recommendations.

#### GET `/api/performance/enhanced/analytics`
Get comprehensive cache analytics.

### Cache Management

#### POST `/api/performance/enhanced/cache/warm`
Trigger cache warming.

**Query Parameters:**
- `strategy` (optional): Specific warming strategy name

#### POST `/api/performance/enhanced/cache/invalidate`
Invalidate cache entries.

**Body:**
```json
{
  "key": "user:123",        // Optional: specific key
  "tag": "user",           // Optional: cache tag
  "all": true              // Optional: clear all cache
}
```

### Monitoring Control

#### POST `/api/performance/enhanced/monitoring/start`
Start performance monitoring.

#### POST `/api/performance/enhanced/monitoring/stop`
Stop performance monitoring.

## Configuration

### Environment Variables

```bash
# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
PERFORMANCE_MONITORING_INTERVAL=30000
PERFORMANCE_LOG_LEVEL=info

# Caching
CACHE_L1_MAX_SIZE=1000
CACHE_L1_MAX_MEMORY=104857600
CACHE_L2_DEFAULT_TTL=3600
CACHE_WARMING_ENABLED=true
CACHE_PREDICTIVE_WARMING=true

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Advanced Configuration

```typescript
const config = {
  enableMonitoring: true,
  enableCaching: true,
  enableEnhancedMiddleware: true,
  monitoringInterval: 30000,
  cacheWarmingInterval: 300000,
  logLevel: 'info',
  customWarmingStrategies: [
    {
      name: 'custom_data',
      patterns: ['custom:*'],
      warmupFunction: async () => {
        // Custom warming logic
      }
    }
  ]
};
```

## Monitoring and Alerting

### Performance Alerts

The system automatically generates alerts for:

- High memory usage (> 80%)
- Slow response times (> 1000ms)
- High error rates (> 5%)
- CPU usage spikes
- Database connection issues
- Cache performance degradation

### Anomaly Detection

The system uses statistical analysis to detect anomalies:

- Response time outliers
- Memory usage patterns
- Error rate spikes
- Unusual access patterns

### Bottleneck Identification

Automatic identification of:

- Slow API endpoints
- Memory leaks
- Database query issues
- Cache inefficiencies
- Network latency problems

## Best Practices

### 1. Cache Strategy

```typescript
// Use appropriate TTL based on data volatility
await enhancedCachingService.set(key, data, {
  ttl: data.volatile ? 60 : 3600,  // 1 min vs 1 hour
  priority: data.frequentlyAccessed ? 'high' : 'medium',
  predictive: true  // Enable predictive loading
});

// Use tags for intelligent invalidation
await enhancedCachingService.set('user:123:profile', profile, {
  tags: ['user', 'profile', `user:${123}`]
});

// Invalidate related data
await enhancedCachingService.invalidateByTag('user');
```

### 2. Performance Monitoring

```typescript
// Track endpoint performance manually
app.use('/api/slow-endpoint', (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    enhancedPerformanceMonitoringService.trackEndpoint(
      req.path, duration, res.statusCode
    );
  });

  next();
});

// Set up custom alerts
enhancedPerformanceMonitoringService.on('alert', (alert) => {
  if (alert.severity === 'critical') {
    // Send notification to monitoring system
    sendAlert(alert);
  }
});
```

### 3. Database Integration

```typescript
// Use caching service for database queries
async function getUserWithCache(id: string) {
  return await enhancedCachingService.getOrSet(
    `user:${id}`,
    async () => await database.users.findById(id),
    {
      ttl: 1800,  // 30 minutes
      tags: ['user'],
      priority: 'high'
    }
  );
}

// Invalidate cache on data changes
async function updateUser(id: string, data: any) {
  await database.users.update(id, data);
  await enhancedCachingService.invalidateByTag(`user:${id}`);
}
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check L1 cache size limits
   - Monitor cache eviction rates
   - Consider reducing TTL values

2. **Low Cache Hit Rate**
   - Review cache key patterns
   - Check TTL values (too short)
   - Analyze access patterns

3. **Slow Performance**
   - Check identified bottlenecks
   - Review optimization recommendations
   - Monitor response time trends

### Debug Tools

```typescript
// Get detailed analytics
const analytics = enhancedCachingService.getAnalytics();
console.log('Top accessed keys:', analytics.topKeys);
console.log('Access patterns:', analytics.accessPatterns);

// Get performance bottlenecks
const bottlenecks = enhancedPerformanceMonitoringService.getBottlenecks();
console.log('Active bottlenecks:', bottlenecks);

// Get optimization recommendations
const recommendations = enhancedPerformanceMonitoringService.getOptimizationRecommendations();
console.log('Recommendations:', recommendations);
```

## Integration Examples

### Express.js Application

```typescript
import express from 'express';
import { initializePerformanceSystem, createRouteMonitoring } from './config/performance-integration';

const app = express();

// Initialize performance system
await initializePerformanceSystem(app, server);

// Apply route-specific monitoring
app.use('/api/critical', createRouteMonitoring({
  enableCaching: true,
  cacheTTL: 300,
  enableProfiling: true,
  rateLimit: { windowMs: 60000, max: 100 }
}));

// Your existing routes
app.get('/api/workshops', async (req, res) => {
  // This endpoint will be automatically monitored and cached
  const workshops = await getWorkshops();
  res.json(workshops);
});
```

### Custom Metrics

```typescript
// Track custom business metrics
class BusinessMetrics {
  static trackUserAction(userId: string, action: string) {
    enhancedPerformanceMonitoringService.trackEndpoint(
      `user_action:${action}`,
      Date.now(), // or actual duration
      200
    );
  }

  static trackDatabaseQuery(query: string, duration: number) {
    enhancedPerformanceMonitoringService.trackEndpoint(
      `db_query:${query}`,
      duration,
      duration < 1000 ? 200 : 500 // Status based on performance
    );
  }
}
```

## Performance Tuning

### 1. Cache Optimization

```typescript
// Optimize cache for your specific use case
const customConfig = {
  L1: {
    maxSize: 2000,        // Increase for hot data
    maxMemorySize: 200 * 1024 * 1024, // 200MB
    hotKeyThreshold: 20,  // Adjust for your traffic patterns
  },
  L2: {
    defaultTTL: 7200,     // 2 hours for stable data
    compressionThreshold: 512, // Compress smaller values
  },
  prediction: {
    enabled: true,
    modelUpdateInterval: 30 * 60 * 1000, // 30 minutes
  }
};
```

### 2. Monitoring Optimization

```typescript
// Adjust monitoring frequency based on environment
const monitoringConfig = {
  production: {
    interval: 30000,      // 30 seconds
    anomalyThreshold: 2.0, // Standard deviations
    trendAnalysisWindow: 200,
  },
  development: {
    interval: 120000,     // 2 minutes
    anomalyThreshold: 1.5, // More sensitive
    trendAnalysisWindow: 50,
  }
};
```

## Conclusion

The Performance Monitoring and Caching System provides comprehensive tools for monitoring, analyzing, and optimizing your WorkshopsAI CMS application. By following this guide and implementing the recommended practices, you can achieve significant performance improvements and maintain high availability.

For more advanced usage and customization options, refer to the inline documentation in the source files and the TypeScript definitions.