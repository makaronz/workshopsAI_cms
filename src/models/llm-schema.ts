import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  decimal,
  datetime,
  index,
  primaryKey,
  uuid,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, workshops } from './postgresql-schema';

// Enum definitions
export const questionnaireStatusEnum = pgEnum('questionnaireStatus', [
  'draft',
  'review',
  'published',
  'closed',
  'analyzed',
]);

export const questionTypeEnum = pgEnum('questionType', [
  'text',
  'textarea',
  'number',
  'scale',
  'single_choice',
  'multiple_choice',
]);

export const analysisTypeEnum = pgEnum('analysisType', [
  'thematic',
  'clusters',
  'contradictions',
  'insights',
  'recommendations',
]);

export const analysisStatusEnum = pgEnum('analysisStatus', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const analysisJobStatusEnum = pgEnum('analysisJobStatus', [
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

export const analysisJobPriorityEnum = pgEnum('analysisJobPriority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const consentTypeEnum = pgEnum('consentType', [
  'research_analysis',
  'marketing_emails',
  'data_sharing',
  'anonymous_presentation',
]);

/**
 * Questionnaires table - core questionnaire structure
 */
export const questionnaires = pgTable(
  'questionnaires',
  {
    id: varchar('id', { length: 36 }).primaryKey().default('uuid()'),
    workshopId: varchar('workshopId', { length: 36 }).references(
      () => workshops.id,
      { onDelete: 'cascade' },
    ),
    title: json('title').notNull(), // {"pl": "Tytuł", "en": "Title"}
    description: json('description'),
    instructions: json('instructions'),
    status: questionnaireStatusEnum('status')
      .default('draft')
      .notNull(),
    settings: json('settings').$type<{
      anonymous: boolean;
      requireConsent: boolean;
      maxResponses: number | null;
      closeAfterWorkshop: boolean;
      showAllQuestions: boolean;
      allowEdit: boolean;
      questionStyle: 'first_person_plural' | 'third_person';
    }>(),
    publishedAt: timestamp('publishedAt'),
    closedAt: timestamp('closedAt'),
    createdBy: uuid('createdBy')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    workshopIdIdx: index('idx_workshop_id').on(table.workshopId),
    statusIdx: index('idx_status').on(table.status),
    createdByIdx: index('idx_created_by').on(table.createdBy),
  }),
);

export type Questionnaire = typeof questionnaires.$inferSelect;
export type InsertQuestionnaire = typeof questionnaires.$inferInsert;

/**
 * Question Groups table - sections within questionnaires
 */
export const questionGroups = pgTable(
  'questionGroups',
  {
    id: varchar('id', { length: 36 }).primaryKey().default('uuid()'),
    questionnaireId: varchar('questionnaireId', { length: 36 })
      .notNull()
      .references(() => questionnaires.id, { onDelete: 'cascade' }),
    title: json('title').notNull(), // {"pl": "1. WIZJA / MANIFEST", "en": "1. VISION / MANIFEST"}
    description: json('description'),
    orderIndex: integer('orderIndex').notNull().default(0),
    uiConfig: json('uiConfig').$type<{
      collapsed: boolean;
      showProgress: boolean;
      icon: string | null;
    }>(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    questionnaireIdIdx: index('idx_questionnaire_id').on(table.questionnaireId),
    orderIdx: index('idx_order').on(table.orderIndex),
  }),
);

export type QuestionGroup = typeof questionGroups.$inferSelect;
export type InsertQuestionGroup = typeof questionGroups.$inferInsert;

/**
 * Questions table - individual questions within groups
 */
export const questions = pgTable(
  'questions',
  {
    id: varchar('id', { length: 36 }).primaryKey().default('uuid()'),
    groupId: varchar('groupId', { length: 36 })
      .notNull()
      .references(() => questionGroups.id, { onDelete: 'cascade' }),
    text: json('text').notNull(), // {"pl": "Pytanie?", "en": "Question?"}
    type: questionTypeEnum('type').notNull(),
    options: json('options').$type<
      Array<{
        value: string;
        label: { pl: string; en: string };
      }>
    >(),
    validation: json('validation').$type<{
      required: boolean;
      minLength?: number;
      maxLength?: number;
      minValue?: number;
      maxValue?: number;
      pattern?: string;
    }>(),
    conditionalLogic: json('conditionalLogic').$type<{
      showIf: {
        questionId: string;
        operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
        value: any;
      };
    }>(),
    orderIndex: integer('orderIndex').notNull().default(0),
    helpText: json('helpText'), // {"pl": "Pomoc", "en": "Help"}
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    groupIdIdx: index('idx_group_id').on(table.groupId),
    orderIdx: index('idx_order').on(table.orderIndex),
    typeIdx: index('idx_type').on(table.type),
  }),
);

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

/**
 * Responses table - user answers to questions
 */
