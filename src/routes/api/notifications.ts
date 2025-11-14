import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { emailService } from '../../services/emailService';
import { emailQueueService } from '../../services/emailQueue';
import {
  db,
  emailLogs,
  emailConsents,
  emailBlacklist,
} from '../../models/postgresql-schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

const router = Router();

// Rate limiting for sending emails
const sendEmailRateLimit = rateLimit({
  windowMs: emailConfig.rateLimit.windowMs,
  max: emailConfig.rateLimit.maxRequests,
  message: {
    error: 'Too many email requests. Please try again later.',
  },
});

// Send email endpoint
router.post(
  '/send',
  sendEmailRateLimit,
  [
    body('to').isEmail().withMessage('Valid email address is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('type')
      .optional()
      .isIn([
        'workshop_invitation',
        'session_reminder',
        'questionnaire_reminder',
        'workshop_update',
        'account_verification',
        'password_reset',
        'completion_certificate',
        'enrollment_confirmation',
        'waiting_list_notification',
        'workshop_cancellation',
        'custom',
      ]),
    body('htmlContent').optional().isString(),
    body('textContent').optional().isString(),
    body('templateId').optional().isUUID(),
    body('templateData').optional().isObject(),
    body('userId').optional().isInt(),
    body('workshopId').optional().isUUID(),
    body('enrollmentId').optional().isUUID(),
    body('language').optional().isIn(['pl', 'en']),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('scheduledAt').optional().isISO8601().toDate(),
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

      const {
        to,
        subject,
        type,
        htmlContent,
        textContent,
        templateId,
        templateData,
        userId,
        workshopId,
        enrollmentId,
        language = 'pl',
        priority = 'normal',
        scheduledAt,
        immediate = false,
      } = req.body;

      const result = await emailService.sendEmail(
        {
          to,
          subject,
          type,
          htmlContent,
          textContent,
          templateId,
          templateData,
          userId,
          workshopId,
          enrollmentId,
          language,
          priority,
          scheduledAt,
        },
        { immediate },
      );

      res.json({
        success: true,
        messageId: result.messageId,
        providerMessageId: result.providerMessageId,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      });
    }
  },
);

// Send workshop invitation
router.post(
  '/workshop-invitation',
  sendEmailRateLimit,
  [
    body('to').isEmail().withMessage('Valid email address is required'),
    body('workshopId').isUUID().withMessage('Valid workshop ID is required'),
    body('workshop').isObject().withMessage('Workshop data is required'),
    body('userId').optional().isInt(),
    body('enrollmentId').optional().isUUID(),
    body('language').optional().isIn(['pl', 'en']),
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

      const {
        to,
        workshopId,
        workshop,
        userId,
        enrollmentId,
        language = 'pl',
        immediate = false,
      } = req.body;

      await emailService.sendWorkshopInvitation(to, workshop, {
        workshopId,
        userId,
        enrollmentId,
        language,
        priority: 'high',
      });

      res.json({
        success: true,
        message: 'Workshop invitation sent successfully',
      });
    } catch (error) {
      console.error('Failed to send workshop invitation:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send workshop invitation',
      });
    }
  },
);

// Send session reminder
router.post(
  '/session-reminder',
  sendEmailRateLimit,
  [
    body('to').isEmail().withMessage('Valid email address is required'),
    body('sessionId').isUUID().withMessage('Valid session ID is required'),
    body('session').isObject().withMessage('Session data is required'),
    body('workshop').isObject().withMessage('Workshop data is required'),
    body('userId').optional().isInt(),
    body('language').optional().isIn(['pl', 'en']),
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

      const {
        to,
        sessionId,
        session,
        workshop,
        userId,
        language = 'pl',
      } = req.body;

      await emailService.sendSessionReminder(to, session, workshop, {
        userId,
        language,
        priority: 'high',
      });

      res.json({
        success: true,
        message: 'Session reminder sent successfully',
      });
    } catch (error) {
      console.error('Failed to send session reminder:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send session reminder',
      });
    }
  },
);

// Send questionnaire reminder
router.post(
  '/questionnaire-reminder',
  sendEmailRateLimit,
  [
    body('to').isEmail().withMessage('Valid email address is required'),
    body('questionnaireId')
      .isUUID()
      .withMessage('Valid questionnaire ID is required'),
    body('questionnaire')
      .isObject()
      .withMessage('Questionnaire data is required'),
    body('userId').optional().isInt(),
    body('enrollmentId').optional().isUUID(),
    body('language').optional().isIn(['pl', 'en']),
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

      const {
        to,
        questionnaireId,
        questionnaire,
        userId,
        enrollmentId,
        language = 'pl',
      } = req.body;

      await emailService.sendQuestionnaireReminder(to, questionnaire, {
        userId,
        enrollmentId,
        language,
      });

      res.json({
        success: true,
        message: 'Questionnaire reminder sent successfully',
      });
    } catch (error) {
      console.error('Failed to send questionnaire reminder:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send questionnaire reminder',
      });
    }
  },
);

