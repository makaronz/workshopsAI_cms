# Vector Database Services

Comprehensive RAG (Retrieval-Augmented Generation) functionality for workshopsAI CMS with multilingual support for Polish and English.

## Overview

This module provides a complete vector database integration with the following features:

- **Vector Database Manager** - PostgreSQL/pgvector integration with efficient similarity search
- **Embedding Service** - Multilingual text embeddings with OpenAI and local model support
- **RAG Query Engine** - Advanced context retrieval and prompt augmentation
- **Vector Index Manager** - Automated index creation and optimization
- **Semantic Search Service** - Full-text semantic search with filtering and analytics
- **Performance Monitor** - Real-time performance tracking and alerting

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vector Database Services                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ EmbeddingService│  │RAGQueryEngine   │  │SemanticSearch   │ │
│  │                 │  │                 │  │Service          │ │
│  │ • Text → Vector │  │ • Context       │  │ • Advanced      │ │
│  │ • Batch Process │  │   Retrieval     │  │   Search        │ │
│  │ • Cache         │  │ • Prompt        │  │ • Filtering     │ │
│  │ • Multi-model   │  │   Augmentation  │  │ • Analytics     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │       │
│           └─────────────────────┼─────────────────────┘       │
│                                 │                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │VectorDBManager  │  │VectorIndexMgr   │  │PerformanceMon   │ │
│  │                 │  │                 │  │                 │ │
│  │ • PostgreSQL    │  │ • Index Creation│  │ • Metrics       │ │
│  │ • pgvector      │  │ • Optimization  │  │ • Alerts        │ │
│  │ • Similarity    │  │ • Health Check  │  │ • Dashboard     │ │
│  │ • CRUD Ops      │  │ • Maintenance   │  │ • Reports       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ PostgreSQL +    │
                    │ pgvector        │
                    │                 │
                    │ • document_embeddings │
                    │ • vector_search_queries │
                    │ • embedding_cache      │
                    │ • vector_indexes       │
                    └─────────────────┘
```

## Supported Languages

- **English** (en) - Full support with all embedding models
- **Polish** (pl) - Native support with specialized tokenization
- **Multilingual** - 12+ additional languages supported

## Installation

```bash
# Install PostgreSQL with pgvector extension
brew install pgvector  # macOS
# or
sudo apt-get install postgresql-14-pgvector  # Ubuntu

# Install required packages
npm install pgvector openai

# Run database migrations
npm run db:migrate-questionnaires
```

## Quick Start

```typescript
import { initializeVectorServices, semanticSearchService } from './services/vector';

// Initialize all services
await initializeVectorServices();

// Perform semantic search
const results = await semanticSearchService.search('workshop feedback', {
  type: 'semantic',
  resultTypes: ['questionnaire_response'],
  includeFacets: true
});

console.log(`Found ${results.totalResults} matching documents`);
```

## Core Services

### EmbeddingService

Handles text-to-vector conversion with multilingual support.

```typescript
import { embeddingService } from './services/vector';

// Generate embedding for single text
const result = await embeddingService.generateEmbedding(
  'This workshop was very helpful for learning new skills.',
  { model: 'text-embedding-3-small', language: 'en' }
);

// Batch processing
const batchResults = await embeddingService.generateBatchEmbeddings([
  'Text 1',
  'Tekst 2 po polsku',
  'Text 3'
], {
  batchSize: 100,
  onProgress: (completed, total) => console.log(`${completed}/${total}`)
});

// Store document embeddings
await embeddingService.storeDocumentEmbeddings([
  {
    documentId: 'doc1',
    documentType: 'questionnaire_response',
    content: 'Great workshop experience',
    language: 'en',
    metadata: { workshopId: 'ws1' }
  }
]);
```

### VectorDatabaseManager

Manages PostgreSQL/pgvector operations and vector similarity search.

```typescript
import { vectorDatabaseManager } from './services/vector';

// Initialize vector database
await vectorDatabaseManager.initialize();

// Search similar documents
const similarDocs = await vectorDatabaseManager.searchSimilar(queryEmbedding, {
  limit: 10,
  threshold: 0.7,
  metric: 'cosine',
  filters: {
    documentType: ['questionnaire_response', 'question'],
    language: ['en', 'pl']
  }
});

// Get database statistics
const stats = await vectorDatabaseManager.getStatistics();
console.log(`Total embeddings: ${stats.totalEmbeddings}`);
```

### RAGQueryEngine

Retrieval-Augmented Generation for intelligent context retrieval.

```typescript
import { ragQueryEngine } from './services/vector';

// Execute RAG query
const ragResult = await ragQueryEngine.query(
  'What are the common themes in participant feedback?',
  {
    type: 'context_retrieval',
    maxContextDocuments: 8,
    minSimilarityThreshold: 0.6,
    ranking: {
      method: 'hybrid',
      weights: { similarity: 0.6, recency: 0.3, relevance: 0.1 }
    }
  }
);

// Generate augmented prompt for LLM
const augmentedPrompt = await ragQueryEngine.generateAugmentedPrompt(
  'Analyze the feedback and provide insights:',
  ragResult,
  { formatStyle: 'structured' }
);
```

### SemanticSearchService

Advanced search with filtering, faceting, and analytics.

```typescript
import { semanticSearchService } from './services/vector';

// Semantic search with filters
const searchResults = await semanticSearchService.search(
  'conflict resolution techniques',
  {
    type: 'semantic',
    resultTypes: ['questionnaire_response', 'workshop_content'],
    filters: {
      languages: ['en'],
      dateRange: { start: new Date('2024-01-01'), end: new Date() },
      workshopId: 'ws123'
    },
    pagination: { limit: 20, sortBy: 'relevance' },
    includeFacets: true,
    includeHighlights: true
  }
);

