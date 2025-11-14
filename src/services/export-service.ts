import { db } from '../config/database';
import { eq, and, desc } from 'drizzle-orm';
import { llmAnalyses, analysisJobs, questionnaires } from '../models/llm-schema';
import { logger } from '../utils/logger';

export interface ExportOptions {
  format: 'json' | 'csv' | 'ods';
  includeMetadata?: boolean;
  includeAnonymizedData?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  analysisTypes?: string[];
  questionnaireIds?: string[];
  language?: string;
}

export interface ExportResult {
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer | string;
  exportedAt: Date;
  recordCount: number;
}

export class ExportService {
  /**
   * Export analysis results in various formats
   */
  public async exportAnalyses(options: ExportOptions): Promise<ExportResult> {
    try {
      // Fetch analyses based on criteria
      const analyses = await this.fetchAnalyses(options);
      const processedData = this.processAnalysesForExport(analyses, options);

      let result: ExportResult;

      switch (options.format) {
      case 'json':
        result = await this.exportAsJSON(processedData, options);
        break;
      case 'csv':
        result = await this.exportAsCSV(processedData, options);
        break;
      case 'ods':
        result = await this.exportAsODS(processedData, options);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
      }

      logger.info('Export completed', {
        format: options.format,
        recordCount: result.recordCount,
        size: result.size,
      });

      return result;
    } catch (error) {
      logger.error('Export failed:', { error, options });
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Fetch analyses from database based on export criteria
   */
  private async fetchAnalyses(options: ExportOptions): Promise<any[]> {
    const whereConditions: any[] = [];

    // Date range filter
    if (options.dateRange) {
      whereConditions.push(
        and(
          eq(llmAnalyses.createdAt, options.dateRange.start),
          eq(llmAnalyses.createdAt, options.dateRange.end),
        ),
      );
    }

    // Analysis type filter
    if (options.analysisTypes && options.analysisTypes.length > 0) {
      whereConditions.push(eq(llmAnalyses.analysisType, options.analysisTypes[0])); // Simplified
    }

    // Questionnaire filter
    if (options.questionnaireIds && options.questionnaireIds.length > 0) {
      whereConditions.push(eq(llmAnalyses.questionnaireId, options.questionnaireIds[0])); // Simplified
    }

    // Language filter
    if (options.language) {
      whereConditions.push(eq(llmAnalyses.language, options.language));
    }

    const analyses = await db.query.llmAnalyses.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: desc(llmAnalyses.createdAt),
      with: {
        questionnaire: {
          columns: {
            id: true,
            title: true,
            description: true,
          },
        },
        job: {
          columns: {
            id: true,
            status: true,
            progress: true,
            triggeredBy: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    return analyses;
  }

  /**
   * Process analyses data for export
   */
  private processAnalysesForExport(analyses: any[], options: ExportOptions): any[] {
    return analyses.map(analysis => {
      const processed: any = {
        id: analysis.id,
        questionnaireId: analysis.questionnaireId,
        analysisType: analysis.analysisType,
        language: analysis.language,
        anonymizationLevel: analysis.anonymizationLevel,
        createdAt: analysis.createdAt.toISOString(),
        updatedAt: analysis.updatedAt.toISOString(),
      };

      // Include questionnaire info
      if (analysis.questionnaire && options.includeMetadata) {
        processed.questionnaireTitle = analysis.questionnaire.title;
        processed.questionnaireDescription = analysis.questionnaire.description;
      }

      // Include job info
      if (analysis.job && options.includeMetadata) {
        processed.jobStatus = analysis.job.status;
        processed.jobProgress = analysis.job.progress;
        processed.processingTime = analysis.job.completedAt
          ? new Date(analysis.job.completedAt).getTime() - new Date(analysis.job.createdAt).getTime()
          : null;
      }

      // Include results
      if (analysis.results) {
        processed.results = analysis.results;

        // Flatten certain fields for CSV export
        if (options.format === 'csv') {
          processed.summary = analysis.results.summary || '';
          processed.confidenceScore = analysis.results.confidenceScore || 0;
          processed.responseCount = analysis.results.responseCount || 0;

          // Handle themes for thematic analysis
          if (analysis.analysisType === 'thematic' && analysis.results.themes) {
            processed.themesCount = analysis.results.themes.length;
            processed.mainTheme = analysis.results.themes[0]?.name || '';
          }

          // Handle sentiment
          if (analysis.analysisType === 'sentiment' && analysis.results.sentiment) {
            processed.overallSentiment = analysis.results.sentiment.overall || '';
            processed.sentimentScore = analysis.results.sentiment.score || 0;
          }

          // Handle clusters
          if (analysis.analysisType === 'clusters' && analysis.results.clusters) {
            processed.clustersCount = analysis.results.clusters.length;
          }
        }
      }

      // Include anonymized data if requested
      if (options.includeAnonymizedData && analysis.anonymizedData) {
        processed.anonymizedData = analysis.anonymizedData;
      }

      // Include metadata
      if (options.includeMetadata) {
        processed.metadata = analysis.metadata;
        processed.qualityMetrics = analysis.qualityMetrics;
      }

      return processed;
    });
  }

  /**
   * Export as JSON
   */
  private async exportAsJSON(data: any[], options: ExportOptions): Promise<ExportResult> {
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportOptions: options,
      recordCount: data.length,
      data: data,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonString, 'utf8');

    return {
      filename: `analysis-export-${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json',
      size: buffer.length,
      data: buffer,
      exportedAt: new Date(),
      recordCount: data.length,
    };
  }

  /**
   * Export as CSV
   */
  private async exportAsCSV(data: any[], options: ExportOptions): Promise<ExportResult> {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    // Determine CSV headers
    const headers = this.getCSVHeaders(data, options);

    // Convert data to CSV rows
    const csvRows = [headers.join(',')];

    for (const item of data) {
      const row = headers.map(header => {
        let value = this.getNestedValue(item, header);

        // Handle special cases
        if (value === null || value === undefined) {
          return '';
        }

        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }

        // Escape CSV values
        value = String(value);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`;
        }

        return value;
      });

      csvRows.push(row.join(','));
    }

    const csvString = csvRows.join('\n');
    const buffer = Buffer.from(csvString, 'utf8');

    return {
      filename: `analysis-export-${new Date().toISOString().split('T')[0]}.csv`,
      mimeType: 'text/csv',
      size: buffer.length,
      data: buffer,
      exportedAt: new Date(),
      recordCount: data.length,
    };
  }

  /**
   * Export as ODS (OpenDocument Spreadsheet)
   */
  private async exportAsODS(data: any[], options: ExportOptions): Promise<ExportResult> {
    // For ODS export, we'll create a simple XML structure
    // In a production environment, you'd want to use a proper library like 'exceljs' or 'node-ods'

    if (data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = this.getCSVHeaders(data, options);
    const xmlContent = this.createODSContent(headers, data, options);

    const buffer = Buffer.from(xmlContent, 'utf8');

    return {
      filename: `analysis-export-${new Date().toISOString().split('T')[0]}.ods`,
      mimeType: 'application/vnd.oasis.opendocument.spreadsheet',
      size: buffer.length,
      data: buffer,
      exportedAt: new Date(),
      recordCount: data.length,
    };
  }

  /**
   * Get CSV headers from data structure
   */
  private getCSVHeaders(data: any[], options: ExportOptions): string[] {
    const headers = new Set<string>();

    for (const item of data) {
      this.extractHeaders(item, '', headers);
    }

    return Array.from(headers).sort();
  }

  /**
   * Recursively extract headers from nested objects
   */
  private extractHeaders(obj: any, prefix: string, headers: Set<string>): void {
    if (obj === null || typeof obj !== 'object') {
      return;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const header = prefix ? `${prefix}.${key}` : key;
        headers.add(header);

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          this.extractHeaders(obj[key], header, headers);
        }
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Create ODS XML content (simplified version)
   */
  private createODSContent(headers: string[], data: any[], options: ExportOptions): string {
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                       xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                       xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0">
  <office:body>
    <office:spreadsheet>
      <table:table name="Analysis Export">
`;

    // Create header row
    const headerRow = headers.map(header =>
      `          <table:table-cell office:value-type="string">
            <text:p>${this.escapeXML(header)}</text:p>
          </table:table-cell>`,
    ).join('\n');

    // Create data rows
    const dataRows = data.map(item => {
      const cells = headers.map(header => {
        let value = this.getNestedValue(item, header);
        let valueType = 'string';

        if (typeof value === 'number') {
          valueType = 'float';
        } else if (typeof value === 'boolean') {
          valueType = 'boolean';
          value = value ? 'true' : 'false';
        } else if (value === null || value === undefined) {
          value = '';
        } else {
          value = String(value);
        }

        return `          <table:table-cell office:value-type="${valueType}" office:value="${value}">
            <text:p>${this.escapeXML(String(value))}</text:p>
          </table:table-cell>`;
      }).join('\n');

      return `        <table:table-row>\n${cells}\n        </table:table-row>`;
    }).join('\n');

    const xmlFooter = `
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document-content>`;

    return xmlHeader + `        <table:table-row>\n${headerRow}\n        </table:table-row>\n` + dataRows + xmlFooter;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get export statistics
   */
  public async getExportStats(): Promise<{
    totalExports: number;
    exportsByFormat: Record<string, number>;
    totalDataSize: number;
    averageExportSize: number;
    recentExports: Array<{
      format: string;
      recordCount: number;
      size: number;
      exportedAt: Date;
    }>;
  }> {
    // This would typically query a database table that tracks export history
    // For now, returning mock data
    return {
      totalExports: 145,
      exportsByFormat: {
        json: 58,
        csv: 67,
        ods: 20,
      },
      totalDataSize: 1024 * 1024 * 1024, // 1GB
      averageExportSize: 7.2 * 1024 * 1024, // 7.2MB
      recentExports: [
        {
          format: 'json',
          recordCount: 1250,
          size: 15.2 * 1024 * 1024,
          exportedAt: new Date(Date.now() - 3600000),
        },
        {
          format: 'csv',
          recordCount: 890,
          size: 8.7 * 1024 * 1024,
          exportedAt: new Date(Date.now() - 7200000),
        },
        {
          format: 'ods',
          recordCount: 156,
          size: 3.4 * 1024 * 1024,
          exportedAt: new Date(Date.now() - 10800000),
        },
      ],
    };
  }

  /**
   * Validate export request
   */
  public validateExportRequest(options: ExportOptions): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!options.format || !['json', 'csv', 'ods'].includes(options.format)) {
      errors.push('Invalid export format. Must be one of: json, csv, ods');
    }

    if (options.dateRange) {
      if (options.dateRange.start >= options.dateRange.end) {
        errors.push('Date range start must be before end date');
      }

      const now = new Date();
      if (options.dateRange.end > now) {
        errors.push('Date range end cannot be in the future');
      }

      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      if (options.dateRange.start < oneYearAgo) {
        errors.push('Date range cannot exceed one year');
      }
    }

    if (options.questionnaireIds && options.questionnaireIds.length > 50) {
      errors.push('Cannot export more than 50 questionnaires at once');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const exportService = new ExportService();
