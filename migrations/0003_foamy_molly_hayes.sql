CREATE TYPE "public"."analysisJobPriority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."analysisJobStatus" AS ENUM('queued', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."analysisStatus" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionnaireId" uuid NOT NULL,
	"analysisTypes" jsonb NOT NULL,
	"status" "analysisJobStatus" DEFAULT 'queued' NOT NULL,
	"priority" "analysisJobPriority" DEFAULT 'medium' NOT NULL,
	"progress" numeric(5, 2) DEFAULT '0',
	"totalSteps" numeric(10, 0) DEFAULT '1' NOT NULL,
	"completedSteps" numeric(10, 0) DEFAULT '0',
	"options" jsonb,
	"errorLog" jsonb,
	"estimatedDuration" numeric(10, 0),
	"actualDuration" numeric(10, 0),
	"workerId" text,
	"scheduledAt" timestamp,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"triggeredBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"responseId" uuid NOT NULL,
	"questionId" uuid NOT NULL,
	"vectorIndex" numeric(10, 0) NOT NULL,
	"model" text NOT NULL,
	"dimensions" numeric(10, 0) NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"checksum" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "llm_analyses" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "llm_analyses" ALTER COLUMN "status" SET DATA TYPE "public"."analysisStatus" USING "status"::text::"public"."analysisStatus";--> statement-breakpoint
ALTER TABLE "llm_analyses" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "questionnaireId" uuid;--> statement-breakpoint
ALTER TABLE "llm_analyses" ADD COLUMN "isVisibleToParticipants" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "responses" ADD COLUMN "questionnaireId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_questionnaireId_questionnaires_id_fk" FOREIGN KEY ("questionnaireId") REFERENCES "public"."questionnaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_triggeredBy_users_id_fk" FOREIGN KEY ("triggeredBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_responseId_responses_id_fk" FOREIGN KEY ("responseId") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_questionId_questions_id_fk" FOREIGN KEY ("questionId") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analysis_jobs_questionnaire_id" ON "analysis_jobs" USING btree ("questionnaireId");--> statement-breakpoint
CREATE INDEX "idx_analysis_jobs_status" ON "analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_analysis_jobs_priority" ON "analysis_jobs" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_analysis_jobs_triggered_by" ON "analysis_jobs" USING btree ("triggeredBy");--> statement-breakpoint
CREATE INDEX "idx_analysis_jobs_scheduled_at" ON "analysis_jobs" USING btree ("scheduledAt");--> statement-breakpoint
CREATE INDEX "idx_embeddings_response_id" ON "embeddings" USING btree ("responseId");--> statement-breakpoint
CREATE INDEX "idx_embeddings_question_id" ON "embeddings" USING btree ("questionId");--> statement-breakpoint
CREATE INDEX "idx_embeddings_model" ON "embeddings" USING btree ("model");--> statement-breakpoint
CREATE INDEX "idx_embeddings_checksum" ON "embeddings" USING btree ("checksum");--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_questionnaireId_questionnaires_id_fk" FOREIGN KEY ("questionnaireId") REFERENCES "public"."questionnaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_questionnaireId_questionnaires_id_fk" FOREIGN KEY ("questionnaireId") REFERENCES "public"."questionnaires"("id") ON DELETE cascade ON UPDATE no action;