import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface BadgeProps {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  removable?: boolean;
  value?: string;
}

@customElement('ui-badge')
export class Badge extends LitElement implements BadgeProps {
  static styles: CSSResultGroup = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      line-height: 1;
      white-space: nowrap;
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }

    /* Size variants */
    .badge--sm {
      padding: var(--spacing-0) var(--spacing-1);
      font-size: var(--font-size-xs);
    }

    .badge--md {
      padding: var(--spacing-1) var(--spacing-2);
      font-size: var(--font-size-sm);
    }

    .badge--lg {
      padding: var(--spacing-2) var(--spacing-3);
      font-size: var(--font-size-base);
    }

    /* Rounded variant */
    .badge--rounded {
      border-radius: var(--radius-full);
    }

    .badge:not(.badge--rounded) {
      border-radius: var(--radius-md);
    }

    /* Variant styles */
    .badge--default {
      background: var(--color-gray-100);
      color: var(--color-gray-700);
      border-color: var(--color-gray-200);
    }

    .badge--primary {
      background: var(--color-primary-100);
      color: var(--color-primary-700);
      border-color: var(--color-primary-200);
    }

    .badge--secondary {
      background: var(--color-secondary-100);
      color: var(--color-secondary-700);
      border-color: var(--color-secondary-200);
    }

    .badge--success {
      background: var(--color-green-100);
      color: var(--color-green-700);
      border-color: var(--color-green-200);
    }

    .badge--warning {
      background: var(--color-yellow-100);
      color: var(--color-yellow-700);
      border-color: var(--color-yellow-200);
    }

    .badge--error {
      background: var(--color-red-100);
      color: var(--color-red-700);
      border-color: var(--color-red-200);
    }

    /* Remove button */
    .badge-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      background: transparent;
      border: none;
      border-radius: var(--radius-full);
      cursor: pointer;
      font-size: var(--font-size-xs);
      color: inherit;
      opacity: 0.7;
      transition: all 0.2s ease;
    }

    .badge-remove:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.1);
    }

    .badge-remove:focus {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .badge {
        border-width: 2px;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .badge,
      .badge-remove {
        transition: none;
      }
    }
  `;

  @property({ type: String })
  variant: BadgeProps['variant'] = 'default';

  @property({ type: String })
  size: BadgeProps['size'] = 'md';

  @property({ type: Boolean })
  rounded: boolean = false;

  @property({ type: Boolean })
  removable: boolean = false;

  @property({ type: String })
  value?: BadgeProps['value'];

  private handleRemove() {
    this.dispatchEvent(new CustomEvent('remove', {
      detail: { value: this.value },
      bubbles: true,
      composed: true
    }));
  }

  private getBadgeClasses() {
    return [
      'badge',
      `badge--${this.variant}`,
      `badge--${this.size}`,
      this.rounded ? 'badge--rounded' : ''
    ].filter(Boolean).join(' ');
  }

  render(): TemplateResult {
    return html`
      <div class=${this.getBadgeClasses()}>
        <slot>${this.value}</slot>
        ${this.removable ? html`
          <button
            class="badge-remove"
            @click=${this.handleRemove}
            aria-label=${i18n.t('action.remove')}
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
    'ui-badge': Badge;
  }
}