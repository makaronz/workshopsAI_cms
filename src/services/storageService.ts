import { Readable, PassThrough } from 'stream';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import {
  storageConfig,
  StorageProvider,
  StorageProviderConfig,
  getActiveStorageProviders,
  getDefaultStorageProvider,
} from '../config/storage';
import { redisService } from '../config/redis';
import { db } from '../config/postgresql-database';
import { files, fileVersions, auditLogs } from '../models/postgresql-schema';
import { eq, and, desc, lt, sql } from 'drizzle-orm';

/**
 * File metadata interface
 */
export interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  extension: string;
  category?: string;
  uploadedBy: string;
  associatedEntityType?:
    | 'workshop'
    | 'session'
    | 'module'
    | 'user'
    | 'questionnaire'
    | 'template';
  associatedEntityId?: string;
  isPublic: boolean;
  accessLevel: 'private' | 'workshop' | 'organization' | 'public';
  tags?: string[];
  metadata?: Record<string, any>;
  provider: string;
  bucket?: string;
  region?: string;
  cdnUrl?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  checksum?: string;
  uploadedAt: Date;
  lastAccessedAt?: Date;
  expiresAt?: Date;
  downloadCount: number;
}

/**
 * Upload options interface
 */
export interface UploadOptions {
  fileName?: string;
  path?: string;
  isPublic?: boolean;
  accessLevel?: 'private' | 'workshop' | 'organization' | 'public';
  tags?: string[];
  metadata?: Record<string, any>;
  generatePreview?: boolean;
  generateThumbnail?: boolean;
  compress?: boolean;
  associatedEntityType?:
    | 'workshop'
    | 'session'
    | 'module'
    | 'user'
    | 'questionnaire'
    | 'template';
  associatedEntityId?: string;
  expiresAt?: Date;
}

/**
 * Upload progress callback
 */
export type UploadProgressCallback = (progress: {
  loaded: number;
  total: number;
  percentage: number;
  stage: string;
}) => void;

/**
 * Storage provider interface
 */
export interface IStorageProvider {
  name: string;
  upload(
    stream: Readable,
    key: string,
    metadata?: Record<string, any>,
    progressCallback?: UploadProgressCallback,
  ): Promise<{ url: string; key: string; metadata?: Record<string, any> }>;
  download(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): Promise<string>;
  listFiles(
    prefix?: string,
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>>;
  copy(
    sourceKey: string,
    destinationKey: string,
  ): Promise<{ url: string; key: string }>;
  move(
    sourceKey: string,
    destinationKey: string,
  ): Promise<{ url: string; key: string }>;
}

/**
 * AWS S3 Storage Provider
 */
class AWSStorageProvider implements IStorageProvider {
  name = 'aws-s3';
  private s3: any = null;

