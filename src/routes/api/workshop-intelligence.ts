/**
 * Workshop Intelligence API Routes
 * Endpoints for managing workshop forms, participant contributions, and LLM analyses
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { workshopIntelligenceService } from '../../services/workshopIntelligenceService.js';

const router = express.Router();

/**
 * Validation Schemas
 */
const createFormSchema = z.object({
  workshopId: z.string().uuid(),
});

const addQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['text', 'textarea', 'multiple_choice', 'single_choice', 'rating', 'yes_no']),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().default(false),
  displayOrder: z.number().int().nonnegative(),
});

const updateQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  questionType: z.enum(['text', 'textarea', 'multiple_choice', 'single_choice', 'rating', 'yes_no']).optional(),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
});

const saveAnswerSchema = z.object({
  contributionId: z.string().uuid(),
  questionId: z.string().uuid(),
  answerData: z.any(), // Flexible answer data structure
});

/**
 * Form Management Routes
 */

/**
 * POST /api/workshop-intelligence/forms
 * Create a new form for a workshop
 */
router.post('/forms', async (req: Request, res: Response) => {
  try {
    const validated = createFormSchema.parse(req.body);
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const form = await workshopIntelligenceService.createForm(
      validated.workshopId,
      userId,
    );

    res.status(201).json(form);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/workshop-intelligence/forms/:workshopId
 * Get form with questions for a workshop
 */
router.get('/forms/:workshopId', async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;

    const formWithQuestions = await workshopIntelligenceService.getFormWithQuestions(
      workshopId,
    );

    if (!formWithQuestions) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.json(formWithQuestions);
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workshop-intelligence/forms/:formId/questions
 * Add a question to a form
 */
router.post('/forms/:formId/questions', async (req: Request, res: Response) => {
  try {
    const { formId } = req.params;
    const validated = addQuestionSchema.parse(req.body);

    const question = await workshopIntelligenceService.addQuestion(formId, validated);

    res.status(201).json(question);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error adding question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/workshop-intelligence/questions/:questionId
 * Update a question
 */
router.put('/questions/:questionId', async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const validated = updateQuestionSchema.parse(req.body);

    const question = await workshopIntelligenceService.updateQuestion(
      questionId,
      validated,
    );

    res.json(question);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/workshop-intelligence/questions/:questionId
 * Delete a question
 */
router.delete('/questions/:questionId', async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;

    await workshopIntelligenceService.deleteQuestion(questionId);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Form Locking Routes
 */

/**
 * PUT /api/workshop-intelligence/forms/:workshopId/lock
 * Lock form (disable editing)
 */
router.put('/forms/:workshopId/lock', async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;

    const form = await workshopIntelligenceService.lockForm(workshopId);

    res.json(form);
  } catch (error) {
    console.error('Error locking form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/workshop-intelligence/forms/:workshopId/unlock
 * Unlock form (enable editing)
 */
router.put('/forms/:workshopId/unlock', async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;

    const form = await workshopIntelligenceService.unlockForm(workshopId);

    res.json(form);
  } catch (error) {
    console.error('Error unlocking form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Participant Contribution Routes
 */

/**
 * POST /api/workshop-intelligence/contributions
 * Create or get participant contribution
 */
router.post('/contributions', async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!workshopId) {
      return res.status(400).json({ error: 'workshopId is required' });
    }

    const contribution = await workshopIntelligenceService.getOrCreateContribution(
      workshopId,
      userId,
    );

    res.json(contribution);
  } catch (error) {
    console.error('Error creating contribution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workshop-intelligence/answers
 * Save answer to a question
 */
router.post('/answers', async (req: Request, res: Response) => {
  try {
    const validated = saveAnswerSchema.parse(req.body);
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if form is editable
    const contribution = await workshopIntelligenceService.getParticipantContribution(
      validated.contributionId,
    );

    if (!contribution) {
      return res.status(404).json({ error: 'Contribution not found' });
    }

    const isEditable = await workshopIntelligenceService.isFormEditable(
      contribution.workshopId,
    );

    if (!isEditable) {
      return res.status(403).json({ error: 'Form is locked and cannot be edited' });
    }

    const answer = await workshopIntelligenceService.saveAnswer(
      validated.contributionId,
      validated.questionId,
      validated.answerData,
    );

    res.json(answer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error saving answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workshop-intelligence/contributions/:contributionId/submit
 * Submit contribution
 */
router.post(
  '/contributions/:contributionId/submit',
  async (req: Request, res: Response) => {
    try {
      const { contributionId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const contribution = await workshopIntelligenceService.submitContribution(
        contributionId,
      );

      res.json(contribution);
    } catch (error) {
      console.error('Error submitting contribution:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /api/workshop-intelligence/contributions/:contributionId
 * Get participant contribution with answers
 */
router.get(
  '/contributions/:contributionId',
  async (req: Request, res: Response) => {
    try {
      const { contributionId } = req.params;

      const contribution = await workshopIntelligenceService.getParticipantContribution(
        contributionId,
      );

      if (!contribution) {
        return res.status(404).json({ error: 'Contribution not found' });
      }

      res.json(contribution);
    } catch (error) {
      console.error('Error fetching contribution:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /api/workshop-intelligence/workshops/:workshopId/contributions
 * Get all contributions for a workshop (admin only)
 */
router.get(
  '/workshops/:workshopId/contributions',
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // TODO: Add role-based access control (admin/facilitator only)

      const contributions = await workshopIntelligenceService.getWorkshopContributions(
        workshopId,
      );

      res.json(contributions);
    } catch (error) {
      console.error('Error fetching workshop contributions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * LLM Analysis Routes
 */

/**
 * POST /api/workshop-intelligence/workshops/:workshopId/analyses
 * Trigger new analysis (queues BullMQ job)
 */
router.post(
  '/workshops/:workshopId/analyses',
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const { modelName, promptTemplateId, customInstructions } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate model name
      if (!modelName) {
        return res.status(400).json({ error: 'modelName is required' });
      }

      const validModels = [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-4o',
        'gpt-4o-mini',
        'claude-3-opus',
        'claude-3-sonnet',
        'gemini-pro',
      ];

      if (!validModels.includes(modelName)) {
        return res.status(400).json({
          error: 'Invalid model name',
          validModels,
        });
      }

      // Check if form exists and has contributions
      const contributions = await workshopIntelligenceService.getWorkshopContributions(
        workshopId,
      );

      if (contributions.length === 0) {
        return res.status(400).json({
          error: 'No participant contributions found for this workshop',
        });
      }

      // Create analysis and queue job
      const analysis = await workshopIntelligenceService.createAnalysis(
        workshopId,
        userId,
        modelName,
        promptTemplateId,
        customInstructions,
      );

      res.status(201).json({
        message: 'Analysis queued successfully',
        analysis,
      });
    } catch (error) {
      console.error('Error creating analysis:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /api/workshop-intelligence/analyses/:analysisId
 * Get analysis results
 */
router.get('/analyses/:analysisId', async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analysis = await workshopIntelligenceService.getAnalysis(analysisId);

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // TODO: Check if user has permission to view this analysis
    // (owner, admin, or participant if shared)

    res.json(analysis);
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/workshop-intelligence/workshops/:workshopId/analyses
 * Get all analyses for workshop (admin only)
 */
router.get(
  '/workshops/:workshopId/analyses',
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // TODO: Add role-based access control (admin/facilitator only)

      const analyses = await workshopIntelligenceService.getAllAnalyses(workshopId);

      res.json(analyses);
    } catch (error) {
      console.error('Error fetching analyses:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /api/workshop-intelligence/analyses/:analysisId/share
 * Share analysis with participants
 */
router.put('/analyses/:analysisId/share', async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Check if user is admin/facilitator

    const analysis = await workshopIntelligenceService.shareAnalysis(analysisId);

    res.json({
      message: 'Analysis shared with participants',
      analysis,
    });
  } catch (error) {
    console.error('Error sharing analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/workshop-intelligence/analyses/:analysisId/hide
 * Hide analysis from participants
 */
router.put('/analyses/:analysisId/hide', async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Check if user is admin/facilitator

    const analysis = await workshopIntelligenceService.hideAnalysis(analysisId);

    res.json({
      message: 'Analysis hidden from participants',
      analysis,
    });
  } catch (error) {
    console.error('Error hiding analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Prompt Template Routes
 */

/**
 * GET /api/workshop-intelligence/prompt-templates
 * Get all prompt templates
 */
router.get('/prompt-templates', async (req: Request, res: Response) => {
  try {
    const templates = await workshopIntelligenceService.getPromptTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching prompt templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workshop-intelligence/prompt-templates
 * Create custom prompt template
 */
router.post('/prompt-templates', async (req: Request, res: Response) => {
  try {
    const { name, description, templateText } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name || !templateText) {
      return res.status(400).json({
        error: 'name and templateText are required',
      });
    }

    const template = await workshopIntelligenceService.createPromptTemplate(
      name,
      description || '',
      templateText,
      userId,
    );

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating prompt template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
