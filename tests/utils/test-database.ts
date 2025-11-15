import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/models/llm-schema';
import { eq } from 'drizzle-orm';

// Test database configuration
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';

class TestDatabase {
  private client: postgres.Sql | null = null;
  private db: ReturnType<typeof drizzle> | null = null;

  async connect() {
    if (!this.client) {
      this.client = postgres(TEST_DB_URL, {
        max: 1,
        idle_timeout: 20,
        max_lifetime: 60,
      });
      this.db = drizzle(this.client, { schema });
    }
    return this.db;
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.db = null;
    }
  }

  async clearAllTables() {
    const db = await this.connect();

    // Delete data in order to respect foreign key constraints
    await db.delete(schema.llmAnalyses);
    await db.delete(schema.analysisJobs);
    await db.delete(schema.responses);
    await db.delete(schema.questions);
    await db.delete(schema.questionnaires);
    await db.delete(schema.users);
    await db.delete(schema.consents);
  }

  async createTestUser(userData: Partial<typeof schema.users.$inferInsert>) {
    const db = await this.connect();
    const [user] = await db.insert(schema.users).values({
      id: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      passwordHash: 'test-hash',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...userData,
    }).returning();

    return user;
  }

  async createTestQuestionnaire(userId: string, questionnaireData: Partial<typeof schema.questionnaires.$inferInsert>) {
    const db = await this.connect();
    const [questionnaire] = await db.insert(schema.questionnaires).values({
      id: `test-questionnaire-${Date.now()}`,
      title: 'Test Questionnaire',
      description: 'Test Description',
      createdBy: userId,
      isPublic: false,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...questionnaireData,
    }).returning();

    return questionnaire;
  }

  async createTestQuestion(questionnaireId: string, questionData: Partial<typeof schema.questions.$inferInsert>) {
    const db = await this.connect();
    const [question] = await db.insert(schema.questions).values({
      id: `test-question-${Date.now()}`,
      questionnaireId,
      type: 'text',
      text: 'Test Question',
      required: true,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...questionData,
    }).returning();

    return question;
  }

  async createTestResponse(userId: string, questionnaireId: string, responseData: Partial<typeof schema.responses.$inferInsert>) {
    const db = await this.connect();
    const [response] = await db.insert(schema.responses).values({
      id: `test-response-${Date.now()}`,
      userId,
      questionnaireId,
      status: 'completed',
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...responseData,
    }).returning();

    return response;
  }

  async createTestAnalysisJob(questionnaireId: string, jobData: Partial<typeof schema.analysisJobs.$inferInsert>) {
    const db = await this.connect();
    const [job] = await db.insert(schema.analysisJobs).values({
      id: `test-job-${Date.now()}`,
      questionnaireId,
      status: 'pending',
      analysisTypes: ['thematic'],
      triggeredBy: 'test-user',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...jobData,
    }).returning();

    return job;
  }

  async createTestLLMAnalysis(jobId: string, analysisData: Partial<typeof schema.llmAnalyses.$inferInsert>) {
    const db = await this.connect();
    const [analysis] = await db.insert(schema.llmAnalyses).values({
      id: `test-analysis-${Date.now()}`,
      jobId,
      analysisType: 'thematic',
      status: 'completed',
      result: { themes: [], insights: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...analysisData,
    }).returning();

    return analysis;
  }

  // Helper methods for test data generation
  generateTestUserData(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
    return {
      id: `test-user-${Date.now()}-${Math.random()}`,
      email: `test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'test-password-hash',
      firstName: 'Test',
      lastName: 'User',
      role: 'user' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  generateTestQuestionnaireData(userId: string, overrides: Partial<typeof schema.questionnaires.$inferInsert> = {}) {
    return {
      id: `test-questionnaire-${Date.now()}-${Math.random()}`,
      title: 'Test Questionnaire',
      description: 'Test Description',
      createdBy: userId,
      isPublic: false,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  generateTestQuestionData(questionnaireId: string, overrides: Partial<typeof schema.questions.$inferInsert> = {}) {
    return {
      id: `test-question-${Date.now()}-${Math.random()}`,
      questionnaireId,
      type: 'text' as const,
      text: 'Test Question',
      required: true,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }
}

// Singleton instance
export const testDatabase = new TestDatabase();

// Test helpers
export const createTestDataSet = async () => {
  const user = await testDatabase.createTestUser();
  const questionnaire = await testDatabase.createTestQuestionnaire(user.id);
  const question = await testDatabase.createTestQuestion(questionnaire.id);
  const response = await testDatabase.createTestResponse(user.id, questionnaire.id);
  const job = await testDatabase.createTestAnalysisJob(questionnaire.id);
  const analysis = await testDatabase.createTestLLMAnalysis(job.id);

  return { user, questionnaire, question, response, job, analysis };
};

export const cleanupTestData = async () => {
  await testDatabase.clearAllTables();
};