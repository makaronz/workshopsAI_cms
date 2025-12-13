import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Notification } from '../ui/notification';

export interface MigrationNotificationConfig {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  duration?: number; // Auto-dismiss after ms (null = manual dismiss only)
  persistent?: boolean; // Cannot be dismissed manually
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  }>;
  progress?: {
    current: number;
    total: number;
    label?: string;
  };
  icon?: string;
}

const MigrationNotification: React.FC<{
  config: MigrationNotificationConfig;
  onDismiss?: (id: string) => void;
  className?: string;
}> = ({
  config,
  onDismiss,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    config.duration ? config.duration / 1000 : null
  );

  useEffect(() => {
    if (config.duration && timeRemaining !== null) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev !== null && prev > 0) {
            const newValue = prev - 1;
            if (newValue === 0) {
              handleDismiss();
            }
            return newValue;
          }
          return null;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [config.duration]);

  const handleDismiss = () => {
    if (!config.persistent) {
      setIsVisible(false);
      setTimeout(() => {
        onDismiss?.(config.id);
      }, 300); // Wait for animation
    }
  };

  const handleAction = (action: () => void) => {
    action();
    if (config.duration !== null) {
      handleDismiss();
    }
  };

  const getNotificationIcon = (): string => {
    if (config.icon) return config.icon;

    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      success: '✅',
      error: '❌'
    };

    return icons[config.type] || 'ℹ️';
  };

  const getProgressPercentage = (): number => {
    if (!config.progress) return 0;
    return (config.progress.current / config.progress.total) * 100;
  };

  if (!isVisible) return null;

  return (
    <div className={`migration-notification ${className}`}>
      <Notification
        type={config.type}
        visible={true}
        onDismiss={config.persistent ? undefined : handleDismiss}
        className="max-w-lg"
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">
            {getNotificationIcon()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 dark:text-white mb-1">
              {config.title}
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {config.message}
            </div>

            {/* Progress bar */}
            {config.progress && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>{config.progress.label || 'Progress'}</span>
                  <span>{config.progress.current} / {config.progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            {config.actions && config.actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.actions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant || 'outline'}
                    size="sm"
                    onClick={() => handleAction(action.action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Auto-dismiss timer */}
            {timeRemaining !== null && timeRemaining > 0 && !config.persistent && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Auto-dismissing in {timeRemaining}s
              </div>
            )}
          </div>
        </div>
      </Notification>
    </div>
  );
};

// Notification Manager for handling multiple notifications
export const MigrationNotificationManager: React.FC<{
  notifications: MigrationNotificationConfig[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxVisible?: number;
}> = ({
  notifications,
  onDismiss,
  position = 'top-right',
  maxVisible = 5
}) => {
  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  const visibleNotifications = notifications.slice(-maxVisible);

  return (
    <div className={`fixed z-50 ${positionClasses[position]} space-y-2 pointer-events-none`}>
      {visibleNotifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <MigrationNotification
            config={notification}
            onDismiss={onDismiss}
          />
        </div>
      ))}
    </div>
  );
};

// Hook for managing migration notifications
export const useMigrationNotifications = () => {
  const [notifications, setNotifications] = useState<MigrationNotificationConfig[]>([]);

  const addNotification = (config: Omit<MigrationNotificationConfig, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification: MigrationNotificationConfig = {
      ...config,
      id
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove after duration
    if (config.duration && !config.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, config.duration + 300); // Add buffer for animation
    }

    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Predefined notification types
  const showMigrationStart = (estimatedDuration?: number) => {
    return addNotification({
      type: 'info',
      title: 'System Migration Started',
      message: `We're upgrading our systems to provide you with better service.${
        estimatedDuration ? ` Estimated duration: ${estimatedDuration} minutes.` : ''
      } You may experience temporary interruptions.`,
      duration: 10000,
      persistent: false,
      icon: '🚀',
      actions: [
        {
          label: 'Learn More',
          action: () => window.open('/docs/migration', '_blank'),
          variant: 'outline'
        }
      ]
    });
  };

  const showMigrationProgress = (phase: string, progress: number) => {
    return addNotification({
      type: 'info',
      title: `Migration: ${phase}`,
      message: `Migration in progress. Current phase: ${phase}`,
      duration: null,
      persistent: false,
      icon: '⚙️',
      progress: {
        current: progress,
        total: 100,
        label: 'Overall Progress'
      }
    });
  };

  const showMigrationComplete = () => {
    return addNotification({
      type: 'success',
      title: 'Migration Complete!',
      message: 'System migration completed successfully. All services are now fully operational.',
      duration: 8000,
      persistent: false,
      icon: '🎉',
      actions: [
        {
          label: 'View Changes',
          action: () => window.open('/docs/whats-new', '_blank'),
          variant: 'primary'
        }
      ]
    });
  };

  const showServiceDegradation = (service: string, reason?: string) => {
    return addNotification({
      type: 'warning',
      title: `${service} Service Degraded`,
      message: `The ${service} service is temporarily experiencing degraded performance.${
        reason ? ` Reason: ${reason}` : ''
      } We're working to restore full functionality.`,
      duration: 15000,
      persistent: false,
      icon: '⚠️',
      actions: [
        {
          label: 'Check Status',
          action: () => window.open('/system/status', '_blank'),
          variant: 'outline'
        }
      ]
    });
  };

  const showOfflineMode = () => {
    return addNotification({
      type: 'warning',
      title: 'Offline Mode Active',
      message: 'You\'re currently in offline mode. Changes will be synced when connection is restored.',
      duration: null,
      persistent: true,
      icon: '📴',
      actions: [
        {
          label: 'Try Reconnect',
          action: () => window.location.reload(),
          variant: 'primary'
        }
      ]
    });
  };

  const showSessionExpiring = (minutes: number) => {
    return addNotification({
      type: 'warning',
      title: 'Session Expiring Soon',
      message: `Your session will expire in ${minutes} minute${minutes !== 1 ? 's' : ''}. Would you like to extend it?`,
      duration: 60000,
      persistent: false,
      icon: '⏰',
      actions: [
        {
          label: 'Extend Session',
          action: () => {
            // Dispatch custom event for session extension
            window.dispatchEvent(new CustomEvent('extendSession'));
          },
          variant: 'primary'
        }
      ]
    });
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showMigrationStart,
    showMigrationProgress,
    showMigrationComplete,
    showServiceDegradation,
    showOfflineMode,
    showSessionExpiring
  };
};

export default MigrationNotification;