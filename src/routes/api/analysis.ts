import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db } from '../../config/database';
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import { enhancedLLMAnalysisWorker } from '../../services/enhanced-llm-worker';
import { anonymizationService } from '../../services/anonymization';
import {
  llmAnalyses,
  analysisJobs,
  questionnaires,
  users,
  responses,
  consents,
  analysisStatusEnum,
  analysisJobStatusEnum,
} from '../../models/postgresql-schema';
import { authenticateJWT } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Validation schemas
 */
const createAnalysisJobSchema = z.object({
  questionnaireId: z.string().uuid(),
  analysisTypes: z.array(z.enum(['thematic', 'clusters', 'contradictions', 'insights', 'recommendations', 'sentiment'])),
  options: z.object({
    minClusterSize: z.number().min(2).optional(),
    minThemeFrequency: z.number().min(1).optional(),
    includeSentiment: z.boolean().optional(),
    anonymizationLevel: z.enum(['partial', 'full']).optional(),
    customPrompt: z.string().optional(),
    batchSize: z.number().min(10).optional(),
    language: z.enum(['en', 'pl', 'auto']).optional(),
    culturalBiasHandling: z.boolean().optional(),
    provider: z.enum(['openai', 'anthropic', 'auto']).optional(),
    model: z.string().optional(),
    maxTokens: z.number().min(100).max(8000).optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  scheduledAt: z.string().datetime().optional(),
});

const getAnalysesSchema = z.object({
  questionnaireId: z.string().uuid(),
  analysisTypes: z.array(z.string()).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

const exportAnalysisSchema = z.object({
  analysisId: z.string().uuid(),
  format: z.enum(['json', 'csv', 'ods']),
  includeMetadata: z.boolean().optional(),
  includeRawResponses: z.boolean().optional(),
});

/**
 * Rate limiting configuration
 */
const analysisRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many analysis requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/analysis/jobs - Create new analysis job
 */
router.post('/jobs', authenticateJWT, analysisRateLimit, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const validatedData = createAnalysisJobSchema.parse(req.body);

    // Verify user owns the questionnaire
    const questionnaire = await db.query.questionnaires.findFirst({
      where: and(
        eq(questionnaires.id, validatedData.questionnaireId),
        eq(questionnaires.createdBy, userId),
      ),
    });

    if (!questionnaire) {
      return res.status(404).json({
        error: 'Questionnaire not found or access denied',
      });
    }

    // Check if there are responses to analyze
    const responseCount = await db.query.responses.findMany({
      where: eq(responses.questionnaireId, validatedData.questionnaireId),
    });

    if (responseCount.length === 0) {
      return res.status(400).json({
        error: 'No responses found for this questionnaire',
      });
    }

    // Create the analysis job
    const jobId = await enhancedLLMAnalysisWorker.addJob({
      questionnaireId: validatedData.questionnaireId,
      analysisTypes: validatedData.analysisTypes,
      options: validatedData.options,
      priority: validatedData.priority,
      scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined,
      triggeredBy: userId,
    });

    logger.info('Analysis job created', {
      userId,
      jobId,
      questionnaireId: validatedData.questionnaireId,
      analysisTypes: validatedData.analysisTypes,
    });

    res.status(201).json({
      jobId,
      message: 'Analysis job created successfully',
      estimatedDuration: Math.ceil(responseCount.length / 10), // Rough estimate
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Error creating analysis job', { error, userId: (req as any).user?.id });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/analysis/jobs/:jobId/status - Get job status and progress
 */
router.get('/jobs/:jobId/status', authenticateJWT, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user.id;

    // Verify job ownership
    const job = await db.query.analysisJobs.findFirst({
      where: and(
        eq(analysisJobs.id, jobId),
        eq(analysisJobs.triggeredBy, userId),
      ),
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found or access denied',
      });
    }

    // Get current status from queue
    const queueStatus = await enhancedLLMAnalysisWorker.getJobStatus(jobId);

    // Get related analyses
    const analyses = await db.query.llmAnalyses.findMany({
      where: eq(llmAnalyses.questionnaireId, job.questionnaireId),
      orderBy: desc(llmAnalyses.createdAt),
    });

    res.json({
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        totalSteps: job.totalSteps,
        completedSteps: job.completedSteps,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorLog: job.errorLog,
      },
      queue: queueStatus,
      analyses: analyses.map(analysis => ({
        id: analysis.id,
        type: analysis.analysisType,
        status: analysis.status,
        createdAt: analysis.createdAt,
        completedAt: analysis.completedAt,
        errorMessage: analysis.errorMessage,
      })),
    });

  } catch (error) {
    logger.error('Error getting job status', { error, jobId: req.params.jobId });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/analysis/jobs/:jobId/cancel - Cancel a job
 */
router.post('/jobs/:jobId/cancel', authenticateJWT, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user.id;

    // Verify job ownership
    const job = await db.query.analysisJobs.findFirst({
      where: and(
        eq(analysisJobs.id, jobId),
        eq(analysisJobs.triggeredBy, userId),
      ),
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found or access denied',
      });
    }

    if (job.status !== 'queued') {
      return res.status(400).json({
        error: 'Job cannot be cancelled in current status',
      });
    }

    await enhancedLLMAnalysisWorker.cancelJob(jobId);

    logger.info('Analysis job cancelled', { userId, jobId });

    res.json({
      message: 'Job cancelled successfully',
    });

  } catch (error) {
    logger.error('Error cancelling job', { error, jobId: req.params.jobId });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/analysis/results - Get analysis results
 */
router.get('/results', authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const validatedQuery = getAnalysesSchema.parse(req.query);

    // Verify questionnaire ownership
    const questionnaire = await db.query.questionnaires.findFirst({
      where: and(
        eq(questionnaires.id, validatedQuery.questionnaireId),
        eq(questionnaires.createdBy, userId),
      ),
    });

    if (!questionnaire) {
      return res.status(404).json({
        error: 'Questionnaire not found or access denied',
      });
    }

    // Build query conditions
    const conditions = [eq(llmAnalyses.questionnaireId, validatedQuery.questionnaireId)];

    if (validatedQuery.analysisTypes) {
      conditions.push(inArray(llmAnalyses.analysisType, validatedQuery.analysisTypes as any[]));
    }

    if (validatedQuery.status) {
      conditions.push(eq(llmAnalyses.status, validatedQuery.status as any));
    }

    // Get analyses with pagination
    const analyses = await db.query.llmAnalyses.findMany({
      where: conditions.length > 1 ? and(...conditions) : conditions[0],
      orderBy: desc(llmAnalyses.createdAt),
      limit: validatedQuery.limit || 20,
      offset: validatedQuery.offset || 0,
    });

    // Get total count
    const totalCount = await db.query.llmAnalyses.findMany({
      where: conditions.length > 1 ? and(...conditions) : conditions[0],
    });

    res.json({
      analyses,
      pagination: {
        total: totalCount.length,
        limit: validatedQuery.limit || 20,
        offset: validatedQuery.offset || 0,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Error getting analysis results', { error, userId: (req as any).user?.id });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/analysis/results/:analysisId - Get specific analysis result
 */
router.get('/results/:analysisId', authenticateJWT, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const userId = (req as any).user.id;

    const analysis = await db.query.llmAnalyses.findFirst({
      where: eq(llmAnalyses.id, analysisId),
      with: {
        questionnaire: {
          with: {
            creator: {
              columns: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!analysis) {
      return res.status(404).json({
        error: 'Analysis not found',
      });
    }

    // Verify user has access (either owner or has consent)
    if (analysis.questionnaire?.createdBy !== userId) {
      // Check if user has consent to view this analysis
      const hasConsent = await db
        .select()
        .from(consents)
        .where(
          and(
            eq(consents.questionnaireId, analysis.questionnaireId),
            eq(consents.userId, userId),
            eq(consents.consentType, 'research_analysis'),
            eq(consents.granted, true),
          ),
        )
        .limit(1);

      if (!hasConsent) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions',
        });
      }
    }

    res.json(analysis);

  } catch (error) {
    logger.error('Error getting analysis result', { error, analysisId: req.params.analysisId });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * PATCH /api/analysis/results/:analysisId/visibility - Toggle analysis visibility for participants
 */
router.patch('/results/:analysisId/visibility', authenticateJWT, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { isVisible } = z.object({ isVisible: z.boolean() }).parse(req.body);
    const userId = (req as any).user.id;

    // Verify analysis exists and user owns the questionnaire
    const analysis = await db.query.llmAnalyses.findFirst({
      where: eq(llmAnalyses.id, analysisId),
      with: {
        questionnaire: true,
      },
    });

    if (!analysis) {
      return res.status(404).json({
        error: 'Analysis not found',
      });
    }

    if (analysis.questionnaire.createdBy !== userId) {
      return res.status(403).json({
        error: 'Access denied - only questionnaire creator can change visibility',
      });
    }

    // Update visibility
    await db
      .update(llmAnalyses)
      .set({ isVisibleToParticipants: isVisible })
      .where(eq(llmAnalyses.id, analysisId));

    logger.info('Analysis visibility updated', {
      userId,
      analysisId,
      isVisible,
    });

    res.json({
      success: true,
      message: `Analysis is now ${isVisible ? 'visible' : 'hidden'} to participants`,
      isVisible,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Error updating analysis visibility', { error, analysisId: req.params.analysisId });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/analysis/results/:analysisId/export - Export analysis results
 */
router.post('/results/:analysisId/export', authenticateJWT, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const userId = (req as any).user.id;
    const validatedData = exportAnalysisSchema.parse(req.body);

    // Get analysis with related questionnaire
    const analysis = await db.query.llmAnalyses.findFirst({
      where: eq(llmAnalyses.id, analysisId),
      with: {
        questionnaire: true,
      },
    });

    if (!analysis) {
      return res.status(404).json({
        error: 'Analysis not found',
      });
    }

    // Verify user has access
    if (analysis.questionnaire.createdBy !== userId) {
      const hasConsent = await db
        .select()
        .from(consents)
        .where(
          and(
            eq(consents.questionnaireId, analysis.questionnaireId),
            eq(consents.userId, userId),
            eq(consents.consentType, 'research_analysis'),
            eq(consents.granted, true),
          ),
        )
        .limit(1);

      if (!hasConsent) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions',
        });
      }
    }

    // Get related responses if requested
    let responseData = null;
    if (validatedData.includeRawResponses) {
      responseData = await db.query.responses.findMany({
        where: eq(responses.questionnaireId, analysis.questionnaireId),
      });

      // Anonymize responses for export
      const anonymizedResponses = await Promise.all(
        responseData.map(r => anonymizationService.anonymizeResponse(r, 'full'))
      );
      responseData = anonymizedResponses.map(ar => ({
        ...ar.anonymizationResult,
        answer: ar.answer,
      }));
    }

    // Generate export data
    const exportData = {
      analysis: {
        ...analysis,
        questionnaire: {
          id: analysis.questionnaire.id,
          titleI18n: analysis.questionnaire.titleI18n,
          createdAt: analysis.questionnaire.createdAt,
        },
      },
      responses: responseData,
      metadata: validatedData.includeMetadata ? {
        exportedAt: new Date().toISOString(),
        exportedBy: userId,
        format: validatedData.format,
      } : undefined,
    };

    // Format based on requested format
    let formattedData: string;
    let contentType: string;
    let filename: string;

    switch (validatedData.format) {
      case 'json':
        formattedData = JSON.stringify(exportData, null, 2);
        contentType = 'application/json';
        filename = `analysis_${analysisId}.json`;
        break;

      case 'csv':
        formattedData = convertToCSV(exportData);
        contentType = 'text/csv';
        filename = `analysis_${analysisId}.csv`;
        break;

      case 'ods':
        // For ODS, we'll return JSON and let the client handle conversion
        formattedData = JSON.stringify(exportData, null, 2);
        contentType = 'application/vnd.oasis.opendocument.spreadsheet';
        filename = `analysis_${analysisId}.ods`;
        break;

      default:
        return res.status(400).json({
          error: 'Unsupported export format',
        });
    }

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(formattedData);

    logger.info('Analysis exported', {
      userId,
      analysisId,
      format: validatedData.format,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Error exporting analysis', { error, analysisId: req.params.analysisId });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/analysis/stats - Get analysis statistics
 */
router.get('/stats', authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { questionnaireId } = req.query;

    // Verify questionnaire ownership if specified
    if (questionnaireId) {
      const questionnaire = await db.query.questionnaires.findFirst({
        where: and(
          eq(questionnaires.id, questionnaireId as string),
          eq(questionnaires.createdBy, userId),
        ),
      });

      if (!questionnaire) {
        return res.status(404).json({
          error: 'Questionnaire not found or access denied',
        });
      }
    }

    // Build query conditions
    const conditions = [];

    if (questionnaireId) {
      conditions.push(eq(llmAnalyses.questionnaireId, questionnaireId as string));
    }

    // Get analysis statistics
    const query = db.query.llmAnalyses.findMany(
      conditions.length > 0 ? { where: conditions[0] } : undefined
    );
    const allAnalyses = await query;

    const stats = {
      total: allAnalyses.length,
      byStatus: {
        pending: allAnalyses.filter(a => a.status === 'pending').length,
        processing: allAnalyses.filter(a => a.status === 'processing').length,
        completed: allAnalyses.filter(a => a.status === 'completed').length,
        failed: allAnalyses.filter(a => a.status === 'failed').length,
      },
      byType: {
        thematic: allAnalyses.filter(a => a.analysisType === 'thematic').length,
        clusters: allAnalyses.filter(a => a.analysisType === 'clusters').length,
        contradictions: allAnalyses.filter(a => a.analysisType === 'contradictions').length,
        insights: allAnalyses.filter(a => a.analysisType === 'insights').length,
        recommendations: allAnalyses.filter(a => a.analysisType === 'recommendations').length,
        sentiment: allAnalyses.filter(a => a.analysisType === 'sentiment').length,
      },
      averageProcessingTime: calculateAverageProcessingTime(allAnalyses),
      totalCost: calculateTotalCost(allAnalyses),
    };

    // Get queue statistics
    const queueStats = await enhancedLLMAnalysisWorker.getQueueStats();

    // Get cost statistics
    const costStats = await enhancedLLMAnalysisWorker.getCostStats();

    res.json({
      analyses: stats,
      queue: queueStats,
      costs: costStats,
    });

  } catch (error) {
    logger.error('Error getting analysis statistics', { error, userId: (req as any).user?.id });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/analysis/gdpr-report - Generate GDPR compliance report
 */
router.get('/gdpr-report', authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { questionnaireId } = req.query;

    // Verify questionnaire ownership
    const questionnaire = await db.query.questionnaires.findFirst({
      where: and(
        eq(questionnaires.id, questionnaireId as string),
        eq(questionnaires.createdBy, userId),
      ),
    });

    if (!questionnaire) {
      return res.status(404).json({
        error: 'Questionnaire not found or access denied',
      });
    }

    // Get all responses for the questionnaire
    const allResponses = await db.query.responses.findMany({
      where: eq(responses.questionnaireId, questionnaireId as string),
    });

    // Get all analyses
    const analyses = await db.query.llmAnalyses.findMany({
      where: eq(llmAnalyses.questionnaireId, questionnaireId as string),
    });

    // Generate anonymization report
    const anonymizedResponses = await Promise.all(
      allResponses.map(async r => ({ ...r, answer: (await anonymizationService.anonymizeResponse(r, 'full')).answer }))
    );
    const anonymizationReport = anonymizationService.generateAnonymizationReport(
      allResponses,
      anonymizedResponses,
    );

    // Check consent status
    const consentRecords = await db.query.consents.findMany({
      where: and(
        eq(consents.questionnaireId, questionnaireId as string),
        eq(consents.granted, true),
      ),
    });

    // Generate GDPR report
    const gdprReport = {
      questionnaire: {
        id: questionnaire.id,
        titleI18n: questionnaire.titleI18n,
        createdAt: questionnaire.createdAt,
      },
      dataProcessing: {
        totalResponses: allResponses.length,
        uniqueRespondents: new Set(allResponses.map(r => r.userId).filter(Boolean)).size,
        analysesPerformed: analyses.length,
        consentRecords: consentRecords.length,
        consentRate: allResponses.length > 0 ? (consentRecords.length / allResponses.length) * 100 : 0,
      },
      anonymization: anonymizationReport,
      dataRetention: {
        oldestResponse: allResponses.length > 0 ?
          new Date(Math.min(...allResponses.map(r => new Date(r.submittedAt!).getTime()))) :
          null,
        retentionPeriod: '12 months',
        deletionSchedule: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)), // 1 year from now
      },
      legalBasis: {
        purpose: 'Research analysis for workshop improvement',
        lawfulBasis: 'Consent (Article 6(1)(a) GDPR)',
        dataCategories: ['Questionnaire responses', 'Demographic data'],
        recipients: ['Research team', 'AI analysis services'],
      },
      recommendations: [
        anonymizationReport.details.recommendations,
        'Review consent documentation',
        'Implement regular data retention reviews',
        'Consider data minimization principles',
      ].flat(),
      complianceScore: calculateGDPRComplianceScore(anonymizationReport, consentRecords.length, allResponses.length),
    };

    res.json(gdprReport);

  } catch (error) {
    logger.error('Error generating GDPR report', { error, userId: (req as any).user?.id });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/analysis/export/:questionnaireId - Export all analyses for a questionnaire
 */
router.get('/export/:questionnaireId', authenticateJWT, async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    const userId = (req as any).user.id;
    const { format = 'json', includeRawResponses = 'false' } = req.query;

    // Verify questionnaire ownership
    const questionnaire = await db.query.questionnaires.findFirst({
      where: and(
        eq(questionnaires.id, questionnaireId),
        eq(questionnaires.createdBy, userId),
      ),
    });

    if (!questionnaire) {
      return res.status(404).json({
        error: 'Questionnaire not found or access denied',
      });
    }

    // Get all analyses for the questionnaire
    const analyses = await db.query.llmAnalyses.findMany({
      where: eq(llmAnalyses.questionnaireId, questionnaireId),
      orderBy: desc(llmAnalyses.createdAt),
    });

    // Get responses if requested
    let responseData = null;
    if (includeRawResponses === 'true') {
      responseData = await db.query.responses.findMany({
        where: eq(responses.questionnaireId, questionnaireId),
      });

      // Anonymize responses
      responseData = await Promise.all(
        responseData.map(async (r) => ({
          ...r,
          answer: (await anonymizationService.anonymizeResponse(r, 'full')).answer,
          metadata: {
            ...(r.metadata as any),
            ipHash: '[HASHED]',
            userAgentHash: '[HASHED]',
          },
        }))
      );
    }

    // Get consent information
    const consentRecords = await db.query.consents.findMany({
      where: eq(consents.questionnaireId, questionnaireId),
    });

    // Create comprehensive export package
    const exportPackage = {
      questionnaire: {
        id: questionnaire.id,
        titleI18n: questionnaire.titleI18n,
        instructionsI18n: questionnaire.instructionsI18n,
        status: questionnaire.status,
        createdAt: questionnaire.createdAt,
        settings: questionnaire.settings,
      },
      analyses,
      responses: responseData,
      consents: {
        total: consentRecords.length,
        granted: consentRecords.filter(c => c.granted).length,
      },
      statistics: {
        totalAnalyses: analyses.length,
        completedAnalyses: analyses.filter(a => a.status === 'completed').length,
        failedAnalyses: analyses.filter(a => a.status === 'failed').length,
        totalResponses: responseData ? responseData.length : 0,
        totalConsents: consentRecords.filter(c => c.granted).length,
        consentRate: responseData && responseData.length > 0 ?
          (consentRecords.filter(c => c.granted).length / responseData.length) * 100 : 0,
      },
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: userId,
        format,
        version: '1.0',
        compliance: {
          gdprCompliant: true,
          anonymizationLevel: 'full',
          dataRetention: '12 months',
        },
      },
    };

    // Format based on requested format
    let formattedData: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        formattedData = convertAnalysesToCSV(exportPackage);
        contentType = 'text/csv';
        filename = `questionnaire_${questionnaireId}_analyses.csv`;
        break;

      case 'ods':
        // For ODS, return JSON and let client handle conversion
        formattedData = JSON.stringify(exportPackage, null, 2);
        contentType = 'application/vnd.oasis.opendocument.spreadsheet';
        filename = `questionnaire_${questionnaireId}_analyses.ods`;
        break;

      case 'json':
      default:
        formattedData = JSON.stringify(exportPackage, null, 2);
        contentType = 'application/json';
        filename = `questionnaire_${questionnaireId}_analyses.json`;
        break;
    }

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(formattedData);

    logger.info('Questionnaire analyses exported', {
      userId,
      questionnaireId,
      format,
      analysisCount: analyses.length,
    });

  } catch (error) {
    logger.error('Error exporting questionnaire analyses', {
      error,
      questionnaireId: req.params.questionnaireId,
    });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * Helper functions
 */

function convertToCSV(data: any): string {
  const csvRows: string[] = [];

  // Header
  csvRows.push('Analysis ID,Type,Status,Created At,Completed At,Results Summary');

  // Data rows
  csvRows.push(
    `${data.analysis.id},${data.analysis.analysisType},${data.analysis.status},${data.analysis.createdAt},${data.analysis.completedAt || ''},"${JSON.stringify(data.analysis.results).substring(0, 100)}..."`,
  );

  return csvRows.join('\n');
}

function convertAnalysesToCSV(packageData: any): string {
  const csvRows: string[] = [];

  // Questionnaire header
  csvRows.push('# Questionnaire');
  csvRows.push(`ID,${packageData.questionnaire.id}`);
  csvRows.push(`Title,${JSON.stringify(packageData.questionnaire.titleI18n)}`);
  csvRows.push(`Status,${packageData.questionnaire.status}`);
  csvRows.push(`Created At,${packageData.questionnaire.createdAt}`);
  csvRows.push('');

  // Analyses header
  csvRows.push('# Analyses');
  csvRows.push('ID,Type,Status,Created At,Completed At,Confidence Score,Tokens Used,Processing Time (ms),Cost Estimate,Provider,Model');

  // Analyses data
  for (const analysis of packageData.analyses) {
    const metadata = analysis.metadata || {};
    csvRows.push([
      analysis.id,
      analysis.analysisType,
      analysis.status,
      analysis.createdAt,
      analysis.completedAt || '',
      metadata.confidenceScore || '',
      metadata.tokensUsed || '',
      metadata.processingTimeMs || '',
      metadata.costEstimate || '',
      metadata.provider || '',
      metadata.model || '',
    ].join(','));
  }

  csvRows.push('');

  // Statistics
  csvRows.push('# Statistics');
  csvRows.push('Total Analyses,' + packageData.statistics.totalAnalyses);
  csvRows.push('Completed Analyses,' + packageData.statistics.completedAnalyses);
  csvRows.push('Failed Analyses,' + packageData.statistics.failedAnalyses);
  csvRows.push('Total Responses,' + packageData.statistics.totalResponses);
  csvRows.push('Consent Rate (%),' + packageData.statistics.consentRate.toFixed(2));

  return csvRows.join('\n');
}

function calculateAverageProcessingTime(analyses: any[]): number {
  const completedAnalyses = analyses.filter(a =>
    a.status === 'completed' && a.completedAt && a.metadata?.processingTimeMs,
  );

  if (completedAnalyses.length === 0) return 0;

  const totalTime = completedAnalyses.reduce((sum, a) =>
    sum + a.metadata.processingTimeMs, 0,
  );

  return Math.round(totalTime / completedAnalyses.length / 1000); // Convert to seconds
}

function calculateTotalCost(analyses: any[]): number {
  return analyses.reduce((total, a) =>
    total + (a.metadata?.costEstimate || 0), 0,
  );
}

function calculateGDPRComplianceScore(anonymizationReport: any, consentCount: number, responseCount: number): number {
  let score = 0;

  // Anonymization compliance (40 points)
  if (anonymizationReport.summary.kAnonymityCompliant) score += 20;
  if (anonymizationReport.summary.gdprCompliant) score += 20;

  // Consent compliance (30 points)
  const consentRate = responseCount > 0 ? consentCount / responseCount : 0;
  score += Math.round(consentRate * 30);

  // Data minimization (20 points)
  if (anonymizationReport.details.riskAssessment === 'Low risk') score += 20;
  else if (anonymizationReport.details.riskAssessment === 'Medium risk') score += 10;

  // Documentation (10 points)
  score += 10; // Assuming proper documentation exists

  return Math.min(100, score);
}

export default router;
