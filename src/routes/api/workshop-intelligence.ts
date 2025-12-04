import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth';
import { WorkshopIntelligenceService } from '../../services/workshopIntelligenceService';

const router = Router();

// ===== VALIDATION SCHEMAS =====

const createFormSchema = z.object({
  workshopId: z.string().uuid(),
});

const createQuestionSchema = z.object({
  questionText: z.string().min(1).max(1000),
  questionType: z.enum([
    'text',
    'textarea',
    'multiple_choice',
    'single_choice',
    'rating',
    'yes_no',
  ]),
  options: z
    .object({
      options: z.array(z.string()).optional(),
    })
    .optional(),
  isRequired: z.boolean().default(false),
  displayOrder: z.number().int().min(0),
});

const updateQuestionSchema = createQuestionSchema.partial();

const updateFormSchema = z.object({
  questions: z.array(createQuestionSchema).optional(),
});

const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answerData: z.record(z.any()), // Flexible JSON structure
});

const submitContributionSchema = z.object({
  answers: z.array(submitAnswerSchema),
  status: z.enum(['draft', 'submitted']).default('draft'),
});

// ===== MIDDLEWARE =====

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

// ===== FORM MANAGEMENT ROUTES =====

/**
 * POST /api/workshop-intelligence/forms
 * Create a new form for a workshop
 * @access Admin, Facilitator
 */
router.post(
  '/forms',
  authenticateJWT,
  authorizeRoles(['admin', 'facilitator']),
  validateRequestBody(createFormSchema),
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.body;
      const service = new WorkshopIntelligenceService();

      const form = await service.createForm(workshopId);

      return res.status(201).json({
        success: true,
        data: form,
      });
    } catch (error: any) {
      console.error('Error creating form:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to create form',
      });
    }
  },
);

/**
 * GET /api/workshop-intelligence/forms/:workshopId
 * Get form for a specific workshop
 * @access Authenticated users
 */
router.get(
  '/forms/:workshopId',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const service = new WorkshopIntelligenceService();

      const form = await service.getFormByWorkshopId(workshopId);

      if (!form) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Form not found for this workshop',
        });
      }

      return res.status(200).json({
        success: true,
        data: form,
      });
    } catch (error: any) {
      console.error('Error fetching form:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch form',
      });
    }
  },
);

/**
 * PUT /api/workshop-intelligence/forms/:workshopId/lock
 * Lock form editing for participants
 * @access Admin, Facilitator
 */
router.put(
  '/forms/:workshopId/lock',
  authenticateJWT,
  authorizeRoles(['admin', 'facilitator']),
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const service = new WorkshopIntelligenceService();

      const form = await service.lockForm(workshopId);

      return res.status(200).json({
        success: true,
        data: form,
        message: 'Form locked successfully',
      });
    } catch (error: any) {
      console.error('Error locking form:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to lock form',
      });
    }
  },
);

/**
 * PUT /api/workshop-intelligence/forms/:workshopId/unlock
 * Unlock form editing for participants
 * @access Admin, Facilitator
 */
router.put(
  '/forms/:workshopId/unlock',
  authenticateJWT,
  authorizeRoles(['admin', 'facilitator']),
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const service = new WorkshopIntelligenceService();

      const form = await service.unlockForm(workshopId);

      return res.status(200).json({
        success: true,
        data: form,
        message: 'Form unlocked successfully',
      });
    } catch (error: any) {
      console.error('Error unlocking form:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to unlock form',
      });
    }
  },
);

// ===== QUESTION MANAGEMENT ROUTES =====

/**
 * POST /api/workshop-intelligence/forms/:workshopId/questions
 * Add a question to the form
 * @access Admin, Facilitator
 */
router.post(
  '/forms/:workshopId/questions',
  authenticateJWT,
  authorizeRoles(['admin', 'facilitator']),
  validateRequestBody(createQuestionSchema),
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const questionData = req.body;
      const service = new WorkshopIntelligenceService();

      const question = await service.addQuestion(workshopId, questionData);

      return res.status(201).json({
        success: true,
        data: question,
      });
    } catch (error: any) {
      console.error('Error adding question:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to add question',
      });
    }
  },
);

/**
 * PUT /api/workshop-intelligence/questions/:questionId
 * Update a question
 * @access Admin, Facilitator
 */
router.put(
  '/questions/:questionId',
  authenticateJWT,
  authorizeRoles(['admin', 'facilitator']),
  validateRequestBody(updateQuestionSchema),
  async (req: Request, res: Response) => {
    try {
      const { questionId } = req.params;
      const questionData = req.body;
      const service = new WorkshopIntelligenceService();

      const question = await service.updateQuestion(questionId, questionData);

      return res.status(200).json({
        success: true,
        data: question,
      });
    } catch (error: any) {
      console.error('Error updating question:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to update question',
      });
    }
  },
);

/**
 * DELETE /api/workshop-intelligence/questions/:questionId
 * Delete a question
 * @access Admin, Facilitator
 */
router.delete(
  '/questions/:questionId',
  authenticateJWT,
  authorizeRoles(['admin', 'facilitator']),
  async (req: Request, res: Response) => {
    try {
      const { questionId } = req.params;
      const service = new WorkshopIntelligenceService();

      await service.deleteQuestion(questionId);

      return res.status(200).json({
        success: true,
        message: 'Question deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting question:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to delete question',
      });
    }
  },
);

// ===== PARTICIPANT CONTRIBUTION ROUTES =====

/**
 * POST /api/workshop-intelligence/workshops/:workshopId/contributions
 * Submit or update participant contribution
 * @access Authenticated participants
 */
router.post(
  '/workshops/:workshopId/contributions',
  authenticateJWT,
  validateRequestBody(submitContributionSchema),
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const { answers, status } = req.body;
      const userId = (req as any).user.id; // From JWT middleware
      const service = new WorkshopIntelligenceService();

      const contribution = await service.submitContribution(
        workshopId,
        userId,
        answers,
        status,
      );

      return res.status(201).json({
        success: true,
        data: contribution,
      });
    } catch (error: any) {
      console.error('Error submitting contribution:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to submit contribution',
      });
    }
  },
);

/**
 * GET /api/workshop-intelligence/workshops/:workshopId/contributions/me
 * Get current user's contribution for a workshop
 * @access Authenticated participants
 */
router.get(
  '/workshops/:workshopId/contributions/me',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const userId = (req as any).user.id; // From JWT middleware
      const service = new WorkshopIntelligenceService();

      const contribution = await service.getUserContribution(
        workshopId,
        userId,
      );

      if (!contribution) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'No contribution found',
        });
      }

      return res.status(200).json({
        success: true,
        data: contribution,
      });
    } catch (error: any) {
      console.error('Error fetching contribution:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch contribution',
      });
    }
  },
);

/**
 * GET /api/workshop-intelligence/workshops/:workshopId/contributions
 * Get all contributions for a workshop (admin only)
 * @access Admin, Facilitator
 */
router.get(
  '/workshops/:workshopId/contributions',
  authenticateJWT,
  authorizeRoles(['admin', 'facilitator']),
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const service = new WorkshopIntelligenceService();

      const contributions = await service.getAllContributions(workshopId);

      return res.status(200).json({
        success: true,
        data: contributions,
        count: contributions.length,
      });
    } catch (error: any) {
      console.error('Error fetching contributions:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch contributions',
      });
    }
  },
);

export default router;
