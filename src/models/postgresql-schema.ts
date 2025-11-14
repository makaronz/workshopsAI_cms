import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
  uuid,
  decimal,
  jsonb,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Enums for PostgreSQL
export const loginMethodEnum = pgEnum('loginMethod', ['local', 'oauth', 'sso']);
export const roleEnum = pgEnum('role', [
  'participant',
  'facilitator',
  'moderator',
  'sociologist-editor',
  'admin',
]);
export const statusEnum = pgEnum('status', [
  'draft',
  'published',
  'archived',
  'cancelled',
]);
export const templateThemeEnum = pgEnum('templateTheme', [
  'integracja',
  'konflikty',
  'well-being',
  'custom',
]);
export const languageEnum = pgEnum('language', ['pl', 'en']);
export const enrollmentStatusEnum = pgEnum('enrollmentStatus', [
  'pending',
  'confirmed',
  'waitlisted',
  'cancelled',
  'completed',
]);
export const paymentStatusEnum = pgEnum('paymentStatus', [
  'pending',
  'paid',
  'refunded',
  'waived',
]);
export const moduleTypeEnum = pgEnum('moduleType', [
  'text',
  'video',
  'quiz',
  'exercise',
  'discussion',
  'presentation',
  'file',
]);
export const announcementTypeEnum = pgEnum('announcementType', [
  'info',
  'reminder',
  'update',
  'cancellation',
  'urgent',
]);
export const feedbackStatusEnum = pgEnum('feedbackStatus', [
  'pending',
  'approved',
  'rejected',
]);
export const workshopFacilitatorRoleEnum = pgEnum('workshopFacilitatorRole', [
  'lead',
  'assistant',
  'guest',
]);
export const tagCategoryEnum = pgEnum('tagCategory', [
  'theme',
  'skill',
  'level',
  'format',
  'audience',
]);

// File management enums
export const fileAccessLevelEnum = pgEnum('fileAccessLevel', [
  'private',
  'workshop',
  'organization',
  'public',
]);
export const fileAssociatedEntityEnum = pgEnum('fileAssociatedEntity', [
  'workshop',
  'session',
  'module',
  'user',
  'questionnaire',
  'template',
  'none',
]);
export const fileProviderEnum = pgEnum('fileProvider', [
  'aws-s3',
  'google-cloud',
  'azure-blob',
  'local',
]);
export const fileStatusEnum = pgEnum('fileStatus', [
  'uploading',
  'processing',
  'completed',
  'failed',
  'deleted',
]);
export const fileOperationEnum = pgEnum('fileOperation', [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'DOWNLOAD',
  'COPY',
  'MOVE',
]);

/**
 * Users table - extended for CMS roles with PostgreSQL UUID primary key
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    openId: text('openId').notNull().unique(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    password: text('password'),
    loginMethod: loginMethodEnum('loginMethod').default('local').notNull(),
    role: roleEnum('role').default('participant').notNull(),
    avatar: text('avatar'),
    bio: text('bio'),
    isActive: boolean('isActive').default(true).notNull(),
    emailVerified: boolean('emailVerified').default(false).notNull(),
    lastLoginAt: timestamp('lastLoginAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    deletedAt: timestamp('deletedAt'), // Soft delete support
  },
  table => ({
    emailIdx: index('idx_users_email')
      .on(table.email)
      .where(sql`deleted_at IS NULL`),
    roleIdx: index('idx_users_role').on(table.role),
    openIdIdx: index('idx_users_open_id').on(table.openId),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Consents table for GDPR compliance
 */
export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    consentType: text('consentType').notNull(), // 'research_analysis', 'marketing_emails', 'data_sharing'
    granted: boolean('granted').notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index('idx_consents_user_id').on(table.userId),
    consentTypeIdx: index('idx_consents_type').on(table.consentType),
  }),
);

export type Consent = typeof consents.$inferSelect;
export type InsertConsent = typeof consents.$inferInsert;

/**
 * Audit Log table for GDPR compliance
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').references(() => users.id, { onDelete: 'set null' }),
    tableName: text('tableName').notNull(),
    recordId: uuid('recordId').notNull(),
    operation: text('operation').notNull(), // 'CREATE', 'UPDATE', 'DELETE', 'READ'
    oldValues: jsonb('oldValues'),
    newValues: jsonb('newValues'),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  table => ({
    recordIdIdx: index('idx_audit_logs_record_id').on(table.recordId),
    timestampIdx: index('idx_audit_logs_timestamp').on(table.timestamp),
    userIdIdx: index('idx_audit_logs_user_id').on(table.userId),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ===== FILE MANAGEMENT SYSTEM =====

/**
 * Files table - file metadata and storage information
 */
export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originalName: text('originalName').notNull(),
    fileName: text('fileName').notNull(),
    filePath: text('filePath').notNull(),
    fileSize: text('fileSize').notNull(), // Store as string to support large files
    mimeType: text('mimeType').notNull(),
    extension: text('extension').notNull(),
    category: text('category'), // 'image', 'document', 'video', 'audio', etc.
    uploadedBy: uuid('uploadedBy')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    associatedEntityType: fileAssociatedEntityEnum(
      'associatedEntityType',
    ).default('none'),
    associatedEntityId: uuid('associatedEntityId'), // References workshop, session, module, etc.
    isPublic: boolean('isPublic').default(false).notNull(),
    accessLevel: fileAccessLevelEnum('accessLevel')
      .default('private')
      .notNull(),
    tags: text('tags').array(), // Array of tags for categorization
    metadata: jsonb('metadata'), // Additional file-specific metadata
    provider: fileProviderEnum('provider').notNull(), // Storage provider
    bucket: text('bucket'), // Bucket/container name
    region: text('region'), // Storage region
    cdnUrl: text('cdnUrl'), // CDN URL for the file
    previewUrl: text('previewUrl'), // Preview image URL
    thumbnailUrl: text('thumbnailUrl'), // Thumbnail image URL
    checksum: text('checksum'), // SHA-256 checksum for integrity
    status: fileStatusEnum('status').default('completed').notNull(),
    uploadedAt: timestamp('uploadedAt').defaultNow().notNull(),
    lastAccessedAt: timestamp('lastAccessedAt'),
    expiresAt: timestamp('expiresAt'), // For temporary files
    downloadCount: text('downloadCount').default('0').notNull(),
    deletedAt: timestamp('deletedAt'), // Soft delete support
    deletedBy: uuid('deletedBy').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    uploadedByIdx: index('idx_files_uploaded_by').on(table.uploadedBy),
    associatedEntityIdx: index('idx_files_associated_entity').on(
      table.associatedEntityType,
      table.associatedEntityId,
    ),
    mimeTypeIdx: index('idx_files_mime_type').on(table.mimeType),
    accessLevelIdx: index('idx_files_access_level').on(table.accessLevel),
    statusIdx: index('idx_files_status').on(table.status),
    uploadedAtIdx: index('idx_files_uploaded_at').on(table.uploadedAt),
    expiresAtIdx: index('idx_files_expires_at').on(table.expiresAt),
    checksumIdx: index('idx_files_checksum').on(table.checksum),
    deletedAtIdx: index('idx_files_deleted_at').on(table.deletedAt),
  }),
);

