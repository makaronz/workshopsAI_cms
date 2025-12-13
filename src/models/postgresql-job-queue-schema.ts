/**
 * PostgreSQL Job Queue Schema
 * Complete job queue system tables for replacing BullMQ
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
  integer,
  bigint,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Job Status Enum
export const jobStatusEnum = pgEnum('jobStatus', [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
  'stuck',
  'cancelled',
]);

// Job Priority Enum
export const jobPriorityEnum = pgEnum('jobPriority', [
  'low',
  'normal',
  'high',
  'critical',
]);

// Worker Status Enum
export const workerStatusEnum = pgEnum('workerStatus', [
  'idle',
  'active',
  'draining',
  'offline',
]);

// Queue Config Table
export const queueConfigs = pgTable('queue_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  maxConcurrency: integer('max_concurrency').default(5),
  defaultJobOptions: jsonb('default_job_options').$type<{
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
    delay?: number;
    removeOnComplete?: number;
    removeOnFail?: number;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  }>().default({}),
  isPaused: boolean('is_paused').default(false),
  settings: jsonb('settings').$type<{
    jobTimeout?: number;
    stalledInterval?: number;
    maxStalledCount?: number;
    retryLimit?: number;
    lockDuration?: number;
    lockRenewTime?: number;
  }>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  nameIdx: index('queue_configs_name_idx').on(table.name),
}));

// Jobs Table
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  queueName: text('queue_name').notNull(),
  name: text('name').default('default'),
  data: jsonb('data').notNull(),
  opts: jsonb('opts').$type<{
    attempts?: number;
    delay?: number;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    removeOnComplete?: number;
    removeOnFail?: number;
    repeat?: {
      pattern?: string;
      endDate?: Date;
      tz?: string;
    };
    jobId?: string;
  }>().default({}),
  status: jobStatusEnum('status').default('waiting'),
  priority: jobPriorityEnum('priority').default('normal'),
  progress: integer('progress').default(0),
  returnvalue: jsonb('returnvalue'),
  failedReason: text('failed_reason'),
  stacktrace: text('stacktrace'),
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(3),
  delayUntil: timestamp('delay_until'),
  processedOn: timestamp('processed_on'),
  finishedOn: timestamp('finished_on'),
  timestamp: timestamp('timestamp').defaultNow(),
  createdBy: text('created_by'),
  parentJobId: uuid('parent_job_id').references(() => jobs.id, { onDelete: 'set null' }),
  dependencyJobId: uuid('dependency_job_id').references(() => jobs.id, { onDelete: 'set null' }),
  cron: text('cron'),
  nextRunAt: timestamp('next_run_at'),
  workerId: uuid('worker_id').references(() => workers.id),
  lockedBy: text('locked_by'),
  lockedUntil: timestamp('locked_until'),
  token: text('token'), // For job claiming
}, (table) => ({
  queueNameIdx: index('jobs_queue_name_idx').on(table.queueName),
  statusIdx: index('jobs_status_idx').on(table.status),
  priorityIdx: index('jobs_priority_idx').on(table.priority.desc()),
  delayUntilIdx: index('jobs_delay_until_idx').on(table.delayUntil),
  workerIdIdx: index('jobs_worker_id_idx').on(table.workerId),
  parentJobIdIdx: index('jobs_parent_job_id_idx').on(table.parentJobId),
  dependencyJobIdIdx: index('jobs_dependency_job_id_idx').on(table.dependencyJobId),
  nextRunAtIdx: index('jobs_next_run_at_idx').on(table.nextRunAt),
  queueStatusPriorityIdx: index('jobs_queue_status_priority_idx').on(
    table.queueName,
    table.status,
    table.priority.desc()
  ),
}));

// Job Dependencies Table
export const jobDependencies = pgTable('job_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  dependsOnJobId: uuid('depends_on_job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  jobIdIdx: index('job_dependencies_job_id_idx').on(table.jobId),
  dependsOnJobIdIdx: index('job_dependencies_depends_on_job_id_idx').on(table.dependsOnJobId),
  uniqueDependency: index('job_dependencies_unique_idx').on(table.jobId, table.dependsOnJobId).unique(),
}));

// Workers Table
export const workers = pgTable('workers', {
  id: uuid('id').primaryKey().defaultRandom(),
  queueName: text('queue_name').notNull(),
  workerId: text('worker_id').notNull(),
  hostname: text('hostname').notNull(),
  pid: integer('pid').notNull(),
  status: workerStatusEnum('status').default('idle'),
  lastSeen: timestamp('last_seen').defaultNow(),
  startedAt: timestamp('started_at').defaultNow(),
  concurrentJobs: integer('concurrent_jobs').default(0),
  maxConcurrency: integer('max_concurrency').default(5),
  metadata: jsonb('metadata').$type<{
    version?: string;
    platform?: string;
    nodeVersion?: string;
    memory?: number;
    cpu?: number;
  }>().default({}),
  settings: jsonb('settings').$type<{
    pollingInterval?: number;
    maxJobs?: number;
    stallInterval?: number;
  }>().default({}),
}, (table) => ({
  queueNameIdx: index('workers_queue_name_idx').on(table.queueName),
  workerIdIdx: index('workers_worker_id_idx').on(table.workerId),
  statusIdx: index('workers_status_idx').on(table.status),
  lastSeenIdx: index('workers_last_seen_idx').on(table.lastSeen),
}));

// Job Logs Table
export const jobLogs = pgTable('job_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  level: text('level').notNull(), // 'info', 'warn', 'error', 'debug'
  message: text('message').notNull(),
  data: jsonb('data'),
  timestamp: timestamp('timestamp').defaultNow(),
}, (table) => ({
  jobIdIdx: index('job_logs_job_id_idx').on(table.jobId),
  timestampIdx: index('job_logs_timestamp_idx').on(table.timestamp.desc()),
  levelIdx: index('job_logs_level_idx').on(table.level),
}));

// Job Metrics Table
export const jobMetrics = pgTable('job_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  queueName: text('queue_name').notNull(),
  date: timestamp('date').notNull(), // Date bucket for metrics
  waitingJobs: bigint('waiting_jobs').default(0),
  activeJobs: bigint('active_jobs').default(0),
  completedJobs: bigint('completed_jobs').default(0),
  failedJobs: bigint('failed_jobs').default(0),
  delayedJobs: bigint('delayed_jobs').default(0),
  averageWaitTime: decimal('average_wait_time', { precision: 10, scale: 2 }).default('0'),
  averageRunTime: decimal('average_run_time', { precision: 10, scale: 2 }).default('0'),
  throughput: decimal('throughput', { precision: 10, scale: 2 }).default('0'),
  errorRate: decimal('error_rate', { precision: 5, scale: 4 }).default('0'),
}, (table) => ({
  queueNameDateIdx: index('job_metrics_queue_name_date_idx').on(table.queueName, table.date),
}));

// Dead Letter Queue
export const deadLetterQueue = pgTable('dead_letter_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  originalJobId: uuid('original_job_id').notNull(),
  queueName: text('queue_name').notNull(),
  jobData: jsonb('job_data').notNull(),
  jobOptions: jsonb('job_options').notNull(),
  error: text('error').notNull(),
  stacktrace: text('stacktrace'),
  failedAt: timestamp('failed_at').defaultNow(),
  retryCount: integer('retry_count').default(0),
  strategy: text('strategy').default('exponential_backoff'), // 'immediate', 'delayed', 'exponential_backoff'
  nextRetryAt: timestamp('next_retry_at'),
  metadata: jsonb('metadata').$type<{
    originalAttempts?: number;
    lastError?: string;
    processingTime?: number;
    workerId?: string;
  }>().default({}),
}, (table) => ({
  queueNameIdx: index('dlq_queue_name_idx').on(table.queueName),
  nextRetryAtIdx: index('dlq_next_retry_at_idx').on(table.nextRetryAt),
  failedAtIdx: index('dlq_failed_at_idx').on(table.failedAt),
}));

// Job Batches Table
export const jobBatches = pgTable('job_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: text('batch_id').notNull().unique(),
  queueName: text('queue_name').notNull(),
  totalJobs: integer('total_jobs').notNull(),
  completedJobs: integer('completed_jobs').default(0),
  failedJobs: integer('failed_jobs').default(0),
  status: text('status').default('active'), // 'active', 'completed', 'failed', 'cancelled'
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  options: jsonb('options').$type<{
    progress?: boolean;
    chunkSize?: number;
    delay?: number;
  }>().default({}),
}, (table) => ({
  batchIdIdx: index('job_batches_batch_id_idx').on(table.batchId),
  queueNameIdx: index('job_batches_queue_name_idx').on(table.queueName),
  statusIdx: index('job_batches_status_idx').on(table.status),
}));

// Job Batch Relations Table
export const jobBatchRelations = pgTable('job_batch_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: text('batch_id').notNull().references(() => jobBatches.batchId, { onDelete: 'cascade' }),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  batchIdIdx: index('job_batch_relations_batch_id_idx').on(table.batchId),
  jobIdIdx: index('job_batch_relations_job_id_idx').on(table.jobId),
  uniqueRelation: index('job_batch_relations_unique_idx').on(table.batchId, table.jobId).unique(),
}));

// Queue Settings Table
export const queueSettings = pgTable('queue_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  queueName: text('queue_name').notNull().unique(),
  settings: jsonb('settings').$type<{
    // Job processing settings
    defaultJobOptions?: any;
    maxConcurrency?: number;
    stalledInterval?: number;
    maxStalledCount?: number;

    // Lock settings
    lockDuration?: number;
    lockRenewTime?: number;

    // Retry settings
    retryLimit?: number;
    retryBackoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
      maxDelay?: number;
      jitter?: boolean;
    };

    // Cleanup settings
    removeOnComplete?: number;
    removeOnFail?: number;
    cleanAge?: number; // in milliseconds

    // Metrics settings
    metricsEnabled?: boolean;
    metricsRetention?: number; // in days

    // Notifications
    notifications?: {
      onJobComplete?: boolean;
      onJobFail?: boolean;
      onQueueEmpty?: boolean;
      webhookUrl?: string;
    };

    // Auto-scaling
    autoScaling?: {
      enabled: boolean;
      minWorkers?: number;
      maxWorkers?: number;
      scaleUpThreshold?: number;
      scaleDownThreshold?: number;
      checkInterval?: number;
    };
  }>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  queueNameIdx: index('queue_settings_queue_name_idx').on(table.queueName),
}));

// Relations
export const queueConfigsRelations = relations(queueConfigs, ({ many }) => ({
  jobs: many(jobs),
  workers: many(workers),
  settings: one(queueSettings),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  queue: one(queueConfigs, {
    fields: [jobs.queueName],
    references: [queueConfigs.name],
  }),
  worker: one(workers, {
    fields: [jobs.workerId],
    references: [workers.id],
  }),
  parentJob: one(jobs, {
    fields: [jobs.parentJobId],
    references: [jobs.id],
  }),
  dependencyJob: one(jobs, {
    fields: [jobs.dependencyJobId],
    references: [jobs.id],
  }),
  childJobs: many(jobs),
  dependentJobs: many(jobs),
  dependencies: many(jobDependencies),
  logs: many(jobLogs),
  batchRelation: one(jobBatchRelations, {
    fields: [jobs.id],
    references: [jobBatchRelations.jobId],
  }),
}));

export const workersRelations = relations(workers, ({ one, many }) => ({
  queue: one(queueConfigs, {
    fields: [workers.queueName],
    references: [queueConfigs.name],
  }),
  jobs: many(jobs),
}));

export const jobDependenciesRelations = relations(jobDependencies, ({ one }) => ({
  job: one(jobs, {
    fields: [jobDependencies.jobId],
    references: [jobs.id],
  }),
  dependsOnJob: one(jobs, {
    fields: [jobDependencies.dependsOnJobId],
    references: [jobs.id],
  }),
}));

export const jobLogsRelations = relations(jobLogs, ({ one }) => ({
  job: one(jobs, {
    fields: [jobLogs.jobId],
    references: [jobs.id],
  }),
}));

export const jobBatchRelationsRelations = relations(jobBatchRelations, ({ one }) => ({
  batch: one(jobBatches, {
    fields: [jobBatchRelations.batchId],
    references: [jobBatches.batchId],
  }),
  job: one(jobs, {
    fields: [jobBatchRelations.jobId],
    references: [jobs.id],
  }),
}));

export const queueSettingsRelations = relations(queueSettings, ({ one }) => ({
  queue: one(queueConfigs, {
    fields: [queueSettings.queueName],
    references: [queueConfigs.name],
  }),
}));