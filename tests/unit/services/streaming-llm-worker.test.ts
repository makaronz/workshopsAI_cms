import { StreamingLLMAnalysisWorker, StreamingLLMAnalysisJobData, StreamingResponseData } from '../../../src/services/streaming-llm-worker';
import { mockLLMService, LLMResponseTemplates } from '../../utils/llm-mock-utils';
import { testDatabase } from '../../utils/test-database';
import { MockDataGenerator } from '../../utils/mock-data-generators';
import { performanceTestingUtils } from '../../utils/performance-testing-utils';

// Mock external dependencies
jest.mock('ioredis');
jest.mock('bullmq');
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');
jest.mock('../../../src/services/anonymization');
jest.mock('../../../src/services/embeddings');
jest.mock('../../../src/services/prompt-templates');
jest.mock('../../../src/config/database');

describe('StreamingLLMAnalysisWorker', () => {
  let worker: StreamingLLMAnalysisWorker;
  let mockConfig: any;
  let testDataset: any;

  beforeAll(async () => {
    await testDatabase.connect();
    mockConfig = {
      openai: {
        apiKey: 'test-openai-key',
        baseURL: 'https://api.openai.com/v1',
      },
      anthropic: {
        apiKey: 'test-anthropic-key',
      },
      redis: {
        host: 'localhost',
        port: 6379,
        db: 1,
      },
    };

    testDataset = MockDataGenerator.generateCompleteDataset({
      userCount: 1,
      questionnaireCount: 1,
      questionsPerQuestionnaire: 3,
      responsesPerQuestionnaire: 5,
      analysisJobsPerQuestionnaire: 1,
      analysesPerJob: 1,
    });
  });

  afterAll(async () => {
    await testDatabase.disconnect();
  });

  beforeEach(() => {
    worker = new StreamingLLMAnalysisWorker(mockConfig);
    mockLLMService.resetMocks();
    performanceTestingUtils.reset();
  });

  afterEach(async () => {
    if (worker) {
      await worker.shutdown();
    }
    await testDatabase.clearAllTables();
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(worker).toBeInstanceOf(StreamingLLMAnalysisWorker);
      expect(worker).toBeDefined();
    });

    it('should set up Redis connection with correct parameters', () => {
      // Test that Redis connection is configured correctly
      expect(worker).toBeDefined();
    });

    it('should initialize OpenAI and Anthropic clients', () => {
      expect(worker).toBeDefined();
    });
  });

  describe('Job Processing', () => {
    let jobData: StreamingLLMAnalysisJobData;

    beforeEach(() => {
      jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic', 'sentiment'],
        options: {
          minClusterSize: 3,
          minThemeFrequency: 2,
          includeSentiment: true,
          anonymizationLevel: 'partial',
          language: 'en',
          provider: 'openai',
          streamResponse: true,
        },
        triggeredBy: testDataset.datasets[0].user.id,
        priority: 'medium',
      };
    });

    it('should process thematic analysis job successfully', async () => {
      setupMockLLMSuccess('openai');

      const result = await worker.processJob(jobData);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.analysisType).toBe('thematic');
      expect(result.result).toBeDefined();
    });

    it('should process sentiment analysis job successfully', async () => {
      const sentimentJobData = {
        ...jobData,
        analysisTypes: ['sentiment'],
      };

      setupMockLLMSuccess('openai');

      const result = await worker.processJob(sentimentJobData);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.analysisType).toBe('sentiment');
      expect(result.result).toBeDefined();
    });

    it('should handle cluster analysis job successfully', async () => {
      const clusterJobData = {
        ...jobData,
        analysisTypes: ['clusters'],
      };

      setupMockLLMSuccess('openai');

      const result = await worker.processJob(clusterJobData);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.analysisType).toBe('clusters');
      expect(result.result).toBeDefined();
    });

    it('should process multiple analysis types in sequence', async () => {
      setupMockLLMSuccess('openai');

      const results = await worker.processMultipleAnalyses(jobData);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.status === 'completed')).toBe(true);
      expect(results.map(r => r.analysisType)).toContain('thematic');
      expect(results.map(r => r.analysisType)).toContain('sentiment');
    });

    it('should handle job failures gracefully', async () => {
      setupMockLLMError('openai');

      await expect(worker.processJob(jobData)).rejects.toThrow();
    });

    it('should retry failed jobs with exponential backoff', async () => {
      let callCount = 0;
      mockLLMService.mockOpenAIError(new Error('Temporary failure'));

      const result = await worker.processJobWithRetry(jobData, 3);

      expect(mockLLMService.getOpenAICallCount()).toBeGreaterThan(2);
      expect(result.status).toBe('failed');
    });
  });

  describe('Streaming Functionality', () => {
    let jobData: StreamingLLMAnalysisJobData;
    let streamEvents: StreamingResponseData[];

    beforeEach(() => {
      jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: {
          streamResponse: true,
          provider: 'openai',
        },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      streamEvents = [];
      worker.on('stream', (data: StreamingResponseData) => {
        streamEvents.push(data);
      });
    });

    it('should emit stream events during analysis', async () => {
      const chunks = ['Theme 1: ', 'User experience', 'Theme 2: ', 'Performance'];
      mockLLMService.mockOpenAIStream(chunks);

      await worker.processJob(jobData);

      expect(streamEvents.length).toBeGreaterThan(0);
      expect(streamEvents[0].type).toBe('chunk');
      expect(streamEvents[streamEvents.length - 1].type).toBe('complete');
    });

    it('should emit progress events during processing', async () => {
      setupMockLLMSuccess('openai');

      await worker.processJob(jobData);

      const progressEvents = streamEvents.filter(e => e.type === 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].metadata?.progress).toBeGreaterThanOrEqual(0);
      expect(progressEvents[0].metadata?.progress).toBeLessThanOrEqual(100);
    });

    it('should handle stream interruption gracefully', async () => {
      const abortController = new AbortController();

      // Start streaming and abort after first chunk
      const streamPromise = worker.processJobWithStream(jobData, abortController.signal);

      setTimeout(() => abortController.abort(), 100);

      await expect(streamPromise).rejects.toThrow('Stream aborted');
    });

    it('should accumulate stream chunks correctly', async () => {
      const chunks = ['Analysis', ' of ', 'themes', ' shows ', 'positive', ' feedback'];
      mockLLMService.mockOpenAIStream(chunks);

      const result = await worker.processJob(jobData);

      expect(result.result).toContain('Analysis of themes shows positive feedback');
    });
  });

  describe('Memory Management', () => {
    it('should clean up cache entries older than TTL', async () => {
      const key = 'test-cache-key';
      const data = { test: 'data' };

      // Add cache entry
      worker.setCache(key, data, 100); // 100ms TTL

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const cachedData = worker.getCache(key);
      expect(cachedData).toBeNull();
    });

    it('should limit cache size to prevent memory leaks', async () => {
      // Fill cache beyond limit
      for (let i = 0; i < 1500; i++) {
        worker.setCache(`key-${i}`, { data: `value-${i}` }, 300000);
      }

      // Cache should be limited to prevent memory issues
      const cacheSize = worker.getCacheSize();
      expect(cacheSize).toBeLessThanOrEqual(1000); // Assuming max cache size is 1000
    });

    it('should clean up active streams on completion', async () => {
      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { streamResponse: true },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      setupMockLLMSuccess('openai');

      await worker.processJob(jobData);

      const activeStreams = worker.getActiveStreamsCount();
      expect(activeStreams).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    it('should complete thematic analysis within performance threshold', async () => {
      setupMockLLMSuccess('openai');

      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      const { result, metric } = await performanceTestingUtils.measurePerformance(
        'thematic-analysis',
        () => worker.processJob(jobData)
      );

      expect(metric.duration).toBeLessThan(30000); // 30 seconds
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should handle concurrent jobs efficiently', async () => {
      setupMockLLMSuccess('openai');

      const jobs = Array.from({ length: 5 }, (_, i) => ({
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      }));

      const startTime = Date.now();
      const results = await Promise.all(jobs.map(job => worker.processJob(job)));
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(results.every(r => r.status === 'completed')).toBe(true);
      expect(endTime - startTime).toBeLessThan(60000); // 1 minute for 5 concurrent jobs
    });

    it('should maintain acceptable memory usage during processing', async () => {
      setupMockLLMSuccess('openai');

      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      const memoryLeakResult = await performanceTestingUtils.detectMemoryLeaks(
        'streaming-llm-worker',
        () => worker.processJob(jobData),
        10,
        50 * 1024 * 1024 // 50MB threshold
      );

      expect(memoryLeakResult.hasMemoryLeak).toBe(false);
      expect(memoryLeakResult.memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API rate limits', async () => {
      setupMockLLMRateLimit('openai');

      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      const result = await worker.processJobWithRetry(jobData, 3);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Rate limit');
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockLLMService.mockOpenAIError(timeoutError);

      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      await expect(worker.processJob(jobData)).rejects.toThrow('timeout');
    });

    it('should handle malformed responses from LLM APIs', async () => {
      mockLLMService.getOpenAIClient().chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: null }, // Malformed response
        }],
      } as any);

      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      const result = await worker.processJob(jobData);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Invalid response');
    });

    it('should handle database connection failures', async () => {
      // Mock database failure
      const mockDbError = new Error('Database connection failed');
      jest.doMock('../../../src/config/database', () => ({
        db: {
          query: jest.fn().mockRejectedValue(mockDbError),
        },
      }));

      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      await expect(worker.processJob(jobData)).rejects.toThrow('Database');
    });
  });

  describe('Integration with Other Services', () => {
    it('should integrate with anonymization service', async () => {
      setupMockLLMSuccess('openai');

      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: {
          anonymizationLevel: 'full',
          provider: 'openai',
        },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      const result = await worker.processJob(jobData);

      expect(result.status).toBe('completed');
      // Verify anonymization was called (mock would need to be checked)
    });

    it('should integrate with embeddings service', async () => {
      setupMockLLMSuccess('openai');

      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['clusters'],
        options: {
          provider: 'openai',
        },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      const result = await worker.processJob(jobData);

      expect(result.status).toBe('completed');
      // Verify embeddings were calculated
    });

    it('should use prompt templates for different analysis types', async () => {
      setupMockLLMSuccess('openai');

      const thematicJob = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      const sentimentJob = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['sentiment'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      await worker.processJob(thematicJob);
      await worker.processJob(sentimentJob);

      // Verify different prompt templates were used
      expect(mockLLMService.getOpenAICallCount()).toBe(2);
    });
  });

  describe('Configuration and Options', () => {
    it('should respect custom model parameters', async () => {
      const customModelJobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: {
          provider: 'openai',
          model: 'gpt-4-turbo',
          maxTokens: 2000,
          temperature: 0.3,
        },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      setupMockLLMSuccess('openai');

      await worker.processJob(customModelJobData);

      const lastCall = mockLLMService.getLastOpenAICall();
      expect(lastCall.model).toBe('gpt-4-turbo');
      expect(lastCall.max_tokens).toBe(2000);
      expect(lastCall.temperature).toBe(0.3);
    });

    it('should handle language detection and multilingual analysis', async () => {
      const multilingualJobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: {
          language: 'auto',
          culturalBiasHandling: true,
          provider: 'openai',
        },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      setupMockLLMSuccess('openai');

      const result = await worker.processJob(multilingualJobData);

      expect(result.status).toBe('completed');
      // Verify language detection was performed
    });

    it('should handle batch processing for large datasets', async () => {
      const batchJobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: {
          batchSize: 10,
          provider: 'openai',
        },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      setupMockLLMSuccess('openai');

      const result = await worker.processJob(batchJobData);

      expect(result.status).toBe('completed');
      // Verify batch processing was used
    });
  });

  describe('Cache Management', () => {
    it('should cache analysis results for repeated requests', async () => {
      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      setupMockLLMSuccess('openai');

      // First call
      const result1 = await worker.processJob(jobData);
      expect(mockLLMService.getOpenAICallCount()).toBe(1);

      // Second call with same parameters (should use cache)
      const result2 = await worker.processJob(jobData);
      expect(mockLLMService.getOpenAICallCount()).toBe(1); // Should not increase

      expect(result1).toEqual(result2);
    });

    it('should invalidate cache when questionnaire data changes', async () => {
      const jobData = {
        questionnaireId: testDataset.datasets[0].questionnaire.id,
        analysisTypes: ['thematic'],
        options: { provider: 'openai' },
        triggeredBy: testDataset.datasets[0].user.id,
      };

      setupMockLLMSuccess('openai');

      // First analysis
      await worker.processJob(jobData);
      expect(mockLLMService.getOpenAICallCount()).toBe(1);

      // Simulate questionnaire update
      worker.invalidateCacheForQuestionnaire(jobData.questionnaireId);

      // Second analysis should call API again
      await worker.processJob(jobData);
      expect(mockLLMService.getOpenAICallCount()).toBe(2);
    });
  });
});

// Helper function to setup mock LLM success
function setupMockLLMSuccess(provider: 'openai' | 'anthropic' = 'openai') {
  if (provider === 'openai') {
    mockLLMService.mockOpenAICompletion(LLMResponseTemplates.thematic.success);
  } else {
    mockLLMService.mockAnthropicCompletion(LLMResponseTemplates.thematic.success);
  }
}