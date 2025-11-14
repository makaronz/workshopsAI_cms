# Cloud Storage Integration Guide

This guide provides comprehensive documentation for the cloud storage system integrated into the workshopsAI CMS.

## Overview

The cloud storage system provides a unified interface for file management across multiple storage providers, including AWS S3, Google Cloud Storage, Azure Blob Storage, and local file system. It offers features like:

- **Multi-provider support** with automatic failover
- **Secure file uploads** with validation and virus scanning
- **Automatic image processing** (compression, thumbnails, previews)
- **File versioning and backup**
- **Access control and permissions**
- **Audit logging and analytics**
- **CDN integration** for fast content delivery

## Architecture

### Components

1. **Storage Service** (`src/services/storageService.ts`)
   - Core abstraction layer
   - Provider implementations
   - File operations (upload, download, delete, etc.)

2. **Storage Configuration** (`src/config/storage.ts`)
   - Multi-provider configuration
   - Security settings
   - Performance tuning
   - Retention policies

3. **File Upload Middleware** (`src/middleware/fileUpload.ts`)
   - Request validation
   - File type checking
   - Progress tracking
   - Security scanning

4. **Database Schema** (`src/models/postgresql-schema.ts`)
   - File metadata storage
   - Access logs
   - Share links
   - User quotas

5. **API Routes** (`src/routes/api/files.ts`)
   - RESTful file management endpoints
   - Authentication and authorization
   - Share links and permissions

## Configuration

### Environment Variables

Configure your storage provider using environment variables. See `.env.example` for all available options.

#### AWS S3 Setup

```bash
# Enable AWS S3
AWS_S3_ENABLED=true
STORAGE_DEFAULT_PROVIDER=aws-s3

# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Optional: Custom S3-compatible endpoint
AWS_S3_ENDPOINT=https://s3-compatible-endpoint.com
AWS_S3_FORCE_PATH_STYLE=true
```

#### Google Cloud Storage Setup

```bash
# Enable Google Cloud Storage
GCS_ENABLED=true
STORAGE_DEFAULT_PROVIDER=google-cloud

# GCP Configuration
GCS_PROJECT_ID=your-gcp-project
GCS_KEY_FILENAME=./path/to/service-account-key.json
GCS_BUCKET_NAME=your-gcs-bucket
```

#### Azure Blob Storage Setup

```bash
# Enable Azure Blob Storage
AZURE_BLOB_ENABLED=true
STORAGE_DEFAULT_PROVIDER=azure-blob

# Azure Configuration
AZURE_ACCOUNT_NAME=your_storage_account
AZURE_ACCOUNT_KEY=your_storage_key
AZURE_CONTAINER_NAME=your-container
```

#### Local Storage Setup

```bash
# Enable Local Storage (default)
STORAGE_LOCAL_ENABLED=true
STORAGE_DEFAULT_PROVIDER=local

# Local Configuration
STORAGE_LOCAL_UPLOAD_DIR=./uploads
STORAGE_LOCAL_PUBLIC_URL=http://localhost:3001/uploads
```

### Security Configuration

```bash
# File size limits (500MB default)
STORAGE_MAX_FILE_SIZE=524288000

# Allowed file types
STORAGE_ALLOWED_MIME_TYPES=image/jpeg,image/png,application/pdf
STORAGE_ALLOWED_EXTENSIONS=.jpg,.png,.pdf

# Security features
STORAGE_VIRUS_SCAN=true
STORAGE_GENERATE_PREVIEWS=true
```

### Performance Configuration

```bash
# Multipart upload threshold (100MB)
STORAGE_MULTIPART_THRESHOLD=104857600

# Concurrent uploads
STORAGE_MAX_CONCURRENT_UPLOADS=3

# File compression
STORAGE_COMPRESSION_ENABLED=true
```

## API Usage

### File Upload

```javascript
// Upload files with form data
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);

// Optional metadata
formData.append('associatedEntityType', 'workshop');
formData.append('associatedEntityId', 'workshop-uuid');
formData.append('tags', JSON.stringify(['document', 'important']));
formData.append('isPublic', 'false');

const response = await fetch('/api/v1/files', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
  },
  body: formData,
});

const result = await response.json();
console.log('Uploaded files:', result.files);
```

