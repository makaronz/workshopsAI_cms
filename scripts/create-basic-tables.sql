-- Basic tables creation for workshopsAI CMS
-- This script creates the essential tables needed for the application to start

-- Create enums - drop and recreate to avoid IF NOT EXISTS issues
DROP TYPE IF EXISTS "loginMethod" CASCADE;
CREATE TYPE "loginMethod" AS ENUM('local', 'oauth', 'sso');

DROP TYPE IF EXISTS "role" CASCADE;
CREATE TYPE "role" AS ENUM('participant', 'facilitator', 'moderator', 'sociologist-editor', 'admin');

DROP TYPE IF EXISTS "status" CASCADE;
CREATE TYPE "status" AS ENUM('draft', 'published', 'archived', 'cancelled');

DROP TYPE IF EXISTS "templateTheme" CASCADE;
CREATE TYPE "templateTheme" AS ENUM('integracja', 'konflikty', 'well-being', 'custom');

DROP TYPE IF EXISTS "language" CASCADE;
CREATE TYPE "language" AS ENUM('pl', 'en');

DROP TYPE IF EXISTS "enrollmentStatus" CASCADE;
CREATE TYPE "enrollmentStatus" AS ENUM('pending', 'confirmed', 'waitlisted', 'cancelled', 'completed');

DROP TYPE IF EXISTS "paymentStatus" CASCADE;
CREATE TYPE "paymentStatus" AS ENUM('pending', 'paid', 'refunded', 'waived');

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "openId" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT,
    "loginMethod" "loginMethod" NOT NULL DEFAULT 'local',
    "role" "role" NOT NULL DEFAULT 'participant',
    "avatar" TEXT,
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "deletedAt" TIMESTAMP
);

-- Consents table for GDPR compliance
CREATE TABLE IF NOT EXISTS "consents" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "consentType" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit Logs table for GDPR compliance
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "tableName" TEXT NOT NULL,
    "recordId" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workshops table
CREATE TABLE IF NOT EXISTS "workshops" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "shortDescription" TEXT,
    "status" "status" NOT NULL DEFAULT 'draft',
    "templateTheme" "templateTheme" NOT NULL DEFAULT 'custom',
    "language" "language" NOT NULL DEFAULT 'pl',
    "maxParticipants" INTEGER,
    "currentParticipants" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP,
    "endDate" TIMESTAMP,
    "location" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "facilitatorId" UUID REFERENCES "users"("id"),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "publishedAt" TIMESTAMP,
    "deletedAt" TIMESTAMP
);

-- Enrollments table
CREATE TABLE IF NOT EXISTS "enrollments" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "workshopId" UUID NOT NULL REFERENCES "workshops"("id") ON DELETE CASCADE,
    "participantId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "status" "enrollmentStatus" NOT NULL DEFAULT 'pending',
    "paymentStatus" "paymentStatus" NOT NULL DEFAULT 'pending',
    "enrolledAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "notes" TEXT,
    UNIQUE("workshopId", "participantId")
);

-- Responses/Questionnaires table
CREATE TABLE IF NOT EXISTS "responses" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "workshopId" UUID REFERENCES "workshops"("id") ON DELETE CASCADE,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role");
CREATE INDEX IF NOT EXISTS "idx_users_open_id" ON "users"("openId");
CREATE INDEX IF NOT EXISTS "idx_consents_user_id" ON "consents"("userId");
CREATE INDEX IF NOT EXISTS "idx_consents_type" ON "consents"("consentType");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_timestamp" ON "audit_logs"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_table_record" ON "audit_logs"("tableName", "recordId");
CREATE INDEX IF NOT EXISTS "idx_workshops_status" ON "workshops"("status", "publishedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_workshops_facilitator" ON "workshops"("facilitatorId");
CREATE INDEX IF NOT EXISTS "idx_enrollments_workshop_participant" ON "enrollments"("workshopId", "participantId");
CREATE INDEX IF NOT EXISTS "idx_enrollments_status" ON "enrollments"("status");
CREATE INDEX IF NOT EXISTS "idx_responses_user_question" ON "responses"("userId", "questionId");
CREATE INDEX IF NOT EXISTS "idx_responses_workshop" ON "responses"("workshopId");

-- Insert a default admin user for testing
INSERT INTO "users" ("openId", "name", "email", "password", "loginMethod", "role", "isActive", "emailVerified")
VALUES (
    'admin-default',
    'System Administrator',
    'admin@workshopsai.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyCskw9bVhXq4O', -- password: admin123
    'local',
    'admin',
    true,
    true
) ON CONFLICT ("email") DO NOTHING;

-- Success message
SELECT 'Basic tables created successfully' AS status;