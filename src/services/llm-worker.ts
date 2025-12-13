import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import OpenAI from 'openai';
import { db } from '../config/database';
import { eq, and, desc } from 'drizzle-orm';
import {
  AnalysisJob,
  analysisJobs,
  llmAnalyses,
  responses,
  questions,
  questionnaires,
  LLMAnalysis,
} from '../models/llm-schema';
import { anonymizationService } from './anonymization';
import { embeddingsService } from './embeddings';
import { promptTemplateService } from './prompt-templates';

/**
 * LLM analysis job data structure
 */
export interface LLMAnalysisJobData {
  questionnaireId: string;
  analysisTypes: string[];
  options?: {
    minClusterSize?: number;
    minThemeFrequency?: number;
    includeSentiment?: boolean;
    anonymizationLevel?: 'partial' | 'full';
    customPrompt?: string;
  };
  triggeredBy: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * LLM analysis job result
 */
export interface LLMAnalysisJobResult {
  jobId: string;
  status: 'completed' | 'failed';
  analyses: Array<{
    type: string;
    results: any;
    metadata: {
      model: string;
      promptVersion: string;
      tokensUsed: number;
      processingTimeMs: number;
      confidenceScore: number;
      responseCount: number;
    };
  }>;
  errors?: Array<{
    type: string;
    error: string;
    retryable: boolean;
  }>;
}

/**
 * LLM analysis worker configuration
 */
export interface LLMWorkerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  openai?: {
    apiKey: string;
    baseURL?: string;
    timeout?: number;
  };
  concurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
  jobTimeout?: number;
}

/**
 * LLM analysis worker service
 */
export class LLMAnalysisWorker {
  private connection: Redis;
  private queue: Queue;
  private queueEvents: QueueEvents;
  private worker: Worker;
  private openai: OpenAI | null;
  private config: LLMWorkerConfig;

