/**
 * Test Data Fixtures
 * Predefined test data for various scenarios
 */

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workshop {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  maxParticipants: number;
  currentParticipants: number;
  startDate: string;
  endDate: string;
  location?: string;
  isOnline: boolean;
  price: number;
  currency: string;
  tags: string[];
  requirements: string[];
  learningObjectives: string[];
  agenda: AgendaItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaItem {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  startTime: string;
  type: 'presentation' | 'activity' | 'break' | 'discussion' | 'assessment';
}

export interface Questionnaire {
  id: string;
  title: string;
  description: string;
  workshopId?: string;
  isTemplate: boolean;
  questions: Question[];
  settings: QuestionnaireSettings;
  responses: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'url' | 'date' | 'time' |
        'choice' | 'multiple-choice' | 'rating' | 'slider' | 'file' | 'image';
  title: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  options?: QuestionOption[];
  validation?: QuestionValidation;
  conditionalLogic?: ConditionalLogic;
}

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  order: number;
}

export interface QuestionValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
}

export interface ConditionalLogic {
  showWhen: {
    questionId: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
    value: any;
  }[];
}

export interface QuestionnaireSettings {
  allowAnonymous: boolean;
  collectEmail: boolean;
  showProgress: boolean;
  allowSave: boolean;
  timeLimit?: number;
  shuffleQuestions: boolean;
  showResults: boolean;
  sendConfirmation: boolean;
}