  constructor(private config: StorageProviderConfig) {
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      // Lazy import to avoid dependency if not used
      const {
        S3Client,
        PutObjectCommand,
        GetObjectCommand,
        DeleteObjectCommand,
      } = await import('@aws-sdk/client-s3');

      this.s3 = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId!,
          secretAccessKey: this.config.secretAccessKey!,
        },
        endpoint: this.config.endpoint,
        forcePathStyle: this.config.forcePathStyle,
      });
    } catch (error) {
      console.error('Failed to initialize AWS S3 client:', error);
    }
  }

  async upload(
    stream: Readable,
    key: string,
    metadata?: Record<string, any>,
    progressCallback?: UploadProgressCallback,
  ): Promise<{ url: string; key: string; metadata?: Record<string, any> }> {
    const chunks: Buffer[] = [];
    let loaded = 0;

    const transformStream = new PassThrough({
      transform(chunk: Buffer, encoding, callback) {
        chunks.push(chunk);
        loaded += chunk.length;
        if (progressCallback && stream.readableLength) {
          progressCallback({
            loaded,
            total: stream.readableLength || loaded,
            percentage: stream.readableLength
              ? (loaded / stream.readableLength) * 100
              : 0,
            stage: 'uploading',
          });
        }
        callback(null, chunk);
      },
    });

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new PutObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
      Body: stream.pipe(transformStream),
      ContentType: metadata?.contentType,
      Metadata: metadata,
    });

    try {
      await this.s3.send(command);
      return {
        url: await this.getPublicUrl(key),
        key,
        metadata,
      };
    } catch (error) {
      console.error('AWS S3 upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async download(key: string): Promise<Readable> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new GetObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
    });

    try {
      const response = await this.s3.send(command);
      return response.Body as Readable;
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
    });

    try {
      await this.s3.send(command);
    } catch (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new HeadObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
    });

    try {
      await this.s3.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new GetObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
    });

    try {
      return await getSignedUrl(this.s3, command, { expiresIn });
    } catch (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  async getPublicUrl(key: string): Promise<string> {
    const endpoint =
      this.config.endpoint || `https://s3.${this.config.region}.amazonaws.com`;
    return `${endpoint}/${this.config.bucket}/${key}`;
  }

  async listFiles(
    prefix?: string,
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const command = new ListObjectsV2Command({
      Bucket: this.config.bucket!,
      Prefix: prefix,
    });

    try {
      const response = await this.s3.send(command);
      return (response.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));
    } catch (error) {
      throw new Error(`List files failed: ${error.message}`);
    }
  }

  async copy(
    sourceKey: string,
    destinationKey: string,
  ): Promise<{ url: string; key: string }> {
    const { CopyObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new CopyObjectCommand({
      Bucket: this.config.bucket!,
      CopySource: `${this.config.bucket}/${sourceKey}`,
      Key: destinationKey,
    });

    try {
      await this.s3.send(command);
      return {
        url: await this.getPublicUrl(destinationKey),
        key: destinationKey,
      };
    } catch (error) {
      throw new Error(`Copy failed: ${error.message}`);
    }
  }

  async move(
    sourceKey: string,
    destinationKey: string,
  ): Promise<{ url: string; key: string }> {
    await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
    return {
      url: await this.getPublicUrl(destinationKey),
      key: destinationKey,
    };
  }
}

/**
 * Local File System Storage Provider
 */
class LocalStorageProvider implements IStorageProvider {
  name = 'local';
  private fs: any = null;
  private path: any = null;

  constructor(private config: StorageProviderConfig) {
    this.initializeDependencies();
  }

  private async initializeDependencies() {
    try {
      this.fs = await import('fs/promises');
      this.path = await import('path');

      // Ensure upload directory exists
      await this.fs.mkdir(this.config.uploadDir!, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize local storage:', error);
    }
  }

  async upload(
    stream: Readable,
    key: string,
    metadata?: Record<string, any>,
    progressCallback?: UploadProgressCallback,
  ): Promise<{ url: string; key: string; metadata?: Record<string, any> }> {
    const fullPath = this.path.join(this.config.uploadDir!, key);
    const directory = this.path.dirname(fullPath);

    // Create directory if it doesn't exist
    await this.fs.mkdir(directory, { recursive: true });

    const writeStream = this.fs.createWriteStream(fullPath);
    let loaded = 0;

    stream.on('data', (chunk: Buffer) => {
      loaded += chunk.length;
      if (progressCallback) {
        progressCallback({
          loaded,
          total: loaded, // We don't know total length for streams
          percentage: 100,
          stage: 'uploading',
        });
      }
    });

    return new Promise((resolve, reject) => {
      stream.pipe(writeStream);

      writeStream.on('finish', async () => {
        try {
          const url = await this.getPublicUrl(key);
          resolve({
            url,
            key,
            metadata,
          });
        } catch (error) {
          reject(error);
        }
      });

      writeStream.on('error', reject);
    });
  }

  async download(key: string): Promise<Readable> {
    const fullPath = this.path.join(this.config.uploadDir!, key);
    return this.fs.createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.path.join(this.config.uploadDir!, key);
    await this.fs.unlink(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullPath = this.path.join(this.config.uploadDir!, key);
      await this.fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, we'll create a temporary signed URL using Redis
    const token = randomUUID();
    await redisService.client.setex(`file:${token}`, expiresIn, key);
    return `${this.config.publicUrl}/signed/${token}`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `${this.config.publicUrl}/${key}`;
  }

  async listFiles(
    prefix?: string,
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    const files: Array<{ key: string; size: number; lastModified: Date }> = [];
    const searchDir = prefix
      ? this.path.join(this.config.uploadDir!, prefix)
      : this.config.uploadDir!;

    const scanDirectory = async (
      dir: string,
      baseKey: string = '',
    ): Promise<void> => {
      const entries = await this.fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = this.path.join(dir, entry.name);
        const relativeKey = this.path.join(baseKey, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath, relativeKey);
        } else {
          const stats = await this.fs.stat(fullPath);
          files.push({
            key: relativeKey.replace(/\\/g, '/'), // Normalize path separators
            size: stats.size,
            lastModified: stats.mtime,
          });
        }
      }
    };

    await scanDirectory(searchDir);
    return files;
  }

