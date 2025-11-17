# WorkshopsAI CMS - Development Guidelines & Best Practices

**Version**: 1.0.0 | **Last Updated**: November 2025 | **Tech Stack**: LitElement 3 + TypeScript + Node.js

---

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Component Development](#component-development)
- [API Development](#api-development)
- [Testing Guidelines](#testing-guidelines)
- [Git Workflow](#git-workflow)
- [Code Review Process](#code-review-process)
- [Performance Guidelines](#performance-guidelines)
- [Accessibility Guidelines](#accessibility-guidelines)
- [Internationalization](#internationalization)
- [Debugging & Troubleshooting](#debugging--troubleshooting)

---

## 🚀 Development Setup

### Prerequisites
- **Node.js**: >= 20.0.0
- **npm**: >= 8.0.0
- **PostgreSQL**: >= 15.0
- **Redis**: >= 7.0
- **Git**: Latest version

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd workshopsAI_cms

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run db:generate
npm run db:migrate

# Start development servers
npm run dev                    # Backend (port 3001)
cd frontend && npm run dev     # Frontend (port 3000)
```

### Environment Configuration
```bash
# Required environment variables
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/workshopsai_cms
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secure-jwt-secret
CORS_ORIGIN=http://localhost:3000

# Optional but recommended
LOG_LEVEL=debug
ENABLE_METRICS=true
ENABLE_PROFILING=true
```

### Development Tools Setup
```bash
# Install VS Code extensions
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension bradlc.vscode-tailwindcss

# Setup Git hooks
npm run setup:hooks

# Install Playwright browsers
npx playwright install --with-deps
```

---

## 📝 Coding Standards

### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  },
  "include": ["src/**/*", "frontend/src/**/*"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

### ESLint Configuration
```json
// .eslintrc.json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:security/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "security/detect-object-injection": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Prettier Configuration
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### Naming Conventions

#### Files and Directories
```
# Use kebab-case for files
user-service.ts
workshop-editor.ts
questionnaire-manager.ts

# Use descriptive names
user-authentication.service.ts  // Good
auth.ts                         // Bad (too generic)
```

#### Components
```typescript
// Use PascalCase for component classes
@customElement('user-profile')
export class UserProfile extends LitElement {
  // Use camelCase for properties
  @property({ type: String }) userName = '';

  // Use camelCase for methods
  private handleUserClick() {
    // Implementation
  }
}

// Use kebab-case for custom element names
<user-profile></user-profile>
<workshop-editor></workshop-editor>
<questionnaire-manager></questionnaire-manager>
```

#### Variables and Functions
```typescript
// Use camelCase for variables and functions
const userName = 'John Doe';
const isUserAuthenticated = true;

function createWorkshop(data: WorkshopData) {
  // Implementation
}

async function getUserById(id: string): Promise<User> {
  // Implementation
}
```

#### Constants
```typescript
// Use UPPER_SNAKE_CASE for constants
const API_BASE_URL = 'http://localhost:3001/api/v1';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_PAGE_SIZE = 20;

// Group related constants
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const;
```

---

## 🧩 Component Development

### LitElement Component Structure
```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators';

/**
 * Component description
 * @element component-name
 */
@customElement('component-name')
export class ComponentName extends LitElement {
  // Static styles
  static styles = css`
    :host {
      display: block;
    }

    .container {
      padding: 1rem;
      border-radius: 0.5rem;
      background-color: var(--color-background);
    }

    .title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    /* Use CSS custom properties for theming */
    .primary-button {
      background-color: var(--color-primary);
      color: var(--color-on-primary);
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      cursor: pointer;
    }

    .primary-button:hover {
      background-color: var(--color-primary-hover);
    }

    /* Focus states for accessibility */
    .primary-button:focus {
      outline: 2px solid var(--color-primary-focus);
      outline-offset: 2px;
    }
  `;

  // Properties (can be set from outside)
  @property({ type: String, reflect: true }) title = '';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Array }) items: Item[] = [];

  // Private state (internal to component)
  @state() private isLoading = false;
  @state() private error?: string;

  // Lifecycle hooks
  connectedCallback() {
    super.connectedCallback();
    // Setup subscriptions, event listeners, etc.
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Cleanup subscriptions, event listeners, etc.
  }

  // Event handlers
  private async handleButtonClick() {
    if (this.disabled || this.isLoading) return;

    this.isLoading = true;
    this.error = undefined;

    try {
      await this.performAction();
      this.dispatchEvent(new CustomEvent('action-completed', {
        detail: { success: true }
      }));
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Unknown error';
      this.dispatchEvent(new CustomEvent('action-completed', {
        detail: { success: false, error: this.error }
      }));
    } finally {
      this.isLoading = false;
    }
  }

  // Private methods
  private async performAction(): Promise<void> {
    // Implementation
  }

  // Template
  render() {
    return html`
      <div class="container">
        <h2 class="title">${this.title}</h2>

        ${this.error ? html`
          <div class="error" role="alert">
            ${this.error}
          </div>
        ` : ''}

        <button
          class="primary-button"
          ?disabled=${this.disabled || this.isLoading}
          @click=${this.handleButtonClick}
          aria-busy=${this.isLoading}
        >
          ${this.isLoading ? 'Loading...' : 'Action'}
        </button>

        ${this.items.length > 0 ? html`
          <ul class="items-list">
            ${this.items.map(item => html`
              <li>
                ${item.name}
              </li>
            `)}
          </ul>
        ` : html`
          <p class="empty-state">No items available</p>
        `}
      </div>
    `;
  }
}

// Type definitions
interface Item {
  id: string;
  name: string;
}
```

### Component Best Practices

#### Performance
```typescript
// Use memoization for expensive computations
import { memoize } from 'lodash-es';

const expensiveComputation = memoize((data: ComplexData) => {
  return data.reduce((acc, item) => acc + item.value, 0);
});

// Lazy load heavy components
import { until } from 'lit/directives/until.js';

render() {
  return html`
    <div>
      ${until(
        this.loadHeavyComponent(),
        html`<div>Loading...</div>`
      )}
    </div>
  `;
}

// Use virtual scrolling for large lists
import { VirtualList } from './virtual-list.js';

render() {
  return html`
    <virtual-list
      .items=${this.largeItemList}
      .itemHeight=${48}
      .renderItem=${this.renderListItem}
    ></virtual-list>
  `;
}
```

#### Accessibility
```typescript
// ARIA attributes and semantic HTML
render() {
  return html`
    <!-- Use proper semantic elements -->
    <main role="main">
      <section aria-labelledby="workshop-title">
        <h2 id="workshop-title">${this.workshop.title}</h2>

        <!-- Form accessibility -->
        <form @submit=${this.handleSubmit} aria-label="Workshop form">
          <label for="workshop-title-input">Title</label>
          <input
            id="workshop-title-input"
            type="text"
            .value=${this.workshop.title}
            @input=${this.handleTitleChange}
            aria-describedby="title-help"
            aria-invalid=${this.errors.title ? 'true' : 'false'}
            aria-required="true"
          >
          <div id="title-help" class="help-text">
            Enter a descriptive title for your workshop
          </div>
          ${this.errors.title ? html`
            <div class="error" role="alert">
              ${this.errors.title}
            </div>
          ` : ''}
        </form>
      </section>
    </main>
  `;
}

// Keyboard navigation
private handleKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Enter':
    case ' ':
      this.activateItem();
      event.preventDefault();
      break;
    case 'Escape':
      this.closeModal();
      break;
    case 'ArrowDown':
      this.focusNextItem();
      event.preventDefault();
      break;
    case 'ArrowUp':
      this.focusPreviousItem();
      event.preventDefault();
      break;
  }
}
```

#### State Management
```typescript
// Use reactive properties for component state
@property({ type: Object, attribute: false })
private userState: UserState = {
  currentUser: null,
  isLoading: false,
  error: null
};

// Use state for internal component state
@state() private selectedTab = 'overview';
@state() private isExpanded = false;

// Implement proper state updates
private async loadUser() {
  this.userState = { ...this.userState, isLoading: true, error: null };

  try {
    const user = await this.userService.getCurrentUser();
    this.userState = { ...this.userState, currentUser: user, isLoading: false };
  } catch (error) {
    this.userState = { ...this.userState, error, isLoading: false };
  }
}
```

---

## 🔌 API Development

### Controller Structure
```typescript
// src/controllers/workshopController.ts
import { Request, Response, NextFunction } from 'express';
import { WorkshopService } from '../services/workshopService';
import { validateRequest } from '../middleware/validation';
import { createWorkshopSchema, updateWorkshopSchema } from '../types/validation';

export class WorkshopController {
  constructor(private workshopService: WorkshopService) {}

  async getWorkshops(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, limit = 20, status, search } = req.query;

      const result = await this.workshopService.getWorkshops({
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        search: search as string,
        userId: req.user!.id
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async createWorkshop(req: Request, res: Response, next: NextFunction) {
    try {
      const workshopData = {
        ...req.body,
        createdBy: req.user!.id
      };

      const workshop = await this.workshopService.createWorkshop(workshopData);

      res.status(201).json({
        success: true,
        data: { workshop }
      });
    } catch (error) {
      next(error);
    }
  }
}

// Route setup
router.get('/workshops', authenticate, workshopController.getWorkshops.bind(workshopController));
router.post('/workshops',
  authenticate,
  requireRole(UserRole.SOCIOLOGIST_EDITOR),
  validateRequest(createWorkshopSchema),
  workshopController.createWorkshop.bind(workshopController)
);
```

### Service Layer Pattern
```typescript
// src/services/workshopService.ts
import { db } from '../config/database';
import { workshops, users } from '../models/schema';
import { eq, and, like, desc } from 'drizzle-orm';

export interface GetWorkshopsOptions {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  userId?: string;
}

export interface WorkshopResult {
  workshops: Workshop[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class WorkshopService {
  async getWorkshops(options: GetWorkshopsOptions): Promise<WorkshopResult> {
    const { page, limit, status, search, userId } = options;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(workshops.status, status));
    }

    if (search) {
      conditions.push(
        like(workshops.title, `%${search}%`)
      );
    }

    if (userId) {
      conditions.push(eq(workshops.createdBy, userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Execute queries in parallel
    const [workshopsResult, totalCount] = await Promise.all([
      db
        .select({
          id: workshops.id,
          title: workshops.title,
          description: workshops.description,
          status: workshops.status,
          startDate: workshops.startDate,
          endDate: workshops.endDate,
          seatLimit: workshops.seatLimit,
          enrolledCount: workshops.enrolledCount,
          facilitator: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName
          },
          createdAt: workshops.createdAt,
          updatedAt: workshops.updatedAt
        })
        .from(workshops)
        .leftJoin(users, eq(workshops.facilitatorId, users.id))
        .where(whereClause)
        .orderBy(desc(workshops.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: workshops.id })
        .from(workshops)
        .where(whereClause)
    ]);

    const total = totalCount[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      workshops: workshopsResult,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  async createWorkshop(data: CreateWorkshopData): Promise<Workshop> {
    const [workshop] = await db
      .insert(workshops)
      .values({
        ...data,
        id: generateUUID(),
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return workshop;
  }
}
```

### Validation Schemas
```typescript
// src/types/validation.ts
import { z } from 'zod';

export const createWorkshopSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .trim(),

  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .trim(),

  startDate: z.string()
    .datetime('Invalid start date format')
    .refine((date) => new Date(date) > new Date(), {
      message: 'Start date must be in the future'
    }),

  endDate: z.string()
    .datetime('Invalid end date format'),

  seatLimit: z.number()
    .int('Seat limit must be an integer')
    .min(1, 'Seat limit must be at least 1')
    .max(1000, 'Seat limit cannot exceed 1000'),

  facilitatorId: z.string()
    .uuid('Invalid facilitator ID'),

  templateTheme: z.enum(['integration', 'conflicts', 'well-being'], {
    errorMap: () => ({ message: 'Template theme must be integration, conflicts, or well-being' })
  }),

  language: z.enum(['pl', 'en']).default('pl'),

  tags: z.array(z.string().max(50)).max(10, 'Maximum 10 tags allowed').optional()
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate']
});

export const updateWorkshopSchema = createWorkshopSchema.partial();
export const queryWorkshopSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().max(100).optional(),
  facilitatorId: z.string().uuid().optional()
});
```

### Error Handling
```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any[];
}

export function errorHandler(
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip
  });

  // Determine status code
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Build error response
  const errorResponse = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: isProduction ? 'Internal server error' : error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    }
  };

  // Include stack trace in development
  if (!isProduction && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public details: any[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}
```

---

## 🧪 Testing Guidelines

### Unit Testing
```typescript
// tests/unit/services/workshopService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkshopService } from '../../../src/services/workshopService';
import { db } from '../../../src/config/database';

// Mock database
vi.mock('../../../src/config/database');

describe('WorkshopService', () => {
  let workshopService: WorkshopService;

  beforeEach(() => {
    workshopService = new WorkshopService();
    vi.clearAllMocks();
  });

  describe('getWorkshops', () => {
    it('should return workshops with pagination', async () => {
      // Arrange
      const mockWorkshops = [
        {
          id: '1',
          title: 'Test Workshop',
          description: 'A test workshop',
          status: 'published',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockCount = [{ count: 1 }];

      vi.mocked(db.select).mockReturnValueOnce({
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockWorkshops)
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount)
      } as any);

      // Act
      const result = await workshopService.getWorkshops({
        page: 1,
        limit: 20
      });

      // Assert
      expect(result.workshops).toEqual(mockWorkshops);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      });
    });

    it('should filter workshops by status', async () => {
      // Arrange
      const options = {
        page: 1,
        limit: 20,
        status: 'published'
      };

      // Act
      await workshopService.getWorkshops(options);

      // Assert
      expect(db.select).toHaveBeenCalledTimes(2);
      // Verify that the where clause includes status filter
    });
  });

  describe('createWorkshop', () => {
    it('should create workshop with valid data', async () => {
      // Arrange
      const workshopData = {
        title: 'New Workshop',
        description: 'A new workshop',
        startDate: '2025-12-01T09:00:00Z',
        endDate: '2025-12-01T17:00:00Z',
        seatLimit: 20,
        facilitatorId: 'facilitator-uuid',
        templateTheme: 'integration' as const,
        createdBy: 'user-uuid'
      };

      const mockCreatedWorkshop = {
        id: 'workshop-uuid',
        ...workshopData,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedWorkshop])
      } as any);

      // Act
      const result = await workshopService.createWorkshop(workshopData);

      // Assert
      expect(result).toEqual(mockCreatedWorkshop);
      expect(db.insert).toHaveBeenCalledWith(expect.any(Object));
    });
  });
});
```

### Component Testing
```typescript
// tests/unit/components/workshop-editor.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { WorkshopEditor } from '../../../src/components/workshop/WorkshopEditor';

describe('WorkshopEditor', () => {
  let element: WorkshopEditor;

  beforeEach(async () => {
    element = await fixture(html`<workshop-editor></workshop-editor>`);
  });

  it('renders correctly', () => {
    expect(element).toBeInstanceOf(WorkshopEditor);
    expect(element.shadowRoot).not.toBeNull();
  });

  it('displays workshop title when provided', async () => {
    element.title = 'Test Workshop';
    await element.updateComplete;

    const titleElement = element.shadowRoot!.querySelector('.workshop-title');
    expect(titleElement?.textContent).toContain('Test Workshop');
  });

  it('emits save event when form is submitted', async () => {
    const spy = vi.fn();
    element.addEventListener('workshop-save', spy);

    // Fill form
    element.title = 'Test Workshop';
    element.description = 'Test Description';
    await element.updateComplete;

    // Submit form
    const form = element.shadowRoot!.querySelector('form');
    form?.dispatchEvent(new Event('submit'));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          title: 'Test Workshop',
          description: 'Test Description'
        })
      })
    );
  });

  it('validates required fields', async () => {
    const form = element.shadowRoot!.querySelector('form');
    form?.dispatchEvent(new Event('submit'));

    await element.updateComplete;

    const errorMessages = element.shadowRoot!.querySelectorAll('.error-message');
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  it('shows loading state during save', async () => {
    // Mock save function to be async
    element.saveWorkshop = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 100))
    );

    const form = element.shadowRoot!.querySelector('form');
    form?.dispatchEvent(new Event('submit'));

    await element.updateComplete;

    const saveButton = element.shadowRoot!.querySelector('button[type="submit"]');
    expect(saveButton?.hasAttribute('disabled')).toBe(true);
    expect(saveButton?.textContent).toContain('Saving...');
  });
});
```

### Integration Testing
```typescript
// tests/integration/workshop-api.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';

describe('Workshop API Integration', () => {
  let authToken: string;

  beforeEach(async () => {
    await setupTestDatabase();

    // Create test user and get auth token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      });

    authToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/v1/workshops', () => {
    it('should return paginated workshops', async () => {
      const response = await request(app)
        .get('/api/v1/workshops?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workshops).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter workshops by status', async () => {
      const response = await request(app)
        .get('/api/v1/workshops?status=published')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.workshops.forEach((workshop: any) => {
        expect(workshop.status).toBe('published');
      });
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/v1/workshops')
        .expect(401);
    });
  });

  describe('POST /api/v1/workshops', () => {
    it('should create new workshop with valid data', async () => {
      const workshopData = {
        title: 'Test Workshop',
        description: 'A test workshop for integration testing',
        startDate: '2025-12-01T09:00:00Z',
        endDate: '2025-12-01T17:00:00Z',
        seatLimit: 20,
        facilitatorId: 'test-facilitator-id',
        templateTheme: 'integration'
      };

      const response = await request(app)
        .post('/api/v1/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workshopData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workshop.title).toBe(workshopData.title);
      expect(response.body.data.workshop.status).toBe('draft');
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        title: 'A', // Too short
        description: 'Short', // Too short
        seatLimit: -1 // Invalid
      };

      const response = await request(app)
        .post('/api/v1/workshops')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

### E2E Testing
```typescript
// tests/e2e/workshop-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Workshop Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'sociologist@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Wait for dashboard
    await page.waitForURL('/dashboard');
  });

  test('should create new workshop', async ({ page }) => {
    // Navigate to workshop creation
    await page.click('[data-testid="create-workshop-button"]');
    await page.waitForURL('/dashboard/workshops/new');

    // Fill workshop form
    await page.fill('[data-testid="workshop-title"]', 'Test Workshop');
    await page.fill('[data-testid="workshop-description"]', 'A test workshop for E2E testing');
    await page.selectOption('[data-testid="template-theme"]', 'integration');
    await page.fill('[data-testid="seat-limit"]', '20');

    // Set dates
    await page.fill('[data-testid="start-date"]', '2025-12-01T09:00');
    await page.fill('[data-testid="end-date"]', '2025-12-01T17:00');

    // Save workshop
    await page.click('[data-testid="save-workshop-button"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('text=Workshop created successfully')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/dashboard/workshops/new');

    // Try to save without filling required fields
    await page.click('[data-testid="save-workshop-button"]');

    // Verify validation errors
    await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="description-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="date-error"]')).toBeVisible();
  });

  test('should filter workshops list', async ({ page }) => {
    await page.goto('/dashboard/workshops');

    // Test status filter
    await page.selectOption('[data-testid="status-filter"]', 'published');
    await page.waitForTimeout(1000); // Wait for debounce

    // Verify filtered results
    const workshops = await page.locator('[data-testid="workshop-item"]');
    for (let i = 0; i < await workshops.count(); i++) {
      const workshop = workshops.nth(i);
      await expect(workshop.locator('[data-testid="workshop-status"]')).toHaveText('published');
    }

    // Test search filter
    await page.fill('[data-testid="search-input"]', 'integration');
    await page.waitForTimeout(1000); // Wait for debounce

    // Verify search results contain search term
    const searchResults = await page.locator('[data-testid="workshop-title"]');
    for (let i = 0; i < await searchResults.count(); i++) {
      const title = await searchResults.nth(i).textContent();
      expect(title?.toLowerCase()).toContain('integration');
    }
  });
});
```

---

## 🌿 Git Workflow

### Branch Naming Conventions
```bash
# Feature branches
feature/workshop-editor-redesign
feature/questionnaire-validation
feature/user-authentication

# Bug fix branches
fix/authentication-token-mismatch
fix/dashboard-data-loading
fix/workshop-creation-validation

# Hotfix branches
hotfix/security-vulnerability-patch
hotfix/critical-bug-fix

# Release branches
release/v1.0.0
release/v1.1.0

# Hotfix branches
hotfix/critical-security-fix
hotfix/data-corruption-issue

# Documentation branches
docs/api-documentation-update
docs/development-guide
```

### Commit Message Format
```bash
# Format: <type>(<scope>): <subject>

# Types
feat:     New feature
fix:      Bug fix
docs:     Documentation change
style:    Formatting, missing semicolons, etc.
refactor: Code change that neither fixes a bug nor adds a feature
perf:     Performance improvement
test:     Adding or refactoring tests
chore:    Build process, dependency management, etc.

# Examples
feat(workshop): add drag-and-drop workshop builder
fix(auth): resolve token mismatch in API calls
docs(readme): update installation instructions
refactor(dashboard): extract components to separate files
perf(api): optimize database queries with proper indexing
test(auth): add comprehensive authentication test suite
chore(deps): update dependencies to latest versions
```

### Git Hooks Setup
```bash
#!/bin/sh
# .husky/pre-commit

# Run linting
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed. Please fix linting errors before committing."
  exit 1
fi

# Run type checking
npm run typecheck
if [ $? -ne 0 ]; then
  echo "❌ Type checking failed. Please fix TypeScript errors before committing."
  exit 1
fi

# Run unit tests
npm run test:unit
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed. Please fix failing tests before committing."
  exit 1
fi

echo "✅ All pre-commit checks passed!"
```

---

## 👀 Code Review Process

### Pull Request Template
```markdown
## Description
Brief description of changes made in this PR.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed
- [ ] Accessibility testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated if necessary
- [ ] No console.log statements left in code
- [ ] No hardcoded secrets or credentials
- [ ] Performance considerations addressed
- [ ] Security implications considered

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Context
Add any other context about the problem here.
```

### Review Guidelines
```markdown
### Code Review Checklist

#### Functionality
- [ ] Code implements the requirements correctly
- [ ] Edge cases are handled appropriately
- [ ] Error handling is comprehensive
- [ ] No obvious bugs or logic errors

#### Code Quality
- [ ] Code is readable and maintainable
- [ ] Follows established patterns and conventions
- [ ] Functions are single-purpose and well-named
- [ ] No code duplication or redundancy

#### Performance
- [ ] No performance bottlenecks introduced
- [ ] Database queries are optimized
- [ ] Memory usage is appropriate
- [ ] No unnecessary computations or API calls

#### Security
- [ ] No security vulnerabilities introduced
- [ ] Input validation is comprehensive
- [ ] Authentication and authorization are correct
- [ ] No sensitive data exposure

#### Testing
- [ ] Adequate test coverage provided
- [ ] Tests cover edge cases and error scenarios
- [ ] Test setup is clean and isolated
- [ ] Tests are maintainable and readable

#### Documentation
- [ ] Code is well-commented where necessary
- [ ] API documentation is updated
- [ ] README is updated if needed
- [ ] Commit messages are descriptive
```

---

## ⚡ Performance Guidelines

### Frontend Performance
```typescript
// Use lazy loading for heavy components
import { LitElement, html } from 'lit';
import { until } from 'lit/directives/until.js';

class WorkshopDashboard extends LitElement {
  render() {
    return html`
      <div class="dashboard">
        <!-- Lazy load heavy analytics component -->
        ${until(
          import('./analytics-chart.js').then(m =>
            html`<analytics-chart></analytics-chart>`
          ),
          html`<div class="loading">Loading analytics...</div>`
        )}

        <!-- Lazy load workshop list -->
        ${until(
          this.loadWorkshops(),
          html`<div class="loading">Loading workshops...</div>`
        )}
      </div>
    `;
  }

  private async loadWorkshops() {
    const workshops = await this.workshopService.getWorkshops();
    return html`<workshop-list .workshops=${workshops}></workshop-list>`;
  }
}

// Use virtual scrolling for large lists
class VirtualWorkshopList extends LitElement {
  @property({ type: Array }) workshops: Workshop[] = [];
  @property({ type: Number }) itemHeight = 60;
  @property({ type: Number }) visibleCount = 10;

  private get visibleWorkshops() {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = startIndex + this.visibleCount;
    return this.workshops.slice(startIndex, endIndex);
  }

  render() {
    const totalHeight = this.workshops.length * this.itemHeight;

    return html`
      <div
        class="virtual-list"
        style="height: ${totalHeight}px; position: relative;"
        @scroll=${this.handleScroll}
      >
        ${this.visibleWorkshops.map((workshop, index) => {
          const actualIndex = this.workshops.indexOf(workshop);
          const top = actualIndex * this.itemHeight;

          return html`
            <workshop-item
              style="position: absolute; top: ${top}px; height: ${this.itemHeight}px;"
              .workshop=${workshop}
            ></workshop-item>
          `;
        })}
      </div>
    `;
  }
}
```

### Backend Performance
```typescript
// Use database indexes for performance
// migrations/001_add_indexes.sql
CREATE INDEX CONCURRENTLY idx_workshops_status_created_at
ON workshops(status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_workshops_facilitator_id
ON workshops(facilitator_id);

CREATE INDEX CONCURRENTLY idx_workshops_title_gin
ON workshops USING gin(to_tsvector('english', title));

// Implement caching with Redis
import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Use caching in service layer
export class WorkshopService {
  constructor(private cache: CacheService) {}

  async getWorkshops(options: GetWorkshopsOptions): Promise<WorkshopResult> {
    const cacheKey = `workshops:${JSON.stringify(options)}`;

    // Try cache first
    const cached = await this.cache.get<WorkshopResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, fetch from database
    const result = await this.fetchWorkshopsFromDatabase(options);

    // Cache for 5 minutes
    await this.cache.set(cacheKey, result, 300);

    return result;
  }

  async createWorkshop(data: CreateWorkshopData): Promise<Workshop> {
    const workshop = await this.saveWorkshopToDatabase(data);

    // Invalidate related cache entries
    await this.cache.invalidate('workshops:*');

    return workshop;
  }
}
```

### Performance Monitoring
```typescript
// Performance monitoring middleware
import { performance } from 'perf_hooks';

export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - start;

    // Log performance metrics
    console.log({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: Math.round(duration),
      userAgent: req.get('User-Agent')
    });

    // Alert on slow requests
    if (duration > 1000) {
      console.warn(`Slow request detected: ${req.method} ${req.url} took ${duration}ms`);
    }
  });

  next();
}

// Database query performance monitoring
export class DatabaseService {
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const start = performance.now();

    try {
      const result = await this.db.query(sql, params);

      const duration = performance.now() - start;

      // Log slow queries
      if (duration > 100) {
        console.warn(`Slow database query (${duration}ms):`, sql);
      }

      return result;
    } catch (error) {
      console.error('Database query failed:', { sql, params, error });
      throw error;
    }
  }
}
```

---

## ♿ Accessibility Guidelines

### ARIA Attributes Usage
```typescript
// Use proper ARIA attributes for accessibility
render() {
  return html`
    <div class="workshop-editor" role="main">
      <header>
        <h1 id="page-title">Create Workshop</h1>
      </header>

      <form
        aria-labelledby="page-title"
        @submit=${this.handleSubmit}
      >
        <!-- Form field with proper labeling -->
        <div class="form-field">
          <label for="workshop-title">
            Workshop Title
            <span class="required" aria-label="required">*</span>
          </label>

          <input
            id="workshop-title"
            type="text"
            .value=${this.title}
            @input=${this.handleTitleChange}
            aria-describedby="title-help title-error"
            aria-required="true"
            aria-invalid=${this.errors.title ? 'true' : 'false'}
          >

          <div id="title-help" class="help-text">
            Enter a descriptive title for your workshop (3-200 characters)
          </div>

          ${this.errors.title ? html`
            <div id="title-error" class="error" role="alert">
              ${this.errors.title}
            </div>
          ` : ''}
        </div>

        <!-- Multi-select with proper ARIA -->
        <div class="form-field">
          <label id="tags-label">Workshop Tags</label>

          <div
            role="listbox"
            aria-labelledby="tags-label"
            aria-multiselectable="true"
            @keydown=${this.handleTagsKeyDown}
          >
            ${this.availableTags.map(tag => html`
              <div
                role="option"
                aria-selected=${this.selectedTags.includes(tag.id)}
                class="tag-option"
                @click=${() => this.toggleTag(tag.id)}
              >
                ${tag.name}
              </div>
            `)}
          </div>
        </div>

        <!-- Progress indicator -->
        <div
          role="progressbar"
          aria-valuenow=${this.progress}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Workshop creation progress"
        >
          <div class="progress-bar" style="width: ${this.progress}%"></div>
        </div>

        <!-- Submit button with loading state -->
        <button
          type="submit"
          ?disabled=${this.isSubmitting}
          aria-busy=${this.isSubmitting}
        >
          ${this.isSubmitting ? 'Creating Workshop...' : 'Create Workshop'}
        </button>
      </form>
    </div>
  `;
}
```

### Keyboard Navigation
```typescript
// Implement comprehensive keyboard navigation
private handleKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      // Close modal or cancel action
      this.closeModal();
      break;

    case 'Enter':
    case ' ':
      // Activate focused element
      if (event.target instanceof HTMLElement &&
          event.target.getAttribute('role') === 'option') {
        event.target.click();
        event.preventDefault();
      }
      break;

    case 'ArrowDown':
      // Navigate to next item in list
      this.focusNextItem(event.target as HTMLElement);
      event.preventDefault();
      break;

    case 'ArrowUp':
      // Navigate to previous item in list
      this.focusPreviousItem(event.target as HTMLElement);
      event.preventDefault();
      break;

    case 'Tab':
      // Handle custom tab behavior if needed
      this.handleTabNavigation(event);
      break;

    default:
      // Let browser handle other keys
      break;
  }
}

