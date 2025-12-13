# Redis Elimination Implementation Roadmap

## Executive Summary

This document provides a comprehensive technical roadmap for eliminating Redis dependency from the WorkshopsAI CMS system. The migration focuses on maintaining system reliability, performance, and scalability while transitioning to alternative solutions.

## 1. Current Redis Usage Analysis

### 1.1 Primary Use Cases

Based on codebase analysis, Redis is utilized for:

- **Caching Service** (L2 cache layer)
  - Multi-tier caching with L1 (in-memory) and L2 (Redis)
  - Query result caching
  - Session storage
  - Cache warming strategies

- **Authentication & Session Management**
  - Refresh token storage
  - Session data persistence
  - Password reset tokens
  - Authentication attempt tracking

- **Rate Limiting**
  - Email rate limiting
  - API rate limiting
  - Multi-level throttling (per second, minute, hour, day)

- **Queue Management**
  - BullMQ for workshop analysis queues
  - Background job processing
  - Job state management

- **Real-time Features**
  - Socket.IO Redis adapter
  - WebSocket session management

### 1.2 Dependencies Identified

```json
{
  "ioredis": "^5.3.2",
  "redis": "^4.6.11",
  "bullmq": "^5.63.1",
  "@bull-board/api": "^6.14.2",
  "@bull-board/express": "^6.14.2",
  "connect-redis": "^7.1.0",
  "@socket.io/redis-adapter": "^8.3.0",
  "socket.io-redis-adapter": "^8.4.6"
}
```

## 2. Migration Strategy

### 2.1 Phase 1: Cache Layer Migration

#### 2.1.1 In-Memory Cache Enhancement

**Objective**: Replace Redis L2 cache with enhanced in-memory solution

**Implementation**:

```typescript
// src/services/enhanced-memory-cache.ts
import NodeCache from 'node-cache';
import { EventEmitter } from 'events';

export interface EnhancedCacheOptions {
  ttl?: number;
  checkperiod?: number;
  useClones?: boolean;
  deleteOnExpire?: boolean;
  enableLegacyCallbacks?: boolean;
  maxKeys?: number;
  lruSize?: number;
}

export class EnhancedMemoryCache extends EventEmitter {
  private caches: Map<string, NodeCache> = new Map();
  private defaultOptions: EnhancedCacheOptions;

  constructor(options: EnhancedCacheOptions = {}) {
    super();
    this.defaultOptions = {
      ttl: 3600, // 1 hour
      checkperiod: 600, // 10 minutes
      useClones: false,
      deleteOnExpire: true,
      enableLegacyCallbacks: false,
      maxKeys: 10000,
      lruSize: 1000,
      ...options
    };

    this.setupCaches();
  }

  private setupCaches(): void {
    // Create separate caches for different data types
    this.caches.set('sessions', new NodeCache({
      ttl: 86400, // 24 hours
      checkperiod: 3600,
      maxKeys: 5000
    }));

    this.caches.set('queries', new NodeCache({
      ttl: 1800, // 30 minutes
      checkperiod: 300,
      maxKeys: 10000
    }));

    this.caches.set('tokens', new NodeCache({
      ttl: 604800, // 7 days
      checkperiod: 3600,
      maxKeys: 1000
    }));

    this.caches.set('rate_limit', new NodeCache({
      ttl: 900, // 15 minutes
      checkperiod: 60,
      maxKeys: 50000
    }));

    this.caches.set('general', new NodeCache(this.defaultOptions));

    // Setup event listeners
    this.caches.forEach((cache, name) => {
      cache.on('expired', (key, value) => {
        this.emit('expired', { cache: name, key, value });
      });

      cache.on('del', (key, value) => {
        this.emit('deleted', { cache: name, key, value });
      });

      cache.on('set', (key, value) => {
        this.emit('set', { cache: name, key, value });
      });
    });
  }

  async get<T>(key: string, cacheName: string = 'general'): Promise<T | null> {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      throw new Error(`Cache '${cacheName}' not found`);
    }

    return cache.get<T>(key) || null;
  }

  async set<T>(
    key: string,
    value: T,
    ttl?: number,
    cacheName: string = 'general'
  ): Promise<boolean> {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      throw new Error(`Cache '${cacheName}' not found`);
    }

    return cache.set(key, value, ttl);
  }

  async del(key: string, cacheName?: string): Promise<number> {
    if (cacheName) {
      const cache = this.caches.get(cacheName);
      if (!cache) return 0;
      return cache.del(key) ? 1 : 0;
    }

    // Delete from all caches
    let deleted = 0;
    for (const cache of this.caches.values()) {
      if (cache.del(key)) deleted++;
    }
    return deleted;
  }

  async exists(key: string, cacheName: string = 'general'): Promise<boolean> {
    const cache = this.caches.get(cacheName);
    if (!cache) return false;

    return cache.has(key);
  }

  async incr(key: string, cacheName: string = 'rate_limit'): Promise<number> {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      throw new Error(`Cache '${cacheName}' not found`);
    }

    const current = cache.get<number>(key) || 0;
    const newValue = current + 1;
    cache.set(key, newValue);
    return newValue;
  }

  async expire(key: string, ttl: number, cacheName?: string): Promise<boolean> {
    if (cacheName) {
      const cache = this.caches.get(cacheName);
      if (!cache || !cache.has(key)) return false;

      const value = cache.get(key);
      cache.set(key, value, ttl);
      return true;
    }

    // Try all caches
    for (const [name, cache] of this.caches) {
      if (cache.has(key)) {
        const value = cache.get(key);
        cache.set(key, value, ttl);
        return true;
      }
    }
    return false;
  }

  async ttl(key: string, cacheName?: string): Promise<number> {
    if (cacheName) {
      const cache = this.caches.get(cacheName);
      if (!cache || !cache.has(key)) return -2;

      return cache.getTtl(key) || -1;
    }

    // Check all caches
    for (const cache of this.caches.values()) {
      if (cache.has(key)) {
        return cache.getTtl(key) || -1;
      }
    }
    return -2;
  }

  async keys(pattern: string, cacheName: string = 'general'): Promise<string[]> {
    const cache = this.caches.get(cacheName);
    if (!cache) return [];

    const allKeys = cache.keys();
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async clear(cacheName?: string): Promise<void> {
    if (cacheName) {
      const cache = this.caches.get(cacheName);
      if (cache) {
        cache.flushAll();
      }
    } else {
      // Clear all caches
      this.caches.forEach(cache => cache.flushAll());
    }
  }

  getStats(cacheName?: string) {
    if (cacheName) {
      const cache = this.caches.get(cacheName);
      if (!cache) return null;

      return cache.getStats();
    }

    const stats: Record<string, any> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = cache.getStats();
    });
    return stats;
  }

  // Cluster support for multiple instances
  async syncWithCluster(nodes: string[]): Promise<void> {
    // Implementation for multi-instance synchronization
    // Could use database or message queue for sync
  }
}
```

