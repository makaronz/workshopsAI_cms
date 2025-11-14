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

/**
 * Enhanced LLM analysis job data structure
 */
export interface EnhancedLLMAnalysisJobData {
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
  };
  triggeredBy: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  scheduledAt?: Date;
}

/**
 * Enhanced LLM analysis job result
 */
export interface EnhancedLLMAnalysisJobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'partial';
  analyses: Array<{
    type: string;
    results: any;
    metadata: {
      provider: 'openai' | 'anthropic';
      model: string;
      promptVersion: string;
      tokensUsed: number;
      processingTimeMs: number;
      confidenceScore: number;
      responseCount: number;
      costEstimate: number;
      culturalBiasDetected?: boolean;
      sentimentDistribution?: { positive: number; negative: number; neutral: number };
    };
  }>;
  errors: Array<{
    type: string;
    error: string;
    retryable: boolean;
    severity: 'low' | 'medium' | 'high';
  }>;
  statistics: {
    totalResponses: number;
    anonymizedResponses: number;
    processingTimeMs: number;
    totalCost: number;
    kAnonymityCompliant: boolean;
    gdprCompliant: boolean;
  };
}

/**
 * LLM provider configuration
 */
interface LLMProviderConfig {
  openai?: {
    apiKey: string;
    baseURL?: string;
    timeout?: number;
    organizationId?: string;
  };
  anthropic?: {
    apiKey: string;
    baseURL?: string;
    timeout?: number;
  };
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

/**
 * Cost optimization settings
 */
interface CostOptimizationSettings {
  enableCaching: boolean;
  cacheExpirationHours: number;
  batchThreshold: number;
  preferCheaperModel: boolean;
  costLimitUSD: number;
  trackCosts: boolean;
}

/**
 * Enhanced LLM analysis worker service
 */
export class EnhancedLLMAnalysisWorker {
  private connection: Redis;
  private queue: Queue;
  private queueEvents: QueueEvents;
  private worker: Worker;
  private openai: OpenAI;
  private anthropic: Anthropic;
  private config: LLMProviderConfig;
  private costSettings: CostOptimizationSettings;
  private costTracker: Map<string, number> = new Map();
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor(
    config: LLMProviderConfig,
    costSettings: CostOptimizationSettings = {
      enableCaching: true,
      cacheExpirationHours: 24,
      batchThreshold: 100,
      preferCheaperModel: true,
      costLimitUSD: 50.0,
      trackCosts: true,
    },
  ) {
    this.config = config;
    this.costSettings = costSettings;

    // Initialize Redis connection
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      maxRetriesPerRequest: null,
    });

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: config.openai?.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.openai?.baseURL,
      timeout: config.openai?.timeout || 60000,
      organizationId: config.openai?.organizationId,
    });

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: config.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config.anthropic?.baseURL,
      timeout: config.anthropic?.timeout || 60000,
    });

    // Initialize queue and worker
    this.queue = new Queue('enhanced-llm-analysis', {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        delay: 0,
        priority: 0,
      },
    });

    this.queueEvents = new QueueEvents('enhanced-llm-analysis', {
      connection: this.connection,
    });

    this.worker = new Worker(
      'enhanced-llm-analysis',
      this.processJob.bind(this),
      {
        connection: this.connection,
        concurrency: 2, // Reduced for better resource management
        limiter: {
          max: 5, // Stricter rate limiting
          duration: 60000,
        },
      },
    );

    this.setupEventHandlers();
    this.startCacheCleanup();
  }

  /**
   * Add a new enhanced LLM analysis job to the queue
   */
  async addJob(jobData: EnhancedLLMAnalysisJobData): Promise<string> {
    // Validate user consent for AI analysis
    const hasConsent = await this.verifyAnalysisConsent(
      jobData.questionnaireId,
      jobData.triggeredBy,
    );
    if (!hasConsent) {
      throw new Error('User consent required for AI analysis');
    }

    // Check cost limit
    if (this.costSettings.trackCosts) {
      const currentCost = this.getCurrentMonthlyCost();
      if (currentCost >= this.costSettings.costLimitUSD) {
        throw new Error(`Monthly cost limit of $${this.costSettings.costLimitUSD} reached`);
      }
    }

    const job = await this.queue.add('enhanced-llm-analysis', jobData, {
      priority: this.getPriorityValue(jobData.priority || 'medium'),
      delay: jobData.scheduledAt
        ? Math.max(0, jobData.scheduledAt.getTime() - Date.now())
        : 0,
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    // Create comprehensive job record
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Process a single enhanced LLM analysis job
   */
  private async processJob(
    job: Job<EnhancedLLMAnalysisJobData>,
  ): Promise<EnhancedLLMAnalysisJobResult> {
    const startTime = Date.now();
    const {
      questionnaireId,
      analysisTypes,
      options,
      triggeredBy,
    } = job.data;
    const jobId = job.id!;

    try {
      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing', 0);

      // Get questionnaire and validate responses
      const questionnaire = await this.getQuestionnaireWithResponses(questionnaireId);
      if (!questionnaire) {
        throw new Error(`Questionnaire not found: ${questionnaireId}`);
      }

      const { questionnaire: qData, responses: responsesData } = questionnaire;

      if (responsesData.length === 0) {
        throw new Error('No responses found for questionnaire');
      }

      // Verify GDPR compliance and k-anonymity
      const gdprCompliant = await this.verifyGDPRCompliance(questionnaireId, responsesData);
      if (!gdprCompliant.compliant) {
        throw new Error(`GDPR compliance check failed: ${gdprCompliant.issues.join(', ')}`);
      }

      // Apply advanced anonymization
      const anonymizationLevel = options?.anonymizationLevel || 'full';
      const anonymizedResponses = await this.batchAnonymizeResponses(
        responsesData,
        anonymizationLevel,
      );

      // Verify k-anonymity (k≥5)
      const kAnonymityCompliant = anonymizationService.verifyKAnonymity(
        anonymizedResponses.map(r => JSON.stringify(r.answer)),
        5,
      );

      if (!kAnonymityCompliant && anonymizationLevel === 'full') {
        // Apply additional anonymization techniques
        await this.applyAdditionalAnonymization(anonymizedResponses);
      }

      // Generate embeddings for semantic analysis
      if (analysisTypes.includes('clusters') || analysisTypes.includes('thematic')) {
        await this.generateEmbeddings(anonymizedResponses);
      }

      // Run analyses with batching for cost optimization
      const analyses: EnhancedLLMAnalysisJobResult['analyses'] = [];
      const errors: EnhancedLLMAnalysisJobResult['errors'] = [];
      let totalCost = 0;

      for (let i = 0; i < analysisTypes.length; i++) {
        const analysisType = analysisTypes[i];
        const progress = Math.round(((i + 1) / analysisTypes.length) * 100);

        try {
          const analysisResult = await this.runEnhancedAnalysis(
            analysisType,
            anonymizedResponses,
            options || {},
            qData,
          );

          // Track cost
          if (this.costSettings.trackCosts) {
            totalCost += analysisResult.metadata.costEstimate;
            this.trackCost(analysisResult.metadata.costEstimate);
          }

          // Save analysis result
          await this.saveAnalysisResult(
            questionnaireId,
            analysisType,
            analysisResult,
            triggeredBy,
          );

          analyses.push(analysisResult);
          await this.updateJobStatus(jobId, 'processing', progress);

        } catch (error) {
          console.error(`Analysis ${analysisType} failed:`, error);
          const errorObj = {
            type: analysisType,
            error: error instanceof Error ? error.message : String(error),
            retryable: this.isRetryableError(error),
            severity: this.getErrorSeverity(error, analysisType),
          };
          errors.push(errorObj);

          // Save failed analysis
          await this.saveFailedAnalysis(
            questionnaireId,
            analysisType,
            errorObj,
            triggeredBy,
          );
        }
      }

      const processingTime = Date.now() - startTime;

      // Create final result
      const result: EnhancedLLMAnalysisJobResult = {
        jobId,
        status: errors.length > 0 && analyses.length === 0 ? 'failed' :
          errors.length > 0 ? 'partial' : 'completed',
        analyses,
        errors,
        statistics: {
          totalResponses: responsesData.length,
          anonymizedResponses: anonymizedResponses.length,
          processingTimeMs: processingTime,
          totalCost,
          kAnonymityCompliant,
          gdprCompliant: gdprCompliant.compliant,
        },
      };

      // Update job completion status
      await this.updateJobStatus(
        jobId,
        result.status === 'failed' ? 'failed' : 'completed',
        100,
      );

      return result;

    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);

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
   * Run enhanced analysis with provider selection and cultural bias handling
   */
  private async runEnhancedAnalysis(
    analysisType: string,
    responses: any[],
    options: any,
    questionnaire: any,
  ): Promise<EnhancedLLMAnalysisJobResult['analyses'][0]> {
    const startTime = Date.now();

    // Select optimal provider and model
    const { provider, model } = await this.selectOptimalProvider(analysisType, options);

    // Build context-aware prompt
    const prompt = await this.buildEnhancedPrompt(
      analysisType,
      responses,
      options,
      questionnaire,
      provider,
    );

    let result: any;
    let tokensUsed = 0;
    let costEstimate = 0;

    try {
      if (provider === 'openai') {
        const response = await this.callOpenAI(model, prompt, options);
        result = this.parseLLMResponse(response.content);
        tokensUsed = response.usage?.total_tokens || 0;
        costEstimate = this.calculateOpenAICost(model, tokensUsed);
      } else if (provider === 'anthropic') {
        const response = await this.callAnthropic(model, prompt, options);
        result = this.parseLLMResponse(response.content[0].text);
        tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
        costEstimate = this.calculateAnthropicCost(model, tokensUsed);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      // Enhanced result processing
      const enhancedResult = await this.processAnalysisResult(
        analysisType,
        result,
        responses,
        options,
      );

      const processingTime = Date.now() - startTime;
      const confidenceScore = this.calculateConfidenceScore(
        enhancedResult,
        responses.length,
        analysisType,
      );

      return {
        type: analysisType,
        results: enhancedResult,
        metadata: {
          provider,
          model,
          promptVersion: promptTemplateService.getCurrentVersion(analysisType),
          tokensUsed,
          processingTimeMs: processingTime,
          confidenceScore,
          responseCount: responses.length,
          costEstimate,
          culturalBiasDetected: await this.detectCulturalBias(enhancedResult, options.language),
          sentimentDistribution: this.extractSentimentDistribution(enhancedResult),
        },
      };

    } catch (error) {
      // Enhanced error handling with provider fallback
      if (this.isRetryableError(error) && provider !== options.provider) {
        console.warn(`Provider ${provider} failed, attempting fallback`);
        return this.runEnhancedAnalysis(analysisType, responses, { ...options, provider }, questionnaire);
      }
      throw error;
    }
  }

  /**
   * Select optimal provider and model based on analysis type and options
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

    // Auto-selection logic based on analysis type and cost optimization
    if (this.costSettings.preferCheaperModel) {
      return {
        provider: 'openai',
        model: 'gpt-4o-mini',
      };
    }

    // Use Claude for complex analysis requiring nuanced understanding
    if (['insights', 'contradictions', 'recommendations'].includes(analysisType)) {
      return {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      };
    }

    // Use OpenAI for structured data analysis
    return {
      provider: 'openai',
      model: options.model || 'gpt-4-turbo-preview',
    };
  }

  /**
   * Build enhanced prompt with cultural bias awareness
   */
  private async buildEnhancedPrompt(
    analysisType: string,
    responses: any[],
    options: any,
    questionnaire: any,
    provider: 'openai' | 'anthropic',
  ): Promise<string> {
    const language = options.language || 'auto';
    const culturalContext = await this.detectCulturalContext(responses);

    let basePrompt: string;

    switch (analysisType) {
    case 'thematic':
      basePrompt = promptTemplateService.buildThematicAnalysisPrompt(
        responses,
        options,
      );
      break;
    case 'clusters':
      basePrompt = promptTemplateService.buildClusteringPrompt(
        responses,
        options,
      );
      break;
    case 'contradictions':
      basePrompt = promptTemplateService.buildContradictionsPrompt(
        responses,
        options,
      );
      break;
    case 'insights':
      basePrompt = promptTemplateService.buildInsightsPrompt(responses, options);
      break;
    case 'recommendations':
      basePrompt = promptTemplateService.buildRecommendationsPrompt(
        responses,
        options,
      );
      break;
    case 'sentiment':
      basePrompt = this.buildSentimentAnalysisPrompt(responses, options);
      break;
    default:
      throw new Error(`Unknown analysis type: ${analysisType}`);
    }

    // Add cultural bias handling if enabled
    if (options.culturalBiasHandling) {
      basePrompt = this.addCulturalBiasInstructions(basePrompt, culturalContext, language);
    }

    // Add provider-specific formatting
    if (provider === 'anthropic') {
      basePrompt = this.adaptPromptForAnthropic(basePrompt);
    }

    return basePrompt;
  }

  /**
   * Call OpenAI API with enhanced error handling
   */
  private async callOpenAI(
    model: string,
    prompt: string,
    options: any,
  ): Promise<{ content: string; usage?: any }> {
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert sociological analyst specializing in workshop feedback analysis. Provide insights that are culturally sensitive and evidence-based. Respond only with valid JSON as specified in the prompt.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.3,
        response_format: { type: 'json_object' },
      });

      return {
        content: response.choices[0].message.content || '',
        usage: response.usage,
      };

    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Call Anthropic API with enhanced error handling
   */
  private async callAnthropic(
    model: string,
    prompt: string,
    options: any,
  ): Promise<{ content: Array<{ text: string }>; usage: any }> {
    try {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.3,
        messages: [
          {
            role: 'user',
            content: `You are an expert sociological analyst specializing in workshop feedback analysis. Provide insights that are culturally sensitive and evidence-based. Respond only with valid JSON as specified in the following prompt:\n\n${prompt}`,
          },
        ],
      });

      return {
        content: response.content,
        usage: response.usage,
      };

    } catch (error) {
      console.error('Anthropic API call failed:', error);
      throw new Error(`Anthropic API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse and validate LLM response
   */
  private parseLLMResponse(content: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Invalid JSON response from LLM: ${content.substring(0, 200)}...`);
    }
  }

  /**
   * Process analysis results with validation and enhancement
   */
  private async processAnalysisResult(
    analysisType: string,
    result: any,
    responses: any[],
    options: any,
  ): Promise<any> {
    // Validate result structure
    this.validateAnalysisResults(analysisType, result);

    // Add confidence scores and metadata
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
   * Verify GDPR compliance for analysis
   */
  private async verifyGDPRCompliance(
    questionnaireId: string,
    responses: any[],
  ): Promise<{ compliant: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check for user consent
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

    // Check data retention
    const oldestResponse = responses.reduce((oldest, response) => {
      return response.submittedAt < oldest.submittedAt ? response : oldest;
    }, responses[0]);

    const retentionDays = 365; // 1 year default retention
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    if (new Date(oldestResponse.submittedAt) < cutoffDate) {
      issues.push('Data retention period exceeded');
    }

    return {
      compliant: issues.length === 0,
      issues,
    };
  }

  /**
   * Verify user consent for AI analysis
   */
  private async verifyAnalysisConsent(
    questionnaireId: string,
    userId: string,
  ): Promise<boolean> {
    const consent = await db.query.consents.findFirst({
      where: and(
        eq(consents.questionnaireId, questionnaireId),
        eq(consents.userId, userId),
        eq(consents.consentType, 'research_analysis'),
        eq(consents.granted, true),
      ),
    });

    return !!consent;
  }

  /**
   * Batch anonymize responses for efficiency
   */
  private async batchAnonymizeResponses(
    responses: any[],
    level: 'partial' | 'full',
  ): Promise<any[]> {
    const batchSize = this.costSettings.batchThreshold || 100;
    const batches = [];

    for (let i = 0; i < responses.length; i += batchSize) {
      batches.push(responses.slice(i, i + batchSize));
    }

    const anonymizedBatches = await Promise.all(
      batches.map(batch =>
        Promise.all(
          batch.map(response => anonymizationService.anonymizeResponse(response, level)),
        ),
      ),
    );

    return anonymizedBatches.flat();
  }

  /**
   * Apply additional anonymization techniques for k-anonymity
   */
  private async applyAdditionalAnonymization(responses: any[]): Promise<void> {
    // Generalize specific locations, dates, and other identifying information
    for (const response of responses) {
      if (typeof response.answer === 'string') {
        response.answer = this.generalizeIdentifyingInfo(response.answer);
      }
    }
  }

  /**
   * Generalize identifying information for better anonymity
   */
  private generalizeIdentifyingInfo(text: string): string {
    // Generalize specific years to decades
    text = text.replace(/\b(19|20)\d{2}\b/g, (match) => {
      const year = parseInt(match);
      const decade = Math.floor(year / 10) * 10;
      return `${decade}s`;
    });

    // Generalize specific ages to ranges
    text = text.replace(/\b\d{1,2}\s*(?:lat|lata)\b/gi, (match) => {
      const age = parseInt(match);
      if (age < 25) return '18-24 lat';
      if (age < 35) return '25-34 lat';
      if (age < 45) return '35-44 lat';
      if (age < 55) return '45-54 lat';
      return '55+ lat';
    });

    return text;
  }

  /**
   * Generate embeddings for semantic analysis
   */
  private async generateEmbeddings(responses: any[]): Promise<void> {
    // Check cache first
    const uncachedResponses = responses.filter(response => {
      const cacheKey = this.getCacheKey(response.id, response.answer);
      return !this.cache.has(cacheKey);
    });

    if (uncachedResponses.length === 0) return;

    // Process in batches to manage API limits
    const batchSize = 100;
    for (let i = 0; i < uncachedResponses.length; i += batchSize) {
      const batch = uncachedResponses.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (response) => {
          const text = typeof response.answer === 'string'
            ? response.answer
            : JSON.stringify(response.answer);

          await embeddingsService.storeEmbedding(
            response.id,
            response.questionId,
            text,
            'text-embedding-3-small',
          );

          // Cache the result
          const cacheKey = this.getCacheKey(response.id, response.answer);
          this.cache.set(cacheKey, {
            data: true,
            timestamp: Date.now(),
          });
        }),
      );
    }
  }

  /**
   * Get cache key for response
   */
  private getCacheKey(responseId: string, answer: any): string {
    return `embedding:${responseId}:${this.hashContent(answer)}`;
  }

  /**
   * Hash content for caching
   */
  private hashContent(content: any): string {
    const crypto = require('crypto');
    return crypto
      .createHash('md5')
      .update(JSON.stringify(content))
      .digest('hex');
  }

  /**
   * Get questionnaire with associated responses
   */
  private async getQuestionnaireWithResponses(questionnaireId: string) {
    const questionnaire = await db.query.questionnaires.findFirst({
      where: eq(questionnaires.id, questionnaireId),
      with: {
        questions: {
          with: {
            responses: true,
          },
        },
      },
    });

    if (!questionnaire) return null;

    const responses = questionnaire.questions.flatMap(q => q.responses);

    return {
      questionnaire,
      responses,
    };
  }

  /**
   * Save analysis result to database
   */
  private async saveAnalysisResult(
    questionnaireId: string,
    analysisType: string,
    result: EnhancedLLMAnalysisJobResult['analyses'][0],
    triggeredBy: string,
  ): Promise<void> {
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
  }

  /**
   * Save failed analysis to database
   */
  private async saveFailedAnalysis(
    questionnaireId: string,
    analysisType: string,
    error: any,
    triggeredBy: string,
  ): Promise<void> {
    await db.insert(llmAnalyses).values({
      id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      questionnaireId,
      analysisType,
      status: 'failed',
      errorMessage: error.error,
      triggeredBy,
      completedAt: new Date(),
    });
  }

  /**
   * Setup event handlers for the worker
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed successfully`);
      this.sendCompletionNotification(job.data.triggeredBy, result);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`Job ${job?.id} failed:`, error);
      this.sendFailureNotification(job?.data.triggeredBy, error);
    });

    this.worker.on('error', error => {
      console.error('Worker error:', error);
    });

    this.queueEvents.on('stalled', job => {
      console.warn(`Job ${job.id} stalled`);
    });

    this.queueEvents.on('progress', (job, progress) => {
      console.log(`Job ${job.id} progress: ${progress}%`);
    });
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(userId: string, result: any): Promise<void> {
    // Implementation would integrate with your notification system
    console.log(`Analysis completed for user ${userId}:`, result.status);
  }

  /**
   * Send failure notification
   */
  private async sendFailureNotification(userId: string, error: any): Promise<void> {
    // Implementation would integrate with your notification system
    console.error(`Analysis failed for user ${userId}:`, error);
  }

  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expirationMs = this.costSettings.cacheExpirationHours * 60 * 60 * 1000;

      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > expirationMs) {
          this.cache.delete(key);
        }
      }
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Get default model for provider
   */
  private getDefaultModel(provider: 'openai' | 'anthropic', analysisType: string): string {
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
  }

  /**
   * Calculate OpenAI API cost
   */
  private calculateOpenAICost(model: string, tokens: number): number {
    const pricing = {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 }, // per 1K tokens
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['gpt-4o-mini'];

    // Assume 70% input, 30% output split
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    return (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output;
  }

  /**
   * Calculate Anthropic API cost
   */
  private calculateAnthropicCost(model: string, tokens: number): number {
    const pricing = {
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 }, // per 1K tokens
      'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['claude-3-5-haiku-20241022'];

    // Assume 70% input, 30% output split
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    return (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output;
  }

  /**
   * Track costs for monthly limit
   */
  private trackCost(cost: number): void {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentCost = this.costTracker.get(currentMonth) || 0;
    this.costTracker.set(currentMonth, currentCost + cost);
  }

  /**
   * Get current monthly cost
   */
  private getCurrentMonthlyCost(): number {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return this.costTracker.get(currentMonth) || 0;
  }

  /**
   * Helper methods for enhanced functionality
   */
  private updateJobStatus = async (jobId: string, status: string, progress: number, errorMessage?: string): Promise<void> => {
    const updateData: any = {
      status,
      progress,
      updatedAt: new Date(),
    };

    if (status === 'processing') {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
      updateData.completedSteps = Math.floor(progress / 100 * 5); // Assuming 5 total steps
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await db
      .update(analysisJobs)
      .set(updateData)
      .where(eq(analysisJobs.id, jobId));
  };

  private getPriorityValue = (priority: string): number => {
    const priorities = { low: 1, medium: 5, high: 10, urgent: 20 };
    return priorities[priority as keyof typeof priorities] || 5;
  };

  private isRetryableError = (error: any): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('temporary') ||
        message.includes('overloaded')
      );
    }
    return false;
  };

  private getErrorSeverity = (error: any, analysisType: string): 'low' | 'medium' | 'high' => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('api key') || message.includes('authentication')) {
        return 'high';
      }
      if (message.includes('rate limit') || message.includes('timeout')) {
        return 'medium';
      }
    }
    return 'low';
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

  private calculateConfidenceScore = (results: any, responseCount: number, analysisType: string): number => {
    let score = 0.5; // Base score

    // Increase score based on response count
    if (responseCount >= 100) score += 0.3;
    else if (responseCount >= 50) score += 0.2;
    else if (responseCount >= 20) score += 0.1;

    // Increase score based on result quality
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

  // Placeholder methods for enhanced features
  private buildSentimentAnalysisPrompt = (responses: any[], options: any): string => {
    return promptTemplateService.buildSentimentAnalysisPrompt(responses, options);
  };

  private addCulturalBiasInstructions = (prompt: string, culturalContext: any, language: string): string => {
    return `${prompt}\n\nCultural Context Awareness: ${JSON.stringify(culturalContext)}\nLanguage: ${language}\nPlease ensure your analysis is culturally sensitive and avoids bias.`;
  };

  private adaptPromptForAnthropic = (prompt: string): string => {
    return `Please respond with valid JSON only. ${prompt}`;
  };

  private detectCulturalContext = async (responses: any[]): Promise<any> => {
    // Simplified cultural context detection
    return { region: 'mixed', detectedLanguages: ['pl', 'en'] };
  };

  private detectCulturalBias = async (results: any, language?: string): Promise<boolean> => {
    // Simplified bias detection
    return false;
  };

  private extractSentimentDistribution = (results: any): { positive: number; negative: number; neutral: number } => {
    return results.sentiment?.distribution || { positive: 0.4, negative: 0.2, neutral: 0.4 };
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
   * Get cost statistics
   */
  async getCostStats(): Promise<{
    currentMonth: number;
    lastMonth: number;
    projectedMonthly: number;
  }> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().slice(0, 7);

    return {
      currentMonth: this.getCurrentMonthlyCost(),
      lastMonth: this.costTracker.get(lastMonthStr) || 0,
      projectedMonthly: this.getCurrentMonthlyCost() * 2, // Simple projection
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

// Create and export enhanced worker instance
export const enhancedLLMAnalysisWorker = new EnhancedLLMAnalysisWorker({
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    organizationId: process.env.OPENAI_ORG_ID,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  rateLimits: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
  },
});
