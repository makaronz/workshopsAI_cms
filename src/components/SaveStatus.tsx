/**
 * Save Status Web Component
 * Real-time visual feedback for save operations with multiple states
 */

type SaveStatusType = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

interface SaveStatusConfig {
  showText?: boolean;
  showIcon?: boolean;
  autoHide?: boolean;
  hideDelay?: number;
}

const defaultConfig: SaveStatusConfig = {
  showText: true,
  showIcon: true,
  autoHide: true,
  hideDelay: 2000, // 2 seconds
};

export class SaveStatus extends HTMLElement {
  private currentStatus: SaveStatusType = 'idle';
  private config: SaveStatusConfig;
  private hideTimeout: number | null = null;

  private statusIcon: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private statusContainer: HTMLElement | null = null;

  constructor(config: Partial<SaveStatusConfig> = {}) {
    super();
    this.attachShadow({ mode: 'open' });
    this.config = { ...defaultConfig, ...config };
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.clearHideTimeout();
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .status-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          transition: all 0.2s ease-in-out;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
        }

        .status-icon {
          width: 1rem;
          height: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease-in-out;
        }

        .status-text {
          color: #6b7280;
          white-space: nowrap;
        }

        /* Status-specific styles */
        .status-container.idle {
          opacity: 0.6;
        }

        .status-container.saving {
          background-color: #dbeafe;
          border-color: #3b82f6;
        }

        .status-container.saving .status-text {
          color: #1e40af;
        }

        .status-container.saving .status-icon {
          animation: spin 1s linear infinite;
        }

        .status-container.saved {
          background-color: #d1fae5;
          border-color: #10b981;
        }

        .status-container.saved .status-text {
          color: #065f46;
        }

        .status-container.saved .status-icon {
          animation: checkmark 0.3s ease-in-out;
        }

        .status-container.error {
          background-color: #fee2e2;
          border-color: #dc2626;
        }

        .status-container.error .status-text {
          color: #991b1b;
        }

        .status-container.error .status-icon {
          animation: shake 0.3s ease-in-out;
        }

        .status-container.offline {
          background-color: #fef3c7;
          border-color: #f59e0b;
        }

        .status-container.offline .status-text {
          color: #92400e;
        }

