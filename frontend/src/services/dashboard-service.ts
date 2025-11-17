/**
 * Dashboard Service using Unified API Client
 *
 * This service handles all dashboard-related operations using the centralized
 * API client for consistent behavior, caching, and optimized performance.
 */

import { apiClient, ApiError } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/api-config';

// Types
export interface DashboardMetrics {
  totalWorkshops: number;
  publishedWorkshops: number;
  draftWorkshops: number;
  totalParticipants: number;
  activeWorkshops: number;
  upcomingSessions: number;
  completedSessions: number;
  totalRevenue?: number;
  averageRating?: number;
  workshopCompletionRate?: number;
}

export interface ActivityEvent {
  id: string;
  type: 'workshop_created' | 'workshop_published' | 'session_completed' | 'user_registered' | 'questionnaire_submitted';
  userId: string;
  userName: string;
  workshopId?: string;
  workshopTitle?: string;
  sessionId?: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AnalyticsData {
  workshopStats: {
    total: number;
    published: number;
    draft: number;
    archived: number;
    growth: {
      thisMonth: number;
      lastMonth: number;
      percentageChange: number;
    };
  };
  participantStats: {
    total: number;
    active: number;
    newThisMonth: number;
    retentionRate: number;
  };
  sessionStats: {
    total: number;
    completed: number;
    upcoming: number;
    averageDuration: number;
  };
  ratingStats: {
    averageRating: number;
    totalReviews: number;
    distribution: Record<number, number>;
  };
  revenueStats?: {
    totalRevenue: number;
    revenueThisMonth: number;
    averagePerWorkshop: number;
  };
}

export interface TimeRangeFilter {
  startDate?: string;
  endDate?: string;
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface DashboardFilters extends TimeRangeFilter {
  workshopId?: string;
  facilitatorId?: string;
  status?: string[];
  tags?: string[];
}

/**
 * Dashboard Service
 */
export class DashboardService {
  private static instance: DashboardService;

  private constructor() {}

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  /**
   * Get dashboard metrics with caching
   */
  async getMetrics(filters?: DashboardFilters): Promise<DashboardMetrics> {
    console.log('📊 [DASHBOARD] Fetching metrics:', filters);

    try {
      const response = await apiClient.get<DashboardMetrics>(
        API_ENDPOINTS.DASHBOARD.METRICS,
        filters,
        {
          serviceType: 'dashboard',
          skipCache: false // Enable caching for metrics
        }
      );

      console.log('✅ [DASHBOARD] Retrieved metrics:', {
        totalWorkshops: response.totalWorkshops,
        publishedWorkshops: response.publishedWorkshops,
        totalParticipants: response.totalParticipants
      });

      return response;
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Failed to fetch metrics:', {
        status: error.status,
        message: error.message,
        filters
      });

      throw new Error(error.message || 'Failed to fetch dashboard metrics');
    }
  }

  /**
   * Get comprehensive analytics data
   */
  async getAnalytics(filters?: DashboardFilters): Promise<AnalyticsData> {
    console.log('📈 [DASHBOARD] Fetching analytics:', filters);

    try {
      const response = await apiClient.get<AnalyticsData>(
        API_ENDPOINTS.DASHBOARD.ANALYTICS,
        filters,
        {
          serviceType: 'dashboard',
          skipCache: false // Cache analytics data
        }
      );

      console.log('✅ [DASHBOARD] Retrieved analytics:', {
        workshopCount: response.workshopStats.total,
        participantCount: response.participantStats.total,
        averageRating: response.ratingStats.averageRating
      });

      return response;
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Failed to fetch analytics:', {
        status: error.status,
        message: error.message,
        filters
      });

