import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest/utils';
import { compilerOptions } from '../../tsconfig.json';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/performance'],
  testMatch: [
    '**/?(*.)+(perf|performance|benchmark|load|stress).ts'
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
    'src/routes/api/**/*.ts'
  ],
  coverageDirectory: 'coverage/performance',
  coverageReporters: ['text', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/config/jest.performance.setup.ts'],
  testTimeout: 120000, // 2 minutes for performance tests
  verbose: true,
  maxWorkers: 1, // Single worker for accurate performance measurements
  cacheDirectory: '<rootDir>/.jest-performance-cache',
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/src/' }),
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/test-results/',
    '/e2e/',
    '/unit/',
    '/integration/'
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  errorOnDeprecated: true,
  failOnConsole: false,
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results/performance',
      outputName: 'performance-test-results.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};

export default config;