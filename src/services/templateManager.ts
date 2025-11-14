import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  db,
  questionnaires,
  questionGroups,
  questions,
  eq,
  and,
  desc,
  sql,
} from '../config/database';
import {
  Questionnaire,
  InsertQuestionnaire,
  QuestionGroup,
  InsertQuestionGroup,
  Question,
  InsertQuestion,
} from '../models/postgresql-schema';
import { v4 as uuidv4 } from 'uuid';
import { ParsedTemplate, PDFTemplateParser } from './pdfTemplateParser';

export interface TemplateVersion {
  id: string;
  template_id: string;
  version: string;
  created_at: string;
  created_by: number;
  changes: string;
  template_data: ParsedTemplate;
}

export interface TemplateUsageAnalytics {
  template_id: string;
  usage_count: number;
  last_used: string;
  average_completion_rate: number;
  average_time_minutes: number;
  ratings: number[];
  feedback_count: number;
}

export interface TemplateImportResult {
  success: boolean;
  template_id?: string;
  questionnaire_id?: string;
  errors?: string[];
  warnings?: string[];
}

export class TemplateManager {
  private parser: PDFTemplateParser;
  private templatesDirectory: string;

  constructor(templatesDirectory = './src/templates') {
    this.parser = new PDFTemplateParser();
    this.templatesDirectory = templatesDirectory;
  }

