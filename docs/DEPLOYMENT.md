# Production Deployment Guide - workshopsAI CMS

This comprehensive guide covers the complete production deployment pipeline for the workshopsAI CMS platform.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Docker Configuration](#docker-configuration)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Environment Configuration](#environment-configuration)
7. [Deployment Process](#deployment-process)
8. [Monitoring & Observability](#monitoring--observability)
9. [Backup & Recovery](#backup--recovery)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)
12. [Maintenance](#maintenance)

## Overview

The workshopsAI CMS deployment pipeline includes:

- **Multi-stage Docker builds** for optimized production images
- **Infrastructure as Code** using Terraform
- **Automated CI/CD** with GitHub Actions
- **Container orchestration** with Docker Compose and Kubernetes
- **Comprehensive monitoring** with Prometheus and Grafana
- **Automated backups** and disaster recovery
- **Security scanning** and compliance checks

## Prerequisites

### Required Tools

```bash
# Version requirements
Docker >= 20.10
Docker Compose >= 2.0
Node.js >= 18.0
NPM >= 8.0
Terraform >= 1.3
kubectl >= 1.24
Helm >= 3.8
```

### Cloud Accounts

- **AWS Account** with appropriate IAM permissions
- **GitHub Account** with repository access
- **Domain** (optional, for custom domain configuration)

### Required Permissions

#### AWS IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "ecs:*",
        "ecr:*",
        "elasticache:*",
        "elasticloadbalancing:*",
        "iam:*",
        "logs:*",
        "monitoring:*",
        "rds:*",
        "route53:*",
        "s3:*",
        "sns:*",
        "vpc:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Infrastructure Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/workshopsai-cms.git
cd workshopsai-cms
```

### 2. Configure Environment Variables

Create `.env.deploy` file:

```bash
# Environment
ENVIRONMENT=production

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Infrastructure
ECR_REPOSITORY=workshopsai-cms
CLUSTER_NAME=workshopsai-cms-production
VPC_CIDR=10.0.0.0/16

# Database
DB_INSTANCE_CLASS=db.t3.medium
DB_ALLOCATED_STORAGE=100
DB_NAME=workshopsai_cms
DB_USER=workshopsai
DB_PASSWORD=your_secure_password

# Redis
REDIS_NODE_TYPE=cache.t3.small
REDIS_AUTH_TOKEN=your_redis_auth_token

# Application
APP_DESIRED_COUNT=3
APP_MIN_CAPACITY=2
APP_MAX_CAPACITY=10

# SSL & Domain
ENABLE_SSL=true
SSL_CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
DOMAIN_NAME=workshopsai.com

# Monitoring
ENABLE_MONITORING=true

# Backup
BACKUP_S3_BUCKET=workshopsai-backups
BACKUP_RETENTION_DAYS=30

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
NOTIFICATION_EMAIL=devops@workshopsai.com
```

### 3. Deploy Infrastructure with Terraform

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var-file="../terraform.tfvars"

# Apply configuration
terraform apply -var-file="../terraform.tfvars"
```

### 4. Create Kubernetes Resources (if using Kubernetes)

```bash
cd ../../kubernetes/base

# Apply base manifests
kubectl apply -f .

# Apply environment-specific overlay
kubectl apply -k ../overlays/production
```

## Docker Configuration

### Multi-stage Dockerfile

The Dockerfile uses multi-stage builds for optimized production images:

```dockerfile
# Stages:
# 1. base - System dependencies and user setup
# 2. development - Development dependencies and tools
# 3. builder - Build application and security scanning
# 4. production - Production-optimized image
# 5. security - Security scanning for CI/CD
# 6. test - Testing stage
```

### Building Images

```bash
# Development image
docker build --target development -t workshopsai/cms:dev .

# Production image
docker build --target production -t workshopsai/cms:latest .

# Security scan image
docker build --target security -t workshopsai/cms:security .

# Test image
docker build --target test -t workshopsai/cms:test .
```

### Docker Compose

#### Development Environment

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Include development tools
docker-compose -f docker-compose.dev.yml --profile tools up -d

# Include test environment
docker-compose -f docker-compose.dev.yml --profile test up -d
```

#### Production Environment

```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# Include monitoring stack
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Include backup service
docker-compose -f docker-compose.prod.yml --profile backup up -d
```

## CI/CD Pipeline

### GitHub Actions Workflows

#### Main CI/CD Pipeline (`.github/workflows/ci-cd.yml`)

**Triggered by:**
- Push to main/develop branches
- Pull requests
- Tag creation

**Pipeline Stages:**
1. **Quality Check**: TypeScript, ESLint, security audit
2. **Testing**: Unit tests, integration tests, coverage reports
3. **Build**: Docker image building and optimization
4. **Security Scanning**: Container security scanning
5. **Deploy**: Automated deployment to staging/production
6. **Performance Testing**: Load and performance tests
7. **Notifications**: Slack/email notifications

#### Security Pipeline (`.github/workflows/security.yml`)

**Triggered by:**
- Code changes
- Schedule (weekly)
- Manual dispatch

**Security Checks:**
- Dependency vulnerability scanning
- Static Application Security Testing (SAST)
- Container security scanning
- API security testing
- Compliance checks

### Pipeline Configuration

Configure repository secrets in GitHub:

```bash
# Required secrets
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
ECR_REPOSITORY
SLACK_WEBHOOK_URL
SNYK_TOKEN
SENTRY_DSN
```

## Environment Configuration

### Environment Variables

#### Core Application Configuration

```bash
# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
DB_HOST=localhost
DB_PORT=5432
DB_USER=workshopsai
DB_PASSWORD=secure_password
DB_NAME=workshopsai_cms

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Security
JWT_SECRET=your_jwt_secret_minimum_32_characters
SESSION_SECRET=your_session_secret
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGIN=https://workshopsai.com

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

#### External Services Configuration

```bash
# Email Service
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key

# Cloud Storage
STORAGE_DEFAULT_PROVIDER=aws-s3
AWS_S3_BUCKET=workshopsai-uploads
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret

# Monitoring
SENTRY_DSN=your_sentry_dsn
PROMETHEUS_PORT=9090

# Feature Flags
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_WAITING_LIST=true
```

## Deployment Process

### 1. Pre-deployment Checks

```bash
# Run automated deployment script
./scripts/deployment/deploy.sh

# Or manually run checks
npm run typecheck
npm run lint
npm run test
npm run security:audit
```

### 2. Database Migration

```bash
# Run migrations
npm run db:migrate

# Verify database schema
npm run db:validate
```

### 3. Application Deployment

```bash
# Deploy to staging
./scripts/deployment/deploy.sh staging

# Deploy to production
./scripts/deployment/deploy.sh production

# Rollback if needed
./scripts/deployment/deploy.sh rollback
```

### 4. Health Checks

```bash
# Check application health
curl -f https://workshopsai.com/health

# Check API health
curl -f https://workshopsai.com/api/health

# Check database connectivity
curl -f https://workshopsai.com/api/health/db
```

## Monitoring & Observability

### Prometheus Metrics

#### Application Metrics

```javascript
// Custom metrics in application
const client = require('prom-client');

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const activeUsers = new client.Gauge({
  name: 'active_users_total',
  help: 'Number of active users'
});
```

#### System Metrics

- **CPU Usage**: Container and node CPU utilization
- **Memory Usage**: Container memory consumption
- **Disk I/O**: Read/write operations and latency
- **Network I/O**: Network traffic and connections

#### Database Metrics

- **Connection Count**: Active database connections
- **Query Performance**: Query execution time
- **Replication Lag**: Database replication lag (if applicable)
- **Cache Hit Ratio**: Query cache effectiveness

### Grafana Dashboards

#### Pre-configured Dashboards

1. **Application Overview**
   - Request rate and error rate
   - Response time percentiles
   - Active users and sessions

2. **Infrastructure Health**
   - CPU and memory usage
   - Disk space and I/O
   - Network traffic

3. **Database Performance**
   - Connection pool status
   - Query performance
   - Replication status

4. **Business Metrics**
   - User registrations
   - Workshop enrollments
   - Revenue metrics

### Alerting

#### Critical Alerts

- **Application Down**: Service unavailable
- **High Error Rate**: >5% error rate for 5 minutes
- **Database Connection Failure**: Cannot connect to database
- **High Memory Usage**: >90% memory usage
- **High CPU Usage**: >90% CPU usage

#### Warning Alerts

- **Slow Response Time**: >2 seconds average response time
- **Database Slow Queries**: Queries taking >5 seconds
- **Disk Space Low**: <20% free disk space
- **Memory Usage High**: >80% memory usage

## Backup & Recovery

### Automated Backups

#### Database Backups

```bash
# Manual full backup
./scripts/deployment/backup.sh database

# Scheduled backups (via cron)
0 2 * * * /path/to/scripts/deployment/backup.sh full
```

#### File Storage Backups

```bash
# Backup files
./scripts/deployment/backup.sh files

# Backup configuration
./scripts/deployment/backup.sh configuration
```

### Disaster Recovery

#### Recovery Procedures

1. **Database Recovery**

```bash
# List available backups
aws s3 ls s3://workshopsai-backups/database/

# Restore from backup
aws s3 cp s3://workshopsai-backups/database/backup.sql.gz .
gunzip backup.sql.gz
psql -h localhost -U workshopsai -d workshopsai_cms < backup.sql
```

2. **File Recovery**

```bash
# Sync files from backup
aws s3 sync s3://workshopsai-backups/files/ /app/uploads/
```

3. **Configuration Recovery**

```bash
# Restore configuration
aws s3 cp s3://workshopsai-backups/configuration/latest.tar.gz .
tar -xzf latest.tar.gz
```

## Security

### Container Security

#### Security Scanning

```bash
# Scan Docker image for vulnerabilities
docker scan workshopsai/cms:latest

# Use Trivy for comprehensive scanning
trivy image workshopsai/cms:latest
```

#### Runtime Security

- **Non-root user**: Containers run as non-root user (UID 1001)
- **Read-only filesystem**: Root filesystem mounted read-only
- **Resource limits**: CPU and memory limits enforced
- **Seccomp profiles**: System call filtering enabled
- **AppArmor/SELinux**: Mandatory access control enabled

### Network Security

#### Firewall Rules

```bash
# AWS Security Groups
# - Allow HTTP (80) and HTTPS (443) from anywhere
# - Allow application traffic (3001) from load balancer
# - Allow database traffic (5432) from application
# - Allow Redis traffic (6379) from application
# - Deny all other traffic
```

#### SSL/TLS Configuration

```bash
# Enable SSL termination at load balancer
# Use strong cipher suites
# Implement HSTS headers
# Enable certificate pinning
```

### Secrets Management

#### Environment Variables

- **No hardcoded secrets**: Use environment variables
- **Encrypted storage**: Secrets stored in encrypted form
- **Rotation policies**: Regular secret rotation
- **Access controls**: Limited access to secrets

#### AWS Secrets Manager

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name workshopsai-cms/database \
  --secret-string '{"username":"workshopsai","password":"secure_password"}'

# Retrieve secrets in application
const secrets = await getSecret('workshopsai-cms/database');
```

## Troubleshooting

### Common Issues

#### Application Startup Failures

1. **Check logs**:
```bash
docker logs workshopsai-cms
kubectl logs deployment/workshopsai-cms
```

2. **Check health endpoint**:
```bash
curl -f http://localhost:3001/health
```

3. **Verify environment variables**:
```bash
docker exec workshopsai-cms env | grep DATABASE_URL
```

#### Database Connection Issues

1. **Test database connectivity**:
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

2. **Check connection pool**:
```bash
curl -f http://localhost:3001/api/health/db
```

#### Performance Issues

1. **Check resource usage**:
```bash
docker stats
kubectl top pods
```

2. **Analyze slow queries**:
```sql
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Debug Mode

Enable debug logging:

```bash
# Set log level to debug
export LOG_LEVEL=debug

# Enable verbose logging
export DEBUG=workshopsai:*
```

## Maintenance

### Regular Tasks

#### Daily

- **Monitor system health**: Check dashboards and alerts
- **Review logs**: Check for errors or warnings
- **Backup verification**: Ensure backups completed successfully

#### Weekly

- **Security updates**: Apply security patches
- **Performance review**: Analyze performance metrics
- **Capacity planning**: Review resource utilization

#### Monthly

- **Backup testing**: Test restore procedures
- **Security audit**: Run comprehensive security scan
- **Documentation updates**: Update documentation as needed

### Scaling Operations

#### Horizontal Scaling

```bash
# Scale deployment
kubectl scale deployment workshopsai-cms --replicas=5

# Update HPA configuration
kubectl edit hpa workshopsai-cms-hpa
```

#### Vertical Scaling

```bash
# Update resource requests
kubectl patch deployment workshopsai-cms -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"requests":{"memory":"512Mi","cpu":"500m"}}}]}}}}'
```

### Rolling Updates

```bash
# Perform rolling update
kubectl set image deployment/workshopsai-cms app=workshopsai/cms:v2.0.0

# Monitor update progress
kubectl rollout status deployment/workshopsai-cms

# Rollback if needed
kubectl rollout undo deployment/workshopsai-cms
```

## Support

### Getting Help

- **Documentation**: [GitHub Wiki](https://github.com/your-org/workshopsai-cms/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/workshopsai-cms/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/workshopsai-cms/discussions)
- **Email**: support@workshopsai.com

### Emergency Contacts

- **DevOps Team**: devops@workshopsai.com
- **Security Team**: security@workshopsai.com
- **On-call Engineer**: +1-555-XXX-XXXX

---

This guide covers the complete production deployment pipeline for workshopsAI CMS. For specific questions or issues, please refer to the troubleshooting section or contact the support team.