import { migrationApiClient } from './migration/api-client';
import { User, LoginCredentials, RegisterData, AuthResponse, PasswordResetRequest, PasswordResetData } from './auth';
import i18nService, { t } from './i18n';

/**
 * Migration-aware Auth Service
 * Integrates with the migration API client for Redis elimination resilience
 */
class MigrationAuthService {
  private static instance: MigrationAuthService;
  private currentUser: User | null = null;
  private authPromise: Promise<User | null> | null = null;
  private tokenRefreshPromise: Promise<string | null> | null = null;

  private constructor() {
    // Initialize auth state from storage
    this.initializeAuth();
  }

  public static getInstance(): MigrationAuthService {
    if (!MigrationAuthService.instance) {
      MigrationAuthService.instance = new MigrationAuthService();
    }
    return MigrationAuthService.instance;
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

    console.log('🔍 [VALIDATE AUTH] Validating stored token...');

    try {
      const response = await migrationApiClient.get<User>('/auth/me', {
        cache: {
          strategy: 'network-first',
          ttl: 60000 // Cache user data for 1 minute
        }
      });

      console.log('✅ [VALIDATE AUTH] Token is valid, user:', response?.email);
      return response;
    } catch (error: any) {
      console.warn('⚠️ [VALIDATE AUTH] Token validation failed:', error);

      // Check if it's a migration-related error
      if (error.isMigrationError) {
        console.warn('⚠️ [MIGRATION] Auth validation affected by migration');
        // Try to use cached user data if available
        const cachedUser = this.getCachedUser();
        if (cachedUser) {
          console.log('✅ [MIGRATION] Using cached user data');
          return cachedUser;
        }
      }

      // Clear auth storage on 401 or migration errors
      if (error?.status === 401 || error.isMigrationError) {
        this.clearAuthStorage();
      }

      return null;
    }
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('workshopsai-access-token') ||
           sessionStorage.getItem('workshopsai-access-token');
  }

  private setAccessToken(token: string, rememberMe: boolean = false): void {
    localStorage.setItem('workshopsai-access-token', token);
    if (!rememberMe) {
      sessionStorage.setItem('workshopsai-access-token', token);
    } else {
      sessionStorage.removeItem('workshopsai-access-token');
    }
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('workshopsai-refresh-token');
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem('workshopsai-refresh-token', token);
  }

  private clearAuthStorage(): void {
    localStorage.removeItem('workshopsai-access-token');
    localStorage.removeItem('workshopsai-refresh-token');
    sessionStorage.removeItem('workshopsai-access-token');
  }

  private getCachedUser(): User | null {
    const cached = localStorage.getItem('workshopsai-cached-user');
    if (cached) {
      try {
        const user = JSON.parse(cached);
        const cacheTime = localStorage.getItem('workshopsai-cache-time');
        if (cacheTime) {
          const age = Date.now() - parseInt(cacheTime);
          // Use cached user if less than 10 minutes old
          if (age < 600000) {
            return user;
          }
        }
      } catch (error) {
        console.warn('Failed to parse cached user:', error);
      }
    }
    return null;
  }

  private cacheUser(user: User): void {
    localStorage.setItem('workshopsai-cached-user', JSON.stringify(user));
    localStorage.setItem('workshopsai-cache-time', Date.now().toString());
  }

  private async refreshAccessToken(): Promise<string | null> {
    // Prevent multiple refresh attempts
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    this.tokenRefreshPromise = (async () => {
      try {
        const response = await migrationApiClient.post<{
          success: boolean;
          message: string;
          data: {
            accessToken: string;
            expiresIn: number;
            tokenType: string;
          };
        }>('/auth/refresh', { refreshToken }, {
          retry: {
            maxRetries: 3,
            retryDelay: 1000,
            onRetry: (retryCount, error) => {
              console.warn(`Token refresh retry ${retryCount}:`, error);
            }
          }
        });

        this.setAccessToken(response.data.data.accessToken);
        // Refresh token doesn't change

        return response.data.data.accessToken;
      } catch (error) {
        console.error('Token refresh failed:', error);
        this.clearAuthStorage();
        return null;
      } finally {
        this.tokenRefreshPromise = null;
      }
    })();

    return this.tokenRefreshPromise;
  }

  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    console.log('🔐 [LOGIN START] Attempting login:', credentials.email);

    try {
      const response = await migrationApiClient.post<{
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
          migrationPhase?: string;
        };
      }>('/auth/login', credentials, {
        retry: {
          maxRetries: 2,
          retryDelay: 1000
        }
      });

      console.log('✅ [LOGIN SUCCESS]', response.success);

      const { user, tokens } = response.data;

      if (!tokens?.accessToken || !tokens?.refreshToken) {
        throw new Error('Missing tokens in response');
      }

      this.setAccessToken(tokens.accessToken, credentials.rememberMe);
      this.setRefreshToken(tokens.refreshToken);
      this.currentUser = user;
      this.cacheUser(user); // Cache user for offline/migration scenarios

      console.log('✅ [LOGIN COMPLETE]', user.role);

      // Handle migration phase notification
      if (response.data.migrationPhase) {
        window.dispatchEvent(new CustomEvent('migration-phase-changed', {
          detail: { phase: response.data.migrationPhase }
        }));
      }

      return {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error: any) {
      console.error('❌ [LOGIN ERROR]', error);

      // Provide better error messages for migration issues
      if (error.isMigrationError) {
        throw new Error('Login temporarily unavailable due to system migration. Please try again in a moment.');
      }

      const message = error?.response?.data?.message ||
                     error?.response?.data?.error?.message ||
                     error?.message ||
                     t('auth.loginError');

      throw new Error(message);
    }
  }

  public async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const registerPayload = {
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        role: data.role || 'participant',
        agreeToTerms: data.agreeToTerms,
      };

      const response = await migrationApiClient.post<{
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
      }>('/auth/register', registerPayload, {
        retry: {
          maxRetries: 2,
          retryDelay: 1000
        }
      });

      const { user, tokens } = response.data;

      this.setAccessToken(tokens.accessToken);
      this.setRefreshToken(tokens.refreshToken);
      this.currentUser = user;
      this.cacheUser(user);

      return {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error: any) {
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
      await migrationApiClient.post('/auth/logout', {}, {
        retry: {
          maxRetries: 1
        }
      });
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      this.clearAuthStorage();
      localStorage.removeItem('workshopsai-cached-user');
      localStorage.removeItem('workshopsai-cache-time');
      this.currentUser = null;
      this.authPromise = null;
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

  public getApi() {
    return migrationApiClient;
  }

  public subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'workshopsai-access-token' && !event.newValue) {
        this.currentUser = null;
        callback(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }

  // Migration-specific methods
  public async extendSession(): Promise<boolean> {
    try {
      const refreshed = await this.refreshAccessToken();
      return !!refreshed;
    } catch (error) {
      console.error('Failed to extend session:', error);
      return false;
    }
  }

  public getSessionHealth() {
    const token = this.getAccessToken();
    const cachedUser = this.getCachedUser();
    const now = Date.now();

    return {
      hasToken: !!token,
      hasCachedUser: !!cachedUser,
      cacheAge: cachedUser ? now - parseInt(localStorage.getItem('workshopsai-cache-time') || '0') : null,
      currentUser: this.currentUser,
      migrationPhase: migrationApiClient.getMigrationStatus()?.phase
    };
  }
}

export const migrationAuthService = MigrationAuthService.getInstance();
export default migrationAuthService;