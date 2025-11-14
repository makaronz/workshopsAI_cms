/**
 * Mock Data Factory
 * Centralized mock data generation for consistent testing
 */

import type { User, Workshop, Questionnaire, Response } from '../types'

// User mock data
export const mockUsers = {
  admin: {
    id: 'admin-user-id',
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: null
  },

  instructor: {
    id: 'instructor-user-id',
    email: 'instructor@example.com',
    username: 'instructor',
    firstName: 'Instructor',
    lastName: 'User',
    role: 'instructor',
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    lastLoginAt: '2024-01-02T10:00:00.000Z'
  },

  participant: {
    id: 'participant-user-id',
    email: 'participant@example.com',
    username: 'participant',
    firstName: 'Participant',
    lastName: 'User',
    role: 'user',
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
    lastLoginAt: '2024-01-03T09:00:00.000Z'
  },

  inactive: {
    id: 'inactive-user-id',
    email: 'inactive@example.com',
    username: 'inactive',
    firstName: 'Inactive',
    lastName: 'User',
    role: 'user',
    isActive: false,
    emailVerified: false,
    createdAt: '2024-01-04T00:00:00.000Z',
    updatedAt: '2024-01-04T00:00:00.000Z',
    lastLoginAt: null
  }
} as const

// Workshop mock data
export const mockWorkshops = {
  draft: {
    id: 'draft-workshop-id',
    title: 'Introduction to Testing',
    description: 'Learn the fundamentals of software testing',
    slug: 'introduction-to-testing',
    status: 'draft' as const,
    maxParticipants: 30,
    currentParticipants: 0,
    startDate: '2024-02-01T09:00:00.000Z',
    endDate: '2024-02-01T17:00:00.000Z',
    location: 'Online',
    instructorId: 'instructor-user-id',
    tags: ['testing', 'fundamentals'],
    price: 99.99,
    currency: 'USD',
    imageUrl: null,
    requirements: ['Basic programming knowledge'],
    learningObjectives: [
      'Understand testing principles',
      'Write unit tests',
      'Debug test failures'
    ],
    agenda: [
      { time: '09:00', title: 'Introduction', description: 'Course overview' },
      { time: '10:00', title: 'Testing Basics', description: 'Fundamental concepts' },
      { time: '11:00', title: 'Break', description: 'Coffee break' },
      { time: '11:15', title: 'Practical Testing', description: 'Hands-on exercises' },
      { time: '13:00', title: 'Lunch', description: 'Break' },
      { time: '14:00', title: 'Advanced Topics', description: 'Advanced techniques' },
      { time: '16:00', title: 'Q&A', description: 'Questions and answers' }
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    publishedAt: null
  },

  published: {
    id: 'published-workshop-id',
    title: 'Advanced TypeScript Patterns',
    description: 'Master advanced TypeScript patterns and best practices',
    slug: 'advanced-typescript-patterns',
    status: 'published' as const,
    maxParticipants: 25,
    currentParticipants: 15,
    startDate: '2024-02-15T09:00:00.000Z',
    endDate: '2024-02-15T17:00:00.000Z',
    location: 'Virtual Classroom',
    instructorId: 'instructor-user-id',
    tags: ['typescript', 'advanced', 'patterns'],
    price: 199.99,
    currency: 'USD',
    imageUrl: 'https://example.com/workshop-image.jpg',
    requirements: ['Intermediate TypeScript knowledge'],
    learningObjectives: [
      'Master advanced TypeScript patterns',
      'Understand type manipulation',
      'Build type-safe applications'
    ],
    agenda: [
      { time: '09:00', title: 'Type System Deep Dive', description: 'Advanced type concepts' },
      { time: '10:30', title: 'Generic Programming', description: 'Working with generics' },
      { time: '12:00', title: 'Lunch', description: 'Break' },
      { time: '13:00', title: 'Conditional Types', description: 'Type manipulation' },
      { time: '15:00', title: 'Practical Applications', description: 'Real-world examples' }
    ],
    createdAt: '2024-01-05T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
    publishedAt: '2024-01-06T00:00:00.000Z'
  },

  completed: {
    id: 'completed-workshop-id',
    title: 'JavaScript Fundamentals',
    description: 'Complete guide to JavaScript basics',
    slug: 'javascript-fundamentals',
    status: 'completed' as const,
    maxParticipants: 40,
    currentParticipants: 40,
    startDate: '2023-12-01T09:00:00.000Z',
    endDate: '2023-12-01T17:00:00.000Z',
    location: 'Training Center',
    instructorId: 'instructor-user-id',
    tags: ['javascript', 'fundamentals', 'beginner'],
    price: 79.99,
    currency: 'USD',
    imageUrl: 'https://example.com/js-workshop.jpg',
    requirements: [],
    learningObjectives: [
      'JavaScript syntax and basics',
      'DOM manipulation',
      'Event handling'
    ],
    agenda: [],
    createdAt: '2023-11-01T00:00:00.000Z',
    updatedAt: '2023-12-02T00:00:00.000Z',
    publishedAt: '2023-11-15T00:00:00.000Z'
  }
} as const

// Questionnaire mock data
export const mockQuestionnaires = {
  enrollment: {
    id: 'enrollment-questionnaire-id',
    title: 'Workshop Enrollment Form',
    description: 'Please provide some information about yourself',
    type: 'enrollment' as const,
    workshopId: 'published-workshop-id',
    isRequired: true,
    isActive: true,
    questions: [
      {
        id: 'q1',
        type: 'text' as const,
        title: 'Full Name',
        description: 'Enter your full name',
        placeholder: 'John Doe',
        required: true,
        validation: {
          minLength: 2,
          maxLength: 100
        }
      },
      {
        id: 'q2',
        type: 'email' as const,
        title: 'Email Address',
        description: 'Your email for communication',
        placeholder: 'john@example.com',
        required: true,
        validation: {
          format: 'email'
        }
      },
      {
        id: 'q3',
        type: 'select' as const,
        title: 'Experience Level',
        description: 'How would you rate your experience?',
        required: true,
        options: [
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' }
        ]
      },
      {
        id: 'q4',
        type: 'textarea' as const,
        title: 'Learning Goals',
        description: 'What do you hope to learn from this workshop?',
        placeholder: 'Share your learning objectives...',
        required: false,
        validation: {
          maxLength: 500
        }
      }
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  },

  feedback: {
    id: 'feedback-questionnaire-id',
    title: 'Workshop Feedback',
    description: 'Help us improve by providing feedback',
    type: 'feedback' as const,
    workshopId: 'completed-workshop-id',
    isRequired: false,
    isActive: true,
    questions: [
      {
        id: 'q1',
        type: 'rating' as const,
        title: 'Overall Satisfaction',
        description: 'How satisfied were you with the workshop?',
        required: true,
        validation: {
          min: 1,
          max: 5
        }
      },
      {
        id: 'q2',
        type: 'radio' as const,
        title: 'Would you recommend this workshop?',
        description: 'Would you recommend this workshop to others?',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'maybe', label: 'Maybe' }
        ]
      },
      {
        id: 'q3',
        type: 'textarea' as const,
        title: 'Additional Comments',
        description: 'Any additional feedback or suggestions?',
        placeholder: 'Share your thoughts...',
        required: false
      }
    ],
    createdAt: '2023-12-01T00:00:00.000Z',
    updatedAt: '2023-12-01T00:00:00.000Z'
  }
} as const

