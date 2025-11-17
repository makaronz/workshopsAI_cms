const { Pool } = require('pg');

async function fixQuestionnaireTables() {
  const pool = new Pool({
    host: 'localhost',
    port: 5433,
    user: 'workshopsai',
    password: 'dev_password',
    database: 'workshopsai_cms_dev'
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();

    console.log('Creating missing questionnaire tables...');

    // Create questionnaires table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "questionnaires" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "workshopId" uuid,
          "titleI18n" jsonb NOT NULL,
          "descriptionI18n" jsonb,
          "instructionsI18n" jsonb,
          "status" "questionnaireStatus" DEFAULT 'draft' NOT NULL,
          "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
          "createdBy" uuid NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );
      `);
      console.log('✓ Created questionnaires table');
    } catch (err) {
      console.log('ℹ questionnaires table already exists or error:', err.message);
    }

    // Create questiongroups table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "questiongroups" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "questionnaireId" uuid NOT NULL,
          "titleI18n" jsonb NOT NULL,
          "descriptionI18n" jsonb,
          "orderIndex" integer DEFAULT 0 NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );
      `);
      console.log('✓ Created questiongroups table');
    } catch (err) {
      console.log('ℹ questiongroups table already exists or error:', err.message);
    }

    // Create questions table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "questions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "groupId" uuid,
          "questionnaireId" uuid NOT NULL,
          "questionI18n" jsonb NOT NULL,
          "type" "questionType" NOT NULL,
          "optionsI18n" jsonb,
          "required" boolean DEFAULT false NOT NULL,
          "orderIndex" integer DEFAULT 0 NOT NULL,
          "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );
      `);
      console.log('✓ Created questions table');
    } catch (err) {
      console.log('ℹ questions table already exists or error:', err.message);
    }

    // Create llmanalyses table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "llmanalyses" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "questionnaireId" uuid NOT NULL,
          "analysisType" "llmAnalysisType" NOT NULL,
          "status" "status" DEFAULT 'draft' NOT NULL,
          "results" jsonb,
          "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
          "completedAt" timestamp,
          "createdBy" uuid NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );
      `);
      console.log('✓ Created llmanalyses table');
    } catch (err) {
      console.log('ℹ llmanalyses table already exists or error:', err.message);
    }

    // Create analysisjobs table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "analysisjobs" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "questionnaireId" uuid NOT NULL,
          "analysisType" "llmAnalysisType" NOT NULL,
          "status" "status" DEFAULT 'draft' NOT NULL,
          "priority" integer DEFAULT 0 NOT NULL,
          "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
          "startedAt" timestamp,
          "completedAt" timestamp,
          "errorMessage" text,
          "createdBy" uuid NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );
      `);
      console.log('✓ Created analysisjobs table');
    } catch (err) {
      console.log('ℹ analysisjobs table already exists or error:', err.message);
    }

    // Add missing columns to responses table
    try {
      await client.query(`
        ALTER TABLE responses
        ADD COLUMN IF NOT EXISTS "questionId" uuid,
        ADD COLUMN IF NOT EXISTS "status" "responseStatus" DEFAULT 'draft' NOT NULL,
        ADD COLUMN IF NOT EXISTS "enrollmentId" uuid
      `);
      console.log('✓ Added missing columns to responses table');
    } catch (err) {
      console.log('ℹ Columns already exist or error:', err.message);
    }

    // Add missing column to consents table
    try {
      await client.query(`
        ALTER TABLE consents
        ADD COLUMN IF NOT EXISTS "revokedAt" timestamp
      `);
      console.log('✓ Added revokedAt column to consents table');
    } catch (err) {
      console.log('ℹ Column already exists or error:', err.message);
    }

    // Add missing columns to questionnaires table for proper relations
    try {
      await client.query(`
        ALTER TABLE questionnaires
        ADD COLUMN IF NOT EXISTS "workshopId" uuid
      `);
      console.log('✓ Added workshopId column to questionnaires table');
    } catch (err) {
      console.log('ℹ Column already exists or error:', err.message);
    }

    console.log('✅ Questionnaire tables and columns fixed successfully!');
    await client.release();
  } catch (error) {
    console.error('❌ Error fixing questionnaire tables:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixQuestionnaireTables().catch(console.error);