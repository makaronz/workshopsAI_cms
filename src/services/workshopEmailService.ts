import { emailService } from './emailService';
import { emailRateLimitService } from './emailRateLimitService';
import { emailValidationService } from './emailValidationService';
import {
  db,
  users,
  workshops,
  enrollments,
  sessions,
  facilitators,
  locations,
} from '../models/postgresql-schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface WorkshopEmailContext {
  workshop: any;
  facilitator?: any;
  location?: any;
  sessions?: any[];
  enrollment?: any;
  participant?: any;
  userLanguage?: 'pl' | 'en';
}

export interface EmailNotificationOptions {
  immediate?: boolean;
  scheduledAt?: Date;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  skipRateLimit?: boolean;
  customTemplateData?: Record<string, any>;
}

class WorkshopEmailService {
  async sendWorkshopInvitation(
    workshopId: string,
    recipientEmail: string,
    options: EmailNotificationOptions = {},
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Get workshop details
      const workshopData = await this.getWorkshopEmailContext(workshopId);
      if (!workshopData) {
        return { success: false, error: 'Workshop not found' };
      }

      // Validate recipient email
      const validation =
        await emailValidationService.validateEmail(recipientEmail);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid email address: ${validation.suggestions?.join(', ')}`,
        };
      }

      // Check rate limits unless explicitly skipped
      if (!options.skipRateLimit) {
        const rateLimitCheck =
          await emailRateLimitService.checkComprehensiveRateLimit(
            'workshop_invitation',
            recipientEmail,
            undefined,
            workshopId,
            options.priority,
          );

        if (!rateLimitCheck.allowed) {
          return {
            success: false,
            error: `Rate limit exceeded: ${rateLimitCheck.reasons.join(', ')}`,
          };
        }
      }

      // Prepare email context
      const context = this.prepareWorkshopInvitationContext(
        workshopData,
        recipientEmail,
        options,
      );

      // Send email
      await emailService.sendEmail(
        {
          to: recipientEmail,
          type: 'workshop_invitation',
          subject: this.getSubject('workshop_invitation', context),
          templateId: 'workshop_invitation',
          templateData: context.templateData,
          workshopId,
          language: context.language,
          priority: options.priority || 'high',
          scheduledAt: options.scheduledAt,
        },
        { immediate: options.immediate },
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to send workshop invitation:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to send invitation',
      };
    }
  }

  async sendSessionReminders(
    workshopId: string,
    sessionId: string,
    options: EmailNotificationOptions = {},
  ): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    try {
      // Get session and workshop details
      const [sessionData, workshopData] = await Promise.all([
        this.getSessionEmailContext(sessionId),
        this.getWorkshopEmailContext(workshopId),
      ]);

      if (!sessionData || !workshopData) {
        return {
          success: false,
          sent: 0,
          failed: 0,
          errors: ['Session or workshop not found'],
        };
      }

      // Get enrolled participants
      const enrolledUsers = await db
        .select({
          email: users.email,
          userId: users.id,
          enrollmentId: enrollments.id,
        })
        .from(enrollments)
        .innerJoin(users, eq(enrollments.participantId, users.id))
        .where(
          and(
            eq(enrollments.workshopId, workshopId),
            eq(enrollments.status, 'confirmed'),
          ),
        );

      if (enrolledUsers.length === 0) {
        return { success: true, sent: 0, failed: 0, errors: [] };
      }

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      // Send reminders to all enrolled participants
      for (const user of enrolledUsers) {
        try {
          // Check rate limits
          if (!options.skipRateLimit) {
            const rateLimitCheck =
              await emailRateLimitService.checkComprehensiveRateLimit(
                'session_reminder',
                user.email,
                user.userId,
                workshopId,
                options.priority,
              );

            if (!rateLimitCheck.allowed) {
              failed++;
              errors.push(
                `Rate limit exceeded for ${user.email}: ${rateLimitCheck.reasons.join(', ')}`,
              );
              continue;
            }
          }

          // Prepare context
          const context = this.prepareSessionReminderContext(
            workshopData,
            sessionData,
            user,
            options,
          );

          // Send reminder
          await emailService.sendEmail(
            {
              to: user.email,
              type: 'session_reminder',
              subject: this.getSubject('session_reminder', context),
              templateId: 'session_reminder',
              templateData: context.templateData,
              workshopId,
              userId: user.userId,
              enrollmentId: user.enrollmentId,
              language: context.language,
              priority: options.priority || 'high',
              scheduledAt: options.scheduledAt,
            },
            { immediate: options.immediate },
          );

          sent++;
        } catch (error) {
          failed++;
          errors.push(
            `Failed to send to ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      return {
        success: failed === 0,
        sent,
        failed,
        errors,
      };
    } catch (error) {
      console.error('Failed to send session reminders:', error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        errors: [
          error instanceof Error ? error.message : 'Failed to send reminders',
        ],
      };
    }
  }

  async sendQuestionnaireReminder(
    questionnaireId: string,
    workshopId?: string,
    options: EmailNotificationOptions = {},
  ): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    try {
      // Get questionnaire details (this would need to be implemented based on your questionnaire schema)
      const questionnaireData =
        await this.getQuestionnaireEmailContext(questionnaireId);
      if (!questionnaireData) {
        return {
          success: false,
          sent: 0,
          failed: 0,
          errors: ['Questionnaire not found'],
        };
      }

      // Determine recipients
      let recipients;
      if (workshopId) {
        // Send to workshop participants
        recipients = await db
          .select({
            email: users.email,
            userId: users.id,
            enrollmentId: enrollments.id,
          })
          .from(enrollments)
          .innerJoin(users, eq(enrollments.participantId, users.id))
          .where(
            and(
              eq(enrollments.workshopId, workshopId),
              eq(enrollments.status, 'completed'),
            ),
          );
      } else {
        // Send to all users (or based on other criteria)
        recipients = await db
          .select({
            email: users.email,
            userId: users.id,
          })
          .from(users)
          .where(eq(users.isActive, true))
          .limit(100); // Limit for safety
      }

      if (recipients.length === 0) {
        return { success: true, sent: 0, failed: 0, errors: [] };
      }

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      // Send reminders
      for (const user of recipients) {
        try {
          // Check rate limits
          if (!options.skipRateLimit) {
            const rateLimitCheck =
              await emailRateLimitService.checkComprehensiveRateLimit(
                'questionnaire_reminder',
                user.email,
                user.userId,
                workshopId,
                options.priority,
              );

            if (!rateLimitCheck.allowed) {
              failed++;
              errors.push(
                `Rate limit exceeded for ${user.email}: ${rateLimitCheck.reasons.join(', ')}`,
              );
              continue;
            }
          }

          // Prepare context
          const context = this.prepareQuestionnaireReminderContext(
            questionnaireData,
            user,
            workshopId,
            options,
          );

          // Send reminder
          await emailService.sendEmail(
            {
              to: user.email,
              type: 'questionnaire_reminder',
              subject: this.getSubject('questionnaire_reminder', context),
              templateId: 'questionnaire_reminder',
              templateData: context.templateData,
              workshopId,
              userId: user.userId,
              enrollmentId: user.enrollmentId,
              language: context.language,
              priority: options.priority || 'normal',
              scheduledAt: options.scheduledAt,
            },
            { immediate: options.immediate },
          );

          sent++;
        } catch (error) {
          failed++;
          errors.push(
            `Failed to send to ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      return {
        success: failed === 0,
        sent,
        failed,
        errors,
      };
    } catch (error) {
      console.error('Failed to send questionnaire reminders:', error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        errors: [
          error instanceof Error ? error.message : 'Failed to send reminders',
        ],
      };
    }
  }

  async sendWorkshopUpdate(
    workshopId: string,
    updateType:
      | 'schedule_change'
      | 'location_change'
      | 'content_update'
      | 'cancellation',
    updateDetails: Record<string, any>,
    options: EmailNotificationOptions = {},
  ): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    try {
      const workshopData = await this.getWorkshopEmailContext(workshopId);
      if (!workshopData) {
        return {
          success: false,
          sent: 0,
          failed: 0,
          errors: ['Workshop not found'],
        };
      }

      // Get all enrolled participants
      const enrolledUsers = await db
        .select({
          email: users.email,
          userId: users.id,
          enrollmentId: enrollments.id,
        })
        .from(enrollments)
        .innerJoin(users, eq(enrollments.participantId, users.id))
        .where(
          and(
            eq(enrollments.workshopId, workshopId),
            eq(enrollments.status, 'confirmed'),
          ),
        );

      if (enrolledUsers.length === 0) {
        return { success: true, sent: 0, failed: 0, errors: [] };
      }

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const user of enrolledUsers) {
        try {
          if (!options.skipRateLimit) {
            const rateLimitCheck =
              await emailRateLimitService.checkComprehensiveRateLimit(
                'workshop_update',
                user.email,
                user.userId,
                workshopId,
                'high', // Workshop updates are high priority
              );

            if (!rateLimitCheck.allowed) {
              failed++;
              errors.push(
                `Rate limit exceeded for ${user.email}: ${rateLimitCheck.reasons.join(', ')}`,
              );
              continue;
            }
          }

          const context = this.prepareWorkshopUpdateContext(
            workshopData,
            updateType,
            updateDetails,
            user,
            options,
          );

          await emailService.sendEmail(
            {
              to: user.email,
              type: 'workshop_update',
              subject: this.getSubject('workshop_update', context),
              templateId: 'workshop_update',
              templateData: context.templateData,
              workshopId,
              userId: user.userId,
              enrollmentId: user.enrollmentId,
              language: context.language,
              priority: 'high',
              scheduledAt: options.scheduledAt,
            },
            { immediate: options.immediate },
          );

          sent++;
        } catch (error) {
          failed++;
          errors.push(
            `Failed to send to ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      return {
        success: failed === 0,
        sent,
        failed,
        errors,
      };
    } catch (error) {
      console.error('Failed to send workshop update:', error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        errors: [
          error instanceof Error ? error.message : 'Failed to send update',
        ],
      };
    }
  }

  private async getWorkshopEmailContext(
    workshopId: string,
  ): Promise<WorkshopEmailContext | null> {
    const result = await db
      .select({
        workshop: workshops,
      })
      .from(workshops)
      .where(eq(workshops.id, workshopId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0] as WorkshopEmailContext;
  }

  private async getSessionEmailContext(sessionId: string): Promise<any | null> {
    const result = await db
      .select({
        session: sessions,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  private async getQuestionnaireEmailContext(
    questionnaireId: string,
  ): Promise<any | null> {
    // This would need to be implemented based on your questionnaire schema
    return null; // Placeholder
  }

  private prepareWorkshopInvitationContext(
    workshopData: WorkshopEmailContext,
    email: string,
    options: EmailNotificationOptions,
  ): WorkshopEmailContext & { templateData: any; language: 'pl' | 'en' } {
    const language = workshopData.userLanguage || 'pl';

    return {
      ...workshopData,
      language,
      templateData: {
        workshop: workshopData.workshop,
        facilitator: workshopData.facilitator,
        location: workshopData.location,
        baseUrl: process.env.EMAIL_BASE_URL || 'https://workshopsai.com',
        unsubscribeToken: this.generateUnsubscribeToken(email),
        ...options.customTemplateData,
      },
    };
  }

  private prepareSessionReminderContext(
    workshopData: WorkshopEmailContext,
    sessionData: any,
    user: any,
    options: EmailNotificationOptions,
  ): WorkshopEmailContext & { templateData: any; language: 'pl' | 'en' } {
    const language = workshopData.userLanguage || 'pl';

    return {
      ...workshopData,
      language,
      templateData: {
        workshop: workshopData.workshop,
        session: sessionData.session,
        baseUrl: process.env.EMAIL_BASE_URL || 'https://workshopsai.com',
        unsubscribeToken: this.generateUnsubscribeToken(user.email),
        ...options.customTemplateData,
      },
    };
  }

  private prepareQuestionnaireReminderContext(
    questionnaireData: any,
    user: any,
    workshopId?: string,
    options: EmailNotificationOptions = {},
  ): { templateData: any; language: 'pl' | 'en' } {
    const language = user.language || 'pl';

    return {
      language,
      templateData: {
        questionnaire: questionnaireData,
        baseUrl: process.env.EMAIL_BASE_URL || 'https://workshopsai.com',
        unsubscribeToken: this.generateUnsubscribeToken(user.email),
        ...options.customTemplateData,
      },
    };
  }

  private prepareWorkshopUpdateContext(
    workshopData: WorkshopEmailContext,
    updateType: string,
    updateDetails: Record<string, any>,
    user: any,
    options: EmailNotificationOptions = {},
  ): WorkshopEmailContext & { templateData: any; language: 'pl' | 'en' } {
    const language = workshopData.userLanguage || 'pl';

    return {
      ...workshopData,
      language,
      templateData: {
        workshop: workshopData.workshop,
        updateType,
        updateDetails,
        baseUrl: process.env.EMAIL_BASE_URL || 'https://workshopsai.com',
        unsubscribeToken: this.generateUnsubscribeToken(user.email),
        ...options.customTemplateData,
      },
    };
  }

  private getSubject(emailType: string, context: any): string {
    const language = context.language || 'pl';
    const workshopTitle = context.workshop?.title || '';

    const subjects: Record<string, Record<string, string>> = {
      workshop_invitation: {
        pl: `Zaproszenie na warsztat: ${workshopTitle}`,
        en: `Workshop Invitation: ${workshopTitle}`,
      },
      session_reminder: {
        pl: 'Przypomnienie o sesji warsztatowej',
        en: 'Workshop Session Reminder',
      },
      questionnaire_reminder: {
        pl: 'Przypomnienie o wypełnieniu ankiety',
        en: 'Questionnaire Reminder',
      },
      workshop_update: {
        pl: `Aktualizacja warsztatu: ${workshopTitle}`,
        en: `Workshop Update: ${workshopTitle}`,
      },
    };

    return subjects[emailType]?.[language] || `Notification: ${workshopTitle}`;
  }

  private generateUnsubscribeToken(email: string): string {
    // Generate a simple token based on email and timestamp
    // In production, you'd use a more secure method
    return Buffer.from(`${email}:${Date.now()}`).toString('base64');
  }

  async scheduleAutomatedReminders(workshopId: string): Promise<void> {
    const workshopData = await this.getWorkshopEmailContext(workshopId);
    if (!workshopData || !workshopData.workshop.startDate) {
      return;
    }

    const workshopStartDate = new Date(workshopData.workshop.startDate);
    const now = new Date();

    // Schedule session reminders (24 hours before each session)
    if (workshopData.workshop.sessions) {
      for (const session of workshopData.workshop.sessions) {
        const sessionStartTime = new Date(session.startTime);
        const reminderTime = new Date(
          sessionStartTime.getTime() - 24 * 60 * 60 * 1000,
        ); // 24 hours before

        if (reminderTime > now) {
          await this.sendSessionReminders(workshopId, session.id, {
            scheduledAt: reminderTime,
            priority: 'normal',
          });
        }
      }
    }

    // Schedule questionnaire reminder (after workshop completion)
    if (workshopData.workshop.endDate) {
      const workshopEndDate = new Date(workshopData.workshop.endDate);
      const questionnaireReminderTime = new Date(
        workshopEndDate.getTime() + 24 * 60 * 60 * 1000,
      ); // 24 hours after

      if (questionnaireReminderTime > now) {
        await this.sendQuestionnaireReminder(workshopId, workshopId, {
          scheduledAt: questionnaireReminderTime,
          priority: 'normal',
        });
      }
    }
  }
}

export const workshopEmailService = new WorkshopEmailService();
