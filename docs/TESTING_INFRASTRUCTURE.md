# Testing Infrastructure Documentation

## Overview

This document provides comprehensive information about the testing infrastructure implemented for the WorkshopsAI CMS system. The testing suite ensures production readiness through comprehensive E2E, integration, security, accessibility, and performance testing.

## Table of Contents

1. [Testing Architecture](#testing-architecture)
2. [Test Categories](#test-categories)
3. [Setup and Configuration](#setup-and-configuration)
4. [Running Tests](#running-tests)
5. [Test Data Management](#test-data-management)
6. [CI/CD Integration](#cicd-integration)
7. [Security Testing](#security-testing)
8. [Accessibility Testing](#accessibility-testing)
9. [Performance Testing](#performance-testing)
10. [Test Reports](#test-reports)

## Testing Architecture

### Test Pyramid

```
        /\
       /E2E\      <- 10-15% (User journeys, critical paths)
      /------\
     /Integr. \    <- 20-25% (API testing, database)
    /----------\
   /   Unit     \   <- 60-70% (Fast, isolated tests)
  /--------------\
```

### Technology Stack

- **E2E Testing**: Playwright with cross-browser support
- **Integration Testing**: Jest + Supertest for API testing
- **Unit Testing**: Jest for individual component testing
- **Security Testing**: OWASP ZAP integration + custom security tests
- **Accessibility Testing**: Axe-core + Playwright accessibility
- **Performance Testing**: K6 for load/stress testing
- **Database**: PostgreSQL test instances with proper isolation

## Test Categories

### 1. Unit Tests (`tests/unit/`)

Fast, isolated tests for individual functions and components.

**Example:**
```typescript
describe('WorkshopService', () => {
  test('should create workshop with valid data', async () => {
    const workshopData = generateTestData('workshop');
    const result = await workshopService.create(workshopData);
    expect(result).toHaveProperty('id');
  });
});
```

### 2. Integration Tests (`tests/integration/`)

Tests API endpoints, database operations, and service interactions.

**Structure:**
- API endpoint testing (`api/`)
- Database integration (`db/`)
- Service integration (`services/`)

### 3. E2E Tests (`tests/e2e/`)

End-to-end user scenarios across the entire application.

**Key Areas:**
- Workshop management workflows
- Questionnaire creation and response
- User authentication flows
- Data visualization and analytics

### 4. Security Tests (`tests/security/`)

Comprehensive security validation including OWASP Top 10 compliance.

**Coverage:**
- SQL injection prevention
- XSS protection
- Authentication and authorization
- CSRF protection
- Input validation
- Rate limiting

### 5. Accessibility Tests (`tests/accessibility/`)

WCAG 2.2 AA compliance testing.

**Key Features:**
- Screen reader compatibility
- Keyboard navigation
- Color contrast validation
- Focus management
- Semantic markup

### 6. Performance Tests (`tests/performance/`)

Load testing and performance validation.

**Metrics:**
- Response times
- Throughput
- Resource usage
- Memory management
- Database performance

## Setup and Configuration

### Prerequisites

1. **Node.js** (v18 or later)
2. **PostgreSQL** (v15 or later)
3. **Redis** (v7 or later)
4. **Playwright Browsers** (auto-installed)

### Environment Variables

```bash
# Database Configuration
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=workshopsai_cms_test
TEST_DB_USER=testuser
TEST_DB_PASSWORD=testpassword

# Testing Configuration
NODE_ENV=test
BASE_URL=http://localhost:3000
JWT_SECRET=test-jwt-secret

# Security Testing
ZAP_API_KEY=your-zap-api-key
```

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run playwright:install

# Install Playwright system dependencies
npm run playwright:install-deps
```

## Running Tests

### Individual Test Suites

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Accessibility tests
npm run test:accessibility

# Security tests
npm run test:security

# Performance tests
npm run test:performance
```

### Comprehensive Testing

```bash
# Run all tests
npm run test:all

# CI pipeline tests
npm run ci:test

# Generate coverage reports
npm run test:coverage
```

### Browser-Specific E2E Tests

```bash
# Run tests in headed mode
npm run test:e2e:headed

# Run specific browser tests
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Data Management

### Test Data Factory

The `TestDataFactory` class provides realistic test data generation:

```typescript
import { generateTestData, generateBulkTestData } from '../helpers/test-data-factory';

// Generate single test entity
const workshop = generateTestData('workshop', {
  title: 'Custom Workshop',
  capacity: 25
});

// Generate bulk data for performance testing
const users = generateBulkTestData('user', 100);
```

### Database Setup

Test databases are isolated and cleaned between test runs:

```typescript
import { getTestDbConnection, cleanupTestData } from '../helpers/test-db-helpers';

const db = await getTestDbConnection();
await cleanupTestData(db);
```

### Data Relationships

Helper functions create related test data with proper relationships:

```typescript
const { user, workshop, questionnaire, enrollments } = await createRelatedTestData(db);
```

## CI/CD Integration

### GitHub Actions Pipeline

The testing pipeline runs on:
- Push to `main`/`develop` branches
- Pull requests
- Daily scheduled runs

**Pipeline Stages:**
1. Lint and type checking
2. Unit tests with coverage
3. Integration tests
4. E2E tests
5. Accessibility tests
6. Security scans
7. Performance tests

### Quality Gates

- **Unit Tests**: Must pass
- **Integration Tests**: Must pass
- **E2E Tests**: Must pass on critical paths
- **Accessibility**: Zero WCAG 2.2 AA critical violations
- **Security**: Zero high/critical vulnerabilities
- **Performance**: Response times under defined thresholds

### Coverage Requirements

- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >80%
- **Lines**: >80%

## Security Testing

### OWASP ZAP Integration

```bash
# Run full security scan
npm run security:zap

# Run spider scan
npm run security:zap-spider

# Run active scan
npm run security:zap-active
```

### Security Test Categories

1. **Injection Flaws**: SQL injection, XSS, command injection
2. **Authentication**: Session management, token validation
3. **Authorization**: Role-based access control
4. **Data Validation**: Input sanitization, output encoding
5. **Rate Limiting**: DoS protection, brute force prevention

### Custom Security Tests

```typescript
test('should protect against SQL injection', async ({ page }) => {
  const payloads = ["'; DROP TABLE users; --", "' OR '1'='1"];

  for (const payload of payloads) {
    await page.fill('[data-testid="search-input"]', payload);
    await page.press('Enter');

    // Verify no database errors
    await expect(page.locator('[data-testid="database-error"]')).not.toBeVisible();
  }
});
```

## Accessibility Testing

### WCAG 2.2 AA Compliance

All accessibility tests verify compliance with WCAG 2.2 AA guidelines:

- **Perceivable**: Information must be presentable in ways users can perceive
- **Operable**: Interface components must be operable
- **Understandable**: Information and UI operation must be understandable
- **Robust**: Content must be robust enough for assistive technologies

### Test Categories

1. **Keyboard Navigation**: All functionality accessible via keyboard
2. **Screen Reader**: Semantic markup and ARIA labels
3. **Color Contrast**: 4.5:1 ratio for normal text, 3:1 for large text
4. **Focus Management**: Visible focus indicators and logical tab order
5. **Error Handling**: Clear error messages and recovery options

### Accessibility Test Examples

```typescript
test('should have accessible navigation', async ({ page }) => {
  await injectAxe(page);

  // Check for proper ARIA labels
  await expect(page.locator('nav')).toHaveAttribute('aria-label');

  // Test keyboard navigation
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();

  // Run accessibility audit
  await checkA11y(page);
});
```

## Performance Testing

### Load Testing with K6

```bash
# Basic load test
npm run test:load

# Stress test
npm run test:stress
```

### Performance Metrics

- **Response Time**: 95th percentile < 2s
- **Throughput**: Minimum 100 requests/second
- **Error Rate**: <5% under normal load
- **Memory Usage**: No memory leaks during extended testing

### Performance Test Scenarios

1. **Homepage Loading**: Initial page load performance
2. **API Response Times**: Backend performance under load
3. **Database Queries**: Query optimization and index effectiveness
4. **Resource Loading**: Images, scripts, and CSS optimization
5. **Concurrent Users**: System behavior under simultaneous usage

## Test Reports

### Coverage Reports

Coverage reports are generated automatically and uploaded to Codecov:

```bash
# View coverage report
open coverage/lcov-report/index.html
```

### Playwright Reports

E2E test reports include:
- Screenshots on failure
- Video recordings
- Network activity logs
- Trace files for debugging

### Accessibility Reports

Detailed accessibility reports include:
- Violation summaries
- Impact levels
- Remediation recommendations
- Compliance scores

### Security Reports

Security test reports include:
- Vulnerability assessments
- Risk ratings
- Remediation priorities
- Compliance checks

## Best Practices

### Test Writing

1. **Arrange-Act-Assert Pattern**: Clear test structure
2. **Descriptive Names**: Test names explain what and why
3. **Isolation**: Tests should not depend on each other
4. **Deterministic**: Consistent results across runs
5. **Maintainable**: Easy to understand and modify

### Data Management

1. **Factory Pattern**: Use test data factories for consistent data
2. **Cleanup**: Clean up test data after each test
3. **Isolation**: Test databases should be isolated
4. **Realistic**: Test data should resemble production data

### Performance Considerations

1. **Monitoring**: Track performance metrics during tests
2. **Thresholds**: Define and enforce performance thresholds
3. **Profiling**: Regular performance profiling and optimization
4. **Scalability**: Test for expected user loads and beyond

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify test database is running
   - Check connection string
   - Ensure proper permissions

2. **Browser Setup Issues**:
   - Run `npm run playwright:install`
   - Install system dependencies with `npm run playwright:install-deps`

3. **Test Flakiness**:
   - Add proper waits and retries
   - Use page.waitForLoadState()
   - Implement proper test isolation

4. **Performance Test Failures**:
   - Check system resources
   - Verify test environment setup
   - Review load generator configuration

### Debug Mode

Run tests in debug mode for troubleshooting:

```bash
# Debug E2E tests
npm run test:e2e --debug

# Debug with Playwright Inspector
npx playwright test --debug
```

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**: Automated visual comparison testing
2. **Cross-Browser Testing**: Expanded browser support
3. **Mobile Testing**: Dedicated mobile device testing
4. **API Contract Testing: Consumer-driven contract testing
5. **Chaos Engineering**: Fault injection and resilience testing

### Continuous Improvement

1. **Test Metrics**: Track test execution metrics and trends
2. **Flakiness Reduction**: Identify and fix flaky tests
3. **Coverage Optimization**: Improve test coverage for critical paths
4. **Performance Optimization**: Continuous performance monitoring and improvement

## Contributing to Tests

When adding new tests:

1. **Follow Patterns**: Use existing test patterns and conventions
2. **Update Documentation**: Keep documentation current with changes
3. **Test Review**: Ensure peer review for new test additions
4. **Integration**: Verify tests integrate properly with CI/CD pipeline

## Conclusion

This comprehensive testing infrastructure ensures the WorkshopsAI CMS system meets production quality standards through systematic validation of functionality, security, accessibility, and performance. Regular execution of these tests provides confidence in system reliability and user experience quality.