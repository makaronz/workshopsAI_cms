import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import { vectorDatabaseManager } from './vectorDatabaseManager';

/**
 * Supported embedding models with multilingual support
 */
export interface EmbeddingModel {
  name: string;
  provider: 'openai' | 'cohere' | 'local';
  dimensions: number;
  maxTokens: number;
  costPer1kTokens: number;
  languages: string[];
  specialties: string[];
}

export const EMBEDDING_MODELS: Record<string, EmbeddingModel> = {
  'text-embedding-3-small': {
    name: 'text-embedding-3-small',
    provider: 'openai',
    dimensions: 1536,
    maxTokens: 8191,
    costPer1kTokens: 0.00002,
    languages: [
      'en',
      'pl',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'ru',
      'ja',
      'ko',
      'zh',
    ],
    specialties: ['general', 'multilingual', 'cost-effective'],
  },
  'text-embedding-3-large': {
    name: 'text-embedding-3-large',
    provider: 'openai',
    dimensions: 3072,
    maxTokens: 8191,
    costPer1kTokens: 0.00013,
    languages: [
      'en',
      'pl',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'ru',
      'ja',
      'ko',
      'zh',
    ],
    specialties: ['high-quality', 'multilingual', 'semantic-understanding'],
  },
  'text-embedding-ada-002': {
    name: 'text-embedding-ada-002',
    provider: 'openai',
    dimensions: 1536,
    maxTokens: 8191,
    costPer1kTokens: 0.0001,
    languages: ['en'],
    specialties: ['general', 'english-focused'],
  },
  'multilingual-e5-large': {
    name: 'multilingual-e5-large',
    provider: 'local',
    dimensions: 1024,
    maxTokens: 512,
    costPer1kTokens: 0,
    languages: [
      'en',
      'pl',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'ru',
      'ja',
      'ko',
      'zh',
      'ar',
      'hi',
    ],
    specialties: ['multilingual', 'semantic-search', 'instruction-tuned'],
  },
  'paraphrase-multilingual-mpnet-base-v2': {
    name: 'paraphrase-multilingual-mpnet-base-v2',
    provider: 'local',
    dimensions: 768,
    maxTokens: 514,
    costPer1kTokens: 0,
    languages: [
      'en',
      'pl',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'ru',
      'ja',
      'ko',
      'zh',
      'ar',
      'hi',
      'tr',
    ],
    specialties: [
      'multilingual',
      'paraphrase-detection',
      'semantic-similarity',
    ],
  },
};

/**
 * Embedding generation result
 */
export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  tokens: number;
  cost: number;
  processingTime: number;
  confidence: number;
  language: string;
}

/**
 * Batch embedding processing options
 */
