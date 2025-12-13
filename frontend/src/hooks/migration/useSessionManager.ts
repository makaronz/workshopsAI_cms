import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../../services/auth';
import migrationApiClient from '../../services/migration/api-client';

export interface SessionState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionSource: 'redis' | 'database' | 'hybrid' | 'local';
  lastActivity: Date | null;
  sessionValidUntil: Date | null;
  migrationPhase: string;
}

export interface SessionConfig {
  activityThreshold: number; // Minutes of inactivity before warning
  gracePeriod: number; // Minutes after warning before logout
  enableIdleDetection: boolean;
  enableMigrationNotifications: boolean;
  autoRefreshThreshold: number; // Minutes before expiry to refresh
}

const DEFAULT_CONFIG: SessionConfig = {
  activityThreshold: 15,
  gracePeriod: 5,
  enableIdleDetection: true,
  enableMigrationNotifications: true,
  autoRefreshThreshold: 5
};

export const useSessionManager = (config: Partial<SessionConfig> = {}) => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [sessionState, setSessionState] = useState<SessionState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    sessionSource: 'local',
    lastActivity: null,
    sessionValidUntil: null,
    migrationPhase: 'pre-migration'
  });

  const [migrationNotification, setMigrationNotification] = useState<{
    visible: boolean;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });

  const [idleWarning, setIdleWarning] = useState<{
    visible: boolean;
    timeRemaining: number;
  }>({
    visible: false,
    timeRemaining: 0
  });

  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const graceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session
  useEffect(() => {
    initializeSession();

    return () => {
      // Cleanup timers
      if (activityTimerRef.current) clearInterval(activityTimerRef.current);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    };
  }, []);

  const initializeSession = async () => {
    try {
      // Get current session info
      const sessionInfo = await migrationApiClient.get<{
        user: User;
        source: 'redis' | 'database' | 'hybrid' | 'local';
        expiresAt: string;
        migrationPhase: string;
      }>('/auth/session-info', {
        cache: {
          strategy: 'network-first',
          ttl: 60000
        }
      });

      const migrationStatus = migrationApiClient.getMigrationStatus();

      setSessionState({
        user: sessionInfo.user,
        isLoading: false,
        isAuthenticated: !!sessionInfo.user,
        sessionSource: sessionInfo.source || 'local',
        lastActivity: new Date(),
        sessionValidUntil: sessionInfo.expiresAt ? new Date(sessionInfo.expiresAt) : null,
        migrationPhase: migrationStatus?.phase || 'pre-migration'
      });

      // Start timers
      startActivityMonitoring();
      startSessionRefreshMonitoring(sessionInfo.expiresAt);
      checkMigrationStatus();

    } catch (error) {
      console.error('Failed to initialize session:', error);
      setSessionState(prev => ({
        ...prev,
        isLoading: false,
        isAuthenticated: false,
        sessionSource: 'local'
      }));
    }
  };

  const startActivityMonitoring = () => {
    if (!mergedConfig.enableIdleDetection) return;

    const updateActivity = () => {
      setSessionState(prev => ({
        ...prev,
        lastActivity: new Date()
      }));

      // Reset idle warning
      if (idleWarning.visible) {
        setIdleWarning({ visible: false, timeRemaining: 0 });
        if (graceTimerRef.current) {
          clearTimeout(graceTimerRef.current);
        }
      }
    };

    // Track various user activities
    const activities = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
    ];

    activities.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // Check for inactivity periodically
    activityTimerRef.current = setInterval(() => {
      checkIdleStatus();
    }, 60000); // Check every minute
  };

  const checkIdleStatus = () => {
    if (!sessionState.lastActivity || !mergedConfig.enableIdleDetection) return;

    const now = new Date();
    const inactiveMinutes = (now.getTime() - sessionState.lastActivity.getTime()) / (1000 * 60);

    if (inactiveMinutes >= mergedConfig.activityThreshold) {
      const timeRemaining = mergedConfig.gracePeriod;

      setIdleWarning({
        visible: true,
        timeRemaining
      });

      // Start grace period timer
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
      }

      graceTimerRef.current = setTimeout(() => {
        handleSessionTimeout();
      }, mergedConfig.gracePeriod * 60 * 1000);
    }
  };

  const handleSessionTimeout = async () => {
    try {
      await migrationApiClient.post('/auth/extend-session', {
        source: 'idle-timeout'
      });

      // Session extended successfully
      setIdleWarning({ visible: false, timeRemaining: 0 });

      showNotification({
        message: 'Session extended due to inactivity',
        type: 'info'
      });

    } catch (error) {
      // Cannot extend session, logout
      await handleLogout();
      showNotification({
        message: 'Session expired due to inactivity',
        type: 'warning'
      });
    }
  };

  const startSessionRefreshMonitoring = (expiresAt?: string) => {
    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();
    const refreshTime = expiryTime - (mergedConfig.autoRefreshThreshold * 60 * 1000);
    const now = Date.now();

    if (refreshTime > now) {
      const delay = refreshTime - now;

      refreshTimerRef.current = setTimeout(() => {
        refreshSession();
      }, delay);
    }
  };

  const refreshSession = async () => {
    try {
      const response = await migrationApiClient.post<{
        expiresAt: string;
        source: string;
      }>('/auth/refresh-session');

      setSessionState(prev => ({
        ...prev,
        sessionValidUntil: new Date(response.expiresAt)
      }));

      // Restart monitoring with new expiry
      startSessionRefreshMonitoring(response.expiresAt);

      showNotification({
        message: 'Session refreshed successfully',
        type: 'success',
        duration: 3000
      });

    } catch (error) {
      console.error('Failed to refresh session:', error);
      showNotification({
        message: 'Failed to refresh session',
        type: 'error'
      });
    }
  };

  const checkMigrationStatus = async () => {
    if (!mergedConfig.enableMigrationNotifications) return;

    try {
      const status = await migrationApiClient.get<{
        phase: string;
        message?: string;
        estimatedCompletion?: string;
      }>('/system/migration/session-status', {
        cache: {
          strategy: 'cache-first',
          ttl: 30000
        }
      });

      if (status.phase !== sessionState.migrationPhase) {
        // Migration phase changed
        setSessionState(prev => ({
          ...prev,
          migrationPhase: status.phase
        }));

        const messages: Record<string, string> = {
          'pre-migration': 'Preparing for system migration...',
          'migration': 'System migration in progress. Some features may be temporarily unavailable.',
          'post-migration': 'Migration complete. Verifying systems...',
          'complete': 'Migration successfully completed!'
        };

        showNotification({
          message: status.message || messages[status.phase] || 'System update in progress',
          type: status.phase === 'complete' ? 'success' : 'info',
          duration: 10000
        });
      }
    } catch (error) {
      // Migration status endpoint might not exist
      console.log('Migration status not available');
    }
  };

  const showNotification = (notification: {
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    duration?: number;
  }) => {
    setMigrationNotification({
      visible: true,
      message: notification.message,
      type: notification.type
    });

    if (notification.duration) {
      setTimeout(() => {
        setMigrationNotification(prev => ({ ...prev, visible: false }));
      }, notification.duration);
    }
  };

  const extendSession = useCallback(async () => {
    try {
      await refreshSession();
      return true;
    } catch (error) {
      console.error('Failed to extend session:', error);
      return false;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await migrationApiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setSessionState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        sessionSource: 'local',
        lastActivity: null,
        sessionValidUntil: null,
        migrationPhase: 'pre-migration'
      });
    }
  }, []);

  const handleLogin = useCallback(async (credentials: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => {
    try {
      const response = await migrationApiClient.post<{
        user: User;
        expiresAt: string;
        source: string;
      }>('/auth/login', credentials);

      setSessionState({
        user: response.user,
        isLoading: false,
        isAuthenticated: true,
        sessionSource: response.source || 'local',
        lastActivity: new Date(),
        sessionValidUntil: new Date(response.expiresAt),
        migrationPhase: migrationApiClient.getMigrationStatus()?.phase || 'pre-migration'
      });

      // Restart monitoring
      startActivityMonitoring();
      startSessionRefreshMonitoring(response.expiresAt);

      return response;
    } catch (error) {
      throw error;
    }
  }, []);

  const getSessionHealth = useCallback(() => {
    const now = new Date();
    const health = {
      isHealthy: true,
      issues: [] as string[],
      timeUntilExpiry: sessionState.sessionValidUntil
        ? sessionState.sessionValidUntil.getTime() - now.getTime()
        : null,
      recommendations: [] as string[]
    };

    // Check session expiry
    if (health.timeUntilExpiry && health.timeUntilExpiry < 5 * 60 * 1000) {
      health.isHealthy = false;
      health.issues.push('Session expires soon');
      health.recommendations.push('Refresh session or logout');
    }

    // Check migration phase
    if (sessionState.migrationPhase === 'migration') {
      health.issues.push('System migration in progress');
      health.recommendations.push('Save work frequently');
    }

    // Check session source
    if (sessionState.sessionSource === 'local') {
      health.issues.push('Using local session storage');
      health.recommendations.push('Session will not persist across devices');
    }

    return health;
  }, [sessionState]);

  return {
    sessionState,
    migrationNotification,
    idleWarning,
    extendSession,
    handleLogout,
    handleLogin,
    getSessionHealth,
    dismissMigrationNotification: () => setMigrationNotification(prev => ({ ...prev, visible: false })),
    extendIdleSession: () => {
      setSessionState(prev => ({ ...prev, lastActivity: new Date() }));
      setIdleWarning({ visible: false, timeRemaining: 0 });
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
      }
    }
  };
};