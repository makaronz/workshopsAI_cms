# Test Execution Guide for WorkshopsAI CMS

## Quick Start

### Running All Tests Locally

```bash
# Complete test suite
npm run test:all

# Individual test types
npm run test:unit              # Unit tests only
npm run test:integration        # Integration tests only
npm run test:e2e              # End-to-end tests only
npm run test:accessibility     # Accessibility tests only
npm run test:security         # Security tests only
npm run test:performance       # Performance tests only
npm run test:cross-browser     # Cross-browser tests only
```

### Running Specific Test Files

```bash
# Run specific E2E test file
npx playwright test tests/e2e/authentication-token-standardization.test.ts

# Run specific unit test file
npx vitest run tests/unit/services/authService.test.ts

# Run tests matching a pattern
npx playwright test --grep="authentication"
npx vitest run --grep="AuthService"
```

### Development Workflow

1. **Before Making Changes**:
   ```bash
   npm run precommit  # Runs lint, typecheck, unit tests
   ```

2. **During Development**:
   ```bash
   npm run test:watch    # Watch mode for unit tests
   npm run test:ui       # Interactive test UI
   ```

3. **Before Committing**:
   ```bash
   npm run validate     # Full validation including build
   ```

## Detailed Test Categories

### 1. Authentication & Token Standardization Tests

**Location**: `tests/e2e/authentication-token-standardization.test.ts`

**Purpose**: Validate authentication flow and token consistency across all services

**Key Test Scenarios**:
- Token storage with correct key (`workshopsai-access-token`)
- Cross-service token consistency
- Token refresh mechanisms
- Session timeout handling
- Logout functionality

**Execution**:
```bash
# Run authentication tests
npx playwright test tests/e2e/authentication-token-standardization.test.ts

# Run with specific browser
npx playwright test tests/e2e/authentication-token-standardization.test.ts --project=chromium
```

### 2. Dashboard Live Data Integration Tests

**Location**: `tests/e2e/dashboard-live-data-integration.test.ts`

**Purpose**: Verify dashboard connects to live API and displays real metrics

**Key Test Scenarios**:
- Live data loading from `/api/dashboard/overview`
- Loading states and error handling
- Data refresh functionality
- Performance metrics display
- Recent activity feed

**Execution**:
```bash
# Run dashboard integration tests
npx playwright test tests/e2e/dashboard-live-data-integration.test.ts
```

### 3. Workshop Routing Tests

**Location**: `tests/e2e/workshop-routing.test.ts`

**Purpose**: Test new workshop creation route and editor integration

**Key Test Scenarios**:
- `/dashboard/workshops/new` route handling
- Workshop editor component loading
- Route protection and permissions
- Breadcrumb navigation
- Form submission workflow

**Execution**:
```bash
# Run workshop routing tests
npx playwright test tests/e2e/workshop-routing.test.ts
```

### 4. Cross-Browser Compatibility Tests

**Location**: `tests/e2e/cross-browser-lit-element.test.ts`

**Purpose**: Ensure LitElement compatibility across browsers and devices

**Browsers Tested**:
- Desktop: Chrome, Firefox, Safari, Edge (latest 2 versions)
- Mobile: Chrome (Android), Safari (iOS)
- Tablet: iPad, Android tablets

**Execution**:
```bash
# Run cross-browser tests with all browsers
npx playwright test --config=playwright.cross-browser.config.ts

# Run specific browser only
npx playwright test --config=playwright.cross-browser.config.ts --project=chromium
npx playwright test --config=playwright.cross-browser.config.ts --project=firefox
npx playwright test --config=playwright.cross-browser.config.ts --project=webkit
```

### 5. Regression Test Suite

**Location**: `tests/integration/regression-suite.test.ts`

**Purpose**: Prevent breaking changes to existing functionality

**Coverage Areas**:
- Authentication flows
- Dashboard functionality
- Workshop management
- User experience consistency
- Security measures
- Performance standards

**Execution**:
```bash
# Run regression suite
npx playwright test tests/integration/regression-suite.test.ts
```

## Test Environment Setup

### Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

2. **Database Setup**:
   ```bash
   # Create test database
   createdb workshopsai_cms_test

   # Run migrations
   npm run db:generate
   npm run db:migrate

   # Seed test data
   npm run db:seed:test
   ```

3. **Install Browsers**:
   ```bash
   npx playwright install
   npx playwright install-deps
   ```

4. **Environment Configuration**:
   ```bash
   cp .env.example .env.test
   # Edit .env.test with test database credentials
   ```

### Docker Test Environment

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d

# Run tests
npm run test:all

# Stop services
docker-compose -f docker-compose.test.yml down
```

## Test Data Management

### Mock Data Usage

Tests use factories and mocks to generate consistent test data:

```typescript
// Example: Generate test user
const testUser = UserFactory.create({
  email: 'test@example.com',
  role: 'facilitator'
});

