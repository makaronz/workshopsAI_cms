import {
  ragQueryEngine,
  type RAGQueryOptions,
  type RAGQueryResult,
} from './ragQueryEngine';
import { embeddingService } from './embeddingService';
import {
  vectorDatabaseManager,
  type VectorSearchOptions,
} from './vectorDatabaseManager';
import { db } from '../../config/database';
import {
  document_embeddings,
  vector_search_queries,
} from '../../models/vector-schema';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { logger } from '../../utils/logger';

/**
 * Search query types
 */
export type SearchQueryType =
  | 'semantic'
  | 'hybrid'
  | 'filtered'
  | 'multilingual';

/**
 * Search result types
 */
export type SearchResultType =
  | 'all'
  | 'questionnaire_response'
  | 'question'
  | 'workshop_content'
  | 'analysis_result'
  | 'user_profile';

/**
 * Advanced search filters
 */
export interface AdvancedSearchFilters {
  documentTypes?: SearchResultType[];
  languages?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  workshopId?: string;
  userId?: string;
  confidenceRange?: {
    min: number;
    max: number;
  };
  textFilters?: {
    includeTerms?: string[];
    excludeTerms?: string[];
    exactPhrase?: string;
  };
  metadataFilters?: Record<string, any>;
}

/**
 * Search pagination options
 */
export interface SearchPagination {
  limit?: number;
  offset?: number;
  cursor?: string;
  sortBy?: 'relevance' | 'date' | 'confidence';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search analytics
 */
export interface SearchAnalytics {
  queryId: string;
  queryText: string;
  resultCount: number;
  averageSimilarity: number;
  searchTime: number;
  filters: AdvancedSearchFilters;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
}

/**
 * Semantic search result with enhanced metadata
 */
export interface SemanticSearchResult {
  id: string;
  documentId: string;
  documentType: string;
  content: string;
  language: string;
  similarity: number;
  relevance: number;
  confidence: number;
  highlights: string[];
  metadata: {
    title?: string;
    author?: string;
    createdAt: Date;
    updatedAt?: Date;
    workshopId?: string;
    userId?: string;
    tags?: string[];
    categories?: string[];
    [key: string]: any;
  };
}

/**
 * Semantic search response
 */
export interface SemanticSearchResponse {
  query: string;
  queryType: SearchQueryType;
  results: SemanticSearchResult[];
  totalResults: number;
  searchTime: number;
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    limit: number;
    offset: number;
  };
  facets: {
    documentTypes: Record<string, number>;
    languages: Record<string, number>;
    dateRanges: Record<string, number>;
  };
  suggestions?: string[];
  analytics?: SearchAnalytics;
}

/**
 * Advanced Semantic Search Service
 * Provides comprehensive search capabilities with filtering, pagination, and analytics
 */
export class SemanticSearchService {
  private defaultPagination: SearchPagination = {
    limit: 20,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  };

