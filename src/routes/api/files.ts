import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { body, query, param, validationResult } from 'express-validator';
import { storageService } from '../../services/storageService';
import { AuthService, ROLE_PERMISSIONS } from '../../services/authService';
import { db } from '../../config/postgresql-database';
import {
  files,
  fileShares,
  fileAccessLogs,
  fileQuotas,
  enrollments,
} from '../../models/postgresql-schema';
import { eq, and, or, desc, sql, lt } from 'drizzle-orm';
import { fileOperationEnum } from '../../models/postgresql-schema';

const router = Router();

/**
 * Validation schemas
 */
const uploadFileSchema = z.object({
  associatedEntityType: z
    .enum([
      'workshop',
      'session',
      'module',
      'user',
      'questionnaire',
      'template',
      'none',
    ])
    .optional(),
  associatedEntityId: z.string().uuid().optional(),
  isPublic: z.boolean().default(false),
  accessLevel: z
    .enum(['private', 'workshop', 'organization', 'public'])
    .default('private'),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  generatePreview: z.boolean().default(true),
  generateThumbnail: z.boolean().default(true),
  compress: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
});

const shareFileSchema = z.object({
  permissions: z.array(z.enum(['view', 'download', 'comment', 'edit'])).min(1),
  shareType: z.enum(['link', 'email', 'embed']).default('link'),
  accessLevel: z
    .enum(['private', 'workshop', 'organization', 'public'])
    .default('private'),
  expiresAt: z.string().datetime().optional(),
  maxDownloads: z.number().positive().optional(),
  password: z.string().min(6).optional(),
  requiresLogin: z.boolean().default(false),
  allowedEmails: z.array(z.string().email()).optional(),
  blockedEmails: z.array(z.string().email()).optional(),
  metadata: z.record(z.any()).optional(),
});

const updateFileSchema = z.object({
  isPublic: z.boolean().optional(),
  accessLevel: z
    .enum(['private', 'workshop', 'organization', 'public'])
    .optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * Middleware to check file permissions
 */
async function checkFilePermission(
  req: Request,
  res: Response,
  next: Function,
) {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
      });
    }

    const metadata = await storageService.getFileMetadata(fileId);
    if (!metadata) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist',
      });
    }

    // Check if user has permission
    const hasPermission = await hasFileAccessPermission(
      metadata,
      userId,
      req.user.role,
    );
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You don\'t have permission to access this file',
      });
    }

    req.fileMetadata = metadata;
    next();
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({
      error: 'Permission check failed',
      message: error.message,
    });
  }
}

/**
 * Check if user has permission to access a file
 */
