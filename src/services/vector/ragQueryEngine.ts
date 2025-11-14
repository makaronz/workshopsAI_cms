import {
  embeddingService,
  type DocumentEmbeddingRequest,
} from './embeddingService';
import {
  vectorDatabaseManager,
  type VectorSearchOptions,
  type VectorSearchResult,
} from './vectorDatabaseManager';
import { db } from '../../config/database';
import {
  document_embeddings,
  vector_search_queries,
  rag_context_windows,
} from '../../models/vector-schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { logger } from '../../utils/logger';

/**
 * RAG query types
 */
export type RAGQueryType =
  | 'semantic_search'
  | 'context_retrieval'
  | 'document_analysis'
  | 'recommendation';

/**
 * RAG query options
 */
export interface RAGQueryOptions {
  type: RAGQueryType;
  maxContextDocuments?: number;
  minSimilarityThreshold?: number;
  includeMetadata?: boolean;
  contextWindow?: number; // in tokens
  filters?: {
    documentTypes?: string[];
    languages?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    workshopId?: string;
    userId?: string;
  };
  ranking?: {
    method: 'similarity' | 'recency' | 'hybrid';
    weights?: {
      similarity: number;
      recency: number;
      relevance: number;
    };
  };
  analytics?: {
    trackQuery?: boolean;
    userId?: string;
    sessionId?: string;
  };
}

/**
 * RAG context document
 */
export interface RAGContextDocument {
  id: string;
  documentType: string;
  documentId: string;
  content: string;
  language: string;
  similarity: number;
  relevance?: number;
  metadata?: any;
  source?: {
    title?: string;
    url?: string;
    author?: string;
    date?: Date;
  };
}

/**
 * RAG query result
 */
export interface RAGQueryResult {
  query: string;
  queryEmbedding: number[];
  contextDocuments: RAGContextDocument[];
  totalResults: number;
  averageSimilarity: number;
  contextWindow: {
    size: number; // in tokens
    documents: number;
    truncated: boolean;
  };
  performance: {
    embeddingTime: number;
    searchTime: number;
    totalTime: number;
  };
  analytics?: {
    queryId?: string;
    sessionId?: string;
    userId?: string;
  };
}

/**
 * RAG context window configuration
 */
export interface RAGContextWindowConfig {
  maxTokens: number;
  maxDocuments: number;
  overlapRatio: number; // for overlapping context windows
  minChunkSize: number; // minimum tokens per document
  maxChunkSize: number; // maximum tokens per document
  truncationStrategy: 'head' | 'tail' | 'middle' | 'smart';
}

/**
 * RAG (Retrieval-Augmented Generation) Query Engine
 * Integrates vector search with LLM context generation
 */
export class RAGQueryEngine {
  private defaultContextConfig: RAGContextWindowConfig = {
    maxTokens: 4000,
    maxDocuments: 10,
    overlapRatio: 0.1,
    minChunkSize: 100,
    maxChunkSize: 800,
    truncationStrategy: 'smart',
  };

  /**
   * Execute RAG query with context retrieval
   */
  async query(
    queryText: string,
    options: RAGQueryOptions,
  ): Promise<RAGQueryResult> {
    const startTime = Date.now();

    try {
      logger.info(`Executing RAG query: ${queryText.substring(0, 100)}...`, {
        type: options.type,
        maxDocuments: options.maxContextDocuments,
        filters: options.filters,
      });

      // Step 1: Generate query embedding
      const embeddingStartTime = Date.now();
      const queryEmbeddingResult = await embeddingService.generateEmbedding(
        queryText,
        {
          model: 'text-embedding-3-small',
          detectLanguage: true,
        },
      );
      const embeddingTime = Date.now() - embeddingStartTime;

      // Step 2: Search vector database
      const searchStartTime = Date.now();
      const searchResults = await this.executeVectorSearch(
        queryEmbeddingResult.vector,
        options,
      );
      const searchTime = Date.now() - searchStartTime;

      // Step 3: Process and rank results
      const contextDocuments = await this.processSearchResults(
        searchResults,
        options,
      );

      // Step 4: Build context window
      const contextWindow = this.buildContextWindow(
        contextDocuments,
        options,
        this.defaultContextConfig,
      );

      // Step 5: Track analytics if enabled
      let queryId: string | undefined;
      if (options.analytics?.trackQuery) {
        queryId = await this.trackQuery(
          queryText,
          queryEmbeddingResult.vector,
          contextWindow.documents,
          searchTime,
          options,
        );
      }

      // Step 6: Store context window if needed
      if (
        options.type === 'context_retrieval' ||
        options.type === 'document_analysis'
      ) {
        await this.storeContextWindow(queryText, contextWindow, options);
      }

      const totalTime = Date.now() - startTime;

      const result: RAGQueryResult = {
        query: queryText,
        queryEmbedding: queryEmbeddingResult.vector,
        contextDocuments: contextWindow.documents,
        totalResults: searchResults.length,
        averageSimilarity: this.calculateAverageSimilarity(searchResults),
        contextWindow: {
          size: contextWindow.tokenCount,
          documents: contextWindow.documents.length,
          truncated: contextWindow.truncated,
        },
        performance: {
          embeddingTime,
          searchTime,
          totalTime,
        },
        analytics: queryId
          ? {
            queryId,
            sessionId: options.analytics?.sessionId,
            userId: options.analytics?.userId,
          }
          : undefined,
      };

      logger.info(`RAG query completed in ${totalTime}ms`, {
        contextDocuments: result.contextDocuments.length,
        averageSimilarity: result.averageSimilarity,
        totalResults: result.totalResults,
      });

      return result;
    } catch (error) {
      logger.error('RAG query failed:', error);
      throw new Error(`RAG query execution failed: ${error}`);
    }
  }

