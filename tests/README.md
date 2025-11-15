# WorkshopsAI CMS Testing Suite

Comprehensive testing framework for the WorkshopsAI CMS project covering unit tests, integration tests, performance tests, and E2E tests with full support for streaming LLM worker implementations and performance optimizations.

## 📋 Table of Contents

- [Test Suite Overview](#test-suite-overview)
- [Quick Start](#quick-start)
- [Test Categories](#test-categories)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Performance Testing](#performance-testing)
- [Mock Data and Utilities](#mock-data-and-utilities)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Test Suite Overview

This testing suite provides comprehensive coverage for:

- **Unit Tests**: Fast, isolated tests for individual components and services
- **Integration Tests**: End-to-end workflow testing with real dependencies
- **Performance Tests**: Load testing, stress testing, and performance regression detection
- **E2E Tests**: Full browser automation tests with Playwright
- **Security Tests**: Automated vulnerability scanning and security validation
- **Accessibility Tests**: WCAG compliance and accessibility validation

### Key Features

- 🚀 **High Performance**: Optimized test execution with parallel processing
- 📊 **Performance Monitoring**: Built-in performance measurement and regression detection
- 🔄 **Streaming Support**: Full support for testing streaming LLM implementations
- 🎭 **Comprehensive Mocking**: Complete mock infrastructure for external dependencies
- 📈 **Coverage Reporting**: Detailed coverage reports with configurable thresholds
- 🐳 **Container Support**: Test containers for database and Redis testing
- 🔧 **TypeScript Support**: Full TypeScript integration with type checking

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Set up environment variables
cp .env.example .env.test
```

### Running All Tests

```bash
# Run complete test suite
npm run test:all

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Quick Test Commands

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Performance tests only
npm run test:performance

# E2E tests only
npm run test:e2e

# Security tests only
npm run test:security
```

## 📂 Test Categories

### Unit Tests (`/tests/unit/`)

Fast, isolated tests for individual components and services.

```bash
# Run unit tests
npm run test:unit

# Run with coverage
npm run test:unit:coverage

# Run specific test file
npm run test:unit -- streaming-llm-worker.test.ts
```

**Coverage Areas:**
- Streaming LLM Worker
- Performance Monitoring Service
- Enhanced Caching Service
- Database Optimization Service
- API Controllers and Middleware
- Utility Functions

### Integration Tests (`/tests/integration/`)

End-to-end workflow testing with real dependencies.

```bash
# Run integration tests
npm run test:integration

# Run with database setup
npm run test:integration:db

# Run specific integration test
npm run test:integration -- llm-analysis-workflow.test.ts
```

**Test Scenarios:**
- Complete LLM Analysis Pipeline
- Multi-level Caching Integration
- Database Optimization Workflows
- API Endpoint Integration
- WebSocket Real-time Updates

### Performance Tests (`/tests/performance/`)

Load testing, stress testing, and performance regression detection.

```bash
# Run performance tests
npm run test:performance

# Run load tests
npm run test:load

# Run stress tests
npm run test:stress

# Generate performance report
npm run test:performance:report
```

**Performance Metrics:**
- Response Time Benchmarks
- Throughput Measurements
- Memory Usage Analysis
- Concurrent Request Handling
- Database Query Performance
- Cache Hit Rate Analysis

### E2E Tests (`/tests/e2e/`)

Full browser automation tests with Playwright.

```bash
# Run E2E tests
npm run test:e2e

# Run on specific browser
npm run test:e2e:chrome

# Run with headed mode
npm run test:e2e:headed

# Run debug mode
npm run test:e2e:debug
```

**E2E Scenarios:**
- Complete User Workflows
- Real-time Dashboard Functionality
- WebSocket Communication
- Cross-browser Compatibility
- Mobile Responsiveness
- Accessibility Compliance

## ⚙️ Configuration

### Jest Configuration

The test suite uses multiple Jest configurations for different test types:

- `jest.unit.config.ts` - Unit tests with high coverage thresholds
- `jest.integration.config.ts` - Integration tests with database setup
- `jest.performance.config.ts` - Performance tests with single worker
- `jest.e2e.config.ts` - E2E tests with Playwright integration

### Environment Configuration

```bash
# Test environment
NODE_ENV=test

# Database configuration
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/test_db

# Redis configuration
TEST_REDIS_URL=redis://localhost:6379/1

# LLM API keys (for integration tests)
OPENAI_API_KEY=test_key
ANTHROPIC_API_KEY=test_key

# Performance thresholds
PERFORMANCE_RESPONSE_TIME_THRESHOLD=2000
PERFORMANCE_MEMORY_THRESHOLD=512
```

### Coverage Configuration

```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    },
    "./src/services/": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  }
}
```

## 🏃 Running Tests

### Development Workflow

```bash
# 1. Start development environment
npm run dev

# 2. Run tests in watch mode
npm run test:watch

# 3. Run specific test file
npm run test:unit -- services/streaming-llm-worker.test.ts

# 4. Check coverage
npm run test:coverage

# 5. Run performance tests
npm run test:performance
```

### CI/CD Pipeline

The test suite is integrated into the CI/CD pipeline:

```bash
# Run CI pipeline locally
npm run test:ci

# Run with Docker
npm run test:ci:docker

# Generate CI report
npm run test:ci:report
```

### Test Commands Reference

| Command | Description |
|---------|-------------|
| `npm run test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run test:performance` | Run performance tests only |
| `npm run test:e2e` | Run E2E tests only |
| `npm run test:security` | Run security tests only |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:ci` | Run CI pipeline |

## 📊 Performance Testing

### Load Testing

```typescript
// Example: Load testing LLM analysis endpoint
import { performanceTest } from '../utils/performance-testing-utils';

describe('LLM Analysis Load Testing', () => {
  performanceTest({
    name: 'LLM Analysis Endpoint',
    endpoint: '/api/analysis/llm',
    method: 'POST',
    payload: generateAnalysisPayload(),
    concurrency: 50,
    duration: 30000,
    thresholds: {
      avgResponseTime: 2000,
      maxResponseTime: 5000,
      errorRate: 0.01,
      throughput: 10
    }
  });
});
```

### Stress Testing

```typescript
// Example: Stress testing caching service
describe('Caching Service Stress Test', () => {
  it('should handle high load without degradation', async () => {
    const promises = Array.from({ length: 1000 }, () =>
      cachingService.get(`key-${Math.random()}`)
    );

    const results = await Promise.allSettled(promises);
    const failures = results.filter(r => r.status === 'rejected');

    expect(failures.length).toBeLessThan(10); // <1% failure rate
  });
});
```

### Memory Leak Detection

```typescript
// Example: Memory leak detection
describe('Memory Leak Detection', () => {
  it('should not leak memory during sustained operation', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Run sustained operation
    for (let i = 0; i < 10000; i++) {
      await service.processItem(generateTestItem());
    }

    // Force garbage collection
    global.gc?.();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // <50MB increase
  });
});
```

## 🎭 Mock Data and Utilities

### Database Utilities

```typescript
import { TestDatabase } from '../utils/test-database';

// Setup test database
const testDb = new TestDatabase();
await testDb.setup();

// Create test data
const questionnaire = await testDb.createQuestionnaire({
  title: 'Test Questionnaire',
  questions: generateTestQuestions(5)
});

// Cleanup
await testDb.cleanup();
```

### Redis Mock

```typescript
import { MockRedis } from '../utils/test-redis';

// Setup mock Redis
const mockRedis = new MockRedis();

// Use in tests
await mockRedis.set('test-key', 'test-value');
const value = await mockRedis.get('test-key');
```

### LLM API Mocks

```typescript
import { createMockOpenAI } from '../utils/llm-mock-utils';

// Create mock OpenAI client
const mockOpenAI = createMockOpenAI({
  responses: [
    { content: 'First response' },
    { content: 'Second response' }
  ]
});

// Use in tests
const response = await mockOpenAI.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Test' }]
});
```

### Performance Utilities

```typescript
import { measurePerformance } from '../utils/performance-testing-utils';

// Measure performance
const { duration, memory, operations } = await measurePerformance(async () => {
  await service.processLargeDataset(data);
});

expect(duration).toBeLessThan(5000);
expect(memory.heapUsed).toBeLessThan(100 * 1024 * 1024);
```

## 🔄 CI/CD Integration

### GitHub Actions

The test suite is integrated into GitHub Actions with comprehensive workflows:

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Test Reports

Test reports are generated and uploaded as artifacts:

- **Coverage Reports**: LCOV format with detailed coverage analysis
- **Performance Reports**: JSON and HTML reports with performance metrics
- **E2E Reports**: Screenshots and videos of test executions
- **Security Reports**: Vulnerability scan results

### Deployment Gates

Tests act as deployment gates:

```yaml
# Deployment pipeline
deploy:
  needs: [test, security, performance]
  if: needs.test.result == 'success' && needs.security.result == 'success'
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to staging
      run: npm run deploy:staging
```

## 📚 Best Practices

### Test Structure

```typescript
describe('Service Name', () => {
  let service: Service;
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(() => {
    // Setup mocks and service instance
    mockDependency = createMockDependency();
    service = new Service(mockDependency);
  });

  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });

  describe('Method Name', () => {
    it('should perform expected behavior', async () => {
      // Arrange
      const input = createTestInput();
      mockDependency.method.mockResolvedValue(expectedOutput);

      // Act
      const result = await service.method(input);

      // Assert
      expect(result).toEqual(expectedOutput);
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });
  });
});
```

### Performance Testing

```typescript
describe('Performance Tests', () => {
  const thresholds = {
    responseTime: 2000,
    memoryUsage: 512 * 1024 * 1024,
    throughput: 100
  };

  it('should meet performance thresholds', async () => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Execute operation
    await service.heavyOperation(largeDataset);

    const duration = Date.now() - startTime;
    const memoryUsed = process.memoryUsage().heapUsed - startMemory;

    expect(duration).toBeLessThan(thresholds.responseTime);
    expect(memoryUsed).toBeLessThan(thresholds.memoryUsage);
  });
});
```

### Integration Testing

```typescript
describe('Integration Tests', () => {
  let testDb: TestDatabase;
  let app: Application;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    app = createApp(testDb.connection);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it('should handle complete workflow', async () => {
    // Create test data
    const user = await testDb.createUser(testUserData);
    const questionnaire = await testDb.createQuestionnaire(testQuestionnaireData);

    // Execute workflow
    const response = await request(app)
      .post(`/api/questionnaires/${questionnaire.id}/analyze`)
      .set('Authorization', `Bearer ${user.token}`)
      .send(analysisRequest);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('analysisId');
  });
});
```

### Error Handling

```typescript
describe('Error Handling', () => {
  it('should handle API errors gracefully', async () => {
    // Mock API error
    mockLLMService.analyze.mockRejectedValue(new Error('API Error'));

    // Execute and verify error handling
    await expect(service.analyze(data)).rejects.toThrow('API Error');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'LLM analysis failed',
      expect.objectContaining({ error: 'API Error' })
    );
  });

  it('should retry on transient failures', async () => {
    mockLLMService.analyze
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(expectedResult);

    const result = await service.analyze(data);

    expect(result).toEqual(expectedResult);
    expect(mockLLMService.analyze).toHaveBeenCalledTimes(2);
  });
});
```

## 🔧 Troubleshooting

### Common Issues

#### Test Database Connection Issues

```bash
# Reset test database
npm run test:db:reset

# Check database connection
npm run test:db:check

# Recreate test database
npm run test:db:recreate
```

#### Redis Connection Issues

```bash
# Start Redis for testing
docker-compose up -d redis-test

# Check Redis connection
npm run test:redis:check

# Reset Redis data
npm run test:redis:reset
```

#### Performance Test Failures

```bash
# Run performance tests with debugging
npm run test:performance:debug

# Generate detailed performance report
npm run test:performance:report

# Run single performance test
npm run test:performance -- --testNamePattern="specific test"
```

#### E2E Test Failures

```bash
# Run E2E tests in headed mode
npm run test:e2e:headed

# Run specific E2E test
npm run test:e2e -- --grep="specific test"

# Debug E2E tests
npm run test:e2e:debug
```

### Debug Mode

```bash
# Run tests with debugging
DEBUG=test* npm run test

# Run specific test with debugging
DEBUG=test* npm run test:unit -- services/streaming-llm-worker.test.ts

# Enable verbose logging
VERBOSE=true npm run test
```

### Coverage Issues

```bash
# Generate detailed coverage report
npm run test:coverage:report

# Check uncovered lines
npm run test:coverage:uncovered

# Generate HTML coverage report
npm run test:coverage:html
```

### Memory Issues

```bash
# Run tests with increased memory
NODE_OPTIONS="--max-old-space-size=4096" npm run test

# Run performance tests with memory monitoring
npm run test:performance:memory

# Check for memory leaks
npm run test:memory:leak
```

## 📖 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Performance Testing Guide](./docs/performance-testing.md)
- [Mock Data Guide](./docs/mock-data.md)
- [CI/CD Guide](./docs/ci-cd.md)

## 🤝 Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Ensure proper setup and teardown
3. Add appropriate mocks and test data
4. Include performance tests for critical paths
5. Update documentation for new test types
6. Verify coverage thresholds are maintained

## 📞 Support

For testing-related issues:

1. Check this documentation for common solutions
2. Review existing test files for patterns
3. Check GitHub Actions for CI/CD issues
4. Create an issue with detailed reproduction steps

---

**Happy Testing! 🎉**