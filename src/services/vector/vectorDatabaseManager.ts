import { client, db } from '../../config/postgresql-database';
import { eq, and, inArray, sql, lte, gte, desc, asc } from 'drizzle-orm';
import {
  document_embeddings,
  type DocumentEmbedding,
} from '../../models/vector-schema';
import { logger } from '../../utils/logger';

/**
 * Vector similarity metrics
 */
export type SimilarityMetric = 'cosine' | 'l2' | 'inner_product';

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  metric?: SimilarityMetric;
  includeMetadata?: boolean;
  filters?: {
    documentType?: string[];
    language?: string[];
    embeddingModel?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
    confidenceScore?: number;
  };
  pagination?: {
    cursor?: string;
    direction?: 'forward' | 'backward';
  };
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  id: string;
  documentId: string;
  documentType: string;
  content: string;
  language: string;
  similarity: number;
  metadata?: any;
  embeddingModel: string;
  createdAt: Date;
  confidence?: number;
}

/**
 * Vector index configuration
 */
export interface VectorIndexConfig {
  name: string;
  type: 'ivfflat' | 'hnsw';
  columns: string[];
  metric: SimilarityMetric;
  lists?: number; // For IVFFlat
  m?: number; // For HNSW
  ef_construction?: number; // For HNSW
  ef?: number; // For HNSW search
}

/**
 * Batch operation options
 */
export interface BatchOptions {
  batchSize?: number;
  maxRetries?: number;
  timeout?: number;
  skipExisting?: boolean;
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Vector database manager with pgvector integration
 */
export class VectorDatabaseManager {
  private defaultMetric: SimilarityMetric = 'cosine';

  constructor() {
    // postgres-js client is already configured in postgresql-database.ts
  }

  /**
   * Initialize vector database extensions and schema
   */
  async initialize(): Promise<void> {
    try {
      // Enable pgvector extension
      await client`CREATE EXTENSION IF NOT EXISTS vector;`;

      // Create document_embeddings table if not exists
      await this.ensureTableExists();

      // Create vector indexes for performance
      await this.ensureIndexesExist();

      logger.info('Vector database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize vector database:', error);
      throw error;
    }
  }