export interface Response {
  id: string;
  questionnaireId: string;
  userId?: string;
  answers: Answer[];
  submittedAt: string;
  completedAt?: string;
  isAnonymous: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface Answer {
  questionId: string;
  value: any;
  type: string;
  order: number;
}

// Test Users
export const testUsers: User[] = [
  {
    id: 'user-1',
    email: 'admin@test.com',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    bio: 'System administrator',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'user-2',
    email: 'moderator@test.com',
    username: 'moderator',
    firstName: 'Moderator',
    lastName: 'User',
    role: 'moderator',
    bio: 'Content moderator',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z'
  },
  {
    id: 'user-3',
    email: 'user@test.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    bio: 'Regular test user',
    location: 'New York, USA',
    website: 'https://example.com',
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z'
  },
  {
    id: 'user-4',
    email: 'instructor@test.com',
    username: 'instructor',
    firstName: 'Instructor',
    lastName: 'User',
    role: 'user',
    bio: 'Workshop instructor',
    createdAt: '2024-01-04T00:00:00.000Z',
    updatedAt: '2024-01-04T00:00:00.000Z'
  }
];

// Test Workshops
export const testWorkshops: Workshop[] = [
  {
    id: 'workshop-1',
    title: 'Introduction to Web Development',
    description: 'Learn the basics of HTML, CSS, and JavaScript',
    slug: 'intro-web-dev',
    status: 'published',
    maxParticipants: 30,
    currentParticipants: 15,
    startDate: '2024-02-01T09:00:00.000Z',
    endDate: '2024-02-01T17:00:00.000Z',
    isOnline: true,
    price: 99.99,
    currency: 'USD',
    tags: ['web', 'development', 'javascript', 'html', 'css'],
    requirements: ['Basic computer skills', 'Text editor installed'],
    learningObjectives: [
      'Understand HTML structure',
      'Style with CSS',
      'Add interactivity with JavaScript',
      'Build a simple website'
    ],
    agenda: [
      {
        id: 'agenda-1',
        title: 'Introduction and Setup',
        description: 'Workshop overview and environment setup',
        duration: 60,
        startTime: '09:00',
        type: 'presentation'
      },
      {
        id: 'agenda-2',
        title: 'HTML Fundamentals',
        description: 'Learn HTML tags and structure',
        duration: 120,
        startTime: '10:00',
        type: 'presentation'
      },
      {
        id: 'agenda-3',
        title: 'Lunch Break',
        description: 'Break for lunch',
        duration: 60,
        startTime: '12:00',
        type: 'break'
      },
      {
        id: 'agenda-4',
        title: 'CSS Styling',
        description: 'Style your HTML with CSS',
        duration: 120,
        startTime: '13:00',
        type: 'presentation'
      },
      {
        id: 'agenda-5',
        title: 'JavaScript Basics',
        description: 'Add interactivity with JavaScript',
        duration: 120,
        startTime: '15:00',
        type: 'presentation'
      },
      {
        id: 'agenda-6',
        title: 'Project Workshop',
        description: 'Build your first website',
        duration: 90,
        startTime: '17:00',
        type: 'activity'
      }
    ],
    createdBy: 'user-4',
    createdAt: '2024-01-05T00:00:00.000Z',
    updatedAt: '2024-01-05T00:00:00.000Z'
  },
  {
    id: 'workshop-2',
    title: 'Advanced React Patterns',
    description: 'Master advanced React patterns and best practices',
    slug: 'advanced-react-patterns',
    status: 'draft',
    maxParticipants: 20,
    currentParticipants: 0,
    startDate: '2024-03-01T10:00:00.000Z',
    endDate: '2024-03-01T18:00:00.000Z',
    location: 'San Francisco, CA',
    isOnline: false,
    price: 299.99,
    currency: 'USD',
    tags: ['react', 'javascript', 'frontend', 'advanced'],
    requirements: [
      'Strong JavaScript knowledge',
      'React experience required',
      'Node.js installed'
    ],
    learningObjectives: [
      'Master React Hooks',
      'Implement custom hooks',
      'Understand React patterns',
      'Optimize React applications'
    ],
    agenda: [
      {
        id: 'agenda-7',
        title: 'React Hooks Deep Dive',
        description: 'Advanced hook patterns',
        duration: 180,
        startTime: '10:00',
        type: 'presentation'
      },
      {
        id: 'agenda-8',
        title: 'Custom Hooks Workshop',
        description: 'Build custom hooks',
        duration: 120,
        startTime: '13:00',
        type: 'activity'
      },
      {
        id: 'agenda-9',
        title: 'Performance Optimization',
        description: 'React performance tips',
        duration: 120,
        startTime: '15:00',
        type: 'presentation'
      }
    ],
    createdBy: 'user-4',
    createdAt: '2024-01-06T00:00:00.000Z',
    updatedAt: '2024-01-06T00:00:00.000Z'
  }
];

// Test Questionnaires
export const testQuestionnaires: Questionnaire[] = [
  {
    id: 'questionnaire-1',
    title: 'Workshop Feedback Survey',
    description: 'Please provide feedback about the workshop',
    workshopId: 'workshop-1',
    isTemplate: false,
    questions: [
      {
        id: 'q1',
        type: 'rating',
        title: 'How would you rate the overall workshop experience?',
        required: true,
        validation: { min: 1, max: 5 }
      },
      {
        id: 'q2',
        type: 'choice',
        title: 'Which topics did you find most valuable?',
        required: true,
        options: [
          { id: 'opt1', label: 'HTML Fundamentals', value: 'html', order: 1 },
          { id: 'opt2', label: 'CSS Styling', value: 'css', order: 2 },
          { id: 'opt3', label: 'JavaScript Basics', value: 'js', order: 3 },
          { id: 'opt4', label: 'Project Workshop', value: 'project', order: 4 }
        ]
      },
      {
        id: 'q3',
        type: 'textarea',
        title: 'What would you like to see improved?',
        required: false,
        validation: { maxLength: 1000 }
      },
      {
        id: 'q4',
        type: 'choice',
        title: 'Would you recommend this workshop to others?',
        required: true,
        options: [
          { id: 'opt5', label: 'Yes', value: 'yes', order: 1 },
          { id: 'opt6', label: 'No', value: 'no', order: 2 },
          { id: 'opt7', label: 'Maybe', value: 'maybe', order: 3 }
        ]
      }
    ],
    settings: {
      allowAnonymous: false,
      collectEmail: true,
      showProgress: true,
      allowSave: true,
      showResults: false,
      sendConfirmation: true
    },
    responses: 12,
    createdBy: 'user-1',
    createdAt: '2024-01-07T00:00:00.000Z',
    updatedAt: '2024-01-07T00:00:00.000Z'
  },
  {
    id: 'questionnaire-2',
    title: 'Pre-Workshop Assessment',
    description: 'Assessment to gauge participant skill level',
    isTemplate: true,
    questions: [
      {
        id: 'q5',
        type: 'multiple-choice',
        title: 'Which programming languages do you know? (Select all that apply)',
        required: true,
        options: [
          { id: 'opt8', label: 'JavaScript', value: 'javascript', order: 1 },
          { id: 'opt9', label: 'Python', value: 'python', order: 2 },
          { id: 'opt10', label: 'Java', value: 'java', order: 3 },
          { id: 'opt11', label: 'C++', value: 'cpp', order: 4 },
          { id: 'opt12', label: 'Other', value: 'other', order: 5 }
        ]
      },
      {
        id: 'q6',
        type: 'number',
        title: 'How many years of programming experience do you have?',
        required: true,
        validation: { min: 0, max: 50 }
      },
      {
        id: 'q7',
        type: 'choice',
        title: 'What is your experience level with web development?',
        required: true,
        options: [
          { id: 'opt13', label: 'Beginner', value: 'beginner', order: 1 },
          { id: 'opt14', label: 'Intermediate', value: 'intermediate', order: 2 },
          { id: 'opt15', label: 'Advanced', value: 'advanced', order: 3 },
          { id: 'opt16', label: 'Expert', value: 'expert', order: 4 }
        ]
      }
    ],
    settings: {
      allowAnonymous: true,
      collectEmail: false,
      showProgress: true,
      allowSave: false,
      showResults: false,
      sendConfirmation: false
    },
    responses: 0,
    createdBy: 'user-4',
    createdAt: '2024-01-08T00:00:00.000Z',
    updatedAt: '2024-01-08T00:00:00.000Z'
  }
];

// Test Responses
export const testResponses: Response[] = [
  {
    id: 'response-1',
    questionnaireId: 'questionnaire-1',
    userId: 'user-3',
    answers: [
      { questionId: 'q1', value: 5, type: 'rating', order: 1 },
      { questionId: 'q2', value: ['html', 'css'], type: 'choice', order: 2 },
      { questionId: 'q3', value: 'Everything was great, maybe add more hands-on exercises', type: 'textarea', order: 3 },
      { questionId: 'q4', value: 'yes', type: 'choice', order: 4 }
    ],
    submittedAt: '2024-01-10T15:30:00.000Z',
    completedAt: '2024-01-10T15:35:00.000Z',
    isAnonymous: false,
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  {
    id: 'response-2',
    questionnaireId: 'questionnaire-2',
    answers: [
      { questionId: 'q5', value: ['javascript', 'python'], type: 'multiple-choice', order: 1 },
      { questionId: 'q6', value: 3, type: 'number', order: 2 },
      { questionId: 'q7', value: 'intermediate', type: 'choice', order: 3 }
    ],
    submittedAt: '2024-01-09T10:15:00.000Z',
    completedAt: '2024-01-09T10:20:00.000Z',
    isAnonymous: true,
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
];

// Utility functions to create test data
export const createTestUser = (overrides: Partial<User> = {}): User => ({
  id: `user-${Date.now()}`,
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createTestWorkshop = (overrides: Partial<Workshop> = {}): Workshop => ({
  id: `workshop-${Date.now()}`,
  title: 'Test Workshop',
  description: 'A test workshop',
  slug: 'test-workshop',
  status: 'draft',
  maxParticipants: 20,
  currentParticipants: 0,
  startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
  endDate: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
  isOnline: true,
  price: 0,
  currency: 'USD',
  tags: [],
  requirements: [],
  learningObjectives: [],
  agenda: [],
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createTestQuestionnaire = (overrides: Partial<Questionnaire> = {}): Questionnaire => ({
  id: `questionnaire-${Date.now()}`,
  title: 'Test Questionnaire',
  description: 'A test questionnaire',
  isTemplate: false,
  questions: [],
  settings: {
    allowAnonymous: false,
    collectEmail: true,
    showProgress: true,
    allowSave: true,
    showResults: false,
    sendConfirmation: true
  },
  responses: 0,
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createTestResponse = (questionnaireId: string, overrides: Partial<Response> = {}): Response => ({
  id: `response-${Date.now()}`,
  questionnaireId,
  answers: [],
  submittedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  isAnonymous: false,
  ...overrides
});