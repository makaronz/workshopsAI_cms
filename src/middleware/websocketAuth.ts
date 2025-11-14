/**
 * WebSocket Authentication Middleware
 *
 * Provides authentication and authorization for WebSocket connections
 * with role-based access control and session validation
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedSocket } from '../services/websocketService';
import { redisService } from '../config/redis';
import { logger } from '../utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      websocketAuth?: {
        userId: string;
        userEmail: string;
        userRole: string;
        sessionId: string;
      };
    }
  }
}

export interface WebSocketAuthConfig {
  requiredRole?: string[];
  allowedRoles?: string[];
  requireOwnership?: boolean;
  resourceType?: 'workshop' | 'questionnaire' | 'preview';
}

export class WebSocketAuthMiddleware {
  /**
   * Middleware to verify WebSocket authentication token
   */
  static verifyToken = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      const token =
        req.headers.authorization?.replace('Bearer ', '') ||
        (req.headers['x-auth-token'] as string) ||
        (req.query.token as string);

      if (!token) {
        res.status(401).json({ error: 'Authentication token required' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      req.websocketAuth = {
        userId: decoded.id,
        userEmail: decoded.email,
        userRole: decoded.role,
        sessionId: (req.headers['x-session-id'] as string) || 'unknown',
      };

      next();
    } catch (error) {
      logger.warn('WebSocket token verification failed:', error);
      res.status(401).json({ error: 'Invalid authentication token' });
    }
  };

  /**
   * Middleware to check user role permissions
   */
  static checkRole = (config: WebSocketAuthConfig) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.websocketAuth) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { userRole } = req.websocketAuth;

      // Check if user has required role
      if (config.requiredRole && !config.requiredRole.includes(userRole)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          required: config.requiredRole,
          current: userRole,
        });
        return;
      }

      // Check if user role is allowed
      if (config.allowedRoles && !config.allowedRoles.includes(userRole)) {
        res.status(403).json({
          error: 'Role not allowed',
          allowed: config.allowedRoles,
          current: userRole,
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check resource ownership
   */
  static checkOwnership = (resourceType: 'workshop' | 'questionnaire') => {
    return async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      if (!req.websocketAuth) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        const resourceId =
          req.params.id || req.params.workshopId || req.params.questionnaireId;
        const { userId, userRole } = req.websocketAuth;

        // Admins and moderators can access any resource
        if (['admin', 'moderator'].includes(userRole)) {
          next();
          return;
        }

        // Check ownership based on resource type
        const isOwner = await this.verifyResourceOwnership(
          userId,
          resourceId,
          resourceType,
        );

        if (!isOwner) {
          res.status(403).json({
            error: 'Access denied',
            message: 'You do not have permission to access this resource',
          });
          return;
        }

        next();
      } catch (error) {
        logger.error('Error checking resource ownership:', error);
        res.status(500).json({ error: 'Failed to verify permissions' });
      }
    };
  };

  /**
   * Middleware to check preview access permissions
   */
  static checkPreviewAccess = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.websocketAuth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const { workshopId, questionnaireId } = req.body;
      const { userId, userRole } = req.websocketAuth;

      // Admins and moderators can preview any content
      if (['admin', 'moderator'].includes(userRole)) {
        next();
        return;
      }

      // Check if user has access to the specific resource
      let hasAccess = false;

      if (workshopId) {
        hasAccess = await this.verifyWorkshopAccess(userId, workshopId);
      } else if (questionnaireId) {
        hasAccess = await this.verifyQuestionnaireAccess(
          userId,
          questionnaireId,
        );
      }

      if (!hasAccess) {
        res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to preview this content',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Error checking preview access:', error);
      res.status(500).json({ error: 'Failed to verify preview access' });
    }
  };

  /**
   * Middleware to rate limit WebSocket connections
   */
  static rateLimit = (maxConnections: number = 10) => {
    return async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      if (!req.websocketAuth) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        const { userId } = req.websocketAuth;
        const key = `ws_connections:${userId}`;
        const current = await redisService.getClient().get(key);

        if (current && parseInt(current) >= maxConnections) {
          res.status(429).json({
            error: 'Too many connections',
            message: `Maximum ${maxConnections} WebSocket connections allowed per user`,
          });
          return;
        }

        // Increment connection counter
        const newCount = current ? parseInt(current) + 1 : 1;
        await redisService.getClient().setex(key, 3600, newCount.toString()); // 1 hour expiry

        next();
      } catch (error) {
        logger.error('Error in WebSocket rate limiting:', error);
        next(); // Continue on error to not break functionality
      }
    };
  };

  /**
   * Middleware to validate session
   */
  static validateSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.websocketAuth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const { sessionId, userId } = req.websocketAuth;
      const sessionKey = `session:${sessionId}`;

      const sessionData = await redisService.getClient().get(sessionKey);

      if (!sessionData) {
        res.status(401).json({
          error: 'Invalid session',
          message: 'Session expired or invalid',
        });
        return;
      }

      const session = JSON.parse(sessionData);

      // Verify session belongs to the same user
      if (session.userId !== userId) {
        res.status(401).json({
          error: 'Session mismatch',
          message: 'Session does not belong to authenticated user',
        });
        return;
      }

      // Update session activity
      session.lastActivity = new Date().toISOString();
      await redisService
        .getClient()
        .setex(sessionKey, 3600, JSON.stringify(session));

      next();
    } catch (error) {
      logger.error('Error validating session:', error);
      res.status(500).json({ error: 'Failed to validate session' });
    }
  };

  /**
   * Middleware to check collaboration permissions
   */
  static checkCollaborationPermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.websocketAuth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const { workshopId, questionnaireId } = req.body;
      const { userId, userRole } = req.websocketAuth;

      // Admins and moderators can collaborate on any content
      if (['admin', 'moderator'].includes(userRole)) {
        next();
        return;
      }

      // Check if user is a collaborator on the resource
      let isCollaborator = false;

      if (workshopId) {
        isCollaborator = await this.verifyCollaboratorAccess(
          userId,
          workshopId,
          'workshop',
        );
      } else if (questionnaireId) {
        isCollaborator = await this.verifyCollaboratorAccess(
          userId,
          questionnaireId,
          'questionnaire',
        );
      }

      if (!isCollaborator) {
        res.status(403).json({
          error: 'Collaboration access denied',
          message: 'You are not authorized to collaborate on this content',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Error checking collaboration permissions:', error);
      res
        .status(500)
        .json({ error: 'Failed to verify collaboration permissions' });
    }
  };

  /**
   * Helper method to verify resource ownership
   */
  private static async verifyResourceOwnership(
    userId: string,
    resourceId: string,
    resourceType: 'workshop' | 'questionnaire',
  ): Promise<boolean> {
    try {
      // This would typically query your database
      // For now, using Redis as a cache/example
      const key = `${resourceType}:${resourceId}:owner`;
      const owner = await redisService.getClient().get(key);

      return owner === userId;
    } catch (error) {
      logger.error('Error verifying resource ownership:', error);
      return false;
    }
  }

  /**
   * Helper method to verify workshop access
   */
  private static async verifyWorkshopAccess(
    userId: string,
    workshopId: string,
  ): Promise<boolean> {
    try {
      // Check if user is owner or has been granted access
      const ownerKey = `workshop:${workshopId}:owner`;
      const accessKey = `workshop:${workshopId}:access:${userId}`;

      const [owner, hasAccess] = await Promise.all([
        redisService.getClient().get(ownerKey),
        redisService.getClient().get(accessKey),
      ]);

      return owner === userId || hasAccess === 'true';
    } catch (error) {
      logger.error('Error verifying workshop access:', error);
      return false;
    }
  }

  /**
   * Helper method to verify questionnaire access
   */
  private static async verifyQuestionnaireAccess(
    userId: string,
    questionnaireId: string,
  ): Promise<boolean> {
    try {
      // Check if user is owner or has been granted access
      const ownerKey = `questionnaire:${questionnaireId}:owner`;
      const accessKey = `questionnaire:${questionnaireId}:access:${userId}`;

      const [owner, hasAccess] = await Promise.all([
        redisService.getClient().get(ownerKey),
        redisService.getClient().get(accessKey),
      ]);

      return owner === userId || hasAccess === 'true';
    } catch (error) {
      logger.error('Error verifying questionnaire access:', error);
      return false;
    }
  }

  /**
   * Helper method to verify collaborator access
   */
  private static async verifyCollaboratorAccess(
    userId: string,
    resourceId: string,
    resourceType: 'workshop' | 'questionnaire',
  ): Promise<boolean> {
    try {
      const collaboratorKey = `${resourceType}:${resourceId}:collaborators`;
      const collaborators = await redisService
        .getClient()
        .smembers(collaboratorKey);

      return collaborators.includes(userId);
    } catch (error) {
      logger.error('Error verifying collaborator access:', error);
      return false;
    }
  }
}

export default WebSocketAuthMiddleware;
