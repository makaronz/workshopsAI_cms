import axios, { AxiosInstance } from 'axios';

export interface DashboardMetrics {
  workshops: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  };
  questionnaires: {
    total: number;
    active: number;
    draft: number;
    closed: number;
  };
  responses: {
    total: number;
    thisMonth: number;
    thisWeek: number;
    today: number;
  };
  analysisJobs: {
    total: number;
    completed: number;
    processing: number;
    failed: number;
    pending: number;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
    llmProviders: {
      openai: 'healthy' | 'unhealthy';
      anthropic: 'healthy' | 'unhealthy';
    };
  };
  lastUpdated: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class DashboardApiService {
  private static instance: DashboardApiService;
  private api: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  private constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '/api',
      timeout: 15000, // 15 seconds timeout
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
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - trigger re-authentication
          this.clearTokens();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): DashboardApiService {
    if (!DashboardApiService.instance) {
      DashboardApiService.instance = new DashboardApiService();
    }
    return DashboardApiService.instance;
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('workshopsai-access-token') ||
           sessionStorage.getItem('workshopsai-access-token');
  }

  private clearTokens(): void {
    localStorage.removeItem('workshopsai-access-token');
    localStorage.removeItem('workshopsai-refresh-token');
    sessionStorage.removeItem('workshopsai-access-token');
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCachedData<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  /**
   * Fetch dashboard overview metrics
   * @param forceRefresh - Skip cache and fetch fresh data
   */
  public async fetchDashboardMetrics(forceRefresh: boolean = false): Promise<DashboardMetrics> {
    const cacheKey = 'dashboard_metrics';

    if (!forceRefresh) {
      const cached = this.getCachedData<DashboardMetrics>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      console.log('🔄 [DASHBOARD] Fetching fresh metrics from API...');

      const response = await this.api.get<ApiResponse<any>>('/dashboard/overview');

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to fetch dashboard metrics');
      }

      const apiData = response.data.data;

      // Transform API response to DashboardMetrics format
      const metrics: DashboardMetrics = {
        workshops: {
          total: apiData.queue?.waiting || 0, // Temporary mapping until we implement proper queries
          published: 0,
          draft: 0,
          archived: 0,
        },
        questionnaires: {
          total: apiData.queue?.active || 0, // Temporary mapping until we implement proper queries
          active: 0,
          draft: 0,
          closed: 0,
        },
        responses: {
          total: apiData.queue?.completed || 0, // Temporary mapping until we implement proper queries
          thisMonth: 0,
          thisWeek: 0,
          today: 0,
        },
        analysisJobs: {
          total: (apiData.queue?.waiting || 0) + (apiData.queue?.active || 0) + (apiData.queue?.completed || 0),
          completed: apiData.queue?.completed || 0,
          processing: apiData.queue?.active || 0,
          failed: 0,
          pending: apiData.queue?.waiting || 0,
        },
        systemHealth: {
          status: apiData.health?.status || 'healthy',
          uptime: apiData.health?.uptime || 0,
          database: 'connected', // Will be updated with actual health check
          redis: 'connected', // Will be updated with actual health check
          llmProviders: {
            openai: apiData.health?.llmProviders?.openai || 'healthy',
            anthropic: apiData.health?.llmProviders?.anthropic || 'healthy',
          },
        },
        lastUpdated: new Date().toISOString(),
      };

      console.log('✅ [DASHBOARD] Metrics fetched successfully:', {
        workshops: metrics.workshops.total,
        questionnaires: metrics.questionnaires.total,
        responses: metrics.responses.total,
        analysisJobs: metrics.analysisJobs.total,
        systemStatus: metrics.systemHealth.status
      });

      // Cache the results for 5 minutes
      this.setCachedData(cacheKey, metrics);

      return metrics;
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Error fetching metrics:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        message: error?.response?.data?.error || error?.message,
        url: error?.config?.url
      });

      // Return fallback data for better UX
      const fallbackMetrics: DashboardMetrics = {
        workshops: { total: 0, published: 0, draft: 0, archived: 0 },
        questionnaires: { total: 0, active: 0, draft: 0, closed: 0 },
        responses: { total: 0, thisMonth: 0, thisWeek: 0, today: 0 },
        analysisJobs: { total: 0, completed: 0, processing: 0, failed: 0, pending: 0 },
        systemHealth: {
          status: 'degraded',
          uptime: 0,
          database: 'disconnected',
          redis: 'disconnected',
          llmProviders: { openai: 'unhealthy', anthropic: 'unhealthy' }
        },
        lastUpdated: new Date().toISOString(),
      };

      // Don't cache fallback data - we want to retry on next request
      return fallbackMetrics;
    }
  }

  /**
   * Refresh dashboard metrics (force cache bypass)
   */
  public async refreshDashboardMetrics(): Promise<DashboardMetrics> {
    return this.fetchDashboardMetrics(true);
  }

  /**
   * Get system health status
   */
  public async fetchSystemHealth(): Promise<DashboardMetrics['systemHealth']> {
    try {
      const response = await this.api.get<ApiResponse<DashboardMetrics['systemHealth']>>('/dashboard/health');

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(response.data.error || 'Failed to fetch system health');
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Error fetching system health:', error);
      return {
        status: 'unhealthy',
        uptime: 0,
        database: 'disconnected',
        redis: 'disconnected',
        llmProviders: { openai: 'unhealthy', anthropic: 'unhealthy' }
      };
    }
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('🗑️ [DASHBOARD] Cache cleared');
  }

  /**
   * Check if data is being loaded (useful for loading states)
   */
  public isLoading(): boolean {
    // You could implement a loading state tracker here if needed
    return false;
  }
}

export const dashboardApiService = DashboardApiService.getInstance();
export default dashboardApiService;