export type File = typeof files.$inferSelect;
export type InsertFile = typeof files.$inferInsert;

/**
 * File Versions table - version history for files
 */
export const fileVersions = pgTable(
  'file_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('fileId')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    versionNumber: text('versionNumber').notNull(), // SemVer version (1.0.0, 1.1.0, etc.)
    fileName: text('fileName').notNull(),
    filePath: text('filePath').notNull(),
    fileSize: text('fileSize').notNull(),
    mimeType: text('mimeType').notNull(),
    checksum: text('checksum').notNull(),
    changeDescription: text('changeDescription'), // Description of changes
    uploadedBy: uuid('uploadedBy')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    isActive: boolean('isActive').default(false).notNull(), // Currently active version
  },
  table => ({
    fileIdIdx: index('idx_file_versions_file_id').on(table.fileId),
    versionNumberIdx: index('idx_file_versions_version').on(
      table.fileId,
      table.versionNumber,
    ),
    uploadedByIdx: index('idx_file_versions_uploaded_by').on(table.uploadedBy),
    isActiveIdx: index('idx_file_versions_is_active').on(table.isActive),
  }),
);

export type FileVersion = typeof fileVersions.$inferSelect;
export type InsertFileVersion = typeof fileVersions.$inferInsert;

/**
 * File Access Logs table - detailed access tracking
 */
export const fileAccessLogs = pgTable(
  'file_access_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('fileId')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    userId: uuid('userId').references(() => users.id, { onDelete: 'set null' }),
    operation: fileOperationEnum('operation').notNull(), // 'READ', 'DOWNLOAD', 'COPY', etc.
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    referer: text('referer'),
    success: boolean('success').notNull(),
    errorMessage: text('errorMessage'), // If operation failed
    bytesTransferred: text('bytesTransferred'), // For downloads
    duration: text('duration'), // Operation duration in milliseconds
    metadata: jsonb('metadata'), // Additional operation metadata
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  table => ({
    fileIdIdx: index('idx_file_access_logs_file_id').on(table.fileId),
    userIdIdx: index('idx_file_access_logs_user_id').on(table.userId),
    operationIdx: index('idx_file_access_logs_operation').on(table.operation),
    timestampIdx: index('idx_file_access_logs_timestamp').on(
      table.timestamp,
    ),
    successIdx: index('idx_file_access_logs_success').on(table.success),
  }),
);

export type FileAccessLog = typeof fileAccessLogs.$inferSelect;
export type InsertFileAccessLog = typeof fileAccessLogs.$inferInsert;

/**
 * File Sharing table - shared file links and permissions
 */
export const fileShares = pgTable(
  'file_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('fileId')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    sharedBy: uuid('sharedBy')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shareToken: text('shareToken').notNull().unique(), // Unique token for shared link
    shareType: text('shareType').notNull(), // 'link', 'email', 'embed'
    permissions: text('permissions').array().notNull(), // ['view', 'download', 'comment', 'edit']
    accessLevel: fileAccessLevelEnum('accessLevel')
      .default('private')
      .notNull(),
    expiresAt: timestamp('expiresAt'), // Link expiration
    maxDownloads: text('maxDownloads'), // Download limit
    downloadCount: text('downloadCount').default('0').notNull(),
    password: text('password'), // Password protection
    requiresLogin: boolean('requiresLogin').default(false).notNull(),
    allowedEmails: text('allowedEmails').array(), // Whitelisted emails
    blockedEmails: text('blockedEmails').array(), // Blacklisted emails
    metadata: jsonb('metadata'), // Additional share settings
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    lastAccessedAt: timestamp('lastAccessedAt'),
    isActive: boolean('isActive').default(true).notNull(),
  },
  table => ({
    fileIdIdx: index('idx_file_shares_file_id').on(table.fileId),
    sharedByIdx: index('idx_file_shares_shared_by').on(table.sharedBy),
    shareTokenIdx: index('idx_file_shares_token').on(table.shareToken),
    expiresAtIdx: index('idx_file_shares_expires_at').on(table.expiresAt),
    isActiveIdx: index('idx_file_shares_is_active').on(table.isActive),
  }),
);

export type FileShare = typeof fileShares.$inferSelect;
export type InsertFileShare = typeof fileShares.$inferInsert;

/**
 * File Quotas table - storage quotas and limits
 */
