import React, { Component, ReactNode } from 'react';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import migrationApiClient from '../../services/migration/api-client';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
  fallbackMode: boolean;
  reportedError: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  maxRetries?: number;
  enableFallbackMode?: boolean;
  reportErrors?: boolean;
}

class MigrationErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorTimeouts: NodeJS.Timeout[] = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      fallbackMode: false,
      reportedError: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({
      error,
      errorInfo,
      reportedError: false
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Report error if enabled
    if (this.props.reportErrors) {
      this.reportError(error, errorInfo);
    }

    // Check if error is migration-related
    if (this.isMigrationRelatedError(error)) {
      this.handleMigrationError(error);
    }
  }

  private isMigrationRelatedError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    const migrationIndicators = [
      'redis',
      'cache',
      'session',
      'queue',
      'migration',
      'network',
      'timeout',
      '503',
      '502',
      '504'
    ];

    return migrationIndicators.some(indicator =>
      message.includes(indicator) || stack.includes(indicator)
    );
  }

  private handleMigrationError(error: Error): void {
    // Implement migration-specific error handling
    console.warn('Migration-related error detected:', error);

    // Enable fallback mode if error persists
    const timeout = setTimeout(() => {
      if (this.state.hasError && this.props.enableFallbackMode) {
        this.setState({ fallbackMode: true });
      }
    }, 5000);

    this.errorTimeouts.push(timeout);
  }

  private async reportError(error: Error, errorInfo: any): Promise<void> {
    if (this.state.reportedError) return;

    try {
      const migrationStatus = migrationApiClient.getMigrationStatus();

      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        migrationPhase: migrationStatus?.phase || 'unknown',
        retryCount: this.state.retryCount
      };

      // Send error report to monitoring service
      await migrationApiClient.post('/system/errors/report', errorReport, {
        timeout: 5000
      }).catch(() => {
        // Silently fail if error reporting fails
        console.warn('Failed to report error:', errorReport);
      });

      this.setState({ reportedError: true });
    } catch (reportError) {
      console.warn('Error reporting failed:', reportError);
    }
  }

  private handleRetry = async (): Promise<void> => {
    const { maxRetries = 3 } = this.props;

    if (this.state.retryCount >= maxRetries) {
      // Max retries reached, show different message
      return;
    }

    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
      hasError: false,
      error: null,
      errorInfo: null,
      fallbackMode: false
    }));

    // Clear any pending timeouts
    this.errorTimeouts.forEach(timeout => clearTimeout(timeout));
    this.errorTimeouts = [];
  };

  private handleUseFallback = (): void => {
    this.setState({
      fallbackMode: true,
      hasError: false
    });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private getErrorMessage(): string {
    const { error, retryCount } = this.state;

    if (!error) return 'An unknown error occurred';

    if (this.isMigrationRelatedError(error)) {
      if (retryCount > 0) {
        return 'Service temporarily unavailable due to system migration. Please try again in a moment.';
      }
      return 'A migration-related error occurred. The system is updating to provide better service.';
    }

    return error.message || 'An unexpected error occurred';
  }

  private getErrorSeverity(): 'low' | 'medium' | 'high' {
    const { error } = this.state;

    if (!error) return 'medium';

    if (this.isMigrationRelatedError(error)) {
      return 'low'; // Migration errors are expected
    }

    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      return 'medium'; // Network/loading errors
    }

    return 'high'; // Unexpected errors
  }

  private renderErrorModal(): ReactNode {
    const severity = this.getErrorSeverity();
    const { maxRetries = 3 } = this.props;
    const canRetry = this.state.retryCount < maxRetries;

    return (
      <Modal isOpen={true} onClose={() => {}} closable={false}>
        <div className="p-6 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <div className={`text-3xl ${
              severity === 'high' ? 'text-red-500' :
              severity === 'medium' ? 'text-amber-500' :
              'text-blue-500'
            }`}>
              {severity === 'high' ? '❌' : severity === 'medium' ? '⚠️' : 'ℹ️'}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {severity === 'high' ? 'Error' : 'Service Unavailable'}
            </h2>
          </div>

          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {this.getErrorMessage()}
            </p>

            {this.state.retryCount > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Retry attempts: {this.state.retryCount}/{maxRetries}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {canRetry && (
              <Button onClick={this.handleRetry} className="w-full">
                Try Again
              </Button>
            )}

            {this.props.enableFallbackMode && !this.state.fallbackMode && (
              <Button
                variant="outline"
                onClick={this.handleUseFallback}
                className="w-full"
              >
                Use Offline Mode
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={this.handleReload}
              className="w-full"
            >
              Reload Page
            </Button>
          </div>

          {/* Error details for debugging */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400">
                Error Details (Development)
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </Modal>
    );
  }

  private renderFallbackMode(): ReactNode {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8 max-w-md">
          <div className="text-6xl mb-4">🔧</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Offline Mode
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The system is currently unavailable due to migration.
            We're working to restore full functionality as soon as possible.
          </p>
          <div className="space-y-3">
            <Button onClick={this.handleRetry} className="w-full">
              Check Status
            </Button>
            <Button variant="outline" onClick={this.handleReload} className="w-full">
              Refresh Page
            </Button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
            Your work is being saved locally and will sync when the system is restored.
          </p>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    if (this.state.fallbackMode) {
      return this.renderFallbackMode();
    }

    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Otherwise render error modal
      return this.renderErrorModal();
    }

    return this.props.children;
  }

  componentWillUnmount() {
    // Clean up timeouts
    this.errorTimeouts.forEach(timeout => clearTimeout(timeout));
  }
}

// HOC for wrapping components with error boundary
export const withMigrationErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <MigrationErrorBoundary {...options}>
      <Component {...props} />
    </MigrationErrorBoundary>
  );

  WrappedComponent.displayName = `withMigrationErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default MigrationErrorBoundary;