/**
 * Preview API Routes
 *
 * RESTful API endpoints for managing preview sessions,
 * real-time collaboration, and preview functionality
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { PreviewService } from '../../services/previewService';
import WebSocketAuthMiddleware from '../../middleware/websocketAuth';
import { logger } from '../../utils/logger';

const router = Router();

// Rate limiting for preview API
const previewRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: 'Too many preview requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all preview routes
router.use(previewRateLimit);

// Initialize preview service (will be injected by main app)
let previewService: PreviewService;

/**
 * Initialize preview routes with dependencies
 */
export function initializePreviewRoutes(service: PreviewService): Router {
  previewService = service;
  return router;
}

/**
 * Validation middleware
 */
const handleValidationErrors = (
  req: Request,
  res: Response,
  next: Function,
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

/**
 * @route   POST /api/v1/preview/sessions
 * @desc    Create a new preview session
 * @access  Private
 */
router.post(
  '/sessions',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.rateLimit(5),
  [
    body('type')
      .isIn(['workshop', 'questionnaire'])
      .withMessage('Type must be workshop or questionnaire'),
    body('resourceId').isUUID().withMessage('Resource ID must be a valid UUID'),
    body('title')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be 1-200 characters'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('initialContent')
      .optional()
      .isObject()
      .withMessage('Initial content must be an object'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      if (!req.websocketAuth) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { type, resourceId, title, description, initialContent } = req.body;
      const { userId, userEmail } = req.websocketAuth;

      const session = await previewService.createPreviewSession(
        type,
        resourceId,
        userId,
        title,
        description,
        initialContent,
      );

      logger.info(`Preview session created: ${session.id} by ${userEmail}`);

      res.status(201).json({
        success: true,
        data: session,
        message: 'Preview session created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating preview session:', error);
      res.status(500).json({
        error: 'Failed to create preview session',
        message: error.message,
      });
    }
  },
);

/**
 * @route   GET /api/v1/preview/sessions/:sessionId
 * @desc    Get preview session by ID
 * @access  Private
 */
router.get(
  '/sessions/:sessionId',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  [param('sessionId').isUUID().withMessage('Session ID must be a valid UUID')],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { userId } = req.websocketAuth!;

      const session = await previewService.getPreviewSession(sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'Preview session not found',
          message: 'The requested preview session does not exist',
        });
      }

      // Check if user has access to this session
      if (
        session.ownerId !== userId &&
        !session.collaborators.includes(userId)
      ) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to access this preview session',
        });
      }

      res.json({
        success: true,
        data: session,
      });
    } catch (error: any) {
      logger.error('Error getting preview session:', error);
      res.status(500).json({
        error: 'Failed to get preview session',
        message: error.message,
      });
    }
  },
);

/**
 * @route   PUT /api/v1/preview/sessions/:sessionId/content
 * @desc    Update preview session content
 * @access  Private
 */
router.put(
  '/sessions/:sessionId/content',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  WebSocketAuthMiddleware.checkCollaborationPermissions,
  [
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
    body('content').isObject().withMessage('Content must be an object'),
    body('changeDescription')
      .optional()
      .isString()
      .withMessage('Change description must be a string'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { content, changeDescription } = req.body;
      const { userId, userEmail } = req.websocketAuth!;

      const session = await previewService.updatePreviewContent(
        sessionId,
        content,
        userId,
        userEmail,
        changeDescription,
      );

      res.json({
        success: true,
        data: session,
        message: 'Preview content updated successfully',
      });
    } catch (error: any) {
      logger.error('Error updating preview content:', error);
      res.status(500).json({
        error: 'Failed to update preview content',
        message: error.message,
      });
    }
  },
);

/**
 * @route   PUT /api/v1/preview/sessions/:sessionId/settings
 * @desc    Update preview session settings
 * @access  Private
 */
router.put(
  '/sessions/:sessionId/settings',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  WebSocketAuthMiddleware.checkCollaborationPermissions,
  [
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
    body('settings').isObject().withMessage('Settings must be an object'),
    body('settings.mobilePreview')
      .optional()
      .isBoolean()
      .withMessage('mobilePreview must be boolean'),
    body('settings.tabletPreview')
      .optional()
      .isBoolean()
      .withMessage('tabletPreview must be boolean'),
    body('settings.deviceType')
      .optional()
      .isIn(['desktop', 'tablet', 'mobile'])
      .withMessage('Invalid device type'),
    body('settings.darkMode')
      .optional()
      .isBoolean()
      .withMessage('darkMode must be boolean'),
    body('settings.highContrast')
      .optional()
      .isBoolean()
      .withMessage('highContrast must be boolean'),
    body('settings.fontSize')
      .optional()
      .isIn(['small', 'medium', 'large'])
      .withMessage('Invalid font size'),
    body('settings.autoSave')
      .optional()
      .isBoolean()
      .withMessage('autoSave must be boolean'),
    body('settings.showInteractionHints')
      .optional()
      .isBoolean()
      .withMessage('showInteractionHints must be boolean'),
    body('settings.simulateParticipantView')
      .optional()
      .isBoolean()
      .withMessage('simulateParticipantView must be boolean'),
    body('settings.testMode')
      .optional()
      .isBoolean()
      .withMessage('testMode must be boolean'),
    body('settings.accessibilityMode')
      .optional()
      .isBoolean()
      .withMessage('accessibilityMode must be boolean'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { settings } = req.body;
      const { userId, userEmail } = req.websocketAuth!;

      const session = await previewService.updatePreviewSettings(
        sessionId,
        settings,
        userId,
        userEmail,
      );

      res.json({
        success: true,
        data: session,
        message: 'Preview settings updated successfully',
      });
    } catch (error: any) {
      logger.error('Error updating preview settings:', error);
      res.status(500).json({
        error: 'Failed to update preview settings',
        message: error.message,
      });
    }
  },
);

