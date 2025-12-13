/**
 * Workshop Analysis Queue
 * BullMQ queue for asynchronous LLM analysis processing
 */

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { llmAnalysisService, type LLMModel } from '../services/llmAnalysisService';
import { AnonymizationService } from '../services/anonymizationService';
import { WorkshopIntelligenceService } from '../services/workshopIntelligenceService';
import { db } from '../config/postgresql-database';
import {
  llmAnalyses,
  workshopAnalysisResults,
  workshops,
  promptTemplates,
} from '../models/postgresql-schema';
import { eq } from 'drizzle-orm';

// Job data interface
export interface AnalysisJobData {
  analysisId: string;
  workshopId: string;
  modelName: LLMModel;
  promptTemplateId?: string;
  customInstructions?: string;
}

// Redis connection
// Railway uses REDIS_URL, fallback to REDIS_HOST/REDIS_PORT for development
const isProduction = process.env.NODE_ENV === 'production';
const redisUrl = process.env.REDIS_URL;

// Helper to parse Redis config
const parseRedisConfig = (url: string | undefined): string | { path: string } | null => {
  if (!url) return null;
  if (url.startsWith('/')) {
    // Unix socket path
    return { path: url };
  }
  if (url.startsWith('redis://') || url.startsWith('rediss://')) {
    // TCP URL
    return url;
  }
  return null;
};

const parsedConfig = parseRedisConfig(redisUrl);
const baseConfig = {
  maxRetriesPerRequest: null as number | null, // Required for BullMQ
};

let redisConnection: Redis;
if (parsedConfig) {
  if (typeof parsedConfig === 'string') {
    // TCP URL
    redisConnection = new Redis(parsedConfig, baseConfig);
  } else {
    // Unix socket path
    redisConnection = new Redis({
      ...baseConfig,
      path: parsedConfig.path,
    });
  }
} else if (process.env.REDIS_HOST || !isProduction) {
  // Fallback to individual variables (development only)
  redisConnection = new Redis({
    ...baseConfig,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  });
} else {
  // Production without Redis - create dummy client that won't connect
  redisConnection = new Redis({
    host: '127.0.0.1',
    port: 6379,
    enableOfflineQueue: false, // Don't queue commands when offline
    maxRetriesPerRequest: 0,
    retryStrategy: () => null, // Don't retry
    lazyConnect: true,
    connectTimeout: 1, // Very short timeout
    commandTimeout: 1, // Very short timeout
  });
  redisConnection.on('error', () => {}); // Suppress errors
  redisConnection.disconnect(); // Prevent connection attempts
}

// Create queue
export const workshopAnalysisQueue = new Queue<AnalysisJobData>(
  'workshop-analysis',
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        count: 500, // Keep last 500 failed jobs for debugging
      },
    },
  },
);

