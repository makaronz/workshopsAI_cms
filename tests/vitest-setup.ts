/**
 * Vitest Setup File
 * Global setup for Vitest tests with comprehensive mocking and utilities
 */

import { beforeAll, afterEach, afterAll, vi, expect } from 'vitest'
import { config } from 'dotenv'

// Load test environment variables
config({ path: '.env.test' })

// Set test environment
process.env.NODE_ENV = 'test'
process.env.DB_NAME = 'workshopsai_cms_vitest_test'
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest-only'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-for-vitest-only'
process.env.TEST_MODE = 'true'

// Mock console methods for cleaner test output
const originalConsole = { ...console }

beforeAll(() => {
  // Enhanced console mocking with Vitest
  global.console = {
    ...originalConsole,
    log: vi.fn((...args) => originalConsole.log('[VITEST LOG]', ...args)),
    debug: vi.fn((...args) => originalConsole.debug('[VITEST DEBUG]', ...args)),
    info: vi.fn((...args) => originalConsole.info('[VITEST INFO]', ...args)),
    warn: vi.fn((...args) => originalConsole.warn('[VITEST WARN]', ...args)),
    error: vi.fn((...args) => originalConsole.error('[VITEST ERROR]', ...args)),
  }
})

// Global test utilities
global.testUtils = {
  // Generate mock user data
  createMockUser: (overrides = {}) => ({
    id: 'vitest-user-id',
    email: 'vitest@example.com',
    username: 'vitestuser',
    firstName: 'Vitest',
    lastName: 'User',
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),

  // Generate mock workshop data
  createMockWorkshop: (overrides = {}) => ({
    id: 'vitest-workshop-id',
    title: 'Vitest Test Workshop',
    description: 'A test workshop for Vitest testing',
    slug: 'vitest-test-workshop',
    status: 'draft',
    maxParticipants: 20,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 3600000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),

  // Generate mock questionnaire data
  createMockQuestionnaire: (overrides = {}) => ({
    id: 'vitest-questionnaire-id',
    title: 'Vitest Test Questionnaire',
    description: 'A test questionnaire for Vitest',
    questions: [
      {
        id: 'q1',
        type: 'text',
        title: 'Vitest Test Question',
        required: true,
        placeholder: 'Enter your answer'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),

  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock JWT tokens
  generateMockJWT: (payload: any) => `vitest.mock.jwt.${btoa(JSON.stringify(payload))}`,

  // Create mock file
  createMockFile: (name: string, type: string, size: number = 1024) => {
    const buffer = Buffer.alloc(size, 'vitest')
    return new File([buffer], name, { type })
  }
}

// Setup comprehensive mocks
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'vitest-message-id' }),
    verify: vi.fn().mockResolvedValue(true)
  }))
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3: vi.fn(() => ({
    putObject: vi.fn().mockResolvedValue({ ETag: 'vitest-etag' }),
    getObject: vi.fn().mockResolvedValue({ Body: Buffer.from('vitest') }),
    deleteObject: vi.fn().mockResolvedValue({})
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn()
}))

vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        save: vi.fn().mockResolvedValue(),
        delete: vi.fn().mockResolvedValue(),
        exists: vi.fn().mockResolvedValue([false]),
        createWriteStream: vi.fn().mockReturnValue({
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn()
        })
      }))
    }))
  }))
}))

vi.mock('socket.io', () => ({
  Server: vi.fn(() => ({
    emit: vi.fn(),
    on: vi.fn(),
    close: vi.fn(),
    to: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis()
  }))
}))

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    flushall: vi.fn().mockResolvedValue('OK')
  }))
}))

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'vitest-job-id' }),
    getJob: vi.fn().mockResolvedValue({ id: 'vitest-job-id' }),
    close: vi.fn().mockResolvedValue(),
    getRepeatableJobs: vi.fn().mockResolvedValue([]),
    removeRepeatableByKey: vi.fn().mockResolvedValue()
  })),
  Worker: vi.fn(() => ({
    close: vi.fn().mockResolvedValue(),
    run: vi.fn()
  })),
  Job: vi.fn()
}))

vi.mock('winston', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    log: vi.fn()
  })),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    errors: vi.fn(),
    json: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn()
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn()
  }
}))

// Mock PostgreSQL
vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn()
    }),
    end: vi.fn().mockResolvedValue(),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  }))
}))

// Mock Drizzle ORM
vi.mock('drizzle-orm', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
        offset: vi.fn().mockResolvedValue([])
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{}])
      })
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{}])
        })
      })
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(1)
    }),
    query: vi.fn().mockResolvedValue([])
  })),
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  inArray: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  sql: vi.fn(),
  count: vi.fn()
}))

// Mock fetch
global.fetch = vi.fn()

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
})) as any

// Mock FileReader
global.FileReader = vi.fn(() => ({
  readAsDataURL: vi.fn(),
  readAsText: vi.fn(),
  addEventListener: vi.fn(),
  result: 'data:image/png;base64,vitest'
})) as any

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Custom matchers for better test assertions
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },

  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const pass = uuidRegex.test(received)
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
      pass,
    }
  }
})

// Cleanup utilities
afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks()
  vi.clearAllTimers()
  vi.useRealTimers()
})

afterAll(() => {
  // Restore original console
  global.console = originalConsole
})

// Export test utilities for use in test files
export { testUtils }