  async copy(
    sourceKey: string,
    destinationKey: string,
  ): Promise<{ url: string; key: string }> {
    const sourcePath = this.path.join(this.config.uploadDir!, sourceKey);
    const destinationPath = this.path.join(
      this.config.uploadDir!,
      destinationKey,
    );

    await this.fs.mkdir(this.path.dirname(destinationPath), {
      recursive: true,
    });
    await this.fs.copyFile(sourcePath, destinationPath);

    return {
      url: await this.getPublicUrl(destinationKey),
      key: destinationKey,
    };
  }

  async move(
    sourceKey: string,
    destinationKey: string,
  ): Promise<{ url: string; key: string }> {
    await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
    return {
      url: await this.getPublicUrl(destinationKey),
      key: destinationKey,
    };
  }
}

/**
 * Main Storage Service
 */
export class StorageService {
  private providers: Map<string, IStorageProvider> = new Map();
  private defaultProvider: IStorageProvider | null = null;

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders() {
    const activeProviders = getActiveStorageProviders();

    for (const providerConfig of activeProviders) {
      try {
        let provider: IStorageProvider;

        switch (providerConfig.name) {
        case 'aws-s3':
          provider = new AWSStorageProvider(providerConfig.config);
          break;
        case 'local':
          provider = new LocalStorageProvider(providerConfig.config);
          break;
        case 'google-cloud':
          // TODO: Implement Google Cloud Storage provider
          console.warn('Google Cloud Storage provider not yet implemented');
          continue;
        case 'azure-blob':
          // TODO: Implement Azure Blob Storage provider
          console.warn('Azure Blob Storage provider not yet implemented');
          continue;
        default:
          console.warn(`Unknown storage provider: ${providerConfig.name}`);
          continue;
        }

        this.providers.set(providerConfig.name, provider);

        if (providerConfig.name === storageConfig.defaultProvider) {
          this.defaultProvider = provider;
        }
      } catch (error) {
        console.error(
          `Failed to initialize storage provider ${providerConfig.name}:`,
          error,
        );
      }
    }

    if (this.providers.size === 0) {
      console.error('No storage providers are available');
    }
  }

