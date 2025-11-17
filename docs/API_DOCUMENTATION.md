# WorkshopsAI CMS - Complete API Documentation

**Version**: 1.0.0 | **Base URL**: `http://localhost:3001/api/v1` | **Last Updated**: November 2025

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [Workshops Management](#workshops-management)
- [Questionnaires Management](#questionnaires-management)
- [User Management](#user-management)
- [Dashboard & Analytics](#dashboard--analytics)
- [File Management](#file-management)
- [Response Collection](#response-collection)
- [Health & System](#health--system)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)

---

## 🔐 Authentication

### Base Authentication Pattern
All API endpoints (except public ones) require JWT authentication via the `Authorization` header:

```http
Authorization: Bearer <your-jwt-token>
```

### Login
Authenticate user and receive JWT tokens.

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "rememberMe": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "sociologist-editor",
      "createdAt": "2025-11-17T10:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

### Register
Create a new user account.

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "participant"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "newuser@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "participant",
      "createdAt": "2025-11-17T10:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

### Refresh Token
Refresh access token using refresh token.

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Logout
Invalidate user tokens and logout.

```http
POST /api/v1/auth/logout
Authorization: Bearer <access-token>
```

---

## 🏛️ Workshops Management

### Get All Workshops
Retrieve a paginated list of workshops with filtering options.

```http
GET /api/v1/workshops?page=1&limit=20&status=published&search=integration
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `status` (string, optional): Filter by status (`draft`, `published`, `archived`)
- `search` (string, optional): Search in title and description
- `facilitatorId` (string, optional): Filter by facilitator
- `templateTheme` (string, optional): Filter by template theme

**Response:**
```json
{
  "success": true,
  "data": {
    "workshops": [
      {
        "id": "uuid",
        "title": "Integration Workshop",
        "description": "Learn team integration techniques",
        "status": "published",
        "templateTheme": "integration",
        "startDate": "2025-12-01T09:00:00Z",
        "endDate": "2025-12-01T17:00:00Z",
        "seatLimit": 25,
        "enrolledCount": 18,
        "facilitator": {
          "id": "uuid",
          "firstName": "John",
          "lastName": "Doe"
        },
        "createdAt": "2025-11-15T10:00:00Z",
        "updatedAt": "2025-11-16T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Get Workshop by ID
Retrieve detailed information about a specific workshop.

```http
GET /api/v1/workshops/:id
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workshop": {
      "id": "uuid",
      "title": "Integration Workshop",
      "description": "Learn team integration techniques",
      "status": "published",
      "templateTheme": "integration",
      "language": "pl",
      "startDate": "2025-12-01T09:00:00Z",
      "endDate": "2025-12-01T17:00:00Z",
      "seatLimit": 25,
      "enrolledCount": 18,
      "location": {
        "name": "Conference Room A",
        "address": "123 Main St, City",
        "coordinates": {
          "lat": 52.5200,
          "lng": 13.4050
        }
      },
      "facilitator": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "bio": "Experienced facilitator with 10+ years"
      },
      "modules": [
        {
          "id": "uuid",
          "title": "Ice Breaker",
          "description": "Introduction activities",
          "duration": 30,
          "order": 1
        }
      ],
      "tags": ["team-building", "integration", "communication"],
      "createdAt": "2025-11-15T10:00:00Z",
      "updatedAt": "2025-11-16T14:30:00Z"
    }
  }
}
```

### Create Workshop
Create a new workshop (requires `sociologist-editor` or `admin` role).

```http
POST /api/v1/workshops
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "title": "New Integration Workshop",
  "description": "A workshop focused on team integration",
  "templateTheme": "integration",
  "language": "pl",
  "startDate": "2025-12-15T09:00:00Z",
  "endDate": "2025-12-15T17:00:00Z",
  "seatLimit": 20,
  "facilitatorId": "uuid",
  "location": {
    "name": "Training Room",
    "address": "456 Oak St, City"
  },
  "tags": ["integration", "team-building"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workshop": {
      "id": "new-uuid",
      "title": "New Integration Workshop",
      "status": "draft",
      "createdAt": "2025-11-17T10:00:00Z",
      "updatedAt": "2025-11-17T10:00:00Z"
    }
  }
}
```

### Update Workshop
Update an existing workshop (requires appropriate permissions).

```http
PUT /api/v1/workshops/:id
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "title": "Updated Workshop Title",
  "description": "Updated description",
  "seatLimit": 30
}
```

### Publish Workshop
Publish a workshop making it available for enrollment.

```http
POST /api/v1/workshops/:id/publish
Authorization: Bearer <access-token>
```

### Archive Workshop
Archive a workshop (no longer active but preserved).

```http
POST /api/v1/workshops/:id/archive
Authorization: Bearer <access-token>
```

---

## 📋 Questionnaires Management

### Get All Questionnaires
Retrieve a list of questionnaires with filtering.

```http
GET /api/v1/questionnaires?page=1&limit=20&status=published&workshopId=uuid
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "questionnaires": [
      {
        "id": "uuid",
        "title": "Workshop Feedback Form",
        "description": "Collect feedback after workshop completion",
        "status": "published",
        "type": "feedback",
        "workshopId": "uuid",
        "responseCount": 25,
        "createdAt": "2025-11-10T10:00:00Z",
        "updatedAt": "2025-11-15T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

### Get Questionnaire by ID
Retrieve detailed questionnaire with questions and groups.

```http
GET /api/v1/questionnaires/:id
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "questionnaire": {
      "id": "uuid",
      "title": "Workshop Feedback Form",
      "description": "Collect feedback after workshop completion",
      "status": "published",
      "type": "feedback",
      "language": "pl",
      "settings": {
        "allowAnonymous": false,
        "requireAuth": true,
        "showProgress": true,
        "randomizeQuestions": false
      },
      "questions": [
        {
          "id": "uuid",
          "groupId": "uuid",
          "type": "rating",
          "title": "Overall workshop satisfaction",
          "description": "Rate your overall satisfaction",
          "required": true,
          "order": 1,
          "settings": {
            "min": 1,
            "max": 5,
            "labels": {
              "1": "Very Dissatisfied",
              "5": "Very Satisfied"
            }
          }
        }
      ],
      "groups": [
        {
          "id": "uuid",
          "title": "Overall Feedback",
          "description": "General feedback questions",
          "order": 1
        }
      ]
    }
  }
}
```

### Create Questionnaire
Create a new questionnaire.

```http
POST /api/v1/questionnaires
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "title": "New Feedback Form",
  "description": "Collect user feedback",
  "type": "feedback",
  "language": "pl",
  "settings": {
    "allowAnonymous": false,
    "requireAuth": true
  },
  "questions": [
    {
      "type": "rating",
      "title": "How satisfied are you?",
      "required": true,
      "settings": {
        "min": 1,
        "max": 5
      }
    }
  ]
}
```

### Update Questionnaire
Update existing questionnaire.

```http
PUT /api/v1/questionnaires/:id
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "title": "Updated Title",
  "settings": {
    "allowAnonymous": true
  }
}
```

### Validate Questionnaire
Validate questionnaire structure before publishing.

```http
POST /api/v1/questionnaires/:id/validate
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "issues": [],
    "warnings": [
      {
        "type": "question_count",
        "message": "Consider adding more questions for better feedback"
      }
    ]
  }
}
```

---

## 👥 User Management

### Get Current User
Retrieve current authenticated user profile.

```http
GET /api/v1/users/me
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "sociologist-editor",
      "permissions": [
        "workshops.create",
        "workshops.edit",
        "questionnaires.create",
        "questionnaires.edit"
      ],
      "profile": {
        "bio": "Sociologist specializing in group dynamics",
        "organization": "University of Social Sciences",
        "phone": "+48 123 456 789"
      },
      "createdAt": "2025-10-01T10:00:00Z",
      "lastLoginAt": "2025-11-17T09:15:00Z"
    }
  }
}
```

### Update User Profile
Update current user profile information.

```http
PUT /api/v1/users/me
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "profile": {
    "bio": "Updated bio",
    "organization": "New Organization"
  }
}
```

### Get Users (Admin Only)
Retrieve list of users (requires admin role).

```http
GET /api/v1/users?page=1&limit=20&role=sociologist-editor&search=John
Authorization: Bearer <access-token>
```

### Update User Role (Admin Only)
Update user role and permissions.

```http
PUT /api/v1/users/:id/role
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "role": "facilitator",
  "reason": "Promoted to facilitator role"
}
```

---

## 📊 Dashboard & Analytics

### Get Dashboard Overview
Get dashboard statistics and overview data.

```http
GET /api/v1/dashboard/overview
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalWorkshops": 25,
      "publishedWorkshops": 18,
      "totalQuestionnaires": 45,
      "totalResponses": 1250,
      "activeUsers": 180,
      "upcomingWorkshops": 8
    },
    "recentActivity": [
      {
        "type": "workshop_created",
        "workshopId": "uuid",
        "title": "New Integration Workshop",
        "user": "John Doe",
        "timestamp": "2025-11-17T09:30:00Z"
      }
    ],
    "quickActions": [
      {
        "type": "create_workshop",
        "title": "Create New Workshop",
        "description": "Start creating a new workshop",
        "url": "/dashboard/workshops/new"
      }
    ]
  }
}
```

### Get Workshop Analytics
Get detailed analytics for workshops.

```http
GET /api/v1/analytics/workshops?period=30d&groupBy=day
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalWorkshops": 25,
      "newWorkshops": 5,
      "averageDuration": 480,
      "completionRate": 85.5
    },
    "timeSeries": [
      {
        "date": "2025-10-18",
        "workshopsCreated": 2,
        "workshopsCompleted": 3,
        "participants": 45
      }
    ],
    "topTemplates": [
      {
        "template": "integration",
        "count": 12,
        "percentage": 48
      }
    ]
  }
}
```

---

## 📁 File Management

### Upload File
Upload file for workshop or questionnaire content.

```http
POST /api/v1/files/upload
Authorization: Bearer <access-token>
Content-Type: multipart/form-data