async function hasFileAccessPermission(
  fileMetadata: any,
  userId: string,
  userRole: string,
): Promise<boolean> {
  // Owner can always access
  if (fileMetadata.uploadedBy === userId) {
    return true;
  }

  // Public files can be accessed by anyone
  if (fileMetadata.isPublic || fileMetadata.accessLevel === 'public') {
    return true;
  }

  // Admin can access all files
  if (AuthService.hasPermission(userRole as any, '*')) {
    return true;
  }

  // Check workshop enrollment (if file is associated with a workshop)
  if (
    fileMetadata.associatedEntityType === 'workshop' &&
    fileMetadata.associatedEntityId
  ) {
    const enrollment = await db
      .select()
      .from(imports)
      .where(
        and(
          eq(enrollments.workshopId, fileMetadata.associatedEntityId),
          eq(enrollments.participantId, userId),
          eq(enrollments.status, 'confirmed'),
        ),
      )
      .limit(1);

    if (enrollment.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Log file access for audit trail
 */
async function logFileAccess(
  fileId: string,
  userId: string,
  operation:
    | 'CREATE'
    | 'READ'
    | 'UPDATE'
    | 'DELETE'
    | 'DOWNLOAD'
    | 'COPY'
    | 'MOVE',
  req: Request,
  success: boolean = true,
  errorMessage?: string,
  bytesTransferred?: number,
  duration?: number,
) {
  try {
    await db.insert(fileAccessLogs).values({
      fileId,
      userId,
      operation,
      ipAddress: AuthService.extractRequestMetadata(req).ipAddress,
      userAgent: AuthService.extractRequestMetadata(req).userAgent,
      referer: req.headers.referer,
      success,
      errorMessage,
      bytesTransferred: bytesTransferred?.toString(),
      duration: duration?.toString(),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to log file access:', error);
  }
}

/**
 * GET /api/v1/files
 * List files with filtering and pagination
 */
router.get(
  '/',
  [
    query('associatedEntityType')
      .optional()
      .isIn([
        'workshop',
        'session',
        'module',
        'user',
        'questionnaire',
        'template',
      ]),
    query('associatedEntityId').optional().isUUID(),
    query('tags')
      .optional()
      .custom(value => {
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      }),
    query('mimeType').optional().isString(),
    query('isPublic').optional().isBoolean(),
    query('accessLevel')
      .optional()
      .isIn(['private', 'workshop', 'organization', 'public']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('sortBy')
      .optional()
      .isIn(['uploadedAt', 'fileSize', 'downloadCount', 'originalName']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const {
        associatedEntityType,
        associatedEntityId,
        tags,
        mimeType,
        isPublic,
        accessLevel,
        limit = 20,
        offset = 0,
        sortBy = 'uploadedAt',
        sortOrder = 'desc',
      } = req.query;

      const filters: any = {};

      // Only show files user has access to
      if (!AuthService.hasPermission(req.user!.role as any, '*')) {
        filters.uploadedBy = req.user!.id;
      }

      if (associatedEntityType) {
        filters.associatedEntityType = associatedEntityType;
      }

      if (associatedEntityId) {
        filters.associatedEntityId = associatedEntityId;
      }

      if (tags) {
        filters.tags = JSON.parse(tags as string);
      }

      if (mimeType) {
        filters.mimeType = mimeType;
      }

      if (isPublic !== undefined) {
        filters.isPublic = isPublic === 'true';
      }

      if (accessLevel) {
        filters.accessLevel = accessLevel;
      }

      const result = await storageService.listFiles({
        ...filters,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
      });

      // Log access
      await logFileAccess('', req.user!.id, 'READ' as any, req, true);

      res.json({
        files: result.files,
        pagination: {
          total: result.total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore:
            result.total >
            parseInt(offset as string) + parseInt(limit as string),
        },
      });
    } catch (error) {
      console.error('Failed to list files:', error);
      res.status(500).json({
        error: 'Failed to list files',
        message: error.message,
      });
    }
  },
);

/**
 * GET /api/v1/files/:fileId
 * Get file metadata
 */
router.get(
  '/:fileId',
  checkFilePermission,
  async (req: Request, res: Response) => {
    try {
      const file = req.fileMetadata;

      // Log access
      await logFileAccess(file.id, req.user!.id, 'READ' as any, req, true);

      res.json({
        file,
      });
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      res.status(500).json({
        error: 'Failed to get file metadata',
        message: error.message,
      });
    }
  },
);

/**
 * GET /api/v1/files/:fileId/download
 * Get download URL for a file
 */
router.get(
  '/:fileId/download',
  checkFilePermission,
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const file = req.fileMetadata;
      const userId = req.user!.id;

      const downloadResult = await storageService.getDownloadUrl(
        file.id,
        userId,
      );

      if (!downloadResult) {
        return res.status(500).json({
          error: 'Failed to generate download URL',
          message: 'Unable to create secure download link',
        });
      }

      // Log successful download access
      const duration = Date.now() - startTime;
      await logFileAccess(
        file.id,
        userId,
        'DOWNLOAD' as any,
        req,
        true,
        undefined,
        undefined,
        duration,
      );

      res.json({
        downloadUrl: downloadResult.url,
        expiresIn: downloadResult.expiresIn,
        fileName: file.originalName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
      });
    } catch (error) {
      console.error('Failed to get download URL:', error);

      // Log failed download access
      const duration = Date.now() - startTime;
      await logFileAccess(
        req.fileMetadata!.id,
        req.user!.id,
        'DOWNLOAD' as any,
        req,
        false,
        error.message,
        undefined,
        duration,
      );

      res.status(500).json({
        error: 'Failed to get download URL',
        message: error.message,
      });
    }
  },
);

/**
 * POST /api/v1/files
 * Upload a new file (handled by middleware)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        message: 'Please upload at least one file',
      });
    }

    // Process upload options from request body
    const uploadOptions = uploadFileSchema.parse(req.body);

    // Apply upload options to uploaded files
    const processedFiles = [];
    for (const uploadedFile of req.uploadedFiles) {
      if (uploadedFile.error) {
        processedFiles.push({
          ...uploadedFile,
          success: false,
        });
        continue;
      }

      // Update file metadata with upload options
      const metadata = await storageService.getFileMetadata(uploadedFile.id);
      if (metadata) {
        await db
          .update(files)
          .set({
            associatedEntityType: uploadOptions.associatedEntityType,
            associatedEntityId: uploadOptions.associatedEntityId,
            isPublic: uploadOptions.isPublic,
            accessLevel: uploadOptions.accessLevel,
            tags: uploadOptions.tags,
            metadata: uploadOptions.metadata,
            expiresAt: uploadOptions.expiresAt
              ? new Date(uploadOptions.expiresAt)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(files.id, uploadedFile.id));
      }

      processedFiles.push({
        ...uploadedFile,
        success: true,
      });

      // Log file creation
      await logFileAccess(
        uploadedFile.id,
        req.user!.id,
        'CREATE' as any,
        req,
        true,
      );
    }

    res.json({
      message: 'Files uploaded successfully',
      files: processedFiles,
      uploadId: req.headers['x-upload-id'],
    });
  } catch (error) {
    console.error('File upload processing error:', error);
    res.status(500).json({
      error: 'Failed to process uploaded files',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/files/:fileId
 * Update file metadata
 */
router.put(
  '/:fileId',
  [
    body('isPublic').optional().isBoolean(),
    body('accessLevel')
      .optional()
      .isIn(['private', 'workshop', 'organization', 'public']),
    body('tags').optional().isArray(),
    body('metadata').optional().isObject(),
    body('expiresAt').optional().isISO8601().toDate(),
  ],
  checkFilePermission,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const file = req.fileMetadata;
      const userId = req.user!.id;

      // Only owner or admin can update
      if (
        file.uploadedBy !== userId &&
        !AuthService.hasPermission(req.user!.role as any, '*')
      ) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only file owner or admin can update file metadata',
        });
      }

      const updateData = updateFileSchema.parse(req.body);

      await db
        .update(files)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(files.id, file.id));

      // Get updated metadata
      const updatedFile = await storageService.getFileMetadata(file.id);

      // Log update
      await logFileAccess(file.id, userId, 'UPDATE' as any, req, true);

      res.json({
        message: 'File metadata updated successfully',
        file: updatedFile,
      });
    } catch (error) {
      console.error('Failed to update file metadata:', error);
      res.status(500).json({
        error: 'Failed to update file metadata',
        message: error.message,
      });
    }
  },
);

