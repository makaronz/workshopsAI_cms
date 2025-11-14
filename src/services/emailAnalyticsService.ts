import { db, emailLogs } from '../models/postgresql-schema';
import { eq, and, gte, lte, desc, sql, count, sum } from 'drizzle-orm';

export interface EmailStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  pending: number;
  processing: number;
  cancelled: number;
}

export interface EmailMetrics {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  failureRate: number;
}

export interface TimeSeriesData {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

export interface EngagementMetrics {
  totalOpens: number;
  uniqueOpens: number;
  totalClicks: number;
  uniqueClicks: number;
  avgTimeToOpen: number;
  avgTimeToClick: number;
}

export interface TopPerformingTemplate {
  templateId: string;
  templateName: string;
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

class EmailAnalyticsService {
  async getOverallStats(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ stats: EmailStats; metrics: EmailMetrics }> {
    const whereConditions = this.buildDateConditions(startDate, endDate);
    const whereClause =
      whereConditions.length > 0
        ? sql`${whereConditions.reduce(
          (acc, cond, index) =>
            index === 0 ? cond : sql`${acc} AND ${cond}`,
          sql`${whereConditions[0]}`,
        )}`
        : sql``;

    const results = await db
      .select({
        total: count(),
        sent: count(sql`CASE WHEN status = 'sent' THEN 1 END`),
        delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`),
        opened: count(sql`CASE WHEN status = 'opened' THEN 1 END`),
        clicked: count(sql`CASE WHEN status = 'clicked' THEN 1 END`),
        bounced: count(sql`CASE WHEN status = 'bounced' THEN 1 END`),
        failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
        pending: count(sql`CASE WHEN status = 'pending' THEN 1 END`),
        processing: count(sql`CASE WHEN status = 'processing' THEN 1 END`),
        cancelled: count(sql`CASE WHEN status = 'cancelled' THEN 1 END`),
      })
      .from(emailLogs)
      .where(whereClause);

    const stats = results[0];

    const metrics = this.calculateMetrics(stats);

    return { stats, metrics };
  }

  async getStatsByType(
    startDate?: Date,
    endDate?: Date,
  ): Promise<Record<string, { stats: EmailStats; metrics: EmailMetrics }>> {
    const whereConditions = this.buildDateConditions(startDate, endDate);
    const whereClause =
      whereConditions.length > 0
        ? sql`${whereConditions.reduce(
          (acc, cond, index) =>
            index === 0 ? cond : sql`${acc} AND ${cond}`,
          sql`${whereConditions[0]}`,
        )}`
        : sql``;

    const results = await db
      .select({
        type: emailLogs.type,
        total: count(),
        sent: count(sql`CASE WHEN status = 'sent' THEN 1 END`),
        delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`),
        opened: count(sql`CASE WHEN status = 'opened' THEN 1 END`),
        clicked: count(sql`CASE WHEN status = 'clicked' THEN 1 END`),
        bounced: count(sql`CASE WHEN status = 'bounced' THEN 1 END`),
        failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
        pending: count(sql`CASE WHEN status = 'pending' THEN 1 END`),
        processing: count(sql`CASE WHEN status = 'processing' THEN 1 END`),
        cancelled: count(sql`CASE WHEN status = 'cancelled' THEN 1 END`),
      })
      .from(emailLogs)
      .where(whereClause)
      .groupBy(emailLogs.type);

    return results.reduce(
      (acc, result) => {
        acc[result.type || 'unknown'] = {
          stats: result,
          metrics: this.calculateMetrics(result),
        };
        return acc;
      },
      {} as Record<string, { stats: EmailStats; metrics: EmailMetrics }>,
    );
  }

