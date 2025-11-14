import { EnhancedLLMAnalysisWorker } from '../src/services/enhanced-llm-worker';
import { AnonymizationService } from '../src/services/anonymization';
import { promptTemplateService } from '../src/services/prompt-templates';
import { AnalysisWebSocketService } from '../src/services/analysis-websocket';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';

// Mock dependencies
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');
jest.mock('ioredis', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      disconnect: jest.fn(),
    })),
  };
});

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
    close: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    run: jest.fn(),
    close: jest.fn(),
  })),
  Job: jest.fn(),
}));

describe('Enhanced LLM Integration Tests', () => {
  let enhancedWorker: EnhancedLLMAnalysisWorker;
  let httpServer: any;
  let wsService: AnalysisWebSocketService;
  let clientSocket: ClientSocket;

  beforeAll(async () => {
    // Setup test HTTP server for WebSocket
    httpServer = createServer();
    await new Promise((resolve) => {
      httpServer.listen(0, resolve);
    });
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (wsService) {
      wsService.shutdown();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  beforeEach(async () => {
    enhancedWorker = new EnhancedLLMAnalysisWorker();
    await enhancedWorker.initialize();

    wsService = new AnalysisWebSocketService(httpServer);
  });

  afterEach(async () => {
    if (enhancedWorker) {
      await enhancedWorker.shutdown();
    }
  });

  describe('Enhanced LLM Worker Configuration', () => {
    test('should initialize with default configuration', () => {
      expect(enhancedWorker).toBeDefined();
      expect(enhancedWorker['providers']).toContain('openai');
      expect(enhancedWorker['providers']).toContain('anthropic');
    });

    test('should have proper cost tracking initialized', () => {
      const costStats = enhancedWorker.getCostStats();
      expect(costStats).toHaveProperty('totalCost');
      expect(costStats).toHaveProperty('totalTokens');
      expect(costStats).toHaveProperty('callsByProvider');
      expect(costStats.totalCost).toBe(0);
    });

    test('should have cache with TTL management', () => {
      const cache = enhancedWorker['cache'];
      expect(cache).toBeDefined();
      expect(cache instanceof Map).toBe(true);
    });
  });

  describe('Job Management', () => {
    test('should add job with proper validation', async () => {
      const jobData = {
        questionnaireId: 'test-q-id',
        analysisType: 'thematic',
        options: {
          language: 'pl',
          anonymizationLevel: 'full',
        },
      };

      const jobId = await enhancedWorker.addJob(jobData);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const status = await enhancedWorker.getJobStatus(jobId);
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('progress');
    });

    test('should validate job data before adding', async () => {
      const invalidJobData = {
        analysisType: 'invalid-type',
      };

      await expect(enhancedWorker.addJob(invalidJobData))
        .rejects.toThrow();
    });

    test('should handle job cancellation', async () => {
      const jobData = {
        questionnaireId: 'test-q-id',
        analysisType: 'thematic',
        options: {},
      };

      const jobId = await enhancedWorker.addJob(jobData);
      const cancelled = await enhancedWorker.cancelJob(jobId);

      expect(cancelled).toBe(true);

      const status = await enhancedWorker.getJobStatus(jobId);
      expect(status.status).toBe('cancelled');
    });

    test('should get job progress with accurate percentages', async () => {
      const jobData = {
        questionnaireId: 'test-q-id',
        analysisType: 'thematic',
        options: {},
      };

      const jobId = await enhancedWorker.addJob(jobData);
      const progress = await enhancedWorker.getJobProgress(jobId);

      expect(progress).toHaveProperty('percentage');
      expect(progress).toHaveProperty('currentStep');
      expect(progress).toHaveProperty('totalSteps');
      expect(progress.percentage).toBeGreaterThanOrEqual(0);
      expect(progress.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Advanced Analysis Features', () => {
    test('should perform thematic analysis with cultural bias handling', async () => {
      const responses = [
        { answer: 'Współpraca jest dla nas najważniejsza', metadata: { userId: 1 } },
        { answer: 'Chcemy wspólnie decydować o przestrzeni', metadata: { userId: 2 } },
      ];

      const result = await enhancedWorker.performAnalysis('thematic', responses, {
        language: 'pl',
        enableCulturalBias: true,
        culturalContext: 'polish_workplace',
      });

      expect(result).toHaveProperty('type', 'thematic');
      expect(result).toHaveProperty('results');
      expect(result.results).toHaveProperty('themes');
      expect(Array.isArray(result.results.themes)).toBe(true);
    });

    test('should perform sentiment analysis with cultural context', async () => {
      const responses = [
        { answer: 'Jestem bardzo zadowolony z pracy', metadata: { userId: 1 } },
        { answer: 'Trochę się martwię o przyszłość', metadata: { userId: 2 } },
      ];

      const result = await enhancedWorker.performAnalysis('sentiment', responses, {
        language: 'pl',
        enableCulturalBias: true,
        culturalContext: 'polish_communication',
      });

      expect(result).toHaveProperty('type', 'sentiment');
      expect(result.results).toHaveProperty('overallSentiment');
      expect(result.results).toHaveProperty('emotionalBreakdown');
      expect(result.results).toHaveProperty('culturalContextAnalysis');
    });

    test('should cluster responses semantically', async () => {
      const responses = [
        { answer: 'Potrzebujemy więcej miejsca na spotkania', metadata: { userId: 1 } },
        { answer: 'Brakuje nam sali konferencyjnej', metadata: { userId: 2 } },
        { answer: 'Chcemy ciszy do skupionej pracy', metadata: { userId: 3 } },
      ];

      const result = await enhancedWorker.performAnalysis('clusters', responses, {
        language: 'pl',
        clusterCount: 2,
      });

      expect(result).toHaveProperty('type', 'clusters');
      expect(result.results).toHaveProperty('clusters');
      expect(Array.isArray(result.results.clusters)).toBe(true);
      expect(result.results.clusters.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Provider Support', () => {
    test('should fall back to secondary provider on failure', async () => {
      // Mock OpenAI failure
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI API Error')),
          },
        },
      };

      const mockAnthropic = {
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ text: '{"themes": [{"name": "test", "frequency": 1}]}' }],
            usage: { input_tokens: 100, output_tokens: 50 },
          }),
        },
      };

      enhancedWorker['openai'] = mockOpenAI as any;
      enhancedWorker['anthropic'] = mockAnthropic as any;

      const responses = [{ answer: 'Test response', metadata: { userId: 1 } }];
      const result = await enhancedWorker.performAnalysis('thematic', responses, {
        provider: 'openai',
        fallbackProvider: 'anthropic',
      });

      expect(result).toBeDefined();
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
      expect(mockAnthropic.messages.create).toHaveBeenCalled();
    });

    test('should prefer cost-effective provider for bulk operations', async () => {
      const provider = enhancedWorker.selectProvider({
        analysisType: 'thematic',
        responseCount: 1000,
        costOptimization: true,
      });

      // Should prefer OpenAI for bulk operations based on cost
      expect(provider).toBe('openai');
    });

    test('should handle provider-specific rate limits', async () => {
      const rateLimitInfo = enhancedWorker.getProviderRateLimits('openai');

      expect(rateLimitInfo).toHaveProperty('requestsPerMinute');
      expect(rateLimitInfo).toHaveProperty('tokensPerMinute');
      expect(rateLimitInfo).toHaveProperty('retryAfter');
    });
  });

  describe('Cost Tracking', () => {
    test('should accurately track costs per provider', async () => {
      const initialStats = enhancedWorker.getCostStats();

      // Simulate some API calls
      await enhancedWorker.trackCost('openai', 1000, 0.002);
      await enhancedWorker.trackCost('anthropic', 500, 0.003);

      const updatedStats = enhancedWorker.getCostStats();

      expect(updatedStats.totalCost).toBeGreaterThan(initialStats.totalCost);
      expect(updatedStats.totalTokens).toBe(1500);
      expect(updatedStats.callsByProvider.openai).toBe(1);
      expect(updatedStats.callsByProvider.anthropic).toBe(1);
    });

    test('should provide cost estimates before analysis', async () => {
      const responses = Array.from({ length: 100 }, (_, i) => ({
        answer: `Response ${i}`,
        metadata: { userId: i },
      }));

      const estimate = await enhancedWorker.getCostEstimate('thematic', responses, {
        provider: 'openai',
      });

      expect(estimate).toHaveProperty('estimatedTokens');
      expect(estimate).toHaveProperty('estimatedCost');
      expect(estimate).toHaveProperty('breakdown');
      expect(estimate.estimatedCost).toBeGreaterThan(0);
    });

    test('should enforce cost budgets', async () => {
      await enhancedWorker.setCostBudget({
        daily: 10.0,
        monthly: 100.0,
      });

      const responses = [{ answer: 'Test', metadata: { userId: 1 } }];

      // Mock high cost operation
      jest.spyOn(enhancedWorker as any, 'calculateCost')
        .mockReturnValue(50.0);

      await expect(enhancedWorker.performAnalysis('thematic', responses))
        .rejects.toThrow('Cost budget exceeded');
    });
  });

  describe('Caching and Optimization', () => {
    test('should cache analysis results', async () => {
      const responses = [{ answer: 'Test response', metadata: { userId: 1 } }];
      const options = { language: 'pl' };

      // First call should compute and cache
      const result1 = await enhancedWorker.performAnalysis('thematic', responses, options);

      // Second call should use cache
      const result2 = await enhancedWorker.performAnalysis('thematic', responses, options);

      expect(result1).toEqual(result2);

      const cacheStats = enhancedWorker.getCacheStats();
      expect(cacheStats.hits).toBeGreaterThan(0);
    });

    test('should respect cache TTL', async () => {
      const responses = [{ answer: 'Test', metadata: { userId: 1 } }];

      await enhancedWorker.performAnalysis('thematic', responses);

      // Clear cache entries that are expired
      await enhancedWorker.clearExpiredCache();

      const cacheStats = enhancedWorker.getCacheStats();
      expect(cacheStats.expired).toBe(0);
    });

    test('should implement response batching', async () => {
      const responses = Array.from({ length: 50 }, (_, i) => ({
        answer: `Response ${i}`,
        metadata: { userId: i },
      }));

      const batchResult = await enhancedWorker.batchAnalyze('sentiment', responses, {
        batchSize: 10,
        language: 'pl',
      });

      expect(batchResult).toHaveProperty('results');
      expect(batchResult.results).toHaveLength(50);
      expect(batchResult).toHaveProperty('batchStats');
      expect(batchResult.batchStats.batchesProcessed).toBe(5);
    });
  });

  describe('Enhanced Anonymization Features', () => {
    let anonymizer: AnonymizationService;

    beforeEach(() => {
      anonymizer = new AnonymizationService('test-salt-enhanced');
    });

    test('should perform advanced k-anonymity with semantic analysis', async () => {
      const responses = [
        'Wspólna przestrzeń do pracy',
        'Współpraca w zespole',
        'Przestrzeń współpracy',
        'Teamwork space',
        'Collaboration area',
      ];

      const result = anonymizer.advancedKAnonymity(responses, 3, 0.8);

      expect(result).toHaveProperty('compliant');
      expect(result).toHaveProperty('anonymizedResponses');
      expect(result).toHaveProperty('groups');
      expect(result).toHaveProperty('issues');
      expect(Array.isArray(result.groups)).toBe(true);
    });

    test('should verify GDPR compliance', async () => {
      const responses = [
        { answer: 'Jan Kowalski, jan@example.com', metadata: { userId: 1 } },
        { answer: 'Anna Nowak, telefon 123-456-789', metadata: { userId: 2 } },
      ];

      const complianceReport = await anonymizer.verifyGDPRCompliance(responses);

      expect(complianceReport).toHaveProperty('compliant');
      expect(complianceReport).toHaveProperty('issues');
      expect(complianceReport).toHaveProperty('recommendations');
      expect(Array.isArray(complianceReport.issues)).toBe(true);
    });

    test('should handle semantic grouping', async () => {
      const responses = [
        'lubimy współpracę',
        'współpraca jest ważna',
        'chcemy razem pracować',
        'brak współpracy',
        'konkurencja jest zła',
      ];

      const groups = await anonymizer.semanticGrouping(responses, 2);

      expect(groups).toHaveProperty('groups');
      expect(groups.groups).toHaveLength(2);
      expect(groups.groups[0]).toHaveProperty('responses');
      expect(groups.groups[0]).toHaveProperty('centroid');
    });
  });

  describe('Prompt Templates with Cultural Bias', () => {
    test('should add cultural bias instructions', () => {
      const basePrompt = 'Analyze these responses';
      const culturalContext = 'polish_workplace';
      const language = 'pl';

      const enhancedPrompt = promptTemplateService.addCulturalBiasInstructions(
        basePrompt,
        culturalContext,
        language
      );

      expect(enhancedPrompt).toContain(basePrompt);
      expect(enhancedPrompt).toContain('cultural context');
      expect(enhancedPrompt).toContain('polish_workplace');
    });

    test('should build sentiment analysis with cultural context', () => {
      const responses = [
        { answer: 'Jestem zadowolony', metadata: { userId: 1 } },
      ];

      const prompt = promptTemplateService.buildSentimentAnalysisPrompt(responses, {
        language: 'pl',
        enableCulturalBias: true,
        culturalContext: 'polish_communication',
      });

      expect(prompt).toContain('Polish communication context');
      expect(prompt).toContain('cultural nuances');
    });

    test('should validate prompt templates', () => {
      const template = 'thematic-analysis-v1';
      const variables = {
        responses: 'test',
        responseCount: 10,
        questionText: 'Test question',
        language: 'pl',
      };

      const validation = promptTemplateService.validateVariables(template, variables);

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('missing');
      expect(validation.valid).toBe(true);
    });
  });

  describe('Queue Management', () => {
    test('should get queue statistics', async () => {
      const queueStats = await enhancedWorker.getQueueStats();

      expect(queueStats).toHaveProperty('waiting');
      expect(queueStats).toHaveProperty('active');
      expect(queueStats).toHaveProperty('completed');
      expect(queueStats).toHaveProperty('failed');
    });

    test('should handle queue priorities', async () => {
      const highPriorityJob = {
        questionnaireId: 'high-priority',
        analysisType: 'thematic',
        options: {},
        priority: 10,
      };

      const jobId = await enhancedWorker.addJob(highPriorityJob);
      const status = await enhancedWorker.getJobStatus(jobId);

      expect(status).toHaveProperty('priority');
      expect(status.priority).toBe(10);
    });

    test('should manage queue throughput', async () => {
      const throughputStats = await enhancedWorker.getThroughputStats();

      expect(throughputStats).toHaveProperty('jobsPerMinute');
      expect(throughputStats).toHaveProperty('averageProcessingTime');
      expect(throughputStats).toHaveProperty('successRate');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should implement exponential backoff retry', async () => {
      const responses = [{ answer: 'Test', metadata: { userId: 1 } }];

      // Mock API failure followed by success
      let callCount = 0;
      jest.spyOn(enhancedWorker as any, 'callLLM')
        .mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            throw new Error('API Error');
          }
          return { content: '{"results": {}}', tokensUsed: 100 };
        });

      const result = await enhancedWorker.performAnalysis('thematic', responses, {
        maxRetries: 3,
      });

      expect(result).toBeDefined();
      expect(callCount).toBe(3);
    });

    test('should handle partial failures gracefully', async () => {
      const responses = Array.from({ length: 10 }, (_, i) => ({
        answer: `Response ${i}`,
        metadata: { userId: i },
      }));

      // Mock failure for some responses
      jest.spyOn(enhancedWorker as any, 'callLLM')
        .mockImplementation((prompt) => {
          if (prompt.includes('Response 5')) {
            throw new Error('Processing error');
          }
          return { content: '{"sentiment": "positive"}', tokensUsed: 50 };
        });

      const result = await enhancedWorker.batchAnalyze('sentiment', responses, {
        partialFailure: true,
      });

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('failures');
      expect(result.failures).toHaveLength(1);
    });

    test('should log errors appropriately', async () => {
      const loggerSpy = jest.spyOn(console, 'error').mockImplementation();

      await enhancedWorker.performAnalysis('thematic', [], {})
        .catch(() => {});

      expect(loggerSpy).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });
  });

  describe('Performance Metrics', () => {
    test('should provide detailed performance metrics', async () => {
      const metrics = await enhancedWorker.getPerformanceMetrics();

      expect(metrics).toHaveProperty('avgResponseTime');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('providerPerformance');
    });

    test('should track processing times', async () => {
      const startTime = Date.now();

      await enhancedWorker.performAnalysis('thematic',
        [{ answer: 'Test response', metadata: { userId: 1 } }],
        {}
      );

      const processingTime = Date.now() - startTime;

      const metrics = await enhancedWorker.getPerformanceMetrics();
      expect(metrics.avgResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    test('should manage cache size limits', async () => {
      // Fill cache beyond limit
      for (let i = 0; i < 1200; i++) {
        await enhancedWorker.performAnalysis('thematic',
          [{ answer: `Response ${i}`, metadata: { userId: i } }],
          {}
        );
      }

      const cacheStats = enhancedWorker.getCacheStats();
      expect(cacheStats.size).toBeLessThanOrEqual(1000); // Default cache limit
    });

    test('should clean up expired entries', async () => {
      // Add entries with immediate expiration
      enhancedWorker['cache'].set('test-key', {
        data: 'test',
        timestamp: Date.now() - 3600000, // 1 hour ago
      });

      await enhancedWorker.clearExpiredCache();

      expect(enhancedWorker['cache'].has('test-key')).toBe(false);
    });
  });

  describe('WebSocket Integration', () => {
    test('should handle job subscription', (done) => {
      clientSocket = ClientIO(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token: 'test-token' },
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe-job', { jobId: 'test-job-id' });
      });

      clientSocket.on('job-status', (data) => {
        expect(data).toHaveProperty('jobId');
        expect(data).toHaveProperty('status');
        done();
      });
    });

    test('should broadcast progress updates', (done) => {
      clientSocket = ClientIO(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token: 'test-token' },
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe-job', { jobId: 'test-job-id' });
      });

      clientSocket.on('job-progress', (data) => {
        expect(data).toHaveProperty('jobId');
        expect(data).toHaveProperty('progress');
        done();
      });

      // Simulate progress update
      setTimeout(() => {
        wsService.notifyJobStatusChange('test-job-id', 'processing', { progress: 50 });
      }, 100);
    });

    test('should handle authentication errors', (done) => {
      clientSocket = ClientIO(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token: 'invalid-token' },
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        done();
      });
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete analysis workflow', async () => {
      const responses = Array.from({ length: 20 }, (_, i) => ({
        answer: `To jest moja odpowiedź numer ${i}. ${i % 2 === 0 ? 'Lubię współpracę.' : 'Wolę ciszę.'}`,
        metadata: { userId: i, timeSpentMs: 1000 + i * 100 },
      }));

      const jobData = {
        questionnaireId: 'integration-test',
        analysisType: 'thematic',
        options: {
          language: 'pl',
          anonymizationLevel: 'full',
          enableCulturalBias: true,
          culturalContext: 'polish_workplace',
        },
      };

      const jobId = await enhancedWorker.addJob(jobData);
      expect(jobId).toBeDefined();

      const progress = await enhancedWorker.getJobProgress(jobId);
      expect(progress.percentage).toBeGreaterThanOrEqual(0);

      // Simulate completion
      const result = await enhancedWorker.performAnalysis('thematic', responses, jobData.options);

      expect(result).toHaveProperty('type', 'thematic');
      expect(result.results).toHaveProperty('themes');
      expect(Array.isArray(result.results.themes)).toBe(true);
    });

    test('should handle multiple analysis types in parallel', async () => {
      const responses = [
        { answer: 'Współpraca jest kluczowa', metadata: { userId: 1 } },
        { answer: 'Czasami się martwię', metadata: { userId: 2 } },
      ];

      const analyses = await Promise.all([
        enhancedWorker.performAnalysis('thematic', responses, { language: 'pl' }),
        enhancedWorker.performAnalysis('sentiment', responses, { language: 'pl' }),
        enhancedWorker.performAnalysis('clusters', responses, { language: 'pl' }),
      ]);

      expect(analyses).toHaveLength(3);
      expect(analyses[0].type).toBe('thematic');
      expect(analyses[1].type).toBe('sentiment');
      expect(analyses[2].type).toBe('clusters');
    });
  });
});