#### 2.1.2 Cache Interface Abstraction

```typescript
// src/interfaces/cache.interface.ts
export interface ICacheService {
  get<T>(key: string, options?: CacheGetOptions): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  del(key: string | string[]): Promise<number>;
  exists(key: string): Promise<boolean>;
  incr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  clear(pattern?: string): Promise<void>;
  getStats(): CacheStats;
}

export interface CacheGetOptions {
  ttl?: number;
  prefix?: string;
  tags?: string[];
  json?: boolean;
}

export interface CacheSetOptions {
  ttl?: number;
  prefix?: string;
  tags?: string[];
  json?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
}
```

### 2.2 Phase 2: Session Management Migration

#### 2.2.1 Database-Backed Sessions

```typescript
// src/services/database-session-store.ts
import { db } from '../config/database';
import { EventEmitter } from 'events';

export interface SessionData {
  id: string;
  data: any;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class DatabaseSessionStore extends EventEmitter {
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.initializeCleanup();
  }

  async get(sessionId: string): Promise<SessionData | null> {
    try {
      const result = await db`
        SELECT * FROM sessions
        WHERE id = ${sessionId}
        AND expires_at > NOW()
        LIMIT 1
      `;

      if (result.length === 0) return null;

      // Update last accessed time
      await db`
        UPDATE sessions
        SET updated_at = NOW()
        WHERE id = ${sessionId}
      `;

      const session = result[0];
      return {
        id: session.id,
        data: session.data,
        expiresAt: session.expires_at,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        userId: session.user_id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent
      };
    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  async set(
    sessionId: string,
    data: any,
    options: {
      ttl?: number;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<void> {
    try {
      const ttl = options.ttl || 86400; // 24 hours default
      const expiresAt = new Date(Date.now() + ttl * 1000);

      await db`
        INSERT INTO sessions (
          id, data, expires_at, user_id, ip_address, user_agent
        ) VALUES (
          ${sessionId},
          ${JSON.stringify(data)},
          ${expiresAt},
          ${options.userId || null},
          ${options.ipAddress || null},
          ${options.userAgent || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW(),
          user_id = EXCLUDED.user_id,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent
      `;

      this.emit('set', { sessionId, data });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async destroy(sessionId: string): Promise<void> {
    try {
      const result = await db`
        DELETE FROM sessions WHERE id = ${sessionId}
      `;

      if (result.count > 0) {
        this.emit('destroyed', { sessionId });
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async touch(sessionId: string, ttl: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);

      await db`
        UPDATE sessions
        SET expires_at = ${expiresAt}, updated_at = NOW()
        WHERE id = ${sessionId}
      `;

      this.emit('touched', { sessionId, ttl });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await db`DELETE FROM sessions`;
      this.emit('cleared');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getAllUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const result = await db`
        SELECT * FROM sessions
        WHERE user_id = ${userId}
        AND expires_at > NOW()
        ORDER BY updated_at DESC
      `;

      return result.map(row => ({
        id: row.id,
        data: row.data,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        userId: row.user_id,
        ipAddress: row.ip_address,
        userAgent: row.user_agent
      }));
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    try {
      const result = await db`
        DELETE FROM sessions
        WHERE user_id = ${userId}
      `;

      if (result.count > 0) {
        this.emit('userSessionsRevoked', { userId, count: result.count });
      }

      return result.count;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private initializeCleanup(): void {
    // Clean up expired sessions every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        const result = await db`
          DELETE FROM sessions
          WHERE expires_at <= NOW()
        `;

        if (result.count > 0) {
          this.emit('cleanup', { deleted: result.count });
        }
      } catch (error) {
        this.emit('error', error);
      }
    }, 3600000); // 1 hour
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
```

#### 2.2.2 Session Table Migration

```sql
-- migrations/001_create_sessions_table.sql
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT
);

-- Indexes for performance
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at);

-- Auto-cleanup trigger (optional)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at <= NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run cleanup periodically
-- Note: This requires pg_cron extension
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions();');
```

### 2.3 Phase 3: Rate Limiting Migration

#### 2.3.1 In-Memory Rate Limiter

```typescript
// src/services/memory-rate-limiter.ts
import { EventEmitter } from 'events';
import { RateLimitRule, RateLimitResult, ThrottlingConfig } from './emailRateLimitService';

interface RateLimitEntry {
  count: number;
  windowStart: number;
  resetTime: number;
}

export class MemoryRateLimiter extends EventEmitter {
  private windows: Map<string, RateLimitEntry> = new Map();
  private throttlingCounters: Map<string, number[]> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.initializeCleanup();
  }

  async checkRateLimit(
    ruleName: string,
    identifier: string,
    customRule?: Partial<RateLimitRule>
  ): Promise<RateLimitResult> {
    const rule = this.getRule(ruleName, customRule);
    const key = `rate_limit:${ruleName}:${identifier}`;
    const now = Date.now();
    const windowMs = rule.windowMs || 60000;

    // Get or create window entry
    let entry = this.windows.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = {
        count: 0,
        windowStart: now,
        resetTime: now + windowMs
      };
      this.windows.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, rule.maxRequests - entry.count);
    const allowed = entry.count <= rule.maxRequests;

    this.emit('rateLimitCheck', {
      ruleName,
      identifier,
      count: entry.count,
      allowed,
      remaining
    });

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
      retryAfter: allowed ? undefined : entry.resetTime - now
    };
  }

  async checkThrottling(
    identifier: string,
    requestCount: number = 1,
    config?: Partial<ThrottlingConfig>
  ): Promise<boolean> {
    const now = Date.now();
    const defaultConfig: ThrottlingConfig = {
      maxPerSecond: 10,
      maxPerMinute: 100,
      maxPerHour: 1000,
      maxPerDay: 10000
    };

    const throttleConfig = { ...defaultConfig, ...config };

    // Check each time window
    const windows = [
      { key: `throttle:second:${identifier}`, max: throttleConfig.maxPerSecond, windowMs: 1000 },
      { key: `throttle:minute:${identifier}`, max: throttleConfig.maxPerMinute, windowMs: 60000 },
      { key: `throttle:hour:${identifier}`, max: throttleConfig.maxPerHour, windowMs: 3600000 },
      { key: `throttle:day:${identifier}`, max: throttleConfig.maxPerDay, windowMs: 86400000 }
    ];

    for (const window of windows) {
      const timestamps = this.throttlingCounters.get(window.key) || [];

      // Remove old entries
      const validTimestamps = timestamps.filter(t => now - t < window.windowMs);

      // Add current request(s)
      for (let i = 0; i < requestCount; i++) {
        validTimestamps.push(now);
      }

      // Check if exceeds limit
      if (validTimestamps.length > window.max) {
        this.emit('throttled', {
          identifier,
          window: window.key,
          count: validTimestamps.length,
          max: window.max
        });
        return false;
      }

      this.throttlingCounters.set(window.key, validTimestamps);
    }

    return true;
  }

  async resetRateLimit(ruleName: string, identifier: string): Promise<void> {
    const key = `rate_limit:${ruleName}:${identifier}`;
    this.windows.delete(key);
    this.emit('rateLimitReset', { ruleName, identifier });
  }

  async resetAllRateLimits(identifier: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const key of this.windows.keys()) {
      if (key.includes(identifier)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.windows.delete(key);
    }

    // Also clear throttling counters
    for (const key of this.throttlingCounters.keys()) {
      if (key.includes(identifier)) {
        this.throttlingCounters.delete(key);
      }
    }

    this.emit('allRateLimitsReset', { identifier, count: keysToDelete.length });
  }

  getRateLimitStatus(identifier: string): Record<string, any> {
    const status: Record<string, any> = {};
    const now = Date.now();

    for (const [key, entry] of this.windows) {
      if (key.includes(identifier)) {
        const parts = key.split(':');
        const ruleType = parts[1] || 'unknown';

        status[ruleType] = {
          current: entry.count,
          remaining: Math.max(0, this.getRule(ruleType).maxRequests - entry.count),
          resetTime: entry.resetTime,
          windowStart: entry.windowStart,
          timeRemaining: Math.max(0, entry.resetTime - now)
        };
      }
    }

    return status;
  }

  private getRule(ruleName: string, customRule?: Partial<RateLimitRule>): RateLimitRule {
    const defaultRules: Record<string, RateLimitRule> = {
      global: { windowMs: 60000, maxRequests: 1000 },
      email: { windowMs: 60000, maxRequests: 10 },
      user: { windowMs: 900000, maxRequests: 50 }, // 15 minutes
      workshop: { windowMs: 3600000, maxRequests: 100 }, // 1 hour
      transactional: { windowMs: 60000, maxRequests: 100 },
      marketing: { windowMs: 3600000, maxRequests: 50 }
    };

    const defaultRule = defaultRules[ruleName] || {
      windowMs: 60000,
      maxRequests: 10
    };

    return { ...defaultRule, ...customRule };
  }

  private initializeCleanup(): void {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      // Clean rate limit windows
      for (const [key, entry] of this.windows) {
        if (now - entry.windowStart > entry.resetTime - entry.windowStart + 60000) {
          expiredKeys.push(key);
        }
      }

      for (const key of expiredKeys) {
        this.windows.delete(key);
      }

      // Clean throttling counters
      for (const [key, timestamps] of this.throttlingCounters) {
        const validTimestamps = timestamps.filter(t => now - t < 86400000); // Keep for 24 hours
        if (validTimestamps.length === 0) {
          this.throttlingCounters.delete(key);
        } else if (validTimestamps.length < timestamps.length) {
          this.throttlingCounters.set(key, validTimestamps);
        }
      }

      if (expiredKeys.length > 0) {
        this.emit('cleanup', { deleted: expiredKeys.length });
      }
    }, 60000); // 1 minute
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.windows.clear();
    this.throttlingCounters.clear();
  }
}
```

### 2.4 Phase 4: Queue Management Migration

#### 2.4.1 Database-Backed Queue System

```typescript
// src/services/database-queue.ts
import { db } from '../config/database';
import { EventEmitter } from 'events';

export interface JobData {
  id: string;
  name: string;
  data: any;
  opts: JobOptions;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  priority: number;
  delay: number;
  timestamp: number;
  attemptsMade: number;
  finishedOn?: number;
  processedOn?: number;
  failedReason?: string;
  stacktrace?: string;
  returnvalue?: any;
}

export interface JobOptions {
  attempts?: number;
  delay?: number;
  priority?: number;
  repeat?: RepeatOptions;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

export interface RepeatOptions {
  every?: number;
  pattern?: string;
}

export class DatabaseQueue extends EventEmitter {
  private name: string;
  private processor: ((job: JobData) => Promise<any>) | null = null;
  private processing: boolean = false;
  private concurrency: number = 1;
  private pollInterval: number = 1000;
  private activeJobs: Map<string, Promise<any>> = new Map();

  constructor(name: string, options: { concurrency?: number; pollInterval?: number } = {}) {
    super();
    this.name = name;
    this.concurrency = options.concurrency || 1;
    this.pollInterval = options.pollInterval || 1000;
    this.ensureTable();
  }

  private async ensureTable(): Promise<void> {
    await db`
      CREATE TABLE IF NOT EXISTS queue_jobs (
        id VARCHAR(255) PRIMARY KEY,
        queue_name VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        data JSONB,
        opts JSONB,
        status VARCHAR(50) NOT NULL DEFAULT 'waiting',
        priority INTEGER DEFAULT 0,
        delay INTEGER DEFAULT 0,
        timestamp BIGINT NOT NULL,
        attempts_made INTEGER DEFAULT 0,
        processed_on BIGINT,
        finished_on BIGINT,
        failed_reason TEXT,
        stacktrace TEXT,
        returnvalue JSONB
      )
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_status ON queue_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_queue_name ON queue_jobs(queue_name);
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_timestamp ON queue_jobs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_priority ON queue_jobs(priority DESC);
    `;
  }

  async add(name: string, data: any, opts: JobOptions = {}): Promise<JobData> {
    const jobId = `${this.name}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    const delay = opts.delay || 0;

    const job: JobData = {
      id: jobId,
      name,
      data,
      opts,
      status: delay > 0 ? 'delayed' : 'waiting',
      priority: opts.priority || 0,
      delay,
      timestamp: timestamp + delay,
      attemptsMade: 0
    };

    await db`
      INSERT INTO queue_jobs (
        id, queue_name, name, data, opts, status,
        priority, delay, timestamp, attempts_made
      ) VALUES (
        ${jobId},
        ${this.name},
        ${name},
        ${JSON.stringify(data)},
        ${JSON.stringify(opts)},
        ${job.status},
        ${job.priority},
        ${delay},
        ${job.timestamp},
        ${job.attemptsMade}
      )
    `;

    this.emit('added', job);

    // Start processing if not already running
    if (this.processor && !this.processing) {
      this.process();
    }

    return job;
  }

  process(processor: (job: JobData) => Promise<any>): void {
    this.processor = processor;
    if (!this.processing) {
      this.process();
    }
  }

  private async process(): Promise<void> {
    if (!this.processor || this.processing) return;

    this.processing = true;

    while (this.processor && this.activeJobs.size < this.concurrency) {
      const job = await this.getNextJob();

      if (!job) {
        await this.sleep(this.pollInterval);
        continue;
      }

      const jobPromise = this.processJob(job);
      this.activeJobs.set(job.id, jobPromise);

      jobPromise.finally(() => {
        this.activeJobs.delete(job.id);
      });
    }

    this.processing = false;
  }

  private async getNextJob(): Promise<JobData | null> {
    const now = Date.now();

    const result = await db`
      UPDATE queue_jobs
      SET status = 'active', processed_on = ${now}
      WHERE id = (
        SELECT id FROM queue_jobs
        WHERE queue_name = ${this.name}
        AND status IN ('waiting', 'delayed')
        AND timestamp <= ${now}
        ORDER BY priority DESC, timestamp ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      data: row.data,
      opts: row.opts,
      status: row.status,
      priority: row.priority,
      delay: row.delay,
      timestamp: row.timestamp,
      attemptsMade: row.attempts_made,
      processedOn: row.processed_on,
      finishedOn: row.finished_on,
      failedReason: row.failed_reason,
      stacktrace: row.stacktrace,
      returnvalue: row.returnvalue
    };
  }

  private async processJob(job: JobData): Promise<void> {
    try {
      this.emit('started', job);

      const result = await this.processor!(job);

      // Job completed successfully
      await db`
        UPDATE queue_jobs
        SET
          status = 'completed',
          finished_on = ${Date.now()},
          returnvalue = ${JSON.stringify(result)}
        WHERE id = ${job.id}
      `;

      // Remove job if configured
      if (job.opts.removeOnComplete !== false) {
        await db`DELETE FROM queue_jobs WHERE id = ${job.id}`;
      }

      this.emit('completed', job, result);
    } catch (error) {
      const attempts = job.opts.attempts || 3;
      job.attemptsMade++;

      if (job.attemptsMade < attempts) {
        // Retry job
        const delay = Math.min(1000 * Math.pow(2, job.attemptsMade), 30000); // Exponential backoff

        await db`
          UPDATE queue_jobs
          SET
            status = 'waiting',
            attempts_made = ${job.attemptsMade},
            timestamp = ${Date.now() + delay},
            failed_reason = ${error.message},
            stacktrace = ${error.stack}
          WHERE id = ${job.id}
        `;

        this.emit('failed', job, error);
      } else {
        // Mark as failed
        await db`
          UPDATE queue_jobs
          SET
            status = 'failed',
            finished_on = ${Date.now()},
            failed_reason = ${error.message},
            stacktrace = ${error.stack}
          WHERE id = ${job.id}
        `;

        // Remove job if configured
        if (job.opts.removeOnFail !== false) {
          await db`DELETE FROM queue_jobs WHERE id = ${job.id}`;
        }

        this.emit('failed', job, error, true);
      }
    }
  }

  async getJob(jobId: string): Promise<JobData | null> {
    const result = await db`
      SELECT * FROM queue_jobs
      WHERE id = ${jobId}
      LIMIT 1
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      data: row.data,
      opts: row.opts,
      status: row.status,
      priority: row.priority,
      delay: row.delay,
      timestamp: row.timestamp,
      attemptsMade: row.attempts_made,
      processedOn: row.processed_on,
      finishedOn: row.finished_on,
      failedReason: row.failed_reason,
      stacktrace: row.stacktrace,
      returnvalue: row.returnvalue
    };
  }

  async getJobs statuses: string[]): Promise<JobData[]> {
    const result = await db`
      SELECT * FROM queue_jobs
      WHERE queue_name = ${this.name}
      AND status = ANY(${statuses})
      ORDER BY timestamp DESC
    `;

    return result.map(row => ({
      id: row.id,
      name: row.name,
      data: row.data,
      opts: row.opts,
      status: row.status,
      priority: row.priority,
      delay: row.delay,
      timestamp: row.timestamp,
      attemptsMade: row.attempts_made,
      processedOn: row.processed_on,
      finishedOn: row.finished_on,
      failedReason: row.failed_reason,
      stacktrace: row.stacktrace,
      returnvalue: row.returnvalue
    }));
  }

  async getWaiting(): Promise<JobData[]> {
    return this.getJobs(['waiting', 'delayed']);
  }

  async getActive(): Promise<JobData[]> {
    return this.getJobs(['active']);
  }

  async getCompleted(): Promise<JobData[]> {
    return this.getJobs(['completed']);
  }

  async getFailed(): Promise<JobData[]> {
    return this.getJobs(['failed']);
  }

  async getCounts(): Promise<Record<string, number>> {
    const result = await db`
      SELECT status, COUNT(*) as count
      FROM queue_jobs
      WHERE queue_name = ${this.name}
      GROUP BY status
    `;

    const counts: Record<string, number> = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };

    result.forEach(row => {
      counts[row.status] = parseInt(row.count);
    });

    return counts;
  }

  async clean(grace: number = 0): Promise<Record<string, number>> {
    const threshold = Date.now() - grace;

    const completed = await db`
      DELETE FROM queue_jobs
      WHERE queue_name = ${this.name}
      AND status = 'completed'
      AND finished_on < ${threshold}
    `;

    const failed = await db`
      DELETE FROM queue_jobs
      WHERE queue_name = ${this.name}
      AND status = 'failed'
      AND finished_on < ${threshold}
    `;

    const cleaned = {
      completed: completed.count,
      failed: failed.count
    };

    this.emit('cleaned', cleaned);

    return cleaned;
  }

  async pause(): Promise<void> {
    // Implementation would set a paused flag
  }

  async resume(): Promise<void> {
    // Implementation would clear the paused flag
  }

  async close(): Promise<void> {
    // Wait for all active jobs to complete
    await Promise.all(this.activeJobs.values());
    this.activeJobs.clear();
    this.processor = null;
    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 2.5 Phase 5: WebSocket Migration

#### 2.5.1 In-Memory WebSocket Adapter

```typescript
// src/services/memory-websocket-adapter.ts
import { EventEmitter } from 'events';
import { Server as SocketIOServer, Socket } from 'socket.io';

export interface Message {
  type: string;
  data: any;
  room?: string;
  except?: string;
}

export interface RoomInfo {
  name: string;
  sockets: Set<string>;
  created: Date;
}

export class MemoryWebSocketAdapter extends EventEmitter {
  private rooms: Map<string, RoomInfo> = new Map();
  private sockets: Map<string, Socket> = new Map();
  private socketRooms: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    super();
    this.setupEventHandlers(io);
  }

  private setupEventHandlers(io: SocketIOServer): void {
    io.on('connection', (socket: Socket) => {
      this.sockets.set(socket.id, socket);
      this.socketRooms.set(socket.id, new Set());

      socket.on('disconnect', () => {
        this.handleDisconnect(socket.id);
      });

      socket.on('join-room', (roomName: string) => {
        this.joinRoom(socket.id, roomName);
      });

      socket.on('leave-room', (roomName: string) => {
        this.leaveRoom(socket.id, roomName);
      });
    });
  }

  private handleDisconnect(socketId: string): void {
    // Remove socket from all rooms
    const rooms = this.socketRooms.get(socketId);
    if (rooms) {
      for (const roomName of rooms) {
        this.leaveRoom(socketId, roomName);
      }
    }

    this.sockets.delete(socketId);
    this.socketRooms.delete(socketId);
  }

  async joinRoom(socketId: string, roomName: string): Promise<void> {
    const room = this.rooms.get(roomName);
    const socket = this.sockets.get(socketId);

    if (!socket) return;

    if (!room) {
      this.rooms.set(roomName, {
        name: roomName,
        sockets: new Set([socketId]),
        created: new Date()
      });
    } else {
      room.sockets.add(socketId);
    }

    const socketRooms = this.socketRooms.get(socketId) || new Set();
    socketRooms.add(roomName);
    this.socketRooms.set(socketId, socketRooms);

    // Join actual socket.io room
    socket.join(roomName);

    this.emit('joined-room', { socketId, roomName });
  }

  async leaveRoom(socketId: string, roomName: string): Promise<void> {
    const room = this.rooms.get(roomName);
    const socket = this.sockets.get(socketId);

    if (!room || !socket) return;

    room.sockets.delete(socketId);

    if (room.sockets.size === 0) {
      this.rooms.delete(roomName);
    }

    const socketRooms = this.socketRooms.get(socketId);
    if (socketRooms) {
      socketRooms.delete(roomName);
    }

    // Leave actual socket.io room
    socket.leave(roomName);

    this.emit('left-room', { socketId, roomName });
  }

  async broadcast(message: Message): Promise<void> {
    if (message.room) {
      // Broadcast to room
      this.broadcastToRoom(message.room, message.type, message.data, message.except);
    } else {
      // Broadcast to all
      this.broadcastToAll(message.type, message.data, message.except);
    }
  }

  private async broadcastToRoom(
    roomName: string,
    type: string,
    data: any,
    except?: string
  ): Promise<void> {
    const room = this.rooms.get(roomName);
    if (!room) return;

    for (const socketId of room.sockets) {
      if (except && socketId === except) continue;

      const socket = this.sockets.get(socketId);
      if (socket) {
        socket.emit(type, data);
      }
    }

    this.emit('broadcasted', { room: roomName, type, data });
  }

  private async broadcastToAll(type: string, data: any, except?: string): Promise<void> {
    for (const [socketId, socket] of this.sockets) {
      if (except && socketId === except) continue;

      socket.emit(type, data);
    }

    this.emit('broadcasted', { room: 'all', type, data });
  }

  async sendToSocket(socketId: string, type: string, data: any): Promise<void> {
    const socket = this.sockets.get(socketId);
    if (!socket) return;

    socket.emit(type, data);

    this.emit('sent', { socketId, type, data });
  }

  getRoomInfo(roomName: string): RoomInfo | null {
    return this.rooms.get(roomName) || null;
  }

  getAllRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  getSocketRooms(socketId: string): string[] {
    const rooms = this.socketRooms.get(socketId);
    return rooms ? Array.from(rooms) : [];
  }

  getSocketCount(): number {
    return this.sockets.size;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
```

## 3. Implementation Checklist

### 3.1 Preparation Phase

- [ ] Create feature branch `feature/redis-elimination`
- [ ] Document current Redis usage patterns
- [ ] Identify critical paths requiring careful migration
- [ ] Set up monitoring baseline metrics
- [ ] Prepare rollback procedures

### 3.2 Dependencies Management

- [ ] Install new dependencies:
  ```bash
  npm install node-cache
  npm uninstall ioredis redis bullmq @bull-board/api @bull-board/express
  npm uninstall connect-redis @socket.io/redis-adapter socket.io-redis-adapter
  ```

- [ ] Update type definitions
- [ ] Remove Redis-related imports from all files
- [ ] Update Docker compose files to remove Redis service

### 3.3 Code Migration

- [ ] Implement cache interface abstraction
- [ ] Replace Redis client with memory cache implementation
- [ ] Migrate session storage to database
- [ ] Replace Redis rate limiting with in-memory implementation
- [ ] Implement database-backed queue system
- [ ] Replace WebSocket Redis adapter with memory adapter
- [ ] Update authentication middleware
- [ ] Update caching service
- [ ] Update queue implementations
- [ ] Update WebSocket configuration

### 3.4 Database Changes

- [ ] Create sessions table
- [ ] Create queue jobs table
- [ ] Add necessary indexes
- [ ] Create cleanup procedures
- [ ] Update database connection pool settings

### 3.5 Testing

- [ ] Unit tests for all new implementations
- [ ] Integration tests for session management
- [ ] Load tests for rate limiting
- [ ] Queue processing tests
- [ ] WebSocket communication tests
- [ ] Performance benchmarking
- [ ] Memory leak detection

### 3.6 Configuration

- [ ] Update environment variables
- [ ] Remove Redis-related configuration
- [ ] Add cache size limits
- [ ] Configure cleanup intervals
- [ ] Set monitoring thresholds

### 3.7 Deployment

- [ ] Update deployment documentation
- [ ] Modify Docker configurations
- [ ] Update Kubernetes manifests
- [ ] Adjust CI/CD pipeline
- [ ] Prepare feature flags for gradual rollout

## 4. Monitoring and Observability

### 4.1 Key Metrics to Track

```typescript
// src/services/migration-metrics.ts
export class MigrationMetrics {
  private metrics: {
    cache: {
      hits: number;
      misses: number;
      size: number;
      evictions: number;
    };
    sessions: {
      active: number;
      created: number;
      destroyed: number;
      errors: number;
    };
    rateLimit: {
      checks: number;
      blocked: number;
      errors: number;
    };
    queues: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
  };

  constructor() {
    this.metrics = {
      cache: { hits: 0, misses: 0, size: 0, evictions: 0 },
      sessions: { active: 0, created: 0, destroyed: 0, errors: 0 },
      rateLimit: { checks: 0, blocked: 0, errors: 0 },
      queues: { waiting: 0, active: 0, completed: 0, failed: 0 },
      memory: { heapUsed: 0, heapTotal: 0, external: 0 }
    };

    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memory = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      };

      // Send metrics to monitoring system
      this.sendMetrics();
    }, 30000); // Every 30 seconds
  }

  private sendMetrics(): void {
    // Implementation would send to Prometheus/DataDog/New Relic
  }

  // Update methods for various metrics
  updateCacheMetrics(hits: number, misses: number, size: number, evictions: number): void {
    this.metrics.cache = { hits, misses, size, evictions };
  }

  getSessionMetrics(): any {
    return this.metrics.sessions;
  }

  getQueueMetrics(): any {
    return this.metrics.queues;
  }

  getMemoryUsage(): any {
    return this.metrics.memory;
  }
}
```

### 4.2 Health Check Implementation

```typescript
// src/services/health-check.ts
export class HealthCheckService {
  async checkCacheHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const cacheStats = cacheService.getStats();
      const hitRate = cacheStats.overall.overallHitRate;
      const memoryUsage = cacheStats.overall.totalSize;

      if (hitRate < 0.5) {
        return {
          status: 'degraded',
          details: { reason: 'Low cache hit rate', hitRate }
        };
      }

      if (memoryUsage > 500 * 1024 * 1024) { // 500MB
        return {
          status: 'degraded',
          details: { reason: 'High memory usage', memoryUsage }
        };
      }

      return {
        status: 'healthy',
        details: cacheStats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  async checkSessionHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const sessionCount = await sessionStore.getSessionCount();
      const avgResponseTime = await sessionStore.getAverageResponseTime();

      if (avgResponseTime > 100) { // 100ms threshold
        return {
          status: 'degraded',
          details: { reason: 'Slow session operations', avgResponseTime }
        };
      }

      return {
        status: 'healthy',
        details: { sessionCount, avgResponseTime }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  async checkQueueHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const queueStats = await queueService.getCounts();
      const totalJobs = Object.values(queueStats).reduce((a, b) => a + b, 0);

      if (queueStats.failed > totalJobs * 0.1) { // More than 10% failed
        return {
          status: 'degraded',
          details: { reason: 'High failure rate', queueStats }
        };
      }

      return {
        status: 'healthy',
        details: queueStats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }
}
```

## 5. Performance Benchmarks

### 5.1 Baseline Measurement Script

```typescript
// scripts/benchmark-redis-elimination.ts
import { performance } from 'perf_hooks';

export class BenchmarkSuite {
  async runCacheBenchmarks(): Promise<void> {
    console.log('Running cache benchmarks...');

    // Test cache operations
    const iterations = 10000;
    const testData = { id: 'test', data: new Array(100).fill('x') };

    // Write operations
    const writeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await cacheService.set(`test:${i}`, testData);
    }
    const writeTime = performance.now() - writeStart;

    // Read operations
    const readStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await cacheService.get(`test:${i}`);
    }
    const readTime = performance.now() - readStart;

    console.log(`Cache - Write: ${writeTime}ms, Read: ${readTime}ms`);
    console.log(`Cache - Write/sec: ${iterations / (writeTime / 1000)}, Read/sec: ${iterations / (readTime / 1000)}`);
  }

  async runSessionBenchmarks(): Promise<void> {
    console.log('Running session benchmarks...');

    const iterations = 1000;
    const sessionData = { userId: 'test', authenticated: true, permissions: [] };

    // Create sessions
    const createStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await sessionStore.set(`sess:${i}`, sessionData);
    }
    const createTime = performance.now() - createStart;

    // Retrieve sessions
    const retrieveStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await sessionStore.get(`sess:${i}`);
    }
    const retrieveTime = performance.now() - retrieveStart;

    console.log(`Sessions - Create: ${createTime}ms, Retrieve: ${retrieveTime}ms`);
  }

  async runRateLimitBenchmarks(): Promise<void> {
    console.log('Running rate limit benchmarks...');

    const iterations = 10000;

    const rateStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await rateLimiter.checkRateLimit('test', `user:${i % 100}`);
    }
    const rateTime = performance.now() - rateStart;

    console.log(`Rate limiting - ${iterations} checks in ${rateTime}ms`);
    console.log(`Rate limiting - ${iterations / (rateTime / 1000)} checks/sec`);
  }

  async runQueueBenchmarks(): Promise<void> {
    console.log('Running queue benchmarks...');

    const iterations = 1000;
    const jobs = [];

    // Add jobs
    const addStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      jobs.push(queueService.add('test-job', { id: i }));
    }
    await Promise.all(jobs);
    const addTime = performance.now() - addStart;

    console.log(`Queue - Added ${iterations} jobs in ${addTime}ms`);

    // Process jobs
    const processStart = performance.now();
    queueService.process(async (job) => {
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 1));
      return { processed: true };
    });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    const processTime = performance.now() - processStart;

    console.log(`Queue - Processed jobs in ${processTime}ms`);
  }

  async memoryUsageMonitoring(): Promise<void> {
    const initial = process.memoryUsage();

    // Run operations
    await this.runCacheBenchmarks();
    await this.runSessionBenchmarks();

    const final = process.memoryUsage();

    console.log('Memory usage:');
    console.log(`  Initial - Heap: ${initial.heapUsed / 1024 / 1024}MB`);
    console.log(`  Final - Heap: ${final.heapUsed / 1024 / 1024}MB`);
    console.log(`  Increase: ${(final.heapUsed - initial.heapUsed) / 1024 / 1024}MB`);
  }
}
```

## 6. Development Workflow

### 6.1 Branching Strategy

```bash
# Main branches
main                 # Production-ready code
develop              # Integration branch

# Feature branches
feature/redis-elimination-cache      # Cache layer migration
feature/redis-elimination-sessions   # Session storage migration
feature/redis-elimination-queues     # Queue system migration
feature/redis-elimination-websockets # WebSocket adapter migration

# Release branches
release/v2.0.0-redis-elimination     # Final integration
```

### 6.2 Testing Environments

- **Development**: Local with Docker Compose
- **Staging**: Production-like environment with full data set
- **Canary**: Production with limited traffic (5%)
- **Production**: Full production deployment

### 6.3 CI/CD Pipeline Adjustments

```yaml
# .github/workflows/redis-elimination.yml
name: Redis Elimination Pipeline

on:
  push:
    branches: [feature/redis-elimination-*]
  pull_request:
    branches: [develop]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          npm ci
          npm install node-cache
          npm uninstall ioredis redis bullmq

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test

      - name: Run performance benchmarks
        run: npm run test:performance

      - name: Memory leak detection
        run: npm run test:memory-leaks

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          # Deploy without Redis
          ./scripts/deploy-staging.sh --no-redis
```

## 7. Configuration Changes

### 7.1 Environment Variables

```bash
# Remove these
REDIS_URL=
REDIS_TTL=
BULLMQ_REDIS_HOST=
BULLMQ_REDIS_PORT=
SESSION_REDIS_URL=

# Add these
CACHE_TTL=3600
CACHE_MAX_SIZE=10000
SESSION_TTL=86400
RATE_LIMIT_WINDOW_MS=60000
QUEUE_CONCURRENCY=5
WEBSOCKET_ADAPTER=memory
```

### 7.2 Docker Configuration

```yaml
# docker-compose.yml (updated)
version: '3.8'

services:
  app:
    build: .
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/workshopsai
      - CACHE_PROVIDER=memory
      - SESSION_STORE=database
      - QUEUE_PROVIDER=database
    depends_on:
      - postgres
    ports:
      - "3000:3000"

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: workshopsai
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

## 8. Error Handling Patterns

### 8.1 Circuit Breaker Pattern

```typescript
// src/utils/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold = 5,
    private timeout = 60000,
    private resetTimeout = 10000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

### 8.2 Graceful Degradation

```typescript
// src/utils/degradation.ts
export class GracefulDegradation {
  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    errorMessage?: string
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      console.warn(errorMessage || 'Primary operation failed, using fallback', error);
      return await fallback();
    }
  }

  static async withCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    cacheFn: () => Promise<T | null>
  ): Promise<T> {
    try {
      const cached = await cacheFn();
      if (cached !== null) return cached;

      const data = await fetchFn();
      // Store in cache
      await cacheService.set(key, data);
      return data;
    } catch (error) {
      throw error;
    }
  }
}
```

## 9. Rollback Procedures

### 9.1 Feature Flags

```typescript
// src/config/feature-flags.ts
export const featureFlags = {
  USE_MEMORY_CACHE: process.env.USE_MEMORY_CACHE === 'true',
  USE_DATABASE_SESSIONS: process.env.USE_DATABASE_SESSIONS === 'true',
  USE_DATABASE_QUEUES: process.env.USE_DATABASE_QUEUES === 'true',
  USE_MEMORY_RATE_LIMIT: process.env.USE_MEMORY_RATE_LIMIT === 'true',
  USE_MEMORY_WEBSOCKETS: process.env.USE_MEMORY_WEBSOCKETS === 'true'
};
```

### 9.2 Rollback Script

```bash
#!/bin/bash
# scripts/rollback-to-redis.sh

echo "Rolling back to Redis..."

# Reinstall Redis dependencies
npm install ioredis redis bullmq @bull-board/api @bull-board/express
npm install connect-redis @socket.io/redis-adapter

# Restore Redis configuration
cp config/redis.yaml.example config/redis.yaml

# Update environment
export USE_MEMORY_CACHE=false
export USE_DATABASE_SESSIONS=false
export USE_DATABASE_QUEUES=false

# Restart services
docker-compose down
docker-compose up -d redis
docker-compose up -d app

echo "Rollback complete"
```

## 10. Conclusion

This roadmap provides a comprehensive approach to eliminating Redis dependency while maintaining system reliability and performance. Key considerations:

1. **Incremental Migration**: Phase-by-phase approach minimizes risk
2. **Backwards Compatibility**: Feature flags enable instant rollback
3. **Monitoring**: Comprehensive metrics ensure visibility into performance
4. **Testing**: Extensive test coverage validates the migration
5. **Documentation**: Clear procedures enable team alignment

The migration will result in:
- Reduced infrastructure complexity
- Lower operational costs
- Simplified deployment process
- Improved maintainability
- Full control over caching and queue behavior

Execute this roadmap methodically, with careful monitoring at each phase, to ensure a successful migration.