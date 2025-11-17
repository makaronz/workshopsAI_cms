# WorkshopsAI CMS - Deployment & Operations Guide

**Version**: 1.0.0 | **Last Updated**: November 2025 | **Production Ready**: ✅

---

## 📋 Table of Contents

- [Overview](#overview)
- [Environment Requirements](#environment-requirements)
- [Deployment Architecture](#deployment-architecture)
- [Development Deployment](#development-deployment)
- [Staging Deployment](#staging-deployment)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Database Management](#database-management)
- [Monitoring & Logging](#monitoring--logging)
- [Security Configuration](#security-configuration)
- [Backup & Recovery](#backup--recovery)
- [Scaling & Performance](#scaling--performance)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This guide provides comprehensive instructions for deploying and operating the WorkshopsAI CMS in various environments. The application follows modern DevOps practices with containerization, automated testing, and monitoring capabilities.

### Deployment Targets
- **Development**: Local development with hot reload
- **Staging**: Pre-production environment for testing
- **Production**: Live production environment with high availability
- **Docker**: Containerized deployment for portability

### Key Features
- **Zero-Downtime Deployment**: Blue-green deployment strategy
- **Automated Testing**: Comprehensive test suite in CI/CD
- **Health Monitoring**: Real-time health checks and alerting
- **Security Hardening**: Production security configurations
- **Disaster Recovery**: Automated backups and recovery procedures

---

## 🖥️ Environment Requirements

### Minimum System Requirements

#### Development Environment
```bash
# CPU: 2 cores
# RAM: 4GB
# Storage: 10GB free space
# OS: macOS 10.15+, Ubuntu 18.04+, Windows 10+

Node.js >= 20.0.0
npm >= 8.0.0
PostgreSQL >= 15.0
Redis >= 7.0
```

#### Production Environment
```bash
# CPU: 4 cores minimum (8 cores recommended)
# RAM: 8GB minimum (16GB recommended)
# Storage: 50GB SSD (100GB recommended)
# Network: 1Gbps connection

Node.js >= 20.0.0
PostgreSQL >= 15.0 (PostgreSQL 15+ recommended)
Redis >= 7.0 (Redis 7+ recommended)
Nginx >= 1.20 (or similar reverse proxy)
```

#### Cloud Requirements (AWS/GCP/Azure)
```yaml
# Compute Instance
type: t3.large (or equivalent)
vCPU: 2
RAM: 8GB
Storage: gp3 50GB SSD
Network: Standard

# Database
type: db.t3.medium (or equivalent)
vCPU: 2
RAM: 4GB
Storage: 100GB SSD
Backup: Automated daily
High Availability: Yes (multi-AZ)

# Cache
type: cache.t3.micro (or equivalent)
vCPU: 1
RAM: 1GB
Cluster mode: No
```

### Software Dependencies

#### Required Software
```bash
# Core dependencies
node --version  # >= 20.0.0
npm --version   # >= 8.0.0

# Database
psql --version # >= 15.0
redis-server --version # >= 7.0

# Build tools
git --version
docker --version  # >= 20.10.0
docker-compose --version # >= 2.0.0

# Optional but recommended
npx --version    # Latest
pm2 --version    # >= 5.0.0 (for production)
```

#### Development Tools
```bash
# Install globally (optional)
npm install -g typescript tsx nodemon pm2

# For Docker deployment
docker buildx version  # >= 0.8.0
```

---

## 🏗️ Deployment Architecture

### System Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │    Web Server   │    │   Application   │
│    (Nginx)      │────│    (Nginx)      │────│   (Node.js)     │
│  Port: 80/443   │    │  Port: 3000     │    │  Port: 3001     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐            │
                       │   Frontend SPA  │            │
                       │   (Vite/Lit)    │            │
                       │  Port: 3000     │            │
                       └─────────────────┘            │
                                                        ▼
                                              ┌─────────────────┐
                                              │   PostgreSQL    │
                                              │     Database    │
                                              │  Port: 5432     │
                                              └─────────────────┘
                                                        │
                                              ┌─────────────────┐
                                              │     Redis       │
                                              │      Cache      │
                                              │  Port: 6379     │
                                              └─────────────────┘
```

### Network Configuration
```yaml
# Production network setup
load_balancer:
  type: nginx
  port: 80, 443
  ssl_certificate: /path/to/cert.pem
  ssl_key: /path/to/key.pem

web_servers:
  - host: app1.workshopsai.com
    port: 3000
    backend: http://localhost:3001
  - host: app2.workshopsai.com
    port: 3000
    backend: http://localhost:3001

database:
  host: db.workshopsai.com
  port: 5432
  ssl: true
  max_connections: 100

cache:
  host: cache.workshopsai.com
  port: 6379
  ssl: true
  cluster: false
```

---

## 🛠️ Development Deployment

### Quick Start Development Setup
```bash
# 1. Clone repository
git clone https://github.com/your-org/workshopsAI_cms.git
cd workshopsAI_cms

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..

# 3. Setup environment
cp .env.example .env.development
# Edit .env.development with your settings

# 4. Setup database
createdb workshopsai_cms_dev
npm run db:generate
npm run db:migrate

# 5. Start Redis (if not running)
redis-server

# 6. Start development servers
npm run dev              # Backend on port 3001
cd frontend && npm run dev  # Frontend on port 3000
```

### Development Environment Configuration
```bash
# .env.development
NODE_ENV=development
PORT=3001
DEBUG=workshopsai:*

# Database (development)
DATABASE_URL=postgresql://dev_user:dev_pass@localhost:5432/workshopsai_cms_dev
DB_HOST=localhost
DB_PORT=5432
DB_USER=dev_user
DB_PASSWORD=dev_pass
DB_NAME=workshopsai_cms_dev

# Redis (development)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (development - weak keys only!)
JWT_SECRET=development-jwt-secret-change-in-production
JWT_REFRESH_SECRET=development-refresh-secret-change-in-production

# CORS (development)
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# Features
ENABLE_LOGGING=true
ENABLE_METRICS=true
ENABLE_PROFILING=true
ENABLE_SWAGGER=true
LOG_LEVEL=debug

# File upload (development)
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB
```

### Development Docker Compose
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/workshopsai_cms
      - REDIS_URL=redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - db
      - redis
    command: npm run dev

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: workshopsai_cms
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Development Commands
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Database operations
npm run db:generate     # Generate migrations
npm run db:migrate      # Run migrations
npm run db:studio       # Open Drizzle Studio
npm run db:seed         # Seed test data
```

---

## 🧪 Staging Deployment

### Staging Environment Setup
```bash
# 1. Create staging server
# Use your cloud provider to create staging instance
# Recommended: t3.large (2 vCPU, 8GB RAM, 50GB SSD)

# 2. Configure server
ssh user@staging.workshopsai.com

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y postgresql postgresql-contrib
sudo apt-get install -y redis-server
sudo apt-get install -y nginx

# 3. Clone and setup repository
git clone https://github.com/your-org/workshopsAI_cms.git
cd workshopsAI_cms
npm ci --production
cd frontend && npm ci --production && cd ..

# 4. Configure environment
sudo nano /etc/environment
# Add environment variables

# 5. Setup database
sudo -u postgres createdb workshopsai_cms_staging
npm run db:migrate
```

### Staging Environment Configuration
```bash
# /etc/environment or .env.staging
NODE_ENV=staging
PORT=3001

# Database (staging)
DATABASE_URL=postgresql://workshopsai_staging:secure_password@localhost:5432/workshopsai_cms_staging
DB_HOST=localhost
DB_PORT=5432
DB_USER=workshopsai_staging
DB_PASSWORD=secure_password_for_staging
DB_NAME=workshopsai_cms_staging

# Redis (staging)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (staging - use secure keys)
JWT_SECRET=your-secure-staging-jwt-secret-32-chars-minimum
JWT_REFRESH_SECRET=your-secure-staging-refresh-secret-32-chars-minimum

# CORS (staging)
CORS_ORIGIN=https://staging.workshopsai.com
CORS_CREDENTIALS=true

# External services
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key

# Monitoring
SENTRY_DSN=https://your-sentry-dsn-for-staging
LOG_LEVEL=info

# File upload (staging)
UPLOAD_DIR=/var/www/workshopsai/uploads
MAX_FILE_SIZE=10485760  # 10MB
```

### Staging Deployment Script
```bash
#!/bin/bash
# deploy-staging.sh

set -e

echo "🚀 Starting staging deployment..."

# Variables
APP_DIR="/var/www/workshopsai_staging"
BACKUP_DIR="/var/backups/workshopsai_staging"
REPO_URL="https://github.com/your-org/workshopsAI_cms.git"
BRANCH="main"

# Create backup
echo "📦 Creating backup..."
sudo mkdir -p $BACKUP_DIR
sudo cp -r $APP_DIR $BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S)

# Update code
echo "📥 Updating code..."
cd $APP_DIR
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production
cd frontend && npm ci --production && cd ..

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Build application
echo "🏗️ Building application..."
npm run build

# Restart services
echo "🔄 Restarting services..."
sudo systemctl reload workshopsai
sudo systemctl reload nginx

# Health check
echo "🏥 Running health check..."
sleep 10
curl -f http://localhost:3001/health || exit 1

echo "✅ Staging deployment completed successfully!"
echo "🌐 Application available at: https://staging.workshopsai.com"
```

### Staging Nginx Configuration
```nginx
# /etc/nginx/sites-available/staging.workshopsai.com
server {
    listen 80;
    server_name staging.workshopsai.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.workshopsai.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/staging.workshopsai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.workshopsai.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Frontend (static files)
    location / {
        root /var/www/workshopsai_staging/frontend/dist;
        try_files $uri $uri/ /index.html;

        # Cache static files
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }

    # File uploads
    location /uploads/ {
        alias /var/www/workshopsai_staging/uploads/;
        expires 1y;
        add_header Cache-Control "public";
    }
}
```

### Staging Systemd Service
```ini
# /etc/systemd/system/workshopsai.service
[Unit]
Description=WorkshopsAI CMS
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/workshopsai_staging
Environment=NODE_ENV=staging
Environment=PORT=3001
Restart=always
RestartSec=10
ExecStart=/usr/bin/node dist/index.js
ExecReload=/bin/kill -HUP $MAINPID

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/workshopsai_staging/uploads /var/www/workshopsai_staging/logs

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

---

## 🚀 Production Deployment

### Production Environment Setup
```bash
# 1. Infrastructure Setup
# Use managed services where possible:
# - Managed PostgreSQL (AWS RDS, Cloud SQL, etc.)
# - Managed Redis (ElastiCache, Memorystore, etc.)
# - Load Balancer (ALB, Cloud Load Balancer, etc.)
# - CDN (CloudFront, Cloud CDN, etc.)

# 2. Application Servers
# Create at least 2 instances for high availability
# Recommended: t3.large or larger

# 3. Install dependencies (on each server)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y nginx
sudo apt-get install -y certbot python3-certbot-nginx
```

### Production Environment Configuration
```bash
# Production environment variables
NODE_ENV=production
PORT=3001

# Database (production - use managed service)
DATABASE_URL=postgresql://workshopsai_prod:very_secure_password@db.workshopsai.com:5432/workshopsai_cms_prod
DB_HOST=db.workshopsai.com
DB_PORT=5432
DB_USER=workshopsai_prod
DB_PASSWORD=very_secure_password_change_me
DB_NAME=workshopsai_cms_prod
DB_SSL_MODE=require
DB_SSL_CERT=/path/to/client-cert.pem
DB_SSL_KEY=/path/to/client-key.pem
DB_SSL_CA=/path/to/ca-cert.pem

# Redis (production - use managed service)
REDIS_URL=redis://redis.workshopsai.com:6379
REDIS_HOST=redis.workshopsai.com
REDIS_PORT=6379
REDIS_PASSWORD=secure_redis_password
REDIS_TLS=true

# JWT (production - use extremely secure keys)
JWT_SECRET=your-super-secure-production-jwt-secret-64-chars-minimum
JWT_REFRESH_SECRET=your-super-secure-production-refresh-secret-64-chars-minimum
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS (production)
CORS_ORIGIN=https://app.workshopsai.com
CORS_CREDENTIALS=true

# External services
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-production-sendgrid-api-key

# Monitoring and logging
SENTRY_DSN=https://your-production-sentry-dsn
LOG_LEVEL=warn
NEW_RELIC_LICENSE_KEY=your-newrelic-license-key

# File storage (production - use S3 or similar)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET=workshopsai-production-uploads
UPLOAD_DIR=/tmp/uploads
MAX_FILE_SIZE=10485760  # 10MB

# Rate limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100
```

### Production Deployment Script
```bash
#!/bin/bash
# deploy-production.sh

set -e

# Configuration
APP_DIR="/var/www/workshopsai"
BACKUP_DIR="/var/backups/workshopsai"
HEALTH_CHECK_URL="http://localhost:3001/health"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    # Send to Slack
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 Production Deployment Error: $1\"}" \
        $SLACK_WEBHOOK
}

# Send notification
notify() {
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$1\"}" \
        $SLACK_WEBHOOK
}

# Pre-deployment checks
log "🔍 Running pre-deployment checks..."

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    error "Application directory not found: $APP_DIR"
    exit 1
fi

# Check disk space
DISK_USAGE=$(df $APP_DIR | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    error "Disk usage too high: ${DISK_USAGE}%"
    exit 1
fi

# Check database connection
log "🗄️ Checking database connection..."
npm run db:check || (error "Database connection failed" && exit 1)

# Create backup
log "📦 Creating application backup..."
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p $BACKUP_DIR
sudo cp -r $APP_DIR $BACKUP_DIR/$BACKUP_NAME

# Database backup
log "🗄️ Creating database backup..."
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | \
    gzip > $BACKUP_DIR/db-backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Notify start of deployment
notify "🚀 Starting production deployment..."

# Update code
log "📥 Updating application code..."
cd $APP_DIR

# Stash any local changes
git stash

# Fetch and checkout latest
git fetch origin
git checkout main
git pull origin main

# Install dependencies
log "📦 Installing dependencies..."
npm ci --production
cd frontend && npm ci --production && cd ..

# Run tests
log "🧪 Running tests..."
npm run test:ci || (error "Tests failed" && exit 1)

# Run database migrations
log "🗄️ Running database migrations..."
npm run db:migrate

# Build application
log "🏗️ Building application..."
npm run build

# Blue-green deployment
log "🔀 Starting blue-green deployment..."

# Prepare new version
NEW_VERSION_DIR="${APP_DIR}_new"
cp -r $APP_DIR $NEW_VERSION_DIR

# Switch to new version
log "🔄 Switching to new version..."
sudo ln -sfn $NEW_VERSION_DIR /var/www/workshopsai_current
sudo systemctl reload workshopsai

# Health check
log "🏥 Running health check..."
sleep 30
MAX_ATTEMPTS=10
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if curl -f $HEALTH_CHECK_URL; then
        log "✅ Health check passed"
        break
    fi

    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        error "Health check failed after $MAX_ATTEMPTS attempts"
        # Rollback
        log "🔄 Rolling back deployment..."
        sudo ln -sfn $APP_DIR /var/www/workshopsai_current
        sudo systemctl reload workshopsai
        notify "❌ Production deployment failed - rolled back"
        exit 1
    fi

    log "⏳ Health check attempt $ATTEMPT failed, retrying in 10 seconds..."
    sleep 10
    ATTEMPT=$((ATTEMPT + 1))
done

# Cleanup old version
log "🧹 Cleaning up old version..."
if [ -d "${APP_DIR}_old" ]; then
    sudo rm -rf ${APP_DIR}_old
fi

# Move current to old, new to current
sudo mv $APP_DIR ${APP_DIR}_old
sudo mv $NEW_VERSION_DIR $APP_DIR
sudo ln -sfn $APP_DIR /var/www/workshopsai_current

# Reload nginx
sudo systemctl reload nginx

# Final health check
log "🏥 Final health check..."
sleep 10
curl -f $HEALTH_CHECK_URL || (error "Final health check failed" && exit 1)

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "backup-*" -mtime +7 -exec rm -rf {} \;
find $BACKUP_DIR -name "db-backup-*.sql.gz" -mtime +7 -delete

log "✅ Production deployment completed successfully!"
notify "✅ Production deployment completed successfully!"
log "🌐 Application available at: https://app.workshopsai.com"
```

### Production Nginx Configuration
```nginx
# /etc/nginx/sites-available/workshopsai.com
upstream workshopsai_backend {
    least_conn;
    server 10.0.1.10:3001 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name workshopsai.com www.workshopsai.com;
    return 301 https://$server_name$request_uri;
}

# Main server block
server {
    listen 443 ssl http2;
    server_name workshopsai.com www.workshopsai.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/workshopsai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/workshopsai.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/workshopsai.com/chain.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.workshopsai.com; frame-src 'none';" always;

    # Frontend (static files)
    location / {
        root /var/www/workshopsai/frontend/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary Accept-Encoding;
        }

        # Cache HTML files
        location ~* \.html$ {
            expires 1h;
            add_header Cache-Control "public, must-revalidate";
        }
    }

    # Backend API
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://workshopsai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Authentication endpoints (stricter rate limiting)
    location /api/v1/auth/ {
        limit_req zone=auth burst=10 nodelay;

        proxy_pass http://workshopsai_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check (no rate limiting)
    location /health {
        proxy_pass http://workshopsai_backend/health;
        access_log off;
        proxy_set_header Host $host;
    }

    # File uploads
    location /uploads/ {
        alias /var/www/workshopsai/uploads/;
        expires 1y;
        add_header Cache-Control "public";
        add_header X-Content-Type-Options nosniff;

        # Security for uploaded files
        location ~* \.(php|jsp|asp|sh|py)$ {
            deny all;
        }
    }

    # Websockets (if applicable)
    location /socket.io/ {
        proxy_pass http://workshopsai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Block access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ ~$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

---

## 🐳 Docker Deployment

### Production Dockerfile
```dockerfile
# Dockerfile.production
# Multi-stage build for production optimization

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install build dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S workshopsai -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=workshopsai:nodejs /app/dist ./dist
COPY --from=builder --chown=workshopsai:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=workshopsai:nodejs /app/package.json ./package.json

# Create required directories
RUN mkdir -p /app/uploads /app/logs && \
    chown -R workshopsai:nodejs /app

# Switch to non-root user
USER workshopsai

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### Frontend Dockerfile
```dockerfile
# frontend/Dockerfile.production
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose Production
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.production
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://workshopsai:${DB_PASSWORD}@db:5432/workshopsai_cms
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "3001:3001"
    volumes:
      - uploads:/app/uploads
      - logs:/app/logs
    depends_on:
      - db
      - redis
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.production
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - app

  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=workshopsai_cms
      - POSTGRES_USER=workshopsai
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U workshopsai"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/ssl:ro
      - uploads:/var/www/uploads:ro
    depends_on:
      - app
      - frontend

volumes:
  postgres_data:
  redis_data:
  uploads:
  logs:
```

### Docker Deployment Commands
```bash
# Build and deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Scale application
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# Update deployment
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Backup volumes
docker run --rm -v workshopsai_cms_postgres_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/postgres-$(date +%Y%m%d).tar.gz -C /data .
```

---

## 🗄️ Database Management

### Database Setup
```bash
# Create production database
sudo -u postgres createuser workshopsai
sudo -u postgres createdb workshopsai_cms -O workshopsai

# Set password
sudo -u postgres psql -c "ALTER USER workshopsai PASSWORD 'secure_password';"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE workshopsai_cms TO workshopsai;"

# Enable extensions
sudo -u postgres psql -d workshopsai_cms -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
sudo -u postgres psql -d workshopsai_cms -c "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";"
```

### Database Migrations
```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Check migration status
npm run db:migrate:status

# Rollback migration (if needed)
npm run db:migrate:rollback

# Reset database (development only)
npm run db:migrate:reset
```

### Database Backup
```bash
#!/bin/bash
# backup-database.sh

set -e

# Configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="workshopsai"
DB_NAME="workshopsai_cms"
BACKUP_DIR="/var/backups/workshopsai"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

echo "📦 Starting database backup..."

# Create backup
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h $DB_HOST \
  -p $DB_PORT \
  -U $DB_USER \
  -d $DB_NAME \
  --verbose \
  --clean \
  --if-exists \
  --format=custom \
  --compress=9 \
  --file=$BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

echo "✅ Database backup completed: ${BACKUP_FILE}.gz"

# Cleanup old backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "🧹 Cleaned up backups older than $RETENTION_DAYS days"
```

### Database Restore
```bash
#!/bin/bash
# restore-database.sh

set -e

# Check arguments
if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 /var/backups/workshopsai/db_backup_20251117_120000.sql.gz"
    exit 1
fi

BACKUP_FILE=$1
DB_NAME="workshopsai_cms"
DB_USER="workshopsai"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Starting database restore..."

# Create backup of current database
CURRENT_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CURRENT_BACKUP="/var/backups/workshopsai/current_backup_$CURRENT_TIMESTAMP.sql"

PGPASSWORD=$DB_PASSWORD pg_dump \
  -h localhost \
  -U $DB_USER \
  -d $DB_NAME \
  --format=custom \
  --compress=9 \
  --file=$CURRENT_BACKUP

echo "📦 Created current database backup: $CURRENT_BACKUP"

# Drop and recreate database
PGPASSWORD=$DB_PASSWORD dropdb -h localhost -U $DB_USER $DB_NAME
PGPASSWORD=$DB_PASSWORD createdb -h localhost -U $DB_USER $DB_NAME

# Restore from backup
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c $BACKUP_FILE | PGPASSWORD=$DB_PASSWORD pg_restore \
        -h localhost \
        -U $DB_USER \
        -d $DB_NAME \
        --verbose \
        --clean \
        --if-exists
else
    PGPASSWORD=$DB_PASSWORD pg_restore \
        -h localhost \
        -U $DB_USER \
        -d $DB_NAME \
        --verbose \
        --clean \
        --if-exists \
        $BACKUP_FILE
fi

echo "✅ Database restore completed successfully!"
```

---

## 📊 Monitoring & Logging

### Application Monitoring Setup
```typescript
// src/monitoring/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Create metrics
export const httpRequestsTotal = new Counter({
  name: 'workshopai_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const httpRequestDuration = new Histogram({
  name: 'workshopai_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

export const activeUsers = new Gauge({
  name: 'workshopai_active_users',
  help: 'Number of active users'
});

export const databaseConnections = new Gauge({
  name: 'workshopai_database_connections',
  help: 'Number of active database connections'
});

export const cacheHitRate = new Gauge({
  name: 'workshopai_cache_hit_rate',
  help: 'Cache hit rate as percentage'
});
```

### Health Check Implementation
```typescript
// src/health/healthCheck.ts
export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    storage: ServiceHealth;
  };
  metrics: {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
  };
}

export interface ServiceHealth {
  status: 'ok' | 'error';
  responseTime?: number;
  error?: string;
}

export class HealthChecker {
  async checkHealth(): Promise<HealthStatus> {
    const startTime = Date.now();

    const [databaseHealth, redisHealth, storageHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage()
    ]);

    const overallStatus = [
      databaseHealth.status,
      redisHealth.status,
      storageHealth.status
    ].every(status => status === 'ok') ? 'ok' : 'error';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: databaseHealth,
        redis: redisHealth,
        storage: storageHealth
      },
      metrics: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await db.select().from(workshops).limit(1);
      return {
        status: 'ok',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await redis.ping();
      return {
        status: 'ok',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkStorage(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Check if upload directory is accessible
      await fs.access(process.env.UPLOAD_DIR || './uploads', fs.constants.W_OK);
      return {
        status: 'ok',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

### Logging Configuration
```typescript
// src/config/logger.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'workshopsai-cms' },
  transports: [
    // Error log file
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),

    // Combined log file
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),

    // Access log file
    new DailyRotateFile({
      filename: 'logs/access-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
```

### Monitoring Dashboard
```yaml
# monitoring/docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'

volumes:
  prometheus_data:
  grafana_data:
```

---

## 🔒 Security Configuration

### SSL/TLS Configuration
```bash
# Install Let's Encrypt certificates
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d workshopsai.com -d www.workshopsai.com

# Auto-renewal (cron job)
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Security Headers Configuration
```nginx
# Add to nginx configuration
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:;" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### Firewall Configuration
```bash
# UFW (Uncomplicated Firewall) setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 💾 Backup & Recovery

### Automated Backup Script
```bash
#!/bin/bash
# backup-all.sh

set -e

BACKUP_DIR="/var/backups/workshopsai"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

echo "🔄 Starting full system backup..."

# Database backup
echo "📦 Backing up database..."
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  --format=custom \
  --compress=9 \
  --file=$BACKUP_DIR/db_backup_$DATE.sql

# Application files backup
echo "📦 Backing up application files..."
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz \
  /var/www/workshopsai \
  --exclude=node_modules \
  --exclude=logs \
  --exclude=uploads

# Uploads backup
echo "📦 Backing up uploads..."
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz \
  /var/www/workshopsai/uploads

# Configuration backup
echo "📦 Backing up configurations..."
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz \
  /etc/nginx/sites-available/workshopsai.com \
  /etc/systemd/system/workshopsai.service \
  /var/www/workshopsai/.env.production

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "✅ Backup completed successfully!"
echo "📁 Backup location: $BACKUP_DIR"
```

### Disaster Recovery Plan
```bash
#!/bin/bash
# disaster-recovery.sh

set -e

BACKUP_DIR="/var/backups/workshopsai"
RECOVERY_DATE=$1

if [ -z "$RECOVERY_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Example: $0 20251117"
    exit 1
fi

echo "🚨 Starting disaster recovery for backup date: $RECOVERY_DATE"

# Stop services
echo "⏹️ Stopping services..."
sudo systemctl stop workshopsai
sudo systemctl stop nginx

# Recover database
echo "🗄️ Recovering database..."
sudo -u postgres dropdb workshopsai_cms
sudo -u postgres createdb workshopsai_cms
sudo -u postgres psql -d workshopsai_cms < $BACKUP_DIR/db_backup_${RECOVERY_DATE}_*.sql

# Recover application files
echo "📁 Recovering application files..."
sudo rm -rf /var/www/workshopsai
sudo tar -xzf $BACKUP_DIR/app_backup_${RECOVERY_DATE}.tar.gz -C /

# Recover uploads
echo "📁 Recovering uploads..."
sudo rm -rf /var/www/workshopsai/uploads
sudo tar -xzf $BACKUP_DIR/uploads_backup_${RECOVERY_DATE}.tar.gz -C /

# Recover configuration
echo "⚙️ Recovering configuration..."
sudo tar -xzf $BACKUP_DIR/config_backup_${RECOVERY_DATE}.tar.gz -C /

# Restart services
echo "▶️ Restarting services..."
sudo systemctl start workshopsai
sudo systemctl start nginx

echo "✅ Disaster recovery completed successfully!"
```

---

## 📈 Scaling & Performance

### Horizontal Scaling
```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.production
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.scale.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app
```

### Performance Tuning
```typescript
// Connection pooling configuration
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection pooling
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxMemoryPolicy: 'allkeys-lru',
});
```

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Database Connection Issues
```bash
# Check database connectivity
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Check connection pool
ps aux | grep postgres
```

#### Application Not Starting
```bash
# Check application logs
sudo journalctl -u workshopsai -f

# Check configuration
cat /var/www/workshopsai/.env.production

# Check permissions
ls -la /var/www/workshopsai/
```

#### High Memory Usage
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Check Node.js process
sudo kill -USR2 $(pgrep node)  # Get heap snapshot

# Monitor in detail
htop
iotop
```

#### Performance Issues
```bash
# Check database queries
sudo -u postgres psql -d $DB_NAME -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check slow queries
sudo tail -f /var/log/postgresql/postgresql-15-slow.log

# Profile application
node --inspect dist/index.js
```

---

**Document Status**: ✅ **PRODUCTION READY**
**Last Updated**: November 17, 2025
**Next Review**: February 17, 2026
**Maintained By**: DevOps Team

For deployment support or questions, please contact the DevOps team or create an issue in the project repository.