// Focus management for modals
private openModal() {
  this.isModalOpen = true;

  // Store current focus
  this.previousFocus = document.activeElement as HTMLElement;

  // Set focus to modal content
  requestAnimationFrame(() => {
    const modalContent = this.shadowRoot?.querySelector('.modal-content');
    if (modalContent instanceof HTMLElement) {
      modalContent.focus();
    }
  });

  // Trap focus within modal
  this.trapFocus();
}

private closeModal() {
  this.isModalOpen = false;

  // Restore focus to previous element
  if (this.previousFocus) {
    this.previousFocus.focus();
  }
}

private trapFocus() {
  const modalElement = this.shadowRoot?.querySelector('.modal');
  if (!modalElement) return;

  const focusableElements = modalElement.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  };

  modalElement.addEventListener('keydown', handleKeyDown);

  // Remove listener when modal closes
  this.addEventListener('modal-closed', () => {
    modalElement.removeEventListener('keydown', handleKeyDown);
  });
}
```

---

## 🌍 Internationalization

### i18n Implementation
```typescript
// src/services/i18n.ts
export type Language = 'pl' | 'en';

interface Translation {
  [key: string]: string | Translation;
}

const translations: Record<Language, Translation> = {
  pl: {
    workshop: {
      title: 'Tytuł warsztatu',
      description: 'Opis warsztatu',
      create: 'Utwórz warsztat',
      edit: 'Edytuj warsztat',
      delete: 'Usuń warsztat',
      save: 'Zapisz',
      cancel: 'Anuluj'
    },
    validation: {
      required: 'To pole jest wymagane',
      minLength: 'Minimalna długość to {{min}} znaków',
      maxLength: 'Maksymalna długość to {{max}} znaków',
      email: 'Nieprawidłowy format email',
      required_field: 'Pole {{field}} jest wymagane'
    }
  },
  en: {
    workshop: {
      title: 'Workshop Title',
      description: 'Workshop Description',
      create: 'Create Workshop',
      edit: 'Edit Workshop',
      delete: 'Delete Workshop',
      save: 'Save',
      cancel: 'Cancel'
    },
    validation: {
      required: 'This field is required',
      minLength: 'Minimum length is {{min}} characters',
      maxLength: 'Maximum length is {{max}} characters',
      email: 'Invalid email format',
      required_field: '{{field}} field is required'
    }
  }
};