file: <binary-data>
type: workshop-image|questionnaire-attachment|avatar
workshopId: uuid (optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "file": {
      "id": "uuid",
      "filename": "workshop-image.jpg",
      "originalName": "my-image.jpg",
      "mimeType": "image/jpeg",
      "size": 245760,
      "url": "https://cdn.example.com/files/uuid/workshop-image.jpg",
      "uploadedAt": "2025-11-17T10:00:00Z"
    }
  }
}
```

### Get File
Retrieve uploaded file by ID.

```http
GET /api/v1/files/:id
Authorization: Bearer <access-token>
```

### Delete File
Delete uploaded file.

```http
DELETE /api/v1/files/:id
Authorization: Bearer <access-token>
```

---

## 📝 Response Collection

### Submit Questionnaire Response
Submit responses to a questionnaire.

```http
POST /api/v1/responses
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "questionnaireId": "uuid",
  "responses": [
    {
      "questionId": "uuid",
      "value": 4,
      "type": "rating"
    },
    {
      "questionId": "uuid",
      "value": "Great workshop!",
      "type": "text"
    }
  ],
  "metadata": {
    "browser": "Chrome 119.0.0.0",
    "platform": "Web",
    "timeSpent": 300
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": {
      "id": "uuid",
      "questionnaireId": "uuid",
      "userId": "uuid",
      "submittedAt": "2025-11-17T10:00:00Z",
      "completionTime": 300
    }
  }
}
```

### Get Response by ID
Retrieve specific response details.

```http
GET /api/v1/responses/:id
Authorization: Bearer <access-token>
```

### Get Questionnaire Responses
Get all responses for a questionnaire.

```http
GET /api/v1/questionnaires/:id/responses?page=1&limit=50
Authorization: Bearer <access-token>
```

### Export Responses
Export questionnaire responses in various formats.

```http
GET /api/v1/questionnaires/:id/export?format=csv&includeMetadata=true
Authorization: Bearer <access-token>
```

**Response:**
```csv
Response ID,User,Submitted At,Question 1,Question 2
uuid,John Doe,2025-11-17T10:00:00Z,4,"Great workshop!"
```

---

## ❤️ Health & System

### Health Check
Check system health and status.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T10:00:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "connected",
      "responseTime": 15
    },
    "redis": {
      "status": "connected",
      "responseTime": 2
    },
    "storage": {
      "status": "available",
      "freeSpace": "500GB"
    }
  }
}
```

