import { Router, Request, Response } from "express";
import { EnrollmentService } from "../services/enrollmentService";
import { validationSchemas } from "../types/validation";
import { authenticate, authorize, requireRole } from "../config/auth";
import { z } from "zod";

const router = Router();

// Apply authentication to all enrollment routes
router.use(authenticate);

// GET /api/enrollments - List enrollments
router.get("/", async (req: Request, res: Response) => {
  try {
    const validatedQuery = validationSchemas.enrollmentFilter.parse(req.query);
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const result = await EnrollmentService.listEnrollments(
      validatedQuery,
      userId,
      userRole
    );

    res.json({
      success: true,
      data: result.enrollments,
      pagination: result.pagination,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    console.error("Error listing enrollments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list enrollments",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/enrollments/history - Get participant enrollment history
router.get("/history", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = req.user!.id;

    const enrollments = await EnrollmentService.getParticipantEnrollmentHistory(
      userId,
      limit
    );

    res.json({
      success: true,
      data: enrollments,
    });
  } catch (error) {
    console.error("Error getting enrollment history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get enrollment history",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/enrollments/:id - Get enrollment by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const enrollment = await EnrollmentService.getEnrollmentById(id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: "Enrollment not found",
      });
    }

    // Check permissions
    const isParticipant = enrollment.participantId === userId;
    const isFacilitator = userRole === "facilitator" || userRole === "moderator" || userRole === "admin";

    if (!isParticipant && !isFacilitator) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    res.json({
      success: true,
      data: enrollment,
    });
  } catch (error) {
    console.error("Error getting enrollment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get enrollment",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/enrollments - Create enrollment
router.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = validationSchemas.createEnrollment.parse(req.body);
    const userId = req.user!.id;

    const enrollment = await EnrollmentService.createEnrollment(userId, validatedData);

    res.status(201).json({
      success: true,
      data: enrollment,
      message: "Enrollment created successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    if (error instanceof Error && error.message.includes("already enrolled")) {
      return res.status(409).json({
        success: false,
        error: "Already enrolled",
        message: error.message,
      });
    }

    if (error instanceof Error && error.message.includes("Workshop not found")) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
        message: "The workshop you're trying to enroll in does not exist",
      });
    }

    if (error instanceof Error && error.message.includes("not available for enrollment")) {
      return res.status(400).json({
        success: false,
        error: "Workshop not available",
        message: "This workshop is not currently accepting enrollments",
      });
    }

    if (error instanceof Error && error.message.includes("full")) {
      return res.status(409).json({
        success: false,
        error: "Workshop full",
        message: error.message,
      });
    }

    console.error("Error creating enrollment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create enrollment",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// PUT /api/enrollments/:id - Update enrollment
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = validationSchemas.updateEnrollment.parse(req.body);

    const enrollment = await EnrollmentService.updateEnrollment(id, userId, validatedData);

    res.json({
      success: true,
      data: enrollment,
      message: "Enrollment updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    if (error instanceof Error && error.message.includes("Permission denied")) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
        message: error.message,
      });
    }

    if (error instanceof Error && error.message.includes("Enrollment not found")) {
      return res.status(404).json({
        success: false,
        error: "Enrollment not found",
      });
    }

    console.error("Error updating enrollment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update enrollment",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/enrollments/:id/confirm - Confirm enrollment (facilitator only)
router.post(
  "/:id/confirm",
  requireRole(["facilitator", "moderator", "admin"]),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const enrollment = await EnrollmentService.confirmEnrollment(id, userId);

      res.json({
        success: true,
        data: enrollment,
        message: "Enrollment confirmed successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Enrollment not found")) {
        return res.status(404).json({
          success: false,
          error: "Enrollment not found",
        });
      }

      if (error instanceof Error && error.message.includes("Permission denied")) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
          message: "Only facilitators can confirm enrollments",
        });
      }

      if (error instanceof Error && error.message.includes("cannot be confirmed")) {
        return res.status(400).json({
          success: false,
          error: "Cannot confirm enrollment",
          message: error.message,
        });
      }

      console.error("Error confirming enrollment:", error);
      res.status(500).json({
        success: false,
        error: "Failed to confirm enrollment",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// POST /api/enrollments/:id/cancel - Cancel enrollment
router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { reason } = req.body;

    const enrollment = await EnrollmentService.cancelEnrollment(id, userId, reason);

    res.json({
      success: true,
      data: enrollment,
      message: "Enrollment cancelled successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Enrollment not found")) {
      return res.status(404).json({
        success: false,
        error: "Enrollment not found",
      });
    }

    if (error instanceof Error && error.message.includes("Permission denied")) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
        message: error.message,
      });
    }

    if (error instanceof Error && error.message.includes("cannot be cancelled")) {
      return res.status(400).json({
        success: false,
        error: "Cannot cancel enrollment",
        message: error.message,
      });
    }

    console.error("Error cancelling enrollment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel enrollment",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/enrollments/:id/attendance - Mark attendance (facilitator only)
router.post(
  "/:id/attendance",
  requireRole(["facilitator", "moderator", "admin"]),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { sessionId, attended, notes } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          message: "Session ID is required",
        });
      }

      const enrollment = await EnrollmentService.markAttendance(
        id,
        sessionId,
        userId,
        attended,
        notes
      );

      res.json({
        success: true,
        data: enrollment,
        message: "Attendance marked successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Enrollment not found")) {
        return res.status(404).json({
          success: false,
          error: "Enrollment not found",
        });
      }

      if (error instanceof Error && error.message.includes("Permission denied")) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
          message: "Only facilitators can mark attendance",
        });
      }

      if (error instanceof Error && error.message.includes("Can only mark attendance for confirmed enrollments")) {
        return res.status(400).json({
          success: false,
          error: "Invalid enrollment status",
          message: error.message,
        });
      }

      console.error("Error marking attendance:", error);
      res.status(500).json({
        success: false,
        error: "Failed to mark attendance",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// GET /api/enrollments/workshop/:workshopId/stats - Get workshop enrollment statistics
router.get(
  "/workshop/:workshopId/stats",
  requireRole(["facilitator", "moderator", "sociologist-editor", "admin"]),
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;

      const stats = await EnrollmentService.getWorkshopEnrollmentStats(workshopId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error getting workshop enrollment stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get workshop enrollment statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;