# PostgreSQL Database Migration Guide

## Overview

This document outlines the migration from MySQL 8.0 to PostgreSQL 15+ with Row-Level Security (RLS) for GDPR compliance. This is a critical production migration that must be executed with extreme care.

## Migration Checklist

### Pre-Migration Requirements

- [ ] Full database backup of MySQL database
- [ ] Test environment set up with PostgreSQL
- [ ] All application dependencies updated
- [ ] Migration scripts reviewed and tested
- [ ] Rollback procedures documented
- [ ] Maintenance window scheduled (minimum 4 hours)

### Migration Steps

1. **Prepare PostgreSQL Database**
   ```bash
   # Install PostgreSQL 15+
   # Create database and user
   createdb workshopsai_cms
   createuser workshopsai_postgres
   ```

2. **Update Application Dependencies**
   ```bash
   npm install postgres pg
   npm uninstall mysql2
   ```

3. **Update Database Configuration**
   - Update `.env` file with PostgreSQL connection details
   - Update database.ts to use postgresql-database.ts
   - Update drizzle.config.ts to use PostgreSQL dialect

4. **Execute Migration Scripts**
   ```bash
   # Step 1: Apply PostgreSQL schema
   psql -d workshopsai_cms -f migrations/001_initial_postgresql_schema.sql

   # Step 2: Migrate data from MySQL to PostgreSQL
   # (Requires both databases accessible)
   psql -d workshopsai_cms -f migrations/002_data_migration_mysql_to_postgresql.sql
   ```

5. **Update Application Code**
   - Import from `postgresql-schema.ts` instead of `schema.ts`
   - Update database connection to use `postgresql-database.ts`
   - Implement RLS context setting in authentication middleware

6. **Validate Migration**
   - Run data validation queries
   - Test all API endpoints
   - Verify RLS policies are working
   - Check GDPR compliance features

## Key Changes

### Schema Enhancements

1. **UUID Primary Keys**: All tables now use UUID primary keys instead of auto-increment integers
2. **i18n Support**: JSONB fields for internationalized content (`titleI18n`, `descriptionI18n`, etc.)
3. **Soft Deletes**: Added `deleted_at` columns for GDPR compliance
4. **GDPR Tables**: New `consents` and `audit_logs` tables for compliance
5. **Enhanced Indexes**: Optimized for PostgreSQL performance

### Row-Level Security (RLS)

PostgreSQL RLS policies implement the following access controls:

- **Users**: Can only read/update their own data
- **Sociologists**: Can manage their own workshops and view anonymized responses
- **Admins**: Full access to all data
- **Public**: Read-only access to published workshops

### GDPR Compliance Features

1. **Right to Erasure**: `anonymize_user_data()` function for user data deletion
2. **Data Portability**: `export_user_data()` function for data export
3. **Consent Management**: Comprehensive consent tracking
4. **Audit Logging**: Complete audit trail of all data operations

## Environment Variables

Update your `.env` file:

```env
# Database Configuration (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=workshopsai_cms
DATABASE_URL=postgresql://postgres:password@localhost:5432/workshopsai_cms

# Optional SSL for production
DB_SSL_MODE=require
```

## Application Code Changes

### Database Connection

```typescript
// Before (MySQL)
import { db } from "./config/database";

// After (PostgreSQL)
import { db, RLSHelper } from "./config/postgresql-database";
```

### Authentication Middleware

```typescript
// Set RLS context after JWT authentication
await RLSHelper.setCurrentUser(userId, userRole, isAdmin);
```

### API Response Format

Update response handlers to work with i18n content:

```typescript
// Before
return { title: workshop.title };

// After
return {
  title: workshop.titleI18n[locale] || workshop.titleI18n['pl']
};
```

## Testing

### Data Validation

Run these queries to validate migration:

```sql
-- Verify data integrity
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Workshops', COUNT(*) FROM workshops
UNION ALL
SELECT 'Enrollments', COUNT(*) FROM enrollments;

-- Check for orphaned records
SELECT COUNT(*) FROM enrollments e
LEFT JOIN workshops w ON e.workshopId = w.id
WHERE w.id IS NULL;
```

### RLS Policy Testing

```sql
-- Test user permissions
SET app.current_user_id = 'user-uuid-here';
SET app.current_user_role = 'participant';
SET app.is_admin = 'false';

-- Should return only user's own data
SELECT COUNT(*) FROM responses;
```

## Performance Considerations

### Indexing Strategy

- UUID indexes for primary keys
- Composite indexes for foreign key relationships
- Specialized indexes for common query patterns
- Partial indexes for RLS policy optimization

### Query Optimization

- Use JSONB operators for i18n content
- Implement materialized views for complex analytics
- Consider connection pooling (pgBouncer) for high traffic

## Monitoring

### Database Metrics

Monitor these PostgreSQL metrics:

- Connection pool usage
- Query execution times
- RLS policy overhead
- Table/index sizes

### Application Metrics

Track these application metrics:

- API response times
- Authentication success rates
- Data access patterns
- Error rates by operation

## Rollback Procedures

### Emergency Rollback

If critical issues arise:

1. **Stop Application**: Prevent new data writes
2. **Enable Compatibility Mode**: Run emergency rollback script
3. **Assess Data**: Check for any data corruption
4. **Plan Recovery**: Either fix PostgreSQL issues or restore MySQL

### Compatibility Mode

The rollback script creates MySQL-compatible views that allow the application to continue running while planning a full rollback.

## Security Considerations

### RLS Policy Security

- Policies use session variables for context
- Admin users have proper privilege escalation
- All data access is logged for audit trails

### Database Security

- Use SSL connections in production
- Implement proper connection limits
- Regular security updates for PostgreSQL
- Monitor for unusual access patterns

## Troubleshooting

### Common Issues

1. **UUID Conversion**: Ensure proper UUID handling in application code
2. **RLS Context**: Verify session variables are set correctly
3. **JSONB Queries**: Update query syntax for JSONB operations
4. **Performance**: Monitor query execution times and add indexes as needed

### Debug Tools

```sql
-- Check current RLS context
SELECT current_setting('app.current_user_id', true),
       current_setting('app.current_user_role', true),
       current_setting('app.is_admin', true);

-- Analyze slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Post-Migration Tasks

1. **Performance Tuning**: Monitor and optimize slow queries
2. **Backup Strategy**: Implement regular PostgreSQL backups
3. **Monitoring**: Set up database monitoring and alerting
4. **Documentation**: Update all documentation and runbooks
5. **Training**: Train team on PostgreSQL-specific features

## Support Contacts

- **Database Team**: database-team@company.com
- **Security Team**: security-team@company.com
- **DevOps Team**: devops-team@company.com

## Migration Timeline

- **Preparation**: 2 weeks
- **Migration Execution**: 4 hours (during maintenance window)
- **Validation**: 2 days
- **Monitoring**: 1 week intensive, then ongoing

---

**WARNING**: This is a production-critical migration. Test thoroughly in a staging environment before executing in production.