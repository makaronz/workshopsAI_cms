# Testing Strategy & Procedures for WorkshopsAI CMS

## Overview

This document outlines the comprehensive testing strategy for the WorkshopsAI CMS project, covering all aspects of quality assurance from unit testing to cross-browser compatibility testing.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Infrastructure](#test-infrastructure)
3. [Test Types & Coverage](#test-types--coverage)
4. [Test Execution Procedures](#test-execution-procedures)
5. [CI/CD Integration](#cicd-integration)
6. [Test Data Management](#test-data-management)
7. [Performance & Security Testing](#performance--security-testing)
8. [Accessibility Testing](#accessibility-testing)
9. [Regression Testing](#regression-testing)
10. [Reporting & Metrics](#reporting--metrics)

## Testing Philosophy

### Principles

1. **Test-First Development**: Write tests before implementing features (TDD)
2. **Comprehensive Coverage**: Target 80% unit test coverage, 70% E2E coverage
3. **Shift Left Testing**: Catch issues early in the development cycle
4. **Automation First**: Manual testing only for exploratory scenarios
5. **Cross-Platform Compatibility**: Ensure consistent behavior across browsers and devices
6. **Accessibility by Design**: Integrate WCAG 2.2 AA compliance from the start
7. **Security-First Testing**: Proactive vulnerability detection and prevention

### Quality Gates

- **Code Coverage**: Minimum 80% for unit tests, 70% for integration tests
- **Performance**: All API responses under 200ms, page loads under 2 seconds
- **Accessibility**: 95+ WCAG compliance score
- **Security**: Zero critical vulnerabilities, all OWASP Top 10 checks passing
- **Browser Compatibility**: Tests passing on Chrome, Firefox, Safari, Edge (latest 2 versions)

## Test Infrastructure

### Testing Stack

**Frontend Testing:**
- **Unit Tests**: Vitest with jsdom
- **Component Tests**: Vitest + Web Component Testing Library
- **E2E Tests**: Playwright
- **Visual Regression**: Playwright Screenshots
- **Performance**: Lighthouse CI
- **Accessibility**: axe-core integration

**Backend Testing:**
- **Unit Tests**: Jest with TypeScript
- **Integration Tests**: Supertest for API testing
- **Database Tests**: PostgreSQL test database with test transactions
- **Security Tests**: OWASP ZAP, Snyk
- **Load Testing**: k6

**Cross-Browser Testing:**
- **Browser Stack**: Playwright with multiple browser configurations
- **Mobile Testing**: Real device emulation
- **Progressive Enhancement**: Feature detection and graceful degradation tests

### Environment Configuration

```bash
# Test environment variables
NODE_ENV=test
DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/workshopsai_cms_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-key
API_BASE_URL=http://localhost:3001/api
```

### Database Setup

```sql
-- Create test database
CREATE DATABASE workshopsai_cms_test;

-- Run migrations
npm run db:generate
npm run db:migrate

-- Seed test data
npm run db:seed:test
```

## Test Types & Coverage

### 1. Unit Tests

**Location**: `tests/unit/`

**Coverage**: 80% target

**Purpose**: Test individual functions, classes, and components in isolation

**Example Structure**:
```
tests/unit/
├── services/
│   ├── authService.test.ts
│   ├── workshopService.test.ts
│   └── questionnaireService.test.ts
├── components/
│   ├── login-form.test.ts
│   ├── dashboard.test.ts
│   └── workshop-editor.test.ts
├── utils/
│   ├── validation.test.ts
│   ├── formatting.test.ts
│   └── storage.test.ts
└── middleware/
    ├── auth.test.ts
    └── validation.test.ts
```

**Example Test**:
```typescript
describe('AuthService', () => {
  let authService: AuthService;
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    authService = new AuthService(mockStorage);
  });

  describe('login', () => {
    it('should store access token with correct key', async () => {
      const credentials = { email: 'test@example.com', password: 'password' };
      const expectedToken = 'jwt-token-123';

      // Mock API response
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: { token: expectedToken }
      }));

      await authService.login(credentials);

      expect(mockStorage.getItem('workshopsai-access-token')).toBe(expectedToken);
    });
  });
});
```

### 2. Integration Tests

**Location**: `tests/integration/`

**Coverage**: 70% target

**Purpose**: Test interaction between components, API endpoints, and database operations

**Example Structure**:
```
tests/integration/
├── api/
│   ├── auth.test.ts
│   ├── workshops.test.ts
│   └── questionnaires.test.ts
├── database/
│   ├── user-management.test.ts
│   └── workshop-operations.test.ts
└── workflows/
    ├── user-registration.test.ts
    └── workshop-creation.test.ts
```

### 3. End-to-End (E2E) Tests

**Location**: `tests/e2e/`

**Coverage**: Critical user journeys (100% for core workflows)

**Purpose**: Test complete user workflows across the application

**Test Categories**:
- **Authentication Flows**: Login, logout, token refresh, session management
- **Dashboard Functionality**: Live data loading, metrics display, navigation
- **Workshop Management**: Creation, editing, deletion, filtering
- **Questionnaire Management**: Creation, responses, analysis
- **User Management**: Registration, profile updates, permissions
- **Accessibility**: Keyboard navigation, screen reader support, ARIA compliance
- **Performance**: Load times, memory usage, network optimization
- **Security**: XSS prevention, CSRF protection, input validation

### 4. Regression Tests

**Location**: `tests/integration/regression-suite.test.ts`

**Purpose**: Prevent breaking changes to existing functionality

**Scope**:
- Authentication token consistency
- Dashboard data integration
- Routing functionality
- Cross-browser compatibility
- Performance standards
- Security measures

### 5. Cross-Browser Tests

**Location**: `tests/e2e/cross-browser-lit-element.test.ts`

**Browsers Tested**:
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile Chrome (Android)
- Mobile Safari (iOS)

## Test Execution Procedures

### Local Development

```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run accessibility tests
npm run test:accessibility

# Run performance tests
npm run test:performance

# Run security tests
npm run test:security
```

### Before Commit

```bash
# Run pre-commit checks
npm run precommit

# Equivalent to:
npm run lint
npm run typecheck
npm run test:unit
```

### CI/CD Pipeline

```bash
# Full CI test suite
npm run ci:test

# Build with validation
npm run ci:build
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test and Build
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          docker-compose -f docker-compose.test.yml up -d postgres redis
          npm run db:setup:test

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run typecheck

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Run accessibility tests
        run: npm run test:accessibility

      - name: Run security tests
        run: npm run security:vulnerability-scan

  cross-browser:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run cross-browser tests
        run: npm run test:cross-browser

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: cross-browser-results
          path: playwright-report/
```

### Quality Gates in Pipeline

1. **Lint Pass**: All ESLint rules must pass
2. **Type Check**: TypeScript compilation must succeed
3. **Unit Test Coverage**: Minimum 80% coverage required
4. **Integration Tests**: All must pass
5. **E2E Tests**: Core workflows must pass
6. **Accessibility**: Minimum 95% WCAG compliance
7. **Security**: No critical vulnerabilities
8. **Performance**: All benchmarks met

## Test Data Management

### Mock Data Strategy

**Location**: `tests/mocks/`, `tests/factories/`

**Factories**:
```typescript
// tests/factories/userFactory.ts
export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    return {
      id: faker.datatype.uuid(),
      email: faker.internet.email(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      role: 'participant',
      createdAt: new Date(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}
```

### Database Transactions

All database tests use transactions to ensure test isolation:

```typescript
beforeEach(async () => {
  await database.transaction(async (trx) => {
    // Setup test data
    await setupTestData(trx);
  });
});

afterEach(async () => {
  await database.rollback();
});
```

### API Mocking

Consistent API mocking strategy across tests:

```typescript
// tests/mocks/apiHandlers.ts
export const createMockApiHandler = (endpoint: string, response: any, status = 200) => {
  return page.route(`**/api${endpoint}`, async route => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response)
    });
  });
};
```

## Performance & Security Testing

### Performance Testing

**Load Testing**: `tests/load/`
```javascript
// tests/load/basic-load-test.js
import http from 'k6/http';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<150'], // 99% of requests under 150ms
  },
};

export default function () {
  let response = http.get('http://localhost:3001/api/dashboard/overview');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

**Performance Budgets**:
- API Response Time: <200ms (95th percentile)
- Page Load Time: <2 seconds (LCP)
- Bundle Size: <300KB gzipped
- Memory Usage: <50MB increase per session

### Security Testing

**OWASP Top 10 Coverage**:
```bash
# Automated security scanning
npm run security:audit          # npm audit
npm run security:scan           # semgrep
npm run security:zap            # OWASP ZAP
npm run security:penetration-test # Combined security tests
```

**Security Test Cases**:
- XSS Prevention
- CSRF Protection
- SQL Injection Prevention
- Authentication Bypass
- Authorization Bypass
- Data Exposure
- Rate Limiting
- Input Validation

## Accessibility Testing

### Automated Testing

```typescript
// tests/accessibility/dashboard-accessibility.test.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test('dashboard accessibility compliance', async ({ page }) => {
  await page.goto('/dashboard');
  await injectAxe(page);

  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true },
    rules: {
      // Configure specific rules
    }
  });
});
```

### Manual Testing Checklist

**Keyboard Navigation**:
- [ ] All interactive elements reachable via Tab
- [ ] Visible focus indicators
- [ ] Logical tab order
- [ ] Skip links available

**Screen Reader Support**:
- [ ] Proper heading structure
- [ ] ARIA labels and descriptions
- [ ] Landmark elements
- [ ] Form labels and descriptions

**Visual Accessibility**:
- [ ] Color contrast (4.5:1 minimum)
- [ ] Text resizing (200% zoom)
- [ ] High contrast mode
- [ ] Responsive design

## Regression Testing

### Automated Regression Suite

**Execution**: Every pull request and nightly builds

**Scope**:
1. **Authentication**: Token standardization, session management
2. **Dashboard**: Live data integration, metrics display
3. **Routing**: Workshop creation, navigation
4. **Cross-Browser**: LitElement compatibility
5. **Performance**: Load times, memory usage
6. **Security**: Vulnerability prevention
7. **Accessibility**: WCAG compliance

### Regression Test Categories

1. **Critical**: Must pass for release
2. **High**: Should pass, exceptions documented
3. **Medium**: Monitor for trends
4. **Low**: Track for future improvements

## Reporting & Metrics

### Test Reports

**Coverage Reports**:
- Generated with `npm run test:coverage`
- Stored in `coverage/` directory
- Uploaded to Codecov for CI

**E2E Reports**:
- Playwright HTML reports: `npm run test:report`
- Screenshots on failure
- Video recordings for debugging

**Accessibility Reports**:
- axe-core detailed reports
- WCAG compliance scores
- Issue tracking and remediation

### Quality Metrics

**Dashboard Metrics**:
- Test Coverage: Unit 80%, Integration 70%, E2E Critical 100%
- Pass Rate: Target 98%+ across all test suites
- Flaky Test Rate: <2%
- Test Execution Time: <5 minutes for unit, <15 minutes for E2E

**Performance Metrics**:
- API Response Time: <200ms (95th percentile)
- Page Load Time: <2 seconds (LCP)
- Bundle Size: <300KB gzipped
- Memory Usage: <50MB per session

**Security Metrics**:
- Critical Vulnerabilities: 0
- High Vulnerabilities: 0
- Medium Vulnerabilities: <5
- Security Test Pass Rate: 100%

**Accessibility Metrics**:
- WCAG 2.2 AA Compliance: 95%+
- Automated Tests Pass Rate: 100%
- Manual Audit Score: 95%+

### Alerting

**Critical Failures**:
- Immediate team notification
- Block deployment
- Root cause analysis required

**High Priority Issues**:
- Team notification
- Document workaround
- Schedule fix within sprint

**Medium Priority Issues**:
- Track in backlog
- Monitor for trends
- Address in next release cycle

## Best Practices

### Test Writing

1. **AAA Pattern**: Arrange, Act, Assert structure
2. **Descriptive Names**: Test names should explain what and why
3. **Single Responsibility**: Each test verifies one behavior
4. **Isolation**: Tests should not depend on each other
5. **Deterministic**: Same result every time
6. **Fast**: Unit tests should run in <100ms

### Test Data

1. **Factory Pattern**: Use factories for test data generation
2. **Minimal Data**: Only create data needed for the test
3. **Cleanup**: Always clean up test data
4. **Consistency**: Use consistent naming conventions
5. **Realistic**: Test data should reflect production scenarios

### CI/CD Integration

1. **Fast Feedback**: Quick tests first, slower tests later
2. **Parallel Execution**: Run tests in parallel where possible
3. **Fail Fast**: Stop pipeline on critical failures
4. **Artifacts**: Save test results and reports
5. **Retry Logic**: Handle flaky tests appropriately

## Conclusion

This comprehensive testing strategy ensures the WorkshopsAI CMS maintains high quality standards across all aspects of the application. By following these procedures and utilizing the outlined infrastructure, we can:

1. **Prevent Bugs**: Catch issues early in development
2. **Ensure Quality**: Maintain high standards for user experience
3. **Support Accessibility**: Provide inclusive experience for all users
4. **Protect Security**: Proactively identify and fix vulnerabilities
5. **Maintain Performance**: Ensure fast, responsive user experience
6. **Enable Cross-Platform Compatibility**: Work consistently across browsers and devices

Regular review and updates to this strategy will ensure it remains effective as the application evolves and new testing challenges emerge.