  /**
   * Get a storage provider by name
   */
  getProvider(name?: string): IStorageProvider {
    const providerName = name || storageConfig.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Storage provider '${providerName}' not available`);
    }

    return provider;
  }

  /**
   * Upload a file with validation and processing
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    uploadedBy: string,
    options: UploadOptions = {},
    progressCallback?: UploadProgressCallback,
  ): Promise<FileMetadata> {
    progressCallback?.({
      loaded: 0,
      total: buffer.length,
      percentage: 0,
      stage: 'validating',
    });

    // Detect file type
    const fileType = await fileTypeFromBuffer(buffer);
    const extension =
      options.fileName?.split('.').pop()?.toLowerCase() ||
      fileType?.ext ||
      originalName.split('.').pop()?.toLowerCase() ||
      'bin';
    const mimeType = fileType?.mime || 'application/octet-stream';
    const fileSize = buffer.length;

    // Validate file
    if (!this.validateFile({ extension, mimeType, size: fileSize })) {
      throw new Error(
        `File type or size not allowed: ${extension} (${mimeType}, ${fileSize} bytes)`,
      );
    }

    progressCallback?.({
      loaded: 0,
      total: buffer.length,
      percentage: 10,
      stage: 'processing',
    });

    // Generate file metadata
    const fileId = randomUUID();
    const fileName =
      options.fileName || this.generateFileName(originalName, extension);
    const filePath = this.generateFilePath(
      uploadedBy,
      fileName,
      options.associatedEntityType,
    );

    // Process file (compress, generate previews, etc.)
    let processedBuffer = buffer;
    let previewBuffer: Buffer | null = null;
    let thumbnailBuffer: Buffer | null = null;

    if (options.compress !== false && this.shouldCompress(mimeType)) {
      processedBuffer = await this.compressFile(buffer, mimeType);
    }

    if (
      options.generatePreview !== false &&
      this.shouldGeneratePreview(mimeType)
    ) {
      previewBuffer = await this.generatePreview(buffer, mimeType);
      thumbnailBuffer = await this.generateThumbnail(buffer, mimeType);
    }

    progressCallback?.({
      loaded: 0,
      total: processedBuffer.length,
      percentage: 30,
      stage: 'uploading',
    });

    // Get storage provider and upload
    const provider = this.getProvider();
    const uploadStream = Readable.from([processedBuffer]);

    const uploadResult = await provider.upload(
      uploadStream,
      filePath,
      {
        contentType: mimeType,
        originalName,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
      },
      progress => {
        progressCallback?.({
          ...progress,
          percentage: 30 + progress.percentage * 0.5,
        });
      },
    );

    // Upload previews if generated
    let previewUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    if (previewBuffer) {
      const previewPath = this.generatePreviewPath(filePath);
      await provider.upload(Readable.from([previewBuffer]), previewPath, {
        contentType: mimeType,
        originalName: `preview_${originalName}`,
      });
      previewUrl = uploadResult.url.replace(fileName, `preview_${fileName}`);
    }

    if (thumbnailBuffer) {
      const thumbnailPath = this.generateThumbnailPath(filePath);
      await provider.upload(Readable.from([thumbnailBuffer]), thumbnailPath, {
        contentType: 'image/jpeg',
        originalName: `thumb_${originalName}`,
      });
      thumbnailUrl = uploadResult.url.replace(fileName, `thumb_${fileName}`);
    }

    progressCallback?.({
      loaded: processedBuffer.length,
      total: processedBuffer.length,
      percentage: 90,
      stage: 'saving_metadata',
    });

    // Save metadata to database
    const fileMetadata: FileMetadata = {
      id: fileId,
      originalName,
      fileName,
      filePath,
      fileSize: processedBuffer.length,
      mimeType,
      extension,
      uploadedBy,
      associatedEntityType: options.associatedEntityType,
      associatedEntityId: options.associatedEntityId,
      isPublic: options.isPublic ?? false,
      accessLevel: options.accessLevel ?? 'private',
      tags: options.tags,
      metadata: options.metadata,
      provider: provider.name,
      bucket: (provider as AWSStorageProvider).config?.bucket,
      region: (provider as AWSStorageProvider).config?.region,
      cdnUrl: uploadResult.url,
      previewUrl,
      thumbnailUrl,
      checksum: this.calculateChecksum(processedBuffer),
      uploadedAt: new Date(),
      downloadCount: 0,
    };

    await this.saveFileMetadata(fileMetadata);

    progressCallback?.({
      loaded: processedBuffer.length,
      total: processedBuffer.length,
      percentage: 100,
      stage: 'complete',
    });

    return fileMetadata;
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    try {
      const result = await db
        .select()
        .from(files)
        .where(and(eq(files.id, fileId), eq(files.deletedAt, null as any)))
        .limit(1);

      if (!result[0]) {
        return null;
      }

      // Convert string fields back to numbers
      const file = result[0];
      return {
        ...file,
        fileSize: parseInt(file.fileSize) || 0,
        downloadCount: parseInt(file.downloadCount) || 0,
      };
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return null;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string, deletedBy: string): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) {
        return false;
      }

      const provider = this.getProvider(metadata.provider);

      // Delete main file
      await provider.delete(metadata.filePath);

      // Delete preview and thumbnail if they exist
      if (metadata.previewUrl) {
        const previewPath = this.generatePreviewPath(metadata.filePath);
        await provider.delete(previewPath).catch(() => {}); // Ignore errors
      }

      if (metadata.thumbnailUrl) {
        const thumbnailPath = this.generateThumbnailPath(metadata.filePath);
        await provider.delete(thumbnailPath).catch(() => {}); // Ignore errors
      }

      // Mark as deleted in database (soft delete)
      await db
        .update(files)
        .set({
          deletedAt: new Date(),
          deletedBy,
          updatedAt: new Date(),
        })
        .where(eq(files.id, fileId));

      // Create audit log
      await this.createAuditLog(deletedBy, 'DELETE', 'files', fileId, null, {
        fileName: metadata.fileName,
      });

      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Get download URL for a file
   */
  async getDownloadUrl(
    fileId: string,
    userId: string,
  ): Promise<{ url: string; expiresIn: number } | null> {
    try {
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) {
        return null;
      }

      // Check access permissions
      if (!(await this.hasDownloadPermission(metadata, userId))) {
        throw new Error('Access denied');
      }

      const provider = this.getProvider(metadata.provider);
      const signedUrl = await provider.getSignedUrl(metadata.filePath);

      // Update download count and last accessed
      await db
        .update(files)
        .set({
          downloadCount: metadata.downloadCount + 1,
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(files.id, fileId));

      // Create audit log
      await this.createAuditLog(userId, 'DOWNLOAD', 'files', fileId, null, {
        fileName: metadata.fileName,
      });

      return {
        url: signedUrl,
        expiresIn: 3600, // 1 hour
      };
    } catch (error) {
      console.error('Failed to get download URL:', error);
      return null;
    }
  }

  /**
   * List files with filtering and pagination
   */
  async listFiles(
    options: {
      userId?: string;
      associatedEntityType?: string;
      associatedEntityId?: string;
      tags?: string[];
      mimeType?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'uploadedAt' | 'fileSize' | 'downloadCount';
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<{ files: FileMetadata[]; total: number }> {
    try {
      let query = db
        .select()
        .from(files)
        .where(eq(files.deletedAt, null as any));

      // Apply filters
      if (options.userId) {
        query = query.where(eq(files.uploadedBy, options.userId));
      }

      if (options.associatedEntityType) {
        query = query.where(
          eq(files.associatedEntityType, options.associatedEntityType as any),
        );
      }

      if (options.associatedEntityId) {
        query = query.where(
          eq(files.associatedEntityId, options.associatedEntityId),
        );
      }

      if (options.mimeType) {
        query = query.where(eq(files.mimeType, options.mimeType));
      }

      if (options.tags && options.tags.length > 0) {
        query = query.where(sql`${files.tags} && ${options.tags}`);
      }

      // Apply sorting
      const sortBy = options.sortBy || 'uploadedAt';
      const sortOrder = options.sortOrder || 'desc';

      if (sortOrder === 'desc') {
        query = query.orderBy(desc(files[sortBy as keyof typeof files]));
      } else {
        query = query.orderBy(files[sortBy as keyof typeof files]);
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.offset(options.offset);
      }

      const filesList = await query;

      return {
        files: filesList,
        total: filesList.length,
      };
    } catch (error) {
      console.error('Failed to list files:', error);
      return { files: [], total: 0 };
    }
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles(): Promise<number> {
    try {
      if (!storageConfig.retention.autoCleanup) {
        return 0;
      }

      const expiredFiles = await db
        .select()
        .from(files)
        .where(
          and(
            eq(files.deletedAt, null as any),
            lt(files.expiresAt, new Date()),
          ),
        );

      let deletedCount = 0;

      for (const file of expiredFiles) {
        if (await this.deleteFile(file.id, 'system')) {
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup expired files:', error);
      return 0;
    }
  }

  /**
   * Private helper methods
   */
  private validateFile(file: {
    extension: string;
    mimeType: string;
    size: number;
  }): boolean {
    // Check against security rules
    if (file.size > storageConfig.security.maxFileSize) {
      return false;
    }

    // Check MIME type restrictions
    if (storageConfig.security.allowedMimeTypes.length > 0) {
      if (!storageConfig.security.allowedMimeTypes.includes(file.mimeType)) {
        return false;
      }
    }

    // Check extension restrictions
    if (storageConfig.security.allowedExtensions.length > 0) {
      if (
        !storageConfig.security.allowedExtensions.includes(`.${file.extension}`)
      ) {
        return false;
      }
    }

    return true;
  }

  private generateFileName(originalName: string, extension: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExt}_${timestamp}_${random}.${extension}`;
  }