// Response mock data
export const mockResponses = {
  enrollment: {
    id: 'enrollment-response-id',
    questionnaireId: 'enrollment-questionnaire-id',
    userId: 'participant-user-id',
    workshopId: 'published-workshop-id',
    answers: {
      q1: 'John Participant',
      q2: 'participant@example.com',
      q3: 'intermediate',
      q4: 'I want to learn advanced TypeScript patterns for my work projects'
    },
    status: 'completed' as const,
    submittedAt: '2024-01-10T14:30:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    createdAt: '2024-01-10T14:00:00.000Z',
    updatedAt: '2024-01-10T14:30:00.000Z'
  },

  feedback: {
    id: 'feedback-response-id',
    questionnaireId: 'feedback-questionnaire-id',
    userId: 'participant-user-id',
    workshopId: 'completed-workshop-id',
    answers: {
      q1: 5,
      q2: 'yes',
      q3: 'Excellent workshop! The instructor was very knowledgeable and the content was well-structured.'
    },
    status: 'completed' as const,
    submittedAt: '2023-12-02T10:00:00.000Z',
    reviewedAt: '2023-12-02T11:00:00.000Z',
    reviewedBy: 'instructor-user-id',
    createdAt: '2023-12-02T09:45:00.000Z',
    updatedAt: '2023-12-02T11:00:00.000Z'
  }
} as const