  constructor(config: LLMWorkerConfig) {
    this.config = {
      concurrency: 3,
      maxRetries: 3,
      retryDelay: 2000,
      jobTimeout: 300000, // 5 minutes
      ...config,
    };

    // Initialize Redis connection
    this.connection = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
      maxRetriesPerRequest: null,
      // Remove unsupported options for Redis v4
    });

    // Initialize OpenAI client only if API key is provided
    const apiKey = config.openai?.apiKey || process.env.OPENAI_API_KEY;
    this.openai = apiKey
      ? new OpenAI({
          apiKey,
          baseURL: config.openai?.baseURL,
          timeout: config.openai?.timeout || 60000,
        })
      : null;

    // Initialize queue and worker
    this.queue = new Queue('llm-analysis', {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: this.config.maxRetries,
        backoff: {
          type: 'exponential',
          delay: this.config.retryDelay,
        },
        delay: 0,
        priority: 0,
      },
    });

    this.queueEvents = new QueueEvents('llm-analysis', {
      connection: this.connection,
    });

    this.worker = new Worker('llm-analysis', this.processJob.bind(this), {
      connection: this.connection,
      concurrency: this.config.concurrency,
      limiter: {
        max: 10,
        duration: 60000, // 1 minute
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Add a new LLM analysis job to the queue
   */
  async addJob(jobData: LLMAnalysisJobData): Promise<string> {
    const job = await this.queue.add('llm-analysis', jobData, {
      priority: this.getPriorityValue(jobData.priority || 'medium'),
      delay: 0,
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    // Create job record in database
    await db.insert(analysisJobs).values({
      questionnaireId: jobData.questionnaireId,
      analysisTypes: jobData.analysisTypes,
      status: 'queued',
      priority: jobData.priority || 'medium',
      totalSteps: jobData.analysisTypes.length,
      options: jobData.options,
      triggeredBy: jobData.triggeredBy.toString(),
    });

    return job.id!;
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: string;
    progress: number;
    data?: any;
    result?: any;
    error?: string;
  }> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return {
      id: job.id!,
      status: await job.getState(),
      progress: (job.progress as number) || 0,
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job && (await job.getState()) === 'waiting') {
      await job.remove();
    }

    // Update database record
    await db
      .update(analysisJobs)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(analysisJobs.id, jobId));
  }

  /**
   * Process a single LLM analysis job
   */
  private async processJob(
    job: Job<LLMAnalysisJobData>,
  ): Promise<LLMAnalysisJobResult> {
    const { questionnaireId, analysisTypes, options, triggeredBy } = job.data;
    const jobId = job.id!;

    try {
      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing', 0);

      // Get questionnaire and responses
      const [questionnaire] = await db
        .select()
        .from(questionnaires)
        .where(eq(questionnaires.id, questionnaireId))
        .limit(1);

      if (!questionnaire) {
        throw new Error(`Questionnaire not found: ${questionnaireId}`);
      }

      // Get all responses for the questionnaire
      const responsesData = await db
        .select()
        .from(responses)
        .where(eq(responses.questionId, questionnaireId));

      if (responsesData.length === 0) {
        throw new Error('No responses found for questionnaire');
      }

      // Anonymize responses
      const anonymizationLevel = options?.anonymizationLevel || 'full';
      const anonymizedResponses = await Promise.all(
        responsesData.map(response =>
          anonymizationService.anonymizeResponse(response, anonymizationLevel),
        ),
      );

      // Generate embeddings for all responses
      const embeddingPromises = anonymizedResponses.map(
        async (anonResponse, index) => {
          const originalResponse = responsesData[index];
          await embeddingsService.storeEmbedding(
            originalResponse.id,
            originalResponse.questionId,
            typeof anonResponse.answer === 'string'
              ? anonResponse.answer
              : JSON.stringify(anonResponse.answer),
            'text-embedding-3-small',
          );
        },
      );

      await Promise.all(embeddingPromises);

      // Run analyses
      const analyses: LLMAnalysisJobResult['analyses'] = [];
      const errors: LLMAnalysisJobResult['errors'] = [];

      for (let i = 0; i < analysisTypes.length; i++) {
        const analysisType = analysisTypes[i];
        const progress = Math.round(((i + 1) / analysisTypes.length) * 100);

        try {
          const analysisResult = await this.runAnalysis(
            analysisType,
            anonymizedResponses,
            options || {},
          );

          // Save analysis result to database
          await db.insert(llmAnalyses).values({
            questionnaireId,
            analysisType: analysisType as any, // Cast to bypass enum typing
            status: 'completed' as any,
            results: analysisResult.results,
            metadata: {
              ...analysisResult.metadata,
              anonymizationLevel: options?.anonymizationLevel || 'full',
            },
            triggeredBy: triggeredBy.toString(),
            completedAt: new Date(),
          });

          analyses.push(analysisResult);

          // Update job progress
          await this.updateJobStatus(jobId, 'processing', progress);
        } catch (error) {
          console.error(`Analysis ${analysisType} failed:`, error);
          errors.push({
            type: analysisType,
            error: error instanceof Error ? error.message : String(error),
            retryable: this.isRetryableError(error),
          });

          // Save failed analysis to database
          await db.insert(llmAnalyses).values({
            questionnaireId,
            analysisType: analysisType as any, // Cast to bypass enum typing
            status: 'failed' as any,
            errorMessage:
              error instanceof Error ? error.message : String(error),
            triggeredBy: triggeredBy.toString(),
            completedAt: new Date(),
          });
        }
      }

      // Mark job as completed
      await this.updateJobStatus(jobId, 'completed', 100);

      return {
        jobId,
        status:
          errors.length > 0 && analyses.length === 0 ? 'failed' : 'completed',
        analyses,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);

      // Mark job as failed
      await this.updateJobStatus(
        jobId,
        'failed',
        0,
        error instanceof Error ? error.message : String(error),
      );

      throw error;
    }
  }

  /**
   * Run a specific analysis type
   */
  private async runAnalysis(
    analysisType: string,
    responses: any[],
    options: any,
  ): Promise<{
    type: string;
    results: any;
    metadata: {
      model: string;
      promptVersion: string;
      tokensUsed: number;
      processingTimeMs: number;
      confidenceScore: number;
      responseCount: number;
    };
  }> {
    const startTime = Date.now();
    let prompt: string;
    const model = 'gpt-4-turbo-preview';
    const maxTokens = 4000;

    switch (analysisType) {
    case 'thematic':
      prompt = promptTemplateService.buildThematicAnalysisPrompt(
        responses,
        options,
      );
      break;
    case 'clusters':
      prompt = promptTemplateService.buildClusteringPrompt(
        responses,
        options,
      );
      break;
    case 'contradictions':
      prompt = promptTemplateService.buildContradictionsPrompt(
        responses,
        options,
      );
      break;
    case 'insights':
      prompt = promptTemplateService.buildInsightsPrompt(responses, options);
      break;
    case 'recommendations':
      prompt = promptTemplateService.buildRecommendationsPrompt(
        responses,
        options,
      );
      break;
    default:
      throw new Error(`Unknown analysis type: ${analysisType}`);
    }

    // Check if OpenAI client is available
    if (!this.openai) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    // Call OpenAI API
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert sociological analyst. Respond only with valid JSON as specified in the prompt.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const processingTime = Date.now() - startTime;
    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    let results;
    try {
      results = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON response from LLM: ${content}`);
    }

    // Validate results structure
    this.validateAnalysisResults(analysisType, results);

    const tokensUsed = response.usage?.total_tokens || 0;
    const confidenceScore = this.calculateConfidenceScore(
      results,
      responses.length,
    );

    return {
      type: analysisType,
      results,
      metadata: {
        model,
        promptVersion: promptTemplateService.getCurrentVersion(analysisType),
        tokensUsed,
        processingTimeMs: processingTime,
        confidenceScore,
        responseCount: responses.length,
      },
    };
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    jobId: string,
    status: string,
    progress: number,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: any = {
      status,
      progress,
      updatedAt: new Date(),
    };

    if (status === 'processing') {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
      updateData.completedSteps = progress;
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await db
      .update(analysisJobs)
      .set(updateData)
      .where(eq(analysisJobs.id, jobId));
  }

  /**
   * Setup event handlers for the worker
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed:`, result);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`Job ${job?.id} failed:`, error);
    });

    this.worker.on('error', error => {
      console.error('Worker error:', error);
    });

    this.queueEvents.on('stalled', job => {
      console.warn(`Job ${job.jobId} stalled`);
    });

    this.queueEvents.on('progress', (job, progress) => {
      console.log(`Job ${job.jobId} progress: ${progress}%`);
    });
  }

  /**
   * Get priority value for queue
   */
  private getPriorityValue(priority: string): number {
    const priorities = { low: 1, medium: 5, high: 10, urgent: 20 };
    return priorities[priority as keyof typeof priorities] || 5;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('temporary')
      );
    }
    return false;
  }

  /**
   * Validate analysis results structure
   */
  private validateAnalysisResults(analysisType: string, results: any): void {
    const requiredFields = {
      thematic: ['themes'],
      clusters: ['clusters'],
      contradictions: ['contradictions'],
      insights: ['insights'],
      recommendations: ['recommendations'],
    };

    const fields = requiredFields[analysisType as keyof typeof requiredFields];
    if (!fields) return;

    for (const field of fields) {
      if (!results[field]) {
        throw new Error(
          `Missing required field '${field}' in ${analysisType} analysis results`,
        );
      }
    }
  }

  /**
   * Calculate confidence score for analysis results
   */
  private calculateConfidenceScore(
    results: any,
    responseCount: number,
  ): number {
    let score = 0.5; // Base score

    // Increase score based on response count
    if (responseCount >= 50) score += 0.2;
    else if (responseCount >= 20) score += 0.1;

    // Increase score based on result quality
    if (results.themes?.length > 0) score += 0.1;
    if (results.clusters?.length > 0) score += 0.1;
    if (results.insights?.length > 0) score += 0.1;
    if (results.recommendations?.length > 0) score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const counts = await this.queue.getJobCounts();
    const countsObj = counts as Record<string, number>;
    return {
      waiting: countsObj.waiting || 0,
      active: countsObj.active || 0,
      completed: countsObj.completed || 0,
      failed: countsObj.failed || 0,
      delayed: countsObj.delayed || 0,
      paused: countsObj.paused || 0,
    };
  }

  /**
   * Gracefully shutdown the worker
   */
  async shutdown(): Promise<void> {
    await this.worker.close();
    await this.queueEvents.close();
    await this.queue.close();
    await this.connection.quit();
  }
}

