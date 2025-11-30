// Database Schema for Workshop Intelligence System (UPDATED)
// Using Drizzle ORM for WorkshopsAI CMS
// Version: 1.1 - Includes dynamic forms and visibility controls

import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, integer, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// WORKSHOP FORMS
// ============================================================================

/**
 * Stores the form configuration for each workshop
 * Admins can create custom forms with dynamic questions
 */
export const workshopForms = pgTable('workshop_forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  workshopId: uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  
  // Admin can lock/unlock the ability for participants to edit their contributions
  isEditable: boolean('is_editable').notNull().default(true),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // One form per workshop
  uniqueWorkshop: unique().on(table.workshopId),
}));

// ============================================================================
// FORM QUESTIONS
// ============================================================================

/**
 * Stores individual questions within a workshop form
 * Supports multiple question types (text, textarea, multiple choice, etc.)
 */
export const formQuestions = pgTable('form_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  formId: uuid('form_id').notNull().references(() => workshopForms.id, { onDelete: 'cascade' }),
  
  questionText: text('question_text').notNull(),
  
  // Question types: 'text', 'textarea', 'multiple_choice', 'single_choice', 'rating', 'yes_no'
  questionType: varchar('question_type', { length: 50 }).notNull(),
  
  // For multiple_choice and single_choice types
  // Example: { "options": ["Option 1", "Option 2", "Option 3"] }
  options: jsonb('options'),
  
  isRequired: boolean('is_required').notNull().default(false),
  
  // Display order in the form
  displayOrder: integer('display_order').notNull(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================================
// PARTICIPANT CONTRIBUTIONS
// ============================================================================

/**
 * Stores the contribution record for each participant
 * Links to the workshop and user
 */
export const participantContributions = pgTable('participant_contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workshopId: uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  status: varchar('status', { length: 20 }).notNull().default('draft'), // 'draft' | 'submitted'
  submittedAt: timestamp('submitted_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Ensure one contribution per participant per workshop
  uniqueWorkshopUser: unique().on(table.workshopId, table.userId),
}));

// ============================================================================
// PARTICIPANT ANSWERS
// ============================================================================

/**
 * Stores individual answers to form questions
 * Linked to both the contribution and the specific question
 */
export const participantAnswers = pgTable('participant_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  contributionId: uuid('contribution_id').notNull().references(() => participantContributions.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => formQuestions.id, { onDelete: 'cascade' }),
  
  // Flexible answer storage
  // For text: { "value": "My answer here" }
  // For multiple_choice: { "selected": ["Option 1", "Option 3"] }
  // For rating: { "value": 4 }
  answerData: jsonb('answer_data').notNull(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // One answer per question per contribution
  uniqueContributionQuestion: unique().on(table.contributionId, table.questionId),
}));

// ============================================================================
// LLM ANALYSES
// ============================================================================

/**
 * Tracks each LLM analysis run for a workshop
 * Stores metadata about the analysis (model, prompt, status)
 * UPDATED: Added is_visible_to_participants flag
 */
export const llmAnalyses = pgTable('llm_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  workshopId: uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  triggeredBy: uuid('triggered_by').notNull().references(() => users.id), // Admin who triggered the analysis
  
  modelName: varchar('model_name', { length: 100 }).notNull(), // e.g., 'gpt-4o-mini', 'claude-3.5-sonnet'
  promptTemplateId: uuid('prompt_template_id').references(() => promptTemplates.id),
  customInstructions: text('custom_instructions'), // Optional custom instructions from admin
  
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  
  // NEW: Admin can share analysis results with participants
  isVisibleToParticipants: boolean('is_visible_to_participants').notNull().default(false),
  
  // Timing information
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  
  // Error tracking
  errorMessage: text('error_message'), // If status is 'failed'
});

// ============================================================================
// ANALYSIS RESULTS
// ============================================================================

/**
 * Stores the actual results generated by LLM for each analysis
 * Multiple result types can be stored for a single analysis
 */
