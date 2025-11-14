import { Request, Response, Router } from 'express';
import { storageService } from '../../services/storageService';
import { redisService } from '../../config/redis';
import { storageConfig } from '../../config/storage';
import path from 'path';

const router = Router();

/**
 * GET /api/v1/files/signed/:token
 * Handle signed URL access for local storage
 */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        error: 'Token required',
        message: 'Please provide a valid signed URL token',
      });
    }

    // Get file path from Redis
    const filePath = await redisService.client.get(`file:${token}`);
    if (!filePath) {
      return res.status(404).json({
        error: 'Invalid or expired token',
        message: 'This signed URL has expired or is invalid',
      });
    }

    // Get file metadata to validate access
    const fileParts = filePath.split('/');
    const fileName = fileParts[fileParts.length - 1];

    // For now, we'll serve the file directly
    // In production, you might want to add additional security checks

    const localProvider = storageConfig.providers.find(p => p.name === 'local');
    if (!localProvider || !localProvider.enabled) {
      return res.status(404).json({
        error: 'Local storage not available',
        message: 'File cannot be served',
      });
    }

    const fullPath = path.join(localProvider.config.uploadDir!, filePath);

    // Check if file exists
    const fs = await import('fs/promises');
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist',
      });
    }

    // Get file stats for proper headers
    const stats = await fs.stat(fullPath);
    const fileExtension = path.extname(fileName).toLowerCase();

    // Set appropriate content type
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.zip': 'application/zip',
    };

    const contentType =
      contentTypes[fileExtension] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // 1 hour cache
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

    // Stream the file
    const fileStream = await import('fs').then(fs =>
      fs.createReadStream(fullPath),
    );
    fileStream.pipe(res);
  } catch (error) {
    console.error('Failed to serve file via signed URL:', error);
    res.status(500).json({
      error: 'Failed to serve file',
      message: error.message,
    });
  }
});

export default router;
