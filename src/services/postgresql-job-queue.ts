/**
 * PostgreSQL Job Queue System
 *
 * Replaces BullMQ Redis-based job queue with PostgreSQL implementation
 * Provides job scheduling, retry logic, priority handling, and worker management
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, lt, gte, desc, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/postgresql-database';
import { logger } from '../utils/logger';

// Job queue schema (will be added to main schema)
export const jobQueues = pgTable('job_queues', {
  id: uuid('id').primaryKey().defaultRandom(),
  queueName: text('queue_name').notNull(),
  jobId: text('job_id').notNull().unique(),
  jobData: jsonb('job_data').notNull(),
  jobOptions: jsonb('job_options').$type<{
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
    removeOnComplete?: number;
    removeOnFail?: number;
  }>(),
  status: text('status').default('waiting').notNull(), // 'waiting', 'active', 'completed', 'failed'
  priority: text('priority').default('0').notNull(),
  delay: text('delay').default('0').notNull(), // milliseconds
  attempts: text('attempts').default('0').notNull(),
  maxAttempts: text('max_attempts').default('3').notNull(),
  processedOn: timestamp('processed_on'),
  finishedOn: timestamp('finished_on'),
  failedReason: text('failed_reason'),
  stacktrace: text('stacktrace'),
  returnValue: jsonb('return_value'),
  progress: text('progress').default('0').notNull(), // 0-100
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  queueNameIdx: index('idx_job_queues_queue_name').on(table.queueName),
  statusIdx: index('idx_job_queues_status').on(table.status),
  priorityIdx: index('idx_job_queues_priority').on(table.priority),
  createdAtIdx: index('idx_job_queues_created_at').on(table.createdAt),
  queueStatusPriorityIdx: index('idx_job_queues_queue_status_priority').on(
    table.queueName,
    table.status,
    desc(table.priority),
    asc(table.createdAt)
  ),
}));

export type JobQueue = typeof jobQueues.$inferSelect;
export type InsertJobQueue = typeof jobQueues.$inferInsert;

export interface JobData {
  [key: string]: any;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: number;
  removeOnFail?: number;
}

export interface Job<T = any> {
  id: string;
  name: string;
  data: T;
  opts: JobOptions;
  returnvalue?: any;
  failedReason?: string;
  progress: number;
  processedOn?: Date;
  finishedOn?: Date;
  attemptsMade: number;
}

/**
 * PostgreSQL-based Queue
 * Replaces BullMQ Queue with PostgreSQL implementation
 */
export class PGQueue {
  private queueName: string;
  private defaultOptions: JobOptions;

  constructor(queueName: string, options: { defaultJobOptions?: JobOptions } = {}) {
    this.queueName = queueName;
    this.defaultOptions = options.defaultJobOptions || {};
  }

  /**
   * Add a job to the queue
   */
  async add<T = any>(
    jobName: string,
    data: T,
    options: JobOptions = {}
  ): Promise<Job<T>> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    const jobData: InsertJobQueue = {
      queueName: this.queueName,
      jobId: options.jobId || `${jobName}-${uuidv4()}`,
      jobData: data as any,
      jobOptions: mergedOptions,
      status: 'waiting',
      priority: String(mergedOptions.priority || 0),
      delay: String(mergedOptions.delay || 0),
      maxAttempts: String(mergedOptions.attempts || 3),
      attempts: '0',
      progress: '0',
    };

    // If delay is set, calculate scheduled time
    if (mergedOptions.delay && mergedOptions.delay > 0) {
      const scheduledFor = new Date(Date.now() + mergedOptions.delay);
      // Note: In a real implementation, you might want a separate scheduledFor column
      // For now, we'll handle delay in the worker polling logic
    }

