import React, { useEffect, useState } from 'react';
import {
  MigrationErrorBoundary,
  MigrationMonitor,
  PerformanceMonitor,
  MigrationNotificationManager,
  useMigrationNotifications
} from './components/migration';
import { useSessionManager } from './hooks/migration/useSessionManager';
import { migrationApiClient } from './services/migration/api-client';
import { cacheWarmingService } from './services/migration/cache-warming';
import { progressiveEnhancementService } from './services/migration/progressive-enhancement';
import migrationAuthService from './services/migration-auth';

/**
 * Migration-ready App Component
 * This example shows how to integrate all migration utilities
 */

const AppMigrationReady: React.FC = () => {
  const [isDevelopment, setIsDevelopment] = useState(process.env.NODE_ENV === 'development');
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const { notifications, addNotification } = useMigrationNotifications();

  // Session management
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

  // Initialize migration services
  useEffect(() => {
    initializeMigrationServices();
  }, []);

  const initializeMigrationServices = async () => {
    // Register progressive enhancement features
    registerProgressiveFeatures();

    // Check initial migration status
    const migrationStatus = migrationApiClient.getMigrationStatus();
    if (migrationStatus) {
      handleMigrationPhaseChange(migrationStatus.phase);
    }

    // Set up event listeners
    window.addEventListener('migration-phase-changed', handleMigrationPhaseChange);
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    window.addEventListener('extendSession', handleExtendSession);

    // Initial cache warming
    if (migrationStatus?.phase === 'pre-migration') {
      console.log('Pre-migration cache warming...');
      await cacheWarmingService.warmForMigrationPhase('pre-migration');
    }

    return () => {
      window.removeEventListener('migration-phase-changed', handleMigrationPhaseChange);
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      window.removeEventListener('extendSession', handleExtendSession);
    };
  };

  const registerProgressiveFeatures = () => {
    // Register real-time collaboration
    progressiveEnhancementService.registerFeature({
      name: 'real-time-collaboration',
      required: false,
      fallbackAvailable: true,
      checkImplementation: async () => {
        return 'WebSocket' in window && navigator.onLine;
      },
      progressiveLevels: {
        basic: async () => {
          // Polling-based updates
          console.log('Using polling updates for collaboration');
          return { type: 'polling', interval: 30000 };
        },
        enhanced: async () => {
          // Server-sent events
          console.log('Using SSE for collaboration');
          return { type: 'sse' };
        },
        advanced: async () => {
          // WebSocket real-time
          console.log('Using WebSocket for collaboration');
          return { type: 'websocket' };
        }
      },
      fallbackImplementation: async () => {
        // Manual refresh
        return { type: 'manual', requiresRefresh: true };
      }
    });

    // Register advanced analytics
    progressiveEnhancementService.registerFeature({
      name: 'advanced-analytics',
      required: false,
      fallbackAvailable: true,
      checkImplementation: async () => {
        return 'WebAssembly' in window && 'BigInt64Array' in window;
      },
      progressiveLevels: {
        basic: async () => {
          // Simple charts
          return { type: 'basic-charts' };
        },
        enhanced: async () => {
          // Interactive visualizations
          return { type: 'interactive' };
        },
        advanced: async () => {
          // WebAssembly-accelerated analytics
          return { type: 'wasm-accelerated' };
        }
      },
      fallbackImplementation: async () => {
        // Static reports
        return { type: 'static-reports' };
      }
    });

    // Register file uploads with progress
    progressiveEnhancementService.registerFeature({
      name: 'file-upload-progress',
      required: true,
      fallbackAvailable: true,
      checkImplementation: async () => {
        return 'ReadableStream' in window && 'serviceWorker' in navigator;
      },
      progressiveLevels: {
        basic: async () => {
          // Form-based upload with iframe fallback
          return { type: 'form-upload' };
        },
        enhanced: async () => {
          // XHR with progress events
          return { type: 'xhr-upload' };
        },
        advanced: async () => {
          // Stream-based upload with service worker
          return { type: 'stream-upload' };
        }
      }
    });
  };

  const handleMigrationPhaseChange = async (event: CustomEvent | { detail: { phase: string } }) => {
    const phase = event.detail.phase;
    console.log('Migration phase changed:', phase);

    switch (phase) {
      case 'pre-migration':
        addNotification({
          type: 'info',
          title: 'Migration Scheduled',
          message: 'System maintenance will begin soon. Your work will be saved.',
          duration: 10000
        });
        break;

      case 'migration':
        addNotification({
          type: 'warning',
          title: 'Migration in Progress',
          message: 'Some features may be temporarily unavailable during the upgrade.',
          duration: null,
          persistent: false
        });

        // Enable performance monitoring during migration
        setShowPerformanceMonitor(true);

        // Warm critical cache entries
        await cacheWarmingService.warmForMigrationPhase('migration');
        break;

      case 'post-migration':
        addNotification({
          type: 'info',
          title: 'Migration Complete',
          message: 'System upgrade completed successfully!',
          duration: 8000
        });

        // Warm all cache entries
        await cacheWarmingService.warmForMigrationPhase('post-migration');
        break;
    }
  };

  const handleNetworkChange = () => {
    if (navigator.onLine) {
      addNotification({
        type: 'success',
        title: 'Connection Restored',
        message: 'You\'re back online. Syncing your changes...',
        duration: 5000
      });
    } else {
      addNotification({
        type: 'warning',
        title: 'Offline Mode',
        message: 'You\'re currently offline. Changes will sync when connection is restored.',
        duration: null,
        persistent: true
      });
    }
  };

  const handleExtendSession = async () => {
    const success = await extendSession();
    if (success) {
      addNotification({
        type: 'success',
        title: 'Session Extended',
        message: 'Your session has been extended.',
        duration: 3000
      });
    }
  };

  const handleLogin = async (credentials: { email: string; password: string }) => {
    try {
      await migrationAuthService.login(credentials);
      addNotification({
        type: 'success',
        title: 'Welcome Back!',
        message: 'You have successfully logged in.',
        duration: 5000
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Login Failed',
        message: error.message,
        duration: 5000
      });
    }
  };

  const handleLogout = async () => {
    try {
      await migrationAuthService.logout();
      addNotification({
        type: 'info',
        title: 'Logged Out',
        message: 'You have been successfully logged out.',
        duration: 3000
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="app">
      {/* Migration monitoring */}
      <MigrationMonitor
        visible={isDevelopment}
        position="top-right"
        showDetails={false}
      />

      <PerformanceMonitor
        visible={showPerformanceMonitor}
        position="bottom"
      />

      {/* Session management */}
      {idleWarning.visible && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-amber-100 dark:bg-amber-900 border border-amber-300 dark:border-amber-700 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <div>
              <div className="font-medium">Session Expiring</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Your session will expire in {idleWarning.timeRemaining} minute{idleWarning.timeRemaining !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('extendSession'))}
              className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Extend Session
            </button>
          </div>
        </div>
      )}

      {/* Migration notification */}
      {migrationNotification.visible && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-lg shadow-lg p-4 z-50 max-w-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">ℹ️</span>
            <div className="flex-1">
              <div className="font-medium">{migrationNotification.message}</div>
            </div>
            <button
              onClick={() => migrationNotification.visible = false}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Notification manager */}
      <MigrationNotificationManager
        notifications={notifications}
        onDismiss={(id) => {
          // Handle notification dismissal
        }}
        position="top-right"
        maxVisible={3}
      />

      {/* Main app content */}
      <MigrationErrorBoundary
        enableFallbackMode={true}
        maxRetries={3}
        reportErrors={true}
        onError={(error, errorInfo) => {
          console.error('App error:', error, errorInfo);
          // Report to error tracking service
        }}
      >
        <div className="app-header">
          <h1>WorkshopsAI CMS</h1>

          {/* Development controls */}
          {isDevelopment && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded"
              >
                {showPerformanceMonitor ? 'Hide' : 'Show'} Performance
              </button>

              <button
                onClick={async () => {
                  await cacheWarmingService.warmForMigrationPhase('pre-migration');
                  addNotification({
                    type: 'success',
                    title: 'Cache Warmed',
                    message: 'Pre-migration cache warming completed.',
                    duration: 3000
                  });
                }}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded"
              >
                Warm Cache
              </button>

              <button
                onClick={async () => {
                  window.dispatchEvent(new CustomEvent('migration-phase-changed', {
                    detail: { phase: 'migration' }
                  }));
                }}
                className="px-3 py-1 text-sm bg-amber-200 dark:bg-amber-800 rounded"
              >
                Simulate Migration
              </button>
            </div>
          )}
        </div>

        <div className="app-content">
          {sessionState.isAuthenticated ? (
            <AuthenticatedApp
              user={sessionState.user}
              onLogout={handleLogout}
              migrationPhase={sessionState.migrationPhase}
            />
          ) : (
            <LoginApp onLogin={handleLogin} />
          )}
        </div>
      </MigrationErrorBoundary>
    </div>
  );
};

