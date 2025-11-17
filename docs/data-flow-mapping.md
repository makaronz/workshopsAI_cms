# Frontend-Backend Data Flow Mapping

## Overview
This document maps all frontend-backend communication patterns in the WorkshopsAI CMS application, identifying API calls, their corresponding backend handlers, and verification of consistency.

## Architecture Summary
- **Frontend**: LitElement + Vaadin Router (TypeScript)
- **Backend**: Express.js with TypeScript
- **Communication**: Primarily Axios-based HTTP calls with some fetch() usage
- **Authentication**: JWT-based with Bearer tokens
- **API Version**: v1 (`/api/v1/`)

## 1. Authentication Flow

### Frontend Service: `auth.ts`
**Base URL**: `/api` (proxied to `/api/v1/` by Vite)

| Method | Endpoint | Purpose | Backend Handler | Status |
|--------|----------|---------|----------------|--------|
| `POST` | `/auth/login` | User login | `src/routes/auth.ts:100` | ✅ Active |
| `POST` | `/auth/register` | User registration | `src/routes/auth.ts:407` | ✅ Active |
| `POST` | `/auth/refresh` | Token refresh | `src/routes/auth.ts:180` | ✅ Active |
| `POST` | `/auth/logout` | User logout | `src/routes/auth.ts:270` | ✅ Active |
| `GET` | `/auth/me` | Get current user | `src/routes/auth.ts:597` | ✅ Active |
| `POST` | `/auth/forgot-password` | Password reset request | Not implemented | ⚠️ Missing |
| `POST` | `/auth/reset-password` | Password reset | Not implemented | ⚠️ Missing |

### Frontend Components Using Auth Service
- `login-form.ts` - Calls `authService.login()`
- `register-form.ts` - Calls `authService.register()`

### Data Flow Validation
- ✅ All authentication calls use proper JWT interceptors
- ✅ Token refresh mechanism implemented
- ✅ Error handling consistent across endpoints
- ⚠️ Password reset endpoints not implemented on backend

## 2. Workshop Management

### Frontend Service: `workshop.ts`
**Base URL**: `/api/v1/workshops`

| Method | Endpoint | Purpose | Backend Handler | Status |
|--------|----------|---------|----------------|--------|
| `GET` | `/` | List workshops with filters | `src/routes/api/workshops.ts:135` | ✅ Active |
| `GET` | `/:id` | Get workshop by ID | `src/routes/api/workshops.ts:192` | ✅ Active |
| `POST` | `/` | Create workshop | `src/routes/api/workshops.ts:224` | ✅ Active |
| `PATCH` | `/:id` | Update workshop | `src/routes/api/workshops.ts:260` | ✅ Active |
| `DELETE` | `/:id` | Delete workshop | `src/routes/api/workshops.ts:309` | ✅ Active |
| `GET` | `/:id/publish-checklist` | Check publishing readiness | `src/routes/api/workshops.ts:345` | ✅ Active |

### Workshop Session Management
| Method | Endpoint | Purpose | Backend Handler | Status |
|--------|----------|---------|----------------|--------|
| `GET` | `/:id/sessions` | List sessions | Not implemented | ⚠️ Missing |
| `POST` | `/:id/sessions` | Create session | Not implemented | ⚠️ Missing |
| `PATCH` | `/:id/sessions/:sessionId` | Update session | Not implemented | ⚠️ Missing |
| `DELETE` | `/:id/sessions/:sessionId` | Delete session | Not implemented | ⚠️ Missing |
| `PATCH` | `/:id/sessions/reorder` | Reorder sessions | Not implemented | ⚠️ Missing |

### Workshop Module Management
| Method | Endpoint | Purpose | Backend Handler | Status |
|--------|----------|---------|----------------|--------|
| `GET` | `/:id/sessions/:sessionId/modules` | List modules | Not implemented | ⚠️ Missing |
| `POST` | `/:id/sessions/:sessionId/modules` | Create module | Not implemented | ⚠️ Missing |
| `PATCH` | `/:id/sessions/:sessionId/modules/:moduleId` | Update module | Not implemented | ⚠️ Missing |
| `DELETE` | `/:id/sessions/:sessionId/modules/:moduleId` | Delete module | Not implemented | ⚠️ Missing |
| `PATCH` | `/:id/sessions/:sessionId/modules/reorder` | Reorder modules | Not implemented | ⚠️ Missing |