export class I18nService {
  private currentLanguage: Language = 'pl';
  private translations = translations;

  setLanguage(language: Language) {
    this.currentLanguage = language;
    localStorage.setItem('language', language);
    document.documentElement.lang = language;

    // Notify components of language change
    window.dispatchEvent(new CustomEvent('language-changed', {
      detail: { language }
    }));
  }

  getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let translation = this.translations[this.currentLanguage];

    for (const k of keys) {
      translation = translation?.[k] as any;
    }

    if (typeof translation !== 'string') {
      return key; // Return key if translation not found
    }

    // Replace parameters
    if (params) {
      return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return String(params[param] || match);
      });
    }

    return translation;
  }
}

export const i18n = new I18nService();

// Initialize language from localStorage or browser
const savedLanguage = localStorage.getItem('language') as Language;
const browserLanguage = navigator.language.startsWith('pl') ? 'pl' : 'en';
i18n.setLanguage(savedLanguage || browserLanguage);
```

### Using i18n in Components
```typescript
import { i18n } from '../services/i18n';

class WorkshopForm extends LitElement {
  @state() private language = i18n.getCurrentLanguage();

  connectedCallback() {
    super.connectedCallback();

    // Listen for language changes
    window.addEventListener('language-changed', this.handleLanguageChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('language-changed', this.handleLanguageChange);
  }

  private handleLanguageChange = (event: CustomEvent) => {
    this.language = event.detail.language;
    this.requestUpdate();
  };

  translate(key: string, params?: Record<string, any>) {
    return i18n.translate(key, params);
  }

  render() {
    return html`
      <form>
        <div class="form-field">
          <label for="title">${this.translate('workshop.title')}</label>
          <input
            id="title"
            type="text"
            .value=${this.title}
            @input=${this.handleTitleChange}
            required
          >
          ${this.errors.title ? html`
            <div class="error">
              ${this.translate('validation.required')}
            </div>
          ` : ''}
        </div>

        <div class="form-field">
          <label for="description">${this.translate('workshop.description')}</label>
          <textarea
            id="description"
            .value=${this.description}
            @input=${this.handleDescriptionChange}
            minlength="10"
            maxlength="2000"
            required
          ></textarea>
          ${this.errors.description ? html`
            <div class="error">
              ${this.translate('validation.minLength', { min: 10 })}
            </div>
          ` : ''}
        </div>

        <div class="form-actions">
          <button type="submit">
            ${this.translate('workshop.save')}
          </button>
          <button type="button" @click=${this.handleCancel}>
            ${this.translate('workshop.cancel')}
          </button>
        </div>
      </form>
    `;
  }
}
```

---

## 🐛 Debugging & Troubleshooting

### Frontend Debugging
```typescript
// Debug utilities for LitElement components
export class DebugUtils {
  static logComponentState(component: LitElement, label: string = 'Component') {
    console.group(`${label} State`);
    console.log('Properties:', component.constructor.properties);
    console.log('Attributes:', Array.from(component.attributes).map(attr => ({
      name: attr.name,
      value: attr.value
    })));
    console.log('Shadow Root:', component.shadowRoot);
    console.groupEnd();
  }

