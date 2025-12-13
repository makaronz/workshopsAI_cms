/**
 * PostgreSQL Redis Replacement Schema
 *
 * This file provides PostgreSQL-based implementations for common Redis patterns:
 * - Session management with TTL
 * - Distributed caching with tag-based invalidation
 * - Job queues with worker coordination
 * - Rate limiting with efficient indexing
 * - Pub/Sub messaging emulation
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
  uuid,
  decimal,
  jsonb,
  index,
  primaryKey,
  unique,
  check,
  bigint,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// ===== ENUMS =====

export const cacheEntryStatusEnum = pgEnum('cache_entry_status', [
  'active',
  'expired',
  'evicted',
  'invalidated'
]);

export const jobStatusEnum = pgEnum('job_status', [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
  'stuck',
  'cancelled'
]);

export const jobPriorityEnum = pgEnum('job_priority', [
  'low',
  'normal',
  'high',
  'critical'
]);

export const workerStatusEnum = pgEnum('worker_status', [
  'idle',
  'active',
  'paused',
  'stopping',
  'offline'
]);

export const rateLimitWindowEnum = pgEnum('rate_limit_window', [
  'second',
  'minute',
  'hour',
  'day',
  'week',
  'month'
]);

export const messageTypeEnum = pgEnum('message_type', [
  'publish',
  'subscribe',
  'unsubscribe',
  'pattern',
  'unsubscribe_pattern'
]);

export const messageAckStatusEnum = pgEnum('message_ack_status', [
  'pending',
  'acknowledged',
  'failed',
  'timeout'
]);

// ===== SESSION MANAGEMENT =====

/**
 * pg_sessions - PostgreSQL replacement for Redis session storage
 * Supports automatic TTL cleanup and efficient session lookup
 */
export const pgSessions = pgTable(
  'pg_sessions',
  {
    id: text('id').primaryKey(), // Session ID (compatible with express-session)
    userId: uuid('user_id'), // Optional user ID for authenticated sessions
    data: jsonb('data').notNull(), // Session data (JSON)
    ipAddress: text('ip_address'), // Client IP for security
    userAgent: text('user_agent'), // Client user agent
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(), // TTL - when session expires
    lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
    accessCount: bigint('access_count', { mode: 'bigint' }).default(1).notNull(),
  },
  (table) => ({
    // Index for fast session lookup
    sessionIdIdx: index('idx_pg_sessions_id').on(table.id),
    // Index for user session lookup
    userIdIdx: index('idx_pg_sessions_user_id').on(table.userId),
    // Composite index for active sessions with expiration
    activeSessionIdx: index('idx_pg_sessions_active_expires').on(
      table.isActive,
      table.expiresAt
    ),
    // Index for cleanup expired sessions
    expiresAtIdx: index('idx_pg_sessions_expires_at').on(table.expiresAt),
    // Partial index for only active sessions
    activeOnlyIdx: index('idx_pg_sessions_active_only')
      .on(table.lastAccessedAt)
      .where(sql`is_active = true`),
  })
);

// ===== DISTRIBUTED CACHING =====

/**
 * pg_cache_entries - General purpose cache with tag support
 * Replaces Redis GET/SET operations with PostgreSQL persistence
 */