  /**
   * Insert or update document embeddings
   */
  async upsertEmbeddings(
    embeddings: Array<{
      documentId: string;
      documentType: string;
      content: string;
      embedding: number[];
      language?: string;
      embeddingModel?: string;
      metadata?: any;
    }>,
    options: BatchOptions = {},
  ): Promise<void> {
    const {
      batchSize = 100,
      maxRetries = 3,
      timeout = 30000,
      skipExisting = true,
      onProgress,
    } = options;

    const batches = this.createBatches(embeddings, batchSize);
    let completed = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          await client.begin(async (sqlClient) => {
            for (const embedding of batch) {
              const vectorString = `[${embedding.embedding.join(',')}]`;

              // Check if embedding already exists
              if (skipExisting) {
                const existing = await sqlClient`
                  SELECT id FROM document_embeddings
                  WHERE document_id = ${embedding.documentId} AND document_type = ${embedding.documentType}
                `;

                if (existing.length > 0) {
                  // Update existing embedding
                  await sqlClient`
                    UPDATE document_embeddings
                    SET content = ${embedding.content},
                        embedding = ${vectorString},
                        language = ${embedding.language || 'en'},
                        embedding_model = ${embedding.embeddingModel || 'text-embedding-3-small'},
                        metadata = ${JSON.stringify(embedding.metadata || {})},
                        updated_at = NOW()
                    WHERE document_id = ${embedding.documentId} AND document_type = ${embedding.documentType}
                  `;
                } else {
                  // Insert new embedding
                  await sqlClient`
                    INSERT INTO document_embeddings
                    (document_id, document_type, content, embedding, language,
                     embedding_model, metadata)
                    VALUES (${embedding.documentId}, ${embedding.documentType}, ${embedding.content}, ${vectorString}, ${embedding.language || 'en'}, ${embedding.embeddingModel || 'text-embedding-3-small'}, ${JSON.stringify(embedding.metadata || {})})
                  `;
                }
              } else {
                // Force insert new embedding
                await sqlClient`
                  INSERT INTO document_embeddings
                  (document_id, document_type, content, embedding, language,
                   embedding_model, metadata)
                  VALUES (${embedding.documentId}, ${embedding.documentType}, ${embedding.content}, ${vectorString}, ${embedding.language || 'en'}, ${embedding.embeddingModel || 'text-embedding-3-small'}, ${JSON.stringify(embedding.metadata || {})})
                `;
              }

              completed++;
              if (onProgress) {
                onProgress(completed, embeddings.length);
              }
            }
          });

          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          if (retryCount <= maxRetries) {
            logger.warn(
              `Batch ${batchIndex + 1} failed, retrying (${retryCount}/${maxRetries}):`,
              error,
            );
            await this.sleep(1000 * Math.pow(2, retryCount - 1)); // Exponential backoff
          } else {
            logger.error(
              `Batch ${batchIndex + 1} failed after ${maxRetries} retries:`,
              error,
            );
            throw error;
          }
        }
      }
    }
  }

  /**
   * Search for similar documents using vector similarity
   */
  async searchSimilar(
    queryEmbedding: number[],
    options: VectorSearchOptions = {},
  ): Promise<VectorSearchResult[]> {
    const {
      limit = 10,
      threshold = 0.7,
      metric = this.defaultMetric,
      includeMetadata = true,
      filters = {},
      pagination = {},
    } = options;

    try {
      let query = client`
        SELECT
          id, document_id, document_type, content, language,
          embedding_model, created_at, updated_at
      `;

      if (includeMetadata) {
        query = client`
          SELECT
            id, document_id, document_type, content, language,
            embedding_model, created_at, updated_at, metadata
        `;
      }

      const vectorString = `[${queryEmbedding.join(',')}]`;

      // Build query based on metric
      let similarityFunction;
      switch (metric) {
        case 'cosine':
          similarityFunction = client`1 - (embedding <=> ${client(vectorString)})`;
          break;
        case 'l2':
          similarityFunction = client`embedding <-> ${client(vectorString)}`;
          break;
        case 'inner_product':
          similarityFunction = client`(embedding <#> ${client(vectorString)})`;
          break;
        default:
          similarityFunction = client`1 - (embedding <=> ${client(vectorString)})`;
      }

      let finalQuery = query`
        FROM document_embeddings
        WHERE 1=1
      `;

      // Add filters
      if (filters.documentType?.length) {
        finalQuery = finalQuery`AND document_type = ANY(${filters.documentType})`;
      }

      if (filters.language?.length) {
        finalQuery = finalQuery`AND language = ANY(${filters.language})`;
      }

      if (filters.embeddingModel?.length) {
        finalQuery = finalQuery`AND embedding_model = ANY(${filters.embeddingModel})`;
      }

      if (filters.createdAfter) {
        finalQuery = finalQuery`AND created_at >= ${filters.createdAfter}`;
      }

      if (filters.createdBefore) {
        finalQuery = finalQuery`AND created_at <= ${filters.createdBefore}`;
      }

      // Add similarity threshold condition
      finalQuery = finalQuery`AND ${similarityFunction} >= ${threshold}`;

      // Complete the query
      const result = await client`
        ${finalQuery}
        ORDER BY ${similarityFunction} DESC
        LIMIT ${limit}
      `;

      return result.map((row: any) => ({
        id: row.id,
        documentId: row.document_id,
        documentType: row.document_type,
        content: row.content,
        language: row.language,
        similarity: parseFloat(row.similarity),
        metadata: includeMetadata ? row.metadata : undefined,
        embeddingModel: row.embedding_model,
        createdAt: row.created_at,
        confidence: row.metadata?.confidenceScore,
      }));
    } catch (error) {
      logger.error('Vector similarity search failed:', error);
      throw error;
    }
  }

  /**
   * Delete embeddings by document IDs
   */
  async deleteEmbeddings(documentIds: string[]): Promise<void> {
    try {
      await client`
        DELETE FROM document_embeddings
        WHERE document_id = ANY(${documentIds})
      `;
    } catch (error) {
      logger.error('Failed to delete embeddings:', error);
      throw error;
    }
  }

  /**
   * Get embedding statistics
   */
  async getStatistics(): Promise<{
    totalEmbeddings: number;
    embeddingsByType: Record<string, number>;
    embeddingsByLanguage: Record<string, number>;
    embeddingsByModel: Record<string, number>;
    averageEmbeddingDimension: number;
    oldestEmbedding?: Date;
    newestEmbedding?: Date;
  }> {
    try {
      const statsQuery = await client`
        SELECT
          COUNT(*) as total,
          document_type,
          language,
          embedding_model,
          created_at
        FROM document_embeddings
        GROUP BY document_type, language, embedding_model, created_at
        ORDER BY created_at DESC
      `;

      const totalEmbeddings = statsQuery.reduce(
        (sum, row) => sum + parseInt(row.total),
        0,
      );

      const embeddingsByType: Record<string, number> = {};
      const embeddingsByLanguage: Record<string, number> = {};
      const embeddingsByModel: Record<string, number> = {};

      statsQuery.forEach(row => {
        embeddingsByType[row.document_type] =
          (embeddingsByType[row.document_type] || 0) + parseInt(row.total);
        embeddingsByLanguage[row.language] =
          (embeddingsByLanguage[row.language] || 0) + parseInt(row.total);
        embeddingsByModel[row.embedding_model] =
          (embeddingsByModel[row.embedding_model] || 0) + parseInt(row.total);
      });

      const dates = statsQuery.map(row => row.created_at).filter(Boolean);
      const oldestEmbedding =
        dates.length > 0
          ? new Date(Math.min(...dates.map(d => new Date(d).getTime())))
          : undefined;
      const newestEmbedding =
        dates.length > 0
          ? new Date(Math.max(...dates.map(d => new Date(d).getTime())))
          : undefined;

      // Get average embedding dimension
      const dimensionQuery = await client`
        SELECT array_length(embedding, 1) as dim
        FROM document_embeddings
        WHERE embedding IS NOT NULL
        LIMIT 1000
      `;

      const dimensions = dimensionQuery
        .map(row => row.dim)
        .filter(Boolean);
      const averageEmbeddingDimension =
        dimensions.length > 0
          ? Math.round(
            dimensions.reduce((sum, dim) => sum + dim, 0) / dimensions.length,
          )
          : 0;

      return {
        totalEmbeddings,
        embeddingsByType,
        embeddingsByLanguage,
        embeddingsByModel,
        averageEmbeddingDimension,
        oldestEmbedding,
        newestEmbedding,
      };
    } catch (error) {
      logger.error('Failed to get embedding statistics:', error);
      throw error;
    }
  }

  /**
   * Create vector index for performance optimization
   */
  async createVectorIndex(config: VectorIndexConfig): Promise<void> {
    try {
      let indexQuery;

      if (config.type === 'ivfflat') {
        indexQuery = `CREATE INDEX IF NOT EXISTS ${config.name} ON document_embeddings USING ivfflat (embedding ${config.metric}_ops)`;
        if (config.lists) {
          indexQuery += ` WITH (lists = ${config.lists})`;
        }
      } else if (config.type === 'hnsw') {
        indexQuery = `CREATE INDEX IF NOT EXISTS ${config.name} ON document_embeddings USING hnsw (embedding ${config.metric}_ops)`;
        const hnswParams = [];
        if (config.m) hnswParams.push(`m = ${config.m}`);
        if (config.ef_construction)
          hnswParams.push(`ef_construction = ${config.ef_construction}`);
        if (hnswParams.length > 0) {
          indexQuery += ` WITH (${hnswParams.join(', ')})`;
        }
      } else {
        indexQuery = `CREATE INDEX IF NOT EXISTS ${config.name} ON document_embeddings`;
      }

      await client.unsafe(indexQuery);
      logger.info(`Created vector index: ${config.name}`);
    } catch (error) {
      logger.error('Failed to create vector index:', error);
      throw error;
    }
  }

  /**
   * Health check for vector database
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test pgvector extension
      await client`SELECT 1::vector`;

      // Test basic query
      await client`SELECT COUNT(*) FROM document_embeddings LIMIT 1`;

      return true;
    } catch (error) {
      logger.error('Vector database health check failed:', error);
      return false;
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    // postgres-js client is already managed by the main database configuration
    logger.info('Vector database manager closed');
  }

  // Private helper methods

  private async ensureTableExists(): Promise<void> {
    await client`
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_type VARCHAR(50) NOT NULL,
        document_id UUID NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536) NOT NULL,
        language VARCHAR(2) NOT NULL DEFAULT 'en',
        embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Create unique constraint
    await client`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_document_embeddings_unique
      ON document_embeddings (document_type, document_id);
    `;
  }

  private async ensureIndexesExist(): Promise<void> {
    // Basic indexes for filtering
    await client`
      CREATE INDEX IF NOT EXISTS idx_document_embeddings_type
      ON document_embeddings (document_type);
    `;

    await client`
      CREATE INDEX IF NOT EXISTS idx_document_embeddings_language
      ON document_embeddings (language);
    `;

    await client`
      CREATE INDEX IF NOT EXISTS idx_document_embeddings_model
      ON document_embeddings (embedding_model);
    `;

    await client`
      CREATE INDEX IF NOT EXISTS idx_document_embeddings_created_at
      ON document_embeddings (created_at DESC);
    `;

    // Vector indexes for similarity search (create based on data size)
    const countResult = await client`
      SELECT COUNT(*) as count FROM document_embeddings
    `;
    const count = parseInt(countResult[0].count);

    if (count > 1000) {
      await this.createVectorIndex({
        name: 'idx_document_embeddings_embedding_cosine',
        type: 'ivfflat',
        columns: ['embedding'],
        metric: 'cosine',
        lists: Math.min(count / 10, 1000),
      });
    }
  }

  private getSimilarityFunction(metric: SimilarityMetric): string {
    switch (metric) {
    case 'cosine':
      return 'cosine_similarity';
    case 'l2':
      return 'l2_distance';
    case 'inner_product':
      return 'inner_product';
    default:
      return 'cosine_similarity';
    }
  }

  private getSimilarityExpression(
    metric: SimilarityMetric,
    vectorParam: string,
  ): string {
    switch (metric) {
    case 'cosine':
      return `1 - (embedding <=> ${vectorParam})`;
    case 'l2':
      return `embedding <-> ${vectorParam}`;
    case 'inner_product':
      return `(embedding <#> ${vectorParam})`;
    default:
      return `1 - (embedding <=> ${vectorParam})`;
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
}

// Export singleton instance
export const vectorDatabaseManager = new VectorDatabaseManager();
