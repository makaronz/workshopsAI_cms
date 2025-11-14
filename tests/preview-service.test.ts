/**
 * Preview Service Tests
 *
 * Comprehensive test suite for the PreviewService functionality
 */

import { PreviewService } from '../src/services/previewService';
import { WebSocketService } from '../src/services/websocketService';
import { redisService } from '../src/config/redis';
import { logger } from '../src/utils/logger';

// Mock dependencies
jest.mock('../src/services/websocketService');
jest.mock('../src/config/redis');
jest.mock('../src/utils/logger');

describe('PreviewService', () => {
  let previewService: PreviewService;
  let mockWebSocketService: jest.Mocked<WebSocketService>;
  let mockRedisClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock WebSocketService
    mockWebSocketService = new WebSocketService({} as any) as jest.Mocked<WebSocketService>;
    mockWebSocketService.broadcastToRoom = jest.fn();
    mockWebSocketService.sendToUser = jest.fn();

    // Mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      hmget: jest.fn(),
      hmset: jest.fn(),
      expire: jest.fn(),
      smembers: jest.fn()
    };
    (redisService.getClient as jest.Mock) = jest.fn().mockReturnValue(mockRedisClient);

    // Create preview service instance
    previewService = new PreviewService(mockWebSocketService);
  });

  afterEach(async () => {
    // Clean up test data
    await previewService.deletePreviewSession('test-session-id');
  });

  describe('createPreviewSession', () => {
    it('should create a new preview session successfully', async () => {
      const sessionData = {
        type: 'workshop' as const,
        resourceId: 'test-workshop-id',
        ownerId: 'test-user-id',
        title: 'Test Preview Session',
        description: 'Test Description'
      };

      mockRedisClient.setex.mockResolvedValue('OK');

      const session = await previewService.createPreviewSession(
        sessionData.type,
        sessionData.resourceId,
        sessionData.ownerId,
        sessionData.title,
        sessionData.description
      );

      expect(session).toBeDefined();
      expect(session.type).toBe('workshop');
      expect(session.resourceId).toBe('test-workshop-id');
      expect(session.ownerId).toBe('test-user-id');
      expect(session.title).toBe('Test Preview Session');
      expect(session.description).toBe('Test Description');
      expect(session.settings).toBeDefined();
      expect(session.metadata).toBeDefined();
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should create session with initial content', async () => {
      const initialContent = { sections: ['test'], content: 'Hello World' };

      mockRedisClient.setex.mockResolvedValue('OK');

      const session = await previewService.createPreviewSession(
        'questionnaire',
        'test-questionnaire-id',
        'test-user-id',
        'Test Questionnaire',
        undefined,
        initialContent
      );

      expect(session.content).toEqual(initialContent);
    });
  });

  describe('getPreviewSession', () => {
    it('should retrieve an existing preview session', async () => {
      const mockSession = {
        id: 'test-session-id',
        type: 'workshop',
        resourceId: 'test-workshop-id',
        ownerId: 'test-user-id',
        title: 'Test Session',
        content: { test: 'data' },
        settings: {
          mobilePreview: false,
          tabletPreview: false,
          deviceType: 'desktop' as const,
          darkMode: false,
          highContrast: false,
          fontSize: 'medium' as const,
          autoSave: true,
          showInteractionHints: true,
          simulateParticipantView: false,
          testMode: false,
          accessibilityMode: false
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
            mobileOptimization: 0
          },
          accessibilityScore: 0,
          lastValidated: new Date(),
          validationErrors: [],
          tags: [],
          category: 'workshop'
        },
        collaborators: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date()
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedisClient.setex.mockResolvedValue('OK');

      const session = await previewService.getPreviewSession('test-session-id');

      expect(session).toBeDefined();
      expect(session?.id).toBe('test-session-id');
      expect(session?.type).toBe('workshop');
      expect(mockRedisClient.get).toHaveBeenCalledWith('preview_session:test-session-id');
    });

    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const session = await previewService.getPreviewSession('non-existent-id');

      expect(session).toBeNull();
    });
  });

  describe('updatePreviewContent', () => {
    it('should update preview content and broadcast changes', async () => {
      const mockSession = {
        id: 'test-session-id',
        type: 'workshop',
        resourceId: 'test-workshop-id',
        ownerId: 'test-user-id',
        title: 'Test Session',
        content: { sections: ['original'] },
        settings: {
          mobilePreview: false,
          tabletPreview: false,
          deviceType: 'desktop' as const,
          darkMode: false,
          highContrast: false,
          fontSize: 'medium' as const,
          autoSave: true,
          showInteractionHints: true,
          simulateParticipantView: false,
          testMode: false,
          accessibilityMode: false
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
            mobileOptimization: 0
          },
          accessibilityScore: 0,
          lastValidated: new Date(),
          validationErrors: [],
          tags: [],
          category: 'workshop'
        },
        collaborators: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date()
      };

      const newContent = { sections: ['updated'], content: 'Updated content' };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedisClient.setex.mockResolvedValue('OK');

      const updatedSession = await previewService.updatePreviewContent(
        'test-session-id',
        newContent,
        'test-user-id',
        'test@example.com',
        'Updated content'
      );

      expect(updatedSession.content).toEqual({
        sections: ['updated'],
        content: 'Updated content'
      });
      expect(updatedSession.metadata.changeHistory).toHaveLength(1);
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        'preview:workshop:test-workshop-id',
        'preview_content_updated',
        expect.any(Object)
      );
    });

    it('should throw error for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        previewService.updatePreviewContent(
          'non-existent-id',
          { content: 'test' },
          'test-user-id',
          'test@example.com'
        )
      ).rejects.toThrow('Preview session not found');
    });
  });

  describe('addCollaborator', () => {
    it('should add a collaborator to preview session', async () => {
      const mockSession = {
        id: 'test-session-id',
        type: 'workshop',
        resourceId: 'test-workshop-id',
        ownerId: 'test-user-id',
        title: 'Test Session',
        content: {},
        settings: {
          mobilePreview: false,
          tabletPreview: false,
          deviceType: 'desktop' as const,
          darkMode: false,
          highContrast: false,
          fontSize: 'medium' as const,
          autoSave: true,
          showInteractionHints: true,
          simulateParticipantView: false,
          testMode: false,
          accessibilityMode: false
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
            mobileOptimization: 0
          },
          accessibilityScore: 0,
          lastValidated: new Date(),
          validationErrors: [],
          tags: [],
          category: 'workshop'
        },
        collaborators: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date()
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedisClient.setex.mockResolvedValue('OK');

      await previewService.addCollaborator('test-session-id', 'collaborator-user-id');

      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        'preview:workshop:test-workshop-id',
        'collaborator_added',
        expect.any(Object)
      );
    });
  });

  describe('removeCollaborator', () => {
    it('should remove a collaborator from preview session', async () => {
      const mockSession = {
        id: 'test-session-id',
        type: 'workshop',
        resourceId: 'test-workshop-id',
        ownerId: 'test-user-id',
        title: 'Test Session',
        content: {},
        settings: {
          mobilePreview: false,
          tabletPreview: false,
          deviceType: 'desktop' as const,
          darkMode: false,
          highContrast: false,
          fontSize: 'medium' as const,
          autoSave: true,
          showInteractionHints: true,
          simulateParticipantView: false,
          testMode: false,
          accessibilityMode: false
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
            mobileOptimization: 0
          },
          accessibilityScore: 0,
          lastValidated: new Date(),
          validationErrors: [],
          tags: [],
          category: 'workshop'
        },
        collaborators: ['collaborator-user-id'],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date()
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedisClient.setex.mockResolvedValue('OK');

      await previewService.removeCollaborator('test-session-id', 'collaborator-user-id');

      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        'preview:workshop:test-workshop-id',
        'collaborator_removed',
        expect.any(Object)
      );
    });
  });

  describe('recordAnalyticsEvent', () => {
    it('should record analytics event and broadcast', async () => {
      mockRedisClient.lpush.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);
      mockRedisClient.hmget.mockResolvedValue(['5', '10']);

      const eventData = {
        element: 'button',
        action: 'click'
      };

      await previewService.recordAnalyticsEvent(
        'test-session-id',
        'click',
        'test-user-id',
        eventData,
        'button'
      );

      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        'preview_analytics:test-session-id',
        expect.stringContaining('click')
      );
    });
  });

  describe('getPreviewAnalytics', () => {
    it('should retrieve and calculate analytics', async () => {
      const mockEvent = {
        id: 'event-1',
        timestamp: new Date().toISOString(),
        type: 'click',
        element: 'button',
        data: { action: 'test' },
        userId: 'test-user-id'
      };

      mockRedisClient.lrange.mockResolvedValue([JSON.stringify(mockEvent)]);
      mockRedisClient.hmget.mockResolvedValue(['5', '10']);

      const analytics = await previewService.getPreviewAnalytics('test-session-id');

      expect(analytics).toBeDefined();
      expect(analytics.sessionId).toBe('test-session-id');
      expect(analytics.events).toHaveLength(1);
      expect(analytics.engagement).toBeDefined();
      expect(analytics.performance).toBeDefined();
      expect(analytics.accessibility).toBeDefined();
    });
  });

  describe('deletePreviewSession', () => {
    it('should delete preview session and cleanup', async () => {
      const mockSession = {
        id: 'test-session-id',
        type: 'workshop',
        resourceId: 'test-workshop-id',
        ownerId: 'test-user-id',
        title: 'Test Session',
        content: {},
        settings: {
          mobilePreview: false,
          tabletPreview: false,
          deviceType: 'desktop' as const,
          darkMode: false,
          highContrast: false,
          fontSize: 'medium' as const,
          autoSave: true,
          showInteractionHints: true,
          simulateParticipantView: false,
          testMode: false,
          accessibilityMode: false
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
            mobileOptimization: 0
          },
          accessibilityScore: 0,
          lastValidated: new Date(),
          validationErrors: [],
          tags: [],
          category: 'workshop'
        },
        collaborators: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date()
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedisClient.del.mockResolvedValue(1);

      await previewService.deletePreviewSession('test-session-id');

      expect(mockRedisClient.del).toHaveBeenCalledWith('preview_session:test-session-id');
      expect(mockRedisClient.del).toHaveBeenCalledWith('preview_analytics:test-session-id');
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        'preview:workshop:test-workshop-id',
        'session_deleted',
        expect.any(Object)
      );
    });
  });

  describe('getUserPreviewSessions', () => {
    it('should retrieve all preview sessions for a user', async () => {
      const mockSession1 = {
        id: 'session-1',
        ownerId: 'test-user-id',
        collaborators: [],
        updatedAt: new Date('2023-01-01')
      };

      const mockSession2 = {
        id: 'session-2',
        ownerId: 'other-user-id',
        collaborators: ['test-user-id'],
        updatedAt: new Date('2023-01-02')
      };

      const mockSession3 = {
        id: 'session-3',
        ownerId: 'other-user-id',
        collaborators: [],
        updatedAt: new Date('2023-01-03')
      };

      mockRedisClient.keys.mockResolvedValue([
        'preview_session:session-1',
        'preview_session:session-2',
        'preview_session:session-3'
      ]);

      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(mockSession1))
        .mockResolvedValueOnce(JSON.stringify(mockSession2))
        .mockResolvedValueOnce(JSON.stringify(mockSession3));

      const sessions = await previewService.getUserPreviewSessions('test-user-id');

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-2'); // Should be sorted by updated_at desc
      expect(sessions[1].id).toBe('session-1');
    });
  });

  describe('validatePreviewContent', () => {
    it('should validate content and return errors', async () => {
      const mockSession = {
        id: 'test-session-id',
        type: 'workshop',
        resourceId: 'test-workshop-id',
        ownerId: 'test-user-id',
        title: 'Test Session',
        content: {},
        settings: {
          mobilePreview: false,
          tabletPreview: false,
          deviceType: 'desktop' as const,
          darkMode: false,
          highContrast: false,
          fontSize: 'medium' as const,
          autoSave: true,
          showInteractionHints: true,
          simulateParticipantView: false,
          testMode: false,
          accessibilityMode: false
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
            mobileOptimization: 0
          },
          accessibilityScore: 0,
          lastValidated: new Date(),
          validationErrors: [],
          tags: [],
          category: 'workshop'
        },
        collaborators: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date()
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedisClient.setex.mockResolvedValue('OK');

      const errors = await previewService.validatePreviewContent(mockSession);

      expect(Array.isArray(errors)).toBe(true);
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        'preview:workshop:test-workshop-id',
        'validation_completed',
        expect.any(Object)
      );
    });
  });
});