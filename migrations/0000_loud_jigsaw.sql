CREATE TYPE "public"."announcementType" AS ENUM('info', 'reminder', 'update', 'cancellation', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."emailBlacklistProvider" AS ENUM('sendgrid', 'mailgun', 'nodemailer', 'manual');--> statement-breakpoint
CREATE TYPE "public"."emailBlacklistReason" AS ENUM('bounced', 'complained', 'spam', 'unsubscribed', 'blocked', 'admin');--> statement-breakpoint
CREATE TYPE "public"."emailBounceType" AS ENUM('hard', 'soft', 'spam', 'complaint');--> statement-breakpoint
CREATE TYPE "public"."emailPriority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."emailProvider" AS ENUM('sendgrid', 'mailgun', 'nodemailer');--> statement-breakpoint
CREATE TYPE "public"."emailStatus" AS ENUM('pending', 'processing', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."emailType" AS ENUM('workshop_invitation', 'session_reminder', 'questionnaire_reminder', 'workshop_update', 'account_verification', 'password_reset', 'completion_certificate', 'enrollment_confirmation', 'waiting_list_notification', 'workshop_cancellation', 'custom');--> statement-breakpoint
CREATE TYPE "public"."enrollmentStatus" AS ENUM('pending', 'confirmed', 'waitlisted', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."feedbackStatus" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."fileAccessLevel" AS ENUM('private', 'workshop', 'organization', 'public');--> statement-breakpoint
CREATE TYPE "public"."fileAssociatedEntity" AS ENUM('workshop', 'session', 'module', 'user', 'questionnaire', 'template', 'none');--> statement-breakpoint
CREATE TYPE "public"."fileOperation" AS ENUM('CREATE', 'READ', 'UPDATE', 'DELETE', 'DOWNLOAD', 'COPY', 'MOVE');--> statement-breakpoint
CREATE TYPE "public"."fileProvider" AS ENUM('aws-s3', 'google-cloud', 'azure-blob', 'local');--> statement-breakpoint
CREATE TYPE "public"."fileStatus" AS ENUM('uploading', 'processing', 'completed', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('pl', 'en');--> statement-breakpoint
CREATE TYPE "public"."llmAnalysisType" AS ENUM('thematic', 'clusters', 'contradictions', 'insights', 'recommendations');--> statement-breakpoint
CREATE TYPE "public"."loginMethod" AS ENUM('local', 'oauth', 'sso');--> statement-breakpoint
CREATE TYPE "public"."moduleType" AS ENUM('text', 'video', 'quiz', 'exercise', 'discussion', 'presentation', 'file');--> statement-breakpoint
CREATE TYPE "public"."paymentStatus" AS ENUM('pending', 'paid', 'refunded', 'waived');--> statement-breakpoint
CREATE TYPE "public"."questionType" AS ENUM('text', 'textarea', 'number', 'scale', 'single_choice', 'multiple_choice');--> statement-breakpoint
CREATE TYPE "public"."questionnaireStatus" AS ENUM('draft', 'review', 'published', 'closed', 'analyzed');--> statement-breakpoint
CREATE TYPE "public"."responseStatus" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('participant', 'facilitator', 'moderator', 'sociologist-editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('draft', 'published', 'archived', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tagCategory" AS ENUM('theme', 'skill', 'level', 'format', 'audience');--> statement-breakpoint
CREATE TYPE "public"."templateTheme" AS ENUM('integracja', 'konflikty', 'well-being', 'custom');--> statement-breakpoint
CREATE TYPE "public"."workshopFacilitatorRole" AS ENUM('lead', 'assistant', 'guest');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid NOT NULL,
	"titleI18n" jsonb NOT NULL,
	"contentI18n" jsonb NOT NULL,
	"type" "announcementType" DEFAULT 'info' NOT NULL,
	"sendEmail" boolean DEFAULT false NOT NULL,
	"emailSentAt" timestamp,
	"isPublished" boolean DEFAULT false NOT NULL,
	"publishedAt" timestamp,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"tableName" text NOT NULL,
	"recordId" uuid NOT NULL,
	"operation" text NOT NULL,
	"oldValues" jsonb,
	"newValues" jsonb,
	"ipAddress" text,
	"userAgent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"consentType" text NOT NULL,
	"granted" boolean NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_blacklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"reason" "emailBlacklistReason" NOT NULL,
	"provider" "emailBlacklistProvider" NOT NULL,
	"providerReason" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"notes" text,
	"blockedAt" timestamp DEFAULT now() NOT NULL,
	"unblockedAt" timestamp,
	"blockedBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_blacklist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "email_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"email" text NOT NULL,
	"marketing" boolean DEFAULT false NOT NULL,
	"transactional" boolean DEFAULT true NOT NULL,
	"workshopUpdates" boolean DEFAULT true NOT NULL,
	"questionnaireReminders" boolean DEFAULT true NOT NULL,
	"newsletters" boolean DEFAULT false NOT NULL,
	"consentTextI18n" jsonb,
	"ipAddress" text,
	"userAgent" text,
	"givenAt" timestamp DEFAULT now() NOT NULL,
	"withdrawnAt" timestamp,
	"lastUpdatedBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"messageId" text,
	"templateId" uuid,
	"userId" uuid,
	"workshopId" uuid,
	"enrollmentId" uuid,
	"type" "emailType" NOT NULL,
	"toEmail" text NOT NULL,
	"fromEmail" text NOT NULL,
	"fromName" text NOT NULL,
	"subject" text NOT NULL,
	"language" "language" DEFAULT 'pl' NOT NULL,
	"status" "emailStatus" DEFAULT 'pending' NOT NULL,
	"provider" "emailProvider" NOT NULL,
	"providerMessageId" text,
	"priority" "emailPriority" DEFAULT 'normal' NOT NULL,
	"scheduledAt" timestamp,
	"sentAt" timestamp,
	"deliveredAt" timestamp,
	"openedAt" timestamp,
	"lastClickedAt" timestamp,
	"bouncedAt" timestamp,
	"failedAt" timestamp,
	"retryCount" numeric(10, 0) DEFAULT '0' NOT NULL,
	"maxRetries" numeric(10, 0) DEFAULT '3' NOT NULL,
	"nextRetryAt" timestamp,
	"errorMessage" text,
	"bounceReason" text,
	"bounceType" "emailBounceType",
	"metadata" jsonb,
	"consent" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_queue_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" text NOT NULL,
	"emailLogId" uuid NOT NULL,
	"queueName" text DEFAULT 'email-queue' NOT NULL,
	"priority" numeric(10, 0) DEFAULT '0',
	"delay" numeric(10, 0) DEFAULT '0',
	"attempts" numeric(10, 0) DEFAULT '0',
	"maxAttempts" numeric(10, 0) DEFAULT '3',
	"data" jsonb NOT NULL,
	"opts" jsonb,
	"progress" numeric(10, 0) DEFAULT '0',
	"processedOn" timestamp,
	"finishedOn" timestamp,
	"failedReason" text,
	"stacktrace" text,
	"returnValue" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_queue_jobs_jobId_unique" UNIQUE("jobId")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "emailType" NOT NULL,
	"subjectI18n" jsonb NOT NULL,
	"htmlTemplate" text NOT NULL,
	"textTemplate" text,
	"variables" jsonb,
	"isActive" boolean DEFAULT true NOT NULL,
	"version" numeric(10, 0) DEFAULT '1' NOT NULL,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid NOT NULL,
	"participantId" uuid NOT NULL,
	"status" "enrollmentStatus" DEFAULT 'pending' NOT NULL,
	"enrollmentDate" timestamp DEFAULT now() NOT NULL,
	"confirmedAt" timestamp,
	"cancelledAt" timestamp,
	"completedAt" timestamp,
	"notes" text,
	"specialRequirements" text,
	"paymentStatus" "paymentStatus" DEFAULT 'pending',
	"paymentAmount" numeric(10, 2),
	"attendance" jsonb,
	"formData" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facilitators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text,
	"organization" text,
	"experience" text,
	"specializations" jsonb,
	"certifications" jsonb,
	"languages" jsonb,
	"website" text,
	"socialLinks" jsonb,
	"isAvailable" boolean DEFAULT true NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0.00',
	"totalWorkshops" numeric(10, 0) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "facilitators_userId_unique" UNIQUE("userId"),
	CONSTRAINT "facilitators_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid NOT NULL,
	"participantId" uuid NOT NULL,
	"rating" numeric(2, 1),
	"contentI18n" jsonb,
	"isPublic" boolean DEFAULT false NOT NULL,
	"isAnonymous" boolean DEFAULT false NOT NULL,
	"status" "feedbackStatus" DEFAULT 'pending' NOT NULL,
	"reviewedBy" uuid,
	"reviewNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fileId" uuid NOT NULL,
	"userId" uuid,
	"operation" "fileOperation" NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"referer" text,
	"success" boolean NOT NULL,
	"errorMessage" text,
	"bytesTransferred" text,
	"duration" text,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"storageQuota" text NOT NULL,
	"storageUsed" text DEFAULT '0' NOT NULL,
	"fileCountQuota" text DEFAULT '1000',
	"fileCountUsed" text DEFAULT '0' NOT NULL,
	"maxFileSize" text,
	"allowedFileTypes" text[],
	"bandwidthQuota" text,
	"bandwidthUsed" text DEFAULT '0' NOT NULL,
	"bandwidthResetDate" timestamp NOT NULL,
	"warningsSent" text[],
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "file_quotas_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "file_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fileId" uuid NOT NULL,
	"sharedBy" uuid NOT NULL,
	"shareToken" text NOT NULL,
	"shareType" text NOT NULL,
	"permissions" text[] NOT NULL,
	"accessLevel" "fileAccessLevel" DEFAULT 'private' NOT NULL,
	"expiresAt" timestamp,
	"maxDownloads" text,
	"downloadCount" text DEFAULT '0' NOT NULL,
	"password" text,
	"requiresLogin" boolean DEFAULT false NOT NULL,
	"allowedEmails" text[],
	"blockedEmails" text[],
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastAccessedAt" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	CONSTRAINT "file_shares_shareToken_unique" UNIQUE("shareToken")
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fileId" uuid NOT NULL,
	"versionNumber" text NOT NULL,
	"fileName" text NOT NULL,
	"filePath" text NOT NULL,
	"fileSize" text NOT NULL,
	"mimeType" text NOT NULL,
	"checksum" text NOT NULL,
	"changeDescription" text,
	"uploadedBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"originalName" text NOT NULL,
	"fileName" text NOT NULL,
	"filePath" text NOT NULL,
	"fileSize" text NOT NULL,
	"mimeType" text NOT NULL,
	"extension" text NOT NULL,
	"category" text,
	"uploadedBy" uuid NOT NULL,
	"associatedEntityType" "fileAssociatedEntity" DEFAULT 'none',
	"associatedEntityId" uuid,
	"isPublic" boolean DEFAULT false NOT NULL,
	"accessLevel" "fileAccessLevel" DEFAULT 'private' NOT NULL,
	"tags" text[],
	"metadata" jsonb,
	"provider" "fileProvider" NOT NULL,
	"bucket" text,
	"region" text,
	"cdnUrl" text,
	"previewUrl" text,
	"thumbnailUrl" text,
	"checksum" text,
	"status" "fileStatus" DEFAULT 'completed' NOT NULL,
	"uploadedAt" timestamp DEFAULT now() NOT NULL,
	"lastAccessedAt" timestamp,
	"expiresAt" timestamp,
	"downloadCount" text DEFAULT '0' NOT NULL,
	"deletedAt" timestamp,
	"deletedBy" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionnaireId" uuid NOT NULL,
	"analysisType" "llmAnalysisType" NOT NULL,
	"results" jsonb NOT NULL,
	"metadata" jsonb,
	"status" "questionnaireStatus" DEFAULT 'draft' NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"createdBy" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text,
	"city" text,
	"country" text,
	"capacity" numeric(10, 0),
	"facilities" jsonb,
	"coordinates" jsonb,
	"contactInfo" jsonb,
	"imageUrl" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"titleI18n" jsonb,
	"type" "moduleType" NOT NULL,
	"contentI18n" jsonb NOT NULL,
	"duration" numeric(10, 0),
	"orderIndex" numeric(10, 0) DEFAULT '0',
	"isRequired" boolean DEFAULT true NOT NULL,
	"resources" jsonb,
	"settings" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionnaireId" uuid NOT NULL,
	"titleI18n" jsonb NOT NULL,
	"descriptionI18n" jsonb,
	"orderIndex" numeric(10, 0) NOT NULL,
	"uiConfig" jsonb DEFAULT '{"collapsed":false,"show_progress":true,"icon":null,"color":null}'::jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questionnaires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid,
	"titleI18n" jsonb NOT NULL,
	"instructionsI18n" jsonb,
	"status" "questionnaireStatus" DEFAULT 'draft' NOT NULL,
	"settings" jsonb DEFAULT '{"anonymous":false,"require_consent":true,"max_responses":null,"close_after_workshop":false,"show_all_questions":true,"allow_edit":true,"question_style":"first_person_plural"}'::jsonb,
	"publishedAt" timestamp,
	"closedAt" timestamp,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"groupId" uuid NOT NULL,
	"textI18n" jsonb NOT NULL,
	"type" "questionType" NOT NULL,
	"optionsI18n" jsonb,
	"validation" jsonb,
	"conditionalLogic" jsonb,
	"orderIndex" numeric(10, 0) NOT NULL,
	"helpTextI18n" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionId" uuid NOT NULL,
	"userId" uuid,
	"enrollmentId" uuid,
	"answer" jsonb NOT NULL,
	"metadata" jsonb,
	"status" "responseStatus" DEFAULT 'draft' NOT NULL,
	"submittedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid NOT NULL,
	"titleI18n" jsonb NOT NULL,
	"descriptionI18n" jsonb,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp NOT NULL,
	"duration" numeric(10, 0),
	"orderIndex" numeric(10, 0) DEFAULT '0',
	"locationId" uuid,
	"materials" jsonb,
	"isRequired" boolean DEFAULT true NOT NULL,
	"maxParticipants" numeric(10, 0),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#000000',
	"category" "tagCategory" NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"usageCount" numeric(10, 0) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"openId" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"loginMethod" "loginMethod" DEFAULT 'local' NOT NULL,
	"role" "role" DEFAULT 'participant' NOT NULL,
	"avatar" text,
	"bio" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workshop_facilitators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid NOT NULL,
	"facilitatorId" uuid NOT NULL,
	"role" "workshopFacilitatorRole" DEFAULT 'assistant' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid NOT NULL,
	"tagId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"titleI18n" jsonb NOT NULL,
	"subtitleI18n" jsonb,
	"descriptionI18n" jsonb,
	"shortDescriptionI18n" jsonb,
	"status" "status" DEFAULT 'draft' NOT NULL,
	"startDate" timestamp,
	"endDate" timestamp,
	"seatLimit" numeric(10, 0),
	"seatReserved" numeric(10, 0) DEFAULT '0',
	"enableWaitingList" boolean DEFAULT true NOT NULL,
	"waitingListCount" numeric(10, 0) DEFAULT '0',
	"templateTheme" "templateTheme" DEFAULT 'custom',
	"language" "language" DEFAULT 'pl' NOT NULL,
	"price" numeric(10, 2) DEFAULT '0.00',
	"currency" text DEFAULT 'PLN',
	"imageUrl" text,
	"gallery" jsonb,
	"requirementsI18n" jsonb,
	"objectivesI18n" jsonb,
	"materials" jsonb,
	"createdBy" uuid NOT NULL,
	"publishedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "workshops_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_blacklist" ADD CONSTRAINT "email_blacklist_blockedBy_users_id_fk" FOREIGN KEY ("blockedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_consents" ADD CONSTRAINT "email_consents_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_consents" ADD CONSTRAINT "email_consents_lastUpdatedBy_users_id_fk" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_templateId_email_templates_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_enrollmentId_enrollments_id_fk" FOREIGN KEY ("enrollmentId") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_queue_jobs" ADD CONSTRAINT "email_queue_jobs_emailLogId_email_logs_id_fk" FOREIGN KEY ("emailLogId") REFERENCES "public"."email_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_participantId_users_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilitators" ADD CONSTRAINT "facilitators_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_participantId_users_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_reviewedBy_users_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_access_logs" ADD CONSTRAINT "file_access_logs_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_access_logs" ADD CONSTRAINT "file_access_logs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_quotas" ADD CONSTRAINT "file_quotas_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_sharedBy_users_id_fk" FOREIGN KEY ("sharedBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploadedBy_users_id_fk" FOREIGN KEY ("uploadedBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploadedBy_users_id_fk" FOREIGN KEY ("uploadedBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_deletedBy_users_id_fk" FOREIGN KEY ("deletedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_analyses" ADD CONSTRAINT "llm_analyses_questionnaireId_questionnaires_id_fk" FOREIGN KEY ("questionnaireId") REFERENCES "public"."questionnaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_analyses" ADD CONSTRAINT "llm_analyses_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_sessionId_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_questionnaireId_questionnaires_id_fk" FOREIGN KEY ("questionnaireId") REFERENCES "public"."questionnaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_groupId_question_groups_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."question_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_questionId_questions_id_fk" FOREIGN KEY ("questionId") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_enrollmentId_enrollments_id_fk" FOREIGN KEY ("enrollmentId") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_locationId_locations_id_fk" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_facilitators" ADD CONSTRAINT "workshop_facilitators_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_facilitators" ADD CONSTRAINT "workshop_facilitators_facilitatorId_facilitators_id_fk" FOREIGN KEY ("facilitatorId") REFERENCES "public"."facilitators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_tags" ADD CONSTRAINT "workshop_tags_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_tags" ADD CONSTRAINT "workshop_tags_tagId_tags_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_announcements_workshop_id" ON "announcements" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_announcements_type" ON "announcements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_announcements_is_published" ON "announcements" USING btree ("isPublished");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_record_id" ON "audit_logs" USING btree ("recordId");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_consents_user_id" ON "consents" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_consents_type" ON "consents" USING btree ("consentType");--> statement-breakpoint
CREATE INDEX "idx_email_blacklist_email" ON "email_blacklist" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_email_blacklist_reason" ON "email_blacklist" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "idx_email_blacklist_is_active" ON "email_blacklist" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_email_blacklist_blocked_at" ON "email_blacklist" USING btree ("blockedAt");--> statement-breakpoint
CREATE INDEX "idx_email_consent_user_id" ON "email_consents" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_email_consent_email" ON "email_consents" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_email_consent_withdrawn_at" ON "email_consents" USING btree ("withdrawnAt");--> statement-breakpoint
CREATE INDEX "idx_email_message_id" ON "email_logs" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "idx_email_template_id" ON "email_logs" USING btree ("templateId");--> statement-breakpoint
CREATE INDEX "idx_email_user_id" ON "email_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_email_workshop_id" ON "email_logs" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_email_enrollment_id" ON "email_logs" USING btree ("enrollmentId");--> statement-breakpoint
CREATE INDEX "idx_email_type" ON "email_logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_email_status" ON "email_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_to_email" ON "email_logs" USING btree ("toEmail");--> statement-breakpoint
CREATE INDEX "idx_email_provider_message_id" ON "email_logs" USING btree ("providerMessageId");--> statement-breakpoint
CREATE INDEX "idx_email_scheduled_at" ON "email_logs" USING btree ("scheduledAt");--> statement-breakpoint
CREATE INDEX "idx_email_created_at" ON "email_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_email_queue_job_id" ON "email_queue_jobs" USING btree ("jobId");--> statement-breakpoint
CREATE INDEX "idx_email_queue_email_log_id" ON "email_queue_jobs" USING btree ("emailLogId");--> statement-breakpoint
CREATE INDEX "idx_email_queue_name" ON "email_queue_jobs" USING btree ("queueName");--> statement-breakpoint
CREATE INDEX "idx_email_queue_created_at" ON "email_queue_jobs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_email_template_name" ON "email_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_email_template_type" ON "email_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_email_template_created_by" ON "email_templates" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX "idx_enrollments_workshop_id" ON "enrollments" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_enrollments_participant_id" ON "enrollments" USING btree ("participantId");--> statement-breakpoint
CREATE INDEX "idx_enrollments_status" ON "enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_enrollments_enrollment_date" ON "enrollments" USING btree ("enrollmentDate");--> statement-breakpoint
CREATE INDEX "idx_facilitators_user_id" ON "facilitators" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_facilitators_slug" ON "facilitators" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_feedback_workshop_id" ON "feedback" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_feedback_participant_id" ON "feedback" USING btree ("participantId");--> statement-breakpoint
CREATE INDEX "idx_feedback_status" ON "feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_file_access_logs_file_id" ON "file_access_logs" USING btree ("fileId");--> statement-breakpoint
CREATE INDEX "idx_file_access_logs_user_id" ON "file_access_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_file_access_logs_operation" ON "file_access_logs" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "idx_file_access_logs_timestamp" ON "file_access_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_file_access_logs_success" ON "file_access_logs" USING btree ("success");--> statement-breakpoint
CREATE INDEX "idx_file_quotas_user_id" ON "file_quotas" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_file_quotas_storage_used" ON "file_quotas" USING btree ("storageUsed");--> statement-breakpoint
CREATE INDEX "idx_file_quotas_bandwidth_reset" ON "file_quotas" USING btree ("bandwidthResetDate");--> statement-breakpoint
CREATE INDEX "idx_file_shares_file_id" ON "file_shares" USING btree ("fileId");--> statement-breakpoint
CREATE INDEX "idx_file_shares_shared_by" ON "file_shares" USING btree ("sharedBy");--> statement-breakpoint
CREATE INDEX "idx_file_shares_token" ON "file_shares" USING btree ("shareToken");--> statement-breakpoint
CREATE INDEX "idx_file_shares_expires_at" ON "file_shares" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "idx_file_shares_is_active" ON "file_shares" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_file_versions_file_id" ON "file_versions" USING btree ("fileId");--> statement-breakpoint
CREATE INDEX "idx_file_versions_version" ON "file_versions" USING btree ("fileId","versionNumber");--> statement-breakpoint
CREATE INDEX "idx_file_versions_uploaded_by" ON "file_versions" USING btree ("uploadedBy");--> statement-breakpoint
CREATE INDEX "idx_file_versions_is_active" ON "file_versions" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_files_uploaded_by" ON "files" USING btree ("uploadedBy");--> statement-breakpoint
CREATE INDEX "idx_files_associated_entity" ON "files" USING btree ("associatedEntityType","associatedEntityId");--> statement-breakpoint
CREATE INDEX "idx_files_mime_type" ON "files" USING btree ("mimeType");--> statement-breakpoint
CREATE INDEX "idx_files_access_level" ON "files" USING btree ("accessLevel");--> statement-breakpoint
CREATE INDEX "idx_files_status" ON "files" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_files_uploaded_at" ON "files" USING btree ("uploadedAt");--> statement-breakpoint
CREATE INDEX "idx_files_expires_at" ON "files" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "idx_files_checksum" ON "files" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "idx_files_deleted_at" ON "files" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "idx_llm_analyses_questionnaire_id" ON "llm_analyses" USING btree ("questionnaireId");--> statement-breakpoint
CREATE INDEX "idx_llm_analyses_type" ON "llm_analyses" USING btree ("analysisType");--> statement-breakpoint
CREATE INDEX "idx_llm_analyses_status" ON "llm_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_llm_analyses_created_by" ON "llm_analyses" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX "idx_locations_slug" ON "locations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_locations_city" ON "locations" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_modules_session_id" ON "modules" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "idx_modules_order" ON "modules" USING btree ("orderIndex");--> statement-breakpoint
CREATE INDEX "idx_modules_type" ON "modules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_question_groups_questionnaire_id" ON "question_groups" USING btree ("questionnaireId");--> statement-breakpoint
CREATE INDEX "idx_question_groups_order" ON "question_groups" USING btree ("orderIndex");--> statement-breakpoint
CREATE INDEX "idx_questionnaires_workshop_id" ON "questionnaires" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_questionnaires_status" ON "questionnaires" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_questionnaires_created_by" ON "questionnaires" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX "idx_questionnaires_published_at" ON "questionnaires" USING btree ("publishedAt");--> statement-breakpoint
CREATE INDEX "idx_questions_group_id" ON "questions" USING btree ("groupId");--> statement-breakpoint
CREATE INDEX "idx_questions_order" ON "questions" USING btree ("orderIndex");--> statement-breakpoint
CREATE INDEX "idx_questions_type" ON "questions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_responses_question_id" ON "responses" USING btree ("questionId");--> statement-breakpoint
CREATE INDEX "idx_responses_user_id" ON "responses" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_responses_enrollment_id" ON "responses" USING btree ("enrollmentId");--> statement-breakpoint
CREATE INDEX "idx_responses_status" ON "responses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_responses_submitted_at" ON "responses" USING btree ("submittedAt");--> statement-breakpoint
CREATE INDEX "idx_sessions_workshop_id" ON "sessions" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_sessions_order" ON "sessions" USING btree ("orderIndex");--> statement-breakpoint
CREATE INDEX "idx_sessions_location_id" ON "sessions" USING btree ("locationId");--> statement-breakpoint
CREATE INDEX "idx_sessions_start_time" ON "sessions" USING btree ("startTime");--> statement-breakpoint
CREATE INDEX "idx_tags_slug" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_tags_category" ON "tags" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email") WHERE "deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_open_id" ON "users" USING btree ("openId");--> statement-breakpoint
CREATE INDEX "idx_workshop_facilitators_workshop_id" ON "workshop_facilitators" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_workshop_facilitators_facilitator_id" ON "workshop_facilitators" USING btree ("facilitatorId");--> statement-breakpoint
CREATE INDEX "idx_workshop_tags_workshop_id" ON "workshop_tags" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_workshop_tags_tag_id" ON "workshop_tags" USING btree ("tagId");--> statement-breakpoint
CREATE INDEX "idx_workshops_slug" ON "workshops" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_workshops_status" ON "workshops" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workshops_start_date" ON "workshops" USING btree ("startDate");--> statement-breakpoint
CREATE INDEX "idx_workshops_created_by" ON "workshops" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX "idx_workshops_published_at" ON "workshops" USING btree ("publishedAt");