### Workshop Utilities
| Method | Endpoint | Purpose | Backend Handler | Status |
|--------|----------|---------|----------------|--------|
| `POST` | `/utils/generate-slug` | Generate unique slug | Not implemented | ⚠️ Missing |
| `POST` | `/utils/validate` | Validate workshop data | Not implemented | ⚠️ Missing |
| `POST` | `/upload/image` | Upload workshop image | Not implemented | ⚠️ Missing |
| `GET` | `/:id/export` | Export workshop data | Not implemented | ⚠️ Missing |
| `POST` | `/import` | Import workshop data | Not implemented | ⚠️ Missing |

### Frontend Components Using Workshop Service
- `WorkshopEditor.ts` - Workshop CRUD operations
- `WorkshopForm.ts` - Workshop creation/editing
- `SessionManager.ts` - Session management (no backend support)
- `WorkshopPreview.ts` - Workshop preview

### Data Flow Validation
- ✅ Basic workshop CRUD fully implemented
- ✅ Role-based access control enforced
- ✅ Proper validation with Zod schemas
- ⚠️ Session/Module management not implemented on backend
- ⚠️ Utility endpoints not implemented

## 3. Questionnaire Management

### Frontend Components (Mixed Service Patterns)

#### Questionnaire Manager Component
**Base URL**: `/api/v1/questionnaires`

| Method | Endpoint | Purpose | Backend Handler | Status |
|--------|----------|---------|----------------|--------|
| `GET` | `/:id` | Get questionnaire | `src/routes/api/questionnaires-new.ts:235` | ✅ Active |
| `POST` | `/:id/publish` | Publish questionnaire | `src/routes/api/questionnaires-new.ts:846` | ✅ Active |
| `PUT` | `/:id` | Update questionnaire | Uses fetch() in component | ⚠️ Mixed pattern |

#### Questionnaire Preview Page
| Method | Endpoint | Purpose | Backend Handler | Status |
|--------|----------|---------|----------------|--------|
| `GET` | `/api/v1/questionnaires/:id` | Get questionnaire for preview | `src/routes/api/questionnaires.ts:242` | ✅ Active |

### Backend Questionnaire Routes

#### New Implementation (`questionnaires-new.ts`)
| Method | Endpoint | Purpose | Implementation Status |
|--------|----------|---------|-----------------------|
| `GET` | `/:id` | Get questionnaire | ✅ Complete |
| `POST` | `/workshops/:workshopId/questionnaires` | Create for workshop | ✅ Complete |
| `PATCH` | `/:id` | Update questionnaire | ✅ Complete |
| `DELETE` | `/:id` | Delete questionnaire | ✅ Complete |
| `GET` | `/:id/status` | Get status | ✅ Complete |
| `POST` | `/:id/publish` | Publish questionnaire | ✅ Complete |

#### Question Group Management
| Method | Endpoint | Purpose | Implementation Status |
|--------|----------|---------|-----------------------|
| `POST` | `/:questionnaireId/groups` | Create group | ✅ Complete |
| `PATCH` | `/question-groups/:id` | Update group | ✅ Complete |
| `DELETE` | `/question-groups/:id` | Delete group | ✅ Complete |
| `PATCH` | `/:questionnaireId/groups/reorder` | Reorder groups | ✅ Complete |

#### Question Management
| Method | Endpoint | Purpose | Implementation Status |
|--------|----------|---------|-----------------------|
| `POST` | `/question-groups/:groupId/questions` | Create question | ✅ Complete |
| `PATCH` | `/questions/:id` | Update question | ✅ Complete |
| `DELETE` | `/questions/:id` | Delete question | ✅ Complete |
| `PATCH` | `/question-groups/:groupId/questions/reorder` | Reorder questions | ✅ Complete |

#### Legacy Implementation (`questionnaires.ts`)
| Method | Endpoint | Purpose | Implementation Status |
|--------|----------|---------|-----------------------|
| `GET` | `/` | List questionnaires | ✅ Complete |
| `GET` | `/:id` | Get questionnaire | ✅ Complete |
| `POST` | `/` | Create questionnaire | ✅ Complete |
| `POST` | `/:id/analysis` | Trigger LLM analysis | ✅ Complete |
| `GET` | `/:id/analysis` | Get analysis results | ✅ Complete |
| `POST` | `/responses` | Submit response | ✅ Complete |
| `POST` | `/responses/consent` | Record consent | ✅ Complete |