// Enrollment mock data
export const mockEnrollments = {
  active: {
    id: 'active-enrollment-id',
    userId: 'participant-user-id',
    workshopId: 'published-workshop-id',
    status: 'confirmed' as const,
    enrolledAt: '2024-01-10T00:00:00.000Z',
    confirmedAt: '2024-01-10T01:00:00.000Z',
    cancelledAt: null,
    completedAt: null,
    certificateIssued: false,
    paymentStatus: 'paid' as const,
    paymentId: 'payment-123',
    notes: null
  },

  pending: {
    id: 'pending-enrollment-id',
    userId: 'participant-user-id',
    workshopId: 'draft-workshop-id',
    status: 'pending' as const,
    enrolledAt: '2024-01-11T00:00:00.000Z',
    confirmedAt: null,
    cancelledAt: null,
    completedAt: null,
    certificateIssued: false,
    paymentStatus: 'pending' as const,
    paymentId: null,
    notes: 'Waiting for workshop publication'
  }
} as const

// Token mock data
export const mockTokens = {
  validAccess: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJwYXJ0aWNpcGFudC11c2VyLWlkIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MDQ1MjAwMDAsImV4cCI6MTcwNDUyMzYwMH0.valid-signature',
    payload: {
      userId: 'participant-user-id',
      role: 'user',
      iat: 1704520000,
      exp: 1704523600
    }
  },

  validRefresh: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJwYXJ0aWNpcGFudC11c2VyLWlkIiwidG9rZW5UeXBlIjoicmVmcmVzaCIsImlhdCI6MTcwNDUyMDAwMCwiZXhwIjoxNzA0NjA2NDAwfQ.valid-refresh-signature',
    payload: {
      userId: 'participant-user-id',
      tokenType: 'refresh',
      iat: 1704520000,
      exp: 1704606400
    }
  },

  expired: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJwYXJ0aWNpcGFudC11c2VyLWlkIiwicm9sZSI6InVzZXIiLCJpYXQiOjE2ODMwMDAwMDAsImV4cCI6MTY4MzAwMzYwMH0.expired-signature',
    payload: {
      userId: 'participant-user-id',
      role: 'user',
      iat: 1683000000,
      exp: 1683003600
    }
  }
} as const

// API response mock data
export const mockApiResponses = {
  success: {
    success: true,
    data: {},
    message: 'Operation completed successfully'
  },

  error: {
    success: false,
    error: {
      code: 'ERROR_CODE',
      message: 'An error occurred',
      details: null
    }
  },

  validation: {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: {
        fields: [
          {
            field: 'email',
            message: 'Invalid email format'
          }
        ]
      }
    }
  },

  pagination: {
    success: true,
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 100,
      totalPages: 5,
      hasNext: true,
      hasPrev: false
    }
  }
} as const

// Data factory functions
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  ...mockUsers.participant,
  ...overrides
})

export const createMockWorkshop = (overrides: Partial<Workshop> = {}): Workshop => ({
  ...mockWorkshops.draft,
  ...overrides
})

export const createMockQuestionnaire = (overrides: Partial<Questionnaire> = {}): Questionnaire => ({
  ...mockQuestionnaires.enrollment,
  ...overrides
})

export const createMockResponse = (overrides: Partial<Response> = {}): Response => ({
  ...mockResponses.enrollment,
  ...overrides
})

// Helper functions for generating test data
export const generateMockUsers = (count: number, baseUser: Partial<User> = {}): User[] => {
  return Array.from({ length: count }, (_, index) => ({
    ...mockUsers.participant,
    id: `user-${index}`,
    email: `user${index}@example.com`,
    username: `user${index}`,
    firstName: `User${index}`,
    lastName: 'Test',
    ...baseUser
  }))
}

export const generateMockWorkshops = (count: number, baseWorkshop: Partial<Workshop> = {}): Workshop[] => {
  return Array.from({ length: count }, (_, index) => ({
    ...mockWorkshops.draft,
    id: `workshop-${index}`,
    title: `Test Workshop ${index}`,
    slug: `test-workshop-${index}`,
    ...baseWorkshop
  }))
}

// Type definitions
interface MockDataFactory {
  user: (overrides?: Partial<User>) => User
  workshop: (overrides?: Partial<Workshop>) => Workshop
  questionnaire: (overrides?: Partial<Questionnaire>) => Questionnaire
  response: (overrides?: Partial<Response>) => Response
}

export const mockDataFactory: MockDataFactory = {
  user: createMockUser,
  workshop: createMockWorkshop,
  questionnaire: createMockQuestionnaire,
  response: createMockResponse
}

// Export all mock data
export {
  mockUsers,
  mockWorkshops,
  mockQuestionnaires,
  mockResponses,
  mockEnrollments,
  mockTokens,
  mockApiResponses
}