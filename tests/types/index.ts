/**
 * Test Types
 * Common TypeScript types for testing
 */

// User types
export interface TestUser {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  role: 'admin' | 'instructor' | 'user'
  isActive: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
}

// Workshop types
export interface TestWorkshop {
  id: string
  title: string
  description: string
  slug: string
  status: 'draft' | 'published' | 'completed' | 'cancelled'
  maxParticipants: number
  currentParticipants: number
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  instructorId?: string | null
  tags: string[]
  price: number
  currency: string
  imageUrl?: string | null
  requirements?: string[]
  learningObjectives?: string[]
  agenda?: Array<{
    time: string
    title: string
    description: string
  }>
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
}

// Questionnaire types
export interface TestQuestionnaire {
  id: string
  title: string
  description: string
  type: 'enrollment' | 'feedback' | 'survey'
  workshopId?: string | null
  isRequired: boolean
  isActive: boolean
  questions: TestQuestion[]
  createdAt: string
  updatedAt: string
}

export interface TestQuestion {
  id: string
  type: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'radio' | 'checkbox' | 'rating'
  title: string
  description?: string
  placeholder?: string
  required: boolean
  validation?: {
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    format?: string
  }
  options?: Array<{
    value: string
    label: string
  }>
}

// Response types
export interface TestResponse {
  id: string
  questionnaireId: string
  userId: string
  workshopId?: string | null
  answers: Record<string, any>
  status: 'draft' | 'completed' | 'reviewed'
  submittedAt?: string | null
  reviewedAt?: string | null
  reviewedBy?: string | null
  createdAt: string
  updatedAt: string
}

// Enrollment types
export interface TestEnrollment {
  id: string
  userId: string
  workshopId: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  enrolledAt: string
  confirmedAt?: string | null
  cancelledAt?: string | null
  completedAt?: string | null
  certificateIssued: boolean
  paymentStatus: 'pending' | 'paid' | 'refunded'
  paymentId?: string | null
  notes?: string | null
}

// API response types
export interface TestApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Authentication types
export interface TestTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface TestJwtPayload {
  userId: string
  role: string
  iat: number
  exp: number
}

// Component testing types
export interface TestComponentConfig {
  tagName: string
  properties?: Record<string, any>
  attributes?: Record<string, string>
  slots?: Record<string, string>
}

// Mock types
export interface MockRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: any
  query: Record<string, string>
  params: Record<string, string>
  user?: TestUser | null
}

export interface MockResponse {
  status: jest.Mock
  json: jest.Mock
  send: jest.Mock
  end: jest.Mock
  cookie: jest.Mock
  clearCookie: jest.Mock
  redirect: jest.Mock
  headersSent: boolean
  locals: Record<string, any>
}

// Test environment types
export interface TestEnvironment {
  nodeEnv: string
  database: {
    host: string
    port: number
    user: string
    password: string
    name: string
  }
  redis: {
    host: string
    port: number
  }
  jwt: {
    secret: string
    expiresIn: string
  }
}

// Performance testing types
export interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  memoryUsage: number
  networkRequests: number
  bundleSize: number
}

// Accessibility testing types
export interface AccessibilityResult {
  passed: boolean
  issues: string[]
  score: number
  violations: Array<{
    impact: 'critical' | 'serious' | 'moderate' | 'minor'
    description: string
    help: string
    helpUrl: string
  }>
}

// Visual testing types
export interface VisualTestConfig {
  threshold?: number
  animations?: 'disabled' | 'allow'
  fullPage?: boolean
  clip?: {
    x: number
    y: number
    width: number
    height: number
  }
}

// File testing types
export interface TestFile {
  name: string
  type: string
  size: number
  content: string | Buffer
}

// WebSocket testing types
export interface MockWebSocket {
  send: jest.Mock
  close: jest.Mock
  addEventListener: jest.Mock
  removeEventListener: jest.Mock
  readyState: number
  CONNECTING: number
  OPEN: number
  CLOSING: number
  CLOSED: number
}

export interface MockSocketServer {
  emit: jest.Mock
  on: jest.Mock
  close: jest.Mock
  to: jest.Mock
  in: jest.Mock
  sockets: {
    sockets: Map<string, any>
    emit: jest.Mock
  }
}

// Database testing types
export interface TestDatabase {
  reset(): Promise<void>
  cleanup(): Promise<void>
  close(): Promise<void>
  createUser(userData: Partial<TestUser>): Promise<TestUser>
  createWorkshop(workshopData: Partial<TestWorkshop>): Promise<TestWorkshop>
  createQuestionnaire(questionnaireData: Partial<TestQuestionnaire>): Promise<TestQuestionnaire>
  createEnrollment(enrollmentData: Partial<TestEnrollment>): Promise<TestEnrollment>
}

// Error testing types
export interface TestError extends Error {
  code?: string
  statusCode?: number
  details?: any
}

// Async testing types
export interface ResolvablePromise<T = void> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: any) => void
}

// Wait utilities types
export interface WaitOptions {
  timeout?: number
  interval?: number
  message?: string
}

// Spy utilities types
export interface SpyConfig<T extends (...args: any[]) => any> {
  implementation?: T
  returnValue?: ReturnType<T>
  rejectValue?: any
  calls?: Array<Parameters<T>>
}

// Test configuration types
export interface TestConfig {
  timeout?: number
  retries?: number
  parallel?: boolean
  verbose?: boolean
  bail?: boolean
  maxWorkers?: number
}

// Coverage types
export interface CoverageReport {
  lines: {
    total: number
    covered: number
    percentage: number
  }
  functions: {
    total: number
    covered: number
    percentage: number
  }
  branches: {
    total: number
    covered: number
    percentage: number
  }
  statements: {
    total: number
    covered: number
    percentage: number
  }
}