export const pgCacheEntries = pgTable(
  'pg_cache_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    value: jsonb('value').notNull(), // Cached value
    tags: text('tags').array(), // Array of tags for selective invalidation
    version: bigint('version', { mode: 'bigint' }).default(1).notNull(), // Optimistic locking
    status: cacheEntryStatusEnum('status').default('active').notNull(),
    namespace: text('namespace'), // Optional namespace for key isolation
    ttl: bigint('ttl', { mode: 'bigint' }), // TTL in seconds
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'), // When cache entry expires
    lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
    accessCount: bigint('access_count', { mode: 'bigint' }).default(1).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).default(0), // Size in bytes for LRU
    metadata: jsonb('metadata'), // Optional metadata
  },
  (table) => ({
    // Unique key constraint
    keyUnique: unique('uq_pg_cache_entries_key').on(table.key),
    // Primary key lookup
    idIdx: index('idx_pg_cache_entries_id').on(table.id),
    // Fast key lookup
    keyIdx: index('idx_pg_cache_entries_key').on(table.key),
    // Namespace lookup
    namespaceIdx: index('idx_pg_cache_entries_namespace').on(table.namespace),
    // Tag lookup (GIN index for array operations)
    tagsIdx: index('idx_pg_cache_entries_tags').using('gin', table.tags),
    // Composite index for active entries with expiration
    activeExpiresIdx: index('idx_pg_cache_entries_active_expires').on(
      table.status,
      table.expiresAt
    ),
    // LRU tracking
    lruIdx: index('idx_pg_cache_entries_lru').on(table.lastAccessedAt, table.sizeBytes),
    // Partial index for only active entries
    activeOnlyIdx: index('idx_pg_cache_entries_active_only')
      .on(table.key)
      .where(sql`status = 'active'`),
  })
);

/**
 * pg_cache_tags - Tag management for selective cache invalidation
 */
export const pgCacheTags = pgTable(
  'pg_cache_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tag: text('tag').notNull().unique(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    invalidatedAt: timestamp('invalidated_at'), // When all entries with this tag were invalidated
  },
  (table) => ({
    tagUnique: unique('uq_pg_cache_tags_tag').on(table.tag),
    tagIdx: index('idx_pg_cache_tags_tag').on(table.tag),
  })
);

/**
 * pg_cache_stats - Cache performance statistics
 */
export const pgCacheStats = pgTable(
  'pg_cache_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    namespace: text('namespace'),
    date: timestamp('date').defaultNow().notNull(), // Daily stats
    hits: bigint('hits', { mode: 'bigint' }).default(0).notNull(),
    misses: bigint('misses', { mode: 'bigint' }).default(0).notNull(),
    sets: bigint('sets', { mode: 'bigint' }).default(0).notNull(),
    deletes: bigint('deletes', { mode: 'bigint' }).default(0).notNull(),
    evictions: bigint('evictions', { mode: 'bigint' }).default(0).notNull(),
    avgAccessTime: decimal('avg_access_time', { precision: 10, scale: 3 }), // ms
    maxMemoryUsage: bigint('max_memory_usage', { mode: 'bigint' }).default(0),
    entryCount: bigint('entry_count', { mode: 'bigint' }).default(0),
  },
  (table) => ({
    namespaceDateIdx: index('idx_pg_cache_stats_namespace_date').on(
      table.namespace,
      table.date
    ),
    dateIdx: index('idx_pg_cache_stats_date').on(table.date),
  })
);

// ===== JOB QUEUES =====

/**
 * pg_jobs - BullMQ-compatible job queue implementation
 * Supports delays, retries, priorities, and worker coordination
 */
