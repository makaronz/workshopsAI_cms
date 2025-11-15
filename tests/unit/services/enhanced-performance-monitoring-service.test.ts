import { EnhancedPerformanceMonitoringService } from '../../../src/services/enhanced-performance-monitoring-service';
import { testRedis } from '../../utils/test-redis';
import { performanceTestingUtils } from '../../utils/performance-testing-utils';

// Mock external dependencies
jest.mock('ioredis');
jest.mock('prom-client');

describe('EnhancedPerformanceMonitoringService', () => {
  let service: EnhancedPerformanceMonitoringService;
  let mockRedis: any;

  beforeAll(async () => {
    mockRedis = await testRedis.connect();
  });

  afterAll(async () => {
    await testRedis.disconnect();
  });

  beforeEach(() => {
    service = new EnhancedPerformanceMonitoringService({
      redis: {
        host: 'localhost',
        port: 6379,
        db: 1,
      },
      metrics: {
        enabled: true,
        interval: 1000,
        retention: 3600,
      },
      alerts: {
        enabled: true,
        thresholds: {
          responseTime: 5000,
          errorRate: 0.05,
          memoryUsage: 512 * 1024 * 1024,
        },
      },
    });

    performanceTestingUtils.reset();
  });

  afterEach(async () => {
    await service.stop();
    await mockRedis.flushall();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(service).toBeDefined();
      expect(service.isRunning()).toBe(false);
    });

    it('should start monitoring successfully', async () => {
      await service.start();
      expect(service.isRunning()).toBe(true);
    });

    it('should stop monitoring successfully', async () => {
      await service.start();
      await service.stop();
      expect(service.isRunning()).toBe(false);
    });

    it('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await service.start();
        expect(service.isRunning()).toBe(true);
        await service.stop();
        expect(service.isRunning()).toBe(false);
      }
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should record API response time metrics', async () => {
      const endpoint = '/api/test';
      const responseTime = 250;

      await service.recordApiResponseTime(endpoint, responseTime);

      const metrics = await service.getMetrics('api.response_time');
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].value).toBe(responseTime);
      expect(metrics[0].labels.endpoint).toBe(endpoint);
    });

    it('should record database query metrics', async () => {
      const query = 'SELECT * FROM users';
      const duration = 120;
      const success = true;

      await service.recordDatabaseQuery(query, duration, success);

      const metrics = await service.getMetrics('db.query_duration');
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].value).toBe(duration);
      expect(metrics[0].labels.query).toContain('users');
      expect(metrics[0].labels.success).toBe('true');
    });

    it('should record cache performance metrics', async () => {
      const operation = 'get';
      const hit = true;
      const duration = 5;

      await service.recordCacheOperation(operation, hit, duration);

      const metrics = await service.getMetrics('cache.operation_duration');
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].value).toBe(duration);
      expect(metrics[0].labels.operation).toBe(operation);
      expect(metrics[0].labels.hit).toBe('true');
    });

    it('should record memory usage metrics', async () => {
      const memoryUsage = process.memoryUsage();

      await service.recordMemoryUsage(memoryUsage);

      const metrics = await service.getMetrics('system.memory_usage');
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].value).toBeGreaterThan(0);
    });

    it('should record custom application metrics', async () => {
      const metricName = 'custom_user_logins';
      const value = 42;
      const labels = { source: 'web', version: '1.0.0' };

      await service.recordCustomMetric(metricName, value, labels);

      const metrics = await service.getMetrics(metricName);
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].value).toBe(value);
      expect(metrics[0].labels.source).toBe('web');
      expect(metrics[0].labels.version).toBe('1.0.0');
    });

    it('should aggregate metrics over time windows', async () => {
      const endpoint = '/api/test';

      // Record multiple metrics
      for (let i = 0; i < 10; i++) {
        await service.recordApiResponseTime(endpoint, 100 + i * 10);
      }

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for aggregation

      const aggregated = await service.getAggregatedMetrics('api.response_time', '1m');
      expect(aggregated).toBeDefined();
      expect(aggregated.count).toBe(10);
      expect(aggregated.average).toBe(145); // Average of 100 to 190
      expect(aggregated.min).toBe(100);
      expect(aggregated.max).toBe(190);
    });
  });

  describe('Performance Alerts', () => {
    beforeEach(async () => {
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should trigger alert when response time exceeds threshold', async () => {
      const alertListener = jest.fn();
      service.on('alert', alertListener);

      // Record slow response time
      await service.recordApiResponseTime('/api/slow', 6000); // Threshold is 5000ms

      // Wait for alert processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(alertListener).toHaveBeenCalled();
      const alert = alertListener.mock.calls[0][0];
      expect(alert.type).toBe('response_time');
      expect(alert.severity).toBe('warning');
      expect(alert.value).toBe(6000);
      expect(alert.threshold).toBe(5000);
    });

    it('should trigger alert when error rate exceeds threshold', async () => {
      const alertListener = jest.fn();
      service.on('alert', alertListener);

      // Simulate high error rate
      for (let i = 0; i < 10; i++) {
        await service.recordApiResponseTime('/api/error', 100, false); // failed requests
      }

      // Wait for alert processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(alertListener).toHaveBeenCalled();
      const alert = alertListener.mock.calls[0][0];
      expect(alert.type).toBe('error_rate');
      expect(alert.severity).toBe('critical');
    });

    it('should trigger alert when memory usage exceeds threshold', async () => {
      const alertListener = jest.fn();
      service.on('alert', alertListener);

      // Simulate high memory usage
      const highMemoryUsage = {
        rss: 600 * 1024 * 1024, // 600MB
        heapTotal: 400 * 1024 * 1024,
        heapUsed: 550 * 1024 * 1024, // 550MB (threshold is 512MB)
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024,
      };

      await service.recordMemoryUsage(highMemoryUsage);

      // Wait for alert processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(alertListener).toHaveBeenCalled();
      const alert = alertListener.mock.calls[0][0];
      expect(alert.type).toBe('memory_usage');
      expect(alert.severity).toBe('warning');
    });

    it('should not trigger alerts for normal metrics', async () => {
      const alertListener = jest.fn();
      service.on('alert', alertListener);

      // Record normal metrics
      await service.recordApiResponseTime('/api/normal', 200); // Under threshold
      await service.recordApiResponseTime('/api/normal', 300, true); // Success
      await service.recordMemoryUsage(process.memoryUsage()); // Normal memory

      // Wait for potential alert processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(alertListener).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Storage and Retrieval', () => {
    beforeEach(async () => {
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should store metrics in Redis with proper TTL', async () => {
      const metricName = 'test.metric';
      const value = 100;

      await service.recordCustomMetric(metricName, value);

      // Check if metric is stored in Redis
      const stored = await mockRedis.exists(`metrics:${metricName}:latest`);
      expect(stored).toBe(1);

      // Check TTL
      const ttl = await mockRedis.ttl(`metrics:${metricName}:latest`);
      expect(ttl).toBeGreaterThan(0);
    });

    it('should retrieve metrics for different time ranges', async () => {
      const metricName = 'test.timerange';

      // Record metrics at different times
      await service.recordCustomMetric(metricName, 100);
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.recordCustomMetric(metricName, 200);
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.recordCustomMetric(metricName, 300);

      const recentMetrics = await service.getMetrics(metricName, '5m');
      expect(recentMetrics.length).toBe(3);

      const olderMetrics = await service.getMetrics(metricName, '1h');
      expect(olderMetrics.length).toBe(3);
    });

    it('should handle metric cleanup and retention', async () => {
      const metricName = 'test.retention';

      // Record a metric
      await service.recordCustomMetric(metricName, 100);

      // Verify it exists
      let metrics = await service.getMetrics(metricName);
      expect(metrics.length).toBeGreaterThan(0);

      // Simulate time passage and cleanup
      await service.cleanupOldMetrics(0); // Clean up everything

      // Verify it's cleaned up
      metrics = await service.getMetrics(metricName);
      expect(metrics.length).toBe(0);
    });
  });

  describe('Performance Analysis', () => {
    beforeEach(async () => {
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should generate performance reports', async () => {
      // Record various metrics
      await service.recordApiResponseTime('/api/users', 150);
      await service.recordApiResponseTime('/api/posts', 300);
      await service.recordDatabaseQuery('SELECT * FROM users', 50, true);
      await service.recordCacheOperation('get', true, 5);

      const report = await service.generatePerformanceReport();

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.alerts).toBeDefined();
      expect(report.recommendations).toBeDefined();

      expect(report.summary.totalMetrics).toBeGreaterThan(0);
      expect(report.summary.timeRange).toBeDefined();
    });

    it('should identify performance bottlenecks', async () => {
      // Record some slow operations
      await service.recordApiResponseTime('/api/slow', 2000);
      await service.recordApiResponseTime('/api/slow', 3000);
      await service.recordApiResponseTime('/api/slow', 2500);

      const bottlenecks = await service.identifyBottlenecks();

      expect(bottlenecks).toBeDefined();
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].type).toBe('slow_endpoint');
      expect(bottlenecks[0].endpoint).toBe('/api/slow');
    });

    it('should provide performance recommendations', async () => {
      // Record metrics that would trigger recommendations
      for (let i = 0; i < 10; i++) {
        await service.recordApiResponseTime('/api/slow', 1000 + i * 100);
        await service.recordCacheOperation('get', false, 50); // Cache misses
      }

      const recommendations = await service.getPerformanceRecommendations();

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      const types = recommendations.map(r => r.type);
      expect(types).toContain('optimization');
      expect(types).toContain('caching');
    });

    it('should compare performance across time periods', async () => {
      const metricName = 'api.response_time';

      // Record current period metrics
      for (let i = 0; i < 5; i++) {
        await service.recordCustomMetric(metricName, 200 + i * 10, { period: 'current' });
      }

      // Record previous period metrics (simulate older data)
      for (let i = 0; i < 5; i++) {
        await service.recordCustomMetric(metricName, 150 + i * 10, { period: 'previous' });
      }

      const comparison = await service.compareTimePeriods(metricName, '1h', '2h');

      expect(comparison).toBeDefined();
      expect(comparison.current).toBeDefined();
      expect(comparison.previous).toBeDefined();
      expect(comparison.change).toBeDefined();
      expect(comparison.changePercent).toBeDefined();
    });
  });

  describe('Custom Metrics and Labels', () => {
    beforeEach(async () => {
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should handle metrics with multiple labels', async () => {
      const labels = {
        endpoint: '/api/users',
        method: 'GET',
        status: '200',
        version: 'v1',
      };

      await service.recordCustomMetric('http.requests', 1, labels);

      const metrics = await service.getMetrics('http.requests');
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].labels).toEqual(labels);
    });

    it('should aggregate metrics by label combinations', async () => {
      // Record metrics with different label combinations
      await service.recordCustomMetric('http.requests', 1, { endpoint: '/api/users', method: 'GET' });
      await service.recordCustomMetric('http.requests', 1, { endpoint: '/api/users', method: 'POST' });
      await service.recordCustomMetric('http.requests', 1, { endpoint: '/api/posts', method: 'GET' });

      const aggregation = await service.getMetricsByLabels('http.requests', ['endpoint']);

      expect(aggregation).toBeDefined();
      expect(Object.keys(aggregation)).toContain('/api/users');
      expect(Object.keys(aggregation)).toContain('/api/posts');
      expect(aggregation['/api/users']).toBe(2);
      expect(aggregation['/api/posts']).toBe(1);
    });

    it('should handle metric value types correctly', async () => {
      // Counter metric
      await service.recordCustomMetric('user.logins', 1);
      await service.recordCustomMetric('user.logins', 1);

      // Gauge metric
      await service.recordCustomMetric('active.users', 10);
      await service.recordCustomMetric('active.users', 15);

      // Histogram metric
      await service.recordCustomMetric('response.time', 100);
      await service.recordCustomMetric('response.time', 200);

      const counterMetric = await service.getMetrics('user.logins');
      const gaugeMetric = await service.getMetrics('active.users');
      const histogramMetric = await service.getMetrics('response.time');

      expect(counterMetric.length).toBeGreaterThan(0);
      expect(gaugeMetric.length).toBeGreaterThan(0);
      expect(histogramMetric.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Mock Redis failure
      mockRedis.set = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      const service = new EnhancedPerformanceMonitoringService({
        redis: { host: 'localhost', port: 6379, db: 1 },
      });

      await service.start();

      // Should not throw when recording metrics
      await expect(service.recordApiResponseTime('/api/test', 100)).resolves.not.toThrow();

      await service.stop();
    });

    it('should handle invalid metric data gracefully', async () => {
      await service.start();

      // These should not throw
      await expect(service.recordApiResponseTime('', -1)).resolves.not.toThrow();
      await expect(service.recordCustomMetric('', null as any)).resolves.not.toThrow();
      await expect(service.recordMemoryUsage(null as any)).resolves.not.toThrow();

      await service.stop();
    });

    it('should handle alert system failures', async () => {
      await service.start();

      // Mock alert system failure
      const originalEmit = service.emit;
      service.emit = jest.fn().mockImplementation(() => {
        throw new Error('Alert system failed');
      });

      // Should not crash when alert fails
      await expect(service.recordApiResponseTime('/api/slow', 10000)).resolves.not.toThrow();

      service.emit = originalEmit;
      await service.stop();
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency metric recording without performance degradation', async () => {
      await service.start();

      const { result, metric } = await performanceTestingUtils.measurePerformance(
        'high-frequency-metrics',
        async () => {
          const promises = Array.from({ length: 1000 }, (_, i) =>
            service.recordApiResponseTime(`/api/test/${i}`, Math.random() * 100)
          );
          await Promise.all(promises);
        }
      );

      expect(metric.duration).toBeLessThan(5000); // 5 seconds for 1000 metrics
      expect(result).toBeDefined();

      await service.stop();
    });

    it('should maintain acceptable memory usage during extended monitoring', async () => {
      const memoryLeakResult = await performanceTestingUtils.detectMemoryLeaks(
        'performance-monitoring',
        async () => {
          const service = new EnhancedPerformanceMonitoringService({
            redis: { host: 'localhost', port: 6379, db: 1 },
          });

          await service.start();

          // Record metrics
          for (let i = 0; i < 100; i++) {
            await service.recordApiResponseTime(`/api/test/${i}`, Math.random() * 200);
          }

          await service.stop();
        },
        5,
        20 * 1024 * 1024 // 20MB threshold
      );

      expect(memoryLeakResult.hasMemoryLeak).toBe(false);
      expect(memoryLeakResult.memoryGrowth).toBeLessThan(20 * 1024 * 1024);
    });

    it('should handle concurrent metric operations efficiently', async () => {
      await service.start();

      const loadTestResult = await performanceTestingUtils.performLoadTest(
        'concurrent-metrics',
        async () => {
          const operations = Math.floor(Math.random() * 4);
          switch (operations) {
            case 0:
              return service.recordApiResponseTime('/api/test', Math.random() * 200);
            case 1:
              return service.recordDatabaseQuery('SELECT 1', Math.random() * 50, true);
            case 2:
              return service.recordCacheOperation('get', Math.random() > 0.5, Math.random() * 10);
            case 3:
              return service.getMetrics('api.response_time');
          }
        },
        {
          concurrency: 50,
          totalRequests: 500,
        }
      );

      expect(loadTestResult.successfulRequests).toBeGreaterThan(450);
      expect(loadTestResult.averageResponseTime).toBeLessThan(100);
      expect(loadTestResult.requestsPerSecond).toBeGreaterThan(50);

      await service.stop();
    });
  });
});