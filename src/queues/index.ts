/**
 * PostgreSQL Job Queue System - Main Export
 * Complete BullMQ replacement with PostgreSQL backend
 */

// Core queue system
export {
  PostgreSQLQueue,
  PostgreSQLWorker,
  PostgreSQLJobScheduler,
  type Job,
  type JobData,
  type JobOptions,
  type QueueStats,
  type WorkerOptions,
  type ScheduleOptions,
  type RecurringJobData,
} from './postgresql-job-queue';

// Monitoring and administration
export {
  PostgreSQLQueueMonitor,
  type QueueMetrics,
  type WorkerMetrics,
  type JobDetail,
  type QueueAlert,
} from './postgresql-queue-monitor';

export {
  PostgreSQLQueueAdmin,
  type AdminOptions,
  type QueueHealth,
  type CleanupResult,
} from './postgresql-queue-admin';

// Workshop analysis queue implementation
export {
  WorkshopAnalysisQueue,
  workshopAnalysisQueue,
  type AnalysisJobData,
  type AnalysisJobResult,
} from './postgresql-workshop-analysis-queue';

// Dashboard API routes
export { default as queueDashboardRouter } from './postgresql-queue-dashboard';

// Database schema
export * from '../models/postgresql-job-queue-schema';