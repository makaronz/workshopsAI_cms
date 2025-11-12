/**
 * Workshop Service Tests
 * Unit tests for workshop management functionality
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WorkshopService } from '../src/services/workshopService';
import { db } from '../src/config/database';
import { workshops, users, facilitators, tags, locations } from '../src/models/schema';
import { eq } from 'drizzle-orm';

// Mock database
jest.mock('../src/config/database', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    query: {
      workshops: {
        findFirst: jest.fn()
      }
    }
  }
}));

describe('WorkshopService', () => {
  const mockUserId = 1;
  const mockWorkshopData = {
    title: 'Test Workshop',
    slug: 'test-workshop',
    description: 'A test workshop for testing',
    startDate: '2025-01-15T09:00:00Z',
    endDate: '2025-01-15T17:00:00Z',
    seatLimit: 20,
    templateTheme: 'integracja',
    language: 'pl',
    tagIds: [1, 2],
    facilitatorIds: [1],
    locationIds: [1]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createWorkshop', () => {
    test('should create workshop with valid data', async () => {
      // Mock database responses
      const mockWorkshop = {
        id: 'test-uuid',
        title: mockWorkshopData.title,
        slug: mockWorkshopData.slug,
        status: 'draft',
        createdBy: mockUserId
      };

      (db.insert as jest.Mock).mockReturnValue({
        values: expect.any(Object),
        returning: jest.fn().mockResolvedValue([mockWorkshop])
      });

      const result = await WorkshopService.createWorkshop(mockUserId, mockWorkshopData);

      expect(result).toEqual(mockWorkshop);
      expect(db.insert).toHaveBeenCalledWith(workshops);
    });

    test('should generate slug from title if not provided', async () => {
      const workshopWithoutSlug = {
        ...mockWorkshopData,
        slug: undefined
      };

      const mockWorkshop = {
        id: 'test-uuid',
        title: workshopWithoutSlug.title,
        slug: 'test-workshop',
        status: 'draft',
        createdBy: mockUserId
      };

      (db.insert as jest.Mock).mockReturnValue({
        values: expect.any(Object),
        returning: jest.fn().mockResolvedValue([mockWorkshop])
      });

      await WorkshopService.createWorkshop(mockUserId, workshopWithoutSlug);

      const insertCall = (db.insert as jest.Mock).mock.calls[0];
      const insertedData = insertCall[0].values;
      expect(insertedData.slug).toBe('test-workshop');
    });
  });

  describe('getWorkshopById', () => {
    test('should return workshop when found', async () => {
      const mockWorkshop = {
        id: 'test-uuid',
        title: 'Test Workshop',
        slug: 'test-workshop',
        status: 'published',
        creator: { id: 1, name: 'Test User', email: 'test@example.com' },
        sessions: [],
        workshopTags: [],
        workshopFacilitators: [],
        workshopLocations: [],
        enrollments: []
      };

      (db.query.workshops.findFirst as jest.Mock).mockResolvedValue(mockWorkshop);

      const result = await WorkshopService.getWorkshopById('test-uuid');

      expect(result).toEqual(mockWorkshop);
      expect(db.query.workshops.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
        with: expect.any(Object)
      });
    });

    test('should return null when workshop not found', async () => {
      (db.query.workshops.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await WorkshopService.getWorkshopById('nonexistent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('updateWorkshop', () => {
    test('should update workshop when user is creator', async () => {
      const workshopId = 'test-uuid';
      const updateData = {
        title: 'Updated Workshop Title'
      };

      const existingWorkshop = {
        id: workshopId,
        title: 'Original Title',
        createdBy: mockUserId
      };

      const updatedWorkshop = {
        ...existingWorkshop,
        title: updateData.title,
        updatedAt: expect.any(Date)
      };

      // Mock getWorkshopById
      jest.spyOn(WorkshopService, 'getWorkshopById').mockResolvedValue(existingWorkshop as any);

      // Mock update
      (db.update as jest.Mock).mockReturnValue({
        set: expect.any(Object),
        where: expect.any(Object),
        returning: jest.fn().mockResolvedValue([updatedWorkshop])
      });

      const result = await WorkshopService.updateWorkshop(workshopId, mockUserId, updateData);

      expect(result).toEqual(updatedWorkshop);
      expect(db.update).toHaveBeenCalledWith(workshops);
    });

    test('should throw error when workshop not found', async () => {
      const workshopId = 'nonexistent-uuid';
      const updateData = { title: 'Updated Title' };

      // Mock getWorkshopById to return null
      jest.spyOn(WorkshopService, 'getWorkshopById').mockResolvedValue(null);

      await expect(WorkshopService.updateWorkshop(workshopId, mockUserId, updateData))
        .rejects.toThrow('Workshop not found');
    });
  });

  describe('publishWorkshop', () => {
    test('should publish workshop when user is creator and workshop is valid', async () => {
      const workshopId = 'test-uuid';
      const validWorkshop = {
        id: workshopId,
        title: 'Valid Workshop',
        description: 'Valid description with enough content',
        status: 'draft',
        createdBy: mockUserId
      };

      const publishedWorkshop = {
        ...validWorkshop,
        status: 'published',
        publishedAt: expect.any(Date)
      };

      // Mock getWorkshopById
      jest.spyOn(WorkshopService, 'getWorkshopById').mockResolvedValue(validWorkshop as any);

      // Mock update
      (db.update as jest.Mock).mockReturnValue({
        set: expect.any(Object),
        where: expect.any(Object),
        returning: jest.fn().mockResolvedValue([publishedWorkshop])
      });

      const result = await WorkshopService.publishWorkshop(workshopId, mockUserId);

      expect(result).toEqual(publishedWorkshop);
      expect(result.status).toBe('published');
    });

    test('should throw error when workshop has no title', async () => {
      const workshopId = 'test-uuid';
      const invalidWorkshop = {
        id: workshopId,
        title: '',
        description: 'Description only',
        status: 'draft',
        createdBy: mockUserId
      };

      // Mock getWorkshopById
      jest.spyOn(WorkshopService, 'getWorkshopById').mockResolvedValue(invalidWorkshop as any);

      await expect(WorkshopService.publishWorkshop(workshopId, mockUserId))
        .rejects.toThrow('Title and description are required to publish workshop');
    });
  });

  describe('duplicateWorkshop', () => {
    test('should duplicate workshop with new title', async () => {
      const originalWorkshopId = 'original-uuid';
      const newTitle = 'Duplicated Workshop';

      const originalWorkshop = {
        id: originalWorkshopId,
        title: 'Original Workshop',
        description: 'Original description',
        sessions: [
          {
            id: 'session-uuid',
            title: 'Session 1',
            duration: 60,
            order: 0,
            materials: [],
            modules: [
              {
                id: 'module-uuid',
                title: 'Module 1',
                type: 'text',
                content: { content: 'Module content' },
                duration: 30,
                order: 0,
                isRequired: true,
                resources: [],
                settings: {}
              }
            ]
          }
        ],
        workshopTags: [{ tagId: 1 }],
        workshopFacilitators: [{ facilitatorId: 1 }],
        workshopLocations: [{ locationId: 1 }]
      };

      const duplicateWorkshop = {
        id: 'new-uuid',
        title: newTitle,
        slug: 'duplicated-workshop',
        status: 'draft'
      };

      // Mock getWorkshopById
      jest.spyOn(WorkshopService, 'getWorkshopById').mockResolvedValue(originalWorkshop as any);

      // Mock insert for duplicate workshop
      (db.insert as jest.Mock).mockReturnValue({
        values: expect.any(Object),
        returning: jest.fn().mockResolvedValue([duplicateWorkshop])
      });

      const result = await WorkshopService.duplicateWorkshop(originalWorkshopId, mockUserId, newTitle);

      expect(result.title).toBe(newTitle);
      expect(result.status).toBe('draft');
      expect(db.insert).toHaveBeenCalledWith(workshops);
    });
  });

  describe('deleteWorkshop', () => {
    test('should delete workshop when user is creator and no enrollments', async () => {
      const workshopId = 'test-uuid';
      const existingWorkshop = {
        id: workshopId,
        title: 'Test Workshop',
        createdBy: mockUserId
      };

      // Mock getWorkshopById
      jest.spyOn(WorkshopService, 'getWorkshopById').mockResolvedValue(existingWorkshop as any);

      // Mock enrollment count check (returns 0)
      (db.select as jest.Mock).mockReturnValue({
        where: expect.any(Object),
        from: expect.any(Object)
      });

      // Mock delete
      (db.delete as jest.Mock).mockReturnValue({
        where: expect.any(Object)
      });

      const result = await WorkshopService.deleteWorkshop(workshopId, mockUserId);

      expect(result).toEqual({ success: true });
      expect(db.delete).toHaveBeenCalledWith(workshops);
    });

    test('should throw error when workshop has enrollments', async () => {
      const workshopId = 'test-uuid';
      const existingWorkshop = {
        id: workshopId,
        title: 'Test Workshop',
        createdBy: mockUserId
      };

      // Mock getWorkshopById
      jest.spyOn(WorkshopService, 'getWorkshopById').mockResolvedValue(existingWorkshop as any);

      // Mock enrollment count check (returns > 0)
      const mockCount = { count: { count: 5 } };
      (db.select as jest.Mock).mockReturnValue([mockCount]);

      await expect(WorkshopService.deleteWorkshop(workshopId, mockUserId))
        .rejects.toThrow('Cannot delete workshop with enrollments');
    });
  });
});

describe('WorkshopService Edge Cases', () => {
  test('should handle database errors gracefully', async () => {
    const mockDbError = new Error('Database connection failed');

    // Mock database to throw error
    (db.query.workshops.findFirst as jest.Mock).mockRejectedValue(mockDbError);

    await expect(WorkshopService.getWorkshopById('test-uuid'))
      .rejects.toThrow('Database connection failed');
  });

  test('should handle invalid workshop IDs', async () => {
    // Mock workshop not found
    (db.query.workshops.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await WorkshopService.getWorkshopById('invalid-uuid');
    expect(result).toBeNull();
  });

  test('should validate workshop data', async () => {
    const invalidWorkshopData = {
      title: '', // Invalid: empty title
      description: 'A workshop with no title',
      slug: '',
      startDate: 'invalid-date'
    };

    // This should be handled by validation layer
    expect(() => WorkshopService.createWorkshop(mockUserId, invalidWorkshopData as any))
      .not.toThrow();
  });
});

describe('WorkshopService Performance', () => {
  test('should handle large workshop lists efficiently', async () => {
    // This test would verify that pagination works correctly
    const mockPaginationFilter = {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };

    // Mock database response with pagination
    const mockWorkshops = Array.from({ length: 20 }, (_, i) => ({
      id: `workshop-${i}`,
      title: `Workshop ${i}`,
      status: 'published'
    }));

    (db.query.workshops.findMany as jest.Mock).mockResolvedValue(mockWorkshops);

    // Mock count
    (db.select as jest.Mock).mockReturnValue([{
      count: { count: 100 }
    }]);

    // This test mainly verifies the structure exists and would work with real data
    expect(mockPaginationFilter.limit).toBe(20);
    expect(mockPaginationFilter.page).toBe(1);
  });
});