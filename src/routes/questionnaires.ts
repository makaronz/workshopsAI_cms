import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, questionnaires } from '../config/postgresql-database';
import { eq } from 'drizzle-orm';

const router = Router();

// Validation schemas
const createQuestionnaireSchema = z.object({
  titleI18n: z.record(z.string(), z.string().min(1)).refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one title translation is required',
  }),
  instructionsI18n: z.record(z.string(), z.string()).optional(),
});

const updateQuestionnaireSchema = z.object({
  titleI18n: z.record(z.string(), z.string().min(1)).optional(),
  instructionsI18n: z.record(z.string(), z.string()).optional(),
});

// GET / - List all questionnaires
router.get('/', async (req: Request, res: Response) => {
  try {
    const questionnaireList = await db
      .select({
        id: questionnaires.id,
        titleI18n: questionnaires.titleI18n,
        instructionsI18n: questionnaires.instructionsI18n,
        createdAt: questionnaires.createdAt,
      })
      .from(questionnaires)
      .orderBy(questionnaires.createdAt);

    return res.status(200).json({
      success: true,
      data: questionnaireList,
      count: questionnaireList.length,
    });
  } catch (error) {
    console.error('List questionnaires error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list questionnaires',
    });
  }
});

// GET /:id - Get questionnaire by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const questionnaire = await db
      .select({
        id: questionnaires.id,
        titleI18n: questionnaires.titleI18n,
        instructionsI18n: questionnaires.instructionsI18n,
        createdAt: questionnaires.createdAt,
      })
      .from(questionnaires)
      .where(eq(questionnaires.id, id))
      .limit(1);

    if (questionnaire.length === 0) {
      return res.status(404).json({
        error: 'Questionnaire not found',
        message: 'Questionnaire with this ID does not exist',
      });
    }

    return res.status(200).json({
      success: true,
      data: questionnaire[0],
    });
  } catch (error) {
    console.error('Get questionnaire error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get questionnaire',
    });
  }
});

// POST / - Create new questionnaire
router.post('/', async (req: Request, res: Response) => {
  try {
    const questionnaireData = createQuestionnaireSchema.parse(req.body);

    const newQuestionnaire = await db
      .insert({
        titleI18n: questionnaireData.titleI18n,
        instructionsI18n: questionnaireData.instructionsI18n || null,
        createdAt: new Date(),
      })
      .into(questionnaires)
      .returning();

    return res.status(201).json({
      success: true,
      message: 'Questionnaire created successfully',
      data: newQuestionnaire,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.errors[0].message,
      });
    }
    console.error('Create questionnaire error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create questionnaire',
    });
  }
});

// PUT /:id - Update questionnaire
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const questionnaireData = updateQuestionnaireSchema.parse(req.body);

    const updated = await db
      .update(questionnaires)
      .set({
        titleI18n: questionnaireData.titleI18n,
        instructionsI18n: questionnaireData.instructionsI18n,
      })
      .where(eq(questionnaires.id, id))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({
        error: 'Questionnaire not found',
        message: 'Questionnaire with this ID does not exist',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Questionnaire updated successfully',
      data: updated[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.errors[0].message,
      });
    }
    console.error('Update questionnaire error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update questionnaire',
    });
  }
});

// DELETE /:id - Delete questionnaire
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await db
      .delete(questionnaires)
      .where(eq(questionnaires.id, id))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({
        error: 'Questionnaire not found',
        message: 'Questionnaire with this ID does not exist',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Questionnaire deleted successfully',
    });
  } catch (error) {
    console.error('Delete questionnaire error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete questionnaire',
    });
  }
});

export default router;

