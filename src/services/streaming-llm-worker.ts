import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../config/database';
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import {
  AnalysisJob,
  analysisJobs,
  llmAnalyses,
  responses,
  questions,
  questionnaires,
  users,
  consents,
  LLMAnalysis,
  analysisStatusEnum,
  analysisJobStatusEnum,
} from '../models/llm-schema';
import { anonymizationService } from './anonymization';
import { embeddingsService } from './embeddings';
import { promptTemplateService } from './prompt-templates';
import { EventEmitter } from 'events';

/**
 * Streaming analysis job data structure
 */
export interface StreamingLLMAnalysisJobData {
  questionnaireId: string;
  analysisTypes: Array<'thematic' | 'clusters' | 'contradictions' | 'insights' | 'recommendations' | 'sentiment'>;
  options?: {
    minClusterSize?: number;
    minThemeFrequency?: number;
    includeSentiment?: boolean;
    anonymizationLevel?: 'partial' | 'full';
    customPrompt?: string;
    batchSize?: number;
    language?: 'en' | 'pl' | 'auto';
    culturalBiasHandling?: boolean;
    provider?: 'openai' | 'anthropic' | 'auto';
    model?: string;
    maxTokens?: number;
    temperature?: number;
    streamResponse?: boolean;
  };
  triggeredBy: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  scheduledAt?: Date;
}

/**
 * Streaming response data
 */
export interface StreamingResponseData {
  type: 'chunk' | 'progress' | 'complete' | 'error';
  analysisType: string;
  data: any;
  metadata?: {
    progress: number;
    totalTokens?: number;
    processingTime?: number;
    confidence?: number;
  };
}

/**
 * Streaming LLM analysis worker with memory optimization
 */
export class StreamingLLMAnalysisWorker extends EventEmitter {
  private connection: Redis;
  private queue: Queue;
  private queueEvents: QueueEvents;
  private worker: Worker;
  private openai: OpenAI | null;
  private anthropic: Anthropic | null;
  private config: any;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private activeStreams: Map<string, AbortController> = new Map();

