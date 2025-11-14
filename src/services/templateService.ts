/**
 * Template Service - Backend API Integration
 * Comprehensive service for template management operations
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Template,
  WorkshopTemplate,
  QuestionnaireTemplate,
  TemplateFilter,
  TemplateSearch,
  TemplateSearchResult,
  TemplateUsage,
  TemplateShare,
  TemplateCollection,
  TemplateReview,
  TemplateComment,
  TemplateAuthor,
  SearchSort,
  TemplateCategory,
  TemplateType,
  TemplateStatus,
  TemplateDifficulty,
} from '../types/template';

// API Response Types
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    totalPages: number;
  };
}

export class TemplateService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor(baseURL = '/api/templates') {
    this.baseURL = baseURL;
    this.api = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for authentication
    this.api.interceptors.request.use(
      config => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => Promise.reject(error),
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      },
    );
  }

  // ========== TEMPLATE CRUD OPERATIONS ==========

  /**
   * Get all templates with filtering and pagination
   */
  async getTemplates(
    filter: TemplateFilter = {},
    page = 1,
    limit = 20,
    sort: SearchSort = 'newest',
  ): Promise<PaginatedResponse<Template>> {
    try {
      const response = await this.api.get('/templates', {
        params: {
          ...filter,
          page,
          limit,
          sort,
        },
      });
      return response.data;
    } catch (error) {
      this.handleError('Failed to fetch templates', error);
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<Template> {
    try {
      const response = await this.api.get(`/templates/${id}`);
      return response.data.data;
    } catch (error) {
      this.handleError(`Failed to fetch template ${id}`, error);
      throw error;
    }
  }

  /**
   * Get template by slug
   */
  async getTemplateBySlug(slug: string): Promise<Template> {
    try {
      const response = await this.api.get(`/templates/slug/${slug}`);
      return response.data.data;
    } catch (error) {
      this.handleError(`Failed to fetch template ${slug}`, error);
      throw error;
    }
  }

  /**
   * Create new workshop template
   */
  async createWorkshopTemplate(
    template: Partial<WorkshopTemplate>,
  ): Promise<WorkshopTemplate> {
    try {
      const response = await this.api.post('/templates/workshop', template);
      return response.data.data;
    } catch (error) {
      this.handleError('Failed to create workshop template', error);
      throw error;
    }
  }

  /**
   * Create new questionnaire template
   */
  async createQuestionnaireTemplate(
    template: Partial<QuestionnaireTemplate>,
  ): Promise<QuestionnaireTemplate> {
    try {
      const response = await this.api.post(
        '/templates/questionnaire',
        template,
      );
      return response.data.data;
    } catch (error) {
      this.handleError('Failed to create questionnaire template', error);
      throw error;
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    id: string,
    updates: Partial<Template>,
  ): Promise<Template> {
    try {
      const response = await this.api.put(`/templates/${id}`, updates);
      return response.data.data;
    } catch (error) {
      this.handleError(`Failed to update template ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete template (soft delete)
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      await this.api.delete(`/templates/${id}`);
    } catch (error) {
      this.handleError(`Failed to delete template ${id}`, error);
      throw error;
    }
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(
    id: string,
    newTitle?: { pl: string; en: string },
  ): Promise<Template> {
    try {
      const response = await this.api.post(`/templates/${id}/duplicate`, {
        newTitle,
      });
      return response.data.data;
    } catch (error) {
      this.handleError(`Failed to duplicate template ${id}`, error);
      throw error;
    }
  }

  // ========== TEMPLATE SEARCH AND DISCOVERY ==========

  /**
   * Search templates
   */
  async searchTemplates(search: TemplateSearch): Promise<TemplateSearchResult> {
    try {
      const response = await this.api.post('/templates/search', search);
      return response.data.data;
    } catch (error) {
      this.handleError('Failed to search templates', error);
      throw error;
    }
  }

  /**
   * Get template suggestions based on content
   */
  async getTemplateSuggestions(
    context: string,
    limit = 5,
  ): Promise<Template[]> {
    try {
      const response = await this.api.get('/templates/suggestions', {
        params: { context, limit },
      });
      return response.data.data || [];
    } catch (error) {
      this.handleError('Failed to get template suggestions', error);
      throw error;
    }
  }

  /**
   * Get popular/trending templates
   */
  async getPopularTemplates(
    limit = 10,
    timeframe = 'week',
  ): Promise<Template[]> {
    try {
      const response = await this.api.get('/templates/popular', {
        params: { limit, timeframe },
      });
      return response.data.data || [];
    } catch (error) {
      this.handleError('Failed to get popular templates', error);
      throw error;
    }
  }

  /**
   * Get featured templates
   */
  async getFeaturedTemplates(limit = 10): Promise<Template[]> {
    try {
      const response = await this.api.get('/templates/featured', {
        params: { limit },
      });
      return response.data.data || [];
    } catch (error) {
      this.handleError('Failed to get featured templates', error);
      throw error;
    }
  }

  /**
   * Get related templates
   */
  async getRelatedTemplates(
    templateId: string,
    limit = 5,
  ): Promise<Template[]> {
    try {
      const response = await this.api.get(`/templates/${templateId}/related`, {
        params: { limit },
      });
      return response.data.data || [];
    } catch (error) {
      this.handleError(
        `Failed to get related templates for ${templateId}`,
        error,
      );
      throw error;
    }
  }

  // ========== TEMPLATE CATEGORIES AND TAGS ==========

  /**
   * Get all template categories with counts
   */
  async getCategories(): Promise<Record<TemplateCategory, number>> {
    try {
      const response = await this.api.get('/templates/categories');
      return response.data.data;
    } catch (error) {
      this.handleError('Failed to get categories', error);
      throw error;
    }
  }

  /**
   * Get all tags with counts
   */
  async getTags(): Promise<Record<string, number>> {
    try {
      const response = await this.api.get('/templates/tags');
      return response.data.data;
    } catch (error) {
      this.handleError('Failed to get tags', error);
      throw error;
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    category: TemplateCategory,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Template>> {
    try {
      const response = await this.api.get(`/templates/category/${category}`, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      this.handleError(
        `Failed to get templates for category ${category}`,
        error,
      );
      throw error;
    }
  }

  // ========== TEMPLATE REVIEWS AND RATINGS ==========

  /**
   * Get template reviews
   */
  async getTemplateReviews(
    templateId: string,
    page = 1,
    limit = 10,
    sort: 'newest' | 'oldest' | 'rating' = 'newest',
  ): Promise<PaginatedResponse<TemplateReview>> {
    try {
      const response = await this.api.get(`/templates/${templateId}/reviews`, {
        params: { page, limit, sort },
      });
      return response.data;
    } catch (error) {
      this.handleError(
        `Failed to get reviews for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add template review
   */
  async addTemplateReview(
    templateId: string,
    review: Omit<
      TemplateReview,
      'id' | 'templateId' | 'reviewerId' | 'createdAt' | 'helpful'
    >,
  ): Promise<TemplateReview> {
    try {
      const response = await this.api.post(
        `/templates/${templateId}/reviews`,
        review,
      );
      return response.data.data;
    } catch (error) {
      this.handleError(
        `Failed to add review for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update template review
   */
  async updateTemplateReview(
    templateId: string,
    reviewId: string,
    updates: Partial<TemplateReview>,
  ): Promise<TemplateReview> {
    try {
      const response = await this.api.put(
        `/templates/${templateId}/reviews/${reviewId}`,
        updates,
      );
      return response.data.data;
    } catch (error) {
      this.handleError(
        `Failed to update review ${reviewId} for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete template review
   */
  async deleteTemplateReview(
    templateId: string,
    reviewId: string,
  ): Promise<void> {
    try {
      await this.api.delete(`/templates/${templateId}/reviews/${reviewId}`);
    } catch (error) {
      this.handleError(
        `Failed to delete review ${reviewId} for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Mark review as helpful
   */
  async markReviewHelpful(templateId: string, reviewId: string): Promise<void> {
    try {
      await this.api.post(
        `/templates/${templateId}/reviews/${reviewId}/helpful`,
      );
    } catch (error) {
      this.handleError(`Failed to mark review ${reviewId} as helpful`, error);
      throw error;
    }
  }

  // ========== TEMPLATE COMMENTS ==========

  /**
   * Get template comments
   */
  async getTemplateComments(
    templateId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<TemplateComment>> {
    try {
      const response = await this.api.get(`/templates/${templateId}/comments`, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      this.handleError(
        `Failed to get comments for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add template comment
   */
  async addTemplateComment(
    templateId: string,
    comment: Omit<
      TemplateComment,
      | 'id'
      | 'templateId'
      | 'authorId'
      | 'author'
      | 'createdAt'
      | 'updatedAt'
      | 'resolved'
    >,
  ): Promise<TemplateComment> {
    try {
      const response = await this.api.post(
        `/templates/${templateId}/comments`,
        comment,
      );
      return response.data.data;
    } catch (error) {
      this.handleError(
        `Failed to add comment for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update template comment
   */
  async updateTemplateComment(
    templateId: string,
    commentId: string,
    updates: Partial<TemplateComment>,
  ): Promise<TemplateComment> {
    try {
      const response = await this.api.put(
        `/templates/${templateId}/comments/${commentId}`,
        updates,
      );
      return response.data.data;
    } catch (error) {
      this.handleError(
        `Failed to update comment ${commentId} for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Resolve template comment
   */
  async resolveTemplateComment(
    templateId: string,
    commentId: string,
  ): Promise<void> {
    try {
      await this.api.post(
        `/templates/${templateId}/comments/${commentId}/resolve`,
      );
    } catch (error) {
      this.handleError(
        `Failed to resolve comment ${commentId} for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  // ========== TEMPLATE SHARING AND COLLABORATION ==========

  /**
   * Share template
   */
  async shareTemplate(
    templateId: string,
    shareData: Omit<
      TemplateShare,
      | 'id'
      | 'templateId'
      | 'sharedBy'
      | 'createdAt'
      | 'shareToken'
      | 'accessCount'
    >,
  ): Promise<TemplateShare> {
    try {
      const response = await this.api.post(
        `/templates/${templateId}/share`,
        shareData,
      );
      return response.data.data;
    } catch (error) {
      this.handleError(`Failed to share template ${templateId}`, error);
      throw error;
    }
  }

  /**
   * Get template shares
   */
  async getTemplateShares(templateId: string): Promise<TemplateShare[]> {
    try {
      const response = await this.api.get(`/templates/${templateId}/shares`);
      return response.data.data || [];
    } catch (error) {
      this.handleError(
        `Failed to get shares for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Revoke template share
   */
  async revokeTemplateShare(
    templateId: string,
    shareId: string,
  ): Promise<void> {
    try {
      await this.api.delete(`/templates/${templateId}/shares/${shareId}`);
    } catch (error) {
      this.handleError(
        `Failed to revoke share ${shareId} for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Access shared template
   */
  async accessSharedTemplate(shareToken: string): Promise<Template> {
    try {
      const response = await this.api.get(`/templates/shared/${shareToken}`);
      return response.data.data;
    } catch (error) {
      this.handleError(
        `Failed to access shared template with token ${shareToken}`,
        error,
      );
      throw error;
    }
  }

  // ========== TEMPLATE COLLECTIONS ==========

  /**
   * Get user's template collections
   */
  async getCollections(): Promise<TemplateCollection[]> {
    try {
      const response = await this.api.get('/collections');
      return response.data.data || [];
    } catch (error) {
      this.handleError('Failed to get collections', error);
      throw error;
    }
  }

  /**
   * Create template collection
   */
  async createCollection(
    collection: Omit<TemplateCollection, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TemplateCollection> {
    try {
      const response = await this.api.post('/collections', collection);
      return response.data.data;
    } catch (error) {
      this.handleError('Failed to create collection', error);
      throw error;
    }
  }

  /**
   * Update template collection
   */
  async updateCollection(
    id: string,
    updates: Partial<TemplateCollection>,
  ): Promise<TemplateCollection> {
    try {
      const response = await this.api.put(`/collections/${id}`, updates);
      return response.data.data;
    } catch (error) {
      this.handleError(`Failed to update collection ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete template collection
   */
  async deleteCollection(id: string): Promise<void> {
    try {
      await this.api.delete(`/collections/${id}`);
    } catch (error) {
      this.handleError(`Failed to delete collection ${id}`, error);
      throw error;
    }
  }

  /**
   * Add template to collection
   */
  async addToCollection(
    collectionId: string,
    templateId: string,
  ): Promise<void> {
    try {
      await this.api.post(`/collections/${collectionId}/templates`, {
        templateId,
      });
    } catch (error) {
      this.handleError(
        `Failed to add template ${templateId} to collection ${collectionId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove template from collection
   */
  async removeFromCollection(
    collectionId: string,
    templateId: string,
  ): Promise<void> {
    try {
      await this.api.delete(
        `/collections/${collectionId}/templates/${templateId}`,
      );
    } catch (error) {
      this.handleError(
        `Failed to remove template ${templateId} from collection ${collectionId}`,
        error,
      );
      throw error;
    }
  }

  // ========== TEMPLATE USAGE AND ANALYTICS ==========

  /**
   * Track template usage
   */
  async trackTemplateUsage(
    templateId: string,
    usage: Omit<TemplateUsage, 'id' | 'templateId' | 'startedAt'>,
  ): Promise<TemplateUsage> {
    try {
      const response = await this.api.post(
        `/templates/${templateId}/usage`,
        usage,
      );
      return response.data.data;
    } catch (error) {
      this.handleError(
        `Failed to track usage for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get template usage analytics
   */
  async getTemplateAnalytics(templateId: string): Promise<any> {
    try {
      const response = await this.api.get(`/templates/${templateId}/analytics`);
      return response.data.data;
    } catch (error) {
      this.handleError(
        `Failed to get analytics for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get user's template usage history
   */
  async getUserUsageHistory(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<TemplateUsage>> {
    try {
      const response = await this.api.get('/templates/usage/history', {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      this.handleError('Failed to get usage history', error);
      throw error;
    }
  }

  // ========== TEMPLATE IMPORT/EXPORT ==========

  /**
   * Export template
   */
  async exportTemplate(
    templateId: string,
    format: 'json' | 'pdf' = 'json',
  ): Promise<Blob> {
    try {
      const response = await this.api.get(`/templates/${templateId}/export`, {
        params: { format },
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      this.handleError(`Failed to export template ${templateId}`, error);
      throw error;
    }
  }

  /**
   * Import template
   */
  async importTemplate(
    file: File,
    metadata: {
      title: { pl: string; en: string };
      category: TemplateCategory;
      type: TemplateType;
    },
  ): Promise<Template> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));

      const response = await this.api.post('/templates/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    } catch (error) {
      this.handleError('Failed to import template', error);
      throw error;
    }
  }

  /**
   * Validate template file
   */
  async validateTemplateFile(
    file: File,
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.api.post('/templates/validate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    } catch (error) {
      this.handleError('Failed to validate template file', error);
      throw error;
    }
  }

  // ========== TEMPLATE VERSIONING ==========

  /**
   * Create template version
   */
  async createTemplateVersion(
    templateId: string,
    changes: string,
  ): Promise<{ version: string; createdAt: Date }> {
    try {
      const response = await this.api.post(
        `/templates/${templateId}/versions`,
        { changes },
      );
      return response.data.data;
    } catch (error) {
      this.handleError(
        `Failed to create version for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get template versions
   */
  async getTemplateVersions(
    templateId: string,
  ): Promise<Array<{ version: string; createdAt: Date; changes: string }>> {
    try {
      const response = await this.api.get(`/templates/${templateId}/versions`);
      return response.data.data || [];
    } catch (error) {
      this.handleError(
        `Failed to get versions for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Restore template version
   */
  async restoreTemplateVersion(
    templateId: string,
    version: string,
  ): Promise<Template> {
    try {
      const response = await this.api.post(
        `/templates/${templateId}/versions/${version}/restore`,
      );
      return response.data.data;
    } catch (error) {
      this.handleError(
        `Failed to restore version ${version} for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  // ========== UTILITY METHODS ==========

  /**
   * Generate template preview
   */
  async generatePreview(
    templateId: string,
    options: any = {},
  ): Promise<string> {
    try {
      const response = await this.api.post(
        `/templates/${templateId}/preview`,
        options,
      );
      return response.data.data.preview;
    } catch (error) {
      this.handleError(
        `Failed to generate preview for template ${templateId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Validate template structure
   */
  async validateTemplate(
    template: Partial<Template>,
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const response = await this.api.post('/templates/validate', template);
      return response.data.data;
    } catch (error) {
      this.handleError('Failed to validate template', error);
      throw error;
    }
  }

  /**
   * Get template authors
   */
  async getAuthors(): Promise<TemplateAuthor[]> {
    try {
      const response = await this.api.get('/templates/authors');
      return response.data.data || [];
    } catch (error) {
      this.handleError('Failed to get template authors', error);
      throw error;
    }
  }

  /**
   * Get templates by author
   */
  async getTemplatesByAuthor(
    authorId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Template>> {
    try {
      const response = await this.api.get(`/templates/author/${authorId}`, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      this.handleError(`Failed to get templates for author ${authorId}`, error);
      throw error;
    }
  }

  // ========== ERROR HANDLING ==========

  private handleError(message: string, error: any): void {
    console.error(`TemplateService Error: ${message}`, error);

    // Could implement more sophisticated error handling here:
    // - Send error to monitoring service
    // - Show user-friendly notifications
    // - Retry logic for transient errors
    // - Offline support

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error(message);
    }
  }

  // ========== CACHE MANAGEMENT ==========

  /**
   * Clear template cache
   */
  clearCache(): void {
    // Implement cache clearing logic
    // This could clear localStorage, sessionStorage, or memory cache
    localStorage.removeItem('template_cache');
  }

  /**
   * Get cached template
   */
  getCachedTemplate(id: string): Template | null {
    try {
      const cache = localStorage.getItem('template_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        return parsed[id] || null;
      }
    } catch (error) {
      console.warn('Failed to get cached template', error);
    }
    return null;
  }

  /**
   * Cache template
   */
  cacheTemplate(template: Template): void {
    try {
      const cache = localStorage.getItem('template_cache');
      let parsedCache: Record<string, Template> = {};

      if (cache) {
        parsedCache = JSON.parse(cache);
      }

      parsedCache[template.id] = template;
      localStorage.setItem('template_cache', JSON.stringify(parsedCache));
    } catch (error) {
      console.warn('Failed to cache template', error);
    }
  }
}

// Create and export singleton instance
export const templateService = new TemplateService();

// Export types for external use
export type { ApiResponse, PaginatedResponse };

// Helper functions for common operations
export const templateHelpers = {
  /**
   * Get default template filter
   */
  getDefaultFilter(): TemplateFilter {
    return {
      status: ['published'],
      featured: false,
    };
  },

  /**
   * Build search query from filter
   */
  buildSearchQuery(filter: TemplateFilter): string {
    const params = new URLSearchParams();

    if (filter.category?.length) {
      params.append('category', filter.category.join(','));
    }

    if (filter.type?.length) {
      params.append('type', filter.type.join(','));
    }

    if (filter.difficulty?.length) {
      params.append('difficulty', filter.difficulty.join(','));
    }

    if (filter.tags?.length) {
      params.append('tags', filter.tags.join(','));
    }

    return params.toString();
  },

  /**
   * Format template duration
   */
  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  },

  /**
   * Get template difficulty color
   */
  getDifficultyColor(difficulty: TemplateDifficulty): string {
    const colors = {
      beginner: 'green',
      intermediate: 'yellow',
      advanced: 'orange',
      expert: 'red',
    };
    return colors[difficulty] || 'gray';
  },

  /**
   * Generate template URL
   */
  getTemplateUrl(template: Template): string {
    return `/templates/${template.slug}`;
  },
};

export default templateService;
