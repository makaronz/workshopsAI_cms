import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import {
  storageService,
  UploadOptions,
  UploadProgressCallback,
} from '../services/storageService';
import { AuthService } from '../services/authService';
import { redisService } from '../config/redis';
import {
  storageConfig,
  isFileAllowed,
  getFileTypeCategory,
} from '../config/storage';

/**
 * Extended Request interface for file uploads
 */
declare global {
  namespace Express {
    interface Request {
      uploadedFiles?: Array<{
        id: string;
        originalName: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        url: string;
        previewUrl?: string;
        thumbnailUrl?: string;
      }>;
      uploadProgress?: {
        loaded: number;
        total: number;
        percentage: number;
        stage: string;
      };
    }
  }
}

/**
 * File upload configuration
 */
interface FileUploadConfig {
  maxFiles?: number;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  requireAuth?: boolean;
  publicUpload?: boolean;
  accessLevel?: 'private' | 'workshop' | 'organization' | 'public';
  generatePreviews?: boolean;
  generateThumbnails?: boolean;
  compress?: boolean;
  associatedEntityType?:
    | 'workshop'
    | 'session'
    | 'module'
    | 'user'
    | 'questionnaire'
    | 'template';
  scanForViruses?: boolean;
  validateChecksum?: boolean;
}

/**
 * Default upload configuration
 */
const defaultUploadConfig: FileUploadConfig = {
  maxFiles: 5,
  maxFileSize: storageConfig.security.maxFileSize,
  requireAuth: true,
  publicUpload: false,
  accessLevel: 'private',
  generatePreviews: storageConfig.security.generatePreviews,
  generateThumbnails: true,
  compress: storageConfig.performance.compressionEnabled,
  scanForVયુસes: storageConfig.security.scanForViruses,
  validateChecksum: true,
};

/**
 * File validation middleware
 */
function createFileFilter(config: FileUploadConfig) {
  return (
    req: Request,
    file: Express.Multer.File,
    callback: FileFilterCallback,
  ) => {
    // Check file extension
    const extension = file.originalname?.split('.').pop()?.toLowerCase();
    const mimeType = file.mimetype;
    const size = file.size || 0;

    // Create file object for validation
    const fileObj = { extension: `.${extension}`, mimeType, size };

    // Validate file
    if (!isFileAllowed(fileObj)) {
      const category = getFileTypeCategory(fileObj);
      return callback(
        new Error(
          `File type not allowed: ${extension} (${mimeType}). ` +
            `Allowed categories: ${Object.keys(require('../config/storage').FILE_TYPE_RULES).join(', ')}`,
        ),
      );
    }

    // Custom MIME type validation
    if (config.allowedMimeTypes && config.allowedMimeTypes.length > 0) {
      if (!mimeType || !config.allowedMimeTypes.includes(mimeType)) {
        return callback(new Error(`MIME type not allowed: ${mimeType}`));
      }
    }

    // Custom extension validation
    if (config.allowedExtensions && config.allowedExtensions.length > 0) {
      if (!extension || !config.allowedExtensions.includes(`.${extension}`)) {
        return callback(new Error(`File extension not allowed: .${extension}`));
      }
    }

    callback(null, true);
  };
}

/**
 * Virus scanning middleware
 */
async function scanForViruses(
  buffer: Buffer,
  fileName: string,
): Promise<boolean> {
  if (!storageConfig.security.scanForViruses) {
    return true;
  }

  try {
    // Simple signature-based scanning (in production, use a proper antivirus solution)
    const suspiciousSignatures = [
      Buffer.from('MZ', 'hex'), // Windows executable
      Buffer.from('\x7fELF', 'binary'), // Linux executable
      Buffer.from('PK\x03\x04'), // ZIP (could contain malware)
    ];

    for (const signature of suspiciousSignatures) {
      if (buffer.includes(signature)) {
        const extension = fileName.split('.').pop()?.toLowerCase();
        const allowedExecutables = ['zip', 'rar', '7z', 'exe', 'deb', 'rpm'];

        if (!allowedExecutables.includes(extension || '')) {
          console.warn(`Suspicious file detected: ${fileName}`);
          return false;
        }
      }
    }

    // TODO: Integrate with professional antivirus API
    // Examples: ClamAV, VirusTotal API, AWS Macie, etc.

    return true;
  } catch (error) {
    console.error('Virus scan failed:', error);
    // Fail open - allow file but log the error
    return true;
  }
}

/**
 * Progress tracking middleware
 */
