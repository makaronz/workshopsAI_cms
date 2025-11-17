/**
 * Workshop Service using Unified API Client
 *
 * This service handles all workshop-related operations using the centralized
 * API client for consistent behavior, caching, and error handling.
 */

import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/api-config';

// Types
export interface Workshop {
  id: string;
  slug: string;
  titleI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  facilitatorId: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  metadata?: {
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    duration: number; // in minutes
    maxParticipants: number;
    tags: string[];
    prerequisites: string[];
    learningObjectives: string[];
    materials: string[];
  };
}

export interface WorkshopSession {
  id: string;
  workshopId: string;
  titleI18n: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  order: number;
  duration: number; // in minutes
  type: 'presentation' | 'activity' | 'discussion' | 'break' | 'assessment';
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopModule {
  id: string;
  sessionId: string;
  titleI18n: Record<string, string>;
  contentI18n: Record<string, string>;
  type: 'text' | 'image' | 'video' | 'interactive' | 'questionnaire';
  order: number;
  duration: number; // in minutes
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopFormData {
  slug: string;
  titleI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  facilitatorId: string;
  status: Workshop['status'];
  metadata?: Workshop['metadata'];
}

export interface PublishingChecklist {
  isValid: boolean;
  completedItems: string[];
  missingItems: string[];
  warnings: string[];
  canPublish: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface WorkshopFilters {
  status?: Workshop['status'];
  publishedAfter?: string;
  publishedBefore?: string;
  createdBy?: string;
  hasQuestionnaire?: boolean;
  hasSessions?: boolean;
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'publishedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Workshop Service
 */
export class WorkshopService {
  private static instance: WorkshopService;

  private constructor() {}

  public static getInstance(): WorkshopService {
    if (!WorkshopService.instance) {
      WorkshopService.instance = new WorkshopService();
    }
    return WorkshopService.instance;
  }

  /**
   * Get list of workshops with filtering and pagination
   */
  async getWorkshops(filters: WorkshopFilters = {}): Promise<PaginatedResponse<Workshop>> {
    console.log('📋 [WORKSHOPS] Fetching workshops with filters:', filters);

    try {
      const response = await apiClient.get<PaginatedResponse<Workshop>>(
        API_ENDPOINTS.WORKSHOPS.LIST,
        filters,
        {
          serviceType: 'workshops',
          skipCache: false // Enable caching for workshop lists
        }
      );

      console.log(`✅ [WORKSHOPS] Retrieved ${response.data.length} workshops`);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to fetch workshops:', {
        status: error.status,
        message: error.message,
        filters
      });

      throw new Error(error.message || 'Failed to fetch workshops');
    }
  }

  /**
   * Get workshop by ID with full details
   */
  async getWorkshop(id: string): Promise<Workshop> {
    console.log('🔍 [WORKSHOPS] Fetching workshop:', { id });

    try {
      const response = await apiClient.get<Workshop>(
        API_ENDPOINTS.WORKSHOPS.UPDATE(id),
        undefined,
        {
          serviceType: 'workshops',
          skipCache: false // Cache individual workshops
        }
      );

      console.log('✅ [WORKSHOPS] Retrieved workshop:', response.slug);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to fetch workshop:', {
        id,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to fetch workshop');
    }
  }

  /**
   * Create new workshop
   */
  async createWorkshop(data: WorkshopFormData): Promise<Workshop> {
    console.log('➕ [WORKSHOPS] Creating workshop:', { slug: data.slug });

    try {
      const response = await apiClient.post<Workshop>(
        API_ENDPOINTS.WORKSHOPS.CREATE,
        data,
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      // Clear workshop list cache
      apiClient.clearCache('workshops');

      console.log('✅ [WORKSHOPS] Created workshop:', response.slug);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to create workshop:', {
        slug: data.slug,
        status: error.status,
        message: error.message,
        details: error.details
      });

      throw new Error(error.message || 'Failed to create workshop');
    }
  }

  /**
   * Update existing workshop
   */
  async updateWorkshop(id: string, data: Partial<WorkshopFormData>): Promise<Workshop> {
    console.log('✏️ [WORKSHOPS] Updating workshop:', { id });

    try {
      const response = await apiClient.patch<Workshop>(
        API_ENDPOINTS.WORKSHOPS.UPDATE(id),
        data,
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      // Clear all workshop-related caches
      apiClient.clearCache('workshops');
      apiClient.clearCache(`workshops/${id}`);

      console.log('✅ [WORKSHOPS] Updated workshop:', response.slug);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to update workshop:', {
        id,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to update workshop');
    }
  }

  /**
   * Delete workshop (soft delete)
   */
  async deleteWorkshop(id: string): Promise<void> {
    console.log('🗑️ [WORKSHOPS] Deleting workshop:', { id });

    try {
      await apiClient.delete(
        API_ENDPOINTS.WORKSHOPS.DELETE(id),
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      // Clear all workshop-related caches
      apiClient.clearCache('workshops');
      apiClient.clearCache(`workshops/${id}`);

      console.log('✅ [WORKSHOPS] Deleted workshop:', { id });
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to delete workshop:', {
        id,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to delete workshop');
    }
  }

  /**
   * Publish workshop
   */
  async publishWorkshop(id: string): Promise<Workshop> {
    console.log('📢 [WORKSHOPS] Publishing workshop:', { id });

    try {
      const response = await apiClient.patch<Workshop>(
        API_ENDPOINTS.WORKSHOPS.PUBLISH(id),
        {
          status: 'published',
          publishedAt: new Date().toISOString()
        },
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      // Clear workshop caches
      apiClient.clearCache('workshops');
      apiClient.clearCache(`workshops/${id}`);

      console.log('✅ [WORKSHOPS] Published workshop:', response.slug);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to publish workshop:', {
        id,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to publish workshop');
    }
  }

  /**
   * Unpublish workshop (set back to draft)
   */
  async unpublishWorkshop(id: string): Promise<Workshop> {
    console.log('🔇 [WORKSHOPS] Unpublishing workshop:', { id });

    try {
      const response = await apiClient.patch<Workshop>(
        API_ENDPOINTS.WORKSHOPS.UPDATE(id),
        {
          status: 'draft'
        },
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      // Clear workshop caches
      apiClient.clearCache('workshops');
      apiClient.clearCache(`workshops/${id}`);

      console.log('✅ [WORKSHOPS] Unpublished workshop:', response.slug);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to unpublish workshop:', {
        id,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to unpublish workshop');
    }
  }

  /**
   * Get publishing checklist for workshop
   */
  async getPublishingChecklist(id: string): Promise<PublishingChecklist> {
    console.log('✅ [WORKSHOPS] Getting publishing checklist:', { id });

    try {
      const response = await apiClient.get<PublishingChecklist>(
        API_ENDPOINTS.WORKSHOPS.CHECKLIST(id),
        undefined,
        {
          serviceType: 'workshops',
          skipCache: false // Cache checklist briefly
        }
      );

      console.log('✅ [WORKSHOPS] Retrieved checklist:', {
        canPublish: response.canPublish,
        missingItems: response.missingItems.length
      });

      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to get publishing checklist:', {
        id,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to get publishing checklist');
    }
  }

  /**
   * Generate unique slug for workshop
   */
  async generateSlug(baseTitle: string): Promise<string> {
    console.log('🏷️ [WORKSHOPS] Generating slug for title:', { baseTitle });

    try {
      const response = await apiClient.post<{ slug: string }>(
        API_ENDPOINTS.WORKSHOPS.GENERATE_SLUG,
        { title: baseTitle },
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      console.log('✅ [WORKSHOPS] Generated slug:', response.slug);
      return response.slug;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to generate slug:', {
        baseTitle,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to generate slug');
    }
  }

  /**
   * Validate workshop data
   */
  async validateWorkshop(data: WorkshopFormData): Promise<{ isValid: boolean; errors: Record<string, string> }> {
    console.log('✅ [WORKSHOPS] Validating workshop data:', { slug: data.slug });

    try {
      const response = await apiClient.post<{ isValid: boolean; errors: Record<string, string> }>(
        API_ENDPOINTS.WORKSHOPS.VALIDATE,
        data,
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      console.log('✅ [WORKSHOPS] Validation result:', {
        isValid: response.isValid,
        errorsCount: Object.keys(response.errors).length
      });

      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to validate workshop:', {
        slug: data.slug,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to validate workshop');
    }
  }

  /**
   * Upload workshop image
   */
  async uploadImage(file: File, onProgress?: (progress: number) => void): Promise<{ url: string; filename: string }> {
    console.log('📤 [WORKSHOPS] Uploading image:', {
      fileName: file.name,
      fileSize: file.size
    });

    try {
      const response = await apiClient.upload<{ url: string; filename: string }>(
        API_ENDPOINTS.WORKSHOPS.UPLOAD_IMAGE,
        file,
        {
          serviceType: 'upload',
          ...(onProgress && { onProgress }),
          fieldName: 'image'
        }
      );

      console.log('✅ [WORKSHOPS] Uploaded image:', response.filename);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to upload image:', {
        fileName: file.name,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to upload image');
    }
  }

  /**
   * Export workshop data
   */
  async exportWorkshop(id: string, format: 'json' | 'pdf' = 'json'): Promise<Blob> {
    console.log('📤 [WORKSHOPS] Exporting workshop:', { id, format });

    try {
      const response = await apiClient.get(
        API_ENDPOINTS.WORKSHOPS.EXPORT(id),
        { format },
        {
          serviceType: 'workshops',
          skipCache: true,
          responseType: 'blob'
        }
      );

      console.log('✅ [WORKSHOPS] Exported workshop:', { id, format, size: response.size });
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to export workshop:', {
        id,
        format,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to export workshop');
    }
  }

  /**
   * Import workshop data
   */
  async importWorkshop(file: File, onProgress?: (progress: number) => void): Promise<Workshop> {
    console.log('📥 [WORKSHOPS] Importing workshop:', {
      fileName: file.name,
      fileSize: file.size
    });

    try {
      const response = await apiClient.upload<Workshop>(
        API_ENDPOINTS.WORKSHOPS.IMPORT,
        file,
        {
          serviceType: 'upload',
          ...(onProgress && { onProgress }),
          fieldName: 'file'
        }
      );

      // Clear workshop list cache after import
      apiClient.clearCache('workshops');

      console.log('✅ [WORKSHOPS] Imported workshop:', response.slug);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to import workshop:', {
        fileName: file.name,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to import workshop');
    }
  }

  // SESSION MANAGEMENT METHODS

  /**
   * Get all sessions for a workshop
   */
  async getSessions(workshopId: string): Promise<WorkshopSession[]> {
    console.log('📋 [WORKSHOPS] Fetching sessions:', { workshopId });

    try {
      const response = await apiClient.get<WorkshopSession[]>(
        API_ENDPOINTS.SESSIONS.BASE(workshopId),
        undefined,
        {
          serviceType: 'workshops',
          skipCache: false
        }
      );

      console.log(`✅ [WORKSHOPS] Retrieved ${response.length} sessions`);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to fetch sessions:', {
        workshopId,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to fetch sessions');
    }
  }

  /**
   * Create new session
   */
  async createSession(workshopId: string, data: Omit<WorkshopSession, 'id' | 'workshopId' | 'createdAt' | 'updatedAt'>): Promise<WorkshopSession> {
    console.log('➕ [WORKSHOPS] Creating session:', { workshopId, title: data.titleI18n });

    try {
      const response = await apiClient.post<WorkshopSession>(
        API_ENDPOINTS.SESSIONS.CREATE(workshopId),
        data,
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      // Clear workshop sessions cache
      apiClient.clearCache(`workshops/${workshopId}/sessions`);

      console.log('✅ [WORKSHOPS] Created session:', response.id);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to create session:', {
        workshopId,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to create session');
    }
  }

  /**
   * Update session
   */
  async updateSession(workshopId: string, sessionId: string, data: Partial<WorkshopSession>): Promise<WorkshopSession> {
    console.log('✏️ [WORKSHOPS] Updating session:', { workshopId, sessionId });

    try {
      const response = await apiClient.patch<WorkshopSession>(
        API_ENDPOINTS.SESSIONS.UPDATE(workshopId, sessionId),
        data,
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      // Clear session-related caches
      apiClient.clearCache(`workshops/${workshopId}/sessions`);

      console.log('✅ [WORKSHOPS] Updated session:', response.id);
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to update session:', {
        workshopId,
        sessionId,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to update session');
    }
  }

  /**
   * Delete session
   */
  async deleteSession(workshopId: string, sessionId: string): Promise<void> {
    console.log('🗑️ [WORKSHOPS] Deleting session:', { workshopId, sessionId });

    try {
      await apiClient.delete(
        API_ENDPOINTS.SESSIONS.DELETE(workshopId, sessionId),
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      // Clear session-related caches
      apiClient.clearCache(`workshops/${workshopId}/sessions`);

      console.log('✅ [WORKSHOPS] Deleted session:', { workshopId, sessionId });
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to delete session:', {
        workshopId,
        sessionId,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to delete session');
    }
  }

  /**
   * Reorder sessions
   */
  async reorderSessions(workshopId: string, sessionOrders: Array<{ id: string; order: number }>): Promise<WorkshopSession[]> {
    console.log('🔄 [WORKSHOPS] Reordering sessions:', { workshopId, count: sessionOrders.length });

    try {
      const response = await apiClient.patch<WorkshopSession[]>(
        API_ENDPOINTS.SESSIONS.REORDER(workshopId),
        { sessionOrders },
        {
          serviceType: 'workshops',
          skipCache: true
        }
      );

      // Clear session cache
      apiClient.clearCache(`workshops/${workshopId}/sessions`);

      console.log('✅ [WORKSHOPS] Reordered sessions');
      return response;
    } catch (error: any) {
      console.error('❌ [WORKSHOPS] Failed to reorder sessions:', {
        workshopId,
        status: error.status,
        message: error.message
      });

      throw new Error(error.message || 'Failed to reorder sessions');
    }
  }
}

// Export singleton instance
export const workshopService = WorkshopService.getInstance();

// Export types for backward compatibility
export type { WorkshopFormData, WorkshopFilters, PaginatedResponse };