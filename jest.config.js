import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest/utils';
import { compilerOptions } from './tsconfig.json';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/index-secure.ts',
    '!src/index-optimized.ts',
    '!src/types/*.ts',
    '!src/**/index.ts',
    '!src/**/*.stories.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!**/node_modules/**',
    '!dist/**',
    '!coverage/**'
  ],
  coverageDirectory: 'coverage/jest',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'clover'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/middleware/**/*': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/**/*': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  maxWorkers: '50%',
  cacheDirectory: '<rootDir>/.jest-cache',
  // Environment variables for tests
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  // Module name mapping using tsconfig paths
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/src/' }),
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  // Global test setup
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  // Test file exclusions
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/test-results/',
    '/e2e/'
  ],
  // Performance optimizations
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Error handling
  errorOnDeprecated: true,
  failOnConsole: false,
  // Reporting
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'jest-results.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};

export default config;