  static logRender(component: LitElement, renderTime: number) {
    console.log(`Render time for ${component.constructor.name}: ${renderTime}ms`);
  }

  static trackPerformance<T>(label: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`${label}: ${end - start}ms`);
    return result;
  }
}

// Debug decorator for performance monitoring
export function debugPerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function(...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const end = performance.now();

    console.log(`${propertyKey}: ${end - start}ms`);
    return result;
  };

  return descriptor;
}

// Usage in components
class WorkshopEditor extends LitElement {
  @debugPerformance
  private async saveWorkshop() {
    // Save logic here
  }

  render() {
    return DebugUtils.trackPerformance('WorkshopEditor.render', () => {
      // Original render logic
      return html`<!-- component template -->`;
    });
  }
}
```

### Backend Debugging
```typescript
// Debug middleware for API requests
export function debugMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);

  // Add request ID to headers
  res.setHeader('X-Request-ID', requestId);

  // Log request details
  console.log(`[${requestId}] ${req.method} ${req.url}`, {
    headers: req.headers,
    body: req.body,
    query: req.query,
    user: req.user?.id
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data: any) {
    const duration = Date.now() - start;
    console.log(`[${requestId}] Response (${duration}ms):`, {
      status: res.statusCode,
      data: data
    });
    return originalJson.call(this, data);
  };

  next();
}

