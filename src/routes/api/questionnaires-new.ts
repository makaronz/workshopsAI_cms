import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  authenticateJWT,
  authorizeRoles,
  canAccessQuestionnaire,
} from '../../middleware/auth';
import { QuestionnaireCrudService } from '../../services/questionnaireCrudService';

const router = Router();

// Validation schemas
const createQuestionnaireSchema = z.object({
  titleI18n: z.record(z.string(), z.string().min(1)).refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one title translation is required',
  }),
  instructionsI18n: z.record(z.string(), z.string()).optional(),
  settings: z
    .object({
      anonymous: z.boolean().optional(),
      require_consent: z.boolean().optional(),
      max_responses: z.number().int().positive().nullable().optional(),
      close_after_workshop: z.boolean().optional(),
      show_all_questions: z.boolean().optional(),
      allow_edit: z.boolean().optional(),
      question_style: z
        .enum(['first_person_plural', 'third_person'])
        .optional(),
    })
    .optional(),
});

const updateQuestionnaireSchema = createQuestionnaireSchema.partial().extend({
  status: z
    .enum(['draft', 'review', 'published', 'closed', 'analyzed'])
    .optional(),
  publishedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
});

// Question group validation schemas
const createQuestionGroupSchema = z.object({
  titleI18n: z.record(z.string(), z.string().min(1)).refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one translation is required',
  }),
  descriptionI18n: z.record(z.string(), z.string()).optional(),
  orderIndex: z.number().int().min(1).optional(),
  uiConfig: z
    .object({
      collapsed: z.boolean().optional(),
      show_progress: z.boolean().optional(),
      icon: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
    })
    .optional(),
});

const updateQuestionGroupSchema = createQuestionGroupSchema.partial();

// Question validation schemas
const createQuestionSchema = z.object({
  textI18n: z.record(z.string(), z.string().min(1)).refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one translation is required',
  }),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'scale',
    'single_choice',
    'multiple_choice',
  ]),
  optionsI18n: z
    .array(
      z.object({
        value: z.string().min(1),
        label: z.object({
          pl: z.string().min(1),
          en: z.string().min(1),
        }),
      }),
    )
    .optional(),
  validation: z
    .object({
      required: z.boolean().optional(),
      min_length: z.number().int().min(1).optional(),
      max_length: z.number().int().min(1).optional(),
      min_value: z.number().optional(),
      max_value: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
  conditionalLogic: z
    .object({
      show_if: z.object({
        question_id: z.string().uuid(),
        operator: z.enum(['equals', 'contains', 'greater_than', 'less_than']),
        value: z.any(),
      }),
    })
    .optional(),
  orderIndex: z.number().int().min(1).optional(),
  helpTextI18n: z.record(z.string(), z.string()).optional(),
});

const updateQuestionSchema = createQuestionSchema.partial();

// Reorder schemas
const reorderQuestionGroupsSchema = z.object({
  groupOrders: z
    .array(
      z.object({
        id: z.string().uuid(),
        orderIndex: z.number().int().min(1),
      }),
    )
    .min(1),
});

const reorderQuestionsSchema = z.object({
  questionOrders: z
    .array(
      z.object({
        id: z.string().uuid(),
        orderIndex: z.number().int().min(1),
      }),
    )
    .min(1),
});

// Middleware to validate request body
const validateRequestBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request body',
          details: error.errors,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid request body',
      });
    }
  };
};

/**
 * POST /api/v1/questionnaires
 * Create questionnaire (standalone)
 */
