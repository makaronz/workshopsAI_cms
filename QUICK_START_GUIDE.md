# workshopsAI CMS - Quick Start Guide

## 🚀 Getting Started Quickly

This guide helps you get workshopsAI CMS running in minutes with our optimized initialization process.

## Prerequisites

### System Requirements
- **Node.js**: 20.0.0 or higher
- **npm**: 8.0.0 or higher
- **PostgreSQL**: 13 or higher
- **Redis**: 6 or higher
- **Docker**: (Optional, for containerized setup)

### Quick Environment Check
```bash
# Verify Node.js version
node --version  # Should be v20.x.x or higher

# Verify npm version
npm --version   # Should be 8.x.x or higher

# Verify services
docker --version
pg_isready -h localhost -p 5432
redis-cli ping
```

## ⚡ One-Command Setup

### Option 1: Automatic Setup (Recommended)
```bash
# Clone and set up in one command
git clone <repository-url> workshopsai-cms
cd workshopsai-cms
npm run init
```

### Option 2: Step-by-Step Setup
```bash
# 1. Install dependencies
npm ci

# 2. Set up environment
npm run setup

# 3. Set up database (requires PostgreSQL running)
npm run setup:dev

# 4. Start development server
npm run dev
```

## 🛠️ Environment Configuration

### 1. Database Setup
```bash
# Using Docker (easiest)
docker-compose up -d postgres redis

# Or install locally:
# PostgreSQL: https://www.postgresql.org/download/
# Redis: https://redis.io/download
```

### 2. Environment Variables
Copy the example environment file and update values:
```bash
cp .env.example .env
# Edit .env with your configuration
```

**Required variables for development:**
```env
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=workshopsai_cms
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

### 3. Database Migration
```bash
# Generate database schema
npm run db:generate

# Run migrations
npm run db:migrate

# Verify database setup
npm run db:validate
```

## 🧪 Verification & Testing

### Health Check
```bash
# Health check endpoint
curl http://localhost:3001/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "...",
#   "uptime": 123,
#   "environment": "development",
#   "database": "connected",
#   "redis": "connected"
# }
```

### Run Tests
```bash
# Quick validation
npm run validate

# Full test suite
npm run test:all

# E2E tests (requires more setup)
npm run test:e2e
```

## 🐳 Docker Setup (Alternative)

### Development with Docker
```bash
# Start all services
npm run docker:dev

# Or manually:
docker-compose -f docker-compose.dev.yml up -d
```

### Production Docker Setup
```bash
# Build and run production container
npm run docker:build
npm run docker:run
```

## 📱 Access Points

Once running, access the application at:

- **API Base URL**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/health
- **API Documentation**: http://localhost:3001/docs (if enabled)
- **Database Studio**: http://localhost:3001/db (if enabled)

## 🔧 Common Development Tasks

### Adding Dependencies
```bash
# Production dependency
npm install package-name

# Development dependency
npm install --save-dev package-name

# Update all dependencies
npm update
```

### Database Operations
```bash
# Create new migration
npm run db:generate

# Run migrations
npm run db:migrate

# Open database studio
npm run db:studio

# Backup database
npm run db:backup
```

### Testing
```bash
# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# Serve coverage report
npm run coverage:serve

# E2E tests with UI
npm run test:e2e --headed
```

### Code Quality
```bash
# Lint and fix
npm run lint:fix

# Format code
npm run format

# Type checking
npm run typecheck

# Security audit
npm run security:audit
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Error
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# If not running:
# macOS: brew services start postgresql
# Ubuntu: sudo systemctl start postgresql
# Docker: docker start postgres_container_name
```

#### 2. Redis Connection Error
```bash
# Check Redis status
redis-cli ping

# If not running:
# macOS: brew services start redis
# Ubuntu: sudo systemctl start redis
# Docker: docker start redis_container_name
```

#### 3. Port Already in Use
```bash
# Find process using port 3001
lsof -ti:3001

# Kill process
kill -9 $(lsof -ti:3001)

# Or use different port
PORT=3002 npm run dev
```

#### 4. Permission Issues
```bash
# Fix file permissions
chmod -R 755 .
sudo chown -R $(whoami) node_modules
```

#### 5. Dependency Issues
```bash
# Clean install
npm run clean:all

# Or manually:
rm -rf node_modules package-lock.json
npm install
```

### Getting Help

1. **Check logs**: Look at console output for specific error messages
2. **Health check**: Visit http://localhost:3001/health for system status
3. **Documentation**: See `/docs` folder for detailed guides
4. **Issues**: Check GitHub issues for known problems

## 📊 Development Workflow

### Daily Development
```bash
# 1. Start services
docker-compose up -d postgres redis

# 2. Start development server
npm run dev

# 3. Run tests in another terminal
npm run test:watch

# 4. Check linting before commits
npm run lint
```

### Before Committing
```bash
# Full validation
npm run validate:strict

# Or individual checks
npm run lint
npm run typecheck
npm run test:unit
```

### Performance Monitoring
```bash
# Bundle analysis
npm run build:analyze

# Performance tests
npm run test:performance

# Load testing
npm run test:load
```

## 🎯 Next Steps

1. **Explore the API**: Check `docs/api-overview.md` for API documentation
2. **Review Architecture**: See `docs/INITIALIZATION_ARCHITECTURE.md` for technical details
3. **Configure Features**: Update `.env` file to enable/disable features
4. **Set Up CI/CD**: Configure GitHub Actions for automated testing/deployment

## 📚 Additional Resources

- **API Documentation**: `/docs/developer-docs/api-overview.md`
- **Deployment Guide**: `/docs/deployment/`
- **Security Guide**: `/docs/SECURITY_IMPLEMENTATION_GUIDE.md`
- **Testing Guide**: `/docs/TESTING_INFRASTRUCTURE.md`
- **Performance Guide**: `/docs/performance/optimization-guide.md`

---

**Need help?** Check the [documentation](./docs/) or [open an issue](https://github.com/your-repo/issues).

Happy coding! 🚀