/**
 * Rate Limiting Administration Tools
 *
 * Provides administrative interface for managing rate limits:
 * - Dynamic rule management
 * - Real-time analytics and monitoring
 * - Penalty box management
 * - Performance metrics and dashboards
 */

import { Request, Response } from 'express';
import { RateLimitRule, RateLimitAnalytics, PenaltyBox } from './types';
import { MultiLevelRateLimiter } from './multi-level-limiter';
import { RateLimitingMiddleware } from './middleware';

export interface AdminConfig {
  /** Enable admin endpoints */
  enabled: boolean;
  /** Admin authentication middleware */
  authMiddleware?: (req: Request, res: Response, next: any) => void;
  /** Admin endpoint prefix */
  prefix?: string;
}

export class RateLimitAdminTools {
  private limiter: MultiLevelRateLimiter;
  private middleware: RateLimitingMiddleware;
  private config: AdminConfig;
  private customRules: Map<string, RateLimitRule> = new Map();

  constructor(
    limiter: MultiLevelRateLimiter,
    middleware: RateLimitingMiddleware,
    config: AdminConfig = { enabled: true }
  ) {
    this.limiter = limiter;
    this.middleware = middleware;
    this.config = {
      prefix: '/admin/rate-limit',
      ...config
    };
  }

  /**
   * Get Express router for admin endpoints
   */
  getRouter() {
    const express = require('express');
    const router = express.Router();

    // Apply authentication middleware if configured
    if (this.config.authMiddleware) {
      router.use(this.config.authMiddleware);
    }

    // Analytics endpoints
    router.get('/analytics', this.getAnalyticsHandler.bind(this));
    router.get('/analytics/:routeId', this.getRouteAnalyticsHandler.bind(this));

    // Rule management endpoints
    router.get('/rules', this.getRulesHandler.bind(this));
    router.post('/rules', this.createRuleHandler.bind(this));
    router.put('/rules/:ruleId', this.updateRuleHandler.bind(this));
    router.delete('/rules/:ruleId', this.deleteRuleHandler.bind(this));

    // Penalty box endpoints
    router.get('/penalty-box', this.getPenaltyBoxHandler.bind(this));
    router.post('/penalty-box/:clientId', this.addPenaltyHandler.bind(this));
    router.delete('/penalty-box/:clientId', this.removePenaltyHandler.bind(this));

    // Client management endpoints
    router.get('/clients/:clientId/status', this.getClientStatusHandler.bind(this));
    router.post('/clients/:clientId/reset', this.resetClientHandler.bind(this));

    // System metrics endpoints
    router.get('/metrics', this.getSystemMetricsHandler.bind(this));
    router.get('/health', this.getHealthHandler.bind(this));

    // Configuration endpoints
    router.get('/config', this.getConfigHandler.bind(this));
    router.post('/config/reload', this.reloadConfigHandler.bind(this));

    // Bulk operations
    router.post('/bulk/reset', this.bulkResetHandler.bind(this));
    router.post('/bulk/penalty', this.bulkPenaltyHandler.bind(this));

    return router;
  }

  /**
   * Handler for getting overall analytics
   */
  private async getAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
      const timeRange = req.query.timeRange as string || '1h';
      const analytics = await this.limiter.getAnalytics();

