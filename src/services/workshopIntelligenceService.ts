/**
 * Workshop Intelligence Service
 * Manages workshop forms, participant contributions, and LLM analyses
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/postgresql-database.js';
import {
  workshopForms,
  formQuestions,
  participantContributions,
  participantAnswers,
  workshopLlmAnalyses,
  analysisResults,
  promptTemplates,
  type WorkshopForm,
  type InsertWorkshopForm,
  type FormQuestion,
  type InsertFormQuestion,
  type ParticipantContribution,
  type InsertParticipantContribution,
  type ParticipantAnswer,
  type InsertParticipantAnswer,
} from '../models/postgresql-schema.js';

/**
 * Workshop Form Management
 */
export class WorkshopIntelligenceService {
  /**
   * Create a new form for a workshop
   */
  async createForm(workshopId: string, userId: string): Promise<WorkshopForm> {
    const [form] = await db
      .insert(workshopForms)
      .values({
        workshopId,
        isEditable: true,
      })
      .returning();

    return form;
  }

  /**
   * Get form by workshop ID
   */
  async getFormByWorkshopId(workshopId: string): Promise<WorkshopForm | null> {
    const [form] = await db
      .select()
      .from(workshopForms)
      .where(eq(workshopForms.workshopId, workshopId))
      .limit(1);

    return form || null;
  }

  /**
   * Get form with questions
   */
  async getFormWithQuestions(workshopId: string) {
    const form = await this.getFormByWorkshopId(workshopId);
    if (!form) return null;

    const questions = await db
      .select()
      .from(formQuestions)
      .where(eq(formQuestions.formId, form.id))
      .orderBy(formQuestions.displayOrder);

    return {
      ...form,
      questions,
    };
  }

  /**
   * Add question to form
   */
  async addQuestion(
    formId: string,
    question: Omit<InsertFormQuestion, 'formId'>,
  ): Promise<FormQuestion> {
    const [newQuestion] = await db
      .insert(formQuestions)
      .values({
        ...question,
        formId,
      })
      .returning();

    return newQuestion;
  }

  /**
   * Update question
   */
  async updateQuestion(
    questionId: string,
    updates: Partial<Omit<FormQuestion, 'id' | 'formId' | 'createdAt'>>,
  ): Promise<FormQuestion> {
    const [updated] = await db
      .update(formQuestions)
      .set(updates)
      .where(eq(formQuestions.id, questionId))
      .returning();

    return updated;
  }

  /**
   * Delete question
   */
  async deleteQuestion(questionId: string): Promise<void> {
    await db.delete(formQuestions).where(eq(formQuestions.id, questionId));
  }

  /**
   * Lock form (disable editing)
   */
  async lockForm(workshopId: string): Promise<WorkshopForm> {
    const [updated] = await db
      .update(workshopForms)
      .set({
        isEditable: false,
        updatedAt: new Date(),
      })
      .where(eq(workshopForms.workshopId, workshopId))
      .returning();

    return updated;
  }

  /**
   * Unlock form (enable editing)
   */
  async unlockForm(workshopId: string): Promise<WorkshopForm> {
    const [updated] = await db
      .update(workshopForms)
      .set({
        isEditable: true,
        updatedAt: new Date(),
      })
      .where(eq(workshopForms.workshopId, workshopId))
      .returning();

    return updated;
  }

  /**
   * Participant Contributions
   */

  /**
   * Create or get participant contribution
   */
  async getOrCreateContribution(
    workshopId: string,
    userId: string,
  ): Promise<ParticipantContribution> {
    // Check if contribution exists
    const [existing] = await db
      .select()
      .from(participantContributions)
      .where(
        and(
          eq(participantContributions.workshopId, workshopId),
          eq(participantContributions.userId, userId),
        ),
      )
      .limit(1);

    if (existing) return existing;

    // Create new contribution
    const [newContribution] = await db
      .insert(participantContributions)
      .values({
        workshopId,
        userId,
        status: 'draft',
      })
      .returning();

    return newContribution;
  }

  /**
   * Save answer to a question
   */
  async saveAnswer(
    contributionId: string,
    questionId: string,
    answerData: any,
  ): Promise<ParticipantAnswer> {
    // Check if answer exists
    const [existing] = await db
      .select()
      .from(participantAnswers)
      .where(
        and(
          eq(participantAnswers.contributionId, contributionId),
          eq(participantAnswers.questionId, questionId),
        ),
      )
      .limit(1);

    if (existing) {
      // Update existing answer
      const [updated] = await db
        .update(participantAnswers)
        .set({
          answerData,
          updatedAt: new Date(),
        })
        .where(eq(participantAnswers.id, existing.id))
        .returning();

      return updated;
    }

    // Create new answer
    const [newAnswer] = await db
      .insert(participantAnswers)
      .values({
        contributionId,
        questionId,
        answerData,
      })
      .returning();

    return newAnswer;
  }

