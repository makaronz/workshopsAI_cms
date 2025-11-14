import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Storage configuration for multiple cloud providers
 */
export interface StorageProvider {
  name: 'aws-s3' | 'google-cloud' | 'azure-blob' | 'local';
  enabled: boolean;
  config: StorageProviderConfig;
}

export interface StorageProviderConfig {
  // AWS S3 Configuration
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucket?: string;

  // Google Cloud Storage Configuration
  projectId?: string;
  keyFilename?: string;
  bucketName?: string;

  // Azure Blob Storage Configuration
  accountName?: string;
  accountKey?: string;
  containerName?: string;

  // Common Configuration
  endpoint?: string;
  forcePathStyle?: boolean;
  signatureVersion?: string;

  // Local Development
  uploadDir?: string;
  publicUrl?: string;
}

export interface StorageConfig {
  defaultProvider: StorageProvider['name'];
  providers: StorageProvider[];
  security: {
    maxFileSize: number; // bytes
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    scanForViruses: boolean;
    generatePreviews: boolean;
  };
  performance: {
    multipartThreshold: number; // bytes
    maxConcurrentUploads: number;
    compressionEnabled: boolean;
    cdnEnabled: boolean;
  };
  retention: {
    autoCleanup: boolean;
    retentionDays: number;
    archiveAfterDays: number;
  };
  monitoring: {
    enableMetrics: boolean;
    enableAuditLog: boolean;
    errorWebhook?: string;
  };
}

/**
 * Default storage configuration
 */
export const storageConfig: StorageConfig = {
  defaultProvider:
    (process.env['STORAGE_DEFAULT_PROVIDER'] as StorageProvider['name']) ||
    'aws-s3',

  providers: [
    {
      name: 'aws-s3',
      enabled: process.env['AWS_S3_ENABLED'] === 'true',
      config: {
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
        region: process.env['AWS_REGION'] || 'us-east-1',
        bucket: process.env['AWS_S3_BUCKET'],
        endpoint: process.env['AWS_S3_ENDPOINT'],
        forcePathStyle: process.env['AWS_S3_FORCE_PATH_STYLE'] === 'true',
        signatureVersion: process.env['AWS_S3_SIGNATURE_VERSION'] || 'v4',
      },
    },
    {
      name: 'google-cloud',
      enabled: process.env['GCS_ENABLED'] === 'true',
      config: {
        projectId: process.env['GCS_PROJECT_ID'],
        keyFilename: process.env['GCS_KEY_FILENAME'],
        bucketName: process.env['GCS_BUCKET_NAME'],
      },
    },
    {
      name: 'azure-blob',
      enabled: process.env['AZURE_BLOB_ENABLED'] === 'true',
      config: {
        accountName: process.env['AZURE_ACCOUNT_NAME'],
        accountKey: process.env['AZURE_ACCOUNT_KEY'],
        containerName: process.env['AZURE_CONTAINER_NAME'],
      },
    },
    {
      name: 'local',
      enabled: process.env['STORAGE_LOCAL_ENABLED'] !== 'false',
      config: {
        uploadDir: process.env['STORAGE_LOCAL_UPLOAD_DIR'] || './uploads',
        publicUrl:
          process.env['STORAGE_LOCAL_PUBLIC_URL'] ||
          'http://localhost:3001/uploads',
      },
    },
  ],

  security: {
    maxFileSize: parseInt(process.env['STORAGE_MAX_FILE_SIZE'] || '524288000'), // 500MB
    allowedMimeTypes: (process.env['STORAGE_ALLOWED_MIME_TYPES'] || '')
      .split(',')
      .filter(Boolean),
    allowedExtensions: (process.env['STORAGE_ALLOWED_EXTENSIONS'] || '')
      .split(',')
      .filter(Boolean),
    scanForViruses: process.env['STORAGE_VIRUS_SCAN'] !== 'false',
    generatePreviews: process.env['STORAGE_GENERATE_PREVIEWS'] !== 'false',
  },

  performance: {
    multipartThreshold: parseInt(
      process.env['STORAGE_MULTIPART_THRESHOLD'] || '104857600',
    ), // 100MB
    maxConcurrentUploads: parseInt(
      process.env['STORAGE_MAX_CONCURRENT_UPLOADS'] || '3',
    ),
    compressionEnabled: process.env['STORAGE_COMPRESSION_ENABLED'] !== 'false',
    cdnEnabled: process.env['STORAGE_CDN_ENABLED'] === 'true',
  },

  retention: {
    autoCleanup: process.env['STORAGE_AUTO_CLEANUP'] !== 'false',
    retentionDays: parseInt(process.env['STORAGE_RETENTION_DAYS'] || '365'), // 1 year
    archiveAfterDays: parseInt(
      process.env['STORAGE_ARCHIVE_AFTER_DAYS'] || '90',
    ), // 90 days
  },

  monitoring: {
    enableMetrics: process.env['STORAGE_ENABLE_METRICS'] !== 'false',
    enableAuditLog: process.env['STORAGE_ENABLE_AUDIT_LOG'] !== 'false',
    errorWebhook: process.env['STORAGE_ERROR_WEBHOOK'],
  },
};

/**
 * Get active storage provider
 */
export function getActiveStorageProviders(): StorageProvider[] {
  return storageConfig.providers.filter(provider => provider.enabled);
}

/**
 * Get default storage provider configuration
 */
