# Mock Data and Utilities Guide

Comprehensive guide to using mock data generators, test utilities, and mocking strategies for the WorkshopsAI CMS testing suite.

## 📋 Table of Contents

- [Mock Data Overview](#mock-data-overview)
- [Mock Data Generators](#mock-data-generators)
- [Database Test Utilities](#database-test-utilities)
- [Redis Test Utilities](#redis-test-utilities)
- [LLM API Mocks](#llm-api-mocks)
- [Performance Testing Utilities](#performance-testing-utilities)
- [Custom Mock Strategies](#custom-mock-strategies)
- [Test Data Management](#test-data-management)
- [Best Practices](#best-practices)
- [Examples and Patterns](#examples-and-patterns)

## 🎯 Mock Data Overview

Mock data is essential for creating reliable, repeatable tests that don't depend on external services or production data. This guide covers:

- **Data Generators**: Create realistic test data for all entities
- **Database Utilities**: Set up and manage test databases
- **Redis Mocks**: Mock Redis functionality for caching tests
- **LLM API Mocks**: Mock OpenAI and Anthropic API responses
- **Performance Utilities**: Measure and analyze performance metrics
- **Custom Mocks**: Create specialized mocks for specific scenarios

### Benefits of Mock Data

- **Consistency**: Same data structure across all tests
- **Isolation**: Tests don't depend on external services
- **Performance**: Faster test execution without network calls
- **Control**: Predictable test behavior and outcomes
- **Coverage**: Test edge cases and error conditions
- **Reproducibility**: Consistent test results across environments

## 🎲 Mock Data Generators

The mock data generators provide realistic, consistent test data for all entities in the system.

### Basic Usage

```typescript
import {
  generateUser,
  generateQuestionnaire,
  generateAnalysis,
  generateAnswer,
  createBatchData
} from '../utils/mock-data-generators';

// Generate single entities
const user = generateUser({ role: 'admin' });
const questionnaire = generateQuestionnaire({
  title: 'Test Questionnaire',
  questionCount: 10
});

// Generate batch data
const users = createBatchData('user', 50, { role: 'user' });
const questionnaires = createBatchData('questionnaire', 20);
```

### User Data Generation

```typescript
// Generate basic user
const basicUser = generateUser();
// Returns: { id: string, email: string, name: string, role: 'user', createdAt: Date }

// Generate user with custom options
const adminUser = generateUser({
  role: 'admin',
  email: 'admin@example.com',
  name: 'Admin User'
});

// Generate user with specific ID
const userWithId = generateUser({
  id: 'user-123',
  role: 'moderator'
});

// Batch generate users
const users = generateUsers(25, {
  role: 'user',
  status: 'active'
});
```

### Questionnaire Data Generation

```typescript
// Generate basic questionnaire
const questionnaire = generateQuestionnaire();

// Generate with custom options
const customQuestionnaire = generateQuestionnaire({
  title: 'Customer Satisfaction Survey',
  description: 'Survey for measuring customer satisfaction',
  status: 'published',
  questionCount: 15
});

// Generate with specific questions
const questionnaireWithQuestions = generateQuestionnaire({
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      text: 'How satisfied are you?',
      options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'],
      required: true
    },
    {
      id: 'q2',
      type: 'text',
      text: 'Additional comments',
      required: false
    }
  ]
});

// Generate questionnaires with relationships
const questionnaireWithAnswers = generateQuestionnaire({
  includeAnswers: true,
  answerCount: 100
});
```

### Analysis Data Generation

```typescript
// Generate basic analysis
const analysis = generateAnalysis();

// Generate with custom options
const customAnalysis = generateAnalysis({
  questionnaireId: 'q-123',
  model: 'gpt-4',
  status: 'completed',
  resultType: 'comprehensive'
});

// Generate with mock LLM response
const analysisWithResponse = generateAnalysis({
  includeLLMResponse: true,
  responseLength: 1000,
  responseFormat: 'json'
});

// Generate analysis with streaming data
const streamingAnalysis = generateAnalysis({
  includeStreamingData: true,
  chunkCount: 20,
  delay: 100
});
```

### Answer Data Generation

```typescript
// Generate basic answer
const answer = generateAnswer();

// Generate with custom options
const customAnswer = generateAnswer({
  questionnaireId: 'q-123',
  userId: 'u-456',
  questionId: 'q-789',
  responseText: 'Custom answer text'
});

// Generate batch answers for questionnaire
const answers = generateAnswersForQuestionnaire('q-123', 50, {
  responseRate: 0.8, // 80% response rate
  completionRate: 0.6 // 60% completion rate
});
```

## 🗄️ Database Test Utilities

Database utilities provide seamless test database setup, data management, and cleanup.

### Basic Database Setup

```typescript
import { TestDatabase } from '../utils/test-database';

// Create test database instance
const testDb = new TestDatabase({
  connectionString: 'postgresql://test:test@localhost:5432/test_db',
  resetOnSetup: true,
  seedData: true
});

// Setup database (creates tables, runs migrations)
await testDb.setup();

// Get database connection
const db = testDb.getConnection();

// Cleanup database
await testDb.cleanup();
```

### Data Management

```typescript
// Create test data
const user = await testDb.createUser({
  email: 'test@example.com',
  name: 'Test User',
  role: 'user'
});

const questionnaire = await testDb.createQuestionnaire({
  title: 'Test Questionnaire',
  createdBy: user.id
});

// Create related data
const answers = await testDb.createAnswersForQuestionnaire(
  questionnaire.id,
  10, // number of answers
  { responseRate: 0.8 }
);

// Create analysis
const analysis = await testDb.createAnalysis({
  questionnaireId: questionnaire.id,
  status: 'completed',
  result: generateLLMResponse()
});
```

### Database Seeding

```typescript
// Seed with large dataset
await testDb.seedLargeDataset({
  users: 1000,
  questionnaires: 100,
  answers: 10000,
  analyses: 500
});

// Seed with custom data
await testDb.seedCustomData([
  {
    table: 'users',
    data: generateUsers(100, { role: 'admin' })
  },
  {
    table: 'questionnaires',
    data: generateQuestionnaires(20, { status: 'published' })
  }
]);
```

### Transaction Testing

```typescript
// Test transaction behavior
await testDb.withTransaction(async (trx) => {
  const user = await trx.insert('users').values(generateUser()).returning('*');
  const questionnaire = await trx.insert('questionnaires').values({
    ...generateQuestionnaire(),
    createdBy: user.id
  }).returning('*');

  // Transaction will be rolled back if error occurs
  if (Math.random() < 0.1) { // 10% chance of failure
    throw new Error('Simulated failure');
  }

  return { user, questionnaire };
});
```

### Database Cleanup

```typescript
// Clean specific tables
await testDb.cleanTables(['users', 'questionnaires']);

// Clean all tables
await testDb.cleanAllTables();

// Reset database (drop and recreate)
await testDb.resetDatabase();

// Clean with conditions
await testDb.cleanTable('users', { role: 'test' });
```

## 🔄 Redis Test Utilities

Redis utilities provide a complete mock implementation for testing caching functionality.

### Basic Redis Mock

```typescript
import { MockRedis } from '../utils/test-redis';

// Create mock Redis instance
const mockRedis = new MockRedis({
  defaultTTL: 3600,
  enablePersistence: false
});

// Use in tests
await mockRedis.set('test-key', 'test-value');
const value = await mockRedis.get('test-key');
expect(value).toBe('test-value');
```

### Advanced Redis Operations

```typescript
// Hash operations
await mockRedis.hset('user:123', {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user'
});

const user = await mockRedis.hgetall('user:123');
expect(user).toEqual({
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user'
});

// List operations
await mockRedis.lpush('queue:tasks', 'task1', 'task2', 'task3');
const tasks = await mockRedis.lrange('queue:tasks', 0, -1);
expect(tasks).toEqual(['task3', 'task2', 'task1']);

// Set operations
await mockRedis.sadd('permissions:123', 'read', 'write', 'admin');
const permissions = await mockRedis.smembers('permissions:123');
expect(permissions).toContain('read');

// Pub/Sub operations
let receivedMessage: string | null = null;
await mockRedis.subscribe('notifications', (message) => {
  receivedMessage = message;
});

await mockRedis.publish('notifications', 'Hello World');
expect(receivedMessage).toBe('Hello World');
```

### Redis Mock Configuration

```typescript
// Configure with custom options
const mockRedis = new MockRedis({
  defaultTTL: 1800, // 30 minutes
  maxKeys: 10000,
  enablePersistence: true,
  persistenceFile: './test-redis-data.json',
  onEviction: (key, reason) => {
    console.log(`Key ${key} evicted: ${reason}`);
  }
});

// Simulate Redis errors
mockRedis.setErrorMode(true);
await expect(mockRedis.get('test-key')).rejects.toThrow('Redis error');

// Simulate network latency
mockRedis.setLatency(100); // 100ms delay
const start = Date.now();
await mockRedis.get('test-key');
const duration = Date.now() - start;
expect(duration).toBeGreaterThanOrEqual(100);
```

## 🤖 LLM API Mocks

LLM API mocks provide realistic simulation of OpenAI and Anthropic API responses for testing streaming functionality.

### OpenAI API Mock

```typescript
import { createMockOpenAI, createMockAnthropic } from '../utils/llm-mock-utils';

// Create mock OpenAI client
const mockOpenAI = createMockOpenAI({
  defaultModel: 'gpt-4',
  defaultResponse: 'This is a mock response',
  streamingEnabled: true,
  delay: 100 // 100ms delay between chunks
});

// Use in tests
const response = await mockOpenAI.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Test message' }],
  stream: false
});

expect(response.choices[0].message.content).toBe('This is a mock response');
```

### Streaming Response Mock

```typescript
// Create streaming mock
const streamingMock = createMockOpenAI({
  streamingEnabled: true,
  chunkSize: 10, // 10 characters per chunk
  delay: 50, // 50ms between chunks
  responseContent: 'This is a longer streaming response that will be delivered in chunks'
});

// Test streaming functionality
const stream = await streamingMock.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Test streaming' }],
  stream: true
});

const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk.choices[0]?.delta?.content || '');
}

const fullResponse = chunks.join('');
expect(fullResponse).toBe('This is a longer streaming response that will be delivered in chunks');
```

### Custom Response Configuration

```typescript
// Configure custom responses
const customMock = createMockOpenAI({
  responses: [
    {
      content: 'First custom response',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    },
    {
      content: 'Second custom response',
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
    }
  ]
});

// Configure conditional responses
const conditionalMock = createMockOpenAI({
  responseGenerator: (messages, options) => {
    const userMessage = messages[messages.length - 1].content;

    if (userMessage.includes('error')) {
      throw new Error('Simulated API error');
    }

    if (userMessage.includes('slow')) {
      return { content: 'Slow response', delay: 2000 };
    }

    return { content: `Response to: ${userMessage}` };
  }
});
```

### Anthropic API Mock

```typescript
// Create mock Anthropic client
const mockAnthropic = createMockAnthropic({
  defaultModel: 'claude-3-sonnet-20240229',
  defaultResponse: 'Mock Claude response',
  streamingEnabled: true
});

// Test Anthropic API
const response = await mockAnthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'Test message' }]
});

expect(response.content[0].type).toBe('text');
expect(response.content[0].text).toBe('Mock Claude response');
```

### Error Simulation

```typescript
// Simulate API errors
const errorMock = createMockOpenAI({
  errorRate: 0.1, // 10% error rate
  errorTypes: ['rate_limit', 'timeout', 'server_error']
});

// Simulate rate limiting
const rateLimitMock = createMockOpenAI({
  rateLimitConfig: {
    requestsPerMinute: 60,
    tokensPerMinute: 10000,
    currentRequests: 0,
    currentTokens: 0
  }
});

// Simulate timeout
const timeoutMock = createMockOpenAI({
  timeout: 5000, // 5 second timeout
  timeoutError: 'Request timeout'
});
```

## 📊 Performance Testing Utilities

Performance utilities provide tools for measuring, analyzing, and validating performance metrics.

### Basic Performance Measurement

```typescript
import { measurePerformance, createLoadTest, stressTest } from '../utils/performance-testing-utils';

// Measure single operation performance
const { duration, memory, operations } = await measurePerformance(async () => {
  await service.processLargeDataset(data);
});

expect(duration).toBeLessThan(5000); // <5 seconds
expect(memory.heapUsed).toBeLessThan(100 * 1024 * 1024); // <100MB
```

### Load Testing

```typescript
// Create load test
const loadTest = createLoadTest({
  target: service.processRequest,
  concurrency: 50,
  duration: 30000, // 30 seconds
  rampUpTime: 5000, // 5 second ramp up
  payload: generateTestData(),
  thresholds: {
    avgResponseTime: 1000,
    maxResponseTime: 3000,
    errorRate: 0.01,
    throughput: 25
  }
});

// Run load test
const results = await loadTest.run();

expect(results.avgResponseTime).toBeLessThan(1000);
expect(results.errorRate).toBeLessThan(0.01);
expect(results.throughput).toBeGreaterThan(25);
```

### Stress Testing

```typescript
// Create stress test
const stressTestResults = await stressTest({
  target: service.heavyOperation,
  pattern: 'ramp',
  startConcurrency: 10,
  endConcurrency: 100,
  duration: 120000, // 2 minutes
  stepDuration: 15000, // 15 seconds per step
  payload: generateLargeDataset(),
  failureCriteria: {
    errorRate: 0.1,
    avgResponseTime: 10000,
    memoryUsage: 1024 * 1024 * 1024 // 1GB
  }
});

expect(stressTestResults.maxConcurrencyReached).toBeGreaterThan(80);
expect(stressTestResults.memoryUsage).toBeLessThan(1024 * 1024 * 1024);
```

### Memory Leak Detection

```typescript
import { detectMemoryLeaks } from '../utils/performance-testing-utils';

// Detect memory leaks
const leakReport = await detectMemoryLeaks({
  target: service.processItem,
  iterations: 10000,
  payload: generateTestData(),
  gcInterval: 1000, // Force GC every 1000 iterations
  memoryThreshold: 50 * 1024 * 1024 // 50MB threshold
});

expect(leakReport.hasLeak).toBe(false);
expect(leakReport.memoryGrowth).toBeLessThan(leakReport.memoryThreshold);
```

## 🎨 Custom Mock Strategies

Create specialized mocks for specific testing scenarios.

### Response Time Simulation

```typescript
// Create mock with configurable response times
class TimedMockService {
  constructor(private responseTimeRange: [number, number]) {}

  async processRequest(request: any): Promise<any> {
    const [min, max] = this.responseTimeRange;
    const delay = Math.random() * (max - min) + min;

    await new Promise(resolve => setTimeout(resolve, delay));

    return {
      id: generateId(),
      processedAt: new Date(),
      request
    };
  }
}

// Use in tests
const mockService = new TimedMockService([100, 500]); // 100-500ms response time
```

### Stateful Mocks

```typescript
// Create stateful mock for testing state management
class StatefulMockCache {
  private cache = new Map<string, { value: any; timestamp: number; ttl: number }>();

  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: any, ttl: number = 3600000): Promise<void> {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  // Add methods for testing cache behavior
  getCacheSize(): number {
    return this.cache.size;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### Error Injection Mocks

```typescript
// Create mock with error injection
class ErrorInjectingMockService {
  private errorConfig: {
    rate: number;
    types: string[];
    conditions?: (request: any) => boolean;
  };

  constructor(errorConfig) {
    this.errorConfig = errorConfig;
  }

  async processRequest(request: any): Promise<any> {
    // Check if error should be injected
    if (this.shouldInjectError(request)) {
      throw this.createError();
    }

    return this.processNormally(request);
  }

  private shouldInjectError(request: any): boolean {
    if (Math.random() > this.errorConfig.rate) {
      return false;
    }

    if (this.errorConfig.conditions && !this.errorConfig.conditions(request)) {
      return false;
    }

    return true;
  }

  private createError(): Error {
    const errorTypes = this.errorConfig.types;
    const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];

    switch (errorType) {
      case 'timeout':
        return new Error('Request timeout');
      case 'rate_limit':
        return new Error('Rate limit exceeded');
      case 'server_error':
        return new Error('Internal server error');
      default:
        return new Error('Unknown error');
    }
  }
}
```

## 📁 Test Data Management

Proper management of test data ensures consistent and reliable tests.

### Data Factories

```typescript
// Create data factory for complex objects
class QuestionnaireFactory {
  static create(overrides: Partial<Questionnaire> = {}): Questionnaire {
    return {
      id: generateId(),
      title: 'Test Questionnaire',
      description: 'Test Description',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      questions: [],
      ...overrides
    };
  }

  static withQuestions(questionCount: number, overrides: Partial<Questionnaire> = {}): Questionnaire {
    return this.create({
      ...overrides,
      questions: Array.from({ length: questionCount }, (_, i) =>
        QuestionFactory.create({
          id: `q-${i + 1}`,
          order: i + 1
        })
      )
    });
  }

  static published(overrides: Partial<Questionnaire> = {}): Questionnaire {
    return this.create({
      ...overrides,
      status: 'published',
      publishedAt: new Date()
    });
  }
}
```

### Test Data Builders

```typescript
// Create builder pattern for complex test data
class QuestionnaireBuilder {
  private questionnaire: Partial<Questionnaire> = {};

  constructor() {
    this.questionnaire = {
      id: generateId(),
      title: 'Default Questionnaire',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      questions: []
    };
  }

  withTitle(title: string): this {
    this.questionnaire.title = title;
    return this;
  }

  withDescription(description: string): this {
    this.questionnaire.description = description;
    return this;
  }

  published(): this {
    this.questionnaire.status = 'published';
    this.questionnaire.publishedAt = new Date();
    return this;
  }

  withQuestions(count: number): this {
    this.questionnaire.questions = Array.from({ length: count }, (_, i) =>
      QuestionFactory.create({
        id: `q-${i + 1}`,
        order: i + 1,
        text: `Question ${i + 1}`
      })
    );
    return this;
  }

  build(): Questionnaire {
    return QuestionnaireFactory.create(this.questionnaire);
  }
}

// Usage
const questionnaire = new QuestionnaireBuilder()
  .withTitle('Customer Survey')
  .withDescription('Survey for customer feedback')
  .published()
  .withQuestions(10)
  .build();
```

### Test Data Cleanup Strategies

```typescript
// Implement cleanup strategies
class TestDataManager {
  private createdData: {
    users: string[];
    questionnaires: string[];
    answers: string[];
    analyses: string[];
  } = {
    users: [],
    questionnaires: [],
    answers: [],
    analyses: []
  };

  async createUser(data: Partial<User>): Promise<User> {
    const user = await testDb.createUser(data);
    this.createdData.users.push(user.id);
    return user;
  }

  async createQuestionnaire(data: Partial<Questionnaire>): Promise<Questionnaire> {
    const questionnaire = await testDb.createQuestionnaire(data);
    this.createdData.questionnaires.push(questionnaire.id);
    return questionnaire;
  }

  async cleanup(): Promise<void> {
    // Clean in reverse order of dependencies
    await testDb.deleteRecords('analyses', { id: { in: this.createdData.analyses } });
    await testDb.deleteRecords('answers', { id: { in: this.createdData.answers } });
    await testDb.deleteRecords('questionnaires', { id: { in: this.createdData.questionnaires } });
    await testDb.deleteRecords('users', { id: { in: this.createdData.users } });

    // Reset tracking
    this.createdData = {
      users: [],
      questionnaires: [],
      answers: [],
      analyses: []
    };
  }
}
```

## 🎯 Best Practices

### Mock Data Design

1. **Realistic Data**: Mock data should closely resemble production data
2. **Consistent Generation**: Same input should produce consistent output
3. **Configurable Options**: Allow customization of generated data
4. **Relationship Support**: Generate related data with proper foreign keys
5. **Edge Cases**: Include support for edge cases and error conditions

### Test Database Management

1. **Isolation**: Use separate test database from production
2. **Reset Between Tests**: Clean database state between test runs
3. **Transaction Rollback**: Use transactions for automatic cleanup
4. **Seed Data**: Use consistent seed data for repeatable tests
5. **Performance**: Optimize database setup for fast test execution

### Mock Service Design

1. **Interface Compliance**: Mocks should implement the same interface as real services
2. **Realistic Behavior**: Mock behavior should closely match real service behavior
3. **Configurable Responses**: Allow customization of mock responses
4. **Error Simulation**: Support for simulating various error conditions
5. **Performance**: Mocks should be faster than real services

### Performance Testing

1. **Baseline Establishment**: Create performance baselines for comparison
2. **Threshold Setting**: Set appropriate performance thresholds
3. **Metric Collection**: Collect comprehensive performance metrics
4. **Regression Detection**: Detect performance regressions over time
5. **Environment Consistency**: Use consistent testing environment

## 📚 Examples and Patterns

### Complete Test Example

```typescript
describe('LLM Analysis Service Integration', () => {
  let testDb: TestDatabase;
  let mockOpenAI: MockOpenAI;
  let mockRedis: MockRedis;
  let service: LLMAnalysisService;
  let dataManager: TestDataManager;

  beforeAll(async () => {
    // Setup test infrastructure
    testDb = new TestDatabase({ resetOnSetup: true });
    await testDb.setup();

    mockOpenAI = createMockOpenAI({
      streamingEnabled: true,
      responseContent: 'Mock analysis response'
    });

    mockRedis = new MockRedis({ defaultTTL: 3600 });

    service = new LLMAnalysisService({
      openai: mockOpenAI,
      redis: mockRedis,
      database: testDb.getConnection()
    });

    dataManager = new TestDataManager();
  });

  afterAll(async () => {
    await dataManager.cleanup();
    await testDb.cleanup();
  });

  beforeEach(() => {
    mockRedis.clear();
    jest.clearAllMocks();
  });

  it('should process questionnaire analysis with streaming', async () => {
    // Arrange
    const user = await dataManager.createUser({
      email: 'test@example.com',
      role: 'user'
    });

    const questionnaire = await dataManager.createQuestionnaire({
      title: 'Test Survey',
      createdBy: user.id,
      status: 'published'
    });

    const answers = await dataManager.createAnswersForQuestionnaire(
      questionnaire.id,
      25,
      { responseRate: 0.8 }
    );

    // Act
    const analysis = await service.startAnalysis(questionnaire.id, {
      model: 'gpt-4',
      streaming: true
    });

    // Assert
    expect(analysis.id).toBeDefined();
    expect(analysis.status).toBe('processing');
    expect(analysis.questionnaireId).toBe(questionnaire.id);

    // Verify streaming chunks
    const chunks = [];
    for await (const chunk of service.getAnalysisStream(analysis.id)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('Mock analysis response');

    // Verify cache usage
    const cachedResult = await mockRedis.get(`analysis:${analysis.id}`);
    expect(cachedResult).toBeDefined();

    // Verify database state
    const finalAnalysis = await testDb.getAnalysis(analysis.id);
    expect(finalAnalysis.status).toBe('completed');
    expect(finalAnalysis.result).toContain('Mock analysis response');
  });

  it('should handle API errors gracefully', async () => {
    // Arrange
    const questionnaire = await dataManager.createQuestionnaire();

    mockOpenAI.setErrorMode(true);
    mockOpenAI.setErrorRate(1.0); // 100% error rate

    // Act & Assert
    await expect(
      service.startAnalysis(questionnaire.id, { model: 'gpt-4' })
    ).rejects.toThrow('API error');

    // Verify error handling
    const analysis = await testDb.getAnalysisByQuestionnaire(questionnaire.id);
    expect(analysis.status).toBe('failed');
    expect(analysis.error).toContain('API error');
  });
});
```

### Performance Test Example

```typescript
describe('LLM Analysis Performance', () => {
  let service: LLMAnalysisService;
  let performanceCollector: PerformanceMetricsCollector;

  beforeAll(async () => {
    service = new LLMAnalysisService({ /* config */ });
    performanceCollector = new PerformanceMetricsCollector();
  });

  it('should meet performance thresholds under load', async () => {
    const loadTest = createLoadTest({
      target: service.processAnalysis,
      concurrency: 20,
      duration: 60000,
      rampUpTime: 10000,
      payload: () => ({
        questionnaireId: generateId(),
        options: { model: 'gpt-4' }
      }),
      thresholds: {
        avgResponseTime: 2000,
        maxResponseTime: 5000,
        errorRate: 0.01,
        throughput: 10
      }
    });

    const results = await loadTest.run();

    expect(results.avgResponseTime).toBeLessThan(2000);
    expect(results.p95ResponseTime).toBeLessThan(5000);
    expect(results.errorRate).toBeLessThan(0.01);
    expect(results.throughput).toBeGreaterThan(10);

    // Log detailed metrics
    console.log('Performance Results:', {
      avgResponseTime: results.avgResponseTime,
      p95ResponseTime: results.p95ResponseTime,
      maxResponseTime: results.maxResponseTime,
      throughput: results.throughput,
      errorRate: results.errorRate,
      totalRequests: results.totalRequests
    });
  });
});
```

This comprehensive mock data and utilities guide provides all the tools and patterns needed to create effective, maintainable tests for the WorkshopsAI CMS project.