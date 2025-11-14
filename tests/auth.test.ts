import { AuthService, UserRole } from '../src/config/auth';
import { users } from '../src/models/schema';
import { eq } from 'drizzle-orm';

// Mock the database
jest.mock('../src/config/database', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password with salt rounds', async () => {
      const password = 'testPassword123';
      const hashedPassword = await AuthService.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50); // bcrypt hash length
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await AuthService.hashPassword(password);
      const hash2 = await AuthService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        role: 'participant' as UserRole,
      };

      const token = AuthService.generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        role: 'participant' as UserRole,
      };

      const token = AuthService.generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        role: 'participant' as UserRole,
      };

      const token = AuthService.generateAccessToken(payload);
      const decoded = AuthService.verifyAccessToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.jwt.token';

      expect(() => {
        AuthService.verifyAccessToken(invalidToken);
      }).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        role: 'participant' as UserRole,
      };

      const token = AuthService.generateRefreshToken(payload);
      const decoded = AuthService.verifyRefreshToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });
  });

  describe('hasPermission', () => {
    it('should grant all permissions to admin role', () => {
      expect(AuthService.hasPermission('admin', 'any:permission')).toBe(true);
    });

    it('should check specific permissions for non-admin roles', () => {
      expect(AuthService.hasPermission('participant', 'read:own-profile')).toBe(true);
      expect(AuthService.hasPermission('participant', 'create:workshops')).toBe(false);
      expect(AuthService.hasPermission('facilitator', 'read:own-workshops')).toBe(true);
      expect(AuthService.hasPermission('facilitator', 'delete:workshops')).toBe(false);
    });
  });

  describe('canAccessResource', () => {
    it('should check resource access correctly', () => {
      expect(AuthService.canAccessResource('participant', 'read', 'own-profile')).toBe(true);
      expect(AuthService.canAccessResource('participant', 'create', 'workshops')).toBe(false);
      expect(AuthService.canAccessResource('admin', 'delete', 'anything')).toBe(true);
    });
  });
});