    try {
      const [job] = await db.insert(jobQueues).values(jobData).returning();

      return {
        id: job.id,
        name: jobName,
        data: job.jobData as T,
        opts: job.jobOptions || {},
        progress: parseInt(job.progress),
        attemptsMade: parseInt(job.attempts),
        processedOn: job.processedOn || undefined,
        finishedOn: job.finishedOn || undefined,
        returnvalue: job.returnValue,
        failedReason: job.failedReason,
      };
    } catch (error) {
      logger.error(`Failed to add job to queue ${this.queueName}:`, error);
      throw error;
    }
  }

  /**
   * Get waiting jobs count
   */
  async getWaitingCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobQueues)
      .where(and(
        eq(jobQueues.queueName, this.queueName),
        eq(jobQueues.status, 'waiting'),
        lt(sql`extract(epoch from now()) * 1000`, sql`extract(epoch from ${jobQueues.createdAt}) * 1000 + ${jobQueues.delay}`)
      ));

    return result[0]?.count || 0;
  }

  /**
   * Get active jobs count
   */
  async getActiveCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobQueues)
      .where(and(
        eq(jobQueues.queueName, this.queueName),
        eq(jobQueues.status, 'active')
      ));

    return result[0]?.count || 0;
  }

  /**
   * Get completed jobs count
   */
  async getCompletedCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobQueues)
      .where(and(
        eq(jobQueues.queueName, this.queueName),
        eq(jobQueues.status, 'completed')
      ));

    return result[0]?.count || 0;
  }

  /**
   * Get failed jobs count
   */
  async getFailedCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobQueues)
      .where(and(
        eq(jobQueues.queueName, this.queueName),
        eq(jobQueues.status, 'failed')
      ));

    return result[0]?.count || 0;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    const [job] = await db
      .select()
      .from(jobQueues)
      .where(eq(jobQueues.jobId, jobId))
      .limit(1);

    if (!job) return null;

    return {
      id: job.id,
      name: job.queueName, // Using queue name as job name for now
      data: job.jobData,
      opts: job.jobOptions || {},
      progress: parseInt(job.progress),
      attemptsMade: parseInt(job.attempts),
      processedOn: job.processedOn || undefined,
      finishedOn: job.finishedOn || undefined,
      returnvalue: job.returnValue,
      failedReason: job.failedReason,
    };
  }

  /**
   * Clean up old jobs based on options
   */
  async clean(grace: number = 0, status?: 'completed' | 'failed'): Promise<number> {
    const cutoffTime = new Date(Date.now() - grace);
    const conditions = [
      lt(jobQueues.finishedOn || jobQueues.createdAt, cutoffTime)
    ];

    if (status) {
      conditions.push(eq(jobQueues.status, status));
    } else {
      conditions.push(
        sql`(${jobQueues.status} = 'completed' OR ${jobQueues.status} = 'failed')`
      );
    }

    const result = await db
      .delete(jobQueues)
      .where(and(...conditions));

    return result.rowCount || 0;
  }
}

/**
 * PostgreSQL-based Worker
 * Replaces BullMQ Worker with PostgreSQL implementation
 */
export class PGWorker<T = any> {
  private queueName: string;
  private processor: (job: Job<T>) => Promise<any>;
  private concurrency: number;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeJobs = new Map<string, Promise<any>>();

  constructor(
    queueName: string,
    processor: (job: Job<T>) => Promise<any>,
    options: { concurrency?: number } = {}
  ) {
    this.queueName = queueName;
    this.processor = processor;
    this.concurrency = options.concurrency || 5;
  }

  /**
   * Start the worker
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      logger.warn(`Worker for queue ${this.queueName} is already running`);
      return;
    }

    this.isRunning = true;
    logger.info(`Starting worker for queue ${this.queueName}`);

    // Poll for jobs every 2 seconds
    this.pollInterval = setInterval(() => {
      this.processNextJob();
    }, 2000);

    // Process immediate job
    this.processNextJob();
  }

  /**
   * Stop the worker
   */
  async close(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Wait for all active jobs to complete
    await Promise.allSettled(Array.from(this.activeJobs.values()));
    this.activeJobs.clear();

    logger.info(`Worker for queue ${this.queueName} stopped`);
  }

