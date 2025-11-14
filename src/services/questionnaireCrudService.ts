import { Request } from 'express';
import { eq, and, desc, asc, count, isNull, sql } from 'drizzle-orm';
import { db, RLSHelper } from '../config/postgresql-database';
import {
  questionnaires,
  questionGroups,
  questions,
  responses,
  workshops,
  users,
  Questionnaire,
  InsertQuestionnaire,
  QuestionGroup,
  Question,
  InsertQuestionGroup,
  InsertQuestion,
  Session,
} from '../models/postgresql-schema';

// Types
export interface CreateQuestionnaireData {
  workshopId?: string;
  titleI18n: Record<string, string>;
  instructionsI18n?: Record<string, string>;
  settings?: {
    anonymous?: boolean;
    require_consent?: boolean;
    max_responses?: number | null;
    close_after_workshop?: boolean;
    show_all_questions?: boolean;
    allow_edit?: boolean;
    question_style?: 'first_person_plural' | 'third_person';
  };
}

export interface UpdateQuestionnaireData
  extends Partial<CreateQuestionnaireData> {
  status?: 'draft' | 'review' | 'published' | 'closed' | 'analyzed';
  publishedAt?: Date;
  closedAt?: Date;
}

export interface QuestionnaireWithContent extends Questionnaire {
  creator: { id: string; name: string; email: string };
  workshop?: {
    id: string;
    slug: string;
    titleI18n: Record<string, string>;
    status: string;
  };
  questionGroups: Array<{
    id: string;
    titleI18n: Record<string, string>;
    descriptionI18n?: Record<string, string>;
    orderIndex: number;
    uiConfig: Record<string, any>;
    questions: Array<{
      id: string;
      textI18n: Record<string, string>;
      type: string;
      optionsI18n?: Array<{
        value: string;
        label: { pl: string; en: string };
      }>;
      validation?: Record<string, any>;
      conditionalLogic?: Record<string, any>;
      orderIndex: number;
      helpTextI18n?: Record<string, string>;
    }>;
  }>;
}

// Types for Question Groups
export interface CreateQuestionGroupData {
  questionnaireId: string;
  titleI18n: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  orderIndex?: number;
  uiConfig?: {
    collapsed?: boolean;
    show_progress?: boolean;
    icon?: string | null;
    color?: string | null;
  };
}

export interface UpdateQuestionGroupData
  extends Partial<CreateQuestionGroupData> {}

// Types for Questions
export interface CreateQuestionData {
  groupId: string;
  textI18n: Record<string, string>;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'scale'
    | 'single_choice'
    | 'multiple_choice';
  optionsI18n?: Array<{
    value: string;
    label: { pl: string; en: string };
  }>;
  validation?: {
    required?: boolean;
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
    pattern?: string;
  };
  conditionalLogic?: {
    show_if?: {
      question_id: string;
      operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    };
  };
  orderIndex?: number;
  helpTextI18n?: { pl?: string; en?: string };
}

export interface UpdateQuestionData extends Partial<CreateQuestionData> {}

/**
 * Questionnaire CRUD Service
 */