        /* Animations */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes checkmark {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        /* Icon styles */
        .icon-idle::before {
          content: '💾';
          opacity: 0.6;
        }

        .icon-saving::before {
          content: '⏳';
        }

        .icon-saved::before {
          content: '✓';
        }

        .icon-error::before {
          content: '⚠️';
        }

        .icon-offline::before {
          content: '📴';
        }

        /* Compact mode */
        :host([compact]) .status-container {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }

        :host([compact]) .status-icon {
          width: 0.875rem;
          height: 0.875rem;
        }

        /* Icon-only mode */
        :host([icon-only]) .status-text {
          display: none;
        }

        :host([icon-only]) .status-container {
          padding: 0.5rem;
        }

        /* Text-only mode */
        :host([text-only]) .status-icon {
          display: none;
        }

        /* High contrast mode */
        @media (prefers-contrast: high) {
          .status-container {
            border-width: 2px;
          }

          .status-container.saving {
            background-color: #000;
            color: #fff;
            border-color: #000;
          }

          .status-container.saved {
            background-color: #000;
            color: #fff;
            border-color: #000;
          }

          .status-container.error {
            background-color: #000;
            color: #fff;
            border-color: #000;
          }

          .status-container.saving .status-text,
          .status-container.saved .status-text,
          .status-container.error .status-text {
            color: #fff;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .status-container.saving .status-icon {
            animation: none;
          }

          .status-container.saved .status-icon,
          .status-container.error .status-icon {
            animation: none;
          }

          * {
            transition-duration: 0.01ms !important;
          }
        }

        /* Focus management */
        :host:focus-visible .status-container {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
      </style>

      <div class="status-container idle" id="status-container" role="status" aria-live="polite">
        <div class="status-icon icon-idle" id="status-icon" aria-hidden="true"></div>
        <div class="status-text" id="status-text"></div>
      </div>
    `;

    this.statusContainer = this.shadowRoot.getElementById('status-container');
    this.statusIcon = this.shadowRoot.getElementById('status-icon');
    this.statusText = this.shadowRoot.getElementById('status-text');

    // Apply configuration
    this.applyConfig();

    // Update to initial status
    this.updateStatusDisplay();
  }

  private applyConfig(): void {
    if (!this.statusContainer || !this.statusIcon || !this.statusText) return;

    // Apply visibility options
    if (!this.config.showIcon) {
      this.statusIcon.style.display = 'none';
    }

    if (!this.config.showText) {
      this.statusText.style.display = 'none';
    }

    // Check for attribute-based overrides
    if (this.hasAttribute('icon-only')) {
      this.statusText.style.display = 'none';
    }

    if (this.hasAttribute('text-only')) {
      this.statusIcon.style.display = 'none';
    }
  }

  /**
   * Set the current save status
   * @param status The new status
   * @param message Optional custom message
   */
  setStatus(status: SaveStatusType, message?: string): void {
    const previousStatus = this.currentStatus;
    this.currentStatus = status;

    this.updateStatusDisplay(message);

    // Auto-hide for saved status
    if (status === 'saved' && this.config.autoHide) {
      this.scheduleHide();
    } else {
      this.clearHideTimeout();
    }

    // Announce status change for screen readers
    if (previousStatus !== status && this.statusContainer) {
      const announcement = this.getStatusAnnouncement(status, message);
      this.announceStatusChange(announcement);
    }
  }

  /**
   * Get current status
   */
  getStatus(): SaveStatusType {
    return this.currentStatus;
  }

  /**
   * Show loading state
   */
  showSaving(message?: string): void {
    this.setStatus('saving', message);
  }

  /**
   * Show success state
   */
  showSaved(message?: string): void {
    this.setStatus('saved', message);
  }

  /**
   * Show error state
   */
  showError(message?: string): void {
    this.setStatus('error', message);
  }

  /**
   * Show offline state
   */
  showOffline(message?: string): void {
    this.setStatus('offline', message);
  }

  /**
   * Reset to idle state
   */
  setIdle(message?: string): void {
    this.setStatus('idle', message);
  }

  private updateStatusDisplay(customMessage?: string): void {
    if (!this.statusContainer || !this.statusIcon || !this.statusText) return;

    // Update container classes
    this.statusContainer.className = `status-container ${this.currentStatus}`;

    // Update icon
    this.statusIcon.className = `status-icon icon-${this.currentStatus}`;

    // Update text
    const statusText =
      customMessage || this.getDefaultStatusText(this.currentStatus);
    this.statusText.textContent = statusText;

    // Update ARIA attributes
    this.updateAriaAttributes(this.currentStatus, statusText);
  }

  private getDefaultStatusText(status: SaveStatusType): string {
    const language = this.getCurrentLanguage();

    const statusTexts = {
      idle: { pl: 'Gotowe', en: 'Ready' },
      saving: { pl: 'Zapisywanie...', en: 'Saving...' },
      saved: { pl: 'Zapisano', en: 'Saved' },
      error: { pl: 'Błąd zapisu', en: 'Save failed' },
      offline: { pl: 'Offline', en: 'Offline' },
    };

    return statusTexts[status]?.[language] || statusTexts[status]?.en || status;
  }

  private getCurrentLanguage(): 'pl' | 'en' {
    const htmlLang = document.documentElement.lang || 'pl';
    return htmlLang === 'en' ? 'en' : 'pl';
  }

  private updateAriaAttributes(status: SaveStatusType, text: string): void {
    if (!this.statusContainer) return;

    this.statusContainer.setAttribute('aria-label', `Save status: ${text}`);

    switch (status) {
    case 'saving':
      this.statusContainer.setAttribute('aria-busy', 'true');
      break;
    case 'saved':
    case 'error':
      this.statusContainer.setAttribute('aria-busy', 'false');
      break;
    default:
      this.statusContainer.removeAttribute('aria-busy');
    }
  }

  private getStatusAnnouncement(
    status: SaveStatusType,
    customMessage?: string,
  ): string {
    const message = customMessage || this.getDefaultStatusText(status);
    const language = this.getCurrentLanguage();

    const announcements = {
      idle: { pl: 'Status zapisu: gotowy', en: 'Save status: ready' },
      saving: { pl: 'Trwa zapisywanie', en: 'Saving in progress' },
      saved: { pl: 'Zapisano pomyślnie', en: 'Saved successfully' },
      error: { pl: 'Błąd podczas zapisu', en: 'Save failed' },
      offline: {
        pl: 'Tryb offline - zmiany zostaną zapisane po połączeniu',
        en: 'Offline mode - changes will be saved when connected',
      },
    };

    return (
      announcements[status]?.[language] || announcements[status]?.en || message
    );
  }

  private announceStatusChange(message: string): void {
    // Create a temporary live region for screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    announcement.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      if (announcement.parentNode) {
        announcement.parentNode.removeChild(announcement);
      }
    }, 1000);
  }

  private scheduleHide(): void {
    this.clearHideTimeout();

    this.hideTimeout = window.setTimeout(() => {
      this.setIdle();
    }, this.config.hideDelay);
  }

  private clearHideTimeout(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SaveStatusConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyConfig();
  }

  /**
   * Show/hide the status component
   */
  setVisible(visible: boolean): void {
    this.style.display = visible ? 'inline-flex' : 'none';
  }

  /**
   * Get accessibility information
   */
  getAccessibilityInfo(): {
    label: string;
    description: string;
    currentStatus: string;
    } {
    return {
      label: 'Save Status Indicator',
      description: 'Shows the current save status of the questionnaire',
      currentStatus: this.getDefaultStatusText(this.currentStatus),
    };
  }

  // Static method for element definition
  static get tagName() {
    return 'save-status';
  }
}

// Register the custom element
if (!customElements.get(SaveStatus.tagName)) {
  customElements.define(SaveStatus.tagName, SaveStatus);
}