export const pgJobs = pgTable(
  'pg_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: text('job_id').notNull().unique(), // External job ID
    queueName: text('queue_name').notNull(),
    name: text('name').notNull(), // Job type/name
    data: jsonb('data').notNull(), // Job payload
    opts: jsonb('opts'), // Job options (attempts, delay, etc.)
    status: jobStatusEnum('status').default('waiting').notNull(),
    priority: jobPriorityEnum('priority').default('normal').notNull(),
    progress: bigint('progress', { mode: 'bigint' }).default(0).notNull(),
    attemptsMade: bigint('attempts_made', { mode: 'bigint' }).default(0).notNull(),
    maxAttempts: bigint('max_attempts', { mode: 'bigint' }).default(3).notNull(),
    processedOn: timestamp('processed_on'),
    finishedOn: timestamp('finished_on'),
    failedReason: text('failed_reason'),
    stacktrace: text('stacktrace'),
    returnValue: jsonb('return_value'),
    timestamp: bigint('timestamp', { mode: 'bigint' }).notNull(), // Job creation timestamp
    delay: bigint('delay', { mode: 'bigint' }).default(0).notNull(), // Delay in ms
    repeat: jsonb('repeat'), // Repeat job configuration
    cron: text('cron'), // Cron expression for repeat jobs
    parentKey: text('parent_key'), // Parent job for dependencies
    parentDependenciesKey: text('parent_dependencies_key'),
    parentId: uuid('parent_id').references(() => pgJobs.id, {
      onDelete: 'set null',
    }),
    workerId: text('worker_id'), // ID of worker processing this job
    lockUntil: timestamp('lock_until'), // Job lock timeout
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    jobIdUnique: unique('uq_pg_jobs_job_id').on(table.jobId),
    jobIdIdx: index('idx_pg_jobs_job_id').on(table.jobId),
    queueNameIdx: index('idx_pg_jobs_queue_name').on(table.queueName),
    statusIdx: index('idx_pg_jobs_status').on(table.status),
    priorityIdx: index('idx_pg_jobs_priority').on(table.priority),
    // Composite index for job selection by workers
    waitingJobsIdx: index('idx_pg_jobs_waiting').on(
      table.queueName,
      table.status,
      table.priority,
      table.createdAt
    ),
    // Delayed jobs index
    delayedJobsIdx: index('idx_pg_jobs_delayed').on(
      table.queueName,
      table.status,
      sql`(timestamp + delay)`, // When job becomes eligible
    ),
    // Failed jobs index for retries
    failedJobsIdx: index('idx_pg_jobs_failed').on(
      table.queueName,
      table.status,
      table.attemptsMade,
      table.maxAttempts,
    ),
    // Worker lock index
    workerLockIdx: index('idx_pg_jobs_worker_lock').on(
      table.workerId,
      table.lockUntil
    ),
    // Parent job index
    parentIdx: index('idx_pg_jobs_parent').on(table.parentId),
    // Timestamp for sorting
    timestampIdx: index('idx_pg_jobs_timestamp').on(table.timestamp),
  })
);

/**
 * pg_job_dependencies - Job dependency management
 */
export const pgJobDependencies = pgTable(
  'pg_job_dependencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => pgJobs.id, { onDelete: 'cascade' }),
    dependsOnJobId: uuid('depends_on_job_id')
      .notNull()
      .references(() => pgJobs.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Prevent duplicate dependencies
    jobDependencyUnique: unique('uq_pg_job_dependencies_unique').on(
      table.jobId,
      table.dependsOnJobId
    ),
    jobIdIdx: index('idx_pg_job_dependencies_job_id').on(table.jobId),
    dependsOnJobIdIdx: index('idx_pg_job_dependencies_depends_on').on(
      table.dependsOnJobId
    ),
  })
);

/**
 * pg_workers - Worker process tracking
 */
export const pgWorkers = pgTable(
  'pg_workers',
  {
    id: text('id').primaryKey(), // Worker ID (hostname:pid)
    queueName: text('queue_name').notNull(),
    pid: bigint('pid', { mode: 'bigint' }).notNull(),
    hostname: text('hostname').notNull(),
    status: workerStatusEnum('status').default('idle').notNull(),
    concurrency: bigint('concurrency', { mode: 'bigint' }).default(1).notNull(),
    maxConcurrency: bigint('max_concurrency', { mode: 'bigint' }).default(1).notNull(),
    processedJobs: bigint('processed_jobs', { mode: 'bigint' }).default(0).notNull(),
    failedJobs: bigint('failed_jobs', { mode: 'bigint' }).default(0).notNull(),
    currentJobId: uuid('current_job_id').references(() => pgJobs.id, {
      onDelete: 'set null',
    }),
    lastJobAt: timestamp('last_job_at'),
    lastHeartbeatAt: timestamp('last_heartbeat_at').defaultNow().notNull(),
    metadata: jsonb('metadata'), // Worker metadata (version, config, etc.)
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    workerIdUnique: unique('uq_pg_workers_id').on(table.id),
    queueNameIdx: index('idx_pg_workers_queue_name').on(table.queueName),
    statusIdx: index('idx_pg_workers_status').on(table.status),
    heartbeatIdx: index('idx_pg_workers_heartbeat').on(table.lastHeartbeatAt),
    currentJobIdIdx: index('idx_pg_workers_current_job').on(table.currentJobId),
  })
);

