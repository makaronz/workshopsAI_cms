/**
 * Authentication Service using Unified API Client
 *
 * This service handles all authentication operations using the centralized
 * API client for consistent behavior and error handling.
 */

import { apiClient, ApiResponse, ApiError } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/api-config';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Sociologist-Editor' | 'Facilitator' | 'Moderator' | 'Participant';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  emailVerified?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role?: User['role'];
  agreeToTerms: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetData {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Authentication Service
 */
export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private authPromise: Promise<User | null> | null = null;
  private authChangeCallbacks: Set<(user: User | null) => void> = new Set();

  private constructor() {
    this.initializeAuth();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async initializeAuth(): Promise<void> {
    this.authPromise = this.validateStoredAuth();
    try {
      this.currentUser = await this.authPromise;
      this.notifyAuthChange(this.currentUser);
    } catch (error) {
      console.warn('Failed to initialize auth:', error);
      this.authPromise = null;
    }
  }

  private async validateStoredAuth(): Promise<User | null> {
    try {
      const response = await apiClient.get<User>(
        API_ENDPOINTS.AUTH.ME,
        undefined,
        {
          serviceType: 'auth',
          skipCache: true // Never cache auth status
        }
      );

      console.log('✅ [AUTH] Validated stored token for user:', response.email);
      return response;
    } catch (error: any) {
      console.warn('⚠️ [AUTH] Token validation failed:', {
        status: error.status,
        message: error.message
      });
      return null;
    }
  }

  private notifyAuthChange(user: User | null): void {
    this.authChangeCallbacks.forEach(callback => callback(user));
  }

  /**
   * User authentication
   */
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    console.log('🔐 [AUTH] Starting login process:', {
      email: credentials.email,
      rememberMe: credentials.rememberMe,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await apiClient.post<AuthResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials,
        {
          serviceType: 'auth',
          skipCache: true,
          skipRetry: false // Allow retry for login
        }
      );

      const { user, accessToken, refreshToken, expiresIn } = response;

      console.log('✅ [AUTH] Login successful:', {
        user: user.email,
        role: user.role,
        hasTokens: !!(accessToken && refreshToken),
        expiresIn
      });

      this.currentUser = user;
      this.notifyAuthChange(user);

      return {
        user,
        accessToken,
        refreshToken,
        expiresIn
      };
    } catch (error: any) {
      console.error('❌ [AUTH] Login failed:', {
        email: credentials.email,
        status: error.status,
        message: error.message,
        details: error.details
      });

      throw new Error(error.message || 'Login failed');
    }
  }

  /**
   * User registration
   */
  public async register(data: RegisterData): Promise<AuthResponse> {
    console.log('📝 [AUTH] Starting registration:', {
      email: data.email,
      name: data.name,
      role: data.role,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await apiClient.post<AuthResponse>(
        API_ENDPOINTS.AUTH.REGISTER,
        data,
        {
          serviceType: 'auth',
          skipCache: true,
          skipRetry: false
        }
      );

      const { user, accessToken, refreshToken, expiresIn } = response;

      console.log('✅ [AUTH] Registration successful:', {
        user: user.email,
        role: user.role
      });

      this.currentUser = user;
      this.notifyAuthChange(user);

      return {
        user,
        accessToken,
        refreshToken,
        expiresIn
      };
    } catch (error: any) {
      console.error('❌ [AUTH] Registration failed:', {
        email: data.email,
        status: error.status,
        message: error.message,
        details: error.details
      });

      // Enhanced error message for registration
      const message = error.details && Array.isArray(error.details)
        ? error.details.map((d: any) => d.message).join(', ')
        : error.message || 'Registration failed';

      throw new Error(message);
    }
  }

  /**
   * User logout
   */
  public async logout(): Promise<void> {
    console.log('🚪 [AUTH] Starting logout process');

    try {
      await apiClient.post(
        API_ENDPOINTS.AUTH.LOGOUT,
        undefined,
        { serviceType: 'auth', skipCache: true }
      );

      console.log('✅ [AUTH] Logout API call successful');
    } catch (error) {
      console.warn('⚠️ [AUTH] Logout API call failed, continuing with local cleanup:', error);
    } finally {
      this.currentUser = null;
      this.authPromise = null;

      // Clear auth-related cache
      apiClient.clearCache('auth');

      this.notifyAuthChange(null);

      console.log('✅ [AUTH] Logout completed');
    }
  }

  /**
   * Request password reset
   */
  public async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    console.log('🔑 [AUTH] Requesting password reset:', { email: data.email });

    try {
      await apiClient.post(
        API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
        data,
        { serviceType: 'auth', skipCache: true }
      );

      console.log('✅ [AUTH] Password reset email sent');
    } catch (error: any) {
      console.error('❌ [AUTH] Password reset request failed:', {
        email: data.email,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to send password reset email');
    }
  }

  /**
   * Reset password with token
   */
  public async resetPassword(data: PasswordResetData): Promise<void> {
    console.log('🔐 [AUTH] Resetting password with token');

    try {
      await apiClient.post(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        data,
        { serviceType: 'auth', skipCache: true }
      );

      console.log('✅ [AUTH] Password reset successful');
    } catch (error: any) {
      console.error('❌ [AUTH] Password reset failed:', {
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to reset password');
    }
  }

  /**
   * Get current user
   */
  public async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    if (this.authPromise) {
      return await this.authPromise;
    }

    try {
      const user = await this.validateStoredAuth();
      this.currentUser = user;
      this.notifyAuthChange(user);
      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  /**
   * Role-based authorization methods
   */
  public hasRole(role: User['role'] | User['role'][]): boolean {
    if (!this.currentUser) return false;

    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(this.currentUser.role);
  }

  public canCreateWorkshops(): boolean {
    return this.hasRole(['Sociologist-Editor', 'Admin']);
  }

  public canManageWorkshops(): boolean {
    return this.hasRole(['Facilitator', 'Sociologist-Editor', 'Moderator', 'Admin']);
  }

  public canViewAnalytics(): boolean {
    return this.hasRole(['Sociologist-Editor', 'Admin']);
  }

  public canManageUsers(): boolean {
    return this.hasRole(['Moderator', 'Admin']);
  }

  public isAdmin(): boolean {
    return this.hasRole('Admin');
  }

  /**
   * Subscribe to auth state changes
   */
  public subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
    this.authChangeCallbacks.add(callback);

    // Immediately call with current state
    callback(this.currentUser);

    return () => {
      this.authChangeCallbacks.delete(callback);
    };
  }

  /**
   * Force refresh current user data
   */
  public async refreshCurrentUser(): Promise<User | null> {
    this.authPromise = this.validateStoredAuth();
    try {
      this.currentUser = await this.authPromise;
      this.notifyAuthChange(this.currentUser);
      return this.currentUser;
    } catch (error) {
      this.currentUser = null;
      this.notifyAuthChange(null);
      return null;
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();

// Export types for backward compatibility
export { User as AuthUser, LoginCredentials, RegisterData, AuthResponse };