import { Pool } from 'pg';
import { faker } from '@faker-js/faker';

/**
 * Integration Test Database Helpers
 *
 * Provides database setup, test data management, and utility functions
 * for integration testing scenarios.
 */

export interface TestDatabase {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  pool: Pool;
}

let testDb: TestDatabase | null = null;

/**
 * Get test database connection
 */
export async function getTestDbConnection(): Promise<TestDatabase> {
  if (testDb) {
    return testDb;
  }

  const dbConfig = {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    database: process.env.TEST_DB_NAME || 'workshopsai_cms_test',
    username: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'password'
  };

  const pool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.username,
    password: dbConfig.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Test database connection established');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }

  testDb = {
    ...dbConfig,
    pool
  };

  return testDb;
}

/**
 * Clean up test database
 */
export async function cleanupTestData(db: TestDatabase): Promise<void> {
  if (!db || !db.pool) {
    return;
  }

  const tables = [
    'responses',
    'enrollments',
    'questionnaires',
    'workshops',
    'users',
    'sessions',
    'audit_logs'
  ];

  try {
    // Disable foreign key constraints temporarily
    await db.pool.query('SET session_replication_role = replica;');

    // Clean up tables in order of dependencies
    for (const table of tables) {
      try {
        await db.pool.query(`DELETE FROM ${table}`);
        console.log(`✅ Cleaned table: ${table}`);
      } catch (error) {
        console.warn(`⚠️  Could not clean table ${table}:`, error);
      }
    }

    // Reset sequences
    const sequences = [
      'users_id_seq',
      'workshops_id_seq',
      'questionnaires_id_seq',
      'enrollments_id_seq',
      'responses_id_seq'
    ];

    for (const sequence of sequences) {
      try {
        await db.pool.query(`ALTER SEQUENCE IF EXISTS ${sequence} RESTART WITH 1`);
      } catch (error) {
        // Ignore if sequence doesn't exist
      }
    }

    // Re-enable foreign key constraints
    await db.pool.query('SET session_replication_role = DEFAULT;');

  } catch (error) {
    console.error('❌ Failed to cleanup test database:', error);
    throw error;
  }
}

/**
 * Close test database connection
 */
export async function closeTestDatabase(): Promise<void> {
  if (testDb && testDb.pool) {
    await testDb.pool.end();
    testDb = null;
    console.log('✅ Test database connection closed');
  }
}

/**
 * Create test data with database relationships
 */
export async function createRelatedTestData(db: TestDatabase): Promise<{
  user: any;
  workshop: any;
  questionnaire: any;
  enrollments: any[];
  responses: any[];
}> {
  // Create user
  const userResult = await db.pool.query(`
    INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING *
  `, [
    faker.string.uuid(),
    faker.internet.email(),
    'hashedpassword',
    faker.person.firstName(),
    faker.person.lastName(),
    'participant'
  ]);

  const user = userResult.rows[0];

  // Create workshop
  const workshopResult = await db.pool.query(`
    INSERT INTO workshops (
      id, title, description, start_date, end_date, capacity,
      instructor_id, created_by, created_at, updated_at, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9)
    RETURNING *
  `, [
    faker.string.uuid(),
    faker.lorem.words(3),
    faker.lorem.paragraph(),
    faker.date.future({ years: 1 }),
    faker.date.future({ years: 1 }),
    faker.number.int({ min: 10, max: 50 }),
    user.id,
    user.id,
    'published'
  ]);

  const workshop = workshopResult.rows[0];

  // Create questionnaire
  const questionnaireResult = await db.pool.query(`
    INSERT INTO questionnaires (
      id, title, description, type, workshop_id, created_by, created_at, updated_at, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)
    RETURNING *
  `, [
    faker.string.uuid(),
    'Feedback Questionnaire',
    faker.lorem.paragraph(),
    'feedback',
    workshop.id,
    user.id,
    'active'
  ]);

  const questionnaire = questionnaireResult.rows[0];

  // Create enrollments
  const enrollmentCount = faker.number.int({ min: 5, max: 15 });
  const enrollments = [];

  for (let i = 0; i < enrollmentCount; i++) {
    const enrollmentResult = await db.pool.query(`
      INSERT INTO enrollments (
        id, workshop_id, participant_id, participant_email, participant_name,
        status, enrolled_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
      RETURNING *
    `, [
      faker.string.uuid(),
      workshop.id,
      faker.string.uuid(),
      faker.internet.email(),
      faker.person.fullName(),
      'confirmed'
    ]);

    enrollments.push(enrollmentResult.rows[0]);
  }

  // Create responses
  const responseCount = Math.floor(enrollmentCount * 0.8); // 80% completion rate
  const responses = [];

  for (let i = 0; i < responseCount; i++) {
    const responseResult = await db.pool.query(`
      INSERT INTO responses (
        id, questionnaire_id, workshop_id, participant_id, participant_email,
        status, started_at, submitted_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), NOW())
      RETURNING *
    `, [
      faker.string.uuid(),
      questionnaire.id,
      workshop.id,
      enrollments[i]?.participant_id || faker.string.uuid(),
      enrollments[i]?.participant_email || faker.internet.email(),
      'completed'
    ]);

    responses.push(responseResult.rows[0]);
  }

  return {
    user,
    workshop,
    questionnaire,
    enrollments,
    responses
  };
}

