const postgres = require('postgres');

async function checkTables() {
  const sql = postgres(`postgresql://workshopsai:dev_password@localhost:5433/workshopsai_cms_dev`);

  try {
    console.log('🔍 Checking database state...');

    // Check if tables exist in public schema
    const tables = await sql`
      SELECT tablename, tableowner
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    console.log('📊 Tables in public schema:');
    if (tables.length === 0) {
      console.log('  No tables found.');
    } else {
      tables.forEach(table => {
        console.log(`  - ${table.tablename} (owner: ${table.tableowner})`);
      });
    }

    // Check current schema
    const currentSchema = await sql`SELECT current_schema();`;
    console.log('📁 Current schema:', currentSchema[0]?.current_schema);

    // Check all schemas
    const schemas = await sql`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name;
    `;

    console.log('📁 User schemas:');
    schemas.forEach(schema => {
      console.log(`  - ${schema.schema_name}`);
    });

  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await sql.end();
  }
}

checkTables();