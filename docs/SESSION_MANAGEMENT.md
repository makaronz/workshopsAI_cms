# PostgreSQL Session Management System

This document describes the PostgreSQL-based session management system that replaces Redis for storing and managing user sessions.

## Overview

The session management system provides:
- **Secure session persistence** in PostgreSQL
- **Refresh token rotation** for enhanced security
- **Multi-device session management**
- **Anomaly detection and security monitoring**
- **GDPR compliance features**
- **Session analytics and reporting**
- **Automatic cleanup and maintenance**

## Architecture

### Core Components

1. **SessionService** (`src/services/sessionService.ts`)
   - Core session management functionality
   - Session creation, validation, and revocation
   - Token rotation and refresh logic
   - Security anomaly detection

2. **SessionMiddleware** (`src/middleware/sessionMiddleware.ts`)
   - Express.js middleware integration
   - Authentication and authorization
   - Automatic token refresh
   - Session-based rate limiting

3. **SessionAnalyticsService** (`src/services/sessionAnalyticsService.ts`)
   - Real-time session monitoring
   - Security alerts and reporting
   - User session history
   - Compliance data export

4. **Database Schema** (`src/models/postgresql-schema.ts`)
   - `user_sessions` table - stores all session data
   - `session_audit_logs` table - tracks session activities

## Database Schema

### user_sessions Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| session_id | TEXT | Unique session identifier |
| access_token_hash | TEXT | Hashed access token |
| refresh_token_hash | TEXT | Hashed refresh token |
| refresh_token_id | TEXT | Unique refresh token ID |
| status | ENUM | active, expired, revoked, suspicious |
| session_type | ENUM | web, mobile, api, desktop |
| ip_address | TEXT | Client IP address |
| user_agent | TEXT | Client user agent |
| device_fingerprint | TEXT | Unique device identifier |
| location | JSONB | Geographic location data |
| is_active | BOOLEAN | Session status flag |
| last_accessed_at | TIMESTAMP | Last activity timestamp |
| expires_at | TIMESTAMP | Session expiration |
| absolute_expires_at | TIMESTAMP | Absolute expiration |
| login_at | TIMESTAMP | Login timestamp |
| logout_at | TIMESTAMP | Logout timestamp |
| revoked_at | TIMESTAMP | Revocation timestamp |
| revoked_reason | TEXT | Reason for revocation |
| suspicious_activities | JSONB | Array of suspicious events |
| risk_score | DECIMAL | Calculated risk score (0-10) |
| metadata | JSONB | Additional session data |

### session_audit_logs Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | Foreign key to user_sessions |
| user_id | UUID | Foreign key to users |
| action | TEXT | Action type |
| details | JSONB | Action details |
| ip_address | TEXT | Client IP |
| user_agent | TEXT | Client user agent |
| timestamp | TIMESTAMP | Action timestamp |

## Installation & Setup

### 1. Database Migration

Run the SQL migration to create the session tables:

```bash
# Using psql
psql $DATABASE_URL -f migrations/add_session_tables.sql

# Or using Drizzle
npm run db:migrate
```

### 2. Update Environment Variables

Add/update these environment variables in your `.env` file:

```env
# Session Configuration
SESSION_MAX_AGE=86400000              # 24 hours
REFRESH_TOKEN_EXPIRES_IN=604800      # 7 days
MAX_CONCURRENT_SESSIONS=5
INACTIVITY_TIMEOUT=86400             # 24 hours

# Security
ANOMALY_DETECTION_ENABLED=true
SESSION_CLEANUP_INTERVAL=3600000     # 1 hour
RISK_SCORE_HIGH_THRESHOLD=7
RISK_SCORE_CRITICAL_THRESHOLD=9
```

### 3. Update Application Code

Replace Redis-based session management with PostgreSQL:

```typescript
// Old code (Redis)
import { redisService } from './config/redis';

// New code (PostgreSQL)
import SessionService from './services/sessionService';
import { authenticateSession } from './middleware/sessionMiddleware';

// In your routes
app.use('/api/v1/protected', authenticateSession());
```

### 4. Migration from Redis (if applicable)

If you have existing sessions in Redis, migrate them:

```bash
# Dry run validation
npm run session:migrate:validate

# Migrate sessions (without deleting from Redis)
npm run session:migrate

# Migrate and delete from Redis
DELETE_REDIS_AFTER_MIGRATION=true npm run session:migrate

# Rollback if needed
npm run session:migrate:rollback
```

## Usage Examples

### Creating a Session

```typescript
import SessionService from './services/sessionService';

// Create session for user
const session = await SessionService.createSession(
  userId,
  req,
  {
    sessionType: 'web',
    rememberMe: true,
    deviceInfo: {
      browser: 'Chrome',
      os: 'Windows',
      device: 'Desktop',
      language: 'en-US',
      timezone: 'UTC',
    }
  }
);
```

### Validating a Session

```typescript
// Using middleware
app.get('/api/profile', authenticateSession(), (req, res) => {
  // req.session contains session data
  // req.user contains user data
});

// Manual validation
const session = await SessionService.validateSession(accessToken);
if (session) {
  // Session is valid
}
```

### Refreshing Tokens

```typescript
const newTokens = await SessionService.refreshAccessToken(
  refreshToken,
  req
);
```

### Managing Sessions

```typescript
// Get all user sessions
const sessions = await SessionService.getUserSessions(userId);

// Revoke specific session
await SessionService.revokeSession(sessionId, 'user_logout');

// Revoke all user sessions
await SessionService.revokeAllUserSessions(userId, 'security_alert');
```

### Session Analytics