// Example authenticated app component
const AuthenticatedApp: React.FC<{
  user: any;
  onLogout: () => void;
  migrationPhase: string;
}> = ({ user, onLogout, migrationPhase }) => {
  return (
    <div>
      <div className="user-info">
        <span>Welcome, {user.firstName}!</span>
        <span className="text-sm text-gray-500">
          {migrationPhase === 'migration' && ' (Migration in progress)'}
        </span>
        <button onClick={onLogout}>Logout</button>
      </div>

      <div className="app-features">
        <WorkshopList />
        <AnalyticsDashboard />
        <CollaborativeEditor />
      </div>
    </div>
  );
};

// Example login app component
const LoginApp: React.FC<{ onLogin: (credentials: any) => Promise<void> }> = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(credentials);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={credentials.email}
        onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={credentials.password}
        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};

// Example components using progressive enhancement
const WorkshopList: React.FC = () => {
  return (
    <div>
      <h3>My Workshops</h3>
      {/* Workshop list implementation */}
    </div>
  );
};

const AnalyticsDashboard: React.FC = () => {
  const [level, setLevel] = useState<'basic' | 'enhanced' | 'advanced'>('enhanced');

  return (
    <div>
      <h3>Analytics</h3>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setLevel('basic')}
          className={level === 'basic' ? 'active' : ''}
        >
          Basic
        </button>
        <button
          onClick={() => setLevel('enhanced')}
          className={level === 'enhanced' ? 'active' : ''}
        >
          Enhanced
        </button>
        <button
          onClick={() => setLevel('advanced')}
          className={level === 'advanced' ? 'active' : ''}
        >
          Advanced
        </button>
      </div>
      {/* Analytics implementation with progressive enhancement */}
    </div>
  );
};

const CollaborativeEditor: React.FC = () => {
  return (
    <div>
      <h3>Collaborative Editor</h3>
      {/* Real-time collaboration with fallbacks */}
    </div>
  );
};

export default AppMigrationReady;