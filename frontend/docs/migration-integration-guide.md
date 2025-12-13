# Redis Migration Frontend Integration Guide

This guide explains how to use the migration utilities to ensure seamless frontend operation during Redis elimination.

## Overview

The migration utilities provide:
- **Migration-aware API client** with automatic fallbacks
- **Session management** with migration transparency
- **Performance monitoring** during migration
- **Error boundaries** for migration resilience
- **User notifications** for migration updates
- **Cache warming** strategies
- **Progressive enhancement** capabilities

## Quick Start

### 1. Wrap Your App with Migration Error Boundary

```tsx
// App.tsx
import React from 'react';
import { MigrationErrorBoundary } from './components/migration';
import AppContent from './AppContent';

function App() {
  return (
    <MigrationErrorBoundary
      enableFallbackMode={true}
      maxRetries={3}
      reportErrors={true}
      onError={(error, errorInfo) => {
        // Custom error handling
        console.error('App error:', error, errorInfo);
      }}
    >
      <AppContent />
    </MigrationErrorBoundary>
  );
}
```

### 2. Add Migration Monitoring

```tsx
// AppContent.tsx
import React from 'react';
import { MigrationMonitor, PerformanceMonitor } from './components/migration';
import { useMigrationNotifications } from './components/migration';

function AppContent() {
  const { notifications, addNotification } = useMigrationNotifications();

  return (
    <>
      {/* Migration monitoring widgets */}
      <MigrationMonitor visible={process.env.NODE_ENV === 'development'} />
      <PerformanceMonitor visible={false} position="bottom" />

      {/* Your app content */}
      <YourMainApp />

      {/* Notification manager */}
      <MigrationNotificationManager
        notifications={notifications}
        onDismiss={(id) => {
          // Handle notification dismissal
        }}
      />
    </>
  );
}
```

### 3. Use Migration-Aware API Client

```tsx
// services/workshop.ts
import { migrationApiClient } from './services/migration';

export async function fetchWorkshops() {
  return migrationApiClient.get('/workshops', {
    cache: {
      strategy: 'cache-first',
      ttl: 300000, // 5 minutes
      tag: 'workshops'
    }
  });
}

export async function createWorkshop(data: any) {
  return migrationApiClient.post('/workshops', data, {
    headers: {
      'X-Cache-Tag': 'workshops' // Invalidate cache
    }
  }, {
    retry: {
      maxRetries: 3,
      retryDelay: 1000
    }
  });
}
```

### 4. Manage Sessions with Migration Support

```tsx
// hooks/useAuth.ts
import { useSessionManager } from './hooks/migration/useSessionManager';

export function useAuth() {
  const {
    sessionState,
    migrationNotification,
    idleWarning,
    extendSession,
    handleLogin,
    handleLogout
  } = useSessionManager({
    activityThreshold: 15,
    gracePeriod: 5,
    enableIdleDetection: true,
    enableMigrationNotifications: true
  });

  return {
    user: sessionState.user,
    isAuthenticated: sessionState.isAuthenticated,
    login: handleLogin,
    logout: handleLogout,
    extendSession,
    migrationStatus: sessionState.migrationPhase,
    idleWarning
  };
}
```

## Advanced Usage

### Cache Warming

```tsx
// utils/cache-strategies.ts
import { cacheWarmingService } from './services/migration';

// Warm cache for specific user
async function warmUserCache(userId: string) {
  await cacheWarmingService.warmUserSpecificContext(userId);
}

// Warm cache for workshop
async function warmWorkshopCache(workshopId: string) {
  await cacheWarmingService.warmWorkshopContext(workshopId);
}

// Warm based on migration phase
async function warmForMigration() {
  const phase = migrationApiClient.getMigrationStatus()?.phase;
  if (phase) {
    await cacheWarmingService.warmForMigrationPhase(phase);
  }
}
```

### Progressive Enhancement

```tsx
// components/WorkshopEditor.tsx
import { progressive, progressiveEnhancementService } from './services/migration';
import MigrationErrorBoundary from './components/migration/MigrationErrorBoundary';

class WorkshopEditor extends React.Component {
  // Use decorator for progressive enhancement
  @progressive('workshop-editor', 'enhanced')
  async loadAdvancedFeatures() {
    // Load enhanced editor features
  }

  // Or use service directly
  async saveWorkshop(data: any) {
    try {
      // Try enhanced save with real-time collaboration
      return await progressiveEnhancementService.executeFeature(
        'collaborative-save',
        'advanced'
      );
    } catch (error) {
      // Fall back to basic save
      return await this.basicSave(data);
    }
  }

  render() {
    return (
      <MigrationErrorBoundary
        fallback={<BasicEditor />}
        enableFallbackMode={true}
      >
        {this.renderEnhancedEditor()}
      </MigrationErrorBoundary>
    );
  }
}
```

