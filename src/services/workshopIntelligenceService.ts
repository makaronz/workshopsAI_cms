import { eq, and } from 'drizzle-orm';
import { db } from '../config/postgresql-database';
import {
  workshopForms,
  formQuestions,
  participantContributions,
  participantAnswers,
  WorkshopForm,
  FormQuestion,
  ParticipantContribution,
  ParticipantAnswer,
  InsertWorkshopForm,
  InsertFormQuestion,
  InsertParticipantContribution,
  InsertParticipantAnswer,
} from '../models/postgresql-schema';

export class WorkshopIntelligenceService {
  // ===== FORM MANAGEMENT =====

  /**
   * Create a new form for a workshop
   */
  async createForm(workshopId: string): Promise<WorkshopForm> {
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
  async getFormByWorkshopId(
    workshopId: string,
  ): Promise<(WorkshopForm & { questions: FormQuestion[] }) | null> {
    const [form] = await db
      .select()
      .from(workshopForms)
      .where(eq(workshopForms.workshopId, workshopId));

    if (!form) {
      return null;
    }

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
   * Lock form (disable editing for participants)
   */
  async lockForm(workshopId: string): Promise<WorkshopForm> {
    const [form] = await db
      .update(workshopForms)
      .set({ isEditable: false, updatedAt: new Date() })
      .where(eq(workshopForms.workshopId, workshopId))
      .returning();

    if (!form) {
      throw new Error('Form not found');
    }

    return form;
  }

  /**
   * Unlock form (enable editing for participants)
   */
  async unlockForm(workshopId: string): Promise<WorkshopForm> {
    const [form] = await db
      .update(workshopForms)
      .set({ isEditable: true, updatedAt: new Date() })
      .where(eq(workshopForms.workshopId, workshopId))
      .returning();

    if (!form) {
      throw new Error('Form not found');
    }

    return form;
  }

  // ===== QUESTION MANAGEMENT =====

  /**
   * Add a question to a form
   */
  async addQuestion(
    workshopId: string,
    questionData: Omit<InsertFormQuestion, 'formId'>,
  ): Promise<FormQuestion> {
    // Get form ID from workshop ID
    const [form] = await db
      .select()
      .from(workshopForms)
      .where(eq(workshopForms.workshopId, workshopId));

    if (!form) {
      throw new Error('Form not found for this workshop');
    }

    const [question] = await db
      .insert(formQuestions)
      .values({
        formId: form.id,
        ...questionData,
      })
      .returning();

    return question;
  }

  /**
   * Update a question
   */
  async updateQuestion(
    questionId: string,
    questionData: Partial<InsertFormQuestion>,
  ): Promise<FormQuestion> {
    const [question] = await db
      .update(formQuestions)
      .set(questionData)
      .where(eq(formQuestions.id, questionId))
      .returning();

    if (!question) {
      throw new Error('Question not found');
    }

    return question;
  }

  /**
   * Delete a question
   */
  async deleteQuestion(questionId: string): Promise<void> {
    await db.delete(formQuestions).where(eq(formQuestions.id, questionId));
  }

  // ===== PARTICIPANT CONTRIBUTIONS =====

  /**
   * Submit or update participant contribution
   */
  async submitContribution(
    workshopId: string,
    userId: string,
    answers: Array<{ questionId: string; answerData: any }>,
    status: 'draft' | 'submitted' = 'draft',
  ): Promise<ParticipantContribution> {
    // Check if form is editable
    const [form] = await db
      .select()
      .from(workshopForms)
      .where(eq(workshopForms.workshopId, workshopId));

    if (!form) {
      throw new Error('Form not found for this workshop');
    }

    if (!form.isEditable) {
      throw new Error('Form is locked and cannot be edited');
    }

    // Check if contribution already exists
    const [existingContribution] = await db
      .select()
      .from(participantContributions)
      .where(
        and(
          eq(participantContributions.workshopId, workshopId),
          eq(participantContributions.userId, userId),
        ),
      );

    let contribution: ParticipantContribution;

    if (existingContribution) {
      // Update existing contribution
      [contribution] = await db
        .update(participantContributions)
        .set({
          status,
          submittedAt: status === 'submitted' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(participantContributions.id, existingContribution.id))
        .returning();
    } else {
      // Create new contribution
      [contribution] = await db
        .insert(participantContributions)
        .values({
          workshopId,
          userId,
          status,
          submittedAt: status === 'submitted' ? new Date() : null,
        })
        .returning();
    }

    // Save answers
    for (const answer of answers) {
      const [existingAnswer] = await db
        .select()
        .from(participantAnswers)
        .where(
          and(
            eq(participantAnswers.contributionId, contribution.id),
            eq(participantAnswers.questionId, answer.questionId),
          ),
        );

      if (existingAnswer) {
        // Update existing answer
        await db
          .update(participantAnswers)
          .set({
            answerData: answer.answerData,
            updatedAt: new Date(),
          })
          .where(eq(participantAnswers.id, existingAnswer.id));
      } else {
        // Create new answer
        await db.insert(participantAnswers).values({
          contributionId: contribution.id,
          questionId: answer.questionId,
          answerData: answer.answerData,
        });
      }
    }

    return contribution;
  }

  /**
   * Get user's contribution for a workshop
   */
  async getUserContribution(
    workshopId: string,
    userId: string,
  ): Promise<
    | (ParticipantContribution & { answers: ParticipantAnswer[] })
    | null
  > {
    const [contribution] = await db
      .select()
      .from(participantContributions)
      .where(
        and(
          eq(participantContributions.workshopId, workshopId),
          eq(participantContributions.userId, userId),
        ),
      );

    if (!contribution) {
      return null;
    }

    const answers = await db
      .select()
      .from(participantAnswers)
      .where(eq(participantAnswers.contributionId, contribution.id));

    return {
      ...contribution,
      answers,
    };
  }

  /**
   * Get all contributions for a workshop (admin only)
   */
  async getAllContributions(
    workshopId: string,
  ): Promise<Array<ParticipantContribution & { answers: ParticipantAnswer[] }>> {
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
}