/**
 * @route   POST /api/v1/preview/sessions/:sessionId/collaborators
 * @desc    Add collaborator to preview session
 * @access  Private
 */
router.post(
  '/sessions/:sessionId/collaborators',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  WebSocketAuthMiddleware.checkOwnership('workshop'),
  [
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
    body('collaboratorId')
      .isUUID()
      .withMessage('Collaborator ID must be a valid UUID'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { collaboratorId } = req.body;

      await previewService.addCollaborator(sessionId, collaboratorId);

      res.json({
        success: true,
        message: 'Collaborator added successfully',
      });
    } catch (error: any) {
      logger.error('Error adding collaborator:', error);
      res.status(500).json({
        error: 'Failed to add collaborator',
        message: error.message,
      });
    }
  },
);

/**
 * @route   DELETE /api/v1/preview/sessions/:sessionId/collaborators/:collaboratorId
 * @desc    Remove collaborator from preview session
 * @access  Private
 */
router.delete(
  '/sessions/:sessionId/collaborators/:collaboratorId',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  WebSocketAuthMiddleware.checkOwnership('workshop'),
  [
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
    param('collaboratorId')
      .isUUID()
      .withMessage('Collaborator ID must be a valid UUID'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId, collaboratorId } = req.params;

      await previewService.removeCollaborator(sessionId, collaboratorId);

      res.json({
        success: true,
        message: 'Collaborator removed successfully',
      });
    } catch (error: any) {
      logger.error('Error removing collaborator:', error);
      res.status(500).json({
        error: 'Failed to remove collaborator',
        message: error.message,
      });
    }
  },
);

/**
 * @route   POST /api/v1/preview/sessions/:sessionId/analytics
 * @desc    Record analytics event for preview session
 * @access  Private
 */
router.post(
  '/sessions/:sessionId/analytics',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  [
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
    body('type')
      .isIn(['view', 'click', 'scroll', 'interaction', 'error', 'navigation'])
      .withMessage('Invalid event type'),
    body('data').isObject().withMessage('Event data must be an object'),
    body('element')
      .optional()
      .isString()
      .withMessage('Element must be a string'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { type, data, element } = req.body;
      const { userId } = req.websocketAuth!;

      await previewService.recordAnalyticsEvent(
        sessionId,
        type,
        userId,
        data,
        element,
      );

      res.json({
        success: true,
        message: 'Analytics event recorded successfully',
      });
    } catch (error: any) {
      logger.error('Error recording analytics event:', error);
      res.status(500).json({
        error: 'Failed to record analytics event',
        message: error.message,
      });
    }
  },
);

/**
 * @route   GET /api/v1/preview/sessions/:sessionId/analytics
 * @desc    Get analytics for preview session
 * @access  Private
 */
router.get(
  '/sessions/:sessionId/analytics',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  [param('sessionId').isUUID().withMessage('Session ID must be a valid UUID')],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { userId } = req.websocketAuth!;

      // Verify user has access to this session
      const session = await previewService.getPreviewSession(sessionId);
      if (
        !session ||
        (session.ownerId !== userId && !session.collaborators.includes(userId))
      ) {
        return res.status(403).json({
          error: 'Access denied',
          message:
            'You do not have permission to view analytics for this session',
        });
      }

      const analytics = await previewService.getPreviewAnalytics(sessionId);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      logger.error('Error getting preview analytics:', error);
      res.status(500).json({
        error: 'Failed to get preview analytics',
        message: error.message,
      });
    }
  },
);

/**
 * @route   POST /api/v1/preview/sessions/:sessionId/validate
 * @desc    Validate preview session content
 * @access  Private
 */
