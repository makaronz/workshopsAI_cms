# Contributing to the Test Suite

Thank you for your interest in contributing to the WorkshopsAI CMS test suite! This guide will help you understand how to contribute effectively and maintain high testing standards.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Test Standards](#test-standards)
- [Mock Data](#mock-data)
- [Performance Testing](#performance-testing)
- [E2E Testing](#e2e-testing)
- [Review Process](#review-process)
- [Debugging](#debugging)

## 🚀 Getting Started

### Prerequisites

Before contributing to the test suite, ensure you have:

- Node.js 18.x or later
- npm or yarn package manager
- Git installed and configured
- Access to the repository

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd workshopsAI_cms

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Set up test environment
cp .env.example .env.test
```

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📂 Test Structure

The test suite follows a well-organized structure:

```
tests/
├── config/                 # Configuration files
│   ├── jest.unit.config.ts
│   ├── jest.integration.config.ts
│   ├── jest.performance.config.ts
│   └── jest.setup.ts
├── docs/                   # Documentation
│   ├── performance-testing-guide.md
│   ├── mock-data-guide.md
│   ├── e2e-testing-guide.md
│   └── ci-cd-integration.md
├── e2e/                    # End-to-end tests
│   ├── complete-workflows/
│   ├── performance/
│   ├── real-time/
│   └── pages/
├── integration/            # Integration tests
│   ├── performance/
│   ├── llm-analysis/
│   └── caching/
├── performance/            # Performance tests
│   ├── load-testing/
│   ├── stress-testing/
│   └── api-performance/
├── unit/                   # Unit tests
│   ├── services/
│   ├── controllers/
│   └── utils/
├── utils/                  # Test utilities
│   ├── test-database.ts
│   ├── test-redis.ts
│   ├── mock-data-generators.ts
│   └── performance-testing-utils.ts
└── fixtures/               # Test fixtures
    └── test-fixtures.ts
```

## ✍️ Writing Tests

### Unit Tests

Unit tests should be fast, isolated, and focused on testing a single piece of functionality.

```typescript
// Example: Unit test for a service
describe('LLMWorkerService', () => {
  let service: LLMWorkerService;
  let mockRedis: jest.Mocked<Redis>;
  let mockDatabase: jest.Mocked<Database>;

  beforeEach(() => {
    // Setup mocks
    mockRedis = createMockRedis();
    mockDatabase = createMockDatabase();

    // Create service instance
    service = new LLMWorkerService({
      redis: mockRedis,
      database: mockDatabase
    });
  });

  afterEach(() => {
    // Clean up mocks
    jest.clearAllMocks();
  });

  describe('processJob', () => {
    it('should process LLM job successfully', async () => {
      // Arrange
      const job = createMockJob({
        id: 'job-123',
        type: 'llm-analysis',
        data: { questionnaireId: 'q-123' }
      });

      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockDatabase.query.mockResolvedValue(mockQuestionnaireData);

      // Act
      const result = await service.processJob(job);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(mockRedis.set).toHaveBeenCalledWith(
        `job:${job.id}:result`,
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should handle job processing errors', async () => {
      // Arrange
      const job = createMockJob({ id: 'job-123', type: 'llm-analysis' });
      const error = new Error('Processing failed');

      mockDatabase.query.mockRejectedValue(error);

      // Act & Assert
      await expect(service.processJob(job)).rejects.toThrow('Processing failed');
      expect(mockRedis.set).toHaveBeenCalledWith(
        `job:${job.id}:error`,
        expect.stringContaining('Processing failed'),
        expect.any(Number)
      );
    });
  });
});
```

### Integration Tests

Integration tests should verify that multiple components work together correctly.

```typescript
// Example: Integration test for LLM analysis workflow
describe('LLM Analysis Integration', () => {
  let testDb: TestDatabase;
  let app: Application;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    app = createTestApp({ database: testDb });
  });

  afterAll(async () => {
    await testDb.cleanup();
    await app.close();
  });

  it('should complete full LLM analysis workflow', async () => {
    // Arrange
    const user = await testDb.createUser({
      email: 'test@example.com',
      role: 'admin'
    });

    const questionnaire = await testDb.createQuestionnaire({
      title: 'Test Questionnaire',
      createdBy: user.id
    });

    const answers = await testDb.createAnswersForQuestionnaire(
      questionnaire.id,
      25,
      { responseRate: 0.8 }
    );

    // Act
    const response = await request(app)
      .post(`/api/questionnaires/${questionnaire.id}/analyze`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        model: 'gpt-4',
        options: { streaming: false }
      })
      .expect(200);

    // Assert
    expect(response.body).toHaveProperty('analysisId');
    expect(response.body.status).toBe('processing');

    // Wait for analysis to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    const finalResponse = await request(app)
      .get(`/api/analysis/${response.body.analysisId}`)
      .expect(200);

    expect(finalResponse.body.status).toBe('completed');
    expect(finalResponse.body.result).toHaveProperty('summary');
  });
});
```

### E2E Tests

E2E tests should simulate real user interactions across the entire application.

```typescript
// Example: E2E test for complete user workflow
test.describe('User Questionnaire Workflow', () => {
  test('should create and analyze questionnaire end-to-end', async ({ page }) => {
    // Navigate to application
    await page.goto('/');

    // Login
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit-login"]');

    // Create questionnaire
    await page.click('[data-testid="create-questionnaire"]');
    await page.fill('[data-testid="title"]', 'Customer Satisfaction Survey');
    await page.fill('[data-testid="description"]', 'Survey for customer feedback');
    await page.click('[data-testid="add-question"]');
    await page.fill('[data-testid="question-text"]', 'How satisfied are you?');
    await page.selectOption('[data-testid="question-type"]', 'multiple-choice');
    await page.click('[data-testid="save-question"]');
    await page.click('[data-testid="publish-questionnaire"]');

    // Verify questionnaire created
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="questionnaire-list"]')).toContainText('Customer Satisfaction Survey');

    // Start analysis
    await page.click('[data-testid="analyze-questionnaire"]');
    await page.selectOption('[data-testid="model-select"]', 'gpt-4');
    await page.click('[data-testid="start-analysis"]');

    // Monitor progress
    await expect(page.locator('[data-testid="analysis-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="analysis-status"]')).toHaveText('processing');

    // Wait for completion
    await page.waitForSelector('[data-testid="analysis-status"]:has-text("completed")', {
      timeout: 60000
    });

    // Verify results
    await expect(page.locator('[data-testid="analysis-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="analysis-summary"]')).toContainText('customer satisfaction');
  });
});
```

## 📏 Test Standards

### Naming Conventions

- **Test Files**: Use kebab-case with descriptive names
  - ✅ `streaming-llm-worker.test.ts`
  - ❌ `test_worker.ts`
- **Test Suites**: Use clear, descriptive names
  - ✅ `describe('LLM Worker Processing')`
  - ❌ `describe('worker tests')`
- **Test Cases**: Use "should" format to describe expected behavior
  - ✅ `it('should process LLM job successfully')`
  - ❌ `it('processes job')`

### Test Structure

Follow the AAA pattern (Arrange, Act, Assert):

```typescript
it('should validate user input correctly', () => {
  // Arrange
  const validator = new InputValidator();
  const invalidInput = { email: 'invalid-email', name: '' };

  // Act
  const result = validator.validate(invalidInput);

  // Assert
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain('Invalid email format');
  expect(result.errors).toContain('Name is required');
});
```

### Test Coverage

- **Unit Tests**: Aim for 90%+ coverage on critical business logic
- **Integration Tests**: Cover all major workflows and edge cases
- **E2E Tests**: Cover all critical user journeys
- **Performance Tests**: Cover all performance-critical paths

### Error Testing

Always test error conditions and edge cases:

```typescript
it('should handle API errors gracefully', async () => {
  // Mock API error
  mockApiClient.analyze.mockRejectedValue(new Error('API Error'));

  // Test error handling
  await expect(service.analyze(data)).rejects.toThrow('API Error');
  expect(mockLogger.error).toHaveBeenCalledWith(
    'Analysis failed',
    expect.objectContaining({ error: 'API Error' })
  );
});
```

## 🎭 Mock Data

### Data Generators

Use the provided data generators for consistent test data:

```typescript
import { generateUser, generateQuestionnaire } from '../utils/mock-data-generators';

// Generate test data
const user = generateUser({ role: 'admin' });
const questionnaire = generateQuestionnaire({
  title: 'Test Questionnaire',
  questionCount: 10
});
```

### Mock Services

Create consistent mocks for external dependencies:

```typescript
import { createMockOpenAI } from '../utils/llm-mock-utils';

const mockOpenAI = createMockOpenAI({
  defaultModel: 'gpt-4',
  responses: [
    { content: 'Test response 1' },
    { content: 'Test response 2' }
  ]
});
```

### Test Database

Use the test database utilities for consistent test data:

```typescript
import { TestDatabase } from '../utils/test-database';

const testDb = new TestDatabase();
await testDb.setup();

// Create test data
const user = await testDb.createUser(testUserData);
const questionnaire = await testDb.createQuestionnaire(testQuestionnaireData);
```

## ⚡ Performance Testing

### Load Testing

Follow the patterns for performance testing:

```typescript
import { performanceTest } from '../utils/performance-testing-utils';

performanceTest({
  name: 'LLM Analysis Load Test',
  endpoint: '/api/analysis/llm',
  method: 'POST',
  payload: generateAnalysisPayload(),
  concurrency: 50,
  duration: 30000,
  thresholds: {
    avgResponseTime: 2000,
    maxResponseTime: 5000,
    errorRate: 0.01
  }
});
```

### Memory Testing

Include memory leak detection:

```typescript
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

  expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // <50MB
});
```

## 🌐 E2E Testing

### Page Object Model

Use the Page Object Model for maintainable E2E tests:

```typescript
import { QuestionnairePage } from '../pages/questionnaire-page';

const questionnairePage = new QuestionnairePage(page);
await questionnairePage.gotoQuestionnaires();
await questionnairePage.createQuestionnaire(testData);
```

### Browser Support

Ensure tests work across all supported browsers:

```typescript
test.describe.configure({ mode: 'parallel' });

['chromium', 'firefox', 'webkit'].forEach(browserName => {
  test.describe(`Browser: ${browserName}`, () => {
    test.use({ browserName });

    test('should work in ' + browserName, async ({ page }) => {
      // Test implementation
    });
  });
});
```

### Accessibility Testing

Include accessibility testing in E2E tests:

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test.beforeEach(async ({ page }) => {
  await injectAxe(page);
});

test('should meet accessibility standards', async ({ page }) => {
  await page.goto('/dashboard');
  await checkA11y(page);
});
```

## 🔍 Review Process

### Before Submitting

1. **Run Tests Locally**: Ensure all tests pass
   ```bash
   npm run test
   npm run test:coverage
   ```

2. **Check Code Quality**: Run linting and formatting
   ```bash
   npm run lint
   npm run format:check
   ```

3. **Update Documentation**: Update relevant documentation
4. **Test Edge Cases**: Ensure error conditions are tested

### Pull Request Requirements

- **Clear Description**: Explain what tests were added/modified
- **Test Coverage**: Ensure new code is adequately tested
- **Documentation**: Update relevant documentation
- **Performance**: Consider performance impact

### Code Review Checklist

- [ ] Tests follow naming conventions
- [ ] Tests use AAA pattern
- [ ] Tests include error conditions
- [ ] Tests use appropriate mocks
- [ ] Tests are deterministic
- [ ] Tests don't depend on each other
- [ ] Performance tests include thresholds
- [ ] E2E tests use Page Object Model
- [ ] Accessibility tests are included where relevant

## 🐛 Debugging

### Local Debugging

```bash
# Run tests in debug mode
npx playwright test --debug

# Run tests with trace
npx playwright test --trace on

# Run specific test
npx playwright test --grep "test name"
```

### Test Isolation

If tests are flaky, ensure they're properly isolated:

```typescript
beforeEach(async () => {
  // Reset test state
  await resetTestDatabase();
  await clearCache();
});

afterEach(async () => {
  // Cleanup
  await cleanupTestData();
});
```

### Performance Debugging

```bash
# Run performance tests with detailed output
DEBUG=performance* npm run test:performance

# Generate performance profile
npm run test:performance:profile
```

## 📚 Resources

### Documentation

- [Performance Testing Guide](./docs/performance-testing-guide.md)
- [Mock Data Guide](./docs/mock-data-guide.md)
- [E2E Testing Guide](./docs/e2e-testing-guide.md)
- [CI/CD Integration Guide](./docs/ci-cd-integration.md)

### Tools

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Best Practices](https://github.com/goldbergyoni/node-testing-best-practices)

## 🤝 Getting Help

If you need help with test contributions:

1. Check existing tests for patterns
2. Review the documentation
3. Ask questions in pull requests
4. Join team discussions about testing

## 📝 Template for New Tests

Use this template for new test files:

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Add other imports as needed

describe('[Component/Service Name]', () => {
  let service: ServiceType;
  let mocks: MockTypes;

  beforeEach(() => {
    // Setup mocks and service instance
    mocks = createMocks();
    service = new ServiceType(mocks);
  });

  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });

  describe('[Feature Name]', () => {
    it('should [expected behavior]', async () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = await service.method(input);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should handle [error condition]', async () => {
      // Arrange
      const error = new Error('Test error');
      mocks.dependency.method.mockRejectedValue(error);

      // Act & Assert
      await expect(service.method(input)).rejects.toThrow('Test error');
    });
  });
});
```

---

Thank you for contributing to the test suite! Your contributions help ensure the quality and reliability of the WorkshopsAI CMS application.