// Get email logs
router.get(
  '/logs',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type')
      .optional()
      .isIn([
        'workshop_invitation',
        'session_reminder',
        'questionnaire_reminder',
        'workshop_update',
        'account_verification',
        'password_reset',
        'completion_certificate',
        'enrollment_confirmation',
        'waiting_list_notification',
        'workshop_cancellation',
        'custom',
      ]),
    query('status')
      .optional()
      .isIn([
        'pending',
        'processing',
        'sent',
        'delivered',
        'opened',
        'clicked',
        'bounced',
        'failed',
        'cancelled',
      ]),
    query('userId').optional().isInt(),
    query('workshopId').optional().isUUID(),
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

      const {
        page = 1,
        limit = 20,
        type,
        status,
        userId,
        workshopId,
        startDate,
        endDate,
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Build where conditions
      const whereConditions: any[] = [];

      if (type) {
        whereConditions.push(eq(emailLogs.type, type as string));
      }

      if (status) {
        whereConditions.push(eq(emailLogs.status, status as string));
      }

      if (userId) {
        whereConditions.push(eq(emailLogs.userId, Number(userId)));
      }

      if (workshopId) {
        whereConditions.push(eq(emailLogs.workshopId, workshopId as string));
      }

      if (startDate) {
        whereConditions.push(
          gte(emailLogs.createdAt, new Date(startDate as string)),
        );
      }

      if (endDate) {
        whereConditions.push(
          lte(emailLogs.createdAt, new Date(endDate as string)),
        );
      }

      // Execute query
      const whereClause =
        whereConditions.length > 0
          ? sql`${whereConditions.reduce(
            (acc, cond, index) =>
              index === 0 ? cond : sql`${acc} AND ${cond}`,
            sql`${whereConditions[0]}`,
          )}`
          : sql``;

      const [logs, total] = await Promise.all([
        db
          .select()
          .from(emailLogs)
          .where(whereClause)
          .orderBy(desc(emailLogs.createdAt))
          .limit(Number(limit))
          .offset(offset),

        db
          .select({ count: sql<number>`count(*)` })
          .from(emailLogs)
          .where(whereClause),
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: total[0]?.count || 0,
          pages: Math.ceil((total[0]?.count || 0) / Number(limit)),
        },
      });
    } catch (error) {
      console.error('Failed to get email logs:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get email logs',
      });
    }
  },
);

// Get email statistics
router.get(
  '/stats',
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

      const stats = await emailService.getEmailStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Failed to get email statistics:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get email statistics',
      });
    }
  },
);

// Get queue status
router.get('/queue/status', async (req: Request, res: Response) => {
  try {
    const queueStatus = await emailQueueService.getQueueStatus();

    res.json({
      success: true,
      data: queueStatus,
    });
  } catch (error) {
    console.error('Failed to get queue status:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get queue status',
    });
  }
});

// Pause queue
router.post('/queue/pause', async (req: Request, res: Response) => {
  try {
    await emailQueueService.pauseQueue();

    res.json({
      success: true,
      message: 'Email queue paused successfully',
    });
  } catch (error) {
    console.error('Failed to pause queue:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause queue',
    });
  }
});

// Resume queue
router.post('/queue/resume', async (req: Request, res: Response) => {
  try {
    await emailQueueService.resumeQueue();

    res.json({
      success: true,
      message: 'Email queue resumed successfully',
    });
  } catch (error) {
    console.error('Failed to resume queue:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume queue',
    });
  }
});

// Manage email consent
router.post(
  '/consent',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('marketing').optional().isBoolean(),
    body('transactional').optional().isBoolean(),
    body('workshopUpdates').optional().isBoolean(),
    body('questionnaireReminders').optional().isBoolean(),
    body('newsletters').optional().isBoolean(),
    body('userId').optional().isInt(),
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

      const {
        email,
        marketing = false,
        transactional = true,
        workshopUpdates = true,
        questionnaireReminders = true,
        newsletters = false,
        userId,
      } = req.body;

      // Check if consent already exists
      const existingConsent = await db
        .select()
        .from(emailConsents)
        .where(eq(emailConsents.email, email))
        .limit(1);

      const consentData = {
        marketing,
        transactional,
        workshopUpdates,
        questionnaireReminders,
        newsletters,
        updatedAt: new Date(),
      };

      if (existingConsent.length > 0) {
        // Update existing consent
        await db
          .update(emailConsents)
          .set(consentData)
          .where(eq(emailConsents.email, email));
      } else {
        // Create new consent
        await db.insert(emailConsents).values({
          email,
          userId,
          ...consentData,
          givenAt: new Date(),
          createdAt: new Date(),
        });
      }

      res.json({
        success: true,
        message: 'Email consent updated successfully',
      });
    } catch (error) {
      console.error('Failed to update email consent:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update email consent',
      });
    }
  },
);

// Webhook handlers for email providers
router.post('/webhook/sendgrid', async (req: Request, res: Response) => {
  try {
    const events = req.body;

    for (const event of events) {
      await this.handleWebhookEvent('sendgrid', event);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    res.status(500).send('Error');
  }
});

router.post('/webhook/mailgun', async (req: Request, res: Response) => {
  try {
    const events = req.body['event-data'];

    if (Array.isArray(events)) {
      for (const event of events) {
        await this.handleWebhookEvent('mailgun', event);
      }
    } else {
      await this.handleWebhookEvent('mailgun', events);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Mailgun webhook error:', error);
    res.status(500).send('Error');
  }
});

// Unsubscribe endpoint
router.post(
  '/unsubscribe',
  [body('token').notEmpty().withMessage('Unsubscribe token is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { token } = req.body;

      // Find email log with this unsubscribe token
      const emailLog = await db
        .select()
        .from(emailLogs)
        .where(sql`${emailLogs.metadata}->>'unsubscribeToken' = ${token}`)
        .limit(1);

      if (emailLog.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Invalid unsubscribe token',
        });
      }

      // Update consent to opt-out
      await db
        .update(emailConsents)
        .set({
          marketing: false,
          workshopUpdates: false,
          questionnaireReminders: false,
          newsletters: false,
          withdrawnAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(emailConsents.email, emailLog[0].toEmail));

      res.json({
        success: true,
        message: 'Successfully unsubscribed from emails',
      });
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      });
    }
  },
);

export default router;
