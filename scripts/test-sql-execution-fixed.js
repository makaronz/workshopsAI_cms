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

// Function to split SQL into statements properly
function splitSqlStatements(sql) {
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    let dollarQuoteTag = '';
    let i = 0;

    while (i < sql.length) {
        const char = sql[i];
        const nextTwo = sql.substr(i, 2);
        const nextThree = sql.substr(i, 3);

        // Handle dollar-quoted strings
        if (!inDollarQuote && nextTwo === '$$') {
            inDollarQuote = true;
            dollarQuoteTag = '$$';
            current += '$$';
            i += 2;
            continue;
        }

        if (inDollarQuote && nextTwo === dollarQuoteTag) {
            inDollarQuote = false;
            current += '$$';
            i += 2;
            continue;
        }

        // Handle tagged dollar quotes (like $function$)
        if (!inDollarQuote && nextThree === '$do$') {
            inDollarQuote = true;
            dollarQuoteTag = '$do$';
            current += '$do$';
            i += 4;
            continue;
        }

        if (inDollarQuote && sql.substr(i, 5) === dollarQuoteTag) {
            inDollarQuote = false;
            current += dollarQuoteTag;
            i += dollarQuoteTag.length;
            continue;
        }

        // Handle statement terminators when not in dollar quotes
        if (!inDollarQuote && char === ';') {
            const statement = current.trim();
            if (statement && !statement.startsWith('--')) {
                statements.push(statement);
            }
            current = '';
            i++;
            continue;
        }

        current += char;
        i++;
    }

    // Add any remaining content
    const statement = current.trim();
    if (statement && !statement.startsWith('--')) {
        statements.push(statement);
    }

    return statements;
}

async function testSqlFile(filePath, fileName) {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log(`\n🔍 Testing ${fileName}...`);

        // Read SQL file
        const sqlContent = fs.readFileSync(filePath, 'utf8');

        // Split into individual statements properly
        const statements = splitSqlStatements(sqlContent);

        console.log(`📝 Found ${statements.length} SQL statements in ${fileName}`);

        let successCount = 0;
        let errorCount = 0;
        let errors = [];
        let warnings = [];

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];

            // Skip empty statements
            if (!statement || statement.trim() === '') {
                continue;
            }

            try {
                const result = await client.query(statement);
                successCount++;

                // Log success messages from SELECT statements
                if (statement.trim().toLowerCase().startsWith('select')) {
                    console.log(`  ✅ ${result.rows[0]?.status || 'Query executed'}`);
                }

                // Show progress for every 5 statements
                if ((i + 1) % 5 === 0) {
                    console.log(`  📈 Processed ${i + 1}/${statements.length} statements`);
                }
            } catch (error) {
                errorCount++;
                const errorMsg = `Statement ${i + 1}: ${error.message}`;
                errors.push(errorMsg);

                // Categorize the error
                if (error.message.includes('column') && error.message.includes('does not exist')) {
                    console.log(`  ❌ Column reference error in statement ${i + 1}: ${error.message}`);
                    console.log(`  📄 SQL: ${statement.substring(0, 150)}${statement.length > 150 ? '...' : ''}`);
                } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
                    console.log(`  ⚠️  Expected error (table dependency): ${error.message}`);
                } else if (error.message.includes('already exists')) {
                    console.log(`  ⚠️  Expected error (object exists): ${error.message}`);
                } else {
                    console.log(`  ❌ Unexpected error in statement ${i + 1}: ${error.message}`);
                }
            }
        }

        console.log(`\n📊 Results for ${fileName}:`);
        console.log(`  ✅ Successful statements: ${successCount}`);
        console.log(`  ❌ Failed statements: ${errorCount}`);

        if (errors.length > 0) {
            console.log(`\n🚨 Errors in ${fileName}:`);
            errors.forEach(error => {
                if (error.includes('column') && error.includes('does not exist')) {
                    console.log(`   🔴 COLUMN ISSUE: ${error}`);
                } else if (error.includes('relation') && error.includes('does not exist')) {
                    console.log(`   🟡 DEPENDENCY: ${error}`);
                } else {
                    console.log(`   🟠 OTHER: ${error}`);
                }
            });
        }

        return { successCount, errorCount, errors };

    } catch (error) {
        console.error(`💥 Connection error testing ${fileName}:`, error.message);
        return { successCount: 0, errorCount: 1, errors: [error.message] };
    } finally {
        await client.end();
    }
}

