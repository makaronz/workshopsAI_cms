/**
 * Vector Database Services Export
 * Comprehensive RAG (Retrieval-Augmented Generation) functionality for workshopsAI CMS
 */

export { VectorDatabaseManager } from './vectorDatabaseManager';
export { vectorDatabaseManager } from './vectorDatabaseManager';

export { EmbeddingService } from './embeddingService';
export { embeddingService } from './embeddingService';
export type {
  EmbeddingModel,
  EmbeddingResult,
  BatchEmbeddingOptions,
  DocumentEmbeddingRequest,
  LanguageDetection,
} from './embeddingService';

export { RAGQueryEngine } from './ragQueryEngine';
export { ragQueryEngine } from './ragQueryEngine';
export type {
  RAGQueryType,
  RAGQueryOptions,
  RAGContextDocument,
  RAGQueryResult,
  RAGContextWindowConfig,
} from './ragQueryEngine';

export { VectorIndexManager } from './vectorIndexManager';
export { vectorIndexManager } from './vectorIndexManager';
export type {
  VectorIndexConfig,
  IndexPerformanceMetrics,
  IndexOptimizationRecommendation,
  IndexHealthStatus,
} from './vectorIndexManager';

export { SemanticSearchService } from './semanticSearchService';
export { semanticSearchService } from './semanticSearchService';
export type {
  SearchQueryType,
  SearchResultType,
  AdvancedSearchFilters,
  SearchPagination,
  SemanticSearchResult,
  SemanticSearchResponse,
  SearchAnalytics,
} from './semanticSearchService';

// Re-export vector schema types
export type {
  DocumentEmbedding,
  InsertDocumentEmbedding,
  VectorSearchQuery,
  InsertVectorSearchQuery,
  EmbeddingCache,
  InsertEmbeddingCache,
  VectorIndexConfig as DBVectorIndexConfig,
  InsertVectorIndexConfig,
  RAGContextWindow,
  InsertRAGContextWindow,
} from '../../models/vector-schema';

/**
 * Initialize all vector services
 * Call this during application startup
 */
export async function initializeVectorServices(): Promise<void> {
  try {
    console.log('Initializing vector database services...');

    // Initialize vector database manager first
    await vectorDatabaseManager.initialize();

    // Initialize vector index manager
    await vectorIndexManager.initialize();

    // Perform health checks
    const [dbHealth, embeddingHealth] = await Promise.all([
      vectorDatabaseManager.healthCheck(),
      embeddingService.healthCheck(),
    ]);

    if (dbHealth && embeddingHealth.openai) {
      console.log('✅ Vector services initialized successfully');
    } else {
      console.warn('⚠️ Vector services initialized with warnings:', {
        database: dbHealth ? 'OK' : 'FAILED',
        embedding: embeddingHealth.openai ? 'OK' : 'FAILED',
      });
    }
  } catch (error) {
    console.error('❌ Failed to initialize vector services:', error);
    throw error;
  }
}

/**
 * Shutdown vector services gracefully
 * Call this during application shutdown
 */
export async function shutdownVectorServices(): Promise<void> {
  try {
    console.log('Shutting down vector services...');

    await vectorIndexManager.shutdown();
    await vectorDatabaseManager.close();

    console.log('✅ Vector services shutdown completed');
  } catch (error) {
    console.error('❌ Failed to shutdown vector services:', error);
    throw error;
  }
}