export function getDefaultStorageProvider(): StorageProvider | null {
  const defaultProvider = storageConfig.providers.find(
    provider =>
      provider.name === storageConfig.defaultProvider && provider.enabled,
  );
  return defaultProvider || null;
}

/**
 * Get storage provider by name
 */
export function getStorageProviderByName(
  name: StorageProvider['name'],
): StorageProvider | null {
  return (
    storageConfig.providers.find(
      provider => provider.name === name && provider.enabled,
    ) || null
  );
}

/**
 * Validate storage configuration
 */
export function validateStorageConfig(): {
  isValid: boolean;
  errors: string[];
  } {
  const errors: string[] = [];

  // Check if at least one provider is enabled
  const activeProviders = getActiveStorageProviders();
  if (activeProviders.length === 0) {
    errors.push('At least one storage provider must be enabled');
  }

  // Check if default provider is enabled
  const defaultProvider = getDefaultStorageProvider();
  if (!defaultProvider) {
    errors.push(
      `Default storage provider '${storageConfig.defaultProvider}' is not enabled`,
    );
  }

  // Validate AWS S3 configuration
  const awsProvider = getStorageProviderByName('aws-s3');
  if (awsProvider && awsProvider.enabled) {
    if (!awsProvider.config.accessKeyId) {
      errors.push('AWS S3 access key ID is required');
    }
    if (!awsProvider.config.secretAccessKey) {
      errors.push('AWS S3 secret access key is required');
    }
    if (!awsProvider.config.bucket) {
      errors.push('AWS S3 bucket name is required');
    }
  }

  // Validate Google Cloud Storage configuration
  const gcsProvider = getStorageProviderByName('google-cloud');
  if (gcsProvider && gcsProvider.enabled) {
    if (!gcsProvider.config.projectId) {
      errors.push('Google Cloud project ID is required');
    }
    if (!gcsProvider.config.bucketName) {
      errors.push('Google Cloud bucket name is required');
    }
  }

  // Validate Azure Blob Storage configuration
  const azureProvider = getStorageProviderByName('azure-blob');
  if (azureProvider && azureProvider.enabled) {
    if (!azureProvider.config.accountName) {
      errors.push('Azure account name is required');
    }
    if (!azureProvider.config.accountKey) {
      errors.push('Azure account key is required');
    }
    if (!azureProvider.config.containerName) {
      errors.push('Azure container name is required');
    }
  }

  // Validate local storage configuration
  const localProvider = getStorageProviderByName('local');
  if (localProvider && localProvider.enabled) {
    if (!localProvider.config.uploadDir) {
      errors.push('Local upload directory is required');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * File type validation rules
 */
export const FILE_TYPE_RULES = {
  // Images
  images: {
    extensions: [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.svg',
      '.bmp',
      '.tiff',
    ],
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    generatePreview: true,
  },

  // Documents
  documents: {
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    generatePreview: false,
  },

  // Spreadsheets
  spreadsheets: {
    extensions: ['.xls', '.xlsx', '.csv', '.ods'],
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/vnd.oasis.opendocument.spreadsheet',
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    generatePreview: false,
  },

  // Presentations
  presentations: {
    extensions: ['.ppt', '.pptx', '.odp'],
    mimeTypes: [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.oasis.opendocument.presentation',
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    generatePreview: false,
  },

  // Videos
  videos: {
    extensions: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'],
    mimeTypes: [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/x-flv',
      'video/webm',
    ],
    maxSize: 1024 * 1024 * 1024, // 1GB
    generatePreview: true,
  },

  // Audio
  audio: {
    extensions: ['.mp3', '.wav', '.ogg', '.aac', '.flac'],
    mimeTypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
      'audio/flac',
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    generatePreview: false,
  },

  // Archives
  archives: {
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    mimeTypes: [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
    ],
    maxSize: 1024 * 1024 * 1024, // 1GB
    generatePreview: false,
  },
};

/**
 * Get file type category by extension or MIME type
 */
export function getFileTypeCategory(file: {
  extension?: string;
  mimeType?: string;
}): keyof typeof FILE_TYPE_RULES | null {
  const extension = file.extension?.toLowerCase();
  const mimeType = file.mimeType?.toLowerCase();

  for (const [category, rules] of Object.entries(FILE_TYPE_RULES)) {
    if (extension && rules.extensions.includes(extension)) {
      return category as keyof typeof FILE_TYPE_RULES;
    }
    if (mimeType && rules.mimeTypes.includes(mimeType)) {
      return category as keyof typeof FILE_TYPE_RULES;
    }
  }

  return null;
}

/**
 * Check if file is allowed based on configuration
 */
export function isFileAllowed(file: {
  extension?: string;
  mimeType?: string;
  size: number;
}): boolean {
  const category = getFileTypeCategory(file);

  if (!category) {
    return false;
  }

  const rules = FILE_TYPE_RULES[category];

  // Check size
  if (file.size > rules.maxSize) {
    return false;
  }

  // Check MIME type if restrictions are set
  if (storageConfig.security.allowedMimeTypes.length > 0) {
    if (
      !file.mimeType ||
      !storageConfig.security.allowedMimeTypes.includes(file.mimeType)
    ) {
      return false;
    }
  }

  // Check extension if restrictions are set
  if (storageConfig.security.allowedExtensions.length > 0) {
    if (
      !file.extension ||
      !storageConfig.security.allowedExtensions.includes(file.extension)
    ) {
      return false;
    }
  }

  return true;
}

export default storageConfig;
