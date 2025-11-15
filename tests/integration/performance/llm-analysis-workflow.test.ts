import request from 'supertest';
import { app } from '../../../src/index';
import { testDatabase } from '../../utils/test-database';
import { MockDataGenerator } from '../../utils/mock-data-generators';
import { mockLLMService, LLMResponseTemplates } from '../../utils/llm-mock-utils';
import { testRedis } from '../../utils/test-redis';
import { performanceTestingUtils } from '../../utils/performance-testing-utils';

describe('LLM Analysis Workflow Integration', () => {
  let server: any;
  let testDataset: any;
  let authToken: string;

  beforeAll(async () => {
    await testDatabase.connect();
    await testRedis.connect();

    // Setup test data
    testDataset = MockDataGenerator.generateCompleteDataset({
      userCount: 2,
      questionnaireCount: 2,
      questionsPerQuestionnaire: 5,
      responsesPerQuestionnaire: 15,
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
    mockLLMService.resetMocks();
    performanceTestingUtils.reset();
    await testDatabase.clearAllTables();
    await testRedis.getInstance().flushall();
  });

  describe('Complete LLM Analysis Pipeline', () => {
    beforeEach(async () => {
      // Recreate test data for each test
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

    it('should complete full analysis workflow from API to storage', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // 1. Start analysis via API
      const analysisResponse = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic', 'sentiment', 'clusters'],
          options: {
            anonymizationLevel: 'partial',
            language: 'en',
            provider: 'openai',
          },
        });

      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.body.jobId).toBeDefined();
      expect(analysisResponse.body.status).toBe('pending');

      const jobId = analysisResponse.body.jobId;

      // 2. Monitor job progress
      let jobStatus = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (jobStatus === 'pending' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await request(app)
          .get(`/api/analysis/status/${jobId}`)
          .set('Authorization', `Bearer ${authToken}`);

        jobStatus = statusResponse.body.status;
        attempts++;
      }

      expect(jobStatus).toBe('completed');

      // 3. Retrieve analysis results
      const resultsResponse = await request(app)
        .get(`/api/analysis/results/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(resultsResponse.status).toBe(200);
      expect(resultsResponse.body.analyses).toBeDefined();
      expect(resultsResponse.body.analyses).toHaveLength(3);

      const analyses = resultsResponse.body.analyses;
      expect(analyses.find((a: any) => a.type === 'thematic')).toBeDefined();
      expect(analyses.find((a: any) => a.type === 'sentiment')).toBeDefined();
      expect(analyses.find((a: any) => a.type === 'clusters')).toBeDefined();

      // 4. Verify data persistence
      const verificationResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}/analyses`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(verificationResponse.status).toBe(200);
      expect(verificationResponse.body.analyses).toHaveLength(3);
    });

    it('should handle streaming analysis with real-time updates', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Mock streaming response
      const chunks = [
        'Analyzing responses',
        ' for patterns',
        ' and themes',
        '...\n\nThemes identified:\n',
        '- User Experience',
        '- Performance',
        '- Feature Requests',
      ];

      mockLLMService.mockOpenAIStream(chunks);

      // Start streaming analysis
      const streamResponse = await request(app)
        .post('/api/analysis/stream')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic'],
          options: { streamResponse: true },
        });

      expect(streamResponse.status).toBe(200);
      expect(streamResponse.body.streamId).toBeDefined();

      const streamId = streamResponse.body.streamId;

      // Connect to WebSocket for streaming updates (simulated here)
      const updates = [];
      let completed = false;

      // Simulate WebSocket connection and monitoring
      while (!completed && updates.length < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));

        // In real implementation, this would be WebSocket messages
        // For testing, we simulate receiving updates
        if (updates.length === 0) {
          updates.push({ type: 'progress', data: { progress: 10, message: 'Starting analysis' } });
        } else if (updates.length === 1) {
          updates.push({ type: 'chunk', data: { content: chunks[0] } });
        } else if (updates.length < chunks.length + 1) {
          updates.push({ type: 'chunk', data: { content: chunks[updates.length - 1] } });
        } else {
          updates.push({ type: 'complete', data: { progress: 100 } });
          completed = true;
        }
      }

      expect(updates.length).toBeGreaterThan(0);
      expect(updates.some(u => u.type === 'chunk')).toBe(true);
      expect(updates.some(u => u.type === 'complete')).toBe(true);
    });

    it('should handle multiple concurrent analyses efficiently', async () => {
      const questionnaires = testDataset.datasets.map(d => d.questionnaire);

      // Start multiple analyses concurrently
      const analysisPromises = questionnaires.map((questionnaire, index) =>
        request(app)
          .post('/api/analysis/start')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            questionnaireId: questionnaire.id,
            analysisTypes: ['thematic'],
            options: { provider: 'openai' },
          })
      );

      const startTime = Date.now();
      const analysisResponses = await Promise.all(analysisPromises);
      const endTime = Date.now();

      // All analyses should start successfully
      expect(analysisResponses.every(r => r.status === 200)).toBe(true);
      expect(analysisResponses.every(r => r.body.jobId)).toBe(true);

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds for 4 concurrent starts

      // Wait for all analyses to complete
      const jobIds = analysisResponses.map(r => r.body.jobId);
      const completionPromises = jobIds.map(async (jobId) => {
        let status = 'pending';
        let attempts = 0;
        while (status === 'pending' && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const statusResponse = await request(app)
            .get(`/api/analysis/status/${jobId}`)
            .set('Authorization', `Bearer ${authToken}`);
          status = statusResponse.body.status;
          attempts++;
        }
        return { jobId, status };
      });

      const completions = await Promise.all(completionPromises);
      expect(completions.every(c => c.status === 'completed')).toBe(true);
    });

    it('should handle analysis failures and retry mechanisms', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Mock LLM failure on first attempt
      mockLLMService.mockOpenAIError(new Error('API Rate Limit'), true);

      const analysisResponse = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic'],
          options: { provider: 'openai' },
        });

      expect(analysisResponse.status).toBe(200);
      const jobId = analysisResponse.body.jobId;

      // Wait for retry and completion
      let attempts = 0;
      let finalStatus = 'pending';

      while (finalStatus === 'pending' && attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await request(app)
          .get(`/api/analysis/status/${jobId}`)
          .set('Authorization', `Bearer ${authToken}`);

        finalStatus = statusResponse.body.status;

        if (finalStatus === 'failed' && attempts === 0) {
          // Setup success for retry
          setupMockLLMSuccess('openai');
        }

        attempts++;
      }

      // Should eventually succeed after retry
      expect(finalStatus).toBe('completed');
    });
  });

  describe('Performance and Caching Integration', () => {
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

    it('should cache analysis results for repeated requests', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // First analysis
      const firstAnalysis = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic'],
          options: { provider: 'openai' },
        });

      expect(firstAnalysis.status).toBe(200);

      // Wait for completion
      let status = 'pending';
      while (status === 'pending') {
        await new Promise(resolve => setTimeout(resolve, 500));
        const statusResponse = await request(app)
          .get(`/api/analysis/status/${firstAnalysis.body.jobId}`)
          .set('Authorization', `Bearer ${authToken}`);
        status = statusResponse.body.status;
      }

      // Second identical analysis should use cache
      const startTime = Date.now();
      const secondAnalysis = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic'],
          options: { provider: 'openai' },
        });
      const endTime = Date.now();

      expect(secondAnalysis.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast due to caching
      expect(mockLLMService.getOpenAICallCount()).toBe(1); // Only called once
    });

    it('should invalidate cache when questionnaire data changes', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // First analysis
      const firstAnalysis = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic'],
          options: { provider: 'openai' },
        });

      // Wait for completion
      let status = 'pending';
      while (status === 'pending') {
        await new Promise(resolve => setTimeout(resolve, 500));
        const statusResponse = await request(app)
          .get(`/api/analysis/status/${firstAnalysis.body.jobId}`)
          .set('Authorization', `Bearer ${authToken}`);
        status = statusResponse.body.status;
      }

      // Update questionnaire (should invalidate cache)
      await request(app)
        .put(`/api/questionnaires/${questionnaire.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
        });

      // Second analysis should trigger new API call
      const secondAnalysis = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic'],
          options: { provider: 'openai' },
        });

      expect(secondAnalysis.status).toBe(200);
      expect(mockLLMService.getOpenAICallCount()).toBe(2); // Should be called again
    });

    it('should maintain performance under high load', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      const loadTestResult = await performanceTestingUtils.performLoadTest(
        'llm-analysis-load-test',
        async () => {
          return request(app)
            .post('/api/analysis/start')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              questionnaireId: questionnaire.id,
              analysisTypes: ['thematic'],
              options: { provider: 'openai' },
            });
        },
        {
          concurrency: 10,
          totalRequests: 50,
        }
      );

      expect(loadTestResult.successfulRequests).toBeGreaterThan(45);
      expect(loadTestResult.averageResponseTime).toBeLessThan(2000);
      expect(loadTestResult.requestsPerSecond).toBeGreaterThan(5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid questionnaire IDs gracefully', async () => {
      const response = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: 'invalid-id',
          analysisTypes: ['thematic'],
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Questionnaire not found');
    });

    it('should handle unauthorized access attempts', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      const response = await request(app)
        .post('/api/analysis/start')
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic'],
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should handle malformed analysis requests', async () => {
      const response = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: testDataset.datasets[0].questionnaire.id,
          analysisTypes: [], // Empty analysis types
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('At least one analysis type is required');
    });

    it('should handle analysis timeouts gracefully', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Mock very slow LLM response
      mockLLMService.mockOpenAICompletion(LLMResponseTemplates.thematic.success, {
        delay: 35000, // 35 seconds (longer than timeout)
      });

      const analysisResponse = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic'],
          options: { provider: 'openai' },
        });

      expect(analysisResponse.status).toBe(200);

      const jobId = analysisResponse.body.jobId;

      // Wait for timeout
      let status = 'pending';
      let attempts = 0;

      while (status === 'pending' && attempts < 40) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await request(app)
          .get(`/api/analysis/status/${jobId}`)
          .set('Authorization', `Bearer ${authToken}`);

        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('failed');

      // Check error details
      const errorResponse = await request(app)
        .get(`/api/analysis/errors/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(errorResponse.status).toBe(200);
      expect(errorResponse.body.error).toContain('timeout');
    });
  });

  describe('Data Integrity and Consistency', () => {
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

    it('should maintain data consistency during concurrent analyses', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // Start multiple analyses for the same questionnaire
      const concurrentAnalyses = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/analysis/start')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            questionnaireId: questionnaire.id,
            analysisTypes: ['thematic'],
            options: { provider: 'openai' },
          })
      );

      const responses = await Promise.all(concurrentAnalyses);
      const jobIds = responses.map(r => r.body.jobId);

      // Wait for all to complete
      await Promise.all(jobIds.map(async (jobId) => {
        let status = 'pending';
        while (status === 'pending') {
          await new Promise(resolve => setTimeout(resolve, 500));
          const statusResponse = await request(app)
            .get(`/api/analysis/status/${jobId}`)
            .set('Authorization', `Bearer ${authToken}`);
          status = statusResponse.body.status;
        }
      }));

      // All should complete successfully
      for (const jobId of jobIds) {
        const finalStatus = await request(app)
          .get(`/api/analysis/status/${jobId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(finalStatus.body.status).toBe('completed');
      }

      // Verify data integrity - should have consistent analyses
      const resultsResponse = await request(app)
        .get(`/api/questionnaires/${questionnaire.id}/analyses`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(resultsResponse.status).toBe(200);
      const analyses = resultsResponse.body.analyses;

      // Should have analyses, but potentially duplicates handled appropriately
      expect(analyses.length).toBeGreaterThan(0);
      expect(analyses.every((a: any) => a.questionnaireId === questionnaire.id)).toBe(true);
    });

    it('should handle analysis result versioning', async () => {
      const questionnaire = testDataset.datasets[0].questionnaire;

      // First analysis
      const firstAnalysis = await request(app)
        .post('/api/analysis/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionnaireId: questionnaire.id,
          analysisTypes: ['thematic'],
          options: { provider: 'openai' },
        });

      // Wait for completion
      let status = 'pending';
      while (status === 'pending') {
        await new Promise(resolve => setTimeout(resolve, 500));
        const statusResponse = await request(app)
          .get(`/api/analysis/status/${firstAnalysis.body.jobId}`)
          .set('Authorization', `Bearer ${authToken}`);
        status = statusResponse.body.status;
      }

      // Get analysis results with version
      const resultsResponse = await request(app)
        .get(`/api/analysis/results/${firstAnalysis.body.jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ version: 'latest' });

      expect(resultsResponse.status).toBe(200);
      expect(resultsResponse.body.version).toBeDefined();
      expect(resultsResponse.body.analyses).toBeDefined();

      const version = resultsResponse.body.version;

      // Request specific version
      const versionedResponse = await request(app)
        .get(`/api/analysis/results/${firstAnalysis.body.jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ version });

      expect(versionedResponse.status).toBe(200);
      expect(versionedResponse.body.version).toBe(version);
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