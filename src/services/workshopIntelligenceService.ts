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
}

export const workshopIntelligenceService = new WorkshopIntelligenceService();