  async getTimeSeriesData(
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<TimeSeriesData[]> {
    let dateFormat = '%Y-%m-%d';

    switch (groupBy) {
    case 'week':
      dateFormat = '%Y-%u';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    }

    const results = await db
      .select({
        date: sql`DATE_FORMAT(${emailLogs.createdAt}, ${dateFormat})`,
        sent: count(sql`CASE WHEN status = 'sent' THEN 1 END`),
        delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`),
        opened: count(sql`CASE WHEN status = 'opened' THEN 1 END`),
        clicked: count(sql`CASE WHEN status = 'clicked' THEN 1 END`),
        bounced: count(sql`CASE WHEN status = 'bounced' THEN 1 END`),
      })
      .from(emailLogs)
      .where(
        and(
          gte(emailLogs.createdAt, startDate),
          lte(emailLogs.createdAt, endDate),
        ),
      )
      .groupBy(sql`DATE_FORMAT(${emailLogs.createdAt}, ${dateFormat})`)
      .orderBy(sql`date`);

    return results as TimeSeriesData[];
  }

  async getEngagementMetrics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<EngagementMetrics> {
    const whereConditions = this.buildDateConditions(startDate, endDate);
    const whereClause =
      whereConditions.length > 0
        ? sql`${whereConditions.reduce(
          (acc, cond, index) =>
            index === 0 ? cond : sql`${acc} AND ${cond}`,
          sql`${whereConditions[0]}`,
        )}`
        : sql``;

    const results = await db
      .select({
        totalOpens: sum(sql`JSON_EXTRACT(metadata, '$.openCount')`).mapWith(
          Number,
        ),
        uniqueOpens: count(sql`CASE WHEN openedAt IS NOT NULL THEN 1 END`),
        totalClicks: sum(sql`JSON_EXTRACT(metadata, '$.clickCount')`).mapWith(
          Number,
        ),
        uniqueClicks: count(
          sql`CASE WHEN lastClickedAt IS NOT NULL THEN 1 END`,
        ),
        avgTimeToOpen: sql`AVG(TIMESTAMPDIFF(SECOND, sentAt, openedAt))`,
        avgTimeToClick: sql`AVG(TIMESTAMPDIFF(SECOND, sentAt, lastClickedAt))`,
      })
      .from(emailLogs)
      .where(whereClause);

    const metrics = results[0];

    return {
      totalOpens: metrics.totalOpens || 0,
      uniqueOpens: metrics.uniqueOpens || 0,
      totalClicks: metrics.totalClicks || 0,
      uniqueClicks: metrics.uniqueClicks || 0,
      avgTimeToOpen: metrics.avgTimeToOpen || 0,
      avgTimeToClick: metrics.avgTimeToClick || 0,
    };
  }

  async getTopPerformingTemplates(
    startDate?: Date,
    endDate?: Date,
    limit: number = 10,
  ): Promise<TopPerformingTemplate[]> {
    const whereConditions = this.buildDateConditions(startDate, endDate);
    const whereClause =
      whereConditions.length > 0
        ? sql`${whereConditions.reduce(
          (acc, cond, index) =>
            index === 0 ? cond : sql`${acc} AND ${cond}`,
          sql`${whereConditions[0]}`,
        )}`
        : sql``;

    const results = await db
      .select({
        templateId: emailLogs.templateId,
        totalSent: count(),
        delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`),
        opened: count(sql`CASE WHEN status = 'opened' THEN 1 END`),
        clicked: count(sql`CASE WHEN status = 'clicked' THEN 1 END`),
      })
      .from(emailLogs)
      .where(sql`templateId IS NOT NULL AND ${whereClause}`)
      .groupBy(emailLogs.templateId)
      .orderBy(sql`delivered DESC`)
      .limit(limit);

    return results.map(result => ({
      templateId: result.templateId!,
      templateName: `Template ${result.templateId}`, // In a real implementation, you'd join with emailTemplates table
      totalSent: result.totalSent,
      delivered: result.delivered,
      opened: result.opened,
      clicked: result.clicked,
      deliveryRate:
        result.totalSent > 0 ? (result.delivered / result.totalSent) * 100 : 0,
      openRate:
        result.delivered > 0 ? (result.opened / result.delivered) * 100 : 0,
      clickRate: result.opened > 0 ? (result.clicked / result.opened) * 100 : 0,
    }));
  }