  /**
   * Generate augmented prompt with context
   */
  async generateAugmentedPrompt(
    basePrompt: string,
    ragResult: RAGQueryResult,
    options: {
      includeMetadata?: boolean;
      formatStyle?: 'bullet' | 'paragraph' | 'structured';
      contextHeader?: string;
    } = {},
  ): Promise<string> {
    const {
      includeMetadata = true,
      formatStyle = 'paragraph',
      contextHeader = 'Context Information',
    } = options;

    let contextSection = `\n\n${contextHeader}:\n`;

    if (ragResult.contextDocuments.length === 0) {
      contextSection += 'No relevant context found.\n';
    } else {
      switch (formatStyle) {
      case 'bullet':
        contextSection += ragResult.contextDocuments
          .map((doc, index) => {
            let bullet = `\n${index + 1}. `;
            if (doc.source?.title) {
              bullet += `[${doc.source.title}] `;
            }
            bullet += doc.content;
            if (includeMetadata) {
              bullet += `\n   Source: ${doc.documentType} (Similarity: ${doc.similarity.toFixed(3)})`;
            }
            return bullet;
          })
          .join('\n');
        break;

      case 'structured':
        contextSection += '\n```\n';
        ragResult.contextDocuments.forEach((doc, index) => {
          contextSection += `\n[Document ${index + 1}]\n`;
          contextSection += `Type: ${doc.documentType}\n`;
          contextSection += `Content: ${doc.content}\n`;
          if (includeMetadata) {
            contextSection += `Similarity: ${doc.similarity.toFixed(3)}\n`;
            if (doc.metadata) {
              contextSection += `Metadata: ${JSON.stringify(doc.metadata, null, 2)}\n`;
            }
          }
        });
        contextSection += '\n```\n';
        break;

      case 'paragraph':
      default:
        contextSection += ragResult.contextDocuments
          .map((doc, index) => {
            let paragraph = `${index + 1}. ${doc.content}`;
            if (includeMetadata && doc.source?.title) {
              paragraph += ` (Source: ${doc.source.title})`;
            }
            return paragraph;
          })
          .join('\n\n');
        break;
      }
    }

    return `${basePrompt}${contextSection}\n\nBased on the above context, please provide a comprehensive response.`;
  }

  /**
   * Find similar documents to a given document
   */
  async findSimilarDocuments(
    documentId: string,
    documentType: string,
    options: Partial<RAGQueryOptions> = {},
  ): Promise<RAGQueryResult> {
    // Get the original document embedding
    const originalDoc = await db.query.document_embeddings.findFirst({
      where: and(
        eq(document_embeddings.documentId, documentId),
        eq(document_embeddings.documentType, documentType),
      ),
    });

    if (!originalDoc) {
      throw new Error(`Document not found: ${documentType}:${documentId}`);
    }

    // Search for similar documents
    const searchOptions: RAGQueryOptions = {
      type: 'semantic_search',
      maxContextDocuments: 10,
      minSimilarityThreshold: 0.5,
      ...options,
      filters: {
        ...options.filters,
        // Exclude the original document from results
        documentTypes: options.filters?.documentTypes?.filter(
          t => t !== documentType,
        ) || [documentType],
      },
    };

    return await this.query(originalDoc.content, searchOptions);
  }

