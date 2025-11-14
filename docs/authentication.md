# Authentication System Documentation

## Overview

The workshopsAI CMS implements a comprehensive JWT-based authentication system with role-based access control, session management, and GDPR compliance. This system provides secure user authentication, authorization, and audit logging capabilities.

## Architecture

### Core Components

1. **JWT Service** (`src/services/authService.ts`)
   - Token generation and validation
   - Password hashing and verification
   - User management operations
   - Audit logging and consent tracking

2. **Redis Service** (`src/config/redis.ts`)
   - Refresh token storage and management
   - Session data storage
   - Rate limiting for authentication attempts
   - Password reset token management

3. **Authentication Middleware** (`src/middleware/authMiddleware.ts`)
   - Request authentication and authorization
   - Role-based access control
   - Session validation
   - Optional authentication support

4. **Authentication Routes** (`src/routes/auth.ts`)
   - Login, logout, registration endpoints
   - Token refresh functionality
   - Password management
   - User session management

## Security Features

### JWT Token Configuration

- **Access Tokens**: 15-minute expiration, used for API access
- **Refresh Tokens**: 7-day expiration, stored in Redis for secure rotation
- **Stateless Design**: Access tokens contain all necessary user information
- **Token Rotation**: Refresh tokens are rotated and tracked for security

### Password Security

- **Hashing**: bcrypt with 12 salt rounds
- **Strength Requirements**: Minimum 8 characters with complexity requirements
- **Secure Storage**: Only hashed passwords stored in database

### Rate Limiting

- **Authentication Attempts**: 5 failed attempts per 15 minutes
- **API Rate Limiting**: 100 requests per 15 minutes per IP
- **User-based Limiting**: Customizable limits per user role

### Session Management

- **Redis Storage**: All session data stored in Redis for scalability
- **Session Tracking**: Device and IP address tracking
- **Multi-device Support**: Users can maintain multiple active sessions
- **Secure Logout**: Complete session invalidation on logout

## API Endpoints

### Authentication

#### `POST /api/v1/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!",
  "role": "participant",
  "agreeToTerms": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "participant",
      "emailVerified": false
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token",
      "expiresIn": 900,
      "tokenType": "Bearer"
    },
    "sessionId": "session-uuid"
  }
}
```

#### `POST /api/v1/auth/login`
Authenticate user with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "rememberMe": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "participant",
      "emailVerified": false,
      "lastLoginAt": "2024-01-01T12:00:00Z"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token",
      "expiresIn": 900,
      "tokenType": "Bearer"
    },
    "sessionId": "session-uuid"
  }
}
```

#### `POST /api/v1/auth/refresh`
Refresh an expired access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "new-jwt-token",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

#### `POST /api/v1/auth/logout`
Logout user and invalidate current session.

**Request Body:**
```json
{
  "refreshToken": "refresh-token",
  "sessionId": "session-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### `POST /api/v1/auth/logout-all`
Logout user from all devices and invalidate all sessions.

**Headers:** `Authorization: Bearer <access-token>`

**Response:**
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

### User Management

#### `GET /api/v1/auth/me`
Get current user information.

**Headers:** `Authorization: Bearer <access-token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "participant",
    "emailVerified": true,
    "isActive": true,
    "lastLoginAt": "2024-01-01T12:00:00Z",
    "createdAt": "2024-01-01T10:00:00Z"
  }
}
```

#### `GET /api/v1/auth/sessions`
Get all active sessions for the current user.

**Headers:** `Authorization: Bearer <access-token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "userId": "uuid",
        "deviceInfo": "desktop",
        "ipAddress": "192.168.1.1",
        "createdAt": "2024-01-01T12:00:00Z",
        "lastUsed": "2024-01-01T12:30:00Z"
      }
    ],
    "count": 1
  }
}
```

#### `POST /api/v1/auth/change-password`
Change user password.

**Headers:** `Authorization: Bearer <access-token>`

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully. Please login again."
}
```

## User Roles and Permissions

### Role Hierarchy

1. **Admin**: Full system access
2. **Sociologist-Editor**: Content management and analytics
3. **Moderator**: User and content moderation
4. **Facilitator**: Workshop management
5. **Participant**: Basic user access

### Permission System

Each role has specific permissions:

