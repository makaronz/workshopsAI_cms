-- Workshop Intelligence System Migration
-- Created: 2025-11-30
-- Description: Adds tables for dynamic workshop forms, participant contributions, and LLM analysis

-- Create enums
DO $$ BEGIN
  CREATE TYPE "wi_question_type" AS ENUM('text', 'textarea', 'multiple_choice', 'single_choice', 'rating', 'yes_no');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "wi_contribution_status" AS ENUM('draft', 'submitted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "wi_analysis_status" AS ENUM('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "wi_result_type" AS ENUM('summary', 'insights', 'themes', 'recommendations', 'plan');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create workshop_forms table
CREATE TABLE IF NOT EXISTS "workshop_forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workshop_id" uuid NOT NULL,
  "is_editable" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "workshop_forms_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_workshop_forms_workshop_id" ON "workshop_forms" ("workshop_id");

-- Create form_questions table
CREATE TABLE IF NOT EXISTS "form_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "form_id" uuid NOT NULL,
  "question_text" text NOT NULL,
  "question_type" wi_question_type NOT NULL,
  "options" jsonb,
  "is_required" boolean DEFAULT false NOT NULL,
  "display_order" numeric(10, 0) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "form_questions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "workshop_forms"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_form_questions_form_id" ON "form_questions" ("form_id");
CREATE INDEX IF NOT EXISTS "idx_form_questions_display_order" ON "form_questions" ("display_order");

-- Create participant_contributions table
CREATE TABLE IF NOT EXISTS "participant_contributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workshop_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" wi_contribution_status DEFAULT 'draft' NOT NULL,
  "submitted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "participant_contributions_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE,
  CONSTRAINT "participant_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_participant_contributions_workshop_id" ON "participant_contributions" ("workshop_id");
CREATE INDEX IF NOT EXISTS "idx_participant_contributions_user_id" ON "participant_contributions" ("user_id");

-- Create participant_answers table
CREATE TABLE IF NOT EXISTS "participant_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contribution_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "answer_data" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "participant_answers_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "participant_contributions"("id") ON DELETE CASCADE,
  CONSTRAINT "participant_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "form_questions"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_participant_answers_contribution_id" ON "participant_answers" ("contribution_id");
CREATE INDEX IF NOT EXISTS "idx_participant_answers_question_id" ON "participant_answers" ("question_id");

-- Create prompt_templates table
CREATE TABLE IF NOT EXISTS "prompt_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "template_text" text NOT NULL,
  "variables" jsonb,
  "category" text,
  "is_default" boolean DEFAULT false,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "prompt_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "idx_prompt_templates_name" ON "prompt_templates" ("name");
CREATE INDEX IF NOT EXISTS "idx_prompt_templates_created_by" ON "prompt_templates" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_prompt_templates_is_default" ON "prompt_templates" ("is_default");

-- Create workshop_llm_analyses table
CREATE TABLE IF NOT EXISTS "workshop_llm_analyses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workshop_id" uuid NOT NULL,
  "triggered_by" uuid NOT NULL,
  "model_name" text NOT NULL,
  "prompt_template_id" uuid,
  "custom_instructions" text,
  "status" wi_analysis_status DEFAULT 'pending' NOT NULL,
  "is_visible_to_participants" boolean DEFAULT false NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "workshop_llm_analyses_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE,
  CONSTRAINT "workshop_llm_analyses_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id"),
  CONSTRAINT "workshop_llm_analyses_prompt_template_id_fkey" FOREIGN KEY ("prompt_template_id") REFERENCES "prompt_templates"("id")
);

CREATE INDEX IF NOT EXISTS "idx_workshop_llm_analyses_workshop_id" ON "workshop_llm_analyses" ("workshop_id");
CREATE INDEX IF NOT EXISTS "idx_workshop_llm_analyses_triggered_by" ON "workshop_llm_analyses" ("triggered_by");
CREATE INDEX IF NOT EXISTS "idx_workshop_llm_analyses_status" ON "workshop_llm_analyses" ("status");

-- Create analysis_results table
CREATE TABLE IF NOT EXISTS "analysis_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "analysis_id" uuid NOT NULL,
  "result_type" wi_result_type NOT NULL,
  "content" jsonb NOT NULL,
  "raw_response" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "analysis_results_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "workshop_llm_analyses"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_analysis_results_analysis_id" ON "analysis_results" ("analysis_id");
CREATE INDEX IF NOT EXISTS "idx_analysis_results_result_type" ON "analysis_results" ("result_type");