      throw new Error(error.message || 'Failed to fetch analytics data');
    }
  }

  /**
   * Get recent activity feed
   */
  async getActivity(limit: number = 20, filters?: DashboardFilters): Promise<ActivityEvent[]> {
    console.log('🔄 [DASHBOARD] Fetching activity:', { limit });

    try {
      const response = await apiClient.get<ActivityEvent[]>(
        API_ENDPOINTS.DASHBOARD.ACTIVITY,
        {
          limit,
          ...filters
        },
        {
          serviceType: 'dashboard',
          skipCache: false // Cache activity briefly
        }
      );

      console.log(`✅ [DASHBOARD] Retrieved ${response.length} activity events`);
      return response;
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Failed to fetch activity:', {
        status: error.status,
        message: error.message,
        limit
      });

      throw new Error(error.message || 'Failed to fetch recent activity');
    }
  }

  /**
   * Get workshop performance data
   */
  async getWorkshopPerformance(workshopId?: string, filters?: TimeRangeFilter): Promise<any> {
    console.log('📊 [DASHBOARD] Fetching workshop performance:', { workshopId });

    try {
      const url = workshopId
        ? `${API_ENDPOINTS.DASHBOARD.ANALYTICS}/workshops/${workshopId}`
        : `${API_ENDPOINTS.DASHBOARD.ANALYTICS}/workshops`;

      const response = await apiClient.get<any>(
        url,
        filters,
        {
          serviceType: 'dashboard',
          skipCache: false
        }
      );

      console.log('✅ [DASHBOARD] Retrieved workshop performance data');
      return response;
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Failed to fetch workshop performance:', {
        workshopId,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to fetch workshop performance');
    }
  }

  /**
   * Get participant engagement data
   */
  async getParticipantEngagement(filters?: DashboardFilters): Promise<any> {
    console.log('👥 [DASHBOARD] Fetching participant engagement:', filters);

    try {
      const response = await apiClient.get<any>(
        `${API_ENDPOINTS.DASHBOARD.ANALYTICS}/engagement`,
        filters,
        {
          serviceType: 'dashboard',
          skipCache: false
        }
      );

      console.log('✅ [DASHBOARD] Retrieved participant engagement data');
      return response;
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Failed to fetch participant engagement:', {
        status: error.status,
        message: error.message,
        filters
      });

      throw new Error(error.message || 'Failed to fetch participant engagement');
    }
  }

  /**
   * Get revenue data (if applicable)
   */
  async getRevenueData(filters?: TimeRangeFilter): Promise<any> {
    console.log('💰 [DASHBOARD] Fetching revenue data:', filters);

    try {
      const response = await apiClient.get<any>(
        `${API_ENDPOINTS.DASHBOARD.ANALYTICS}/revenue`,
        filters,
        {
          serviceType: 'dashboard',
          skipCache: false
        }
      );

      console.log('✅ [DASHBOARD] Retrieved revenue data');
      return response;
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Failed to fetch revenue data:', {
        status: error.status,
        message: error.message,
        filters
      });

      throw new Error(error.message || 'Failed to fetch revenue data');
    }
  }

  /**
   * Get completion and satisfaction metrics
   */
  async getCompletionMetrics(filters?: DashboardFilters): Promise<any> {
    console.log('🎯 [DASHBOARD] Fetching completion metrics:', filters);

    try {
      const response = await apiClient.get<any>(
        `${API_ENDPOINTS.DASHBOARD.ANALYTICS}/completion`,
        filters,
        {
          serviceType: 'dashboard',
          skipCache: false
        }
      );

      console.log('✅ [DASHBOARD] Retrieved completion metrics');
      return response;
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Failed to fetch completion metrics:', {
        status: error.status,
        message: error.message,
        filters
      });

      throw new Error(error.message || 'Failed to fetch completion metrics');
    }
  }

  /**
   * Export dashboard data
   */
  async exportData(
    type: 'metrics' | 'analytics' | 'activity',
    format: 'json' | 'csv' | 'pdf' = 'json',
    filters?: DashboardFilters
  ): Promise<Blob> {
    console.log('📤 [DASHBOARD] Exporting dashboard data:', { type, format });

    try {
      const response = await apiClient.get(
        `${API_ENDPOINTS.DASHBOARD.ANALYTICS}/export`,
        {
          type,
          format,
          ...filters
        },
        {
          serviceType: 'dashboard',
          skipCache: true,
          responseType: 'blob'
        }
      );

      console.log('✅ [DASHBOARD] Exported dashboard data:', { type, format, size: response.size });
      return response;
    } catch (error: any) {
      console.error('❌ [DASHBOARD] Failed to export dashboard data:', {
        type,
        format,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to export dashboard data');
    }
  }

  /**
   * Refresh dashboard cache
   */
  async refreshCache(): Promise<void> {
    console.log('🔄 [DASHBOARD] Refreshing dashboard cache');

    try {
      // Clear all dashboard-related caches
      apiClient.clearCache('dashboard');

      // Optional: Make a lightweight API call to force cache refresh
      await apiClient.get(
        API_ENDPOINTS.DASHBOARD.METRICS,
        { refresh: true },
        {
          serviceType: 'dashboard',
          skipCache: true
        }
      );

      console.log('✅ [DASHBOARD] Cache refreshed successfully');
    } catch (error: any) {
      console.warn('⚠️ [DASHBOARD] Cache refresh warning:', error.message);
      // Don't throw error for cache refresh failure
    }
  }

  /**
   * Get real-time dashboard updates (WebSocket or polling alternative)
   */
  async subscribeToUpdates(callback: (data: Partial<DashboardMetrics>) => void): Promise<() => void> {
    console.log('🔔 [DASHBOARD] Setting up real-time updates');

    // For now, implement polling-based updates
    // In a real implementation, this would use WebSocket connections
    const pollInterval = 30000; // 30 seconds
    let isActive = true;

    const poll = async () => {
      if (!isActive) return;

      try {
        const metrics = await this.getMetrics();
        callback(metrics);
      } catch (error) {
        console.warn('⚠️ [DASHBOARD] Polling error:', error);
      }

      if (isActive) {
        setTimeout(poll, pollInterval);
      }
    };

    // Start polling
    poll();

    // Return unsubscribe function
    return () => {
      isActive = false;
      console.log('🔇 [DASHBOARD] Unsubscribed from real-time updates');
    };
  }
}

// Export singleton instance
export const dashboardService = DashboardService.getInstance();

// Export types for backward compatibility
export { DashboardMetrics, ActivityEvent, AnalyticsData, DashboardFilters, TimeRangeFilter };