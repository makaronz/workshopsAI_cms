# PostgreSQL Migration Guide

## Overview

This document outlines the complete migration from MySQL to PostgreSQL for the WorkshopsAI CMS system. The migration includes enhanced GDPR compliance, RLS policies, vector search capabilities, and improved internationalization support.

## Migration Benefits

### ✅ **PostgreSQL 15+ Features**
- **Row Level Security (RLS)** for GDPR compliance
- **UUID primary keys** for better scalability
- **JSONB support** for flexible i18n data structures
- **Vector extensions** for AI/ML features
- **Advanced indexing** and query optimization
- **Full-text search** capabilities

### ✅ **GDPR Compliance Enhancements**
- **Comprehensive audit logging** with detailed tracking
- **Consent management** system with granular permissions
- **Data anonymization** functions for right to erasure
- **Data export** capabilities for data subject requests
- **Role-based access control** with fine-grained permissions

### ✅ **Enhanced Questionnaire System**
- **Advanced question types** with conditional logic
- **Multi-language support** with JSONB i18n fields
- **Real-time analytics** and response tracking
- **AI-powered analysis** with vector embeddings
- **Flexible validation** and dynamic form generation

## Migration Architecture

### Database Schema Changes

#### Core Tables Enhanced
1. **Users Table**
   - UUID primary keys (instead of integer auto-increment)
   - Soft delete support (`deleted_at` timestamp)
   - Enhanced role-based permissions

2. **Workshops Table**
   - JSONB i18n fields (`titleI18n`, `descriptionI18n`, etc.)
   - Soft delete support
   - Enhanced metadata and settings

3. **Questionnaires Table**
   - Advanced settings for GDPR compliance
   - Flexible configuration options
   - Status workflow management

#### New PostgreSQL-Specific Tables
1. **Consents Table** - GDPR consent tracking
2. **Audit Logs Table** - Comprehensive activity logging
3. **Vector Search Tables** - AI/ML functionality
4. **RAG Context Windows** - Advanced AI features

## Migration Process

### Phase 1: Preparation

#### 1. Environment Setup
```bash
# Ensure PostgreSQL 15+ is installed
psql --version

# Verify connection
psql "postgresql://user:password@localhost:5432/workshopsai_cms"
```

#### 2. Environment Variables
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=workshopsai_cms

# Application Configuration
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Phase 2: Migration Execution

#### 1. Automated Migration
```bash
# Execute complete migration
npm run db:migrate-postgres

# Execute with application testing
npm run db:migrate-postgres-test
```

#### 2. Manual Migration Steps
```bash
# 1. Create schema and RLS policies
psql "postgresql://user:password@localhost:5432/workshopsai_cms" -f migrations/001_initial_postgresql_schema.sql

# 2. Install vector extensions
psql "postgresql://user:password@localhost:5432/workshopsai_cms" -f migrations/003_vector_extensions.sql

# 3. Migrate data from MySQL (if applicable)
psql "postgresql://user:password@localhost:5432/workshopsai_cms" -f migrations/002_data_migration_mysql_to_postgresql.sql
```

### Phase 3: Validation

#### 1. Schema Validation
```bash
# Verify tables created
npm run db:validate

# Check RLS policies
npm run db:rls-check
```

#### 2. Data Integrity Checks
```sql
-- Check user migration
SELECT COUNT(*) as total_users FROM users;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check extensions
SELECT extname, extversion FROM pg_extension;
```

## RLS Policies Overview

### User Data Protection
```sql
-- Users can only access their own data
CREATE POLICY users_select_own ON users FOR SELECT
USING (id = current_setting('app.current_user_id', true)::uuid);

-- Admins can access all data
CREATE POLICY users_select_admin ON users FOR SELECT
USING (current_setting('app.is_admin', true)::boolean = true);
```

### GDPR Compliance Features
- **Right to Access**: Data export functions
- **Right to Erasure**: Anonymization functions
- **Consent Management**: Granular consent tracking
- **Audit Trail**: Complete activity logging

## Application Configuration Updates

### Database Configuration
```typescript
// Updated to use PostgreSQL
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../models/postgresql-schema";

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === "development",
});
```

### RLS Helper Functions
```typescript
// Set user context for RLS
await RLSHelper.setCurrentUser(userId, userRole, isAdmin);

// Create audit logs
await RLSHelper.createAuditLog(
  userId,
  tableName,
  recordId,
  operation,
  oldValues,
  newValues
);
```

## Post-Migration Tasks

### 1. Application Testing
```bash
# Test application startup
npm start

# Run test suite
npm test

# Check database connectivity
curl http://localhost:3001/health
```

