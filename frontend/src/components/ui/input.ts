import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  error?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  value?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  pattern?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

@customElement('ui-input')
export class Input extends LitElement implements InputProps {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
    }

    .input {
      width: 100%;
      padding: var(--spacing-3) var(--spacing-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-family: var(--font-family-sans);
      font-size: var(--font-size-base);
      line-height: 1.5;
      color: var(--color-text-primary);
      background-color: var(--color-background);
      transition: var(--transition-colors), var(--transition-border-color);
      box-sizing: border-box;
    }

    .input:focus {
      outline: none;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px var(--color-primary-100);
    }

    .input:focus:not(:focus-visible) {
      box-shadow: none;
    }

    .input:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    /* Size variants */
    .input--sm {
      padding: var(--spacing-2) var(--spacing-3);
      font-size: var(--font-size-sm);
    }

    .input--md {
      padding: var(--spacing-3) var(--spacing-4);
      font-size: var(--font-size-base);
    }

    .input--lg {
      padding: var(--spacing-4) var(--spacing-5);
      font-size: var(--font-size-lg);
    }

    /* State variants */
    .input:disabled {
      background-color: var(--color-gray-50);
      color: var(--color-gray-500);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .input:readonly {
      background-color: var(--color-gray-50);
      cursor: default;
    }

    .input--error {
      border-color: var(--color-error-500);
    }

    .input--error:focus {
      border-color: var(--color-error-500);
      box-shadow: 0 0 0 3px var(--color-error-100);
    }

    /* Full width */
    .input--full-width {
      width: 100%;
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .input {
        border-width: 2px;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .input {
        transition: none;
      }
    }
  `;

  @property({ type: String })
  type: InputProps['type'] = 'text';

  @property({ type: String })
  placeholder?: InputProps['placeholder'];

  @property({ type: Boolean })
  disabled: boolean = false;

  @property({ type: Boolean })
  readonly: boolean = false;

  @property({ type: Boolean })
  required: boolean = false;

  @property({ type: Boolean })
  error: boolean = false;

  @property({ type: String })
  size: InputProps['size'] = 'md';

  @property({ type: Boolean })
  fullWidth: boolean = true;

  @property({ type: String })
  value?: InputProps['value'];

  @property({ type: String })
  name?: InputProps['name'];

  @property({ type: String })
  id?: InputProps['id'];

  @property({ type: String })
  autocomplete?: InputProps['autocomplete'];

  @property({ type: String })
  pattern?: InputProps['pattern'];

  @property({ type: String })
  min?: InputProps['min'];

  @property({ type: String })
  max?: InputProps['max'];

  @property({ type: String })
  step?: InputProps['step'];

  @property({ type: String })
  ariaLabel?: InputProps['ariaLabel'];

  @property({ type: String })
  ariaDescribedBy?: InputProps['ariaDescribedBy'];

  private handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent('input', {
      detail: { value: this.value },
      bubbles: true,
      composed: true
    }));
  }

  private handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value: this.value },
      bubbles: true,
      composed: true
    }));
  }

  private getClasses() {
    return [
      'input',
      `input--${this.size}`,
      this.error ? 'input--error' : '',
      this.fullWidth ? 'input--full-width' : ''
    ].filter(Boolean).join(' ');
  }

  private getInputAttributes() {
    const attrs: Record<string, string | boolean> = {
      type: this.type,
      disabled: this.disabled,
      readonly: this.readonly,
      required: this.required,
      class: this.getClasses()
    };

    if (this.placeholder) attrs.placeholder = this.placeholder;
    if (this.value !== undefined) attrs.value = this.value;
    if (this.name) attrs.name = this.name;
    if (this.id) attrs.id = this.id;
    if (this.autocomplete) attrs.autocomplete = this.autocomplete;
    if (this.pattern) attrs.pattern = this.pattern;
    if (this.min !== undefined) attrs.min = this.min;
    if (this.max !== undefined) attrs.max = this.max;
    if (this.step !== undefined) attrs.step = this.step;
    if (this.ariaLabel) attrs['aria-label'] = this.ariaLabel;
    if (this.ariaDescribedBy) attrs['aria-describedby'] = this.ariaDescribedBy;

    return attrs;
  }

  render(): TemplateResult {
    return html`
      <input
        @input=${this.handleInput}
        @change=${this.handleChange}
        ...=${this.getInputAttributes()}
      />
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-input': Input;
  }
}