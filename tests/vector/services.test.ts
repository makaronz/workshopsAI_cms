import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { embeddingService } from '../../src/services/vector';
import { vectorDatabaseManager } from '../../src/services/vector/vectorDatabaseManager';
import { ragQueryEngine } from '../../src/services/vector/ragQueryEngine';
import { semanticSearchService } from '../../src/services/vector/semanticSearchService';

describe('Vector Database Services', () => {
  beforeEach(() => {
    // Mock environment variables for testing
    process.env.OPENAI_API_KEY = 'test-key';
  });

  describe('EmbeddingService', () => {
    it('should detect language correctly', async () => {
      const polishText = 'To jest polski tekst z polskimi znakami: ąęłńóśźż';
      const detection = await embeddingService.detectLanguage(polishText);

      expect(detection.language).toBe('pl');
      expect(detection.confidence).toBeGreaterThan(0.8);
    });

    it('should calculate embedding costs correctly', () => {
      const texts = [
        'Short text',
        'This is a much longer text with more words to calculate accurate token estimation',
        'Medium length text here'
      ];

      const cost = embeddingService.calculateCost(texts);

      expect(cost.tokens).toBeGreaterThan(0);
      expect(cost.cost).toBeGreaterThanOrEqual(0);
      expect(cost.details).toHaveLength(3);
    });

    it('should validate embedding models', () => {
      expect(() => {
        embeddingService.calculateCost(['test'], 'invalid-model');
      }).toThrow('Unsupported model');
    });
  });

  describe('VectorDatabaseManager', () => {
    beforeEach(async () => {
      // Initialize test database connection
      await vectorDatabaseManager.initialize();
    });

    it('should perform health check', async () => {
      const health = await vectorDatabaseManager.healthCheck();
      expect(typeof health).toBe('boolean');
    });

    it('should handle vector search with options', async () => {
      const testEmbedding = new Array(1536).fill(0).map(() => Math.random());

      const results = await vectorDatabaseManager.searchSimilar(testEmbedding, {
        limit: 5,
        threshold: 0.5,
        filters: {
          documentType: ['questionnaire_response']
        }
      });

      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result).toHaveProperty('similarity');
        expect(result).toHaveProperty('documentId');
        expect(result).toHaveProperty('content');
      });
    });

    it('should get database statistics', async () => {
      const stats = await vectorDatabaseManager.getStatistics();

      expect(stats).toHaveProperty('totalEmbeddings');
      expect(stats).toHaveProperty('embeddingsByType');
      expect(stats).toHaveProperty('embeddingsByLanguage');
      expect(stats).toHaveProperty('averageEmbeddingDimension');
    });
  });

  describe('RAGQueryEngine', () => {
    it('should execute basic RAG query', async () => {
      const result = await ragQueryEngine.query('test query about workshops', {
        type: 'semantic_search',
        maxContextDocuments: 5,
        minSimilarityThreshold: 0.5
      });

      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('contextDocuments');
      expect(result).toHaveProperty('totalResults');
      expect(result).toHaveProperty('performance');
      expect(Array.isArray(result.contextDocuments)).toBe(true);
    });

    it('should generate augmented prompt', async () => {
      const mockRAGResult = {
        query: 'test query',
        queryEmbedding: new Array(1536).fill(0),
        contextDocuments: [
          {
            id: '1',
            documentType: 'question',
            documentId: 'q1',
            content: 'Test content about workshops',
            language: 'en',
            similarity: 0.85,
            relevance: 0.85,
            metadata: { title: 'Test Question' }
          }
        ],
        totalResults: 1,
        averageSimilarity: 0.85,
        contextWindow: { size: 100, documents: 1, truncated: false },
        performance: { embeddingTime: 100, searchTime: 50, totalTime: 150 }
      };

      const augmentedPrompt = await ragQueryEngine.generateAugmentedPrompt(
        'Based on the context, answer the following question:',
        mockRAGResult,
        { formatStyle: 'bullet' }
      );

      expect(augmentedPrompt).toContain('Context Information');
      expect(augmentedPrompt).toContain('Test content about workshops');
    });
  });

  describe('SemanticSearchService', () => {
    it('should perform semantic search', async () => {
      const result = await semanticSearchService.search('workshop feedback', {
        type: 'semantic',
        resultTypes: ['questionnaire_response'],
        limit: 10,
        includeFacets: true
      });

      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('totalResults');
      expect(result).toHaveProperty('facets');
      expect(result.facets).toHaveProperty('documentTypes');
      expect(result.facets).toHaveProperty('languages');
    });

    it('should get search suggestions', async () => {
      const suggestions = await semanticSearchService.getSearchSuggestions('worksh', {
        maxSuggestions: 5,
        includeHistory: false
      });

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should search by document type', async () => {
      const result = await semanticSearchService.searchByDocumentType(
        'participant experience',
        'questionnaire_response',
        { limit: 5 }
      );

      expect(result.query).toBe('participant experience');
      expect(Array.isArray(result.results)).toBe(true);
      result.results.forEach(result => {
        expect(result.documentType).toBe('questionnaire_response');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle end-to-end RAG workflow', async () => {
      const query = 'How do participants feel about workshop effectiveness?';

      // Step 1: Semantic search
      const searchResult = await semanticSearchService.search(query, {
        type: 'semantic',
        includeHighlights: true
      });

      // Step 2: RAG query with context
      const ragResult = await ragQueryEngine.query(query, {
        type: 'context_retrieval',
        maxContextDocuments: 5
      });

      // Step 3: Generate augmented prompt
      const augmentedPrompt = await ragQueryEngine.generateAugmentedPrompt(
        query,
        ragResult,
        { formatStyle: 'structured' }
      );

      expect(searchResult.results.length).toBeGreaterThanOrEqual(0);
      expect(ragResult.contextDocuments.length).toBeGreaterThanOrEqual(0);
      expect(augmentedPrompt).toContain(query);
      expect(augmentedPrompt).toContain('Context Information');
    });

    it('should handle multilingual search', async () => {
      const polishQuery = 'Jak uczestnicy oceniają warsztaty?';

      const result = await semanticSearchService.multilingualSearch(
        polishQuery,
        ['pl', 'en'],
        { preferOriginalLanguage: true }
      );

      expect(result.query).toBe(polishQuery);
      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });
  });
});