/**
 * DELETE /api/v1/files/:fileId
 * Delete a file
 */
router.delete(
  '/:fileId',
  checkFilePermission,
  async (req: Request, res: Response) => {
    try {
      const file = req.fileMetadata;
      const userId = req.user!.id;

      // Only owner or admin can delete
      if (
        file.uploadedBy !== userId &&
        !AuthService.hasPermission(req.user!.role as any, '*')
      ) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only file owner or admin can delete files',
        });
      }

      const success = await storageService.deleteFile(file.id, userId);

      if (!success) {
        return res.status(500).json({
          error: 'Failed to delete file',
          message: 'The file could not be deleted',
        });
      }

      // Log deletion
      await logFileAccess(file.id, userId, 'DELETE' as any, req, true);

      res.json({
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
      res.status(500).json({
        error: 'Failed to delete file',
        message: error.message,
      });
    }
  },
);

/**
 * POST /api/v1/files/:fileId/share
 * Create a share link for a file
 */
router.post(
  '/:fileId/share',
  [
    body('permissions').isArray({ min: 1 }),
    body('shareType').optional().isIn(['link', 'email', 'embed']),
    body('accessLevel')
      .optional()
      .isIn(['private', 'workshop', 'organization', 'public']),
    body('expiresAt').optional().isISO8601().toDate(),
    body('maxDownloads').optional().isInt({ min: 1 }),
    body('password').optional().isLength({ min: 6 }),
    body('requiresLogin').optional().isBoolean(),
    body('allowedEmails').optional().isArray(),
    body('blockedEmails').optional().isArray(),
  ],
  checkFilePermission,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const file = req.fileMetadata;
      const userId = req.user!.id;

      // Only owner or admin can share
      if (
        file.uploadedBy !== userId &&
        !AuthService.hasPermission(req.user!.role as any, '*')
      ) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only file owner or admin can share files',
        });
      }

      const shareData = shareFileSchema.parse(req.body);

      // Generate share token
      const shareToken = Buffer.from(
        `${file.id}-${Date.now()}-${Math.random()}`,
      ).toString('base64');

      // Create share record
      await db.insert(fileShares).values({
        fileId: file.id,
        sharedBy: userId,
        shareToken,
        shareType: shareData.shareType,
        permissions: shareData.permissions,
        accessLevel: shareData.accessLevel,
        expiresAt: shareData.expiresAt ? new Date(shareData.expiresAt) : null,
        maxDownloads: shareData.maxDownloads?.toString(),
        password: shareData.password,
        requiresLogin: shareData.requiresLogin,
        allowedEmails: shareData.allowedEmails,
        blockedEmails: shareData.blockedEmails,
        metadata: shareData.metadata,
      });

      const shareUrl = `${req.protocol}://${req.get('host')}/api/v1/files/shared/${shareToken}`;

      res.json({
        message: 'File shared successfully',
        shareUrl,
        shareToken,
        permissions: shareData.permissions,
        expiresAt: shareData.expiresAt,
        maxDownloads: shareData.maxDownloads,
      });
    } catch (error) {
      console.error('Failed to share file:', error);
      res.status(500).json({
        error: 'Failed to share file',
        message: error.message,
      });
    }
  },
);

