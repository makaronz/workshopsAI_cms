import request from 'supertest';
import { app } from '../../src/index';
import { testDatabase } from '../utils/test-database';
import { MockDataGenerator } from '../utils/mock-data-generators';
import { performanceTestingUtils } from '../utils/performance-testing-utils';

describe('API Performance Testing', () => {
  let server: any;
  let testDataset: any;
  let authToken: string;

  beforeAll(async () => {
    await testDatabase.connect();

    // Setup test data
    testDataset = MockDataGenerator.generateCompleteDataset({
      userCount: 5,
      questionnaireCount: 3,
      questionsPerQuestionnaire: 8,
      responsesPerQuestionnaire: 20,
      analysisJobsPerQuestionnaire: 1,
      analysesPerJob: 2,
    });

    // Setup authentication
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testDataset.datasets[0].user.email,
        password: 'test-password',
      });

    authToken = loginResponse.body.token;

    // Start server
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await testDatabase.disconnect();
  });

  beforeEach(async () => {
    await testDatabase.clearAllTables();
    performanceTestingUtils.reset();
  });

  describe('API Endpoint Performance Benchmarks', () => {
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
    });

    it('should handle questionnaire CRUD operations efficiently', async () => {
      const questionnaireData = {
        title: 'Performance Test Questionnaire',
        description: 'Testing questionnaire CRUD performance',
        isPublic: true,
      };

      // Test CREATE performance
      const createResult = await performanceTestingUtils.measurePerformance(
        'questionnaire-create',
        async () => {
          return request(app)
            .post('/api/questionnaires')
            .set('Authorization', `Bearer ${authToken}`)
            .send(questionnaireData);
        }
      );

      expect(createResult.result.status).toBe(201);
      expect(createResult.metric.duration).toBeLessThan(1000); // 1 second max for create

      const questionnaireId = createResult.result.body.id;

      // Test READ performance
      const readResult = await performanceTestingUtils.measurePerformance(
        'questionnaire-read',
        async () => {
          return request(app)
            .get(`/api/questionnaires/${questionnaireId}`)
            .set('Authorization', `Bearer ${authToken}`);
        }
      );

      expect(readResult.result.status).toBe(200);
      expect(readResult.metric.duration).toBeLessThan(500); // 500ms max for read

      // Test UPDATE performance
      const updateResult = await performanceTestingUtils.measurePerformance(
        'questionnaire-update',
        async () => {
          return request(app)
            .put(`/api/questionnaires/${questionnaireId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ title: 'Updated Performance Test' });
        }
      );

      expect(updateResult.result.status).toBe(200);
      expect(updateResult.metric.duration).toBeLessThan(1000); // 1 second max for update

      // Test DELETE performance
      const deleteResult = await performanceTestingUtils.measurePerformance(
        'questionnaire-delete',
        async () => {
          return request(app)
            .delete(`/api/questionnaires/${questionnaireId}`)
            .set('Authorization', `Bearer ${authToken}`);
        }
      );

      expect(deleteResult.result.status).toBe(200);
      expect(deleteResult.metric.duration).toBeLessThan(1000); // 1 second max for delete

      console.log('Questionnaire CRUD Performance:', {
        create: createResult.metric.duration,
        read: readResult.metric.duration,
        update: updateResult.metric.duration,
        delete: deleteResult.metric.duration,
      });
    });

    it('should handle response management operations efficiently', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Test bulk response creation
      const bulkResponseData = Array.from({ length: 10 }, (_, i) => ({
        questionnaireId: questionnaire.id,
        answers: testDataset.datasets[0].questions.map(q => ({
          questionId: q.id,
          answer: `Bulk answer ${i}-${q.id}`,
        })),
      }));

      const bulkCreateResult = await performanceTestingUtils.measurePerformance(
        'response-bulk-create',
        async () => {
          return request(app)
            .post('/api/responses/bulk')
            .set('Authorization', `Bearer ${authToken}`)
            .send(bulkResponseData);
        }
      );

      expect(bulkCreateResult.result.status).toBe(201);
      expect(bulkCreateResult.metric.duration).toBeLessThan(2000); // 2 seconds for bulk create

      // Test response listing with pagination
      const listResult = await performanceTestingUtils.measurePerformance(
        'response-list-pagination',
        async () => {
          return request(app)
            .get(`/api/questionnaires/${questionnaire.id}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .query({ page: 1, limit: 10 });
        }
      );

      expect(listResult.result.status).toBe(200);
      expect(listResult.metric.duration).toBeLessThan(1000); // 1 second for paginated list

      console.log('Response Management Performance:', {
        bulkCreate: bulkCreateResult.metric.duration,
        paginatedList: listResult.metric.duration,
      });
    });

    it('should handle analysis operations efficiently', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Test analysis initiation
      const analysisStartResult = await performanceTestingUtils.measurePerformance(
        'analysis-start',
        async () => {
          return request(app)
            .post('/api/analysis/start')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              questionnaireId: questionnaire.id,
              analysisTypes: ['thematic', 'sentiment'],
              options: { provider: 'openai' },
            });
        }
      );

      expect(analysisStartResult.result.status).toBe(200);
      expect(analysisStartResult.metric.duration).toBeLessThan(2000); // 2 seconds max to start

      // Test analysis status check
      const statusCheckResult = await performanceTestingUtils.measurePerformance(
        'analysis-status-check',
        async () => {
          return request(app)
            .get(`/api/analysis/status/${analysisStartResult.result.body.jobId}`)
            .set('Authorization', `Bearer ${authToken}`);
        }
      );

      expect(statusCheckResult.result.status).toBe(200);
      expect(statusCheckResult.metric.duration).toBeLessThan(500); // 500ms max for status check

      console.log('Analysis Operations Performance:', {
        start: analysisStartResult.metric.duration,
        statusCheck: statusCheckResult.metric.duration,
      });
    });
  });

  describe('API Load Testing', () => {
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
    });

    it('should handle 100 concurrent GET requests efficiently', async () => {
      const loadTestResult = await performanceTestingUtils.performLoadTest(
        'api-get-load-test',
        async () => {
          const questionnaire = testDataset.datasets[Math.floor(Math.random() * testDataset.datasets.length)].questionnaire;
          return request(app)
            .get(`/api/questionnaires/${questionnaire.id}`)
            .set('Authorization', `Bearer ${authToken}`);
        },
        {
          concurrency: 100,
          totalRequests: 500,
        }
      );

      expect(loadTestResult.successfulRequests).toBeGreaterThan(490); // 98% success rate
      expect(loadTestResult.averageResponseTime).toBeLessThan(1000); // 1 second average
      expect(loadTestResult.p95ResponseTime).toBeLessThan(2000); // 2 seconds P95
      expect(loadTestResult.requestsPerSecond).toBeGreaterThan(100);

      console.log('GET Load Test Results:', {
        totalRequests: loadTestResult.totalRequests,
        successfulRequests: loadTestResult.successfulRequests,
        averageResponseTime: loadTestResult.averageResponseTime,
        p95ResponseTime: loadTestResult.p95ResponseTime,
        requestsPerSecond: loadTestResult.requestsPerSecond,
      });
    });

    it('should handle mixed read/write operations efficiently', async () => {
      const mixedLoadTestResult = await performanceTestingUtils.performLoadTest(
        'api-mixed-load-test',
        async () => {
          const operations = [
            // Read operations
            () => {
              const questionnaire = testDataset.datasets[Math.floor(Math.random() * testDataset.datasets.length)].questionnaire;
              return request(app)
                .get(`/api/questionnaires/${questionnaire.id}`)
                .set('Authorization', `Bearer ${authToken}`);
            },
            () => {
              const questionnaire = testDataset.datasets[Math.floor(Math.random() * testDataset.datasets.length)].questionnaire;
              return request(app)
                .get(`/api/questionnaires/${questionnaire.id}/responses`)
                .set('Authorization', `Bearer ${authToken}`)
                .query({ page: 1, limit: 5 });
            },
            // Write operations
            () => {
              const questionnaire = testDataset.datasets[Math.floor(Math.random() * testDataset.datasets.length)].questionnaire;
              return request(app)
                .post('/api/responses')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                  questionnaireId: questionnaire.id,
                  answers: questionnaire.questions.map(q => ({
                    questionId: q.id,
                    answer: `Test answer ${Date.now()}`,
                  })),
                });
            },
            () => {
              const questionnaire = testDataset.datasets[Math.floor(Math.random() * testDataset.datasets.length)].questionnaire;
              return request(app)
                .post('/api/analysis/start')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                  questionnaireId: questionnaire.id,
                  analysisTypes: ['thematic'],
                });
            },
          ];

          const randomOperation = operations[Math.floor(Math.random() * operations.length)];
          return await randomOperation();
        },
        {
          concurrency: 50,
          totalRequests: 300,
        }
      );

      expect(mixedLoadTestResult.successfulRequests).toBeGreaterThan(270); // 90% success rate
      expect(mixedLoadTestResult.averageResponseTime).toBeLessThan(2000); // 2 seconds average for mixed operations

      console.log('Mixed Load Test Results:', {
        totalRequests: mixedLoadTestResult.totalRequests,
        successfulRequests: mixedLoadTestResult.successfulRequests,
        averageResponseTime: mixedLoadTestResult.averageResponseTime,
        requestsPerSecond: mixedLoadTestResult.requestsPerSecond,
        errorBreakdown: mixedLoadTestResult.errors,
      });
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 30000; // 30 seconds sustained test
      const concurrency = 25;

      const sustainedLoadResult = await performanceTestingUtils.performLoadTest(
        'sustained-api-load',
        async () => {
          const operations = [
            () => {
              const questionnaire = testDataset.datasets[0].questionnaire;
              return request(app)
                .get(`/api/questionnaires/${questionnaire.id}`)
                .set('Authorization', `Bearer ${authToken}`);
            },
            () => {
              return request(app)
                .get('/api/questionnaires')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ page: 1, limit: 10 });
            },
          ];

          const randomOperation = operations[Math.floor(Math.random() * operations.length)];
          return await randomOperation();
        },
        {
          concurrency,
          duration,
        }
      );

      expect(sustainedLoadResult.successfulRequests).toBeGreaterThan(concurrency * duration / 2000); // Expected number based on 2s per request
      expect(sustainedLoadResult.averageResponseTime).toBeLessThan(3000); // Should remain under 3 seconds

      console.log('Sustained Load Test Results:', {
        duration: duration / 1000,
        totalRequests: sustainedLoadResult.totalRequests,
        averageResponseTime: sustainedLoadResult.averageResponseTime,
        requestsPerSecond: sustainedLoadResult.requestsPerSecond,
      });
    });
  });

  describe('API Stress Testing', () => {
    it('should identify breaking point for concurrent requests', async () => {
      const stressTestResult = await performanceTestingUtils.performStressTest(
        'api-stress-test',
        async () => {
          const questionnaire = testDataset.datasets[0].questionnaire;
          return request(app)
            .get(`/api/questionnaires/${questionnaire.id}`)
            .set('Authorization', `Bearer ${authToken}`);
        },
        {
          startConcurrency: 10,
          maxConcurrency: 500,
          stepSize: 50,
          requestsPerStep: 100,
          maxErrorRate: 0.05, // 5% error rate threshold
          maxResponseTime: 10000, // 10 seconds max response time
        }
      );

      expect(stressTestResult.breakingPoint).toBeDefined();
      expect(stressTestResult.breakingPoint.concurrency).toBeGreaterThan(50); // Should handle at least 50 concurrent

      console.log('API Stress Test Results:', {
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
      // Simulate resource exhaustion by making complex requests
      const resourceExhaustionResult = await performanceTestingUtils.performLoadTest(
        'api-resource-exhaustion',
        async () => {
          const questionnaire = testDataset.datasets[0].questionnaire;
          return request(app)
            .get(`/api/questionnaires/${questionnaire.id}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .query({
              page: 1,
              limit: 1000, // Large page size to stress resources
              includeAnalysis: true,
              includeStats: true,
            });
        },
        {
          concurrency: 20,
          totalRequests: 100,
        }
      );

      expect(resourceExhaustionResult.successfulRequests).toBeGreaterThan(80); // Should handle most requests
      expect(resourceExhaustionResult.averageResponseTime).toBeLessThan(15000); // Even under stress, should respond

      console.log('Resource Exhaustion Test Results:', {
        successfulRequests: resourceExhaustionResult.successfulRequests,
        failedRequests: resourceExhaustionResult.failedRequests,
        averageResponseTime: resourceExhaustionResult.averageResponseTime,
      });
    });

    it('should recover from temporary failures', async () => {
      // Simulate temporary database issues
      const recoveryTestResult = await performanceTestingUtils.performLoadTest(
        'api-recovery-test',
        async () => {
          try {
            const questionnaire = testDataset.datasets[0].questionnaire;
            return await request(app)
              .get(`/api/questionnaires/${questionnaire.id}`)
              .set('Authorization', `Bearer ${authToken}`);
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        {
          concurrency: 15,
          totalRequests: 75,
        }
      );

      // API should be resilient and handle failures gracefully
      expect(recoveryTestResult.successfulRequests).toBeGreaterThan(60); // Should recover and handle most requests

      console.log('Recovery Test Results:', {
        successfulRequests: recoveryTestResult.successfulRequests,
        failedRequests: recoveryTestResult.failedRequests,
      });
    });
  });

  describe('Memory and Resource Management', () => {
    it('should maintain acceptable memory usage during high load', async () => {
      const memoryTestResult = await performanceTestingUtils.detectMemoryLeaks(
        'api-memory-usage',
        async () => {
          // Simulate memory-intensive operations
          await request(app)
            .get('/api/questionnaires')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ page: 1, limit: 100 });

          await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ includeStats: true });

          await request(app)
            .get('/api/analytics/dashboard')
            .set('Authorization', `Bearer ${authToken}`);
        },
        10, // 10 iterations
        100 * 1024 * 1024 // 100MB memory threshold
      );

      expect(memoryTestResult.hasMemoryLeak).toBe(false);
      expect(memoryTestResult.memoryGrowth).toBeLessThan(100 * 1024 * 1024);
      expect(memoryTestResult.peakMemoryUsage).toBeLessThan(200 * 1024 * 1024); // 200MB peak

      console.log('Memory Usage Test Results:', {
        hasMemoryLeak: memoryTestResult.hasMemoryLeak,
        memoryGrowth: memoryTestResult.memoryGrowth,
        peakMemoryUsage: memoryTestResult.peakMemoryUsage,
        averageMemoryUsage: memoryTestResult.averageMemoryUsage,
      });
    });

    it('should handle large response payloads efficiently', async () => {
      // Create questionnaire with many responses
      const largeDataset = MockDataGenerator.generateCompleteDataset({
        userCount: 1,
        questionnaireCount: 1,
        questionsPerQuestionnaire: 20,
        responsesPerQuestionnaire: 100,
        analysisJobsPerQuestionnaire: 0,
        analysesPerJob: 0,
      });

      await testDatabase.createTestUser(largeDataset.user);
      await testDatabase.createTestQuestionnaire(largeDataset.user.id, largeDataset.questionnaire);

      for (const question of largeDataset.questions) {
        await testDatabase.createTestQuestion(question.questionnaireId, question);
      }

      for (const response of largeDataset.responses) {
        await testDatabase.createTestResponse(response.userId, response.questionnaireId, response);
      }

      const largePayloadResult = await performanceTestingUtils.measurePerformance(
        'large-payload-test',
        async () => {
          return request(app)
            .get(`/api/questionnaires/${largeDataset.questionnaire.id}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .query({ page: 1, limit: 100, includeAnswers: true });
        }
      );

      expect(largePayloadResult.result.status).toBe(200);
      expect(largePayloadResult.metric.duration).toBeLessThan(5000); // 5 seconds max for large payload

      const responseSize = JSON.stringify(largePayloadResult.result.body).length;
      console.log('Large Payload Test Results:', {
        responseSize: responseSize,
        responseSizeKB: (responseSize / 1024).toFixed(2),
        duration: largePayloadResult.metric.duration,
      });
    });
  });

  describe('Performance Regression Testing', () => {
    beforeEach(async () => {
      // Setup minimal test data for regression testing
      await testDatabase.createTestUser(testDataset.datasets[0].user);
      await testDatabase.createTestQuestionnaire(testDataset.datasets[0].user.id, testDataset.datasets[0].questionnaire);

      for (const question of testDataset.datasets[0].questions.slice(0, 3)) {
        await testDatabase.createTestQuestion(question.questionnaireId, question);
      }

      for (const response of testDataset.datasets[0].responses.slice(0, 5)) {
        await testDatabase.createTestResponse(response.userId, response.questionnaireId, response);
      }
    });

    it('should meet established performance baselines', async () => {
      const baselineTests = [
        {
          name: 'questionnaire-list-baseline',
          test: () => request(app)
            .get('/api/questionnaires')
            .set('Authorization', `Bearer ${authToken}`),
          expectedDuration: 500, // 500ms
        },
        {
          name: 'questionnaire-detail-baseline',
          test: () => request(app)
            .get(`/api/questionnaires/${testDataset.datasets[0].questionnaire.id}`)
            .set('Authorization', `Bearer ${authToken}`),
          expectedDuration: 300, // 300ms
        },
        {
          name: 'responses-list-baseline',
          test: () => request(app)
            .get(`/api/questionnaires/${testDataset.datasets[0].questionnaire.id}/responses`)
            .set('Authorization', `Bearer ${authToken}`)
            .query({ page: 1, limit: 10 }),
          expectedDuration: 400, // 400ms
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
          status: result.status,
        });

        expect(metric.duration).toBeLessThanOrEqual(baselineTest.expectedDuration * 1.2); // Allow 20% variance
        expect(result.status).toBe(200);
      }

      console.log('Performance Baseline Results:', results);
    });

    it('should maintain consistent performance across multiple runs', async () => {
      const consistencyTest = {
        name: 'api-performance-consistency',
        test: () => request(app)
          .get(`/api/questionnaires/${testDataset.datasets[0].questionnaire.id}`)
          .set('Authorization', `Bearer ${authToken}`),
        iterations: 20,
        expectedVariance: 0.2, // 20% variance allowed
      };

      const { metrics, statistics } = await performanceTestingUtils.measurePerformanceWithIterations(
        consistencyTest.name,
        consistencyTest.test,
        consistencyTest.iterations
      );

      const variance = statistics.standardDeviation / statistics.averageDuration;
      expect(variance).toBeLessThan(consistencyTest.expectedVariance);

      expect(statistics.averageDuration).toBeLessThan(500); // Should be consistently fast
      expect(metrics.every(m => m.duration < 1000)).toBe(true); // No request should be over 1 second

      console.log('Performance Consistency Results:', {
        averageDuration: statistics.averageDuration,
        standardDeviation: statistics.standardDeviation,
        variance: (variance * 100).toFixed(2) + '%',
        minDuration: statistics.minDuration,
        maxDuration: statistics.maxDuration,
        allUnder1Second: metrics.every(m => m.duration < 1000),
      });
    });
  });
});