router.post(
  '/sessions/:sessionId/validate',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  WebSocketAuthMiddleware.checkCollaborationPermissions,
  [param('sessionId').isUUID().withMessage('Session ID must be a valid UUID')],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const session = await previewService.getPreviewSession(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'Preview session not found',
          message: 'The requested preview session does not exist',
        });
      }

      const errors = await previewService.validatePreviewContent(session);

      res.json({
        success: true,
        data: {
          errors,
          validationScore:
            errors.length === 0 ? 100 : Math.max(0, 100 - errors.length * 10),
          timestamp: new Date(),
        },
        message: 'Validation completed successfully',
      });
    } catch (error: any) {
      logger.error('Error validating preview session:', error);
      res.status(500).json({
        error: 'Failed to validate preview session',
        message: error.message,
      });
    }
  },
);

/**
 * @route   GET /api/v1/preview/sessions
 * @desc    Get all preview sessions for the authenticated user
 * @access  Private
 */
router.get(
  '/sessions',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  [
    query('type')
      .optional()
      .isIn(['workshop', 'questionnaire'])
      .withMessage('Invalid type filter'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.websocketAuth!;
      const { type, limit = 20, offset = 0 } = req.query;

      let sessions = await previewService.getUserPreviewSessions(userId);

      // Apply type filter if specified
      if (type) {
        sessions = sessions.filter(session => session.type === type);
      }

      // Apply pagination
      const paginatedSessions = sessions.slice(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string),
      );

      res.json({
        success: true,
        data: {
          sessions: paginatedSessions,
          pagination: {
            total: sessions.length,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore:
              parseInt(offset as string) + parseInt(limit as string) <
              sessions.length,
          },
        },
      });
    } catch (error: any) {
      logger.error('Error getting user preview sessions:', error);
      res.status(500).json({
        error: 'Failed to get preview sessions',
        message: error.message,
      });
    }
  },
);

/**
 * @route   DELETE /api/v1/preview/sessions/:sessionId
 * @desc    Delete preview session
 * @access  Private
 */
router.delete(
  '/sessions/:sessionId',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  WebSocketAuthMiddleware.checkOwnership('workshop'),
  [param('sessionId').isUUID().withMessage('Session ID must be a valid UUID')],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      await previewService.deletePreviewSession(sessionId);

      res.json({
        success: true,
        message: 'Preview session deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting preview session:', error);
      res.status(500).json({
        error: 'Failed to delete preview session',
        message: error.message,
      });
    }
  },
);

/**
 * @route   GET /api/v1/preview/sessions/:sessionId/export
 * @desc    Export preview session data
 * @access  Private
 */
router.get(
  '/sessions/:sessionId/export',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  [
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
    query('format')
      .optional()
      .isIn(['json', 'csv', 'pdf'])
      .withMessage('Invalid export format'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { format = 'json' } = req.query;
      const { userId } = req.websocketAuth!;

      // Get session and analytics
      const [session, analytics] = await Promise.all([
        previewService.getPreviewSession(sessionId),
        previewService.getPreviewAnalytics(sessionId),
      ]);

      if (
        !session ||
        (session.ownerId !== userId && !session.collaborators.includes(userId))
      ) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to export this session',
        });
      }

      const exportData = {
        session,
        analytics,
        exportedAt: new Date(),
        exportedBy: userId,
      };

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="preview-${sessionId}.json"`,
        );
        return res.json(exportData);
      } else {
        // For other formats, you would implement CSV or PDF generation
        return res.status(400).json({
          error: 'Export format not yet implemented',
          message: 'Currently only JSON export is supported',
        });
      }
    } catch (error: any) {
      logger.error('Error exporting preview session:', error);
      res.status(500).json({
        error: 'Failed to export preview session',
        message: error.message,
      });
    }
  },
);

/**
 * @route   POST /api/v1/preview/sessions/:sessionId/clone
 * @desc    Clone an existing preview session
 * @access  Private
 */
router.post(
  '/sessions/:sessionId/clone',
  WebSocketAuthMiddleware.verifyToken,
  WebSocketAuthMiddleware.validateSession,
  [
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
    body('title')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be 1-200 characters'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { title, description } = req.body;
      const { userId, userEmail } = req.websocketAuth!;

      // Get original session
      const originalSession = await previewService.getPreviewSession(sessionId);
      if (!originalSession) {
        return res.status(404).json({
          error: 'Preview session not found',
          message: 'The requested preview session does not exist',
        });
      }

      // Check if user has access to clone
      if (
        originalSession.ownerId !== userId &&
        !originalSession.collaborators.includes(userId)
      ) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to clone this session',
        });
      }

      // Create new session with cloned content
      const newSession = await previewService.createPreviewSession(
        originalSession.type,
        originalSession.resourceId,
        userId,
        title,
        description || `Cloned from: ${originalSession.title}`,
        originalSession.content,
      );

      // Copy settings
      await previewService.updatePreviewSettings(
        newSession.id,
        originalSession.settings,
        userId,
        userEmail,
      );

      res.status(201).json({
        success: true,
        data: newSession,
        message: 'Preview session cloned successfully',
      });
    } catch (error: any) {
      logger.error('Error cloning preview session:', error);
      res.status(500).json({
        error: 'Failed to clone preview session',
        message: error.message,
      });
    }
  },
);

export default router;
export { initializePreviewRoutes };
