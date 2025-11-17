const postgres = require('postgres');
const { v4: uuidv4 } = require('uuid');

async function createSimpleBasicTables() {
  const sql = postgres(`postgresql://workshopsai:dev_password@localhost:5433/workshopsai_cms_dev?options=--search_path=public`);

  try {
    console.log('🔄 Creating simple basic tables...');

    // Drop tables if they exist to start fresh
    await sql.unsafe(`
      DROP TABLE IF EXISTS "responses" CASCADE;
      DROP TABLE IF EXISTS "enrollments" CASCADE;
      DROP TABLE IF EXISTS "workshops" CASCADE;
      DROP TABLE IF EXISTS "consents" CASCADE;
      DROP TABLE IF EXISTS "audit_logs" CASCADE;
      DROP TABLE IF EXISTS "users" CASCADE;
    `);

    // Create users table with TEXT IDs initially
    await sql.unsafe(`
      CREATE TABLE "users" (
        "id" TEXT PRIMARY KEY,
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
        "id" TEXT PRIMARY KEY,
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
        "facilitatorId" TEXT REFERENCES "users"("id"),
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "publishedAt" TIMESTAMP,
        "deletedAt" TIMESTAMP
      );
    `);

    // Create enrollments table
    await sql.unsafe(`
      CREATE TABLE "enrollments" (
        "id" TEXT PRIMARY KEY,
        "workshopId" TEXT NOT NULL REFERENCES "workshops"("id") ON DELETE CASCADE,
        "participantId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
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
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
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
        "id" TEXT PRIMARY KEY,
        "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "tableName" TEXT NOT NULL,
        "recordId" TEXT NOT NULL,
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
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "workshopId" TEXT REFERENCES "workshops"("id") ON DELETE CASCADE,
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
    const adminId = uuidv4();
    await sql`
      INSERT INTO "users" ("id", "openId", "name", "email", "password", "loginMethod", "role", "isActive", "emailVerified")
      VALUES (
        ${adminId},
        'admin-default',
        'System Administrator',
        'admin@workshopsai.local',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyCskw9bVhXq4O',
        'local',
        'admin',
        true,
        true
      );
    `;

    // Check if tables exist now
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    console.log('📊 Current tables in database:');
    if (tables.length === 0) {
      console.log('  No tables found.');
    } else {
      tables.forEach(table => {
        console.log(`  - ${table.tablename}`);
      });
    }

    console.log('✅ Simple basic tables created successfully');

  } catch (error) {
    console.error('❌ Table creation failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createSimpleBasicTables();