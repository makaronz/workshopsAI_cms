import request from 'supertest';
import { app } from '../../src/index';
import { db } from '../../src/config/postgresql-database';
import { users, workshops, questionnaires, llmAnalyses } from '../../src/models/postgresql-schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

describe('Analysis Sharing API', () => {
    let authToken: string;
    let testUserId: string;
    let testWorkshopId: string;
    let testQuestionnaireId: string;
    let testAnalysisId: string;

    beforeAll(async () => {
        // Create test user
        const testUser = await db
            .insert(users)
            .values({
                openId: 'test-user-admin',
                email: 'admin@example.com',
                name: 'Test Admin',
                role: 'admin',
                isActive: true,
                emailVerified: true,
            })
            .returning();

        testUserId = testUser[0].id;

        // Create JWT token
        authToken = jwt.sign(
            {
                userId: testUserId,
                email: 'admin@example.com',
                role: 'admin'
            },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );

        // Create workshop
        const testWorkshop = await db
            .insert(workshops)
            .values({
                slug: 'test-workshop-analysis',
                titleI18n: { pl: 'Test', en: 'Test' },
                descriptionI18n: { pl: 'Test', en: 'Test' },
                status: 'published',
                createdBy: testUserId
            })
            .returning();

        testWorkshopId = testWorkshop[0].id;

        // Create questionnaire
        const testQuestionnaire = await db
            .insert(questionnaires)
            .values({
                workshopId: testWorkshopId,
                titleI18n: { pl: 'Ankieta', en: 'Questionnaire' },
                status: 'published',
                createdBy: testUserId
            })
            .returning();

        testQuestionnaireId = testQuestionnaire[0].id;

        // Create analysis
        const testAnalysis = await db
            .insert(llmAnalyses)
            .values({
                questionnaireId: testQuestionnaireId,
                status: 'completed',
                results: { summary: 'Test summary' },
                isVisibleToParticipants: false,
                createdBy: testUserId
            })
            .returning();

        testAnalysisId = testAnalysis[0].id;
    });

    afterAll(async () => {
        try {
            await db.delete(llmAnalyses).where(eq(llmAnalyses.id, testAnalysisId));
            await db.delete(questionnaires).where(eq(questionnaires.id, testQuestionnaireId));
            await db.delete(workshops).where(eq(workshops.id, testWorkshopId));
            await db.delete(users).where(eq(users.id, testUserId));
        } catch (error) {
            console.error('Error cleaning up test data:', error);
        }
    });

    describe('PUT /api/v1/workshop-intelligence/analyses/:id/share', () => {
        it('should share analysis with participants', async () => {
            const response = await request(app)
                .put(`/api/v1/workshop-intelligence/analyses/${testAnalysisId}/share`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Analysis shared');

            // Verify in DB
            const analysis = await db
                .select()
                .from(llmAnalyses)
                .where(eq(llmAnalyses.id, testAnalysisId))
                .limit(1);

            expect(analysis[0].isVisibleToParticipants).toBe(true);
        });
    });

    describe('PUT /api/v1/workshop-intelligence/analyses/:id/hide', () => {
        it('should hide analysis from participants', async () => {
            // First ensure it's shared
            await db
                .update(llmAnalyses)
                .set({ isVisibleToParticipants: true })
                .where(eq(llmAnalyses.id, testAnalysisId));

            const response = await request(app)
                .put(`/api/v1/workshop-intelligence/analyses/${testAnalysisId}/hide`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Analysis hidden');

            // Verify in DB
            const analysis = await db
                .select()
                .from(llmAnalyses)
                .where(eq(llmAnalyses.id, testAnalysisId))
                .limit(1);

            expect(analysis[0].isVisibleToParticipants).toBe(false);
        });
    });
});
