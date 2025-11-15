import 'jest-extended';

// Performance testing setup
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn, // Keep warnings for performance issues
  error: console.error, // Keep errors for debugging
};

// Extended timeout for performance tests
jest.setTimeout(120000);

// Performance measurement utilities
global.PerformanceUtils = {
  measureExecutionTime: async <T>(
    fn: () => Promise<T> | T,
    iterations = 1
  ): Promise<{ result: T; duration: number; averageDuration: number }> => {
    const results: T[] = [];
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      const result = await fn();
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      results.push(result);
      durations.push(duration);
    }

    return {
      result: results[0],
      duration: durations[0],
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    };
  },

  measureMemoryUsage: (): NodeJS.MemoryUsage => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0,
    };
  },

  simulateLoad: async (concurrency: number, fn: () => Promise<any>): Promise<void> => {
    const promises = Array.from({ length: concurrency }, () => fn());
    await Promise.all(promises);
  },
};

// Performance thresholds for tests
global.PerformanceThresholds = {
  API_RESPONSE_TIME: 5000, // 5 seconds
  LLM_ANALYSIS_TIME: 30000, // 30 seconds
  CACHE_ACCESS_TIME: 100, // 100ms
  DATABASE_QUERY_TIME: 1000, // 1 second
  MEMORY_USAGE_MB: 512, // 512MB
  CONCURRENT_REQUESTS: 100,
};

// Performance test hooks
beforeAll(async () => {
  // Warm up JIT compiler
  for (let i = 0; i < 100; i++) {
    await new Promise(resolve => setImmediate(resolve));
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

beforeEach(() => {
  // Reset performance counters
  if (global.gc) {
    global.gc();
  }
});

afterEach(() => {
  // Clean up resources
  jest.clearAllMocks();
});

// Performance-specific custom matchers
expect.extend({
  toMeetPerformanceThreshold(received: number, threshold: keyof typeof global.PerformanceThresholds) {
    const limit = global.PerformanceThresholds[threshold];
    const pass = received <= limit;
    return {
      message: () =>
        pass
          ? `expected ${received}ms not to be within threshold ${limit}ms for ${threshold}`
          : `expected ${received}ms to be within threshold ${limit}ms for ${threshold}`,
      pass,
    };
  },

  toHaveAcceptableMemoryUsage(received: NodeJS.MemoryUsage, threshold: number = global.PerformanceThresholds.MEMORY_USAGE_MB) {
    const heapUsedMB = received.heapUsed / 1024 / 1024;
    const pass = heapUsedMB <= threshold;
    return {
      message: () =>
        pass
          ? `expected memory usage ${heapUsedMB.toFixed(2)}MB not to be within threshold ${threshold}MB`
          : `expected memory usage ${heapUsedMB.toFixed(2)}MB to be within threshold ${threshold}MB`,
      pass,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toMeetPerformanceThreshold(threshold: keyof typeof global.PerformanceThresholds): R;
      toHaveAcceptableMemoryUsage(threshold?: number): R;
    }
  }

  var PerformanceUtils: {
    measureExecutionTime: <T>(
      fn: () => Promise<T> | T,
      iterations?: number
    ) => Promise<{ result: T; duration: number; averageDuration: number }>;
    measureMemoryUsage: () => NodeJS.MemoryUsage;
    simulateLoad: (concurrency: number, fn: () => Promise<any>) => Promise<void>;
  };

  var PerformanceThresholds: {
    API_RESPONSE_TIME: number;
    LLM_ANALYSIS_TIME: number;
    CACHE_ACCESS_TIME: number;
    DATABASE_QUERY_TIME: number;
    MEMORY_USAGE_MB: number;
    CONCURRENT_REQUESTS: number;
  };
}