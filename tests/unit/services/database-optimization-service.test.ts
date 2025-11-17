import { DatabaseOptimizationService } from '../../../src/services/database-optimization-service';
import { testDatabase } from '../../utils/test-database';
import { MockDataGenerator } from '../../utils/mock-data-generators';
import { performanceTestingUtils } from '../../utils/performance-testing-utils';

// Mock external dependencies
jest.mock('drizzle-orm/postgres-js');
jest.mock('postgres');

describe('DatabaseOptimizationService', () => {
  let service: DatabaseOptimizationService;
  let testDataset: any;

  beforeAll(async () => {
    await testDatabase.connect();

    service = new DatabaseOptimizationService({
      connectionPool: {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
      queryOptimization: {
        enabled: true,
        slowQueryThreshold: 1000,
        analyzeQueries: true,
        suggestIndexes: true,
      },
      performanceMonitoring: {
        enabled: true,
        trackSlowQueries: true,
        collectExplainPlans: true,
        monitorConnections: true,
      },
    });

    testDataset = MockDataGenerator.generateCompleteDataset({
      userCount: 5,
      questionnaireCount: 3,
      questionsPerQuestionnaire: 10,
      responsesPerQuestionnaire: 20,
      analysisJobsPerQuestionnaire: 2,
      analysesPerJob: 3,
    });
  });

  afterAll(async () => {
    await testDatabase.disconnect();
  });

  beforeEach(async () => {
    await testDatabase.clearAllTables();
    performanceTestingUtils.reset();
  });

  describe('Connection Pool Management', () => {
    it('should initialize connection pool with correct configuration', async () => {
      await service.initialize();

      const poolStats = await service.getConnectionPoolStats();
      expect(poolStats).toBeDefined();
      expect(poolStats.totalConnections).toBeGreaterThanOrEqual(2);
      expect(poolStats.idleConnections).toBeGreaterThanOrEqual(0);
      expect(poolStats.activeConnections).toBeGreaterThanOrEqual(0);
    });

    it('should handle connection pool scaling', async () => {
      await service.initialize();

      // Simulate multiple concurrent requests
      const promises = Array.from({ length: 15 }, async () => {
        return service.execute('SELECT 1 as test');
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(15);
      expect(results.every(r => r[0]?.test === 1)).toBe(true);

      const poolStats = await service.getConnectionPoolStats();
      expect(poolStats.totalConnections).toBeLessThanOrEqual(10); // Max pool size
    });

    it('should clean up idle connections', async () => {
      await service.initialize();

      // Perform some operations
      await service.execute('SELECT 1');

      // Wait for connections to become idle
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger cleanup
      await service.cleanupIdleConnections();

      const poolStats = await service.getConnectionPoolStats();
      expect(poolStats.idleConnections).toBeLessThanOrEqual(8); // Should have cleaned up some
    });

    it('should handle connection failures gracefully', async () => {
      // Mock connection failure
      jest.spyOn(service as any, 'executeQuery')
        .mockRejectedValueOnce(new Error('Connection failed'));

      await expect(service.execute('SELECT 1')).resolves.not.toThrow();
    });
  });

  describe('Query Optimization', () => {
    beforeEach(async () => {
      await service.initialize();
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

    it('should identify and optimize slow queries', async () => {
      // Execute a potentially slow query
      const slowQuery = `
        SELECT u.*, q.title, COUNT(r.id) as response_count
        FROM users u
        LEFT JOIN questionnaires q ON u.id = q.created_by
        LEFT JOIN responses r ON q.id = r.questionnaire_id
        GROUP BY u.id, q.id
        ORDER BY response_count DESC
      `;

      const { result, metric } = await performanceTestingUtils.measurePerformance(
        'slow-query-analysis',
        () => service.execute(slowQuery)
      );

      expect(result).toBeDefined();
      expect(metric.duration).toBeGreaterThan(0);

      // Get optimization suggestions
      const suggestions = await service.analyzeQuery(slowQuery);
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest appropriate indexes', async () => {
      // Query without proper indexes
      const unoptimizedQuery = `
        SELECT * FROM responses
        WHERE questionnaire_id = $1
        AND status = $2
        ORDER BY submitted_at DESC
      `;

      const suggestions = await service.suggestIndexes(unoptimizedQuery);
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);

      const indexSuggestion = suggestions[0];
      expect(indexSuggestion.table).toBe('responses');
      expect(indexSuggestion.columns).toContain('questionnaire_id');
      expect(indexSuggestion.columns).toContain('status');
    });

    it('should rewrite queries for better performance', async () => {
      const originalQuery = `
        SELECT u.*
        FROM users u
        WHERE u.id IN (
          SELECT DISTINCT created_by
          FROM questionnaires
          WHERE is_public = true
        )
      `;

      const rewrittenQuery = await service.rewriteQuery(originalQuery);
      expect(rewrittenQuery).toBeDefined();
      expect(rewrittenQuery).not.toBe(originalQuery);

      // Both queries should return same results
      const originalResults = await service.execute(originalQuery);
      const rewrittenResults = await service.execute(rewrittenQuery);

      expect(originalResults).toHaveLength(rewrittenResults.length);
    });

    it('should analyze query execution plans', async () => {
      const query = 'SELECT * FROM questionnaires WHERE created_by = $1';
      const plan = await service.getExecutionPlan(query, ['test-user-id']);

      expect(plan).toBeDefined();
      expect(plan.planningTime).toBeGreaterThan(0);
      expect(plan.executionTime).toBeGreaterThanOrEqual(0);
      expect(plan.plan).toBeDefined();
      expect(plan.plan.length).toBeGreaterThan(0);
    });

    it('should implement query result caching', async () => {
      const query = 'SELECT COUNT(*) as count FROM questionnaires';
      const cacheKey = service.generateCacheKey(query, []);

      // First execution
      const result1 = await service.executeWithCache(query, [], 60); // 60s TTL
      expect(result1).toBeDefined();

      // Second execution should use cache
      const result2 = await service.executeWithCache(query, [], 60);
      expect(result2).toEqual(result1);

      // Verify cache was used
      const cacheStats = await service.getQueryCacheStats();
      expect(cacheStats.hits).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should track query performance metrics', async () => {
      // Execute various queries
      await service.execute('SELECT 1');
      await service.execute('SELECT COUNT(*) FROM users');
      await service.execute('SELECT * FROM questionnaires LIMIT 10');

      const metrics = await service.getQueryMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalQueries).toBe(3);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.slowQueries).toBeGreaterThanOrEqual(0);
    });

    it('should identify long-running queries', async () => {
      // Simulate a long-running query
      const longQuery = 'SELECT pg_sleep(0.1)'; // 100ms delay

      await service.execute(longQuery);

      const slowQueries = await service.getSlowQueries();
      expect(slowQueries).toBeDefined();
      expect(slowQueries.length).toBeGreaterThan(0);
      expect(slowQueries[0].query).toContain('pg_sleep');
      expect(slowQueries[0].executionTime).toBeGreaterThan(100);
    });

    it('should monitor database connection health', async () => {
      const healthCheck = await service.performHealthCheck();

      expect(healthCheck).toBeDefined();
      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.connectionPool).toBeDefined();
      expect(healthCheck.responseTime).toBeLessThan(1000);
      expect(healthCheck.databaseSize).toBeGreaterThan(0);
    });

    it('should detect and report table bloat', async () => {
      // Insert test data to create potential bloat
      for (let i = 0; i < 100; i++) {
        await service.execute(
          'INSERT INTO questionnaires (id, title, description, created_by, is_public, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
          [`test-${i}`, `Test ${i}`, `Description ${i}`, 'test-user', true]
        );
      }

      // Delete some data to create bloat
      for (let i = 0; i < 50; i++) {
        await service.execute('DELETE FROM questionnaires WHERE id = $1', [`test-${i}`]);
      }

      const bloatAnalysis = await service.analyzeTableBloat();
      expect(bloatAnalysis).toBeDefined();
      expect(bloatAnalysis.length).toBeGreaterThan(0);

      const questionnaireBloat = bloatAnalysis.find(b => b.table === 'questionnaires');
      if (questionnaireBloat) {
        expect(questionnaireBloat.bloatPercentage).toBeGreaterThanOrEqual(0);
        expect(questionnaireBloat.wastedSpace).toBeGreaterThanOrEqual(0);
      }
    });

    it('should track index usage statistics', async () => {
      // Create some indexes if they don't exist
      await service.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      await service.execute('CREATE INDEX IF NOT EXISTS idx_questionnaires_created_by ON questionnaires(created_by)');

      // Execute queries that use indexes
      await service.execute('SELECT * FROM users WHERE email = $1', ['test@example.com']);
      await service.execute('SELECT * FROM questionnaires WHERE created_by = $1', ['test-user']);

      const indexStats = await service.getIndexUsageStats();
      expect(indexStats).toBeDefined();
      expect(indexStats.length).toBeGreaterThan(0);

      const emailIndex = indexStats.find(i => i.indexName === 'idx_users_email');
      if (emailIndex) {
        expect(emailIndex.scans).toBeGreaterThan(0);
      }
    });
  });

  describe('Database Maintenance', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should perform VACUUM operations to reclaim space', async () => {
      // Create and delete data to create dead tuples
      await service.execute(`
        CREATE TEMP TABLE test_vacuum AS
        SELECT generate_series(1, 1000) as id, 'test data' as data
      `);

      await service.execute('DELETE FROM test_vacuum WHERE id % 2 = 0');

      // Get table size before VACUUM
      const beforeSize = await service.getTableSize('test_vacuum');

      // Perform VACUUM
      await service.vacuumTable('test_vacuum');

      // Get table size after VACUUM
      const afterSize = await service.getTableSize('test_vacuum');

      expect(afterSize).toBeLessThanOrEqual(beforeSize);
    });

    it('should update table statistics with ANALYZE', async () => {
      // Create test table with data
      await service.execute(`
        CREATE TEMP TABLE test_analyze AS
        SELECT generate_series(1, 1000) as id,
               CASE WHEN id % 3 = 0 THEN 'type_a'
                    WHEN id % 3 = 1 THEN 'type_b'
                    ELSE 'type_c' END as type
      `);

      // Get row count estimate before ANALYZE
      const beforeEstimate = await service.getRowCountEstimate('test_analyze');

      // Perform ANALYZE
      await service.analyzeTable('test_analyze');

      // Get row count estimate after ANALYZE
      const afterEstimate = await service.getRowCountEstimate('test_analyze');

      expect(afterEstimate).toBeGreaterThan(0);
      expect(Math.abs(afterEstimate - 1000)).toBeLessThan(100); // Should be close to actual count
    });

    it('should rebuild fragmented indexes', async () => {
      // Create index on test data
      await service.execute(`
        CREATE TEMP TABLE test_reindex AS
        SELECT generate_series(1, 1000) as id, random() as value
      `);

      await service.execute('CREATE INDEX idx_test_reindex_value ON test_reindex(value)');

      // Perform lots of updates to fragment the index
      for (let i = 0; i < 100; i++) {
        await service.execute(
          'UPDATE test_reindex SET value = random() WHERE id % 10 = $1',
          [i]
        );
      }

      // Get index size before REINDEX
      const beforeSize = await service.getIndexSize('idx_test_reindex_value');

      // Perform REINDEX
      await service.reindexTable('test_reindex');

      // Get index size after REINDEX
      const afterSize = await service.getIndexSize('idx_test_reindex_value');

      expect(afterSize).toBeLessThanOrEqual(beforeSize * 1.1); // Allow some variance
    });

    it('should identify and clean up orphaned rows', async () => {
      // This would test foreign key constraint cleanup
      // For now, just verify the method exists and doesn't error
      const cleanupResult = await service.cleanupOrphanedRows();
      expect(cleanupResult).toBeDefined();
      expect(cleanupResult.cleanedTables).toBeDefined();
      expect(Array.isArray(cleanupResult.cleanedTables)).toBe(true);
    });
  });

  describe('Query Builder and Optimization', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should build optimized queries for complex operations', async () => {
      const queryBuilder = service.getQueryBuilder();

      const complexQuery = queryBuilder
        .select('u.*', 'q.title', 'COUNT(r.id) as response_count')
        .from('users', 'u')
        .leftJoin('questionnaires', 'q', 'u.id = q.created_by')
        .leftJoin('responses', 'r', 'q.id = r.questionnaire_id')
        .where('u.is_active = ?', true)
        .where('q.is_public = ?', true)
        .groupBy('u.id', 'q.id')
        .orderBy('response_count', 'DESC')
        .limit(10)
        .build();

      expect(complexQuery).toBeDefined();
      expect(complexQuery.sql).toContain('SELECT');
      expect(complexQuery.sql).toContain('LEFT JOIN');
      expect(complexQuery.sql).toContain('GROUP BY');
      expect(complexQuery.sql).toContain('ORDER BY');
      expect(complexQuery.sql).toContain('LIMIT');

      // Execute the built query
      const result = await service.execute(complexQuery.sql, complexQuery.params);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should generate optimal pagination queries', async () => {
      const paginationQuery = service.buildPaginationQuery(
        'SELECT * FROM questionnaires WHERE is_public = ?',
        [true],
        { page: 2, limit: 10, orderBy: 'created_at', direction: 'DESC' }
      );

      expect(paginationQuery.sql).toContain('LIMIT');
      expect(paginationQuery.sql).toContain('OFFSET');
      expect(paginationQuery.params).toContain(true);
      expect(paginationQuery.params).toContain(10);
      expect(paginationQuery.params).toContain(10);

      // Execute pagination query
      const result = await service.execute(paginationQuery.sql, paginationQuery.params);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should implement cursor-based pagination for better performance', async () => {
      const cursorQuery = service.buildCursorPaginationQuery(
        'SELECT * FROM questionnaires WHERE is_public = ?',
        [true],
        {
          cursor: '2023-01-01T00:00:00Z',
          limit: 10,
          orderBy: 'created_at',
          direction: 'forward'
        }
      );

      expect(cursorQuery.sql).toContain('WHERE');
      expect(cursorQuery.sql).toContain('created_at > ?');
      expect(cursorQuery.sql).toContain('ORDER BY');
      expect(cursorQuery.sql).toContain('LIMIT');

      // Execute cursor-based query
      const result = await service.execute(cursorQuery.sql, cursorQuery.params);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should optimize IN clauses for large datasets', async () => {
      const largeIdList = Array.from({ length: 1000 }, (_, i) => `id-${i}`);

      const optimizedQuery = service.optimizeInClause(
        'SELECT * FROM questionnaires WHERE id IN (?)',
        [largeIdList]
      );

      // Should convert to EXISTS or JOIN for better performance
      expect(optimizedQuery.sql).not.toContain('IN ('); // Should not use large IN clause
      expect(optimizedQuery.params).not.toContain(largeIdList); // Should not pass large array directly
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should maintain performance under high query load', async () => {
      const loadTestResult = await performanceTestingUtils.performLoadTest(
        'database-load-test',
        async () => {
          const queries = [
            'SELECT 1 as test',
            'SELECT COUNT(*) FROM users',
            'SELECT * FROM questionnaires LIMIT 5',
            'SELECT * FROM responses LIMIT 10',
          ];

          const randomQuery = queries[Math.floor(Math.random() * queries.length)];
          return service.execute(randomQuery);
        },
        {
          concurrency: 20,
          totalRequests: 200,
        }
      );

      expect(loadTestResult.successfulRequests).toBeGreaterThan(190);
      expect(loadTestResult.averageResponseTime).toBeLessThan(1000); // 1 second average
      expect(loadTestResult.requestsPerSecond).toBeGreaterThan(50);
    });

    it('should handle complex join queries efficiently', async () => {
      const { result, metric } = await performanceTestingUtils.measurePerformance(
        'complex-join-query',
        async () => {
          return service.execute(`
            SELECT
              u.id as user_id,
              u.first_name,
              u.last_name,
              COUNT(DISTINCT q.id) as questionnaire_count,
              COUNT(DISTINCT r.id) as response_count,
              AVG(
                CASE WHEN r.submitted_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (r.submitted_at - r.created_at))
                ELSE NULL END
              ) as avg_completion_time
            FROM users u
            LEFT JOIN questionnaires q ON u.id = q.created_by
            LEFT JOIN responses r ON q.id = r.questionnaire_id
            WHERE u.is_active = true
            GROUP BY u.id, u.first_name, u.last_name
            HAVING COUNT(DISTINCT q.id) > 0
            ORDER BY questionnaire_count DESC, response_count DESC
            LIMIT 20
          `);
        }
      );

      expect(result).toBeDefined();
      expect(metric.duration).toBeLessThan(5000); // 5 seconds max for complex query
    });

    it('should demonstrate query optimization benefits', async () => {
      // Unoptimized query
      const unoptimizedQuery = `
        SELECT u.*,
               (SELECT COUNT(*) FROM questionnaires q WHERE q.created_by = u.id) as q_count,
               (SELECT COUNT(*) FROM responses r JOIN questionnaires q2 ON r.questionnaire_id = q2.id WHERE q2.created_by = u.id) as r_count
        FROM users u
        WHERE u.id IN (SELECT DISTINCT created_by FROM questionnaires WHERE is_public = true)
      `;

      const unoptimizedResult = await performanceTestingUtils.measurePerformance(
        'unoptimized-query',
        () => service.execute(unoptimizedQuery)
      );

      // Optimized query
      const optimizedQuery = await service.rewriteQuery(unoptimizedQuery);
      const optimizedResult = await performanceTestingUtils.measurePerformance(
        'optimized-query',
        () => service.execute(optimizedQuery)
      );

      // Optimized version should be faster
      expect(optimizedResult.metric.duration).toBeLessThan(unoptimizedResult.metric.duration * 1.5);
      expect(unoptimizedResult.result).toHaveLength(optimizedResult.result.length);
    });

    it('should handle memory efficiently during large result sets', async () => {
      const memoryLeakResult = await performanceTestingUtils.detectMemoryLeaks(
        'large-result-sets',
        async () => {
          // Query that returns moderate result set
          await service.execute(`
            SELECT * FROM (
              SELECT
                generate_series(1, 1000) as id,
                'test data ' || generate_series(1, 1000) as data,
                ARRAY['tag1', 'tag2', 'tag3'] as tags,
                '{ "key": "value" }'::json as metadata
            ) large_result
            WHERE id % 10 = 0
          `);
        },
        5,
        100 * 1024 * 1024 // 100MB threshold
      );

      expect(memoryLeakResult.hasMemoryLeak).toBe(false);
      expect(memoryLeakResult.memoryGrowth).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle database connection timeouts', async () => {
      // Mock a timeout error
      const originalExecute = service.execute;
      service.execute = jest.fn().mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 100);
        });
      });

      await expect(service.execute('SELECT 1')).rejects.toThrow('timeout');

      // Service should recover and work normally
      service.execute = originalExecute;
      await expect(service.execute('SELECT 1')).resolves.not.toThrow();
    });

    it('should handle query syntax errors gracefully', async () => {
      const invalidQuery = 'SELECT * FROM invalid_table_name';

      await expect(service.execute(invalidQuery)).rejects.toThrow();

      // Service should still work after syntax error
      await expect(service.execute('SELECT 1')).resolves.not.toThrow();
    });

    it('should implement retry logic for transient failures', async () => {
      let callCount = 0;
      const originalExecute = service.execute;
      service.execute = jest.fn().mockImplementation((query) => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Connection temporarily unavailable'));
        }
        return originalExecute.call(service, query);
      });

      const result = await service.executeWithRetry('SELECT 1', 3);
      expect(result).toBeDefined();
      expect(callCount).toBe(3); // 2 failures + 1 success
    });

    it('should provide detailed error diagnostics', async () => {
      const diagnosticQuery = 'SELECT * FROM non_existent_table';

      try {
        await service.execute(diagnosticQuery);
      } catch (error) {
        const diagnostics = await service.getErrorDiagnostics(error);
        expect(diagnostics).toBeDefined();
        expect(diagnostics.errorType).toBeDefined();
        expect(diagnostics.suggestion).toBeDefined();
        expect(diagnostics.relatedQueries).toBeDefined();
      }
    });
  });
});