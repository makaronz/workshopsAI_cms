/**
 * Auto Save Manager
 * Handles periodic auto-save with debouncing and network status awareness
 */

interface AutoSaveConfig {
  interval: number; // in milliseconds
  debounceMs?: number; // in milliseconds (alias for debounceDelay)
  debounceDelay?: number; // in milliseconds
  maxRetries?: number;
  conflictResolution?: string;
  storage?: string;
  onSave?: () => Promise<void>;
  onError?: (error: Error) => void;
  onConflict?: (error: Error) => void;
  onNetworkChange?: (online: boolean) => void;
}

interface SaveState {
  isSaving: boolean;
  lastSave: Date | null;
  nextSave: Date | null;
  error: string | null;
}

export class AutoSaveManager {
  private config: AutoSaveConfig;
  private state: SaveState = {
    isSaving: false,
    lastSave: null,
    nextSave: null,
    error: null,
  };

  private intervalId: number | null = null;
  private debounceTimeout: number | null = null;
  private isOnline = navigator.onLine;
  private isActive = false;

  constructor(config: AutoSaveConfig) {
    this.config = {
      debounceDelay: 1000, // Default 1 second debounce
      ...config,
    };

    // Support both debounceMs and debounceDelay
    if (config.debounceMs && !config.debounceDelay) {
      this.config.debounceDelay = config.debounceMs;
    }

    // Setup network status listeners
    this.setupNetworkListeners();
  }

  /**
   * Start auto-save monitoring
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.scheduleNextSave();

    // Set up periodic saves
    this.intervalId = window.setInterval(() => {
      if (this.isOnline && !this.state.isSaving) {
        this.performSave();
      }
    }, this.config.interval);

    console.log('Auto-save started with interval:', this.config.interval);
  }

  /**
   * Stop auto-save monitoring
   */
  stop(): void {
    this.isActive = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    console.log('Auto-save stopped');
  }

  /**
   * Trigger a save immediately (with debounce)
   */
  triggerSave(): void {
    if (!this.isActive || !this.isOnline) return;

    // Clear existing debounce
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Set new debounce timeout
    this.debounceTimeout = window.setTimeout(() => {
      this.performSave();
    }, this.config.debounceDelay);

    // Update next save time
    this.scheduleNextSave();
  }

  /**
   * Force save immediately (without debounce)
   */
  async forceSave(): Promise<boolean> {
    if (!this.isActive || !this.isOnline) return false;

    try {
      await this.performSave();
      return true;
    } catch (error) {
      console.error('Force save failed:', error);
      return false;
    }
  }

  /**
   * Get current save state
   */
  getState(): SaveState {
    return { ...this.state };
  }

  /**
   * Check if auto-save is active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Resume auto-save (alias for start)
   */
  resume(): void {
    this.start();
  }

  /**
   * Pause auto-save (alias for stop)
   */
  pause(): void {
    this.stop();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart with new config if active
    if (this.isActive) {
      this.stop();
      this.start();
    }
  }

  private async performSave(): Promise<void> {
    if (this.state.isSaving) return;

    this.state.isSaving = true;
    this.state.error = null;

    try {
      if (this.config.onSave) {
        await this.config.onSave();
      }

      this.state.lastSave = new Date();
      this.state.error = null;

      // Clear error notification if any
      this.clearErrorNotification();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.state.error = errorMessage;

      console.error('Auto-save failed:', error);

      if (this.config.onError) {
        this.config.onError(
          error instanceof Error ? error : new Error(errorMessage),
        );
      }

      // Show error notification
      this.showErrorNotification(errorMessage);

      // Retry after delay if offline
      if (!this.isOnline) {
        this.scheduleRetry();
      }
    } finally {
      this.state.isSaving = false;
      this.scheduleNextSave();
    }
  }

  private scheduleNextSave(): void {
    const nextSaveTime = new Date(Date.now() + this.config.interval);
    this.state.nextSave = nextSaveTime;
  }

  private scheduleRetry(): void {
    // Retry after 30 seconds if offline
    setTimeout(() => {
      if (this.isOnline && this.isActive) {
        this.performSave();
      }
    }, 30000);
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Network connection restored');

      // Trigger save immediately when back online
      if (this.isActive) {
        this.performSave();
      }

      if (this.config.onNetworkChange) {
        this.config.onNetworkChange(true);
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Network connection lost');

      if (this.config.onNetworkChange) {
        this.config.onNetworkChange(false);
      }
    });
  }

  private showErrorNotification(message: string): void {
    // Create or update error notification
    let notification = document.getElementById('auto-save-error');

    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'auto-save-error';
      notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #dc2626;
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-width: 300px;
        font-size: 14px;
        line-height: 1.4;
      `;
      document.body.appendChild(notification);
    }

    notification.textContent = `Save failed: ${message}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.clearErrorNotification();
    }, 5000);
  }

  private clearErrorNotification(): void {
    const notification = document.getElementById('auto-save-error');
    if (notification) {
      notification.remove();
    }
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    this.stop();
    this.clearErrorNotification();

    // Remove network listeners
    window.removeEventListener('online', () => {});
    window.removeEventListener('offline', () => {});
  }
}

// Utility function for creating auto-save manager with default config
export function createAutoSaveManager(
  config: Partial<AutoSaveConfig> = {},
): AutoSaveManager {
  return new AutoSaveManager({
    interval: 30000, // 30 seconds default
    debounceDelay: 1000, // 1 second default
    ...config,
  });
}
