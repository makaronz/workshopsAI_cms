import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface CheckboxProps {
  checked?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  error?: boolean;
  size?: 'sm' | 'md' | 'lg';
  name?: string;
  id?: string;
  value?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  indeterminate?: boolean;
}

@customElement('ui-checkbox')
export class Checkbox extends LitElement implements CheckboxProps {
  static styles: CSSResultGroup = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-2);
      cursor: pointer;
    }

    :host([disabled]) {
      cursor: not-allowed;
      opacity: 0.7;
    }

    .checkbox-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .checkbox--sm {
      width: 16px;
      height: 16px;
    }

    .checkbox--md {
      width: 20px;
      height: 20px;
    }

    .checkbox--lg {
      width: 24px;
      height: 24px;
    }

    .checkbox:focus {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    .checkbox:hover:not(:disabled) {
      border-color: var(--color-primary-500);
    }

    .checkbox--checked {
      background: var(--color-primary-600);
      border-color: var(--color-primary-600);
    }

    .checkbox--indeterminate {
      background: var(--color-primary-600);
      border-color: var(--color-primary-600);
    }

    .checkbox--error {
      border-color: var(--color-error-500);
    }

    .checkbox--error.checkbox--checked {
      background: var(--color-error-600);
      border-color: var(--color-error-600);
    }

    .checkbox--error.checkbox--indeterminate {
      background: var(--color-error-600);
      border-color: var(--color-error-600);
    }

    .checkbox:disabled {
      background: var(--color-gray-100);
      border-color: var(--color-gray-300);
      cursor: not-allowed;
    }

    .checkbox--checked:disabled {
      background: var(--color-gray-400);
      border-color: var(--color-gray-400);
    }

    .checkbox-icon {
      color: white;
      font-size: 12px;
      font-weight: bold;
      line-height: 1;
    }

    .checkbox-icon--sm {
      font-size: 10px;
    }

    .checkbox-icon--md {
      font-size: 12px;
    }

    .checkbox-icon--lg {
      font-size: 14px;
    }

    .checkbox-label {
      font-size: var(--font-size-base);
      color: var(--color-text-primary);
      user-select: none;
      cursor: pointer;
    }

    .checkbox-label--sm {
      font-size: var(--font-size-sm);
    }

    .checkbox-label--md {
      font-size: var(--font-size-base);
    }

    .checkbox-label--lg {
      font-size: var(--font-size-lg);
    }

    :host([disabled]) .checkbox-label {
      color: var(--color-gray-500);
      cursor: not-allowed;
    }

    /* Hidden input */
    .checkbox-input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .checkbox {
        border-width: 2px;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .checkbox {
        transition: none;
      }
    }
  `;

  @property({ type: Boolean })
  checked: boolean = false;

  @property({ type: Boolean })
  disabled: boolean = false;

  @property({ type: Boolean })
  readonly: boolean = false;

  @property({ type: Boolean })
  required: boolean = false;

  @property({ type: Boolean })
  error: boolean = false;

  @property({ type: String })
  size: CheckboxProps['size'] = 'md';

  @property({ type: String })
  name?: CheckboxProps['name'];

  @property({ type: String })
  id?: CheckboxProps['id'];

  @property({ type: String })
  value?: CheckboxProps['value'];

  @property({ type: String })
  ariaLabel?: CheckboxProps['ariaLabel'];

  @property({ type: String })
  ariaDescribedBy?: CheckboxProps['ariaDescribedBy'];

  @property({ type: Boolean })
  indeterminate: boolean = false;

  private handleClick() {
    if (this.disabled || this.readonly) return;

    if (this.indeterminate) {
      this.checked = true;
      this.indeterminate = false;
    } else {
      this.checked = !this.checked;
    }

    this.dispatchEvent(new CustomEvent('change', {
      detail: { checked: this.checked, indeterminate: this.indeterminate },
      bubbles: true,
      composed: true
    }));
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleClick();
    }
  }

  private getCheckboxClasses() {
    return [
      'checkbox',
      `checkbox--${this.size}`,
      this.checked || this.indeterminate ? 'checkbox--checked' : '',
      this.indeterminate ? 'checkbox--indeterminate' : '',
      this.error ? 'checkbox--error' : ''
    ].filter(Boolean).join(' ');
  }

  private getLabelClasses() {
    return [
      'checkbox-label',
      `checkbox-label--${this.size}`
    ].filter(Boolean).join(' ');
  }

  private getIconClasses() {
    return [
      'checkbox-icon',
      `checkbox-icon--${this.size}`
    ].filter(Boolean).join(' ');
  }

  private getIcon() {
    if (this.indeterminate) {
      return html`
        <div class=${this.getIconClasses()}>—</div>
      `;
    } else if (this.checked) {
      return html`
        <div class=${this.getIconClasses()}>✓</div>
      `;
    }
    return nothing;
  }

  render(): TemplateResult {
    return html`
      <label class="checkbox-wrapper" @click=${this.handleClick}>
        <div
          class=${this.getCheckboxClasses()}
          role="checkbox"
          aria-checked=${this.indeterminate ? 'mixed' : this.checked}
          aria-disabled=${this.disabled}
          aria-required=${this.required}
          tabindex=${this.disabled || this.readonly ? -1 : 0}
          @keydown=${this.handleKeyDown}
        >
          ${this.getIcon()}
        </div>

        <input
          type="checkbox"
          class="checkbox-input"
          .checked=${this.checked}
          .disabled=${this.disabled}
          .readonly=${this.readonly}
          .required=${this.required}
          .name=${this.name || ''}
          .value=${this.value || ''}
          ?indeterminate=${this.indeterminate}
          @change=${(e: Event) => {
            const target = e.target as HTMLInputElement;
            this.checked = target.checked;
            this.indeterminate = target.indeterminate;
          }}
          aria-label=${this.ariaLabel}
          aria-describedby=${this.ariaDescribedBy}
        >

        <slot class=${this.getLabelClasses()}></slot>
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-checkbox': Checkbox;
  }
}