export const fileQuotas = pgTable(
  'file_quotas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    storageQuota: text('storageQuota').notNull(), // Total storage limit in bytes
    storageUsed: text('storageUsed').default('0').notNull(), // Current storage usage
    fileCountQuota: text('fileCountQuota').default('1000'), // Max number of files
    fileCountUsed: text('fileCountUsed').default('0').notNull(), // Current file count
    maxFileSize: text('maxFileSize'), // Per-file size limit
    allowedFileTypes: text('allowedFileTypes').array(), // Restrict file types
    bandwidthQuota: text('bandwidthQuota'), // Monthly bandwidth limit
    bandwidthUsed: text('bandwidthUsed').default('0').notNull(),
    bandwidthResetDate: timestamp('bandwidthResetDate').notNull(), // When bandwidth quota resets
    warningsSent: text('warningsSent').array(), // Types of warnings sent
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index('idx_file_quotas_user_id').on(table.userId),
    storageUsedIdx: index('idx_file_quotas_storage_used').on(table.storageUsed),
    bandwidthResetIdx: index('idx_file_quotas_bandwidth_reset').on(
      table.bandwidthResetDate,
    ),
  }),
);

export type FileQuota = typeof fileQuotas.$inferSelect;
export type InsertFileQuota = typeof fileQuotas.$inferInsert;

/**
 * Facilitators table - detailed facilitator profiles
 */
export const facilitators = pgTable(
  'facilitators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    title: text('title'),
    organization: text('organization'),
    experience: text('experience'),
    specializations: jsonb('specializations').$type<string[]>(),
    certifications: jsonb('certifications').$type<string[]>(),
    languages: jsonb('languages').$type<string[]>(),
    website: text('website'),
    socialLinks: jsonb('socialLinks').$type<Record<string, string>>(),
    isAvailable: boolean('isAvailable').default(true).notNull(),
    rating: decimal('rating', { precision: 3, scale: 2 }).default('0.00'),
    totalWorkshops: decimal('totalWorkshops', {
      precision: 10,
      scale: 0,
    }).default('0'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    deletedAt: timestamp('deletedAt'),
  },
  table => ({
    userIdIdx: index('idx_facilitators_user_id').on(table.userId),
    slugIdx: index('idx_facilitators_slug').on(table.slug),
  }),
);

export type Facilitator = typeof facilitators.$inferSelect;
export type InsertFacilitator = typeof facilitators.$inferInsert;

/**
 * Locations table - workshop venues
 */
export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    address: text('address'),
    city: text('city'),
    country: text('country'),
    capacity: decimal('capacity', { precision: 10, scale: 0 }),
    facilities: jsonb('facilities').$type<string[]>(),
    coordinates: jsonb('coordinates').$type<{ lat: number; lng: number }>(),
    contactInfo: jsonb('contactInfo').$type<{
      email?: string;
      phone?: string;
    }>(),
    imageUrl: text('imageUrl'),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    deletedAt: timestamp('deletedAt'),
  },
  table => ({
    slugIdx: index('idx_locations_slug').on(table.slug),
    cityIdx: index('idx_locations_city').on(table.city),
  }),
);

export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

/**
 * Tags table - workshop categories and tags
 */
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    color: text('color').default('#000000'),
    category: tagCategoryEnum('category').notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    usageCount: decimal('usageCount', { precision: 10, scale: 0 }).default('0'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    slugIdx: index('idx_tags_slug').on(table.slug),
    categoryIdx: index('idx_tags_category').on(table.category),
  }),
);

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Workshops table - main workshop content with PostgreSQL enhancements
 */
export const workshops = pgTable(
  'workshops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    titleI18n: jsonb('titleI18n').notNull(), // JSON for i18n support: {"pl": "Title", "en": "Title"}
    subtitleI18n: jsonb('subtitleI18n'), // i18n subtitle
    descriptionI18n: jsonb('descriptionI18n'), // i18n description
    shortDescriptionI18n: jsonb('shortDescriptionI18n'), // i18n short description
    status: statusEnum('status').default('draft').notNull(),
    startDate: timestamp('startDate'),
    endDate: timestamp('endDate'),
    seatLimit: decimal('seatLimit', { precision: 10, scale: 0 }),
    seatReserved: decimal('seatReserved', { precision: 10, scale: 0 }).default(
      '0',
    ),
    enableWaitingList: boolean('enableWaitingList').default(true).notNull(),
    waitingListCount: decimal('waitingListCount', {
      precision: 10,
      scale: 0,
    }).default('0'),
    templateTheme: templateThemeEnum('templateTheme').default('custom'),
    language: languageEnum('language').default('pl').notNull(),
    price: decimal('price', { precision: 10, scale: 2 }).default('0.00'),
    currency: text('currency').default('PLN'),
    imageUrl: text('imageUrl'),
    gallery: jsonb('gallery').$type<string[]>(),
    requirementsI18n:
      jsonb('requirementsI18n').$type<Record<string, string[]>>(),
    objectivesI18n: jsonb('objectivesI18n').$type<Record<string, string[]>>(),
    materials:
      jsonb('materials').$type<
        Array<{ name: string; url: string; type: string }>
      >(),
    createdBy: uuid('createdBy')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publishedAt: timestamp('publishedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    deletedAt: timestamp('deletedAt'), // Soft delete support
  },
  table => ({
    slugIdx: index('idx_workshops_slug').on(table.slug),
    statusIdx: index('idx_workshops_status').on(table.status),
    startDateIdx: index('idx_workshops_start_date').on(table.startDate),
    createdByIdx: index('idx_workshops_created_by').on(table.createdBy),
    publishedAtIdx: index('idx_workshops_published_at').on(table.publishedAt),
  }),
);

export type Workshop = typeof workshops.$inferSelect;
export type InsertWorkshop = typeof workshops.$inferInsert;

/**
 * Workshop Sessions table with PostgreSQL enhancements
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshopId')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    titleI18n: jsonb('titleI18n').notNull(), // i18n title
    descriptionI18n: jsonb('descriptionI18n'), // i18n description
    startTime: timestamp('startTime').notNull(),
    endTime: timestamp('endTime').notNull(),
    duration: decimal('duration', { precision: 10, scale: 0 }), // in minutes
    orderIndex: decimal('orderIndex', { precision: 10, scale: 0 }).default('0'),
    locationId: uuid('locationId').references(() => locations.id, {
      onDelete: 'set null',
    }),
    materials:
      jsonb('materials').$type<
        Array<{ name: string; url: string; type: string }>
      >(),
    isRequired: boolean('isRequired').default(true).notNull(),
    maxParticipants: decimal('maxParticipants', { precision: 10, scale: 0 }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    workshopIdIdx: index('idx_sessions_workshop_id').on(table.workshopId),
    orderIdx: index('idx_sessions_order').on(table.orderIndex),
    locationIdIdx: index('idx_sessions_location_id').on(table.locationId),
    startTimeIdx: index('idx_sessions_start_time').on(table.startTime),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Session Modules table - individual content blocks
 */
