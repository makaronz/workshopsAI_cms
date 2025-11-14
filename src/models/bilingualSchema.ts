import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  decimal,
  datetime,
  index,
} from 'drizzle-orm/mysql-core';
import { relations, one, many } from 'drizzle-orm';
import { users } from './schema';

// Bilingual text type definition
export type BilingualText = {
  pl: string;
  en: string;
};

/**
 * Questionnaires table - multilingual feedback collection
 */
export const questionnaires = mysqlTable(
  'questionnaires',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    title: json('title').$type<BilingualText>().notNull(),
    description: json('description').$type<BilingualText>(),
    instructions: json('instructions').$type<BilingualText>(),
    type: mysqlEnum('type', [
      'session_feedback',
      'workshop_feedback',
      'facilitator_feedback',
      'general',
    ]).notNull(),
    status: mysqlEnum('status', ['draft', 'active', 'archived'])
      .default('draft')
      .notNull(),
    language: mysqlEnum('language', ['pl', 'en', 'both'])
      .default('both')
      .notNull(),
    anonymousAllowed: boolean('anonymousAllowed').default(true).notNull(),
    createdBy: int('createdBy').notNull(),
    publishedAt: timestamp('publishedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    typeIdx: index('idx_type').on(table.type),
    statusIdx: index('idx_status').on(table.status),
    createdByIdx: index('idx_created_by').on(table.createdBy),
  }),
);

export type Questionnaire = typeof questionnaires.$inferSelect;
export type InsertQuestionnaire = typeof questionnaires.$inferInsert;

/**
 * Questions table - individual questionnaire questions
 */
export const questions = mysqlTable(
  'questions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    questionnaireId: varchar('questionnaireId', { length: 36 }).notNull(),
    order: int('order').notNull(),
    type: mysqlEnum('type', [
      'text',
      'scale',
      'choice',
      'multiple_choice',
      'yes_no',
      'rating',
    ]).notNull(),
    question: json('question').$type<BilingualText>().notNull(),
    description: json('description').$type<BilingualText>(),
    required: boolean('required').default(false).notNull(),
    config: json('config').$type<{
      min?: number;
      max?: number;
      steps?: number;
      options?: Array<{ value: string; label: BilingualText }>;
      allowOther?: boolean;
    }>(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    questionnaireIdIdx: index('idx_questionnaire_id').on(table.questionnaireId),
    orderIdx: index('idx_order').on(table.order),
  }),
);

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

/**
 * Responses table - questionnaire submissions
 */
export const responses = mysqlTable(
  'responses',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    questionnaireId: varchar('questionnaireId', { length: 36 }).notNull(),
    participantId: int('participantId'),
    sessionId: varchar('sessionId', { length: 36 }),
    facilitatorId: int('facilitatorId'),
    workshopId: varchar('workshopId', { length: 36 }),
    anonymous: boolean('anonymous').default(false).notNull(),
    status: mysqlEnum('status', ['draft', 'submitted', 'reviewed'])
      .default('draft')
      .notNull(),
    submittedAt: timestamp('submittedAt'),
    reviewedBy: int('reviewedBy'),
    reviewedAt: timestamp('reviewedAt'),
    notes: text('notes'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    questionnaireIdIdx: index('idx_questionnaire_id').on(table.questionnaireId),
    participantIdIdx: index('idx_participant_id').on(table.participantId),
    sessionIdIdx: index('idx_session_id').on(table.sessionId),
    workshopIdIdx: index('idx_workshop_id').on(table.workshopId),
    statusIdx: index('idx_status').on(table.status),
  }),
);

export type Response = typeof responses.$inferSelect;
export type InsertResponse = typeof responses.$inferInsert;

/**
 * Answers table - individual question responses
 */
export const answers = mysqlTable(
  'answers',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    responseId: varchar('responseId', { length: 36 }).notNull(),
    questionId: varchar('questionId', { length: 36 }).notNull(),
    answer: json('answer').notNull(), // Flexible structure based on question type
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    responseIdIdx: index('idx_response_id').on(table.responseId),
    questionIdIdx: index('idx_question_id').on(table.questionId),
  }),
);

export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = typeof answers.$inferInsert;

/**
 * Analysis Jobs table - AI/LLM analysis queue
 */
export const analysisJobs = mysqlTable(
  'analysisJobs',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    questionnaireId: varchar('questionnaireId', { length: 36 }).notNull(),

    // Analysis metadata
    analysisType: mysqlEnum('analysisType', [
      'thematic',
      'clusters',
      'contradictions',
      'insights',
      'recommendations',
    ]).notNull(),

    // Results with bilingual content
    results: json('results').$type<{
      summary: BilingualText;
      themes: Array<{
        name: BilingualText;
        frequency: number;
        examples: Array<string>;
      }>;
      clusters?: Array<{
        name: BilingualText;
        responses: Array<string>;
        similarity: number;
      }>;
      contradictions?: Array<{
        statement1: string;
        statement2: string;
        context: BilingualText;
      }>;
      insights?: Array<{
        category: string;
        finding: BilingualText;
        importance: 'high' | 'medium' | 'low';
      }>;
      recommendations?: Array<{
        title: BilingualText;
        description: BilingualText;
        priority: 'high' | 'medium' | 'low';
      }>;
    }>(),

    status: mysqlEnum('status', [
      'pending',
      'processing',
      'completed',
      'failed',
    ])
      .default('pending')
      .notNull(),
    progress: int('progress').default(0), // 0-100
    error: text('error'),
    startedAt: timestamp('startedAt'),
    completedAt: timestamp('completedAt'),
    processedBy: json('processedBy').$type<{
      model: string;
      version: string;
      parameters: Record<string, any>;
    }>(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    questionnaireIdIdx: index('idx_questionnaire_id').on(table.questionnaireId),
    analysisTypeIdx: index('idx_analysis_type').on(table.analysisType),
    statusIdx: index('idx_status').on(table.status),
  }),
);

export type AnalysisJob = typeof analysisJobs.$inferSelect;
export type InsertAnalysisJob = typeof analysisJobs.$inferInsert;

// Relations
export const questionnairesRelations = relations(
  questionnaires,
  ({ one, many }) => ({
    creator: one(users, {
      fields: [questionnaires.createdBy],
      references: [users.id],
    }),
    questions: many(questions),
    responses: many(responses),
    analysisJobs: many(analysisJobs),
  }),
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
  questionnaire: one(questionnaires, {
    fields: [questions.questionnaireId],
    references: [questionnaires.id],
  }),
  answers: many(answers),
}));

export const responsesRelations = relations(responses, ({ one, many }) => ({
  questionnaire: one(questionnaires, {
    fields: [responses.questionnaireId],
    references: [questionnaires.id],
  }),
  participant: one(users, {
    fields: [responses.participantId],
    references: [users.id],
  }),
  facilitator: one(users, {
    fields: [responses.facilitatorId],
    references: [users.id],
  }),
  answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  response: one(responses, {
    fields: [answers.responseId],
    references: [responses.id],
  }),
  question: one(questions, {
    fields: [answers.questionId],
    references: [questions.id],
  }),
}));

export const analysisJobsRelations = relations(analysisJobs, ({ one }) => ({
  questionnaire: one(questionnaires, {
    fields: [analysisJobs.questionnaireId],
    references: [questionnaires.id],
  }),
}));