  /**
   * Load predefined template from file
   */
  async loadPredefinedTemplate(
    templateId: string,
  ): Promise<ParsedTemplate | null> {
    try {
      const templatePath = path.join(
        this.templatesDirectory,
        `${templateId}.json`,
      );
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const template: ParsedTemplate = JSON.parse(templateContent);

      // Validate template structure
      const validation = this.parser.validateTemplate(template);
      if (!validation.valid) {
        throw new Error(
          `Invalid template structure: ${validation.errors.join(', ')}`,
        );
      }

      return template;
    } catch (error) {
      console.error(`Error loading template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Create questionnaire from template
   */
  async createQuestionnaireFromTemplate(
    templateId: string,
    workshopId: string | null,
    title?: { pl: string; en: string },
    creatorId: number,
  ): Promise<Questionnaire> {
    // Load template
    const template = await this.loadPredefinedTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Create questionnaire
    const questionnaireData: InsertQuestionnaire = {
      id: uuidv4(),
      workshopId: workshopId || undefined,
      title: title || template.title,
      instructions: template.instructions,
      status: 'draft',
      settings: template.settings,
      createdBy: creatorId,
    };

    const [questionnaire] = await db
      .insert(questionnaires)
      .values(questionnaireData)
      .returning();

    // Create question groups and questions
    for (const section of template.sections) {
      const group: InsertQuestionGroup = {
        id: uuidv4(),
        questionnaireId: questionnaire.id,
        title: section.title,
        description: section.description,
        orderIndex: section.order,
        uiConfig: {
          collapsed: false,
          show_progress: template.settings.show_all_questions,
          icon: section.icon || null,
        },
      };

      const [createdGroup] = await db
        .insert(questionGroups)
        .values(group)
        .returning();

      // Create questions for this group
      for (const questionData of section.questions) {
        const question: InsertQuestion = {
          id: uuidv4(),
          groupId: createdGroup.id,
          text: questionData.text,
          type: questionData.type,
          options: questionData.options,
          validation: {
            required: questionData.required,
            ...questionData.validation,
          },
          conditionalLogic: questionData.conditionalLogic,
          orderIndex: questionData.order,
          helpText: questionData.help_text,
        };

        await db.insert(questions).values(question);
      }
    }

    // Track template usage
    await this.trackTemplateUsage(templateId);

    return questionnaire;
  }

  /**
   * Import PDF and create template
   */
  async importPDFToTemplate(
    pdfBuffer: Buffer,
    templateMetadata: {
      title: { pl: string; en?: string };
      category: string;
      language: string;
      creatorId: number;
    },
    options: {
      language?: 'pl' | 'en' | 'both';
      autoDetectQuestions?: boolean;
    } = {},
  ): Promise<TemplateImportResult> {
    try {
      // Parse PDF
      const template = await this.parser.parsePDF(pdfBuffer, {
        language: options.language || 'both',
        autoDetectQuestions: options.autoDetectQuestions,
      });

      // Override template metadata with provided values
      template.title = templateMetadata.title;
      template.category = templateMetadata.category;
      template.language = templateMetadata.language;

      // Validate template
      const validation = this.parser.validateTemplate(template);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Save template to file system
      const templateId = template.template_id;
      const templatePath = path.join(
        this.templatesDirectory,
        `${templateId}.json`,
      );

      // Ensure templates directory exists
      await fs.mkdir(this.templatesDirectory, { recursive: true });

      await fs.writeFile(
        templatePath,
        JSON.stringify(template, null, 2),
        'utf-8',
      );

      // Create questionnaire from the new template
      const questionnaire = await this.createQuestionnaireFromTemplate(
        templateId,
        null, // Not attached to workshop initially
        template.title,
        templateMetadata.creatorId,
      );

      return {
        success: true,
        template_id: templateId,
        questionnaire_id: questionnaire.id,
      };
    } catch (error) {
      console.error('Error importing PDF to template:', error);
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Unknown error occurred',
        ],
      };
    }
  }

  /**
   * Create new version of existing template
   */
  async createTemplateVersion(
    templateId: string,
    updatedTemplate: ParsedTemplate,
    changes: string,
    creatorId: number,
  ): Promise<string> {
    // Generate new version number
    const existingTemplate = await this.loadPredefinedTemplate(templateId);
    if (!existingTemplate) {
      throw new Error(`Template ${templateId} not found`);
    }

    const currentVersion = existingTemplate.version;
    const [major, minor] = currentVersion.split('.').map(Number);
    const newVersion = `${major}.${minor + 1}`;

    // Update version in template
    updatedTemplate.version = newVersion;
    updatedTemplate.metadata.last_updated = new Date().toISOString();

    // Save updated template
    const templatePath = path.join(
      this.templatesDirectory,
      `${templateId}.json`,
    );
    await fs.writeFile(
      templatePath,
      JSON.stringify(updatedTemplate, null, 2),
      'utf-8',
    );

    // Store version history (you might want to store this in a database table)
    // For now, we'll create a separate version file
    const versionHistoryPath = path.join(
      this.templatesDirectory,
      `${templateId}_versions.json`,
    );

    let versions: TemplateVersion[] = [];
    try {
      const existingVersions = await fs.readFile(versionHistoryPath, 'utf-8');
      versions = JSON.parse(existingVersions);
    } catch (error) {
      // File doesn't exist yet, start with empty array
    }

    const newVersionRecord: TemplateVersion = {
      id: uuidv4(),
      template_id: templateId,
      version: newVersion,
      created_at: new Date().toISOString(),
      created_by: creatorId,
      changes,
      template_data: existingTemplate, // Store old version
    };

    versions.push(newVersionRecord);
    await fs.writeFile(
      versionHistoryPath,
      JSON.stringify(versions, null, 2),
      'utf-8',
    );

    return newVersion;
  }

  /**
   * Rollback template to previous version
   */
  async rollbackTemplate(
    templateId: string,
    targetVersion: string,
    creatorId: number,
  ): Promise<ParsedTemplate> {
    const versionHistoryPath = path.join(
      this.templatesDirectory,
      `${templateId}_versions.json`,
    );

    try {
      const versionsContent = await fs.readFile(versionHistoryPath, 'utf-8');
      const versions: TemplateVersion[] = JSON.parse(versionsContent);

      const targetVersionRecord = versions.find(
        v => v.version === targetVersion,
      );
      if (!targetVersionRecord) {
        throw new Error(`Version ${targetVersion} not found`);
      }

      // Restore the old template
      const rolledBackTemplate = targetVersionRecord.template_data;

      // Update metadata
      rolledBackTemplate.metadata.last_updated = new Date().toISOString();

      // Save the rolled back template
      const templatePath = path.join(
        this.templatesDirectory,
        `${templateId}.json`,
      );
      await fs.writeFile(
        templatePath,
        JSON.stringify(rolledBackTemplate, null, 2),
        'utf-8',
      );

      // Add rollback entry to version history
      const rollbackVersion: TemplateVersion = {
        id: uuidv4(),
        template_id: templateId,
        version: `${targetVersion}-rollback-${Date.now()}`,
        created_at: new Date().toISOString(),
        created_by: creatorId,
        changes: `Rollback to version ${targetVersion}`,
        template_data: rolledBackTemplate,
      };

      versions.push(rollbackVersion);
      await fs.writeFile(
        versionHistoryPath,
        JSON.stringify(versions, null, 2),
        'utf-8',
      );

      return rolledBackTemplate;
    } catch (error) {
      throw new Error(
        `Failed to rollback template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get template usage analytics
   */
  async getTemplateUsageAnalytics(
    templateId: string,
  ): Promise<TemplateUsageAnalytics | null> {
    try {
      // Count questionnaires created from this template
      const [usageData] = await db
        .select({
          count: sql<number>`count(*)`,
          last_used: sql<string>`max(${questionnaires.createdAt})`,
        })
        .from(questionnaires)
        .where(eq(questionnaires.templateId, templateId));

      if (!usageData || usageData.count === 0) {
        return null;
      }

      // Calculate completion rates and average time
      const questionnairesList = await db.query.questionnaires.findMany({
        where: eq(questionnaires.templateId, templateId),
        with: {
          responses: {
            columns: {
              id: true,
              status: true,
              submittedAt: true,
            },
          },
        },
      });

      let totalCompletionTime = 0;
      let completedCount = 0;
      const ratings: number[] = [];

      questionnairesList.forEach(questionnaire => {
        const submittedResponses =
          questionnaire.responses?.filter(r => r.status === 'submitted') || [];
        if (submittedResponses.length > 0) {
          completedCount++;
          // Calculate time based on first and last response
          const times = submittedResponses
            .map(r => new Date(r.submittedAt!).getTime())
            .sort();
          if (times.length > 1) {
            totalCompletionTime +=
              (times[times.length - 1] - times[0]) / (1000 * 60); // Convert to minutes
          }
        }
      });

      const averageCompletionRate =
        questionnairesList.length > 0
          ? completedCount / questionnairesList.length
          : 0;

      const averageTimeMinutes =
        completedCount > 0 ? totalCompletionTime / completedCount : 0;

      return {
        template_id: templateId,
        usage_count: usageData.count,
        last_used: usageData.last_used,
        average_completion_rate: averageCompletionRate,
        average_time_minutes: averageTimeMinutes,
        ratings,
        feedback_count: 0,
      };
    } catch (error) {
      console.error('Error getting template usage analytics:', error);
      return null;
    }
  }

  /**
   * List all available templates
   */
  async listTemplates(): Promise<
    Array<ParsedTemplate & { usage_count?: number }>
    > {
    try {
      const templateFiles = await fs.readdir(this.templatesDirectory);
      const templates: Array<ParsedTemplate & { usage_count?: number }> = [];

      for (const file of templateFiles) {
        if (file.endsWith('.json') && !file.endsWith('_versions.json')) {
          const templateId = file.replace('.json', '');
          const template = await this.loadPredefinedTemplate(templateId);

          if (template) {
            // Get usage count
            const [usageData] = await db
              .select({ count: sql<number>`count(*)` })
              .from(questionnaires)
              .where(eq(questionnaires.templateId, templateId));

            templates.push({
              ...template,
              usage_count: usageData?.count || 0,
            });
          }
        }
      }

      return templates.sort((a, b) => b.usage_count - a.usage_count);
    } catch (error) {
      console.error('Error listing templates:', error);
      return [];
    }
  }

  /**
   * Delete template (soft delete by moving to archive)
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const templatePath = path.join(
        this.templatesDirectory,
        `${templateId}.json`,
      );
      const archivePath = path.join(
        this.templatesDirectory,
        'archive',
        `${templateId}.json`,
      );

      // Move template to archive directory
      await fs.mkdir(path.join(this.templatesDirectory, 'archive'), {
        recursive: true,
      });
      await fs.rename(templatePath, archivePath);

      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }

  /**
   * Validate template file structure
   */
  async validateTemplateFile(
    templateId: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const template = await this.loadPredefinedTemplate(templateId);
      if (!template) {
        return {
          valid: false,
          errors: ['Template file not found or invalid JSON'],
        };
      }

      return this.parser.validateTemplate(template);
    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error ? error.message : 'Unknown validation error',
        ],
      };
    }
  }