/**
 * Create test data for performance testing
 */
export async function createPerformanceTestData(db: TestDatabase, scale: 'small' | 'medium' | 'large'): Promise<{
  userCount: number;
  workshopCount: number;
  enrollmentCount: number;
  responseCount: number;
}> {
  const scales = {
    small: { users: 50, workshops: 10, enrollmentsPerWorkshop: 20, responseRate: 0.7 },
    medium: { users: 500, workshops: 100, enrollmentsPerWorkshop: 50, responseRate: 0.6 },
    large: { users: 5000, workshops: 1000, enrollmentsPerWorkshop: 100, responseRate: 0.5 }
  };

  const config = scales[scale];

  // Create users
  const users = [];
  for (let i = 0; i < config.users; i++) {
    const userResult = await db.pool.query(`
      INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    `, [
      faker.string.uuid(),
      faker.internet.email(),
      'hashedpassword',
      faker.person.firstName(),
      faker.person.lastName(),
      faker.helpers.arrayElement(['admin', 'instructor', 'participant'])
    ]);
    users.push(userResult.rows[0]);
  }

  // Create workshops
  const workshops = [];
  for (let i = 0; i < config.workshops; i++) {
    const instructor = faker.helpers.arrayElement(users);
    const workshopResult = await db.pool.query(`
      INSERT INTO workshops (
        id, title, description, start_date, end_date, capacity,
        instructor_id, created_by, created_at, updated_at, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9)
    `, [
      faker.string.uuid(),
      faker.lorem.words(3),
      faker.lorem.paragraph(),
      faker.date.future({ years: 1 }),
      faker.date.future({ years: 1 }),
      faker.number.int({ min: 20, max: 200 }),
      instructor.id,
      instructor.id,
      'published'
    ]);
    workshops.push(workshopResult.rows[0]);
  }

  // Create enrollments
  let totalEnrollments = 0;
  for (const workshop of workshops) {
    const enrollmentCount = Math.min(config.enrollmentsPerWorkshop, users.length);
    const shuffledUsers = faker.helpers.shuffle(users);

    for (let i = 0; i < enrollmentCount; i++) {
      await db.pool.query(`
        INSERT INTO enrollments (
          id, workshop_id, participant_id, participant_email, participant_name,
          status, enrolled_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
      `, [
        faker.string.uuid(),
        workshop.id,
        shuffledUsers[i].id,
        shuffledUsers[i].email,
        `${shuffledUsers[i].first_name} ${shuffledUsers[i].last_name}`,
        'confirmed'
      ]);
      totalEnrollments++;
    }
  }

  // Create questionnaires and responses
  let totalResponses = 0;
  for (const workshop of workshops) {
    const questionnaireResult = await db.pool.query(`
      INSERT INTO questionnaires (
        id, title, description, type, workshop_id, created_by, created_at, updated_at, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)
      RETURNING id
    `, [
      faker.string.uuid(),
      'Feedback Questionnaire',
      faker.lorem.paragraph(),
      'feedback',
      workshop.id,
      workshop.instructor_id,
      'active'
    ]);

    const questionnaireId = questionnaireResult.rows[0].id;

    // Get enrollments for this workshop
    const enrollmentResults = await db.pool.query(
      'SELECT participant_id, participant_email FROM enrollments WHERE workshop_id = $1',
      [workshop.id]
    );

    for (const enrollment of enrollmentResults.rows) {
      if (Math.random() < config.responseRate) {
        await db.pool.query(`
          INSERT INTO responses (
            id, questionnaire_id, workshop_id, participant_id, participant_email,
            status, started_at, submitted_at, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), NOW())
        `, [
          faker.string.uuid(),
          questionnaireId,
          workshop.id,
          enrollment.participant_id,
          enrollment.participant_email,
          'completed'
        ]);
        totalResponses++;
      }
    }
  }

  return {
    userCount: config.users,
    workshopCount: config.workshops,
    enrollmentCount: totalEnrollments,
    responseCount: totalResponses
  };
}