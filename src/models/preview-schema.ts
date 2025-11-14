/**
 * Preview Database Schema
 *
 * PostgreSQL schema for preview sessions, analytics, and related data
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  varchar,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './postgresql-schema';

// Enums
export const previewTypeEnum = pgEnum('preview_type', [
  'workshop',
  'questionnaire',
]);
export const deviceTypeEnum = pgEnum('device_type', [
  'desktop',
  'tablet',
  'mobile',
]);
export const fontSizeEnum = pgEnum('font_size', ['small', 'medium', 'large']);
export const changeTypeEnum = pgEnum('change_type', [
  'content',
  'settings',
  'style',
  'structure',
]);
export const analyticsEventTypeEnum = pgEnum('analytics_event_type', [
  'view',
  'click',
  'scroll',
  'interaction',
  'error',
  'navigation',
]);
export const validationErrorTypeEnum = pgEnum('validation_error_type', [
  'error',
  'warning',
  'info',
]);
export const validationErrorCategoryEnum = pgEnum('validation_error_category', [
  'accessibility',
  'performance',
  'content',
  'structure',
]);

// Preview Sessions Table
export const previewSessions = pgTable('preview_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: previewTypeEnum('type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  ownerId: uuid('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  content: jsonb('content').default('{}'),

  // Settings
  mobilePreview: boolean('mobile_preview').default(false),
  tabletPreview: boolean('tablet_preview').default(false),
  deviceType: deviceTypeEnum('device_type').default('desktop'),
  darkMode: boolean('dark_mode').default(false),
  highContrast: boolean('high_contrast').default(false),
  fontSize: fontSizeEnum('font_size').default('medium'),
  autoSave: boolean('auto_save').default(true),
  showInteractionHints: boolean('show_interaction_hints').default(true),
  simulateParticipantView: boolean('simulate_participant_view').default(false),
  testMode: boolean('test_mode').default(false),
  accessibilityMode: boolean('accessibility_mode').default(false),

  // Metadata
  version: varchar('version', { length: 20 }).default('1.0.0'),
  accessibilityScore: integer('accessibility_score').default(0),
  lastValidated: timestamp('last_validated'),
  tags: text('tags').array(),
  category: varchar('category', { length: 50 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastAccessed: timestamp('last_accessed').defaultNow().notNull(),
});

// Preview Collaborators Table
export const previewCollaborators = pgTable('preview_collaborators', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => previewSessions.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: varchar('role', { length: 20 }).default('collaborator'), // owner, collaborator, viewer
  permissions: text('permissions').array(), // read, write, admin
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
});

// Preview Change History Table
export const previewChangeHistory = pgTable('preview_change_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => previewSessions.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: changeTypeEnum('type').notNull(),
  description: text('description').notNull(),
  data: jsonb('data'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Preview Analytics Events Table
export const previewAnalyticsEvents = pgTable('preview_analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => previewSessions.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  eventType: analyticsEventTypeEnum('event_type').notNull(),
  element: text('element'),
  data: jsonb('data'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  duration: integer('duration'), // For interaction timing
});

// Preview Validation Errors Table
export const previewValidationErrors = pgTable('preview_validation_errors', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => previewSessions.id, { onDelete: 'cascade' })
    .notNull(),
  type: validationErrorTypeEnum('type').notNull(),
  category: validationErrorCategoryEnum('category').notNull(),
  message: text('message').notNull(),
  element: text('element'),
  suggestion: text('suggestion'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  resolved: boolean('resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

// Preview Performance Metrics Table
export const previewPerformanceMetrics = pgTable(
  'preview_performance_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .references(() => previewSessions.id, { onDelete: 'cascade' })
      .notNull(),
    loadTime: integer('load_time'), // milliseconds
    interactionLatency: integer('interaction_latency'), // milliseconds
    memoryUsage: integer('memory_usage'), // bytes
    renderingTime: integer('rendering_time'), // milliseconds
    accessibilityCompliance: integer('accessibility_compliance'), // percentage
    mobileOptimization: integer('mobile_optimization'), // percentage
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
);

// Preview Engagement Metrics Table (Aggregated)
export const previewEngagementMetrics = pgTable('preview_engagement_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => previewSessions.id, { onDelete: 'cascade' })
    .notNull(),
  totalViews: integer('total_views').default(0),
  uniqueInteractions: integer('unique_interactions').default(0),
  timeSpent: integer('time_spent'), // seconds
  dropOffPoints: text('drop_off_points').array(),
  completionRate: integer('completion_rate'), // percentage
  userSatisfaction: integer('user_satisfaction'), // 1-5 scale
  date: timestamp('date').defaultNow().notNull(),
});

// Preview Session Snapshots (for versioning)
export const previewSessionSnapshots = pgTable('preview_session_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => previewSessions.id, { onDelete: 'cascade' })
    .notNull(),
  version: varchar('version', { length: 20 }).notNull(),
  content: jsonb('content').notNull(),
  settings: jsonb('settings').notNull(),
  createdBy: uuid('created_by')
    .references(() => users.id, { onDelete: 'set null' })
    .notNull(),
  description: text('description'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Preview Room State (for WebSocket room management)
export const previewRoomStates = pgTable('preview_room_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: varchar('room_id', { length: 255 }).unique().notNull(),
  sessionId: uuid('session_id')
    .references(() => previewSessions.id, { onDelete: 'cascade' })
    .notNull(),
  activeParticipants: integer('active_participants').default(0),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  state: jsonb('state'), // Current room state
  metadata: jsonb('metadata'),
});

// Relations
export const previewSessionsRelations = relations(
  previewSessions,
  ({ many, one }) => ({
    collaborators: many(previewCollaborators),
    changeHistory: many(previewChangeHistory),
    analyticsEvents: many(previewAnalyticsEvents),
    validationErrors: many(previewValidationErrors),
    performanceMetrics: many(previewPerformanceMetrics),
    engagementMetrics: many(previewEngagementMetrics),
    snapshots: many(previewSessionSnapshots),
    roomState: one(previewRoomStates),
    owner: one(users, {
      fields: [previewSessions.ownerId],
      references: [users.id],
    }),
  }),
);

export const previewCollaboratorsRelations = relations(
  previewCollaborators,
  ({ one }) => ({
    session: one(previewSessions, {
      fields: [previewCollaborators.sessionId],
      references: [previewSessions.id],
    }),
    user: one(users, {
      fields: [previewCollaborators.userId],
      references: [users.id],
    }),
  }),
);

export const previewChangeHistoryRelations = relations(
  previewChangeHistory,
  ({ one }) => ({
    session: one(previewSessions, {
      fields: [previewChangeHistory.sessionId],
      references: [previewSessions.id],
    }),
    user: one(users, {
      fields: [previewChangeHistory.userId],
      references: [users.id],
    }),
  }),
);

export const previewAnalyticsEventsRelations = relations(
  previewAnalyticsEvents,
  ({ one }) => ({
    session: one(previewSessions, {
      fields: [previewAnalyticsEvents.sessionId],
      references: [previewSessions.id],
    }),
    user: one(users, {
      fields: [previewAnalyticsEvents.userId],
      references: [users.id],
    }),
  }),
);

export const previewValidationErrorsRelations = relations(
  previewValidationErrors,
  ({ one }) => ({
    session: one(previewSessions, {
      fields: [previewValidationErrors.sessionId],
      references: [previewSessions.id],
    }),
    resolvedByUser: one(users, {
      fields: [previewValidationErrors.resolvedBy],
      references: [users.id],
    }),
  }),
);

export const previewPerformanceMetricsRelations = relations(
  previewPerformanceMetrics,
  ({ one }) => ({
    session: one(previewSessions, {
      fields: [previewPerformanceMetrics.sessionId],
      references: [previewSessions.id],
    }),
  }),
);

export const previewEngagementMetricsRelations = relations(
  previewEngagementMetrics,
  ({ one }) => ({
    session: one(previewSessions, {
      fields: [previewEngagementMetrics.sessionId],
      references: [previewSessions.id],
    }),
  }),
);

export const previewSessionSnapshotsRelations = relations(
  previewSessionSnapshots,
  ({ one }) => ({
    session: one(previewSessions, {
      fields: [previewSessionSnapshots.sessionId],
      references: [previewSessions.id],
    }),
    createdByUser: one(users, {
      fields: [previewSessionSnapshots.createdBy],
      references: [users.id],
    }),
  }),
);

export const previewRoomStatesRelations = relations(
  previewRoomStates,
  ({ one }) => ({
    session: one(previewSessions, {
      fields: [previewRoomStates.sessionId],
      references: [previewSessions.id],
    }),
  }),
);

// Types
export type PreviewSession = typeof previewSessions.$inferSelect;
export type NewPreviewSession = typeof previewSessions.$inferInsert;

export type PreviewCollaborator = typeof previewCollaborators.$inferSelect;
export type NewPreviewCollaborator = typeof previewCollaborators.$inferInsert;

export type PreviewChangeHistory = typeof previewChangeHistory.$inferSelect;
export type NewPreviewChangeHistory = typeof previewChangeHistory.$inferInsert;

export type PreviewAnalyticsEvent = typeof previewAnalyticsEvents.$inferSelect;
export type NewPreviewAnalyticsEvent =
  typeof previewAnalyticsEvents.$inferInsert;

export type PreviewValidationError =
  typeof previewValidationErrors.$inferSelect;
export type NewPreviewValidationError =
  typeof previewValidationErrors.$inferInsert;

export type PreviewPerformanceMetrics =
  typeof previewPerformanceMetrics.$inferSelect;
export type NewPreviewPerformanceMetrics =
  typeof previewPerformanceMetrics.$inferInsert;

export type PreviewEngagementMetrics =
  typeof previewEngagementMetrics.$inferSelect;
export type NewPreviewEngagementMetrics =
  typeof previewEngagementMetrics.$inferInsert;

export type PreviewSessionSnapshot =
  typeof previewSessionSnapshots.$inferSelect;
export type NewPreviewSessionSnapshot =
  typeof previewSessionSnapshots.$inferInsert;

export type PreviewRoomState = typeof previewRoomStates.$inferSelect;
export type NewPreviewRoomState = typeof previewRoomStates.$inferInsert;