export class QuestionnaireCrudService {
  /**
   * Get questionnaire by ID with full content
   */
  static async getQuestionnaireById(
    id: string,
    request?: Request,
  ): Promise<QuestionnaireWithContent | null> {
    // Get questionnaire with creator and workshop info
    const questionnaireResult = await db
      .select({
        // Questionnaire fields
        id: questionnaires.id,
        workshopId: questionnaires.workshopId,
        titleI18n: questionnaires.titleI18n,
        instructionsI18n: questionnaires.instructionsI18n,
        status: questionnaires.status,
        settings: questionnaires.settings,
        publishedAt: questionnaires.publishedAt,
        closedAt: questionnaires.closedAt,
        createdBy: questionnaires.createdBy,
        createdAt: questionnaires.createdAt,
        updatedAt: questionnaires.updatedAt,
        deletedAt: questionnaires.deletedAt,

        // Creator info
        creatorId: users.id,
        creatorName: users.name,
        creatorEmail: users.email,

        // Workshop info (optional)
        workshopId: workshops.id as any, // Alias conflict workaround
        workshopSlug: workshops.slug,
        workshopTitleI18n: workshops.titleI18n,
        workshopStatus: workshops.status,
      })
      .from(questionnaires)
      .leftJoin(users, eq(questionnaires.createdBy, users.id))
      .leftJoin(workshops, eq(questionnaires.workshopId, workshops.id))
      .where(and(eq(questionnaires.id, id), isNull(questionnaires.deletedAt)))
      .limit(1);

    if (!questionnaireResult || questionnaireResult.length === 0) {
      return null;
    }

    const questionnaireData = questionnaireResult[0];

    // Get question groups with questions
    const questionGroupsData = await db
      .select({
        groupId: questionGroups.id,
        groupTitleI18n: questionGroups.titleI18n,
        groupDescriptionI18n: questionGroups.descriptionI18n,
        groupOrderIndex: questionGroups.orderIndex,
        groupUiConfig: questionGroups.uiConfig,

        questionId: questions.id,
        questionTextI18n: questions.textI18n,
        questionType: questions.type,
        questionOptionsI18n: questions.optionsI18n,
        questionValidation: questions.validation,
        questionConditionalLogic: questions.conditionalLogic,
        questionOrderIndex: questions.orderIndex,
        questionHelpTextI18n: questions.helpTextI18n,
      })
      .from(questionGroups)
      .leftJoin(questions, eq(questionGroups.id, questions.groupId))
      .where(eq(questionGroups.questionnaireId, id))
      .orderBy(asc(questionGroups.orderIndex), asc(questions.orderIndex));

    // Group questions by question group
    const groupsMap = new Map<string, any>();

    questionGroupsData.forEach(row => {
      const groupId = row.groupId;

      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, {
          id: groupId,
          titleI18n: row.groupTitleI18n,
          descriptionI18n: row.groupDescriptionI18n,
          orderIndex: Number(row.groupOrderIndex),
          uiConfig: row.groupUiConfig,
          questions: [],
        });
      }

      if (row.questionId) {
        const group = groupsMap.get(groupId);
        group.questions.push({
          id: row.questionId,
          textI18n: row.questionTextI18n,
          type: row.questionType,
          optionsI18n: row.questionOptionsI18n,
          validation: row.questionValidation,
          conditionalLogic: row.questionConditionalLogic,
          orderIndex: Number(row.questionOrderIndex),
          helpTextI18n: row.questionHelpTextI18n,
        });
      }
    });

    const questionGroupsFormatted = Array.from(groupsMap.values());

    // Format response
    const questionnaire: QuestionnaireWithContent = {
      id: questionnaireData.id,
      workshopId: questionnaireData.workshopId,
      titleI18n: questionnaireData.titleI18n,
      instructionsI18n: questionnaireData.instructionsI18n,
      status: questionnaireData.status,
      settings: questionnaireData.settings,
      publishedAt: questionnaireData.publishedAt,
      closedAt: questionnaireData.closedAt,
      createdBy: questionnaireData.createdBy,
      createdAt: questionnaireData.createdAt,
      updatedAt: questionnaireData.updatedAt,
      deletedAt: questionnaireData.deletedAt,

      creator: {
        id: questionnaireData.creatorId,
        name: questionnaireData.creatorName,
        email: questionnaireData.creatorEmail,
      },

      questionGroups: questionGroupsFormatted,
    };

    // Add workshop info if available
    if (questionnaireData.workshopId) {
      questionnaire.workshop = {
        id: questionnaireData.workshopId,
        slug: questionnaireData.workshopSlug || '',
        titleI18n: questionnaireData.workshopTitleI18n || {},
        status: questionnaireData.workshopStatus || '',
      };
    }

    return questionnaire;
  }

  /**
   * Create questionnaire for workshop
   */
  static async createQuestionnaireForWorkshop(
    workshopId: string,
    data: CreateQuestionnaireData,
    request?: Request,
  ): Promise<Questionnaire> {
    const userId = request?.user?.id;

    // Verify workshop exists
    const workshopCheck = await db
      .select({ id: workshops.id })
      .from(workshops)
      .where(and(eq(workshops.id, workshopId), isNull(workshops.deletedAt)))
      .limit(1);

    if (!workshopCheck || workshopCheck.length === 0) {
      throw new Error('Workshop not found');
    }

    // Prepare questionnaire data
    const questionnaireData: InsertQuestionnaire = {
      workshopId,
      titleI18n: data.titleI18n,
      instructionsI18n: data.instructionsI18n || null,
      status: 'draft',
      settings: {
        anonymous: data.settings?.anonymous ?? false,
        require_consent: data.settings?.require_consent ?? true,
        max_responses: data.settings?.max_responses ?? null,
        close_after_workshop: data.settings?.close_after_workshop ?? false,
        show_all_questions: data.settings?.show_all_questions ?? true,
        allow_edit: data.settings?.allow_edit ?? true,
        question_style: data.settings?.question_style ?? 'first_person_plural',
      } as any, // Type cast to handle optional/required mismatch
      createdBy: userId || '',
    };

    // Insert questionnaire
    const result = await db
      .insert(questionnaires)
      .values(questionnaireData)
      .returning();

    const questionnaire = result[0];

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'questionnaires',
        questionnaire.id,
        'CREATE',
        null,
        questionnaireData,
        request?.ip,
        request?.get('User-Agent'),
      );
    }

    return questionnaire;
  }

  /**
   * Update questionnaire metadata
   */
  static async updateQuestionnaire(
    id: string,
    data: UpdateQuestionnaireData,
    request?: Request,
  ): Promise<Questionnaire> {
    const userId = request?.user?.id;

    // Get existing questionnaire
    const existingQuestionnaire = await db
      .select()
      .from(questionnaires)
      .where(and(eq(questionnaires.id, id), isNull(questionnaires.deletedAt)))
      .limit(1);

    if (!existingQuestionnaire || existingQuestionnaire.length === 0) {
      throw new Error('Questionnaire not found');
    }

    const questionnaire = existingQuestionnaire[0];

    // Prepare update data
    const updateData: Partial<InsertQuestionnaire> = {};

    if (data.titleI18n !== undefined) updateData.titleI18n = data.titleI18n;
    if (data.instructionsI18n !== undefined)
      updateData.instructionsI18n = data.instructionsI18n;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.publishedAt !== undefined)
      updateData.publishedAt = data.publishedAt;
    if (data.closedAt !== undefined) updateData.closedAt = data.closedAt;

    // Set publishedAt if status is changing to published
    if (data.status === 'published' && questionnaire.status !== 'published') {
      updateData.publishedAt = new Date();
    }

    // Set closedAt if status is changing to closed
    if (data.status === 'closed' && questionnaire.status !== 'closed') {
      updateData.closedAt = new Date();
    }

    // Add updatedAt timestamp
    updateData.updatedAt = new Date();

    // Update questionnaire
    const result = await db
      .update(questionnaires)
      .set(updateData)
      .where(eq(questionnaires.id, id))
      .returning();

    const updatedQuestionnaire = result[0];

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'questionnaires',
        id,
        'UPDATE',
        questionnaire,
        updateData,
        request?.ip,
        request?.get('User-Agent'),
      );
    }

    return updatedQuestionnaire;
  }

  /**
   * Delete questionnaire with dependency checking
   */
  static async deleteQuestionnaire(
    id: string,
    request?: Request,
  ): Promise<void> {
    const userId = request?.user?.id;

    // Get existing questionnaire with dependency info
    const existingQuestionnaire = await db
      .select({
        id: questionnaires.id,
        status: questionnaires.status,
        responseCount: count(
          sql`SELECT 1 FROM responses r JOIN questions q ON r.question_id = q.id JOIN question_groups qg ON q.group_id = qg.id WHERE qg.questionnaire_id = ${id}`,
        ),
      })
      .from(questionnaires)
      .where(and(eq(questionnaires.id, id), isNull(questionnaires.deletedAt)))
      .limit(1);

    if (!existingQuestionnaire || existingQuestionnaire.length === 0) {
      throw new Error('Questionnaire not found');
    }

    const questionnaire = existingQuestionnaire[0];

    // Check if questionnaire has responses and is published
    const hasResponses = Number(questionnaire.responseCount) > 0;
    const isPublished = questionnaire.status === 'published';

    if (hasResponses && isPublished) {
      throw new Error(
        'Cannot delete published questionnaire with responses. Consider archiving instead.',
      );
    }

    // Soft delete by setting deletedAt
    await db
      .update(questionnaires)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(questionnaires.id, id));

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'questionnaires',
        id,
        'DELETE',
        questionnaire,
        null,
        request?.ip,
        request?.get('User-Agent'),
      );
    }
  }

  /**
   * Get questionnaires for workshop
   */
  static async getQuestionnairesByWorkshop(
    workshopId: string,
    request?: Request,
  ): Promise<
    Array<
      Questionnaire & {
        creator: { id: string; name: string; email: string };
        questionGroupCount: number;
        questionCount: number;
        responseCount: number;
      }
    >
  > {
    const questionnairesData = await db
      .select({
        // Questionnaire fields
        id: questionnaires.id,
        workshopId: questionnaires.workshopId,
        titleI18n: questionnaires.titleI18n,
        instructionsI18n: questionnaires.instructionsI18n,
        status: questionnaires.status,
        settings: questionnaires.settings,
        publishedAt: questionnaires.publishedAt,
        closedAt: questionnaires.closedAt,
        createdBy: questionnaires.createdBy,
        createdAt: questionnaires.createdAt,
        updatedAt: questionnaires.updatedAt,
        deletedAt: questionnaires.deletedAt,

        // Creator info
        creatorId: users.id,
        creatorName: users.name,
        creatorEmail: users.email,

        // Aggregated counts
        questionGroupCount: count(questionGroups.id),
        questionCount: count(questions.id),
      })
      .from(questionnaires)
      .leftJoin(users, eq(questionnaires.createdBy, users.id))
      .leftJoin(
        questionGroups,
        eq(questionnaires.id, questionGroups.questionnaireId),
      )
      .leftJoin(questions, eq(questionGroups.id, questions.groupId))
      .where(
        and(
          eq(questionnaires.workshopId, workshopId),
          isNull(questionnaires.deletedAt),
        ),
      )
      .groupBy(questionnaires.id, users.id)
      .orderBy(desc(questionnaires.createdAt));

    // Get response counts for each questionnaire
    const questionnaireIds = questionnairesData.map(q => q.id);
    const responseCounts =
      questionnaireIds.length > 0
        ? await db
          .select({
            questionnaireId: questionGroups.questionnaireId,
            responseCount: count(
              sql`DISTINCT ${responses.userId} || '-' || ${responses.enrollmentId}`,
            ),
          })
          .from(questionGroups)
          .leftJoin(questions, eq(questionGroups.id, questions.groupId))
          .leftJoin(responses, eq(questions.id, responses.questionId))
          .where(
            questionnaireIds.length > 0
              ? sql`${questionGroups.questionnaireId} IN ${sql.raw(questionnaireIds.map(id => `'${id}'`).join(','))}`
              : undefined,
          )
          .groupBy(questionGroups.questionnaireId)
        : [];

    const responseCountsMap = responseCounts.reduce(
      (acc, item) => {
        acc[item.questionnaireId] = Number(item.responseCount);
        return acc;
      },
      {} as Record<string, number>,
    );

    return questionnairesData.map(questionnaire => ({
      ...questionnaire,
      creator: {
        id: questionnaire.creatorId,
        name: questionnaire.creatorName,
        email: questionnaire.creatorEmail,
      },
      questionGroupCount: Number(questionnaire.questionGroupCount),
      questionCount: Number(questionnaire.questionCount),
      responseCount: responseCountsMap[questionnaire.id] || 0,
    }));
  }

  // ===== QUESTION GROUP CRUD OPERATIONS =====

  /**
   * Create question group
   */
  static async createQuestionGroup(
    data: CreateQuestionGroupData,
    request?: Request,
  ): Promise<QuestionGroup> {
    const userId = request?.user?.id;

    // Verify questionnaire exists
    const questionnaireCheck = await db
      .select({ id: questionnaires.id })
      .from(questionnaires)
      .where(
        and(
          eq(questionnaires.id, data.questionnaireId),
          isNull(questionnaires.deletedAt),
        ),
      )
      .limit(1);

    if (!questionnaireCheck || questionnaireCheck.length === 0) {
      throw new Error('Questionnaire not found');
    }

    // Get next order index if not provided
    let orderIndex = data.orderIndex;
    if (orderIndex === undefined) {
      const maxOrderResult = await db
        .select({ maxOrder: questionGroups.orderIndex })
        .from(questionGroups)
        .where(eq(questionGroups.questionnaireId, data.questionnaireId));

      orderIndex =
        maxOrderResult.length > 0 ? Number(maxOrderResult[0].maxOrder) + 1 : 1;
    }

    // Prepare question group data
    const questionGroupData: InsertQuestionGroup = {
      questionnaireId: data.questionnaireId,
      titleI18n: data.titleI18n,
      descriptionI18n: data.descriptionI18n || null,
      orderIndex: orderIndex as any, // Cast to handle decimal type
      uiConfig: {
        collapsed: data.uiConfig?.collapsed ?? false,
        show_progress: data.uiConfig?.show_progress ?? true,
        icon: data.uiConfig?.icon ?? null,
        color: data.uiConfig?.color ?? null,
      } as any,
    };

    // Insert question group
    const result = await db
      .insert(questionGroups)
      .values(questionGroupData)
      .returning();

    const questionGroup = result[0];

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'question_groups',
        questionGroup.id,
        'CREATE',
        null,
        questionGroupData,
        request?.ip,
        request?.get('User-Agent'),
      );
    }

    return questionGroup;
  }

  /**
   * Update question group
   */
  static async updateQuestionGroup(
    id: string,
    data: UpdateQuestionGroupData,
    request?: Request,
  ): Promise<QuestionGroup> {
    const userId = request?.user?.id;

    // Get existing question group
    const existingQuestionGroup = await db
      .select()
      .from(questionGroups)
      .where(eq(questionGroups.id, id))
      .limit(1);

    if (!existingQuestionGroup || existingQuestionGroup.length === 0) {
      throw new Error('Question group not found');
    }

    const questionGroup = existingQuestionGroup[0];

    // Prepare update data
    const updateData: Partial<InsertQuestionGroup> = {};

    if (data.titleI18n !== undefined) updateData.titleI18n = data.titleI18n;
    if (data.descriptionI18n !== undefined)
      updateData.descriptionI18n = data.descriptionI18n;
    if (data.orderIndex !== undefined)
      updateData.orderIndex = data.orderIndex as any;
    if (data.uiConfig !== undefined) updateData.uiConfig = data.uiConfig;

    // Add updatedAt timestamp
    // Note: PostgreSQL schema doesn't have updatedAt for question_groups,
    // but we'll add it if needed in future schema updates

    // Update question group
    const result = await db
      .update(questionGroups)
      .set(updateData)
      .where(eq(questionGroups.id, id))
      .returning();

    const updatedQuestionGroup = result[0];

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'question_groups',
        id,
        'UPDATE',
        questionGroup,
        updateData,
        request?.ip,
        request?.get('User-Agent'),
      );
    }

    return updatedQuestionGroup;
  }

  /**
   * Delete question group with dependency checking
   */
  static async deleteQuestionGroup(
    id: string,
    request?: Request,
  ): Promise<void> {
    const userId = request?.user?.id;

    // Get existing question group with question count
    const existingQuestionGroup = await db
      .select({
        id: questionGroups.id,
        questionnaireId: questionGroups.questionnaireId,
        questionCount: count(questions.id),
      })
      .from(questionGroups)
      .leftJoin(questions, eq(questionGroups.id, questions.groupId))
      .where(eq(questionGroups.id, id))
      .groupBy(questionGroups.id)
      .limit(1);

    if (!existingQuestionGroup || existingQuestionGroup.length === 0) {
      throw new Error('Question group not found');
    }

    const questionGroup = existingQuestionGroup[0];
    const hasQuestions = Number(questionGroup.questionCount) > 0;

    if (hasQuestions) {
      throw new Error(
        'Cannot delete question group that contains questions. Remove questions first.',
      );
    }

    // Delete question group
    await db.delete(questionGroups).where(eq(questionGroups.id, id));

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'question_groups',
        id,
        'DELETE',
        questionGroup,
        null,
        request?.ip,
        request?.get('User-Agent'),
      );
    }
  }

  // ===== QUESTION CRUD OPERATIONS =====

  /**
   * Create question
   */
  static async createQuestion(
    data: CreateQuestionData,
    request?: Request,
  ): Promise<Question> {
    const userId = request?.user?.id;

    // Verify question group exists
    const questionGroupCheck = await db
      .select({
        id: questionGroups.id,
        questionnaireId: questionGroups.questionnaireId,
      })
      .from(questionGroups)
      .where(eq(questionGroups.id, data.groupId))
      .limit(1);

    if (!questionGroupCheck || questionGroupCheck.length === 0) {
      throw new Error('Question group not found');
    }

    // Validate question type and options
    if (
      (data.type === 'single_choice' || data.type === 'multiple_choice') &&
      (!data.optionsI18n || data.optionsI18n.length === 0)
    ) {
      throw new Error('Choice questions must have options');
    }

    // Get next order index if not provided
    let orderIndex = data.orderIndex;
    if (orderIndex === undefined) {
      const maxOrderResult = await db
        .select({ maxOrder: questions.orderIndex })
        .from(questions)
        .where(eq(questions.groupId, data.groupId));

      orderIndex =
        maxOrderResult.length > 0 ? Number(maxOrderResult[0].maxOrder) + 1 : 1;
    }

    // Prepare question data
    const questionData: InsertQuestion = {
      groupId: data.groupId,
      textI18n: data.textI18n,
      type: data.type,
      optionsI18n: data.optionsI18n || null,
      validation: data.validation || (null as any),
      conditionalLogic: data.conditionalLogic || null,
      orderIndex: orderIndex as any,
      helpTextI18n: data.helpTextI18n || null,
    };

    // Insert question
    const result = await db.insert(questions).values(questionData).returning();

    const question = result[0];

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'questions',
        question.id,
        'CREATE',
        null,
        questionData,
        request?.ip,
        request?.get('User-Agent'),
      );
    }

    return question;
  }

  /**
   * Update question
   */
  static async updateQuestion(
    id: string,
    data: UpdateQuestionData,
    request?: Request,
  ): Promise<Question> {
    const userId = request?.user?.id;

    // Get existing question
    const existingQuestion = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);

    if (!existingQuestion || existingQuestion.length === 0) {
      throw new Error('Question not found');
    }

    const question = existingQuestion[0];

    // Validate question type and options if type is changing
    const newType = data.type || question.type;
    if (newType === 'single_choice' || newType === 'multiple_choice') {
      const options =
        data.optionsI18n !== undefined
          ? data.optionsI18n
          : question.optionsI18n;
      if (!options || options.length === 0) {
        throw new Error('Choice questions must have options');
      }
    }

    // Prepare update data
    const updateData: Partial<InsertQuestion> = {};

    if (data.textI18n !== undefined) updateData.textI18n = data.textI18n;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.optionsI18n !== undefined)
      updateData.optionsI18n = data.optionsI18n;
    if (data.validation !== undefined)
      updateData.validation = data.validation as any;
    if (data.conditionalLogic !== undefined)
      updateData.conditionalLogic = data.conditionalLogic;
    if (data.orderIndex !== undefined)
      updateData.orderIndex = data.orderIndex as any;
    if (data.helpTextI18n !== undefined)
      updateData.helpTextI18n = data.helpTextI18n;

    // Add updatedAt timestamp
    // Note: PostgreSQL schema doesn't have updatedAt for questions,
    // but we'll add it if needed in future schema updates

    // Update question
    const result = await db
      .update(questions)
      .set(updateData)
      .where(eq(questions.id, id))
      .returning();

    const updatedQuestion = result[0];

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'questions',
        id,
        'UPDATE',
        question,
        updateData,
        request?.ip,
        request?.get('User-Agent'),
      );
    }

    return updatedQuestion;
  }

  /**
   * Delete question with dependency checking
   */
  static async deleteQuestion(id: string, request?: Request): Promise<void> {
    const userId = request?.user?.id;

    // Get existing question with response count
    const existingQuestion = await db
      .select({
        id: questions.id,
        groupId: questions.groupId,
        responseCount: count(responses.id),
      })
      .from(questions)
      .leftJoin(responses, eq(questions.id, responses.questionId))
      .where(eq(questions.id, id))
      .groupBy(questions.id)
      .limit(1);

    if (!existingQuestion || existingQuestion.length === 0) {
      throw new Error('Question not found');
    }

    const question = existingQuestion[0];
    const hasResponses = Number(question.responseCount) > 0;

    if (hasResponses) {
      throw new Error(
        'Cannot delete question that has responses. Consider archiving instead.',
      );
    }

    // Delete question
    await db.delete(questions).where(eq(questions.id, id));

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'questions',
        id,
        'DELETE',
        question,
        null,
        request?.ip,
        request?.get('User-Agent'),
      );
    }
  }

  // ===== SORT ORDER MANAGEMENT =====

  /**
   * Reorder question groups
   */
  static async reorderQuestionGroups(
    questionnaireId: string,
    groupOrders: Array<{ id: string; orderIndex: number }>,
    request?: Request,
  ): Promise<void> {
    const userId = request?.user?.id;

    // Verify all groups belong to the questionnaire
    const groupsInQuestionnaire = await db
      .select({ id: questionGroups.id })
      .from(questionGroups)
      .where(eq(questionGroups.questionnaireId, questionnaireId));

    const groupIds = groupsInQuestionnaire.map(g => g.id);
    const requestedIds = groupOrders.map(go => go.id);

    // Validate all requested groups belong to this questionnaire
    const invalidIds = requestedIds.filter(id => !groupIds.includes(id));
    if (invalidIds.length > 0) {
      throw new Error(
        'Some question groups do not belong to this questionnaire',
      );
    }

    // Update order indices
    await db.transaction(async tx => {
      for (const { id, orderIndex } of groupOrders) {
        await tx
          .update(questionGroups)
          .set({ orderIndex: orderIndex as any })
          .where(eq(questionGroups.id, id));
      }
    });

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'question_groups',
        questionnaireId,
        'REORDER',
        null,
        { groupOrders },
        request?.ip,
        request?.get('User-Agent'),
      );
    }
  }

  /**
   * Reorder questions within a group
   */
  static async reorderQuestions(
    groupId: string,
    questionOrders: Array<{ id: string; orderIndex: number }>,
    request?: Request,
  ): Promise<void> {
    const userId = request?.user?.id;

    // Verify all questions belong to the group
    const questionsInGroup = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.groupId, groupId));

    const questionIds = questionsInGroup.map(q => q.id);
    const requestedIds = questionOrders.map(qo => qo.id);

    // Validate all requested questions belong to this group
    const invalidIds = requestedIds.filter(id => !questionIds.includes(id));
    if (invalidIds.length > 0) {
      throw new Error('Some questions do not belong to this question group');
    }

    // Update order indices
    await db.transaction(async tx => {
      for (const { id, orderIndex } of questionOrders) {
        await tx
          .update(questions)
          .set({ orderIndex: orderIndex as any })
          .where(eq(questions.id, id));
      }
    });

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'questions',
        groupId,
        'REORDER',
        null,
        { questionOrders },
        request?.ip,
        request?.get('User-Agent'),
      );
    }
  }

  // ===== QUESTIONNAIRE STRUCTURE VALIDATION =====

  /**
   * Validate questionnaire structure before publishing
   */
  static async validateQuestionnaireStructure(
    questionnaireId: string,
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get questionnaire with groups and questions
    const questionnaire = await this.getQuestionnaireById(questionnaireId);

    if (!questionnaire) {
      return {
        isValid: false,
        errors: ['Questionnaire not found'],
        warnings: [],
      };
    }

    // Check if questionnaire has at least one question group
    if (questionnaire.questionGroups.length === 0) {
      errors.push('Questionnaire must have at least one question group');
    }

    // Check each question group
    for (const group of questionnaire.questionGroups) {
      // Check if group has at least one question
      if (group.questions.length === 0) {
        warnings.push(
          `Question group "${group.titleI18n.en || group.titleI18n.pl || 'Unnamed'}" has no questions`,
        );
      }

      // Check each question
      for (const question of group.questions) {
        // Check if choice questions have options
        if (
          question.type === 'single_choice' ||
          question.type === 'multiple_choice'
        ) {
          if (!question.optionsI18n || question.optionsI18n.length === 0) {
            errors.push(
              `Choice question "${question.textI18n.en || question.textI18n.pl || 'Unnamed'}" must have options`,
            );
          }
        }

        // Check if required questions have proper validation
        if (question.validation?.required && !question.textI18n) {
          errors.push('Required question must have text');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Helper method to create audit log
   */
  private static async createAuditLog(
    userId: string,
    tableName: string,
    recordId: string,
    operation: string,
    oldValues: any = null,
    newValues: any = null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await RLSHelper.createAuditLog(
        userId,
        tableName,
        recordId,
        operation,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
      );
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}