  constructor(config: any) {
    super();
    this.config = config;

    // Initialize Redis connection with connection pooling
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxMemoryPolicy: 'allkeys-lru',
    });

    // Initialize OpenAI client only if API key is provided
    const openaiApiKey = config.openai?.apiKey || process.env.OPENAI_API_KEY;
    this.openai = openaiApiKey
      ? new OpenAI({
          apiKey: openaiApiKey,
          baseURL: config.openai?.baseURL,
          timeout: config.openai?.timeout || 30000, // Reduced timeout
          organizationId: config.openai?.organizationId,
          maxRetries: 2,
        })
      : null;

    // Initialize Anthropic client only if API key is provided
    const anthropicApiKey = config.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY;
    this.anthropic = anthropicApiKey
      ? new Anthropic({
          apiKey: anthropicApiKey,
          baseURL: config.anthropic?.baseURL,
          timeout: config.anthropic?.timeout || 30000, // Reduced timeout
          maxRetries: 2,
        })
      : null;

    this.initializeQueueAndWorker();
    this.setupEventHandlers();
    this.startCacheCleanup();
  }

  /**
   * Initialize queue and worker with optimized settings
   */
  private initializeQueueAndWorker(): void {
    this.queue = new Queue('streaming-llm-analysis', {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 50, // Reduced for memory
        removeOnFail: 25,
        attempts: 3, // Reduced attempts
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        delay: 0,
        priority: 0,
      },
    });

    this.queueEvents = new QueueEvents('streaming-llm-analysis', {
      connection: this.connection,
    });

    this.worker = new Worker(
      'streaming-llm-analysis',
      this.processJob.bind(this),
      {
        connection: this.connection,
        concurrency: 3, // Increased concurrency
        limiter: {
          max: 10, // More generous rate limiting
          duration: 60000,
        },
      },
    );
  }

  /**
   * Add streaming job to queue
   */
  async addStreamingJob(jobData: StreamingLLMAnalysisJobData): Promise<string> {
    const job = await this.queue.add('streaming-llm-analysis', jobData, {
      priority: this.getPriorityValue(jobData.priority || 'medium'),
      delay: jobData.scheduledAt
        ? Math.max(0, jobData.scheduledAt.getTime() - Date.now())
        : 0,
      removeOnComplete: 50,
      removeOnFail: 25,
    });

    // Create streamlined job record
    const jobId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(analysisJobs).values({
      id: jobId,
      questionnaireId: jobData.questionnaireId,
      analysisTypes: jobData.analysisTypes,
      status: 'queued',
      priority: jobData.priority || 'medium',
      totalSteps: jobData.analysisTypes.length,
      options: jobData.options,
      triggeredBy: jobData.triggeredBy,
      scheduledAt: jobData.scheduledAt,
    });

    return job.id!;
  }

  /**
   * Process streaming job with memory optimization
   */
  private async processJob(
    job: Job<StreamingLLMAnalysisJobData>,
  ): Promise<void> {
    const {
      questionnaireId,
      analysisTypes,
      options,
      triggeredBy,
    } = job.data;
    const jobId = job.id!;

    // Create abort controller for this job
    const abortController = new AbortController();
    this.activeStreams.set(jobId, abortController);

    try {
      await this.updateJobStatus(jobId, 'processing', 0);

      // Get questionnaire with responses (streaming approach)
      const questionnaire = await this.getQuestionnaireWithStreamingResponses(questionnaireId);
      if (!questionnaire) {
        throw new Error(`Questionnaire not found: ${questionnaireId}`);
      }

      const { questionnaire: qData, responses: responsesData } = questionnaire;

      if (responsesData.length === 0) {
        throw new Error('No responses found for questionnaire');
      }

      // Verify GDPR compliance
      const gdprCompliant = await this.verifyGDPRCompliance(questionnaireId, responsesData);
      if (!gdprCompliant.compliant) {
        throw new Error(`GDPR compliance check failed: ${gdprCompliant.issues.join(', ')}`);
      }

      // Stream analyses with progress updates
      for (let i = 0; i < analysisTypes.length; i++) {
        if (abortController.signal.aborted) {
          throw new Error('Job cancelled');
        }

        const analysisType = analysisTypes[i];
        const progress = Math.round(((i + 1) / analysisTypes.length) * 100);

        try {
          await this.streamAnalysis(
            analysisType,
            responsesData,
            options || {},
            qData,
            jobId,
            progress,
          );
          await this.updateJobStatus(jobId, 'processing', progress);
        } catch (error) {
          console.error(`Streaming analysis ${analysisType} failed:`, error);
          this.emitStreamingChunk(jobId, analysisType, 'error', {
            error: error instanceof Error ? error.message : String(error),
            progress,
          });
        }
      }

      await this.updateJobStatus(jobId, 'completed', 100);
      this.emitStreamingChunk(jobId, 'final', 'complete', {
        status: 'completed',
        totalAnalyses: analysisTypes.length,
      });

    } catch (error) {
      console.error(`Streaming job ${jobId} failed:`, error);
      await this.updateJobStatus(jobId, 'failed', 0);
      this.emitStreamingChunk(jobId, 'final', 'error', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.activeStreams.delete(jobId);
    }
  }

  /**
   * Stream analysis with real-time progress updates
   */
  private async streamAnalysis(
    analysisType: string,
    responses: any[],
    options: any,
    questionnaire: any,
    jobId: string,
    initialProgress: number,
  ): Promise<void> {
    const startTime = Date.now();
    const abortController = this.activeStreams.get(jobId);

    // Select provider with optimization
    const { provider, model } = await this.selectOptimalProvider(analysisType, options);

    // Build prompt with streaming optimization
    const prompt = await this.buildOptimizedPrompt(
      analysisType,
      responses,
      options,
      questionnaire,
      provider,
    );

    let accumulatedResult = '';
    let totalTokens = 0;

    try {
      if (provider === 'openai' && options.streamResponse) {
        if (!this.openai) {
          throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
        }
        // Stream OpenAI response
        const stream = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert sociological analyst. Respond with valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.3,
          response_format: { type: 'json_object' },
          stream: true,
        });

        for await (const chunk of stream) {
          if (abortController?.signal.aborted) {
            throw new Error('Stream cancelled');
          }

          const content = chunk.choices[0]?.delta?.content || '';
          accumulatedResult += content;

          // Send progress update
          this.emitStreamingChunk(jobId, analysisType, 'progress', {
            progress: initialProgress,
            chunk: content,
            timestamp: Date.now(),
          });
        }

        totalTokens = this.estimateTokens(accumulatedResult);

      } else if (provider === 'anthropic') {
        if (!this.anthropic) {
          throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
        }
        // Stream Anthropic response
        const stream = await this.anthropic.messages.create({
          model,
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.3,
          messages: [
            {
              role: 'user',
              content: `Respond with valid JSON only: ${prompt}`,
            },
          ],
          stream: true,
        });

        for await (const chunk of stream) {
          if (abortController?.signal.aborted) {
            throw new Error('Stream cancelled');
          }

          if (chunk.type === 'content_block') {
            const content = chunk.content?.text || '';
            accumulatedResult += content;

            // Send progress update
            this.emitStreamingChunk(jobId, analysisType, 'progress', {
              progress: initialProgress,
              chunk: content,
              timestamp: Date.now(),
            });
          }
        }

        totalTokens = this.estimateTokens(accumulatedResult);
      } else {
        // Fallback to non-streaming
        const result = await this.callProviderNonStreaming(provider, model, prompt, options);
        accumulatedResult = result.content;
        totalTokens = result.usage?.total_tokens || 0;
      }

      // Parse and enhance result
      const parsedResult = this.parseLLMResponse(accumulatedResult);
      const enhancedResult = await this.processAnalysisResult(
        analysisType,
        parsedResult,
        responses,
        options,
      );

      const processingTime = Date.now() - startTime;
      const confidenceScore = this.calculateConfidenceScore(
        enhancedResult,
        responses.length,
        analysisType,
      );

      // Save analysis result
      await this.saveAnalysisResult(
        options.questionnaireId || questionnaireId,
        analysisType,
        {
          type: analysisType,
          results: enhancedResult,
          metadata: {
            provider,
            model,
            promptVersion: promptTemplateService.getCurrentVersion(analysisType),
            tokensUsed: totalTokens,
            processingTimeMs: processingTime,
            confidenceScore,
            responseCount: responses.length,
            costEstimate: this.calculateCostEstimate(provider, model, totalTokens),
            streaming: options.streamResponse,
          },
        },
        options.triggeredBy || 'system',
      );

      // Send completion chunk
      this.emitStreamingChunk(jobId, analysisType, 'complete', {
        result: enhancedResult,
        metadata: {
          provider,
          model,
          tokensUsed: totalTokens,
          processingTime,
          confidenceScore,
        },
      });

    } catch (error) {
      if (!abortController?.signal.aborted) {
        throw error;
      }
    }
  }

  /**
   * Emit streaming chunk to WebSocket or event system
   */
  private emitStreamingChunk(
    jobId: string,
    analysisType: string,
    chunkType: string,
    data: any,
  ): void {
    this.emit('streaming-chunk', {
      jobId,
      analysisType,
      chunkType,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get questionnaire with streaming response handling
   */
  private async getQuestionnaireWithStreamingResponses(questionnaireId: string) {
    // Cache questionnaire metadata
    const cacheKey = `questionnaire:${questionnaireId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const questionnaire = await db.query.questionnaires.findFirst({
      where: eq(questionnaires.id, questionnaireId),
      with: {
        questions: {
          with: {
            responses: {
              limit: 100, // Limit initial batch
            },
          },
        },
      },
    });

    if (!questionnaire) return null;

    const result = {
      questionnaire,
      responses: questionnaire.questions.flatMap(q => q.responses),
    };

    // Cache questionnaire metadata
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Select optimal provider with cost and performance optimization
   */
  private async selectOptimalProvider(
    analysisType: string,
    options: any,
  ): Promise<{ provider: 'openai' | 'anthropic'; model: string }> {
    const preferredProvider = options.provider || 'auto';

    if (preferredProvider !== 'auto') {
      return {
        provider: preferredProvider,
        model: options.model || this.getDefaultModel(preferredProvider, analysisType),
      };
    }

    // Use cheaper models for bulk processing
    if (['thematic', 'clusters'].includes(analysisType)) {
      return {
        provider: 'openai',
        model: 'gpt-4o-mini',
      };
    }

    // Use premium models for complex analysis
    return {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
    };
  }

  /**
   * Build optimized prompt for streaming
   */
  private async buildOptimizedPrompt(
    analysisType: string,
    responses: any[],
    options: any,
    questionnaire: any,
    provider: 'openai' | 'anthropic',
  ): Promise<string> {
    // Reduce prompt size for streaming
    const maxResponses = options.maxResponses || 50;
    const limitedResponses = responses.slice(0, maxResponses);

    switch (analysisType) {
      case 'thematic':
        return promptTemplateService.buildThematicAnalysisPrompt(
          limitedResponses,
          { ...options, concise: true },
        );
      case 'clusters':
        return promptTemplateService.buildClusteringPrompt(
          limitedResponses,
          { ...options, concise: true },
        );
      case 'contradictions':
        return promptTemplateService.buildContradictionsPrompt(
          limitedResponses,
          { ...options, concise: true },
        );
      case 'insights':
        return promptTemplateService.buildInsightsPrompt(limitedResponses, {
          ...options,
          concise: true,
        });
      case 'recommendations':
        return promptTemplateService.buildRecommendationsPrompt(
          limitedResponses,
          { ...options, concise: true },
        );
      default:
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }
  }

  /**
   * Call provider without streaming (fallback)
   */
  private async callProviderNonStreaming(
    provider: 'openai' | 'anthropic',
    model: string,
    prompt: string,
    options: any,
  ): Promise<{ content: string; usage?: any }> {
    if (provider === 'openai') {
      if (!this.openai) {
        throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
      }
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert sociological analyst. Respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.3,
        response_format: { type: 'json_object' },
      });

      return {
        content: response.choices[0].message.content || '',
        usage: response.usage,
      };
    } else {
      if (!this.anthropic) {
        throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
      }
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.3,
        messages: [
          {
            role: 'user',
            content: `Respond with valid JSON only: ${prompt}`,
          },
        ],
      });

      return {
        content: response.content[0].text || '',
        usage: response.usage,
      };
    }
  }

  /**
   * Parse LLM response with error handling
   */
  private parseLLMResponse(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Invalid JSON response: ${content.substring(0, 100)}...`);
    }
  }

  /**
   * Process analysis result with validation
   */
  private async processAnalysisResult(
    analysisType: string,
    result: any,
    responses: any[],
    options: any,
  ): Promise<any> {
    this.validateAnalysisResults(analysisType, result);

    switch (analysisType) {
      case 'thematic':
        return this.enhanceThematicResults(result, responses);
      case 'clusters':
        return this.enhanceClusterResults(result, responses);
      case 'sentiment':
        return this.enhanceSentimentResults(result, responses);
      default:
        return result;
    }
  }

  /**
   * Helper methods
   */
  private updateJobStatus = async (
    jobId: string,
    status: string,
    progress: number,
    errorMessage?: string,
  ): Promise<void> => {
    const updateData: any = {
      status,
      progress,
      updatedAt: new Date(),
    };

    if (status === 'processing') {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
      updateData.completedSteps = Math.floor(progress / 100 * 5);
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await db
      .update(analysisJobs)
      .set(updateData)
      .where(eq(analysisJobs.id, jobId));
  };

  private saveAnalysisResult = async (
    questionnaireId: string,
    analysisType: string,
    result: any,
    triggeredBy: string,
  ): Promise<void> => {
    await db.insert(llmAnalyses).values({
      id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      questionnaireId,
      analysisType,
      status: 'completed',
      results: result.results,
      metadata: result.metadata,
      triggeredBy,
      completedAt: new Date(),
    });
  };

  private getPriorityValue = (priority: string): number => {
    const priorities = { low: 1, medium: 5, high: 10, urgent: 20 };
    return priorities[priority as keyof typeof priorities] || 5;
  };

  private validateAnalysisResults = (analysisType: string, results: any): void => {
    const requiredFields = {
      thematic: ['themes'],
      clusters: ['clusters'],
      contradictions: ['contradictions'],
      insights: ['insights'],
      recommendations: ['recommendations'],
      sentiment: ['sentiment'],
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
  };

  private calculateConfidenceScore = (
    results: any,
    responseCount: number,
    analysisType: string,
  ): number => {
    let score = 0.5;

    if (responseCount >= 100) score += 0.3;
    else if (responseCount >= 50) score += 0.2;
    else if (responseCount >= 20) score += 0.1;

    const resultChecks = {
      thematic: () => results.themes?.length > 0,
      clusters: () => results.clusters?.length > 0,
      contradictions: () => results.contradictions?.length > 0,
      insights: () => results.insights?.length > 0,
      recommendations: () => results.recommendations?.length > 0,
      sentiment: () => results.sentiment?.overall !== undefined,
    };

    if (resultChecks[analysisType as keyof typeof resultChecks]?.()) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  };

  private calculateCostEstimate = (
    provider: 'openai' | 'anthropic',
    model: string,
    tokens: number,
  ): number => {
    const pricing = {
      openai: {
        'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
        'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      },
      anthropic: {
        'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
        'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
      },
    };

    const modelPricing = pricing[provider]?.[model as keyof typeof pricing.openai] ||
                         pricing[provider]?.['gpt-4o-mini'] ||
                         pricing['openai']['gpt-4o-mini'];

    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    return (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output;
  };

  private estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  private getDefaultModel = (provider: 'openai' | 'anthropic', analysisType: string): string => {
    const modelMap = {
      openai: {
        thematic: 'gpt-4o-mini',
        clusters: 'gpt-4o-mini',
        contradictions: 'gpt-4-turbo-preview',
        insights: 'gpt-4-turbo-preview',
        recommendations: 'gpt-4-turbo-preview',
        sentiment: 'gpt-4o-mini',
      },
      anthropic: {
        thematic: 'claude-3-5-haiku-20241022',
        clusters: 'claude-3-5-haiku-20241022',
        contradictions: 'claude-3-5-sonnet-20241022',
        insights: 'claude-3-5-sonnet-20241022',
        recommendations: 'claude-3-5-sonnet-20241022',
        sentiment: 'claude-3-5-haiku-20241022',
      },
    };

    return modelMap[provider]?.[analysisType as keyof typeof modelMap.openai] ||
           modelMap[provider]?.thematic ||
           'gpt-4o-mini';
  };

  private verifyGDPRCompliance = async (
    questionnaireId: string,
    responses: any[],
  ): Promise<{ compliant: boolean; issues: string[] }> => {
    // Simplified GDPR compliance check
    const issues: string[] = [];

    const consentCount = await db.query.consents.findMany({
      where: and(
        eq(consents.questionnaireId, questionnaireId),
        eq(consents.consentType, 'research_analysis'),
        eq(consents.granted, true),
      ),
    });

    if (consentCount.length === 0) {
      issues.push('No user consent found for research analysis');
    }

    return {
      compliant: issues.length === 0,
      issues,
    };
  };

  private enhanceThematicResults = (results: any, responses: any[]): any => {
    return results;
  };

  private enhanceClusterResults = (results: any, responses: any[]): any => {
    return results;
  };

  private enhanceSentimentResults = (results: any, responses: any[]): any => {
    return results;
  };

  private setupEventHandlers(): void {
    this.worker.on('completed', (job, result) => {
      console.log(`Streaming job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`Streaming job ${job?.id} failed:`, error);
    });

    this.worker.on('error', error => {
      console.error('Streaming worker error:', error);
    });

    this.queueEvents.on('stalled', job => {
      console.warn(`Streaming job ${job.id} stalled`);
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expirationMs = 24 * 60 * 60 * 1000; // 24 hours

      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > expirationMs) {
          this.cache.delete(key);
        }
      }
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Cancel streaming job
   */
  async cancelJob(jobId: string): Promise<void> {
    const controller = this.activeStreams.get(jobId);
    if (controller) {
      controller.abort();
      await this.updateJobStatus(jobId, 'cancelled', 0);
    }
  }

  /**
   * Get active streaming jobs
   */
  getActiveJobs(): string[] {
    return Array.from(this.activeStreams.keys());
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
    return counts;
  }

  /**
   * Gracefully shutdown the worker
   */
  async shutdown(): Promise<void> {
    // Cancel all active streams
    for (const [jobId, controller] of this.activeStreams.entries()) {
      controller.abort();
    }

    await this.worker.close();
    await this.queueEvents.close();
    await this.queue.close();
    await this.connection.quit();
  }
}

// Create and export streaming worker instance with lazy initialization
let streamingWorkerInstance: StreamingLLMAnalysisWorker | null = null;

export function getStreamingLLMAnalysisWorker(): StreamingLLMAnalysisWorker {
  if (!streamingWorkerInstance) {
    streamingWorkerInstance = new StreamingLLMAnalysisWorker({
      openai: process.env.OPENAI_API_KEY
        ? {
            apiKey: process.env.OPENAI_API_KEY,
            organizationId: process.env.OPENAI_ORG_ID,
          }
        : undefined,
      anthropic: process.env.ANTHROPIC_API_KEY
        ? {
            apiKey: process.env.ANTHROPIC_API_KEY,
          }
        : undefined,
    });
  }
  return streamingWorkerInstance;
}

// For backward compatibility
export const streamingLLMAnalysisWorker = {
  get instance() {
    return getStreamingLLMAnalysisWorker();
  },
};