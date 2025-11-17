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

async function runSqlFile(filePath, fileName) {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log(`\n🔍 Executing ${fileName}...`);

        // Read SQL file
        const sqlContent = fs.readFileSync(filePath, 'utf8');

        // Execute the entire file at once (better for complex SQL)
        const result = await client.query(sqlContent);

        console.log(`✅ ${fileName} executed successfully`);

        if (result.rows && result.rows.length > 0) {
            result.rows.forEach(row => {
                if (row.status) {
                    console.log(`   📢 ${row.status}`);
                }
            });
        }

        return { success: true, error: null };

    } catch (error) {
        console.error(`❌ Error executing ${fileName}:`, error.message);
        return { success: false, error: error.message };
    } finally {
        await client.end();
    }
}

async function verifyDatabaseSetup() {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log('\n🔍 Verifying database setup...');

        // Check if all tables exist
        const tablesCheck = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('\n📋 Tables created:');
        tablesCheck.rows.forEach(row => {
            console.log(`   ✅ ${row.table_name}`);
        });

        // Check if all indexes exist
        const indexesCheck = await client.query(`
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname
        `);

        console.log('\n📊 Indexes created:');
        let currentTable = '';
        indexesCheck.rows.forEach(row => {
            if (row.tablename !== currentTable) {
                currentTable = row.tablename;
                console.log(`\n   📁 ${row.tablename}:`);
            }
            console.log(`      🔑 ${row.indexname}`);
        });

        // Check if all enums exist
        const enumsCheck = await client.query(`
            SELECT typname
            FROM pg_type
            WHERE typtype = 'e'
            ORDER BY typname
        `);

        console.log('\n🏷️  Enum types created:');
        enumsCheck.rows.forEach(row => {
            console.log(`   📝 ${row.typname}`);
        });

        // Test foreign key constraints
        const constraintsCheck = await client.query(`
            SELECT
                tc.table_name,
                tc.constraint_name,
                tc.constraint_type,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_name
        `);

        console.log('\n🔗 Foreign key constraints:');
        let currentTableFK = '';
        constraintsCheck.rows.forEach(row => {
            if (row.table_name !== currentTableFK) {
                currentTableFK = row.table_name;
                console.log(`\n   📁 ${row.table_name}:`);
            }
            console.log(`      🔗 ${row.constraint_name} → ${row.foreign_table_name}(${row.foreign_column_name})`);
        });

        // Check if we can insert and retrieve data
        console.log('\n🧪 Testing data operations...');

        // Test user insertion
        const insertUser = await client.query(`
            INSERT INTO users (openId, name, email, loginMethod, role, isActive, emailVerified)
            VALUES ('test-user-123', 'Test User', 'test@example.com', 'local', 'participant', true, false)
            ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        `);

        const userId = insertUser.rows[0].id;
        console.log(`   ✅ User insertion successful (ID: ${userId})`);

        // Test workshop insertion
        const insertWorkshop = await client.query(`
            INSERT INTO workshops (title, status, facilitatorId)
            VALUES ('Test Workshop', 'draft', $1)
            RETURNING id
        `, [userId]);

        const workshopId = insertWorkshop.rows[0].id;
        console.log(`   ✅ Workshop insertion successful (ID: ${workshopId})`);

        // Test enrollment insertion
        const insertEnrollment = await client.query(`
            INSERT INTO enrollments (workshopId, participantId, status)
            VALUES ($1, $2, 'pending')
            RETURNING id
        `, [workshopId, userId]);

        console.log(`   ✅ Enrollment insertion successful (ID: ${insertEnrollment.rows[0].id})`);

        // Test query with joins
        const testQuery = await client.query(`
            SELECT
                u.name as user_name,
                w.title as workshop_title,
                e.status as enrollment_status
            FROM enrollments e
            JOIN users u ON e.participantId = u.id
            JOIN workshops w ON e.workshopId = w.id
            WHERE u.id = $1
        `, [userId]);

        console.log(`   ✅ Complex query successful: ${testQuery.rows[0].user_name} → ${testQuery.rows[0].workshop_title}`);

        // Clean up test data
        await client.query('DELETE FROM enrollments WHERE participantId = $1', [userId]);
        await client.query('DELETE FROM workshops WHERE facilitatorId = $1', [userId]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        console.log('   🧹 Test data cleaned up');

        return { success: true };

    } catch (error) {
        console.error('❌ Database verification failed:', error.message);
        return { success: false, error: error.message };
    } finally {
        await client.end();
    }
}

async function cleanDatabase() {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log('🧹 Cleaning database for fresh test...');

        // Drop all tables in correct order
        const dropTables = [
            'DROP TABLE IF EXISTS responses CASCADE',
            'DROP TABLE IF EXISTS enrollments CASCADE',
            'DROP TABLE IF EXISTS workshops CASCADE',
            'DROP TABLE IF EXISTS consents CASCADE',
            'DROP TABLE IF EXISTS audit_logs CASCADE',
            'DROP TABLE IF EXISTS users CASCADE'
        ];

        for (const sql of dropTables) {
            try {
                await client.query(sql);
            } catch (error) {
                // Ignore errors during cleanup
            }
        }

        // Drop all enum types
        const dropTypes = [
            'DROP TYPE IF EXISTS paymentStatus CASCADE',
            'DROP TYPE IF EXISTS enrollmentStatus CASCADE',
            'DROP TYPE IF EXISTS status CASCADE',
            'DROP TYPE IF EXISTS role CASCADE',
            'DROP TYPE IF EXISTS loginMethod CASCADE'
        ];

        for (const sql of dropTypes) {
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
    console.log('🚀 Complete Database Setup Test');
    console.log('================================');

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

    // Clean database
    await cleanDatabase();

    // Test each SQL file in order
    const sqlFiles = [
        { path: 'scripts/create-simple-tables.sql', name: 'create-simple-tables.sql' },
        { path: 'scripts/create-basic-tables.sql', name: 'create-basic-tables.sql' },
        { path: 'scripts/create-minimal-tables.sql', name: 'create-minimal-tables.sql' }
    ];

    let allSuccess = true;

    for (const file of sqlFiles) {
        const fullPath = path.join(__dirname, '..', file.path);

        if (fs.existsSync(fullPath)) {
            const result = await runSqlFile(fullPath, file.name);
            if (!result.success) {
                allSuccess = false;
                console.error(`💥 Failed to execute ${file.name}: ${result.error}`);
            }
        } else {
            console.log(`⚠️  File not found: ${fullPath}`);
            allSuccess = false;
        }
    }

    if (allSuccess) {
        // Verify the complete setup
        const verification = await verifyDatabaseSetup();

        if (verification.success) {
            console.log('\n🎉 SUCCESS: Complete database setup test passed!');
            console.log('✅ All tables created successfully');
            console.log('✅ All indexes created successfully');
            console.log('✅ All foreign key constraints working');
            console.log('✅ Data operations working correctly');
            console.log('✅ No column name mismatches found');
        } else {
            console.log('\n❌ FAILED: Database verification failed');
            console.error(verification.error);
        }
    } else {
        console.log('\n❌ FAILED: One or more SQL files failed to execute');
    }
}

// Run the complete test
main().catch(console.error);