/**
 * pg_job_events - Job lifecycle events for auditing
 */
export const pgJobEvents = pgTable(
  'pg_job_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => pgJobs.id, { onDelete: 'cascade' }),
    workerId: text('worker_id'),
    event: text('event').notNull(), // 'created', 'started', 'completed', 'failed', 'stalled'
    data: jsonb('data'), // Event-specific data
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    jobIdIdx: index('idx_pg_job_events_job_id').on(table.jobId),
    workerIdIdx: index('idx_pg_job_events_worker_id').on(table.workerId),
    eventIdx: index('idx_pg_job_events_event').on(table.event),
    timestampIdx: index('idx_pg_job_events_timestamp').on(table.timestamp),
    // Composite for job timeline
    jobTimelineIdx: index('idx_pg_job_events_timeline').on(
      table.jobId,
      table.timestamp
    ),
  })
);

// ===== RATE LIMITING =====

/**
 * pg_rate_limits - Token bucket algorithm implementation
 * Replaces Redis INCR/EXPIRE for rate limiting
 */
export const pgRateLimits = pgTable(
  'pg_rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(), // Rate limit key (e.g., "user:123:api")
    window: rateLimitWindowEnum('window').notNull(), // Time window
    windowStart: timestamp('window_start').notNull(), // Start of current window
    maxRequests: bigint('max_requests', { mode: 'bigint' }).notNull(), // Limit per window
    currentRequests: bigint('current_requests', { mode: 'bigint' }).default(0).notNull(),
    resetAt: timestamp('reset_at').notNull(), // When window resets
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    metadata: jsonb('metadata'), // Additional context
  },
  (table) => ({
    // Unique constraint for key + window
    keyWindowUnique: unique('uq_pg_rate_limits_key_window').on(
      table.key,
      table.window,
      table.windowStart
    ),
    keyIdx: index('idx_pg_rate_limits_key').on(table.key),
    windowIdx: index('idx_pg_rate_limits_window').on(table.window),
    resetAtIdx: index('idx_pg_rate_limits_reset_at').on(table.resetAt),
    // Fast lookup for active limits
    activeLimitsIdx: index('idx_pg_rate_limits_active').on(
      table.key,
      table.window,
      table.windowStart
    ),
  })
);

/**
 * pg_rate_limit_history - Historical rate limit data for analysis
 */
export const pgRateLimitHistory = pgTable(
  'pg_rate_limit_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    window: rateLimitWindowEnum('window').notNull(),
    windowStart: timestamp('window_start').notNull(),
    requests: bigint('requests', { mode: 'bigint' }).notNull(),
    blocked: bigint('blocked', { mode: 'bigint' }).default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    keyWindowIdx: index('idx_pg_rate_limit_history_key_window').on(
      table.key,
      table.window
    ),
    windowStartIdx: index('idx_pg_rate_limit_history_window_start').on(
      table.windowStart
    ),
  })
);

// ===== PUB/SUB MESSAGING =====

/**
 * pg_channels - Channel management for publish/subscribe
 */
export const pgChannels = pgTable(
  'pg_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(), // Channel name
    pattern: text('pattern'), // Pattern for pattern-based subscriptions
    subscriberCount: bigint('subscriber_count', { mode: 'bigint' }).default(0).notNull(),
    lastMessageAt: timestamp('last_message_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameUnique: unique('uq_pg_channels_name').on(table.name),
    nameIdx: index('idx_pg_channels_name').on(table.name),
    patternIdx: index('idx_pg_channels_pattern').on(table.pattern),
  })
);

