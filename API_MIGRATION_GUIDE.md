# API Client Migration Guide

## Overview

This guide outlines the migration from fragmented API client setup to a unified API client architecture for the WorkshopsAI CMS. The migration provides:

- **Centralized Configuration**: Single source of truth for API settings
- **Consistent Authentication**: Unified token management across all services
- **Improved Error Handling**: Standardized error responses and logging
- **Performance Optimization**: Caching, retry mechanisms, and request deduplication
- **Type Safety**: Comprehensive TypeScript support
- **Better Developer Experience**: Easier debugging and monitoring

## Architecture Overview

### Before Migration (Fragmented)

```
frontend/src/services/
├── auth.ts          // Custom Axios instance with interceptors
├── workshop.ts      // Separate Axios instance + helper functions
├── dashboard-api.ts // Another Axios instance
└── i18n.ts          // Language service
```

**Issues:**
- Duplicated Axios configuration
- Inconsistent error handling
- Scattered authentication logic
- Different timeout values
- No caching strategy
- Varying retry mechanisms

### After Migration (Unified)

```
frontend/src/
├── lib/
│   ├── api-config.ts      // Central configuration and endpoints
│   └── api-client.ts      // Unified API client with features
├── services/
│   ├── auth-service.ts    // Auth service using unified client
│   ├── workshop-service.ts // Workshop service using unified client
│   ├── dashboard-service.ts // Dashboard service using unified client
│   └── [existing services will be migrated]
```

**Benefits:**
- Single source of truth for configuration
- Consistent authentication and error handling
- Built-in caching and retry mechanisms
- Performance monitoring and logging
- Type-safe API responses
- Easy testing and mocking

## Migration Steps

### Phase 1: Infrastructure Setup ✅ COMPLETED

1. **Created core modules:**
   - `frontend/src/lib/api-config.ts` - Configuration management
   - `frontend/src/lib/api-client.ts` - Unified API client

2. **New service implementations:**
   - `frontend/src/services/auth-service.ts` - Migrated auth service
   - `frontend/src/services/workshop-service.ts` - Migrated workshop service
   - `frontend/src/services/dashboard-service.ts` - Migrated dashboard service

### Phase 2: Service Migration (In Progress)

#### 2.1 Update Imports

**Old:**
```typescript
import { authService } from '@/services/auth';
import { workshopService } from '@/services/workshop';
```

**New:**
```typescript
import { authService } from '@/services/auth-service';
import { workshopService } from '@/services/workshop-service';
```

#### 2.2 Update Usage Patterns

**Error Handling:**
```typescript
// Old
try {
  const workshops = await workshopService.getWorkshops();
} catch (error: any) {
  console.error(error.message);
  // Different error structure across services
}

// New
try {
  const workshops = await workshopService.getWorkshops();
} catch (error: any) {
  console.error(error.message, error.status, error.details);
  // Consistent error structure
}
```

**Authentication:**
```typescript
// Old
const user = await authService.getCurrentUser();
if (user) {
  // Manual token validation
}

// New
const user = await authService.getCurrentUser();
// Automatic token validation and refresh
```

#### 2.3 Component Updates

Update all components importing the old services:

1. **Authentication Components:**
   - Update imports from `auth.ts` to `auth-service.ts`
   - Update error handling to use new error structure
   - No changes needed for method signatures

2. **Workshop Management:**
   - Update imports from `workshop.ts` to `workshop-service.ts`
   - Benefit from automatic caching and retry logic
   - Enhanced error messages with validation details

3. **Dashboard Components:**
   - Update imports from `dashboard-api.ts` to `dashboard-service.ts`
   - Benefit from performance optimizations and caching

### Phase 3: Advanced Features (Future)

1. **Request Caching Configuration:**
   ```typescript
   // Custom cache settings per service
   const workshopClient = createApiClient({
     timeout: 45000,
     enableCache: true,
     retryAttempts: 4
   });
   ```

2. **Performance Monitoring:**
   ```typescript
   // Built-in request timing and logging
   apiClient.get('/workshops'); // Auto-logged in development
   ```

3. **Custom Interceptors:**
   ```typescript
   // Add custom request/response processing
   const customClient = createApiClient({
     interceptors: {
       request: (config) => { /* custom logic */ },
       response: (response) => { /* custom logic */ }
     }
   });
   ```

