import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Workshop,
  WorkshopSession,
  WorkshopModule,
  WorkshopFormData,
  PublishingChecklist,
  ApiResponse,
  PaginatedResponse
} from '@/types/workshop';

/**
 * Workshop Service - Handles all workshop-related API operations
 */
export class WorkshopService {
  private api: AxiosInstance;
  private baseUrl: string;

  constructor(baseURL: string = '/api/v1/workshops') {
    this.baseUrl = baseURL;

    this.api = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Handle API errors and format them consistently
   */
  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || error.response.data?.error || 'Server error occurred';
      const details = error.response.data?.details;

      const formattedError = new Error(message);
      (formattedError as any).details = details;
      (formattedError as any).status = error.response.status;

      return formattedError;
    } else if (error.request) {
      // Network error
      return new Error('Network error. Please check your connection.');
    } else {
      // Other error
      return new Error(error.message || 'An unexpected error occurred');
    }
  }

  /**
   * Get list of workshops with filtering and pagination
   */
  async getWorkshops(filters: {
    status?: Workshop['status'];
    publishedAfter?: string;
    publishedBefore?: string;
    createdBy?: string;
    hasQuestionnaire?: boolean;
    hasSessions?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResponse<Workshop>> {
    try {
      const response = await this.api.get('/', { params: filters });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get workshop by ID with full details
   */
  async getWorkshop(id: string): Promise<Workshop> {
    try {
      const response = await this.api.get(`/${id}`);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create new workshop
   */
  async createWorkshop(data: WorkshopFormData): Promise<Workshop> {
    try {
      const response = await this.api.post('/', data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update existing workshop
   */
  async updateWorkshop(id: string, data: Partial<WorkshopFormData>): Promise<Workshop> {
    try {
      const response = await this.api.patch(`/${id}`, data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete workshop (soft delete)
   */
  async deleteWorkshop(id: string): Promise<void> {
    try {
      await this.api.delete(`/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Publish workshop
   */
  async publishWorkshop(id: string): Promise<Workshop> {
    try {
      const response = await this.api.patch(`/${id}`, {
        status: 'published',
        publishedAt: new Date().toISOString()
      });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Unpublish workshop (set back to draft)
   */
  async unpublishWorkshop(id: string): Promise<Workshop> {
    try {
      const response = await this.api.patch(`/${id}`, {
        status: 'draft'
      });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get publishing checklist for workshop
   */
  async getPublishingChecklist(id: string): Promise<PublishingChecklist> {
    try {
      const response = await this.api.get(`/${id}/publish-checklist`);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Duplicate workshop
   */
  async duplicateWorkshop(id: string, newData: {
    slug: string;
    titleI18n: Record<string, string>;
  }): Promise<Workshop> {
    try {
      // First get the original workshop
      const original = await this.getWorkshop(id);

      // Create new workshop with copied data
      const duplicateData: WorkshopFormData = {
        ...original,
        ...newData,
        status: 'draft'
      };

      return await this.createWorkshop(duplicateData);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ===== SESSION MANAGEMENT =====

  /**
   * Get all sessions for a workshop
   */
  async getSessions(workshopId: string): Promise<WorkshopSession[]> {
    try {
      const response = await this.api.get(`/${workshopId}/sessions`);
      return response.data.data || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create new session
   */
  async createSession(workshopId: string, data: Omit<WorkshopSession, 'id' | 'workshopId' | 'createdAt' | 'updatedAt'>): Promise<WorkshopSession> {
    try {
      const response = await this.api.post(`/${workshopId}/sessions`, data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update session
   */
  async updateSession(workshopId: string, sessionId: string, data: Partial<WorkshopSession>): Promise<WorkshopSession> {
    try {
      const response = await this.api.patch(`/${workshopId}/sessions/${sessionId}`, data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete session
   */
  async deleteSession(workshopId: string, sessionId: string): Promise<void> {
    try {
      await this.api.delete(`/${workshopId}/sessions/${sessionId}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Reorder sessions
   */
  async reorderSessions(workshopId: string, sessionOrders: Array<{ id: string; order: number }>): Promise<WorkshopSession[]> {
    try {
      const response = await this.api.patch(`/${workshopId}/sessions/reorder`, { sessionOrders });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ===== MODULE MANAGEMENT =====

  /**
   * Get all modules for a session
   */
  async getModules(workshopId: string, sessionId: string): Promise<WorkshopModule[]> {
    try {
      const response = await this.api.get(`/${workshopId}/sessions/${sessionId}/modules`);
      return response.data.data || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create new module
   */
  async createModule(workshopId: string, sessionId: string, data: Omit<WorkshopModule, 'id' | 'sessionId' | 'createdAt' | 'updatedAt'>): Promise<WorkshopModule> {
    try {
      const response = await this.api.post(`/${workshopId}/sessions/${sessionId}/modules`, data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update module
   */
  async updateModule(workshopId: string, sessionId: string, moduleId: string, data: Partial<WorkshopModule>): Promise<WorkshopModule> {
    try {
      const response = await this.api.patch(`/${workshopId}/sessions/${sessionId}/modules/${moduleId}`, data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete module
   */
  async deleteModule(workshopId: string, sessionId: string, moduleId: string): Promise<void> {
    try {
      await this.api.delete(`/${workshopId}/sessions/${sessionId}/modules/${moduleId}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Reorder modules
   */
  async reorderModules(workshopId: string, sessionId: string, moduleOrders: Array<{ id: string; order: number }>): Promise<WorkshopModule[]> {
    try {
      const response = await this.api.patch(`/${workshopId}/sessions/${sessionId}/modules/reorder`, { moduleOrders });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Generate unique slug for workshop
   */
  async generateSlug(baseTitle: string): Promise<string> {
    try {
      const response = await this.api.post('/utils/generate-slug', { title: baseTitle });
      return response.data.data.slug;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Validate workshop data
   */
  async validateWorkshop(data: WorkshopFormData): Promise<{ isValid: boolean; errors: Record<string, string> }> {
    try {
      const response = await this.api.post('/utils/validate', data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Upload workshop image
   */
  async uploadImage(file: File): Promise<{ url: string; filename: string }> {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await this.api.post('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Export workshop data
   */
  async exportWorkshop(id: string, format: 'json' | 'pdf' = 'json'): Promise<Blob> {
    try {
      const response = await this.api.get(`/${id}/export`, {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Import workshop data
   */
  async importWorkshop(file: File): Promise<Workshop> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.api.post('/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// Create singleton instance
export const workshopService = new WorkshopService();
export default workshopService;