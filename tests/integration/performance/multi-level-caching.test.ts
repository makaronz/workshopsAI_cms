import request from 'supertest';
import { app } from '../../../src/index';
import { testDatabase } from '../../utils/test-database';
import { MockDataGenerator } from '../../utils/mock-data-generators';
import { testRedis } from '../../utils/test-redis';
import { performanceTestingUtils } from '../../utils/performance-testing-utils';

describe('Multi-Level Caching Integration', () => {
  let server: any;
  let testDataset: any;
  let authToken: string;

  beforeAll(async () => {
    await testDatabase.connect();
    await testRedis.connect();

    // Setup test data
    testDataset = MockDataGenerator.generateCompleteDataset({
      userCount: 3,
      questionnaireCount: 2,
      questionsPerQuestionnaire: 5,
      responsesPerQuestionnaire: 10,
      analysisJobsPerQuestionnaire: 1,
      analysesPerJob: 1,
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
    await testRedis.disconnect();
  });

  beforeEach(async () => {
    performanceTestingUtils.reset();
    await testDatabase.clearAllTables();
    await testRedis.getInstance().flushall();
  });

  describe('L1 (Memory) Cache Integration', () => {
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

    it('should cache questionnaire data in memory', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // First request - should hit database
      const firstResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.id).toBe(questionnaire.id);

      // Second request - should hit L1 cache
      const startTime = Date.now();
      const secondResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      const endTime = Date.now();

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast from L1 cache
    });

    it('should handle L1 cache eviction correctly', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Fill cache with data
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get(`/api/questionnaires/${questionnaire.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ cacheKey: `test-key-${i}` });
      }

      // Cache should have evicted some entries
      const cacheStats = await request(app)
        .get('/api/cache/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cacheStats.status).toBe(200);
      expect(cacheStats.body.l1.size).toBeLessThanOrEqual(1000); // Max L1 cache size
    });

    it('should invalidate L1 cache when data changes', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // First request - populates cache
      const firstResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(firstResponse.status).toBe(200);

      // Update questionnaire
      await request(app)
        .put(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
        });

      // Next request should reflect update (cache invalidated)
      const updatedResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(updatedResponse.status).toBe(200);
      expect(updatedResponse.body.title).toBe('Updated Title');
      expect(updatedResponse.body.title).not.toBe(firstResponse.body.title);
    });
  });

  describe('L2 (Redis) Cache Integration', () => {
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

    it('should fallback to L2 cache when L1 misses', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // First request - populates both L1 and L2
      await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Clear L1 cache (simulate restart)
      await request(app)
        .post('/api/cache/clear-l1')
        .set('Authorization', `Bearer ${authToken}`);

      // Second request - should hit L2 cache
      const response = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(questionnaire.id);

      // Verify cache metrics
      const cacheStats = await request(app)
        .get('/api/cache/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cacheStats.body.l2.hits).toBeGreaterThan(0);
    });

    it('should handle L2 cache TTL expiration', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Request with short TTL
      await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ ttl: 1 }); // 1 second TTL

      // Should be cached initially
      let response = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Clear L1 to force L2 check
      await request(app)
        .post('/api/cache/clear-l1')
        .set('Authorization', `Bearer ${authToken}`);

      // Should miss L2 cache and hit database
      response = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      const cacheStats = await request(app)
        .get('/api/cache/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cacheStats.body.l2.misses).toBeGreaterThan(0);
    });

    it('should sync L1 and L2 cache correctly', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Request with sync enabled
      await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ sync: true });

      // Verify both caches have the data
      const cacheStatus = await request(app)
        .get('/api/cache/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cacheStatus.status).toBe(200);
      expect(cacheStatus.body.l1.size).toBeGreaterThan(0);
      expect(cacheStatus.body.l2.size).toBeGreaterThan(0);
    });
  });

  describe('Cache Tagging and Bulk Operations', () => {
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

    it('should support cache tagging for related data', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Cache questionnaire with tags
      await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ tags: 'questionnaire,user' });

      // Cache responses with related tags
      await request(app)
        .get(`/api/questionnaires/${questionnaire.id}/responses`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ tags: 'responses,questionnaire' });

      // Invalidate by tag
      await request(app)
        .post('/api/cache/invalidate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tags: ['questionnaire'] });

      // Both should be invalidated
      const questionnaireResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const responsesResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}/responses`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(questionnaireResponse.status).toBe(200);
      expect(responsesResponse.status).toBe(200);

      // Should have missed cache due to invalidation
      const cacheStats = await request(app)
        .get('/api/cache/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cacheStats.body.tagInvalidations).toBeGreaterThan(0);
    });

    it('should handle bulk cache operations efficiently', async () => {
      const questionnaires = testDataset.datasets.map(d => d.questionnaire);

      // Bulk cache multiple items
      const bulkResponse = await request(app)
        .post('/api/cache/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          operations: questionnaires.map(q => ({
            key: `questionnaire:${q.id}`,
            value: q,
            ttl: 3600,
            tags: ['questionnaire', 'bulk'],
          })),
        });

      expect(bulkResponse.status).toBe(200);
      expect(bulkResponse.body.successful).toBe(questionnaires.length);

      // Verify bulk retrieval
      const retrieveResponse = await request(app)
        .post('/api/cache/bulk-retrieve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keys: questionnaires.map(q => `questionnaire:${q.id}`),
        });

      expect(retrieveResponse.status).toBe(200);
      expect(retrieveResponse.body.results).toHaveLength(questionnaires.length);
      expect(retrieveResponse.body.results.every((r: any) => r.found)).toBe(true);
    });
  });

  describe('Cache Performance and Optimization', () => {
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

    it('should demonstrate cache performance benefits', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Measure uncached performance
      const uncachedResult = await performanceTestingUtils.measurePerformance(
        'uncached-request',
        async () => {
          await request(app)
            .get(`/api/questionnaires/${questionnaire.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .query({ bypassCache: true });
        }
      );

      // First cached request
      const firstCachedResult = await performanceTestingUtils.measurePerformance(
        'first-cached-request',
        async () => {
          await request(app)
            .get(`/api/questionnaires/${questionnaire.id}`)
            .set('Authorization', `Bearer ${authToken}`);
        }
      );

      // Subsequent cached request (L1 hit)
      const l1HitResult = await performanceTestingUtils.measurePerformance(
        'l1-cache-hit',
        async () => {
          await request(app)
            .get(`/api/questionnaires/${questionnaire.id}`)
            .set('Authorization', `Bearer ${authToken}`);
        }
      );

      // Performance should improve significantly
      expect(l1HitResult.metric.duration).toBeLessThan(firstCachedResult.metric.duration * 0.1);
      expect(firstCachedResult.metric.duration).toBeLessThan(uncachedResult.metric.duration);
    });

    it('should handle high-frequency cache operations efficiently', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      const loadTestResult = await performanceTestingUtils.performLoadTest(
        'cache-load-test',
        async () => {
          return request(app)
            .get(`/api/questionnaires/${questionnaire.id}`)
            .set('Authorization', `Bearer ${authToken}`);
        },
        {
          concurrency: 50,
          totalRequests: 1000,
        }
      );

      expect(loadTestResult.successfulRequests).toBeGreaterThan(990);
      expect(loadTestResult.averageResponseTime).toBeLessThan(100); // Very fast due to caching
      expect(loadTestResult.requestsPerSecond).toBeGreaterThan(100);

      // Verify cache hit rate
      const cacheStats = await request(app)
        .get('/api/cache/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cacheStats.body.overallHitRate).toBeGreaterThan(0.95); // 95% hit rate
    });

    it('should implement intelligent cache warming', async () => {
      const questionnaires = testDataset.datasets.map(d => d.questionnaire);

      // Trigger cache warming
      const warmupResponse = await request(app)
        .post('/api/cache/warmup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patterns: [
            { pattern: 'questionnaire:*', keys: questionnaires.map(q => q.id) },
            { pattern: 'user:*', keys: testDataset.datasets.map(d => d.user.id) },
          ],
        });

      expect(warmupResponse.status).toBe(200);
      expect(warmupResponse.body.warmedItems).toBeGreaterThan(0);

      // Subsequent requests should be fast
      const warmupTestResult = await performanceTestingUtils.measurePerformance(
        'warmup-test',
        async () => {
          const promises = questionnaires.map(q =>
            request(app)
              .get(`/api/questionnaires/${q.id}`)
              .set('Authorization', `Bearer ${authToken}`)
          );
          return Promise.all(promises);
        }
      );

      expect(warmupTestResult.metric.duration).toBeLessThan(1000); // Should be very fast
    });
  });

  describe('Cache Consistency and Reliability', () => {
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

    it('should handle cache write-through consistency', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Update with write-through
      const updateResponse = await request(app)
        .put(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Write-Through Test',
          cacheStrategy: 'write-through',
        });

      expect(updateResponse.status).toBe(200);

      // Verify both cache and database are updated
      const dbResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ bypassCache: true });

      const cacheResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(dbResponse.body.title).toBe('Write-Through Test');
      expect(cacheResponse.body.title).toBe('Write-Through Test');
    });

    it('should handle cache write-behind consistency', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Update with write-behind
      const updateResponse = await request(app)
        .put(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Write-Behind Test',
          cacheStrategy: 'write-behind',
        });

      expect(updateResponse.status).toBe(200);

      // Cache should be updated immediately
      const cacheResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(cacheResponse.body.title).toBe('Write-Behind Test');

      // Wait for write-behind to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Database should be updated
      const dbResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ bypassCache: true });

      expect(dbResponse.body.title).toBe('Write-Behind Test');
    });

    it('should handle cache failures gracefully', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Simulate cache failure
      await request(app)
        .post('/api/cache/simulate-failure')
        .set('Authorization', `Bearer ${authToken}`);

      // Requests should still work (fallback to database)
      const response = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(questionnaire.id);

      // Should have recorded cache failures
      const cacheStats = await request(app)
        .get('/api/cache/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cacheStats.body.failures).toBeGreaterThan(0);
    });

    it('should implement cache versioning for consistency', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Get initial version
      const initialResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(initialResponse.status).toBe(200);
      const initialVersion = initialResponse.headers['x-cache-version'];

      // Update questionnaire
      await request(app)
        .put(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Versioned Update',
        });

      // Get updated version
      const updatedResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(updatedResponse.status).toBe(200);
      expect(updatedResponse.body.title).toBe('Versioned Update');

      const updatedVersion = updatedResponse.headers['x-cache-version'];
      expect(updatedVersion).not.toBe(initialVersion);
    });
  });

  describe('Multi-Environment Cache Coordination', () => {
    it('should handle cache coordination across multiple instances', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Simulate multiple cache instances
      const instance1Response = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .header('X-Cache-Instance', 'instance-1');

      const instance2Response = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .header('X-Cache-Instance', 'instance-2');

      expect(instance1Response.status).toBe(200);
      expect(instance2Response.status).toBe(200);

      // Update from one instance
      await request(app)
        .put(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .header('X-Cache-Instance', 'instance-1')
        .send({
          title: 'Multi-Instance Update',
        });

      // Verify other instance sees update
      const updatedResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .header('X-Cache-Instance', 'instance-2');

      expect(updatedResponse.status).toBe(200);
      expect(updatedResponse.body.title).toBe('Multi-Instance Update');
    });

    it('should handle cache invalidation across distributed systems', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Cache data in multiple instances
      await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .header('X-Cache-Instance', 'instance-1');

      await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .header('X-Cache-Instance', 'instance-2');

      // Broadcast invalidation
      await request(app)
        .post('/api/cache/invalidate-distributed')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          key: `questionnaire:${questionnaire.id}`,
          instances: ['instance-1', 'instance-2'],
        });

      // Both instances should have invalidated cache
      const instance1Response = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .header('X-Cache-Instance', 'instance-1');

      const instance2Response = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .header('X-Cache-Instance', 'instance-2');

      expect(instance1Response.status).toBe(200);
      expect(instance2Response.status).toBe(200);

      // Should have missed cache due to invalidation
      const invalidationStats = await request(app)
        .get('/api/cache/invalidation-stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidationStats.body.distributedInvalidations).toBeGreaterThan(0);
    });
  });
});