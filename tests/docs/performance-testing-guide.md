# Performance Testing Guide

Comprehensive guide to performance testing for the WorkshopsAI CMS project, including load testing, stress testing, and performance regression detection.

## 📋 Table of Contents

- [Performance Testing Overview](#performance-testing-overview)
- [Setting Up Performance Tests](#setting-up-performance-tests)
- [Load Testing](#load-testing)
- [Stress Testing](#stress-testing)
- [Memory Leak Detection](#memory-leak-detection)
- [Database Performance Testing](#database-performance-testing)
- [API Performance Testing](#api-performance-testing)
- [Performance Regression Testing](#performance-regression-testing)
- [Performance Metrics and Analysis](#performance-metrics-and-analysis)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Performance Testing Overview

Performance testing ensures that the application meets performance requirements under various load conditions. This guide covers:

- **Load Testing**: Testing system performance under expected load
- **Stress Testing**: Testing system behavior under extreme load
- **Memory Leak Detection**: Identifying memory leaks and resource issues
- **Database Performance**: Testing query performance and connection pooling
- **API Performance**: Testing endpoint response times and throughput
- **Regression Testing**: Detecting performance regressions over time

### Performance Goals

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response Time | <2s (p95) | API endpoint response time |
| Throughput | >100 req/s | Requests per second |
| Memory Usage | <512MB | Peak memory usage |
| Error Rate | <1% | Failed requests percentage |
| Database Query Time | <500ms | Average query execution time |
| Cache Hit Rate | >80% | Cache effectiveness |

## ⚙️ Setting Up Performance Tests

### Prerequisites

```bash
# Install performance testing dependencies
npm install --save-dev artillery k6 autocannon

# Install system monitoring tools
npm install --save-dev clinic bubbleprof 0x

# Set up environment for performance testing
cp .env.example .env.performance
```

### Performance Test Configuration

```typescript
// tests/config/performance.config.ts
export const PERFORMANCE_CONFIG = {
  // Load testing configuration
  loadTesting: {
    duration: 60000, // 1 minute
    concurrency: 50,
    rampUpTime: 10000,
    thresholds: {
      avgResponseTime: 2000,
      maxResponseTime: 5000,
      errorRate: 0.01,
      throughput: 100
    }
  },

  // Stress testing configuration
  stressTesting: {
    duration: 300000, // 5 minutes
    maxConcurrency: 1000,
    rampUpTime: 60000,
    thresholds: {
      avgResponseTime: 5000,
      maxResponseTime: 10000,
      errorRate: 0.05,
      throughput: 50
    }
  },

  // Memory testing configuration
  memoryTesting: {
    iterations: 10000,
    memoryThreshold: 512 * 1024 * 1024, // 512MB
    gcInterval: 1000
  }
};
```

### Performance Test Environment

```bash
# Start performance test environment
npm run test:performance:env:start

# Check environment health
npm run test:performance:env:health

# Stop performance test environment
npm run test:performance:env:stop
```

## 🚀 Load Testing

Load testing verifies that the system can handle expected user loads without performance degradation.

### Basic Load Test Example

```typescript
// tests/performance/load-testing/basic-load.test.ts
import { performanceTest } from '../utils/performance-testing-utils';

describe('Basic Load Testing', () => {
  performanceTest({
    name: 'LLM Analysis Load Test',
    endpoint: '/api/analysis/llm',
    method: 'POST',
    payload: {
      questionnaireId: 'test-123',
      options: {
        model: 'gpt-4',
        temperature: 0.7
      }
    },
    concurrency: 50,
    duration: 30000,
    thresholds: {
      avgResponseTime: 2000,
      maxResponseTime: 5000,
      errorRate: 0.01,
      throughput: 25
    }
  });

  performanceTest({
    name: 'Caching Service Load Test',
    endpoint: '/api/cache/get',
    method: 'GET',
    payload: { key: 'test-key' },
    concurrency: 100,
    duration: 20000,
    thresholds: {
      avgResponseTime: 100,
      maxResponseTime: 500,
      errorRate: 0.001,
      throughput: 500
    }
  });
});
```

### Advanced Load Testing with Scenarios

```typescript
// tests/performance/load-testing/user-scenarios.test.ts
import { createScenario } from '../utils/performance-testing-utils';

describe('User Scenario Load Testing', () => {
  createScenario({
    name: 'Complete Analysis Workflow',
    steps: [
      {
        name: 'Create Questionnaire',
        request: {
          endpoint: '/api/questionnaires',
          method: 'POST',
          payload: generateQuestionnaireData()
        },
        thinkTime: 2000
      },
      {
        name: 'Submit Analysis Request',
        request: {
          endpoint: '/api/analysis/llm',
          method: 'POST',
          payload: (context) => ({
            questionnaireId: context.questionnaireId,
            options: { model: 'gpt-4' }
          })
        },
        thinkTime: 5000
      },
      {
        name: 'Check Analysis Status',
        request: {
          endpoint: (context) => `/api/analysis/${context.analysisId}/status`,
          method: 'GET'
        },
        thinkTime: 1000
      }
    ],
    concurrency: 20,
    duration: 60000,
    thresholds: {
      totalResponseTime: 15000,
      errorRate: 0.02
    }
  });
});
```

### Load Testing with Artillery

```yaml
# tests/performance/artillery/llm-analysis.yml
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Load test"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"

scenarios:
  - name: "LLM Analysis"
    weight: 70
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
          capture:
            - json: "$.token"
              as: "authToken"

      - post:
          url: "/api/analysis/llm"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            questionnaireId: "test-123"
            options:
              model: "gpt-4"
              temperature: 0.7

  - name: "Cache Operations"
    weight: 30
    flow:
      - get:
          url: "/api/cache/data/test-key"
      - think: 1
      - post:
          url: "/api/cache/data/test-key"
          json:
            value: "test-data"
            ttl: 3600
```

### Running Load Tests

```bash
# Run basic load tests
npm run test:load:basic

# Run scenario-based load tests
npm run test:load:scenarios

# Run Artillery load tests
npm run test:load:artillery

# Run load tests with monitoring
npm run test:load:monitored

# Generate load test report
npm run test:load:report
```

## 💪 Stress Testing

Stress testing determines the system's breaking point and behavior under extreme load conditions.

### Stress Test Configuration

```typescript
// tests/performance/stress-testing/stress-test.config.ts
export const STRESS_TEST_CONFIG = {
  scenarios: [
    {
      name: 'Gradual Load Increase',
      pattern: 'ramp',
      startConcurrency: 50,
      endConcurrency: 1000,
      duration: 300000, // 5 minutes
      step: 50,
      stepDuration: 15000 // 15 seconds per step
    },
    {
      name: 'Sudden Spike',
      pattern: 'spike',
      baselineConcurrency: 50,
      spikeConcurrency: 500,
      spikeDuration: 60000, // 1 minute
      totalDuration: 180000 // 3 minutes
    },
    {
      name: 'Sustained High Load',
      pattern: 'constant',
      concurrency: 200,
      duration: 600000 // 10 minutes
    }
  ]
};
```

### Stress Test Implementation

```typescript
// tests/performance/stress-testing/stress-tests.test.ts
import { stressTest } from '../utils/performance-testing-utils';

describe('Stress Testing', () => {
  stressTest({
    name: 'LLM Service Stress Test',
    pattern: 'ramp',
    startConcurrency: 10,
    endConcurrency: 500,
    duration: 180000,
    stepDuration: 30000,
    endpoint: '/api/analysis/llm',
    method: 'POST',
    payload: generateAnalysisPayload(),
    failureCriteria: {
      errorRate: 0.1, // 10% error rate
      avgResponseTime: 10000, // 10 seconds
      memoryUsage: 1024 * 1024 * 1024 // 1GB
    }
  });

  stressTest({
    name: 'Cache Service Spike Test',
    pattern: 'spike',
    baselineConcurrency: 20,
    spikeConcurrency: 1000,
    spikeDuration: 60000,
    endpoint: '/api/cache/get',
    method: 'GET',
    payload: { key: 'stress-test-key' },
    failureCriteria: {
      errorRate: 0.05,
      avgResponseTime: 1000
    }
  });
});
```

### Memory Stress Testing

```typescript
// tests/performance/stress-testing/memory-stress.test.ts
describe('Memory Stress Testing', () => {
  it('should handle memory-intensive operations', async () => {
    const initialMemory = process.memoryUsage();
    const operations = [];

    // Create memory-intensive workload
    for (let i = 0; i < 10000; i++) {
      operations.push(
        service.processLargeDataset({
          id: i,
          data: generateLargeDataset(1000), // 1KB each
          metadata: generateMetadata(100) // 100 bytes each
        })
      );
    }

    // Execute all operations concurrently
    const results = await Promise.allSettled(operations);
    const failures = results.filter(r => r.status === 'rejected');

    // Check failure rate
    expect(failures.length / results.length).toBeLessThan(0.05);

    // Check memory usage
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    expect(memoryIncrease).toBeLessThan(1024 * 1024 * 1024); // <1GB

    // Force garbage collection and verify memory is freed
    global.gc?.();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const afterGCMemory = process.memoryUsage();
    const memoryReclaimed = finalMemory.heapUsed - afterGCMemory.heapUsed;
    expect(memoryReclaimed).toBeGreaterThan(memoryIncrease * 0.8); // 80% reclaimed
  });
});
```

### Running Stress Tests

```bash
# Run stress tests
npm run test:stress

# Run gradual ramp-up test
npm run test:stress:ramp

# Run spike test
npm run test:stress:spike

# Run memory stress test
npm run test:stress:memory

# Generate stress test report
npm run test:stress:report
```

## 🔍 Memory Leak Detection

Memory leak detection identifies memory leaks and resource management issues in the application.

### Memory Leak Test Pattern

```typescript
// tests/performance/memory/leak-detection.test.ts
describe('Memory Leak Detection', () => {
  let initialMemory: NodeJS.MemoryUsage;

  beforeAll(() => {
    initialMemory = process.memoryUsage();
  });

  afterEach(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  it('should not leak memory during repeated operations', async () => {
    const baselineMemory = process.memoryUsage();
    const iterations = 10000;
    const memorySnapshots: number[] = [];

    for (let i = 0; i < iterations; i++) {
      // Perform operation that might leak memory
      await service.processRequest({
        id: i,
        data: generateTestData(1000),
        options: { cache: true }
      });

      // Capture memory usage every 1000 iterations
      if (i % 1000 === 0) {
        global.gc?.();
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }
    }

    // Final garbage collection
    global.gc?.();
    const finalMemory = process.memoryUsage();

    // Calculate memory growth
    const memoryGrowth = finalMemory.heapUsed - baselineMemory.heapUsed;
    const avgGrowthPerIteration = memoryGrowth / iterations;

    // Memory growth should be minimal (<1KB per iteration)
    expect(avgGrowthPerIteration).toBeLessThan(1024);

    // Memory snapshots should not show consistent growth
    const trend = calculateMemoryTrend(memorySnapshots);
    expect(trend).toBeLessThan(1000); // <1KB growth per snapshot
  });

  it('should properly clean up resources', async () => {
    const resourceCount = await getResourceCount();

    // Create temporary resources
    const tempResources = Array.from({ length: 1000 }, (_, i) =>
      service.createTempResource({ id: i, data: 'test' })
    );

    await Promise.all(tempResources);

    const withResourcesMemory = process.memoryUsage();

    // Clean up resources
    await service.cleanupTempResources();
    global.gc?.();

    const afterCleanupMemory = process.memoryUsage();

    // Memory should return to near baseline
    const memoryDifference = afterCleanupMemory.heapUsed - resourceCount.memoryUsage;
    expect(memoryDifference).toBeLessThan(50 * 1024 * 1024); // <50MB difference

    // Resource count should return to baseline
    const finalResourceCount = await getResourceCount();
    expect(finalResourceCount.count).toBe(resourceCount.count);
  });
});

function calculateMemoryTrend(snapshots: number[]): number {
  if (snapshots.length < 2) return 0;

  let totalTrend = 0;
  for (let i = 1; i < snapshots.length; i++) {
    totalTrend += snapshots[i] - snapshots[i - 1];
  }

  return totalTrend / (snapshots.length - 1);
}
```

### Resource Leak Detection

```typescript
// tests/performance/memory/resource-leak-detection.test.ts
describe('Resource Leak Detection', () => {
  it('should not leak database connections', async () => {
    const initialConnections = await getDatabaseConnectionCount();

    // Perform many database operations
    const operations = Array.from({ length: 1000 }, (_, i) =>
      service.databaseOperation({ id: i })
    );

    await Promise.all(operations);

    // Wait for connection pool cleanup
    await new Promise(resolve => setTimeout(resolve, 5000));

    const finalConnections = await getDatabaseConnectionCount();

    // Connection count should return to baseline
    expect(finalConnections).toBeLessThanOrEqual(initialConnections + 5);
  });

  it('should not leak file handles', async () => {
    const initialHandles = await getFileHandleCount();

    // Perform many file operations
    const fileOperations = Array.from({ length: 1000 }, (_, i) =>
      service.fileOperation({ filePath: `/tmp/test-${i}.txt` })
    );

    await Promise.allSettled(fileOperations);

    const finalHandles = await getFileHandleCount();

    // File handle count should not grow significantly
    expect(finalHandles).toBeLessThan(initialHandles + 10);
  });
});
```

### Running Memory Leak Tests

```bash
# Run memory leak detection
npm run test:memory:leak

# Run resource leak detection
npm run test:memory:resources

# Run memory profiling
npm run test:memory:profile

# Generate memory report
npm run test:memory:report
```

## 🗄️ Database Performance Testing

Database performance testing ensures that database operations meet performance requirements and scale appropriately.

### Query Performance Tests

```typescript
// tests/performance/database/query-performance.test.ts
describe('Database Query Performance', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    await testDb.seedLargeDataset(100000); // 100k records
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it('should execute simple queries within thresholds', async () => {
    const query = 'SELECT * FROM questionnaires WHERE id = $1';
    const iterations = 1000;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await testDb.query(query, [`test-id-${i % 1000}`]);
      const end = performance.now();
      times.push(end - start);
    }

    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const p95Time = calculatePercentile(times, 95);
    const maxTime = Math.max(...times);

    expect(avgTime).toBeLessThan(10); // <10ms average
    expect(p95Time).toBeLessThan(50); // <50ms p95
    expect(maxTime).toBeLessThan(100); // <100ms max
  });

  it('should handle complex joins efficiently', async () => {
    const complexQuery = `
      SELECT q.*, qa.*, a.response_text
      FROM questionnaires q
      JOIN questionnaire_answers qa ON q.id = qa.questionnaire_id
      JOIN answers a ON qa.answer_id = a.id
      WHERE q.created_at > $1
      ORDER BY q.created_at DESC
      LIMIT 100
    `;

    const iterations = 100;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await testDb.query(complexQuery, [new Date(Date.now() - 86400000)]);
      const end = performance.now();
      times.push(end - start);
    }

    const avgTime = times.reduce((a, b) => a + b) / times.length;
    expect(avgTime).toBeLessThan(100); // <100ms average
  });

  it('should maintain performance under concurrent load', async () => {
    const concurrency = 50;
    const queriesPerConnection = 20;

    const promises = Array.from({ length: concurrency }, async (_, i) => {
      const connectionTimes: number[] = [];

      for (let j = 0; j < queriesPerConnection; j++) {
        const start = performance.now();
        await testDb.query(
          'SELECT * FROM questionnaires WHERE status = $1 LIMIT 10',
          ['active']
        );
        const end = performance.now();
        connectionTimes.push(end - start);
      }

      return {
        connectionId: i,
        avgTime: connectionTimes.reduce((a, b) => a + b) / connectionTimes.length,
        maxTime: Math.max(...connectionTimes)
      };
    });

    const results = await Promise.all(promises);
    const overallAvg = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length;
    const overallMax = Math.max(...results.map(r => r.maxTime));

    expect(overallAvg).toBeLessThan(50); // <50ms average under load
    expect(overallMax).toBeLessThan(200); // <200ms max under load
  });
});

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}
```

### Connection Pool Performance

```typescript
// tests/performance/database/connection-pool.test.ts
describe('Connection Pool Performance', () => {
  it('should efficiently manage connection pool under load', async () => {
    const poolSize = 20;
    const concurrency = 100;
    const operationsPerConnection = 10;

    const startTime = Date.now();
    const promises = Array.from({ length: concurrency }, async (_, i) => {
      const results = [];

      for (let j = 0; j < operationsPerConnection; j++) {
        const start = performance.now();
        await testDb.query('SELECT pg_sleep(0.01)'); // Simulate work
        const end = performance.now();
        results.push(end - start);
      }

      return results;
    });

    const allResults = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    const allTimes = allResults.flat();

    const avgTime = allTimes.reduce((a, b) => a + b) / allTimes.length;
    const throughput = (concurrency * operationsPerConnection) / (totalTime / 1000);

    expect(avgTime).toBeLessThan(50); // Connection acquisition + query <50ms
    expect(throughput).toBeGreaterThan(50); // >50 queries/second
  });
});
```

### Running Database Performance Tests

```bash
# Run database performance tests
npm run test:db:performance

# Run query performance tests
npm run test:db:queries

# Run connection pool tests
npm run test:db:pool

# Generate database performance report
npm run test:db:report
```

## 🌐 API Performance Testing

API performance testing ensures that API endpoints meet performance requirements and handle load effectively.

### Endpoint Performance Tests

```typescript
// tests/performance/api/endpoint-performance.test.ts
describe('API Endpoint Performance', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('LLM Analysis Endpoint', () => {
    it('should meet performance thresholds', async () => {
      const payload = generateAnalysisPayload();
      const iterations = 100;
      const times: number[] = [];
      const memoryUsages: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startMemory = process.memoryUsage().heapUsed;
        const startTime = performance.now();

        const response = await request(app)
          .post('/api/analysis/llm')
          .send(payload)
          .expect(200);

        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;

        times.push(endTime - startTime);
        memoryUsages.push(endMemory - startMemory);

        // Verify response quality
        expect(response.body).toHaveProperty('analysisId');
        expect(response.body).toHaveProperty('status');
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const p95Time = calculatePercentile(times, 95);
      const avgMemory = memoryUsages.reduce((a, b) => a + b) / memoryUsages.length;

      expect(avgTime).toBeLessThan(2000); // <2s average
      expect(p95Time).toBeLessThan(5000); // <5s p95
      expect(avgMemory).toBeLessThan(10 * 1024 * 1024); // <10MB per request
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrency = 50;
      const payload = generateAnalysisPayload();

      const promises = Array.from({ length: concurrency }, async (_, i) => {
        const startTime = performance.now();
        const response = await request(app)
          .post('/api/analysis/llm')
          .send({ ...payload, questionnaireId: `test-${i}` })
          .expect(200);
        const endTime = performance.now();

        return {
          requestId: i,
          responseTime: endTime - startTime,
          analysisId: response.body.analysisId
        };
      });

      const results = await Promise.all(promises);
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));

      expect(avgResponseTime).toBeLessThan(3000); // <3s average under load
      expect(maxResponseTime).toBeLessThan(10000); // <10s max under load
      expect(results.length).toBe(concurrency); // All requests succeeded
    });
  });

  describe('Cache Endpoint', () => {
    it('should respond quickly for cache hits', async () => {
      // Pre-populate cache
      const testKey = 'performance-test-key';
      const testValue = { data: 'test data', timestamp: Date.now() };

      await request(app)
        .post(`/api/cache/${testKey}`)
        .send(testValue)
        .expect(201);

      // Test cache hit performance
      const iterations = 1000;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const response = await request(app)
          .get(`/api/cache/${testKey}`)
          .expect(200);
        const endTime = performance.now();

        times.push(endTime - startTime);
        expect(response.body).toEqual(testValue);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const p95Time = calculatePercentile(times, 95);

      expect(avgTime).toBeLessThan(10); // <10ms average
      expect(p95Time).toBeLessThan(50); // <50ms p95
    });

    it('should handle cache misses efficiently', async () => {
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await request(app)
          .get(`/api/cache/nonexistent-key-${i}`)
          .expect(404);
        const endTime = performance.now();

        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      expect(avgTime).toBeLessThan(20); // <20ms average for cache misses
    });
  });
});
```

### Load Testing with K6

```javascript
// tests/performance/k6/api-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // ramp up to 10 users
    { duration: '5m', target: 10 }, // stay at 10 users
    { duration: '2m', target: 50 }, // ramp up to 50 users
    { duration: '5m', target: 50 }, // stay at 50 users
    { duration: '2m', target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests <2s
    http_req_failed: ['rate<0.05'],    // error rate <5%
    errors: ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:3001';

export default function () {
  // Login and get token
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'password123'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  let success = check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response has token': (r) => JSON.parse(r.body).token !== undefined,
  });

  errorRate.add(!success);

  if (!success) {
    sleep(1);
    return;
  }

  const token = JSON.parse(loginResponse.body).token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Test LLM analysis endpoint
  const analysisPayload = JSON.stringify({
    questionnaireId: 'test-123',
    options: {
      model: 'gpt-4',
      temperature: 0.7,
    },
  });

  const analysisResponse = http.post(`${BASE_URL}/api/analysis/llm`, analysisPayload, {
    headers: authHeaders,
  });

  success = check(analysisResponse, {
    'analysis status is 200': (r) => r.status === 200,
    'analysis response has ID': (r) => JSON.parse(r.body).analysisId !== undefined,
    'analysis response time <2000ms': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);

  // Test cache endpoint
  const cacheResponse = http.get(`${BASE_URL}/api/cache/test-key`, {
    headers: authHeaders,
  });

  check(cacheResponse, {
    'cache status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'cache response time <100ms': (r) => r.timings.duration < 100,
  });

  sleep(1);
}
```

### Running API Performance Tests

```bash
# Run API performance tests
npm run test:api:performance

# Run endpoint performance tests
npm run test:api:endpoints

# Run K6 load tests
npm run test:api:k6

# Generate API performance report
npm run test:api:report
```

## 📈 Performance Regression Testing

Performance regression testing detects performance degradations over time by comparing current performance against established baselines.

### Baseline Establishment

```typescript
// tests/performance/regression/baseline-establishment.test.ts
describe('Performance Baseline Establishment', () => {
  const baselineFile = './test-results/performance-baseline.json';

  it('should establish performance baseline', async () => {
    const baseline = await collectPerformanceBaseline();

    // Save baseline for future comparisons
    await fs.writeFile(baselineFile, JSON.stringify(baseline, null, 2));

    console.log(`Performance baseline established: ${JSON.stringify(baseline, null, 2)}`);
  });

  async function collectPerformanceBaseline() {
    const tests = [
      { name: 'llm-analysis', endpoint: '/api/analysis/llm', method: 'POST' },
      { name: 'cache-get', endpoint: '/api/cache/test-key', method: 'GET' },
      { name: 'questionnaire-list', endpoint: '/api/questionnaires', method: 'GET' },
    ];

    const baseline: Record<string, any> = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      results: {}
    };

    for (const test of tests) {
      const metrics = await measureEndpointPerformance(test);
      baseline.results[test.name] = metrics;
    }

    return baseline;
  }

  async function measureEndpointPerformance(test: any) {
    const iterations = 100;
    const times: number[] = [];
    const memoryUsages: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      const response = await request(app)
        [test.method.toLowerCase()](test.endpoint)
        .send(test.method === 'POST' ? generatePayload() : undefined)
        .expect(200);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      times.push(endTime - startTime);
      memoryUsages.push(endMemory - startMemory);
    }

    return {
      avgResponseTime: calculateAverage(times),
      p95ResponseTime: calculatePercentile(times, 95),
      maxResponseTime: Math.max(...times),
      avgMemoryUsage: calculateAverage(memoryUsages),
      maxMemoryUsage: Math.max(...memoryUsages),
      throughput: iterations / (Math.max(...times) / 1000),
    };
  }
});
```

### Regression Detection

```typescript
// tests/performance/regression/regression-detection.test.ts
describe('Performance Regression Detection', () => {
  const baselineFile = './test-results/performance-baseline.json';
  const regressionThreshold = 0.15; // 15% degradation threshold

  it('should detect performance regressions', async () => {
    const baseline = JSON.parse(await fs.readFile(baselineFile, 'utf8'));
    const current = await collectCurrentPerformance();

    const regressions: string[] = [];

    for (const [testName, baselineMetrics] of Object.entries(baseline.results)) {
      const currentMetrics = current.results[testName];

      if (!currentMetrics) {
        console.warn(`Missing current metrics for test: ${testName}`);
        continue;
      }

      const regression = checkForRegression(
        testName,
        baselineMetrics as any,
        currentMetrics
      );

      if (regression) {
        regressions.push(regression);
      }
    }

    if (regressions.length > 0) {
      console.error('Performance regressions detected:');
      regressions.forEach(reg => console.error(`  - ${reg}`));
      fail(`Performance regressions detected: ${regressions.join(', ')}`);
    }
  });

  function checkForRegression(
    testName: string,
    baseline: any,
    current: any
  ): string | null {
    const regressions: string[] = [];

    // Check response time regression
    const responseTimeRegression =
      (current.avgResponseTime - baseline.avgResponseTime) / baseline.avgResponseTime;

    if (responseTimeRegression > regressionThreshold) {
      regressions.push(
        `Response time increased by ${(responseTimeRegression * 100).toFixed(1)}% ` +
        `(${baseline.avgResponseTime}ms → ${current.avgResponseTime}ms)`
      );
    }

    // Check memory usage regression
    const memoryRegression =
      (current.avgMemoryUsage - baseline.avgMemoryUsage) / baseline.avgMemoryUsage;

    if (memoryRegression > regressionThreshold) {
      regressions.push(
        `Memory usage increased by ${(memoryRegression * 100).toFixed(1)}% ` +
        `(${baseline.avgMemoryUsage}bytes → ${current.avgMemoryUsage}bytes)`
      );
    }

    // Check throughput regression
    const throughputRegression =
      (baseline.throughput - current.throughput) / baseline.throughput;

    if (throughputRegression > regressionThreshold) {
      regressions.push(
        `Throughput decreased by ${(throughputRegression * 100).toFixed(1)}% ` +
        `(${baseline.throughput}req/s → ${current.throughput}req/s)`
      );
    }

    return regressions.length > 0 ? `${testName}: ${regressions.join(', ')}` : null;
  }
});
```

### Running Regression Tests

```bash
# Establish performance baseline
npm run test:performance:baseline

# Run regression detection
npm run test:performance:regression

# Update baseline (when intentional performance changes occur)
npm run test:performance:update-baseline

# Generate regression report
npm run test:performance:regression-report
```

## 📊 Performance Metrics and Analysis

### Metrics Collection

```typescript
// tests/performance/utils/metrics-collector.ts
export class PerformanceMetricsCollector {
  private metrics: Map<string, number[]> = new Map();
  private startTime: number = 0;

  startMeasurement(name: string): void {
    this.startTime = performance.now();
  }

  endMeasurement(name: string): number {
    const duration = performance.now() - this.startTime;

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(duration);
    return duration;
  }

  getMetrics(name: string): number[] | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): Record<string, number[]> {
    return Object.fromEntries(this.metrics);
  }

  getStatistics(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b) / values.length,
      p50: calculatePercentile(sorted, 50),
      p95: calculatePercentile(sorted, 95),
      p99: calculatePercentile(sorted, 99),
    };
  }

  reset(): void {
    this.metrics.clear();
  }
}
```

### Performance Report Generation

```typescript
// tests/performance/utils/report-generator.ts
export class PerformanceReportGenerator {
  static generateReport(metrics: PerformanceMetricsCollector): string {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(metrics),
      details: this.generateDetails(metrics),
      recommendations: this.generateRecommendations(metrics),
    };

    return JSON.stringify(report, null, 2);
  }

  private static generateSummary(metrics: PerformanceMetricsCollector): any {
    const allMetrics = metrics.getAllMetrics();
    const summary: any = {};

    for (const [name, values] of Object.entries(allMetrics)) {
      const stats = metrics.getStatistics(name);
      if (stats) {
        summary[name] = {
          avgResponseTime: stats.avg,
          p95ResponseTime: stats.p95,
          maxResponseTime: stats.max,
          totalRequests: stats.count,
        };
      }
    }

    return summary;
  }

  private static generateDetails(metrics: PerformanceMetricsCollector): any {
    const allMetrics = metrics.getAllMetrics();
    const details: any = {};

    for (const [name, values] of Object.entries(allMetrics)) {
      const stats = metrics.getStatistics(name);
      if (stats) {
        details[name] = {
          ...stats,
          percentiles: {
            p50: stats.p50,
            p90: calculatePercentile(values, 90),
            p95: stats.p95,
            p99: stats.p99,
          },
          distribution: this.generateDistribution(values),
        };
      }
    }

    return details;
  }

  private static generateRecommendations(metrics: PerformanceMetricsCollector): string[] {
    const recommendations: string[] = [];
    const allMetrics = metrics.getAllMetrics();

    for (const [name, values] of Object.entries(allMetrics)) {
      const stats = metrics.getStatistics(name);
      if (!stats) continue;

      if (stats.avg > 2000) {
        recommendations.push(`${name}: Average response time (${stats.avg.toFixed(0)}ms) exceeds 2s threshold`);
      }

      if (stats.p95 > 5000) {
        recommendations.push(`${name}: P95 response time (${stats.p95.toFixed(0)}ms) exceeds 5s threshold`);
      }

      if (stats.max > 10000) {
        recommendations.push(`${name}: Maximum response time (${stats.max.toFixed(0)}ms) exceeds 10s threshold`);
      }

      const coefficientOfVariation = (stats.p95 - stats.p50) / stats.p50;
      if (coefficientOfVariation > 2) {
        recommendations.push(`${name}: High response time variability detected`);
      }
    }

    return recommendations;
  }

  private static generateDistribution(values: number[]): any {
    const sorted = [...values].sort((a, b) => a - b);
    const bins = 10;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const binSize = (max - min) / bins;

    const distribution = [];
    for (let i = 0; i < bins; i++) {
      const binStart = min + (i * binSize);
      const binEnd = min + ((i + 1) * binSize);
      const count = sorted.filter(v => v >= binStart && v < binEnd).length;

      distribution.push({
        range: `${binStart.toFixed(0)}-${binEnd.toFixed(0)}ms`,
        count,
        percentage: (count / sorted.length) * 100,
      });
    }

    return distribution;
  }
}
```

### Generating Performance Reports

```bash
# Generate comprehensive performance report
npm run test:performance:report

# Generate HTML performance report
npm run test:performance:report:html

# Generate JSON performance report
npm run test:performance:report:json

# Compare with baseline
npm run test:performance:compare
```

## 🎯 Best Practices

### Test Design

1. **Use Realistic Data**: Test with data that closely matches production data
2. **Test Different Load Patterns**: Include ramp-up, spike, and sustained load scenarios
3. **Measure Multiple Metrics**: Track response time, throughput, memory usage, and error rates
4. **Establish Baselines**: Create performance baselines for regression testing
5. **Test in Isolated Environment**: Use dedicated performance testing environment

### Performance Monitoring

1. **Monitor System Resources**: Track CPU, memory, disk I/O, and network usage
2. **Use Application Metrics**: Monitor application-specific metrics
3. **Set Up Alerts**: Configure alerts for performance threshold breaches
4. **Correlate Metrics**: Correlate performance metrics with business metrics
5. **Long-term Trending**: Track performance trends over time

### Test Execution

1. **Run Tests Consistently**: Execute tests at the same time of day
2. **Use Same Environment**: Maintain consistent test environment
3. **Warm Up Systems**: Allow systems to warm up before measuring
4. **Repeat Tests**: Run tests multiple times for statistical significance
5. **Document Results**: Maintain detailed records of test results

## 🔧 Troubleshooting

### Common Performance Issues

#### Slow Response Times

```bash
# Profile slow requests
npm run test:profile:slow

# Check database query performance
npm run test:db:slow-queries

# Analyze memory usage
npm run test:profile:memory
```

#### High Memory Usage

```bash
# Check for memory leaks
npm run test:memory:leak

# Profile memory allocation
npm run test:profile:allocation

# Monitor garbage collection
npm run test:profile:gc
```

#### Low Throughput

```bash
# Check connection pool usage
npm run test:db:connections

# Monitor thread pool usage
npm run test:threads:usage

# Analyze bottlenecks
npm run test:profile:bottlenecks
```

#### Database Performance Issues

```bash
# Analyze slow queries
npm run test:db:analyze

# Check index usage
npm run test:db:indexes

# Monitor connection pooling
npm run test:db:pool-monitor
```

### Performance Debugging Tools

```bash
# Use Clinic.js for Node.js profiling
npm run clinic:doctor

# Use 0x for flame graphs
npm run test:profile:flamegraph

# Use autocannon for HTTP load testing
npm run test:load:http

# Use artillery for complex scenarios
npm run test:load:artillery
```

---

This comprehensive performance testing guide provides all the tools and techniques needed to ensure your application meets performance requirements and scales effectively under load.