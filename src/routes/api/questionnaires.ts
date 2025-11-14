import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../config/database';
import { eq, and, desc, asc } from 'drizzle-orm';
import {
  questionnaires,
  questionGroups,
  questions,
  responses,
  llmAnalyses,
  analysisJobs,
  consents,
  users,
} from '../../models/llm-schema';
import { llmAnalysisWorker } from '../../services/llm-worker';
import { anonymizationService } from '../../services/anonymization';
import { embeddingsService } from '../../services/embeddings';
import { promptTemplateService } from '../../services/prompt-templates';

const router = Router();

// Validation schemas
const createQuestionnaireSchema = z.object({
  workshopId: z.string().uuid().optional(),
  title: z.object({
    pl: z.string().min(5).max(200),
    en: z.string().min(5).max(200),
  }),
  description: z
    .object({
      pl: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
  instructions: z
    .object({
      pl: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
  settings: z
    .object({
      anonymous: z.boolean().default(false),
      requireConsent: z.boolean().default(true),
      maxResponses: z.number().positive().optional(),
      closeAfterWorkshop: z.boolean().default(true),
      showAllQuestions: z.boolean().default(true),
      allowEdit: z.boolean().default(true),
      questionStyle: z
        .enum(['first_person_plural', 'third_person'])
        .default('first_person_plural'),
    })
    .default({}),
  templateId: z.string().optional(),
});

const updateQuestionnaireSchema = createQuestionnaireSchema.partial();

const createQuestionGroupSchema = z.object({
  title: z.object({
    pl: z.string().min(1).max(200),
    en: z.string().min(1).max(200),
  }),
  description: z
    .object({
      pl: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
  orderIndex: z.number().int().min(0),
  uiConfig: z
    .object({
      collapsed: z.boolean().default(false),
      showProgress: z.boolean().default(true),
      icon: z.string().nullable(),
    })
    .default({}),
});

const createQuestionSchema = z.object({
  text: z.object({
    pl: z.string().min(1).max(1000),
    en: z.string().min(1).max(1000),
  }),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'scale',
    'single_choice',
    'multiple_choice',
  ]),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.object({
          pl: z.string(),
          en: z.string(),
        }),
      }),
    )
    .optional(),
  validation: z
    .object({
      required: z.boolean().default(false),
      minLength: z.number().int().min(0).optional(),
      maxLength: z.number().int().positive().optional(),
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
      pattern: z.string().optional(),
    })
    .default({}),
  conditionalLogic: z
    .object({
      showIf: z.object({
        questionId: z.string(),
        operator: z.enum(['equals', 'contains', 'greater_than', 'less_than']),
        value: z.any(),
      }),
    })
    .optional(),
  orderIndex: z.number().int().min(0),
  helpText: z
    .object({
      pl: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
});

const submitResponseSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.any(), // Can be string, number, array, etc. depending on question type
  enrollmentId: z.string().uuid().optional(),
});

const triggerAnalysisSchema = z.object({
  questionnaireId: z.string().uuid(),
  analysisTypes: z
    .array(
      z.enum([
        'thematic',
        'clusters',
        'contradictions',
        'insights',
        'recommendations',
      ]),
    )
    .min(1),
  options: z
    .object({
      minClusterSize: z.number().int().min(2).default(3),
      minThemeFrequency: z.number().int().min(1).default(2),
      includeSentiment: z.boolean().default(true),
      anonymizationLevel: z.enum(['partial', 'full']).default('full'),
      customPrompt: z.string().optional(),
    })
    .default({}),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

/**
 * GET /api/v1/questionnaires
 * List questionnaires with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      workshopId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build query conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(questionnaires.status, status as string));
    }
    if (workshopId) {
      conditions.push(eq(questionnaires.workshopId, workshopId as string));
    }

    // Execute query
    const [questionnairesData, totalCount] = await Promise.all([
      db.query.questionnaires.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          creator: {
            columns: { id: true, name: true, email: true },
          },
          groups: {
            with: {
              questions: {
                columns: { id: true },
              },
            },
          },
          _count: {
            responses: true,
          },
        },
        orderBy:
          sortOrder === 'desc'
            ? desc(questionnaires[sortBy as keyof typeof questionnaires])
            : asc(questionnaires[sortBy as keyof typeof questionnaires]),
        limit: limitNum,
        offset,
      }),
      db.query.questionnaires.count(),
    ]);

    res.json({
      data: questionnairesData,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNext: pageNum * limitNum < totalCount,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching questionnaires:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/questionnaires/:id
 * Get questionnaire by ID with full structure
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const questionnaire = await db.query.questionnaires.findFirst({
      where: eq(questionnaires.id, id),
      with: {
        creator: {
          columns: { id: true, name: true, email: true, role: true },
        },
        groups: {
          with: {
            questions: {
              orderBy: asc(questions.orderIndex),
            },
          },
          orderBy: asc(questionGroups.orderIndex),
        },
        _count: {
          responses: true,
          analyses: true,
        },
      },
    });

    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    res.json(questionnaire);
  } catch (error) {
    console.error('Error fetching questionnaire:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/questionnaires
 * Create new questionnaire
 */
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).user?.id; // Assuming auth middleware sets user
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = createQuestionnaireSchema.parse(req.body);

    // Check user permissions (sociologist-editor or admin)
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    if (!user || !['sociologist-editor', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Create questionnaire
    const [questionnaire] = await db
      .insert(questionnaires)
      .values({
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workshopId: validatedData.workshopId,
        title: validatedData.title,
        description: validatedData.description,
        instructions: validatedData.instructions,
        settings: validatedData.settings,
        createdBy: userId,
        status: 'draft',
      })
      .returning();

    // If template specified, create template structure
    if (validatedData.templateId) {
      await applyTemplate(questionnaire.id, validatedData.templateId);
    }

    res.status(201).json(questionnaire);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating questionnaire:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/questionnaires/:id/analysis
 * Trigger LLM analysis for questionnaire
 */
router.post('/:id/analysis', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = triggerAnalysisSchema.parse(req.body);

    // Check if questionnaire exists and user has permission
    const questionnaire = await db.query.questionnaires.findFirst({
      where: eq(questionnaires.id, validatedData.questionnaireId || id),
      with: {
        creator: {
          columns: { id: true, role: true },
        },
      },
    });

    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    const hasPermission =
      questionnaire.createdBy === userId ||
      ['sociologist-editor', 'admin'].includes(user?.role || '');

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check if there are responses to analyze
    const responseCount = await db.query.responses.findMany({
      where: eq(responses.questionId, id),
    });

    if (responseCount.length < 5) {
      return res
        .status(400)
        .json({
          error: 'Insufficient responses for analysis (minimum 5 required)',
        });
    }

    // Check if analysis is already running
    const existingJob = await db.query.analysisJobs.findFirst({
      where: eq(analysisJobs.questionnaireId, id),
      orderBy: desc(analysisJobs.createdAt),
    });

    if (existingJob && existingJob.status === 'processing') {
      return res
        .status(409)
        .json({ error: 'Analysis already in progress', jobId: existingJob.id });
    }

    // Queue analysis job
    const jobId = await llmAnalysisWorker.addJob({
      questionnaireId: validatedData.questionnaireId || id,
      analysisTypes: validatedData.analysisTypes,
      options: validatedData.options,
      triggeredBy: userId,
      priority: validatedData.priority,
    });

    res.status(202).json({
      message: 'Analysis job queued successfully',
      jobId,
      questionnaireId: validatedData.questionnaireId || id,
      analysisTypes: validatedData.analysisTypes,
      estimatedDuration: estimateAnalysisDuration(
        responseCount.length,
        validatedData.analysisTypes,
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error triggering analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/questionnaires/:id/analysis
 * Get analysis results for questionnaire
 */
router.get('/:id/analysis', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check permissions
    const questionnaire = await db.query.questionnaires.findFirst({
      where: eq(questionnaires.id, id),
      with: {
        creator: {
          columns: { id: true, role: true },
        },
      },
    });

    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    const hasPermission =
      questionnaire.createdBy === userId ||
      ['sociologist-editor', 'admin'].includes(user?.role || '');

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get analyses
    const analyses = await db.query.llmAnalyses.findMany({
      where: eq(llmAnalyses.questionnaireId, id),
      orderBy: desc(llmAnalyses.createdAt),
    });

    // Get job status
    const job = await db.query.analysisJobs.findFirst({
      where: eq(analysisJobs.questionnaireId, id),
      orderBy: desc(analysisJobs.createdAt),
    });

    res.json({
      questionnaireId: id,
      analyses: analyses,
      currentJob: job
        ? {
          id: job.id,
          status: job.status,
          progress: job.progress,
          totalSteps: job.totalSteps,
          completedSteps: job.completedSteps,
          startedAt: job.startedAt,
          estimatedDuration: job.estimatedDuration,
          errorLog: job.errorLog,
        }
        : null,
    });
  } catch (error) {
    console.error('Error fetching analysis results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/responses
 * Submit response to question
 */
router.post('/responses', async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = submitResponseSchema.parse(req.body);

    // Check if question exists and is part of published questionnaire
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, validatedData.questionId),
      with: {
        group: {
          with: {
            questionnaire: {
              columns: { id: true, status: true },
            },
          },
        },
      },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.group.questionnaire.status !== 'published') {
      return res.status(400).json({ error: 'Questionnaire is not published' });
    }

    // Check if user already responded to this question
    const existingResponse = await db.query.responses.findFirst({
      where: eq(responses.questionId, validatedData.questionId),
    });

    if (existingResponse && existingResponse.userId === userId) {
      return res.status(409).json({ error: 'Response already exists' });
    }

    // Validate answer format
    const validationResult = validateAnswer(validatedData.answer, question);
    if (!validationResult.valid) {
      return res
        .status(400)
        .json({
          error: 'Invalid answer format',
          details: validationResult.errors,
        });
    }

    // Create response
    const [response] = await db
      .insert(responses)
      .values({
        id: `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        questionId: validatedData.questionId,
        userId,
        enrollmentId: validatedData.enrollmentId,
        answer: validatedData.answer,
        metadata: {
          ipHash: hashIP(req.ip),
          userAgentHash: hashUserAgent(req.get('User-Agent') || ''),
          timeSpentMs: req.body.timeSpentMs || 0,
          editCount: 0,
        },
      })
      .returning();

    res.status(201).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error submitting response:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/responses/consent
 * Record user consent for data processing
 */
router.post('/responses/consent', async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { questionnaireId, consentType, granted, consentText } = req.body;

    if (!questionnaireId || !consentType || typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create consent record
    const [consent] = await db
      .insert(consents)
      .values({
        id: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        questionnaireId,
        consentType,
        granted,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        consentText: consentText || {},
        givenAt: new Date(),
      })
      .returning();

    res.status(201).json(consent);
  } catch (error) {
    console.error('Error recording consent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions

async function applyTemplate(
  questionnaireId: string,
  templateId: string,
): Promise<void> {
  // Template implementation would go here
  // This would create the standard questionnaire structure based on template
  console.log(
    `Applying template ${templateId} to questionnaire ${questionnaireId}`,
  );
}

function estimateAnalysisDuration(
  responseCount: number,
  analysisTypes: string[],
): number {
  // Simple estimation: ~30 seconds per analysis type per 50 responses
  const baseTime = analysisTypes.length * 30; // seconds
  const responseFactor = Math.max(1, responseCount / 50);
  return Math.ceil(baseTime * responseFactor);
}

function validateAnswer(
  answer: any,
  question: any,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required field validation
  if (
    question.validation?.required &&
    (answer === null || answer === undefined || answer === '')
  ) {
    errors.push('This field is required');
  }

  // Type-specific validation
  switch (question.type) {
  case 'text':
  case 'textarea':
    if (typeof answer !== 'string') {
      errors.push('Answer must be a string');
    } else {
      if (
        question.validation?.minLength &&
          answer.length < question.validation.minLength
      ) {
        errors.push(
          `Answer must be at least ${question.validation.minLength} characters`,
        );
      }
      if (
        question.validation?.maxLength &&
          answer.length > question.validation.maxLength
      ) {
        errors.push(
          `Answer must be at most ${question.validation.maxLength} characters`,
        );
      }
    }
    break;

  case 'number':
  case 'scale':
    if (typeof answer !== 'number') {
      errors.push('Answer must be a number');
    } else {
      if (
        question.validation?.minValue !== undefined &&
          answer < question.validation.minValue
      ) {
        errors.push(
          `Answer must be at least ${question.validation.minValue}`,
        );
      }
      if (
        question.validation?.maxValue !== undefined &&
          answer > question.validation.maxValue
      ) {
        errors.push(`Answer must be at most ${question.validation.maxValue}`);
      }
    }
    break;

  case 'single_choice':
    if (
      !Array.isArray(question.options) ||
        !question.options.some((opt: any) => opt.value === answer)
    ) {
      errors.push('Invalid choice selected');
    }
    break;

  case 'multiple_choice':
    if (!Array.isArray(answer)) {
      errors.push('Answer must be an array of choices');
    } else {
      const invalidChoices = answer.filter(
        (choice: any) =>
          !Array.isArray(question.options) ||
            !question.options.some((opt: any) => opt.value === choice),
      );
      if (invalidChoices.length > 0) {
        errors.push('Invalid choices selected');
      }
    }
    break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function hashIP(ip: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

function hashUserAgent(userAgent: string): string {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(userAgent)
    .digest('hex')
    .substring(0, 16);
}

export default router;
