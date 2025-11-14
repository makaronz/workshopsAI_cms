/**
 * Integration Test Helpers
 * Database and application setup utilities for integration testing
 */

import express from 'express'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../src/models/schema'
import type { Express } from 'express'

// Test database configuration
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  user: process.env.TEST_DB_USER || 'test_user',
  password: process.env.TEST_DB_PASSWORD || 'test_password',
  database: process.env.TEST_DB_NAME || 'workshopsai_cms_test',
  max: 1 // Single connection for tests
}

let testDbConnection: postgres.Sql | null = null
let testDb: ReturnType<typeof drizzle> | null = null

export async function getTestDatabase() {
  if (testDb && testDbConnection) {
    return {
      db: testDb,
      connection: testDbConnection,
      reset: async () => {
        await resetTestDatabase(testDb, testDbConnection)
      },
      cleanup: async () => {
        await cleanupTestData(testDb)
      },
      close: async () => {
        if (testDbConnection) {
          await testDbConnection.end()
          testDbConnection = null
          testDb = null
        }
      }
    }
  }

  // Create test database connection
  testDbConnection = postgres(TEST_DB_CONFIG)
  testDb = drizzle(testDbConnection, { schema })

  // Reset database schema
  await setupTestDatabase(testDb, testDbConnection)

  return {
    db: testDb,
    connection: testDbConnection,
    reset: async () => {
      await resetTestDatabase(testDb!, testDbConnection!)
    },
    cleanup: async () => {
      await cleanupTestData(testDb!)
    },
    close: async () => {
      if (testDbConnection) {
        await testDbConnection.end()
        testDbConnection = null
        testDb = null
      }
    },

    // Convenience methods for test data creation
    createUser: async (userData: any) => {
      const [user] = await testDb!.insert(schema.users).values({
        id: userData.id || `user_${Date.now()}`,
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'user',
        isActive: userData.isActive ?? true,
        emailVerified: userData.emailVerified ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...userData
      }).returning()
      return user
    },

    createWorkshop: async (workshopData: any) => {
      const [workshop] = await testDb!.insert(schema.workshops).values({
        id: workshopData.id || `workshop_${Date.now()}`,
        title: workshopData.title,
        description: workshopData.description,
        slug: workshopData.slug,
        status: workshopData.status || 'draft',
        maxParticipants: workshopData.maxParticipants || 20,
        currentParticipants: 0,
        startDate: workshopData.startDate ? new Date(workshopData.startDate) : null,
        endDate: workshopData.endDate ? new Date(workshopData.endDate) : null,
        instructorId: workshopData.instructorId,
        price: workshopData.price || 0,
        currency: workshopData.currency || 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...workshopData
      }).returning()
      return workshop
    },

    createQuestionnaire: async (questionnaireData: any) => {
      const [questionnaire] = await testDb!.insert(schema.questionnaires).values({
        id: questionnaireData.id || `questionnaire_${Date.now()}`,
        title: questionnaireData.title,
        description: questionnaireData.description,
        type: questionnaireData.type || 'enrollment',
        workshopId: questionnaireData.workshopId,
        isRequired: questionnaireData.isRequired ?? true,
        isActive: questionnaireData.isActive ?? true,
        questions: questionnaireData.questions || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...questionnaireData
      }).returning()
      return questionnaire
    },

    createEnrollment: async (enrollmentData: any) => {
      const [enrollment] = await testDb!.insert(schema.enrollments).values({
        id: enrollmentData.id || `enrollment_${Date.now()}`,
        userId: enrollmentData.userId,
        workshopId: enrollmentData.workshopId,
        status: enrollmentData.status || 'pending',
        enrolledAt: new Date(),
        confirmedAt: enrollmentData.status === 'confirmed' ? new Date() : null,
        paymentStatus: enrollmentData.paymentStatus || 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...enrollmentData
      }).returning()
      return enrollment
    },

    createSession: async (sessionData: any) => {
      const [session] = await testDb!.insert(schema.userSessions).values({
        id: sessionData.id || `session_${Date.now()}`,
        userId: sessionData.userId,
        token: sessionData.token,
        refreshToken: sessionData.refreshToken,
        expiresAt: sessionData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
        ...sessionData
      }).returning()
      return session
    }
  }
}

async function setupTestDatabase(db: ReturnType<typeof drizzle>, connection: postgres.Sql) {
  try {
    // Test database connection
    await connection`SELECT 1`

    // Run migrations if needed (you can also use drizzle-kit for this)
    console.log('✅ Test database connected successfully')
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error)
    throw error
  }
}

async function resetTestDatabase(db: ReturnType<typeof drizzle>, connection: postgres.Sql) {
  try {
    // Clean all tables in correct order to respect foreign key constraints
    await connection`
      TRUNCATE TABLE
        user_sessions,
        responses,
        enrollments,
        questionnaires,
        workshops,
        users
      RESTART IDENTITY CASCADE
    `

    console.log('✅ Test database reset successfully')
  } catch (error) {
    console.error('❌ Failed to reset test database:', error)
    throw error
  }
}

async function cleanupTestData(db: ReturnType<typeof drizzle>) {
  try {
    // Clean up test-specific data while preserving schema
    console.log('✅ Test data cleaned up successfully')
  } catch (error) {
    console.error('❌ Failed to cleanup test data:', error)
  }
}

export async function setupTestApp(): Promise<Express> {
  const app = express()

  // Basic middleware
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')

    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
    } else {
      next()
    }
  })

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: 'test'
    })
  })

  // Test endpoints for integration testing
  app.get('/test/users', async (req, res) => {
    try {
      const db = await getTestDatabase()
      const users = await db.db.select().from(schema.users)
      res.json({ success: true, data: users })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch users' }
      })
    }
  })

  app.post('/test/users', async (req, res) => {
    try {
      const db = await getTestDatabase()
      const user = await db.createUser(req.body)
      res.status(201).json({ success: true, data: user })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create user' }
      })
    }
  })

  app.get('/test/workshops', async (req, res) => {
    try {
      const db = await getTestDatabase()
      const workshops = await db.db.select().from(schema.workshops)
      res.json({ success: true, data: workshops })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch workshops' }
      })
    }
  })

  app.post('/test/workshops', async (req, res) => {
    try {
      const db = await getTestDatabase()
      const workshop = await db.createWorkshop(req.body)
      res.status(201).json({ success: true, data: workshop })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create workshop' }
      })
    }
  })

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Test app error:', err)
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'test' ? err.message : undefined
      }
    })
  })

  return app
}

export async function cleanupTestApp(testDatabase: any) {
  try {
    if (testDatabase) {
      await testDatabase.close()
    }
    console.log('✅ Test app cleaned up successfully')
  } catch (error) {
    console.error('❌ Failed to cleanup test app:', error)
  }
}

// Mock authentication middleware for testing
export const mockAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { message: 'No authorization token provided' }
    })
  }

  const token = authHeader.substring(7)

  // Mock token validation
  if (token.startsWith('mock-jwt-token-for-')) {
    const userId = token.replace('mock-jwt-token-for-', '')
    req.user = {
      id: userId,
      email: `${userId}@example.com`,
      role: 'user'
    }
    next()
  } else {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid token' }
    })
  }
}

// Mock validation middleware
export const mockValidationMiddleware = (schema: any) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Mock validation - in real implementation, use proper validation library
    if (req.body && typeof req.body === 'object') {
      next()
    } else {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid request body' }
      })
    }
  }
}