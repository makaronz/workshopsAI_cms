import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface TextareaProps {
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
  rows?: number;
  cols?: number;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  maxLength?: number;
  minLength?: number;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

@customElement('ui-textarea')
export class Textarea extends LitElement implements TextareaProps {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
    }

    .textarea {
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
      resize: vertical;
      min-height: 100px;
    }

    .textarea:focus {
      outline: none;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px var(--color-primary-100);
    }

    .textarea:focus:not(:focus-visible) {
      box-shadow: none;
    }

    .textarea:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    /* Size variants */
    .textarea--sm {
      padding: var(--spacing-2) var(--spacing-3);
      font-size: var(--font-size-sm);
      min-height: 80px;
    }

    .textarea--md {
      padding: var(--spacing-3) var(--spacing-4);
      font-size: var(--font-size-base);
      min-height: 100px;
    }

    .textarea--lg {
      padding: var(--spacing-4) var(--spacing-5);
      font-size: var(--font-size-lg);
      min-height: 120px;
    }

    /* Resize variants */
    .textarea--resize-none {
      resize: none;
    }

    .textarea--resize-vertical {
      resize: vertical;
    }

    .textarea--resize-horizontal {
      resize: horizontal;
    }

    .textarea--resize-both {
      resize: both;
    }

    /* State variants */
    .textarea:disabled {
      background-color: var(--color-gray-50);
      color: var(--color-gray-500);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .textarea:readonly {
      background-color: var(--color-gray-50);
      cursor: default;
    }

    .textarea--error {
      border-color: var(--color-error-500);
    }

    .textarea--error:focus {
      border-color: var(--color-error-500);
      box-shadow: 0 0 0 3px var(--color-error-100);
    }

    /* Full width */
    .textarea--full-width {
      width: 100%;
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .textarea {
        border-width: 2px;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .textarea {
        transition: none;
      }
    }
  `;

  @property({ type: String })
  placeholder?: TextareaProps['placeholder'];

  @property({ type: Boolean })
  disabled: boolean = false;

  @property({ type: Boolean })
  readonly: boolean = false;

  @property({ type: Boolean })
  required: boolean = false;

  @property({ type: Boolean })
  error: boolean = false;

  @property({ type: String })
  size: TextareaProps['size'] = 'md';

  @property({ type: Boolean })
  fullWidth: boolean = true;

  @property({ type: String })
  value?: TextareaProps['value'];

  @property({ type: String })
  name?: TextareaProps['name'];

  @property({ type: String })
  id?: TextareaProps['id'];

  @property({ type: Number })
  rows?: TextareaProps['rows'] = 4;

  @property({ type: Number })
  cols?: TextareaProps['cols'];

  @property({ type: String })
  resize: TextareaProps['resize'] = 'vertical';

  @property({ type: Number })
  maxLength?: TextareaProps['maxLength'];

  @property({ type: Number })
  minLength?: TextareaProps['minLength'];

  @property({ type: String })
  ariaLabel?: TextareaProps['ariaLabel'];

  @property({ type: String })
  ariaDescribedBy?: TextareaProps['ariaDescribedBy'];

  private handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent('input', {
      detail: { value: this.value },
      bubbles: true,
      composed: true
    }));
  }

  private handleChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value: this.value },
      bubbles: true,
      composed: true
    }));
  }

  private getClasses() {
    return [
      'textarea',
      `textarea--${this.size}`,
      `textarea--resize-${this.resize}`,
      this.error ? 'textarea--error' : '',
      this.fullWidth ? 'textarea--full-width' : ''
    ].filter(Boolean).join(' ');
  }

  private getTextareaAttributes() {
    const attrs: Record<string, string | number | boolean> = {
      disabled: this.disabled,
      readonly: this.readonly,
      required: this.required,
      class: this.getClasses(),
      rows: this.rows
    };

    if (this.placeholder) attrs.placeholder = this.placeholder;
    if (this.value !== undefined) attrs.value = this.value;
    if (this.name) attrs.name = this.name;
    if (this.id) attrs.id = this.id;
    if (this.cols) attrs.cols = this.cols;
    if (this.maxLength !== undefined) attrs.maxLength = this.maxLength;
    if (this.minLength !== undefined) attrs.minLength = this.minLength;
    if (this.ariaLabel) attrs['aria-label'] = this.ariaLabel;
    if (this.ariaDescribedBy) attrs['aria-describedby'] = this.ariaDescribedBy;

    return attrs;
  }

  render(): TemplateResult {
    return html`
      <textarea
        @input=${this.handleInput}
        @change=${this.handleChange}
        ...=${this.getTextareaAttributes()}
      ></textarea>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-textarea': Textarea;
  }
}