### Custom Migration Notifications

```tsx
// hooks/useMigrationNotifications.ts
import { useMigrationNotifications } from './components/migration';

export function useCustomNotifications() {
  const {
    showMigrationStart,
    showMigrationProgress,
    showMigrationComplete,
    showServiceDegradation,
    showOfflineMode,
    showSessionExpiring
  } = useMigrationNotifications();

  const notifyMigrationUpdate = async (update: any) => {
    switch (update.type) {
      case 'START':
        showMigrationStart(update.estimatedDuration);
        break;
      case 'PROGRESS':
        showMigrationProgress(update.phase, update.progress);
        break;
      case 'COMPLETE':
        showMigrationComplete();
        break;
      case 'DEGRADATION':
        showServiceDegradation(update.service, update.reason);
        break;
    }
  };

  return { notifyMigrationUpdate };
}
```

## Configuration

### Migration Client Configuration

```tsx
// config/migration.ts
import { migrationApiClient } from '../services/migration';

// Configure default retry behavior
migrationApiClient.updateConfig({
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
    retryCondition: (error) => {
      // Retry on network errors and 5xx
      return !error.response || error.response.status >= 500;
    }
  },
  cache: {
    defaultTtl: 300000,
    defaultStrategy: 'cache-first'
  }
});
```

### Progressive Enhancement Configuration

```tsx
// config/progressive.ts
import { progressiveEnhancementService } from '../services/migration';

progressiveEnhancementService.registerFeature({
  name: 'real-time-collaboration',
  required: false,
  fallbackAvailable: true,
  checkImplementation: async () => {
    return 'WebSocket' in window && 'RTCPeerConnection' in window;
  },
  progressiveLevels: {
    basic: async () => {
      // Polling-based updates
      return startPollingUpdates();
    },
    enhanced: async () => {
      // Server-sent events
      return startSSEUpdates();
    },
    advanced: async () => {
      // WebSocket real-time
      return startWebSocketUpdates();
    }
  },
  fallbackImplementation: async () => {
    // Manual refresh required
    return { requiresManualRefresh: true };
  }
});
```

## Testing Migration Scenarios

### Mock Migration States

```tsx
// test/migration-mock.ts
export function mockMigrationPhase(phase: string) {
  window.dispatchEvent(new CustomEvent('migration-phase-changed', {
    detail: { phase }
  }));
}

// Simulate network degradation
export function simulateSlowNetwork() {
  Object.defineProperty(navigator, 'connection', {
    value: {
      effectiveType: 'slow-2g',
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    writable: true
  });
}
```

### Testing Components

```tsx
// test/MigrationTestUtils.tsx
import React from 'react';
import { render } from '@testing-library/react';
import { MigrationErrorBoundary } from '../components/migration';

export function renderWithMigration(
  component: React.ReactElement,
  options = {}
) {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MigrationErrorBoundary enableFallbackMode={true}>
      {children}
    </MigrationErrorBoundary>
  );

  return render(component, { wrapper: Wrapper, ...options });
}
```

## Best Practices

### 1. Graceful Degradation

- Always provide fallbacks for critical features
- Use progressive enhancement for non-critical features
- Implement offline modes for data synchronization

### 2. User Experience

- Keep users informed about migration progress
- Provide clear error messages with recovery options
- Maintain context during session refreshes

### 3. Performance

- Warm caches strategically based on user behavior
- Use appropriate caching strategies per endpoint
- Monitor performance metrics during migration

### 4. Error Handling

- Use migration-aware error boundaries
- Implement retry logic with exponential backoff
- Log migration-specific errors separately

### 5. Testing

- Test all migration phases
- Simulate network failures and slow connections
- Verify fallback functionality

## Migration Checklist

- [ ] Wrap application with MigrationErrorBoundary
- [ ] Add migration monitoring components
- [ ] Implement session management hooks
- [ ] Configure cache warming strategies
- [ ] Set up progressive enhancement for features
- [ ] Add migration notifications
- [ ] Test all migration scenarios
- [ ] Verify fallback functionality
- [ ] Monitor performance during migration
- [ ] Document any custom behaviors