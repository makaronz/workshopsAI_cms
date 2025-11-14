import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import {
  db,
  responses,
  questions,
  questionGroups,
  questionnaires,
  users,
  enrollments,
  consents,
} from '../config/database';
import { eq, and, desc, asc, inArray, sql, isNull, count } from 'drizzle-orm';
import { responseService } from '../services/responseService';
import { authService } from '../services/authService';
import {
  createResponseValidator,
  validateGDPRCompliance,
  formatValidationErrors,
  sanitizeResponse,
  consentSchema,
  updateResponseSchema,
  exportOptionsSchema,
  bulkResponseSchema,
  type CreateResponseRequest,
  type UpdateResponseRequest,
  type ExportOptionsRequest,
} from '../validators/responseValidators';
import {
  responseSubmissionLimit,
  responseUpdateLimit,
  responseRetrievalLimit,
  responseExportLimit,
  autosaveRateLimit,
  bulkSubmissionRateLimit,
  ResponseDuplicateTracker,
  AdaptiveRateLimit,
} from '../middleware/responseRateLimit';
import {
  authenticateJWT,
  authorizeRoles,
  optionalAuth,
} from '../middleware/auth';

const router = Router();
const duplicateTracker = ResponseDuplicateTracker.getInstance();
const adaptiveRateLimit = AdaptiveRateLimit.getInstance();

// Apply authentication to all response routes
router.use(authenticateJWT);

/**
 * POST /api/v1/responses
 * Submit a single response to a question
 */
