-- Minimal tables creation for workshopsAI CMS - no indexes to avoid syntax errors

-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS "responses" CASCADE;
DROP TABLE IF EXISTS "enrollments" CASCADE;
DROP TABLE IF EXISTS "workshops" CASCADE;
DROP TABLE IF EXISTS "consents" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Users table
CREATE TABLE "users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "openId" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT,
    "loginMethod" TEXT NOT NULL DEFAULT 'local',
    "role" TEXT NOT NULL DEFAULT 'participant',
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
CREATE TABLE "consents" (
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
CREATE TABLE "audit_logs" (
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
CREATE TABLE "workshops" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "shortDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
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
CREATE TABLE "enrollments" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "workshopId" UUID NOT NULL REFERENCES "workshops"("id") ON DELETE CASCADE,
    "participantId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "enrolledAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "notes" TEXT,
    UNIQUE("workshopId", "participantId")
);

-- Responses/Questionnaires table
CREATE TABLE "responses" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "workshopId" UUID REFERENCES "workshops"("id") ON DELETE CASCADE,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

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
SELECT 'Minimal tables created successfully' AS status;