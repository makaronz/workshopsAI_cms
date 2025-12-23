import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, users, workshops } from '../config/postgresql-database';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Validation schemas
const createWorkshopSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  maxParticipants: z.number().int().positive().optional(),
});

const updateWorkshopSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  maxParticipants: z.number().int().positive().optional(),
});

// GET / - List all workshops
router.get('/', async (req: Request, res: Response) => {
  try {
    const workshopList = await db
      .select({
        id: workshops.id,
        title: workshops.title,
        description: workshops.description,
        startDate: workshops.startDate,
        endDate: workshops.endDate,
        maxParticipants: workshops.maxParticipants,
        createdAt: workshops.createdAt,
      })
      .from(workshops)
      .orderBy(workshops.createdAt);

    return res.status(200).json({
      success: true,
      data: workshopList,
      count: workshopList.length,
    });
  } catch (error) {
    console.error('List workshops error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list workshops',
    });
  }
});

// GET /:id - Get workshop by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workshop = await db
      .select({
        id: workshops.id,
        title: workshops.title,
        description: workshops.description,
        startDate: workshops.startDate,
        endDate: workshops.endDate,
        maxParticipants: workshops.maxParticipants,
        createdAt: workshops.createdAt,
      })
      .from(workshops)
      .where(eq(workshops.id, id))
      .limit(1);

    if (workshop.length === 0) {
      return res.status(404).json({
        error: 'Workshop not found',
        message: 'Workshop with this ID does not exist',
      });
    }

    return res.status(200).json({
      success: true,
      data: workshop[0],
    });
  } catch (error) {
    console.error('Get workshop error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get workshop',
    });
  }
});

// POST / - Create new workshop
router.post('/', async (req: Request, res: Response) => {
  try {
    const workshopData = createWorkshopSchema.parse(req.body);

    const newWorkshop = await db
      .insert({
        title: workshopData.title,
        description: workshopData.description || null,
        startDate: workshopData.startDate ? new Date(workshopData.startDate) : null,
        endDate: workshopData.endDate ? new Date(workshopData.endDate) : null,
        maxParticipants: workshopData.maxParticipants || null,
        createdAt: new Date(),
      })
      .into(workshops)
      .returning();

    return res.status(201).json({
      success: true,
      message: 'Workshop created successfully',
      data: newWorkshop,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.errors[0].message,
      });
    }
    console.error('Create workshop error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create workshop',
    });
  }
});

// PUT /:id - Update workshop
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workshopData = updateWorkshopSchema.parse(req.body);

    const updated = await db
      .update(workshops)
      .set({
        title: workshopData.title,
        description: workshopData.description,
        startDate: workshopData.startDate ? new Date(workshopData.startDate) : undefined,
        endDate: workshopData.endDate ? new Date(workshopData.endDate) : undefined,
        maxParticipants: workshopData.maxParticipants,
      })
      .where(eq(workshops.id, id))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({
        error: 'Workshop not found',
        message: 'Workshop with this ID does not exist',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Workshop updated successfully',
      data: updated[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.errors[0].message,
      });
    }
    console.error('Update workshop error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update workshop',
    });
  }
});

// DELETE /:id - Delete workshop
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await db
      .delete(workshops)
      .where(eq(workshops.id, id))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({
        error: 'Workshop not found',
        message: 'Workshop with this ID does not exist',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Workshop deleted successfully',
    });
  } catch (error) {
    console.error('Delete workshop error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete workshop',
    });
  }
});

export default router;