export const modules = pgTable(
  'modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('sessionId')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    titleI18n: jsonb('titleI18n'), // i18n title
    type: moduleTypeEnum('type').notNull(),
    contentI18n: jsonb('contentI18n').notNull(), // Flexible i18n content structure based on type
    duration: decimal('duration', { precision: 10, scale: 0 }), // in minutes
    orderIndex: decimal('orderIndex', { precision: 10, scale: 0 }).default('0'),
    isRequired: boolean('isRequired').default(true).notNull(),
    resources:
      jsonb('resources').$type<
        Array<{ name: string; url: string; type: string }>
      >(),
    settings: jsonb('settings').$type<Record<string, any>>(), // Type-specific settings
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    sessionIdIdx: index('idx_modules_session_id').on(table.sessionId),
    orderIdx: index('idx_modules_order').on(table.orderIndex),
    typeIdx: index('idx_modules_type').on(table.type),
  }),
);

export type Module = typeof modules.$inferSelect;
export type InsertModule = typeof modules.$inferInsert;

/**
 * Enrollments table with PostgreSQL enhancements
 */
export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshopId')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    participantId: uuid('participantId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: enrollmentStatusEnum('status').default('pending').notNull(),
    enrollmentDate: timestamp('enrollmentDate').defaultNow().notNull(),
    confirmedAt: timestamp('confirmedAt'),
    cancelledAt: timestamp('cancelledAt'),
    completedAt: timestamp('completedAt'),
    notes: text('notes'),
    specialRequirements: text('specialRequirements'),
    paymentStatus: paymentStatusEnum('paymentStatus').default('pending'),
    paymentAmount: decimal('paymentAmount', { precision: 10, scale: 2 }),
    attendance:
      jsonb('attendance').$type<
        Array<{ sessionId: string; attended: boolean; notes?: string }>
      >(),
    formData: jsonb('formData').$type<Record<string, any>>(), // Encrypted form data for GDPR
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    workshopIdIdx: index('idx_enrollments_workshop_id').on(table.workshopId),
    participantIdIdx: index('idx_enrollments_participant_id').on(
      table.participantId,
    ),
    statusIdx: index('idx_enrollments_status').on(table.status),
    enrollmentDateIdx: index('idx_enrollments_enrollment_date').on(
      table.enrollmentDate,
    ),
  }),
);

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

// Additional enums for questionnaire system
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
export const responseStatusEnum = pgEnum('responseStatus', [
  'draft',
  'submitted',
]);
export const llmAnalysisTypeEnum = pgEnum('llmAnalysisType', [
  'thematic',
  'clusters',
  'contradictions',
  'insights',
  'recommendations',
]);

/**
 * Questionnaires table - enhanced for GDPR compliance and workshop integration
 */
export const questionnaires = pgTable(
  'questionnaires',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshopId'), // nullable for standalone questionnaires
    titleI18n: jsonb('titleI18n').notNull(), // {"pl": "Tytuł", "en": "Title"}
    instructionsI18n: jsonb('instructionsI18n'), // {"pl": "Instrukcje", "en": "Instructions"}
    status: questionnaireStatusEnum('status').default('draft').notNull(),
    settings: jsonb('settings')
      .$type<{
        anonymous: boolean;
        require_consent: boolean;
        max_responses: number | null;
        close_after_workshop: boolean;
        show_all_questions: boolean;
        allow_edit: boolean;
        question_style: 'first_person_plural' | 'third_person';
      }>()
      .default({
        anonymous: false,
        require_consent: true,
        max_responses: null,
        close_after_workshop: false,
        show_all_questions: true,
        allow_edit: true,
        question_style: 'first_person_plural',
      }),
    publishedAt: timestamp('publishedAt'),
    closedAt: timestamp('closedAt'),
    createdBy: uuid('createdBy')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    deletedAt: timestamp('deletedAt'), // Soft delete support
  },
  table => ({
    workshopIdIdx: index('idx_questionnaires_workshop_id').on(table.workshopId),
    statusIdx: index('idx_questionnaires_status').on(table.status),
    createdByIdx: index('idx_questionnaires_created_by').on(table.createdBy),
    publishedAtIdx: index('idx_questionnaires_published_at').on(
      table.publishedAt,
    ),
  }),
);

export type Questionnaire = typeof questionnaires.$inferSelect;
export type InsertQuestionnaire = typeof questionnaires.$inferInsert;

/**
 * Question Groups table - enhanced for better organization and UX
 */
export const questionGroups = pgTable(
  'question_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionnaireId: uuid('questionnaireId')
      .notNull()
      .references(() => questionnaires.id, { onDelete: 'cascade' }),
    titleI18n: jsonb('titleI18n').notNull(), // {"pl": "Sekcja 1", "en": "Section 1"}
    descriptionI18n: jsonb('descriptionI18n'),
    orderIndex: decimal('orderIndex', { precision: 10, scale: 0 }).notNull(),
    uiConfig: jsonb('uiConfig')
      .$type<{
        collapsed: boolean;
        show_progress: boolean;
        icon: string | null;
        color: string | null;
      }>()
      .default({
        collapsed: false,
        show_progress: true,
        icon: null,
        color: null,
      }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    questionnaireIdIdx: index('idx_question_groups_questionnaire_id').on(
      table.questionnaireId,
    ),
    orderIndexIdx: index('idx_question_groups_order').on(table.orderIndex),
  }),
);

