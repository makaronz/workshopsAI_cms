import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

/**
 * Enhanced Loading States with accessibility support
 * WCAG 2.2 AA compliant loading indicators
 */

export interface LoadingConfig {
  type: 'spinner' | 'skeleton' | 'progress' | 'dots' | 'pulse';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  message?: string;
  progress?: number;
  showPercentage?: boolean;
  inline?: boolean;
}

@customElement('loading-indicator')
export class LoadingIndicator extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: var(--loading-display, flex);
      align-items: center;
      justify-content: var(--loading-justify, center);
      gap: var(--loading-gap, 0.75rem);
      font-family: var(--font-family, system-ui, -apple-system, sans-serif);
    }

    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 1rem;
    }

    .loading-container.inline {
      display: inline-flex;
      padding: 0;
    }

    .loading-container.small {
      padding: 0.5rem;
    }

    .loading-container.large {
      padding: 1.5rem;
    }

    /* Spinner Styles */
    .spinner {
      width: var(--spinner-size, 2rem);
      height: var(--spinner-size, 2rem);
      border: 3px solid var(--spinner-color, #e5e7eb);
      border-top: 3px solid var(--spinner-accent, #3b82f6);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      flex-shrink: 0;
    }

    .spinner.small {
      width: 1rem;
      height: 1rem;
      border-width: 2px;
    }

    .spinner.large {
      width: 3rem;
      height: 3rem;
      border-width: 4px;
    }

    .spinner.primary {
      --spinner-accent: var(--primary-color, #2563eb);
    }

    .spinner.secondary {
      --spinner-accent: var(--secondary-color, #6b7280);
    }

    .spinner.success {
      --spinner-accent: var(--success-color, #059669);
    }

    .spinner.warning {
      --spinner-accent: var(--warning-color, #d97706);
    }

    .spinner.error {
      --spinner-accent: var(--error-color, #dc2626);
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Skeleton Styles */
    .skeleton {
      background: linear-gradient(
        90deg,
        var(--skeleton-base, #f3f4f6) 25%,
        var(--skeleton-shine, #e5e7eb) 50%,
        var(--skeleton-base, #f3f4f6) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .skeleton.small {
      height: 1rem;
      width: 6rem;
    }

    .skeleton.medium {
      height: 1.5rem;
      width: 10rem;
    }

    .skeleton.large {
      height: 2rem;
      width: 16rem;
    }

    .skeleton.text {
      width: 100%;
      height: 1rem;
      margin-bottom: 0.5rem;
    }

    .skeleton.text.title {
      height: 1.5rem;
      width: 60%;
    }

    .skeleton.text.short {
      width: 40%;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* Progress Bar Styles */
    .progress-container {
      width: 100%;
      max-width: 20rem;
    }

    .progress-bar {
      width: 100%;
      height: var(--progress-height, 0.5rem);
      background: var(--progress-bg, #e5e7eb);
      border-radius: 9999px;
      overflow: hidden;
      position: relative;
    }

    .progress-bar.small {
      height: 0.25rem;
    }

    .progress-bar.large {
      height: 0.75rem;
    }

    .progress-fill {
      height: 100%;
      background: var(--progress-color, #3b82f6);
      border-radius: 9999px;
      transition: width 0.3s ease;
      position: relative;
    }

    .progress-fill::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.3),
        transparent
      );
      animation: progress-shine 2s ease-in-out infinite;
    }

    @keyframes progress-shine {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .progress-percentage {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-color, #374151);
      margin-top: 0.5rem;
      text-align: center;
    }

    /* Dots Animation */
    .dots {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }

    .dot {
      width: var(--dot-size, 0.5rem);
      height: var(--dot-size, 0.5rem);
      background: var(--dot-color, #3b82f6);
      border-radius: 50%;
      animation: dot-bounce 1.4s ease-in-out infinite both;
    }

    .dot.small {
      width: 0.375rem;
      height: 0.375rem;
    }

    .dot.large {
      width: 0.75rem;
      height: 0.75rem;
    }

    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }
    .dot:nth-child(3) { animation-delay: 0s; }

    @keyframes dot-bounce {
      0%, 80%, 100% {
        transform: scale(0.8);
        opacity: 0.5;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .dot.primary { --dot-color: var(--primary-color, #2563eb); }
    .dot.secondary { --dot-color: var(--secondary-color, #6b7280); }
    .dot.success { --dot-color: var(--success-color, #059669); }
    .dot.warning { --dot-color: var(--warning-color, #d97706); }
    .dot.error { --dot-color: var(--error-color, #dc2626); }

    /* Pulse Animation */
    .pulse {
      width: var(--pulse-size, 2rem);
      height: var(--pulse-size, 2rem);
      background: var(--pulse-color, #3b82f6);
      border-radius: 50%;
      animation: pulse-animation 1.5s ease-in-out infinite;
      flex-shrink: 0;
    }

    .pulse.small {
      width: 1rem;
      height: 1rem;
    }

    .pulse.large {
      width: 3rem;
      height: 3rem;
    }

    .pulse.primary { --pulse-color: var(--primary-color, #2563eb); }
    .pulse.secondary { --pulse-color: var(--secondary-color, #6b7280); }
    .pulse.success { --pulse-color: var(--success-color, #059669); }
    .pulse.warning { --pulse-color: var(--warning-color, #d97706); }
    .pulse.error { --pulse-color: var(--error-color, #dc2626); }

    @keyframes pulse-animation {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 var(--pulse-color, rgba(59, 130, 246, 0.7));
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
      }
    }

    /* Message Styles */
    .loading-message {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-color, #374151);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .loading-message.small {
      font-size: 0.75rem;
    }

    .loading-message.large {
      font-size: 1rem;
    }

    /* Screen reader only content */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      .spinner,
      .skeleton,
      .dot,
      .pulse,
      .progress-fill::after {
        animation: none;
      }
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .spinner {
        border-width: 4px;
      }

      .progress-bar {
        border: 2px solid currentColor;
      }
    }
  `;

  @property({ type: Object })
  config: LoadingConfig = {
    type: 'spinner',
    size: 'medium',
    color: 'primary'
  };

  @property({ type: String })
  message?: string;

  @property({ type: Number })
  progress?: number;

  @property({ type: Boolean })
  showPercentage: boolean = false;

  @property({ type: Boolean })
  inline: boolean = false;

  private announceToScreenReader(message: string) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    this.shadowRoot?.appendChild(announcement);
    setTimeout(() => {
      if (this.shadowRoot?.contains(announcement)) {
        this.shadowRoot.removeChild(announcement);
      }
    }, 1000);
  }

  connectedCallback() {
    super.connectedCallback();

    // Announce loading state to screen readers
    const announcement = this.message || 'Loading content';
    this.announceToScreenReader(announcement);
  }

  render(): TemplateResult {
    const { type, size, color, message: configMessage } = this.config;
    const { message = configMessage, progress, showPercentage, inline } = this;
    const sizeClass = size || 'medium';
    const colorClass = color || 'primary';
    const displayMessage = message || this.getDefaultMessage(type);

    return html`
      <div
        class="loading-container ${classMap({
          inline,
          [sizeClass]: true
        })}"
        role="status"
        aria-label="${displayMessage}"
      >
        ${this.renderLoadingIndicator(type, sizeClass, colorClass, progress, showPercentage)}
        ${displayMessage ? html`
          <span class="loading-message ${sizeClass}">
            ${displayMessage}
          </span>
        ` : ''}
        <div class="sr-only" aria-live="polite">
          ${displayMessage}. This may take a moment.
        </div>
      </div>
    `;
  }

  private renderLoadingIndicator(
    type: string,
    size: string,
    color: string,
    progress?: number,
    showPercentage?: boolean
  ): TemplateResult {
    switch (type) {
      case 'spinner':
        return html`
          <div class="spinner ${size} ${color}" aria-hidden="true"></div>
        `;

      case 'skeleton':
        return html`
          <div class="skeleton ${size}" aria-hidden="true"></div>
        `;

      case 'progress':
        return html`
          <div class="progress-container" aria-hidden="true">
            <div class="progress-bar ${size}">
              <div class="progress-fill" style="width: ${progress || 0}%"></div>
            </div>
            ${showPercentage ? html`
              <div class="progress-percentage">${Math.round(progress || 0)}%</div>
            ` : ''}
          </div>
        `;

      case 'dots':
        return html`
          <div class="dots" aria-hidden="true">
            <div class="dot ${size} ${color}"></div>
            <div class="dot ${size} ${color}"></div>
            <div class="dot ${size} ${color}"></div>
          </div>
        `;

      case 'pulse':
        return html`
          <div class="pulse ${size} ${color}" aria-hidden="true"></div>
        `;

      default:
        return html`
          <div class="spinner ${size} ${color}" aria-hidden="true"></div>
        `;
    }
  }

  private getDefaultMessage(type: string): string {
    const messages: Record<string, string> = {
      spinner: 'Loading...',
      skeleton: 'Loading content...',
      progress: 'Processing...',
      dots: 'Loading...',
      pulse: 'Processing request...'
    };

    return messages[type] || 'Loading...';
  }

  // Public methods for programmatic control
  public updateProgress(value: number): void {
    this.progress = Math.max(0, Math.min(100, value));
    this.requestUpdate();
  }

  public setMessage(message: string): void {
    this.message = message;
    this.announceToScreenReader(message);
    this.requestUpdate();
  }
}

@customElement('skeleton-card')
export class SkeletonCard extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      padding: 1.5rem;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 8px;
      background: var(--surface-color, #ffffff);
    }

    .skeleton-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .skeleton-avatar {
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      background: linear-gradient(
        90deg,
        #f3f4f6 25%,
        #e5e7eb 50%,
        #f3f4f6 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      flex-shrink: 0;
    }

    .skeleton-title {
      flex: 1;
    }

    .skeleton-line {
      height: 1rem;
      background: linear-gradient(
        90deg,
        #f3f4f6 25%,
        #e5e7eb 50%,
        #f3f4f6 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .skeleton-line:last-child {
      margin-bottom: 0;
    }

    .skeleton-line.short {
      width: 60%;
    }

    .skeleton-line.medium {
      width: 80%;
    }

    .skeleton-line.long {
      width: 100%;
    }

    .skeleton-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .skeleton-button {
      height: 2.5rem;
      width: 8rem;
      border-radius: 6px;
      background: linear-gradient(
        90deg,
        #f3f4f6 25%,
        #e5e7eb 50%,
        #f3f4f6 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      margin-top: 1rem;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton-avatar,
      .skeleton-line,
      .skeleton-button {
        animation: none;
      }
    }
  `;

  @property({ type: Boolean })
  showAvatar: boolean = false;

  @property({ type: Boolean })
  showButton: boolean = false;

  @property({ type: Number })
  lineCount: number = 3;

  render(): TemplateResult {
    return html`
      <div class="skeleton-card" role="presentation" aria-hidden="true">
        ${this.showAvatar ? html`
          <div class="skeleton-header">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-title">
              <div class="skeleton-line medium"></div>
              <div class="skeleton-line short"></div>
            </div>
          </div>
        ` : ''}

        <div class="skeleton-content">
          ${Array.from({ length: this.lineCount }, (_, i) => {
            const widthClass = i === 0 ? 'long' : i === this.lineCount - 1 ? 'short' : 'medium';
            return html`<div class="skeleton-line ${widthClass}"></div>`;
          })}
        </div>

        ${this.showButton ? html`
          <div class="skeleton-button"></div>
        ` : ''}
      </div>
    `;
  }
}

@customElement('loading-overlay')
export class LoadingOverlay extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(2px);
    }

    .overlay-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 2rem;
      background: var(--surface-color, #ffffff);
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      max-width: 90vw;
    }

    .overlay-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-color, #374151);
      margin: 0;
      text-align: center;
    }

    .overlay-description {
      font-size: 0.875rem;
      color: var(--text-color-secondary, #6b7280);
      margin: 0;
      text-align: center;
      max-width: 20rem;
    }

    .overlay-spinner {
      width: 3rem;
      height: 3rem;
      border: 4px solid var(--border-color, #e5e7eb);
      border-top: 4px solid var(--primary-color, #2563eb);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .overlay-spinner {
        animation: none;
      }
    }
  `;

  @property({ type: String })
  title?: string;

  @property({ type: String })
  description?: string;

  render(): TemplateResult {
    return html`
      <div
        class="loading-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-title"
        aria-describedby="overlay-description"
      >
        <div class="overlay-content">
          <div class="overlay-spinner" aria-hidden="true"></div>
          ${this.title ? html`
            <h2 id="overlay-title" class="overlay-title">${this.title}</h2>
          ` : ''}
          ${this.description ? html`
            <p id="overlay-description" class="overlay-description">${this.description}</p>
          ` : ''}
          <div class="sr-only" aria-live="polite">
            Application is loading. Please wait.
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'loading-indicator': LoadingIndicator;
    'skeleton-card': SkeletonCard;
    'loading-overlay': LoadingOverlay;
  }
}

export default {
  LoadingIndicator,
  SkeletonCard,
  LoadingOverlay
};