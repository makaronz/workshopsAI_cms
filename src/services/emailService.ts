import nodemailer from 'nodemailer';
import * as sendGridMail from '@sendgrid/mail';
import * as mailgun from 'mailgun.js';
import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { emailConfig } from '../config/email';
import { emailQueueService } from './emailQueue';
import {
  db,
  emailLogs,
  emailConsents,
  emailBlacklist,
  emailTemplates,
} from '../models/postgresql-schema';
import { eq, and, inArray } from 'drizzle-orm';

export interface EmailContent {
  to: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  userId?: number;
  workshopId?: string;
  enrollmentId?: string;
  language?: 'pl' | 'en';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
  type?: string;
}

export interface SendEmailOptions {
  immediate?: boolean;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

class EmailService {
  private providers: Map<string, any> = new Map();
  private templateCache: Map<string, { html: string; text: string }> =
    new Map();

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    const provider = emailConfig.provider;

    switch (provider.name) {
    case 'sendgrid':
      if (!provider.apiKey) {
        console.error('SendGrid API key not configured');
        return;
      }
      sendGridMail.setApiKey(provider.apiKey);
      this.providers.set('sendgrid', sendGridMail);
      break;

    case 'mailgun':
      if (!provider.apiKey || !provider.domain) {
        console.error('Mailgun API key and domain not configured');
        return;
      }
      const mg = mailgun({
        apiKey: provider.apiKey,
        domain: provider.domain,
      });
      this.providers.set('mailgun', mg);
      break;

    case 'nodemailer':
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
          : undefined,
      });
      this.providers.set('nodemailer', transporter);
      break;
    }
  }

  async sendEmail(
    content: EmailContent,
    options: SendEmailOptions = {},
  ): Promise<{ messageId?: string; providerMessageId?: string }> {
    try {
      // Check if email is blacklisted
      const isBlacklisted = await this.isEmailBlacklisted(content.to);
      if (isBlacklisted) {
        throw new Error(`Email ${content.to} is blacklisted`);
      }

      // Check consent for non-transactional emails
      const consent = await this.getEmailConsent(content.to);
      if (
        consent &&
        !this.hasRequiredConsent(content.type || 'custom', consent)
      ) {
        throw new Error(
          `Email ${content.to} does not have required consent for ${content.type} emails`,
        );
      }

      // Validate email address
      if (!this.isValidEmail(content.to)) {
        throw new Error(`Invalid email address: ${content.to}`);
      }

      // Generate message ID
      const messageId = `workshopsai-${uuidv4()}`;

      // Create email log entry
      const emailLogId = uuidv4();
      await this.createEmailLog(emailLogId, messageId, content);

      // Render templates if provided
      let htmlContent = content.htmlContent;
      let textContent = content.textContent;

      if (content.templateId) {
        const renderedContent = await this.renderTemplate(
          content.templateId,
          content.templateData || {},
          content.language || 'pl',
        );
        htmlContent = renderedContent.html;
        textContent = renderedContent.text;
      }

      // Send immediately or queue
      if (options.immediate) {
        const result = await this.sendEmailDirectly({
          ...content,
          htmlContent,
          textContent,
          messageId,
        });
        return result;
      } else {
        await emailQueueService.addEmailJob({
          emailLogId,
          type: content.type || 'custom',
          to: content.to,
          subject: content.subject,
          htmlContent,
          textContent,
          templateId: content.templateId,
          templateData: content.templateData,
          userId: content.userId,
          workshopId: content.workshopId,
          enrollmentId: content.enrollmentId,
          language: content.language || 'pl',
          priority: content.priority || 'normal',
          scheduledAt: content.scheduledAt,
        });
        return { messageId };
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  private async sendEmailDirectly(
    content: EmailContent & { messageId: string },
  ): Promise<{ messageId?: string; providerMessageId?: string }> {
    const provider = emailConfig.provider;
    const { to, subject, htmlContent, textContent, messageId } = content;

    switch (provider.name) {
    case 'sendgrid':
      return await this.sendViaSendGrid({
        to,
        subject,
        htmlContent,
        textContent,
        messageId,
      });

    case 'mailgun':
      return await this.sendViaMailgun({
        to,
        subject,
        htmlContent,
        textContent,
        messageId,
      });

    case 'nodemailer':
    default:
      return await this.sendViaNodemailer({
        to,
        subject,
        htmlContent,
        textContent,
        messageId,
      });
    }
  }

  private async sendViaSendGrid(
    content: any,
  ): Promise<{ messageId?: string; providerMessageId?: string }> {
    const sendGrid = this.providers.get('sendgrid');
    const msg = {
      to: content.to,
      from: {
        email: emailConfig.provider.fromEmail,
        name: emailConfig.provider.fromName,
      },
      subject: content.subject,
      html: content.htmlContent,
      text: content.textContent,
      customArgs: {
        messageId: content.messageId,
      },
      trackingSettings: {
        openTracking: { enable: emailConfig.tracking.openTracking },
        clickTracking: { enable: emailConfig.tracking.clickTracking },
      },
    };

    try {
      const [response] = await sendGrid.send(msg);
      return {
        messageId: content.messageId,
        providerMessageId: response.headers['x-message-id'],
      };
    } catch (error) {
      console.error('SendGrid error:', error);
      throw error;
    }
  }

  private async sendViaMailgun(
    content: any,
  ): Promise<{ messageId?: string; providerMessageId?: string }> {
    const mg = this.providers.get('mailgun');
    const msg = {
      from: `${emailConfig.provider.fromName} <${emailConfig.provider.fromEmail}>`,
      to: content.to,
      subject: content.subject,
      html: content.htmlContent,
      text: content.textContent,
      'v:messageId': content.messageId,
      'o:tracking': emailConfig.tracking.openTracking ? 'yes' : 'no',
      'o:tracking-clicks': emailConfig.tracking.clickTracking ? 'yes' : 'no',
    };

    try {
      const response = await mg
        .messages()
        .create(emailConfig.provider.domain!, msg);
      return {
        messageId: content.messageId,
        providerMessageId: response.id,
      };
    } catch (error) {
      console.error('Mailgun error:', error);
      throw error;
    }
  }

  private async sendViaNodemailer(
    content: any,
  ): Promise<{ messageId?: string; providerMessageId?: string }> {
    const transporter = this.providers.get('nodemailer');
    const msg = {
      to: content.to,
      from: `${emailConfig.provider.fromName} <${emailConfig.provider.fromEmail}>`,
      subject: content.subject,
      html: content.htmlContent,
      text: content.textContent,
      headers: {
        'X-Message-ID': content.messageId,
      },
    };

    try {
      const info = await transporter.sendMail(msg);
      return {
        messageId: content.messageId,
        providerMessageId: info.messageId,
      };
    } catch (error) {
      console.error('Nodemailer error:', error);
      throw error;
    }
  }

  private async createEmailLog(
    emailLogId: string,
    messageId: string,
    content: EmailContent,
  ): Promise<void> {
    await db.insert(emailLogs).values({
      id: emailLogId,
      messageId,
      templateId: content.templateId,
      userId: content.userId,
      workshopId: content.workshopId,
      enrollmentId: content.enrollmentId,
      type: content.type || 'custom',
      toEmail: content.to,
      fromEmail: emailConfig.provider.fromEmail,
      fromName: emailConfig.provider.fromName,
      subject: content.subject,
      language: content.language || 'pl',
      status: 'pending',
      provider: emailConfig.provider.name,
      priority: content.priority || 'normal',
      scheduledAt: content.scheduledAt,
      consent: await this.getEmailConsent(content.to),
      createdAt: new Date(),
    });
  }

  private async renderTemplate(
    templateId: string,
    data: Record<string, any>,
    language: 'pl' | 'en',
  ): Promise<{ html: string; text: string }> {
    const cacheKey = `${templateId}-${language}`;

    if (this.templateCache.has(cacheKey)) {
      const cachedTemplate = this.templateCache.get(cacheKey)!;
      return {
        html: this.compileTemplate(cachedTemplate.html, { ...data, language }),
        text: this.compileTemplate(cachedTemplate.text, { ...data, language }),
      };
    }

    // Load template from database
    const template = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .limit(1);

    if (template.length === 0) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const templateData = template[0];
    this.templateCache.set(cacheKey, {
      html: templateData.htmlTemplate,
      text: templateData.textTemplate || '',
    });

    return {
      html: this.compileTemplate(templateData.htmlTemplate, {
        ...data,
        language,
      }),
      text: this.compileTemplate(templateData.textTemplate || '', {
        ...data,
        language,
      }),
    };
  }

  private compileTemplate(template: string, data: Record<string, any>): string {
    // Compile with Handlebars
    const compiledTemplate = Handlebars.compile(template);

    // Add base template context
    const context = {
      ...data,
      baseUrl: emailConfig.templates.baseUrl,
      logoUrl: emailConfig.templates.logoUrl,
      primaryColor: emailConfig.templates.primaryColor,
      secondaryColor: emailConfig.templates.secondaryColor,
      socialLinks: emailConfig.templates.socialLinks,
      fromName: emailConfig.provider.fromName,
      currentYear: new Date().getFullYear(),
      language: data.language || 'pl',
    };

    // Register helpers
    this.registerHandlebarsHelpers();

    return compiledTemplate(context);
  }

  private registerHandlebarsHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper(
      'formatDate',
      (date: string | Date, format: string) => {
        const d = new Date(date);
        // Simple formatting - in production, you'd use a proper date formatting library
        switch (format) {
        case 'LLLL':
          return d.toLocaleDateString(
            d.toLocaleDateString() === 'en-US' ? 'en-US' : 'pl-PL',
            {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            },
          );
        case 'HH:mm':
          return d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        default:
          return d.toLocaleDateString();
        }
      },
    );

    // Conditional language helper
    Handlebars.registerHelper('language', function (conditional, options) {
      if (conditional === options.data.root.language) {
        return options.fn(this);
      }
      return options.inverse(this);
    });
  }

  private async isEmailBlacklisted(email: string): Promise<boolean> {
    const result = await db
      .select()
      .from(emailBlacklist)
      .where(
        and(eq(emailBlacklist.email, email), eq(emailBlacklist.isActive, true)),
      )
      .limit(1);

    return result.length > 0;
  }

  private async getEmailConsent(email: string): Promise<any> {
    const result = await db
      .select()
      .from(emailConsents)
      .where(eq(emailConsents.email, email))
      .limit(1);

    return result[0] || null;
  }

  private hasRequiredConsent(type: string, consent: any): boolean {
    switch (type) {
    case 'workshop_invitation':
    case 'questionnaire_reminder':
      return consent.questionnaireReminders;
    case 'workshop_update':
    case 'session_reminder':
    case 'enrollment_confirmation':
    case 'waiting_list_notification':
    case 'workshop_cancellation':
      return consent.workshopUpdates;
    case 'account_verification':
    case 'password_reset':
    case 'completion_certificate':
      return consent.transactional;
    default:
      return consent.marketing;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Public methods for specific email types
  async sendWorkshopInvitation(
    to: string,
    workshop: any,
    options: Partial<EmailContent> = {},
  ): Promise<void> {
    await this.sendEmail({
      to,
      type: 'workshop_invitation',
      subject: workshop.title,
      templateId: 'workshop_invitation',
      templateData: { workshop },
      priority: 'high',
      ...options,
    });
  }

  async sendSessionReminder(
    to: string,
    session: any,
    workshop: any,
    options: Partial<EmailContent> = {},
  ): Promise<void> {
    await this.sendEmail({
      to,
      type: 'session_reminder',
      subject: `Session Reminder: ${session.title}`,
      templateId: 'session_reminder',
      templateData: { session, workshop },
      priority: 'high',
      ...options,
    });
  }

  async sendQuestionnaireReminder(
    to: string,
    questionnaire: any,
    options: Partial<EmailContent> = {},
  ): Promise<void> {
    await this.sendEmail({
      to,
      type: 'questionnaire_reminder',
      subject: `Questionnaire: ${questionnaire.title.pl || questionnaire.title.en}`,
      templateId: 'questionnaire_reminder',
      templateData: { questionnaire },
      priority: 'normal',
      ...options,
    });
  }

  // Analytics methods
  async getEmailStats(startDate?: Date, endDate?: Date): Promise<any> {
    const whereConditions = [];

    if (startDate) {
      whereConditions.push(`createdAt >= '${startDate.toISOString()}'`);
    }
    if (endDate) {
      whereConditions.push(`createdAt <= '${endDate.toISOString()}'`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // This is a simplified version - in production, you'd use proper ORM queries
    const query = `
      SELECT
        type,
        status,
        COUNT(*) as count,
        COUNT(DISTINCT toEmail) as unique_emails,
        AVG(CASE WHEN openedAt IS NOT NULL THEN 1 ELSE 0 END) * 100 as open_rate,
        AVG(CASE WHEN lastClickedAt IS NOT NULL THEN 1 ELSE 0 END) * 100 as click_rate
      FROM emailLogs
      ${whereClause}
      GROUP BY type, status
      ORDER BY count DESC
    `;

    // Implementation would depend on your database setup
    // For now, return empty object
    return {};
  }
}

export const emailService = new EmailService();