export type QuestionGroup = typeof questionGroups.$inferSelect;
export type InsertQuestionGroup = typeof questionGroups.$inferInsert;

/**
 * Questions table - enhanced with advanced validation and conditional logic
 */
export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('groupId')
      .notNull()
      .references(() => questionGroups.id, { onDelete: 'cascade' }),
    textI18n: jsonb('textI18n').notNull(), // {"pl": "Pytanie", "en": "Question"}
    type: questionTypeEnum('type').notNull(),
    optionsI18n: jsonb('optionsI18n').$type<
      Array<{
        value: string;
        label: { pl: string; en: string };
      }>
    >(),
    validation: jsonb('validation').$type<{
      required: boolean;
      min_length?: number;
      max_length?: number;
      min_value?: number;
      max_value?: number;
      pattern?: string;
    }>(),
    conditionalLogic: jsonb('conditionalLogic').$type<{
      show_if?: {
        question_id: string;
        operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
        value: any;
      };
    }>(),
    orderIndex: decimal('orderIndex', { precision: 10, scale: 0 }).notNull(),
    helpTextI18n: jsonb('helpTextI18n').$type<{ pl?: string; en?: string }>(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    groupIdIdx: index('idx_questions_group_id').on(table.groupId),
    orderIndexIdx: index('idx_questions_order').on(table.orderIndex),
    typeIdx: index('idx_questions_type').on(table.type),
  }),
);

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

/**
 * Responses table - enhanced for GDPR compliance and detailed analytics
 */
export const responses = pgTable(
  'responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('questionId')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    userId: uuid('userId'), // nullable if anonymous
    enrollmentId: uuid('enrollmentId').references(() => enrollments.id, {
      onDelete: 'set null',
    }), // nullable for standalone
    answer: jsonb('answer').notNull(), // polymorphic based on question type
    metadata: jsonb('metadata').$type<{
      ip_hash: string;
      user_agent_hash: string;
      time_spent_ms: number;
      edit_count: number;
    }>(),
    status: responseStatusEnum('status').default('draft').notNull(),
    submittedAt: timestamp('submittedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    questionIdIdx: index('idx_responses_question_id').on(table.questionId),
    userIdIdx: index('idx_responses_user_id').on(table.userId),
    enrollmentIdIdx: index('idx_responses_enrollment_id').on(
      table.enrollmentId,
    ),
    statusIdx: index('idx_responses_status').on(table.status),
    submittedAtIdx: index('idx_responses_submitted_at').on(table.submittedAt),
  }),
);

export type Response = typeof responses.$inferSelect;
export type InsertResponse = typeof responses.$inferInsert;

/**
 * LLM Analyses table - enhanced AI analysis for questionnaire insights
 */
export const llmAnalyses = pgTable(
  'llm_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionnaireId: uuid('questionnaireId')
      .notNull()
      .references(() => questionnaires.id, { onDelete: 'cascade' }),
    analysisType: llmAnalysisTypeEnum('analysisType').notNull(),
    results: jsonb('results').notNull(), // structured JSON results
    metadata: jsonb('metadata').$type<{
      model: string;
      prompt_version: string;
      tokens_used: number;
      processing_time_ms: number;
      confidence_score: number;
      response_count: number;
    }>(),
    status: questionnaireStatusEnum('status').default('draft').notNull(),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    completedAt: timestamp('completedAt'),
    createdBy: uuid('createdBy')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  table => ({
    questionnaireIdIdx: index('idx_llm_analyses_questionnaire_id').on(
      table.questionnaireId,
    ),
    analysisTypeIdx: index('idx_llm_analyses_type').on(table.analysisType),
    statusIdx: index('idx_llm_analyses_status').on(table.status),
    createdByIdx: index('idx_llm_analyses_created_by').on(table.createdBy),
  }),
);

export type LLMAnalysis = typeof llmAnalyses.$inferSelect;
export type InsertLLMAnalysis = typeof llmAnalyses.$inferInsert;

/**
 * Workshop Tags junction table
 */
export const workshopTags = pgTable(
  'workshop_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshopId')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    tagId: uuid('tagId')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  table => ({
    workshopIdIdx: index('idx_workshop_tags_workshop_id').on(table.workshopId),
    tagIdIdx: index('idx_workshop_tags_tag_id').on(table.tagId),
  }),
);

export type WorkshopTag = typeof workshopTags.$inferSelect;
export type InsertWorkshopTag = typeof workshopTags.$inferInsert;

/**
 * Workshop Facilitators junction table
 */
export const workshopFacilitators = pgTable(
  'workshop_facilitators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshopId')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    facilitatorId: uuid('facilitatorId')
      .notNull()
      .references(() => facilitators.id, { onDelete: 'cascade' }),
    role: workshopFacilitatorRoleEnum('role').default('assistant').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  table => ({
    workshopIdIdx: index('idx_workshop_facilitators_workshop_id').on(
      table.workshopId,
    ),
    facilitatorIdIdx: index('idx_workshop_facilitators_facilitator_id').on(
      table.facilitatorId,
    ),
  }),
);

export type WorkshopFacilitator = typeof workshopFacilitators.$inferSelect;
export type InsertWorkshopFacilitator =
  typeof workshopFacilitators.$inferInsert;

/**
 * Announcements table - workshop announcements
 */
export const announcements = pgTable(
  'announcements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshopId')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    titleI18n: jsonb('titleI18n').notNull(),
    contentI18n: jsonb('contentI18n').notNull(),
    type: announcementTypeEnum('type').default('info').notNull(),
    sendEmail: boolean('sendEmail').default(false).notNull(),
    emailSentAt: timestamp('emailSentAt'),
    isPublished: boolean('isPublished').default(false).notNull(),
    publishedAt: timestamp('publishedAt'),
    createdBy: uuid('createdBy')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    workshopIdIdx: index('idx_announcements_workshop_id').on(table.workshopId),
    typeIdx: index('idx_announcements_type').on(table.type),
    isPublishedIdx: index('idx_announcements_is_published').on(
      table.isPublished,
    ),
  }),
);

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;

