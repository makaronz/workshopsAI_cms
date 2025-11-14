import { Router, Request, Response } from 'express';
import multer from 'multer';
import { templateManager } from '../services/templateManager';
import { questionnaireService } from '../services/questionnaireService';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

/**
 * GET /api/v1/templates
 * List all available templates
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const templates = await templateManager.listTemplates();
    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list templates',
    });
  }
});

/**
 * GET /api/v1/templates/:templateId
 * Get specific template details
 */
router.get('/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const template = await templateManager.loadPredefinedTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    // Get usage analytics
    const analytics =
      await templateManager.getTemplateUsageAnalytics(templateId);

    res.json({
      success: true,
      data: {
        template,
        analytics,
      },
    });
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template',
    });
  }
});

/**
 * POST /api/v1/templates/import/pdf
 * Import template from PDF file
 */
router.post(
  '/import/pdf',
  authenticateToken,
  requireRole(['sociologist-editor', 'admin']),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No PDF file provided',
        });
      }

      const {
        title,
        category,
        language,
        autoDetectQuestions = true,
        targetLanguage = 'both',
      } = req.body;

      if (!title || !category || !language) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, category, language',
        });
      }

      const result = await templateManager.importPDFToTemplate(
        req.file.buffer,
        {
          title: JSON.parse(title),
          category,
          language,
          creatorId: req.user.id,
        },
        {
          language: targetLanguage,
          autoDetectQuestions: Boolean(autoDetectQuestions),
        },
      );

      if (result.success) {
        res.json({
          success: true,
          data: result,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.errors,
        });
      }
    } catch (error) {
      console.error('Error importing PDF template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import PDF template',
      });
    }
  },
);

/**
 * POST /api/v1/templates/import/json
 * Import template from JSON export
 */
router.post(
  '/import/json',
  authenticateToken,
  requireRole(['sociologist-editor', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const { jsonData } = req.body;

      if (!jsonData) {
        return res.status(400).json({
          success: false,
          error: 'No JSON data provided',
        });
      }

      const result = await templateManager.importTemplateFromJSON(
        jsonData,
        req.user.id,
      );

      if (result.success) {
        res.json({
          success: true,
          data: result,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.errors,
        });
      }
    } catch (error) {
      console.error('Error importing JSON template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import JSON template',
      });
    }
  },
);

/**
 * POST /api/v1/templates/:templateId/create-questionnaire
 * Create questionnaire from template
 */
router.post(
  '/:templateId/create-questionnaire',
  authenticateToken,
  requireRole(['sociologist-editor', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;
      const { workshopId, title } = req.body;

      const questionnaire =
        await templateManager.createQuestionnaireFromTemplate(
          templateId,
          workshopId || null,
          title,
          req.user.id,
        );

      res.json({
        success: true,
        data: {
          questionnaire,
        },
      });
    } catch (error) {
      console.error('Error creating questionnaire from template:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create questionnaire',
      });
    }
  },
);

/**
 * GET /api/v1/templates/:templateId/export
 * Export template to JSON
 */
router.get('/:templateId/export', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const exportData = await templateManager.exportTemplate(templateId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${templateId}.json"`,
    );
    res.send(exportData);
  } catch (error) {
    console.error('Error exporting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export template',
    });
  }
});

/**
 * POST /api/v1/templates/:templateId/version
 * Create new version of template
 */
router.post(
  '/:templateId/version',
  authenticateToken,
  requireRole(['sociologist-editor', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;
      const { updatedTemplate, changes } = req.body;

      if (!updatedTemplate || !changes) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: updatedTemplate, changes',
        });
      }

      const newVersion = await templateManager.createTemplateVersion(
        templateId,
        updatedTemplate,
        changes,
        req.user.id,
      );

      res.json({
        success: true,
        data: {
          version: newVersion,
        },
      });
    } catch (error) {
      console.error('Error creating template version:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create template version',
      });
    }
  },
);

/**
 * POST /api/v1/templates/:templateId/rollback/:version
 * Rollback template to specific version
 */
router.post(
  '/:templateId/rollback/:version',
  authenticateToken,
  requireRole(['sociologist-editor', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const { templateId, version } = req.params;

      const rolledBackTemplate = await templateManager.rollbackTemplate(
        templateId,
        version,
        req.user.id,
      );

      res.json({
        success: true,
        data: {
          template: rolledBackTemplate,
        },
      });
    } catch (error) {
      console.error('Error rolling back template:', error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to rollback template',
      });
    }
  },
);

/**
 * GET /api/v1/templates/:templateId/validate
 * Validate template structure
 */
router.get('/:templateId/validate', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const validation = await templateManager.validateTemplateFile(templateId);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Error validating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate template',
    });
  }
});

/**
 * GET /api/v1/templates/:templateId/analytics
 * Get template usage analytics
 */
router.get('/:templateId/analytics', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const analytics =
      await templateManager.getTemplateUsageAnalytics(templateId);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Analytics not found for this template',
      });
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error getting template analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template analytics',
    });
  }
});

/**
 * DELETE /api/v1/templates/:templateId
 * Delete template (soft delete)
 */
router.delete(
  '/:templateId',
  authenticateToken,
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;
      const success = await templateManager.deleteTemplate(templateId);

      if (success) {
        res.json({
          success: true,
          message: 'Template deleted successfully',
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete template',
      });
    }
  },
);

/**
 * GET /api/v1/templates/predefined/nasza-nieutopia
 * Get the predefined NASZA (NIE)UTOPIA template
 */
router.get(
  '/predefined/nasza-nieutopia',
  async (req: Request, res: Response) => {
    try {
      const template =
        await templateManager.loadPredefinedTemplate('nasza_nieutopia_v1');

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'NASZA (NIE)UTOPIA template not found',
        });
      }

      // Get usage analytics
      const analytics =
        await templateManager.getTemplateUsageAnalytics('nasza_nieutopia_v1');

      res.json({
        success: true,
        data: {
          template,
          analytics,
        },
      });
    } catch (error) {
      console.error('Error getting NASZA (NIE)UTOPIA template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get NASZA (NIE)UTOPIA template',
      });
    }
  },
);

/**
 * POST /api/v1/templates/predefined/nasza-nieutopia/create
 * Create questionnaire from NASZA (NIE)UTOPIA template
 */
router.post(
  '/predefined/nasza-nieutopia/create',
  authenticateToken,
  requireRole(['sociologist-editor', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const { workshopId, title } = req.body;

      const questionnaire =
        await templateManager.createQuestionnaireFromTemplate(
          'nasza_nieutopia_v1',
          workshopId || null,
          title,
          req.user.id,
        );

      res.json({
        success: true,
        data: {
          questionnaire,
        },
      });
    } catch (error) {
      console.error(
        'Error creating questionnaire from NASZA (NIE)UTOPIA template:',
        error,
      );
      res.status(500).json({
        success: false,
        error: 'Failed to create questionnaire from NASZA (NIE)UTOPIA template',
      });
    }
  },
);

/**
 * Error handling middleware for file upload errors
 */
router.use((error: any, req: Request, res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 10MB',
      });
    }
  }

  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  next(error);
});

export default router;
