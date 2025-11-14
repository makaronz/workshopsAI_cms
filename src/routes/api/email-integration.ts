import { Router, Request, Response } from 'express';
import { workshopEmailService } from '../../services/workshopEmailService';
import { emailAnalyticsService } from '../../services/emailAnalyticsService';
import { emailValidationService } from '../../services/emailValidationService';
import { emailRateLimitService } from '../../services/emailRateLimitService';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Workshop email integration endpoints
router.post(
  '/workshop/:workshopId/invite',
  [
    param('workshopId').isUUID().withMessage('Valid workshop ID is required'),
    body('emails').isArray().withMessage('Emails array is required'),
    body('emails.*')
      .isEmail()
      .withMessage('Valid email addresses are required'),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('scheduledAt').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { workshopId } = req.params;
      const { emails, priority, scheduledAt } = req.body;

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (const email of emails) {
        const result = await workshopEmailService.sendWorkshopInvitation(
          workshopId,
          email,
          {
            priority,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          },
        );

        results.push({
          email,
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        });

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      }

      res.json({
        success: failureCount === 0,
        summary: {
          total: emails.length,
          success: successCount,
          failed: failureCount,
        },
        results,
      });
    } catch (error) {
      console.error('Failed to send workshop invitations:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to send invitations',
      });
    }
  },
);

// Send session reminders
router.post(
  '/workshop/:workshopId/session/:sessionId/remind',
  [
    param('workshopId').isUUID().withMessage('Valid workshop ID is required'),
    param('sessionId').isUUID().withMessage('Valid session ID is required'),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('immediate').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { workshopId, sessionId } = req.params;
      const { priority, immediate } = req.body;

      const result = await workshopEmailService.sendSessionReminders(
        workshopId,
        sessionId,
        {
          priority,
          immediate,
        },
      );

      res.json({
        success: result.success,
        summary: {
          sent: result.sent,
          failed: result.failed,
        },
        errors: result.errors,
      });
    } catch (error) {
      console.error('Failed to send session reminders:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to send reminders',
      });
    }
  },
);

// Send questionnaire reminders
router.post(
  '/questionnaire/:questionnaireId/remind',
  [
    param('questionnaireId')
      .isUUID()
      .withMessage('Valid questionnaire ID is required'),
    body('workshopId')
      .optional()
      .isUUID()
      .withMessage('Valid workshop ID is required'),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('immediate').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { questionnaireId } = req.params;
      const { workshopId, priority, immediate } = req.body;

      const result = await workshopEmailService.sendQuestionnaireReminder(
        questionnaireId,
        workshopId,
        {
          priority,
          immediate,
        },
      );

      res.json({
        success: result.success,
        summary: {
          sent: result.sent,
          failed: result.failed,
        },
        errors: result.errors,
      });
    } catch (error) {
      console.error('Failed to send questionnaire reminders:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to send reminders',
      });
    }
  },
);

// Send workshop updates
router.post(
  '/workshop/:workshopId/update',
  [
    param('workshopId').isUUID().withMessage('Valid workshop ID is required'),
    body('updateType')
      .isIn([
        'schedule_change',
        'location_change',
        'content_update',
        'cancellation',
      ])
      .withMessage('Valid update type is required'),
    body('updateDetails').isObject().withMessage('Update details are required'),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('immediate').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { workshopId } = req.params;
      const { updateType, updateDetails, priority, immediate } = req.body;

      const result = await workshopEmailService.sendWorkshopUpdate(
        workshopId,
        updateType,
        updateDetails,
        {
          priority,
          immediate,
        },
      );

      res.json({
        success: result.success,
        summary: {
          sent: result.sent,
          failed: result.failed,
        },
        errors: result.errors,
      });
    } catch (error) {
      console.error('Failed to send workshop update:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send update',
      });
    }
  },
);

// Schedule automated reminders for a workshop
router.post(
  '/workshop/:workshopId/schedule-reminders',
  [param('workshopId').isUUID().withMessage('Valid workshop ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { workshopId } = req.params;

      await workshopEmailService.scheduleAutomatedReminders(workshopId);

      res.json({
        success: true,
        message: 'Automated reminders scheduled successfully',
      });
    } catch (error) {
      console.error('Failed to schedule automated reminders:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to schedule reminders',
      });
    }
  },
);

// Validate email address
router.post(
  '/validate-email',
  [body('email').isEmail().withMessage('Valid email address is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { email } = req.body;

      const result = await emailValidationService.validateEmail(email);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error('Failed to validate email:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to validate email',
      });
    }
  },
);

// Get email analytics
router.get(
  '/analytics',
  [
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { startDate, endDate } = req.query;

      const analytics = await emailAnalyticsService.generateReport(
        startDate
          ? new Date(startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to last 30 days
        endDate ? new Date(endDate as string) : new Date(),
      );

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Failed to get email analytics:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get analytics',
      });
    }
  },
);

// Get rate limit status
router.get(
  '/rate-limit/status/:identifier',
  [param('identifier').notEmpty().withMessage('Identifier is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { identifier } = req.params;

      const status = await emailRateLimitService.getRateLimitStatus(identifier);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get rate limit status',
      });
    }
  },
);

// Reset rate limit
router.post(
  '/rate-limit/reset/:identifier',
  [
    param('identifier').notEmpty().withMessage('Identifier is required'),
    body('rule').optional().isString().withMessage('Rule must be a string'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { identifier } = req.params;
      const { rule } = req.body;

      if (rule) {
        await emailRateLimitService.resetRateLimit(rule, identifier);
      } else {
        await emailRateLimitService.resetAllRateLimits(identifier);
      }

      res.json({
        success: true,
        message: rule
          ? `Rate limit reset for rule: ${rule}`
          : 'All rate limits reset',
      });
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to reset rate limit',
      });
    }
  },
);

// Blacklist email
router.post(
  '/blacklist',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('reason')
      .isIn([
        'bounced',
        'complained',
        'spam',
        'unsubscribed',
        'blocked',
        'admin',
      ])
      .withMessage('Valid reason is required'),
    body('providerReason').optional().isString(),
    body('blockedBy').optional().isInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { email, reason, providerReason, blockedBy } = req.body;

      await emailValidationService.blacklistEmail(
        email,
        reason,
        providerReason,
        blockedBy,
      );

      res.json({
        success: true,
        message: `Email ${email} has been blacklisted`,
      });
    } catch (error) {
      console.error('Failed to blacklist email:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to blacklist email',
      });
    }
  },
);

// Unblacklist email
router.post(
  '/unblacklist',
  [body('email').isEmail().withMessage('Valid email address is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { email } = req.body;

      await emailValidationService.unblacklistEmail(email);

      res.json({
        success: true,
        message: `Email ${email} has been unblacklisted`,
      });
    } catch (error) {
      console.error('Failed to unblacklist email:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to unblacklist email',
      });
    }
  },
);

export default router;
