import request from 'supertest';
import { app } from '../../src/index';
import { generateTestData } from './test-data-factory';
import { User } from '../types';

/**
 * Authentication Helpers
 *
 * Provides utilities for authentication testing including
 * user creation, login, token management, and permission testing.
 */

export class AuthHelper {
  /**
   * Authenticate a user and return auth token
   */
  static async authenticateUser(
    requestContext: any,
    userOverrides: Partial<User> = {}
  ): Promise<{ user: User; token: string }> {
    // Create test user
    const userData = generateTestData('user', userOverrides);

    // Sign up the user
    const signupResponse = await requestContext(app)
      .post('/api/auth/signup')
      .send(userData);

    expect(signupResponse.status).toBe(201);

    // Login to get token
    const loginResponse = await requestContext(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    expect(loginResponse.status).toBe(200);

    return {
      user: userData,
      token: loginResponse.body.token
    };
  }

  /**
   * Create users with different roles for permission testing
   */
  static async createRoleBasedUsers(requestContext: any): Promise<{
    admin: { user: User; token: string };
    instructor: { user: User; token: string };
    participant: { user: User; token: string };
  }> {
    const admin = await this.authenticateUser(requestContext, { role: 'admin' });
    const instructor = await this.authenticateUser(requestContext, { role: 'instructor' });
    const participant = await this.authenticateUser(requestContext, { role: 'participant' });

    return { admin, instructor, participant };
  }

  /**
   * Test authentication middleware
   */
  static async testProtectedEndpoint(
    requestContext: any,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<void> {
    // Test without authentication
    let response = await requestContext(app)[method.toLowerCase() as keyof typeof requestContext](endpoint)
      .send(data || {});

    expect(response.status).toBe(401);
    expect(response.body.error.message).toContain('Unauthorized');

    // Test with invalid token
    response = await requestContext(app)[method.toLowerCase() as keyof typeof requestContext](endpoint)
      .set('Authorization', 'Bearer invalid-token')
      .send(data || {});

    expect(response.status).toBe(401);
    expect(response.body.error.message).toContain('Invalid token');

    // Test with expired token (mock expired token)
    const expiredToken = this.generateExpiredToken();
    response = await requestContext(app)[method.toLowerCase() as keyof typeof requestContext](endpoint)
      .set('Authorization', `Bearer ${expiredToken}`)
      .send(data || {});

    expect(response.status).toBe(401);
    expect(response.body.error.message).toContain('Token expired');
  }

  /**
   * Test role-based access control
   */
  static async testRoleBasedAccess(
    requestContext: any,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    expectedAllowedRoles: string[] = ['admin', 'instructor']
  ): Promise<void> {
    const { admin, instructor, participant } = await this.createRoleBasedUsers(requestContext);

    const testRole = async (
      role: { user: User; token: string },
      roleName: string,
      shouldAllow: boolean
    ) => {
      const response = await requestContext(app)[method.toLowerCase() as keyof typeof requestContext](endpoint)
        .set('Authorization', `Bearer ${role.token}`)
        .send(data || {});

      if (shouldAllow) {
        expect([200, 201, 204]).toContain(response.status());
      } else {
        expect([403, 404]).toContain(response.status());
      }
    };

    await testRole(admin, 'admin', expectedAllowedRoles.includes('admin'));
    await testRole(instructor, 'instructor', expectedAllowedRoles.includes('instructor'));
    await testRole(participant, 'participant', expectedAllowedRoles.includes('participant'));
  }

  /**
   * Test JWT token validation
   */
  static async testJWTValidation(requestContext: any): Promise<void> {
    // Create user and get valid token
    const { token } = await this.authenticateUser(requestContext);

    // Test malformed tokens
    const malformedTokens = [
      'not.a.valid.jwt',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      'invalid.header.payload.signature',
      '',
      null,
      undefined
    ];

    for (const malformedToken of malformedTokens) {
      const response = await requestContext(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${malformedToken}`);

      expect(response.status).toBe(401);
    }

    // Test valid token format but wrong signing key
    const validFormatWrongKey = this.generateTokenWithWrongKey();
    const response = await requestContext(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${validFormatWrongKey}`);

    expect(response.status).toBe(401);
  }

  /**
   * Test session management
   */
  static async testSessionManagement(requestContext: any): Promise<void> {
    const { user, token } = await this.authenticateUser(requestContext);

    // Test multiple concurrent sessions
    const sessions = [];
    for (let i = 0; i < 3; i++) {
      const loginResponse = await requestContext(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password
        });

      expect(loginResponse.status).toBe(200);
      sessions.push(loginResponse.body.token);
    }

    // All tokens should be valid
    for (const sessionToken of sessions) {
      const response = await requestContext(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(response.status).toBe(200);
    }

    // Test logout
    const logoutResponse = await requestContext(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutResponse.status).toBe(200);

    // Token should be invalid after logout
    const profileResponse = await requestContext(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(profileResponse.status).toBe(401);
  }

  /**
   * Test password security
   */
  static async testPasswordSecurity(requestContext: any): Promise<void> {
    const user = generateTestData('user');

    // Test weak passwords
    const weakPasswords = [
      'password',
      '123456',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
      '1234567890'
    ];

    for (const weakPassword of weakPasswords) {
      const response = await requestContext(app)
        .post('/api/auth/signup')
        .send({
          ...user,
          email: faker.internet.email(),
          password: weakPassword
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Password too weak');
    }

    // Test password requirements
    const invalidPasswords = [
      '', // Empty
      'a', // Too short
      'ab', // Too short
      '123', // Only numbers
      'abc', // Only letters
      'ABC', // Only uppercase
      'abc!', // Only lowercase with symbol
      '123ABC', // No symbol
      'Passw0rd' // No symbol
    ];

    for (const invalidPassword of invalidPasswords) {
      const response = await requestContext(app)
        .post('/api/auth/signup')
        .send({
          ...user,
          email: faker.internet.email(),
          password: invalidPassword
        });

      expect(response.status).toBe(400);
    }

    // Test valid strong password
    const strongPassword = 'Str0ngP@ssw0rd!2024';
    const validResponse = await requestContext(app)
      .post('/api/auth/signup')
      .send({
        ...user,
        email: faker.internet.email(),
        password: strongPassword
      });

    expect(validResponse.status).toBe(201);
  }

  /**
   * Test rate limiting on authentication endpoints
   */
  static async testAuthRateLimiting(requestContext: any): Promise<void> {
    const user = generateTestData('user');

    // Test signup rate limiting
    const signupRequests = Array(10).fill(null).map(() =>
      requestContext(app)
        .post('/api/auth/signup')
        .send({
          ...user,
          email: faker.internet.email(),
          password: 'ValidP@ssw0rd123!'
        })
    );

    const signupResponses = await Promise.all(signupRequests);
    const rateLimitedSignups = signupResponses.filter(r => r.status === 429);
    expect(rateLimitedSignups.length).toBeGreaterThan(0);

    // Test login rate limiting
    const loginRequests = Array(10).fill(null).map(() =>
      requestContext(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'wrongpassword'
        })
    );

    const loginResponses = await Promise.all(loginRequests);
    const rateLimitedLogins = loginResponses.filter(r => r.status === 429);
    expect(rateLimitedLogins.length).toBeGreaterThan(0);
  }

  /**
   * Test CSRF protection
   */
  static async testCSRFProtection(requestContext: any): Promise<void> {
    const { token } = await this.authenticateUser(requestContext);

    // Get CSRF token
    const csrfResponse = await requestContext(app)
      .get('/api/auth/csrf-token')
      .set('Authorization', `Bearer ${token}`);

    expect(csrfResponse.status).toBe(200);
    const csrfToken = csrfResponse.body.token;

    // Test request without CSRF token
    const response = await requestContext(app)
      .post('/api/workshops')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Workshop',
        description: 'Test Description'
      });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('CSRF');

    // Test request with invalid CSRF token
    const invalidCsrfResponse = await requestContext(app)
      .post('/api/workshops')
      .set('Authorization', `Bearer ${token}`)
      .set('X-CSRF-Token', 'invalid-token')
      .send({
        title: 'Test Workshop',
        description: 'Test Description'
      });

    expect(invalidCsrfResponse.status).toBe(403);

    // Test request with valid CSRF token
    const validCsrfResponse = await requestContext(app)
      .post('/api/workshops')
      .set('Authorization', `Bearer ${token}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Test Workshop',
        description: 'Test Description'
      });

    expect([200, 201]).toContain(validCsrfResponse.status());
  }

  /**
   * Test password reset flow
   */
  static async testPasswordResetFlow(requestContext: any): Promise<void> {
    const user = generateTestData('user');

    // Create user first
    await requestContext(app)
      .post('/api/auth/signup')
      .send(user);

    // Request password reset
    const resetRequest = await requestContext(app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email });

    expect(resetRequest.status).toBe(200);
    expect(resetRequest.body.message).toContain('Reset email sent');

    // Test with non-existent email
    const invalidEmailRequest = await requestContext(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' });

    // Should still return 200 for security (don't reveal email existence)
    expect(invalidEmailRequest.status).toBe(200);

    // Test password reset with invalid token
    const invalidResetRequest = await requestContext(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'invalid-token',
        newPassword: 'NewStr0ngP@ssw0rd!'
      });

    expect(invalidResetRequest.status).toBe(400);
    expect(invalidResetRequest.body.error.message).toContain('Invalid or expired token');
  }

  /**
   * Generate expired JWT token for testing
   */
  private static generateExpiredToken(): string {
    // This is a mock implementation
    // In a real scenario, you would generate a JWT with an expired timestamp
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-id',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000) - 86400, // 24 hours ago
      exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago (expired)
    })).toString('base64url');

    return `${header}.${payload}.mock-signature`;
  }

  /**
   * Generate JWT token with wrong signing key
   */
  private static generateTokenWithWrongKey(): string {
    // This is a mock implementation
    // In a real scenario, you would generate a JWT with a different secret key
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-id',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    })).toString('base64url');

    return `${header}.${payload}.wrong-signature`;
  }
}

// Export convenience functions for backward compatibility
export const authenticateUser = AuthHelper.authenticateUser.bind(AuthHelper);
export const createRoleBasedUsers = AuthHelper.createRoleBasedUsers.bind(AuthHelper);
export const testProtectedEndpoint = AuthHelper.testProtectedEndpoint.bind(AuthHelper);
export const testRoleBasedAccess = AuthHelper.testRoleBasedAccess.bind(AuthHelper);
export const testJWTValidation = AuthHelper.testJWTValidation.bind(AuthHelper);
export const testSessionManagement = AuthHelper.testSessionManagement.bind(AuthHelper);
export const testPasswordSecurity = AuthHelper.testPasswordSecurity.bind(AuthHelper);
export const testAuthRateLimiting = AuthHelper.testAuthRateLimiting.bind(AuthHelper);
export const testCSRFProtection = AuthHelper.testCSRFProtection.bind(AuthHelper);
export const testPasswordResetFlow = AuthHelper.testPasswordResetFlow.bind(AuthHelper);