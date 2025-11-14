/**
 * Preview Service - State Management and Real-time Preview Functionality
 *
 * Manages preview sessions, state synchronization, and provides
 * comprehensive preview features for workshops and questionnaires
 */

import { v4 as uuidv4 } from 'uuid';
import { redisService } from '../config/redis';
import { db } from '../config/postgresql-database';
import { logger } from '../utils/logger';
import { WebSocketService } from './websocketService';

// Types for preview management
export interface PreviewSession {
  id: string;
  type: 'workshop' | 'questionnaire';
  resourceId: string;
  ownerId: string;
  title: string;
  description?: string;
  content: any;
  settings: PreviewSettings;
  metadata: PreviewMetadata;
  collaborators: string[];
  createdAt: Date;
  updatedAt: Date;
  lastAccessed: Date;
}

export interface PreviewSettings {
  mobilePreview: boolean;
  tabletPreview: boolean;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  darkMode: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  autoSave: boolean;
  showInteractionHints: boolean;
  simulateParticipantView: boolean;
  testMode: boolean;
  accessibilityMode: boolean;
}

export interface PreviewMetadata {
  version: string;
  changeHistory: PreviewChange[];
  performanceMetrics: PerformanceMetrics;
  accessibilityScore: number;
  lastValidated: Date;
  validationErrors: ValidationError[];
  tags: string[];
  category: string;
}

export interface PreviewChange {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail: string;
  type: 'content' | 'settings' | 'style' | 'structure';
  description: string;
  data: any;
}

export interface PerformanceMetrics {
  loadTime: number;
  interactionLatency: number;
  memoryUsage: number;
  renderingTime: number;
  accessibilityCompliance: number;
  mobileOptimization: number;
}

export interface ValidationError {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: 'accessibility' | 'performance' | 'content' | 'structure';
  message: string;
  element?: string;
  suggestion?: string;
  timestamp: Date;
}

export interface PreviewAnalytics {
  sessionId: string;
  events: PreviewEvent[];
  engagement: EngagementMetrics;
  performance: PerformanceMetrics;
  accessibility: AccessibilityReport;
}

export interface PreviewEvent {
  id: string;
  timestamp: Date;
  type: 'view' | 'click' | 'scroll' | 'interaction' | 'error' | 'navigation';
  element?: string;
  data: any;
  userId: string;
}

export interface EngagementMetrics {
  totalViews: number;
  uniqueInteractions: number;
  timeSpent: number;
  dropOffPoints: string[];
  completionRate: number;
  userSatisfaction: number;
}

export interface AccessibilityReport {
  score: number;
  issues: AccessibilityIssue[];
  passes: AccessibilityCheck[];
  timestamp: Date;
}

export interface AccessibilityIssue {
  type: 'error' | 'warning';
  category: 'wcag-a' | 'wcag-aa' | 'wcag-aaa';
  element: string;
  description: string;
  impact: string;
  suggestion: string;
}

export interface AccessibilityCheck {
  category: string;
  passed: boolean;
  description: string;
}

class PreviewService {
  private webSocketService: WebSocketService;
  private readonly PREVIEW_SESSION_TTL = 3600; // 1 hour
  private readonly PREVIEW_STATE_TTL = 1800; // 30 minutes
  private readonly ANALYTICS_RETENTION_DAYS = 30;

  constructor(webSocketService: WebSocketService) {
    this.webSocketService = webSocketService;
  }

  /**
   * Create a new preview session
   */
  async createPreviewSession(
    type: 'workshop' | 'questionnaire',
    resourceId: string,
    ownerId: string,
    title: string,
    description?: string,
    initialContent?: any,
  ): Promise<PreviewSession> {
    try {
      const sessionId = uuidv4();
      const now = new Date();

      const session: PreviewSession = {
        id: sessionId,
        type,
        resourceId,
        ownerId,
        title,
        description,
        content: initialContent || {},
        settings: {
          mobilePreview: false,
          tabletPreview: false,
          deviceType: 'desktop',
          darkMode: false,
          highContrast: false,
          fontSize: 'medium',
          autoSave: true,
          showInteractionHints: true,
          simulateParticipantView: false,
          testMode: false,
          accessibilityMode: false,
        },
        metadata: {
          version: '1.0.0',
          changeHistory: [],
          performanceMetrics: {
            loadTime: 0,
            interactionLatency: 0,
            memoryUsage: 0,
            renderingTime: 0,
            accessibilityCompliance: 0,
            mobileOptimization: 0,
          },
          accessibilityScore: 0,
          lastValidated: now,
          validationErrors: [],
          tags: [],
          category: type,
        },
        collaborators: [],
        createdAt: now,
        updatedAt: now,
        lastAccessed: now,
      };

      // Store session in Redis
      await this.storePreviewSession(session);

      // Log creation
      logger.info(
        `Created preview session: ${sessionId} for ${type}:${resourceId} by user ${ownerId}`,
      );

      // Notify collaborators if any
      await this.notifyCollaborators(sessionId, 'session_created', { session });

      return session;
    } catch (error) {
      logger.error('Error creating preview session:', error);
      throw new Error('Failed to create preview session');
    }
  }

