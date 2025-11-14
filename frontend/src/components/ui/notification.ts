import { LitElement, html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

export interface NotificationProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  message?: string;
  duration?: number;
  closable?: boolean;
  showIcon?: boolean;
  position?: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
}

@customElement('ui-notification')
export class Notification extends LitElement implements NotificationProps {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      position: fixed;
      z-index: 2000;
      pointer-events: none;
    }

    :host([position="top-right"]) {
      top: var(--spacing-4);
      right: var(--spacing-4);
    }

    :host([position="top-left"]) {
      top: var(--spacing-4);
      left: var(--spacing-4);
    }

    :host([position="top-center"]) {
      top: var(--spacing-4);
      left: 50%;
      transform: translateX(-50%);
    }

    :host([position="bottom-right"]) {
      bottom: var(--spacing-4);
      right: var(--spacing-4);
    }

    :host([position="bottom-left"]) {
      bottom: var(--spacing-4);
      left: var(--spacing-4);
    }

    :host([position="bottom-center"]) {
      bottom: var(--spacing-4);
      left: 50%;
      transform: translateX(-50%);
    }

    .notification {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-3);
      padding: var(--spacing-4);
      background: white;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      min-width: 300px;
      max-width: 500px;
      pointer-events: auto;
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease;
      border: 1px solid var(--color-border);
    }

    .notification.show {
      transform: translateX(0);
      opacity: 1;
    }

    .notification--success {
      background: var(--color-green-50);
      border-color: var(--color-green-200);
    }

    .notification--error {
      background: var(--color-red-50);
      border-color: var(--color-red-200);
    }

    .notification--warning {
      background: var(--color-yellow-50);
      border-color: var(--color-yellow-200);
    }

    .notification--info {
      background: var(--color-blue-50);
      border-color: var(--color-blue-200);
    }

    .notification-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin-top: 2px;
    }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-weight: var(--font-weight-semibold);
      margin: 0 0 var(--spacing-1) 0;
      color: var(--color-text-primary);
    }

    .notification-message {
      font-size: var(--font-size-sm);
      line-height: 1.5;
      color: var(--color-text-secondary);
      margin: 0;
    }

    .notification-close {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-gray-400);
      font-size: var(--font-size-sm);
      transition: all 0.2s ease;
    }

    .notification-close:hover {
      background: var(--color-gray-100);
      color: var(--color-gray-600);
    }

    .notification-close:focus {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    /* Animation for slide in */
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .notification--enter {
      animation: slideInRight 0.3s ease forwards;
    }

    .notification--exit {
      animation: slideOutRight 0.3s ease forwards;
    }

    /* Responsive Design */
    @media (max-width: 640px) {
      :host([position="top-right"]),
      :host([position="top-left"]),
      :host([position="bottom-right"]),
      :host([position="bottom-left"]) {
        left: var(--spacing-2);
        right: var(--spacing-2);
      }

      :host([position="top-center"]),
      :host([position="bottom-center"]) {
        left: var(--spacing-2);
        right: var(--spacing-2);
        transform: none;
      }

      .notification {
        min-width: auto;
        max-width: none;
      }
    }

    /* High Contrast Mode */
    @media (prefers-contrast: high) {
      .notification {
        border-width: 2px;
      }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .notification,
      .notification-close {
        transition: none;
      }

      .notification--enter,
      .notification--exit {
        animation: none;
      }
    }
  `;

  @property({ type: String })
  type: NotificationProps['type'] = 'info';

  @property({ type: String })
  message?: NotificationProps['message'];

  @property({ type: Number })
  duration: NotificationProps['duration'] = 5000;

  @property({ type: Boolean })
  closable: boolean = true;

  @property({ type: Boolean })
  showIcon: boolean = true;

  @property({ type: String, reflect: true })
  position: NotificationProps['position'] = 'top-right';

  @state()
  private isVisible = false;

  @state()
  private isExiting = false;

  private timeoutId?: number;

  connectedCallback() {
    super.connectedCallback();
    // Auto remove after duration
    if (this.duration > 0) {
      this.timeoutId = window.setTimeout(() => {
        this.close();
      }, this.duration);
    }

    // Show notification
    requestAnimationFrame(() => {
      this.isVisible = true;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  close() {
    this.isExiting = true;
    setTimeout(() => {
      this.remove();
    }, 300);
  }

  private getIcon(): string {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[this.type] || icons.info;
  }

  private getNotificationClasses() {
    return [
      'notification',
      `notification--${this.type}`,
      this.isVisible ? 'notification--enter' : '',
      this.isExiting ? 'notification--exit' : ''
    ].filter(Boolean).join(' ');
  }

  render(): TemplateResult {
    return html`
      <div
        class=${this.getNotificationClasses()}
        role="alert"
        aria-live=${this.type === 'error' ? 'assertive' : 'polite'}
      >
        ${this.showIcon ? html`
          <div class="notification-icon" aria-hidden="true">
            ${this.getIcon()}
          </div>
        ` : ''}

        <div class="notification-content">
          <div class="notification-message">${this.message}</div>
        </div>

        ${this.closable ? html`
          <button
            class="notification-close"
            @click=${this.close}
            aria-label=${i18n.t('action.close')}
          >
            ✕
          </button>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-notification': Notification;
  }
}