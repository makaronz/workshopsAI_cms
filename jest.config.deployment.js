/**
 * Jest Configuration for Deployment Tests
 * Specialized configuration for PaaS platform deployment testing
 */

module.exports = {
  displayName: 'deployment',
  testMatch: [
    '<rootDir>/tests/deployment/**/*.test.ts',
    '<rootDir>/tests/deployment/**/*.test.js'
  ],
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '<rootDir>/tests/deployment/setup-deployment-tests.ts'
  ],
  testTimeout: 120000, // 2 minutes for deployment tests
  maxWorkers: 1, // Run deployment tests sequentially to avoid port conflicts
  verbose: true,

  // Coverage configuration for deployment tests
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/types/**',
  ],
  coverageDirectory: 'coverage/deployment',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/deployment/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/deployment/globalTeardown.ts',

  // Module configuration
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Test environment variables
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },

  // Configure test reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'deployment-test-results.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ]
  ],

  // Test retry configuration
  retryTimes: process.env.CI ? 2 : 1,

  // Error handling
  errorOnDeprecated: true,
  errorOnObsolete: true,

  // Bail on first failure in CI
  bail: process.env.CI ? 1 : 0,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output for debugging
  verbose: process.env.DEBUG ? true : false
};