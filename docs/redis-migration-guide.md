# Redis Migration Guide

This document provides a comprehensive guide for migrating from Redis to PostgreSQL-based services.

## Overview

This migration eliminates the Redis dependency and replaces it with PostgreSQL-based implementations for:
- Session management
- Job queue system (BullMQ replacement)
- Multi-tier caching
- Authentication and rate limiting
- Password reset tokens

## Migration Phases

### Phase 1: Database Schema Migration

Run the migration script to create the necessary PostgreSQL tables:

```bash
# Run the migration
npm run migrate:postgres
```

Or manually execute:
```sql
-- Execute migrations/0004_redis_migration_postgresql_schema.sql
```

### Phase 2: Session Management Migration

Replace Redis-based session storage with PostgreSQL sessions.

**Before (Redis):**
```typescript
import RedisService from '../services/redis-service';

// Store session
await RedisService.setSession(sessionId, sessionData, { ttl: 3600 });

// Get session
const session = await RedisService.getSession(sessionId);
```

**After (PostgreSQL):**
```typescript
import { sessionService } from '../services/postgresql-session-service';

// Store session
await sessionService.storeSession(sessionId, userId, sessionData, {
  ttl: 3600,
  ipAddress: req.ip,
  userAgent: req.get('User-Agent')
});

// Get session
const session = await sessionService.getSession(sessionId);
```

### Phase 3: Job Queue Migration

Replace BullMQ with PostgreSQL job queue.

**Before (BullMQ):**
```typescript
import { workshopAnalysisQueue, workshopAnalysisWorker } from '../queues/workshopAnalysisQueue';

// Add job
const job = await workshopAnalysisQueue.add('analyze-workshop', data);

// Get stats
const stats = await workshopAnalysisQueue.getStats();
```

**After (PostgreSQL):**
```typescript
import {
  initializeWorkshopAnalysisQueue,
  queueAnalysisJob,
  getQueueStats
} from '../queues/postgresql-workshop-analysis-queue';

// Add job
const job = await queueAnalysisJob(data);

// Get stats
const stats = await getQueueStats();
```

### Phase 4: Caching Migration

Replace Redis caching with PostgreSQL multi-level caching.

**Before (Redis):**
```typescript
import OptimizedRedisService from '../services/optimized-redis';

// Cache data
await OptimizedRedisService.set(key, data, { ttl: 3600 });

// Get cached data
const cached = await OptimizedRedisService.get(key);
```

**After (PostgreSQL):**
```typescript
import { cachingService } from '../services/postgresql-caching-service';

// Cache data
await cachingService.set(key, data, { ttl: 3600, priority: 'high' });

// Get cached data
const cached = await cachingService.get(key);

// Get or set with fetch function
const data = await cachingService.getOrSet(key, async () => {
  return await fetchExpensiveData();
}, { ttl: 3600 });
```

## Service Configuration

### Session Service

```typescript
import { PostgreSQLSessionService } from '../services/postgresql-session-service';

const sessionService = new PostgreSQLSessionService();

// Configuration options are handled through environment variables
// SESSION_TTL: Default session TTL (default: 7 days)
// MAX_AUTH_ATTEMPTS: Maximum authentication attempts (default: 5)
// AUTH_ATTEMPT_WINDOW: Time window for auth attempts in ms (default: 15 minutes)
```

### Caching Service

```typescript
import { PostgreSQLCachingService } from '../services/postgresql-caching-service';

const cacheService = new PostgreSQLCachingService();

// The service automatically configures L1 (in-memory) and L2 (PostgreSQL) caching
// L1 cache size: 1000 entries (configurable)
// Default TTL: 1 hour (configurable)
```

### Job Queue

```typescript
import { PGQueue, PGWorker } from '../services/postgresql-job-queue';

const queue = new PGQueue('queue-name', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

const worker = new PGWorker('queue-name', processor, {
  concurrency: 5,
});

worker.run();
```

## Environment Variables

Update your environment configuration:

```bash
# Remove Redis-related variables
# REDIS_URL=
# REDIS_HOST=
# REDIS_PORT=
# REDIS_PASSWORD=

# PostgreSQL session configuration
SESSION_TTL=604800  # 7 days in seconds
MAX_AUTH_ATTEMPTS=5
AUTH_ATTEMPT_WINDOW=900000  # 15 minutes in ms

# PostgreSQL cache configuration
CACHE_L1_SIZE=1000
CACHE_DEFAULT_TTL=3600

# Job queue configuration
JOB_QUEUE_CONCURRENCY=5
JOB_QUEUE_POLLING_INTERVAL=2000
```