### Frontend Components Using Questionnaire APIs
- `questionnaire-manager.ts` - Mixed axios/fetch pattern
- `questionnaire-builder.ts` - Builder interface
- `questionnaire-preview.ts` - Preview functionality
- `questionnaire-preview-page.ts` - Public preview

### Data Flow Validation
- ✅ Questionnaire CRUD fully implemented in new API
- ✅ Question and question group management complete
- ⚠️ Mixed API usage patterns (axios vs fetch)
- ⚠️ Two separate questionnaire API implementations
- ✅ LLM analysis integration available

## 4. Additional Backend Routes (Not Actively Used by Frontend)

### File Management
- `/api/v1/files` - File upload/management
- `/api/v1/files/signed` - Signed URL generation

### Enrollment Management
- `/api/v1/enrollments` - Workshop enrollments

### Response Management
- `/api/v1/responses` - Questionnaire responses

### Public Routes
- `/api/v1/public` - Public access endpoints

### Preview System
- `/api/v1/preview` - Real-time preview functionality

### Performance Monitoring
- `/api/v1/performance` - Performance metrics
- `/api/v1/performance/enhanced` - Enhanced monitoring

## 5. Real-time Communication

### WebSocket Service
- **Implementation**: `src/services/websocketService.ts`
- **Frontend Integration**: Not currently implemented
- **Purpose**: Real-time preview, live collaboration

## 6. API Inconsistencies and Issues

### Missing Backend Implementations
1. **Workshop Sessions/Modules**: Frontend service exists but backend not implemented
2. **Workshop Utilities**: Slug generation, validation, import/export missing
3. **Password Reset**: Auth service calls but endpoints not implemented
4. **File Upload**: Workshop service references but not implemented

### Mixed Communication Patterns
1. **Auth Service**: Uses Axios with interceptors
2. **Workshop Service**: Uses Axios with different base URL
3. **Questionnaire Components**: Mix of Axios and fetch()
4. **Inconsistent Error Handling**: Different patterns across services

### API Version Inconsistencies
1. **Auth Service**: Uses `/api` base (proxied)
2. **Workshop Service**: Uses `/api/v1/workshops`
3. **Questionnaire**: Mix of old and new API endpoints

### Data Flow Issues
1. **Token Management**: Inconsistent token storage approaches
2. **Authentication**: Some routes may lack proper middleware
3. **Error Response Formats**: Inconsistent across endpoints

## 7. Recommendations

### Immediate Actions
1. **Implement Missing Workshop APIs**: Sessions, modules, utilities
2. **Standardize HTTP Client**: Choose Axios or fetch consistently
3. **Implement Password Reset**: Complete auth flow
4. **Consolidate Questionnaire APIs**: Remove duplication

### Medium-term Improvements
1. **API Version Standardization**: Consistent `/api/v1/` usage
2. **Error Response Standardization**: Consistent format across all endpoints
3. **Type Safety**: Shared TypeScript types between frontend and backend
4. **WebSocket Integration**: Implement real-time features

### Long-term Architecture
1. **GraphQL Migration**: Consider for complex data requirements
2. **Service Worker**: Offline support and caching
3. **Event-Driven Architecture**: Better decoupling of features
4. **Microservices**: Separate concerns for scalability

## 8. Active Data Flow Summary

### Currently Working End-to-End Flows
1. **Authentication**: ✅ Complete flow (login → token management → protected routes)
2. **Workshop CRUD**: ✅ Basic workshop management
3. **Questionnaire Management**: ✅ Complete (using new API)
4. **Question/Group Management**: ✅ Complete
5. **LLM Analysis**: ✅ Working (legacy API)

### Partially Implemented Flows
1. **Workshop Session Management**: ❌ Frontend exists, backend missing
2. **File Management**: ⚠️ Backend exists, frontend integration partial
3. **Real-time Features**: ⚠️ Backend infrastructure exists, frontend not connected

### Dead/Legacy Code
1. **Old Questionnaire API**: Partially superseded but still used
2. **Mixed HTTP Client Patterns**: Inconsistent approaches
3. **Unused Backend Routes**: Several implemented but not used by frontend

This mapping provides a comprehensive overview of the current state of frontend-backend communication and identifies areas needing attention for consistency and completeness.