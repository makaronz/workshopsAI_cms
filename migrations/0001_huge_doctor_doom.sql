CREATE TABLE "form_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formId" uuid NOT NULL,
	"questionText" text NOT NULL,
	"questionType" text NOT NULL,
	"options" jsonb,
	"isRequired" boolean DEFAULT false NOT NULL,
	"displayOrder" numeric(10, 0) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contributionId" uuid NOT NULL,
	"questionId" uuid NOT NULL,
	"answerData" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submittedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"templateText" text NOT NULL,
	"variables" jsonb,
	"category" text,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysisId" uuid NOT NULL,
	"resultType" text NOT NULL,
	"content" jsonb NOT NULL,
	"rawResponse" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid NOT NULL,
	"isEditable" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_forms_workshopId_unique" UNIQUE("workshopId")
);
--> statement-breakpoint
CREATE TABLE "workshop_llm_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshopId" uuid NOT NULL,
	"triggeredBy" uuid NOT NULL,
	"modelName" text NOT NULL,
	"promptTemplateId" uuid,
	"customInstructions" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"isVisibleToParticipants" boolean DEFAULT false NOT NULL,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_formId_workshop_forms_id_fk" FOREIGN KEY ("formId") REFERENCES "public"."workshop_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_answers" ADD CONSTRAINT "participant_answers_contributionId_participant_contributions_id_fk" FOREIGN KEY ("contributionId") REFERENCES "public"."participant_contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_answers" ADD CONSTRAINT "participant_answers_questionId_form_questions_id_fk" FOREIGN KEY ("questionId") REFERENCES "public"."form_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_contributions" ADD CONSTRAINT "participant_contributions_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_contributions" ADD CONSTRAINT "participant_contributions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_analysis_results" ADD CONSTRAINT "workshop_analysis_results_analysisId_workshop_llm_analyses_id_fk" FOREIGN KEY ("analysisId") REFERENCES "public"."workshop_llm_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_forms" ADD CONSTRAINT "workshop_forms_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_llm_analyses" ADD CONSTRAINT "workshop_llm_analyses_workshopId_workshops_id_fk" FOREIGN KEY ("workshopId") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_llm_analyses" ADD CONSTRAINT "workshop_llm_analyses_triggeredBy_users_id_fk" FOREIGN KEY ("triggeredBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_llm_analyses" ADD CONSTRAINT "workshop_llm_analyses_promptTemplateId_prompt_templates_id_fk" FOREIGN KEY ("promptTemplateId") REFERENCES "public"."prompt_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_form_questions_form_id" ON "form_questions" USING btree ("formId");--> statement-breakpoint
CREATE INDEX "idx_form_questions_display_order" ON "form_questions" USING btree ("displayOrder");--> statement-breakpoint
CREATE INDEX "idx_participant_answers_contribution_question" ON "participant_answers" USING btree ("contributionId","questionId");--> statement-breakpoint
CREATE INDEX "idx_participant_answers_contribution_id" ON "participant_answers" USING btree ("contributionId");--> statement-breakpoint
CREATE INDEX "idx_participant_answers_question_id" ON "participant_answers" USING btree ("questionId");--> statement-breakpoint
CREATE INDEX "idx_participant_contributions_workshop_user" ON "participant_contributions" USING btree ("workshopId","userId");--> statement-breakpoint
CREATE INDEX "idx_participant_contributions_workshop_id" ON "participant_contributions" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_participant_contributions_user_id" ON "participant_contributions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_prompt_templates_category" ON "prompt_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_prompt_templates_is_default" ON "prompt_templates" USING btree ("isDefault");--> statement-breakpoint
CREATE INDEX "idx_prompt_templates_created_by" ON "prompt_templates" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX "idx_workshop_analysis_results_analysis_id" ON "workshop_analysis_results" USING btree ("analysisId");--> statement-breakpoint
CREATE INDEX "idx_workshop_analysis_results_result_type" ON "workshop_analysis_results" USING btree ("resultType");--> statement-breakpoint
CREATE INDEX "idx_workshop_forms_workshop_id" ON "workshop_forms" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_workshop_llm_analyses_workshop_id" ON "workshop_llm_analyses" USING btree ("workshopId");--> statement-breakpoint
CREATE INDEX "idx_workshop_llm_analyses_triggered_by" ON "workshop_llm_analyses" USING btree ("triggeredBy");--> statement-breakpoint
CREATE INDEX "idx_workshop_llm_analyses_status" ON "workshop_llm_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workshop_llm_analyses_created_at" ON "workshop_llm_analyses" USING btree ("createdAt");