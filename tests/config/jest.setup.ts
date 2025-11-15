import 'jest-extended';

// Global test configuration and mocks
global.console = {
  ...console,
  // Disable console.log during tests unless specifically needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error, // Keep errors for debugging
};

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.TEST_REDIS_URL = 'redis://localhost:6379/1';

// Global test timeout for async operations
jest.setTimeout(30000);

// Mock external services before all tests
beforeAll(async () => {
  // Setup any global test infrastructure
});

// Cleanup after all tests
afterAll(async () => {
  // Global cleanup
});

// Mock BullMQ for testing
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    process: jest.fn(),
    getJob: jest.fn(),
    close: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
  })),
  Job: jest.fn(),
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock Redis for testing
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    flushall: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// Mock OpenAI for testing
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
    embeddings: {
      create: jest.fn(),
    },
  })),
}));

// Mock Anthropic for testing
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidPerformanceMetric(): R;
      toBeWithinPerformanceThreshold(threshold: number): R;
      toHaveCompletedWithin(milliseconds: number): R;
    }
  }
}

// Custom matchers for performance testing
expect.extend({
  toBeValidPerformanceMetric(received) {
    const pass = typeof received === 'number' && received >= 0 && isFinite(received);
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid performance metric`
          : `expected ${received} to be a valid performance metric (non-negative finite number)`,
      pass,
    };
  },

  toBeWithinPerformanceThreshold(received: number, threshold: number) {
    const pass = typeof received === 'number' && received <= threshold;
    return {
      message: () =>
        pass
          ? `expected ${received} not to be within threshold ${threshold}`
          : `expected ${received} to be within threshold ${threshold}`,
      pass,
    };
  },

  toHaveCompletedWithin(received: [number, number], milliseconds: number) {
    const [startTime, endTime] = received;
    const duration = endTime - startTime;
    const pass = duration <= milliseconds;
    return {
      message: () =>
        pass
          ? `expected operation duration ${duration}ms not to be within ${milliseconds}ms`
          : `expected operation duration ${duration}ms to be within ${milliseconds}ms`,
      pass,
    };
  },
});

// Mock performance.now for consistent testing
const originalPerformanceNow = performance.now;
let mockTime = 0;

beforeEach(() => {
  mockTime = 0;
  performance.now = jest.fn(() => {
    mockTime += 1;
    return mockTime;
  });
});

afterEach(() => {
  performance.now = originalPerformanceNow;
  jest.clearAllMocks();
  jest.restoreAllMocks();
});