## Configuration

### Environment Variables

```bash
# .env
VITE_API_URL=https://api.workshopsai.com/api  # Production API
VITE_API_URL=/api                            # Development with Vite proxy
```

### Service-Specific Configurations

```typescript
// api-config.ts provides optimized defaults:
- auth: 15s timeout, 2 retries, no cache
- workshops: 30s timeout, 3 retries, cached
- dashboard: 20s timeout, 2 retries, cached (1min)
- upload: 60s timeout, 1 retry, no cache
```

## Benefits Achieved

### Performance Improvements

1. **Request Caching:**
   - Workshop lists cached for 5 minutes
   - Dashboard data cached for 1 minute
   - Auth requests never cached

2. **Retry Logic:**
   - Exponential backoff with jitter
   - Smart retry (no retry for 4xx errors)
   - Configurable per service type

3. **Connection Optimization:**
   - Request deduplication for identical requests
   - Automatic timeout management
   - Proper connection pooling

### Developer Experience

1. **Consistent API:**
   ```typescript
   // Same pattern across all services
   const data = await someService.getData(params);
   const result = await someService.createData(payload);
   ```

2. **Type Safety:**
   ```typescript
   interface WorkshopResponse {
     data: Workshop[];
     meta: { pagination: PaginationInfo };
   }

   const workshops = await workshopService.getWorkshops();
   // Full TypeScript support with autocompletion
   ```

3. **Error Handling:**
   ```typescript
   try {
     const result = await someService.operation();
   } catch (error: ApiError) {
     // Consistent error structure
     console.log(error.message, error.status, error.details);
   }
   ```

### Monitoring & Debugging

1. **Request Logging:**
   - Automatic request/response logging in development
   - Request ID tracking for debugging
   - Performance timing metrics

2. **Error Tracking:**
   - Structured error responses
   - Request metadata for debugging
   - Stack trace preservation

## Testing Strategy

### Unit Tests

```typescript
// Mock the API client
jest.mock('@/lib/api-client');

// Test service logic
test('should fetch workshops successfully', async () => {
  const mockWorkshops = [/* workshop data */];
  apiClient.get.mockResolvedValue(mockWorkshops);

  const result = await workshopService.getWorkshops();
  expect(result).toEqual(mockWorkshops);
});
```

### Integration Tests

```typescript
// Test with actual API client
test('should handle API errors gracefully', async () => {
  const mockError = { message: 'Not found', status: 404 };
  apiClient.get.mockRejectedValue(mockError);

  await expect(workshopService.getWorkshop('invalid-id'))
    .rejects.toThrow('Not found');
});
```

## Backward Compatibility

The migration maintains backward compatibility:

1. **Method Signatures:** All existing method signatures preserved
2. **Response Formats:** Consistent with current response structures
3. **Error Handling:** Enhanced but compatible with existing code
4. **Import Paths:** Old files remain during transition period

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback:** Revert import paths to old services
2. **Gradual Migration:** Migrate one service at a time
3. **Feature Flags:** Use feature flags to control new client usage
4. **Monitoring:** Track error rates and performance metrics

## Monitoring & Metrics

Track the following metrics during and after migration:

1. **Performance:**
   - API response times
   - Cache hit rates
   - Retry success rates
   - Error rates

2. **User Experience:**
   - Page load times
   - User interaction latency
   - Error message clarity
   - Success completion rates

3. **Developer Metrics:**
   - Code reduction
   - Type safety improvements
   - Debugging efficiency
   - Test coverage

## Next Steps

1. **Complete Migration:** Update all components to use new services
2. **Remove Old Files:** Clean up deprecated service files
3. **Add Advanced Features:** Implement custom interceptors and monitoring
4. **Performance Tuning:** Optimize cache strategies and retry logic
5. **Documentation:** Create comprehensive API documentation

## Support

For questions or issues during migration:

1. Check console logs for detailed error information
2. Review the unified API client source code in `frontend/src/lib/`
3. Test with development environment first
4. Monitor network tab for request/response details
5. Use browser dev tools to debug caching behavior

---

**Migration Status:** ✅ Infrastructure Complete | 🔄 Services Migrating | ⏳ Testing Phase