/**
 * Preview API Tests
 *
 * Integration tests for preview API endpoints
 */

import request from 'supertest';
import express from 'express';
import { initializePreviewRoutes } from '../src/routes/api/preview';
import { PreviewService } from '../src/services/previewService';
import { WebSocketService } from '../src/services/websocketService';

// Mock dependencies
jest.mock('../src/services/websocketService');
jest.mock('../src/services/previewService');

describe('Preview API', () => {
  let app: express.Application;
  let mockPreviewService: jest.Mocked<PreviewService>;
  let mockWebSocketService: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock services
    mockWebSocketService = new WebSocketService({} as any) as jest.Mocked<WebSocketService>;
    mockPreviewService = new PreviewService(mockWebSocketService) as jest.Mocked<PreviewService>;

    // Setup routes
    const router = initializePreviewRoutes(mockPreviewService);
    app.use('/api/v1/preview', router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/preview/sessions', () => {
    it('should create a new preview session', async () => {
      const sessionData = {
        type: 'workshop',
        resourceId: 'test-workshop-id',
        title: 'Test Preview Session',
        description: 'Test Description'
      };

      const createdSession = {
        id: 'session-123',
        type: 'workshop',
        resourceId: 'test-workshop-id',
        ownerId: 'user-123',
        title: 'Test Preview Session',
        description: 'Test Description',
        content: {},
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

      mockPreviewService.createPreviewSession.mockResolvedValue(createdSession);

      const response = await request(app)
        .post('/api/v1/preview/sessions')
        .set('Authorization', 'Bearer valid-token')
        .send(sessionData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(createdSession);
      expect(mockPreviewService.createPreviewSession).toHaveBeenCalledWith(
        'workshop',
        'test-workshop-id',
        'user-123',
        'Test Preview Session',
        'Test Description',
        undefined
      );
    });

    it('should return validation error for missing fields', async () => {
      const invalidData = {
        type: 'workshop',
        // Missing resourceId and title
      };

      const response = await request(app)
        .post('/api/v1/preview/sessions')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/preview/sessions/:sessionId', () => {
    it('should retrieve preview session by ID', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        type: 'workshop',
        resourceId: 'workshop-123',
        ownerId: 'user-123',
        title: 'Test Session'
      };

      mockPreviewService.getPreviewSession.mockResolvedValue(mockSession);

      const response = await request(app)
        .get(`/api/v1/preview/sessions/${sessionId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSession);
      expect(mockPreviewService.getPreviewSession).toHaveBeenCalledWith(sessionId);
    });

    it('should return 404 for non-existent session', async () => {
      const sessionId = 'non-existent';

      mockPreviewService.getPreviewSession.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/preview/sessions/${sessionId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Preview session not found');
    });
  });

  describe('PUT /api/v1/preview/sessions/:sessionId/content', () => {
    it('should update preview session content', async () => {
      const sessionId = 'session-123';
      const updateData = {
        content: { sections: ['updated'] },
        changeDescription: 'Updated content'
      };

      const updatedSession = {
        id: sessionId,
        content: { sections: ['updated'] },
        updatedAt: new Date()
      };

      mockPreviewService.updatePreviewContent.mockResolvedValue(updatedSession);

      const response = await request(app)
        .put(`/api/v1/preview/sessions/${sessionId}/content`)
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedSession);
      expect(mockPreviewService.updatePreviewContent).toHaveBeenCalledWith(
        sessionId,
        updateData.content,
        'user-123',
        'user@example.com',
        'Updated content'
      );
    });
  });

  describe('PUT /api/v1/preview/sessions/:sessionId/settings', () => {
    it('should update preview session settings', async () => {
      const sessionId = 'session-123';
      const settingsData = {
        settings: {
          mobilePreview: true,
          darkMode: true,
          fontSize: 'large'
        }
      };

      const updatedSession = {
        id: sessionId,
        settings: {
          mobilePreview: true,
          darkMode: true,
          fontSize: 'large'
        },
        updatedAt: new Date()
      };

      mockPreviewService.updatePreviewSettings.mockResolvedValue(updatedSession);

      const response = await request(app)
        .put(`/api/v1/preview/sessions/${sessionId}/settings`)
        .set('Authorization', 'Bearer valid-token')
        .send(settingsData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedSession);
      expect(mockPreviewService.updatePreviewSettings).toHaveBeenCalledWith(
        sessionId,
        settingsData.settings,
        'user-123',
        'user@example.com'
      );
    });
  });

  describe('POST /api/v1/preview/sessions/:sessionId/collaborators', () => {
    it('should add collaborator to preview session', async () => {
      const sessionId = 'session-123';
      const collaboratorData = {
        collaboratorId: 'collaborator-123'
      };

      mockPreviewService.addCollaborator.mockResolvedValue(undefined);

      const response = await request(app)
        .post(`/api/v1/preview/sessions/${sessionId}/collaborators`)
        .set('Authorization', 'Bearer valid-token')
        .send(collaboratorData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Collaborator added successfully');
      expect(mockPreviewService.addCollaborator).toHaveBeenCalledWith(
        sessionId,
        'collaborator-123'
      );
    });
  });

  describe('DELETE /api/v1/preview/sessions/:sessionId/collaborators/:collaboratorId', () => {
    it('should remove collaborator from preview session', async () => {
      const sessionId = 'session-123';
      const collaboratorId = 'collaborator-123';

      mockPreviewService.removeCollaborator.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/v1/preview/sessions/${sessionId}/collaborators/${collaboratorId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Collaborator removed successfully');
      expect(mockPreviewService.removeCollaborator).toHaveBeenCalledWith(
        sessionId,
        collaboratorId
      );
    });
  });

  describe('POST /api/v1/preview/sessions/:sessionId/analytics', () => {
    it('should record analytics event', async () => {
      const sessionId = 'session-123';
      const eventData = {
        type: 'click',
        data: { element: 'button', action: 'test' },
        element: 'submit-button'
      };

      mockPreviewService.recordAnalyticsEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post(`/api/v1/preview/sessions/${sessionId}/analytics`)
        .set('Authorization', 'Bearer valid-token')
        .send(eventData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Analytics event recorded successfully');
      expect(mockPreviewService.recordAnalyticsEvent).toHaveBeenCalledWith(
        sessionId,
        'click',
        'user-123',
        eventData.data,
        'submit-button'
      );
    });
  });

  describe('GET /api/v1/preview/sessions/:sessionId/analytics', () => {
    it('should retrieve preview analytics', async () => {
      const sessionId = 'session-123';
      const mockAnalytics = {
        sessionId,
        events: [],
        engagement: {
          totalViews: 10,
          uniqueInteractions: 5,
          timeSpent: 120,
          dropOffPoints: [],
          completionRate: 80,
          userSatisfaction: 4
        },
        performance: {
          loadTime: 500,
          interactionLatency: 50,
          memoryUsage: 1024,
          renderingTime: 200,
          accessibilityCompliance: 95,
          mobileOptimization: 90
        },
        accessibility: {
          score: 95,
          issues: [],
          passes: [],
          timestamp: new Date()
        }
      };

      mockPreviewService.getPreviewSession.mockResolvedValue({
        id: sessionId,
        ownerId: 'user-123',
        collaborators: []
      } as any);
      mockPreviewService.getPreviewAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get(`/api/v1/preview/sessions/${sessionId}/analytics`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalytics);
      expect(mockPreviewService.getPreviewAnalytics).toHaveBeenCalledWith(sessionId);
    });

    it('should return 403 for unauthorized access to analytics', async () => {
      const sessionId = 'session-123';

      mockPreviewService.getPreviewSession.mockResolvedValue({
        id: sessionId,
        ownerId: 'other-user-123', // Different user
        collaborators: [] // User not in collaborators
      } as any);

      const response = await request(app)
        .get(`/api/v1/preview/sessions/${sessionId}/analytics`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('POST /api/v1/preview/sessions/:sessionId/validate', () => {
    it('should validate preview session content', async () => {
      const sessionId = 'session-123';
      const mockErrors = [
        {
          id: 'error-1',
          type: 'error',
          category: 'accessibility',
          message: 'Missing alt text for image',
          suggestion: 'Add descriptive alt text'
        }
      ];

      const mockSession = {
        id: sessionId,
        type: 'workshop',
        content: { sections: [] },
        settings: {}
      };

      mockPreviewService.getPreviewSession.mockResolvedValue(mockSession as any);
      mockPreviewService.validatePreviewContent.mockResolvedValue(mockErrors);

      const response = await request(app)
        .post(`/api/v1/preview/sessions/${sessionId}/validate`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.errors).toEqual(mockErrors);
      expect(response.body.data.validationScore).toBe(90); // 1 error * 10 points deduction
    });
  });

  describe('GET /api/v1/preview/sessions', () => {
    it('should retrieve user preview sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          type: 'workshop',
          title: 'Session 1',
          updatedAt: new Date('2023-01-02')
        },
        {
          id: 'session-2',
          type: 'questionnaire',
          title: 'Session 2',
          updatedAt: new Date('2023-01-01')
        }
      ];

      mockPreviewService.getUserPreviewSessions.mockResolvedValue(mockSessions as any);

      const response = await request(app)
        .get('/api/v1/preview/sessions')
        .set('Authorization', 'Bearer valid-token')
        .query({ limit: '10', offset: '0' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toEqual(mockSessions);
      expect(response.body.data.pagination).toEqual({
        total: 2,
        limit: 10,
        offset: 0,
        hasMore: false
      });
      expect(mockPreviewService.getUserPreviewSessions).toHaveBeenCalledWith('user-123');
    });

    it('should filter sessions by type', async () => {
      const mockWorkshopSessions = [
        {
          id: 'session-1',
          type: 'workshop',
          title: 'Workshop Session',
          updatedAt: new Date()
        }
      ];

      mockPreviewService.getUserPreviewSessions.mockResolvedValue(mockWorkshopSessions as any);

      const response = await request(app)
        .get('/api/v1/preview/sessions')
        .set('Authorization', 'Bearer valid-token')
        .query({ type: 'workshop' });

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.sessions[0].type).toBe('workshop');
    });
  });

  describe('DELETE /api/v1/preview/sessions/:sessionId', () => {
    it('should delete preview session', async () => {
      const sessionId = 'session-123';

      const mockSession = {
        id: sessionId,
        ownerId: 'user-123',
        type: 'workshop'
      };

      mockPreviewService.getPreviewSession.mockResolvedValue(mockSession as any);
      mockPreviewService.deletePreviewSession.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/v1/preview/sessions/${sessionId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Preview session deleted successfully');
      expect(mockPreviewService.deletePreviewSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('POST /api/v1/preview/sessions/:sessionId/clone', () => {
    it('should clone preview session', async () => {
      const sessionId = 'session-123';
      const cloneData = {
        title: 'Cloned Session',
        description: 'A copy of the original session'
      };

      const originalSession = {
        id: sessionId,
        ownerId: 'user-123',
        type: 'workshop',
        resourceId: 'workshop-123',
        content: { sections: ['test'] },
        settings: { mobilePreview: false }
      };

      const clonedSession = {
        id: 'cloned-123',
        type: 'workshop',
        resourceId: 'workshop-123',
        ownerId: 'user-123',
        title: 'Cloned Session',
        description: 'A copy of the original session',
        content: { sections: ['test'] },
        settings: { mobilePreview: false }
      };

      mockPreviewService.getPreviewSession.mockResolvedValue(originalSession as any);
      mockPreviewService.createPreviewSession.mockResolvedValue(clonedSession as any);
      mockPreviewService.updatePreviewSettings.mockResolvedValue(clonedSession as any);

      const response = await request(app)
        .post(`/api/v1/preview/sessions/${sessionId}/clone`)
        .set('Authorization', 'Bearer valid-token')
        .send(cloneData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(clonedSession);
      expect(response.body.message).toBe('Preview session cloned successfully');
    });
  });

  describe('GET /api/v1/preview/sessions/:sessionId/export', () => {
    it('should export preview session as JSON', async () => {
      const sessionId = 'session-123';

      const mockSession = {
        id: sessionId,
        type: 'workshop',
        ownerId: 'user-123',
        content: { sections: ['test'] },
        settings: {}
      };

      const mockAnalytics = {
        sessionId,
        events: [],
        engagement: {},
        performance: {},
        accessibility: {}
      };

      mockPreviewService.getPreviewSession.mockResolvedValue(mockSession as any);
      mockPreviewService.getPreviewAnalytics.mockResolvedValue(mockAnalytics as any);

      const response = await request(app)
        .get(`/api/v1/preview/sessions/${sessionId}/export`)
        .set('Authorization', 'Bearer valid-token')
        .query({ format: 'json' });

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('preview-session-123.json');
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return error for unsupported export format', async () => {
      const sessionId = 'session-123';

      const mockSession = {
        id: sessionId,
        type: 'workshop',
        ownerId: 'user-123'
      };

      mockPreviewService.getPreviewSession.mockResolvedValue(mockSession as any);

      const response = await request(app)
        .get(`/api/v1/preview/sessions/${sessionId}/export`)
        .set('Authorization', 'Bearer valid-token')
        .query({ format: 'pdf' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Export format not yet implemented');
    });
  });
});