router.post(
  '/',
  responseSubmissionLimit,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Get user risk score for adaptive rate limiting
      const riskScore = await adaptiveRateLimit.getUserRiskScore(userId);
      const adjustedLimit = adaptiveRateLimit.getAdjustedLimit(50, riskScore);

      // Apply adaptive rate limiting
      const userRateLimit = {
        windowMs: 15 * 60 * 1000,
        max: adjustedLimit,
        message: `Adaptive rate limit: ${adjustedLimit} responses per 15 minutes`,
      };

      // Check if user exceeded adaptive limit
      const recentKey = `adaptive_limit:${userId}:${Date.now()}`;
      const recentCount = await db
        .select({ count: count() })
        .from(responses)
        .where(
          and(
            eq(responses.userId, parseInt(userId)),
            sql`createdAt > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
          ),
        );

      if (recentCount[0].count >= adjustedLimit) {
        await adaptiveRateLimit.logViolation(userId, 'adaptive_rate_limit');
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: userRateLimit.message,
          code: 'ADAPTIVE_RATE_LIMIT',
        });
      }

      // Validate request body
      const validationResult = createResponseValidator(req.body);
      const parseResult = validationResult.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formatValidationErrors(parseResult.error),
          code: 'VALIDATION_ERROR',
        });
      }

      const data = parseResult.data;

      // Get question details for validation
      const question = await db.query.questions.findFirst({
        where: eq(questions.id, data.questionId),
        with: {
          group: {
            with: {
              questionnaire: {
                columns: { id: true, status: true, settings: true },
              },
            },
          },
        },
      });

      if (!question) {
        return res.status(404).json({
          success: false,
          error: 'Question not found',
          code: 'QUESTION_NOT_FOUND',
        });
      }

      // Check if questionnaire is published
      if (question.group.questionnaire.status !== 'published') {
        return res.status(400).json({
          success: false,
          error: 'Questionnaire is not accepting responses',
          code: 'QUESTIONNAIRE_NOT_PUBLISHED',
        });
      }

      // Check for duplicate responses (enforce one response per user per question)
      const hasDuplicate = await duplicateTracker.hasUserSubmittedResponse(
        data.questionId,
        userId,
        req.ip,
      );

      if (hasDuplicate && !data.isAutosave) {
        return res.status(409).json({
          success: false,
          error: 'Response already exists for this question',
          code: 'DUPLICATE_RESPONSE',
        });
      }

      // GDPR compliance check
      const gdprValidation = validateGDPRCompliance(
        data.answer,
        question.group.questionnaire.settings?.requireConsent ?? false,
        question.group.questionnaire.settings?.anonymous ? 'full' : 'partial',
      );

      if (!gdprValidation.compliant && !data.isAutosave) {
        return res.status(400).json({
          success: false,
          error: 'GDPR compliance issue detected',
          warnings: gdprValidation.warnings,
          code: 'GDPR_NON_COMPLIANT',
        });
      }

      // Check consent if required
      if (question.group.questionnaire.settings?.requireConsent) {
        const hasConsent = await responseService.hasUserConsent(
          question.group.questionnaire.id,
          userId,
        );

        if (!hasConsent && !data.isAutosave) {
          return res.status(400).json({
            success: false,
            error: 'Consent required before submitting responses',
            code: 'CONSENT_REQUIRED',
          });
        }
      }

      // Create or update response using the service
      const response = await responseService.saveResponse(
        {
          questionId: data.questionId,
          userId: parseInt(userId),
          enrollmentId: data.enrollmentId,
          answer: gdprValidation.sanitizedAnswer,
          status: data.isAutosave ? 'draft' : 'submitted',
        },
        {
          ipHash: hashIP(req.ip),
          userAgentHash: hashUserAgent(req.get('User-Agent') || ''),
          timeSpentMs: data.timeSpentMs,
        },
      );

      // Track user behavior for adaptive rate limiting
      await adaptiveRateLimit.trackUserResponse(
        userId,
        question.group.questionnaire.id,
      );

      // Mark response as submitted (for duplicate checking)
      if (!data.isAutosave) {
        await duplicateTracker.markResponseSubmitted(
          data.questionId,
          userId,
          req.ip,
        );
      }

      // Create audit log
      await authService.createAuditLog(
        userId,
        data.isAutosave ? 'RESPONSE_AUTOSAVE' : 'RESPONSE_CREATE',
        'responses',
        response.id,
        null,
        {
          questionId: data.questionId,
          questionnaireId: question.group.questionnaire.id,
          hasPII: gdprValidation.warnings.length > 0,
        },
        req.ip,
        req.get('User-Agent'),
      );

      res.status(data.isAutosave ? 200 : 201).json({
        success: true,
        data: {
          id: response.id,
          questionId: response.questionId,
          status: response.status,
          submittedAt: response.submittedAt,
          updatedAt: response.updatedAt,
        },
        warnings: gdprValidation.warnings,
        message: data.isAutosave
          ? 'Response autosaved'
          : 'Response submitted successfully',
      });
    } catch (error) {
      console.error('Error submitting response:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

/**
 * PATCH /api/v1/responses/:id
 * Update an existing response (only if in draft status)
 */
router.patch(
  '/:id',
  responseUpdateLimit,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const { id } = req.params;

      // Validate request body
      const parseResult = updateResponseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formatValidationErrors(parseResult.error),
          code: 'VALIDATION_ERROR',
        });
      }

      const updateData = parseResult.data;

      // Get existing response with question details
      const existingResponse = await db.query.responses.findFirst({
        where: eq(responses.id, id),
        with: {
          question: {
            with: {
              group: {
                with: {
                  questionnaire: {
                    columns: { id: true, status: true, settings: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!existingResponse) {
        return res.status(404).json({
          success: false,
          error: 'Response not found',
          code: 'RESPONSE_NOT_FOUND',
        });
      }

      // Check user permissions (can only update own responses or admins can update any)
      if (
        existingResponse.userId !== parseInt(userId) &&
        req.user?.role !== 'admin'
      ) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Cannot update submitted responses (only drafts)
      if (
        existingResponse.status === 'submitted' &&
        req.user?.role !== 'admin'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Cannot update submitted response',
          code: 'RESPONSE_ALREADY_SUBMITTED',
        });
      }

      // GDPR compliance check for new answer
      if (updateData.answer !== undefined) {
        const gdprValidation = validateGDPRCompliance(
          updateData.answer,
          existingResponse.question.group.questionnaire.settings
            ?.requireConsent ?? false,
          existingResponse.question.group.questionnaire.settings?.anonymous
            ? 'full'
            : 'partial',
        );

        if (!gdprValidation.compliant) {
          return res.status(400).json({
            success: false,
            error: 'GDPR compliance issue detected',
            warnings: gdprValidation.warnings,
            code: 'GDPR_NON_COMPLIANT',
          });
        }

        updateData.answer = gdprValidation.sanitizedAnswer;
      }

      // Update response
      const [updatedResponse] = await db
        .update(responses)
        .set({
          ...updateData,
          updatedAt: new Date(),
          metadata: {
            ...(existingResponse.metadata as any),
            ipHash: hashIP(req.ip),
            userAgentHash: hashUserAgent(req.get('User-Agent') || ''),
            timeSpentMs:
              updateData.timeSpentMs ||
              (existingResponse.metadata as any)?.timeSpentMs,
            editCount: ((existingResponse.metadata as any)?.editCount || 0) + 1,
          },
        })
        .where(eq(responses.id, id))
        .returning();

      // Create audit log
      await authService.createAuditLog(
        userId,
        'RESPONSE_UPDATE',
        'responses',
        id,
        { status: existingResponse.status },
        {
          status: updateData.status,
          hasAnswer: updateData.answer !== undefined,
        },
        req.ip,
        req.get('User-Agent'),
      );

      res.json({
        success: true,
        data: {
          id: updatedResponse.id,
          questionId: updatedResponse.questionId,
          status: updatedResponse.status,
          updatedAt: updatedResponse.updatedAt,
        },
        message: 'Response updated successfully',
      });
    } catch (error) {
      console.error('Error updating response:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

/**
 * GET /api/v1/responses/questionnaire/:id
 * Get all responses for a questionnaire (for sociologists/admins)
 */
router.get(
  '/questionnaire/:id',
  responseRetrievalLimit,
  authorizeRoles(['sociologist-editor', 'admin', 'moderator']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        page = '1',
        limit = '50',
        includeAnonymized = 'true',
        includeMetadata = 'true',
        consentFilter = 'consenting_only',
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Check if questionnaire exists and user has permission
      const questionnaire = await db.query.questionnaires.findFirst({
        where: eq(questionnaires.id, id),
        with: {
          creator: {
            columns: { id: true, role: true },
          },
        },
      });

      if (!questionnaire) {
        return res.status(404).json({
          success: false,
          error: 'Questionnaire not found',
          code: 'QUESTIONNAIRE_NOT_FOUND',
        });
      }

      // Check permissions (creator, admin, or sociologist-editor can access)
      const canAccess =
        req.user?.role === 'admin' ||
        req.user?.role === 'sociologist-editor' ||
        questionnaire.createdBy === parseInt(req.user?.id || '0');

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to access this questionnaire',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Get responses with question details
      const responsesQuery = db
        .select({
          response: responses,
          question: questions,
          user:
            includeAnonymized === 'true'
              ? {
                id: sql<string>`CASE WHEN ${req.user?.role} = 'admin' THEN ${users.id} ELSE SHA2(CAST(${users.id} AS CHAR), 256) END`.as(
                  'id',
                ),
                email:
                    sql<string>`CASE WHEN ${req.user?.role} = 'admin' THEN ${users.email} ELSE '[ANONYMIZED]' END`.as(
                      'email',
                    ),
                name: sql<string>`CASE WHEN ${req.user?.role} = 'admin' THEN ${users.name} ELSE '[ANONYMIZED]' END`.as(
                  'name',
                ),
              }
              : null,
        })
        .from(responses)
        .innerJoin(questions, eq(responses.questionId, questions.id))
        .innerJoin(questionGroups, eq(questions.groupId, questionGroups.id))
        .leftJoin(users, eq(responses.userId, users.id))
        .where(eq(questionGroups.questionnaireId, id));

      // Apply consent filter if not admin
      if (consentFilter === 'consenting_only' && req.user?.role !== 'admin') {
        responsesQuery.where(
          sql`EXISTS (
            SELECT 1 FROM consents c
            WHERE c.questionnaireId = ${id}
            AND c.userId = ${responses.userId}
            AND c.granted = true
            AND c.revokedAt IS NULL
          )`,
        );
      }

      const responsesData = await responsesQuery
        .orderBy(desc(responses.submittedAt))
        .limit(limitNum)
        .offset(offset);

      // Get total count for pagination
      const totalCountResult = await db
        .select({ count: count() })
        .from(responses)
        .innerJoin(questions, eq(responses.questionId, questions.id))
        .innerJoin(questionGroups, eq(questions.groupId, questionGroups.id))
        .where(eq(questionGroups.questionnaireId, id));

      const totalCount = totalCountResult[0].count;

      // Get response statistics
      const stats = await responseService.getResponseStatistics(id);

      res.json({
        success: true,
        data: {
          responses: responsesData.map(r => ({
            ...r.response,
            question: r.question,
            ...(includeAnonymized === 'true' && { user: r.user }),
          })),
          questionnaire: {
            id: questionnaire.id,
            title: questionnaire.title,
            status: questionnaire.status,
            settings: questionnaire.settings,
          },
          statistics: stats,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            hasNext: pageNum * limitNum < totalCount,
            hasPrev: pageNum > 1,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching questionnaire responses:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

/**
 * GET /api/v1/responses/user/:id
 * Get user's responses (for participants)
 */
router.get(
  '/user/:id',
  responseRetrievalLimit,
  async (req: Request, res: Response) => {
    try {
      const currentUserId = req.user?.id;
      const { id } = req.params;

      // Users can only access their own responses unless they're admin/moderator
      const canAccess =
        currentUserId === id ||
        req.user?.role === 'admin' ||
        req.user?.role === 'moderator' ||
        req.user?.role === 'sociologist-editor';

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Get user's responses with question details
      const userResponses = await db.query.responses.findMany({
        where: eq(responses.userId, parseInt(id)),
        with: {
          question: {
            with: {
              group: {
                with: {
                  questionnaire: {
                    columns: { id: true, title: true, status: true },
                  },
                },
              },
            },
          },
        },
        orderBy: desc(responses.updatedAt),
      });

      // Group responses by questionnaire
      const responsesByQuestionnaire = userResponses.reduce((acc, response) => {
        const questionnaireId = response.question.group.questionnaire.id;
        if (!acc[questionnaireId]) {
          acc[questionnaireId] = {
            questionnaire: response.question.group.questionnaire,
            responses: [],
            statistics: {
              totalResponses: 0,
              submittedResponses: 0,
              draftResponses: 0,
            },
          };
        }

        acc[questionnaireId].responses.push(response);
        acc[questionnaireId].statistics.totalResponses++;

        if (response.status === 'submitted') {
          acc[questionnaireId].statistics.submittedResponses++;
        } else {
          acc[questionnaireId].statistics.draftResponses++;
        }

        return acc;
      }, {} as any);

      // Calculate completion percentages
      for (const questionnaireId in responsesByQuestionnaire) {
        const questionnaire = responsesByQuestionnaire[questionnaireId];

        // Get total questions for this questionnaire
        const totalQuestionsResult = await db
          .select({ count: count() })
          .from(questions)
          .innerJoin(questionGroups, eq(questions.groupId, questionGroups.id))
          .where(eq(questionGroups.questionnaireId, questionnaireId));

        const totalQuestions = totalQuestionsResult[0].count;
        const completionPercentage =
          totalQuestions > 0
            ? Math.round(
              (questionnaire.statistics.submittedResponses / totalQuestions) *
                  100,
            )
            : 0;

        questionnaire.statistics.completionPercentage = completionPercentage;
      }

      res.json({
        success: true,
        data: {
          userId: id,
          questionnaires: Object.values(responsesByQuestionnaire),
          summary: {
            totalResponses: userResponses.length,
            submittedResponses: userResponses.filter(
              r => r.status === 'submitted',
            ).length,
            draftResponses: userResponses.filter(r => r.status === 'draft')
              .length,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching user responses:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

/**
 * GET /api/v1/responses/export/:questionnaireId
 * Export responses to ODS/CSV/JSON format
 */
router.get(
  '/export/:questionnaireId',
  responseExportLimit,
  authorizeRoles(['sociologist-editor', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const { questionnaireId } = req.params;

      // Validate export options
      const exportOptions = exportOptionsSchema.parse(req.query);

      // Check if questionnaire exists and user has permission
      const questionnaire = await db.query.questionnaires.findFirst({
        where: eq(questionnaires.id, questionnaireId),
      });

      if (!questionnaire) {
        return res.status(404).json({
          success: false,
          error: 'Questionnaire not found',
          code: 'QUESTIONNAIRE_NOT_FOUND',
        });
      }

      // Get responses based on export options
      const exportedData = await responseService.getUserResponses(
        questionnaireId,
        exportOptions.includePersonalData ? undefined : 0, // Use 0 to anonymize
      );

      let exportData: string;
      let contentType: string;
      let filename: string;

      switch (exportOptions.format) {
      case 'csv':
        exportData = await responseService.exportResponsesToCSV(
          questionnaireId,
          exportOptions.includePersonalData,
        );
        contentType = 'text/csv';
        filename = `responses_${questionnaireId}_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'json':
        exportData = JSON.stringify(
          {
            questionnaire: exportedData.questionnaire,
            responses: exportedData.responses,
            statistics: exportedData.completionStatus,
            exportedAt: new Date().toISOString(),
            exportOptions,
          },
          null,
          2,
        );
        contentType = 'application/json';
        filename = `responses_${questionnaireId}_${new Date().toISOString().split('T')[0]}.json`;
        break;

      case 'ods':
      default:
        // For ODS, we'll create a simple ODS-like format (in production, use a proper ODS library)
        exportData = await createODSFormat(exportedData, exportOptions);
        contentType = 'application/vnd.oasis.opendocument.spreadsheet';
        filename = `responses_${questionnaireId}_${new Date().toISOString().split('T')[0]}.ods`;
        break;
      }

      // Create audit log
      await authService.createAuditLog(
        req.user?.id,
        'RESPONSES_EXPORT',
        'questionnaires',
        questionnaireId,
        null,
        {
          format: exportOptions.format,
          includePersonalData: exportOptions.includePersonalData,
          anonymizeLevel: exportOptions.anonymizeLevel,
          responseCount: exportedData.responses.length,
        },
        req.ip,
        req.get('User-Agent'),
      );

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.send(exportData);
    } catch (error) {
      console.error('Error exporting responses:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

/**
 * POST /api/v1/responses/bulk
 * Submit multiple responses at once (questionnaire completion)
 */
router.post(
  '/bulk',
  bulkSubmissionRateLimit,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Validate bulk submission data
      const parseResult = bulkResponseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formatValidationErrors(parseResult.error),
          code: 'VALIDATION_ERROR',
        });
      }

      const {
        questionnaireId,
        responses: responseData,
        status,
        consent,
      } = parseResult.data;

      // Check if questionnaire exists and is published
      const questionnaire = await db.query.questionnaires.findFirst({
        where: eq(questionnaires.id, questionnaireId),
      });

      if (!questionnaire) {
        return res.status(404).json({
          success: false,
          error: 'Questionnaire not found',
          code: 'QUESTIONNAIRE_NOT_FOUND',
        });
      }

      if (questionnaire.status !== 'published') {
        return res.status(400).json({
          success: false,
          error: 'Questionnaire is not accepting responses',
          code: 'QUESTIONNAIRE_NOT_PUBLISHED',
        });
      }

      // Record consent if provided
      if (consent) {
        await responseService.createConsent(
          {
            questionnaireId,
            userId: parseInt(userId),
            aiProcessing: consent.aiProcessing,
            dataProcessing: consent.dataProcessing,
            anonymousSharing: consent.anonymousSharing,
            consentText: consent.consentText,
          },
          {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          },
        );
      } else if (questionnaire.settings?.requireConsent) {
        // Check if consent exists
        const hasConsent = await responseService.hasUserConsent(
          questionnaireId,
          userId,
        );
        if (!hasConsent) {
          return res.status(400).json({
            success: false,
            error: 'Consent required for questionnaire submission',
            code: 'CONSENT_REQUIRED',
          });
        }
      }

      // Process each response
      const processedResponses = [];
      const errors = [];

      for (const responseItem of responseData) {
        try {
          // Get question details
          const question = await db.query.questions.findFirst({
            where: eq(questions.id, responseItem.questionId),
            with: {
              group: {
                with: {
                  questionnaire: {
                    columns: { settings: true },
                  },
                },
              },
            },
          });

          if (!question) {
            errors.push({
              questionId: responseItem.questionId,
              error: 'Question not found',
            });
            continue;
          }

          // GDPR compliance check
          const gdprValidation = validateGDPRCompliance(
            responseItem.answer,
            questionnaire.settings?.requireConsent ?? false,
            questionnaire.settings?.anonymous ? 'full' : 'partial',
          );

          if (!gdprValidation.compliant) {
            errors.push({
              questionId: responseItem.questionId,
              error: 'GDPR compliance issue',
              warnings: gdprValidation.warnings,
            });
            continue;
          }

          // Save response
          const response = await responseService.saveResponse(
            {
              questionId: responseItem.questionId,
              userId: parseInt(userId),
              answer: gdprValidation.sanitizedAnswer,
              status,
            },
            {
              ipHash: hashIP(req.ip),
              userAgentHash: hashUserAgent(req.get('User-Agent') || ''),
            },
          );

          processedResponses.push({
            id: response.id,
            questionId: responseItem.questionId,
            status: response.status,
            warnings: gdprValidation.warnings,
          });
        } catch (error) {
          errors.push({
            questionId: responseItem.questionId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Submit all responses for the questionnaire if final submission
      let submissionResult = { submitted: 0, total: 0 };
      if (status === 'submitted') {
        submissionResult = await responseService.submitQuestionnaireResponses(
          questionnaireId,
          parseInt(userId),
        );
      }

      // Create audit log
      await authService.createAuditLog(
        userId,
        'BULK_RESPONSE_SUBMIT',
        'responses',
        questionnaireId,
        null,
        {
          responseCount: processedResponses.length,
          errorCount: errors.length,
          status,
        },
        req.ip,
        req.get('User-Agent'),
      );

      res.status(status === 'submitted' ? 201 : 200).json({
        success: true,
        data: {
          questionnaireId,
          processedResponses,
          submissionResult,
          errors,
          summary: {
            total: responseData.length,
            successful: processedResponses.length,
            failed: errors.length,
          },
        },
        message:
          status === 'submitted'
            ? 'Questionnaire responses submitted successfully'
            : 'Questionnaire responses saved as draft',
      });
    } catch (error) {
      console.error('Error in bulk response submission:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

/**
 * POST /api/v1/responses/consent
 * Record user consent for data processing
 */
router.post(
  '/consent',
  autosaveRateLimit,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Validate consent data
      const parseResult = consentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formatValidationErrors(parseResult.error),
          code: 'VALIDATION_ERROR',
        });
      }

      const consentData = parseResult.data;

      // Record consent
      const consent = await responseService.createConsent(
        {
          questionnaireId: consentData.questionnaireId,
          userId: parseInt(userId),
          aiProcessing: consentData.aiProcessing,
          dataProcessing: consentData.dataProcessing,
          anonymousSharing: consentData.anonymousSharing,
          consentText: consentData.consentText,
        },
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      );

      // Create audit log
      await authService.createAuditLog(
        userId,
        'CONSENT_GIVEN',
        'consents',
        consent.id,
        null,
        {
          questionnaireId: consentData.questionnaireId,
          aiProcessing: consentData.aiProcessing,
          dataProcessing: consentData.dataProcessing,
          anonymousSharing: consentData.anonymousSharing,
        },
        req.ip,
        req.get('User-Agent'),
      );

      res.status(201).json({
        success: true,
        data: {
          id: consent.id,
          questionnaireId: consent.questionnaireId,
          givenAt: consent.givenAt,
        },
        message: 'Consent recorded successfully',
      });
    } catch (error) {
      console.error('Error recording consent:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

/**
 * GET /api/v1/responses/:id
 * Get a specific response by ID
 */
router.get(
  '/:id',
  responseRetrievalLimit,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      // Get response with question details
      const response = await db.query.responses.findFirst({
        where: eq(responses.id, id),
        with: {
          question: {
            with: {
              group: {
                with: {
                  questionnaire: {
                    columns: { id: true, title: true, settings: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!response) {
        return res.status(404).json({
          success: false,
          error: 'Response not found',
          code: 'RESPONSE_NOT_FOUND',
        });
      }

      // Check permissions (user can access own responses, admins/moderators can access all)
      const canAccess =
        response.userId === parseInt(userId || '0') ||
        req.user?.role === 'admin' ||
        req.user?.role === 'moderator' ||
        req.user?.role === 'sociologist-editor';

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Anonymize user data if not admin
      const responseData = {
        ...response,
        userId: req.user?.role === 'admin' ? response.userId : '[ANONYMIZED]',
      };

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      console.error('Error fetching response:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

// Utility functions

function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

function hashUserAgent(userAgent: string): string {
  return createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
}

async function createODSFormat(
  exportedData: any,
  exportOptions: any,
): Promise<string> {
  // Simple ODS-like format (in production, use a proper ODS library)
  const rows = [];

  // Header row
  const headers = [
    'Response ID',
    'Question ID',
    'Question Text (PL)',
    'Question Text (EN)',
    'Question Type',
    'Answer',
    'Status',
    'Created At',
    'Updated At',
  ];

  if (exportOptions.includePersonalData) {
    headers.push('User ID', 'Email');
  }

  rows.push(headers.join('\t'));

  // Data rows
  for (const response of exportedData.responses) {
    const answer =
      typeof response.answer === 'string'
        ? `"${response.answer.replace(/"/g, '""')}"`
        : JSON.stringify(response.answer);

    const row = [
      response.id,
      response.questionId,
      `"${response.question?.text?.pl || ''}"`,
      `"${response.question?.text?.en || ''}"`,
      response.question?.type || '',
      answer,
      response.status,
      response.createdAt?.toISOString() || '',
      response.updatedAt?.toISOString() || '',
    ];

    if (exportOptions.includePersonalData) {
      row.push(response.userId?.toString() || 'anonymous', '');
    }

    rows.push(row.join('\t'));
  }

  return rows.join('\n');
}

export default router;
