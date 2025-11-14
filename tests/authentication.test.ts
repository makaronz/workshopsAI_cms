import request from 'supertest';
import { app } from '../src/index';
import { AuthService } from '../src/services/authService';
import { redisService } from '../src/config/redis';
import { db } from '../src/config/postgresql-database';
import { users, auditLogs, consents } from '../src/models/postgresql-schema';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'TestPassword123!',
  role: 'participant' as const,
};

let createdUserId: string | null = null;
let authTokens: any = null;
let sessionId: string | null = null;

describe('Authentication API', () => {
  beforeAll(async () => {
    // Clean up any existing test user
    await cleanupTestUser();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestUser();
    await redisService.disconnect();
  });

  afterEach(async () => {
    // Clear rate limiting and auth attempts after each test
    await redisService.clearAuthAttempts(testUser.email, '127.0.0.1');
  });

  async function cleanupTestUser() {
    try {
      // Find and delete test user
      const existingUser = await AuthService.findUserByEmail(testUser.email);
      if (existingUser) {
        // Revoke all tokens first
        await redisService.revokeAllUserTokens(existingUser.id);

        // Delete from database (this will cascade to related tables)
        await db.delete(users).where(eq(users.email, testUser.email));
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          confirmPassword: testUser.password,
          agreeToTerms: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Registration successful');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.sessionId).toBeDefined();

      // Store created data for cleanup
      createdUserId = response.body.data.user.id;
      authTokens = response.body.data.tokens;
      sessionId = response.body.data.sessionId;

      // Verify user was created in database
      const user = await AuthService.findUserByEmail(testUser.email);
      expect(user).toBeTruthy();
      expect(user!.email).toBe(testUser.email.toLowerCase());
      expect(user!.name).toBe(testUser.name);
      expect(user!.role).toBe(testUser.role);
      expect(user!.isActive).toBe(true);
      expect(user!.emailVerified).toBe(false);

      // Verify refresh token is stored in Redis
      const tokenData = await redisService.getRefreshToken(user!.id, authTokens.refreshToken);
      expect(tokenData).toBeTruthy();
      expect(tokenData.userId).toBe(user!.id);

      // Verify session is stored
      const sessionData = await redisService.getSession(sessionId!);
      expect(sessionData).toBeTruthy();
      expect(sessionData.userId).toBe(user!.id);

      // Verify consent was recorded
      const consent = await db
        .select()
        .from(consents)
        .where(eq(consents.userId, user!.id))
        .limit(1);
      expect(consent.length).toBe(1);
      expect(consent[0].consentType).toBe('terms_and_conditions');
      expect(consent[0].granted).toBe(true);

      // Verify audit log was created
      const auditLog = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, user!.id))
        .limit(1);
      expect(auditLog.length).toBe(1);
      expect(auditLog[0].operation).toBe('LOGIN'); // Auto-login after registration
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email',
          confirmPassword: testUser.password,
          agreeToTerms: true,
        })
        .expect(400);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'test2@example.com',
          password: 'weak',
          confirmPassword: 'weak',
          agreeToTerms: true,
        })
        .expect(400);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject registration without agreeing to terms', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'test3@example.com',
          confirmPassword: testUser.password,
          agreeToTerms: false,
        })
        .expect(400);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject registration with existing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          confirmPassword: testUser.password,
          agreeToTerms: true,
        })
        .expect(409);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('User already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.sessionId).toBeDefined();

      // Verify tokens are properly formatted
      expect(response.body.data.tokens.accessToken).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
      expect(response.body.data.tokens.refreshToken).toMatch(/^[a-f0-9]{128}$/i);
      expect(response.body.data.tokens.expiresIn).toBe(900); // 15 minutes
      expect(response.body.data.tokens.tokenType).toBe('Bearer');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrong-password',
        })
        .expect(401);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('Authentication failed');
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('Authentication failed');
    });

    it('should handle rate limiting for failed attempts', async () => {
      // Make multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'wrong-password',
          });
      }

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(429);

      expect(response.body.error).toBe('Too many attempts');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: authTokens.refreshToken,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.expiresIn).toBe(900);
      expect(response.body.data.tokenType).toBe('Bearer');

      // Verify new access token is valid
      const payload = AuthService.verifyAccessToken(response.body.data.accessToken);
      expect(payload.userId).toBe(createdUserId);
      expect(payload.email).toBe(testUser.email.toLowerCase());
    });

    it('should reject refresh with invalid token format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token-format',
        })
        .expect(401);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject refresh with non-existent token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'a'.repeat(128), // Valid format but non-existent
        })
        .expect(401);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user information with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(createdUserId);
      expect(response.body.data.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.data.role).toBe(testUser.role);
      expect(response.body.data.emailVerified).toBe(false);
      expect(response.body.data.isActive).toBe(true);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('GET /api/v1/auth/sessions', () => {
    it('should return user sessions', async () => {
      const response = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);

      // Verify session data structure
      const sessions = response.body.data.sessions;
      expect(sessions[0]).toHaveProperty('userId');
      expect(sessions[0]).toHaveProperty('deviceInfo');
      expect(sessions[0]).toHaveProperty('ipAddress');
      expect(sessions[0]).toHaveProperty('createdAt');
      expect(sessions[0]).toHaveProperty('lastUsed');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout user and invalidate token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({
          refreshToken: authTokens.refreshToken,
          sessionId: sessionId!,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');

      // Verify refresh token is revoked
      const tokenData = await redisService.getRefreshToken(createdUserId!, authTokens.refreshToken);
      expect(tokenData).toBeNull();

      // Verify session is deleted
      const sessionData = await redisService.getSession(sessionId!);
      expect(sessionData).toBeNull();

      // Verify access token no longer works
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('should logout from all devices', async () => {
      // First login again to create a new session
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const newTokens = loginResponse.body.data.tokens;
      const newSessionId = loginResponse.body.data.sessionId;

      // Logout from all devices
      const response = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${newTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out from all devices successfully');

      // Verify all tokens are revoked
      const allTokens = await redisService.getUserTokens(createdUserId!);
      expect(allTokens).toHaveLength(0);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    const newPassword = 'NewPassword123!';

    beforeEach(async () => {
      // Login to get fresh token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      authTokens = loginResponse.body.data.tokens;
    });

    it('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: newPassword,
          confirmPassword: newPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully. Please login again.');

      // Verify old password no longer works
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(401);

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);

      // Update test user password for other tests
      testUser.password = newPassword;
    });

    it('should reject password change with wrong current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          currentPassword: 'wrong-password',
          newPassword: newPassword,
          confirmPassword: newPassword,
        })
        .expect(401);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('Invalid password');
    });

    it('should reject password change with mismatching confirmation', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: newPassword,
          confirmPassword: 'different-password',
        })
        .expect(400);

      expect(response.body.success).toBeFalsy();
      expect(response.body.error).toBe('Validation failed');
    });
  });
});

