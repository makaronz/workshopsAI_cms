import axios, { AxiosInstance, AxiosResponse } from 'axios';
import i18nService, { t } from './i18n';

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
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
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
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '/api/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
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
    if (!token) return null;

    try {
      const response = await this.api.get<User>('/auth/me');
      return response.data;
    } catch (error) {
      // Token is invalid, clear storage
      this.clearAuthStorage();
      return null;
    }
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('workshopsai-access-token') ||
           sessionStorage.getItem('workshopsai-access-token');
  }

  private setAccessToken(token: string, rememberMe: boolean = false): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('workshopsai-access-token', token);
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

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await axios.post<AuthResponse>(
        `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`,
        { refreshToken },
        { timeout: 5000 }
      );

      this.setAccessToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
      this.currentUser = response.data.user;

      return response.data.accessToken;
    } catch (error) {
      this.clearAuthStorage();
      return null;
    }
  }

  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.api.post<AuthResponse>('/auth/login', credentials);
      const { user, accessToken, refreshToken } = response.data;

      this.setAccessToken(accessToken, credentials.rememberMe);
      this.setRefreshToken(refreshToken);
      this.currentUser = user;

      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || t('auth.loginError');
      throw new Error(message);
    }
  }

  public async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await this.api.post<AuthResponse>('/auth/register', data);
      const { user, accessToken, refreshToken } = response.data;

      this.setAccessToken(accessToken);
      this.setRefreshToken(refreshToken);
      this.currentUser = user;

      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || t('auth.registerError');
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
      if (event.key === 'workshopsai-access-token' && !event.newValue) {
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