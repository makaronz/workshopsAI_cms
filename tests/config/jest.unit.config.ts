import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest/utils';
import { compilerOptions } from '../../tsconfig.json';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/integration'],
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
    'src/services/**/*.ts',
    'src/middleware/**/*.ts',
    'src/routes/api/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.stories.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!**/node_modules/**',
    '!dist/**',
    '!coverage/**'
  ],
  coverageDirectory: 'coverage/unit',
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
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/services/**/*': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/middleware/**/*': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/config/jest.setup.ts'],
  testTimeout: 30000,
  verbose: true,
  maxWorkers: '50%',
  cacheDirectory: '<rootDir>/.jest-unit-cache',
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/src/' }),
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  globalSetup: '<rootDir>/tests/config/jest.global-setup.ts',
  globalTeardown: '<rootDir>/tests/config/jest.global-teardown.ts',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/test-results/',
    '/e2e/',
    '/performance/'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  errorOnDeprecated: true,
  failOnConsole: false,
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results/unit',
      outputName: 'unit-test-results.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};

export default config;