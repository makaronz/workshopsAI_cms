/**
 * Authentication Service Unit Tests
 * Comprehensive testing of authentication functionality with 100% coverage
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { authService } from '../../../src/services/authService';
import { mockDatabase } from '../../mocks/database';
import { testUsers } from '../../fixtures/testData';

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../../src/config/database', () => ({
  pool: mockPool
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mockPool } from '../../mocks/database';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'newuser@test.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'password123'
      };

      const hashedPassword = 'hashedpassword123';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(result).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.user.username).toBe(userData.username);
      expect(result.user.firstName).toBe(userData.firstName);
      expect(result.user.lastName).toBe(userData.lastName);
      expect(result.user.password).toBeUndefined(); // Password should not be returned
      expect(result.token).toBeDefined();
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const userData = {
        email: 'admin@test.com', // Existing email
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'password123'
      };

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow('Email already exists');
    });

    it('should throw error for duplicate username', async () => {
      // Arrange
      const userData = {
        email: 'newuser@test.com',
        username: 'admin', // Existing username
        firstName: 'New',
        lastName: 'User',
        password: 'password123'
      };

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow('Username already exists');
    });

    it('should validate email format', async () => {
      // Arrange
      const userData = {
        email: 'invalid-email',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'password123'
      };

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow('Invalid email format');
    });

    it('should validate password strength', async () => {
      // Arrange
      const userData = {
        email: 'newuser@test.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: '123' // Too short
      };

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'password'
      };

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const mockToken = 'mock-jwt-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);
      const mockRefreshToken = 'mock-refresh-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockRefreshToken);

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result).toBeDefined();
      expect(result.user.email).toBe(loginData.email);
      expect(result.token).toBe(mockToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, expect.any(String));
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should throw error for invalid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'wrongpassword'
      };

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      const loginData = {
        email: 'nonexistent@test.com',
        password: 'password'
      };

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow('User not found');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'password'
      };

      // Mock database error
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow('Database connection failed');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token with valid refresh token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const mockPayload = { userId: '1', email: 'admin@test.com' };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      const mockNewToken = 'new-mock-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockNewToken);

      // Act
      const result = await authService.refreshToken(refreshToken);

      // Assert
      expect(result).toBeDefined();
      expect(result.token).toBe(mockNewToken);
      expect(jwt.verify).toHaveBeenCalledWith(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    });

    it('should throw error for invalid refresh token', async () => {
      // Arrange
      const refreshToken = 'invalid-refresh-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for expired refresh token', async () => {
      // Arrange
      const refreshToken = 'expired-refresh-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Token expired') as any;
        error.name = 'TokenExpiredError';
        throw error;
      });

      // Act & Assert
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow('Refresh token expired');
    });
  });

  describe('validateToken', () => {
    it('should validate token and return user payload', async () => {
      // Arrange
      const token = 'valid-token';
      const mockPayload = { userId: '1', email: 'admin@test.com', iat: Date.now() / 1000 };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
    });

    it('should throw error for invalid token', async () => {
      // Arrange
      const token = 'invalid-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.validateToken(token)).rejects.toThrow('Invalid token');
    });

    it('should throw error for expired token', async () => {
      // Arrange
      const token = 'expired-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Token expired') as any;
        error.name = 'TokenExpiredError';
        throw error;
      });

      // Act & Assert
      await expect(authService.validateToken(token)).rejects.toThrow('Token expired');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Arrange
      const userId = '1';
      const passwordData = {
        currentPassword: 'currentpassword',
        newPassword: 'newpassword123'
      };

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const hashedNewPassword = 'hashednewpassword123';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedNewPassword);

      // Act
      await authService.changePassword(userId, passwordData);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(passwordData.currentPassword, expect.any(String));
      expect(bcrypt.hash).toHaveBeenCalledWith(passwordData.newPassword, 12);
    });

    it('should throw error for incorrect current password', async () => {
      // Arrange
      const userId = '1';
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.changePassword(userId, passwordData)).rejects.toThrow('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      // Arrange
      const userId = '1';
      const passwordData = {
        currentPassword: 'currentpassword',
        newPassword: '123' // Too short
      };

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(authService.changePassword(userId, passwordData)).rejects.toThrow('New password must be at least 8 characters');
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      // Arrange
      const email = 'admin@test.com';
      const resetToken = 'reset-token-123';

      (jwt.sign as jest.Mock).mockReturnValue(resetToken);

      // Act
      await authService.resetPassword(email);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        { email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('should handle non-existent user gracefully', async () => {
      // Arrange
      const email = 'nonexistent@test.com';

      // Act & Assert (should not throw error for security reasons)
      await expect(authService.resetPassword(email)).resolves.toBeUndefined();
    });
  });

  describe('confirmPasswordReset', () => {
    it('should reset password with valid token', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const newPassword = 'newpassword123';
      const mockPayload = { email: 'admin@test.com' };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      const hashedPassword = 'hashednewpassword123';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      // Act
      await authService.confirmPasswordReset(token, newPassword);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
    });

    it('should throw error for invalid reset token', async () => {
      // Arrange
      const token = 'invalid-reset-token';
      const newPassword = 'newpassword123';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.confirmPasswordReset(token, newPassword)).rejects.toThrow('Invalid or expired reset token');
    });

    it('should validate new password strength', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const newPassword = '123'; // Too short
      const mockPayload = { email: 'admin@test.com' };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      // Act & Assert
      await expect(authService.confirmPasswordReset(token, newPassword)).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile', async () => {
      // Arrange
      const userId = '1';

      // Act
      const result = await authService.getUserProfile(userId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
      expect(result.password).toBeUndefined(); // Password should not be returned
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-user';

      // Act & Assert
      await expect(authService.getUserProfile(userId)).rejects.toThrow('User not found');
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const userId = '1';
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'Updated bio',
        location: 'Updated location',
        website: 'https://updated-website.com'
      };

      // Act
      const result = await authService.updateUserProfile(userId, updateData);

      // Assert
      expect(result).toBeDefined();
      expect(result.firstName).toBe(updateData.firstName);
      expect(result.lastName).toBe(updateData.lastName);
      expect(result.bio).toBe(updateData.bio);
      expect(result.location).toBe(updateData.location);
      expect(result.website).toBe(updateData.website);
    });

    it('should validate email format when updating email', async () => {
      // Arrange
      const userId = '1';
      const updateData = {
        email: 'invalid-email'
      };

      // Act & Assert
      await expect(authService.updateUserProfile(userId, updateData)).rejects.toThrow('Invalid email format');
    });

    it('should check for duplicate email when updating', async () => {
      // Arrange
      const userId = '1';
      const updateData = {
        email: 'user@test.com' // Another user's email
      };

      // Act & Assert
      await expect(authService.updateUserProfile(userId, updateData)).rejects.toThrow('Email already exists');
    });
  });

  describe('Security Tests', () => {
    it('should use bcrypt with proper salt rounds', async () => {
      // Arrange
      const userData = {
        email: 'security@test.com',
        username: 'securityuser',
        firstName: 'Security',
        lastName: 'User',
        password: 'securepassword123'
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');

      // Act
      await authService.register(userData);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
    });

    it('should use JWT with proper expiration', async () => {
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'password'
      };

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('token');

      // Act
      await authService.login(loginData);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    });

    it('should handle concurrent password reset requests', async () => {
      // Arrange
      const email = 'admin@test.com';
      const promises = Array(10).fill(null).map(() => authService.resetPassword(email));

      // Act & Assert
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should sanitize user data in responses', async () => {
      // Arrange
      const userId = '1';

      // Act
      const profile = await authService.getUserProfile(userId);

      // Assert
      expect(profile.password).toBeUndefined();
      expect(profile.salt).toBeUndefined();
      expect(profile.passwordResetToken).toBeUndefined();
      expect(profile.passwordResetExpires).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      const userData = {
        email: 'test@test.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123'
      };

      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow('Connection failed');
    });

    it('should handle bcrypt errors', async () => {
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'password'
      };

      (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow('Bcrypt error');
    });

    it('should handle JWT errors', async () => {
      // Arrange
      const token = 'valid-token';

      (jwt.verify as jest.Mock).mockRejectedValue(new Error('JWT error'));

      // Act & Assert
      await expect(authService.validateToken(token)).rejects.toThrow('JWT error');
    });
  });
});