/**
 * Feedback table - workshop feedback and reviews
 */
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshopId')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    participantId: uuid('participantId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: decimal('rating', { precision: 2, scale: 1 }), // 1-5 stars
    contentI18n: jsonb('contentI18n'), // i18n feedback content
    isPublic: boolean('isPublic').default(false).notNull(),
    isAnonymous: boolean('isAnonymous').default(false).notNull(),
    status: feedbackStatusEnum('status').default('pending').notNull(),
    reviewedBy: uuid('reviewedBy').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewNotes: text('reviewNotes'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    workshopIdIdx: index('idx_feedback_workshop_id').on(table.workshopId),
    participantIdIdx: index('idx_feedback_participant_id').on(
      table.participantId,
    ),
    statusIdx: index('idx_feedback_status').on(table.status),
  }),
);

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

// Relations for PostgreSQL schema
export const usersRelations = relations(users, ({ many, one }) => ({
  facilitatorProfile: one(facilitators, {
    fields: [users.id],
    references: [facilitators.userId],
  }),
  createdWorkshops: many(workshops),
  enrollments: many(enrollments),
  feedback: many(feedback),
  announcements: many(announcements),
  consents: many(consents),
  auditLogs: many(auditLogs),
  responses: many(responses),
  emailTemplates: many(emailTemplates),
  emailLogs: many(emailLogs),
  emailConsents: many(emailConsents),
}));

export const facilitatorsRelations = relations(
  facilitators,
  ({ one, many }) => ({
    user: one(users, { fields: [facilitators.userId], references: [users.id] }),
    workshopFacilitators: many(workshopFacilitators),
  }),
);

export const locationsRelations = relations(locations, ({ many }) => ({
  workshopLocations: many(sessions),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  workshopTags: many(workshopTags),
}));

export const workshopsRelations = relations(workshops, ({ one, many }) => ({
  creator: one(users, {
    fields: [workshops.createdBy],
    references: [users.id],
  }),
  sessions: many(sessions),
  enrollments: many(enrollments),
  workshopTags: many(workshopTags),
  workshopFacilitators: many(workshopFacilitators),
  announcements: many(announcements),
  feedback: many(feedback),
  questionnaires: many(questionnaires),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  workshop: one(workshops, {
    fields: [sessions.workshopId],
    references: [workshops.id],
  }),
  modules: many(modules),
  location: one(locations, {
    fields: [sessions.locationId],
    references: [locations.id],
  }),
}));