  /**
   * Perform semantic search with advanced options
   */
  async search(
    query: string,
    options: {
      type?: SearchQueryType;
      resultTypes?: SearchResultType[];
      filters?: AdvancedSearchFilters;
      pagination?: SearchPagination;
      includeFacets?: boolean;
      includeHighlights?: boolean;
      includeSuggestions?: boolean;
      trackAnalytics?: boolean;
      userId?: string;
      sessionId?: string;
    } = {},
  ): Promise<SemanticSearchResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Executing semantic search: ${query.substring(0, 100)}...`, {
        type: options.type,
        resultTypes: options.resultTypes,
        filters: options.filters,
      });

      // Build RAG query options
      const ragOptions: RAGQueryOptions = {
        type: this.mapSearchTypeToRAGType(options.type || 'semantic'),
        maxContextDocuments:
          options.pagination?.limit || this.defaultPagination.limit!,
        minSimilarityThreshold: 0.5,
        includeMetadata: true,
        filters: this.buildSearchFilters(options),
        ranking: {
          method: 'similarity',
          weights: {
            similarity: 0.7,
            recency: 0.2,
            relevance: 0.1,
          },
        },
        analytics: {
          trackQuery: options.trackAnalytics !== false,
          userId: options.userId,
          sessionId: options.sessionId,
        },
      };

      // Execute search
      const ragResult = await ragQueryEngine.query(query, ragOptions);

      // Process and enhance results
      const enhancedResults = await this.enhanceSearchResults(
        ragResult.contextDocuments,
        {
          includeHighlights: options.includeHighlights !== false,
          includeMetadata: true,
        },
      );

      // Generate facets if requested
      const facets =
        options.includeFacets !== false
          ? await this.generateSearchFacets(enhancedResults)
          : { documentTypes: {}, languages: {}, dateRanges: {} };

      // Generate suggestions if requested
      const suggestions = options.includeSuggestions
        ? await this.generateSearchSuggestions(query, enhancedResults)
        : undefined;

      const searchTime = Date.now() - startTime;

      const response: SemanticSearchResponse = {
        query,
        queryType: options.type || 'semantic',
        results: enhancedResults,
        totalResults: ragResult.totalResults,
        searchTime,
        pagination: {
          hasMore:
            (options.pagination?.offset || 0) + enhancedResults.length <
            ragResult.totalResults,
          limit: options.pagination?.limit || this.defaultPagination.limit!,
          offset: options.pagination?.offset || 0,
        },
        facets,
        suggestions,
        analytics: ragResult.analytics
          ? {
            queryId: ragResult.analytics.queryId!,
            queryText: query,
            resultCount: enhancedResults.length,
            averageSimilarity: ragResult.averageSimilarity,
            searchTime,
            filters: options.filters || {},
            userId: options.userId,
            sessionId: options.sessionId,
            timestamp: new Date(),
          }
          : undefined,
      };

      logger.info(`Semantic search completed in ${searchTime}ms`, {
        resultsFound: enhancedResults.length,
        totalResults: ragResult.totalResults,
        averageSimilarity: ragResult.averageSimilarity,
      });

      return response;
    } catch (error) {
      logger.error('Semantic search failed:', error);
      throw new Error(`Semantic search execution failed: ${error}`);
    }
  }

  /**
   * Search within a specific document type
   */
  async searchByDocumentType(
    query: string,
    documentType: SearchResultType,
    options: {
      filters?: Omit<AdvancedSearchFilters, 'documentTypes'>;
      pagination?: SearchPagination;
    } = {},
  ): Promise<SemanticSearchResponse> {
    return await this.search(query, {
      resultTypes: [documentType],
      filters: options.filters,
      pagination: options.pagination,
    });
  }

  /**
   * Multilingual search with automatic language detection
   */
  async multilingualSearch(
    query: string,
    targetLanguages: string[] = ['en', 'pl'],
    options: {
      translateQuery?: boolean;
      preferOriginalLanguage?: boolean;
      filters?: AdvancedSearchFilters;
      pagination?: SearchPagination;
    } = {},
  ): Promise<SemanticSearchResponse> {
    // Detect query language
    const languageDetection = await embeddingService.detectLanguage(query);

    // Prepare search with multilingual options
    const filters: AdvancedSearchFilters = {
      ...options.filters,
      languages: targetLanguages,
    };

    return await this.search(query, {
      type: 'multilingual',
      filters,
      pagination: options.pagination,
      includeFacets: true,
    });
  }

  /**
   * Hybrid search combining semantic and keyword search
   */
  async hybridSearch(
    semanticQuery: string,
    keywordQuery?: string,
    options: {
      semanticWeight?: number; // 0-1
      keywordWeight?: number; // 0-1
      filters?: AdvancedSearchFilters;
      pagination?: SearchPagination;
    } = {},
  ): Promise<SemanticSearchResponse> {
    const { semanticWeight = 0.7, keywordWeight = 0.3 } = options;

    // Execute semantic search
    const semanticResults = await this.search(semanticQuery, {
      type: 'semantic',
      filters: options.filters,
      pagination: {
        ...options.pagination,
        limit: (options.pagination?.limit || 20) * 2,
      },
    });

    let finalResults = semanticResults.results;

    // If keyword query provided, execute keyword search and merge results
    if (keywordQuery) {
      const keywordResults = await this.keywordSearch(keywordQuery, {
        filters: options.filters,
        pagination: options.pagination,
      });

      // Merge and re-rank results
      finalResults = this.mergeSemanticAndKeywordResults(
        semanticResults.results,
        keywordResults,
        semanticWeight,
        keywordWeight,
      );
    }

    return {
      ...semanticResults,
      results: finalResults.slice(0, options.pagination?.limit || 20),
      totalResults: Math.min(
        semanticResults.totalResults,
        options.pagination?.limit || 20,
      ),
    };
  }

  /**
   * Get search suggestions and autocomplete
   */
  async getSearchSuggestions(
    partialQuery: string,
    options: {
      maxSuggestions?: number;
      includeHistory?: boolean;
      userId?: string;
    } = {},
  ): Promise<string[]> {
    const { maxSuggestions = 10, includeHistory = true, userId } = options;

    const suggestions: string[] = [];

    // Get suggestions from search history
    if (includeHistory && userId) {
      const historySuggestions = await this.getHistoricalSuggestions(
        partialQuery,
        userId,
        5,
      );
      suggestions.push(...historySuggestions);
    }

    // Get suggestions from document content
    const contentSuggestions = await this.getContentBasedSuggestions(
      partialQuery,
      5,
    );
    suggestions.push(...contentSuggestions);

    // Remove duplicates and limit
    const uniqueSuggestions = [...new Set(suggestions)];
    return uniqueSuggestions.slice(0, maxSuggestions);
  }

  /**
   * Get popular search terms and trends
   */
  async getSearchTrends(
    options: {
      timeRange?: { start: Date; end: Date };
      limit?: number;
      userId?: string;
    } = {},
  ): Promise<
    Array<{
      query: string;
      frequency: number;
      avgResults: number;
      trend: 'up' | 'down' | 'stable';
    }>
  > {
    const { timeRange, limit = 20, userId } = options;

    // This would query the search analytics table
    // For now, return mock data
    return [
      {
        query: 'workshop feedback',
        frequency: 45,
        avgResults: 12,
        trend: 'up',
      },
      {
        query: 'participant experience',
        frequency: 38,
        avgResults: 8,
        trend: 'stable',
      },
      {
        query: 'facilitator training',
        frequency: 32,
        avgResults: 15,
        trend: 'up',
      },
      {
        query: 'conflict resolution',
        frequency: 28,
        avgResults: 10,
        trend: 'down',
      },
      {
        query: 'team building',
        frequency: 25,
        avgResults: 14,
        trend: 'stable',
      },
    ];
  }

  /**
   * Get user search history
   */
  async getUserSearchHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      includeAnalytics?: boolean;
    } = {},
  ): Promise<
    Array<{
      query: string;
      timestamp: Date;
      resultCount: number;
      averageSimilarity: number;
    }>
  > {
    const { limit = 50, offset = 0 } = options;

    // Query search history from database
    const history = await db.query.vector_search_queries.findMany({
      where: eq(vector_search_queries.userId, userId),
      orderBy: [desc(vector_search_queries.createdAt)],
      limit,
      offset,
    });

    return history.map(item => ({
      query: item.queryText,
      timestamp: item.createdAt,
      resultCount: item.resultsFound || 0,
      averageSimilarity: item.avgSimilarity || 0,
    }));
  }

  // Private helper methods

  private mapSearchTypeToRAGType(type: SearchQueryType): RAGQueryType {
    switch (type) {
    case 'semantic':
    case 'multilingual':
      return 'semantic_search';
    case 'hybrid':
      return 'context_retrieval';
    case 'filtered':
      return 'document_analysis';
    default:
      return 'semantic_search';
    }
  }

  private buildSearchFilters(options: any): any {
    const filters: any = {};

    if (options.resultTypes?.length) {
      filters.documentTypes = options.resultTypes;
    }

    if (options.filters?.languages?.length) {
      filters.languages = options.filters.languages;
    }

    if (options.filters?.dateRange) {
      filters.dateRange = options.filters.dateRange;
    }

    if (options.filters?.workshopId) {
      filters.workshopId = options.filters.workshopId;
    }

    if (options.filters?.userId) {
      filters.userId = options.filters.userId;
    }

    return filters;
  }

  private async enhanceSearchResults(
    documents: any[],
    options: {
      includeHighlights?: boolean;
      includeMetadata?: boolean;
    } = {},
  ): Promise<SemanticSearchResult[]> {
    const enhanced: SemanticSearchResult[] = [];

    for (const doc of documents) {
      const result: SemanticSearchResult = {
        id: doc.id,
        documentId: doc.documentId,
        documentType: doc.documentType,
        content: doc.content,
        language: doc.language,
        similarity: doc.similarity,
        relevance: doc.relevance || doc.similarity,
        confidence: doc.confidence || 0.8,
        highlights: options.includeHighlights
          ? this.generateHighlights(doc.content)
          : [],
        metadata: {
          createdAt: new Date(),
          ...doc.metadata,
        },
      };

      enhanced.push(result);
    }

    return enhanced;
  }

  private generateHighlights(content: string): string[] {
    // Simple highlight generation - can be enhanced
    const sentences = content.split(/[.!?]+/);
    return sentences
      .filter(s => s.trim().length > 20)
      .slice(0, 3)
      .map(s => s.trim());
  }

  private async generateSearchFacets(results: SemanticSearchResult[]): Promise<{
    documentTypes: Record<string, number>;
    languages: Record<string, number>;
    dateRanges: Record<string, number>;
  }> {
    const facets = {
      documentTypes: {} as Record<string, number>,
      languages: {} as Record<string, number>,
      dateRanges: {} as Record<string, number>,
    };

    for (const result of results) {
      // Document type facet
      facets.documentTypes[result.documentType] =
        (facets.documentTypes[result.documentType] || 0) + 1;

      // Language facet
      facets.languages[result.language] =
        (facets.languages[result.language] || 0) + 1;

      // Date range facet
      const dateRange = this.getDateRange(result.metadata.createdAt);
      facets.dateRanges[dateRange] = (facets.dateRanges[dateRange] || 0) + 1;
    }

    return facets;
  }

  private async generateSearchSuggestions(
    query: string,
    results: SemanticSearchResult[],
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Extract keywords from top results
    for (const result of results.slice(0, 5)) {
      const keywords = this.extractKeywords(result.content);
      suggestions.push(...keywords);
    }

    // Remove duplicates and return
    return [...new Set(suggestions)].slice(0, 5);
  }

  private async keywordSearch(
    query: string,
    options: {
      filters?: AdvancedSearchFilters;
      pagination?: SearchPagination;
    } = {},
  ): Promise<SemanticSearchResult[]> {
    // Implement keyword search using PostgreSQL text search
    // This is a simplified implementation
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT
          id, document_id, document_type, content, language,
          ts_rank(to_tsvector('english', content), plainto_tsquery($1)) as rank
        FROM document_embeddings
        WHERE to_tsvector('english', content) @@ plainto_tsquery($1)
        ORDER BY rank DESC
        LIMIT $2
      `,
        [query, options.pagination?.limit || 20],
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        documentId: row.document_id,
        documentType: row.document_type,
        content: row.content,
        language: row.language,
        similarity: row.rank,
        relevance: row.rank,
        confidence: 0.7,
        highlights: [],
        metadata: {
          createdAt: new Date(),
        },
      }));
    } finally {
      client.release();
    }
  }

  private mergeSemanticAndKeywordResults(
    semanticResults: SemanticSearchResult[],
    keywordResults: SemanticSearchResult[],
    semanticWeight: number,
    keywordWeight: number,
  ): SemanticSearchResult[] {
    const combinedResults = new Map<string, SemanticSearchResult>();

    // Add semantic results
    for (const result of semanticResults) {
      combinedResults.set(result.id, {
        ...result,
        relevance: result.similarity * semanticWeight,
      });
    }

    // Add or merge keyword results
    for (const result of keywordResults) {
      const existing = combinedResults.get(result.id);
      if (existing) {
        existing.relevance = Math.max(
          existing.relevance,
          result.similarity * keywordWeight,
        );
      } else {
        combinedResults.set(result.id, {
          ...result,
          relevance: result.similarity * keywordWeight,
        });
      }
    }

    // Sort by combined relevance and return
    return Array.from(combinedResults.values()).sort(
      (a, b) => b.relevance - a.relevance,
    );
  }

  private async getHistoricalSuggestions(
    partialQuery: string,
    userId: string,
    limit: number,
  ): Promise<string[]> {
    // Get similar queries from user's search history
    const history = await db.query.vector_search_queries.findMany({
      where: and(
        eq(vector_search_queries.userId, userId),
        sql`query_text ILIKE ${'%' + partialQuery + '%'}`,
      ),
      orderBy: [desc(vector_search_queries.createdAt)],
      limit,
    });

    return history.map(item => item.queryText);
  }

  private async getContentBasedSuggestions(
    partialQuery: string,
    limit: number,
  ): Promise<string[]> {
    // Get suggestions based on document content
    // This is a simplified implementation
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT DISTINCT
          LEFT(content, 100) as suggestion
        FROM document_embeddings
        WHERE content ILIKE ${'%' + partialQuery + '%'}
        LIMIT $1
      `,
        [limit],
      );

      return result.rows.map((row: any) => row.suggestion);
    } finally {
      client.release();
    }
  }

  private getDateRange(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 7) return 'Last 7 days';
    if (diffDays < 30) return 'Last 30 days';
    if (diffDays < 90) return 'Last 90 days';
    return 'Older';
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Count word frequency
    const wordCount = new Map<string, number>();
    for (const word of words) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }

    // Return top keywords
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService();