export interface BatchEmbeddingOptions {
  model?: string;
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  skipCache?: boolean;
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Document embedding request
 */
export interface DocumentEmbeddingRequest {
  documentId: string;
  documentType: string;
  content: string;
  language?: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Language detection result
 */
export interface LanguageDetection {
  language: string;
  confidence: number;
  alternatives?: Array<{ language: string; confidence: number }>;
}

/**
 * Enhanced embedding service with multilingual support
 */
export class EmbeddingService {
  private openai: OpenAI;
  private cache = new Map<string, EmbeddingResult>();
  private readonly maxCacheSize = 10000;
  private defaultModel = 'text-embedding-3-small';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(
    text: string,
    options: {
      model?: string;
      language?: string;
      detectLanguage?: boolean;
    } = {},
  ): Promise<EmbeddingResult> {
    const {
      model = this.defaultModel,
      language: providedLanguage,
      detectLanguage = true,
    } = options;

    const startTime = Date.now();
    const modelConfig = EMBEDDING_MODELS[model];

    if (!modelConfig) {
      throw new Error(`Unsupported embedding model: ${model}`);
    }

    // Detect language if needed
    let language = providedLanguage;
    if (detectLanguage && !language) {
      const detection = await this.detectLanguage(text);
      language = detection.language;
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text, model);
    if (this.cache.has(cacheKey)) {
      return { ...this.cache.get(cacheKey)! };
    }

    // Validate text length
    if (text.length === 0) {
      throw new Error('Cannot generate embedding for empty text');
    }

    if (text.length > modelConfig.maxTokens * 4) {
      logger.warn(
        `Text length (${text.length}) exceeds model max tokens (${modelConfig.maxTokens * 4})`,
      );
    }

    try {
      let embedding: number[];
      let tokens = 0;
      let cost = 0;

      if (modelConfig.provider === 'openai') {
        const response = await this.openai.embeddings.create({
          model: modelConfig.name,
          input: this.preprocessText(text, language),
          encoding_format: 'float',
        });

        embedding = response.data[0].embedding;
        tokens = response.data[0].usage?.total_tokens || 0;
        cost = (tokens / 1000) * modelConfig.costPer1kTokens;
      } else if (modelConfig.provider === 'local') {
        // Local model implementation
        const result = await this.generateLocalEmbedding(
          text,
          modelConfig.name,
          language,
        );
        embedding = result.vector;
        tokens = result.tokens;
        cost = 0; // Local models are free
      } else {
        throw new Error(`Unsupported provider: ${modelConfig.provider}`);
      }

      const processingTime = Date.now() - startTime;
      const confidence = this.calculateConfidence(embedding, text, language);

      const result: EmbeddingResult = {
        vector: embedding,
        model: modelConfig.name,
        dimensions: modelConfig.dimensions,
        tokens,
        cost,
        processingTime,
        confidence,
        language: language || 'en',
      };

      // Cache the result
      this.cache.set(cacheKey, result);
      this.limitCacheSize();

      return result;
    } catch (error) {
      logger.error(`Failed to generate embedding with model ${model}:`, error);
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(
    texts: string[],
    options: BatchEmbeddingOptions = {},
  ): Promise<EmbeddingResult[]> {
    const {
      model = this.defaultModel,
      batchSize = 100,
      maxRetries = 3,
      retryDelay = 1000,
      timeout = 30000,
      skipCache = false,
      onProgress,
    } = options;

    const modelConfig = EMBEDDING_MODELS[model];
    if (!modelConfig) {
      throw new Error(`Unsupported embedding model: ${model}`);
    }

    const results: EmbeddingResult[] = [];
    const batches = this.createBatches(texts, batchSize);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          const batchResults: EmbeddingResult[] = [];

          // Check cache first
          for (let i = 0; i < batch.length; i++) {
            const text = batch[i];
            const cacheKey = this.getCacheKey(text, model);

            if (!skipCache && this.cache.has(cacheKey)) {
              batchResults[i] = { ...this.cache.get(cacheKey)! };
            }
          }

          // Process uncached texts
          const uncachedIndices = batch
            .map((text, i) => (batchResults[i] === undefined ? i : -1))
            .filter(i => i !== -1);

          if (uncachedIndices.length > 0) {
            const uncachedTexts = uncachedIndices.map(i => batch[i]);
            const uncachedResults = await this.processBatchWithProvider(
              uncachedTexts,
              modelConfig,
              timeout,
            );

            // Map results back to original positions
            for (let j = 0; j < uncachedIndices.length; j++) {
              const originalIndex = uncachedIndices[j];
              batchResults[originalIndex] = uncachedResults[j];

              // Cache the result
              const cacheKey = this.getCacheKey(batch[originalIndex], model);
              this.cache.set(cacheKey, uncachedResults[j]);
            }
          }

          results.push(...batchResults);

          // Update progress
          if (onProgress) {
            const completed = Math.min(
              (batchIndex + 1) * batchSize,
              texts.length,
            );
            onProgress(completed, texts.length);
          }

          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          if (retryCount <= maxRetries) {
            logger.warn(
              `Embedding batch ${batchIndex + 1} failed, retrying (${retryCount}/${maxRetries}):`,
              error,
            );
            await this.sleep(retryDelay * Math.pow(2, retryCount - 1)); // Exponential backoff
          } else {
            logger.error(
              `Embedding batch ${batchIndex + 1} failed after ${maxRetries} retries:`,
              error,
            );
            throw error;
          }
        }
      }

      // Add delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        await this.sleep(100);
      }
    }

    this.limitCacheSize();
    return results;
  }

