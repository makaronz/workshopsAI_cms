import { Router, Request, Response } from 'express';
import { EnrollmentService } from '../services/enrollmentService';
import { validationSchemas } from '../types/validation';
import { authenticate, requireRole } from '../config/auth';
import { z } from 'zod';

const router = Router();

// Apply authentication to all enrollment routes
router.use(authenticate);

// GET /api/enrollments - List enrollments
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedQuery = validationSchemas.enrollmentFilter.parse(req.query);
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const result = await EnrollmentService.listEnrollments(
      validatedQuery,
      userId,
      userRole,
    );

    res.json({
      success: true,
      data: result.enrollments,
      pagination: result.pagination,
    });
    return;
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    console.error('Error listing enrollments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list enrollments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
});

// GET /api/enrollments/history - Get participant enrollment history
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = req.user!.id;

    const enrollments = await EnrollmentService.getParticipantEnrollmentHistory(
      userId,
      limit,
    );

    res.json({
      success: true,
      data: enrollments,
    });
    return;
  } catch (error) {
    console.error('Error getting enrollment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get enrollment history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
});

// GET /api/enrollments/:id - Get enrollment by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const enrollment = await EnrollmentService.getEnrollmentById(id);

    if (!enrollment) {
      res.status(404).json({
        success: false,
        error: 'Enrollment not found',
      });
      return;
    }

    // Check permissions
    const isParticipant = enrollment.participantId === userId;
    const isFacilitator =
      userRole === 'facilitator' ||
      userRole === 'moderator' ||
      userRole === 'admin';

    if (!isParticipant && !isFacilitator) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    res.json({
      success: true,
      data: enrollment,
    });
    return;
  } catch (error) {
    console.error('Error getting enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get enrollment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
});

// POST /api/enrollments - Create enrollment
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = validationSchemas.createEnrollment.parse(req.body);
    const userId = req.user!.id;

    const enrollment = await EnrollmentService.createEnrollment(
      userId,
      validatedData,
    );

    res.status(201).json({
      success: true,
      data: enrollment,
      message: 'Enrollment created successfully',
    });
    return;
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error && error.message.includes('already enrolled')) {
      res.status(409).json({
        success: false,
        error: 'Already enrolled',
        message: error.message,
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message.includes('Workshop not found')
    ) {
      res.status(404).json({
        success: false,
        error: 'Workshop not found',
        message: 'The workshop you\'re trying to enroll in does not exist',
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message.includes('not available for enrollment')
    ) {
      res.status(400).json({
        success: false,
        error: 'Workshop not available',
        message: 'This workshop is not currently accepting enrollments',
      });
      return;
    }

    if (error instanceof Error && error.message.includes('full')) {
      res.status(409).json({
        success: false,
        error: 'Workshop full',
        message: error.message,
      });
      return;
    }

    console.error('Error creating enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create enrollment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
});

// PUT /api/enrollments/:id - Update enrollment
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = validationSchemas.updateEnrollment.parse(req.body);

    const enrollment = await EnrollmentService.updateEnrollment(
      id,
      userId,
      validatedData,
    );

    res.json({
      success: true,
      data: enrollment,
      message: 'Enrollment updated successfully',
    });
    return;
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error && error.message.includes('Permission denied')) {
      res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: error.message,
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message.includes('Enrollment not found')
    ) {
      res.status(404).json({
        success: false,
        error: 'Enrollment not found',
      });
      return;
    }

    console.error('Error updating enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update enrollment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
});

// POST /api/enrollments/:id/confirm - Confirm enrollment (facilitator only)
router.post(
  '/:id/confirm',
  requireRole(['facilitator', 'moderator', 'admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const enrollment = await EnrollmentService.confirmEnrollment(id, userId);

      res.json({
        success: true,
        data: enrollment,
        message: 'Enrollment confirmed successfully',
      });
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Enrollment not found')
      ) {
        res.status(404).json({
          success: false,
          error: 'Enrollment not found',
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message.includes('Permission denied')
      ) {
        res.status(403).json({
          success: false,
          error: 'Permission denied',
          message: 'Only facilitators can confirm enrollments',
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message.includes('cannot be confirmed')
      ) {
        res.status(400).json({
          success: false,
          error: 'Cannot confirm enrollment',
          message: error.message,
        });
        return;
      }

      console.error('Error confirming enrollment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to confirm enrollment',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

// POST /api/enrollments/:id/cancel - Cancel enrollment
router.post(
  '/:id/cancel',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { reason } = req.body;

      const enrollment = await EnrollmentService.cancelEnrollment(
        id,
        userId,
        reason,
      );

      res.json({
        success: true,
        data: enrollment,
        message: 'Enrollment cancelled successfully',
      });
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Enrollment not found')
      ) {
        res.status(404).json({
          success: false,
          error: 'Enrollment not found',
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message.includes('Permission denied')
      ) {
        res.status(403).json({
          success: false,
          error: 'Permission denied',
          message: error.message,
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message.includes('cannot be cancelled')
      ) {
        res.status(400).json({
          success: false,
          error: 'Cannot cancel enrollment',
          message: error.message,
        });
        return;
      }

      console.error('Error cancelling enrollment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel enrollment',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

// POST /api/enrollments/:id/attendance - Mark attendance (facilitator only)
router.post(
  '/:id/attendance',
  requireRole(['facilitator', 'moderator', 'admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { sessionId, attended, notes } = req.body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: 'Session ID is required',
        });
        return;
      }

      const enrollment = await EnrollmentService.markAttendance(
        id,
        sessionId,
        userId,
        attended,
        notes,
      );

      res.json({
        success: true,
        data: enrollment,
        message: 'Attendance marked successfully',
      });
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Enrollment not found')
      ) {
        res.status(404).json({
          success: false,
          error: 'Enrollment not found',
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message.includes('Permission denied')
      ) {
        res.status(403).json({
          success: false,
          error: 'Permission denied',
          message: 'Only facilitators can mark attendance',
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message.includes(
          'Can only mark attendance for confirmed enrollments',
        )
      ) {
        res.status(400).json({
          success: false,
          error: 'Invalid enrollment status',
          message: error.message,
        });
        return;
      }

      console.error('Error marking attendance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark attendance',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

// GET /api/enrollments/workshop/:workshopId/stats - Get workshop enrollment statistics
router.get(
  '/workshop/:workshopId/stats',
  requireRole(['facilitator', 'moderator', 'sociologist-editor', 'admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { workshopId } = req.params;

      const stats =
        await EnrollmentService.getWorkshopEnrollmentStats(workshopId);

      res.json({
        success: true,
        data: stats,
      });
      return;
    } catch (error) {
      console.error('Error getting workshop enrollment stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get workshop enrollment statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

export default router;
