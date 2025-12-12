# Testing Guide for workshopsAI CMS

This guide provides comprehensive instructions for working with the testing framework and running tests effectively.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Types](#test-types)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Test Data Management](#test-data-management)
6. [Debugging Tests](#debugging-tests)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### Install Dependencies

```bash
# Install all dependencies including test dependencies
npm install

# Install Playwright browsers for E2E tests
npm run playwright:install

# Initialize test database (only once)
npm run db:generate
npm run db:migrate
```

### Run All Tests

```bash
# Run all test types
npm run test:all

# Run only unit and integration tests (faster)
npm run test:ci

# Run tests with coverage
npm run test:coverage
```

## Test Types

### 1. Unit Tests

Unit tests test individual functions, classes, or components in isolation.

```bash
# Run all unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:unit -- --watch

# Run specific unit test file
npm run test:unit -- tests/unit/services/workshop.test.ts
```

**Coverage Requirements:**
- Global: 80%
- Middleware: 90%
- Services: 85%

### 2. Integration Tests

Integration tests test how multiple parts of the system work together.

```bash
# Run all integration tests
npm run test:integration

# Run with database setup
npm run test:integration -- --setupFiles

# Run specific integration test
npm run test:integration -- tests/integration/api/workshop-api.test.ts
```

### 3. End-to-End (E2E) Tests

E2E tests simulate real user interactions in a browser.

```bash
# Run all E2E tests
npm run test:e2e

# Run with headed mode (shows browser)
npm run test:e2e:headed

# Run specific test file
npm run test:e2e -- tests/e2e/workshop-management.spec.ts

# Run in debug mode
npm run test:e2e -- --debug
```

### 4. Performance Tests

Performance tests measure system performance under load.

```bash
# Run basic load test
npm run test:load

# Run stress test
npm run test:stress
```

### 5. Security Tests

Security tests check for vulnerabilities and security issues.

```bash
# Run security tests
npm run test:security

# Run OWASP ZAP scan
npm run security:zap

# Run penetration test
npm run security:penetration-test
```

### 6. Accessibility Tests

Accessibility tests ensure the application is usable by people with disabilities.

```bash
# Run accessibility tests
npm run test:accessibility
```

## Running Tests

### Local Development

1. **Start required services:**
   ```bash
   # Start PostgreSQL
   brew services start postgresql

   # Start Redis
   brew services start redis
   ```

2. **Set up test database:**
   ```bash
   # Create test database
   createdb test_workshopsai_unit
   createdb test_workshopsai_integration
   createdb test_workshopsai_e2e
   ```

3. **Run tests:**
   ```bash
   # Quick test run
   npm test
   ```

### CI/CD Environment

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` branch

### Test Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Test environment | `test` |
| `DATABASE_URL` | Test database URL | - |
| `REDIS_URL` | Test Redis URL | - |
| `BASE_URL` | Application URL for E2E | `http://localhost:3010` |

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/services/workshop.service.test.ts
import { WorkshopService } from '../../../src/services/workshop.service';
import { WorkshopRepository } from '../../../src/repositories/workshop.repository';
import { createWorkshop } from '../../factories/workshop.factory';

describe('WorkshopService', () => {
  let service: WorkshopService;
  let mockRepository: jest.Mocked<WorkshopRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    service = new WorkshopService(mockRepository);
  });

  describe('createWorkshop', () => {
    it('should create workshop with valid data', async () => {
      // Arrange
      const workshopData = createWorkshop();
      const expectedWorkshop = { ...workshopData, id: 'test-id' };
      mockRepository.create.mockResolvedValue(expectedWorkshop);

      // Act
      const result = await service.createWorkshop(workshopData);

      // Assert
      expect(result).toEqual(expectedWorkshop);
      expect(mockRepository.create).toHaveBeenCalledWith(workshopData);
    });

    it('should throw error for invalid data', async () => {
      // Arrange
      const invalidData = { title: '' }; // Empty title is invalid

      // Act & Assert
      await expect(service.createWorkshop(invalidData))
        .rejects.toThrow('Title is required');
    });
  });
});
```

### Integration Test Example

```typescript
// tests/integration/api/workshop-api.test.ts
import request from 'supertest';
import { createTestApp } from '../../helpers/integration-test-helper';
import { createWorkshop } from '../../factories/workshop.factory';

describe('Workshop API Integration', () => {
  let app: Express;

  beforeAll(async () => {
    app = (await createTestApp()).app;
  });

  describe('POST /api/workshops', () => {
    it('should create workshop', async () => {
      const workshopData = createWorkshop({
        title: 'Integration Test Workshop'
      });

      const response = await request(app)
        .post('/api/workshops')
        .send(workshopData)
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Integration Test Workshop',
        status: 'draft'
      });
    });
  });
});
```

### E2E Test Example

```typescript
// tests/e2e/workshop-management.spec.ts
import { test, expect } from '../fixtures/test-data';