// Database query debugging
export class DatabaseDebugger {
  static logQuery(sql: string, params?: any[], duration?: number) {
    console.group('Database Query');
    console.log('SQL:', sql);
    console.log('Params:', params);
    if (duration) {
      console.log('Duration:', `${duration}ms`);
    }
    console.groupEnd();
  }

  static async executeWithLogging<T>(
    queryFn: () => Promise<T>,
    label: string
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await queryFn();
      const duration = Date.now() - start;

      this.logQuery(`${label} - Success`, undefined, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;

      console.error(`${label} - Error (${duration}ms):`, error);
      throw error;
    }
  }
}

// Usage in services
export class WorkshopService {
  async getWorkshops(options: GetWorkshopsOptions): Promise<WorkshopResult> {
    return DatabaseDebugger.executeWithLogging(
      () => this.fetchWorkshops(options),
      'Get Workshops'
    );
  }
}
```

### Common Issues & Solutions

#### Issue: Component Not Updating
```typescript
// Problem: Component state not updating
// Solution: Ensure properties are marked as reactive or state

@state() private internalData = []; // Use @state for internal state
@property({ type: Array }) public externalData = []; // Use @property for external data

// Manual update when needed
private forceUpdate() {
  this.requestUpdate();
}
```

#### Issue: Memory Leaks
```typescript
// Problem: Event listeners not cleaned up
// Solution: Proper cleanup in disconnectedCallback

