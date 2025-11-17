import axios, { AxiosInstance, AxiosResponse } from 'axios';
import i18nService, { t } from './i18n';
import { TokenManager, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../utils/authTokens';

export interface User {
  id: string;
  email: string;
  role: 'Participant' | 'Facilitator' | 'Moderator' | 'Sociologist-Editor' | 'Admin';
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
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
  role?: 'participant' | 'facilitator';
  agreeToTerms: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetData {
  token: string;
  password: string;
  confirmPassword: string;
}

class AuthService {
  private static instance: AuthService;
  private api: AxiosInstance;
  private currentUser: User | null = null;
  private authPromise: Promise<User | null> | null = null;

  private constructor() {
    // Use /api instead of /api/v1 to work with Vite proxy
    // Proxy will rewrite /api to /api/v1 automatically
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token using centralized management
    this.api.interceptors.request.use(
      (config) => {
        const token = TokenManager.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('🔑 [REQUEST] Adding token to request:', {
            url: config.url,
            method: config.method,
            hasToken: !!token,
            tokenLength: token.length
          });
        } else {
          console.warn('⚠️ [REQUEST] No token available for request:', {
            url: config.url,
            method: config.method
          });
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Log all Axios errors for comprehensive debugging
        console.error("[AXIOS ERROR]", {
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          data: error?.response?.data,
          url: error?.config?.url,
          method: error?.config?.method,
          headers: error?.config?.headers,
          timestamp: new Date().toISOString()
        });

        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
              originalRequest.headers.Authorization = `Bearer ${refreshed}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, logout user
            console.error("[TOKEN REFRESH ERROR]", refreshError);
            await this.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    // Initialize auth state from storage
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
    } catch (error) {
      console.warn('Failed to initialize auth:', error);
      this.authPromise = null;
    }
  }

  private async validateStoredAuth(): Promise<User | null> {
    const token = this.getAccessToken();
    if (!token) {
      console.log('🔍 [VALIDATE AUTH] No token found in storage');
      return null;
    }

    console.log('🔍 [VALIDATE AUTH] Validating stored token...', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 20) + '...'
    });

    try {
      const response = await this.api.get<User>('/auth/me');
      console.log('✅ [VALIDATE AUTH] Token is valid, user:', response.data?.email);
      return response.data;
    } catch (error: any) {
      console.warn('⚠️ [VALIDATE AUTH] Token validation failed:', {
        status: error?.response?.status,
        message: error?.response?.data?.message || error?.message,
        url: error?.config?.url
      });
      
      // Only clear storage if it's a definitive authentication error
      // Don't clear on network errors or temporary server issues
      if (error?.response?.status === 401) {
        // 401 means token is invalid/expired - clear it
        console.warn('⚠️ [VALIDATE AUTH] Token is invalid (401), clearing storage');
        this.clearAuthStorage();
      } else if (error?.response?.status === 403) {
        // 403 means token is valid but user doesn't have permission
        console.warn('⚠️ [VALIDATE AUTH] Token is valid but insufficient permissions (403)');
        // Don't clear - token is valid, just no permission
      } else {
        // Network error or other issue - don't clear token
        console.warn('⚠️ [VALIDATE AUTH] Validation error but keeping token (might be temporary):', error?.response?.status || 'network error');
      }
      
      return null;
    }
  }

  private getAccessToken(): string | null {
    return TokenManager.getAccessToken();
  }

  private setAccessToken(token: string, rememberMe: boolean = false): void {
    TokenManager.setAccessToken(token, rememberMe);
    console.log('💾 Token saved to:', rememberMe ? 'localStorage only' : 'localStorage + sessionStorage');
  }

  private getRefreshToken(): string | null {
    return TokenManager.getRefreshToken();
  }

  private setRefreshToken(token: string): void {
    TokenManager.setRefreshToken(token);
  }

  private clearAuthStorage(): void {
    TokenManager.clearTokens();
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await axios.post<{
        success: boolean;
        message: string;
        data: {
          accessToken: string;
          expiresIn: number;
          tokenType: string;
        };
      }>(
        `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
        { refreshToken },
        { timeout: 5000 }
      );

      // Refresh endpoint only returns accessToken, not refreshToken
      this.setAccessToken(response.data.data.accessToken);
      // Keep existing refreshToken - it doesn't change on refresh

      return response.data.data.accessToken;
    } catch (error) {
      this.clearAuthStorage();
      return null;
    }
  }

  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    console.log('🔐 [LOGIN START] Attempting login with:', {
      email: credentials.email,
      rememberMe: credentials.rememberMe,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await this.api.post<{
        success: boolean;
        message: string;
        data: {
          user: User;
          tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
            tokenType: string;
          };
          sessionId: string;
        };
      }>('/auth/login', credentials);

      console.log('✅ [LOGIN SUCCESS] Response received:', {
        status: response.status,
        statusText: response.statusText,
        success: response.data.success,
        hasUser: !!response.data.data?.user,
        hasTokens: !!response.data.data?.tokens,
        responseTime: new Date().toISOString()
      });

      console.log('📦 [LOGIN DATA] Response data structure:', {
        hasData: !!response.data.data,
        hasUser: !!response.data.data?.user,
        hasTokens: !!response.data.data?.tokens,
        tokensKeys: response.data.data?.tokens ? Object.keys(response.data.data.tokens) : [],
        sessionId: response.data.data?.sessionId
      });

      const { user, tokens } = response.data.data;

      console.log('💾 [TOKEN STORAGE] Saving tokens...', {
        hasAccessToken: !!tokens?.accessToken,
        hasRefreshToken: !!tokens?.refreshToken,
        tokenType: tokens?.tokenType,
        expiresIn: tokens?.expiresIn,
        rememberMe: credentials.rememberMe
      });

      if (!tokens?.accessToken || !tokens?.refreshToken) {
        const error = new Error('Missing tokens in response');
        console.error('❌ [LOGIN ERROR] Token validation failed:', {
          hasAccessToken: !!tokens?.accessToken,
          hasRefreshToken: !!tokens?.refreshToken,
          responseData: response.data
        });
        throw error;
      }

      this.setAccessToken(tokens.accessToken, credentials.rememberMe);
      this.setRefreshToken(tokens.refreshToken);
      this.currentUser = user;

      console.log('✅ [LOGIN COMPLETE] Authentication successful', {
        accessTokenSaved: !!this.getAccessToken(),
        refreshTokenSaved: !!this.getRefreshToken(),
        currentUser: !!this.currentUser,
        userRole: user?.role,
        timestamp: new Date().toISOString()
      });

      return {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error: any) {
      // Comprehensive error logging with full context
      const errorContext = {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        code: error?.code,
        config: {
          url: error?.config?.url,
          method: error?.config?.method,
          headers: error?.config?.headers,
          timeout: error?.config?.timeout
        },
        timestamp: new Date().toISOString(),
        email: credentials.email
      };

      console.error('❌ [LOGIN ERROR] Authentication failed:', errorContext);
      console.error('❌ [LOGIN ERROR] Full error object:', error);
      console.error('❌ [LOGIN ERROR] Error stack trace:', error?.stack);

      // Enhanced error message extraction
      const message = error?.response?.data?.message ||
                     error?.response?.data?.error?.message ||
                     error?.response?.data?.error ||
                     error?.message ||
                     t('auth.loginError');

      const enhancedError = new Error(message);
      enhancedError.cause = errorContext;

      console.error('❌ [LOGIN ERROR] Rethrowing with message:', message);
      throw enhancedError;
    }
  }

  public async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Backend expects data in specific format
      const registerPayload = {
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        role: data.role || 'participant',
        agreeToTerms: data.agreeToTerms,
      };

      const response = await this.api.post<{
        success: boolean;
        message: string;
        data: {
          user: User;
          tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
            tokenType: string;
          };
          sessionId: string;
        };
      }>('/auth/register', registerPayload);

      const { user, tokens } = response.data.data;

      this.setAccessToken(tokens.accessToken);
      this.setRefreshToken(tokens.refreshToken);
      this.currentUser = user;

      return {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error: any) {
      // Log full error for debugging
      console.error('Registration error:', error);
      console.error('Registration error response:', error.response?.data);
      
      const message = error.response?.data?.message || 
                     error.response?.data?.error?.message || 
                     (error.response?.data?.details ? 
                       error.response.data.details.map((d: any) => d.message).join(', ') : 
                       t('auth.registerError'));
      throw new Error(message);
    }
  }

  public async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    } finally {
      this.clearAuthStorage();
      this.currentUser = null;
      this.authPromise = null;
    }
  }

  public async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    try {
      await this.api.post('/auth/forgot-password', data);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || t('auth.requestFailed');
      throw new Error(message);
    }
  }

  public async resetPassword(data: PasswordResetData): Promise<void> {
    try {
      await this.api.post('/auth/reset-password', data);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || t('auth.resetFailed');
      throw new Error(message);
    }
  }

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
      return user;
    } catch (error) {
      return null;
    }
  }

  public async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

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

  public getApi(): AxiosInstance {
    return this.api;
  }

  public subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === ACCESS_TOKEN_KEY && !event.newValue) {
        // Token was cleared elsewhere
        this.currentUser = null;
        callback(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }
}

export const authService = AuthService.getInstance();
export default authService;