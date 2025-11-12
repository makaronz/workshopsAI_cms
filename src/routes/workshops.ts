import { Router, Request, Response } from "express";
import { WorkshopService } from "../services/workshopService";
import { validationSchemas } from "../types/validation";
import { authenticate, authorize, requireOwnerOrAdmin } from "../config/auth";
import { z } from "zod";

const router = Router();

// Apply authentication to all workshop routes
router.use(authenticate);

// GET /api/workshops - List workshops
router.get("/", async (req: Request, res: Response) => {
  try {
    const validatedQuery = validationSchemas.workshopFilter.parse(req.query);
    const result = await WorkshopService.listWorkshops(validatedQuery);

    res.json({
      success: true,
      data: result.workshops,
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

    console.error("Error listing workshops:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list workshops",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/workshops/slug/:slug - Get workshop by slug
router.get("/slug/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const workshop = await WorkshopService.getWorkshopBySlug(slug);

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    // Only return published workshops for public access
    if (workshop.status !== "published" && req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Workshop not available",
      });
    }

    res.json({
      success: true,
      data: workshop,
    });
  } catch (error) {
    console.error("Error getting workshop by slug:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get workshop",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/workshops/:id - Get workshop by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workshop = await WorkshopService.getWorkshopById(id);

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    // Check permissions based on workshop status and user role
    if (workshop.status !== "published") {
      // Only allow creator, facilitators, and admins to see unpublished workshops
      const isCreator = workshop.createdBy === req.user?.id;
      const isFacilitator = workshop.workshopFacilitators.some(
        (wf) => wf.facilitator.userId === req.user?.id
      );
      const isAdmin = req.user?.role === "admin";

      if (!isCreator && !isFacilitator && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }
    }

    res.json({
      success: true,
      data: workshop,
    });
  } catch (error) {
    console.error("Error getting workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get workshop",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/workshops - Create workshop
router.post("/", authorize("create:workshops"), async (req: Request, res: Response) => {
  try {
    const validatedData = validationSchemas.createWorkshop.parse(req.body);
    const userId = req.user!.id;

    const workshop = await WorkshopService.createWorkshop(userId, validatedData);

    res.status(201).json({
      success: true,
      data: workshop,
      message: "Workshop created successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    if (error instanceof Error && error.message.includes("Duplicate entry")) {
      return res.status(409).json({
        success: false,
        error: "Duplicate entry",
        message: "Workshop with this slug already exists",
      });
    }

    console.error("Error creating workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create workshop",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// PUT /api/workshops/:id - Update workshop
router.put(
  "/:id",
  requireOwnerOrAdmin(async (req: Request) => {
    const workshop = await WorkshopService.getWorkshopById(req.params.id);
    return workshop?.createdBy || null;
  }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const validatedData = validationSchemas.updateWorkshop.parse(req.body);

      const workshop = await WorkshopService.updateWorkshop(id, userId, validatedData);

      res.json({
        success: true,
        data: workshop,
        message: "Workshop updated successfully",
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
          message: "You can only update your own workshops",
        });
      }

      if (error instanceof Error && error.message.includes("Workshop not found")) {
        return res.status(404).json({
          success: false,
          error: "Workshop not found",
        });
      }

      console.error("Error updating workshop:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update workshop",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// POST /api/workshops/:id/publish - Publish workshop
router.post(
  "/:id/publish",
  requireOwnerOrAdmin(async (req: Request) => {
    const workshop = await WorkshopService.getWorkshopById(req.params.id);
    return workshop?.createdBy || null;
  }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { publishDate } = req.body;

      const workshop = await WorkshopService.publishWorkshop(
        id,
        userId,
        publishDate ? new Date(publishDate) : undefined
      );

      res.json({
        success: true,
        data: workshop,
        message: "Workshop published successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Permission denied")) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
        });
      }

      if (error instanceof Error && error.message.includes("Workshop not found")) {
        return res.status(404).json({
          success: false,
          error: "Workshop not found",
        });
      }

      if (error instanceof Error && error.message.includes("Title and description are required")) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          message: "Title and description are required to publish workshop",
        });
      }

      console.error("Error publishing workshop:", error);
      res.status(500).json({
        success: false,
        error: "Failed to publish workshop",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// POST /api/workshops/:id/archive - Archive workshop
router.post(
  "/:id/archive",
  requireOwnerOrAdmin(async (req: Request) => {
    const workshop = await WorkshopService.getWorkshopById(req.params.id);
    return workshop?.createdBy || null;
  }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const workshop = await WorkshopService.archiveWorkshop(id, userId);

      res.json({
        success: true,
        data: workshop,
        message: "Workshop archived successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Permission denied")) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
        });
      }

      if (error instanceof Error && error.message.includes("Workshop not found")) {
        return res.status(404).json({
          success: false,
          error: "Workshop not found",
        });
      }

      console.error("Error archiving workshop:", error);
      res.status(500).json({
        success: false,
        error: "Failed to archive workshop",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// DELETE /api/workshops/:id - Delete workshop
router.delete(
  "/:id",
  requireOwnerOrAdmin(async (req: Request) => {
    const workshop = await WorkshopService.getWorkshopById(req.params.id);
    return workshop?.createdBy || null;
  }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await WorkshopService.deleteWorkshop(id, userId);

      res.json({
        success: true,
        data: result,
        message: "Workshop deleted successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Permission denied")) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
        });
      }

      if (error instanceof Error && error.message.includes("Workshop not found")) {
        return res.status(404).json({
          success: false,
          error: "Workshop not found",
        });
      }

      if (error instanceof Error && error.message.includes("Cannot delete workshop with enrollments")) {
        return res.status(409).json({
          success: false,
          error: "Cannot delete workshop",
          message: "Cannot delete workshop with existing enrollments",
        });
      }

      console.error("Error deleting workshop:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete workshop",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// POST /api/workshops/:id/duplicate - Duplicate workshop
router.post(
  "/:id/duplicate",
  authorize("create:workshops"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { newTitle } = req.body;

      if (!newTitle || typeof newTitle !== "string" || newTitle.trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          message: "New title is required and must be at least 3 characters long",
        });
      }

      const duplicateWorkshop = await WorkshopService.duplicateWorkshop(
        id,
        userId,
        newTitle.trim()
      );

      res.status(201).json({
        success: true,
        data: duplicateWorkshop,
        message: "Workshop duplicated successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Workshop not found")) {
        return res.status(404).json({
          success: false,
          error: "Workshop not found",
        });
      }

      console.error("Error duplicating workshop:", error);
      res.status(500).json({
        success: false,
        error: "Failed to duplicate workshop",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;