async function cleanDatabase() {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log('\n🧹 Cleaning database for fresh test...');

        // Drop tables in reverse order of dependencies
        const dropTables = [
            'DROP TABLE IF EXISTS responses CASCADE',
            'DROP TABLE IF EXISTS enrollments CASCADE',
            'DROP TABLE IF EXISTS workshops CASCADE',
            'DROP TABLE IF EXISTS consents CASCADE',
            'DROP TABLE IF EXISTS audit_logs CASCADE',
            'DROP TABLE IF EXISTS users CASCADE'
        ];

        // Drop types
        const dropTypes = [
            'DROP TYPE IF EXISTS paymentStatus CASCADE',
            'DROP TYPE IF EXISTS enrollmentStatus CASCADE',
            'DROP TYPE IF EXISTS status CASCADE',
            'DROP TYPE IF EXISTS role CASCADE',
            'DROP TYPE IF EXISTS loginMethod CASCADE'
        ];

        for (const sql of [...dropTables, ...dropTypes]) {
            try {
                await client.query(sql);
            } catch (error) {
                // Ignore errors during cleanup
            }
        }

        console.log('✅ Database cleaned successfully');
        await client.end();
    } catch (error) {
        console.error('❌ Database cleanup failed:', error.message);
        await client.end();
    }
}

async function main() {
    console.log('🚀 Starting SQL File Validation Tests (Fixed)');
    console.log('=============================================');

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

    // Clean database for fresh test
    await cleanDatabase();

    // SQL files to test
    const sqlFiles = [
        { path: 'scripts/create-minimal-tables.sql', name: 'create-minimal-tables.sql' },
        { path: 'scripts/create-simple-tables.sql', name: 'create-simple-tables.sql' },
        { path: 'scripts/create-basic-tables.sql', name: 'create-basic-tables.sql' }
    ];

    let totalSuccess = 0;
    let totalErrors = 0;
    let columnErrors = [];
    let allErrors = [];

    // Test each SQL file
    for (const file of sqlFiles) {
        const fullPath = path.join(__dirname, '..', file.path);

        if (fs.existsSync(fullPath)) {
            const result = await testSqlFile(fullPath, file.name);
            totalSuccess += result.successCount;
            totalErrors += result.errorCount;

            // Track column-specific errors
            const colErrors = result.errors.filter(err => err.includes('column') && err.includes('does not exist'));
            columnErrors.push(...colErrors);

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

    if (columnErrors.length > 0) {
        console.log('\n🚨 COLUMN NAME ISSUES FOUND:');
        const uniqueColumnErrors = [...new Set(columnErrors)];
        uniqueColumnErrors.forEach(error => console.log(`   - ${error}`));

        console.log('\n💡 Suggested Fix:');
        console.log('   The following column name mismatches were detected:');
        console.log('   - Check that index column names exactly match table column definitions');
        console.log('   - PostgreSQL column names are case-sensitive when quoted');
        console.log('   - Ensure consistent camelCase naming (e.g., "workshopId" not "workshopid")');
    } else if (totalErrors > 0) {
        console.log('\n⚠️  Other Issues Found:');
        const otherErrors = allErrors.filter(err => !err.includes('column') && err.includes('does not exist'));
        [...new Set(otherErrors)].forEach(error => console.log(`   - ${error}`));
    } else {
        console.log('\n🎉 All SQL files executed successfully without column name issues!');
    }
}

// Run the test
main().catch(console.error);