export const modulesRelations = relations(modules, ({ one }) => ({
  session: one(sessions, {
    fields: [modules.sessionId],
    references: [sessions.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  workshop: one(workshops, {
    fields: [enrollments.workshopId],
    references: [workshops.id],
  }),
  participant: one(users, {
    fields: [enrollments.participantId],
    references: [users.id],
  }),
}));

export const questionnairesRelations = relations(
  questionnaires,
  ({ one, many }) => ({
    workshop: one(workshops, {
      fields: [questionnaires.workshopId],
      references: [workshops.id],
    }),
    questionGroups: many(questionGroups),
    llmAnalyses: many(llmAnalyses),
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
}));

export const responsesRelations = relations(responses, ({ one }) => ({
  user: one(users, { fields: [responses.userId], references: [users.id] }),
  question: one(questions, {
    fields: [responses.questionId],
    references: [questions.id],
  }),
}));

export const llmAnalysesRelations = relations(llmAnalyses, ({ one }) => ({
  questionnaire: one(questionnaires, {
    fields: [llmAnalyses.questionnaireId],
    references: [questionnaires.id],
  }),
}));

export const workshopTagsRelations = relations(workshopTags, ({ one }) => ({
  workshop: one(workshops, {
    fields: [workshopTags.workshopId],
    references: [workshops.id],
  }),
  tag: one(tags, { fields: [workshopTags.tagId], references: [tags.id] }),
}));

export const workshopFacilitatorsRelations = relations(
  workshopFacilitators,
  ({ one }) => ({
    workshop: one(workshops, {
      fields: [workshopFacilitators.workshopId],
      references: [workshops.id],
    }),
    facilitator: one(facilitators, {
      fields: [workshopFacilitators.facilitatorId],
      references: [facilitators.id],
    }),
  }),
);

export const announcementsRelations = relations(announcements, ({ one }) => ({
  workshop: one(workshops, {
    fields: [announcements.workshopId],
    references: [workshops.id],
  }),
  creator: one(users, {
    fields: [announcements.createdBy],
    references: [users.id],
  }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  workshop: one(workshops, {
    fields: [feedback.workshopId],
    references: [workshops.id],
  }),
  participant: one(users, {
    fields: [feedback.participantId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [feedback.reviewedBy],
    references: [users.id],
  }),
}));

export const consentsRelations = relations(consents, ({ one }) => ({
  user: one(users, { fields: [consents.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

// ===== FILE MANAGEMENT RELATIONS =====

export const filesRelations = relations(files, ({ one, many }) => ({
  uploader: one(users, { fields: [files.uploadedBy], references: [users.id] }),
  deleter: one(users, { fields: [files.deletedBy], references: [users.id] }),
  workshop: one(workshops, {
    fields: [files.associatedEntityId],
    references: [workshops.id],
  }),
  session: one(sessions, {
    fields: [files.associatedEntityId],
    references: [sessions.id],
  }),
  module: one(modules, {
    fields: [files.associatedEntityId],
    references: [modules.id],
  }),
  questionnaire: one(questionnaires, {
    fields: [files.associatedEntityId],
    references: [questionnaires.id],
  }),
  versions: many(fileVersions),
  accessLogs: many(fileAccessLogs),
  shares: many(fileShares),
}));

export const fileVersionsRelations = relations(
  fileVersions,
  ({ one, many }) => ({
    file: one(files, { fields: [fileVersions.fileId], references: [files.id] }),
    uploader: one(users, {
      fields: [fileVersions.uploadedBy],
      references: [users.id],
    }),
  }),
);

export const fileAccessLogsRelations = relations(fileAccessLogs, ({ one }) => ({
  file: one(files, { fields: [fileAccessLogs.fileId], references: [files.id] }),
  user: one(users, { fields: [fileAccessLogs.userId], references: [users.id] }),
}));

export const fileSharesRelations = relations(fileShares, ({ one, many }) => ({
  file: one(files, { fields: [fileShares.fileId], references: [files.id] }),
  sharer: one(users, { fields: [fileShares.sharedBy], references: [users.id] }),
}));

export const fileQuotasRelations = relations(fileQuotas, ({ one }) => ({
  user: one(users, { fields: [fileQuotas.userId], references: [users.id] }),
}));

// Update existing relations to include file management
// Note: Duplicated usersRelations was removed - the first definition includes necessary relations

// Duplicate relations removed - originals defined above
// Note: File relations already included in original definitions

// Duplicate questionnairesRelations removed - original defined above

// ===== EMAIL SYSTEM SCHEMAS =====

// Additional enums for email system
export const emailTypeEnum = pgEnum('emailType', [
  'workshop_invitation',
  'session_reminder',
  'questionnaire_reminder',
  'workshop_update',
  'account_verification',
  'password_reset',
  'completion_certificate',
  'enrollment_confirmation',
  'waiting_list_notification',
  'workshop_cancellation',
  'custom',
]);
export const emailStatusEnum = pgEnum('emailStatus', [
  'pending',
  'processing',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'failed',
  'cancelled',
]);
export const emailProviderEnum = pgEnum('emailProvider', [
  'sendgrid',
  'mailgun',
  'nodemailer',
]);
export const emailPriorityEnum = pgEnum('emailPriority', ['low', 'normal', 'high', 'urgent']);
export const emailBounceTypeEnum = pgEnum('emailBounceType', ['hard', 'soft', 'spam', 'complaint']);
export const emailBlacklistReasonEnum = pgEnum('emailBlacklistReason', [
  'bounced',
  'complained',
  'spam',
  'unsubscribed',
  'blocked',
  'admin',
]);
export const emailBlacklistProviderEnum = pgEnum('emailBlacklistProvider', [
  'sendgrid',
  'mailgun',
  'nodemailer',
  'manual',
]);

/**
 * Email Templates table - predefined email templates
 */
export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    type: emailTypeEnum('type').notNull(),
    subjectI18n: jsonb('subjectI18n').notNull(),
    htmlTemplate: text('htmlTemplate').notNull(),
    textTemplate: text('textTemplate'),
    variables: jsonb('variables').$type<
      Array<{
        name: string;
        type: 'string' | 'number' | 'date' | 'boolean' | 'url';
        required: boolean;
        default?: any;
        description: { pl: string; en: string };
      }>
    >(),
    isActive: boolean('isActive').default(true).notNull(),
    version: decimal('version', { precision: 10, scale: 0 }).default('1').notNull(),
    createdBy: uuid('createdBy')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    nameIdx: index('idx_email_template_name').on(table.name),
    typeIdx: index('idx_email_template_type').on(table.type),
    createdByIdx: index('idx_email_template_created_by').on(table.createdBy),
  }),
);

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

/**
 * Email Logs table - comprehensive email tracking
 */
export const emailLogs = pgTable(
  'email_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: text('messageId'), // Provider-specific message ID
    templateId: uuid('templateId').references(() => emailTemplates.id, {
      onDelete: 'set null',
    }),
    userId: uuid('userId').references(() => users.id, { onDelete: 'set null' }),
    workshopId: uuid('workshopId').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    enrollmentId: uuid('enrollmentId').references(() => enrollments.id, {
      onDelete: 'set null',
    }),
    type: emailTypeEnum('type').notNull(),
    toEmail: text('toEmail').notNull(),
    fromEmail: text('fromEmail').notNull(),
    fromName: text('fromName').notNull(),
    subject: text('subject').notNull(),
    language: languageEnum('language').default('pl').notNull(),
    status: emailStatusEnum('status').default('pending').notNull(),
    provider: emailProviderEnum('provider').notNull(),
    providerMessageId: text('providerMessageId'),
    priority: emailPriorityEnum('priority').default('normal').notNull(),
    scheduledAt: timestamp('scheduledAt'),
    sentAt: timestamp('sentAt'),
    deliveredAt: timestamp('deliveredAt'),
    openedAt: timestamp('openedAt'),
    lastClickedAt: timestamp('lastClickedAt'),
    bouncedAt: timestamp('bouncedAt'),
    failedAt: timestamp('failedAt'),
    retryCount: decimal('retryCount', { precision: 10, scale: 0 }).default('0').notNull(),
    maxRetries: decimal('maxRetries', { precision: 10, scale: 0 }).default('3').notNull(),
    nextRetryAt: timestamp('nextRetryAt'),
    errorMessage: text('errorMessage'),
    bounceReason: text('bounceReason'),
    bounceType: emailBounceTypeEnum('bounceType'),
    metadata: jsonb('metadata').$type<{
      userAgent?: string;
      ipAddress?: string;
      device?: string;
      platform?: string;
      browser?: string;
      linkClicks?: Array<{ url: string; clickedAt: string; count: number }>;
      openCount?: number;
      clickCount?: number;
      unsubscribeToken?: string;
      trackingId?: string;
    }>(),
    consent: jsonb('consent').$type<{
      marketing: boolean;
      transactional: boolean;
      givenAt?: string;
      ipAddress?: string;
      withdrawnAt?: string;
    }>(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    messageIdIdx: index('idx_email_message_id').on(table.messageId),
    templateIdIdx: index('idx_email_template_id').on(table.templateId),
    userIdIdx: index('idx_email_user_id').on(table.userId),
    workshopIdIdx: index('idx_email_workshop_id').on(table.workshopId),
    enrollmentIdIdx: index('idx_email_enrollment_id').on(table.enrollmentId),
    typeIdx: index('idx_email_type').on(table.type),
    statusIdx: index('idx_email_status').on(table.status),
    toEmailIdx: index('idx_email_to_email').on(table.toEmail),
    providerMessageIdIdx: index('idx_email_provider_message_id').on(
      table.providerMessageId,
    ),
    scheduledAtIdx: index('idx_email_scheduled_at').on(table.scheduledAt),
    createdAtIdx: index('idx_email_created_at').on(table.createdAt),
  }),
);

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

/**
 * Email Consent table - GDPR consent management for emails
 */
export const emailConsents = pgTable(
  'email_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    marketing: boolean('marketing').default(false).notNull(),
    transactional: boolean('transactional').default(true).notNull(),
    workshopUpdates: boolean('workshopUpdates').default(true).notNull(),
    questionnaireReminders: boolean('questionnaireReminders')
      .default(true)
      .notNull(),
    newsletters: boolean('newsletters').default(false).notNull(),
    consentTextI18n: jsonb('consentTextI18n').$type<{ pl: string; en: string }>(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    givenAt: timestamp('givenAt').defaultNow().notNull(),
    withdrawnAt: timestamp('withdrawnAt'),
    lastUpdatedBy: uuid('lastUpdatedBy').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index('idx_email_consent_user_id').on(table.userId),
    emailIdx: index('idx_email_consent_email').on(table.email),
    withdrawnAtIdx: index('idx_email_consent_withdrawn_at').on(
      table.withdrawnAt,
    ),
  }),
);

export type EmailConsent = typeof emailConsents.$inferSelect;
export type InsertEmailConsent = typeof emailConsents.$inferInsert;

/**
 * Email Queue Jobs table - BullMQ job tracking
 */
export const emailQueueJobs = pgTable(
  'email_queue_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: text('jobId').notNull().unique(), // BullMQ job ID
    emailLogId: uuid('emailLogId')
      .notNull()
      .references(() => emailLogs.id, { onDelete: 'cascade' }),
    queueName: text('queueName')
      .default('email-queue')
      .notNull(),
    priority: decimal('priority', { precision: 10, scale: 0 }).default('0'),
    delay: decimal('delay', { precision: 10, scale: 0 }).default('0'),
    attempts: decimal('attempts', { precision: 10, scale: 0 }).default('0'),
    maxAttempts: decimal('maxAttempts', { precision: 10, scale: 0 }).default('3'),
    data: jsonb('data').notNull(), // Job data payload
    opts: jsonb('opts'), // Job options
    progress: decimal('progress', { precision: 10, scale: 0 }).default('0'),
    processedOn: timestamp('processedOn'),
    finishedOn: timestamp('finishedOn'),
    failedReason: text('failedReason'),
    stacktrace: text('stacktrace'),
    returnValue: jsonb('returnValue'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    jobIdIdx: index('idx_email_queue_job_id').on(table.jobId),
    emailLogIdIdx: index('idx_email_queue_email_log_id').on(table.emailLogId),
    queueNameIdx: index('idx_email_queue_name').on(table.queueName),
    createdAtIdx: index('idx_email_queue_created_at').on(table.createdAt),
  }),
);

export type EmailQueueJob = typeof emailQueueJobs.$inferSelect;
export type InsertEmailQueueJob = typeof emailQueueJobs.$inferInsert;

/**
 * Email Blacklist table - suppression list
 */
export const emailBlacklist = pgTable(
  'email_blacklist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    reason: emailBlacklistReasonEnum('reason').notNull(),
    provider: emailBlacklistProviderEnum('provider').notNull(),
    providerReason: text('providerReason'),
    isActive: boolean('isActive').default(true).notNull(),
    notes: text('notes'),
    blockedAt: timestamp('blockedAt').defaultNow().notNull(),
    unblockedAt: timestamp('unblockedAt'),
    blockedBy: uuid('blockedBy').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  table => ({
    emailIdx: index('idx_email_blacklist_email').on(table.email),
    reasonIdx: index('idx_email_blacklist_reason').on(table.reason),
    isActiveIdx: index('idx_email_blacklist_is_active').on(table.isActive),
    blockedAtIdx: index('idx_email_blacklist_blocked_at').on(table.blockedAt),
  }),
);

export type EmailBlacklist = typeof emailBlacklist.$inferSelect;
export type InsertEmailBlacklist = typeof emailBlacklist.$inferInsert;

// ===== EMAIL SYSTEM RELATIONS =====

export const emailTemplatesRelations = relations(
  emailTemplates,
  ({ one, many }) => ({
    creator: one(users, {
      fields: [emailTemplates.createdBy],
      references: [users.id],
    }),
    emailLogs: many(emailLogs),
  }),
);

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  template: one(emailTemplates, {
    fields: [emailLogs.templateId],
    references: [emailTemplates.id],
  }),
  user: one(users, { fields: [emailLogs.userId], references: [users.id] }),
  workshop: one(workshops, {
    fields: [emailLogs.workshopId],
    references: [workshops.id],
  }),
  enrollment: one(enrollments, {
    fields: [emailLogs.enrollmentId],
    references: [enrollments.id],
  }),
  queueJob: one(emailQueueJobs, {
    fields: [emailLogs.id],
    references: [emailQueueJobs.emailLogId],
  }),
}));

export const emailConsentsRelations = relations(emailConsents, ({ one }) => ({
  user: one(users, { fields: [emailConsents.userId], references: [users.id] }),
  lastUpdatedByUser: one(users, {
    fields: [emailConsents.lastUpdatedBy],
    references: [users.id],
  }),
}));

export const emailQueueJobsRelations = relations(emailQueueJobs, ({ one }) => ({
  emailLog: one(emailLogs, {
    fields: [emailQueueJobs.emailLogId],
    references: [emailLogs.id],
  }),
}));

export const emailBlacklistRelations = relations(emailBlacklist, ({ one }) => ({
  blockedByUser: one(users, {
    fields: [emailBlacklist.blockedBy],
    references: [users.id],
  }),
}));

// User relations updated above to include email system

// SQL for import (when we need to use raw SQL)
export { sql } from 'drizzle-orm';
