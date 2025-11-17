# Phase 2 Integration Testing Execution Guide

## Overview

This guide provides comprehensive instructions for executing Phase 2 integration tests to validate architectural consolidation changes in the WorkshopsAI CMS project.

## Prerequisites

### Environment Setup
1. **Node.js**: Version 18.0.0 or higher
2. **Database**: PostgreSQL running with test database configured
3. **Redis**: For session management and caching (if used)
4. **Browser Dependencies**: Playwright browsers installed

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps

# Setup test database
npm run db:setup:test
```

### Configuration
Ensure the following environment variables are set:

```bash
NODE_ENV=test
DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/workshopsai_cms_test
BASE_URL=http://localhost:3001
API_BASE_URL=http://localhost:3001/api
JWT_SECRET=test-secret-key
```

## Test Execution Commands

### Quick Start

```bash
# Run all Phase 2 integration tests
npm run test:phase2:integration

# Run specific test suites
npm run test:api-client-unification
npm run test:routing-consolidation
npm run test:questionnaire-unification
npm run test:dead-code-cleanup
npm run test:phase2-workflows
```

### Comprehensive Testing

```bash
# Full Phase 2 test suite
npm run test:phase2:complete

# Including performance tests
npm run test:phase2:with-performance

# Including cross-browser tests
npm run test:phase2:cross-browser
```

### Individual Test Categories

#### 1. Centralized API Client Tests
```bash
# Run API client unification tests
npx playwright test tests/integration/api-client-unification.test.ts

# Run with specific browser
npx playwright test tests/integration/api-client-unification.test.ts --project=chromium

# Run with debug mode
npx playwright test tests/integration/api-client-unification.test.ts --debug
```

#### 2. Routing Consolidation Tests
```bash
# Run routing tests
npx playwright test tests/integration/routing-consolidation.test.ts

# Test specific routing scenarios
npx playwright test tests/integration/routing-consolidation.test.ts --grep "Route Parameters"

# Test authentication routing
npx playwright test tests/integration/routing-consolidation.test.ts --grep "Route Guards"
```

#### 3. Questionnaire API Unification Tests
```bash
# Run questionnaire unification tests
npx playwright test tests/integration/questionnaire-api-unification.test.ts

# Test CRUD operations
npx playwright test tests/integration/questionnaire-api-unification.test.ts --grep "CRUD Operations"

# Test backward compatibility
npx playwright test tests/integration/questionnaire-api-unification.test.ts --grep "Backward Compatibility"
```

#### 4. Dead Code Cleanup Tests
```bash
# Run cleanup validation tests
npx playwright test tests/integration/dead-code-cleanup-validation.test.ts

# Test component removal
npx playwright test tests/integration/dead-code-cleanup-validation.test.ts --grep "Component Removal"

# Test performance impact
npx playwright test tests/integration/dead-code-cleanup-validation.test.ts --grep "Performance Impact"
```

#### 5. End-to-End Workflow Tests
```bash
# Run complete workflow tests
npx playwright test tests/e2e/phase2-consolidation-workflows.test.ts

# Test specific workflows
npx playwright test tests/e2e/phase2-consolidation-workflows.test.ts --grep "Workshop Creation"
npx playwright test tests/e2e/phase2-consolidation-workflows.test.ts --grep "Questionnaire Management"
```

#### 6. Performance Tests
```bash
# Run performance tests
npm run test:performance:phase2

# Run specific performance scenarios
npm run test:load:consolidation
npm run test:stress:api-client
npm run test:load:routing
```

## Test Execution Workflow

### Pre-Test Setup
1. **Start Services**:
   ```bash
   # Start backend server
   npm run dev

   # In separate terminal, start frontend (if separate)
   cd frontend && npm run dev
   ```

2. **Verify Services**:
   ```bash
   # Check API health
   curl http://localhost:3001/health

   # Check frontend
   curl http://localhost:3000
   ```

3. **Database Setup**:
   ```bash
   # Ensure test database is ready
   npm run db:migrate
   npm run db:seed:test
   ```

### Running Tests

#### Step 1: Smoke Tests
```bash
# Quick smoke test to verify basic functionality
npm run test:phase2:smoke

# This includes:
# - Basic authentication
# - Route accessibility
# - API endpoint availability
# - Component loading
```

#### Step 2: Core Integration Tests
```bash
# Run main integration test suites
npm run test:api-client-unification
npm run test:routing-consolidation
npm run test:questionnaire-unification
```

#### Step 3: Complete Workflow Tests
```bash
# Test end-to-end scenarios
npm run test:phase2-workflows
```

#### Step 4: Performance and Load Tests
```bash
# Run performance benchmarks
npm run test:performance:phase2
```

#### Step 5: Cross-Browser Tests
```bash
# Test across different browsers
npm run test:cross-browser:phase2
```

## Test Results Analysis

### Reading Test Reports

#### HTML Reports
```bash
# View detailed HTML report
npx playwright show-report

