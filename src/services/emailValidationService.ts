import { db, emailLogs, emailBlacklist } from '../models/postgresql-schema';
import { eq, sql } from 'drizzle-orm';
import { emailConfig } from '../config/email';

export interface ValidationResult {
  isValid: boolean;
  score: number;
  suggestions?: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface BounceEvent {
  providerMessageId: string;
  bounceType: 'hard' | 'soft' | 'spam' | 'complaint';
  bounceReason: string;
  timestamp: Date;
  provider: string;
}

class EmailValidationService {
  private disposableDomains: Set<string>;
  private freeEmailProviders: Set<string>;
  private suspiciousPatterns: RegExp[];

  constructor() {
    this.initializeValidationRules();
  }

  private initializeValidationRules(): void {
    // Common disposable email domains
    this.disposableDomains = new Set([
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
      'tempmail.org',
      'yopmail.com',
      'temp-mail.org',
      'sharklasers.com',
      'maildrop.cc',
      'throwaway.email',
      'tempinbox.com',
    ]);

    // Common free email providers
    this.freeEmailProviders = new Set([
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'aol.com',
      'icloud.com',
      'protonmail.com',
      'tutanota.com',
    ]);

    // Suspicious patterns
    this.suspiciousPatterns = [
      /^[a-z]+\d+@[a-z]+\.[a-z]{2,3}$/, // Random letter+number combos
      /^[a-z]{20,}@/, // Very long username
      /test.*@/, // Test accounts
      /example.*@/, // Example accounts
      /demo.*@/, // Demo accounts
    ];
  }

  async validateEmail(email: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      score: 100,
      riskLevel: 'low',
    };

    // Basic format validation
    if (!this.isValidFormat(email)) {
      result.isValid = false;
      result.score = 0;
      result.riskLevel = 'high';
      result.suggestions = ['Invalid email format'];
      return result;
    }

    // Check against blacklists
    if (await this.isBlacklisted(email)) {
      result.isValid = false;
      result.score = 0;
      result.riskLevel = 'high';
      result.suggestions = [
        'Email is blacklisted due to previous bounces or complaints',
      ];
      return result;
    }

    // Domain validation
    const domain = email.split('@')[1].toLowerCase();

    // Check disposable domains
    if (this.disposableDomains.has(domain)) {
      result.score -= 50;
      result.riskLevel = 'high';
      result.suggestions = ['Disposable email domain detected'];
    }