router.post(
  '/',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(createQuestionnaireSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // For standalone questionnaire, workshopId is optional
      const questionnaireData = {
        ...req.body,
        workshopId: undefined, // Standalone questionnaire
      };

      // This would need to be implemented in the service
      // For now, we'll return an error as this is not part of the current requirements
      res.status(501).json({
        success: false,
        error: 'Not Implemented',
        message:
          'Standalone questionnaire creation is not yet supported. Create questionnaires through workshops.',
      });
    } catch (error) {
      console.error('Error creating questionnaire:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/workshops/:workshopId/questionnaires
 * Create questionnaire for workshop
 */
router.post(
  '/workshops/:workshopId/questionnaires',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(createQuestionnaireSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workshopId } = req.params;

      const questionnaire =
        await QuestionnaireCrudService.createQuestionnaireForWorkshop(
          workshopId,
          req.body,
          req,
        );

      res.status(201).json({
        success: true,
        data: questionnaire,
        message: 'Questionnaire created successfully',
      });
    } catch (error) {
      console.error('Error creating questionnaire:', error);

      if (error instanceof Error) {
        if (error.message === 'Workshop not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * GET /api/v1/questionnaires/:id
 * Get questionnaire by ID with all questions and groups
 */
router.get(
  '/:id',
  authenticateJWT,
  canAccessQuestionnaire,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const questionnaire = await QuestionnaireCrudService.getQuestionnaireById(
        id,
        req,
      );

      if (!questionnaire) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Questionnaire not found',
        });
      }

      res.status(200).json({
        success: true,
        data: questionnaire,
      });
    } catch (error) {
      console.error('Error fetching questionnaire:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/workshops/:workshopId/questionnaires
 * Get questionnaires for workshop
 */
router.get(
  '/workshops/:workshopId/questionnaires',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin', 'moderator', 'facilitator']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workshopId } = req.params;

      const questionnaires =
        await QuestionnaireCrudService.getQuestionnairesByWorkshop(
          workshopId,
          req,
        );

      res.status(200).json({
        success: true,
        data: {
          questionnaires,
          total: questionnaires.length,
        },
      });
    } catch (error) {
      console.error('Error fetching workshop questionnaires:', error);
      next(error);
    }
  },
);

/**
 * PATCH /api/v1/questionnaires/:id
 * Update questionnaire metadata
 */
router.patch(
  '/:id',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(updateQuestionnaireSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const questionnaire = await QuestionnaireCrudService.updateQuestionnaire(
        id,
        req.body,
        req,
      );

      res.status(200).json({
        success: true,
        data: questionnaire,
        message: 'Questionnaire updated successfully',
      });
    } catch (error) {
      console.error('Error updating questionnaire:', error);

      if (error instanceof Error) {
        if (error.message === 'Questionnaire not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * DELETE /api/v1/questionnaires/:id
 * Soft delete questionnaire with dependency checking
 */
router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await QuestionnaireCrudService.deleteQuestionnaire(id, req);

      res.status(200).json({
        success: true,
        message: 'Questionnaire deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting questionnaire:', error);

      if (error instanceof Error) {
        if (error.message === 'Questionnaire not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (
          error.message ===
          'Cannot delete published questionnaire with responses. Consider archiving instead.'
        ) {
          return res.status(409).json({
            success: false,
            error: 'Conflict',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * GET /api/v1/questionnaires/:id/status
 * Get questionnaire status and basic stats
 */
router.get(
  '/:id/status',
  authenticateJWT,
  canAccessQuestionnaire,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const questionnaire = await QuestionnaireCrudService.getQuestionnaireById(
        id,
        req,
      );

      if (!questionnaire) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Questionnaire not found',
        });
      }

      // Calculate basic stats
      const questionCount = questionnaire.questionGroups.reduce(
        (total, group) => total + group.questions.length,
        0,
      );

      const statusInfo = {
        id: questionnaire.id,
        status: questionnaire.status,
        publishedAt: questionnaire.publishedAt,
        closedAt: questionnaire.closedAt,
        settings: questionnaire.settings,
        stats: {
          questionGroupCount: questionnaire.questionGroups.length,
          questionCount,
          lastUpdated: questionnaire.updatedAt,
        },
      };

      res.status(200).json({
        success: true,
        data: statusInfo,
      });
    } catch (error) {
      console.error('Error fetching questionnaire status:', error);
      next(error);
    }
  },
);

// ===== QUESTION GROUP ENDPOINTS =====

/**
 * POST /api/v1/questionnaires/:questionnaireId/groups
 * Create question group
 */
router.post(
  '/:questionnaireId/groups',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(createQuestionGroupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionnaireId } = req.params;

      const questionGroupData = {
        ...req.body,
        questionnaireId,
      };

      const questionGroup = await QuestionnaireCrudService.createQuestionGroup(
        questionGroupData,
        req,
      );

      res.status(201).json({
        success: true,
        data: questionGroup,
        message: 'Question group created successfully',
      });
    } catch (error) {
      console.error('Error creating question group:', error);

      if (error instanceof Error) {
        if (error.message === 'Questionnaire not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * PATCH /api/v1/question-groups/:id
 * Update question group
 */
router.patch(
  '/question-groups/:id',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(updateQuestionGroupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const questionGroup = await QuestionnaireCrudService.updateQuestionGroup(
        id,
        req.body,
        req,
      );

      res.status(200).json({
        success: true,
        data: questionGroup,
        message: 'Question group updated successfully',
      });
    } catch (error) {
      console.error('Error updating question group:', error);

      if (error instanceof Error) {
        if (error.message === 'Question group not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * DELETE /api/v1/question-groups/:id
 * Delete question group
 */
router.delete(
  '/question-groups/:id',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await QuestionnaireCrudService.deleteQuestionGroup(id, req);

      res.status(200).json({
        success: true,
        message: 'Question group deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting question group:', error);

      if (error instanceof Error) {
        if (error.message === 'Question group not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (
          error.message ===
          'Cannot delete question group that contains questions. Remove questions first.'
        ) {
          return res.status(409).json({
            success: false,
            error: 'Conflict',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * PATCH /api/v1/questionnaires/:questionnaireId/groups/reorder
 * Reorder question groups
 */
router.patch(
  '/:questionnaireId/groups/reorder',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(reorderQuestionGroupsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionnaireId } = req.params;

      await QuestionnaireCrudService.reorderQuestionGroups(
        questionnaireId,
        req.body.groupOrders,
        req,
      );

      res.status(200).json({
        success: true,
        message: 'Question groups reordered successfully',
      });
    } catch (error) {
      console.error('Error reordering question groups:', error);

      if (error instanceof Error) {
        if (
          error.message ===
          'Some question groups do not belong to this questionnaire'
        ) {
          return res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

// ===== QUESTION ENDPOINTS =====

/**
 * POST /api/v1/question-groups/:groupId/questions
 * Create question
 */
router.post(
  '/question-groups/:groupId/questions',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(createQuestionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;

      const questionData = {
        ...req.body,
        groupId,
      };

      const question = await QuestionnaireCrudService.createQuestion(
        questionData,
        req,
      );

      res.status(201).json({
        success: true,
        data: question,
        message: 'Question created successfully',
      });
    } catch (error) {
      console.error('Error creating question:', error);

      if (error instanceof Error) {
        if (error.message === 'Question group not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message === 'Choice questions must have options') {
          return res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * PATCH /api/v1/questions/:id
 * Update question
 */
router.patch(
  '/questions/:id',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(updateQuestionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const question = await QuestionnaireCrudService.updateQuestion(
        id,
        req.body,
        req,
      );

      res.status(200).json({
        success: true,
        data: question,
        message: 'Question updated successfully',
      });
    } catch (error) {
      console.error('Error updating question:', error);

      if (error instanceof Error) {
        if (error.message === 'Question not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message === 'Choice questions must have options') {
          return res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * DELETE /api/v1/questions/:id
 * Delete question
 */
router.delete(
  '/questions/:id',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await QuestionnaireCrudService.deleteQuestion(id, req);

      res.status(200).json({
        success: true,
        message: 'Question deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting question:', error);

      if (error instanceof Error) {
        if (error.message === 'Question not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (
          error.message ===
          'Cannot delete question that has responses. Consider archiving instead.'
        ) {
          return res.status(409).json({
            success: false,
            error: 'Conflict',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * PATCH /api/v1/question-groups/:groupId/questions/reorder
 * Reorder questions within a group
 */
router.patch(
  '/question-groups/:groupId/questions/reorder',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(reorderQuestionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;

      await QuestionnaireCrudService.reorderQuestions(
        groupId,
        req.body.questionOrders,
        req,
      );

      res.status(200).json({
        success: true,
        message: 'Questions reordered successfully',
      });
    } catch (error) {
      console.error('Error reordering questions:', error);

      if (error instanceof Error) {
        if (
          error.message ===
          'Some questions do not belong to this question group'
        ) {
          return res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: error.message,
          });
        }
      }

      next(error);
    }
  },
);

/**
 * GET /api/v1/questionnaires/:id/validate
 * Validate questionnaire structure
 */
router.get(
  '/:id/validate',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const validation =
        await QuestionnaireCrudService.validateQuestionnaireStructure(id);

      res.status(200).json({
        success: true,
        data: validation,
      });
    } catch (error) {
      console.error('Error validating questionnaire:', error);
      next(error);
    }
  },
);

export default router;