// Example: Mock API response
await page.route('**/api/dashboard/overview', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: mockDashboardData
    })
  });
});
```

### Database Transactions

All database tests use transactions to ensure isolation:

```typescript
beforeEach(async () => {
  await database.transaction(async (trx) => {
    await setupTestData(trx);
  });
});

afterEach(async () => {
  await database.rollback();
});
```

## Performance Testing

### Load Testing with k6

```bash
# Run basic load test
npm run test:load

# Run stress test
npm run test:stress

# Custom load test
k6 run tests/load/custom-load-test.js --vus 50 --duration 5m
```

### Performance Budgets

- **API Response Time**: <200ms (95th percentile)
- **Page Load Time**: <2 seconds (LCP)
- **Bundle Size**: <300KB gzipped
- **Memory Usage**: <50MB increase per session

## Accessibility Testing

### Automated Tests

```bash
# Run accessibility tests
npm run test:accessibility

# Run with specific axe rules
npx playwright test tests/accessibility/ --grep="wcag"
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

## Security Testing

### Automated Security Tests

```bash
# Run security audit
npm run security:audit

# Run vulnerability scan
npm run security:scan

# Run penetration tests
npm run security:penetration-test
```

### Security Test Categories

1. **OWASP Top 10 Coverage**:
   - Broken Authentication
   - Sensitive Data Exposure
   - XML External Entities (XXE)
   - Broken Access Control
   - Security Misconfiguration
   - Cross-Site Scripting (XSS)
   - Insecure Deserialization
   - Using Components with Known Vulnerabilities
   - Insufficient Logging & Monitoring
   - Server-Side Request Forgery (SSRF)

2. **Input Validation Tests**:
   - XSS prevention
   - SQL injection prevention
   - File upload security
   - API parameter validation

## Troubleshooting

### Common Test Issues

1. **Test Timeout Issues**:
   ```bash
   # Increase timeout for specific test
   npx playwright test --timeout=60000

   # Or update in test file
   test.setTimeout(60000);
   ```

2. **Browser Installation Issues**:
   ```bash
   # Reinstall browsers
   npx playwright install --force

   # Install system dependencies
   npx playwright install-deps
   ```

3. **Database Connection Issues**:
   ```bash
   # Check database status
   npm run db:validate

   # Reset test database
   npm run db:reset:test
   ```

4. **Memory Leaks in Tests**:
   ```bash
   # Run with memory profiling
   node --inspect tests/integration/memory-leak-test.ts
   ```

### Debug Mode

```bash
# Run tests with debugging
npm run test:e2e:debug

# Run with headed mode
npm run test:e2e:headed

# Run with traces
npx playwright test --trace on
```

## Continuous Integration

### GitHub Actions

The CI pipeline runs automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Daily scheduled runs at 2 AM UTC

### Local CI Simulation

```bash
# Run full CI pipeline locally
npm run ci:test

# Run build validation
npm run ci:build
```

### Quality Gates

The pipeline enforces these quality gates:
- ✅ All linting rules pass
- ✅ TypeScript compilation succeeds
- ✅ Unit test coverage ≥80%
- ✅ Integration tests pass
- ✅ E2E tests for critical paths pass
- ✅ Accessibility score ≥95%
- ✅ Zero critical security vulnerabilities
- ✅ Performance benchmarks met

## Test Reports

### Generating Reports

```bash
# Generate HTML test report
npx playwright test --reporter=html

# Generate JUnit report
npx playwright test --reporter=junit

# Generate coverage report
npm run test:coverage
```

### Report Locations

- **Playwright Reports**: `playwright-report/`
- **Coverage Reports**: `coverage/`
- **Performance Reports**: `performance-reports/`
- **Security Reports**: `security-reports/`
- **Accessibility Reports**: `test-results/accessibility/`

## Best Practices

### Test Writing

1. **AAA Pattern**: Arrange, Act, Assert
2. **Descriptive Names**: Explain what and why
3. **Single Responsibility**: One behavior per test
4. **Deterministic**: Same result every time
5. **Fast**: Unit tests <100ms, E2E tests <5s

### Test Data

1. **Factory Pattern**: Use factories for consistent test data
2. **Minimal Data**: Only create what's needed
3. **Cleanup**: Always clean up test data
4. **Isolation**: Tests shouldn't depend on each other

### CI/CD Integration

1. **Fast Feedback**: Quick tests first
2. **Parallel Execution**: Run tests in parallel
3. **Fail Fast**: Stop pipeline on critical failures
4. **Artifacts**: Save test results and reports

## Getting Help

### Documentation

- [Testing Strategy Documentation](docs/TESTING_STRATEGY.md)
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)

### Community Support

- GitHub Issues for test-related bugs
- Slack channel for test discussions
- Regular testing sync meetings

### Escalation

For critical test failures blocking deployment:
1. Check test logs for specific error details
2. Run tests locally with debug mode
3. Check recent code changes for potential impact
4. Escalate to development team lead if unresolved within 2 hours