```typescript
import SessionAnalyticsService from './services/sessionAnalyticsService';

// Get real-time metrics
const metrics = await SessionAnalyticsService.getRealTimeMetrics();

// Get security alerts
const alerts = await SessionAnalyticsService.getSecurityAlerts();

// Generate session report
const report = await SessionAnalyticsService.generateSessionReport(
  startDate,
  endDate,
  userId
);
```

## Security Features

### 1. Token Rotation

- Access tokens expire after 15 minutes
- Refresh tokens are rotated on each use
- Old tokens are immediately invalidated

### 2. Anomaly Detection

The system detects and flags:
- IP address changes
- User agent changes
- Device fingerprint changes
- Impossible travel scenarios
- Unusual access patterns

### 3. Rate Limiting

- Per-session rate limiting
- Failed login attempt tracking
- IP-based blocking for brute force attacks

### 4. Device Fingerprinting

- Unique device identification
- Cross-session tracking
- Suspicious device detection

### 5. GDPR Compliance

- Right to be forgotten
- Data export capabilities
- Automatic data cleanup
- Audit logging

## Configuration Options

### SessionService Configuration

```typescript
const SESSION_CONFIG = {
  accessTokenExpiry: 15 * 60,        // 15 minutes
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
  absoluteSessionExpiry: 30 * 24 * 60 * 60, // 30 days
  maxConcurrentSessions: 5,
  sessionCleanupInterval: 60 * 60 * 1000, // 1 hour
  inactivityTimeout: 24 * 60 * 60,       // 24 hours
  anomalyThreshold: 3,
};
```

### Middleware Options

```typescript
// Authentication middleware
app.use(authenticateSession({
  required: true,           // Require authentication
  refreshToken: true,      // Attempt token refresh
  checkSuspicious: true,   // Check for anomalies
}));

// Rate limiting
app.use(sessionRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,         // Max requests per window
}));

// Concurrent session limit
app.use(checkConcurrentSessions(5));
```

## Monitoring & Maintenance

### Automated Cleanup

Sessions are automatically cleaned up:
- Expired sessions marked as 'expired'
- Old audit logs deleted after retention period
- Suspicious sessions automatically revoked

### Health Checks

Monitor session system health:

```typescript
// Check active sessions
const activeCount = await db
  .select({ count: sql`count(*)` })
  .from(userSessions)
  .where(eq(userSessions.status, 'active'));

// Check suspicious activities
const suspiciousCount = await db
  .select({ count: sql`count(*)` })
  .from(userSessions)
  .where(eq(userSessions.status, 'suspicious'));
```

### Performance Optimization

- Database indexes on frequently queried columns
- Batch operations for cleanup
- Connection pooling
- Query optimization for analytics

## Testing

### Unit Tests

```bash
# Run session service tests
npm test -- tests/unit/sessionService.test.ts

# Run middleware tests
npm test -- tests/unit/sessionMiddleware.test.ts
```

### Integration Tests

```bash
# Run full session flow tests
npm run test:integration
```

### Load Testing

```bash
# Test session performance
npm run test:load
```

## Troubleshooting

### Common Issues

1. **Session Not Found**
   - Check session expiration
   - Verify database connection
   - Check session status

2. **High Memory Usage**
   - Review cleanup interval
   - Check for memory leaks
   - Optimize queries

3. **Performance Issues**
   - Check database indexes
   - Review query patterns
   - Monitor connection pool

### Debug Mode

Enable debug logging:

```env
DEBUG=session:*
NODE_ENV=development
```

## API Reference

### SessionService Methods

| Method | Description |
|--------|-------------|
| `createSession()` | Create new session |
| `validateSession()` | Validate session token |
| `refreshAccessToken()` | Refresh access token |
| `revokeSession()` | Revoke specific session |
| `revokeAllUserSessions()` | Revoke all user sessions |
| `getUserSessions()` | Get user's sessions |
| `cleanupExpiredSessions()` | Clean up old sessions |
| `deleteUserSessions()` | GDPR compliance delete |

### SessionAnalyticsService Methods

| Method | Description |
|--------|-------------|
| `getRealTimeMetrics()` | Get current session metrics |
| `getSessionTrends()` | Get session trends over time |
| `getSecurityAlerts()` | Get security alerts |
| `generateSessionReport()` | Generate session report |
| `getUserSessionHistory()` | Get user's session history |
| `exportUserData()` | Export user data (GDPR) |
| `cleanupOldData()` | Clean up old data |

## Migration Guide

### From Redis to PostgreSQL

1. **Preparation**
   - Backup your Redis data
   - Schedule maintenance window
   - Test migration in staging

2. **Migration Steps**
   ```bash
   # 1. Validate Redis connection
   npm run session:migrate:validate

   # 2. Run migration
   npm run session:migrate

   # 3. Update application code
   # 4. Deploy new version
   # 5. Verify functionality

   # 6. Clean up Redis
   DELETE_REDIS_AFTER_MIGRATION=true npm run session:migrate
   ```

3. **Rollback Plan**
   - Keep Redis running during migration
   - Backup database before migration
   - Have rollback script ready
   - Monitor for issues

## Best Practices

### Security

1. Always use HTTPS for session tokens
2. Implement proper CORS configuration
3. Use secure, HTTP-only cookies for refresh tokens
4. Regularly rotate secrets
5. Monitor for suspicious activity

### Performance

1. Use connection pooling
2. Implement proper indexing
3. Cache frequently accessed data
4. Batch database operations
5. Monitor query performance

### Compliance

1. Log all session activities
2. Implement data retention policies
3. Provide data export capabilities
4. Honor deletion requests
5. Conduct regular security audits

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review the code documentation
3. Check existing GitHub issues
4. Create a new issue with detailed information

## License

This session management system is part of the workshopsAI CMS and follows the same license terms.