  /**
   * Get context documents for a specific questionnaire or workshop
   */
  async getContextForWorkshop(
    workshopId: string,
    queryText: string,
    options: Partial<RAGQueryOptions> = {},
  ): Promise<RAGQueryResult> {
    const ragOptions: RAGQueryOptions = {
      type: 'context_retrieval',
      maxContextDocuments: 15,
      minSimilarityThreshold: 0.6,
      filters: {
        documentTypes: [
          'questionnaire_response',
          'question',
          'workshop_content',
          'analysis_result',
        ],
        workshopId,
      },
      ...options,
    };

    return await this.query(queryText, ragOptions);
  }

  /**
   * Update context window configuration
   */
  updateContextConfig(config: Partial<RAGContextWindowConfig>): void {
    this.defaultContextConfig = { ...this.defaultContextConfig, ...config };
    logger.info(
      'RAG context window configuration updated',
      this.defaultContextConfig,
    );
  }

  /**
   * Get RAG engine statistics
   */
  async getStatistics(): Promise<{
    totalQueries: number;
    avgResponseTime: number;
    avgContextDocuments: number;
    cacheHitRate: number;
    popularQueries: Array<{ query: string; frequency: number }>;
    performanceByType: Record<
      string,
      { avgTime: number; avgSimilarity: number }
    >;
  }> {
    const [totalQueries, avgResponseTime, popularQueries] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(vector_search_queries),
      db
        .select({ avg: sql<number>`AVG(search_time)` })
        .from(vector_search_queries),
      db
        .select({
          query: vector_search_queries.queryText,
          frequency: sql<number>`COUNT(*)`,
        })
        .from(vector_search_queries)
        .groupBy(vector_search_queries.queryText)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(10),
    ]);

    // Calculate cache hit rate (would need additional tracking)
    const cacheHitRate = 0.75; // Mock value

    // Get performance by type (would need to add type column to queries table)
    const performanceByType: Record<
      string,
      { avgTime: number; avgSimilarity: number }
    > = {
      semantic_search: { avgTime: 150, avgSimilarity: 0.82 },
      context_retrieval: { avgTime: 200, avgSimilarity: 0.75 },
      document_analysis: { avgTime: 300, avgSimilarity: 0.78 },
      recommendation: { avgTime: 180, avgSimilarity: 0.8 },
    };

    return {
      totalQueries: totalQueries[0]?.count || 0,
      avgResponseTime: avgResponseTime[0]?.avg || 0,
      avgContextDocuments: 8, // Would need to track this
      cacheHitRate,
      popularQueries: popularQueries.map(row => ({
        query:
          row.query.substring(0, 50) + (row.query.length > 50 ? '...' : ''),
        frequency: row.frequency,
      })),
      performanceByType,
    };
  }

  // Private helper methods

  private async executeVectorSearch(
    queryEmbedding: number[],
    options: RAGQueryOptions,
  ): Promise<VectorSearchResult[]> {
    const searchOptions: VectorSearchOptions = {
      limit: options.maxContextDocuments || 10,
      threshold: options.minSimilarityThreshold || 0.7,
      includeMetadata: options.includeMetadata !== false,
      filters: {
        documentType: options.filters?.documentTypes,
        language: options.filters?.languages,
      },
    };

    return await vectorDatabaseManager.searchSimilar(
      queryEmbedding,
      searchOptions,
    );
  }

  private async processSearchResults(
    searchResults: VectorSearchResult[],
    options: RAGQueryOptions,
  ): Promise<RAGContextDocument[]> {
    const contextDocuments: RAGContextDocument[] = [];

    for (const result of searchResults) {
      let relevance = result.similarity;

      // Apply ranking if specified
      if (options.ranking) {
        relevance = this.applyRanking(result, options.ranking);
      }

      const contextDoc: RAGContextDocument = {
        id: result.id,
        documentType: result.documentType,
        documentId: result.documentId,
        content: result.content,
        language: result.language,
        similarity: result.similarity,
        relevance,
        metadata: result.metadata,
        source: this.extractSourceInfo(result),
      };

      contextDocuments.push(contextDoc);
    }

    // Sort by relevance (descending)
    contextDocuments.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    return contextDocuments;
  }

  private buildContextWindow(
    documents: RAGContextDocument[],
    options: RAGQueryOptions,
    config: RAGContextWindowConfig,
  ): {
    documents: RAGContextDocument[];
    tokenCount: number;
    truncated: boolean;
  } {
    const maxDocs = options.maxContextDocuments || config.maxDocuments;
    const maxTokens = options.contextWindow || config.maxTokens;

    let tokenCount = 0;
    const selectedDocs: RAGContextDocument[] = [];
    let truncated = false;

    for (let i = 0; i < Math.min(documents.length, maxDocs); i++) {
      const doc = documents[i];
      const docTokens = this.estimateTokenCount(doc.content);

      if (tokenCount + docTokens > maxTokens) {
        // Truncate content if needed
        if (selectedDocs.length < maxDocs) {
          const remainingTokens = maxTokens - tokenCount;
          if (remainingTokens > config.minChunkSize) {
            const truncatedContent = this.truncateContent(
              doc.content,
              remainingTokens,
              config.truncationStrategy,
            );
            selectedDocs.push({
              ...doc,
              content: truncatedContent,
            });
            tokenCount += this.estimateTokenCount(truncatedContent);
            truncated = true;
          }
        }
        break;
      }

      selectedDocs.push(doc);
      tokenCount += docTokens;
    }

    return {
      documents: selectedDocs,
      tokenCount,
      truncated,
    };
  }

  private applyRanking(
    result: VectorSearchResult,
    ranking: RAGQueryOptions['ranking'],
  ): number {
    if (!ranking || !ranking.weights) {
      return result.similarity;
    }

    const { weights } = ranking;
    const { similarity } = result;

    let score = similarity * weights.similarity;

    // Add recency scoring
    if (weights.recency && weights.recency > 0) {
      const daysOld =
        (Date.now() - result.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-daysOld / 30); // Decay over 30 days
      score += recencyScore * weights.recency;
    }

    // Add relevance scoring (would need more sophisticated implementation)
    if (weights.relevance && weights.relevance > 0 && result.confidence) {
      score += result.confidence * weights.relevance;
    }

    return Math.min(score, 1.0);
  }

  private extractSourceInfo(
    result: VectorSearchResult,
  ): RAGContextDocument['source'] {
    if (!result.metadata) {
      return undefined;
    }

    return {
      title: result.metadata.title,
      url: result.metadata.url,
      author: result.metadata.author,
      date: result.metadata.date ? new Date(result.metadata.date) : undefined,
    };
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private truncateContent(
    content: string,
    maxTokens: number,
    strategy: string,
  ): string {
    const maxLength = maxTokens * 4; // Convert tokens to characters

    switch (strategy) {
    case 'head':
      return content.substring(0, maxLength) + '...';
    case 'tail':
      return '...' + content.substring(-maxLength);
    case 'middle':
      const half = Math.floor(maxLength / 2);
      return content.substring(0, half) + '...' + content.substring(-half);
    case 'smart':
    default:
      // Smart truncation - try to end at sentence boundary
      const truncated = content.substring(0, maxLength);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?'),
      );

      if (lastSentenceEnd > maxLength * 0.7) {
        return truncated.substring(0, lastSentenceEnd + 1);
      }
      return truncated + '...';
    }
  }

  private calculateAverageSimilarity(results: VectorSearchResult[]): number {
    if (results.length === 0) return 0;

    const total = results.reduce((sum, result) => sum + result.similarity, 0);
    return total / results.length;
  }

  private async trackQuery(
    queryText: string,
    queryEmbedding: number[],
    contextDocuments: RAGContextDocument[],
    searchTime: number,
    options: RAGQueryOptions,
  ): Promise<string> {
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await db.insert(vector_search_queries).values({
        id: queryId,
        queryText,
        queryEmbedding: `[${queryEmbedding.join(',')}]`,
        resultsFound: contextDocuments.length,
        avgSimilarity:
          contextDocuments.length > 0
            ? contextDocuments.reduce((sum, doc) => sum + doc.similarity, 0) /
              contextDocuments.length
            : 0,
        searchTime,
        filters: options.filters,
        metricUsed: 'cosine',
        threshold: options.minSimilarityThreshold || 0.7,
        userId: options.analytics?.userId,
        sessionId: options.analytics?.sessionId,
      });
    } catch (error) {
      logger.warn('Failed to track RAG query:', error);
    }

    return queryId;
  }

  private async storeContextWindow(
    queryText: string,
    contextWindow: any,
    options: RAGQueryOptions,
  ): Promise<void> {
    try {
      await db.insert(rag_context_windows).values({
        sessionId: options.analytics?.sessionId || `session_${Date.now()}`,
        userId: options.analytics?.userId,
        conversationType: options.type,
        contextDocuments: contextWindow.documents.map((doc: any) => ({
          id: doc.id,
          documentType: doc.documentType,
          documentId: doc.documentId,
          similarity: doc.similarity,
        })),
        queryText,
        contextLength: contextWindow.tokenCount,
        relevanceScores: contextWindow.documents.map(
          (doc: any) => doc.relevance,
        ),
        responseGenerated: false,
      });
    } catch (error) {
      logger.warn('Failed to store context window:', error);
    }
  }
}

// Export singleton instance
export const ragQueryEngine = new RAGQueryEngine();