/**
 * GET /api/v1/files/shared/:shareToken
 * Access a shared file
 */
router.get('/shared/:shareToken', async (req: Request, res: Response) => {
  try {
    const { shareToken } = req.params;

    const share = await db
      .select()
      .from(fileShares)
      .where(
        and(
          eq(fileShares.shareToken, shareToken),
          eq(fileShares.isActive, true),
        ),
      )
      .limit(1);

    if (!share[0]) {
      return res.status(404).json({
        error: 'Share not found',
        message: 'This share link is invalid or has been disabled',
      });
    }

    const shareRecord = share[0];

    // Check if share has expired
    if (shareRecord.expiresAt && new Date() > shareRecord.expiresAt) {
      return res.status(410).json({
        error: 'Share expired',
        message: 'This share link has expired',
      });
    }

    // Check download limit
    if (
      shareRecord.maxDownloads &&
      parseInt(shareRecord.downloadCount) >= parseInt(shareRecord.maxDownloads)
    ) {
      return res.status(410).json({
        error: 'Download limit exceeded',
        message: 'This file has reached its download limit',
      });
    }

    // Get file metadata
    const file = await storageService.getFileMetadata(shareRecord.fileId);
    if (!file) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The shared file does not exist',
      });
    }

    // Check password protection
    if (shareRecord.password) {
      const providedPassword = req.query.password as string;
      if (!providedPassword || providedPassword !== shareRecord.password) {
        return res.status(401).json({
          error: 'Password required',
          message: 'This file is password protected',
          requiresPassword: true,
        });
      }
    }

    // Update access count
    await db
      .update(fileShares)
      .set({
        downloadCount: (parseInt(shareRecord.downloadCount) + 1).toString(),
        lastAccessedAt: new Date(),
      })
      .where(eq(fileShares.id, shareRecord.id));

    // Generate download URL
    const downloadResult = await storageService.getDownloadUrl(
      file.id,
      req.user?.id || 'anonymous',
    );

    res.json({
      file: {
        id: file.id,
        originalName: file.originalName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        uploadedAt: file.uploadedAt,
      },
      downloadUrl: downloadResult?.url,
      permissions: shareRecord.permissions,
      shareInfo: {
        sharedBy: shareRecord.sharedBy,
        createdAt: shareRecord.createdAt,
        expiresAt: shareRecord.expiresAt,
        remainingDownloads: shareRecord.maxDownloads
          ? parseInt(shareRecord.maxDownloads) -
            parseInt(shareRecord.downloadCount) -
            1
          : null,
      },
    });
  } catch (error) {
    console.error('Failed to access shared file:', error);
    res.status(500).json({
      error: 'Failed to access shared file',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/files/:fileId/stats
 * Get file access statistics
 */
router.get(
  '/:fileId/stats',
  checkFilePermission,
  async (req: Request, res: Response) => {
    try {
      const file = req.fileMetadata;

      // Get access logs
      const accessLogs = await db
        .select()
        .from(fileAccessLogs)
        .where(eq(fileAccessLogs.fileId, file.id))
        .orderBy(desc(fileAccessLogs.timestamp))
        .limit(100);

      // Get share information
      const shares = await db
        .select()
        .from(fileShares)
        .where(eq(fileShares.fileId, file.id))
        .orderBy(desc(fileShares.createdAt));

      // Calculate statistics
      const stats = {
        totalDownloads: accessLogs.filter(log => log.operation === 'DOWNLOAD')
          .length,
        totalViews: accessLogs.filter(log => log.operation === 'READ').length,
        uniqueUsers: [
          ...new Set(accessLogs.map(log => log.userId).filter(Boolean)),
        ].length,
        totalBytesTransferred: accessLogs.reduce(
          (sum, log) => sum + parseInt(log.bytesTransferred || '0'),
          0,
        ),
        averageDownloadSize: 0,
        accessByDate: {} as Record<string, number>,
        accessByCountry: {} as Record<string, number>,
        topReferrers: [] as Array<{ url: string; count: number }>,
      };

      // Calculate average download size
      const downloadLogs = accessLogs.filter(
        log => log.operation === 'DOWNLOAD' && log.bytesTransferred,
      );
      if (downloadLogs.length > 0) {
        stats.averageDownloadSize =
          downloadLogs.reduce(
            (sum, log) => sum + parseInt(log.bytesTransferred),
            0,
          ) / downloadLogs.length;
      }

      // Group by date
      accessLogs.forEach(log => {
        const date = log.timestamp.toISOString().split('T')[0];
        stats.accessByDate[date] = (stats.accessByDate[date] || 0) + 1;
      });

      // TODO: Add country detection from IP addresses
      // TODO: Add referrer analysis

      res.json({
        file: {
          id: file.id,
          originalName: file.originalName,
          fileSize: file.fileSize,
          downloadCount: file.downloadCount,
        },
        stats,
        recentAccess: accessLogs.slice(0, 20),
        shares,
      });
    } catch (error) {
      console.error('Failed to get file stats:', error);
      res.status(500).json({
        error: 'Failed to get file statistics',
        message: error.message,
      });
    }
  },
);

export default router;