// Create and export worker instance with lazy initialization
let workerInstance: LLMAnalysisWorker | null = null;

export function getLLMAnalysisWorker(): LLMAnalysisWorker {
  if (!workerInstance) {
    // Railway uses REDIS_URL, fallback to REDIS_HOST/REDIS_PORT for development
    const isProduction = process.env.NODE_ENV === 'production';
    const redisUrl = process.env.REDIS_URL;

    // Helper to parse Redis config
    const parseRedisConfig = (url: string | undefined): { host: string; port: number; password?: string; db?: number } | null => {
      if (!url) return null;
      if (url.startsWith('/')) {
        // Unix socket path - not supported in this worker (needs path instead of host/port)
        console.warn('⚠️  Unix socket Redis paths not supported in LLM worker. Use TCP URL format.');
        return null;
      }
      if (url.startsWith('redis://') || url.startsWith('rediss://')) {
        // Parse TCP URL (format: redis://[:password@]host[:port][/db])
        try {
          const parsedUrl = new URL(url);
          return {
            host: parsedUrl.hostname,
            port: parseInt(parsedUrl.port || '6379'),
            password: parsedUrl.password || undefined,
            db: parsedUrl.pathname ? parseInt(parsedUrl.pathname.slice(1)) : 0,
          };
        } catch (error) {
          console.warn(`⚠️  Invalid REDIS_URL format: ${url}`);
          return null;
        }
      }
      return null;
    };

    const parsedConfig = parseRedisConfig(redisUrl);
    let redisConfig: { host: string; port: number; password?: string; db?: number };
    
    if (parsedConfig) {
      redisConfig = parsedConfig;
    } else if (process.env.REDIS_HOST || !isProduction) {
      // Fallback to individual variables (development only)
      redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      };
    } else {
      // Production without Redis - use dummy config
      redisConfig = {
        host: 'localhost',
        port: 6379,
      };
    }

    workerInstance = new LLMAnalysisWorker({
      redis: redisConfig,
      openai: process.env.OPENAI_API_KEY
        ? {
            apiKey: process.env.OPENAI_API_KEY,
          }
        : undefined,
      concurrency: 3,
      maxRetries: 3,
      retryDelay: 2000,
      jobTimeout: 300000,
    });
  }
  return workerInstance;
}

// For backward compatibility
export const llmAnalysisWorker = {
  get instance() {
    return getLLMAnalysisWorker();
  },
};
