import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
  integer,
  jsonb,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums for Cache
export const cacheLevelEnum = pgEnum('cacheLevel', ['L1', 'L2', 'L3']);
export const cachePriorityEnum = pgEnum('cachePriority', ['low', 'medium', 'high']);
export const warmingStatusEnum = pgEnum('warmingStatus', ['pending', 'running', 'completed', 'failed']);
export const invalidationTypeEnum = pgEnum('invalidationType', ['key', 'tag', 'pattern', 'cleanup', 'all']);

// Cache entries table for L2 cache
export const cacheEntries = pgTable(
  'cache_entries',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    key: text('key').notNull().unique(),
    value: text('value').notNull(), // Will store compressed base64 data
    metadata: jsonb('metadata').notNull().default({}),
    tags: text('tags').array().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    accessCount: integer('access_count').default(0).notNull(),
    lastAccessed: timestamp('last_accessed').defaultNow().notNull(),
    sizeBytes: integer('size_bytes').default(0).notNull(),
    checksum: text('checksum'),
    compressed: boolean('compressed').default(false).notNull(),
    level: cacheLevelEnum('level').default('L2').notNull(),
    priority: cachePriorityEnum('priority').default('medium').notNull(),
  },
  (table) => ({
    keyIdx: index('idx_cache_entries_key').on(table.key),
    expiresAtIdx: index('idx_cache_entries_expires_at').on(table.expiresAt),
    tagsIdx: index('idx_cache_entries_tags').using('gin', table.tags),
    lastAccessedIdx: index('idx_cache_entries_last_accessed').on(table.lastAccessed),
    activeIdx: index('idx_cache_entries_active').on(table.key).where(
      sql`(expires_at IS NULL OR expires_at > NOW())`
    ),
    priorityIdx: index('idx_cache_entries_priority').on(table.priority),
    levelIdx: index('idx_cache_entries_level').on(table.level),
  })
);

// Cache statistics table for monitoring
export const cacheStatistics = pgTable(
  'cache_statistics',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    cacheLevel: text('cache_level').notNull(),
    metricName: text('metric_name').notNull(),
    metricValue: text('metric_value').notNull(), // Using text to store numeric values
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
    metadata: jsonb('metadata').default({}),
  },
  (table) => ({
    levelMetricIdx: index('idx_cache_statistics_level_metric').on(table.cacheLevel, table.metricName),
    recordedAtIdx: index('idx_cache_statistics_recorded_at').on(table.recordedAt),
  })
);

// Cache warming jobs table
export const cacheWarmingJobs = pgTable(
  'cache_warming_jobs',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    strategyName: text('strategy_name').notNull(),
    status: warmingStatusEnum('status').default('pending').notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    keysWarmed: integer('keys_warmed').default(0).notNull(),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('idx_cache_warming_jobs_status').on(table.status),
    strategyIdx: index('idx_cache_warming_jobs_strategy').on(table.strategyName),
    createdAtIdx: index('idx_cache_warming_jobs_created_at').on(table.createdAt),
  })
);

// Cache invalidation log table
export const cacheInvalidationLog = pgTable(
  'cache_invalidation_log',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    operationType: invalidationTypeEnum('operation_type').notNull(),
    target: text('target').notNull(),
    keysAffected: integer('keys_affected').default(0).notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    operationIdx: index('idx_cache_invalidation_log_operation').on(table.operationType),
    createdAtIdx: index('idx_cache_invalidation_log_created_at').on(table.createdAt),
  })
);

// Relations
export const cacheEntriesRelations = relations(cacheEntries, ({ many }) => ({
  invalidationLogs: many(cacheInvalidationLog),
}));

export const cacheInvalidationLogRelations = relations(cacheInvalidationLog, ({ one }) => ({
  cacheEntry: one(cacheEntries, {
    fields: [cacheInvalidationLog.target],
    references: [cacheEntries.key],
  }),
}));

// Types
export type CacheEntry = typeof cacheEntries.$inferSelect;
export type NewCacheEntry = typeof cacheEntries.$inferInsert;
export type CacheStatistic = typeof cacheStatistics.$inferSelect;
export type NewCacheStatistic = typeof cacheStatistics.$inferInsert;
export type CacheWarmingJob = typeof cacheWarmingJobs.$inferSelect;
export type NewCacheWarmingJob = typeof cacheWarmingJobs.$inferInsert;
export type CacheInvalidationLog = typeof cacheInvalidationLog.$inferSelect;
export type NewCacheInvalidationLog = typeof cacheInvalidationLog.$inferInsert;