### File Download

```javascript
const response = await fetch('/api/v1/files/file-uuid/download', {
  headers: {
    'Authorization': 'Bearer your-jwt-token',
  },
});

const result = await response.json();
console.log('Download URL:', result.downloadUrl);

// Use the signed URL to download
window.open(result.downloadUrl);
```

### List Files

```javascript
const response = await fetch('/api/v1/files?limit=20&offset=0&sortBy=uploadedAt&sortOrder=desc', {
  headers: {
    'Authorization': 'Bearer your-jwt-token',
  },
});

const result = await response.json();
console.log('Files:', result.files);
console.log('Pagination:', result.pagination);
```

### Share Files

```javascript
const shareData = {
  permissions: ['view', 'download'],
  shareType: 'link',
  accessLevel: 'organization',
  expiresAt: '2024-12-31T23:59:59Z',
  maxDownloads: 10,
  password: 'secure123'
};

const response = await fetch('/api/v1/files/file-uuid/share', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(shareData),
});

const result = await response.json();
console.log('Share URL:', result.shareUrl);
```

## File Categories

The system automatically categorizes files based on MIME type and extension:

### Images
- **Extensions**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`
- **Features**: Auto-compression, thumbnails, previews
- **Max Size**: 50MB

### Documents
- **Extensions**: `.pdf`, `.doc`, `.docx`, `.txt`, `.rtf`
- **Features**: Preview generation, text extraction
- **Max Size**: 100MB

### Videos
- **Extensions**: `.mp4`, `.avi`, `.mov`, `.webm`
- **Features**: Thumbnail generation
- **Max Size**: 1GB

### Archives
- **Extensions**: `.zip`, `.rar`, `.7z`, `.tar`
- **Features**: Content scanning
- **Max Size**: 1GB

## Security Features

### Access Control

- **Role-based permissions** integrated with existing auth system
- **File-level access control** (private, workshop, organization, public)
- **Share links** with customizable permissions and expiration
- **Workshop-based access** for enrolled participants

### Audit Logging

All file operations are logged with:
- User information
- IP address and user agent
- Operation type (upload, download, delete, etc.)
- Success/failure status
- Timestamp

### Virus Scanning

- Basic signature-based scanning
- Executable file detection
- Archive content inspection
- Configurable scanning rules

## Performance Optimization

### Image Processing

- **Automatic compression** with configurable quality
- **Multiple thumbnail sizes** for different use cases
- **Format optimization** (WebP for modern browsers)
- **Lazy loading** support

### Caching Strategy

- **Redis caching** for file metadata
- **CDN integration** for static content
- **Browser caching headers** for optimal performance
- **Preview generation** for reduced data transfer

### Upload Performance

- **Multipart uploads** for large files (>100MB)
- **Concurrent upload processing**
- **Progress tracking** with real-time updates
- **Resume capability** for interrupted uploads

## Monitoring and Analytics

### File Statistics

Track file usage with detailed analytics:
- Upload/download counts
- Storage usage per user
- Popular file types
- Access patterns
- Performance metrics

### Health Monitoring

```javascript
// Check storage service health
const health = await storageService.healthCheck();
console.log('Provider status:', health.providers);
console.log('Configuration:', health.config);
```

### Usage Reports

Generate comprehensive reports:
- Storage consumption by user
- File type distribution
- Access frequency analysis
- Cost optimization recommendations

## Integration Examples

### Workshop File Management

```javascript
// Upload workshop materials
const uploadWorkshopFiles = async (workshopId, files) => {
  const formData = new FormData();

  files.forEach(file => {
    formData.append('files', file);
  });

  formData.append('associatedEntityType', 'workshop');
  formData.append('associatedEntityId', workshopId);
  formData.append('accessLevel', 'workshop');

  const response = await fetch('/api/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
};

// Get workshop files
const getWorkshopFiles = async (workshopId) => {
  const response = await fetch(
    `/api/v1/files?associatedEntityType=workshop&associatedEntityId=${workshopId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return response.json();
};
```

### Profile Picture Upload

```javascript
// Upload user avatar
const uploadAvatar = async (file, userId) => {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('associatedEntityType', 'user');
  formData.append('associatedEntityId', userId);
  formData.append('isPublic', 'true');
  formData.append('generateThumbnail', 'true');

  const response = await fetch('/api/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await response.json();

  // Update user profile with new avatar URL
  if (result.files && result.files[0] && result.files[0].success) {
    await updateUserAvatar(userId, result.files[0].thumbnailUrl);
  }

  return result;
};
```

## Troubleshooting

### Common Issues

1. **Upload Fails with "File type not allowed"**
   - Check `STORAGE_ALLOWED_MIME_TYPES` and `STORAGE_ALLOWED_EXTENSIONS`
   - Verify file MIME type detection
   - Ensure file extensions are lowercase

2. **Large File Uploads Timeout**
   - Increase `STORAGE_MULTIPART_THRESHOLD`
   - Check network timeout settings
   - Verify provider-specific limits

3. **Permission Denied Errors**
   - Verify user has appropriate role
   - Check file access level settings
   - Ensure workshop enrollment for workshop files

4. **Storage Provider Connection Issues**
   - Validate credentials and permissions
   - Check network connectivity
   - Verify bucket/container exists

### Debug Mode

Enable detailed logging:

```bash
# Enable debug logging
STORAGE_ENABLE_METRICS=true
STORAGE_ENABLE_AUDIT_LOG=true
LOG_LEVEL=debug
```

### Performance Tuning

1. **Optimize Image Uploads**
   ```javascript
   // Disable automatic processing for faster uploads
   formData.append('generatePreview', 'false');
   formData.append('compress', 'false');
   ```

2. **Batch Operations**
   ```javascript
   // Upload multiple files efficiently
   const batchUpload = async (files) => {
     const batchSize = 5;
     const batches = [];

     for (let i = 0; i < files.length; i += batchSize) {
       batches.push(files.slice(i, i + batchSize));
     }

     const results = await Promise.all(
       batches.map(batch => uploadBatch(batch))
     );

     return results.flat();
   };
   ```

## Best Practices

### File Organization

- Use **descriptive filenames** with timestamps
- Organize files by **entity type** (workshop, user, session)
- Implement **consistent tagging** for better searchability
- Set appropriate **expiration dates** for temporary files

### Security

- Always **validate file types** on both client and server
- Implement **access control checks** before file operations
- Use **signed URLs** for temporary access
- Regular **security audits** of file permissions

### Performance

- **Compress images** before upload
- Use **CDN** for static content delivery
- Implement **caching strategies** for metadata
- Monitor **storage usage** and optimize regularly

### Cost Optimization

- Regular **cleanup** of expired files
- Implement **user quotas** for storage limits
- Use **lifecycle policies** for archival
- Monitor **provider costs** and optimize usage

## Migration Guide

### From Local to Cloud Storage

1. **Configure cloud provider credentials**
2. **Set `STORAGE_DEFAULT_PROVIDER` to cloud provider**
3. **Run migration script** to move existing files
4. **Update application URLs** to use CDN
5. **Test file operations** thoroughly

### Multi-Provider Setup

1. **Enable multiple providers** in configuration
2. **Set up provider-specific credentials**
3. **Configure failover strategy**
4. **Test provider switching**
5. **Monitor provider performance**

## Support

For issues related to the cloud storage system:

1. Check the **troubleshooting section** above
2. Review **configuration settings**
3. Examine **error logs** for detailed information
4. Consult **API documentation** for correct usage
5. Contact support with **error details** and configuration info

## Changelog

### Version 1.0.0
- Initial implementation
- Multi-provider support (AWS S3, GCS, Azure, Local)
- File upload/download with progress tracking
- Security features and access control
- Audit logging and analytics
- Image processing and optimization
- Share links and permissions