/**
 * pg_subscriptions - Active subscriptions to channels
 */
export const pgSubscriptions = pgTable(
  'pg_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriberId: text('subscriber_id').notNull(), // Unique subscriber identifier
    channelId: uuid('channel_id')
      .notNull()
      .references(() => pgChannels.id, { onDelete: 'cascade' }),
    channelName: text('channel_name').notNull(), // Denormalized for fast lookup
    pattern: text('pattern'), // Pattern subscription
    isActive: boolean('is_active').default(true).notNull(),
    lastDeliveredAt: timestamp('last_delivered_at'),
    deliveredCount: bigint('delivered_count', { mode: 'bigint' }).default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    subscriberChannelUnique: unique('uq_pg_subscriptions_subscriber_channel').on(
      table.subscriberId,
      table.channelId
    ),
    subscriberIdIdx: index('idx_pg_subscriptions_subscriber_id').on(table.subscriberId),
    channelIdIdx: index('idx_pg_subscriptions_channel_id').on(table.channelId),
    channelNameIdx: index('idx_pg_subscriptions_channel_name').on(table.channelName),
    patternIdx: index('idx_pg_subscriptions_pattern').on(table.pattern),
    activeIdx: index('idx_pg_subscriptions_active').on(table.isActive),
  })
);

/**
 * pg_messages - Published messages queue
 */
export const pgMessages = pgTable(
  'pg_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: text('message_id').notNull().unique(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => pgChannels.id, { onDelete: 'cascade' }),
    channelName: text('channel_name').notNull(),
    messageType: messageTypeEnum('message_type').default('publish').notNull(),
    payload: jsonb('payload').notNull(),
    publisherId: text('publisher_id'),
    ttl: bigint('ttl', { mode: 'bigint' }), // TTL in seconds
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
    deliveryCount: bigint('delivery_count', { mode: 'bigint' }).default(0).notNull(),
  },
  (table) => ({
    messageIdUnique: unique('uq_pg_messages_message_id').on(table.messageId),
    messageIdIdx: index('idx_pg_messages_message_id').on(table.messageId),
    channelIdIdx: index('idx_pg_messages_channel_id').on(table.channelId),
    channelNameIdx: index('idx_pg_messages_channel_name').on(table.channelName),
    messageTypeIdx: index('idx_pg_messages_type').on(table.messageType),
    createdAtIndex: index('idx_pg_messages_created_at').on(table.createdAt),
    expiresAtIndex: index('idx_pg_messages_expires_at').on(table.expiresAt),
    // Index for message delivery
    deliveryIdx: index('idx_pg_messages_delivery').on(
      table.channelId,
      table.processedAt
    ),
  })
);

/**
 * pg_message_deliveries - Track message delivery to subscribers
 */
export const pgMessageDeliveries = pgTable(
  'pg_message_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => pgMessages.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => pgSubscriptions.id, { onDelete: 'cascade' }),
    subscriberId: text('subscriber_id').notNull(),
    status: messageAckStatusEnum('status').default('pending').notNull(),
    attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
    acknowledgedAt: timestamp('acknowledged_at'),
    errorMessage: text('error_message'),
    retryCount: bigint('retry_count', { mode: 'bigint' }).default(0).notNull(),
    maxRetries: bigint('max_retries', { mode: 'bigint' }).default(3).notNull(),
    nextRetryAt: timestamp('next_retry_at'),
  },
  (table) => ({
    // Unique constraint to prevent duplicate deliveries
    messageSubscriptionUnique: unique('uq_pg_message_deliveries_message_subscription').on(
      table.messageId,
      table.subscriptionId
    ),
    messageIdIdx: index('idx_pg_message_deliveries_message_id').on(table.messageId),
    subscriptionIdIdx: index('idx_pg_message_deliveries_subscription_id').on(table.subscriptionId),
    subscriberIdIdx: index('idx_pg_message_deliveries_subscriber_id').on(table.subscriberId),
    statusIdx: index('idx_pg_message_deliveries_status').on(table.status),
    retryIdx: index('idx_pg_message_deliveries_retry').on(table.nextRetryAt),
  })
);