```typescript
export const ROLE_PERMISSIONS = {
  participant: [
    "read:own-profile",
    "read:workshops",
    "create:enrollment",
    "read:own-enrollments",
    "create:feedback",
    "create:questionnaire-response"
  ],
  facilitator: [
    "read:own-profile",
    "read:workshops",
    "read:own-workshops",
    "update:own-workshops",
    "read:enrollments",
    "read:feedback",
    "read:questionnaires",
    "create:announcements"
  ],
  moderator: [
    "read:all-profiles",
    "read:workshops",
    "create:workshops",
    "update:workshops",
    "read:enrollments",
    "update:enrollments",
    "manage:feedback",
    "manage:questionnaires"
  ],
  "sociologist-editor": [
    "read:all-profiles",
    "create:workshops",
    "read:workshops",
    "update:workshops",
    "delete:workshops",
    "read:enrollments",
    "manage:facilitators",
    "read:facilitators",
    "read:feedback",
    "manage:questionnaires",
    "create:llm-analysis",
    "read:analytics"
  ],
  admin: ["*"] // All permissions
};
```

### Middleware Usage

```typescript
// Require authentication
import { authenticate } from '../middleware/authMiddleware';
router.get('/protected', authenticate, handler);

// Require specific role
import { requireRole } from '../middleware/authMiddleware';
router.get('/admin-only', authenticate, requireRole('admin'), handler);

// Require specific permission
import { authorize } from '../middleware/authMiddleware';
router.post('/workshops', authenticate, authorize('create:workshops'), handler);

// Require resource ownership or admin
import { requireOwnerOrAdmin } from '../middleware/authMiddleware';
router.put('/workshops/:id', authenticate,
  requireOwnerOrAdmin(async (req) => {
    const workshop = await getWorkshop(req.params.id);
    return workshop?.createdBy;
  }),
  handler
);
```

## GDPR Compliance

### Audit Logging

All authentication events are logged to the `audit_logs` table:

- User login/logout events
- Token refresh operations
- Password changes
- Failed authentication attempts
- Consent tracking

### Consent Tracking

User consent is tracked for:

- **Terms and Conditions**: Required for registration
- **Session Tracking**: Recorded for each login session
- **Data Processing**: Configurable per-feature consent

### Data Protection

- **Password Hashing**: Strong bcrypt hashing
- **Token Security**: Secure JWT implementation
- **Session Isolation**: Redis-based session storage
- **Audit Trail**: Complete audit log for all operations

## Environment Configuration

Required environment variables:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
REFRESH_TOKEN_SECRET=your-refresh-secret-key

# Password Security
SALT_ROUNDS=12

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_TTL=604800  # 7 days in seconds

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## Security Best Practices

### Implementation Guidelines

1. **Never log passwords or tokens**
2. **Use HTTPS in production**
3. **Implement proper CORS configuration**
4. **Regular security audits and penetration testing**
5. **Monitor authentication logs for suspicious activity**
6. **Implement account lockout policies**
7. **Use secure cookie settings for refresh tokens**

### Monitoring and Alerting

Monitor these security metrics:

- Failed authentication attempts per IP
- Unusual login patterns
- Token refresh frequency
- Password change requests
- Concurrent session counts per user

## Error Handling

### Authentication Errors

- **401 Unauthorized**: Invalid or expired token
- **403 Forbidden**: Insufficient permissions
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: System errors

### Error Response Format

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Additional error context (optional)"
}
```

## Testing

The authentication system includes comprehensive tests covering:

- User registration and login flows
- Token refresh and validation
- Password management
- Session management
- Rate limiting
- Permission-based access control
- GDPR compliance features

Run tests with:
```bash
npm test -- tests/authentication.test.ts
```

## Integration Guide

### Frontend Integration

1. Store access token in memory (not localStorage)
2. Use refresh token rotation for persistent sessions
3. Implement automatic token refresh
4. Handle token expiration gracefully
5. Clear tokens on logout

### Example Frontend Implementation

```javascript
class AuthService {
  async login(email, password) {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (data.success) {
      this.setAccessToken(data.data.tokens.accessToken);
      this.setRefreshToken(data.data.tokens.refreshToken);
      return data.data.user;
    }
    throw new Error(data.message);
  }

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const data = await response.json();
    if (data.success) {
      this.setAccessToken(data.data.accessToken);
      return data.data.accessToken;
    }
    throw new Error(data.message);
  }
}
```

## Troubleshooting

### Common Issues

1. **Token Not Accepted**: Check token format and expiration
2. **Session Invalid**: Verify Redis connection and session storage
3. **Permission Denied**: Check user role and permission configuration
4. **Rate Limiting**: Verify rate limit configuration and IP tracking
5. **Database Connection**: Ensure PostgreSQL and Redis are accessible

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

This will enable detailed logging for authentication operations.