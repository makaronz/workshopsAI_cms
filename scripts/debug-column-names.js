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

async function debugSqlFile(filePath, fileName) {
    console.log(`\n🔍 Debugging ${fileName}...`);

    const sqlContent = fs.readFileSync(filePath, 'utf8');
    const lines = sqlContent.split('\n');

    console.log('📋 Analyzing CREATE TABLE statements:');
    lines.forEach((line, index) => {
        if (line.trim().toLowerCase().includes('create table') ||
            line.trim().toLowerCase().includes('workshopid') ||
            line.trim().toLowerCase().includes('participantid') ||
            line.trim().toLowerCase().includes('facilitatorid') ||
            line.trim().toLowerCase().includes('userid')) {

            console.log(`   Line ${index + 1}: ${line.trim()}`);
        }
    });

    console.log('\n📋 Analyzing INDEX and UNIQUE statements:');
    lines.forEach((line, index) => {
        if (line.trim().toLowerCase().includes('create index') ||
            line.trim().toLowerCase().includes('unique(') ||
            line.trim().toLowerCase().includes('references')) {

            console.log(`   Line ${index + 1}: ${line.trim()}`);
        }
    });

    // Look for any lowercase references
    console.log('\n🚨 Looking for lowercase column references:');
    lines.forEach((line, index) => {
        if (line.includes('workshopid') ||
            line.includes('participantid') ||
            line.includes('facilitatorid') ||
            line.includes('userid')) {
            console.log(`   🔴 Line ${index + 1}: ${line.trim()}`);
        }
    });
}

async function testWithVerboseErrors(filePath, fileName) {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log(`\n🧪 Testing ${fileName} with verbose error output...`);

        // Read SQL file
        const sqlContent = fs.readFileSync(filePath, 'utf8');

        // Split into statements more carefully
        const statements = [];
        let currentStatement = '';
        let inCreateTable = false;
        let lineNum = 0;

        const lines = sqlContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            lineNum = i + 1;

            // Skip comments and empty lines
            if (line.startsWith('--') || line === '') {
                continue;
            }

            currentStatement += line + '\n';

            // Detect statement boundaries
            if (line.includes('CREATE TABLE')) {
                inCreateTable = true;
            }

            if (line.endsWith(';')) {
                const statement = currentStatement.trim();
                if (statement) {
                    statements.push({ statement, lineNum: lineNum - (currentStatement.split('\n').length - 1) });
                }
                currentStatement = '';
                inCreateTable = false;
            }
        }

        console.log(`📝 Found ${statements.length} statements to execute`);

        // Execute each statement with detailed error reporting
        for (let i = 0; i < statements.length; i++) {
            const { statement, lineNum } = statements[i];

            try {
                await client.query(statement);
                console.log(`   ✅ Line ${lineNum}: Statement executed successfully`);
            } catch (error) {
                console.log(`   ❌ Line ${lineNum}: ${error.message}`);

                // Show the problematic statement
                console.log(`   📄 Statement content:`);
                statement.split('\n').forEach((stmtLine, idx) => {
                    console.log(`      ${lineNum + idx}: ${stmtLine}`);
                });

                // If this is a column reference error, stop and analyze
                if (error.message.includes('column') && error.message.includes('does not exist')) {
                    console.log(`   🔍 COLUMN REFERENCE ERROR DETECTED!`);
                    console.log(`   💡 This is the issue we need to fix.`);
                    return false; // Stop processing further statements
                }
            }
        }

        return true;

    } catch (error) {
        console.error(`💥 Connection error:`, error.message);
        return false;
    } finally {
        await client.end();
    }
}

async function cleanDatabase() {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log('\n🧹 Cleaning database...');

        const dropTables = [
            'DROP TABLE IF EXISTS responses CASCADE',
            'DROP TABLE IF EXISTS enrollments CASCADE',
            'DROP TABLE IF EXISTS workshops CASCADE',
            'DROP TABLE IF EXISTS consents CASCADE',
            'DROP TABLE IF EXISTS audit_logs CASCADE',
            'DROP TABLE IF EXISTS users CASCADE'
        ];

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

        await client.end();
    } catch (error) {
        await client.end();
    }
}

async function main() {
    console.log('🔍 Column Name Debug Tool');
    console.log('==========================');

    // Clean database first
    await cleanDatabase();

    // Analyze each SQL file
    const sqlFiles = [
        { path: 'scripts/create-minimal-tables.sql', name: 'create-minimal-tables.sql' },
        { path: 'scripts/create-simple-tables.sql', name: 'create-simple-tables.sql' },
        { path: 'scripts/create-basic-tables.sql', name: 'create-basic-tables.sql' }
    ];

    for (const file of sqlFiles) {
        const fullPath = path.join(__dirname, '..', file.path);

        if (fs.existsSync(fullPath)) {
            // First, analyze the file structure
            debugSqlFile(fullPath, file.name);

            // Then, test it with verbose error output
            const success = await testWithVerboseErrors(fullPath, file.name);

            if (!success) {
                console.log(`\n🚨 Found column name issues in ${file.name}`);
                break;
            }
        }
    }
}

// Run the debug tool
main().catch(console.error);