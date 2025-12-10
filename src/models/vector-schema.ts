import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  decimal,
  jsonb,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Document type enumeration
 */
export const documentTypeEnum = pgEnum('documentType', [
  'questionnaire_response',
  'question',
  'workshop_content',
  'analysis_result',
  'user_profile',
  'feedback',
  'announcement',
  'template',
  'module',
]);

/**
 * Language enumeration
 */
export const languageEnum = pgEnum('language', [
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
]);

/**
 * Embedding model enumeration
 */
export const embeddingModelEnum = pgEnum('embeddingModel', [
  'text-embedding-3-small',
  'text-embedding-3-large',
  'text-embedding-ada-002',
  'multilingual-e5-large',
  'paraphrase-multilingual-mpnet-base-v2',
]);

/**
 * Document embeddings table - core vector storage for RAG
 */
export const document_embeddings = pgTable(
  'document_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentType: documentTypeEnum('documentType').notNull(),
    documentId: uuid('documentId').notNull(),
    content: text('content').notNull(),
    vectorIndex: decimal('vectorIndex', { precision: 10, scale: 0 }).notNull().default('0'), // Index in external vector DB
    language: languageEnum('language').notNull().default('en'),
    embeddingModel: embeddingModelEnum('embeddingModel')
      .notNull()
      .default('text-embedding-3-small'),
    dimensions: decimal('dimensions', { precision: 10, scale: 0 }).notNull().default('1536'), // 1536, 384, etc.
    metadata: jsonb('metadata'),
    provider: text('provider').notNull().default('openai'), // openai, anthropic, local
    confidenceScore: decimal('confidenceScore', { precision: 3, scale: 2 }).default('0.80').notNull(),
    checksum: text('checksum'), // For content integrity verification
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint on document type and ID
    documentTypeIdx: index('idx_document_embeddings_type').on(
      table.documentType,
    ),
    documentIdIdx: index('idx_document_embeddings_id').on(table.documentId),
    documentUniqueIdx: index('idx_document_embeddings_unique')
      .on(table.documentType, table.documentId),

    // Language and model indexes for filtering
    languageIdx: index('idx_document_embeddings_language').on(table.language),
    embeddingModelIdx: index('idx_document_embeddings_model').on(
      table.embeddingModel,
    ),

    // Time-based indexes
    createdAtIdx: index('idx_document_embeddings_created_at').on(
      table.createdAt,
    ),
    updatedAtIdx: index('idx_document_embeddings_updated_at').on(
      table.updatedAt,
    ),

    // Additional indexes for optimization
    providerIdx: index('idx_document_embeddings_provider').on(table.provider),
    checksumIdx: index('idx_document_embeddings_checksum').on(table.checksum),
  }),
);

export type DocumentEmbedding = typeof document_embeddings.$inferSelect;
export type InsertDocumentEmbedding = typeof document_embeddings.$inferInsert;

/**
 * Vector search queries table - for analytics and optimization
 */
export const vector_search_queries = pgTable(
  'vector_search_queries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    queryText: text('queryText').notNull(),
    queryVectorIndex: decimal('queryVectorIndex', { precision: 10, scale: 0 }).notNull(), // Index in external vector DB
    resultsFound: decimal('resultsFound', { precision: 10, scale: 0 }).notNull().default('0'),
    avgSimilarity: decimal('avgSimilarity', { precision: 3, scale: 3 }).default('0.000'), // 0.000 to 1.000
    searchTime: decimal('searchTime', { precision: 10, scale: 3 }).default('0.000'), // in milliseconds
    filters: jsonb('filters'),
    metricUsed: text('metricUsed').notNull().default('cosine'),
    threshold: decimal('threshold', { precision: 3, scale: 2 }).notNull().default('0.70'),
    embeddingModel: embeddingModelEnum('embeddingModel').notNull(),
    userId: uuid('userId'),
    sessionId: text('sessionId'),
    userAgent: text('userAgent'),
    ipAddress: text('ipAddress'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_vector_search_queries_user_id').on(table.userId),
    sessionIdIdx: index('idx_vector_search_queries_session_id').on(
      table.sessionId,
    ),
    createdAtIdx: index('idx_vector_search_queries_created_at').on(
      table.createdAt,
    ),
    searchTimeIdx: index('idx_vector_search_queries_search_time').on(
      table.searchTime,
    ),
    embeddingModelIdx: index('idx_vector_search_queries_model').on(
      table.embeddingModel,
    ),
  }),
);

export type VectorSearchQuery = typeof vector_search_queries.$inferSelect;
export type InsertVectorSearchQuery = typeof vector_search_queries.$inferInsert;

/**
 * Embedding cache table - for caching frequently used embeddings
 */
