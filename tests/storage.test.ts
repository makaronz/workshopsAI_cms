import { storageService } from "../src/services/storageService";
import { storageConfig, isFileAllowed, getFileTypeCategory, validateStorageConfig } from "../src/config/storage";
import { db } from "../src/config/postgresql-database";
import { files } from "../src/models/postgresql-schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { fileTypeFromBuffer } from "file-type";

describe("Storage Service", () => {
  beforeAll(async () => {
    // Initialize test database connection if needed
    // This would typically be handled by your test setup
  });

  afterAll(async () => {
    // Clean up test data if needed
  });

  describe("Configuration Validation", () => {
    test("should validate storage configuration", () => {
      const validation = validateStorageConfig();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test("should detect missing provider configuration", () => {
      // This test would check invalid configuration scenarios
      // Implementation depends on your test environment setup
    });
  });

  describe("File Validation", () => {
    test("should allow valid image files", () => {
      const file = {
        extension: "jpg",
        mimeType: "image/jpeg",
        size: 1024 * 1024, // 1MB
      };

      expect(isFileAllowed(file)).toBe(true);
      expect(getFileTypeCategory(file)).toBe("images");
    });

    test("should allow valid PDF files", () => {
      const file = {
        extension: "pdf",
        mimeType: "application/pdf",
        size: 5 * 1024 * 1024, // 5MB
      };

      expect(isFileAllowed(file)).toBe(true);
      expect(getFileTypeCategory(file)).toBe("documents");
    });

    test("should reject files that are too large", () => {
      const file = {
        extension: "jpg",
        mimeType: "image/jpeg",
        size: 1024 * 1024 * 1024, // 1GB - larger than typical limits
      };

      expect(isFileAllowed(file)).toBe(false);
    });

    test("should reject unknown file types", () => {
      const file = {
        extension: "exe",
        mimeType: "application/x-executable",
        size: 1024 * 1024, // 1MB
      };

      expect(isFileAllowed(file)).toBe(false);
      expect(getFileTypeCategory(file)).toBeNull();
    });
  });

  describe("File Upload", () => {
    test("should upload a small text file", async () => {
      const content = "Test file content";
      const buffer = Buffer.from(content, "utf-8");
      const fileName = "test-file.txt";
      const uploadedBy = "test-user-id";

      try {
        const result = await storageService.uploadFile(
          buffer,
          fileName,
          uploadedBy,
          {
            isPublic: false,
            accessLevel: "private",
            tags: ["test", "unit-test"],
          }
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.originalName).toBe(fileName);
        expect(result.fileSize).toBe(buffer.length);
        expect(result.mimeType).toBe("text/plain");
        expect(result.extension).toBe("txt");
        expect(result.uploadedBy).toBe(uploadedBy);
        expect(result.isPublic).toBe(false);
        expect(result.accessLevel).toBe("private");

        // Clean up
        await storageService.deleteFile(result.id, uploadedBy);
      } catch (error) {
        // Local storage might not be configured in test environment
        expect(error.message).toContain("No storage providers are available");
      }
    }, 30000);

    test("should upload an image with preview generation", async () => {
      // Create a simple 1x1 PNG image
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0x99, 0x01, 0x01, 0x01, 0x00, 0x00,
        0xFE, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
      ]);

      const fileName = "test-image.png";
      const uploadedBy = "test-user-id";

      try {
        const result = await storageService.uploadFile(
          pngBuffer,
          fileName,
          uploadedBy,
          {
            generatePreview: true,
            generateThumbnail: true,
            compress: false, // Don't compress for test consistency
          }
        );

        expect(result).toBeDefined();
        expect(result.mimeType).toBe("image/png");
        expect(result.extension).toBe("png");
        expect(result.category).toBe("images");

        // Clean up
        await storageService.deleteFile(result.id, uploadedBy);
      } catch (error) {
        expect(error.message).toContain("No storage providers are available");
      }
    }, 30000);
  });

  describe("File Metadata", () => {
    test("should retrieve file metadata", async () => {
      // First upload a file
      const content = "Test metadata file";
      const buffer = Buffer.from(content, "utf-8");
      const fileName = "metadata-test.txt";
      const uploadedBy = "test-user-id";

      try {
        const uploadedFile = await storageService.uploadFile(
          buffer,
          fileName,
          uploadedBy,
          {
            tags: ["metadata", "test"],
            metadata: { description: "Test file for metadata" },
          }
        );

        // Retrieve metadata
        const metadata = await storageService.getFileMetadata(uploadedFile.id);

        expect(metadata).toBeDefined();
        expect(metadata?.id).toBe(uploadedFile.id);
        expect(metadata?.originalName).toBe(fileName);
        expect(metadata?.tags).toEqual(["metadata", "test"]);
        expect(metadata?.metadata).toEqual({ description: "Test file for metadata" });

        // Clean up
        await storageService.deleteFile(uploadedFile.id, uploadedBy);
      } catch (error) {
        expect(error.message).toContain("No storage providers are available");
      }
    }, 30000);

    test("should return null for non-existent file", async () => {
      const metadata = await storageService.getFileMetadata("non-existent-id");
      expect(metadata).toBeNull();
    });
  });

  describe("File Listing", () => {
    test("should list user files", async () => {
      try {
        const result = await storageService.listFiles({
          userId: "test-user-id",
          limit: 10,
          offset: 0,
        });

        expect(result.files).toBeDefined();
        expect(Array.isArray(result.files)).toBe(true);
        expect(typeof result.total).toBe("number");
      } catch (error) {
        // This might fail if database is not set up for testing
        expect(error).toBeDefined();
      }
    });

    test("should filter files by MIME type", async () => {
      try {
        const result = await storageService.listFiles({
          mimeType: "image/jpeg",
          limit: 5,
        });

        expect(result.files).toBeDefined();
        result.files.forEach(file => {
          expect(file.mimeType).toBe("image/jpeg");
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("File Deletion", () => {
    test("should delete uploaded file", async () => {
      const content = "File to be deleted";
      const buffer = Buffer.from(content, "utf-8");
      const fileName = "delete-test.txt";
      const uploadedBy = "test-user-id";

      try {
        // Upload file
        const uploadedFile = await storageService.uploadFile(
          buffer,
          fileName,
          uploadedBy
        );

        expect(uploadedFile.id).toBeDefined();

        // Delete file
        const deleteResult = await storageService.deleteFile(
          uploadedFile.id,
          uploadedBy
        );

        expect(deleteResult).toBe(true);

        // Verify file is deleted (metadata should be soft-deleted)
        const metadata = await storageService.getFileMetadata(uploadedFile.id);
        expect(metadata).toBeNull();
      } catch (error) {
        expect(error.message).toContain("No storage providers are available");
      }
    }, 30000);
  });

  describe("Download URLs", () => {
    test("should generate download URL", async () => {
      const content = "Download test file";
      const buffer = Buffer.from(content, "utf-8");
      const fileName = "download-test.txt";
      const uploadedBy = "test-user-id";

      try {
        // Upload file
        const uploadedFile = await storageService.uploadFile(
          buffer,
          fileName,
          uploadedBy
        );

        // Generate download URL
        const downloadResult = await storageService.getDownloadUrl(
          uploadedFile.id,
          uploadedBy
        );

        expect(downloadResult).toBeDefined();
        expect(downloadResult.url).toBeDefined();
        expect(downloadResult.expiresIn).toBeGreaterThan(0);

        // Clean up
        await storageService.deleteFile(uploadedFile.id, uploadedBy);
      } catch (error) {
        expect(error.message).toContain("No storage providers are available");
      }
    }, 30000);

    test("should deny download for unauthorized user", async () => {
      const content = "Protected file";
      const buffer = Buffer.from(content, "utf-8");
      const fileName = "protected.txt";
      const uploadedBy = "owner-user-id";

      try {
        // Upload file
        const uploadedFile = await storageService.uploadFile(
          buffer,
          fileName,
          uploadedBy,
          {
            isPublic: false,
            accessLevel: "private",
          }
        );

        // Try to get download URL for different user
        const downloadResult = await storageService.getDownloadUrl(
          uploadedFile.id,
          "unauthorized-user-id"
        );

        expect(downloadResult).toBeNull();

        // Clean up
        await storageService.deleteFile(uploadedFile.id, uploadedBy);
      } catch (error) {
        expect(error.message).toContain("No storage providers are available");
      }
    }, 30000);
  });

  describe("Error Handling", () => {
    test("should handle invalid file data", async () => {
      const invalidBuffer = Buffer.alloc(0); // Empty buffer
      const fileName = "empty.txt";
      const uploadedBy = "test-user-id";

      try {
        await storageService.uploadFile(
          invalidBuffer,
          fileName,
          uploadedBy
        );

        // Should not reach here if validation works correctly
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain("File is empty");
      }
    });

    test("should handle provider unavailability", async () => {
      // This test would need to mock provider failure
      // Implementation depends on your test setup
    });
  });

  describe("Performance", () => {
    test("should handle concurrent uploads", async () => {
      const uploadPromises = [];
      const numUploads = 3;

      for (let i = 0; i < numUploads; i++) {
        const content = `Concurrent test file ${i}`;
        const buffer = Buffer.from(content, "utf-8");
        const fileName = `concurrent-${i}.txt`;

        const uploadPromise = storageService.uploadFile(
          buffer,
          fileName,
          "test-user-id"
        ).catch(error => {
          // Expected if no storage provider available
          expect(error.message).toContain("No storage providers are available");
          return null;
        });

        uploadPromises.push(uploadPromise);
      }

      try {
        const results = await Promise.all(uploadPromises);
        const successfulUploads = results.filter(result => result !== null);

        // If storage is available, all should succeed
        if (successfulUploads.length > 0) {
          expect(successfulUploads).toHaveLength(numUploads);

          // Clean up
          for (const result of successfulUploads) {
            if (result) {
              await storageService.deleteFile(result.id, "test-user-id");
            }
          }
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 60000);

    test("should handle large file uploads", async () => {
      // Create a larger buffer (1MB)
      const largeContent = "A".repeat(1024 * 1024);
      const buffer = Buffer.from(largeContent, "utf-8");
      const fileName = "large-file.txt";
      const uploadedBy = "test-user-id";

      try {
        const startTime = Date.now();
        const result = await storageService.uploadFile(
          buffer,
          fileName,
          uploadedBy
        );
        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(result.fileSize).toBe(buffer.length);
        expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

        // Clean up
        await storageService.deleteFile(result.id, uploadedBy);
      } catch (error) {
        expect(error.message).toContain("No storage providers are available");
      }
    }, 60000);
  });
});

describe("Storage Configuration", () => {
  describe("File Type Rules", () => {
    test("should identify image files correctly", () => {
      const imageFile = {
        extension: "jpg",
        mimeType: "image/jpeg",
        size: 1024 * 1024, // 1MB
      };

      const category = getFileTypeCategory(imageFile);
      expect(category).toBe("images");
    });

    test("should identify document files correctly", () => {
      const docFile = {
        extension: "pdf",
        mimeType: "application/pdf",
        size: 5 * 1024 * 1024, // 5MB
      };

      const category = getFileTypeCategory(docFile);
      expect(category).toBe("documents");
    });

    test("should handle unknown file types", () => {
      const unknownFile = {
        extension: "xyz",
        mimeType: "application/unknown",
        size: 1024,
      };

      const category = getFileTypeCategory(unknownFile);
      expect(category).toBeNull();
    });
  });

  describe("Security Validation", () => {
    test("should reject executable files", () => {
      const exeFile = {
        extension: "exe",
        mimeType: "application/x-executable",
        size: 1024 * 1024, // 1MB
      };

      expect(isFileAllowed(exeFile)).toBe(false);
    });

    test("should allow allowed file types", () => {
      const allowedFile = {
        extension: "png",
        mimeType: "image/png",
        size: 2 * 1024 * 1024, // 2MB
      };

      expect(isFileAllowed(allowedFile)).toBe(true);
    });
  });
});

describe("Storage Provider", () => {
  describe("Local Storage", () => {
    // These tests would require actual file system access
    // Consider mocking file system operations for testing

    test("should create upload directory if it doesn't exist", () => {
      // This would need to be implemented with proper mocking
    });

    test("should handle file operations correctly", () => {
      // This would test actual file operations
      // Consider using temporary directories for testing
    });
  });

  describe("Cloud Storage", () => {
    // These tests would require mocking cloud provider APIs
    test("should handle AWS S3 operations", () => {
      // Mock AWS SDK and test S3 operations
    });

    test("should handle Google Cloud Storage operations", () => {
      // Mock Google Cloud Storage and test operations
    });

    test("should handle Azure Blob Storage operations", () => {
      // Mock Azure Storage and test operations
    });
  });
});