  /**
   * Get preview session by ID
   */
  async getPreviewSession(sessionId: string): Promise<PreviewSession | null> {
    try {
      const sessionData = await redisService
        .getClient()
        .get(`preview_session:${sessionId}`);

      if (!sessionData) {
        return null;
      }

      const session: PreviewSession = JSON.parse(sessionData);

      // Update last accessed time
      session.lastAccessed = new Date();
      await this.storePreviewSession(session);

      return session;
    } catch (error) {
      logger.error('Error getting preview session:', error);
      return null;
    }
  }

  /**
   * Update preview session content
   */
  async updatePreviewContent(
    sessionId: string,
    content: any,
    userId: string,
    userEmail: string,
    changeDescription?: string,
  ): Promise<PreviewSession> {
    try {
      const session = await this.getPreviewSession(sessionId);
      if (!session) {
        throw new Error('Preview session not found');
      }

      // Record change in history
      const change: PreviewChange = {
        id: uuidv4(),
        timestamp: new Date(),
        userId,
        userEmail,
        type: 'content',
        description: changeDescription || 'Content updated',
        data: content,
      };

      session.content = { ...session.content, ...content };
      session.metadata.changeHistory.push(change);
      session.metadata.version = this.incrementVersion(
        session.metadata.version,
      );
      session.updatedAt = new Date();
      session.lastAccessed = new Date();

      // Store updated session
      await this.storePreviewSession(session);

      // Broadcast update to WebSocket room
      const roomId = this.getRoomId(session);
      this.webSocketService.broadcastToRoom(roomId, 'preview_content_updated', {
        sessionId,
        content: session.content,
        change,
        timestamp: new Date(),
      });

      // Run validation in background
      this.validatePreviewContent(session).catch(error => {
        logger.warn('Preview validation failed:', error);
      });

      logger.info(
        `Updated preview content for session: ${sessionId} by ${userEmail}`,
      );
      return session;
    } catch (error) {
      logger.error('Error updating preview content:', error);
      throw new Error('Failed to update preview content');
    }
  }

  /**
   * Update preview settings
   */
  async updatePreviewSettings(
    sessionId: string,
    settings: Partial<PreviewSettings>,
    userId: string,
    userEmail: string,
  ): Promise<PreviewSession> {
    try {
      const session = await this.getPreviewSession(sessionId);
      if (!session) {
        throw new Error('Preview session not found');
      }

      // Record settings change
      const change: PreviewChange = {
        id: uuidv4(),
        timestamp: new Date(),
        userId,
        userEmail,
        type: 'settings',
        description: 'Preview settings updated',
        data: settings,
      };

      session.settings = { ...session.settings, ...settings };
      session.metadata.changeHistory.push(change);
      session.updatedAt = new Date();
      session.lastAccessed = new Date();

      // Store updated session
      await this.storePreviewSession(session);

      // Broadcast settings change to WebSocket room
      const roomId = this.getRoomId(session);
      this.webSocketService.broadcastToRoom(
        roomId,
        'preview_settings_updated',
        {
          sessionId,
          settings: session.settings,
          change,
          timestamp: new Date(),
        },
      );

      logger.info(
        `Updated preview settings for session: ${sessionId} by ${userEmail}`,
      );
      return session;
    } catch (error) {
      logger.error('Error updating preview settings:', error);
      throw new Error('Failed to update preview settings');
    }
  }

  /**
   * Add collaborator to preview session
   */
  async addCollaborator(
    sessionId: string,
    collaboratorId: string,
  ): Promise<void> {
    try {
      const session = await this.getPreviewSession(sessionId);
      if (!session) {
        throw new Error('Preview session not found');
      }

      if (!session.collaborators.includes(collaboratorId)) {
        session.collaborators.push(collaboratorId);
        session.updatedAt = new Date();

        await this.storePreviewSession(session);

        // Notify collaborators
        const roomId = this.getRoomId(session);
        this.webSocketService.broadcastToRoom(roomId, 'collaborator_added', {
          sessionId,
          collaboratorId,
          timestamp: new Date(),
        });

        logger.info(
          `Added collaborator ${collaboratorId} to preview session: ${sessionId}`,
        );
      }
    } catch (error) {
      logger.error('Error adding collaborator:', error);
      throw new Error('Failed to add collaborator');
    }
  }

