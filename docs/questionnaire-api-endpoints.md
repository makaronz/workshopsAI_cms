# Questionnaire CRUD API Endpoints Documentation

This document provides comprehensive documentation for the questionnaire CRUD API endpoints implemented for the workshopsAI CMS.

## Overview

The questionnaire API provides full CRUD operations for questionnaires, question groups, and questions with support for i18n content, validation, conditional logic, and audit logging.

## Base URL

```
/api/v1/questionnaires
```

## Authentication & Authorization

All endpoints require JWT authentication (`Bearer` token). Authorization varies by endpoint:

- **Questionnaire Management**: `sociologist-editor`, `admin` roles
- **Question Group & Question Management**: `sociologist-editor`, `admin` roles
- **Read Operations**: Additional roles like `moderator`, `facilitator` may have access

## Endpoints

### Questionnaire Management

#### `POST /api/v1/workshops/:workshopId/questionnaires`
Create a questionnaire for a specific workshop.

**Request Body:**
```json
{
  "titleI18n": {
    "pl": "Ankieta po warsztatach",
    "en": "Post-workshop survey"
  },
  "instructionsI18n": {
    "pl": "Proszę odpowiedzieć na poniższe pytania",
    "en": "Please answer the following questions"
  },
  "settings": {
    "anonymous": false,
    "require_consent": true,
    "max_responses": null,
    "close_after_workshop": false,
    "show_all_questions": true,
    "allow_edit": true,
    "question_style": "first_person_plural"
  }
}
```

#### `GET /api/v1/questionnaires/:id`
Get questionnaire with all question groups and questions.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "workshopId": "uuid",
    "titleI18n": { "pl": "...", "en": "..." },
    "instructionsI18n": { "pl": "...", "en": "..." },
    "status": "draft|review|published|closed|analyzed",
    "settings": { ... },
    "publishedAt": "2024-01-01T00:00:00Z",
    "closedAt": null,
    "creator": { "id": "uuid", "name": "...", "email": "..." },
    "questionGroups": [
      {
        "id": "uuid",
        "titleI18n": { "pl": "...", "en": "..." },
        "descriptionI18n": { "pl": "...", "en": "..." },
        "orderIndex": 1,
        "uiConfig": { "collapsed": false, "show_progress": true, "icon": null, "color": null },
        "questions": [
          {
            "id": "uuid",
            "textI18n": { "pl": "...", "en": "..." },
            "type": "text|textarea|number|scale|single_choice|multiple_choice",
            "optionsI18n": [
              {
                "value": "option1",
                "label": { "pl": "Opcja 1", "en": "Option 1" }
              }
            ],
            "validation": { "required": true, "min_length": 1 },
            "conditionalLogic": {
              "show_if": {
                "question_id": "uuid",
                "operator": "equals|contains|greater_than|less_than",
                "value": "some_value"
              }
            },
            "orderIndex": 1,
            "helpTextI18n": { "pl": "...", "en": "..." }
          }
        ]
      }
    ]
  }
}
```

#### `PATCH /api/v1/questionnaires/:id`
Update questionnaire metadata (title, instructions, settings, status).

#### `DELETE /api/v1/questionnaires/:id`
Soft delete questionnaire with dependency checking.

### Question Group Management

#### `POST /api/v1/questionnaires/:questionnaireId/groups`
Create a new question group in a questionnaire.

**Request Body:**
```json
{
  "titleI18n": {
    "pl": "Sekcja 1",
    "en": "Section 1"
  },
  "descriptionI18n": {
    "pl": "Opis sekcji",
    "en": "Section description"
  },
  "orderIndex": 1,
  "uiConfig": {
    "collapsed": false,
    "show_progress": true,
    "icon": "survey",
    "color": "#blue"
  }
}
```

#### `PATCH /api/v1/question-groups/:id`
Update question group properties.

#### `DELETE /api/v1/question-groups/:id`
Delete question group (only if empty).

#### `PATCH /api/v1/questionnaires/:questionnaireId/groups/reorder`
Reorder question groups within a questionnaire.

**Request Body:**
```json
{
  "groupOrders": [
    { "id": "uuid1", "orderIndex": 1 },
    { "id": "uuid2", "orderIndex": 2 }
  ]
}
```

### Question Management

#### `POST /api/v1/question-groups/:groupId/questions`
Create a new question in a question group.

**Request Body:**
```json
{
  "textI18n": {
    "pl": "Jak oceniasz warsztaty?",
    "en": "How do you rate the workshop?"
  },
  "type": "scale",
  "optionsI18n": [
    { "value": "1", "label": { "pl": "Bardzo źle", "en": "Very poor" } },
    { "value": "2", "label": { "pl": "Źle", "en": "Poor" } },
    { "value": "3", "label": { "pl": "Średnio", "en": "Average" } },
    { "value": "4", "label": { "pl": "Dobrze", "en": "Good" } },
    { "value": "5", "label": { "pl": "Bardzo dobrze", "en": "Very good" } }
  ],
  "validation": {
    "required": true,
    "min_value": 1,
    "max_value": 5
  },
  "orderIndex": 1,
  "helpTextI18n": {
    "pl": "Wybierz ocenę od 1 do 5",
    "en": "Choose a rating from 1 to 5"
  }
}
```

#### `PATCH /api/v1/questions/:id`
Update question properties.

#### `DELETE /api/v1/questions/:id`
Delete question (only if no responses exist).

#### `PATCH /api/v1/question-groups/:groupId/questions/reorder`
Reorder questions within a question group.

### Utility Endpoints

#### `GET /api/v1/questionnaires/:id/status`
Get questionnaire status and basic statistics.

#### `GET /api/v1/questionnaires/:id/validate`
Validate questionnaire structure before publishing.

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": [],
    "warnings": ["Question group 'Unnamed' has no questions"]
  }
}
```

