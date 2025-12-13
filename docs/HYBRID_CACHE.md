# Hybrid Cache System

A comprehensive multi-level caching system designed to replace Redis with enhanced performance, reliability, and features.

## Overview

The Hybrid Cache System provides three levels of caching:
- **L1**: In-memory cache with LRU eviction
- **L2**: PostgreSQL-backed persistent cache
- **L3**: Database materialized views for query results

## Features

### Core Features
- Multi-level caching with automatic promotion/demotion
- Tag-based cache invalidation
- Cache warming strategies
- Circuit breaker pattern for resilience
- Performance monitoring and metrics
- Compression for large values
- Checksum verification for data integrity

### Advanced Features
- Event-driven architecture
- Stale-while-revalidate support
- Batch operations
- Administrative utilities
- Backup and restore functionality
- Migration tools

## Installation

The hybrid cache is integrated into the application. Ensure the database tables are created:

```bash
# Run the migration to create cache tables
npm run db:migrate
```

## Configuration

Configuration is handled in `src/config/hybrid-cache.ts`. Environment-specific settings are automatically applied:

### Development
- L1: 5,000 entries, 100MB memory
- L2: 1 hour default TTL
- Warming: Every 5 minutes

### Production
- L1: 50,000 entries, 500MB memory
- L2: 4 hour default TTL
- Warming: Every 3 minutes

## Usage

### Basic Operations

```typescript
import { hybridCache } from './services/hybrid-cache';

// Set a value
await hybridCache.set('key', { data: 'value' }, {
  ttl: 3600,
  tags: ['user', 'profile'],
  priority: 'high'
});

// Get a value
const value = await hybridCache.get('key');

// Get or set with fetch function
const data = await hybridCache.getOrSet('key', async () => {
  return await fetchDataFromDatabase();
}, { ttl: 1800 });

// Invalidate by key
await hybridCache.invalidate('key');

// Invalidate by tag
await hybridCache.invalidateByTag('user');
```

### Cache Levels

```typescript
// Specify cache level
await hybridCache.set('key', value, { level: CacheLevel.L1 });

// Get from specific level
const value = await hybridCache.get('key', { level: CacheLevel.L2 });
```

### Middleware Integration

```typescript
import { cacheMiddleware } from './services/hybrid-cache-service';

// Cache API responses
app.get('/api/workshops',
  cacheMiddleware({
    ttl: 300,
    tags: ['workshops', 'api']
  }),
  (req, res) => {
    // Handler logic
  }
);
```

## Cache Keys and Patterns

Use the predefined patterns in `src/config/hybrid-cache.ts`:

```typescript
import { cacheKeyPatterns } from './config/hybrid-cache';

const userKey = cacheKeyPatterns.user.profile(userId);
const workshopKey = cacheKeyPatterns.workshop.byId(workshopId);
```

## Cache Warming

The system includes built-in warming strategies:

```typescript
// Warm all strategies
await hybridCache.warmCache();

// Warm specific strategy
await hybridCache.warmCache('user_sessions');

// Add custom strategy
hybridCache.addWarmingStrategy('custom_strategy', {
  name: 'custom_strategy',
  description: 'Custom warming strategy',
  priority: 1,
  enabled: true,
  patterns: ['custom:*'],
  warmupFunction: async (cache) => {
    // Custom warming logic
  }
});
```

## Monitoring

### Statistics

```typescript
const stats = await hybridCache.getStats();
console.log(`
  Overall Hit Rate: ${(stats.overall.hitRate * 100).toFixed(1)}%
  L1 Hit Rate: ${(stats.L1.hitRate * 100).toFixed(1)}%
  L2 Hit Rate: ${(stats.L2.hitRate * 100).toFixed(1)}%
  Total Memory: ${(stats.overall.totalMemoryUsage / 1024 / 1024).toFixed(1)}MB
`);
```

### Health Checks

```typescript
const health = await hybridCache.healthCheck();
if (!health.L1 || !health.L2) {
  console.error('Cache system unhealthy');
}
```

## Administration

### Administrative Utilities