export const analysisResults = pgTable('analysis_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisId: uuid('analysis_id').notNull().references(() => llmAnalyses.id, { onDelete: 'cascade' }),
  
  resultType: varchar('result_type', { length: 50 }).notNull(), // 'summary' | 'insights' | 'themes' | 'recommendations' | 'plan'
  
  // Structured content in JSON format
  // Example for 'insights':
  // {
  //   "insights": [
  //     { "text": "80% of participants prioritize collaboration", "percentage": 80 },
  //     { "text": "Main challenge: remote communication", "count": 12 }
  //   ]
  // }
  content: jsonb('content').notNull(),
  
  // Full raw response from LLM API for debugging/auditing
  rawResponse: text('raw_response'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

/**
 * Stores reusable prompt templates for LLM analysis
 * Admins can create custom templates or use default ones
 */
export const promptTemplates = pgTable('prompt_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  
  // Template text with placeholders like {workshop_title}, {participant_data}, etc.
  templateText: text('template_text').notNull(),
  
  // List of variables used in the template
  // Example: ["workshop_title", "workshop_description", "participant_data", "participant_count"]
  variables: jsonb('variables'),
  
  category: varchar('category', { length: 50 }), // 'insights' | 'planning' | 'analysis' | 'custom'
  isDefault: boolean('is_default').default(false),
  
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const workshopFormsRelations = relations(workshopForms, ({ one, many }) => ({
  workshop: one(workshops, {
    fields: [workshopForms.workshopId],
    references: [workshops.id],
  }),
  questions: many(formQuestions),
}));

export const formQuestionsRelations = relations(formQuestions, ({ one, many }) => ({
  form: one(workshopForms, {
    fields: [formQuestions.formId],
    references: [workshopForms.id],
  }),
  answers: many(participantAnswers),
}));

export const participantContributionsRelations = relations(participantContributions, ({ one, many }) => ({
  workshop: one(workshops, {
    fields: [participantContributions.workshopId],
    references: [workshops.id],
  }),
  user: one(users, {
    fields: [participantContributions.userId],
    references: [users.id],
  }),
  answers: many(participantAnswers),
}));

export const participantAnswersRelations = relations(participantAnswers, ({ one }) => ({
  contribution: one(participantContributions, {
    fields: [participantAnswers.contributionId],
    references: [participantContributions.id],
  }),
  question: one(formQuestions, {
    fields: [participantAnswers.questionId],
    references: [formQuestions.id],
  }),
}));

export const llmAnalysesRelations = relations(llmAnalyses, ({ one, many }) => ({
  workshop: one(workshops, {
    fields: [llmAnalyses.workshopId],
    references: [workshops.id],
  }),
  triggeredByUser: one(users, {
    fields: [llmAnalyses.triggeredBy],
    references: [users.id],
  }),
  promptTemplate: one(promptTemplates, {
    fields: [llmAnalyses.promptTemplateId],
    references: [promptTemplates.id],
  }),
  results: many(analysisResults),
}));

export const analysisResultsRelations = relations(analysisResults, ({ one }) => ({
  analysis: one(llmAnalyses, {
    fields: [analysisResults.analysisId],
    references: [llmAnalyses.id],
  }),
}));

export const promptTemplatesRelations = relations(promptTemplates, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [promptTemplates.createdBy],
    references: [users.id],
  }),
  analyses: many(llmAnalyses),
}));

// ============================================================================
// TYPES (for TypeScript)
// ============================================================================

export type WorkshopForm = typeof workshopForms.$inferSelect;
export type NewWorkshopForm = typeof workshopForms.$inferInsert;

export type FormQuestion = typeof formQuestions.$inferSelect;
export type NewFormQuestion = typeof formQuestions.$inferInsert;

export type ParticipantContribution = typeof participantContributions.$inferSelect;
export type NewParticipantContribution = typeof participantContributions.$inferInsert;

export type ParticipantAnswer = typeof participantAnswers.$inferSelect;
export type NewParticipantAnswer = typeof participantAnswers.$inferInsert;

export type LLMAnalysis = typeof llmAnalyses.$inferSelect;
export type NewLLMAnalysis = typeof llmAnalyses.$inferInsert;

export type AnalysisResult = typeof analysisResults.$inferSelect;
export type NewAnalysisResult = typeof analysisResults.$inferInsert;

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type NewPromptTemplate = typeof promptTemplates.$inferInsert;
