# GitHub Workflows Quick Reference

## Active Workflows

| Workflow | Trigger | Purpose | Duration |
|----------|---------|---------|----------|
| **ci-cd.yml** | Push/PR to main/develop | Lint, type check, test, build | ~15-20 min |
| **test.yml** | Push/PR to main/develop, Daily 2AM | Comprehensive testing suite | ~30-45 min |
| **e2e-tests.yml** | Push/PR to main/develop, Daily 2AM | Browser E2E tests | ~20-30 min |
| **security.yml** | Push/PR, Weekly Sundays 3AM | Security scanning | ~10-15 min |

## Workflow Details

### ci-cd.yml

- ✅ ESLint & TypeScript type checking
- ✅ Unit tests
- ✅ Integration tests (PostgreSQL + Redis)
- ✅ Build verification

### test.yml

- ✅ Lint & type check
- ✅ Unit tests (Node 18 & 20)
- ✅ Integration tests (PostgreSQL + Redis)
- ✅ E2E tests (Chromium, Firefox, WebKit)
- ✅ Accessibility tests
- ✅ Performance tests (optional)
- ✅ Security tests
- ✅ Build tests
- ✅ Coverage reporting

### e2e-tests.yml

- ✅ E2E tests (Chromium, Firefox)
- ✅ Performance tests
- ✅ Security E2E tests
- ✅ Smoke tests

### security.yml

- ✅ npm audit (dependency vulnerabilities)
- ✅ Gitleaks (secret detection)
- ✅ Security summary report

## Running Workflows Locally

### Prerequisites

```bash
npm install
```

### Run individual checks

```bash
# Linting
npm run lint

# Type checking
npm run typecheck

# Unit tests
npm run test:unit

# Integration tests (requires PostgreSQL + Redis)
npm run test:integration

# E2E tests (requires Playwright)
npm run test:e2e

# Security audit
npm audit --audit-level=moderate

# Build
npm run build
```

### Setup services for tests

```bash
# Using Docker Compose (if available)
docker-compose up -d postgres redis

# Or install locally:
# - PostgreSQL 15
# - Redis 7
```

## Common Issues & Solutions

### Issue: Tests fail locally

**Solution**: Ensure PostgreSQL and Redis are running

```bash
# Check PostgreSQL
psql -h localhost -p 5432 -U postgres

# Check Redis
redis-cli ping
```

### Issue: E2E tests fail

**Solution**: Install Playwright browsers

```bash
npx playwright install --with-deps
```

### Issue: Build fails

**Solution**: Check TypeScript errors

```bash
npm run typecheck
```

## Disabled Workflows

To re-enable a disabled workflow:

```bash
cd .github/workflows
mv <workflow-name>.yml.disabled <workflow-name>.yml
```

**Note**: Disabled workflows may require additional secrets and configuration.

## Environment Variables (for testing)

```bash
# Required for integration tests
export DB_HOST=localhost
export  DB_PORT=5432
export DB_USER=workshopsai_test
export DB_PASSWORD=test_password
export DB_NAME=workshopsai_cms_test
export REDIS_HOST=localhost
export REDIS_PORT=6379
export NODE_ENV=test
```

## GitHub Actions Status

View workflow runs: [Repository → Actions](https://github.com/makaronz/workshopsAI_cms/actions)

## Support

- Workflows created/repaired: 2025-11-21
- For issues, check `.github/WORKFLOWS_REPAIR_SUMMARY.md`
