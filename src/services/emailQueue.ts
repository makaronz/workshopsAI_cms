import { Queue, Worker, Job, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';
import { redisService } from './redisService';
import { emailConfig } from '../config/email';
import { emailService } from './emailService';
import { db, emailLogs, emailQueueJobs } from '../models/postgresql-schema';
import { eq, sql } from 'drizzle-orm';

export interface EmailJobData {
  emailLogId: string;
  type: string;
  to: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  userId?: number;
  workshopId?: string;
  enrollmentId?: string;
  language: 'pl' | 'en';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
}

export interface EmailQueueConfig {
  redis: Redis;
  queueName: string;
  concurrency: number;
  defaultJobOptions: {
    removeOnComplete: number;
    removeOnFail: number;
    attempts: number;
    backoff: {
      type: string;
      delay: number;
    };
  };
}

class EmailQueueService {
  private queue: Queue;
  private worker: Worker;
  private scheduler: QueueScheduler;
  private config: EmailQueueConfig;

  constructor() {
    this.config = {
      redis: redisService.getClient(),
      queueName: 'email-queue',
      concurrency: emailConfig.queue.concurrency,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: emailConfig.queue.maxRetries,
        backoff: {
          type: 'exponential',
          delay: emailConfig.queue.retryDelay,
        },
      },
    };

    this.queue = new Queue(this.config.queueName, {
      connection: this.config.redis,
      defaultJobOptions: this.config.defaultJobOptions,
    });

    this.scheduler = new QueueScheduler(this.config.queueName, {
      connection: this.config.redis,
    });

    this.worker = new Worker(
      this.config.queueName,
      this.processEmailJob.bind(this),
      {
        connection: this.config.redis,
        concurrency: this.config.concurrency,
      },
    );

    this.setupWorkerEventListeners();
  }

  private setupWorkerEventListeners(): void {
    this.worker.on('completed', async (job: Job) => {
      console.log(`Email job ${job.id} completed successfully`);
      await this.updateJobStatus(job.id!, 'completed');
    });

    this.worker.on('failed', async (job: Job | undefined, error: Error) => {
      console.error(`Email job ${job?.id} failed:`, error);
      if (job) {
        await this.updateJobStatus(
          job.id,
          'failed',
          error.message,
          error.stack,
        );
        await this.handleFailedEmail(job);
      }
    });

    this.worker.on('error', (error: Error) => {
      console.error('Email worker error:', error);
    });

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`Email job ${jobId} stalled`);
    });
  }

  private async processEmailJob(job: Job<EmailJobData>): Promise<void> {
    const {
      emailLogId,
      to,
      subject,
      htmlContent,
      textContent,
      templateId,
      templateData,
    } = job.data;

    try {
      // Update email log status to processing
      await this.updateEmailLogStatus(emailLogId, 'processing');

      // Send email using email service
      const result = await emailService.sendEmail({
        to,
        subject,
        htmlContent,
        textContent,
        templateId,
        templateData,
      });

      // Update email log with result
      await this.updateEmailLogAfterSend(emailLogId, result);

      console.log(`Email sent successfully to ${to}, job ID: ${job.id}`);
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  private async updateEmailLogStatus(
    emailLogId: string,
    status: string,
    errorMessage?: string,
    stacktrace?: string,
  ): Promise<void> {
    const updateData: any = { status, updatedAt: new Date() };

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    if (status === 'failed') {
      updateData.failedAt = new Date();
    } else if (status === 'processing') {
      updateData.retryCount = sql`${emailLogs.retryCount} + 1`;
    }

    await db
      .update(emailLogs)
      .set(updateData)
      .where(eq(emailLogs.id, emailLogId));
  }

  private async updateEmailLogAfterSend(
    emailLogId: string,
    result: { messageId?: string; providerMessageId?: string },
  ): Promise<void> {
    await db
      .update(emailLogs)
      .set({
        status: 'sent',
        messageId: result.messageId,
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailLogs.id, emailLogId));
  }

  private async updateJobStatus(
    jobId: string,
    status: string,
    failedReason?: string,
    stacktrace?: string,
  ): Promise<void> {
    const updateData: any = { status };

    if (failedReason) {
      updateData.failedReason = failedReason;
    }

    if (stacktrace) {
      updateData.stacktrace = stacktrace;
    }

    if (status === 'completed') {
      updateData.finishedOn = new Date();
    } else if (status === 'processing') {
      updateData.processedOn = new Date();
    }

    await db
      .update(emailQueueJobs)
      .set(updateData)
      .where(eq(emailQueueJobs.jobId, jobId));
  }

  private async handleFailedEmail(job: Job<EmailJobData>): Promise<void> {
    const { emailLogId } = job.data;

    // Update email log with failure information
    await this.updateEmailLogStatus(emailLogId, 'failed');

    // Calculate next retry time if there are remaining attempts
    if (job.attemptsMade < job.opts.attempts!) {
      const nextRetryAt = new Date(
        Date.now() +
          (job.opts.backoff as any).delay *
            Math.pow(emailConfig.queue.backoffMultiplier, job.attemptsMade),
      );

      await db
        .update(emailLogs)
        .set({
          nextRetryAt,
          retryCount: job.attemptsMade,
        })
        .where(eq(emailLogs.id, emailLogId));
    }
  }

  async addEmailJob(jobData: EmailJobData): Promise<Job<EmailJobData>> {
    const jobId = jobData.emailLogId;

    // Create database record for the job
    await db.insert(emailQueueJobs).values({
      jobId,
      emailLogId: jobData.emailLogId,
      queueName: this.config.queueName,
      priority: this.getPriorityNumber(jobData.priority),
      data: jobData,
      opts: {
        attempts: emailConfig.queue.maxRetries,
        backoff: {
          type: 'exponential',
          delay: emailConfig.queue.retryDelay,
        },
      },
      createdAt: new Date(),
    });

    // Add job to queue
    if (jobData.scheduledAt && jobData.scheduledAt > new Date()) {
      return await this.queue.add('send-email', jobData, {
        jobId,
        priority: this.getPriorityNumber(jobData.priority),
        delay: jobData.scheduledAt.getTime() - Date.now(),
      });
    } else {
      return await this.queue.add('send-email', jobData, {
        jobId,
        priority: this.getPriorityNumber(jobData.priority),
      });
    }
  }

  async scheduleEmailJob(
    jobData: EmailJobData,
    scheduledAt: Date,
  ): Promise<Job<EmailJobData>> {
    const scheduledJobData = {
      ...jobData,
      scheduledAt,
    };

    return await this.addEmailJob(scheduledJobData);
  }

  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
      this.queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
  }

  async clearQueue(): Promise<void> {
    await this.queue.clean(0, 'completed');
    await this.queue.clean(0, 'failed');
  }

  private getPriorityNumber(priority: string): number {
    const priorityMap = {
      low: 1,
      normal: 5,
      high: 10,
      urgent: 15,
    };
    return priorityMap[priority as keyof typeof priorityMap] || 5;
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.scheduler.close();
    await this.queue.close();
  }
}

export const emailQueueService = new EmailQueueService();