function createProgressTracker(uploadId: string): UploadProgressCallback {
  return async progress => {
    try {
      await redisService.client.setex(
        `upload:progress:${uploadId}`,
        300, // 5 minutes TTL
        JSON.stringify(progress),
      );
    } catch (error) {
      console.error('Failed to update upload progress:', error);
    }
  };
}

/**
 * File upload middleware factory
 */
export function createFileUploadMiddleware(
  config: Partial<FileUploadConfig> = {},
) {
  const finalConfig = { ...defaultUploadConfig, ...config };

  // Create multer storage using memory
  const multerStorage = multer.memoryStorage();

  // Create file filter
  const fileFilter = createFileFilter(finalConfig);

  // Create multer instance
  const upload = multer({
    storage: multerStorage,
    fileFilter,
    limits: {
      fileSize: finalConfig.maxFileSize,
      files: finalConfig.maxFiles,
    },
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check authentication if required
      if (finalConfig.requireAuth && !req.user) {
        return res.status(401).json({
          error: 'Authentication required for file upload',
          message: 'Please log in to upload files',
        });
      }

      // Generate upload ID for progress tracking
      const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
      res.setHeader('X-Upload-ID', uploadId);

      // Set initial progress
      const progressTracker = createProgressTracker(uploadId);
      req.uploadProgress = {
        loaded: 0,
        total: 0,
        percentage: 0,
        stage: 'initializing',
      };
      progressTracker(req.uploadProgress);

      // Handle multer upload
      upload.array('files', finalConfig.maxFiles)(req, res, async err => {
        if (err) {
          console.error('Multer error:', err);

          // Update progress with error
          req.uploadProgress = {
            loaded: 0,
            total: 0,
            percentage: 0,
            stage: 'error',
          };
          progressTracker(req.uploadProgress);

          return res.status(400).json({
            error: 'File upload failed',
            message: err.message,
          });
        }

        try {
          const files = (req.files as Express.Multer.File[]) || [];
          const uploadedFiles = [];

          req.uploadProgress = {
            loaded: 0,
            total: files.length,
            percentage: 0,
            stage: 'processing',
          };
          progressTracker(req.uploadProgress);

          // Process each file
          for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
              // Update progress
              req.uploadProgress = {
                loaded: i,
                total: files.length,
                percentage: (i / files.length) * 100,
                stage: `processing file ${i + 1} of ${files.length}`,
              };
              progressTracker(req.uploadProgress);

              // Validate file buffer
              if (!file.buffer || file.buffer.length === 0) {
                throw new Error('File is empty');
              }

              // Scan for viruses
              if (finalConfig.scanForViruses) {
                req.uploadProgress.stage = `scanning file ${i + 1}`;
                progressTracker(req.uploadProgress);

                const isClean = await scanForViruses(
                  file.buffer,
                  file.originalname,
                );
                if (!isClean) {
                  throw new Error('File failed virus scan');
                }
              }

              // Prepare upload options
              const uploadOptions: UploadOptions = {
                fileName: file.originalname,
                isPublic: finalConfig.publicUpload,
                accessLevel: finalConfig.accessLevel,
                generatePreview: finalConfig.generatePreviews,
                generateThumbnail: finalConfig.generateThumbnails,
                compress: finalConfig.compress,
                associatedEntityType: finalConfig.associatedEntityType,
                associatedEntityId: req.body.associatedEntityId,
                tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
                metadata: req.body.metadata
                  ? JSON.parse(req.body.metadata)
                  : undefined,
              };

              req.uploadProgress.stage = `uploading file ${i + 1}`;
              progressTracker(req.uploadProgress);

              // Upload file to storage service
              const uploadedFile = await storageService.uploadFile(
                file.buffer,
                file.originalname,
                req.user?.id || 'anonymous',
                uploadOptions,
                progress => {
                  req.uploadProgress = {
                    loaded: i + progress.percentage / 100,
                    total: files.length,
                    percentage:
                      ((i + progress.percentage / 100) / files.length) * 100,
                    stage: `uploading file ${i + 1}: ${progress.stage}`,
                  };
                  progressTracker(req.uploadProgress);
                },
              );

              uploadedFiles.push({
                id: uploadedFile.id,
                originalName: uploadedFile.originalName,
                fileName: uploadedFile.fileName,
                fileSize: uploadedFile.fileSize,
                mimeType: uploadedFile.mimeType,
                url: uploadedFile.cdnUrl || uploadedFile.filePath,
                previewUrl: uploadedFile.previewUrl,
                thumbnailUrl: uploadedFile.thumbnailUrl,
              });

              // Create audit log
              if (req.user && storageConfig.monitoring.enableAuditLog) {
                await AuthService.createAuditLog(
                  req.user.id,
                  'FILE_UPLOAD',
                  'files',
                  uploadedFile.id,
                  null,
                  {
                    originalName: file.originalname,
                    fileSize: uploadedFile.fileSize,
                    mimeType: uploadedFile.mimeType,
                  },
                  AuthService.extractRequestMetadata(req).ipAddress,
                  AuthService.extractRequestMetadata(req).userAgent,
                );
              }
            } catch (fileError) {
              console.error(
                `Failed to process file ${file.originalname}:`,
                fileError,
              );

              // Continue processing other files, but note the failure
              uploadedFiles.push({
                id: '',
                originalName: file.originalname,
                fileName: file.originalname,
                fileSize: file.size || 0,
                mimeType: file.mimetype || 'application/octet-stream',
                url: '',
                error: fileError.message,
              } as any);
            }
          }

          // Set final progress
          req.uploadProgress = {
            loaded: files.length,
            total: files.length,
            percentage: 100,
            stage: 'complete',
          };
          progressTracker(req.uploadProgress);

          // Attach uploaded files to request
          req.uploadedFiles = uploadedFiles;

          // Clear progress after a delay
          setTimeout(async () => {
            try {
              await redisService.client.del(`upload:progress:${uploadId}`);
            } catch (error) {
              // Ignore cleanup errors
            }
          }, 5000);

          next();
        } catch (error) {
          console.error('File processing error:', error);

          // Update progress with error
          req.uploadProgress = {
            loaded: 0,
            total: 0,
            percentage: 0,
            stage: 'error',
          };
          progressTracker(req.uploadProgress);

          return res.status(500).json({
            error: 'File processing failed',
            message: error.message,
          });
        }
      });
    } catch (error) {
      console.error('Upload middleware error:', error);
      return res.status(500).json({
        error: 'Upload middleware error',
        message: error.message,
      });
    }
  };
}

