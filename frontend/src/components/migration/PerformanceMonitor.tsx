import React, { useState, useEffect, useRef } from 'react';
import migrationApiClient from '../../services/migration/api-client';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface PerformanceData {
  timestamp: Date;
  responseTime: number;
  cacheHitRate: number;
  errorRate: number;
  requestRate: number;
  memoryUsage: number;
  connectionStatus: 'connected' | 'degraded' | 'disconnected';
}

interface PerformanceMonitorProps {
  visible?: boolean;
  position?: 'top' | 'bottom';
  showDetails?: boolean;
  alertThresholds?: {
    responseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  visible = true,
  position = 'bottom',
  showDetails = false,
  alertThresholds = {
    responseTime: 2000,
    errorRate: 5,
    cacheHitRate: 70
  }
}) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceData | null>(null);
  const [isRecording, setIsRecording] = useState(true);
  const [alerts, setAlerts] = useState<Array<{
    type: 'warning' | 'error';
    message: string;
    timestamp: Date;
  }>>([]);
  const detailsVisible = useRef(showDetails);

  const maxDataPoints = 60; // Keep last 60 data points (10 minutes at 10s intervals)

  useEffect(() => {
    if (!visible || !isRecording) return;

    const interval = setInterval(async () => {
      await collectPerformanceData();
    }, 10000); // Collect data every 10 seconds

    return () => clearInterval(interval);
  }, [visible, isRecording]);

  const collectPerformanceData = async () => {
    try {
      const startTime = Date.now();

      // Get API health and metrics
      const health = await migrationApiClient.healthCheck();
      const apiMetrics = migrationApiClient.getPerformanceMetrics();

      // Get memory usage if available
      const memoryUsage = getMemoryUsage();

      const data: PerformanceData = {
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        cacheHitRate: apiMetrics.cacheHitRate || 0,
        errorRate: apiMetrics.errors / (apiMetrics.networkRequests || 1) * 100,
        requestRate: apiMetrics.networkRequests / 600, // Per second over last 10 minutes
        memoryUsage: memoryUsage,
        connectionStatus: health.status === 'healthy' ? 'connected' :
                         health.status === 'degraded' ? 'degraded' : 'disconnected'
      };

      setCurrentMetrics(data);
      setPerformanceData(prev => {
        const newData = [...prev, data];
        return newData.slice(-maxDataPoints);
      });

      // Check for alerts
      checkAlerts(data);

    } catch (error) {
      console.warn('Failed to collect performance data:', error);

      // Add disconnected status
      const errorData: PerformanceData = {
        timestamp: new Date(),
        responseTime: 9999,
        cacheHitRate: 0,
        errorRate: 100,
        requestRate: 0,
        memoryUsage: 0,
        connectionStatus: 'disconnected'
      };

      setCurrentMetrics(errorData);
    }
  };

  const getMemoryUsage = (): number => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  };

  const checkAlerts = (data: PerformanceData): void => {
    const newAlerts: Array<{ type: 'warning' | 'error'; message: string; timestamp: Date }> = [];

    if (data.responseTime > alertThresholds.responseTime) {
      newAlerts.push({
        type: data.responseTime > alertThresholds.responseTime * 2 ? 'error' : 'warning',
        message: `High response time: ${data.responseTime}ms`,
        timestamp: data.timestamp
      });
    }

    if (data.errorRate > alertThresholds.errorRate) {
      newAlerts.push({
        type: data.errorRate > alertThresholds.errorRate * 2 ? 'error' : 'warning',
        message: `High error rate: ${data.errorRate.toFixed(1)}%`,
        timestamp: data.timestamp
      });
    }

    if (data.cacheHitRate < alertThresholds.cacheHitRate) {
      newAlerts.push({
        type: 'warning',
        message: `Low cache hit rate: ${data.cacheHitRate.toFixed(1)}%`,
        timestamp: data.timestamp
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts].slice(-10)); // Keep last 10 alerts
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected': return 'green';
      case 'degraded': return 'yellow';
      case 'disconnected': return 'red';
      default: return 'gray';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes;
    return `${mb.toFixed(1)} MB`;
  };

  const clearAlerts = (): void => {
    setAlerts([]);
  };

  const exportData = (): void => {
    const dataStr = JSON.stringify(performanceData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!visible) return null;

  const positionClasses = position === 'top' ? 'top-0' : 'bottom-0';

  return (
    <div className={`fixed left-0 right-0 ${positionClasses} z-40 pointer-events-none`}>
      {/* Compact view */}
      <div className="flex justify-center pointer-events-none">
        <div className="bg-white dark:bg-gray-800 rounded-t-lg shadow-lg p-2 m-2 pointer-events-auto">
          <div className="flex items-center gap-3 text-xs">
            <Badge color={getStatusColor(currentMetrics?.connectionStatus || 'unknown')}>
              {currentMetrics?.connectionStatus || 'Unknown'}
            </Badge>

            {currentMetrics && (
              <>
                <span className="text-gray-600 dark:text-gray-300">
                  RT: {currentMetrics.responseTime}ms
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  Cache: {currentMetrics.cacheHitRate.toFixed(1)}%
                </span>
                {currentMetrics.memoryUsage > 0 && (
                  <span className="text-gray-600 dark:text-gray-300">
                    Mem: {formatBytes(currentMetrics.memoryUsage)}
                  </span>
                )}
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => detailsVisible.current = !detailsVisible.current}
              className="pointer-events-auto"
            >
              {detailsVisible.current ? '▼' : '▲'}
            </Button>
          </div>
        </div>
      </div>

      {/* Detailed view */}
      {detailsVisible.current && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 pointer-events-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-4xl max-h-[80vh] m-auto mt-10 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Performance Monitor
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={isRecording ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setIsRecording(!isRecording)}
                >
                  {isRecording ? '⏸ Pause' : '▶ Resume'}
                </Button>
                <Button variant="outline" size="sm" onClick={exportData}>
                  Export Data
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => detailsVisible.current = false}
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Current Metrics */}
            {currentMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {currentMetrics.responseTime}ms
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Response Time
                  </div>
                  {currentMetrics.responseTime > alertThresholds.responseTime && (
                    <div className="text-xs text-red-500 mt-1">⚠️ Above threshold</div>
                  )}
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {currentMetrics.cacheHitRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Cache Hit Rate
                  </div>
                  {currentMetrics.cacheHitRate < alertThresholds.cacheHitRate && (
                    <div className="text-xs text-red-500 mt-1">⚠️ Below threshold</div>
                  )}
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {currentMetrics.errorRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Error Rate
                  </div>
                  {currentMetrics.errorRate > alertThresholds.errorRate && (
                    <div className="text-xs text-red-500 mt-1">⚠️ Above threshold</div>
                  )}
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {currentMetrics.requestRate.toFixed(1)}/s
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Request Rate
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Recent Alerts
                  </h3>
                  <Button variant="ghost" size="sm" onClick={clearAlerts}>
                    Clear All
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {alerts.map((alert, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 p-2 rounded ${
                        alert.type === 'error'
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-amber-50 dark:bg-amber-900/20'
                      }`}
                    >
                      <span>{alert.type === 'error' ? '❌' : '⚠️'}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {alert.message}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                        {alert.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Chart */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Response Time Trend (Last Hour)
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 h-40">
                <div className="h-full flex items-end gap-1">
                  {performanceData.slice(-60).map((data, index) => (
                    <div
                      key={index}
                      className={`flex-1 ${
                        data.responseTime > alertThresholds.responseTime
                          ? 'bg-red-400'
                          : data.responseTime > alertThresholds.responseTime / 2
                          ? 'bg-amber-400'
                          : 'bg-green-400'
                      }`}
                      style={{ height: `${Math.min(100, (data.responseTime / 5000) * 100)}%` }}
                      title={`${data.responseTime}ms at ${data.timestamp.toLocaleTimeString()}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Avg Response Time
                </div>
                <div className="text-lg font-semibold">
                  {performanceData.length > 0
                    ? (performanceData.reduce((sum, d) => sum + d.responseTime, 0) / performanceData.length).toFixed(0)
                    : 0}ms
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Peak Memory
                </div>
                <div className="text-lg font-semibold">
                  {performanceData.length > 0
                    ? formatBytes(Math.max(...performanceData.map(d => d.memoryUsage)))
                    : '0 MB'}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Total Requests
                </div>
                <div className="text-lg font-semibold">
                  {migrationApiClient.getPerformanceMetrics().networkRequests}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Cache Size
                </div>
                <div className="text-lg font-semibold">
                  {migrationApiClient.getPerformanceMetrics().cacheSize} entries
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;