  private generateFilePath(
    userId: string,
    fileName: string,
    entityType?: string,
  ): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');

    if (entityType) {
      return `${entityType}/${userId}/${year}/${month}/${day}/${fileName}`;
    }

    return `${userId}/${year}/${month}/${day}/${fileName}`;
  }

  private generatePreviewPath(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    const nameWithoutExt = filePath.substring(0, lastDotIndex);
    const extension = filePath.substring(lastDotIndex + 1);
    return `${nameWithoutExt}_preview.${extension}`;
  }

  private generateThumbnailPath(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    const nameWithoutExt = filePath.substring(0, lastDotIndex);
    return `${nameWithoutExt}_thumb.jpg`;
  }

  private shouldCompress(mimeType: string): boolean {
    if (!storageConfig.performance.compressionEnabled) {
      return false;
    }

    const compressibleTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/json',
      'text/csv',
    ];

    return compressibleTypes.includes(mimeType);
  }

  private shouldGeneratePreview(mimeType: string): boolean {
    if (!storageConfig.security.generatePreviews) {
      return false;
    }

    const previewableTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/webm',
    ];

    return previewableTypes.includes(mimeType);
  }

  private async compressFile(
    buffer: Buffer,
    mimeType: string,
  ): Promise<Buffer> {
    if (mimeType.startsWith('image/')) {
      return await this.compressImage(buffer, mimeType);
    }

    return buffer;
  }

  private async compressImage(
    buffer: Buffer,
    mimeType: string,
  ): Promise<Buffer> {
    try {
      let sharpInstance = sharp(buffer);

      // JPEG optimization
      if (mimeType === 'image/jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: true });
      }
      // PNG optimization
      else if (mimeType === 'image/png') {
        sharpInstance = sharpInstance.png({
          compressionLevel: 9,
          progressive: true,
        });
      }
      // WebP optimization
      else if (mimeType === 'image/webp') {
        sharpInstance = sharpInstance.webp({ quality: 85 });
      }

      return await sharpInstance.toBuffer();
    } catch (error) {
      console.error('Failed to compress image:', error);
      return buffer;
    }
  }

  private async generatePreview(
    buffer: Buffer,
    mimeType: string,
  ): Promise<Buffer | null> {
    try {
      if (mimeType.startsWith('image/')) {
        // For images, create a smaller version
        return await sharp(buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
      }

      // TODO: Add preview generation for PDFs and videos
      return null;
    } catch (error) {
      console.error('Failed to generate preview:', error);
      return null;
    }
  }

  private async generateThumbnail(
    buffer: Buffer,
    mimeType: string,
  ): Promise<Buffer | null> {
    try {
      if (mimeType.startsWith('image/')) {
        return await sharp(buffer)
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 75 })
          .toBuffer();
      }

      // TODO: Add thumbnail generation for PDFs and videos
      return null;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return null;
    }
  }

  private calculateChecksum(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async saveFileMetadata(metadata: FileMetadata): Promise<void> {
    await db.insert(files).values({
      id: metadata.id,
      originalName: metadata.originalName,
      fileName: metadata.fileName,
      filePath: metadata.filePath,
      fileSize: metadata.fileSize.toString(),
      mimeType: metadata.mimeType,
      extension: metadata.extension,
      category: metadata.category,
      uploadedBy: metadata.uploadedBy,
      associatedEntityType: metadata.associatedEntityType || 'none',
      associatedEntityId: metadata.associatedEntityId,
      isPublic: metadata.isPublic,
      accessLevel: metadata.accessLevel,
      tags: metadata.tags,
      metadata: metadata.metadata,
      provider: metadata.provider,
      bucket: metadata.bucket,
      region: metadata.region,
      cdnUrl: metadata.cdnUrl,
      previewUrl: metadata.previewUrl,
      thumbnailUrl: metadata.thumbnailUrl,
      checksum: metadata.checksum,
      status: 'completed',
      uploadedAt: metadata.uploadedAt,
      lastAccessedAt: metadata.lastAccessedAt,
      expiresAt: metadata.expiresAt,
      downloadCount: metadata.downloadCount.toString(),
      updatedAt: new Date(),
    });
  }

  private async hasDownloadPermission(
    metadata: FileMetadata,
    userId: string,
  ): Promise<boolean> {
    // Owner can always download
    if (metadata.uploadedBy === userId) {
      return true;
    }

    // Public files can be downloaded by anyone
    if (metadata.isPublic || metadata.accessLevel === 'public') {
      return true;
    }

    // TODO: Add more sophisticated permission checks based on workshop enrollment, etc.

    return false;
  }

  private async createAuditLog(
    userId: string,
    operation: string,
    tableName: string,
    recordId: string,
    oldValues: any = null,
    newValues: any = null,
  ): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId,
        operation,
        tableName,
        recordId,
        oldValues,
        newValues,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}

// Singleton instance
export const storageService = new StorageService();

export default storageService;