export const responses = pgTable(
  'responses',
  {
    id: varchar('id', { length: 36 }).primaryKey().default('uuid()'),
    questionId: varchar('questionId', { length: 36 })
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }),
    enrollmentId: varchar('enrollmentId', { length: 36 }),
    answer: json('answer').notNull(), // Format varies by question type
    metadata: json('metadata').$type<{
      ipHash: string;
      userAgentHash: string;
      timeSpentMs: number;
      editCount: number;
    }>(),
    submittedAt: timestamp('submittedAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    questionIdIdx: index('idx_question_id').on(table.questionId),
    userIdIdx: index('idx_user_id').on(table.userId),
    enrollmentIdIdx: index('idx_enrollment_id').on(table.enrollmentId),
    submittedAtIdx: index('idx_submitted_at').on(table.submittedAt),
  }),
);

export type Response = typeof responses.$inferSelect;
export type InsertResponse = typeof responses.$inferInsert;

/**
 * LLM Analyses table - analysis results and metadata
 */
export const llmAnalyses = pgTable(
  'llmAnalyses',
  {
    id: varchar('id', { length: 36 }).primaryKey().default('uuid()'),
    questionnaireId: varchar('questionnaireId', { length: 36 })
      .notNull()
      .references(() => questionnaires.id, { onDelete: 'cascade' }),
    analysisType: analysisTypeEnum('analysisType').notNull(),
    status: analysisStatusEnum('status')
      .default('pending')
      .notNull(),
    results: json('results').$type<{
      summary: string;
      themes?: Array<{
        name: string;
        frequency: number;
        examples: string[];
        sentiment: number; // -1 to 1
      }>;
      clusters?: Array<{
        id: string;
        size: number;
        centroid: string;
        members: string[]; // response IDs
        characteristics: string[];
      }>;
      contradictions?: Array<{
        questionPair: [string, string];
        description: string;
        severity: 'low' | 'medium' | 'high';
        examples: string[];
      }>;
      insights?: Array<{
        category: string;
        text: string;
        confidence: number; // 0 to 1
        sources: string[]; // response IDs
      }>;
      recommendations?: Array<{
        text: string;
        priority: 'low' | 'medium' | 'high';
        rationale: string;
        category: string;
      }>;
    }>(),
    metadata: json('metadata').$type<{
      model: string; // "gpt-4", "claude-3-opus", etc.
      promptVersion: string;
      tokensUsed: number;
      processingTimeMs: number;
      confidenceScore: number;
      responseCount: number;
      anonymizationLevel: 'partial' | 'full';
    }>(),
    errorMessage: text('errorMessage'),
    triggeredBy: uuid('triggeredBy').references(() => users.id),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    completedAt: timestamp('completedAt'),
  },
  table => ({
    questionnaireIdIdx: index('idx_questionnaire_id').on(table.questionnaireId),
    analysisTypeIdx: index('idx_analysis_type').on(table.analysisType),
    statusIdx: index('idx_status').on(table.status),
    createdAtIdx: index('idx_created_at').on(table.createdAt),
  }),
);

export type LLMAnalysis = typeof llmAnalyses.$inferSelect;
export type InsertLLMAnalysis = typeof llmAnalyses.$inferInsert;

/**
 * Consents table - GDPR consent management
 */
export const consents = pgTable(
  'consents',
  {
    id: varchar('id', { length: 36 }).primaryKey().default('uuid()'),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionnaireId: varchar('questionnaireId', { length: 36 }).references(
      () => questionnaires.id,
      { onDelete: 'cascade' },
    ),
    consentType: consentTypeEnum('consentType').notNull(),
    granted: boolean('granted').notNull(),
    ipAddress: varchar('ipAddress', { length: 45 }), // IPv6 compatible
    userAgent: text('userAgent'),
    consentText: json('consentText'), // The actual consent text shown to user
    givenAt: timestamp('givenAt').defaultNow().notNull(),
    revokedAt: timestamp('revokedAt'),
    version: varchar('version', { length: 20 }).default('1.0'),
  },
  table => ({
    userIdIdx: index('idx_user_id').on(table.userId),
    questionnaireIdIdx: index('idx_questionnaire_id').on(table.questionnaireId),
    consentTypeIdx: index('idx_consent_type').on(table.consentType),
    grantedIdx: index('idx_granted').on(table.granted),
    givenAtIdx: index('idx_given_at').on(table.givenAt),
  }),
);

export type Consent = typeof consents.$inferSelect;
export type InsertConsent = typeof consents.$inferInsert;

/**
 * Embeddings table - vector embeddings for semantic search
 */
export const embeddings = pgTable(
  'embeddings',
  {
    id: varchar('id', { length: 36 }).primaryKey().default('uuid()'),
    responseId: varchar('responseId', { length: 36 })
      .notNull()
      .references(() => responses.id, { onDelete: 'cascade' }),
    questionId: varchar('questionId', { length: 36 })
      .notNull()
      .references(() => questions.id),
    vectorIndex: integer('vectorIndex').notNull(), // Index in external vector DB
    model: varchar('model', { length: 100 }).notNull(), // "text-embedding-3-small", etc.
    dimensions: integer('dimensions').notNull(), // 1536, 384, etc.
    provider: varchar('provider', { length: 50 }).notNull().default('openai'), // openai, anthropic, local
    checksum: varchar('checksum', { length: 64 }), // For content integrity verification
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    responseIdIdx: index('idx_response_id').on(table.responseId),
    questionIdIdx: index('idx_question_id').on(table.questionId),
    modelIdx: index('idx_model').on(table.model),
    checksumIdx: index('idx_checksum').on(table.checksum),
  }),
);