## Deployment Changes

### Docker Configuration

Remove Redis from your Docker configuration:

```dockerfile
# Remove this line
# FROM redis:alpine as redis

# Update application health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node health-check.js
```

### Kubernetes Configuration

Update your deployment manifests:

```yaml
# Remove Redis service
# apiVersion: v1
# kind: Service
# metadata:
#   name: redis
# spec:
#   selector:
#     app: redis
#   ports:
#   - port: 6379

# Update application deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workshops-cms
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        # Remove Redis environment variables
        # - name: REDIS_URL
        #   valueFrom:
        #     secretKeyRef:
        #       name: redis-secret
        #       key: url
        # Add PostgreSQL-specific variables
        - name: SESSION_TTL
          value: "604800"
        - name: MAX_AUTH_ATTEMPTS
          value: "5"
```

## Monitoring and Observability

### Session Monitoring

Monitor session performance through the database:

```sql
-- View session statistics
SELECT * FROM session_monitoring;

-- Check active sessions
SELECT COUNT(*) FROM sessions
WHERE is_active = true AND expires_at > NOW();
```

### Cache Monitoring

Monitor cache performance:

```sql
-- View cache statistics
SELECT * FROM cache_monitoring;

-- Check cache hit rates
SELECT
  SUM(access_count::INTEGER) as total_accesses,
  AVG(access_count::INTEGER) as avg_access_count
FROM cache_entries;
```

### Job Queue Monitoring

Monitor job queue performance:

```sql
-- View queue statistics
SELECT * FROM get_job_queue_stats('workshop-analysis');

-- Check job processing times
SELECT
  AVG(EXTRACT(EPOCH FROM (finished_on - processed_on))) as avg_processing_time,
  COUNT(*) as total_jobs
FROM job_queues
WHERE status = 'completed';
```

## Performance Considerations

### Database Optimization

1. **Indexing**: The migration includes optimized indexes for all tables
2. **Connection Pooling**: Ensure your PostgreSQL connection pool is properly configured
3. **Vacuuming**: Set up regular vacuuming for cache and session tables

### Expected Performance Impact

- **Sessions**: Comparable performance to Redis with added persistence benefits
- **Caching**: L1 cache provides Redis-like performance for hot data
- **Job Queue**: Slightly higher latency than Redis but better durability and observability
- **Overall**: Expect ≤20% performance degradation within acceptable limits

## Rollback Procedure

If you need to rollback to Redis:

1. **Backup Data**: Export critical data from PostgreSQL
2. **Restore Configuration**: Revert environment variables and configuration
3. **Deploy Redis**: Restore Redis service
4. **Switch Services**: Update service imports to use Redis services
5. **Migrate Data**: Import session and queue data back to Redis

```bash
# Backup sessions
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -t sessions > sessions_backup.sql

# Backup queue
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -t job_queues > queue_backup.sql
```

## Testing

Run the comprehensive test suite:

```bash
# Run Redis migration tests
npm test -- tests/redis-migration/

# Run with coverage
npm run test:coverage:redis-migration

# Run performance benchmarks
npm run test:performance:redis-migration
```

## Troubleshooting

### Common Issues

1. **Session Loss**: Check session cleanup jobs and TTL configuration
2. **Slow Cache**: Verify L1 cache size and database indexing
3. **Queue Backlog**: Check worker concurrency and job processing time
4. **Database Load**: Monitor connection pool usage and query performance

### Debug Queries

```sql
-- Check session cleanup
SELECT COUNT(*) FROM sessions
WHERE expires_at < NOW() AND is_active = true;

-- Check cache efficiency
SELECT
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_entries
FROM cache_entries;

-- Check job queue health
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (finished_on - processed_on))) as avg_processing_time
FROM job_queues
GROUP BY status;
```

## Security Considerations

### Session Security

- Sessions now include IP address and user agent tracking
- Automatic cleanup of expired sessions
- Secure token storage with bcrypt hashing

### Rate Limiting

- Enhanced rate limiting with IP-based tracking
- Configurable attempt windows and limits
- Automatic cleanup of old attempt records

### Data Protection

- All sensitive data encrypted at rest in PostgreSQL
- GDPR-compliant audit logging
- Row-level security for user data

## Conclusion

This migration provides several benefits:
- **Reduced Complexity**: Eliminates Redis dependency
- **Better Observability**: Full SQL visibility into all data
- **Enhanced Security**: Improved session and token management
- **Cost Efficiency**: Reduced infrastructure costs
- **Data Durability**: All data persisted in PostgreSQL

The migration maintains system performance while providing a more maintainable and observable architecture.