### 2. Performance Optimization
```sql
-- Create vector indexes for large datasets
SELECT create_vector_index_if_needed();

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

### 3. Backup Strategy
```bash
# Create regular backups
npm run db:backup

# Automated backup script
crontab -e
# Add: 0 2 * * * cd /path/to/project && npm run db:backup
```

## Migration Commands Reference

### Available npm Scripts
```bash
# Database Operations
npm run db:generate          # Generate Drizzle migrations
npm run db:migrate           # Apply pending migrations
npm run db:studio            # Open Drizzle Studio
npm run db:backup            # Create database backup
npm run db:restore <file>    # Restore from backup
npm run db:validate          # Validate schema
npm run db:rls-check         # Check RLS policies

# Migration Scripts
npm run db:migrate-postgres           # Execute full migration
npm run db:migrate-postgres-test      # Execute with testing
```

### PostgreSQL CLI Commands
```bash
# Connect to database
psql "postgresql://user:password@localhost:5432/workshopsai_cms"

# Check database status
\l                    # List databases
\dt                   # List tables
\d users              # Describe table
\du                   # List users

# Monitor performance
SELECT * FROM pg_stat_activity;
SELECT * FROM pg_stat_user_tables;
```

## Troubleshooting

### Common Issues

#### 1. Connection Errors
```bash
# Check PostgreSQL service
sudo systemctl status postgresql

# Check port availability
netstat -an | grep 5432
```

#### 2. Migration Failures
```bash
# Check migration logs
cat migrations/migration.log

# Verify file permissions
ls -la migrations/

# Manual execution with error output
psql "postgresql://user:password@localhost:5432/workshopsai_cms" -f migrations/001_initial_postgresql_schema.sql -v
```

#### 3. RLS Policy Issues
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity FROM pg_tables;

-- Test RLS policies
SET app.current_user_id = 'user-uuid';
SET app.is_admin = 'false';
SELECT * FROM users;
```

## Performance Considerations

### Indexing Strategy
- **Partial indexes** for soft delete patterns
- **Composite indexes** for common query patterns
- **Vector indexes** for AI/ML features
- **GIN indexes** for JSONB fields

### Connection Pooling
```typescript
// Optimize connection pool
const client = postgres(connectionString, {
  max: 20,                    // Maximum connections
  idle_timeout: 30,           // Idle timeout
  connect_timeout: 10,        // Connection timeout
});
```

## Security Enhancements

### PostgreSQL Security
```sql
-- Create dedicated application user
CREATE USER workshopsai_app WITH PASSWORD 'secure_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE workshopsai_cms TO workshopsai_app;
GRANT USAGE ON SCHEMA public TO workshopsai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO workshopsai_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO workshopsai_app;
```

### SSL Configuration
```typescript
// Production SSL settings
const pgConfig = {
  ssl: {
    rejectUnauthorized: false,
    ca: process.env.DB_CA_CERT,
  },
};
```

## Monitoring and Maintenance

### Health Checks
```typescript
// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await client`SELECT 1 as health_check`;
    return result.length > 0;
  } catch (error) {
    console.error("PostgreSQL health check failed:", error);
    return false;
  }
}
```

### Regular Maintenance
```sql
-- Update table statistics
ANALYZE;

-- Clean up old audit logs (keep 1 year)
DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '1 year';

-- Rebuild indexes if needed
REINDEX INDEX CONCURRENTLY idx_users_email_active;
```

## Migration Validation Checklist

### ✅ Pre-Migration
- [ ] PostgreSQL 15+ installed and running
- [ ] Database credentials configured
- [ ] Backup strategy in place
- [ ] Migration scripts reviewed

### ✅ During Migration
- [ ] Schema created successfully
- [ ] RLS policies enabled
- [ ] Data migrated without errors
- [ ] Extensions installed

### ✅ Post-Migration
- [ ] Application starts successfully
- [ ] All API endpoints responding
- [ ] Database queries working
- [ ] RLS policies functioning
- [ ] Performance acceptable

### ✅ Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Load testing completed
- [ ] Security testing passed

## Support and Documentation

### Additional Resources
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [GDPR Compliance Guide](https://gdpr.eu/)

### Migration Support
- Review migration logs for errors
- Check PostgreSQL error logs
- Validate data integrity post-migration
- Monitor application performance

---

**Migration completed**: `2025-11-13`
**PostgreSQL Version**: `15+`
**Drizzle ORM Version**: `0.29.4+`
**GDPR Compliance**: `Enabled with RLS policies`