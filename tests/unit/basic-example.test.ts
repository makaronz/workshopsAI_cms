/**
 * Basic Test Example
 * Simple test to verify the testing infrastructure is working
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { testUtils } from '../vitest-setup'

describe('Testing Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have test utilities available', () => {
    expect(testUtils).toBeDefined()
    expect(testUtils.createMockUser).toBeDefined()
    expect(testUtils.createMockWorkshop).toBeDefined()
    expect(testUtils.createMockQuestionnaire).toBeDefined()
  })

  it('should create mock user data', () => {
    const user = testUtils.createMockUser()
    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).toHaveProperty('username')
    expect(user).toHaveProperty('firstName')
    expect(user).toHaveProperty('lastName')
    expect(user).toHaveProperty('role')
  })

  it('should create mock workshop data', () => {
    const workshop = testUtils.createMockWorkshop()
    expect(workshop).toHaveProperty('id')
    expect(workshop).toHaveProperty('title')
    expect(workshop).toHaveProperty('description')
    expect(workshop).toHaveProperty('slug')
    expect(workshop).toHaveProperty('status')
  })

  it('should create mock questionnaire data', () => {
    const questionnaire = testUtils.createMockQuestionnaire()
    expect(questionnaire).toHaveProperty('id')
    expect(questionnaire).toHaveProperty('title')
    expect(questionnaire).toHaveProperty('description')
    expect(questionnaire).toHaveProperty('questions')
    expect(Array.isArray(questionnaire.questions)).toBe(true)
  })

  it('should generate mock JWT tokens', () => {
    const payload = { userId: 'test-user', role: 'user' }
    const token = testUtils.generateMockJWT(payload)
    expect(typeof token).toBe('string')
    expect(token).toContain('mock.jwt.token')
  })

  it('should create mock files', () => {
    const file = testUtils.createMockFile('test.txt', 'text/plain', 1024)
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('test.txt')
    expect(file.type).toBe('text/plain')
    expect(file.size).toBe(1024)
  })
})

describe('Basic Functionality Tests', () => {
  it('should perform basic async operations', async () => {
    const result = await testUtils.waitFor(100)
    expect(result).toBeUndefined() // setTimeout returns undefined
  })

  it('should handle promises correctly', async () => {
    const promise = Promise.resolve('test-value')
    await expect(promise).resolves.toBe('test-value')
  })

  it('should handle error cases', async () => {
    const promise = Promise.reject(new Error('test error'))
    await expect(promise).rejects.toThrow('test error')
  })
})

describe('Mock Verification', () => {
  it('should have console mocks', () => {
    expect(vi.isMockFunction(console.log)).toBe(true)
    expect(vi.isMockFunction(console.error)).toBe(true)
  })

  it('should have fetch mock', () => {
    expect(global.fetch).toBeDefined()
    expect(vi.isMockFunction(global.fetch)).toBe(true)
  })

  it('should have WebSocket mock', () => {
    expect(global.WebSocket).toBeDefined()
  })

  it('should have FileReader mock', () => {
    expect(global.FileReader).toBeDefined()
  })

  it('should have localStorage mock', () => {
    expect(window.localStorage).toBeDefined()
    expect(vi.isMockFunction(window.localStorage.getItem)).toBe(true)
    expect(vi.isMockFunction(window.localStorage.setItem)).toBe(true)
  })
})

describe('Environment Setup', () => {
  it('should have test environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test')
    expect(process.env.DB_NAME).toBe('workshopsai_cms_vitest_test')
  })

  it('should have JWT secrets for testing', () => {
    expect(process.env.JWT_SECRET).toBeDefined()
    expect(process.env.REFRESH_TOKEN_SECRET).toBeDefined()
  })
})