// Create worker
export const workshopAnalysisWorker = new Worker<AnalysisJobData>(
  'workshop-analysis',
  async (job: Job<AnalysisJobData>) => {
    const { analysisId, workshopId, modelName, promptTemplateId, customInstructions } =
      job.data;

    console.log(`[Worker] Processing analysis job ${job.id} for workshop ${workshopId}`);

    try {
      // Update status to processing
      await db
        .update(llmAnalyses)
        .set({
          status: 'processing',
        })
        .where(eq(llmAnalyses.id, analysisId));

      // Get workshop details
      const [workshop] = await db
        .select()
        .from(workshops)
        .where(eq(workshops.id, workshopId))
        .limit(1);

      if (!workshop) {
        throw new Error(`Workshop ${workshopId} not found`);
      }

      // Create service instances
      const workshopService = new WorkshopIntelligenceService();

      // Get all contributions with answers
      const contributions = await workshopService.getAllContributions(
        workshopId,
      );

      if (contributions.length === 0) {
        throw new Error('No participant contributions found');
      }

      // Get form with questions
      const form = await workshopService.getFormByWorkshopId(workshopId);

      if (!form) {
        throw new Error('Workshop form not found');
      }

      // Build question map for easy lookup
      const questionMap = new Map(
        form.questions.map((q) => [q.id, q.questionText]),
      );

      // Create anonymization service instance
      const anonymizationService = new AnonymizationService();

      // Prepare data for anonymization
      const dataForAnonymization = contributions.map((contrib) => ({
        userId: contrib.userId,
        answers: contrib.answers,
      }));

      const questions = Array.from(questionMap.entries()).map(([id, text]) => ({
        id,
        questionText: text,
      }));

      // Anonymize data
      const anonymizedData = anonymizationService.anonymize(
        dataForAnonymization,
        questions,
      );

      // Get prompt template
      let promptText = '';

      if (promptTemplateId) {
        const [template] = await db
          .select()
          .from(promptTemplates)
          .where(eq(promptTemplates.id, promptTemplateId))
          .limit(1);

        promptText = template?.templateText || getDefaultPromptTemplate();
      } else {
        promptText = getDefaultPromptTemplate();
      }

      // Run LLM analysis
      const { result, metadata } = await llmAnalysisService.analyzeWorkshopData({
        workshopId,
        workshopTitle: (workshop.titleI18n as any)?.pl || 'Workshop',
        workshopDescription: (workshop.descriptionI18n as any)?.pl,
        anonymizedData,
        promptTemplate: promptText,
        modelName,
        customInstructions,
      });

      // Save results to database
      await Promise.all([
        // Save summary
        db.insert(workshopAnalysisResults).values({
          analysisId,
          resultType: 'summary',
          content: { text: result.summary },
          rawResponse: JSON.stringify(result),
        }),

        // Save insights
        db.insert(workshopAnalysisResults).values({
          analysisId,
          resultType: 'insights',
          content: { insights: result.insights },
        }),

        // Save themes
        db.insert(workshopAnalysisResults).values({
          analysisId,
          resultType: 'themes',
          content: { themes: result.themes },
        }),

        // Save recommendations
        db.insert(workshopAnalysisResults).values({
          analysisId,
          resultType: 'recommendations',
          content: { recommendations: result.recommendations },
        }),

        // Save suggested plan if available
        result.suggestedPlan
          ? db.insert(workshopAnalysisResults).values({
              analysisId,
              resultType: 'plan',
              content: { plan: result.suggestedPlan },
            })
          : Promise.resolve(),
      ]);

      // Update analysis status to completed
      await db
        .update(llmAnalyses)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(llmAnalyses.id, analysisId));

      console.log(`[Worker] Analysis ${analysisId} completed successfully`);

      return {
        success: true,
        analysisId,
        metadata,
      };
    } catch (error: any) {
      console.error(`[Worker] Analysis ${analysisId} failed:`, error);

      // Update analysis status to failed
      await db
        .update(llmAnalyses)
        .set({
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        })
        .where(eq(llmAnalyses.id, analysisId));

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs concurrently
  },
);

// Worker event handlers
workshopAnalysisWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

workshopAnalysisWorker.on('failed', (job, error) => {
  console.error(`[Worker] Job ${job?.id} failed:`, error);
});

workshopAnalysisWorker.on('error', (error) => {
  console.error('[Worker] Error:', error);
});

/**
 * Default prompt template
 */
function getDefaultPromptTemplate(): string {
  return `You are analyzing participant responses for a workshop titled "{workshop_title}".

Workshop Description: {workshop_description}

Number of Participants: {participant_count}

Participant Responses:
{participant_data}

Please analyze these responses and provide:

1. A comprehensive summary of the overall themes and patterns
2. Key insights with priority levels (high/medium/low)
3. Recurring themes with frequency counts and examples
4. Actionable recommendations for the workshop facilitator
5. A suggested workshop plan with specific activities

Focus on:
- What participants are hoping to achieve
- Common challenges or concerns
- Areas of high interest or enthusiasm
- Potential group dynamics
- Specific skills or topics to cover

Be specific, actionable, and tailored to this particular group of participants.`;
}

/**
 * Add analysis job to queue
 */
export async function queueAnalysisJob(data: AnalysisJobData): Promise<Job<AnalysisJobData>> {
  const job = await workshopAnalysisQueue.add('analyze-workshop', data, {
    jobId: `analysis-${data.analysisId}`,
  });

  console.log(`[Queue] Added analysis job ${job.id} for workshop ${data.workshopId}`);

  return job;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    workshopAnalysisQueue.getWaitingCount(),
    workshopAnalysisQueue.getActiveCount(),
    workshopAnalysisQueue.getCompletedCount(),
    workshopAnalysisQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
  };
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  const job = await workshopAnalysisQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}
