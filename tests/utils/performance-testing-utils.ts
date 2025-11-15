import { performance } from 'perf_hooks';
import { TestRedisHelper } from './test-redis';

// Performance measurement types
export interface PerformanceMetric {
  name: string;
  duration: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  timestamp: number;
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errors: Array<{ error: string; count: number }>;
}

export interface StressTestResult {
  maxConcurrentRequests: number;
  throughputBreakdown: Array<{
    concurrency: number;
    averageResponseTime: number;
    successRate: number;
    errorsPerSecond: number;
  }>;
  breakingPoint: {
    concurrency: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

// Performance testing utilities
export class PerformanceTestingUtils {
  private metrics: PerformanceMetric[] = [];
  private redis: TestRedisHelper;

  constructor() {
    this.redis = new TestRedisHelper();
  }

  // Basic performance measurement
  async measurePerformance<T>(
    name: string,
    fn: () => Promise<T> | T
  ): Promise<{ result: T; metric: PerformanceMetric }> {
    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();

    try {
      const result = await fn();
      const endTime = performance.now();
      const memoryAfter = process.memoryUsage();

      const metric: PerformanceMetric = {
        name,
        duration: endTime - startTime,
        memoryBefore,
        memoryAfter,
        timestamp: Date.now(),
      };

      this.metrics.push(metric);

      return { result, metric };
    } catch (error) {
      const endTime = performance.now();
      const memoryAfter = process.memoryUsage();

      const metric: PerformanceMetric = {
        name: `${name} (failed)`,
        duration: endTime - startTime,
        memoryBefore,
        memoryAfter,
        timestamp: Date.now(),
      };

      this.metrics.push(metric);
      throw error;
    }
  }

  // Multiple iterations performance testing
  async measurePerformanceWithIterations<T>(
    name: string,
    fn: () => Promise<T> | T,
    iterations = 10
  ): Promise<{
    results: T[];
    metrics: PerformanceMetric[];
    statistics: {
      averageDuration: number;
      minDuration: number;
      maxDuration: number;
      standardDeviation: number;
      averageMemoryUsage: number;
    };
  }> {
    const results: T[] = [];
    const metrics: PerformanceMetric[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, metric } = await this.measurePerformance(`${name} - iteration ${i + 1}`, fn);
      results.push(result);
      metrics.push(metric);
    }

    const durations = metrics.map(m => m.duration);
    const memoryUsages = metrics.map(m => m.memoryAfter.heapUsed - m.memoryBefore.heapUsed);

    const statistics = {
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      standardDeviation: this.calculateStandardDeviation(durations),
      averageMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
    };

    return { results, metrics, statistics };
  }

  // Load testing
  async performLoadTest<T>(
    name: string,
    fn: () => Promise<T> | T,
    options: {
      concurrency?: number;
      duration?: number;
      totalRequests?: number;
      warmupRequests?: number;
    } = {}
  ): Promise<LoadTestResult> {
    const {
      concurrency = 10,
      duration = 30000, // 30 seconds
      totalRequests,
      warmupRequests = 5,
    } = options;

    // Warmup phase
    for (let i = 0; i < warmupRequests; i++) {
      try {
        await fn();
      } catch (error) {
        // Ignore warmup errors
      }
    }

    const startTime = Date.now();
    const endTime = startTime + duration;
    const promises: Promise<{ success: boolean; duration: number; error?: string }>[] = [];
    const results: { success: boolean; duration: number; error?: string }[] = [];
    const errors: Map<string, number> = new Map();

    let requestCount = 0;

    // Execute requests
    while (
      (totalRequests ? requestCount < totalRequests : Date.now() < endTime) &&
      results.length < (totalRequests || Infinity)
    ) {
      const currentConcurrency = Math.min(concurrency, (totalRequests || Infinity) - requestCount);

      for (let i = 0; i < currentConcurrency && requestCount < (totalRequests || Infinity); i++) {
        const promise = this.executeTimedRequest(fn);
        promises.push(promise);
        requestCount++;
      }

      // Wait for a batch to complete
      const batchResults = await Promise.allSettled(promises.splice(0, currentConcurrency));

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (!result.value.success && result.value.error) {
            const count = errors.get(result.value.error) || 0;
            errors.set(result.value.error, count + 1);
          }
        } else {
          results.push({
            success: false,
            duration: 0,
            error: result.reason?.message || 'Unknown error',
          });
          const error = result.reason?.message || 'Unknown error';
          const count = errors.get(error) || 0;
          errors.set(error, count + 1);
        }
      });
    }

    const successfulResults = results.filter(r => r.success);
    const durations = successfulResults.map(r => r.duration);

    const loadTestResult: LoadTestResult = {
      totalRequests: results.length,
      successfulRequests: successfulResults.length,
      failedRequests: results.length - successfulResults.length,
      averageResponseTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minResponseTime: durations.length > 0 ? Math.min(...durations) : 0,
      maxResponseTime: durations.length > 0 ? Math.max(...durations) : 0,
      p95ResponseTime: this.calculatePercentile(durations, 95),
      p99ResponseTime: this.calculatePercentile(durations, 99),
      requestsPerSecond: results.length / ((Date.now() - startTime) / 1000),
      errors: Array.from(errors.entries()).map(([error, count]) => ({ error, count })),
    };

    return loadTestResult;
  }

  // Stress testing
  async performStressTest<T>(
    name: string,
    fn: () => Promise<T> | T,
    options: {
      startConcurrency?: number;
      maxConcurrency?: number;
      stepSize?: number;
      requestsPerStep?: number;
      maxErrorRate?: number;
      maxResponseTime?: number;
    } = {}
  ): Promise<StressTestResult> {
    const {
      startConcurrency = 1,
      maxConcurrency = 100,
      stepSize = 5,
      requestsPerStep = 50,
      maxErrorRate = 0.1, // 10%
      maxResponseTime = 10000, // 10 seconds
    } = options;

    const throughputBreakdown: StressTestResult['throughputBreakdown'] = [];
    let breakingPoint: StressTestResult['breakingPoint'] | null = null;

    for (let concurrency = startConcurrency; concurrency <= maxConcurrency; concurrency += stepSize) {
      console.log(`Stress testing ${name} at concurrency: ${concurrency}`);

      const loadTestResult = await this.performLoadTest(
        `${name} - stress test concurrency ${concurrency}`,
        fn,
        {
          concurrency,
          totalRequests: requestsPerStep,
        }
      );

      const successRate = loadTestResult.successfulRequests / loadTestResult.totalRequests;
      const errorRate = 1 - successRate;

      throughputBreakdown.push({
        concurrency,
        averageResponseTime: loadTestResult.averageResponseTime,
        successRate,
        errorsPerSecond: loadTestResult.errors.reduce((sum, e) => sum + e.count, 0) / (loadTestResult.totalRequests / loadTestResult.requestsPerSecond),
      });

      // Check if we've reached the breaking point
      if (errorRate > maxErrorRate || loadTestResult.averageResponseTime > maxResponseTime) {
        breakingPoint = {
          concurrency,
          errorRate,
          averageResponseTime: loadTestResult.averageResponseTime,
        };
        break;
      }
    }

    return {
      maxConcurrentRequests: breakingPoint ? breakingPoint.concurrency : maxConcurrency,
      throughputBreakdown,
      breakingPoint: breakingPoint || {
        concurrency: maxConcurrency,
        errorRate: 0,
        averageResponseTime: 0,
      },
    };
  }

  // Cache performance testing
  async testCachePerformance(
    cacheOperations: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any, ttl?: number) => Promise<void>;
      del: (key: string) => Promise<void>;
    },
    testSize = 1000
  ): Promise<{
    getPerformance: { averageTime: number; operationsPerSecond: number };
    setPerformance: { averageTime: number; operationsPerSecond: number };
    deletePerformance: { averageTime: number; operationsPerSecond: number };
    hitRate: number;
    memoryUsage: number;
  }> {
    await this.redis.connect();
    const redis = this.redis.getInstance();

    const testData = Array.from({ length: testSize }, (_, i) => ({
      key: `test-key-${i}`,
      value: { id: i, data: `test-data-${i}`.repeat(10) },
    }));

    // Test SET operations
    const setMetrics = await this.measurePerformanceWithIterations(
      'cache-set',
      async () => {
        const item = testData[Math.floor(Math.random() * testData.length)];
        await cacheOperations.set(item.key, item.value, 3600);
      },
      testSize
    );

    // Test GET operations (cache hits)
    const getMetrics = await this.measurePerformanceWithIterations(
      'cache-get',
      async () => {
        const item = testData[Math.floor(Math.random() * testData.length)];
        await cacheOperations.get(item.key);
      },
      testSize
    );

    // Test GET operations (cache misses)
    const missMetrics = await this.measurePerformanceWithIterations(
      'cache-get-miss',
      async () => {
        await cacheOperations.get(`non-existent-key-${Math.random()}`);
      },
      testSize / 10
    );

    // Test DELETE operations
    const deleteMetrics = await this.measurePerformanceWithIterations(
      'cache-delete',
      async () => {
        const item = testData[Math.floor(Math.random() * testData.length)];
        await cacheOperations.del(item.key);
      },
      testSize / 10
    );

    const hitRate = getMetrics.metrics.length / (getMetrics.metrics.length + missMetrics.metrics.length);

    // Cleanup
    for (const item of testData) {
      await cacheOperations.del(item.key);
    }
    await this.redis.disconnect();

    return {
      getPerformance: {
        averageTime: getMetrics.statistics.averageDuration,
        operationsPerSecond: 1000 / getMetrics.statistics.averageDuration,
      },
      setPerformance: {
        averageTime: setMetrics.statistics.averageDuration,
        operationsPerSecond: 1000 / setMetrics.statistics.averageDuration,
      },
      deletePerformance: {
        averageTime: deleteMetrics.statistics.averageDuration,
        operationsPerSecond: 1000 / deleteMetrics.statistics.averageDuration,
      },
      hitRate,
      memoryUsage: getMetrics.statistics.averageMemoryUsage,
    };
  }

  // Memory leak detection
  async detectMemoryLeaks<T>(
    name: string,
    fn: () => Promise<T> | T,
    iterations = 100,
    memoryThreshold = 10 * 1024 * 1024 // 10MB
  ): Promise<{
    hasMemoryLeak: boolean;
    memoryGrowth: number;
    peakMemoryUsage: number;
    averageMemoryUsage: number;
    memorySnapshots: number[];
  }> {
    const memorySnapshots: number[] = [];

    for (let i = 0; i < iterations; i++) {
      await fn();

      if (global.gc) {
        global.gc(); // Force garbage collection if available
      }

      const memoryUsage = process.memoryUsage();
      memorySnapshots.push(memoryUsage.heapUsed);

      // Early detection if memory growth exceeds threshold
      if (i > 10) {
        const recentGrowth = memoryUsage.heapUsed - memorySnapshots[Math.max(0, i - 10)];
        if (recentGrowth > memoryThreshold) {
          return {
            hasMemoryLeak: true,
            memoryGrowth: recentGrowth,
            peakMemoryUsage: Math.max(...memorySnapshots),
            averageMemoryUsage: memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length,
            memorySnapshots,
          };
        }
      }
    }

    const totalGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
    const hasMemoryLeak = totalGrowth > memoryThreshold;

    return {
      hasMemoryLeak,
      memoryGrowth: totalGrowth,
      peakMemoryUsage: Math.max(...memorySnapshots),
      averageMemoryUsage: memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length,
      memorySnapshots,
    };
  }

  // Utility methods
  private async executeTimedRequest<T>(fn: () => Promise<T> | T): Promise<{
    success: boolean;
    duration: number;
    error?: string;
  }> {
    const startTime = performance.now();

    try {
      await fn();
      const endTime = performance.now();
      return {
        success: true,
        duration: endTime - startTime,
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        duration: endTime - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Report generation
  generatePerformanceReport(): {
    summary: {
      totalTests: number;
      averageDuration: number;
      totalMemoryUsed: number;
    };
    metrics: PerformanceMetric[];
    recommendations: string[];
  } {
    if (this.metrics.length === 0) {
      return {
        summary: { totalTests: 0, averageDuration: 0, totalMemoryUsed: 0 },
        metrics: [],
        recommendations: ['No performance metrics collected'],
      };
    }

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalDuration / this.metrics.length;
    const totalMemoryUsed = this.metrics.reduce(
      (sum, m) => sum + (m.memoryAfter.heapUsed - m.memoryBefore.heapUsed),
      0
    );

    const recommendations: string[] = [];

    if (averageDuration > 1000) {
      recommendations.push('Average response time exceeds 1 second - consider optimization');
    }

    if (totalMemoryUsed > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage detected - check for memory leaks');
    }

    const slowOperations = this.metrics.filter(m => m.duration > 5000);
    if (slowOperations.length > 0) {
      recommendations.push(`Found ${slowOperations.length} slow operations (>5s)`);
    }

    return {
      summary: {
        totalTests: this.metrics.length,
        averageDuration,
        totalMemoryUsed,
      },
      metrics: this.metrics,
      recommendations,
    };
  }

  // Cleanup
  reset(): void {
    this.metrics = [];
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// Export singleton instance
export const performanceTestingUtils = new PerformanceTestingUtils();

// Helper functions for common performance scenarios
export const measureAPITime = async <T>(
  apiCall: () => Promise<T>,
  expectedThreshold: number = 5000
): Promise<{ result: T; withinThreshold: boolean; actualTime: number }> => {
  const { result, metric } = await performanceTestingUtils.measurePerformance('API Call', apiCall);
  return {
    result,
    withinThreshold: metric.duration <= expectedThreshold,
    actualTime: metric.duration,
  };
};

export const measureDatabaseQueryPerformance = async <T>(
  query: () => Promise<T>,
  expectedThreshold: number = 1000
): Promise<{ result: T; withinThreshold: boolean; actualTime: number }> => {
  const { result, metric } = await performanceTestingUtils.measurePerformance('Database Query', query);
  return {
    result,
    withinThreshold: metric.duration <= expectedThreshold,
    actualTime: metric.duration,
  };
};

export const measureCachePerformance = async (
  cacheOperation: () => Promise<void>,
  expectedThreshold: number = 100
): Promise<{ success: boolean; withinThreshold: boolean; actualTime: number }> => {
  const { metric } = await performanceTestingUtils.measurePerformance('Cache Operation', cacheOperation);
  return {
    success: true,
    withinThreshold: metric.duration <= expectedThreshold,
    actualTime: metric.duration,
  };
};