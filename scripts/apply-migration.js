const fs = require('fs');
const { Pool } = require('pg');

async function applyMigration() {
  const pool = new Pool({
    host: 'localhost',
    port: 5433,
    user: 'workshopsai',
    password: 'dev_password',
    database: 'workshopsai_cms_dev'
  });

  try {
    console.log('Reading migration file...');
    const migrationSQL = fs.readFileSync('./migrations/0000_polite_wong.sql', 'utf8');

    console.log('Connecting to database...');
    const client = await pool.connect();

    console.log('Applying migration...');
    await client.query(migrationSQL);

    console.log('Migration applied successfully!');
    await client.release();
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration().catch(console.error);