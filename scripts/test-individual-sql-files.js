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

async function testSqlFileIndividually(filePath, fileName) {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log(`\n🔍 Testing ${fileName} independently...`);

        // Clean database completely before this test
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public');
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // Read SQL file
        const sqlContent = fs.readFileSync(filePath, 'utf8');

        // Execute the entire file
        const result = await client.query(sqlContent);

        console.log(`✅ ${fileName} executed successfully independently`);

        // Verify tables were created
        const tablesQuery = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log(`   📋 Created ${tablesQuery.rows.length} tables:`);
        tablesQuery.rows.forEach(row => {
            console.log(`      - ${row.table_name}`);
        });

        // Verify indexes
        const indexesQuery = await client.query(`
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname
        `);

        console.log(`   📊 Created ${indexesQuery.rows.length} indexes:`);
        indexesQuery.rows.forEach(row => {
            console.log(`      - ${row.tablename}.${row.indexname}`);
        });

        return { success: true, tablesCount: tablesQuery.rows.length, indexesCount: indexesQuery.rows.length };

    } catch (error) {
        console.error(`❌ Error testing ${fileName}:`, error.message);
        return { success: false, error: error.message };
    } finally {
        await client.end();
    }
}

async function main() {
    console.log('🧪 Individual SQL File Tests');
    console.log('============================');

    // Test connection
    const testClient = new Client(dbConfig);
    try {
        await testClient.connect();
        console.log('✅ Database connection successful');
        await testClient.end();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
        return;
    }

    // Test each SQL file independently
    const sqlFiles = [
        { path: 'scripts/create-minimal-tables.sql', name: 'create-minimal-tables.sql' },
        { path: 'scripts/create-simple-tables.sql', name: 'create-simple-tables.sql' },
        { path: 'scripts/create-basic-tables.sql', name: 'create-basic-tables.sql' }
    ];

    const results = [];

    for (const file of sqlFiles) {
        const fullPath = path.join(__dirname, '..', file.path);

        if (fs.existsSync(fullPath)) {
            const result = await testSqlFileIndividually(fullPath, file.name);
            results.push({ file: file.name, ...result });

            if (result.success) {
                console.log(`\n🎉 ${file.name} works perfectly!`);
                console.log(`   📊 ${result.tablesCount} tables, ${result.indexesCount} indexes created`);
            } else {
                console.log(`\n💥 ${file.name} has issues:`);
                console.log(`   ❌ ${result.error}`);
            }
        } else {
            console.log(`⚠️  File not found: ${fullPath}`);
        }
    }

    // Summary
    console.log('\n📋 Summary Report');
    console.log('=================');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful files: ${successful.length}`);
    console.log(`❌ Failed files: ${failed.length}`);

    if (successful.length > 0) {
        console.log('\n✅ Working files:');
        successful.forEach(result => {
            console.log(`   - ${result.file} (${result.tablesCount} tables, ${result.indexesCount} indexes)`);
        });
    }

    if (failed.length > 0) {
        console.log('\n❌ Files with issues:');
        failed.forEach(result => {
            console.log(`   - ${result.file}: ${result.error}`);
        });
    }

    if (successful.length === sqlFiles.length) {
        console.log('\n🎉 SUCCESS: All SQL files are working correctly!');
        console.log('✅ Column name issues have been resolved');
        console.log('✅ All files can be executed independently');
    } else {
        console.log('\n⚠️  Some files still need fixes');
    }
}

// Run the test
main().catch(console.error);