  /**
   * Remove collaborator from preview session
   */
  async removeCollaborator(
    sessionId: string,
    collaboratorId: string,
  ): Promise<void> {
    try {
      const session = await this.getPreviewSession(sessionId);
      if (!session) {
        throw new Error('Preview session not found');
      }

      const index = session.collaborators.indexOf(collaboratorId);
      if (index > -1) {
        session.collaborators.splice(index, 1);
        session.updatedAt = new Date();

        await this.storePreviewSession(session);

        // Notify collaborators
        const roomId = this.getRoomId(session);
        this.webSocketService.broadcastToRoom(roomId, 'collaborator_removed', {
          sessionId,
          collaboratorId,
          timestamp: new Date(),
        });

        logger.info(
          `Removed collaborator ${collaboratorId} from preview session: ${sessionId}`,
        );
      }
    } catch (error) {
      logger.error('Error removing collaborator:', error);
      throw new Error('Failed to remove collaborator');
    }
  }

  /**
   * Record preview analytics event
   */
  async recordAnalyticsEvent(
    sessionId: string,
    type: string,
    userId: string,
    data: any,
    element?: string,
  ): Promise<void> {
    try {
      const event: PreviewEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        type: type as any,
        element,
        data,
        userId,
      };

      // Store event in Redis list
      const key = `preview_analytics:${sessionId}`;
      await redisService.getClient().lpush(key, JSON.stringify(event));
      await redisService
        .getClient()
        .expire(key, this.ANALYTICS_RETENTION_DAYS * 24 * 60 * 60);

      // Update engagement metrics
      await this.updateEngagementMetrics(sessionId, event);

      // Broadcast real-time analytics to room
      const session = await this.getPreviewSession(sessionId);
      if (session) {
        const roomId = this.getRoomId(session);
        this.webSocketService.broadcastToRoom(roomId, 'analytics_event', {
          sessionId,
          event,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      logger.error('Error recording analytics event:', error);
    }
  }

  /**
   * Get preview analytics
   */
  async getPreviewAnalytics(sessionId: string): Promise<PreviewAnalytics> {
    try {
      const key = `preview_analytics:${sessionId}`;
      const eventData = await redisService.getClient().lrange(key, 0, -1);

      const events: PreviewEvent[] = eventData.map(data => JSON.parse(data));
      const engagement = this.calculateEngagementMetrics(events);
      const performance = await this.calculatePerformanceMetrics(sessionId);
      const accessibility = await this.runAccessibilityCheck(sessionId);

      return {
        sessionId,
        events,
        engagement,
        performance,
        accessibility,
      };
    } catch (error) {
      logger.error('Error getting preview analytics:', error);
      throw new Error('Failed to get preview analytics');
    }
  }

  /**
   * Validate preview content
   */
  async validatePreviewContent(
    session: PreviewSession,
  ): Promise<ValidationError[]> {
    try {
      const errors: ValidationError[] = [];

      // Content validation
      await this.validateContentStructure(session.content, errors);

      // Accessibility validation
      await this.validateAccessibility(session.content, errors);

      // Performance validation
      await this.validatePerformance(session.content, errors);

      // Update session with validation results
      session.metadata.validationErrors = errors;
      session.metadata.lastValidated = new Date();
      await this.storePreviewSession(session);

      // Broadcast validation results
      const roomId = this.getRoomId(session);
      this.webSocketService.broadcastToRoom(roomId, 'validation_completed', {
        sessionId: session.id,
        errors,
        timestamp: new Date(),
      });

      return errors;
    } catch (error) {
      logger.error('Error validating preview content:', error);
      return [];
    }
  }

  /**
   * Delete preview session
   */
  async deletePreviewSession(sessionId: string): Promise<void> {
    try {
      const session = await this.getPreviewSession(sessionId);
      if (session) {
        // Notify collaborators before deletion
        const roomId = this.getRoomId(session);
        this.webSocketService.broadcastToRoom(roomId, 'session_deleted', {
          sessionId,
          timestamp: new Date(),
        });

        // Delete from Redis
        await redisService.getClient().del(`preview_session:${sessionId}`);
        await redisService.getClient().del(`preview_analytics:${sessionId}`);

        logger.info(`Deleted preview session: ${sessionId}`);
      }
    } catch (error) {
      logger.error('Error deleting preview session:', error);
      throw new Error('Failed to delete preview session');
    }
  }

  /**
   * Get all preview sessions for a user
   */
  async getUserPreviewSessions(userId: string): Promise<PreviewSession[]> {
    try {
      const pattern = 'preview_session:*';
      const keys = await redisService.getClient().keys(pattern);
      const sessions: PreviewSession[] = [];

      for (const key of keys) {
        const sessionData = await redisService.getClient().get(key);
        if (sessionData) {
          const session: PreviewSession = JSON.parse(sessionData);
          if (
            session.ownerId === userId ||
            session.collaborators.includes(userId)
          ) {
            sessions.push(session);
          }
        }
      }

      return sessions.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    } catch (error) {
      logger.error('Error getting user preview sessions:', error);
      return [];
    }
  }

  // Private helper methods

  private async storePreviewSession(session: PreviewSession): Promise<void> {
    const key = `preview_session:${session.id}`;
    await redisService
      .getClient()
      .setex(key, this.PREVIEW_SESSION_TTL, JSON.stringify(session));
  }

  private getRoomId(session: PreviewSession): string {
    return `preview:${session.type}:${session.resourceId}`;
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private async notifyCollaborators(
    sessionId: string,
    event: string,
    data: any,
  ): Promise<void> {
    // Implementation for notifying collaborators
    // This would typically use email notifications or in-app notifications
  }

  private async validateContentStructure(
    content: any,
    errors: ValidationError[],
  ): Promise<void> {
    // Basic content structure validation
    if (!content || typeof content !== 'object') {
      errors.push({
        id: uuidv4(),
        type: 'error',
        category: 'content',
        message: 'Invalid content structure',
        suggestion: 'Ensure content is a valid object',
        timestamp: new Date(),
      });
    }
  }

  private async validateAccessibility(
    content: any,
    errors: ValidationError[],
  ): Promise<void> {
    // Accessibility validation logic
    // Check for alt text, headings, color contrast, etc.
  }

  private async validatePerformance(
    content: any,
    errors: ValidationError[],
  ): Promise<void> {
    // Performance validation logic
    // Check for large images, excessive DOM nodes, etc.
  }

  private async updateEngagementMetrics(
    sessionId: string,
    event: PreviewEvent,
  ): Promise<void> {
    const metricsKey = `preview_engagement:${sessionId}`;
    const current = await redisService.getClient().hgetall(metricsKey);

    const updated = {
      totalViews: (
        parseInt(current.totalViews || '0') + (event.type === 'view' ? 1 : 0)
      ).toString(),
      uniqueInteractions: (
        parseInt(current.uniqueInteractions || '0') +
        (event.type !== 'view' ? 1 : 0)
      ).toString(),
      lastEvent: new Date().toISOString(),
    };

    await redisService.getClient().hmset(metricsKey, updated);
    await redisService
      .getClient()
      .expire(metricsKey, this.ANALYTICS_RETENTION_DAYS * 24 * 60 * 60);
  }

  private calculateEngagementMetrics(
    events: PreviewEvent[],
  ): EngagementMetrics {
    const totalViews = events.filter(e => e.type === 'view').length;
    const uniqueInteractions = events.filter(e => e.type !== 'view').length;
    const timeSpent = this.calculateTimeSpent(events);
    const completionRate = this.calculateCompletionRate(events);

    return {
      totalViews,
      uniqueInteractions,
      timeSpent,
      dropOffPoints: [],
      completionRate,
      userSatisfaction: 0, // Would be calculated from user feedback
    };
  }

  private calculateTimeSpent(events: PreviewEvent[]): number {
    if (events.length < 2) return 0;

    const first = events[0].timestamp;
    const last = events[events.length - 1].timestamp;

    return (last.getTime() - first.getTime()) / 1000; // Convert to seconds
  }

  private calculateCompletionRate(events: PreviewEvent[]): number {
    // Simple completion rate calculation
    const totalSteps = 10; // Would be based on actual content structure
    const completedSteps = new Set(events.map(e => e.element)).size;

    return Math.min((completedSteps / totalSteps) * 100, 100);
  }

  private async calculatePerformanceMetrics(
    sessionId: string,
  ): Promise<PerformanceMetrics> {
    // In a real implementation, this would use actual performance data
    return {
      loadTime: 0,
      interactionLatency: 0,
      memoryUsage: 0,
      renderingTime: 0,
      accessibilityCompliance: 0,
      mobileOptimization: 0,
    };
  }

  private async runAccessibilityCheck(
    sessionId: string,
  ): Promise<AccessibilityReport> {
    // In a real implementation, this would use accessibility testing tools
    return {
      score: 0,
      issues: [],
      passes: [],
      timestamp: new Date(),
    };
  }
}

export { PreviewService };
