# Questionnaire API Documentation

## Canonical Implementation (questionnaires-new.ts)

This document describes the unified questionnaire API endpoints after the legacy cleanup.

### Base URL
`/api/v1/questionnaires`

### Authentication
All endpoints require JWT authentication with appropriate role permissions.

## Endpoints

### Questionnaire CRUD Operations

#### Create Questionnaire
- **POST** `/api/v1/questionnaires`
- **Roles:** `sociologist-editor`, `admin`
- **Body:** QuestionnaireCreateSchema
- **Response:** `{ success: true, data: Questionnaire }`

#### Create Questionnaire for Workshop
- **POST** `/api/v1/workshops/:workshopId/questionnaires`
- **Roles:** `sociologist-editor`, `admin`
- **Body:** QuestionnaireCreateSchema
- **Response:** `{ success: true, data: Questionnaire }`

#### Get Questionnaire by ID
- **GET** `/api/v1/questionnaires/:id`
- **Roles:** Based on questionnaire access permissions
- **Response:** `{ success: true, data: Questionnaire }`

#### Update Questionnaire
- **PATCH** `/api/v1/questionnaires/:id`
- **Roles:** `sociologist-editor`, `admin`
- **Body:** QuestionnaireUpdateSchema
- **Response:** `{ success: true, data: Questionnaire }`

#### Delete Questionnaire
- **DELETE** `/api/v1/questionnaires/:id`
- **Roles:** `sociologist-editor`, `admin`
- **Response:** `{ success: true, message: string }`

#### Get Questionnaire Status
- **GET** `/api/v1/questionnaires/:id/status`
- **Roles:** Based on questionnaire access permissions
- **Response:** `{ success: true, data: QuestionnaireStatus }`

#### Publish Questionnaire
- **POST** `/api/v1/questionnaires/:id/publish`
- **Roles:** `sociologist-editor`, `admin`
- **Response:** `{ success: true, data: Questionnaire }`

#### Validate Questionnaire Structure
- **GET** `/api/v1/questionnaires/:id/validate`
- **Roles:** `sociologist-editor`, `admin`
- **Response:** `{ success: true, data: ValidationResult }`

### Question Group Operations

#### Create Question Group
- **POST** `/api/v1/questionnaires/:questionnaireId/groups`
- **Roles:** `sociologist-editor`, `admin`
- **Body:** QuestionGroupCreateSchema
- **Response:** `{ success: true, data: QuestionGroup }`

#### Update Question Group
- **PATCH** `/api/v1/question-groups/:id`
- **Roles:** `sociologist-editor`, `admin`
- **Body:** QuestionGroupUpdateSchema
- **Response:** `{ success: true, data: QuestionGroup }`

#### Delete Question Group
- **DELETE** `/api/v1/question-groups/:id`
- **Roles:** `sociologist-editor`, `admin`
- **Response:** `{ success: true, message: string }`

#### Reorder Question Groups
- **PATCH** `/api/v1/questionnaires/:questionnaireId/groups/reorder`
- **Roles:** `sociologist-editor`, `admin`
- **Body:** `{ groupOrders: Array<{id: string, orderIndex: number}> }`
- **Response:** `{ success: true, message: string }`

### Question Operations

#### Create Question
- **POST** `/api/v1/question-groups/:groupId/questions`
- **Roles:** `sociologist-editor`, `admin`
- **Body:** QuestionCreateSchema
- **Response:** `{ success: true, data: Question }`

#### Update Question
- **PATCH** `/api/v1/questions/:id`
- **Roles:** `sociologist-editor`, `admin`
- **Body:** QuestionUpdateSchema
- **Response:** `{ success: true, data: Question }`

#### Delete Question
- **DELETE** `/api/v1/questions/:id`
- **Roles:** `sociologist-editor`, `admin`
- **Response:** `{ success: true, message: string }`

#### Reorder Questions
- **PATCH** `/api/v1/question-groups/:groupId/questions/reorder`
- **Roles:** `sociologist-editor`, `admin`
- **Body:** `{ questionOrders: Array<{id: string, orderIndex: number}> }`
- **Response:** `{ success: true, message: string }`

### Workshop Questionnaires

#### Get Workshop Questionnaires
- **GET** `/api/v1/workshops/:workshopId/questionnaires`
- **Roles:** `sociologist-editor`, `admin`, `moderator`, `facilitator`
- **Response:** `{ success: true, data: { questionnaires: Questionnaire[], total: number } }`

## Response Format

All successful responses follow the canonical format:
```json
{
  "success": true,
  "data": <response_data>,
  "message": "<optional_message>"
}
```

Error responses:
```json
{
  "success": false,
  "error": "<error_type>",
  "message": "<error_description>",
  "details": <optional_validation_details>
}
```

## Frontend Integration

The frontend questionnaire manager has been updated to use the canonical API with proper response format handling:

- Uses PATCH instead of PUT for updates
- Handles canonical response format `{ success: true, data: ... }`
- Maintains backward compatibility with legacy response format

## Database Schema

The canonical implementation uses PostgreSQL schema with the following key tables:
- `questionnaires` - Main questionnaire records
- `question_groups` - Question groupings within questionnaires
- `questions` - Individual questions within groups
- `question_options` - Options for choice-based questions
- `question_responses` - User responses to questions

## Legacy Cleanup

**Removed:**
- `src/routes/questionnaires.ts` - Legacy LLM-based implementation
- All references to legacy route imports

**Retained:**
- `src/routes/api/questionnaires-new.ts` - Canonical PostgreSQL implementation (now primary)
- LLM schema for analysis functionality (separate from core questionnaire operations)

## Migration Status

✅ **COMPLETED** - Legacy API cleanup complete
✅ Canonical questionnaire API is active and registered
✅ Frontend updated to use canonical API patterns
✅ Database schema compatibility verified