  /**
   * Store document embeddings in vector database
   */
  async storeDocumentEmbeddings(
    documents: DocumentEmbeddingRequest[],
    options: BatchEmbeddingOptions = {},
  ): Promise<void> {
    // Detect languages for documents
    const documentsWithLanguage = await Promise.all(
      documents.map(async doc => {
        let language = doc.language;
        if (!language) {
          const detection = await this.detectLanguage(doc.content);
          language = detection.language;
        }
        return { ...doc, language };
      }),
    );

    // Generate embeddings
    const embeddings = await this.generateBatchEmbeddings(
      documentsWithLanguage.map(doc => doc.content),
      {
        ...options,
        onProgress: (completed, total) => {
          logger.info(`Generated ${completed}/${total} document embeddings`);
          options.onProgress?.(completed, total);
        },
      },
    );

    // Prepare data for vector database
    const vectorData = embeddings.map((embedding, index) => ({
      documentId: documentsWithLanguage[index].documentId,
      documentType: documentsWithLanguage[index].documentType,
      content: documentsWithLanguage[index].content,
      embedding: embedding.vector,
      language: embedding.language,
      embeddingModel: embedding.model,
      metadata: {
        ...documentsWithLanguage[index].metadata,
        confidence: embedding.confidence,
        tokens: embedding.tokens,
        cost: embedding.cost,
        processingTime: embedding.processingTime,
        priority: documentsWithLanguage[index].priority,
      },
    }));

    // Store in vector database
    await vectorDatabaseManager.upsertEmbeddings(vectorData, options);
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<LanguageDetection> {
    // Simple language detection based on character patterns
    // In production, you might want to use a proper language detection library

    const polishPatterns = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
    const cyrillicPatterns = /[а-яёА-ЯЁ]/;
    const arabicPatterns = /[؀-ؿ‌‍ؠ-ؽؿ-ٟٮ-ۿۼ-۽۾ۿݐ-ݿࢀ-ࢿ࣓-࣡࣢-ࣾࣿ]/;
    const chinesePatterns = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
    const japanesePatterns = /[\u3040-\u309f\u30a0-\u30ff]/;
    const koreanPatterns = /[\uac00-\ud7af]/;

    if (polishPatterns.test(text)) {
      return { language: 'pl', confidence: 0.9 };
    }
    if (cyrillicPatterns.test(text)) {
      return { language: 'ru', confidence: 0.9 };
    }
    if (arabicPatterns.test(text)) {
      return { language: 'ar', confidence: 0.9 };
    }
    if (chinesePatterns.test(text)) {
      return { language: 'zh', confidence: 0.9 };
    }
    if (japanesePatterns.test(text)) {
      return { language: 'ja', confidence: 0.9 };
    }
    if (koreanPatterns.test(text)) {
      return { language: 'ko', confidence: 0.9 };
    }

    // Default to English for Latin script
    return { language: 'en', confidence: 0.7 };
  }

  /**
   * Calculate cost estimate for embedding generation
   */
  calculateCost(
    texts: string[],
    model: string = this.defaultModel,
  ): {
    tokens: number;
    cost: number;
    details: Array<{ text: string; tokenCount: number; cost: number }>;
  } {
    const modelConfig = EMBEDDING_MODELS[model];
    if (!modelConfig) {
      throw new Error(`Unsupported model: ${model}`);
    }

    let totalTokens = 0;
    let totalCost = 0;
    const details: Array<{ text: string; tokenCount: number; cost: number }> =
      [];

    for (const text of texts) {
      const tokenCount = Math.ceil(text.length / 4); // Rough estimation
      const cost = (tokenCount / 1000) * modelConfig.costPer1kTokens;

      totalTokens += tokenCount;
      totalCost += cost;

      details.push({
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        tokenCount,
        cost,
      });
    }

    return {
      tokens: totalTokens,
      cost: totalCost,
      details,
    };
  }

  /**
   * Health check for embedding service
   */
  async healthCheck(): Promise<{
    openai: boolean;
    cache: { size: number; maxSize: number };
    models: string[];
    vectorDatabase: boolean;
  }> {
    const [openaiStatus, vectorDBStatus] = await Promise.all([
      this.checkOpenAIHealth(),
      vectorDatabaseManager.healthCheck(),
    ]);

    return {
      openai: openaiStatus,
      cache: {
        size: this.cache.size,
        maxSize: this.maxCacheSize,
      },
      models: Object.keys(EMBEDDING_MODELS),
      vectorDatabase: vectorDBStatus,
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Embedding cache cleared');
  }

  // Private helper methods

  private preprocessText(text: string, language?: string): string {
    // Basic preprocessing - can be enhanced for specific languages
    let processed = text.trim();

    // Language-specific preprocessing
    if (language === 'pl') {
      // Polish-specific preprocessing
      processed = processed.replace(/[^\w\sąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ' ');
    } else {
      // General preprocessing for other languages
      processed = processed.replace(/[^\w\s]/g, ' ');
    }

    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ').trim();

    return processed;
  }

  private async processBatchWithProvider(
    texts: string[],
    modelConfig: EmbeddingModel,
    timeout: number,
  ): Promise<EmbeddingResult[]> {
    if (modelConfig.provider === 'openai') {
      return await this.processOpenAIBatch(texts, modelConfig, timeout);
    } else if (modelConfig.provider === 'local') {
      return await this.processLocalBatch(texts, modelConfig.name);
    } else {
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    }
  }

  private async processOpenAIBatch(
    texts: string[],
    modelConfig: EmbeddingModel,
    timeout: number,
  ): Promise<EmbeddingResult[]> {
    const startTime = Date.now();

    const response = await Promise.race([
      this.openai.embeddings.create({
        model: modelConfig.name,
        input: texts,
        encoding_format: 'float',
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout),
      ),
    ]);

    const processingTime = Date.now() - startTime;

    return response.data.map((embedding, index) => ({
      vector: embedding.embedding,
      model: modelConfig.name,
      dimensions: modelConfig.dimensions,
      tokens: embedding.usage?.total_tokens || 0,
      cost:
        ((embedding.usage?.total_tokens || 0) / 1000) *
        modelConfig.costPer1kTokens,
      processingTime,
      confidence: this.calculateConfidence(embedding.embedding, texts[index]),
      language: 'en', // OpenAI doesn't provide language info
    }));
  }

  private async processLocalBatch(
    texts: string[],
    modelName: string,
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      const result = await this.generateLocalEmbedding(text, modelName);
      results.push(result);
    }

    return results;
  }

  private async generateLocalEmbedding(
    text: string,
    modelName: string,
    language?: string,
  ): Promise<EmbeddingResult> {
    // This would integrate with local embedding models
    // For now, return a mock embedding
    const modelConfig = EMBEDDING_MODELS[modelName];
    const startTime = Date.now();

    // Mock embedding - replace with actual local model integration
    const vector = new Array(modelConfig.dimensions)
      .fill(0)
      .map(() => Math.random());
    const processingTime = Date.now() - startTime;

    return {
      vector,
      model: modelName,
      dimensions: modelConfig.dimensions,
      tokens: Math.ceil(text.length / 4),
      cost: 0,
      processingTime,
      confidence: 0.8,
      language: language || 'en',
    };
  }

  private calculateConfidence(
    embedding: number[],
    text: string,
    language?: string,
  ): number {
    // Simple confidence calculation based on embedding properties
    // Can be enhanced with more sophisticated methods

    // Base confidence
    let confidence = 0.7;

    // Adjust based on text length
    if (text.length > 100) {
      confidence += 0.1;
    }

    // Adjust based on embedding variance
    const variance = this.calculateVariance(embedding);
    if (variance > 0.1) {
      confidence += 0.1;
    }

    // Adjust based on language support
    const modelConfig = EMBEDDING_MODELS[this.defaultModel];
    if (language && modelConfig.languages.includes(language)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private calculateVariance(vector: number[]): number {
    const mean = vector.reduce((sum, val) => sum + val, 0) / vector.length;
    const variance =
      vector.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      vector.length;
    return variance;
  }

  private getCacheKey(text: string, model: string): string {
    // Simple cache key based on text hash and model
    const crypto = require('crypto');
    const textHash = crypto.createHash('md5').update(text).digest('hex');
    return `${model}:${textHash}`;
  }

  private limitCacheSize(): void {
    if (this.cache.size > this.maxCacheSize) {
      // Remove oldest entries (simple LRU)
      const entries = Array.from(this.cache.entries());
      const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async checkOpenAIHealth(): Promise<boolean> {
    try {
      await this.openai.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
