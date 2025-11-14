/**
 * API Integration Tests
 * Comprehensive testing of API endpoints with real HTTP requests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app';
import { mockDatabase } from '../../mocks/database';
import { testUsers, testWorkshops, testQuestionnaires } from '../../fixtures/testData';

describe('API Integration Tests', () => {
  let server: any;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Start the test server
    server = app.listen(0);
    mockDatabase.reset();

    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    // Close the test server
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  beforeEach(async () => {
    // Reset database before each test
    mockDatabase.reset();
    await seedTestData();
  });

  afterEach(() => {
    // Clean up any test-specific state
  });

  async function seedTestData() {
    // This would normally seed the database with test data
    // For now, we'll rely on our mock database
  }

  async function authenticateUser(userData: any) {
    const response = await request(app)
      .post('/api/auth/login')
      .send(userData)
      .expect(200);

    return {
      token: response.body.token,
      refreshToken: response.body.refreshToken,
      user: response.body.user
    };
  }

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user', async () => {
        const newUser = {
          email: 'newuser@test.com',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(newUser)
          .expect(201);

        expect(response.body.user.email).toBe(newUser.email);
        expect(response.body.user.username).toBe(newUser.username);
        expect(response.body.token).toBeDefined();
        expect(response.body.refreshToken).toBeDefined();
        expect(response.body.user.password).toBeUndefined();
      });

      it('should return 400 for invalid email', async () => {
        const newUser = {
          email: 'invalid-email',
          username: 'test',
          firstName: 'Test',
          lastName: 'User',
          password: 'password123'
        };

        await request(app)
          .post('/api/auth/register')
          .send(newUser)
          .expect(400);
      });

      it('should return 400 for weak password', async () => {
        const newUser = {
          email: 'test@test.com',
          username: 'test',
          firstName: 'Test',
          lastName: 'User',
          password: '123'
        };

        await request(app)
          .post('/api/auth/register')
          .send(newUser)
          .expect(400);
      });

      it('should return 409 for duplicate email', async () => {
        const duplicateUser = {
          email: 'admin@test.com', // Existing email
          username: 'different',
          firstName: 'Test',
          lastName: 'User',
          password: 'password123'
        };

        await request(app)
          .post('/api/auth/register')
          .send(duplicateUser)
          .expect(409);
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const credentials = {
          email: 'admin@test.com',
          password: 'password'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(200);

        expect(response.body.user.email).toBe(credentials.email);
        expect(response.body.token).toBeDefined();
        expect(response.body.refreshToken).toBeDefined();
        expect(response.body.user.password).toBeUndefined();

        // Store auth token for subsequent tests
        authToken = response.body.token;
        userId = response.body.user.id;
      });

      it('should return 401 for invalid credentials', async () => {
        const credentials = {
          email: 'admin@test.com',
          password: 'wrongpassword'
        };

        await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);
      });

      it('should return 401 for non-existent user', async () => {
        const credentials = {
          email: 'nonexistent@test.com',
          password: 'password'
        };

        await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);
      });
    });

    describe('POST /api/auth/refresh', () => {
      it('should refresh access token', async () => {
        // First login to get refresh token
        const auth = await authenticateUser({
          email: 'admin@test.com',
          password: 'password'
        });

        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: auth.refreshToken })
          .expect(200);

        expect(response.body.token).toBeDefined();
        expect(response.body.refreshToken).toBeDefined();
        expect(response.body.token).not.toBe(auth.token);
      });

      it('should return 401 for invalid refresh token', async () => {
        await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'invalid-refresh-token' })
          .expect(401);
      });
    });
  });

  describe('Workshop Endpoints', () => {
    beforeEach(async () => {
      // Authenticate user for workshop tests
      const auth = await authenticateUser({
        email: 'admin@test.com',
        password: 'password'
      });
      authToken = auth.token;
      userId = auth.user.id;
    });

    describe('GET /api/workshops', () => {
      it('should get all workshops', async () => {
        const response = await request(app)
          .get('/api/workshops')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.workshops).toBeInstanceOf(Array);
        expect(response.body.total).toBeDefined();
        expect(response.body.workshops.length).toBeGreaterThan(0);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/workshops?page=1&limit=5')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.workshops.length).toBeLessThanOrEqual(5);
        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(5);
      });

      it('should filter by status', async () => {
        const response = await request(app)
          .get('/api/workshops?status=published')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        response.body.workshops.forEach((workshop: any) => {
          expect(workshop.status).toBe('published');
        });
      });

      it('should return 401 without authentication', async () => {
        await request(app)
          .get('/api/workshops')
          .expect(401);
      });
    });

    describe('POST /api/workshops', () => {
      it('should create a new workshop', async () => {
        const workshopData = {
          title: 'New Test Workshop',
          description: 'A new test workshop',
          slug: 'new-test-workshop',
          maxParticipants: 25,
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 172800000).toISOString(),
          isOnline: true,
          price: 99.99,
          currency: 'USD',
          tags: ['test', 'workshop']
        };

        const response = await request(app)
          .post('/api/workshops')
          .set('Authorization', `Bearer ${authToken}`)
          .send(workshopData)
          .expect(201);

        expect(response.body.title).toBe(workshopData.title);
        expect(response.body.description).toBe(workshopData.description);
        expect(response.body.createdBy).toBe(userId);
        expect(response.body.status).toBe('draft');
      });

      it('should validate required fields', async () => {
        const invalidWorkshop = {
          // Missing required fields
          description: 'Missing title'
        };

        await request(app)
          .post('/api/workshops')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidWorkshop)
          .expect(400);
      });

      it('should return 401 without authentication', async () => {
        const workshopData = {
          title: 'Test Workshop',
          description: 'A test workshop'
        };

        await request(app)
          .post('/api/workshops')
          .send(workshopData)
          .expect(401);
      });
    });

    describe('GET /api/workshops/:id', () => {
      it('should get a specific workshop', async () => {
        // First create a workshop
        const createResponse = await request(app)
          .post('/api/workshops')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Test Workshop',
            description: 'A test workshop',
            slug: 'test-workshop-get'
          });

        const workshopId = createResponse.body.id;

        const response = await request(app)
          .get(`/api/workshops/${workshopId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.id).toBe(workshopId);
        expect(response.body.title).toBe('Test Workshop');
      });

      it('should return 404 for non-existent workshop', async () => {
        await request(app)
          .get('/api/workshops/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });

    describe('PUT /api/workshops/:id', () => {
      it('should update a workshop', async () => {
        // First create a workshop
        const createResponse = await request(app)
          .post('/api/workshops')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Original Title',
            description: 'Original description',
            slug: 'original-workshop'
          });

        const workshopId = createResponse.body.id;
        const updateData = {
          title: 'Updated Title',
          description: 'Updated description',
          status: 'published'
        };

        const response = await request(app)
          .put(`/api/workshops/${workshopId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.title).toBe(updateData.title);
        expect(response.body.description).toBe(updateData.description);
        expect(response.body.status).toBe(updateData.status);
      });

      it('should return 404 when updating non-existent workshop', async () => {
        const updateData = {
          title: 'Updated Title'
        };

        await request(app)
          .put('/api/workshops/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(404);
      });
    });

    describe('DELETE /api/workshops/:id', () => {
      it('should delete a workshop', async () => {
        // First create a workshop
        const createResponse = await request(app)
          .post('/api/workshops')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Workshop to Delete',
            description: 'This workshop will be deleted',
            slug: 'workshop-to-delete'
          });

        const workshopId = createResponse.body.id;

        await request(app)
          .delete(`/api/workshops/${workshopId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Verify workshop is deleted
        await request(app)
          .get(`/api/workshops/${workshopId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });

      it('should return 404 when deleting non-existent workshop', async () => {
        await request(app)
          .delete('/api/workshops/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('Questionnaire Endpoints', () => {
    beforeEach(async () => {
      const auth = await authenticateUser({
        email: 'admin@test.com',
        password: 'password'
      });
      authToken = auth.token;
    });

    describe('GET /api/questionnaires', () => {
      it('should get all questionnaires', async () => {
        const response = await request(app)
          .get('/api/questionnaires')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.questionnaires).toBeInstanceOf(Array);
        expect(response.body.total).toBeDefined();
      });

      it('should filter by workshop', async () => {
        const response = await request(app)
          .get('/api/questionnaires?workshopId=workshop-1')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        response.body.questionnaires.forEach((questionnaire: any) => {
          expect(questionnaire.workshopId).toBe('workshop-1');
        });
      });
    });

    describe('POST /api/questionnaires', () => {
      it('should create a new questionnaire', async () => {
        const questionnaireData = {
          title: 'Test Questionnaire',
          description: 'A test questionnaire',
          workshopId: 'workshop-1',
          questions: [
            {
              id: 'q1',
              type: 'text',
              title: 'Test Question',
              required: true
            }
          ],
          settings: {
            allowAnonymous: false,
            collectEmail: true,
            showProgress: true
          }
        };

        const response = await request(app)
          .post('/api/questionnaires')
          .set('Authorization', `Bearer ${authToken}`)
          .send(questionnaireData)
          .expect(201);

        expect(response.body.title).toBe(questionnaireData.title);
        expect(response.body.description).toBe(questionnaireData.description);
        expect(response.body.createdBy).toBe(userId);
      });

      it('should validate questionnaire structure', async () => {
        const invalidQuestionnaire = {
          title: 'Invalid Questionnaire',
          // Missing required questions array
        };

        await request(app)
          .post('/api/questionnaires')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidQuestionnaire)
          .expect(400);
      });
    });

    describe('POST /api/questionnaires/:id/responses', () => {
      it('should submit a questionnaire response', async () => {
        // Create a questionnaire first
        const createResponse = await request(app)
          .post('/api/questionnaires')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Response Test Questionnaire',
            questions: [
              {
                id: 'q1',
                type: 'text',
                title: 'What is your name?',
                required: true
              },
              {
                id: 'q2',
                type: 'choice',
                title: 'Choose an option',
                required: true,
                options: [
                  { id: 'opt1', label: 'Option 1', value: 'opt1' },
                  { id: 'opt2', label: 'Option 2', value: 'opt2' }
                ]
              }
            ]
          });

        const questionnaireId = createResponse.body.id;
        const responseData = {
          answers: [
            { questionId: 'q1', value: 'John Doe', type: 'text' },
            { questionId: 'q2', value: 'opt1', type: 'choice' }
          ]
        };

        const response = await request(app)
          .post(`/api/questionnaires/${questionnaireId}/responses`)
          .send(responseData)
          .expect(201);

        expect(response.body.id).toBeDefined();
        expect(response.body.questionnaireId).toBe(questionnaireId);
        expect(response.body.answers).toEqual(responseData.answers);
      });

      it('should validate required questions are answered', async () => {
        // Create a questionnaire with required questions
        const createResponse = await request(app)
          .post('/api/questionnaires')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Validation Test Questionnaire',
            questions: [
              {
                id: 'q1',
                type: 'text',
                title: 'Required question',
                required: true
              },
              {
                id: 'q2',
                type: 'text',
                title: 'Optional question',
                required: false
              }
            ]
          });

        const questionnaireId = createResponse.body.id;
        const invalidResponse = {
          answers: [
            // Missing answer for required question q1
            { questionId: 'q2', value: 'Optional answer', type: 'text' }
          ]
        };

        await request(app)
          .post(`/api/questionnaires/${questionnaireId}/responses`)
          .send(invalidResponse)
          .expect(400);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle missing required headers', async () => {
      await request(app)
        .get('/api/workshops')
        // Missing Authorization header
        .expect(401);
    });

    it('should rate limit login attempts', async () => {
      const credentials = {
        email: 'admin@test.com',
        password: 'wrongpassword'
      };

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);
      }

      // The next attempt should be rate limited
      await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(429);
    });
  });

  describe('Security Tests', () => {
    it('should sanitize user input', async () => {
      const maliciousInput = {
        email: 'test@test.com',
        username: '<script>alert("xss")</script>',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousInput)
        .expect(201);

      // Username should be sanitized
      expect(response.body.user.username).not.toContain('<script>');
    });

    it('should prevent SQL injection', async () => {
      const sqlInjectionAttempt = {
        email: "'; DROP TABLE users; --",
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123'
      };

      // Should not cause database error
      const response = await request(app)
        .post('/api/auth/register')
        .send(sqlInjectionAttempt)
        .expect(201);

      expect(response.body.user).toBeDefined();
    });

    it('should validate JWT tokens properly', async () => {
      const invalidToken = 'invalid.jwt.token';

      await request(app)
        .get('/api/workshops')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should handle expired JWT tokens', async () => {
      const expiredToken = 'expired.jwt.token';

      await request(app)
        .get('/api/workshops')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });
});