  /**
   * Process the next available job
   */
  private async processNextJob(): Promise<void> {
    // Check if we're at concurrency limit
    if (this.activeJobs.size >= this.concurrency) {
      return;
    }

    try {
      // Get next waiting job
      const [jobRecord] = await db
        .select()
        .from(jobQueues)
        .where(and(
          eq(jobQueues.queueName, this.queueName),
          eq(jobQueues.status, 'waiting'),
          lt(sql`extract(epoch from now()) * 1000`, sql`extract(epoch from ${jobQueues.createdAt}) * 1000 + ${jobQueues.delay}`)
        ))
        .orderBy(desc(jobQueues.priority), asc(jobQueues.createdAt))
        .limit(1);

      if (!jobRecord) {
        return; // No jobs available
      }

      // Mark job as active
      await db
        .update(jobQueues)
        .set({
          status: 'active',
          processedOn: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobQueues.id, jobRecord.id));

      // Create job object
      const job: Job<T> = {
        id: jobRecord.id,
        name: jobRecord.queueName,
        data: jobRecord.jobData as T,
        opts: jobRecord.jobOptions || {},
        progress: parseInt(jobRecord.progress),
        attemptsMade: parseInt(jobRecord.attempts),
        processedOn: jobRecord.processedOn || undefined,
        finishedOn: jobRecord.finishedOn || undefined,
        returnvalue: jobRecord.returnValue,
        failedReason: jobRecord.failedReason,
      };

      // Process job asynchronously
      const jobPromise = this.processJob(job);
      this.activeJobs.set(jobRecord.id, jobPromise);

      // Clean up when done
      jobPromise.finally(() => {
        this.activeJobs.delete(jobRecord.id);
        // Try to process next job
        setTimeout(() => this.processNextJob(), 100);
      });

    } catch (error) {
      logger.error(`Error processing next job for queue ${this.queueName}:`, error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job<T>): Promise<void> {
    const startTime = Date.now();
    let attemptsMade = job.attemptsMade;

    try {
      logger.info(`Processing job ${job.id} for queue ${this.queueName}`);

      // Execute the processor
      const result = await this.processor(job);

      // Mark job as completed
      await db
        .update(jobQueues)
        .set({
          status: 'completed',
          finishedOn: new Date(),
          returnValue: result,
          progress: '100',
          updatedAt: new Date(),
        })
        .where(eq(jobQueues.id, job.id));

      logger.info(`Job ${job.id} completed successfully`);

    } catch (error: any) {
      logger.error(`Job ${job.id} failed:`, error);

      attemptsMade++;

      // Check if we should retry
      const maxAttempts = job.opts.attempts || 3;

      if (attemptsMade < maxAttempts) {
        // Calculate retry delay
        const retryDelay = this.calculateRetryDelay(attemptsMade, job.opts.backoff);
        const retryAt = new Date(Date.now() + retryDelay);

        // Update job for retry
        await db
          .update(jobQueues)
          .set({
            status: 'waiting',
            attempts: String(attemptsMade),
            failedReason: error.message,
            updatedAt: new Date(),
            // Update createdAt to delay retry (simulating delay)
            createdAt: retryAt,
          })
          .where(eq(jobQueues.id, job.id));

        logger.info(`Job ${job.id} scheduled for retry ${attemptsMade}/${maxAttempts} in ${retryDelay}ms`);

      } else {
        // Mark job as failed
        await db
          .update(jobQueues)
          .set({
            status: 'failed',
            finishedOn: new Date(),
            attempts: String(attemptsMade),
            failedReason: error.message,
            stacktrace: error.stack,
            updatedAt: new Date(),
          })
          .where(eq(jobQueues.id, job.id));

        logger.error(`Job ${job.id} failed permanently after ${attemptsMade} attempts`);
      }
    }

    const duration = Date.now() - startTime;
    logger.debug(`Job processing took ${duration}ms`);
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private calculateRetryDelay(attempt: number, backoff?: { type: 'fixed' | 'exponential'; delay: number }): number {
    if (!backoff) {
      return 2000 * Math.pow(2, attempt - 1); // Default exponential backoff
    }

    if (backoff.type === 'fixed') {
      return backoff.delay;
    }

    // Exponential backoff
    return backoff.delay * Math.pow(2, attempt - 1);
  }

  /**
   * Get worker status
   */
  getStatus(): { running: boolean; activeJobs: number; queueName: string } {
    return {
      running: this.isRunning,
      activeJobs: this.activeJobs.size,
      queueName: this.queueName,
    };
  }
}

// Export for use in workshop analysis queue
export { sql, pgTable, text, jsonb, timestamp, uuid, index } from 'drizzle-orm/pg-core';