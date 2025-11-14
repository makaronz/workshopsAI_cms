/**
 * Integration Test Setup
 * Setup for API integration testing with Supertest and database
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { setupTestApp, cleanupTestApp, getTestDatabase } from './test-helpers'
import type { Express } from 'express'

// Test app instance
let testApp: Express
let testDatabase: any

beforeAll(async () => {
  // Setup test database
  testDatabase = await getTestDatabase()

  // Setup test Express app
  testApp = await setupTestApp()

  // Global test configuration
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-jwt-secret-for-integration'
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-for-integration'
})

afterAll(async () => {
  // Cleanup test app and database
  await cleanupTestApp(testDatabase)
})

beforeEach(async () => {
  // Reset database before each test
  await testDatabase.reset()
  vi.clearAllMocks()
})

afterEach(async () => {
  // Clean up any test-specific state
  await testDatabase.cleanup()
})

// Integration test utilities
export class IntegrationTestUtils {
  static getApp(): Express {
    return testApp
  }

  static getDatabase() {
    return testDatabase
  }

  static async makeRequest(
    method: string,
    path: string,
    data?: any,
    headers: Record<string, string> = {}
  ) {
    const req = request(testApp)[method.toLowerCase()](path)

    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      req.set(key, value)
    })

    // Send data if provided
    if (data) {
      req.send(data)
    }

    return req
  }

  static async authenticatedRequest(
    method: string,
    path: string,
    token: string,
    data?: any
  ) {
    return this.makeRequest(method, path, data, {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    })
  }

  static async createTestUser(userData = {}) {
    const user = {
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      ...userData
    }

    return await testDatabase.createUser(user)
  }

  static async createTestWorkshop(workshopData = {}) {
    const workshop = {
      title: 'Test Workshop',
      description: 'A test workshop',
      slug: 'test-workshop',
      status: 'draft',
      maxParticipants: 20,
      ...workshopData
    }

    return await testDatabase.createWorkshop(workshop)
  }

  static async createTestQuestionnaire(questionnaireData = {}) {
    const questionnaire = {
      title: 'Test Questionnaire',
      description: 'A test questionnaire',
      type: 'enrollment',
      isActive: true,
      questions: [],
      ...questionnaireData
    }

    return await testDatabase.createQuestionnaire(questionnaire)
  }

  static async authenticateUser(user: any) {
    // Simulate authentication and return token
    const token = 'mock-jwt-token-for-' + user.id

    // Store user session in database
    await testDatabase.createSession({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    })

    return token
  }
}

export { IntegrationTestUtils }