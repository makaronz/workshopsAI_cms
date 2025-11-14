import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/postgresql-database';
import { users, workshops, questionnaires } from '../src/models/postgresql-schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

describe('Workshop CRUD API', () => {
  let authToken: string;
  let testUserId: string;
  let testWorkshopId: string;
  let testQuestionnaireId: string;

  beforeAll(async () => {
    // Create test user with sociologist-editor role
    const testUser = await db
      .insert(users)
      .values({
        openId: 'test-user-sociologist',
        email: 'sociologist@example.com',
        name: 'Test Sociologist',
        role: 'sociologist-editor',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    testUserId = testUser[0].id;

    // Create JWT token for test user
    authToken = jwt.sign(
      {
        userId: testUserId,
        email: 'sociologist@example.com',
        role: 'sociologist-editor'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await db.delete(questionnaires).where(eq(questionnaires.createdBy, testUserId));
      await db.delete(workshops).where(eq(workshops.createdBy, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  describe('POST /api/v1/workshops', () => {
    it('should create a new workshop', async () => {
      const workshopData = {
        slug: 'test-workshop-integration',
        titleI18n: {
          pl: 'Test Warsztat Integracja',
          en: 'Test Integration Workshop'
        },
        descriptionI18n: {
          pl: 'Testowy warsztat do testowania integracji systemu',
          en: 'Test workshop for testing system integration'
        },
        language: 'pl' as const,
        price: 100,
        currency: 'PLN',
        enableWaitingList: true,
        templateTheme: 'integracja' as const
      };

      const response = await request(app)
        .post('/api/v1/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workshopData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        slug: workshopData.slug,
        status: 'draft',
        language: 'pl',
        price: '100.00',
        currency: 'PLN',
        enableWaitingList: true,
        templateTheme: 'integracja'
      });

      testWorkshopId = response.body.data.id;

      // Verify workshop was created in database
      const dbWorkshop = await db
        .select()
        .from(workshops)
        .where(eq(workshops.id, testWorkshopId))
        .limit(1);

      expect(dbWorkshop).toHaveLength(1);
      expect(dbWorkshop[0].slug).toBe(workshopData.slug);
    });

    it('should return 400 for invalid workshop data', async () => {
      const invalidData = {
        slug: '', // Invalid empty slug
        titleI18n: {}, // Invalid empty title
        descriptionI18n: {} // Invalid empty description
      };

      const response = await request(app)
        .post('/api/v1/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation Error');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const workshopData = {
        slug: 'test-workshop-unauth',
        titleI18n: { pl: 'Test', en: 'Test' },
        descriptionI18n: { pl: 'Test', en: 'Test' }
      };

      await request(app)
        .post('/api/v1/workshops')
        .send(workshopData)
        .expect(401);
    });

    it('should return 403 for insufficient permissions', async () => {
      // Create user with participant role
      const participantUser = await db
        .insert(users)
        .values({
          openId: 'test-user-participant',
          email: 'participant@example.com',
          name: 'Test Participant',
          role: 'participant',
          isActive: true,
          emailVerified: true,
        })
        .returning();

      const participantToken = jwt.sign(
        {
          userId: participantUser[0].id,
          email: 'participant@example.com',
          role: 'participant'
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const workshopData = {
        slug: 'test-workshop-forbidden',
        titleI18n: { pl: 'Test', en: 'Test' },
        descriptionI18n: { pl: 'Test', en: 'Test' }
      };

      await request(app)
        .post('/api/v1/workshops')
        .set('Authorization', `Bearer ${participantToken}`)
        .send(workshopData)
        .expect(403);

      // Clean up
      await db.delete(users).where(eq(users.id, participantUser[0].id));
    });
  });

  describe('GET /api/v1/workshops', () => {
    it('should list workshops with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('workshops');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.workshops)).toBe(true);
      expect(response.body.data.pagination).toMatchObject({
        total: expect.any(Number),
        limit: 20,
        offset: 0,
        hasMore: expect.any(Boolean)
      });
    });

    it('should filter workshops by status', async () => {
      const response = await request(app)
        .get('/api/v1/workshops?status=draft')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.status).toBe('draft');
      expect(response.body.data.workshops.every((w: any) => w.status === 'draft')).toBe(true);
    });

    it('should filter workshops by limit and offset', async () => {
      const response = await request(app)
        .get('/api/v1/workshops?limit=5&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workshops.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/workshops/:id', () => {
    it('should get workshop by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/workshops/${testWorkshopId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testWorkshopId,
        slug: 'test-workshop-integration',
        status: 'draft'
      });
      expect(response.body.data).toHaveProperty('creator');
      expect(response.body.data).toHaveProperty('sessions');
      expect(response.body.data).toHaveProperty('questionnaires');
      expect(response.body.data).toHaveProperty('tags');
    });

    it('should return 404 for non-existent workshop', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .get(`/api/v1/workshops/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app)
        .get(`/api/v1/workshops/${testWorkshopId}`)
        .expect(401);
    });
  });

  describe('PATCH /api/v1/workshops/:id', () => {
    it('should update workshop', async () => {
      const updateData = {
        titleI18n: {
          pl: 'Zaktualizowany Test Warsztat',
          en: 'Updated Test Workshop'
        },
        price: 150,
        status: 'published' as const
      };

      const response = await request(app)
        .patch(`/api/v1/workshops/${testWorkshopId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.titleI18n).toEqual(updateData.titleI18n);
      expect(response.body.data.price).toBe('150.00');
      expect(response.body.data.status).toBe('published');
      expect(response.body.data.publishedAt).toBeTruthy();
    });

    it('should return 404 for non-existent workshop', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .patch(`/api/v1/workshops/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ titleI18n: { pl: 'Test', en: 'Test' } })
        .expect(404);
    });
  });

  describe('GET /api/v1/workshops/:id/publish-checklist', () => {
    it('should check workshop publishing checklist', async () => {
      const response = await request(app)
        .get(`/api/v1/workshops/${testWorkshopId}/publish-checklist`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        hasSessions: expect.any(Boolean),
        hasQuestionnaire: expect.any(Boolean),
        allRequiredFields: expect.any(Boolean),
        wcagCompliant: expect.any(Boolean),
        canPublish: expect.any(Boolean),
        errors: expect.any(Array)
      });

      // Should have errors since no sessions or questionnaires exist yet
      expect(response.body.data.canPublish).toBe(false);
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent workshop', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .get(`/api/v1/workshops/${fakeId}/publish-checklist`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/workshops/:id', () => {
    it('should soft delete workshop', async () => {
      await request(app)
        .delete(`/api/v1/workshops/${testWorkshopId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify workshop was soft deleted (deletedAt set)
      const dbWorkshop = await db
        .select()
        .from(workshops)
        .where(eq(workshops.id, testWorkshopId))
        .limit(1);

      expect(dbWorkshop).toHaveLength(1);
      expect(dbWorkshop[0].deletedAt).toBeTruthy();
    });

    it('should return 404 for already deleted workshop', async () => {
      await request(app)
        .delete(`/api/v1/workshops/${testWorkshopId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});

describe('Questionnaire CRUD API', () => {
  let authToken: string;
  let testUserId: string;
  let testWorkshopId: string;
  let testQuestionnaireId: string;

  beforeAll(async () => {
    // Create test user with sociologist-editor role
    const testUser = await db
      .insert(users)
      .values({
        openId: 'test-user-sociologist-2',
        email: 'sociologist2@example.com',
        name: 'Test Sociologist 2',
        role: 'sociologist-editor',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    testUserId = testUser[0].id;

    // Create JWT token for test user
    authToken = jwt.sign(
      {
        userId: testUserId,
        email: 'sociologist2@example.com',
        role: 'sociologist-editor'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test workshop for questionnaire
    const testWorkshop = await db
      .insert(workshops)
      .values({
        slug: 'test-workshop-for-questionnaire',
        titleI18n: { pl: 'Test', en: 'Test' },
        descriptionI18n: { pl: 'Test', en: 'Test' },
        status: 'draft',
        createdBy: testUserId
      })
      .returning();

    testWorkshopId = testWorkshop[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await db.delete(questionnaires).where(eq(questionnaires.createdBy, testUserId));
      await db.delete(workshops).where(eq(workshops.createdBy, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  describe('POST /api/v1/workshops/:workshopId/questionnaires', () => {
    it('should create questionnaire for workshop', async () => {
      const questionnaireData = {
        titleI18n: {
          pl: 'Ankieta Testowa',
          en: 'Test Questionnaire'
        },
        instructionsI18n: {
          pl: 'Proszę odpowiedzieć na wszystkie pytania',
          en: 'Please answer all questions'
        },
        settings: {
          anonymous: false,
          require_consent: true,
          show_all_questions: true,
          allow_edit: true,
          question_style: 'first_person_plural' as const
        }
      };

      const response = await request(app)
        .post(`/api/v1/workshops/${testWorkshopId}/questionnaires`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionnaireData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        workshopId: testWorkshopId,
        status: 'draft',
        settings: questionnaireData.settings
      });

      testQuestionnaireId = response.body.data.id;
    });

    it('should return 404 for non-existent workshop', async () => {
      const fakeWorkshopId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .post(`/api/v1/workshops/${fakeWorkshopId}/questionnaires`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          titleI18n: { pl: 'Test', en: 'Test' }
        })
        .expect(404);
    });
  });

  describe('GET /api/v1/questionnaires/:id', () => {
    it('should get questionnaire by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/questionnaires/${testQuestionnaireId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testQuestionnaireId,
        workshopId: testWorkshopId,
        status: 'draft'
      });
      expect(response.body.data).toHaveProperty('creator');
      expect(response.body.data).toHaveProperty('questionGroups');
      expect(response.body.data.questionGroups).toEqual([]);
    });

    it('should return 404 for non-existent questionnaire', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .get(`/api/v1/questionnaires/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/workshops/:workshopId/questionnaires', () => {
    it('should get questionnaires for workshop', async () => {
      const response = await request(app)
        .get(`/api/v1/workshops/${testWorkshopId}/questionnaires`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('questionnaires');
      expect(Array.isArray(response.body.data.questionnaires)).toBe(true);
      expect(response.body.data.questionnaires.length).toBe(1);
      expect(response.body.data.questionnaires[0].id).toBe(testQuestionnaireId);
    });
  });

  describe('PATCH /api/v1/questionnaires/:id', () => {
    it('should update questionnaire', async () => {
      const updateData = {
        titleI18n: {
          pl: 'Zaktualizowana Ankieta',
          en: 'Updated Questionnaire'
        },
        status: 'published' as const
      };

      const response = await request(app)
        .patch(`/api/v1/questionnaires/${testQuestionnaireId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.titleI18n).toEqual(updateData.titleI18n);
      expect(response.body.data.status).toBe('published');
      expect(response.body.data.publishedAt).toBeTruthy();
    });
  });

  describe('DELETE /api/v1/questionnaires/:id', () => {
    it('should soft delete questionnaire', async () => {
      await request(app)
        .delete(`/api/v1/questionnaires/${testQuestionnaireId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify questionnaire was soft deleted
      const dbQuestionnaire = await db
        .select()
        .from(questionnaires)
        .where(eq(questionnaires.id, testQuestionnaireId))
        .limit(1);

      expect(dbQuestionnaire).toHaveLength(1);
      expect(dbQuestionnaire[0].deletedAt).toBeTruthy();
    });

    it('should return 404 for already deleted questionnaire', async () => {
      await request(app)
        .delete(`/api/v1/questionnaires/${testQuestionnaireId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});