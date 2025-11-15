# CI/CD Integration Guide

Comprehensive guide to integrating the testing suite with CI/CD pipelines, including GitHub Actions workflows, test automation, and deployment gates.

## 📋 Table of Contents

- [CI/CD Overview](#cicd-overview)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Test Pipeline Configuration](#test-pipeline-configuration)
- [Environment Management](#environment-management)
- [Test Reporting](#test-reporting)
- [Deployment Gates](#deployment-gates)
- [Security Testing Integration](#security-testing-integration)
- [Performance Monitoring](#performance-monitoring)
- [Notification Systems](#notification-systems)
- [Pipeline Optimization](#pipeline-optimization)
- [Troubleshooting](#troubleshooting)

## 🎯 CI/CD Overview

CI/CD (Continuous Integration/Continuous Deployment) automates the testing and deployment process, ensuring code quality and reliability. This guide covers:

- **Automated Testing**: Comprehensive test execution in CI/CD pipelines
- **Environment Management**: Managing test, staging, and production environments
- **Quality Gates**: Automated checks that prevent bad code from reaching production
- **Reporting**: Comprehensive test reporting and artifact management
- **Deployment Automation**: Automated deployment with rollback capabilities

### CI/CD Pipeline Stages

1. **Code Quality**: Linting, formatting, and static analysis
2. **Unit Testing**: Fast feedback on code changes
3. **Integration Testing**: Component and service integration validation
4. **Performance Testing**: Performance regression detection
5. **E2E Testing**: Complete user workflow validation
6. **Security Testing**: Vulnerability scanning and security validation
7. **Build & Package**: Application packaging and optimization
8. **Deployment**: Automated deployment to target environments

## 🔄 GitHub Actions Workflows

### Main CI/CD Pipeline

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop, 'test/*']
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:
    inputs:
      test_type:
        description: 'Type of tests to run'
        required: false
        type: choice
        default: 'all'
        options:
          - all
          - unit
          - integration
          - performance
          - e2e
          - security
      environment:
        description: 'Target environment'
        required: false
        type: choice
        default: 'staging'
        options:
          - staging
          - production

env:
  NODE_VERSION: '20.x'
  CACHE_VERSION: 'v1'

jobs:
  # Code Quality Checks
  code-quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run Prettier check
        run: npm run format:check

      - name: Run TypeScript check
        run: npm run typecheck

      - name: Upload lint results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: lint-results
          path: lint-results.json
          retention-days: 7

  # Security Scanning
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Run CodeQL analysis
        uses: github/codeql-action/init@v2
        with:
          languages: javascript

      - name: Perform CodeQL analysis
        uses: github/codeql-action/analyze@v2

      - name: Upload security report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: security-report
          path: security-report.json
          retention-days: 30

  # Unit Tests
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit:ci
        env:
          NODE_ENV: test
          CI: true

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        if: matrix.node-version == '20.x'
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

      - name: Upload unit test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: unit-test-results-${{ matrix.node-version }}
          path: test-results/unit/
          retention-days: 7

  # Integration Tests
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Wait for services
        run: |
          timeout 60 bash -c 'until nc -z localhost 5432; do sleep 1; done'
          timeout 60 bash -c 'until nc -z localhost 6379; do sleep 1; done'

      - name: Run database migrations
        run: npm run db:migrate:test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Seed test database
        run: npm run db:seed:test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Run integration tests
        run: npm run test:integration:ci
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379/1
          CI: true

      - name: Upload integration test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: integration-test-results
          path: test-results/integration/
          retention-days: 7

  # Performance Tests
  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    if: github.event_name == 'push' || github.event.inputs.test_type == 'performance'

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          npm run db:migrate:test
          npm run db:seed:test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Run performance tests
        run: npm run test:performance:ci
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379/1
          PERFORMANCE_TEST_DURATION: 60000

      - name: Upload performance results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-test-results
          path: test-results/performance/
          retention-days: 30

      - name: Upload performance baseline
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-baseline
          path: test-results/performance-baseline.json
          retention-days: 90

  # E2E Tests
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [integration-tests]
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Start application
        run: |
          npm start &
          sleep 30

      - name: Run E2E tests
        run: npm run test:e2e:ci
        env:
          BASE_URL: http://localhost:3001
          BROWSER: ${{ matrix.browser }}
          CI: true

      - name: Upload E2E test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: e2e-test-results-${{ matrix.browser }}
          path: test-results/e2e/
          retention-days: 7

  # Build Application
  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production

      - name: Run bundle analysis
        run: npm run analyze:bundle

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: dist/
          retention-days: 7

      - name: Upload bundle analysis
        uses: actions/upload-artifact@v3
        with:
          name: bundle-analysis
          path: bundle-analysis.json
          retention-days: 30

  # Security Scanning (Production)
  security-scan-production:
    name: Production Security Scan
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          path: dist/

      - name: Run OWASP ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'http://localhost:3001'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'

      - name: Upload security scan results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: zap-security-report
          path: report_html.html
          retention-days: 30

  # Deploy to Staging
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build, e2e-tests, security-scan-production]
    if: github.ref == 'refs/heads/develop' || github.event.inputs.environment == 'staging'
    environment:
      name: staging
      url: https://staging.workshopsai-cms.com

    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          path: dist/

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Add your deployment commands here
          # Example: aws s3 sync dist/ s3://staging-bucket/
          # Example: docker build -t workshopsai-cms:staging .
          # Example: docker push your-registry/workshopsai-cms:staging

      - name: Run smoke tests
        run: npm run test:smoke:staging
        env:
          STAGING_URL: https://staging.workshopsai-cms.com

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  # Deploy to Production
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [performance-tests, security-scan-production]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment:
      name: production
      url: https://workshopsai-cms.com

    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          path: dist/

      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          # Add your production deployment commands here

      - name: Run production smoke tests
        run: npm run test:smoke:production
        env:
          PRODUCTION_URL: https://workshopsai-cms.com

      - name: Create deployment tag
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.git.createRef({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: `refs/tags/v${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}`,
              sha: context.sha
            })

      - name: Notify production deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  # Test Results Summary
  test-summary:
    name: Test Results Summary
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, performance-tests, e2e-tests]
    if: always()

    steps:
      - name: Download all test results
        uses: actions/download-artifact@v3

      - name: Generate test summary
        run: |
          echo "# Test Results Summary" > test-results-summary.md
          echo "" >> test-results-summary.md
          echo "## Unit Tests" >> test-results-summary.md
          echo "- Status: ${{ needs.unit-tests.result }}" >> test-results-summary.md
          echo "" >> test-results-summary.md
          echo "## Integration Tests" >> test-results-summary.md
          echo "- Status: ${{ needs.integration-tests.result }}" >> test-results-summary.md
          echo "" >> test-results-summary.md
          echo "## Performance Tests" >> test-results-summary.md
          echo "- Status: ${{ needs.performance-tests.result }}" >> test-results-summary.md
          echo "" >> test-results-summary.md
          echo "## E2E Tests" >> test-results-summary.md
          echo "- Status: ${{ needs.e2e-tests.result }}" >> test-results-summary.md

      - name: Upload test summary
        uses: actions/upload-artifact@v3
        with:
          name: test-results-summary
          path: test-results-summary.md
          retention-days: 90

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const summary = fs.readFileSync('test-results-summary.md', 'utf8');

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: summary
            });
```

### Performance Monitoring Workflow

```yaml
# .github/workflows/performance-monitoring.yml
name: Performance Monitoring

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to monitor'
        required: false
        type: choice
        default: 'production'
        options:
          - production
          - staging
      duration:
        description: 'Test duration in minutes'
        required: false
        default: '10'

jobs:
  performance-monitoring:
    name: Performance Monitoring
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run performance monitoring
        run: npm run test:performance:monitor
        env:
          MONITORING_ENVIRONMENT: ${{ github.event.inputs.environment || 'production' }}
          MONITORING_DURATION: ${{ github.event.inputs.duration || '10' }}

      - name: Analyze performance trends
        run: npm run test:performance:trends

      - name: Check for performance regressions
        run: npm run test:performance:regression-check

      - name: Upload performance report
        uses: actions/upload-artifact@v3
        with:
          name: performance-monitoring-report
          path: performance-monitoring-report.json
          retention-days: 30

      - name: Alert on performance issues
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: 'failure'
          channel: '#alerts'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          message: |
            Performance monitoring detected issues in ${{ github.event.inputs.environment || 'production' }}
            Duration: ${{ github.event.inputs.duration || '10' }} minutes
            Please check the performance report for details.
```

## ⚙️ Test Pipeline Configuration

### Test Configuration Files

```json
// package.json - Test scripts
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:unit": "jest --config jest.unit.config.ts",
    "test:unit:ci": "jest --config jest.unit.config.ts --ci --coverage --watchAll=false",
    "test:unit:watch": "jest --config jest.unit.config.ts --watch",
    "test:unit:coverage": "jest --config jest.unit.config.ts --coverage",
    "test:integration": "jest --config jest.integration.config.ts",
    "test:integration:ci": "jest --config jest.integration.config.ts --ci --watchAll=false",
    "test:e2e": "playwright test",
    "test:e2e:ci": "playwright test --reporter=json --reporter=html",
    "test:performance": "jest --config jest.performance.config.ts",
    "test:performance:ci": "jest --config jest.performance.config.ts --ci --watchAll=false",
    "test:security": "npm audit && snyk test",
    "test:smoke:staging": "playwright test --config playwright.staging.config.ts",
    "test:smoke:production": "playwright test --config playwright.production.config.ts",
    "test:performance:monitor": "node scripts/performance-monitor.js",
    "test:performance:trends": "node scripts/performance-trends.js",
    "test:performance:regression-check": "node scripts/performance-regression-check.js"
  }
}
```

### Environment Configuration

```bash
# .env.test - Test environment
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
REDIS_URL=redis://localhost:6379/1
BASE_URL=http://localhost:3001

# Performance testing
PERFORMANCE_TEST_DURATION=30000
PERFORMANCE_CONCURRENCY=50
PERFORMANCE_THRESHOLD_RESPONSE_TIME=2000
PERFORMANCE_THRESHOLD_ERROR_RATE=0.01

# E2E testing
E2E_TIMEOUT=30000
E2E_RETRY_ATTEMPTS=3
E2E_SLOWMO=0

# CI/CD specific
CI=true
ARTIFACT_RETENTION_DAYS=7
REPORT_RETENTION_DAYS=30
```

```bash
# .env.staging - Staging environment
NODE_ENV=staging
DATABASE_URL=postgresql://user:pass@staging-db:5432/staging_db
REDIS_URL=redis://staging-redis:6379/1
BASE_URL=https://staging.workshopsai-cms.com

# External services
OPENAI_API_KEY=${{ secrets.STAGING_OPENAI_API_KEY }}
ANTHROPIC_API_KEY=${{ secrets.STAGING_ANTHROPIC_API_KEY }}

# Monitoring
SENTRY_DSN=${{ secrets.STAGING_SENTRY_DSN }}
LOG_LEVEL=info
```

```bash
# .env.production - Production environment
NODE_ENV=production
DATABASE_URL=${{ secrets.PROD_DATABASE_URL }}
REDIS_URL=${{ secrets.PROD_REDIS_URL }}
BASE_URL=https://workshopsai-cms.com

# External services
OPENAI_API_KEY=${{ secrets.PROD_OPENAI_API_KEY }}
ANTHROPIC_API_KEY=${{ secrets.PROD_ANTHROPIC_API_KEY }}

# Monitoring
SENTRY_DSN=${{ secrets.PROD_SENTRY_DSN }}
LOG_LEVEL=warn
```

## 🌍 Environment Management

### Multi-environment Setup

```typescript
// scripts/environment-setup.ts
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface EnvironmentConfig {
  name: string;
  database: string;
  redis: string;
  baseUrl: string;
  features: string[];
}

const environments: Record<string, EnvironmentConfig> = {
  test: {
    name: 'test',
    database: 'postgresql://test:test@localhost:5432/test_db',
    redis: 'redis://localhost:6379/1',
    baseUrl: 'http://localhost:3001',
    features: ['mock-llm', 'mock-email', 'debug-mode']
  },
  staging: {
    name: 'staging',
    database: process.env.STAGING_DATABASE_URL!,
    redis: process.env.STAGING_REDIS_URL!,
    baseUrl: 'https://staging.workshopsai-cms.com',
    features: ['real-llm', 'email-logging', 'analytics']
  },
  production: {
    name: 'production',
    database: process.env.PROD_DATABASE_URL!,
    redis: process.env.PROD_REDIS_URL!,
    baseUrl: 'https://workshopsai-cms.com',
    features: ['real-llm', 'real-email', 'analytics', 'monitoring']
  }
};

class EnvironmentManager {
  static async setupEnvironment(envName: string): Promise<void> {
    const env = environments[envName];
    if (!env) {
      throw new Error(`Unknown environment: ${envName}`);
    }

    console.log(`Setting up ${env.name} environment...`);

    // Create environment-specific configuration
    await this.createEnvironmentConfig(env);

    // Setup database
    await this.setupDatabase(env);

    // Setup Redis
    await this.setupRedis(env);

    // Setup monitoring
    await this.setupMonitoring(env);

    console.log(`${env.name} environment setup complete`);
  }

  private static async createEnvironmentConfig(env: EnvironmentConfig): Promise<void> {
    const config = {
      environment: env.name,
      database: env.database,
      redis: env.redis,
      baseUrl: env.baseUrl,
      features: env.features,
      timestamp: new Date().toISOString()
    };

    const configPath = path.join(process.cwd(), 'config', `${env.name}.json`);
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  private static async setupDatabase(env: EnvironmentConfig): Promise<void> {
    if (env.name === 'test') {
      // Reset test database
      execSync('npm run db:reset:test', { stdio: 'inherit' });
    } else {
      // Run migrations for non-test environments
      execSync('npm run db:migrate', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: env.database }
      });
    }
  }

  private static async setupRedis(env: EnvironmentConfig): Promise<void> {
    // Test Redis connection
    execSync('npm run test:redis', {
      stdio: 'inherit',
      env: { ...process.env, REDIS_URL: env.redis }
    });
  }

  private static async setupMonitoring(env: EnvironmentConfig): Promise<void> {
    if (env.features.includes('monitoring')) {
      // Setup monitoring tools
      execSync('npm run monitoring:setup', { stdio: 'inherit' });
    }
  }

  static async teardownEnvironment(envName: string): Promise<void> {
    const env = environments[envName];
    if (!env) {
      throw new Error(`Unknown environment: ${envName}`);
    }

    console.log(`Tearing down ${env.name} environment...`);

    if (env.name === 'test') {
      // Clean test database
      execSync('npm run db:clean:test', { stdio: 'inherit' });
    }

    // Clean Redis cache
    execSync('npm run redis:flush', {
      stdio: 'inherit',
      env: { ...process.env, REDIS_URL: env.redis }
    });

    console.log(`${env.name} environment teardown complete`);
  }
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  const environment = process.argv[3];

  switch (command) {
    case 'setup':
      EnvironmentManager.setupEnvironment(environment);
      break;
    case 'teardown':
      EnvironmentManager.teardownEnvironment(environment);
      break;
    default:
      console.log('Usage: node environment-setup.js <setup|teardown> <environment>');
  }
}

export { EnvironmentManager };
```

### Database Migration Script

```typescript
// scripts/database-migration.ts
import { Client } from 'pg';
import { execSync } from 'child_process';

interface MigrationConfig {
  databaseUrl: string;
  migrationsPath: string;
  seedDataPath: string;
}

class DatabaseMigration {
  private client: Client;

  constructor(private config: MigrationConfig) {
    this.client = new Client({
      connectionString: config.databaseUrl
    });
  }

  async migrate(): Promise<void> {
    try {
      await this.client.connect();
      console.log('Connected to database');

      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();

      // Get current migration version
      const currentVersion = await this.getCurrentMigrationVersion();

      // Get all migration files
      const migrations = await this.getMigrations();

      // Run pending migrations
      for (const migration of migrations) {
        if (migration.version > currentVersion) {
          console.log(`Running migration: ${migration.file}`);
          await this.runMigration(migration);
          await this.recordMigration(migration);
        }
      }

      console.log('All migrations completed');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      await this.client.end();
    }
  }

  async seed(seedDataPath?: string): Promise<void> {
    try {
      await this.client.connect();
      console.log('Connected to database for seeding');

      const seedPath = seedDataPath || this.config.seedDataPath;
      const seedData = require(seedPath);

      for (const table of Object.keys(seedData)) {
        console.log(`Seeding table: ${table}`);
        await this.seedTable(table, seedData[table]);
      }

      console.log('Database seeding completed');
    } catch (error) {
      console.error('Seeding failed:', error);
      throw error;
    } finally {
      await this.client.end();
    }
  }

  async reset(): Promise<void> {
    try {
      await this.client.connect();
      console.log('Connected to database for reset');

      // Drop all tables
      const tables = await this.getTables();
      for (const table of tables) {
        await this.client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }

      // Run migrations
      await this.migrate();

      // Seed data
      await this.seed();

      console.log('Database reset completed');
    } catch (error) {
      console.error('Reset failed:', error);
      throw error;
    } finally {
      await this.client.end();
    }
  }

  private async createMigrationsTable(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        file VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async getCurrentMigrationVersion(): Promise<number> {
    const result = await this.client.query(
      'SELECT COALESCE(MAX(version), 0) as version FROM migrations'
    );
    return parseInt(result.rows[0].version);
  }

  private async getMigrations(): Promise<Array<{ version: number; file: string; sql: string }>> {
    const fs = require('fs');
    const path = require('path');

    const files = fs.readdirSync(this.config.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const version = parseInt(file.split('_')[0]);
      const sql = fs.readFileSync(path.join(this.config.migrationsPath, file), 'utf8');
      return { version, file, sql };
    });
  }

  private async runMigration(migration: { version: number; file: string; sql: string }): Promise<void> {
    await this.client.query('BEGIN');
    try {
      await this.client.query(migration.sql);
      await this.client.query('COMMIT');
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw error;
    }
  }

  private async recordMigration(migration: { version: number; file: string }): Promise<void> {
    await this.client.query(
      'INSERT INTO migrations (version, file) VALUES ($1, $2)',
      [migration.version.toString(), migration.file]
    );
  }

  private async getTables(): Promise<string[]> {
    const result = await this.client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
    return result.rows.map(row => row.tablename);
  }

  private async seedTable(table: string, data: any[]): Promise<void> {
    if (data.length === 0) return;

    const columns = Object.keys(data[0]);
    const values = data.map(row => columns.map(col => row[col]));

    const placeholders = values.map((_, index) =>
      `(${columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ');

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${placeholders}
    `;

    await this.client.query(query, values.flat());
  }
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  const environment = process.argv[3];

  const configs: Record<string, MigrationConfig> = {
    test: {
      databaseUrl: 'postgresql://test:test@localhost:5432/test_db',
      migrationsPath: './migrations',
      seedDataPath: './seed/test-data.json'
    },
    staging: {
      databaseUrl: process.env.STAGING_DATABASE_URL!,
      migrationsPath: './migrations',
      seedDataPath: './seed/staging-data.json'
    },
    production: {
      databaseUrl: process.env.PROD_DATABASE_URL!,
      migrationsPath: './migrations',
      seedDataPath: './seed/production-data.json'
    }
  };

  const config = configs[environment];
  if (!config) {
    console.error(`Unknown environment: ${environment}`);
    process.exit(1);
  }

  const migration = new DatabaseMigration(config);

  switch (command) {
    case 'migrate':
      migration.migrate();
      break;
    case 'seed':
      migration.seed();
      break;
    case 'reset':
      migration.reset();
      break;
    default:
      console.log('Usage: node database-migration.js <migrate|seed|reset> <environment>');
  }
}

export { DatabaseMigration };
```

## 📊 Test Reporting

### Test Report Generator

```typescript
// scripts/test-report-generator.ts
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  suite: string;
  test: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'pass' | 'fail' | 'warn';
}

interface TestReport {
  timestamp: string;
  environment: string;
  branch: string;
  commit: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    coverage?: {
      lines: number;
      functions: number;
      branches: number;
      statements: number;
    };
  };
  suites: Array<{
    name: string;
    tests: TestResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
    };
  }>;
  performance: PerformanceMetric[];
  artifacts: string[];
  recommendations: string[];
}

