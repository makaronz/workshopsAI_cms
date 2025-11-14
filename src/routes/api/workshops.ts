import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth';
import {
  WorkshopCrudService,
  WorkshopFilters,
} from '../../services/workshopCrudService';

const router = Router();

// Validation schemas
const createWorkshopSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/),
  titleI18n: z
    .record(z.string(), z.string().min(1))
    .refine(
      obj =>
        Object.keys(obj).length > 0 &&
        Object.values(obj).some(val => val.trim().length > 0),
      {
        message: 'titleI18n must contain at least one non-empty language entry',
      },
    ),
  subtitleI18n: z.record(z.string(), z.string()).optional(),
  descriptionI18n: z
    .record(z.string(), z.string().min(1))
    .refine(
      obj =>
        Object.keys(obj).length > 0 &&
        Object.values(obj).some(val => val.trim().length > 0),
      {
        message:
          'descriptionI18n must contain at least one non-empty language entry',
      },
    ),
  shortDescriptionI18n: z.record(z.string(), z.string()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  seatLimit: z.number().int().min(1).optional(),
  enableWaitingList: z.boolean().optional().default(true),
  templateTheme: z
    .enum(['integracja', 'konflikty', 'well-being', 'custom'])
    .optional(),
  language: z.enum(['pl', 'en']).optional().default('pl'),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).optional().default('PLN'),
  imageUrl: z.string().url().optional(),
  gallery: z.array(z.string().url()).optional(),
  requirementsI18n: z.record(z.string(), z.array(z.string())).optional(),
  objectivesI18n: z.record(z.string(), z.array(z.string())).optional(),
  materials: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        type: z.string().min(1),
      }),
    )
    .optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const updateWorkshopSchema = createWorkshopSchema.partial().extend({
  status: z.enum(['draft', 'published', 'archived', 'cancelled']).optional(),
  publishedAt: z.string().datetime().optional(),
});

const workshopFiltersSchema = z.object({
  status: z.enum(['draft', 'published', 'archived', 'cancelled']).optional(),
  publishedAfter: z.string().datetime().optional(),
  publishedBefore: z.string().datetime().optional(),
  createdBy: z.string().uuid().optional(),
  hasQuestionnaire: z.boolean().optional(),
  hasSessions: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
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

// Middleware to validate query parameters
const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid query parameters',
      });
    }
  };
};

/**
 * GET /api/v1/workshops
 * List workshops with filtering and pagination
 */
router.get(
  '/',
  authenticateJWT,
  validateQuery(workshopFiltersSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: WorkshopFilters = {
        status: req.query.status as any,
        publishedAfter: req.query.publishedAfter
          ? new Date(req.query.publishedAfter as string)
          : undefined,
        publishedBefore: req.query.publishedBefore
          ? new Date(req.query.publishedBefore as string)
          : undefined,
        createdBy: req.query.createdBy as string,
        hasQuestionnaire:
          req.query.hasQuestionnaire === 'true'
            ? true
            : req.query.hasQuestionnaire === 'false'
              ? false
              : undefined,
        hasSessions:
          req.query.hasSessions === 'true'
            ? true
            : req.query.hasSessions === 'false'
              ? false
              : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await WorkshopCrudService.getWorkshops(filters, req);

      res.status(200).json({
        success: true,
        data: {
          workshops: result.workshops,
          pagination: {
            total: result.total,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: filters.offset + filters.limit < result.total,
          },
          filters: result.filters,
        },
      });
    } catch (error) {
      console.error('Error fetching workshops:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/workshops/:id
 * Get workshop by ID with full details
 */
router.get(
  '/:id',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const workshop = await WorkshopCrudService.getWorkshopById(id, req);

      if (!workshop) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Workshop not found',
        });
      }

      res.status(200).json({
        success: true,
        data: workshop,
      });
    } catch (error) {
      console.error('Error fetching workshop:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/workshops
 * Create new workshop
 */
router.post(
  '/',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(createWorkshopSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workshop = await WorkshopCrudService.createWorkshop(req.body, req);

      res.status(201).json({
        success: true,
        data: workshop,
        message: 'Workshop created successfully',
      });
    } catch (error) {
      console.error('Error creating workshop:', error);

      if (error instanceof Error) {
        if (error.message === 'Workshop with this slug already exists') {
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
 * PATCH /api/v1/workshops/:id
 * Update workshop
 */
router.patch(
  '/:id',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  validateRequestBody(updateWorkshopSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const workshop = await WorkshopCrudService.updateWorkshop(
        id,
        req.body,
        req,
      );

      res.status(200).json({
        success: true,
        data: workshop,
        message: 'Workshop updated successfully',
      });
    } catch (error) {
      console.error('Error updating workshop:', error);

      if (error instanceof Error) {
        if (error.message === 'Workshop not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message === 'Workshop with this slug already exists') {
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
 * DELETE /api/v1/workshops/:id
 * Soft delete workshop
 */
router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await WorkshopCrudService.deleteWorkshop(id, req);

      res.status(200).json({
        success: true,
        message: 'Workshop deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting workshop:', error);

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
 * GET /api/v1/workshops/:id/publish-checklist
 * Check if workshop can be published
 */
router.get(
  '/:id/publish-checklist',
  authenticateJWT,
  authorizeRoles(['sociologist-editor', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const checklist = await WorkshopCrudService.checkPublishingChecklist(id);

      res.status(200).json({
        success: true,
        data: checklist,
      });
    } catch (error) {
      console.error('Error checking publishing checklist:', error);

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

export default router;
