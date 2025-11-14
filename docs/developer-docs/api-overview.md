# 📚 WorkshopsAI CMS API Documentation

**Version:** 1.0.0
**Base URL:** `https://api.workshopsai.com/v1`
**Protocol:** HTTPS
**Authentication:** JWT Bearer Token

---

## 🔧 Overview

WorkshopsAI CMS API to RESTful API zapewniające pełną funkcjonalność zarządzania warsztatami socjologicznymi. API wspiera wielojęzyczność, role-based access control, oraz zapewnia zgodność z RODO/GDPR.

### 🎯 Kluczowe cechy API
- **RESTful architecture** z czytelnymi endpointami
- **JSON responses** z konsystentną strukturą
- **JWT authentication** z rolami użytkowników
- **Internationalization (i18n)** dla wszystkich tekstów
- **Rate limiting** dla ochrony przed nadużyciami
- **Comprehensive error handling** z szczegółowymi kodami
- **Pagination** dla list zasobów
- **Audit logging** dla compliance

---

## 🛡️ Authentication & Authorization

### JWT Token Authentication
Wszystkie endpointy (poza publicznymi) wymagają nagłówka autoryzacji:

```http
Authorization: Bearer <your-jwt-token>
```

### Role-Based Access Control
System wykorzystuje 5-poziomowy system uprawnień:

| Rola | Uprawnienia | Scope |
|------|-------------|-------|
| **participant** | Podstawowy dostęp | Odczyt publiczny, własne zapisy |
| **facilitator** | Warsztaty przydzielone | Zarządzanie swoimi warsztatami |
| **moderator** | Moderacja | Zarządzanie zapisami, komentarze |
| **sociologist-editor** | Pełny edycja | Wszystkie funkcje warsztatowe |
| **admin** | Pełen dostęp | Wszystkie funkcje systemowe |

### Example Authentication Flow

#### 1️⃣ Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-user-123",
      "email": "user@example.com",
      "role": "sociologist-editor",
      "name": "Jan Kowalski"
    },
    "expiresIn": 86400
  }
}
```

#### 2️⃣ Using the Token
```http
GET /api/v1/workshops
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📊 Response Structure

### Success Response
```json
{
  "success": true,
  "data": {
    // API response data
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-uuid-123",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "message": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-uuid-123"
  }
}
```

### HTTP Status Codes
| Kod | Opis | Przykład użycia |
|-----|------|-----------------|
| **200** | Success | GET /workshops |
| **201** | Created | POST /workshops |
| **400** | Bad Request | Invalid data |
| **401** | Unauthorized | Missing/invalid token |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate resource |
| **422** | Validation Error | Invalid input data |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Error | Server error |

---

## 🔄 Workshop Management API

### Get Workshops List
```http
GET /api/v1/workshops?page=1&limit=20&status=published&language=pl
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `status` (enum, optional): draft, published, archived, cancelled
- `language` (enum, optional): pl, en
- `search` (string, optional): Search in titles and descriptions
- `tags` (array, optional): Filter by tags
- `startDate` (date, optional): Filter by start date
- `endDate` (date, optional): Filter by end date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "workshop-uuid-123",
      "slug": "warsztaty-integracji-zespolu",
      "titleI18n": {
        "pl": "Warsztaty Integracji Zespołu",
        "en": "Team Integration Workshop"
      },
      "subtitleI18n": {
        "pl": "Budowanie efektywnej współpracy",
        "en": "Building effective collaboration"
      },
      "descriptionI18n": {
        "pl": "Kompleksowy program warsztatów...",
        "en": "Comprehensive workshop program..."
      },
      "status": "published",
      "language": "pl",
      "startDate": "2024-02-15T09:00:00.000Z",
      "endDate": "2024-02-15T17:00:00.000Z",
      "seatLimit": 20,
      "seatReserved": 15,
      "enableWaitingList": true,
      "templateTheme": "integracja",
      "tags": ["integracja", "zespol", "budowanie-zaufania"],
      "facilitator": {
        "id": "facilitator-uuid-456",
        "name": "Anna Nowak",
        "email": "anna.nowak@example.com"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:45:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### Get Workshop by ID
```http
GET /api/v1/workshops/:id
Authorization: Bearer <token>
```

**Response:** Full workshop object including modules and questionnaire

### Create Workshop
```http
POST /api/v1/workshops
Authorization: Bearer <token>
Content-Type: application/json