## Question Types

### Text Input Types
- **`text`**: Single line text input
- **`textarea`**: Multi-line text input
- **`number`**: Numeric input

### Choice Types
- **`single_choice`**: Radio button selection (requires `optionsI18n`)
- **`multiple_choice`**: Checkbox selection (requires `optionsI18n`)

### Scale Type
- **`scale`**: Rating scale (typically 1-5 or 1-10, requires `optionsI18n` for labels)

## Validation Options

```json
{
  "required": true,
  "min_length": 1,
  "max_length": 500,
  "min_value": 1,
  "max_value": 5,
  "pattern": "^[a-zA-Z0-9]+$"
}
```

## Conditional Logic

Questions can be shown/hidden based on responses to other questions:

```json
{
  "show_if": {
    "question_id": "uuid-of-trigger-question",
    "operator": "equals",
    "value": "trigger_value"
  }
}
```

## i18n Support

All text fields support internationalization using the format:
```json
{
  "pl": "Polish text",
  "en": "English text"
}
```

## Audit Logging

All create, update, and delete operations are logged with:
- User ID
- Operation type (CREATE, UPDATE, DELETE, REORDER)
- Old and new values
- IP address and user agent
- Timestamp

## Error Handling

Standard HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `409`: Conflict (business logic violations)
- `500`: Internal Server Error

Error response format:
```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": [...] // For validation errors
}
```

## Business Logic Constraints

1. **Question Groups**: Cannot be deleted if they contain questions
2. **Questions**: Cannot be deleted if they have responses
3. **Choice Questions**: Must have at least one option
4. **Questionnaires**: Cannot be deleted if published with responses
5. **Order Management**: Automatic order index assignment if not provided

## Rate Limiting

All endpoints are subject to rate limiting (100 requests per 15 minutes in production).

## Security Features

- JWT authentication required
- Role-based authorization
- Input sanitization and XSS protection
- SQL injection protection via parameterized queries
- CORS configuration
- Request size limits