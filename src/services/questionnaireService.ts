import {
  db,
  questionnaires,
  questionGroups,
  questions,
  users,
  workshops,
  eq,
  and,
  desc,
  asc,
  inArray,
  isNull,
  not,
  sql,
} from '../config/database';
import {
  Questionnaire,
  InsertQuestionnaire,
  QuestionGroup,
  InsertQuestionGroup,
  Question,
  InsertQuestion,
  User,
} from '../models/postgresql-schema';
import { v4 as uuidv4 } from 'uuid';

// Questionnaire template for "NASZA (NIE)UTOPIA"
export const NASZA_NIEUTOPIA_TEMPLATE = {
  template_id: 'nasza_nieutopia_v1',
  title: {
    pl: 'NASZA (NIE)UTOPIA',
    en: 'OUR (DIS)UTOPIA',
  },
  instructions: {
    pl: 'Wypełnij kwestionariusz opisujący Waszą wizję wspólnoty. Pamiętaj, że nie ma złych odpowiedzi - chodzi o Wasze autentyczne przemyślenia i marzenia.',
    en: 'Fill out this questionnaire describing your community vision. Remember, there are no wrong answers - this is about your authentic thoughts and dreams.',
  },
  settings: {
    anonymous: false,
    require_consent: true,
    max_responses: null,
    close_after_workshop: false,
    show_all_questions: true,
    allow_edit: true,
    question_style: 'first_person_plural' as const,
  },
  groups: [
    {
      order: 1,
      title: {
        pl: '1. WIZJA / MANIFEST',
        en: '1. VISION / MANIFEST',
      },
      description: {
        pl: 'Podstawowe wartości i cel wspólnoty',
        en: 'Core values and community purpose',
      },
      questions: [
        {
          order: 1,
          text: {
            pl: 'Co jest dla Was ważne we wspólnym miejscu zamieszkania? Co leży u podstaw tego pomysłu? Z jakimi wartościami utożsamiacie się?',
            en: 'What is important to you in a shared living space? What is the foundation of this idea? What values do you identify with?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 500 },
        },
        {
          order: 2,
          text: {
            pl: 'Dlaczego Wasze miejsce istnieje? By żyło się łatwiej, zabawniej i na własnych zasadach',
            en: 'Why does your place exist? So that life is easier, more fun, and on your own terms',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 3,
          text: {
            pl: 'Jakie potrzeby będziecie realizować w Waszym miejscu?',
            en: 'What needs will you fulfill in your place?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 400 },
        },
        {
          order: 4,
          text: {
            pl: 'W jaki sposób jesteśmy postrzegani przez osoby z zewnątrz?',
            en: 'How are we perceived by people from outside?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 5,
          text: {
            pl: 'W jaki sposób komunikujemy się na zewnątrz? Jakie mamy narzędzia?',
            en: 'How do we communicate externally? What tools do we have?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 6,
          text: {
            pl: 'Jak wygląda nasza kultura współpracy?',
            en: 'What does our collaboration culture look like?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 400 },
        },
      ],
    },
    {
      order: 2,
      title: {
        pl: '2. PRZESTRZEŃ I MATERIA',
        en: '2. SPACE AND MATTER',
      },
      description: {
        pl: 'Fizyczna i wirtualna przestrzeń wspólnoty',
        en: 'Physical and virtual community space',
      },
      questions: [
        {
          order: 7,
          text: {
            pl: 'Jak wyglądają nasze relacje z materialnością? Zasilanie, odpady, jedzenie, transport?',
            en: 'What are our relationships with materiality? Power, waste, food, transport?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 400 },
        },
        {
          order: 8,
          text: {
            pl: 'Jakie są nasze sposoby na zarabianie pieniędzy?',
            en: 'What are our ways of earning money?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 9,
          text: {
            pl: 'Jakie struktury zarządzania wybraliśmy? Jakie mają wady i zalety?',
            en: 'What management structures have we chosen? What are their pros and cons?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 400 },
        },
        {
          order: 10,
          text: {
            pl: 'Jakie są nasze zasoby i jak nimi zarządzamy?',
            en: 'What are our resources and how do we manage them?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 11,
          text: {
            pl: 'Jakie materiały, narzędzia i technologie są dla nas istotne?',
            en: 'What materials, tools, and technologies are important to us?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
      ],
    },
    {
      order: 3,
      title: {
        pl: '3. RELACJE, INTERAKCJE I WOLNOŚĆ OSOBISTA',
        en: '3. RELATIONS, INTERACTIONS AND PERSONAL FREEDOM',
      },
      description: {
        pl: 'Społeczne i osobiste aspekty życia we wspólnocie',
        en: 'Social and personal aspects of community life',
      },
      questions: [
        {
          order: 12,
          text: {
            pl: 'Jakie są nasze praktyki budowania relacji?',
            en: 'What are our relationship-building practices?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 400 },
        },
        {
          order: 13,
          text: {
            pl: 'Jakie mamy strategie komunikowania? Jak rozwiązujemy konflikty?',
            en: 'What communication strategies do we have? How do we resolve conflicts?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 400 },
        },
        {
          order: 14,
          text: {
            pl: 'Jakie są nasze relacje z innymi grupami i społecznościami?',
            en: 'What are our relationships with other groups and communities?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 15,
          text: {
            pl: 'Jakie mamy wyobrażenia na temat rodziny i macierzyństwa?',
            en: 'What are our ideas about family and motherhood?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 16,
          text: {
            pl: 'Jak radzimy sobie z emocjami?',
            en: 'How do we handle emotions?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 17,
          text: {
            pl: 'Jakie są nasze relacje z ciałem? Seksualnością? Intymnością?',
            en: 'What are our relationships with the body? Sexuality? Intimacy?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 18,
          text: {
            pl: 'Jakie mamy sposoby spędzania czasu wolnego?',
            en: 'What ways do we spend our free time?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
      ],
    },
    {
      order: 4,
      title: {
        pl: '4. ORGANIZOWANIE',
        en: '4. ORGANIZING',
      },
      description: {
        pl: 'Struktury organizacyjne i zarządzanie',
        en: 'Organizational structures and management',
      },
      questions: [
        {
          order: 19,
          text: {
            pl: 'Jakie mamy tradycje, rytuały, święta?',
            en: 'What traditions, rituals, holidays do we have?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 20,
          text: {
            pl: 'Jakie są nasze strategie bezpieczeństwa?',
            en: 'What are our safety strategies?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 21,
          text: {
            pl: 'Jakie mamy strategie edukacyjne?',
            en: 'What educational strategies do we have?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 22,
          text: {
            pl: 'Jak wspieramy swoje rozwój?',
            en: 'How do we support our development?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 300 },
        },
        {
          order: 23,
          text: {
            pl: 'Jakie są nasze dążenia na przyszłość? Plany rozwoju?',
            en: 'What are our aspirations for the future? Development plans?',
          },
          type: 'textarea',
          required: false,
          validation: { max_length: 400 },
        },
      ],
    },
  ],
};

export class QuestionnaireService {
  /**
   * Create a new questionnaire
   */
  async createQuestionnaire(
    data: Omit<InsertQuestionnaire, 'id' | 'createdAt' | 'updatedAt'>,
    creatorId: number,
  ): Promise<Questionnaire> {
    const questionnaireData: InsertQuestionnaire = {
      id: uuidv4(),
      ...data,
      createdBy: creatorId,
    };

    const [questionnaire] = await db
      .insert(questionnaires)
      .values(questionnaireData)
      .returning();

    return questionnaire;
  }

  /**
   * Create questionnaire from template
   */
  async createFromTemplate(
    templateId: string,
    workshopId: string | null,
    title?: { pl: string; en: string },
    creatorId: number,
  ): Promise<Questionnaire> {
    const template =
      templateId === 'nasza_nieutopia_v1' ? NASZA_NIEUTOPIA_TEMPLATE : null;

    if (!template) {
      throw new Error('Template not found');
    }

    // Create questionnaire
    const questionnaire = await this.createQuestionnaire(
      {
        workshopId: workshopId || undefined,
        title: title || template.title,
        instructions: template.instructions,
        settings: template.settings,
      },
      creatorId,
    );

    // Create question groups and questions
    for (const groupData of template.groups) {
      const group: InsertQuestionGroup = {
        id: uuidv4(),
        questionnaireId: questionnaire.id,
        title: groupData.title,
        description: groupData.description,
        orderIndex: groupData.order,
        uiConfig: {
          collapsed: false,
          show_progress: true,
          icon: null,
        },
      };

      const [createdGroup] = await db
        .insert(questionGroups)
        .values(group)
        .returning();

      // Create questions for this group
      for (const questionData of groupData.questions) {
        const question: InsertQuestion = {
          id: uuidv4(),
          groupId: createdGroup.id,
          text: questionData.text,
          type: questionData.type as any,
          validation: {
            required: questionData.required || false,
            ...questionData.validation,
          },
          orderIndex: questionData.order,
        };

        await db.insert(questions).values(question);
      }
    }

    return questionnaire;
  }

  /**
   * Get questionnaire by ID with all relations
   */
  async getQuestionnaireById(
    id: string,
    includeGroups = true,
  ): Promise<Questionnaire | null> {
    const questionnaire = await db.query.questionnaires.findFirst({
      where: eq(questionnaires.id, id),
      with: includeGroups
        ? {
          creator: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          questionGroups: {
            orderBy: [asc(questionGroups.orderIndex)],
            with: {
              questions: {
                orderBy: [asc(questions.orderIndex)],
              },
            },
          },
          workshop: {
            columns: {
              id: true,
              title: true,
              slug: true,
            },
          },
        }
        : {
          creator: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          workshop: {
            columns: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
    });

    return questionnaire || null;
  }

  /**
   * Get published questionnaire for public access
   */
  async getPublishedQuestionnaire(id: string): Promise<Questionnaire | null> {
    const questionnaire = await db.query.questionnaires.findFirst({
      where: and(
        eq(questionnaires.id, id),
        eq(questionnaires.status, 'published'),
      ),
      with: {
        questionGroups: {
          orderBy: [asc(questionGroups.orderIndex)],
          with: {
            questions: {
              orderBy: [asc(questions.orderIndex)],
            },
          },
        },
        workshop: {
          columns: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return questionnaire || null;
  }

  /**
   * List questionnaires with filtering and pagination
   */
  async listQuestionnaires(filters: {
    status?: string[];
    workshopId?: string;
    createdBy?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      status,
      workshopId,
      createdBy,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const whereConditions = [];

    if (status && status.length > 0) {
      whereConditions.push(inArray(questionnaires.status, status as any[]));
    }

    if (workshopId) {
      whereConditions.push(eq(questionnaires.workshopId, workshopId));
    }

    if (createdBy) {
      whereConditions.push(eq(questionnaires.createdBy, createdBy));
    }

    if (search) {
      whereConditions.push(
        sql`(
          JSON_EXTRACT(${questionnaires.title}, '$.pl') LIKE ${`%${search}%`} OR
          JSON_EXTRACT(${questionnaires.title}, '$.en') LIKE ${`%${search}%`}
        )`,
      );
    }

    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const offset = (page - 1) * limit;

    const [questionnairesData, totalCount] = await Promise.all([
      db.query.questionnaires.findMany({
        where: whereClause,
        with: {
          creator: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          workshop: {
            columns: {
              id: true,
              title: true,
              slug: true,
            },
          },
          questionGroups: {
            columns: {
              id: true,
            },
          },
          responses: {
            columns: {
              id: true,
            },
          },
        },
        orderBy: [desc(questionnaires.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(questionnaires)
        .where(whereClause)
        .then(result => result[0].count),
    ]);

    return {
      questionnaires: questionnairesData,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Update questionnaire
   */
  async updateQuestionnaire(
    id: string,
    data: Partial<Omit<InsertQuestionnaire, 'id' | 'createdBy' | 'createdAt'>>,
    userId: number,
  ): Promise<Questionnaire | null> {
    // Check if user has permission to update this questionnaire
    const questionnaire = await this.getQuestionnaireById(id, false);

    if (!questionnaire) {
      throw new Error('Questionnaire not found');
    }

    // Permission check would go here based on RBAC
    // For now, allow only creator to update
    if (questionnaire.createdBy !== userId) {
      throw new Error('Insufficient permissions');
    }

    const [updatedQuestionnaire] = await db
      .update(questionnaires)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(questionnaires.id, id))
      .returning();

    return updatedQuestionnaire || null;
  }

  /**
   * Publish questionnaire
   */
  async publishQuestionnaire(
    id: string,
    userId: number,
  ): Promise<Questionnaire | null> {
    return this.updateQuestionnaire(
      id,
      {
        status: 'published',
        publishedAt: new Date(),
      },
      userId,
    );
  }

  /**
   * Close questionnaire
   */
  async closeQuestionnaire(
    id: string,
    userId: number,
  ): Promise<Questionnaire | null> {
    return this.updateQuestionnaire(
      id,
      {
        status: 'closed',
        closedAt: new Date(),
      },
      userId,
    );
  }

  /**
   * Delete questionnaire (soft delete by archiving)
   */
  async deleteQuestionnaire(id: string, userId: number): Promise<boolean> {
    const questionnaire = await this.getQuestionnaireById(id, false);

    if (!questionnaire) {
      throw new Error('Questionnaire not found');
    }

    if (questionnaire.createdBy !== userId) {
      throw new Error('Insufficient permissions');
    }

    // Soft delete by archiving
    await db
      .update(questionnaires)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(questionnaires.id, id));

    return true;
  }

  /**
   * Get questionnaire statistics
   */
  async getQuestionnaireStats(id: string): Promise<{
    totalQuestions: number;
    totalResponses: number;
    submittedResponses: number;
    draftResponses: number;
    uniqueParticipants: number;
  } | null> {
    const questionnaire = await this.getQuestionnaireById(id, false);

    if (!questionnaire) {
      return null;
    }

    const [stats] = await db
      .select({
        totalQuestions: sql<number>`(
          SELECT COUNT(*)
          FROM questions q
          JOIN questionGroups qg ON q.groupId = qg.id
          WHERE qg.questionnaireId = ${id}
        )`,
        totalResponses: sql<number>`(
          SELECT COUNT(*)
          FROM responses r
          JOIN questions q ON r.questionId = q.id
          JOIN questionGroups qg ON q.groupId = qg.id
          WHERE qg.questionnaireId = ${id}
        )`,
        submittedResponses: sql<number>`(
          SELECT COUNT(*)
          FROM responses r
          JOIN questions q ON r.questionId = q.id
          JOIN questionGroups qg ON q.groupId = qg.id
          WHERE qg.questionnaireId = ${id} AND r.status = 'submitted'
        )`,
        draftResponses: sql<number>`(
          SELECT COUNT(*)
          FROM responses r
          JOIN questions q ON r.questionId = q.id
          JOIN questionGroups qg ON q.groupId = qg.id
          WHERE qg.questionnaireId = ${id} AND r.status = 'draft'
        )`,
        uniqueParticipants: sql<number>`(
          SELECT COUNT(DISTINCT r.userId)
          FROM responses r
          JOIN questions q ON r.questionId = q.id
          JOIN questionGroups qg ON q.groupId = qg.id
          WHERE qg.questionnaireId = ${id} AND r.userId IS NOT NULL
        )`,
      })
      .from(questionnaires)
      .where(eq(questionnaires.id, id));

    return stats;
  }

  /**
   * Duplicate questionnaire with all questions and groups
   */
  async duplicateQuestionnaire(
    id: string,
    newTitle?: { pl: string; en: string },
    creatorId: number,
  ): Promise<Questionnaire | null> {
    const original = await this.getQuestionnaireById(id, true);

    if (!original) {
      throw new Error('Questionnaire not found');
    }

    // Create new questionnaire
    const newQuestionnaire = await this.createQuestionnaire(
      {
        workshopId: original.workshopId,
        title: newTitle || {
          pl: `${original.title.pl} (kopia)`,
          en: `${original.title.en} (copy)`,
        },
        instructions: original.instructions,
        status: 'draft', // Always start as draft
        settings: original.settings,
      },
      creatorId,
    );

    // Copy all question groups and questions
    for (const group of original.questionGroups || []) {
      const newGroup: InsertQuestionGroup = {
        id: uuidv4(),
        questionnaireId: newQuestionnaire.id,
        title: group.title,
        description: group.description,
        orderIndex: group.orderIndex,
        uiConfig: group.uiConfig || {
          collapsed: false,
          show_progress: true,
          icon: null,
        },
      };

      const [createdGroup] = await db
        .insert(questionGroups)
        .values(newGroup)
        .returning();

      // Copy questions
      for (const question of group.questions || []) {
        const newQuestion: InsertQuestion = {
          id: uuidv4(),
          groupId: createdGroup.id,
          text: question.text,
          type: question.type,
          options: question.options,
          validation: question.validation,
          conditionalLogic: question.conditionalLogic,
          orderIndex: question.orderIndex,
          helpText: question.helpText,
        };

        await db.insert(questions).values(newQuestion);
      }
    }

    return newQuestionnaire;
  }
}

export const questionnaireService = new QuestionnaireService();