{
  "titleI18n": {
    "pl": "Nowe Warsztaty",
    "en": "New Workshop"
  },
  "subtitleI18n": {
    "pl": "Podtytuł warsztatów",
    "en": "Workshop subtitle"
  },
  "descriptionI18n": {
    "pl": "Szczegółowy opis warsztatów...",
    "en": "Detailed workshop description..."
  },
  "shortDescriptionI18n": {
    "pl": "Krótki opis...",
    "en": "Short description..."
  },
  "status": "draft",
  "language": "pl",
  "startDate": "2024-02-15T09:00:00.000Z",
  "endDate": "2024-02-15T17:00:00.000Z",
  "seatLimit": 25,
  "enableWaitingList": true,
  "templateTheme": "integracja",
  "tags": ["integracja", "zespol"],
  "facilitatorId": "facilitator-uuid-456",
  "modules": [
    {
      "titleI18n": {
        "pl": "Moduł 1: Wprowadzenie",
        "en": "Module 1: Introduction"
      },
      "descriptionI18n": {
        "pl": "Opis modułu...",
        "en": "Module description..."
      },
      "type": "text",
      "durationMinutes": 15,
      "sortOrder": 1
    }
  ]
}
```

### Update Workshop
```http
PATCH /api/v1/workshops/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "titleI18n": {
    "pl": "Zaktualizowany tytuł",
    "en": "Updated title"
  },
  "seatLimit": 30
}
```

### Publish Workshop
```http
POST /api/v1/workshops/:id/publish
Authorization: Bearer <token>
```

### Delete Workshop
```http
DELETE /api/v1/workshops/:id
Authorization: Bearer <token>
```

---

## 📝 Questionnaire Management API

### Create Questionnaire
```http
POST /api/v1/workshops/:workshopId/questionnaires
Authorization: Bearer <token>
Content-Type: application/json

{
  "titleI18n": {
    "pl": "Ankieta przed-warsztatowa",
    "en": "Pre-workshop survey"
  },
  "instructionsI18n": {
    "pl": "Proszę odpowiedzieć na poniższe pytania...",
    "en": "Please answer the following questions..."
  },
  "settings": {
    "allowAnonymous": true,
    "showResults": false,
    "requireLogin": true
  },
  "questionGroups": [
    {
      "titleI18n": {
        "pl": "Informacje podstawowe",
        "en": "Basic information"
      },
      "descriptionI18n": {
        "pl": "Proszę podać swoje dane:",
        "en": "Please provide your information:"
      },
      "sortOrder": 1,
      "questions": [
        {
          "textI18n": {
            "pl": "Twoje imię:",
            "en": "Your name:"
          },
          "type": "text",
          "required": true,
          "validation": {
            "minLength": 2,
            "maxLength": 50
          },
          "sortOrder": 1
        }
      ]
    }
  ]
}
```

### Get Questionnaire
```http
GET /api/v1/questionnaires/:id
Authorization: Bearer <token>
```

### Update Questionnaire
```http
PATCH /api/v1/questionnaires/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "titleI18n": {
    "pl": "Zaktualizowany tytuł",
    "en": "Updated title"
  }
}
```

### Add Question Group
```http
POST /api/v1/questionnaires/:questionnaireId/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "titleI18n": {
    "pl": "Nowa grupa pytań",
    "en": "New question group"
  },
  "descriptionI18n": {
    "pl": "Opis grupy...",
    "en": "Group description..."
  }
}
```

### Add Question
```http
POST /api/v1/question-groups/:groupId/questions
Authorization: Bearer <token>
Content-Type: application/json