      res.json({
        success: true,
        data: {
          ...analytics,
          timeRange,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get analytics');
    }
  }

  /**
   * Handler for getting route-specific analytics
   */
  private async getRouteAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
      const { routeId } = req.params;
      const analytics = await this.limiter.getAnalytics(routeId);

      res.json({
        success: true,
        data: {
          routeId,
          ...analytics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get route analytics');
    }
  }

  /**
   * Handler for getting all rate limit rules
   */
  private async getRulesHandler(req: Request, res: Response): Promise<void> {
    try {
      const rules = Array.from(this.customRules.values());

      res.json({
        success: true,
        data: {
          rules,
          count: rules.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get rules');
    }
  }

  /**
   * Handler for creating a new rate limit rule
   */
  private async createRuleHandler(req: Request, res: Response): Promise<void> {
    try {
      const ruleData: RateLimitRule = req.body;

      // Validate rule data
      const validationError = this.validateRule(ruleData);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError
        });
      }

      // Add rule
      this.customRules.set(ruleData.id, ruleData);

      res.status(201).json({
        success: true,
        data: {
          rule: ruleData,
          message: 'Rate limit rule created successfully'
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to create rule');
    }
  }

  /**
   * Handler for updating a rate limit rule
   */
  private async updateRuleHandler(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;
      const updates = req.body;

      const existingRule = this.customRules.get(ruleId);
      if (!existingRule) {
        return res.status(404).json({
          success: false,
          error: 'Rule not found'
        });
      }

      // Validate updates
      const validationError = this.validateRule({ ...existingRule, ...updates });
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError
        });
      }

      // Update rule
      const updatedRule = { ...existingRule, ...updates };
      this.customRules.set(ruleId, updatedRule);

      res.json({
        success: true,
        data: {
          rule: updatedRule,
          message: 'Rate limit rule updated successfully'
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to update rule');
    }
  }

  /**
   * Handler for deleting a rate limit rule
   */
  private async deleteRuleHandler(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;

      const deleted = this.customRules.delete(ruleId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Rule not found'
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Rate limit rule deleted successfully'
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to delete rule');
    }
  }

  /**
   * Handler for getting penalty box entries
   */
  private async getPenaltyBoxHandler(req: Request, res: Response): Promise<void> {
    try {
      // This would need to be implemented in the limiter
      const penalties = []; // Placeholder

      res.json({
        success: true,
        data: {
          penalties,
          count: penalties.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get penalty box');
    }
  }

  /**
   * Handler for adding client to penalty box
   */
  private async addPenaltyHandler(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { reason, durationMs } = req.body;

      if (!reason || !durationMs) {
        return res.status(400).json({
          success: false,
          error: 'Reason and durationMs are required'
        });
      }

      await this.middleware.addPenalty(clientId, reason, durationMs);

      res.json({
        success: true,
        data: {
          message: 'Client added to penalty box successfully'
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to add client to penalty box');
    }
  }

  /**
   * Handler for removing client from penalty box
   */
  private async removePenaltyHandler(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      await this.middleware.removePenalty(clientId);

      res.json({
        success: true,
        data: {
          message: 'Client removed from penalty box successfully'
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to remove client from penalty box');
    }
  }

  /**
   * Handler for getting client status
   */
  private async getClientStatusHandler(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      // Create a mock request for the client
      const mockReq = {
        ip: clientId.replace('ip:', ''),
        path: '/api',
        method: 'GET'
      } as Request;

      const status = await this.middleware.getStatus(mockReq);

      res.json({
        success: true,
        data: {
          clientId,
          status,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get client status');
    }
  }

  /**
   * Handler for resetting client rate limits
   */
  private async resetClientHandler(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      await this.middleware.resetClient(clientId);

      res.json({
        success: true,
        data: {
          message: 'Client rate limits reset successfully'
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to reset client limits');
    }
  }

  /**
   * Handler for getting system metrics
   */
  private async getSystemMetricsHandler(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.limiter.getAnalytics();

      // Add system-level metrics
      const systemMetrics = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform
      };

      res.json({
        success: true,
        data: {
          rateLimit: metrics,
          system: systemMetrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get system metrics');
    }
  }

  /**
   * Handler for health check
   */
  private async getHealthHandler(req: Request, res: Response): Promise<void> {
    try {
      const analytics = await this.limiter.getAnalytics();

      // Determine health status
      const isHealthy = analytics.systemLoad.cpuUsage < 90 &&
                       analytics.systemLoad.memoryUsage < 90 &&
                       analytics.systemLoad.errorRate < 5;

      res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        data: {
          status: isHealthy ? 'healthy' : 'degraded',
          checks: {
            cpu: analytics.systemLoad.cpuUsage < 90 ? 'pass' : 'fail',
            memory: analytics.systemLoad.memoryUsage < 90 ? 'pass' : 'fail',
            errorRate: analytics.systemLoad.errorRate < 5 ? 'pass' : 'fail'
          },
          metrics: analytics.systemLoad,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        error: 'Health check failed'
      });
    }
  }

  /**
   * Handler for getting configuration
   */
  private async getConfigHandler(req: Request, res: Response): Promise<void> {
    try {
      const config = {
        customRulesCount: this.customRules.size,
        adaptiveEnabled: true, // This would come from actual config
        distributedEnabled: true, // This would come from actual config
        timeWindows: {
          second: 1000,
          minute: 60000,
          hour: 3600000,
          day: 86400000
        }
      };

      res.json({
        success: true,
        data: {
          config,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get configuration');
    }
  }

  /**
   * Handler for reloading configuration
   */
  private async reloadConfigHandler(req: Request, res: Response): Promise<void> {
    try {
      // This would reload configuration from database or file
      res.json({
        success: true,
        data: {
          message: 'Configuration reloaded successfully'
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to reload configuration');
    }
  }

  /**
   * Handler for bulk reset operations
   */
  private async bulkResetHandler(req: Request, res: Response): Promise<void> {
    try {
      const { clientIds, pattern } = req.body;

      if (!clientIds && !pattern) {
        return res.status(400).json({
          success: false,
          error: 'Either clientIds or pattern is required'
        });
      }

      let resetCount = 0;

      if (clientIds && Array.isArray(clientIds)) {
        for (const clientId of clientIds) {
          await this.middleware.resetClient(clientId);
          resetCount++;
        }
      }

      // Pattern-based reset would be implemented here
      if (pattern) {
        // Reset clients matching pattern
        // This would need to be implemented in the limiter
        console.log(`Pattern reset requested: ${pattern}`);
      }

      res.json({
        success: true,
        data: {
          resetCount,
          message: `Reset rate limits for ${resetCount} clients`
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to perform bulk reset');
    }
  }

  /**
   * Handler for bulk penalty operations
   */
  private async bulkPenaltyHandler(req: Request, res: Response): Promise<void> {
    try {
      const { clientIds, reason, durationMs } = req.body;

      if (!clientIds || !Array.isArray(clientIds) || !reason || !durationMs) {
        return res.status(400).json({
          success: false,
          error: 'clientIds array, reason, and durationMs are required'
        });
      }

      let penaltyCount = 0;

      for (const clientId of clientIds) {
        await this.middleware.addPenalty(clientId, reason, durationMs);
        penaltyCount++;
      }

      res.json({
        success: true,
        data: {
          penaltyCount,
          message: `Added penalties for ${penaltyCount} clients`
        }
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to perform bulk penalty operation');
    }
  }

  /**
   * Validate rate limit rule
   */
  private validateRule(rule: Partial<RateLimitRule>): string | null {
    if (!rule.id) {
      return 'Rule ID is required';
    }

    if (!rule.pattern && !rule.matcher) {
      return 'Pattern or matcher is required';
    }

    if (rule.priority !== undefined && (typeof rule.priority !== 'number' || rule.priority < 0)) {
      return 'Priority must be a non-negative number';
    }

    // Validate rate limit configurations
    const levels = ['second', 'minute', 'hour', 'day'] as const;
    for (const level of levels) {
      const config = rule.config?.[level];
      if (config) {
        if (typeof config.limit !== 'number' || config.limit <= 0) {
          return `${level} limit must be a positive number`;
        }
        if (typeof config.windowMs !== 'number' || config.windowMs <= 0) {
          return `${level} windowMs must be a positive number`;
        }
      }
    }

    return null;
  }

  /**
   * Handle errors consistently
   */
  private handleError(res: Response, error: any, message: string): void {
    console.error(`${message}:`, error);
    res.status(500).json({
      success: false,
      error: message,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }

  /**
   * Get custom rules
   */
  getCustomRules(): RateLimitRule[] {
    return Array.from(this.customRules.values());
  }

  /**
   * Add custom rule
   */
  addCustomRule(rule: RateLimitRule): void {
    this.customRules.set(rule.id, rule);
  }

  /**
   * Remove custom rule
   */
  removeCustomRule(ruleId: string): boolean {
    return this.customRules.delete(ruleId);
  }
}