describe('Authentication Middleware', () => {
  let validToken: string;

  beforeAll(async () => {
    // Create a test user and get valid token
    const testUserForMiddleware = {
      name: 'Middleware Test User',
      email: 'middleware@example.com',
      password: 'TestPassword123!',
      role: 'participant' as const,
    };

    // Clean up any existing user
    try {
      const existingUser = await AuthService.findUserByEmail(testUserForMiddleware.email);
      if (existingUser) {
        await db.delete(users).where(eq(users.email, testUserForMiddleware.email));
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    // Create user and get token
    const user = await AuthService.createUser(testUserForMiddleware);
    const loginResult = await AuthService.login(
      testUserForMiddleware.email,
      testUserForMiddleware.password
    );
    validToken = loginResult.tokens.accessToken;

    // Cleanup after tests
    afterAll(async () => {
      try {
        await redisService.revokeAllUserTokens(user.id);
        await db.delete(users).where(eq(users.email, testUserForMiddleware.email));
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });

  it('should allow access with valid token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should reject access without token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .expect(401);

    expect(response.body.error).toBe('Authentication required');
  });

  it('should reject access with invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);

    expect(response.body.error).toBe('Invalid token');
  });

  it('should reject access with expired token', async () => {
    // Create a token that's already expired
    const expiredPayload = {
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'participant' as const,
      sessionId: 'test-session',
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    };

    const expiredToken = AuthService.generateAccessToken(expiredPayload);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    expect(response.body.error).toBe('Token expired');
  });
});