class TestReportGenerator {
  private report: TestReport;

  constructor() {
    this.report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      branch: process.env.GITHUB_REF_NAME || 'main',
      commit: process.env.GITHUB_SHA || 'local',
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      suites: [],
      performance: [],
      artifacts: [],
      recommendations: []
    };
  }

  async generateReport(): Promise<TestReport> {
    console.log('Generating comprehensive test report...');

    // Load test results from different sources
    await this.loadUnitTestResults();
    await this.loadIntegrationTestResults();
    await this.loadE2ETestResults();
    await this.loadPerformanceResults();
    await this.loadCoverageResults();

    // Calculate summary
    this.calculateSummary();

    // Generate recommendations
    this.generateRecommendations();

    // Save report
    await this.saveReport();

    console.log('Test report generated successfully');
    return this.report;
  }

  private async loadUnitTestResults(): Promise<void> {
    try {
      const unitResultsPath = 'test-results/unit/jest-results.json';
      if (fs.existsSync(unitResultsPath)) {
        const unitResults = JSON.parse(fs.readFileSync(unitResultsPath, 'utf8'));

        const suite = {
          name: 'Unit Tests',
          tests: unitResults.testResults.map((test: any) => ({
            suite: test.fullName,
            test: test.title,
            status: test.status,
            duration: test.duration,
            error: test.failureMessage
          })),
          summary: {
            total: unitResults.numTotalTests,
            passed: unitResults.numPassedTests,
            failed: unitResults.numFailedTests,
            skipped: unitResults.numPendingTests,
            duration: unitResults.totalTestDuration
          }
        };

        this.report.suites.push(suite);
      }
    } catch (error) {
      console.warn('Failed to load unit test results:', error);
    }
  }

  private async loadIntegrationTestResults(): Promise<void> {
    try {
      const integrationResultsPath = 'test-results/integration/jest-results.json';
      if (fs.existsSync(integrationResultsPath)) {
        const integrationResults = JSON.parse(fs.readFileSync(integrationResultsPath, 'utf8'));

        const suite = {
          name: 'Integration Tests',
          tests: integrationResults.testResults.map((test: any) => ({
            suite: test.fullName,
            test: test.title,
            status: test.status,
            duration: test.duration,
            error: test.failureMessage
          })),
          summary: {
            total: integrationResults.numTotalTests,
            passed: integrationResults.numPassedTests,
            failed: integrationResults.numFailedTests,
            skipped: integrationResults.numPendingTests,
            duration: integrationResults.totalTestDuration
          }
        };

        this.report.suites.push(suite);
      }
    } catch (error) {
      console.warn('Failed to load integration test results:', error);
    }
  }

  private async loadE2ETestResults(): Promise<void> {
    try {
      const e2eResultsPath = 'test-results/e2e/results.json';
      if (fs.existsSync(e2eResultsPath)) {
        const e2eResults = JSON.parse(fs.readFileSync(e2eResultsPath, 'utf8'));

        const suite = {
          name: 'E2E Tests',
          tests: e2eResults.suites.flatMap((suite: any) =>
            suite.specs.map((spec: any) => ({
              suite: suite.title,
              test: spec.title,
              status: spec.tests[0].results[0].status,
              duration: spec.tests[0].results[0].duration,
              error: spec.tests[0].results[0].error?.message
            }))
          ),
          summary: {
            total: e2eResults.stats.expected,
            passed: e2eResults.stats.expected - e2eResults.stats.failed,
            failed: e2eResults.stats.failed,
            skipped: e2eResults.stats.skipped || 0,
            duration: e2eResults.stats.duration
          }
        };

        this.report.suites.push(suite);
      }
    } catch (error) {
      console.warn('Failed to load E2E test results:', error);
    }
  }

  private async loadPerformanceResults(): Promise<void> {
    try {
      const performanceResultsPath = 'test-results/performance/performance-results.json';
      if (fs.existsSync(performanceResultsPath)) {
        const performanceResults = JSON.parse(fs.readFileSync(performanceResultsPath, 'utf8'));

        this.report.performance = performanceResults.metrics.map((metric: any) => ({
          name: metric.name,
          value: metric.value,
          unit: metric.unit,
          threshold: metric.threshold,
          status: metric.value <= metric.threshold ? 'pass' :
                  metric.value <= metric.threshold * 1.2 ? 'warn' : 'fail'
        }));
      }
    } catch (error) {
      console.warn('Failed to load performance results:', error);
    }
  }

  private async loadCoverageResults(): Promise<void> {
    try {
      const coverageResultsPath = 'coverage/coverage-summary.json';
      if (fs.existsSync(coverageResultsPath)) {
        const coverageResults = JSON.parse(fs.readFileSync(coverageResultsPath, 'utf8'));

        this.report.summary.coverage = {
          lines: coverageResults.total.lines.pct,
          functions: coverageResults.total.functions.pct,
          branches: coverageResults.total.branches.pct,
          statements: coverageResults.total.statements.pct
        };
      }
    } catch (error) {
      console.warn('Failed to load coverage results:', error);
    }
  }

  private calculateSummary(): void {
    this.report.summary.total = this.report.suites.reduce((sum, suite) => sum + suite.summary.total, 0);
    this.report.summary.passed = this.report.suites.reduce((sum, suite) => sum + suite.summary.passed, 0);
    this.report.summary.failed = this.report.suites.reduce((sum, suite) => sum + suite.summary.failed, 0);
    this.report.summary.skipped = this.report.suites.reduce((sum, suite) => sum + suite.summary.skipped, 0);
    this.report.summary.duration = this.report.suites.reduce((sum, suite) => sum + suite.summary.duration, 0);
  }

  private generateRecommendations(): void {
    const recommendations: string[] = [];

    // Coverage recommendations
    if (this.report.summary.coverage) {
      if (this.report.summary.coverage.lines < 80) {
        recommendations.push('Line coverage is below 80%. Consider adding more unit tests.');
      }
      if (this.report.summary.coverage.branches < 70) {
        recommendations.push('Branch coverage is below 70%. Add tests for edge cases.');
      }
    }

    // Performance recommendations
    const failedPerformanceTests = this.report.performance.filter(p => p.status === 'fail');
    if (failedPerformanceTests.length > 0) {
      recommendations.push(`${failedPerformanceTests.length} performance tests failed. Review and optimize critical paths.`);
    }

    // Test failure recommendations
    if (this.report.summary.failed > 0) {
      recommendations.push(`${this.report.summary.failed} tests failed. Review and fix failing tests before merging.`);
    }

    // Duration recommendations
    if (this.report.summary.duration > 300000) { // 5 minutes
      recommendations.push('Test suite is taking more than 5 minutes. Consider parallelizing tests or optimizing test performance.');
    }

    this.report.recommendations = recommendations;
  }

  private async saveReport(): Promise<void> {
    const reportDir = 'test-results/reports';
    await fs.promises.mkdir(reportDir, { recursive: true });

    const reportPath = path.join(reportDir, `test-report-${Date.now()}.json`);
    await fs.promises.writeFile(reportPath, JSON.stringify(this.report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    const htmlReportPath = path.join(reportDir, `test-report-${Date.now()}.html`);
    await fs.promises.writeFile(htmlReportPath, htmlReport);

    // Copy to artifacts directory for CI
    const artifactsDir = 'test-results/artifacts';
    await fs.promises.mkdir(artifactsDir, { recursive: true });

    await fs.promises.copyFile(reportPath, path.join(artifactsDir, 'test-report.json'));
    await fs.promises.copyFile(htmlReportPath, path.join(artifactsDir, 'test-report.html'));

    console.log(`Test report saved to: ${reportPath}`);
    console.log(`HTML report saved to: ${htmlReportPath}`);
  }

  private generateHTMLReport(): string {
    const { summary, suites, performance, recommendations } = this.report;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Test Report - ${this.report.timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .metric h3 { margin: 0 0 10px 0; }
        .metric .value { font-size: 24px; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .suite { margin-bottom: 30px; }
        .suite h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
        .test { margin: 5px 0; padding: 5px; border-left: 3px solid #ddd; padding-left: 10px; }
        .test.passed { border-left-color: #28a745; }
        .test.failed { border-left-color: #dc3545; }
        .test.skipped { border-left-color: #ffc107; }
        .performance { margin-bottom: 20px; }
        .performance h3 { color: #333; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; }
        .recommendations h3 { margin-top: 0; color: #856404; }
        .recommendations ul { margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Test Report</h1>
        <p><strong>Environment:</strong> ${this.report.environment}</p>
        <p><strong>Branch:</strong> ${this.report.branch}</p>
        <p><strong>Commit:</strong> ${this.report.commit}</p>
        <p><strong>Timestamp:</strong> ${this.report.timestamp}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div class="value">${summary.total}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div class="value passed">${summary.passed}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="value failed">${summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Skipped</h3>
            <div class="value skipped">${summary.skipped}</div>
        </div>
        <div class="metric">
            <h3>Duration</h3>
            <div class="value">${(summary.duration / 1000).toFixed(2)}s</div>
        </div>
        ${summary.coverage ? `
        <div class="metric">
            <h3>Coverage</h3>
            <div class="value">${summary.coverage.lines}%</div>
        </div>
        ` : ''}
    </div>

    ${suites.map(suite => `
    <div class="suite">
        <h2>${suite.name}</h2>
        <p><strong>Total:</strong> ${suite.summary.total} |
           <strong>Passed:</strong> <span class="passed">${suite.summary.passed}</span> |
           <strong>Failed:</strong> <span class="failed">${suite.summary.failed}</span> |
           <strong>Skipped:</strong> <span class="skipped">${suite.summary.skipped}</span> |
           <strong>Duration:</strong> ${(suite.summary.duration / 1000).toFixed(2)}s</p>
        <div class="tests">
            ${suite.tests.map(test => `
            <div class="test ${test.status}">
                <strong>${test.test}</strong>
                <span style="float: right;">${(test.duration / 1000).toFixed(2)}s</span>
                ${test.error ? `<br><em style="color: #dc3545;">${test.error}</em>` : ''}
            </div>
            `).join('')}
        </div>
    </div>
    `).join('')}

    ${performance.length > 0 ? `
    <div class="performance">
        <h3>Performance Metrics</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="padding: 10px; text-align: left;">Metric</th>
                    <th style="padding: 10px; text-align: left;">Value</th>
                    <th style="padding: 10px; text-align: left;">Threshold</th>
                    <th style="padding: 10px; text-align: left;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${performance.map(metric => `
                <tr>
                    <td style="padding: 10px;">${metric.name}</td>
                    <td style="padding: 10px;">${metric.value} ${metric.unit}</td>
                    <td style="padding: 10px;">${metric.threshold} ${metric.unit}</td>
                    <td style="padding: 10px;">
                        <span class="${metric.status}">${metric.status.toUpperCase()}</span>
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${recommendations.length > 0 ? `
    <div class="recommendations">
        <h3>Recommendations</h3>
        <ul>
            ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>
    `;
  }
}

// CLI usage
if (require.main === module) {
  const generator = new TestReportGenerator();
  generator.generateReport()
    .then(() => console.log('Report generation completed'))
    .catch(error => {
      console.error('Report generation failed:', error);
      process.exit(1);
    });
}

export { TestReportGenerator };
```

## 🚀 Deployment Gates

### Quality Gate Configuration

```typescript
// scripts/quality-gates.ts
interface QualityGate {
  name: string;
  description: string;
  check: () => Promise<GateResult>;
  required: boolean;
}

interface GateResult {
  passed: boolean;
  message: string;
  details?: any;
}

class QualityGateManager {
  private gates: QualityGate[] = [];

  constructor() {
    this.setupGates();
  }

  private setupGates(): void {
    // Test coverage gate
    this.gates.push({
      name: 'test-coverage',
      description: 'Minimum test coverage requirements',
      required: true,
      check: async () => this.checkTestCoverage()
    });

    // Performance gate
    this.gates.push({
      name: 'performance-thresholds',
      description: 'Performance regression detection',
      required: true,
      check: async () => this.checkPerformanceThresholds()
    });

    // Security gate
    this.gates.push({
      name: 'security-scan',
      description: 'Security vulnerability scan',
      required: true,
      check: async () => this.checkSecurityResults()
    });

    // Code quality gate
    this.gates.push({
      name: 'code-quality',
      description: 'Code linting and formatting',
      required: true,
      check: async () => this.checkCodeQuality()
    });

    // Documentation gate
    this.gates.push({
      name: 'documentation',
      description: 'Documentation coverage',
      required: false,
      check: async () => this.checkDocumentationCoverage()
    });
  }

  async runQualityGates(): Promise<{
    passed: boolean;
    results: Array<{ gate: QualityGate; result: GateResult }>;
  }> {
    console.log('Running quality gates...');

    const results: Array<{ gate: QualityGate; result: GateResult }> = [];

    for (const gate of this.gates) {
      console.log(`Checking gate: ${gate.name}`);

      try {
        const result = await gate.check();
        results.push({ gate, result });

        if (!result.passed && gate.required) {
          console.error(`❌ Required gate failed: ${gate.name} - ${result.message}`);
        } else if (result.passed) {
          console.log(`✅ Gate passed: ${gate.name}`);
        } else {
          console.log(`⚠️  Optional gate failed: ${gate.name} - ${result.message}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const result: GateResult = {
          passed: false,
          message: `Gate check failed: ${errorMessage}`
        };

        results.push({ gate, result });

        if (gate.required) {
          console.error(`❌ Required gate error: ${gate.name} - ${errorMessage}`);
        }
      }
    }

    const passed = results
      .filter(r => r.gate.required)
      .every(r => r.result.passed);

    console.log(`Quality gates completed. Overall result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

    return { passed, results };
  }

  private async checkTestCoverage(): Promise<GateResult> {
    try {
      const coveragePath = 'coverage/coverage-summary.json';
      if (!require('fs').existsSync(coveragePath)) {
        return {
          passed: false,
          message: 'Coverage report not found'
        };
      }

      const coverage = JSON.parse(require('fs').readFileSync(coveragePath, 'utf8'));
      const total = coverage.total;

      const thresholds = {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      };

      const failedMetrics = [];

      if (total.lines.pct < thresholds.lines) {
        failedMetrics.push(`Lines: ${total.lines.pct}% (required: ${thresholds.lines}%)`);
      }
      if (total.functions.pct < thresholds.functions) {
        failedMetrics.push(`Functions: ${total.functions.pct}% (required: ${thresholds.functions}%)`);
      }
      if (total.branches.pct < thresholds.branches) {
        failedMetrics.push(`Branches: ${total.branches.pct}% (required: ${thresholds.branches}%)`);
      }
      if (total.statements.pct < thresholds.statements) {
        failedMetrics.push(`Statements: ${total.statements.pct}% (required: ${thresholds.statements}%)`);
      }

      if (failedMetrics.length > 0) {
        return {
          passed: false,
          message: `Coverage thresholds not met: ${failedMetrics.join(', ')}`,
          details: coverage
        };
      }

      return {
        passed: true,
        message: `All coverage thresholds met: Lines ${total.lines.pct}%, Functions ${total.functions.pct}%, Branches ${total.branches.pct}%, Statements ${total.statements.pct}%`,
        details: coverage
      };
    } catch (error) {
      return {
        passed: false,
        message: `Coverage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkPerformanceThresholds(): Promise<GateResult> {
    try {
      const performancePath = 'test-results/performance/performance-results.json';
      if (!require('fs').existsSync(performancePath)) {
        return {
          passed: false,
          message: 'Performance results not found'
        };
      }

      const performance = JSON.parse(require('fs').readFileSync(performancePath, 'utf8'));
      const failedMetrics = [];

      for (const metric of performance.metrics) {
        if (metric.status === 'fail') {
          failedMetrics.push(`${metric.name}: ${metric.value} ${metric.unit} (threshold: ${metric.threshold} ${metric.unit})`);
        }
      }

      if (failedMetrics.length > 0) {
        return {
          passed: false,
          message: `Performance thresholds exceeded: ${failedMetrics.join(', ')}`,
          details: performance
        };
      }

      return {
        passed: true,
        message: 'All performance thresholds met',
        details: performance
      };
    } catch (error) {
      return {
        passed: false,
        message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkSecurityResults(): Promise<GateResult> {
    try {
      const securityPath = 'test-results/security/security-scan-results.json';
      if (!require('fs').existsSync(securityPath)) {
        return {
          passed: false,
          message: 'Security scan results not found'
        };
      }

      const security = JSON.parse(require('fs').readFileSync(securityPath, 'utf8'));

      if (security.vulnerabilities.length > 0) {
        const highVulnerabilities = security.vulnerabilities.filter((v: any) => v.severity === 'high');

        if (highVulnerabilities.length > 0) {
          return {
            passed: false,
            message: `High severity security vulnerabilities found: ${highVulnerabilities.length}`,
            details: security
          };
        }
      }

      return {
        passed: true,
        message: 'No high severity security vulnerabilities found',
        details: security
      };
    } catch (error) {
      return {
        passed: false,
        message: `Security check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkCodeQuality(): Promise<GateResult> {
    try {
      const lintPath = 'test-results/lint/lint-results.json';
      if (!require('fs').existsSync(lintPath)) {
        return {
          passed: false,
          message: 'Lint results not found'
        };
      }

      const lint = JSON.parse(require('fs').readFileSync(lintPath, 'utf8'));

      if (lint.errors && lint.errors.length > 0) {
        return {
          passed: false,
          message: `Lint errors found: ${lint.errors.length}`,
          details: lint
        };
      }

      if (lint.warnings && lint.warnings.length > 10) {
        return {
          passed: false,
          message: `Too many lint warnings: ${lint.warnings.length}`,
          details: lint
        };
      }

      return {
        passed: true,
        message: 'Code quality checks passed',
        details: lint
      };
    } catch (error) {
      return {
        passed: false,
        message: `Code quality check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkDocumentationCoverage(): Promise<GateResult> {
    try {
      const docPath = 'documentation-coverage.json';
      if (!require('fs').existsSync(docPath)) {
        return {
          passed: true, // Optional gate
          message: 'Documentation coverage report not found (optional gate)'
        };
      }

      const docs = JSON.parse(require('fs').readFileSync(docPath, 'utf8'));

      if (docs.coverage < 70) {
        return {
          passed: false,
          message: `Documentation coverage too low: ${docs.coverage}%`,
          details: docs
        };
      }

      return {
        passed: true,
        message: `Documentation coverage: ${docs.coverage}%`,
        details: docs
      };
    } catch (error) {
      return {
        passed: false,
        message: `Documentation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  generateQualityGateReport(results: Array<{ gate: QualityGate; result: GateResult }>): string {
    const report = [
      '# Quality Gates Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Results Summary',
      ''
    ];

    const requiredGates = results.filter(r => r.gate.required);
    const optionalGates = results.filter(r => !r.gate.required);

    report.push('### Required Gates');
    for (const { gate, result } of requiredGates) {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      report.push(`- **${gate.name}**: ${status}`);
      report.push(`  ${result.message}`);
      report.push('');
    }

    if (optionalGates.length > 0) {
      report.push('### Optional Gates');
      for (const { gate, result } of optionalGates) {
        const status = result.passed ? '✅ PASSED' : '⚠️  FAILED';
        report.push(`- **${gate.name}**: ${status}`);
        report.push(`  ${result.message}`);
        report.push('');
      }
    }

    return report.join('\n');
  }
}

// CLI usage
if (require.main === module) {
  const manager = new QualityGateManager();
  manager.runQualityGates()
    .then(({ passed, results }) => {
      const report = manager.generateQualityGateReport(results);
      console.log(report);

      if (!passed) {
        console.error('Quality gates failed. Deployment blocked.');
        process.exit(1);
      } else {
        console.log('All quality gates passed. Deployment approved.');
      }
    })
    .catch(error => {
      console.error('Quality gate check failed:', error);
      process.exit(1);
    });
}

export { QualityGateManager };
```

## 📧 Notification Systems

### Slack Integration

```typescript
// scripts/slack-notifications.ts
interface SlackMessage {
  text: string;
  channel: string;
  attachments?: Array<{
    color: string;
    title: string;
    text: string;
    fields?: Array<{
      title: string;
      value: string;
      short: boolean;
    }>;
  }>;
}

class SlackNotifier {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendMessage(message: SlackMessage): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }

      console.log('Slack notification sent successfully');
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      throw error;
    }
  }

  async notifyDeploymentSuccess(environment: string, version: string): Promise<void> {
    const message: SlackMessage = {
      text: `✅ Deployment to ${environment} completed successfully`,
      channel: '#deployments',
      attachments: [{
        color: 'good',
        title: 'Deployment Success',
        text: `Version ${version} has been deployed to ${environment}`,
        fields: [
          {
            title: 'Environment',
            value: environment,
            short: true
          },
          {
            title: 'Version',
            value: version,
            short: true
          },
          {
            title: 'Deployed At',
            value: new Date().toISOString(),
            short: true
          }
        ]
      }]
    };

    await this.sendMessage(message);
  }

  async notifyDeploymentFailure(environment: string, error: string): Promise<void> {
    const message: SlackMessage = {
      text: `❌ Deployment to ${environment} failed`,
      channel: '#deployments',
      attachments: [{
        color: 'danger',
        title: 'Deployment Failed',
        text: `Deployment to ${environment} encountered an error`,
        fields: [
          {
            title: 'Environment',
            value: environment,
            short: true
          },
          {
            title: 'Error',
            value: error,
            short: false
          },
          {
            title: 'Failed At',
            value: new Date().toISOString(),
            short: true
          }
        ]
      }]
    };

    await this.sendMessage(message);
  }

  async notifyTestResults(environment: string, results: any): Promise<void> {
    const { summary, suites } = results;
    const status = summary.failed === 0 ? 'good' : 'warning';
    const emoji = summary.failed === 0 ? '✅' : '⚠️';

    const message: SlackMessage = {
      text: `${emoji} Test results for ${environment}`,
      channel: '#test-results',
      attachments: [{
        color: status,
        title: 'Test Results Summary',
        text: `Test execution completed for ${environment}`,
        fields: [
          {
            title: 'Total Tests',
            value: summary.total.toString(),
            short: true
          },
          {
            title: 'Passed',
            value: summary.passed.toString(),
            short: true
          },
          {
            title: 'Failed',
            value: summary.failed.toString(),
            short: true
          },
          {
            title: 'Duration',
            value: `${(summary.duration / 1000).toFixed(2)}s`,
            short: true
          }
        ]
      }]
    };

    // Add suite details
    if (suites && suites.length > 0) {
      message.attachments!.push({
        color: status,
        title: 'Test Suite Details',
        fields: suites.map((suite: any) => ({
          title: suite.name,
          value: `${suite.summary.passed}/${suite.summary.total} passed`,
          short: true
        }))
      });
    }

    await this.sendMessage(message);
  }

  async notifyPerformanceRegression(environment: string, regressions: any[]): Promise<void> {
    const message: SlackMessage = {
      text: `🚨 Performance regression detected in ${environment}`,
      channel: '#alerts',
      attachments: [{
        color: 'danger',
        title: 'Performance Regression Alert',
        text: `Performance regressions detected in ${environment}`,
        fields: [
          {
            title: 'Environment',
            value: environment,
            short: true
          },
          {
            title: 'Regressions Count',
            value: regressions.length.toString(),
            short: true
          },
          {
            title: 'Detected At',
            value: new Date().toISOString(),
            short: true
          }
        ]
      }]
    };

    // Add regression details
    if (regressions.length > 0) {
      const regressionDetails = regressions.map(reg => ({
        title: reg.metric,
        value: `${reg.current} vs ${reg.baseline} (${reg.percentageChange}% increase)`,
        short: false
      }));

      message.attachments!.push({
        color: 'danger',
        title: 'Regression Details',
        fields: regressionDetails
      });
    }

    await this.sendMessage(message);
  }
}

export { SlackNotifier };
```

## 🔧 Troubleshooting

### Common CI/CD Issues

#### Test Failures in CI

```bash
# Debug test failures locally
npm run test:ci

# Check test environment setup
npm run test:env:check

# Run specific failing test
npm run test:unit -- --testNamePattern="failing test"

# Run tests with debug output
DEBUG=test* npm run test:unit
```

#### Performance Test Failures

```bash
# Run performance tests locally
npm run test:performance

# Check performance baseline
npm run test:performance:baseline

# Update performance thresholds
npm run test:performance:update-thresholds

# Run performance tests with monitoring
npm run test:performance:monitored
```

#### Deployment Issues

```bash
# Check deployment configuration
npm run deploy:config:check

# Test deployment locally
npm run deploy:local

# Check deployment logs
npm run deploy:logs

# Rollback deployment
npm run deploy:rollback
```

### Performance Optimization

#### CI/CD Pipeline Optimization

```yaml
# .github/workflows/optimized-ci.yml
name: Optimized CI Pipeline

on:
  push:
    branches: [main, develop]

# Use larger runners for better performance
jobs:
  test:
    runs-on: ubuntu-latest-4-cores
    strategy:
      matrix:
        node-version: [20.x] # Single version for speed
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # Run tests in parallel
      - name: Run unit tests
        run: npm run test:unit:ci &

      - name: Run integration tests
        run: npm run test:integration:ci &

      - name: Wait for tests
        run: wait

      # Only run E2E tests on main branch
      - name: Run E2E tests
        if: github.ref == 'refs/heads/main'
        run: npm run test:e2e:ci
```

This comprehensive CI/CD integration guide provides all the tools and configurations needed to set up a robust, automated testing and deployment pipeline for the WorkshopsAI CMS project.