class MyComponent extends LitElement {
  private abortController = new AbortController();

  connectedCallback() {
    super.connectedCallback();

    // Use AbortController for cleanup
    document.addEventListener('click', this.handleDocumentClick, {
      signal: this.abortController.signal
    });

    // Or store listener references
    this.boundHandleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.boundHandleResize);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Abort all listeners
    this.abortController.abort();

    // Remove specific listeners
    if (this.boundHandleResize) {
      window.removeEventListener('resize', this.boundHandleResize);
    }
  }
}
```

#### Issue: Performance Problems
```typescript
// Problem: Slow component rendering
// Solution: Optimize with memoization and lazy loading

import { memoize } from 'lodash-es';

class OptimizedComponent extends LitElement {
  // Memoize expensive computations
  private processData = memoize((data: any[]) => {
    return data.map(item => this.expensiveTransform(item));
  });

  // Use requestIdleCallback for non-critical updates
  private scheduleUpdate() {
    requestIdleCallback(() => {
      this.requestUpdate();
    });
  }

  // Debounce rapid changes
  private handleInputChange = debounce((event: Event) => {
    this.value = (event.target as HTMLInputElement).value;
  }, 300);
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

---

**Document Status**: ✅ **COMPLETE**
**Last Updated**: November 17, 2025
**Next Review**: February 17, 2026
**Maintained By**: Development Team

For questions or suggestions about these guidelines, please contact the development team or create an issue in the project repository.