  /**
   * Submit contribution
   */
  async submitContribution(contributionId: string): Promise<ParticipantContribution> {
    const [updated] = await db
      .update(participantContributions)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(participantContributions.id, contributionId))
      .returning();

    return updated;
  }

  /**
   * Get all contributions for a workshop with answers
   */
  async getWorkshopContributions(workshopId: string) {
    const contributions = await db
      .select()
      .from(participantContributions)
      .where(eq(participantContributions.workshopId, workshopId));

    const contributionsWithAnswers = await Promise.all(
      contributions.map(async contribution => {
        const answers = await db
          .select()
          .from(participantAnswers)
          .where(eq(participantAnswers.contributionId, contribution.id));

        return {
          ...contribution,
          answers,
        };
      }),
    );

    return contributionsWithAnswers;
  }

  /**
   * Get participant's contribution with answers
   */
  async getParticipantContribution(contributionId: string) {
    const [contribution] = await db
      .select()
      .from(participantContributions)
      .where(eq(participantContributions.id, contributionId))
      .limit(1);

    if (!contribution) return null;

    const answers = await db
      .select()
      .from(participantAnswers)
      .where(eq(participantAnswers.contributionId, contributionId));

    return {
      ...contribution,
      answers,
    };
  }

  /**
   * Check if form is editable
   */
  async isFormEditable(workshopId: string): Promise<boolean> {
    const form = await this.getFormByWorkshopId(workshopId);
    return form?.isEditable ?? false;
  }

  /**
   * LLM Analysis Management
   */

  /**
   * Create a new analysis and queue processing job
   */
  async createAnalysis(
    workshopId: string,
    userId: string,
    modelName: string,
    promptTemplateId?: string,
    customInstructions?: string,
  ) {
    // Create analysis record
    const [analysis] = await db
      .insert(workshopLlmAnalyses)
      .values({
        workshopId,
        userId,
        modelName,
        promptTemplateId,
        customInstructions,
        status: 'pending',
        isSharedWithParticipants: false,
      })
      .returning();

    // Queue the analysis job (imported from workshopAnalysisQueue)
    const { queueAnalysisJob } = await import('../queues/workshopAnalysisQueue.js');
    await queueAnalysisJob({
      analysisId: analysis.id,
      workshopId,
      modelName: modelName as any,
      promptTemplateId,
      customInstructions,
    });

    return analysis;
  }

  /**
   * Get analysis by ID with results
   */
  async getAnalysis(analysisId: string) {
    const [analysis] = await db
      .select()
      .from(workshopLlmAnalyses)
      .where(eq(workshopLlmAnalyses.id, analysisId))
      .limit(1);

    if (!analysis) return null;

    // Get all results for this analysis
    const results = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.analysisId, analysisId));

    // Organize results by type
    const organizedResults = {
      summary: results.find((r) => r.resultType === 'summary')?.content,
      insights: results.find((r) => r.resultType === 'insights')?.content,
      themes: results.find((r) => r.resultType === 'themes')?.content,
      recommendations: results.find((r) => r.resultType === 'recommendations')?.content,
      plan: results.find((r) => r.resultType === 'plan')?.content,
      rawResponse: results.find((r) => r.resultType === 'summary')?.rawResponse,
    };

    return {
      ...analysis,
      results: organizedResults,
    };
  }

  /**
   * Get all analyses for a workshop
   */
  async getAllAnalyses(workshopId: string) {
    const analyses = await db
      .select()
      .from(workshopLlmAnalyses)
      .where(eq(workshopLlmAnalyses.workshopId, workshopId))
      .orderBy(desc(workshopLlmAnalyses.createdAt));

    return analyses;
  }

  /**
   * Share analysis with participants
   */
  async shareAnalysis(analysisId: string) {
    const [updated] = await db
      .update(workshopLlmAnalyses)
      .set({
        isSharedWithParticipants: true,
        updatedAt: new Date(),
      })
      .where(eq(workshopLlmAnalyses.id, analysisId))
      .returning();

    return updated;
  }

  /**
   * Hide analysis from participants
   */
  async hideAnalysis(analysisId: string) {
    const [updated] = await db
      .update(workshopLlmAnalyses)
      .set({
        isSharedWithParticipants: false,
        updatedAt: new Date(),
      })
      .where(eq(workshopLlmAnalyses.id, analysisId))
      .returning();

    return updated;
  }

  /**
   * Get prompt templates
   */
  async getPromptTemplates() {
    return await db.select().from(promptTemplates).orderBy(promptTemplates.name);
  }

  /**
   * Create custom prompt template
   */
  async createPromptTemplate(
    name: string,
    description: string,
    templateText: string,
    userId: string,
  ) {
    const [template] = await db
      .insert(promptTemplates)
      .values({
        name,
        description,
        templateText,
        createdBy: userId,
      })
      .returning();

    return template;
  }
}

export const workshopIntelligenceService = new WorkshopIntelligenceService();
