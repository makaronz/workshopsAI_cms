import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'jsdom',

    // Global setup
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/globalSetup.ts'],

    // Test file patterns
    include: [
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'tests/integration/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}'
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      'tests/e2e',
      'tests/performance',
      'tests/security'
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/vitest',
      include: [
        'src/**/*.{ts,tsx}',
        'frontend/src/**/*.{ts,tsx}'
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.stories.{ts,tsx}',
        'src/**/index.ts',
        'src/types/**/*',
        'src/config/**/*',
        'frontend/src/**/*.stories.{ts,tsx}',
        'frontend/src/vite-env.d.ts'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        // Critical security functions need 100% coverage
        './src/services/authService.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        './src/middleware/**/*': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    },

    // Test configuration
    testTimeout: 10000,
    hookTimeout: 10000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },

    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/results.html'
    },

    // Watch mode configuration
    watch: false,
    watchExclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-results/**'
    ],

    // Environment variables
    env: {
      NODE_ENV: 'test',
      VITE_TEST_MODE: 'true'
    },

    // Global variables
    globals: true,

    // Mock configuration
    clearMocks: true,
    restoreMocks: true,

    // Benchmarking
    benchmark: {
      include: ['**/*.{bench,benchmark}.{ts,tsx}'],
      exclude: ['node_modules', 'dist']
    },

    // Type checking
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json'
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@frontend': resolve(__dirname, './frontend/src'),
      '@tests': resolve(__dirname, './tests')
    }
  },

  // Define constants
  define: {
    __TEST__: true,
    __VERSION__: JSON.stringify(process.env.npm_package_version)
  }
});