// ===== LOCKS AND SEMAPHORES =====

/**
 * pg_distributed_locks - Distributed lock implementation
 * Replaces Redis SETNX/EXPIRE for distributed locking
 */
export const pgDistributedLocks = pgTable(
  'pg_distributed_locks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(), // Lock key
    ownerId: text('owner_id').notNull(), // Who owns the lock
    ttl: bigint('ttl', { mode: 'bigint' }).notNull(), // Lock TTL in seconds
    acquiredAt: timestamp('acquired_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    extendedAt: timestamp('extended_at'), // When lock was last extended
    metadata: jsonb('metadata'), // Optional lock metadata
  },
  (table) => ({
    keyUnique: unique('uq_pg_distributed_locks_key').on(table.key),
    keyIdx: index('idx_pg_distributed_locks_key').on(table.key),
    ownerIdIdx: index('idx_pg_distributed_locks_owner_id').on(table.ownerId),
    expiresAtIndex: index('idx_pg_distributed_locks_expires_at').on(table.expiresAt),
  })
);

/**
 * pg_semaphores - Semaphore implementation for concurrency control
 */
export const pgSemaphores = pgTable(
  'pg_semaphores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(), // Semaphore key
    maxPermits: bigint('max_permits', { mode: 'bigint' }).notNull(), // Maximum permits
    availablePermits: bigint('available_permits', { mode: 'bigint' }).notNull(),
    waitingCount: bigint('waiting_count', { mode: 'bigint' }).default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    keyUnique: unique('uq_pg_semaphores_key').on(table.key),
    keyIdx: index('idx_pg_semaphores_key').on(table.key),
    availableIdx: index('idx_pg_semaphores_available').on(table.availablePermits),
  })
);

/**
 * pg_semaphore_holders - Track who holds semaphore permits
 */
export const pgSemaphoreHolders = pgTable(
  'pg_semaphore_holders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    semaphoreId: uuid('semaphore_id')
      .notNull()
      .references(() => pgSemaphores.id, { onDelete: 'cascade' }),
    holderId: text('holder_id').notNull(),
    permits: bigint('permits', { mode: 'bigint' }).notNull(),
    acquiredAt: timestamp('acquired_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    releasedAt: timestamp('released_at'),
  },
  (table) => ({
    semaphoreIdIdx: index('idx_pg_semaphore_holders_semaphore_id').on(table.semaphoreId),
    holderIdIdx: index('idx_pg_semaphore_holders_holder_id').on(table.holderId),
    acquiredAtIndex: index('idx_pg_semaphore_holders_acquired_at').on(table.acquiredAt),
    expiresAtIndex: index('idx_pg_semaphore_holders_expires_at').on(table.expiresAt),
  })
);

// ===== RELATIONS =====

// Session relations
export const pgSessionsRelations = relations(pgSessions, ({ one }) => ({
  user: one(() => require('./postgresql-schema').users, {
    fields: [pgSessions.userId],
    references: [require('./postgresql-schema').users.id],
  }),
}));

// Cache relations
export const pgCacheEntriesRelations = relations(pgCacheEntries, ({ many }) => ({
  tags: many(pgCacheTags),
}));

export const pgCacheTagsRelations = relations(pgCacheTags, ({ many }) => ({
  entries: many(pgCacheEntries),
}));

// Job queue relations
export const pgJobsRelations = relations(pgJobs, ({ one, many }) => ({
  parent: one(pgJobs, {
    fields: [pgJobs.parentId],
    references: [pgJobs.id],
  }),
  children: many(pgJobs),
  dependencies: many(pgJobDependencies),
  dependents: many(pgJobDependencies),
  worker: one(pgWorkers, {
    fields: [pgJobs.workerId],
    references: [pgWorkers.id],
  }),
  events: many(pgJobEvents),
}));

