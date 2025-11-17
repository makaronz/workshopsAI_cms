#!/usr/bin/env node

/**
 * Initialization Validation Runner
 *
 * This script runs comprehensive initialization validation tests
 * and generates a detailed report of the development environment status.
 */

const { InitializationValidator } = require('../tests/validation/initialization-validator.test.ts');

async function main() {
  console.log('🔍 workshopsAI CMS - Initialization Validation');
  console.log('===============================================\n');

  const validator = new InitializationValidator();

  try {
    const results = await validator.runAllTests();
    validator.generateReport();

    // Exit with appropriate code
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Validation failed with critical error:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main();