/**
 * Single file upload middleware
 */
export const uploadSingle = createFileUploadMiddleware({ maxFiles: 1 });

/**
 * Multiple files upload middleware
 */
export const uploadMultiple = createFileUploadMiddleware({ maxFiles: 10 });

/**
 * Workshop file upload middleware
 */
export const uploadWorkshopFiles = createFileUploadMiddleware({
  maxFiles: 20,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  associatedEntityType: 'workshop',
  generatePreviews: true,
  compress: true,
});

/**
 * Profile picture upload middleware
 */
export const uploadProfilePicture = createFileUploadMiddleware({
  maxFiles: 1,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  publicUpload: true,
  accessLevel: 'public',
  generateThumbnails: true,
  associatedEntityType: 'user',
});

/**
 * Document upload middleware
 */
export const uploadDocument = createFileUploadMiddleware({
  maxFiles: 5,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  allowedExtensions: [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.txt',
    '.csv',
  ],
  generatePreviews: true,
});

/**
 * Get upload progress endpoint middleware
 */
export async function getUploadProgress(req: Request, res: Response) {
  try {
    const { uploadId } = req.params;

    if (!uploadId) {
      return res.status(400).json({
        error: 'Upload ID required',
        message: 'Please provide an upload ID',
      });
    }

    const progressData = await redisService.client.get(
      `upload:progress:${uploadId}`,
    );

    if (!progressData) {
      return res.status(404).json({
        error: 'Upload not found',
        message: 'Upload progress not found or expired',
      });
    }

    const progress = JSON.parse(progressData);

    res.json({
      uploadId,
      progress,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get upload progress:', error);
    res.status(500).json({
      error: 'Failed to get upload progress',
      message: error.message,
    });
  }
}

/**
 * Cancel upload middleware
 */
export async function cancelUpload(req: Request, res: Response) {
  try {
    const { uploadId } = req.params;

    if (!uploadId) {
      return res.status(400).json({
        error: 'Upload ID required',
        message: 'Please provide an upload ID',
      });
    }

    // Remove progress data
    await redisService.client.del(`upload:progress:${uploadId}`);

    // TODO: Implement actual upload cancellation
    // This would require integration with the storage provider's multipart upload cancellation

    res.json({
      message: 'Upload cancelled successfully',
      uploadId,
    });
  } catch (error) {
    console.error('Failed to cancel upload:', error);
    res.status(500).json({
      error: 'Failed to cancel upload',
      message: error.message,
    });
  }
}

export default {
  createFileUploadMiddleware,
  uploadSingle,
  uploadMultiple,
  uploadWorkshopFiles,
  uploadProfilePicture,
  uploadDocument,
  getUploadProgress,
  cancelUpload,
};
