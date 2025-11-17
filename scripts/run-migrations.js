const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const connectionString = `postgresql://workshopsai:dev_password@localhost:5433/workshopsai_cms_dev`;
  const sql = postgres(connectionString);

  try {
    console.log('🔄 Running database migrations...');

    // Read and run the initial schema migration
    const schemaSQL = fs.readFileSync(path.join(__dirname, '../migrations/001_initial_postgresql_schema.sql'), 'utf8');
    console.log('📋 Running initial PostgreSQL schema migration...');
    await sql.unsafe(schemaSQL);
    console.log('✅ Initial schema migration completed');

    // Read and run the minimal tables creation
    const tablesSQL = fs.readFileSync(path.join(__dirname, '../scripts/create-minimal-tables.sql'), 'utf8');
    console.log('📋 Creating minimal database tables...');
    await sql.unsafe(tablesSQL);
    console.log('✅ Minimal tables created successfully');

    // Check if tables exist by querying the database
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    console.log('📊 Current tables in database:');
    if (tables.length === 0) {
      console.log('  No tables found. Need to create tables via Drizzle ORM or other migrations.');
    } else {
      tables.forEach(table => {
        console.log(`  - ${table.tablename}`);
      });
    }

    console.log('🎉 Migration process completed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();