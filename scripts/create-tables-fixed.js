const postgres = require('postgres');

async function createSimpleTables() {
  const sql = postgres(`postgresql://workshopsai:dev_password@localhost:5433/workshopsai_cms_dev?options=--search_path=public`);

  try {
    console.log('🔄 Creating simple tables with proper UUID setup...');

    // Enable UUID extension in public schema
    await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;`);
    console.log('✅ UUID extension enabled in public schema');

    // Set search path to public
    await sql.unsafe(`SET search_path TO public;`);

    // Drop tables if they exist to start fresh
    await sql.unsafe(`
      DROP TABLE IF EXISTS "responses" CASCADE;
      DROP TABLE IF EXISTS "enrollments" CASCADE;
      DROP TABLE IF EXISTS "workshops" CASCADE;
      DROP TABLE IF EXISTS "consents" CASCADE;
      DROP TABLE IF EXISTS "audit_logs" CASCADE;
      DROP TABLE IF EXISTS "users" CASCADE;
    `);

    // Create users table with explicit schema qualification
    await sql.unsafe(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
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
    `);

    // Create workshops table
    await sql.unsafe(`
      CREATE TABLE "workshops" (
        "id" UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
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
    `);

    // Create enrollments table
    await sql.unsafe(`
      CREATE TABLE "enrollments" (
        "id" UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "workshopId" UUID NOT NULL REFERENCES "workshops"("id") ON DELETE CASCADE,
        "participantId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
        "enrolledAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "notes" TEXT,
        UNIQUE("workshopId", "participantId")
      );
    `);

    // Create consents table
    await sql.unsafe(`
      CREATE TABLE "consents" (
        "id" UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "consentType" TEXT NOT NULL,
        "granted" BOOLEAN NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create audit logs table
    await sql.unsafe(`
      CREATE TABLE "audit_logs" (
        "id" UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
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
    `);

    // Create responses table
    await sql.unsafe(`
      CREATE TABLE "responses" (
        "id" UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "workshopId" UUID REFERENCES "workshops"("id") ON DELETE CASCADE,
        "questionId" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create basic indexes
    await sql`CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_consents_user_id" ON "consents"("userId");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_audit_logs_timestamp" ON "audit_logs"("timestamp" DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_workshops_status" ON "workshops"("status");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_enrollments_workshop" ON "enrollments"("workshopId");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_enrollments_participant" ON "enrollments"("participantId");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_responses_user" ON "responses"("userId");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_responses_workshop" ON "responses"("workshopId");`;

    // Insert a default admin user for testing
    await sql`
      INSERT INTO "users" ("openId", "name", "email", "password", "loginMethod", "role", "isActive", "emailVerified")
      VALUES (
        'admin-default',
        'System Administrator',
        'admin@workshopsai.local',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyCskw9bVhXq4O',
        'local',
        'admin',
        true,
        true
      ) ON CONFLICT ("email") DO NOTHING;
    `;

    // Check if tables exist now
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    console.log('📊 Current tables in database:');
    tables.forEach(table => {
      console.log(`  - ${table.tablename}`);
    });

    console.log('✅ Simple tables created successfully');

  } catch (error) {
    console.error('❌ Table creation failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createSimpleTables();