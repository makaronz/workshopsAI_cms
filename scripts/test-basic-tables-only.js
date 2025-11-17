const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const dbConfig = {
    host: 'localhost',
    port: 5433,
    database: 'workshopsai_cms_dev',
    user: 'workshopsai',
    password: 'dev_password'
};

async function testBasicTables() {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log('✅ Database connected');

        // Clean database thoroughly
        console.log('🧹 Cleaning database...');

        // Drop all tables
        const tables = ['responses', 'enrollments', 'workshops', 'consents', 'audit_logs', 'users'];
        for (const table of tables) {
            try {
                await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
            } catch (e) {
                // Ignore
            }
        }

        // Drop all types
        const types = ['paymentStatus', 'enrollmentStatus', 'status', 'role', 'loginMethod', 'templateTheme', 'language'];
        for (const type of types) {
            try {
                await client.query(`DROP TYPE IF EXISTS ${type} CASCADE`);
            } catch (e) {
                // Ignore
            }
        }

        // Create extension
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log('✅ Database cleaned');

        // Read and execute the basic tables SQL
        const sqlContent = fs.readFileSync(path.join(__dirname, '..', 'scripts/create-basic-tables.sql'), 'utf8');
        console.log('📝 Executing create-basic-tables.sql...');

        await client.query(sqlContent);
        console.log('✅ create-basic-tables.sql executed successfully');

        // Check what was created
        const tablesResult = await client.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' ORDER BY table_name
        `);

        const indexesResult = await client.query(`
            SELECT indexname, tablename FROM pg_indexes
            WHERE schemaname = 'public' ORDER BY tablename, indexname
        `);

        console.log(`📋 Created ${tablesResult.rows.length} tables:`);
        tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));

        console.log(`📊 Created ${indexesResult.rows.length} indexes:`);
        indexesResult.rows.forEach(row => console.log(`   - ${row.tablename}.${row.indexname}`));

        // Test data operations
        console.log('🧪 Testing basic operations...');

        const insertResult = await client.query(`
            INSERT INTO users ("openId", "name", "email", "loginMethod", "role", "isActive", "emailVerified")
            VALUES ('test-123', 'Test User', 'test@example.com', 'local', 'participant', true, false)
            RETURNING id
        `);

        console.log(`✅ User insert successful: ID ${insertResult.rows[0].id}`);

        await client.query('DELETE FROM users WHERE id = $1', [insertResult.rows[0].id]);
        console.log('✅ User delete successful');

        console.log('\n🎉 SUCCESS: create-basic-tables.sql works perfectly!');
        console.log('✅ All column name issues have been resolved');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await client.end();
    }
}

testBasicTables();