  async getBounceAnalysis(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalBounces: number;
    bounceRate: number;
    bouncesByType: Record<string, number>;
    bouncesByReason: Record<string, number>;
    topBouncingDomains: Array<{
      domain: string;
      count: number;
      percentage: number;
    }>;
  }> {
    const whereConditions = this.buildDateConditions(startDate, endDate);
    const whereClause =
      whereConditions.length > 0
        ? sql`${whereConditions.reduce(
          (acc, cond, index) =>
            index === 0 ? cond : sql`${acc} AND ${cond}`,
          sql`${whereConditions[0]}`,
        )}`
        : sql``;

    const [
      totalResult,
      bouncesByTypeResult,
      bouncesByReasonResult,
      domainResults,
    ] = await Promise.all([
      db
        .select({
          total: count(),
          bounced: count(sql`CASE WHEN status = 'bounced' THEN 1 END`),
        })
        .from(emailLogs)
        .where(whereClause),

      db
        .select({
          bounceType: emailLogs.bounceType,
          count: count(),
        })
        .from(emailLogs)
        .where(sql`status = 'bounced' AND ${whereClause}`)
        .groupBy(emailLogs.bounceType),

      db
        .select({
          bounceReason: emailLogs.bounceReason,
          count: count(),
        })
        .from(emailLogs)
        .where(
          sql`status = 'bounced' AND bounceReason IS NOT NULL AND ${whereClause}`,
        )
        .groupBy(emailLogs.bounceReason)
        .orderBy(sql`count DESC`)
        .limit(10),

      db
        .select({
          domain: sql`SUBSTRING_INDEX(toEmail, '@', -1)`,
          count: count(),
        })
        .from(emailLogs)
        .where(sql`status = 'bounced' AND ${whereClause}`)
        .groupBy(sql`SUBSTRING_INDEX(toEmail, '@', -1)`)
        .orderBy(sql`count DESC`)
        .limit(10),
    ]);

    const total = totalResult[0];
    const bounceRate =
      total.total > 0 ? (total.bounced / total.total) * 100 : 0;

    return {
      totalBounces: total.bounced,
      bounceRate,
      bouncesByType: bouncesByTypeResult.reduce(
        (acc, item) => {
          acc[item.bounceType || 'unknown'] = item.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      bouncesByReason: bouncesByReasonResult.reduce(
        (acc, item) => {
          acc[item.bounceReason || 'unknown'] = item.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      topBouncingDomains: domainResults.map(item => ({
        domain: item.domain,
        count: item.count,
        percentage: total.bounced > 0 ? (item.count / total.bounced) * 100 : 0,
      })),
    };
  }

  async getProviderComparison(
    startDate?: Date,
    endDate?: Date,
  ): Promise<Record<string, EmailStats & EmailMetrics>> {
    const whereConditions = this.buildDateConditions(startDate, endDate);
    const whereClause =
      whereConditions.length > 0
        ? sql`${whereConditions.reduce(
          (acc, cond, index) =>
            index === 0 ? cond : sql`${acc} AND ${cond}`,
          sql`${whereConditions[0]}`,
        )}`
        : sql``;

    const results = await db
      .select({
        provider: emailLogs.provider,
        total: count(),
        sent: count(sql`CASE WHEN status = 'sent' THEN 1 END`),
        delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`),
        opened: count(sql`CASE WHEN status = 'opened' THEN 1 END`),
        clicked: count(sql`CASE WHEN status = 'clicked' THEN 1 END`),
        bounced: count(sql`CASE WHEN status = 'bounced' THEN 1 END`),
        failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
        pending: count(sql`CASE WHEN status = 'pending' THEN 1 END`),
        processing: count(sql`CASE WHEN status = 'processing' THEN 1 END`),
        cancelled: count(sql`CASE WHEN status = 'cancelled' THEN 1 END`),
      })
      .from(emailLogs)
      .where(whereClause)
      .groupBy(emailLogs.provider);

    return results.reduce(
      (acc, result) => {
        acc[result.provider] = {
          ...result,
          ...this.calculateMetrics(result),
        };
        return acc;
      },
      {} as Record<string, EmailStats & EmailMetrics>,
    );
  }

  async getLanguagePerformance(
    startDate?: Date,
    endDate?: Date,
  ): Promise<Record<string, EmailStats & EmailMetrics>> {
    const whereConditions = this.buildDateConditions(startDate, endDate);
    const whereClause =
      whereConditions.length > 0
        ? sql`${whereConditions.reduce(
          (acc, cond, index) =>
            index === 0 ? cond : sql`${acc} AND ${cond}`,
          sql`${whereConditions[0]}`,
        )}`
        : sql``;

    const results = await db
      .select({
        language: emailLogs.language,
        total: count(),
        sent: count(sql`CASE WHEN status = 'sent' THEN 1 END`),
        delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`),
        opened: count(sql`CASE WHEN status = 'opened' THEN 1 END`),
        clicked: count(sql`CASE WHEN status = 'clicked' THEN 1 END`),
        bounced: count(sql`CASE WHEN status = 'bounced' THEN 1 END`),
        failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
        pending: count(sql`CASE WHEN status = 'pending' THEN 1 END`),
        processing: count(sql`CASE WHEN status = 'processing' THEN 1 END`),
        cancelled: count(sql`CASE WHEN status = 'cancelled' THEN 1 END`),
      })
      .from(emailLogs)
      .where(whereClause)
      .groupBy(emailLogs.language);

    return results.reduce(
      (acc, result) => {
        acc[result.language] = {
          ...result,
          ...this.calculateMetrics(result),
        };
        return acc;
      },
      {} as Record<string, EmailStats & EmailMetrics>,
    );
  }

  async generateReport(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    summary: EmailStats & EmailMetrics;
    byType: Record<string, EmailStats & EmailMetrics>;
    timeSeries: TimeSeriesData[];
    engagement: EngagementMetrics;
    bounceAnalysis: any;
    topTemplates: TopPerformingTemplate[];
    providerComparison: Record<string, EmailStats & EmailMetrics>;
    languagePerformance: Record<string, EmailStats & EmailMetrics>;
  }> {
    const [
      summary,
      byType,
      timeSeries,
      engagement,
      bounceAnalysis,
      topTemplates,
      providerComparison,
      languagePerformance,
    ] = await Promise.all([
      this.getOverallStats(startDate, endDate),
      this.getStatsByType(startDate, endDate),
      this.getTimeSeriesData(startDate, endDate),
      this.getEngagementMetrics(startDate, endDate),
      this.getBounceAnalysis(startDate, endDate),
      this.getTopPerformingTemplates(startDate, endDate),
      this.getProviderComparison(startDate, endDate),
      this.getLanguagePerformance(startDate, endDate),
    ]);

    return {
      summary: { ...summary.stats, ...summary.metrics },
      byType,
      timeSeries,
      engagement,
      bounceAnalysis,
      topTemplates,
      providerComparison,
      languagePerformance,
    };
  }

  private buildDateConditions(startDate?: Date, endDate?: Date): any[] {
    const conditions: any[] = [];

    if (startDate) {
      conditions.push(gte(emailLogs.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(emailLogs.createdAt, endDate));
    }

    return conditions;
  }

  private calculateMetrics(stats: Partial<EmailStats>): EmailMetrics {
    const total = stats.total || 1; // Avoid division by zero
    const delivered = stats.delivered || 0;
    const opened = stats.opened || 0;
    const clicked = stats.clicked || 0;
    const bounced = stats.bounced || 0;
    const failed = stats.failed || 0;

    return {
      deliveryRate: (delivered / total) * 100,
      openRate: (opened / total) * 100,
      clickRate: (clicked / total) * 100,
      bounceRate: (bounced / total) * 100,
      failureRate: (failed / total) * 100,
    };
  }
}

export const emailAnalyticsService = new EmailAnalyticsService();
