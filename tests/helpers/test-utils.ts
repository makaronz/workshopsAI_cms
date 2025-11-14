/**
 * Test Utilities
 * Common testing utilities and helpers for all test types
 */

import { expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Request, Response } from 'express'

// Types for test utilities
export type MockRequest = Partial<Request> & {
  method: string
  url: string
  headers: Record<string, string>
  body: any
  query: Record<string, string>
  params: Record<string, string>
  user?: any
}

export type MockResponse = {
  status: Mock
  json: Mock
  send: Mock
  end: Mock
  cookie: Mock
  clearCookie: Mock
  redirect: Mock
  headersSent: boolean
  locals: Record<string, any>
}

// Database test utilities
export class DatabaseTestUtils {
  static async setupTestDatabase() {
    // Setup test database connection
    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: vi.fn()
      }),
      end: vi.fn().mockResolvedValue()
    }

    return mockPool
  }

  static async cleanupTestDatabase() {
    // Clean up test database
    vi.clearAllMocks()
  }

  static createMockTable(name: string, columns: Record<string, string>) {
    return {
      name,
      columns,
      insert: vi.fn().mockResolvedValue([{ id: '1' }]),
      select: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue([{ id: '1' }]),
      delete: vi.fn().mockResolvedValue(1)
    }
  }
}

// API test utilities
export class ApiTestUtils {
  static createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
    return {
      method: 'GET',
      url: '/test',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer test-token',
        ...overrides.headers
      },
      body: {},
      query: {},
      params: {},
      ...overrides
    }
  }

  static createMockResponse(): MockResponse {
    const res: any = {
      headersSent: false,
      locals: {}
    }

    res.status = vi.fn().mockReturnThis()
    res.json = vi.fn().mockReturnThis()
    res.send = vi.fn().mockReturnThis()
    res.end = vi.fn().mockReturnThis()
    res.cookie = vi.fn().mockReturnThis()
    res.clearCookie = vi.fn().mockReturnThis()
    res.redirect = vi.fn().mockReturnThis()

    return res
  }

  static async testApiResponse(
    handler: Function,
    req: MockRequest,
    expectedStatus: number = 200,
    expectedData?: any
  ) {
    const res = ApiTestUtils.createMockResponse()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(expectedStatus)

    if (expectedData !== undefined) {
      expect(res.json).toHaveBeenCalledWith(expectedData)
    }

    return res
  }
}

// Authentication test utilities
export class AuthTestUtils {
  static createMockUser(overrides = {}) {
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  }

  static createMockTokens() {
    return {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600
    }
  }

  static createAuthHeaders(accessToken?: string) {
    return {
      'authorization': `Bearer ${accessToken || 'mock-access-token'}`,
      'content-type': 'application/json'
    }
  }
}

// Component test utilities
export class ComponentTestUtils {
  static createMockElement(tagName: string = 'div', attributes: Record<string, string> = {}) {
    const element = document.createElement(tagName)
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value)
    })
    return element
  }

  static async waitForElement(selector: string, timeout = 5000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector)
      if (element) {
        resolve(element)
        return
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)
        if (element) {
          observer.disconnect()
          resolve(element)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      setTimeout(() => {
        observer.disconnect()
        reject(new Error(`Element ${selector} not found within ${timeout}ms`))
      }, timeout)
    })
  }

  static async fireEvent(element: Element, eventType: string, eventData: any = {}) {
    const event = new Event(eventType, { bubbles: true, ...eventData })
    element.dispatchEvent(event)
    return event
  }
}

// File and storage test utilities
export class FileTestUtils {
  static createMockFile(name: string, type: string, size: number = 1024): File {
    const buffer = new ArrayBuffer(size)
    const blob = new Blob([buffer], { type })
    return new File([blob], name, { type })
  }

  static createMockImageFile(name: string = 'test.png'): File {
    // Create a simple 1x1 PNG image
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 1, 1)

    return new Promise<File>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], name, { type: 'image/png' }))
        }
      }, 'image/png')
    }) as any
  }

  static async readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
}

// WebSocket test utilities
export class WebSocketTestUtils {
  static createMockWebSocket() {
    const mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: 1,
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      emit: vi.fn(),
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn()
    }
    return mockWebSocket
  }

  static createMockSocketServer() {
    return {
      emit: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
      to: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      sockets: {
        sockets: new Map(),
        emit: vi.fn()
      }
    }
  }
}

// Performance test utilities
export class PerformanceTestUtils {
  static async measureExecutionTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    return {
      result,
      duration: end - start
    }
  }

  static expectPerformance<T>(fn: () => T | Promise<T>, maxDurationMs: number): Promise<void> {
    return PerformanceTestUtils.measureExecutionTime(fn).then(({ duration }) => {
      expect(duration).toBeLessThan(maxDurationMs)
    })
  }
}

// Date and time test utilities
export class DateTestUtils {
  static createMockDate(date: string | Date): Date {
    return new Date(date)
  }

  static freezeTime(date: string | Date) {
    const mockDate = new Date(date)
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
    return mockDate
  }

  static advanceTime(ms: number) {
    vi.advanceTimersByTime(ms)
  }

  static restoreTime() {
    vi.useRealTimers()
  }
}

// Environment test utilities
export class EnvironmentTestUtils {
  static setEnvironmentVariables(envVars: Record<string, string>) {
    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = value
    })
  }

  static clearEnvironmentVariables(keys: string[]) {
    keys.forEach(key => {
      delete process.env[key]
    })
  }

  static withEnvironment<T>(envVars: Record<string, string>, fn: () => T): T {
    const originalValues: Record<string, string | undefined> = {}

    Object.entries(envVars).forEach(([key, value]) => {
      originalValues[key] = process.env[key]
      process.env[key] = value
    })

    try {
      return fn()
    } finally {
      Object.entries(originalValues).forEach(([key, value]) => {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      })
    }
  }
}

// Async test utilities
export class AsyncTestUtils {
  static async flushPromises() {
    return new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  }

  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw new Error(`Condition not met within ${timeout}ms`)
  }

  static createResolvablePromise<T = void>() {
    let resolve: (value: T) => void
    let reject: (reason?: any) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    return {
      promise,
      resolve: resolve!,
      reject: reject!
    }
  }
}

// Error test utilities
export class ErrorTestUtils {
  static expectError<T>(fn: () => T | Promise<T>, expectedMessage?: string): Promise<void> {
    return expect(fn()).rejects.toThrow(expectedMessage)
  }

  static expectErrorType<T>(
    fn: () => T | Promise<T>,
    errorType: new (...args: any[]) => Error
  ): Promise<void> {
    return expect(fn()).rejects.toBeInstanceOf(errorType)
  }
}

// Export all utilities
export {
  DatabaseTestUtils,
  ApiTestUtils,
  AuthTestUtils,
  ComponentTestUtils,
  FileTestUtils,
  WebSocketTestUtils,
  PerformanceTestUtils,
  DateTestUtils,
  EnvironmentTestUtils,
  AsyncTestUtils,
  ErrorTestUtils
}