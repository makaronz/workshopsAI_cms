/**
 * Workshop Analysis Queue
 * BullMQ queue for asynchronous LLM analysis processing
 */

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { llmAnalysisService, type LLMModel } from '../services/llmAnalysisService';
import { anonymizationService } from '../services/anonymizationService';
import { workshopIntelligenceService } from '../services/workshopIntelligenceService';
import { db } from '../config/postgresql-database';
import {
  workshopLlmAnalyses,
  analysisResults,
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
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required for BullMQ
});

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
        .update(workshopLlmAnalyses)
        .set({
          status: 'processing',
          startedAt: new Date(),
        })
        .where(eq(workshopLlmAnalyses.id, analysisId));

      // Get workshop details
      const [workshop] = await db
        .select()
        .from(workshops)
        .where(eq(workshops.id, workshopId))
        .limit(1);

      if (!workshop) {
        throw new Error(`Workshop ${workshopId} not found`);
      }

      // Get all contributions with answers
      const contributions = await workshopIntelligenceService.getWorkshopContributions(
        workshopId,
      );

      if (contributions.length === 0) {
        throw new Error('No participant contributions found');
      }

      // Get form with questions
      const form = await workshopIntelligenceService.getFormWithQuestions(workshopId);

      if (!form) {
        throw new Error('Workshop form not found');
      }

      // Build question map for easy lookup
      const questionMap = new Map(
        form.questions.map((q) => [q.id, q.questionText]),
      );

      // Prepare data for anonymization
      const dataForAnonymization = contributions.map((contrib) => ({
        userId: contrib.userId,
        answers: contrib.answers.map((ans) => ({
          questionId: ans.questionId,
          questionText: questionMap.get(ans.questionId) || 'Unknown question',
          answerData: ans.answerData,
        })),
      }));

      // Anonymize data
      const anonymizedData = anonymizationService.anonymizeContributions(
        dataForAnonymization,
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
        db.insert(analysisResults).values({
          analysisId,
          resultType: 'summary',
          content: { text: result.summary },
          rawResponse: JSON.stringify(result),
        }),

        // Save insights
        db.insert(analysisResults).values({
          analysisId,
          resultType: 'insights',
          content: { insights: result.insights },
        }),

        // Save themes
        db.insert(analysisResults).values({
          analysisId,
          resultType: 'themes',
          content: { themes: result.themes },
        }),

        // Save recommendations
        db.insert(analysisResults).values({
          analysisId,
          resultType: 'recommendations',
          content: { recommendations: result.recommendations },
        }),

        // Save suggested plan if available
        result.suggestedPlan
          ? db.insert(analysisResults).values({
              analysisId,
              resultType: 'plan',
              content: { plan: result.suggestedPlan },
            })
          : Promise.resolve(),
      ]);

      // Update analysis status to completed
      await db
        .update(workshopLlmAnalyses)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(workshopLlmAnalyses.id, analysisId));

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
        .update(workshopLlmAnalyses)
        .set({
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        })
        .where(eq(workshopLlmAnalyses.id, analysisId));

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
