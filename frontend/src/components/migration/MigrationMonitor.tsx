import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import migrationApiClient from '../../services/migration/api-client';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loading } from '../ui/loading';

interface MigrationMetrics {
  phase: string;
  progress: number;
  features: {
    caching: 'redis' | 'memory' | 'database';
    sessions: 'redis' | 'database' | 'hybrid';
    queues: 'redis' | 'database' | 'disabled';
  };
  performance: {
    responseTime: number;
    cacheHitRate: number;
    errorRate: number;
    activeConnections: number;
  };
  estimatedCompletion?: Date;
  issues: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }>;
}

const MigrationMonitor: React.FC<{
  visible?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showDetails?: boolean;
  className?: string;
}> = ({
  visible = true,
  position = 'top-right',
  showDetails = false,
  className = ''
}) => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<MigrationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(showDetails);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!visible) return;

    const fetchMetrics = async () => {
      try {
        const [migrationStatus, perfMetrics] = await Promise.all([
          migrationApiClient.getMigrationStatus(),
          migrationApiClient.get('/system/migration/metrics', {
            cache: {
              strategy: 'network-first',
              ttl: 5000
            }
          }).catch(() => null)
        ]);

        const health = await migrationApiClient.healthCheck();

        setMetrics({
          phase: migrationStatus?.phase || 'unknown',
          progress: calculateProgress(migrationStatus?.phase),
          features: migrationStatus?.features || {
            caching: 'redis',
            sessions: 'redis',
            queues: 'redis'
          },
          performance: {
            responseTime: health.details.responseTime || 0,
            cacheHitRate: health.details.performanceMetrics?.cacheHitRate || 0,
            errorRate: (health.details.performanceMetrics?.errors || 0) /
                      (health.details.performanceMetrics?.networkRequests || 1) * 100,
            activeConnections: health.details.pendingRequests || 0
          },
          estimatedCompletion: migrationStatus?.estimatedCompletion,
          issues: [
            ...(health.status === 'degraded' ? [{
              type: 'warning' as const,
              message: 'System performance degraded',
              timestamp: new Date()
            }] : []),
            ...(health.status === 'unhealthy' ? [{
              type: 'error' as const,
              message: 'System experiencing issues',
              timestamp: new Date()
            }] : [])
          ]
        });

        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch migration metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [visible, autoRefresh]);

  const calculateProgress = (phase?: string): number => {
    const progressMap: Record<string, number> = {
      'pre-migration': 0,
      'migration': 50,
      'post-migration': 90,
      'complete': 100
    };
    return progressMap[phase || 'unknown'] || 0;
  };

  const getPhaseColor = (phase: string): string => {
    const colorMap: Record<string, string> = {
      'pre-migration': 'blue',
      'migration': 'yellow',
      'post-migration': 'orange',
      'complete': 'green',
      'unknown': 'gray'
    };
    return colorMap[phase] || 'gray';
  };

  const getFeatureIcon = (feature: string): string => {
    const iconMap: Record<string, string> = {
      'redis': '🔴',
      'memory': '💾',
      'database': '🗄️',
      'hybrid': '🔄',
      'disabled': '❌'
    };
    return iconMap[feature] || '❓';
  };

  if (!visible) return null;

  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  return (
    <div className={`fixed z-50 ${positionClasses[position]} ${className}`}>
      {/* Compact view */}
      {!detailsVisible && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Migration Status
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDetailsVisible(true)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Details
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loading size="sm" />
            </div>
          ) : error ? (
            <div className="text-red-500 text-sm">Unable to fetch status</div>
          ) : metrics && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Badge color={getPhaseColor(metrics.phase)}>
                  {metrics.phase}
                </Badge>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {metrics.progress}% complete
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.progress}%` }}
                />
              </div>

              {metrics.issues.length > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ {metrics.issues.length} issue(s)
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Detailed view */}
      {detailsVisible && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Migration Monitor
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant={autoRefresh ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailsVisible(false)}
              >
                Minimize
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loading />
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="text-red-600 dark:text-red-400 font-medium mb-1">
                Error fetching migration data
              </div>
              <div className="text-sm text-red-500 dark:text-red-300">
                {error}
              </div>
            </div>
          ) : metrics && (
            <div className="space-y-6">
              {/* Phase and Progress */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Current Phase
                </h3>
                <div className="flex items-center gap-3">
                  <Badge color={getPhaseColor(metrics.phase)} size="lg">
                    {metrics.phase}
                  </Badge>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${metrics.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {metrics.progress}% complete
                      {metrics.estimatedCompletion && (
                        <span className="ml-2">
                          • Est. completion: {metrics.estimatedCompletion.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Status */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Feature Status
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="text-2xl mb-1">{getFeatureIcon(metrics.features.caching)}</div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Caching</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {metrics.features.caching}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="text-2xl mb-1">{getFeatureIcon(metrics.features.sessions)}</div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Sessions</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {metrics.features.sessions}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="text-2xl mb-1">{getFeatureIcon(metrics.features.queues)}</div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Queues</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {metrics.features.queues}
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Performance Metrics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {metrics.performance.responseTime}ms
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Response Time</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {metrics.performance.cacheHitRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Cache Hit Rate</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {metrics.performance.errorRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Error Rate</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                    <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {metrics.performance.activeConnections}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Active Connections</div>
                  </div>
                </div>
              </div>

              {/* Issues */}
              {metrics.issues.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Issues & Warnings
                  </h3>
                  <div className="space-y-2">
                    {metrics.issues.map((issue, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-2 p-3 rounded-lg ${
                          issue.type === 'error'
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : issue.type === 'warning'
                            ? 'bg-amber-50 dark:bg-amber-900/20'
                            : 'bg-blue-50 dark:bg-blue-900/20'
                        }`}
                      >
                        <span className="text-lg">
                          {issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {issue.message}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {issue.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Updated */}
              <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MigrationMonitor;