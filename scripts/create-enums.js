const { Pool } = require('pg');

async function createMissingEnums() {
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

    console.log('Creating missing enum types...');

    const enums = [
      'CREATE TYPE "questionnaireStatus" AS ENUM(\'draft\', \'review\', \'published\', \'closed\', \'analyzed\')',
      'CREATE TYPE "questionType" AS ENUM(\'text\', \'textarea\', \'number\', \'scale\', \'single_choice\', \'multiple_choice\')',
      'CREATE TYPE "llmAnalysisType" AS ENUM(\'thematic\', \'clusters\', \'contradictions\', \'insights\', \'recommendations\')',
      'CREATE TYPE "responseStatus" AS ENUM(\'draft\', \'submitted\')'
    ];

    for (const enumSQL of enums) {
      try {
        await client.query(enumSQL);
        console.log('✓ Created enum type');
      } catch (err) {
        console.log('ℹ Enum already exists or error:', err.message);
      }
    }

    console.log('✅ Enum types created successfully!');
    await client.release();
  } catch (error) {
    console.error('❌ Error creating enum types:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createMissingEnums().catch(console.error);