{
  "textI18n": {
    "pl": "Jak oceniasz swoje doświadczenie?",
    "en": "How do you rate your experience?"
  },
  "type": "scale",
  "required": true,
  "optionsI18n": [
    {
      "value": "1",
      "label": {
        "pl": "Bardzo źle",
        "en": "Very poor"
      }
    },
    {
      "value": "5",
      "label": {
        "pl": "Bardzo dobrze",
        "en": "Very good"
      }
    }
  ],
  "validation": {
    "min": 1,
    "max": 5
  }
}
```

---

## 👥 Enrollment Management API

### Create Enrollment
```http
POST /api/v1/enrollments
Authorization: Bearer <token>
Content-Type: application/json

{
  "workshopId": "workshop-uuid-123",
  "notes": "Uwagi do zapisu",
  "answers": [
    {
      "questionId": "question-uuid-456",
      "value": "Jan Kowalski"
    },
    {
      "questionId": "question-uuid-789",
      "value": "5"
    }
  ]
}
```

### Get Enrollments
```http
GET /api/v1/enrollments?workshopId=workshop-uuid-123&status=confirmed
Authorization: Bearer <token>
```

### Update Enrollment Status
```http
PATCH /api/v1/enrollments/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "confirmed",
  "notes": "Potwierdzono telefonicznie"
}
```

### Cancel Enrollment
```http
DELETE /api/v1/enrollments/:id
Authorization: Bearer <token>
```

---

## 📁 File Management API

### Upload File
```http
POST /api/v1/files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: [binary file data]
associatedEntity: "workshop"
associatedEntityId: "workshop-uuid-123"
accessLevel: "workshop"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file-uuid-123",
    "filename": "workshop-image.jpg",
    "originalName": "my-image.jpg",
    "mimeType": "image/jpeg",
    "size": 2048576,
    "url": "https://cdn.workshopsai.com/files/workshop-image.jpg",
    "accessLevel": "workshop",
    "associatedEntity": "workshop",
    "associatedEntityId": "workshop-uuid-123",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get File URL
```http
GET /api/v1/files/:id/url?expiresIn=3600
Authorization: Bearer <token>
```

### Delete File
```http
DELETE /api/v1/files/:id
Authorization: Bearer <token>
```

---

## 👤 User Management API

### Get Current User
```http
GET /api/v1/users/me
Authorization: Bearer <token>
```

### Update Profile
```http
PATCH /api/v1/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jan Kowalski",
  "bio": "Socjolog z 10-letnim doświadczeniem",
  "avatar": "https://cdn.workshopsai.com/avatars/jan-kowalski.jpg"
}
```

### Get Users (Admin only)
```http
GET /api/v1/users?page=1&limit=20&role=participant
Authorization: Bearer <admin-token>
```

### Update User Role (Admin only)
```http
PATCH /api/v1/users/:id/role
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "role": "facilitator"
}
```

---

## 📊 Analytics API

### Get Workshop Statistics
```http
GET /api/v1/analytics/workshops/:id/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEnrollments": 45,
    "confirmedEnrollments": 38,
    "waitlistEnrollments": 7,
    "completionRate": 0.85,
    "satisfactionScore": 4.6,
    "demographics": {
      "ageGroups": {
        "18-25": 12,
        "26-35": 18,
        "36-45": 10,
        "46+": 5
      },
      "experience": {
        "beginner": 15,
        "intermediate": 20,
        "advanced": 10
      }
    },
    "questionnaireResponses": 42
  }
}
```

### Get System Statistics (Admin only)
```http
GET /api/v1/analytics/system/stats?period=30d
Authorization: Bearer <admin-token>
```

---

## 🔔 Notifications API

### Send Notification
```http
POST /api/v1/notifications/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "workshop_reminder",
  "recipients": ["user-uuid-123", "user-uuid-456"],
  "data": {
    "workshopId": "workshop-uuid-789",
    "message": "Przypomnienie o nadchodzącym warsztacie"
  },
  "channels": ["email", "in_app"]
}
```

### Get Notifications
```http
GET /api/v1/notifications?page=1&limit=20&unread=true
Authorization: Bearer <token>
```

### Mark Notification as Read
```http
PATCH /api/v1/notifications/:id/read
Authorization: Bearer <token>
```