### System Info
Get detailed system information (admin only).

```http
GET /api/v1/system/info
Authorization: Bearer <access-token>
```

### System Metrics
Get performance and usage metrics.

```http
GET /api/v1/system/metrics
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "performance": {
      "responseTime": {
        "avg": 180,
        "p95": 320,
        "p99": 450
      },
      "throughput": {
        "requestsPerSecond": 45,
        "activeConnections": 125
      }
    },
    "resources": {
      "memory": {
        "used": "512MB",
        "available": "1.5GB",
        "percentage": 25.4
      },
      "cpu": {
        "usage": 15.2,
        "loadAverage": [0.5, 0.8, 1.2]
      }
    }
  }
}
```

---

## ❌ Error Responses

### Standard Error Format
All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ],
    "timestamp": "2025-11-17T10:00:00Z",
    "requestId": "uuid"
  }
}
```

### Common Error Codes

#### Authentication Errors
- `UNAUTHORIZED` (401): No valid authentication provided
- `TOKEN_EXPIRED` (401): JWT token has expired
- `INVALID_TOKEN` (401): Invalid JWT token
- `INSUFFICIENT_PERMISSIONS` (403): User lacks required permissions

#### Validation Errors
- `VALIDATION_ERROR` (400): Request data validation failed
- `MISSING_REQUIRED_FIELD` (400): Required field is missing
- `INVALID_FORMAT` (400): Field format is invalid

#### Resource Errors
- `NOT_FOUND` (404): Resource does not exist
- `ALREADY_EXISTS` (409): Resource already exists
- `CONFLICT` (409): Resource state conflict

#### Server Errors
- `INTERNAL_ERROR` (500): Unexpected server error
- `DATABASE_ERROR` (500): Database operation failed
- `EXTERNAL_SERVICE_ERROR` (502): External service unavailable

#### Rate Limiting
- `RATE_LIMIT_EXCEEDED` (429): Too many requests

---

## 🚦 Rate Limiting

### Rate Limiting Rules
The API implements rate limiting to prevent abuse:

| Endpoint Type | Limit | Window | Burst |
|---------------|-------|--------|-------|
| Authentication | 5 requests | 15 minutes | 10 |
| General API | 100 requests | 15 minutes | 200 |
| File Upload | 10 requests | 1 hour | 20 |
| Public Endpoints | 1000 requests | 1 hour | 2000 |

### Rate Limit Headers
Rate limit information is included in response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1637187600
X-RateLimit-Retry-After: 60
```

