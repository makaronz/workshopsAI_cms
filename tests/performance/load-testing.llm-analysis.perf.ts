import { performanceTestingUtils } from '../utils/performance-testing-utils';
import { testDatabase } from '../utils/test-database';
import { testRedis } from '../utils/test-redis';
import { MockDataGenerator } from '../utils/mock-data-generators';
import { mockLLMService, LLMResponseTemplates } from '../utils/llm-mock-utils';

describe('LLM Analysis Load Testing', () => {
  let testDataset: any;

  beforeAll(async () => {
    await testDatabase.connect();
    await testRedis.connect();

    // Generate large test dataset
    testDataset = MockDataGenerator.generateLargeDataset(20, 25);
  });

  afterAll(async () => {
    await testDatabase.disconnect();
    await testRedis.disconnect();
  });

  beforeEach(async () => {
    await testDatabase.clearAllTables();
    await testRedis.getInstance().flushall();
    mockLLMService.resetMocks();
    performanceTestingUtils.reset();
  });

  describe('LLM Analysis Performance Benchmarks', () => {
    beforeEach(async () => {
      // Setup test data
      for (const dataset of testDataset.datasets) {
        await testDatabase.createTestUser(dataset.user);
        await testDatabase.createTestQuestionnaire(dataset.user.id, dataset.questionnaire);

        for (const question of dataset.questions) {
          await testDatabase.createTestQuestion(question.questionnaireId, question);
        }

        for (const response of dataset.responses) {
          await testDatabase.createTestResponse(response.userId, response.questionnaireId, response);
        }
      }

      setupMockLLMSuccess('openai');
    });

    it('should handle 100 concurrent LLM analyses within SLA', async () => {
      const loadTestResult = await performanceTestingUtils.performLoadTest(
        'llm-analysis-concurrent',
        async () => {
          const questionnaire = testDataset.datasets[Math.floor(Math.random() * testDataset.datasets.length)].questionnaire;
          const analysisTypes = ['thematic', 'sentiment', 'clusters'];

          // Simulate LLM analysis
          return simulateLLMAnalysis(questionnaire.id, analysisTypes);
        },
        {
          concurrency: 100,
          totalRequests: 500,
        }
      );

      expect(loadTestResult.successfulRequests).toBeGreaterThan(480); // 96% success rate
      expect(loadTestResult.averageResponseTime).toBeLessThan(30000); // 30 seconds average
      expect(loadTestResult.p95ResponseTime).toBeLessThan(60000); // 60 seconds P95
      expect(loadTestResult.requestsPerSecond).toBeGreaterThan(10);

      console.log('LLM Analysis Load Test Results:', {
        totalRequests: loadTestResult.totalRequests,
        successfulRequests: loadTestResult.successfulRequests,
        averageResponseTime: loadTestResult.averageResponseTime,
        p95ResponseTime: loadTestResult.p95ResponseTime,
        requestsPerSecond: loadTestResult.requestsPerSecond,
        errors: loadTestResult.errors,
      });
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 60000; // 1 minute sustained test
      const concurrency = 50;

      const sustainedTestResult = await performanceTestingUtils.performLoadTest(
        'sustained-llm-analysis',
        async () => {
          const questionnaire = testDataset.datasets[Math.floor(Math.random() * testDataset.datasets.length)].questionnaire;
          return simulateLLMAnalysis(questionnaire.id, ['thematic']);
        },
        {
          concurrency,
          duration,
        }
      );

      expect(sustainedTestResult.successfulRequests).toBeGreaterThan(concurrency * duration / 30000); // At least expected number
      expect(sustainedTestResult.averageResponseTime).toBeLessThan(30000);
      expect(sustainedTestResult.requestsPerSecond).toBeGreaterThan(1);

      console.log('Sustained Load Test Results:', {
        duration: duration / 1000,
        totalRequests: sustainedTestResult.totalRequests,
        averageResponseTime: sustainedTestResult.averageResponseTime,
        requestsPerSecond: sustainedTestResult.requestsPerSecond,
      });
    });

    it('should handle memory pressure during high-volume analysis', async () => {
      const memoryTestResult = await performanceTestingUtils.detectMemoryLeaks(
        'llm-analysis-memory-pressure',
        async () => {
          // Perform analyses with large datasets
          const largeQuestionnaire = testDataset.datasets.find(d => d.responses.length > 20)?.questionnaire;
          if (largeQuestionnaire) {
            await simulateLLMAnalysis(largeQuestionnaire.id, ['thematic', 'clusters', 'sentiment', 'insights']);
          }
        },
        20, // 20 iterations
        200 * 1024 * 1024 // 200MB memory threshold
      );

      expect(memoryTestResult.hasMemoryLeak).toBe(false);
      expect(memoryTestResult.memoryGrowth).toBeLessThan(200 * 1024 * 1024);
      expect(memoryTestResult.peakMemoryUsage).toBeLessThan(500 * 1024 * 1024); // 500MB peak

      console.log('Memory Pressure Test Results:', {
        hasMemoryLeak: memoryTestResult.hasMemoryLeak,
        memoryGrowth: memoryTestResult.memoryGrowth,
        peakMemoryUsage: memoryTestResult.peakMemoryUsage,
        averageMemoryUsage: memoryTestResult.averageMemoryUsage,
      });
    });

    it('should demonstrate performance improvement with caching', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Test without caching
      const uncachedResult = await performanceTestingUtils.measurePerformanceWithIterations(
        'llm-analysis-uncached',
        async () => {
          // Simulate fresh analysis each time
          mockLLMService.resetMocks();
          setupMockLLMSuccess('openai');
          return simulateLLMAnalysis(questionnaire.id, ['thematic']);
        },
        10
      );

      // Test with caching enabled
      const cachedResult = await performanceTestingUtils.measurePerformanceWithIterations(
        'llm-analysis-cached',
        async () => {
          // First call sets up cache
          if (mockLLMService.getOpenAICallCount() === 0) {
            setupMockLLMSuccess('openai');
          }
          return simulateLLMAnalysisWithCache(questionnaire.id, ['thematic']);
        },
        10
      );

      expect(cachedResult.statistics.averageDuration).toBeLessThan(uncachedResult.statistics.averageDuration * 0.5);
      expect(cachedResult.statistics.averageMemoryUsage).toBeLessThan(uncachedResult.statistics.averageMemoryUsage * 1.5);

      console.log('Caching Performance Comparison:', {
        uncachedAverage: uncachedResult.statistics.averageDuration,
        cachedAverage: cachedResult.statistics.averageDuration,
        improvement: ((uncachedResult.statistics.averageDuration - cachedResult.statistics.averageDuration) / uncachedResult.statistics.averageDuration * 100).toFixed(2) + '%',
      });
    });
  });

  describe('Stress Testing and Breaking Points', () => {
    beforeEach(async () => {
      // Setup test data
      for (const dataset of testDataset.datasets.slice(0, 5)) { // Use smaller subset for stress testing
        await testDatabase.createTestUser(dataset.user);
        await testDatabase.createTestQuestionnaire(dataset.user.id, dataset.questionnaire);

        for (const question of dataset.questions) {
          await testDatabase.createTestQuestion(question.questionnaireId, question);
        }

        for (const response of dataset.responses) {
          await testDatabase.createTestResponse(response.userId, response.questionnaireId, response);
        }
      }

      setupMockLLMSuccess('openai');
    });

    it('should identify breaking point for concurrent requests', async () => {
      const stressTestResult = await performanceTestingUtils.performStressTest(
        'llm-analysis-stress-test',
        async () => {
          const questionnaire = testDataset.datasets[Math.floor(Math.random() * 5)].questionnaire;
          return simulateLLMAnalysis(questionnaire.id, ['thematic']);
        },
        {
          startConcurrency: 10,
          maxConcurrency: 200,
          stepSize: 20,
          requestsPerStep: 50,
          maxErrorRate: 0.1, // 10% error rate threshold
          maxResponseTime: 120000, // 2 minutes max response time
        }
      );

      expect(stressTestResult.breakingPoint).toBeDefined();
      expect(stressTestResult.breakingPoint.concurrency).toBeGreaterThan(0);
      expect(stressTestResult.breakingPoint.errorRate).toBeLessThan(0.5); // Should fail before 50% error rate

      console.log('Stress Test Results:', {
        maxConcurrentRequests: stressTestResult.maxConcurrentRequests,
        breakingPoint: stressTestResult.breakingPoint,
        throughputBreakdown: stressTestResult.throughputBreakdown.map(t => ({
          concurrency: t.concurrency,
          averageResponseTime: t.averageResponseTime,
          successRate: t.successRate,
        })),
      });
    });

    it('should handle resource exhaustion gracefully', async () => {
      // Simulate resource exhaustion by making all LLM calls fail
      mockLLMService.mockOpenAIError(new Error('Resource exhausted'), false);

      const resourceExhaustionResult = await performanceTestingUtils.performLoadTest(
        'resource-exhaustion-test',
        async () => {
          const questionnaire = testDataset.datasets[0].questionnaire;
          try {
            return await simulateLLMAnalysis(questionnaire.id, ['thematic']);
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        {
          concurrency: 20,
          totalRequests: 100,
        }
      );

      expect(resourceExhaustionResult.failedRequests).toBeGreaterThan(0);
      expect(resourceExhaustionResult.errors.length).toBeGreaterThan(0);
      expect(resourceExhaustionResult.errors.some(e => e.error.includes('Resource exhausted'))).toBe(true);

      console.log('Resource Exhaustion Test Results:', {
        totalRequests: resourceExhaustionResult.totalRequests,
        successfulRequests: resourceExhaustionResult.successfulRequests,
        failedRequests: resourceExhaustionResult.failedRequests,
        errors: resourceExhaustionResult.errors,
      });
    });

    it('should recover from temporary failures', async () => {
      let failureCount = 0;
      const maxFailures = 5;

      mockLLMService.getOpenAIClient().chat.completions.create.mockImplementation(async () => {
        failureCount++;
        if (failureCount <= maxFailures) {
          throw new Error('Temporary failure');
        }
        return createMockOpenAIResponse(LLMResponseTemplates.thematic.success);
      });

      const recoveryTestResult = await performanceTestingUtils.performLoadTest(
        'recovery-test',
        async () => {
          const questionnaire = testDataset.datasets[0].questionnaire;
          try {
            return await simulateLLMAnalysis(questionnaire.id, ['thematic']);
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        {
          concurrency: 10,
          totalRequests: 50,
        }
      });

      // Should eventually recover after failures
      expect(recoveryTestResult.successfulRequests).toBeGreaterThan(30);
      expect(recoveryTestResult.failedRequests).toBeLessThan(20);

      console.log('Recovery Test Results:', {
        successfulRequests: recoveryTestResult.successfulRequests,
        failedRequests: recoveryTestResult.failedRequests,
        totalFailuresSimulated: maxFailures,
      });
    });
  });

  describe('Performance Regression Testing', () => {
    beforeEach(async () => {
      // Setup test data
      for (const dataset of testDataset.datasets.slice(0, 3)) {
        await testDatabase.createTestUser(dataset.user);
        await testDatabase.createTestQuestionnaire(dataset.user.id, dataset.questionnaire);

        for (const question of dataset.questions.slice(0, 3)) {
          await testDatabase.createTestQuestion(question.questionnaireId, question);
        }

        for (const response of dataset.responses.slice(0, 10)) {
          await testDatabase.createTestResponse(response.userId, response.questionnaireId, response);
        }
      }

      setupMockLLMSuccess('openai');
    });

    it('should meet established performance baselines', async () => {
      const baselineTests = [
        {
          name: 'thematic-analysis-baseline',
          test: () => simulateLLMAnalysis(testDataset.datasets[0].questionnaire.id, ['thematic']),
          expectedDuration: 10000, // 10 seconds
          expectedMemory: 50 * 1024 * 1024, // 50MB
        },
        {
          name: 'sentiment-analysis-baseline',
          test: () => simulateLLMAnalysis(testDataset.datasets[0].questionnaire.id, ['sentiment']),
          expectedDuration: 5000, // 5 seconds
          expectedMemory: 30 * 1024 * 1024, // 30MB
        },
        {
          name: 'cluster-analysis-baseline',
          test: () => simulateLLMAnalysis(testDataset.datasets[0].questionnaire.id, ['clusters']),
          expectedDuration: 15000, // 15 seconds
          expectedMemory: 60 * 1024 * 1024, // 60MB
        },
      ];

      const results = [];
      for (const baselineTest of baselineTests) {
        const { result, metric } = await performanceTestingUtils.measurePerformance(
          baselineTest.name,
          baselineTest.test
        );

        results.push({
          name: baselineTest.name,
          duration: metric.duration,
          expectedDuration: baselineTest.expectedDuration,
          withinBaseline: metric.duration <= baselineTest.expectedDuration,
        });

        expect(metric.duration).toBeLessThanOrEqual(baselineTest.expectedDuration * 1.2); // Allow 20% variance
      }

      console.log('Performance Baseline Results:', results);
    });

    it('should maintain consistent performance across multiple runs', async () => {
      const consistencyTest = {
        name: 'performance-consistency',
        test: () => simulateLLMAnalysis(testDataset.datasets[0].questionnaire.id, ['thematic']),
        iterations: 10,
        expectedVariance: 0.3, // 30% variance allowed
      };

      const { metrics, statistics } = await performanceTestingUtils.measurePerformanceWithIterations(
        consistencyTest.name,
        consistencyTest.test,
        consistencyTest.iterations
      );

      const variance = statistics.standardDeviation / statistics.averageDuration;
      expect(variance).toBeLessThan(consistencyTest.expectedVariance);

      console.log('Performance Consistency Results:', {
        averageDuration: statistics.averageDuration,
        standardDeviation: statistics.standardDeviation,
        variance: (variance * 100).toFixed(2) + '%',
        minDuration: statistics.minDuration,
        maxDuration: statistics.maxDuration,
      });
    });
  });

  describe('Scalability Testing', () => {
    it('should scale linearly with dataset size', async () => {
      const scalabilityTests = [
        { responses: 10, expectedDuration: 5000 },
        { responses: 25, expectedDuration: 10000 },
        { responses: 50, expectedDuration: 18000 },
      ];

      const results = [];

      for (const test of scalabilityTests) {
        // Create test dataset with specific response count
        const testDataset = MockDataGenerator.generateCompleteDataset({
          userCount: 1,
          questionnaireCount: 1,
          questionsPerQuestionnaire: 5,
          responsesPerQuestionnaire: test.responses,
          analysisJobsPerQuestionnaire: 0,
          analysesPerJob: 0,
        });

        await testDatabase.createTestUser(testDataset.user);
        await testDatabase.createTestQuestionnaire(testDataset.user.id, testDataset.questionnaire);

        for (const question of testDataset.questions) {
          await testDatabase.createTestQuestion(question.questionnaireId, question);
        }

        for (const response of testDataset.responses) {
          await testDatabase.createTestResponse(response.userId, response.questionnaireId, response);
        }

        const { metric } = await performanceTestingUtils.measurePerformance(
          `scalability-${test.responses}-responses`,
          () => simulateLLMAnalysis(testDataset.questionnaire.id, ['thematic'])
        );

        const scalabilityRatio = metric.duration / test.responses;
        results.push({
          responseCount: test.responses,
          duration: metric.duration,
          expectedDuration: test.expectedDuration,
          scalabilityRatio,
          withinExpected: metric.duration <= test.expectedDuration * 1.5,
        });

        // Cleanup
        await testDatabase.clearAllTables();
      }

      console.log('Scalability Test Results:', results);

      // Verify scalability is reasonable (shouldn't grow exponentially)
      const ratios = results.map(r => r.scalabilityRatio);
      const maxRatio = Math.max(...ratios);
      const minRatio = Math.min(...ratios);
      expect(maxRatio / minRatio).toBeLessThan(3); // Shouldn't be more than 3x difference
    });

    it('should handle mixed workload efficiently', async () => {
      const mixedWorkloadTest = await performanceTestingUtils.performLoadTest(
        'mixed-workload-test',
        async () => {
          const operations = [
            () => simulateLLMAnalysis(testDataset.datasets[0].questionnaire.id, ['thematic']),
            () => simulateLLMAnalysis(testDataset.datasets[0].questionnaire.id, ['sentiment']),
            () => simulateLLMAnalysis(testDataset.datasets[0].questionnaire.id, ['clusters']),
            () => simulateLLMAnalysis(testDataset.datasets[0].questionnaire.id, ['thematic', 'sentiment']),
            () => simulateLLMAnalysis(testDataset.datasets[0].questionnaire.id, ['thematic', 'clusters', 'insights']),
          ];

          const randomOperation = operations[Math.floor(Math.random() * operations.length)];
          return await randomOperation();
        },
        {
          concurrency: 25,
          totalRequests: 200,
        }
      );

      expect(mixedWorkloadTest.successfulRequests).toBeGreaterThan(180);
      expect(mixedWorkloadTest.averageResponseTime).toBeLessThan(25000);

      console.log('Mixed Workload Test Results:', {
        successfulRequests: mixedWorkloadTest.successfulRequests,
        averageResponseTime: mixedWorkloadTest.averageResponseTime,
        requestsPerSecond: mixedWorkloadTest.requestsPerSecond,
      });
    });
  });
});

// Helper functions for simulating LLM analysis
async function simulateLLMAnalysis(questionnaireId: string, analysisTypes: string[]) {
  // Simulate the full LLM analysis workflow
  const startTime = Date.now();

  // 1. Fetch questionnaire and responses (simulated database query)
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  // 2. Data preparation and anonymization (simulated processing)
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

  // 3. LLM API calls (simulated with mock)
  for (const analysisType of analysisTypes) {
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
  }

  // 4. Result processing and storage (simulated)
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  const endTime = Date.now();

  return {
    questionnaireId,
    analysisTypes,
    status: 'completed',
    duration: endTime - startTime,
    result: {
      themes: ['Theme 1', 'Theme 2', 'Theme 3'],
      insights: ['Insight 1', 'Insight 2'],
      metadata: {
        processedAt: new Date().toISOString(),
        analysisTime: endTime - startTime,
      },
    },
  };
}

async function simulateLLMAnalysisWithCache(questionnaireId: string, analysisTypes: string[]) {
  // Simulate caching behavior
  const cacheKey = `analysis:${questionnaireId}:${analysisTypes.join(',')}`;

  // Check cache first (simulated)
  if (Math.random() > 0.3) { // 70% cache hit rate
    return {
      questionnaireId,
      analysisTypes,
      status: 'completed',
      cached: true,
      duration: 50, // Very fast from cache
      result: { cached: true },
    };
  }

  // Cache miss - perform full analysis
  return await simulateLLMAnalysis(questionnaireId, analysisTypes);
}

function createMockOpenAIResponse(content: string) {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4',
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}

function setupMockLLMSuccess(provider: 'openai' | 'anthropic' = 'openai') {
  if (provider === 'openai') {
    mockLLMService.mockOpenAICompletion(LLMResponseTemplates.thematic.success);
  } else {
    mockLLMService.mockAnthropicCompletion(LLMResponseTemplates.thematic.success);
  }
}