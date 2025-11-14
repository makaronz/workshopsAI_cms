import OpenAI from 'openai';
import { Embedding, Response } from '../models/llm-schema';
import { db } from '../config/database';
import { eq, and } from 'drizzle-orm';

/**
 * Supported embedding models with their specifications
 */
export interface EmbeddingModel {
  name: string;
  provider: 'openai' | 'anthropic' | 'local';
  dimensions: number;
  maxTokens: number;
  costPer1kTokens: number;
}

export const EMBEDDING_MODELS: Record<string, EmbeddingModel> = {
  'text-embedding-3-small': {
    name: 'text-embedding-3-small',
    provider: 'openai',
    dimensions: 1536,
    maxTokens: 8191,
    costPer1kTokens: 0.00002,
  },
  'text-embedding-3-large': {
    name: 'text-embedding-3-large',
    provider: 'openai',
    dimensions: 3072,
    maxTokens: 8191,
    costPer1kTokens: 0.00013,
  },
  'text-embedding-ada-002': {
    name: 'text-embedding-ada-002',
    provider: 'openai',
    dimensions: 1536,
    maxTokens: 8191,
    costPer1kTokens: 0.0001,
  },
  'voyage-02': {
    name: 'voyage-02',
    provider: 'anthropic',
    dimensions: 1024,
    maxTokens: 32000,
    costPer1kTokens: 0.00006,
  },
  'voyage-large-2': {
    name: 'voyage-large-2',
    provider: 'anthropic',
    dimensions: 1536,
    maxTokens: 16000,
    costPer1kTokens: 0.00035,
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
}

/**
 * Search options for vector similarity
 */
export interface VectorSearchOptions {
  limit?: number;
  threshold?: number; // Similarity threshold (0-1)
  includeMetadata?: boolean;
  filterByQuestionId?: string;
}

/**
 * Similarity search result
 */
export interface SimilaritySearchResult {
  responseId: string;
  questionId: string;
  similarity: number;
  content: string;
  metadata?: any;
}

/**
 * Vector database interface (to be implemented with actual vector store)
 */
export interface VectorDatabase {
  upsert(
    vectors: Array<{ id: string; vector: number[]; metadata?: any }>,
  ): Promise<void>;
  search(
    queryVector: number[],
    options: VectorSearchOptions,
  ): Promise<SimilaritySearchResult[]>;
  delete(ids: string[]): Promise<void>;
  update(id: string, vector: number[], metadata?: any): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/**
 * Mock vector database implementation (replace with actual vector store)
 */
export class MockVectorDatabase implements VectorDatabase {
  private vectors = new Map<string, { vector: number[]; metadata?: any }>();
  private nextId = 1;

  async upsert(
    vectors: Array<{ id: string; vector: number[]; metadata?: any }>,
  ): Promise<void> {
    for (const { id, vector, metadata } of vectors) {
      const vectorId = id || `vec_${this.nextId++}`;
      this.vectors.set(vectorId, { vector, metadata });
    }
  }

  async search(
    queryVector: number[],
    options: VectorSearchOptions = {},
  ): Promise<SimilaritySearchResult[]> {
    const { limit = 10, threshold = 0.7 } = options;

    const results: SimilaritySearchResult[] = [];

    for (const [id, data] of this.vectors.entries()) {
      const similarity = this.cosineSimilarity(queryVector, data.vector);

      if (similarity >= threshold) {
        results.push({
          responseId: data.metadata?.responseId || id,
          questionId: data.metadata?.questionId || '',
          similarity,
          content: data.metadata?.content || '',
          metadata: data.metadata,
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.vectors.delete(id);
    }
  }

  async update(id: string, vector: number[], metadata?: any): Promise<void> {
    this.vectors.set(id, { vector, metadata });
  }

  async healthCheck(): Promise<boolean> {
    return this.vectors.size >= 0;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }
}

/**
 * Embeddings service for managing vector embeddings
 */
export class EmbeddingsService {
  private openai: OpenAI;
  private vectorDB: VectorDatabase;
  private defaultModel: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.vectorDB = new MockVectorDatabase(); // Replace with actual vector DB
    this.defaultModel = 'text-embedding-3-small';
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(
    text: string,
    model: string = this.defaultModel,
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const modelConfig = EMBEDDING_MODELS[model];

    if (!modelConfig) {
      throw new Error(`Unsupported embedding model: ${model}`);
    }

    if (modelConfig.provider === 'openai') {
      try {
        const response = await this.openai.embeddings.create({
          model: modelConfig.name,
          input: text,
          encoding_format: 'float',
        });

        const embedding = response.data[0];
        const processingTime = Date.now() - startTime;

        return {
          vector: embedding.embedding,
          model: modelConfig.name,
          dimensions: modelConfig.dimensions,
          tokens: embedding.usage?.total_tokens || 0,
          cost:
            ((embedding.usage?.total_tokens || 0) *
              modelConfig.costPer1kTokens) /
            1000,
          processingTime,
        };
      } catch (error) {
        throw new Error(`OpenAI embedding generation failed: ${error}`);
      }
    } else if (modelConfig.provider === 'anthropic') {
      // Implement Anthropic embedding generation
      throw new Error('Anthropic embedding generation not implemented yet');
    } else {
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
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
          const startTime = Date.now();

          if (modelConfig.provider === 'openai') {
            const response = await Promise.race([
              this.openai.embeddings.create({
                model: modelConfig.name,
                input: batch,
                encoding_format: 'float',
              }),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeout),
              ),
            ]);

            const processingTime = Date.now() - startTime;

            for (let i = 0; i < response.data.length; i++) {
              const embedding = response.data[i];
              results.push({
                vector: embedding.embedding,
                model: modelConfig.name,
                dimensions: modelConfig.dimensions,
                tokens: embedding.usage?.total_tokens || 0,
                cost:
                  ((embedding.usage?.total_tokens || 0) *
                    modelConfig.costPer1kTokens) /
                  1000,
                processingTime,
              });
            }
          }

          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          if (retryCount <= maxRetries) {
            console.warn(
              `Embedding batch ${batchIndex + 1} failed, retrying (${retryCount}/${maxRetries}):`,
              error,
            );
            await this.sleep(retryDelay * Math.pow(2, retryCount - 1)); // Exponential backoff
          } else {
            console.error(
              `Embedding batch ${batchIndex + 1} failed after ${maxRetries} retries:`,
              error,
            );
            // Add empty results for failed batch to maintain alignment
            for (const text of batch) {
              results.push({
                vector: [],
                model: modelConfig.name,
                dimensions: modelConfig.dimensions,
                tokens: 0,
                cost: 0,
                processingTime: 0,
              });
            }
          }
        }
      }

      // Add delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        await this.sleep(100);
      }
    }

    return results;
  }

  /**
   * Store embedding in database and vector store
   */
  async storeEmbedding(
    responseId: string,
    questionId: string,
    text: string,
    model: string = this.defaultModel,
  ): Promise<void> {
    // Generate embedding
    const embeddingResult = await this.generateEmbedding(text, model);

    // Check if embedding already exists
    const existingEmbedding = await db.query.embeddings.findFirst({
      where: and(
        eq(embeddings.responseId, responseId),
        eq(embeddings.questionId, questionId),
      ),
    });

    const vectorIndex = `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (existingEmbedding) {
      // Update existing embedding
      await this.vectorDB.update(
        existingEmbedding.vectorIndex,
        embeddingResult.vector,
        {
          responseId,
          questionId,
          content: text,
          model: embeddingResult.model,
        },
      );

      await db
        .update(embeddings)
        .set({
          vectorIndex,
          model: embeddingResult.model,
          dimensions: embeddingResult.dimensions,
          provider: EMBEDDING_MODELS[model].provider,
          checksum: this.calculateChecksum(text),
        })
        .where(eq(embeddings.id, existingEmbedding.id));
    } else {
      // Create new embedding
      await this.vectorDB.upsert([
        {
          id: vectorIndex,
          vector: embeddingResult.vector,
          metadata: {
            responseId,
            questionId,
            content: text,
            model: embeddingResult.model,
          },
        },
      ]);

      await db.insert(embeddings).values({
        id: `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        responseId,
        questionId,
        vectorIndex,
        model: embeddingResult.model,
        dimensions: embeddingResult.dimensions,
        provider: EMBEDDING_MODELS[model].provider,
        checksum: this.calculateChecksum(text),
      });
    }
  }

  /**
   * Find similar responses using vector similarity
   */
  async findSimilarResponses(
    queryText: string,
    options: VectorSearchOptions = {},
  ): Promise<SimilaritySearchResult[]> {
    const { model = this.defaultModel } = options;

    // Generate embedding for query text
    const queryEmbedding = await this.generateEmbedding(queryText, model);

    // Search vector database
    return await this.vectorDB.search(queryEmbedding.vector, options);
  }

  /**
   * Find similar responses to a given response ID
   */
  async findSimilarResponsesToResponse(
    responseId: string,
    options: VectorSearchOptions = {},
  ): Promise<SimilaritySearchResult[]> {
    // Get the embedding for the response
    const embeddingRecord = await db.query.embeddings.findFirst({
      where: eq(embeddings.responseId, responseId),
    });

    if (!embeddingRecord) {
      throw new Error(`No embedding found for response: ${responseId}`);
    }

    // Get vector from vector database
    const vectorData = await this.vectorDB.search([], { limit: 1 });
    const targetVector = vectorData.find(v => v.responseId === responseId);

    if (!targetVector) {
      throw new Error(
        `Vector not found in database for response: ${responseId}`,
      );
    }

    // Get the actual vector (this would need to be implemented based on vector DB)
    const queryVector = await this.getVectorByIndex(
      embeddingRecord.vectorIndex,
    );

    return await this.vectorDB.search(queryVector, options);
  }

  /**
   * Get clustering data for responses
   */
  async getClusteringData(
    questionIds: string[],
    model: string = this.defaultModel,
  ): Promise<Array<{ id: string; vector: number[]; content: string }>> {
    const embeddings = await db.query.embeddings.findMany({
      where:
        questionIds.length > 0
          ? eq(embeddings.questionId, questionIds[0]) // This would need IN operator
          : undefined,
    });

    const clusteringData: Array<{
      id: string;
      vector: number[];
      content: string;
    }> = [];

    for (const embedding of embeddings) {
      try {
        const vector = await this.getVectorByIndex(embedding.vectorIndex);
        clusteringData.push({
          id: embedding.responseId,
          vector,
          content: '', // Would need to fetch from responses table
        });
      } catch (error) {
        console.warn(
          `Failed to get vector for embedding ${embedding.id}:`,
          error,
        );
      }
    }

    return clusteringData;
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
      const tokenCount = Math.ceil(text.length / 4); // Rough estimation: 1 token ≈ 4 characters
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
    vectorDB: boolean;
    database: boolean;
    models: string[];
  }> {
    const [openaiStatus, vectorDBStatus] = await Promise.all([
      this.checkOpenAIHealth(),
      this.vectorDB.healthCheck(),
    ]);

    return {
      openai: openaiStatus,
      vectorDB: vectorDBStatus,
      database: true, // Would need to implement actual DB health check
      models: Object.keys(EMBEDDING_MODELS),
    };
  }

  // Private helper methods

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

  private calculateChecksum(text: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex')
      .substring(0, 16);
  }

  private async checkOpenAIHealth(): Promise<boolean> {
    try {
      await this.openai.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getVectorByIndex(index: string): Promise<number[]> {
    // This would need to be implemented based on the actual vector database
    // For now, return a dummy vector
    return new Array(1536).fill(0).map(() => Math.random());
  }
}

// Export singleton instance
export const embeddingsService = new EmbeddingsService();

// Export vector database interface for actual implementation
export { VectorDatabase };
