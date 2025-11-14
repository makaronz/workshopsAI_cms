import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  selected?: boolean;
}

export interface SelectProps {
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  value?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  multiple?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

@customElement('ui-select')
export class Select extends LitElement implements SelectProps {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
    }

    .select {
      width: 100%;
      padding: var(--spacing-3) var(--spacing-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-family: var(--font-family-sans);
      font-size: var(--font-size-base);
      line-height: 1.5;
      color: var(--color-text-primary);
      background-color: var(--color-background);
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right var(--spacing-3) center;
      background-repeat: no-repeat;
      background-size: 1.5em 1.5em;
      padding-right: var(--spacing-10);
      transition: var(--transition-colors), var(--transition-border-color);
      box-sizing: border-box;
      appearance: none;
    }

    .select:focus {
      outline: none;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px var(--color-primary-100);
    }

    .select:focus:not(:focus-visible) {
      box-shadow: none;
    }

    .select:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    /* Size variants */
    .select--sm {
      padding: var(--spacing-2) var(--spacing-3);
      font-size: var(--font-size-sm);
      padding-right: var(--spacing-8);
      background-size: 1.2em 1.2em;
    }

    .select--md {
      padding: var(--spacing-3) var(--spacing-4);
      font-size: var(--font-size-base);
      padding-right: var(--spacing-10);
      background-size: 1.5em 1.5em;
    }

    .select--lg {
      padding: var(--spacing-4) var(--spacing-5);
      font-size: var(--font-size-lg);
      padding-right: var(--spacing-12);
      background-size: 1.8em 1.8em;
    }

    /* State variants */
    .select:disabled {
      background-color: var(--color-gray-50);
      color: var(--color-gray-500);
      cursor: not-allowed;
      opacity: 0.7;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    }

    .select--error {
      border-color: var(--color-error-500);
    }

    .select--error:focus {
      border-color: var(--color-error-500);
      box-shadow: 0 0 0 3px var(--color-error-100);
    }

    /* Multiple select */
    .select--multiple {
      background-image: none;
      padding-right: var(--spacing-4);
      min-height: 80px;
    }

    /* Full width */
    .select--full-width {
      width: 100%;
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .select {
        border-width: 2px;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .select {
        transition: none;
      }
    }
  `;

  @property({ type: Array })
  options: SelectOption[] = [];

  @property({ type: String })
  placeholder?: SelectProps['placeholder'];

  @property({ type: Boolean })
  disabled: boolean = false;

  @property({ type: Boolean })
  required: boolean = false;

  @property({ type: Boolean })
  error: boolean = false;

  @property({ type: String })
  size: SelectProps['size'] = 'md';

  @property({ type: Boolean })
  fullWidth: boolean = true;

  @property({ type: String })
  value?: SelectProps['value'];

  @property({ type: String })
  name?: SelectProps['name'];

  @property({ type: String })
  id?: SelectProps['id'];

  @property({ type: String })
  autocomplete?: SelectProps['autocomplete'];

  @property({ type: Boolean })
  multiple: boolean = false;

  @property({ type: String })
  ariaLabel?: SelectProps['ariaLabel'];

  @property({ type: String })
  ariaDescribedBy?: SelectProps['ariaDescribedBy'];

  private handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value: this.value },
      bubbles: true,
      composed: true
    }));
  }

  private getClasses() {
    return [
      'select',
      `select--${this.size}`,
      this.error ? 'select--error' : '',
      this.fullWidth ? 'select--full-width' : '',
      this.multiple ? 'select--multiple' : ''
    ].filter(Boolean).join(' ');
  }

  private getSelectAttributes() {
    const attrs: Record<string, string | boolean | number> = {
      disabled: this.disabled,
      required: this.required,
      multiple: this.multiple,
      class: this.getClasses()
    };

    if (this.name) attrs.name = this.name;
    if (this.id) attrs.id = this.id;
    if (this.autocomplete) attrs.autocomplete = this.autocomplete;
    if (this.ariaLabel) attrs['aria-label'] = this.ariaLabel;
    if (this.ariaDescribedBy) attrs['aria-describedby'] = this.ariaDescribedBy;

    return attrs;
  }

  render(): TemplateResult {
    return html`
      <select
        @change=${this.handleChange}
        ...=${this.getSelectAttributes()}
      >
        ${this.placeholder ? html`
          <option value="" disabled ?selected=${!this.value}>
            ${this.placeholder}
          </option>
        ` : ''}
        ${this.options.map(option => html`
          <option
            value="${option.value}"
            ?selected=${option.selected || this.value === option.value}
            ?disabled=${option.disabled}
          >
            ${option.label}
          </option>
        `)}
      </select>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-select': Select;
  }
}