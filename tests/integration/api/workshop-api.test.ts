import request from 'supertest';
import { app } from '../../../src/app';
import { getTestDbConnection, cleanupTestData } from '../test-helpers';
import { generateTestData } from '../../helpers/test-data-factory';

describe('Workshop API Integration Tests', () => {
  let db: any;
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    db = await getTestDbConnection();

    // Create test user and get auth token
    testUser = generateTestData('user');
    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send(testUser);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData(db);
  });

  describe('POST /api/workshops', () => {
    test('should create a new workshop with valid data', async () => {
      const workshopData = generateTestData('workshop');

      const response = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workshopData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          title: workshopData.title,
          description: workshopData.description,
          startDate: workshopData.startDate,
          endDate: workshopData.endDate,
          capacity: workshopData.capacity,
          isPublic: workshopData.isPublic
        }
      });

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).toHaveProperty('updatedAt');
    });

    test('should validate required fields', async () => {
      const invalidWorkshop = {
        title: '', // Empty title
        description: 'Valid description'
      };

      const response = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidWorkshop)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          type: 'ValidationError',
          message: expect.stringContaining('title')
        }
      });
    });

    test('should validate date logic', async () => {
      const workshopWithInvalidDates = generateTestData('workshop', {
        startDate: '2024-12-15',
        endDate: '2024-12-10' // End date before start date
      });

      const response = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workshopWithInvalidDates)
        .expect(400);

      expect(response.body.error.message).toContain('End date must be after start date');
    });

    test('should require authentication', async () => {
      const workshopData = generateTestData('workshop');

      await request(app)
        .post('/api/workshops')
        .send(workshopData)
        .expect(401);
    });

    test('should handle concurrent workshop creation', async () => {
      const workshopData = generateTestData('workshop');

      // Create multiple workshops with the same title to test race conditions
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/workshops')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...workshopData,
            title: `${workshopData.title}-${Math.random()}`
          })
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('id');
      });
    });
  });

  describe('GET /api/workshops', () => {
    beforeEach(async () => {
      // Create test workshops
      const workshops = Array(5).fill(null).map(() => generateTestData('workshop'));

      for (const workshop of workshops) {
        await db.collection('workshops').insertOne(workshop);
      }
    });

    test('should return paginated list of workshops', async () => {
      const response = await request(app)
        .get('/api/workshops')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          workshops: expect.any(Array),
          pagination: {
            page: 1,
            limit: 10,
            total: expect.any(Number),
            totalPages: expect.any(Number)
          }
        }
      });

      expect(response.body.data.workshops.length).toBeGreaterThan(0);
      expect(response.body.data.workshops[0]).toHaveProperty('id');
      expect(response.body.data.workshops[0]).toHaveProperty('title');
    });

    test('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/workshops?page=1&limit=2')
        .expect(200);

      expect(response.body.data.workshops.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    test('should support search functionality', async () => {
      // Create a specific workshop for search testing
      const searchWorkshop = generateTestData('workshop', {
        title: 'JavaScript Advanced Workshop'
      });
      await db.collection('workshops').insertOne(searchWorkshop);

      const response = await request(app)
        .get('/api/workshops?search=JavaScript')
        .expect(200);

      const foundWorkshop = response.body.data.workshops.find(
        (w: any) => w.title === 'JavaScript Advanced Workshop'
      );
      expect(foundWorkshop).toBeDefined();
    });

    test('should support date range filtering', async () => {
      const response = await request(app)
        .get('/api/workshops?startDate=2024-01-01&endDate=2024-12-31')
        .expect(200);

      // All returned workshops should be within the date range
      response.body.data.workshops.forEach((workshop: any) => {
        expect(new Date(workshop.startDate)).toBeGreaterThanOrEqual(new Date('2024-01-01'));
        expect(new Date(workshop.endDate)).toBeLessThanOrEqual(new Date('2024-12-31'));
      });
    });

    test('should support sorting', async () => {
      const response = await request(app)
        .get('/api/workshops?sortBy=startDate&sortOrder=desc')
        .expect(200);

      const workshops = response.body.data.workshops;
      for (let i = 1; i < workshops.length; i++) {
        expect(new Date(workshops[i-1].startDate)).toBeGreaterThanOrEqual(
          new Date(workshops[i].startDate)
        );
      }
    });
  });

  describe('GET /api/workshops/:id', () => {
    let workshopId: string;

    beforeEach(async () => {
      const workshop = generateTestData('workshop');
      const result = await db.collection('workshops').insertOne(workshop);
      workshopId = result.insertedId.toString();
    });

    test('should return workshop by ID', async () => {
      const response = await request(app)
        .get(`/api/workshops/${workshopId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: workshopId
        }
      });
    });

    test('should return 404 for non-existent workshop', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/workshops/${nonExistentId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          type: 'NotFound',
          message: expect.stringContaining('Workshop not found')
        }
      });
    });

    test('should include enrollment statistics', async () => {
      // Create enrollments for the workshop
      const enrollments = Array(3).fill(null).map(() =>
        generateTestData('enrollment', { workshopId })
      );

      for (const enrollment of enrollments) {
        await db.collection('enrollments').insertOne(enrollment);
      }

      const response = await request(app)
        .get(`/api/workshops/${workshopId}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('enrollmentStats');
      expect(response.body.data.enrollmentStats).toMatchObject({
        totalEnrollments: 3,
        availableSpaces: expect.any(Number)
      });
    });
  });

  describe('PUT /api/workshops/:id', () => {
    let workshopId: string;

    beforeEach(async () => {
      const workshop = generateTestData('workshop');
      const result = await db.collection('workshops').insertOne(workshop);
      workshopId = result.insertedId.toString();
    });

    test('should update workshop successfully', async () => {
      const updateData = {
        title: 'Updated Workshop Title',
        description: 'Updated workshop description',
        capacity: 50
      };

      const response = await request(app)
        .put(`/api/workshops/${workshopId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: workshopId,
          title: updateData.title,
          description: updateData.description,
          capacity: updateData.capacity
        }
      });

      expect(response.body.data).toHaveProperty('updatedAt');
    });

    test('should validate update data', async () => {
      const invalidUpdate = {
        title: '', // Empty title
        capacity: -1 // Negative capacity
      };

      const response = await request(app)
        .put(`/api/workshops/${workshopId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.error.type).toBe('ValidationError');
    });

    test('should prevent unauthorized updates', async () => {
      const updateData = { title: 'Unauthorized Update' };

      await request(app)
        .put(`/api/workshops/${workshopId}`)
        .send(updateData)
        .expect(401);
    });

    test('should not allow capacity below current enrollments', async () => {
      // Create enrollments
      const enrollments = Array(5).fill(null).map(() =>
        generateTestData('enrollment', { workshopId })
      );

      for (const enrollment of enrollments) {
        await db.collection('enrollments').insertOne(enrollment);
      }

      const updateData = { capacity: 3 }; // Less than current enrollments

      const response = await request(app)
        .put(`/api/workshops/${workshopId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error.message).toContain('Cannot set capacity below current enrollments');
    });
  });

  describe('DELETE /api/workshops/:id', () => {
    let workshopId: string;

    beforeEach(async () => {
      const workshop = generateTestData('workshop');
      const result = await db.collection('workshops').insertOne(workshop);
      workshopId = result.insertedId.toString();
    });

    test('should delete workshop successfully', async () => {
      const response = await request(app)
        .delete(`/api/workshops/${workshopId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Workshop deleted successfully')
      });

      // Verify workshop is deleted
      await request(app)
        .get(`/api/workshops/${workshopId}`)
        .expect(404);
    });

    test('should not delete workshop with active enrollments', async () => {
      // Create enrollment
      const enrollment = generateTestData('enrollment', { workshopId });
      await db.collection('enrollments').insertOne(enrollment);

      const response = await request(app)
        .delete(`/api/workshops/${workshopId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.message).toContain('Cannot delete workshop with active enrollments');
    });

    test('should require authentication', async () => {
      await request(app)
        .delete(`/api/workshops/${workshopId}`)
        .expect(401);
    });
  });

  describe('POST /api/workshops/:id/enrollments', () => {
    let workshopId: string;

    beforeEach(async () => {
      const workshop = generateTestData('workshop');
      const result = await db.collection('workshops').insertOne(workshop);
      workshopId = result.insertedId.toString();
    });

    test('should create enrollment successfully', async () => {
      const enrollmentData = generateTestData('enrollment', { workshopId });

      const response = await request(app)
        .post(`/api/workshops/${workshopId}/enrollments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(enrollmentData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          workshopId: workshopId,
          participantEmail: enrollmentData.participantEmail,
          status: 'confirmed'
        }
      });
    });

    test('should prevent duplicate enrollments', async () => {
      const enrollmentData = generateTestData('enrollment', { workshopId });

      // Create first enrollment
      await request(app)
        .post(`/api/workshops/${workshopId}/enrollments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(enrollmentData)
        .expect(201);

      // Try to create duplicate enrollment
      const response = await request(app)
        .post(`/api/workshops/${workshopId}/enrollments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(enrollmentData)
        .expect(400);

      expect(response.body.error.message).toContain('Already enrolled in this workshop');
    });

    test('should handle workshop capacity limits', async () => {
      // Get workshop capacity
      const workshop = await db.collection('workshops').findOne({ _id: workshopId });

      // Fill workshop to capacity
      for (let i = 0; i < workshop.capacity; i++) {
        const enrollment = generateTestData('enrollment', {
          workshopId,
          participantEmail: `user${i}@example.com`
        });
        await db.collection('enrollments').insertOne(enrollment);
      }

      // Try to enroll when workshop is full
      const enrollmentData = generateTestData('enrollment', { workshopId });
      const response = await request(app)
        .post(`/api/workshops/${workshopId}/enrollments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(enrollmentData)
        .expect(400);

      expect(response.body.error.message).toContain('Workshop is full');
    });
  });

  describe('GET /api/workshops/:id/enrollments', () => {
    let workshopId: string;

    beforeEach(async () => {
      const workshop = generateTestData('workshop');
      const result = await db.collection('workshops').insertOne(workshop);
      workshopId = result.insertedId.toString();

      // Create test enrollments
      const enrollments = Array(5).fill(null).map(() =>
        generateTestData('enrollment', { workshopId })
      );

      for (const enrollment of enrollments) {
        await db.collection('enrollments').insertOne(enrollment);
      }
    });

    test('should return workshop enrollments', async () => {
      const response = await request(app)
        .get(`/api/workshops/${workshopId}/enrollments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          enrollments: expect.any(Array),
          pagination: expect.any(Object)
        }
      });

      expect(response.body.data.enrollments.length).toBe(5);
    });

    test('should support enrollment filtering', async () => {
      const response = await request(app)
        .get(`/api/workshops/${workshopId}/enrollments?status=confirmed`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.data.enrollments.forEach((enrollment: any) => {
        expect(enrollment.status).toBe('confirmed');
      });
    });

    test('should export enrollments data', async () => {
      const response = await request(app)
        .get(`/api/workshops/${workshopId}/enrollments?export=csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/csv/);
      expect(response.headers['content-disposition']).toMatch(/attachment/);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json')
        .expect(400);

      expect(response.body.error.type).toBe('MalformedRequest');
    });

    test('should handle database connection errors gracefully', async () => {
      // Mock database error
      jest.spyOn(db.collection('workshops'), 'insertOne')
        .mockRejectedValueOnce(new Error('Database connection failed'));

      const workshopData = generateTestData('workshop');

      const response = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workshopData)
        .expect(500);

      expect(response.body.error.type).toBe('DatabaseError');
    });

    test('should rate limit API requests', async () => {
      const workshopData = generateTestData('workshop');

      // Make many rapid requests
      const promises = Array(100).fill(null).map(() =>
        request(app)
          .post('/api/workshops')
          .set('Authorization', `Bearer ${authToken}`)
          .send(workshopData)
      );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});