```typescript
import { CacheAdmin } from './services/hybrid-cache';

const admin = new CacheAdmin(cache, monitor, warmer);

// Clear cache
await admin.clear();

// Invalidate by pattern
await admin.invalidate('user:*');

// Create backup
const backup = await admin.createBackup(true);

// Restore from backup
await admin.restoreFromBackup(backup.id);

// Generate performance report
const report = await admin.generatePerformanceReport(24); // Last 24 hours
```

## Redis Fallback

The system provides automatic fallback from Redis to hybrid cache:

```typescript
import { redisService } from './config/redis';

// Redis service automatically falls back to hybrid cache
await redisService.storeRefreshToken(userId, token, deviceInfo, ipAddress);
```

## Best Practices

### 1. Cache Key Design
- Use consistent patterns
- Include version numbers when necessary
- Group related keys with tags

### 2. TTL Strategy
- Short TTL for rapidly changing data (5-15 minutes)
- Medium TTL for user data (1-4 hours)
- Long TTL for static content (24 hours+)

### 3. Tag Strategy
- Tag by entity type (user, workshop, etc.)
- Tag by feature (api, search, analytics)
- Tag by data freshness (real-time, daily, static)

### 4. Priority Levels
- **High**: User sessions, authentication tokens
- **Medium**: User profiles, workshop data
- **Low**: Analytics, reports, cached API responses

### 5. Cache Warming
- Warm frequently accessed data on startup
- Use dependency graphs for complex warming
- Monitor warming performance

## Performance Tuning

### Memory Management
- Monitor L1 cache size
- Adjust eviction policies
- Use compression for large values

### Database Optimization
- Ensure proper indexes on cache tables
- Regular cleanup of expired entries
- Monitor query performance

### Network Considerations
- Use connection pooling
- Batch operations when possible
- Implement retry logic

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check L1 cache size
   - Review TTL settings
   - Monitor for memory leaks

2. **Low Hit Rate**
   - Analyze access patterns
   - Check key consistency
   - Review warming strategies

3. **Slow Performance**
   - Check database indexes
   - Monitor connection pool
   - Review batch sizes

### Debug Mode

Enable debug logging:
```typescript
process.env.DEBUG = 'hybrid-cache:*';
```

## Migration from Redis

The system provides migration tools:

```typescript
import { CacheAdmin } from './services/hybrid-cache';

const admin = new CacheAdmin(cache, monitor, warmer);

// Migrate from Redis
await admin.migrate({
  source: {
    type: 'redis',
    connection: redisClient
  },
  target: {
    type: 'hybrid',
    config: hybridCacheConfig
  },
  batchSize: 1000,
  parallelism: 5
});
```

## API Reference

### HybridCache Class

#### Methods
- `get<T>(key, options?)`: Get cached value
- `set<T>(key, value, options?)`: Set cached value
- `getOrSet<T>(key, fetchFn, options?)`: Get or set pattern
- `invalidate(key, options?)`: Invalidate cached entry
- `invalidateByTag(tag)`: Invalidate entries by tag
- `clear()`: Clear all cache
- `warmCache(strategy?)`: Warm cache
- `healthCheck()`: Check cache health
- `getStats()`: Get statistics
- `shutdown()`: Graceful shutdown

#### Options
```typescript
interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  priority?: 'low' | 'medium' | 'high';
  level?: CacheLevel; // Specific cache level
  compress?: boolean; // Compress large values
  checksum?: boolean; // Verify data integrity
  warmOnStartup?: boolean; // Warm on startup
  staleWhileRevalidate?: number; // Serve stale while revalidating
}
```

### Events

The cache emits events for monitoring:

```typescript
cache.on('cacheHit', ({ key, level, value }) => {
  console.log(`Cache hit on ${level} for key: ${key}`);
});

cache.on('cacheMiss', ({ key, options }) => {
  console.log(`Cache miss for key: ${key}`);
});

cache.on('cacheError', ({ key, error, operation }) => {
  console.error(`Cache error during ${operation} for key ${key}:`, error);
});
```

## Contributing

When contributing to the hybrid cache system:

1. Follow the existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Consider performance implications
5. Test with different cache levels

## License

This cache system is part of the workshopsAI CMS project.