---

## 📝 API Rate Limits

| Plan | Requests per minute | Requests per hour |
|------|-------------------|------------------|
| **Free** | 60 | 1000 |
| **Pro** | 300 | 5000 |
| **Enterprise** | 1000 | 20000 |

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1642234560
```

---

## 🔍 Pagination

List endpoints support pagination with these parameters:
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)

**Pagination metadata:**
```json
{
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## 🔍 Search and Filtering

### Search Syntax
Search supports multiple parameters:

```http
GET /api/v1/workshops?search=integracja&status=published&language=pl&tags=zespol,budowanie-zaufania
```

### Advanced Filtering
```http
GET /api/v1/workshops?filters[status]=published&filters[language]=pl&filters[tags][]=integracja
```

### Sorting
```http
GET /api/v1/workshops?sort=startDate&order=desc
```

Available sort fields: `createdAt`, `updatedAt`, `startDate`, `title`, `popularity`

---

## 🔧 Webhooks

### Configure Webhook
```http
POST /api/v1/webhooks
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/workshops",
  "events": ["workshop.created", "enrollment.confirmed"],
  "secret": "your-webhook-secret",
  "active": true
}
```

### Webhook Events
- `workshop.created` - New workshop created
- `workshop.published` - Workshop published
- `enrollment.created` - New enrollment
- `enrollment.confirmed` - Enrollment confirmed
- `questionnaire.completed` - Questionnaire submitted

### Webhook Payload Example
```json
{
  "event": "enrollment.confirmed",
  "data": {
    "id": "enrollment-uuid-123",
    "workshopId": "workshop-uuid-456",
    "userId": "user-uuid-789",
    "status": "confirmed",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "signature": "sha256=abc123..."
}
```

---

## 🧪 Testing the API

### SDK Examples

#### JavaScript/Node.js
```javascript
const axios = require('axios');

class WorkshopsAIClient {
  constructor(apiKey, baseUrl = 'https://api.workshopsai.com/v1') {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getWorkshops(params = {}) {
    const response = await this.client.get('/workshops', { params });
    return response.data;
  }

  async createWorkshop(data) {
    const response = await this.client.post('/workshops', data);
    return response.data;
  }
}

// Usage
const client = new WorkshopsAIClient('your-api-key');
const workshops = await client.getWorkshops({ status: 'published' });
```

#### Python
```python
import requests

class WorkshopsAIClient:
    def __init__(self, api_key, base_url='https://api.workshopsai.com/v1'):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def get_workshops(self, params=None):
        response = requests.get(
            f'{self.base_url}/workshops',
            headers=self.headers,
            params=params
        )
        return response.json()

# Usage
client = WorkshopsAIClient('your-api-key')
workshops = client.get_workshops({'status': 'published'})
```

### API Testing Tools
- **Postman Collection:** Download our collection
- **OpenAPI Spec:** Available at `/api/docs/swagger.yaml`
- **Interactive Docs:** Available at `/api/docs`

---

## 🚨 Error Handling

### Common Error Scenarios

#### Validation Error (422)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "value": "invalid-email"
      },
      {
        "field": "seatLimit",
        "message": "Must be between 1 and 100",
        "value": 0
      }
    ]
  }
}
```

#### Rate Limit Exceeded (429)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 300,
      "remaining": 0,
      "resetIn": 45
    }
  }
}
```

---

## 📞 Support

- **API Documentation:** Complete OpenAPI spec available
- **Support Email:** api-support@workshopsai.com
- **Status Page:** https://status.workshopsai.com
- **GitHub Issues:** For feature requests and bug reports
- **Response Time:** 24 hours for business days

---

## 🔮 Roadmap

### Upcoming Features
- GraphQL API (Q2 2024)
- Real-time WebSocket API (Q2 2024)
- Advanced analytics endpoints (Q3 2024)
- Machine learning insights API (Q4 2024)

---

**Last Updated:** January 15, 2024
**API Version:** 1.0.0
**Compatibility:** Node.js 18+, Python 3.8+, PHP 8.0+