    // Check suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(email)) {
        result.score -= 30;
        result.riskLevel = result.score < 50 ? 'high' : 'medium';
        result.suggestions = result.suggestions || [];
        result.suggestions.push('Email pattern appears suspicious');
        break;
      }
    }

    // Check free email providers (not necessarily bad, but note it)
    if (this.freeEmailProviders.has(domain)) {
      result.score -= 5; // Small penalty for free providers
      result.suggestions = result.suggestions || [];
      result.suggestions.push('Free email provider detected');
    }

    // Check domain MX records
    try {
      const hasValidMX = await this.validateMXRecords(domain);
      if (!hasValidMX) {
        result.isValid = false;
        result.score = 0;
        result.riskLevel = 'high';
        result.suggestions = ['Domain does not have valid MX records'];
        return result;
      }
    } catch (error) {
      result.score -= 20;
      result.riskLevel = 'medium';
      result.suggestions = result.suggestions || [];
      result.suggestions.push('Could not validate domain MX records');
    }

    // Update risk level based on final score
    if (result.score >= 80) {
      result.riskLevel = 'low';
    } else if (result.score >= 50) {
      result.riskLevel = 'medium';
    } else {
      result.riskLevel = 'high';
    }

    result.isValid = result.score >= 50;

    return result;
  }

  private isValidFormat(email: string): boolean {
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  private async isBlacklisted(email: string): Promise<boolean> {
    const result = await db
      .select()
      .from(emailBlacklist)
      .where(eq(emailBlacklist.email, email))
      .limit(1);

    return result.length > 0 && result[0].isActive;
  }

  private async validateMXRecords(domain: string): Promise<boolean> {
    try {
      // This would require an MX record validation library or service
      // For now, we'll return true as a placeholder
      // In production, you might use a service like 'dns' npm package or external API

      // Simple validation - check if domain has valid format
      const domainRegex =
        /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
      return domainRegex.test(domain);
    } catch (error) {
      return false;
    }
  }

  async blacklistEmail(
    email: string,
    reason:
      | 'bounced'
      | 'complained'
      | 'spam'
      | 'unsubscribed'
      | 'blocked'
      | 'admin',
    providerReason?: string,
    blockedBy?: number,
  ): Promise<void> {
    const existingBlacklist = await db
      .select()
      .from(emailBlacklist)
      .where(eq(emailBlacklist.email, email))
      .limit(1);

    if (existingBlacklist.length > 0) {
      // Update existing entry
      await db
        .update(emailBlacklist)
        .set({
          reason,
          providerReason,
          isActive: true,
          unblockedAt: null,
          blockedBy,
          updatedAt: new Date(),
        })
        .where(eq(emailBlacklist.email, email));
    } else {
      // Create new entry
      await db.insert(emailBlacklist).values({
        email,
        reason,
        provider: emailConfig.provider.name,
        providerReason,
        isActive: true,
        blockedAt: new Date(),
        blockedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  async unblacklistEmail(email: string): Promise<void> {
    await db
      .update(emailBlacklist)
      .set({
        isActive: false,
        unblockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailBlacklist.email, email));
  }

  async handleBounceEvent(event: BounceEvent): Promise<void> {
    try {
      // Find the email log entry
      const emailLog = await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.providerMessageId, event.providerMessageId))
        .limit(1);

      if (emailLog.length === 0) {
        console.warn(
          `Email log not found for providerMessageId: ${event.providerMessageId}`,
        );
        return;
      }

      const email = emailLog[0];

      // Update email log with bounce information
      await db
        .update(emailLogs)
        .set({
          status: 'bounced',
          bouncedAt: event.timestamp,
          bounceReason: event.bounceReason,
          bounceType: event.bounceType,
          updatedAt: new Date(),
        })
        .where(eq(emailLogs.id, email.id));

      // Blacklist the email if it's a hard bounce or complaint
      if (event.bounceType === 'hard' || event.bounceType === 'complaint') {
        await this.blacklistEmail(
          email.toEmail,
          event.bounceType === 'complaint' ? 'complained' : 'bounced',
          event.bounceReason,
        );
      }

      console.log(
        `Handled bounce event for ${email.toEmail}: ${event.bounceReason}`,
      );
    } catch (error) {
      console.error('Failed to handle bounce event:', error);
    }
  }

  async handleDeliveryEvent(
    providerMessageId: string,
    timestamp: Date,
  ): Promise<void> {
    try {
      await db
        .update(emailLogs)
        .set({
          status: 'delivered',
          deliveredAt: timestamp,
          updatedAt: new Date(),
        })
        .where(eq(emailLogs.providerMessageId, providerMessageId));
    } catch (error) {
      console.error('Failed to handle delivery event:', error);
    }
  }

  async handleOpenEvent(
    providerMessageId: string,
    timestamp: Date,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      const emailLog = await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.providerMessageId, providerMessageId))
        .limit(1);

      if (emailLog.length === 0) {
        return;
      }

      const email = emailLog[0];
      const metadata = email.metadata || {};

      // Update metadata with open information
      const updatedMetadata = {
        ...metadata,
        userAgent,
        ipAddress,
        openCount: (metadata.openCount || 0) + 1,
      };

      await db
        .update(emailLogs)
        .set({
          status: 'opened',
          openedAt: timestamp,
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(emailLogs.id, email.id));
    } catch (error) {
      console.error('Failed to handle open event:', error);
    }
  }

  async handleClickEvent(
    providerMessageId: string,
    url: string,
    timestamp: Date,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      const emailLog = await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.providerMessageId, providerMessageId))
        .limit(1);

      if (emailLog.length === 0) {
        return;
      }

      const email = emailLog[0];
      const metadata = email.metadata || {};

      // Update metadata with click information
      const linkClicks = metadata.linkClicks || [];
      const existingClick = linkClicks.find((click: any) => click.url === url);

      if (existingClick) {
        existingClick.clickedAt = timestamp;
        existingClick.count++;
      } else {
        linkClicks.push({
          url,
          clickedAt: timestamp,
          count: 1,
        });
      }

      const updatedMetadata = {
        ...metadata,
        userAgent,
        ipAddress,
        linkClicks,
        clickCount: (metadata.clickCount || 0) + 1,
        lastClickedAt: timestamp,
      };

      await db
        .update(emailLogs)
        .set({
          status: 'clicked',
          lastClickedAt: timestamp,
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(emailLogs.id, email.id));
    } catch (error) {
      console.error('Failed to handle click event:', error);
    }
  }

  async getValidationReport(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const whereConditions: any[] = [];

      if (startDate) {
        whereConditions.push(sql`createdAt >= ${startDate.toISOString()}`);
      }

      if (endDate) {
        whereConditions.push(sql`createdAt <= ${endDate.toISOString()}`);
      }

      const whereClause =
        whereConditions.length > 0
          ? sql`${whereConditions.reduce(
            (acc, cond, index) =>
              index === 0 ? cond : sql`${acc} AND ${cond}`,
            sql`${whereConditions[0]}`,
          )}`
          : sql``;

      const [totalEmails, bouncedEmails, bouncedByType] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(emailLogs)
          .where(whereClause),

        db
          .select({ count: sql<number>`count(*)` })
          .from(emailLogs)
          .where(sql`status = 'bounced' AND ${whereClause}`),

        db
          .select({
            bounceType: emailLogs.bounceType,
            count: sql<number>`count(*)`,
          })
          .from(emailLogs)
          .where(sql`status = 'bounced' AND ${whereClause}`)
          .groupBy(emailLogs.bounceType),
      ]);

      return {
        total: totalEmails[0]?.count || 0,
        bounced: bouncedEmails[0]?.count || 0,
        bounceRate:
          totalEmails[0]?.count > 0
            ? ((bouncedEmails[0]?.count || 0) / totalEmails[0].count) * 100
            : 0,
        bouncedByType: bouncedByType.reduce(
          (acc, item) => {
            acc[item.bounceType || 'unknown'] = item.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      };
    } catch (error) {
      console.error('Failed to get validation report:', error);
      return null;
    }
  }

  async cleanupOldBlacklistEntries(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); // 1 year ago

      const result = await db
        .delete(emailBlacklist)
        .where(
          sql`isActive = false AND unblockedAt < ${cutoffDate.toISOString()}`,
        );

      return result.length;
    } catch (error) {
      console.error('Failed to cleanup old blacklist entries:', error);
      return 0;
    }
  }
}

export const emailValidationService = new EmailValidationService();