// Multilingual search
const multilingualResults = await semanticSearchService.multilingualSearch(
  'techniki rozwiązywania konfliktów',
  ['pl', 'en'],
  { preferOriginalLanguage: true }
);

// Get search suggestions
const suggestions = await semanticSearchService.getSearchSuggestions('worksh', {
  maxSuggestions: 5,
  includeHistory: true
});
```

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=workshopsai_cms

# Logging
LOG_LEVEL=info
```

### Service Configuration

```typescript
// Update context window configuration
ragQueryEngine.updateContextConfig({
  maxTokens: 4000,
  maxDocuments: 10,
  truncationStrategy: 'smart'
});

// Start performance monitoring
import { vectorPerformanceMonitor } from './services/vector';
vectorPerformanceMonitor.startMonitoring(60000); // Every minute
```

## Database Schema

The vector extensions add the following tables:

### document_embeddings
Core storage for vector embeddings with metadata
```sql
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(50) NOT NULL,
  document_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  language VARCHAR(2) NOT NULL DEFAULT 'en',
  embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
  metadata JSONB,
  confidence_score FLOAT DEFAULT 0.8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### vector_search_queries
Analytics tracking for search performance
```sql
CREATE TABLE vector_search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  query_embedding vector(1536) NOT NULL,
  results_found INTEGER DEFAULT 0,
  avg_similarity FLOAT,
  search_time FLOAT, -- in milliseconds
  filters JSONB,
  metric_used VARCHAR(20) DEFAULT 'cosine',
  threshold FLOAT DEFAULT 0.7,
  user_id UUID,
  session_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### embedding_cache
Performance optimization through caching
```sql
CREATE TABLE embedding_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash VARCHAR(64) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  model VARCHAR(100) NOT NULL,
  language VARCHAR(2) NOT NULL,
  tokens INTEGER DEFAULT 0,
  cost FLOAT DEFAULT 0,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);
```

## Performance Optimization

### Vector Indexes

The system automatically creates optimal indexes based on data size:

- **< 1,000 embeddings**: Exact search (no index needed)
- **1,000 - 100,000 embeddings**: IVFFlat index
- **> 100,000 embeddings**: HNSW index for maximum performance

### Caching Strategy

- **Embedding Cache**: Automatic caching of frequently used embeddings
- **Query Cache**: LRU cache for search results
- **Connection Pooling**: Optimized database connections

### Monitoring

Real-time performance monitoring with alerts:
- Query response times
- Embedding generation performance
- Cache hit rates
- System resource usage

```typescript
// Get performance dashboard
const dashboard = await vectorPerformanceMonitor.getDashboardData();
console.log(`System status: ${dashboard.systemStatus}`);
console.log(`Average query time: ${dashboard.currentMetrics.searchOperations.averageTime}ms`);
```

## Usage Examples

### Workshop Feedback Analysis

```typescript
// Find similar feedback across all workshops
const similarFeedback = await semanticSearchService.search(
  'participants enjoyed the interactive exercises',
  {
    resultTypes: ['questionnaire_response'],
    filters: {
      dateRange: { start: new Date('2024-01-01'), end: new Date() }
    }
  }
);

// Generate insights using RAG
const insights = await ragQueryEngine.query(
  'What are the main strengths of our workshops?',
  {
    type: 'document_analysis',
    maxContextDocuments: 15,
    contextWindow: 6000
  }
);
```

### Content Recommendations

```typescript
// Recommend relevant workshop content
const recommendations = await ragQueryEngine.findSimilarDocuments(
  'workshop123',
  'workshop_content',
  {
    ranking: { method: 'hybrid', weights: { similarity: 0.8, recency: 0.2 } }
  }
);
```

### Multilingual Search

```typescript
// Search across Polish and English content
const bilingualResults = await semanticSearchService.multilingualSearch(
  'jak poprawić komunikację w zespole',
  ['pl', 'en'],
  {
    translateQuery: false,
    filters: { documentTypes: ['questionnaire_response', 'workshop_content'] }
  }
);
```

## Testing

```bash
# Run vector service tests
npm test tests/vector/services.test.ts

# Run with coverage
npm run test:coverage

# Performance testing
npm run test:performance
```

## Troubleshooting

### Common Issues

1. **pgvector extension not found**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **High memory usage**
   - Reduce cache sizes
   - Implement streaming for large datasets
   - Monitor and optimize indexes

3. **Slow search performance**
   - Check vector index status
   - Verify similarity thresholds
   - Consider HNSW indexes for large datasets

### Performance Tuning

```typescript
// Optimize for specific use cases
const optimizedConfig = {
  maxContextDocuments: 5,      // Reduce for faster responses
  minSimilarityThreshold: 0.8, // Increase for precision
  cacheSize: 5000,            // Adjust based on memory
  indexType: 'hnsw'          // Use for large datasets
};
```

## API Reference

Detailed API documentation is available in the TypeScript interfaces for each service. Key interfaces include:

- `EmbeddingResult` - Embedding generation results
- `VectorSearchOptions` - Search configuration
- `RAGQueryOptions` - RAG query configuration
- `SemanticSearchResponse` - Search response format
- `PerformanceMetrics` - Performance monitoring data

## Contributing

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure backward compatibility

## License

This module is part of the workshopsAI CMS project and follows the same licensing terms.