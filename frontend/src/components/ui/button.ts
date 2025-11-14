import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

@customElement('ui-button')
export class Button extends LitElement implements ButtonProps {
  static styles: CSSResultGroup = css`
    :host {
      display: inline-block;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      font-family: var(--font-family-sans);
      font-weight: var(--font-weight-medium);
      line-height: 1;
      text-decoration: none;
      cursor: pointer;
      transition: var(--transition-colors), var(--transition-transform), var(--transition-shadow);
      position: relative;
      white-space: nowrap;
      user-select: none;
      text-align: center;
      vertical-align: middle;
      appearance: none;
      background: none;
      margin: 0;
    }

    .button:focus {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    .button:focus:not(:focus-visible) {
      outline: none;
    }

    .button:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    /* Size variants */
    .button--sm {
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
      min-height: 2rem;
    }

    .button--md {
      padding: var(--space-3) var(--space-4);
      font-size: var(--font-size-base);
      min-height: 2.5rem;
    }

    .button--lg {
      padding: var(--space-4) var(--space-6);
      font-size: var(--font-size-lg);
      min-height: 3rem;
    }

    .button--full-width {
      width: 100%;
    }

    /* Variant styles */
    .button--primary {
      background-color: var(--color-primary-600);
      color: var(--color-text-inverse);
      border-color: var(--color-primary-600);
    }

    .button--primary:hover:not(:disabled) {
      background-color: var(--color-primary-700);
      border-color: var(--color-primary-700);
    }

    .button--primary:active:not(:disabled) {
      background-color: var(--color-primary-800);
      border-color: var(--color-primary-800);
      transform: translateY(1px);
    }

    .button--secondary {
      background-color: var(--color-surface);
      color: var(--color-text-primary);
      border-color: var(--color-border);
    }

    .button--secondary:hover:not(:disabled) {
      background-color: var(--color-surface-hover);
      border-color: var(--color-border-hover);
    }

    .button--secondary:active:not(:disabled) {
      background-color: var(--color-surface-active);
      transform: translateY(1px);
    }

    .button--success {
      background-color: var(--color-success-600);
      color: var(--color-text-inverse);
      border-color: var(--color-success-600);
    }

    .button--success:hover:not(:disabled) {
      background-color: var(--color-success-700);
      border-color: var(--color-success-700);
    }

    .button--warning {
      background-color: var(--color-warning-600);
      color: var(--color-text-inverse);
      border-color: var(--color-warning-600);
    }

    .button--warning:hover:not(:disabled) {
      background-color: var(--color-warning-700);
      border-color: var(--color-warning-700);
    }

    .button--error {
      background-color: var(--color-error-600);
      color: var(--color-text-inverse);
      border-color: var(--color-error-600);
    }

    .button--error:hover:not(:disabled) {
      background-color: var(--color-error-700);
      border-color: var(--color-error-700);
    }

    .button--ghost {
      background-color: transparent;
      color: var(--color-text-primary);
      border-color: transparent;
    }

    .button--ghost:hover:not(:disabled) {
      background-color: var(--color-surface-hover);
      color: var(--color-text-primary);
    }

    .button--outline {
      background-color: transparent;
      color: var(--color-primary-600);
      border-color: var(--color-primary-600);
    }

    .button--outline:hover:not(:disabled) {
      background-color: var(--color-primary-600);
      color: var(--color-text-inverse);
    }

    /* Disabled state */
    .button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }

    /* Loading state */
    .button--loading {
      color: transparent;
      cursor: wait;
    }

    .button--loading::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 1em;
      height: 1em;
      margin: -0.5em 0 0 -0.5em;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Icon support */
    .button .icon {
      flex-shrink: 0;
    }

    .button--icon-only {
      padding: var(--space-3);
      min-height: auto;
    }

    .button--icon-only .icon {
      margin: 0;
    }

    /* Accessibility improvements */
    .button[aria-pressed="true"] {
      background-color: var(--color-primary-700);
    }

    .button[aria-expanded="true"] {
      background-color: var(--color-primary-700);
    }

    .button[aria-pressed="true"]:focus,
    .button[aria-expanded="true"]:focus {
      background-color: var(--color-primary-800);
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .button {
        border-width: 2px;
      }

      .button--ghost {
        border-color: var(--color-border);
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .button,
      .button--loading::after {
        transition: none;
        animation: none;
      }
    }

    /* Mobile responsiveness */
    @media (max-width: 640px) {
      .button--lg {
        padding: var(--space-3) var(--space-5);
        font-size: var(--font-size-base);
        min-height: 2.5rem;
      }
    }
  `;

  @property({ type: String })
  variant: ButtonProps['variant'] = 'primary';

  @property({ type: String })
  size: ButtonProps['size'] = 'md';

  @property({ type: Boolean })
  disabled: boolean = false;

  @property({ type: Boolean })
  loading: boolean = false;

  @property({ type: String })
  type: ButtonProps['type'] = 'button';

  @property({ type: Boolean })
  fullWidth: boolean = false;

  @property({ type: String })
  ariaLabel: string = '';

  @property({ type: String })
  ariaDescribedBy: string = '';

  @state()
  private hasIconSlot: boolean = false;

  @state()
  private hasTextContent: boolean = false;

  firstUpdated() {
    this.checkSlots();
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    this.checkSlots();
  }

  private checkSlots() {
    this.hasIconSlot = !!this.shadowRoot?.querySelector('slot[name="icon"]')?.assignedElements().length;
    this.hasTextContent = !!this.shadowRoot?.querySelector('slot:not([name])')?.assignedElements().length;
  }

  private handleClick(event: Event) {
    if (this.disabled || this.loading) {
      event.preventDefault();
      return;
    }

    this.dispatchEvent(new CustomEvent('click', {
      bubbles: true,
      composed: true
    }));
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.click();
    }
  }

  private getClasses() {
    return classMap({
      'button': true,
      'button--sm': this.size === 'sm',
      'button--md': this.size === 'md',
      'button--lg': this.size === 'lg',
      'button--primary': this.variant === 'primary',
      'button--secondary': this.variant === 'secondary',
      'button--success': this.variant === 'success',
      'button--warning': this.variant === 'warning',
      'button--error': this.variant === 'error',
      'button--ghost': this.variant === 'ghost',
      'button--outline': this.variant === 'outline',
      'button--loading': this.loading,
      'button--full-width': this.fullWidth,
      'button--icon-only': this.hasIconSlot && !this.hasTextContent,
    });
  }

  private getButtonAttributes() {
    const attrs: Record<string, string> = {
      type: this.type,
      disabled: this.disabled || this.loading ? 'true' : 'false',
      'aria-busy': this.loading ? 'true' : 'false',
    };

    if (this.ariaLabel) {
      attrs['aria-label'] = this.ariaLabel;
    }

    if (this.ariaDescribedBy) {
      attrs['aria-describedby'] = this.ariaDescribedBy;
    }

    return attrs;
  }

  render(): TemplateResult {
    return html`
      <button
        class=${this.getClasses()}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
        ...=${this.getButtonAttributes()}
      >
        <slot name="icon" class="icon"></slot>
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-button': Button;
  }
}