  /**
   * Export template to JSON for sharing
   */
  async exportTemplate(templateId: string): Promise<string> {
    const template = await this.loadPredefinedTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Create export package with metadata
    const exportData = {
      template,
      exported_at: new Date().toISOString(),
      exported_by: 'workshopsAI_CMS',
      version: '1.0',
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import template from JSON export
   */
  async importTemplateFromJSON(
    jsonData: string,
    creatorId: number,
  ): Promise<TemplateImportResult> {
    try {
      const importData = JSON.parse(jsonData);

      if (!importData.template) {
        return {
          success: false,
          errors: ['Invalid export format: missing template data'],
        };
      }

      const template: ParsedTemplate = importData.template;

      // Validate imported template
      const validation = this.parser.validateTemplate(template);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Generate new template ID to avoid conflicts
      const newTemplateId = this.generateUniqueTemplateId(template.title.pl);
      template.template_id = newTemplateId;

      // Save template
      const templatePath = path.join(
        this.templatesDirectory,
        `${newTemplateId}.json`,
      );
      await fs.writeFile(
        templatePath,
        JSON.stringify(template, null, 2),
        'utf-8',
      );

      return {
        success: true,
        template_id: newTemplateId,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Invalid JSON format',
        ],
      };
    }
  }

  /**
   * Track template usage for analytics
   */
  private async trackTemplateUsage(templateId: string): Promise<void> {
    try {
      // This could be stored in a separate analytics table
      // For now, we'll just update a usage counter in a separate file
      const analyticsPath = path.join(
        this.templatesDirectory,
        'usage_analytics.json',
      );

      let analytics: Record<string, { count: number; last_used: string }> = {};

      try {
        const existingAnalytics = await fs.readFile(analyticsPath, 'utf-8');
        analytics = JSON.parse(existingAnalytics);
      } catch (error) {
        // File doesn't exist yet
      }

      analytics[templateId] = {
        count: (analytics[templateId]?.count || 0) + 1,
        last_used: new Date().toISOString(),
      };

      await fs.writeFile(
        analyticsPath,
        JSON.stringify(analytics, null, 2),
        'utf-8',
      );
    } catch (error) {
      console.error('Error tracking template usage:', error);
    }
  }

  /**
   * Generate unique template ID based on title
   */
  private generateUniqueTemplateId(title: string): string {
    const baseId = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 20);

    const hash = crypto
      .createHash('md5')
      .update(title + Date.now())
      .digest('hex')
      .substring(0, 8);
    return `${baseId}_${hash}`;
  }
}

export const templateManager = new TemplateManager();