test.describe('Workshop Management', () => {
  test('admin can create and manage workshops', async ({ page, authenticatedPage }) => {
    // Already authenticated as admin

    // Create new workshop
    await page.goto('/workshops/create');
    await page.fill('[data-testid="title-input"]', 'E2E Test Workshop');
    await page.fill('[data-testid="description-input"]', 'A workshop for E2E testing');
    await page.selectOption('[data-testid="type-select"]', 'workshop');
    await page.click('[data-testid="save-button"]');

    // Verify creation
    await expect(page.locator('h1')).toContainText('E2E Test Workshop');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Edit workshop
    await page.click('[data-testid="edit-button"]');
    await page.fill('[data-testid="title-input"]', 'Updated E2E Test Workshop');
    await page.click('[data-testid="save-button"]');

    // Verify update
    await expect(page.locator('h1')).toContainText('Updated E2E Test Workshop');
  });

  test('student can enroll in workshops', async ({ page, studentPage }) => {
    // Browse workshops
    await page.goto('/workshops');

    // Find and click first available workshop
    const workshopCard = page.locator('[data-testid="workshop-card"]').first();
    await workshopCard.click();

    // Click enroll button
    await page.click('[data-testid="enroll-button"]');

    // Confirm enrollment
    await page.click('[data-testid="confirm-enroll"]');

    // Verify enrollment
    await expect(page.locator('[data-testid="enrollment-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="enrolled-badge"]')).toBeVisible();
  });
});
```

## Test Data Management

### Using Factories

```typescript
import { createWorkshop, createWorkshops, WorkshopFactory } from '../factories';

// Create single workshop
const workshop = createWorkshop({
  title: 'Custom Title',
  status: 'published'
});

// Create multiple workshops
const workshops = createWorkshops(5, {
  type: 'webinar'
});

// Use factory methods
const publishedWorkshop = WorkshopFactory.published();
const completedWorkshop = WorkshopFactory.completed();
```

### Test Database Setup

```typescript
import { setupTestDatabase, cleanTestDatabase, seedTestData } from '../helpers';

beforeAll(async () => {
  await setupTestDatabase(db);
});

beforeEach(async () => {
  await cleanTestDatabase(db);
});

afterAll(async () => {
  await db.end();
});
```

## Debugging Tests

### Unit Tests

```bash
# Run with debugger
node --inspect-brk node_modules/.bin/jest tests/unit/workshop.test.ts

# Run tests with verbose output
npm run test:unit -- --verbose

# Run tests with coverage
npm run test:unit -- --coverage
```

### Integration Tests

```typescript
// Add console logging
console.log('Test data:', testData);
console.log('Response:', response.data);

// Add debug breakpoints
debugger; // Will pause execution if Node is run with --inspect

// Use async/await properly
await setupTestData(); // Ensure data is ready
```

### E2E Tests

```typescript
// Use Playwright Inspector
test('debug mode', async ({ page }) => {
  // This will open the browser with inspector
  await page.goto('/');

  // Pause execution
  await page.pause();

  // Take screenshots
  await page.screenshot({ path: 'debug.png' });

  // Check page state
  console.log('Page URL:', page.url());
  console.log('Page title:', await page.title());
});
```

## Best Practices

### 1. Test Organization

```
tests/
├── unit/                  # Unit tests
│   ├── services/         # Service layer tests
│   ├── controllers/       # Controller tests
│   └── utils/           # Utility function tests
├── integration/          # Integration tests
│   ├── api/             # API integration tests
│   └── database/        # Database integration tests
├── e2e/                  # End-to-end tests
│   ├── flows/           # User journey tests
│   └── components/      # Component tests
├── factories/           # Test data factories
├── fixtures/            # Test fixtures and data
├── helpers/             # Test helper utilities
└── config/              # Test configurations
```

### 2. Naming Conventions

- **Test files**: `*.test.ts` for Jest, `*.spec.ts` for Playwright
- **Test descriptions**: Use "should" format
  - Good: `should create workshop with valid data`
  - Bad: `test 1`

### 3. Test Structure (AAA Pattern)

```typescript
it('should calculate correct workshop duration', () => {
  // Arrange - Set up test data
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-01-03');

  // Act - Execute the code being tested
  const duration = calculateDuration(startDate, endDate);

  // Assert - Verify the result
  expect(duration).toBe(3); // 3 days
});
```

### 4. Mocking

```typescript
// Use consistent mock objects
const mockWorkshopRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn()
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
```

### 5. Test Data

- Use factories for test data
- Avoid hardcoded values
- Use realistic but deterministic data
- Clean up after tests

### 6. Async Testing

```typescript
// Always await async operations
await service.createWorkshop(data);

// Use Promise.all for parallel operations
await Promise.all([
  service.createWorkshop(data1),
  service.createWorkshop(data2)
]);
```

## Troubleshooting

### Common Issues

1. **Test database connection errors**
   ```bash
   # Check PostgreSQL is running
   brew services list | grep postgresql

   # Check database exists
   psql -l
   ```

2. **Port conflicts in E2E tests**
   ```bash
   # Find process using port 3010
   lsof -i :3010

   # Kill process
   kill -9 <PID>
   ```

3. **Test timeouts**
   ```typescript
   // Increase timeout for slow tests
   test.setTimeout(60000); // 60 seconds
   ```

4. **Memory issues in tests**
   ```bash
   # Limit Jest memory
   NODE_OPTIONS="--max-old-space-size=4096" npm test
   ```

### Debug Checklist

- [ ] Services running (PostgreSQL, Redis)?
- [ ] Test databases created?
- [ ] Environment variables set?
- [ ] Dependencies installed?
- [ ] Browsers installed for E2E?
- [ ] Test data factories working?

### Getting Help

1. Check test logs in `test-results/`
2. Run tests with verbose output
3. Use `--debug` flag for Playwright tests
4. Check CI/CD logs for pipeline failures

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Test Coverage Guide](https://jestjs.io/docs/coverage)

## Contributing

When adding new tests:

1. Follow the existing patterns
2. Add appropriate factories if needed
3. Update documentation
4. Ensure coverage thresholds are met
5. Run all tests before submitting