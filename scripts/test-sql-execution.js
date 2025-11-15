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

async function testSqlFile(filePath, fileName) {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log(`\n🔍 Testing ${fileName}...`);

        // Read SQL file
        const sqlContent = fs.readFileSync(filePath, 'utf8');

        // Split into individual statements
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`📝 Found ${statements.length} SQL statements in ${fileName}`);

        let successCount = 0;
        let errorCount = 0;
        let errors = [];

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];

            try {
                await client.query(statement);
                successCount++;

                // Show progress for every 10 statements
                if ((i + 1) % 10 === 0) {
                    console.log(`  ✅ Processed ${i + 1}/${statements.length} statements`);
                }
            } catch (error) {
                errorCount++;
                const errorMsg = `Statement ${i + 1}: ${error.message}`;
                errors.push(errorMsg);
                console.log(`  ❌ Error in statement ${i + 1}: ${error.message}`);

                // Log the problematic statement
                if (error.message.includes('column') && error.message.includes('does not exist')) {
                    console.log(`  📄 Problematic SQL:\n     ${statement.substring(0, 200)}${statement.length > 200 ? '...' : ''}`);
                }
            }
        }

        console.log(`\n📊 Results for ${fileName}:`);
        console.log(`  ✅ Successful statements: ${successCount}`);
        console.log(`  ❌ Failed statements: ${errorCount}`);

        if (errors.length > 0) {
            console.log(`\n🚨 Errors in ${fileName}:`);
            errors.forEach(error => console.log(`   - ${error}`));
        }

        return { successCount, errorCount, errors };

    } catch (error) {
        console.error(`💥 Connection error testing ${fileName}:`, error.message);
        return { successCount: 0, errorCount: 1, errors: [error.message] };
    } finally {
        await client.end();
    }
}

async function main() {
    console.log('🚀 Starting SQL File Validation Tests');
    console.log('=====================================');

    // Test connection first
    const testClient = new Client(dbConfig);
    try {
        await testClient.connect();
        console.log('✅ Database connection successful');
        await testClient.end();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.log('\n💡 Please ensure PostgreSQL is running with these settings:');
        console.log(`   Host: ${dbConfig.host}`);
        console.log(`   Port: ${dbConfig.port}`);
        console.log(`   Database: ${dbConfig.database}`);
        console.log(`   User: ${dbConfig.user}`);
        process.exit(1);
        return;
    }

    // SQL files to test
    const sqlFiles = [
        { path: 'scripts/create-minimal-tables.sql', name: 'create-minimal-tables.sql' },
        { path: 'scripts/create-simple-tables.sql', name: 'create-simple-tables.sql' },
        { path: 'scripts/create-basic-tables.sql', name: 'create-basic-tables.sql' }
    ];

    let totalSuccess = 0;
    let totalErrors = 0;
    let allErrors = [];

    // Test each SQL file
    for (const file of sqlFiles) {
        const fullPath = path.join(__dirname, '..', file.path);

        if (fs.existsSync(fullPath)) {
            const result = await testSqlFile(fullPath, file.name);
            totalSuccess += result.successCount;
            totalErrors += result.errorCount;
            allErrors.push(...result.errors);
        } else {
            console.log(`⚠️  File not found: ${fullPath}`);
        }
    }

    // Summary
    console.log('\n🎯 Overall Summary');
    console.log('==================');
    console.log(`✅ Total successful statements: ${totalSuccess}`);
    console.log(`❌ Total failed statements: ${totalErrors}`);

    if (totalErrors > 0) {
        console.log('\n🚨 Critical Issues Found:');
        const uniqueErrors = [...new Set(allErrors)];
        uniqueErrors.forEach(error => console.log(`   - ${error}`));

        // Provide fix suggestions
        if (allErrors.some(err => err.includes('column') && err.includes('does not exist'))) {
            console.log('\n💡 Suggested Fix:');
            console.log('   Check for column name mismatches between table definitions and indexes.');
            console.log('   Ensure index column names exactly match table column names (case-sensitive).');
        }
    } else {
        console.log('\n🎉 All SQL files executed successfully!');
    }
}

// Run the test
main().catch(console.error);