# View specific test report
npx playwright show-report playwright-report/phase2-integration
```

#### JSON Reports
```bash
# Export results to JSON
npx playwright test --reporter=json > test-results.json

# Analyze results programmatically
node scripts/analyze-test-results.js test-results.json
```

#### Coverage Reports
```bash
# Generate coverage report
npm run test:phase2:coverage

# View coverage in browser
npm run coverage:serve
```

### Key Metrics to Monitor

1. **Test Success Rate**: Target >95%
2. **API Response Times**: Target <200ms (95th percentile)
3. **Page Load Times**: Target <2 seconds
4. **Error Rates**: Target <5%
5. **Memory Usage**: Monitor for leaks
6. **Bundle Size**: Should be reduced after cleanup

### Common Issues and Solutions

#### Test Failures

**Authentication Issues**:
```bash
# Clear test data and reset
npm run db:reset:test
npm run test:clean
```

**API Endpoint Not Found**:
```bash
# Verify server is running
curl http://localhost:3001/api/health

# Check route configuration
npm run dev:debug
```

**Browser Issues**:
```bash
# Reinstall Playwright browsers
npx playwright install --force

# Clear browser cache
npx playwright test --headed
```

**Performance Test Failures**:
```bash
# Check system resources
npm run test:performance:baseline

# Reduce load test parameters
npm run test:performance:light
```

## Continuous Integration

### GitHub Actions Integration

The Phase 2 tests are automatically run in CI/CD:

```yaml
# .github/workflows/phase2-testing.yml
name: Phase 2 Integration Tests
on:
  push:
    branches: [plan1711-remediation]
  pull_request:
    branches: [plan1711-remediation]

jobs:
  phase2-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Setup test environment
        run: |
          docker-compose -f docker-compose.test.yml up -d
          npm run db:setup:test

      - name: Run Phase 2 tests
        run: |
          npm run test:phase2:smoke
          npm run test:phase2:integration
          npm run test:phase2:workflows
          npm run test:performance:phase2

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: phase2-test-results
          path: |
            playwright-report/
            test-results/
            coverage/
```

### Local Pre-Commit Checks

```bash
# Set up pre-commit hooks
npm run install:hooks

# Run pre-commit validation
npm run precommit:phase2
```

## Test Data Management

### Test Data Creation

```bash
# Generate test data
npm run test:data:generate

# Seed test database
npm run test:data:seed

# Clean test data
npm run test:data:clean
```

### Mock Data Management

```bash
# Update API mocks
npm run test:mocks:update

# Validate mock data consistency
npm run test:mocks:validate
```

## Troubleshooting Guide

### Environment Issues

**Port Conflicts**:
```bash
# Check what's running on ports
lsof -i :3001
lsof -i :3000

# Kill processes
kill -9 <PID>
```

**Database Connection Issues**:
```bash
# Check PostgreSQL status
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql

# Recreate test database
npm run db:recreate:test
```

### Test Execution Issues

**Timeout Issues**:
```bash
# Increase test timeout
npx playwright test --timeout=60000

# Run with debug mode
npx playwright test --debug
```

**Memory Issues**:
```bash
# Run with reduced concurrency
npx playwright test --workers=1

# Monitor memory usage
npm run test:memory:monitor
```

### Performance Test Issues

**Load Test Failures**:
```bash
# Run with smaller load
npm run test:load:light

# Check server resources
npm run performance:server:check
```

## Best Practices

### Test Development

1. **Use Descriptive Names**: Test names should clearly indicate what they're testing
2. **Independent Tests**: Each test should be self-contained and not depend on others
3. **Consistent Assertions**: Use consistent patterns for assertions
4. **Proper Cleanup**: Clean up test data after each test
5. **Mock External Dependencies**: Mock external services to ensure test reliability

### Test Execution

1. **Run Tests Frequently**: Run tests regularly during development
2. **Use Fixtures**: Reuse test fixtures to maintain consistency
3. **Monitor Performance**: Keep track of test execution times
4. **Review Results**: Analyze test results to identify patterns and issues
5. **Update Tests**: Keep tests updated with application changes

### CI/CD Integration

1. **Parallel Execution**: Run tests in parallel to reduce execution time
2. **Fail Fast**: Configure pipelines to fail fast on critical issues
3. **Artifact Retention**: Keep test artifacts for analysis
4. **Notification**: Set up notifications for test failures
5. **Trend Analysis**: Monitor test performance trends over time

## Conclusion

This execution guide provides a comprehensive approach to validating Phase 2 architectural consolidation. By following these procedures and best practices, you can ensure that the consolidation changes maintain system integrity while delivering the expected improvements in performance, maintainability, and user experience.

Remember to:
- Run tests regularly during development
- Monitor test performance and results
- Keep tests updated with application changes
- Use test results to drive improvement decisions
- Document any issues and resolutions for future reference