export const embedding_cache = pgTable(
  'embedding_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentHash: text('contentHash').notNull().unique(),
    content: text('content').notNull(),
    vectorIndex: decimal('vectorIndex', { precision: 10, scale: 0 }).notNull().default('0'), // Index in external vector DB
    model: embeddingModelEnum('model').notNull(),
    language: languageEnum('language').notNull(),
    dimensions: decimal('dimensions', { precision: 10, scale: 0 }).notNull().default('1536'),
    tokens: decimal('tokens', { precision: 10, scale: 0 }).notNull().default('0'),
    cost: decimal('cost', { precision: 5, scale: 4 }).notNull().default('0.0000'),
    hitCount: decimal('hitCount', { precision: 10, scale: 0 }).notNull().default('0'),
    lastAccessedAt: timestamp('lastAccessedAt').defaultNow().notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    expiresAt: timestamp('expiresAt'), // TTL for cache entries
  },
  (table) => ({
    contentHashIdx: index('idx_embedding_cache_content_hash').on(
      table.contentHash,
    ),
    modelIdx: index('idx_embedding_cache_model').on(table.model),
    languageIdx: index('idx_embedding_cache_language').on(table.language),
    hitCountIdx: index('idx_embedding_cache_hit_count').on(table.hitCount),
    lastAccessedAtIdx: index('idx_embedding_cache_last_accessed').on(
      table.lastAccessedAt,
    ),
    expiresAtIdx: index('idx_embedding_cache_expires_at').on(table.expiresAt),
    modelLanguageIdx: index('idx_embedding_cache_model_language').on(
      table.model,
      table.language,
    ),
  }),
);

export type EmbeddingCache = typeof embedding_cache.$inferSelect;
export type InsertEmbeddingCache = typeof embedding_cache.$inferInsert;

/**
 * Vector index configurations table
 */
export const vector_index_configs = pgTable(
  'vector_index_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    indexName: text('indexName').notNull().unique(),
    indexType: text('indexType').notNull(), // 'ivfflat', 'hnsw', 'exact'
    tableName: text('tableName').notNull(),
    columnName: text('columnName').notNull(),
    metric: text('metric').notNull(), // 'cosine', 'l2', 'inner_product'
    dimensions: decimal('dimensions', { precision: 10, scale: 0 }).notNull().default('1536'),
    isActive: boolean('isActive').notNull().default(true),
    configuration: jsonb('configuration'), // Index-specific parameters
    sizeEstimate: decimal('sizeEstimate', { precision: 10, scale: 2 }).notNull().default('0.00'), // in MB
    performance: jsonb('performance'), // Performance metrics
    lastOptimizedAt: timestamp('lastOptimizedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    indexNameIdx: index('idx_vector_index_configs_name').on(table.indexName),
    tableNameIdx: index('idx_vector_index_configs_table').on(table.tableName),
    isActiveIdx: index('idx_vector_index_configs_active').on(table.isActive),
    indexTypeIdx: index('idx_vector_index_configs_type').on(table.indexType),
    lastOptimizedAtIdx: index('idx_vector_index_configs_last_optimized').on(table.lastOptimizedAt),
  }),
);

export type VectorIndexConfig = typeof vector_index_configs.$inferSelect;
export type InsertVectorIndexConfig = typeof vector_index_configs.$inferInsert;

/**
 * RAG context windows table - for managing conversation context
 */
export const rag_context_windows = pgTable(
  'rag_context_windows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: text('sessionId').notNull(),
    userId: uuid('userId'),
    conversationType: text('conversationType').notNull(), // 'analysis', 'search', 'chat'
    contextDocuments: jsonb('contextDocuments').notNull(), // Array of document references
    queryText: text('queryText').notNull(),
    contextLength: decimal('contextLength', { precision: 10, scale: 0 }).notNull().default('0'), // in tokens
    relevanceScores: jsonb('relevanceScores'),
    responseGenerated: boolean('responseGenerated').notNull().default(false),
    responseTime: decimal('responseTime', { precision: 10, scale: 3 }).notNull().default('0.000'), // in milliseconds
    feedbackScore: decimal('feedbackScore', { precision: 3, scale: 2 }).default('0.00'), // User feedback on context quality
    embeddingModel: embeddingModelEnum('embeddingModel').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index('idx_rag_context_windows_session').on(table.sessionId),
    userIdIdx: index('idx_rag_context_windows_user_id').on(table.userId),
    conversationTypeIdx: index('idx_rag_context_windows_type').on(
      table.conversationType,
    ),
    embeddingModelIdx: index('idx_rag_context_windows_model').on(
      table.embeddingModel,
    ),
    createdAtIdx: index('idx_rag_context_windows_created_at').on(
      table.createdAt,
    ),
    sessionTypeIdx: index('idx_rag_context_windows_session_type').on(
      table.sessionId,
      table.conversationType,
    ),
  }),
);

export type RAGContextWindow = typeof rag_context_windows.$inferSelect;
export type InsertRAGContextWindow = typeof rag_context_windows.$inferInsert;

/**
 * Relations for vector schema
 */
export const documentEmbeddingsRelations = relations(
  document_embeddings,
  ({ one }) => ({
    // Relations can be defined here if needed
  }),
);

export const vectorSearchQueriesRelations = relations(
  vector_search_queries,
  ({ one }) => ({
    // Relations can be defined here if needed
  }),
);

export const embeddingCacheRelations = relations(
  embedding_cache,
  ({ one }) => ({
    // Relations can be defined here if needed
  }),
);

export const vectorIndexConfigsRelations = relations(
  vector_index_configs,
  ({ one }) => ({
    // Relations can be defined here if needed
  }),
);

export const ragContextWindowsRelations = relations(
  rag_context_windows,
  ({ one }) => ({
    // Relations can be defined here if needed
  }),
);

// SQL export is handled above
