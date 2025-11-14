/**
 * Enhanced Test Setup File
 * Global setup for all tests with comprehensive mocking and utilities
 */

import { config } from 'dotenv';
import { beforeAll, afterEach, afterAll, jest } from '@jest/globals';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'workshopsai_cms_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing-purposes-only';
process.env.TEST_MODE = 'true';

// Mock console methods to reduce noise in test output
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console methods for cleaner test output
  global.console = {
    ...originalConsole,
    log: jest.fn((...args) => originalConsole.log('[TEST LOG]', ...args)),
    debug: jest.fn((...args) => originalConsole.debug('[TEST DEBUG]', ...args)),
    info: jest.fn((...args) => originalConsole.info('[TEST INFO]', ...args)),
    warn: jest.fn((...args) => originalConsole.warn('[TEST WARN]', ...args)),
    error: jest.fn((...args) => originalConsole.error('[TEST ERROR]', ...args)),
  };
});

// Global test timeout
jest.setTimeout(30000);

// Setup and teardown hooks
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Reset modules to ensure clean state
  jest.resetModules();
});

afterEach(() => {
  // Clean up any test-specific state
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterAll(() => {
  // Restore original console
  global.console = originalConsole;
});

// Global test utilities
global.testUtils = {
  // Generate mock user data
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    ...overrides
  }),

  // Generate mock workshop data
  createMockWorkshop: (overrides = {}) => ({
    id: 'test-workshop-id',
    title: 'Test Workshop',
    description: 'A test workshop for testing purposes',
    slug: 'test-workshop',
    status: 'draft',
    maxParticipants: 20,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 3600000).toISOString(),
    ...overrides
  }),

  // Generate mock questionnaire data
  createMockQuestionnaire: (overrides = {}) => ({
    id: 'test-questionnaire-id',
    title: 'Test Questionnaire',
    description: 'A test questionnaire',
    questions: [
      {
        id: 'q1',
        type: 'text',
        title: 'Test Question',
        required: true
      }
    ],
    ...overrides
  }),

  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock JWT tokens
  generateMockJWT: (payload: any) => `mock.jwt.token.${btoa(JSON.stringify(payload))}`,

  // Create mock file
  createMockFile: (name: string, type: string, size: number = 1024) => {
    const buffer = Buffer.alloc(size, 'test');
    return new File([buffer], name, { type });
  }
};

// Mock external services
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3: jest.fn(() => ({
    putObject: jest.fn().mockResolvedValue({ ETag: 'test-etag' }),
    getObject: jest.fn().mockResolvedValue({ Body: Buffer.from('test') }),
    deleteObject: jest.fn().mockResolvedValue({})
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn()
}));

jest.mock('socket.io', () => ({
  Server: jest.fn(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock Redis
jest.mock('ioredis', () => ({
  default: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1)
  }))
}));

// Mock database connection
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue()
  }))
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
    getJob: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
    close: jest.fn().mockResolvedValue()
  })),
  Worker: jest.fn(() => ({
    close: jest.fn().mockResolvedValue()
  }))
}));

// Setup global fetch mock for API testing
global.fetch = jest.fn();

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
})) as any;

// Mock FileReader
global.FileReader = jest.fn(() => ({
  readAsDataURL: jest.fn(),
  readAsText: jest.fn(),
  addEventListener: jest.fn(),
  result: 'data:image/png;base64,test'
})) as any;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Export test utilities for use in test files
export { testUtils };