export type Embedding = typeof embeddings.$inferSelect;
export type InsertEmbedding = typeof embeddings.$inferInsert;

/**
 * Analysis Jobs table - queue management for LLM processing
 */
export const analysisJobs = pgTable(
  'analysisJobs',
  {
    id: varchar('id', { length: 36 }).primaryKey().default('uuid()'),
    questionnaireId: varchar('questionnaireId', { length: 36 })
      .notNull()
      .references(() => questionnaires.id),
    analysisTypes: json('analysisTypes').$type<string[]>().notNull(),
    status: analysisJobStatusEnum('status')
      .default('queued')
      .notNull(),
    priority: analysisJobPriorityEnum('priority')
      .default('medium')
      .notNull(),
    progress: integer('progress').default(0), // 0-100 percentage
    totalSteps: integer('totalSteps').notNull().default(1),
    completedSteps: integer('completedSteps').default(0),
    options: json('options').$type<{
      minClusterSize?: number;
      minThemeFrequency?: number;
      includeSentiment?: boolean;
      anonymizationLevel?: 'partial' | 'full';
      customPrompt?: string;
    }>(),
    errorLog: json('errorLog').$type<
      Array<{
        step: string;
        error: string;
        timestamp: string;
        retryable: boolean;
      }>
    >(),
    estimatedDuration: integer('estimatedDuration'), // in seconds
    actualDuration: integer('actualDuration'), // in seconds
    workerId: varchar('workerId', { length: 100 }),
    scheduledAt: timestamp('scheduledAt'),
    startedAt: timestamp('startedAt'),
    completedAt: timestamp('completedAt'),
    triggeredBy: uuid('triggeredBy').references(() => users.id),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    questionnaireIdIdx: index('idx_questionnaire_id').on(table.questionnaireId),
    statusIdx: index('idx_status').on(table.status),
    priorityIdx: index('idx_priority').on(table.priority),
    triggeredByIdx: index('idx_triggered_by').on(table.triggeredBy),
    scheduledAtIdx: index('idx_scheduled_at').on(table.scheduledAt),
  }),
);

export type AnalysisJob = typeof analysisJobs.$inferSelect;
export type InsertAnalysisJob = typeof analysisJobs.$inferInsert;

// Relations
export const questionnairesRelations = relations(
  questionnaires,
  ({ one, many }) => ({
    workshop: one(workshops, {
      fields: [questionnaires.workshopId],
      references: [workshops.id],
    }),
    creator: one(users, {
      fields: [questionnaires.createdBy],
      references: [users.id],
    }),
    groups: many(questionGroups),
    responses: many(responses),
    analyses: many(llmAnalyses),
    consents: many(consents),
    jobs: many(analysisJobs),
  }),
);

export const questionGroupsRelations = relations(
  questionGroups,
  ({ one, many }) => ({
    questionnaire: one(questionnaires, {
      fields: [questionGroups.questionnaireId],
      references: [questionnaires.id],
    }),
    questions: many(questions),
  }),
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
  group: one(questionGroups, {
    fields: [questions.groupId],
    references: [questionGroups.id],
  }),
  responses: many(responses),
  embeddings: many(embeddings),
}));

export const responsesRelations = relations(responses, ({ one, many }) => ({
  question: one(questions, {
    fields: [responses.questionId],
    references: [questions.id],
  }),
  user: one(users, { fields: [responses.userId], references: [users.id] }),
  embeddings: many(embeddings),
}));

export const llmAnalysesRelations = relations(llmAnalyses, ({ one }) => ({
  questionnaire: one(questionnaires, {
    fields: [llmAnalyses.questionnaireId],
    references: [questionnaires.id],
  }),
  triggerUser: one(users, {
    fields: [llmAnalyses.triggeredBy],
    references: [users.id],
  }),
}));

export const consentsRelations = relations(consents, ({ one }) => ({
  user: one(users, { fields: [consents.userId], references: [users.id] }),
  questionnaire: one(questionnaires, {
    fields: [consents.questionnaireId],
    references: [questionnaires.id],
  }),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  response: one(responses, {
    fields: [embeddings.responseId],
    references: [responses.id],
  }),
  question: one(questions, {
    fields: [embeddings.questionId],
    references: [questions.id],
  }),
}));

export const analysisJobsRelations = relations(analysisJobs, ({ one }) => ({
  questionnaire: one(questionnaires, {
    fields: [analysisJobs.questionnaireId],
    references: [questionnaires.id],
  }),
  triggerUser: one(users, {
    fields: [analysisJobs.triggeredBy],
    references: [users.id],
  }),
}));