### Rate Limit Response
When rate limit is exceeded:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 60,
    "limit": 100,
    "window": "15m"
  }
}
```

---

## 🔧 SDK Examples

### JavaScript/TypeScript Client
```typescript
class WorkshopsAI {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    this.token = data.data.tokens.accessToken;
    return data;
  }

  async getWorkshops() {
    const response = await fetch(`${this.baseURL}/workshops`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }
}

// Usage
const client = new WorkshopsAI('http://localhost:3001/api/v1');
await client.login('user@example.com', 'password');
const workshops = await client.getWorkshops();
```

### cURL Examples
```bash
# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get workshops
curl -X GET http://localhost:3001/api/v1/workshops \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create workshop
curl -X POST http://localhost:3001/api/v1/workshops \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Workshop","description":"Description"}'
```

---

## 📚 Additional Resources

- **Frontend Integration Guide**: See `FRONTEND_INTEGRATION.md`
- **Testing Examples**: See `API_TESTING_EXAMPLES.md`
- **Webhook Documentation**: See `WEBHOOKS.md`
- **Migration Guide**: See `MIGRATION_GUIDE.md`

---

**API Version**: 1.0.0
**Base URL**: `http://localhost:3001/api/v1`
**Documentation Last Updated**: November 17, 2025
**Support**: development@workshopsai.com

For technical support or questions about the API, please contact the development team or create an issue in the project repository.