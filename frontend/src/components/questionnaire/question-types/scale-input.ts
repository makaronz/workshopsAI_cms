/**
 * Scale Input Question Type Component
 * Handles Likert scale and other rating scale questions
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { Question, BilingualText, QuestionOption } from '../questionnaire-builder.js';

export interface ScaleInputConfig {
  question: Question;
  value?: number | string;
  language: 'pl' | 'en';
  onChange?: (value: number) => void;
  onBlur?: (value: number) => void;
  readonly?: boolean;
  showLabels?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Scale Input Component
 */
@customElement('question-scale-input')
export class QuestionScaleInput extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .scale-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .scale-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
      color: #6b7280;
      font-weight: 500;
    }

    .scale-label-left {
      text-align: left;
    }

    .scale-label-right {
      text-align: right;
    }

    .scale-options {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
    }

    .scale-options.vertical {
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
    }

    .scale-option {
      position: relative;
      flex: 1;
      min-width: 44px; /* Minimum touch target size */
      text-align: center;
    }

    .scale-option.vertical {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .scale-option input[type="radio"] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    .scale-option input[type="radio"]:focus + label {
      box-shadow: 0 0 0 2px #3b82f6;
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    .scale-option label {
      display: block;
      padding: 0.75rem 0.5rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: 500;
      background: white;
      color: #374151;
      font-size: 0.875rem;
      line-height: 1.2;
      text-align: center;
      user-select: none;
    }

    .scale-option.vertical label {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      min-height: 44px;
    }

    .scale-option:hover label {
      border-color: #9ca3af;
      background: #f9fafb;
    }

    .scale-option input[type="radio"]:checked + label {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
    }

    .scale-option input[type="radio"]:checked + label:hover {
      background: #2563eb;
      border-color: #2563eb;
    }

    .scale-option input[type="radio"]:disabled + label {
      background: #f9fafb;
      color: #9ca3af;
      border-color: #e5e7eb;
      cursor: not-allowed;
    }

    .scale-value {
      display: block;
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .scale-text {
      font-size: 0.75rem;
      opacity: 0.8;
      line-height: 1.2;
    }

    .scale-option.vertical .scale-value {
      margin-bottom: 0;
      margin-right: 0.5rem;
    }

    .scale-option.vertical .scale-text {
      flex: 1;
      text-align: left;
      opacity: 0;
    }

    /* Visual scale with colors for emotion scales */
    .scale-visual {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: 0.5rem;
    }

    .scale-visual-point {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #e5e7eb;
      transition: all 0.2s ease;
    }

    .scale-visual-point.filled {
      background: #3b82f6;
    }

    /* Scale stepper */
    .scale-stepper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-top: 1rem;
    }

    .stepper-button {
      width: 2.5rem;
      height: 2.5rem;
      border: 2px solid #e5e7eb;
      background: white;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      transition: all 0.2s ease;
    }

    .stepper-button:hover:not(:disabled) {
      border-color: #3b82f6;
      color: #3b82f6;
    }

    .stepper-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .stepper-display {
      font-size: 1.5rem;
      font-weight: 600;
      color: #374151;
      min-width: 3rem;
      text-align: center;
    }

    /* Validation */
    .validation-message {
      font-size: 0.875rem;
      color: #dc2626;
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      * {
        transition-duration: 0.01ms !important;
      }
    }

    @media (prefers-contrast: high) {
      .scale-option label {
        border-width: 2px;
      }
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .scale-options {
        gap: 0.25rem;
      }

      .scale-option {
        min-width: 40px;
      }

      .scale-option label {
        padding: 0.5rem 0.25rem;
        font-size: 0.75rem;
      }

      .scale-stepper {
        gap: 0.75rem;
      }

      .stepper-button {
        width: 2rem;
        height: 2rem;
        font-size: 1rem;
      }
    }

    /* Touch-friendly improvements */
    @media (pointer: coarse) {
      .scale-option label {
        padding: 1rem 0.5rem;
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  `;

  @property({ type: Object })
  config: ScaleInputConfig;

  @state()
  private internalValue: number | null = null;

  @state()
  private isValid = true;

  @state()
  private validationMessage = '';

  connectedCallback() {
    super.connectedCallback();
    this.internalValue = this.config.value ? Number(this.config.value) : null;
    this.validate();
  }

  private get minValue(): number {
    return this.config.question.validation?.minValue || 1;
  }

  private get maxValue(): number {
    return this.config.question.validation?.maxValue || 5;
  }

  private get isRequired(): boolean {
    return this.config.question.validation?.required || false;
  }

  private getScaleOptions(): QuestionOption[] {
    if (this.config.question.options && this.config.question.options.length > 0) {
      return this.config.question.options;
    }

    // Generate default scale options
    const options: QuestionOption[] = [];
    for (let i = this.minValue; i <= this.maxValue; i++) {
      options.push({
        id: `scale-${i}`,
        value: i.toString(),
        label: {
          pl: i.toString(),
          en: i.toString()
        }
      });
    }
    return options;
  }

  private getScaleLabel(index: number): string {
    const options = this.getScaleOptions();
    const option = options[index];
    return option ? option.label[this.config.language] : (index + 1).toString();
  }

  private handleChange(value: number) {
    this.internalValue = value;
    this.validate();

    if (this.config.onChange) {
      this.config.onChange(value);
    }
  }

  private handleStepperChange(direction: 'up' | 'down') {
    if (this.internalValue === null) {
      this.handleChange(this.minValue);
      return;
    }

    const newValue = direction === 'up' ?
      Math.min(this.internalValue + 1, this.maxValue) :
      Math.max(this.internalValue - 1, this.minValue);

    this.handleChange(newValue);
  }

  private handleBlur() {
    this.validate();

    if (this.config.onBlur && this.internalValue !== null) {
      this.config.onBlur(this.internalValue);
    }
  }

  private validate(): boolean {
    const errors: string[] = [];

    // Required validation
    if (this.isRequired && this.internalValue === null) {
      errors.push(this.config.language === 'pl' ? 'Wybierz wartość' : 'Please select a value');
    }

    // Range validation (if value is set)
    if (this.internalValue !== null) {
      if (this.internalValue < this.minValue || this.internalValue > this.maxValue) {
        errors.push(
          this.config.language === 'pl' ?
            `Wybierz wartość od ${this.minValue} do ${this.maxValue}` :
            `Please select a value between ${this.minValue} and ${this.maxValue}`
        );
      }
    }

    this.isValid = errors.length === 0;
    this.validationMessage = errors[0] || '';

    return this.isValid;
  }

  private renderScaleOption(option: QuestionOption, index: number): TemplateResult {
    const value = Number(option.value);
    const isChecked = this.internalValue === value;
    const isDisabled = this.config.readonly;

    return html`
      <div class="scale-option">
        <input
          type="radio"
          id="scale-${this.config.question.id}-${value}"
          name="scale-${this.config.question.id}"
          .value=${value}
          @change=${() => this.handleChange(value)}
          @blur=${this.handleBlur}
          ?checked=${isChecked}
          ?disabled=${isDisabled}
        />
        <label for="scale-${this.config.question.id}-${value}">
          <span class="scale-value">${value}</span>
          ${option.label.pl !== option.value || option.label.en !== option.value ? html`
            <span class="scale-text">${this.getScaleLabel(index)}</span>
          ` : ''}
        </label>
      </div>
    `;
  }

  private renderVerticalScaleOption(option: QuestionOption, index: number): TemplateResult {
    const value = Number(option.value);
    const isChecked = this.internalValue === value;
    const isDisabled = this.config.readonly;
    const label = this.getScaleLabel(index);

    return html`
      <div class="scale-option">
        <input
          type="radio"
          id="scale-vertical-${this.config.question.id}-${value}"
          name="scale-vertical-${this.config.question.id}"
          .value=${value}
          @change=${() => this.handleChange(value)}
          @blur=${this.handleBlur}
          ?checked=${isChecked}
          ?disabled=${isDisabled}
        />
        <label for="scale-vertical-${this.config.question.id}-${value}">
          <span class="scale-value">${value}</span>
          <span class="scale-text">${label}</span>
        </label>
      </div>
    `;
  }

  private renderScaleVisual(): TemplateResult {
    const options = this.getScaleOptions();
    const currentIndex = this.internalValue ?
      options.findIndex(opt => Number(opt.value) === this.internalValue) : -1;

    return html`
      <div class="scale-visual">
        ${options.map((_, index) => html`
          <div
            class="scale-visual-point ${classMap({ filled: index <= currentIndex && currentIndex >= 0 })}"
          ></div>
        `)}
      </div>
    `;
  }

  private renderScaleStepper(): TemplateResult {
    const canDecrease = this.internalValue === null || this.internalValue > this.minValue;
    const canIncrease = this.internalValue === null || this.internalValue < this.maxValue;

    return html`
      <div class="scale-stepper">
        <button
          type="button"
          class="stepper-button"
          @click=${() => this.handleStepperChange('down')}
          ?disabled=${this.config.readonly || !canDecrease}
          aria-label="${this.config.language === 'pl' ? 'Zmniejsz' : 'Decrease'}"
        >
          −
        </button>
        <div class="stepper-display">
          ${this.internalValue !== null ? this.internalValue : '-'}
        </div>
        <button
          type="button"
          class="stepper-button"
          @click=${() => this.handleStepperChange('up')}
          ?disabled=${this.config.readonly || !canIncrease}
          aria-label="${this.config.language === 'pl' ? 'Zwiększ' : 'Increase'}"
        >
          +
        </button>
      </div>
    `;
  }

  render() {
    const options = this.getScaleOptions();
    const isVertical = this.config.orientation === 'vertical';
    const showLabels = this.config.showLabels !== false;

    return html`
      <div class="scale-container">
        ${showLabels && options.length > 0 ? html`
          <div class="scale-labels">
            <span class="scale-label-left">
              ${this.getScaleLabel(0)}
            </span>
            <span class="scale-label-right">
              ${this.getScaleLabel(options.length - 1)}
            </span>
          </div>
        ` : ''}

        <div class="scale-options ${classMap({ vertical: isVertical })}"
             role="radiogroup"
             aria-label="${this.config.question.text[this.config.language]}">
          ${options.map((option, index) =>
            isVertical ?
              this.renderVerticalScaleOption(option, index) :
              this.renderScaleOption(option, index)
          )}
        </div>

        ${this.renderScaleVisual()}

        ${this.renderScaleStepper()}

        ${!this.isValid ? html`
          <div class="validation-message" role="alert">
            <span>❌</span>
            <span>${this.validationMessage}</span>
          </div>
        ` : ''}
      </div>
    `;
  }
}

export default QuestionScaleInput;