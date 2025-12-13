import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, boolean, pgEnum, integer, jsonb, index } from 'drizzle-orm/pg-core';
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

// Migration SQL
export const up = sql`
  -- Create enums if they don't exist
  DO $$ BEGIN
    CREATE TYPE cacheLevel AS ENUM ('L1', 'L2', 'L3');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE cachePriority AS ENUM ('low', 'medium', 'high');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE warmingStatus AS ENUM ('pending', 'running', 'completed', 'failed');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE invalidationType AS ENUM ('key', 'tag', 'pattern', 'cleanup', 'all');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  -- Create cache_entries table
  CREATE TABLE IF NOT EXISTS cache_entries (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0 NOT NULL,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    size_bytes INTEGER DEFAULT 0 NOT NULL,
    checksum TEXT,
    compressed BOOLEAN DEFAULT FALSE NOT NULL,
    level cacheLevel DEFAULT 'L2' NOT NULL,
    priority cachePriority DEFAULT 'medium' NOT NULL
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries (key);
  CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries (expires_at);
  CREATE INDEX IF NOT EXISTS idx_cache_entries_tags ON cache_entries USING GIN (tags);
  CREATE INDEX IF NOT EXISTS idx_cache_entries_last_accessed ON cache_entries (last_accessed);
  CREATE INDEX IF NOT EXISTS idx_cache_entries_active ON cache_entries (key)
    WHERE (expires_at IS NULL OR expires_at > NOW());
  CREATE INDEX IF NOT EXISTS idx_cache_entries_priority ON cache_entries (priority);
  CREATE INDEX IF NOT EXISTS idx_cache_entries_level ON cache_entries (level);

  -- Create cache_statistics table
  CREATE TABLE IF NOT EXISTS cache_statistics (
    id SERIAL PRIMARY KEY,
    cache_level TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    metadata JSONB DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_cache_statistics_level_metric ON cache_statistics (cache_level, metric_name);
  CREATE INDEX IF NOT EXISTS idx_cache_statistics_recorded_at ON cache_statistics (recorded_at);

  -- Create cache_warming_jobs table
  CREATE TABLE IF NOT EXISTS cache_warming_jobs (
    id SERIAL PRIMARY KEY,
    strategy_name TEXT NOT NULL,
    status warmingStatus DEFAULT 'pending' NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    keys_warmed INTEGER DEFAULT 0 NOT NULL,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_status ON cache_warming_jobs (status);
  CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_strategy ON cache_warming_jobs (strategy_name);
  CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_created_at ON cache_warming_jobs (created_at);

  -- Create cache_invalidation_log table
  CREATE TABLE IF NOT EXISTS cache_invalidation_log (
    id SERIAL PRIMARY KEY,
    operation_type invalidationType NOT NULL,
    target TEXT NOT NULL,
    keys_affected INTEGER DEFAULT 0 NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_operation ON cache_invalidation_log (operation_type);
  CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_created_at ON cache_invalidation_log (created_at);

  -- Create trigger to update updated_at timestamp
  CREATE OR REPLACE FUNCTION update_cache_entries_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ language 'plpgsql';

  DROP TRIGGER IF EXISTS cache_entries_updated_at ON cache_entries;
  CREATE TRIGGER cache_entries_updated_at
    BEFORE UPDATE ON cache_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_cache_entries_updated_at();

  -- Create views
  CREATE OR REPLACE VIEW active_cache_entries AS
  SELECT
    id,
    key,
    size_bytes,
    tags,
    level,
    priority,
    access_count,
    last_accessed,
    expires_at,
    compressed
  FROM cache_entries
  WHERE (expires_at IS NULL OR expires_at > NOW());

  -- Create performance metrics view
  CREATE OR REPLACE VIEW cache_performance_metrics AS
  SELECT
    DATE_TRUNC('hour', recorded_at) as hour,
    cache_level,
    metric_name,
    AVG(CAST(metric_value AS NUMERIC)) as avg_value,
    MIN(CAST(metric_value AS NUMERIC)) as min_value,
    MAX(CAST(metric_value AS NUMERIC)) as max_value,
    COUNT(*) as sample_count
  FROM cache_statistics
  WHERE recorded_at >= NOW() - INTERVAL '24 hours'
  GROUP BY DATE_TRUNC('hour', recorded_at), cache_level, metric_name
  ORDER BY hour DESC, cache_level, metric_name;
`;

export const down = sql`
  -- Drop views
  DROP VIEW IF EXISTS cache_performance_metrics;
  DROP VIEW IF EXISTS active_cache_entries;

  -- Drop triggers
  DROP TRIGGER IF EXISTS cache_entries_updated_at ON cache_entries;

  -- Drop functions
  DROP FUNCTION IF EXISTS update_cache_entries_updated_at();

  -- Drop tables
  DROP TABLE IF EXISTS cache_invalidation_log;
  DROP TABLE IF EXISTS cache_warming_jobs;
  DROP TABLE IF EXISTS cache_statistics;
  DROP TABLE IF EXISTS cache_entries;

  -- Drop enums
  DROP TYPE IF EXISTS invalidationType;
  DROP TYPE IF EXISTS warmingStatus;
  DROP TYPE IF EXISTS cachePriority;
  DROP TYPE IF EXISTS cacheLevel;
`;