export const pgJobDependenciesRelations = relations(pgJobDependencies, ({ one }) => ({
  job: one(pgJobs, {
    fields: [pgJobDependencies.jobId],
    references: [pgJobs.id],
  }),
  dependsOnJob: one(pgJobs, {
    fields: [pgJobDependencies.dependsOnJobId],
    references: [pgJobs.id],
  }),
}));

export const pgWorkersRelations = relations(pgWorkers, ({ one, many }) => ({
  currentJob: one(pgJobs, {
    fields: [pgWorkers.currentJobId],
    references: [pgJobs.id],
  }),
  jobs: many(pgJobs),
}));

export const pgJobEventsRelations = relations(pgJobEvents, ({ one }) => ({
  job: one(pgJobs, {
    fields: [pgJobEvents.jobId],
    references: [pgJobs.id],
  }),
}));

// Pub/Sub relations
export const pgChannelsRelations = relations(pgChannels, ({ many }) => ({
  subscriptions: many(pgSubscriptions),
  messages: many(pgMessages),
}));

export const pgSubscriptionsRelations = relations(pgSubscriptions, ({ one, many }) => ({
  channel: one(pgChannels, {
    fields: [pgSubscriptions.channelId],
    references: [pgChannels.id],
  }),
  deliveries: many(pgMessageDeliveries),
}));

export const pgMessagesRelations = relations(pgMessages, ({ one, many }) => ({
  channel: one(pgChannels, {
    fields: [pgMessages.channelId],
    references: [pgChannels.id],
  }),
  deliveries: many(pgMessageDeliveries),
}));

export const pgMessageDeliveriesRelations = relations(pgMessageDeliveries, ({ one }) => ({
  message: one(pgMessages, {
    fields: [pgMessageDeliveries.messageId],
    references: [pgMessages.id],
  }),
  subscription: one(pgSubscriptions, {
    fields: [pgMessageDeliveries.subscriptionId],
    references: [pgSubscriptions.id],
  }),
}));

// Semaphore relations
export const pgSemaphoresRelations = relations(pgSemaphores, ({ many }) => ({
  holders: many(pgSemaphoreHolders),
}));

export const pgSemaphoreHoldersRelations = relations(pgSemaphoreHolders, ({ one }) => ({
  semaphore: one(pgSemaphores, {
    fields: [pgSemaphoreHolders.semaphoreId],
    references: [pgSemaphores.id],
  }),
}));

// Export types
export type PgSession = typeof pgSessions.$inferSelect;
export type InsertPgSession = typeof pgSessions.$inferInsert;

export type PgCacheEntry = typeof pgCacheEntries.$inferSelect;
export type InsertPgCacheEntry = typeof pgCacheEntries.$inferInsert;

export type PgJob = typeof pgJobs.$inferSelect;
export type InsertPgJob = typeof pgJobs.$inferInsert;

export type PgWorker = typeof pgWorkers.$inferSelect;
export type InsertPgWorker = typeof pgWorkers.$inferInsert;

export type PgRateLimit = typeof pgRateLimits.$inferSelect;
export type InsertPgRateLimit = typeof pgRateLimits.$inferInsert;

export type PgMessage = typeof pgMessages.$inferSelect;
export type InsertPgMessage = typeof pgMessages.$inferInsert;

export type PgChannel = typeof pgChannels.$inferSelect;
export type InsertPgChannel = typeof pgChannels.$inferInsert;

export type PgSubscription = typeof pgSubscriptions.$inferSelect;
export type InsertPgSubscription = typeof pgSubscriptions.$inferInsert;

export type PgDistributedLock = typeof pgDistributedLocks.$inferSelect;
export type InsertPgDistributedLock = typeof pgDistributedLocks.$inferInsert;

export type PgSemaphore = typeof pgSemaphores.$inferSelect;
export type InsertPgSemaphore = typeof pgSemaphores.$inferInsert;