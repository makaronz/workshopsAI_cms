/**
 * Question Renderer Web Component
 * Renders different question types with accessibility support and validation
 */

import { type Language, translations } from '../i18n/translations.js';

interface QuestionConfig {
  id: string;
  text: { pl: string; en: string };
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'scale'
    | 'single_choice'
    | 'multiple_choice';
  options?: Array<{ value: string; label: { pl: string; en: string } }>;
  validation?: {
    required?: boolean;
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
    pattern?: string;
  };
  helpText?: { pl: string; en: string };
}

interface QuestionRendererConfig {
  question: QuestionConfig;
  language: Language;
  value?: unknown;
  onChange?: (questionId: string, value: unknown) => void;
}

export class QuestionRenderer extends HTMLElement {
  private config: QuestionRendererConfig;
  private currentValue: unknown;
  private questionElement: HTMLElement | null = null;

  constructor(config: QuestionRendererConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    this.config = config;
    this.currentValue = config.value;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.updateValue();
  }

  private render() {
    if (!this.shadowRoot) return;

    const { question, language } = this.config;
    const questionText = question.text[language];
    const helpText = question.helpText?.[language];
    const isRequired = question.validation?.required || false;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .question-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .question-header {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .question-label {
          font-weight: 600;
          color: #374151;
          line-height: 1.4;
          margin: 0;
        }

        .required-indicator {
          color: #dc2626;
          margin-left: 0.25rem;
        }

        .help-text {
          font-size: 0.875rem;
          color: #6b7280;
          line-height: 1.4;
          margin: 0;
        }

        .input-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* Text input styles */
        .text-input,
        .number-input {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
          font-family: inherit;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .text-input:focus,
        .number-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .text-input.error,
        .number-input.error {
          border-color: #dc2626;
        }

        /* Textarea styles */
        .textarea-input {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
          font-family: inherit;
          resize: vertical;
          min-height: 100px;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .textarea-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .textarea-input.error {
          border-color: #dc2626;
        }

        /* Character counter */
        .char-counter {
          font-size: 0.75rem;
          color: #6b7280;
          text-align: right;
        }

        .char-counter.warning {
          color: #f59e0b;
        }

        .char-counter.error {
          color: #dc2626;
        }

        /* Scale input styles */
        .scale-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .scale-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .scale-inputs {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .scale-option {
          position: relative;
          flex: 1;
          min-width: 44px;
          text-align: center;
        }

        .scale-option input[type="radio"] {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .scale-option input[type="radio"]:focus + label {
          box-shadow: 0 0 0 2px #3b82f6;
        }

        .scale-option label {
          display: block;
          padding: 0.5rem 0.25rem;
          border: 2px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .scale-option input[type="radio"]:checked + label {
          background-color: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .scale-option:hover label {
          border-color: #9ca3af;
        }

        .scale-option input[type="radio"]:checked + label:hover {
          background-color: #2563eb;
          border-color: #2563eb;
        }

        /* Single choice styles */
        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .radio-option {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .radio-option input[type="radio"] {
          margin-top: 0.25rem;
          width: 1.25rem;
          height: 1.25rem;
          cursor: pointer;
        }

        .radio-option input[type="radio"]:focus + label {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .radio-option label {
          cursor: pointer;
          flex: 1;
          padding: 0.5rem 0;
          font-size: 1rem;
          line-height: 1.4;
        }

        /* Multiple choice styles */
        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .checkbox-option {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .checkbox-option input[type="checkbox"] {
          margin-top: 0.25rem;
          width: 1.25rem;
          height: 1.25rem;
          cursor: pointer;
        }

        .checkbox-option input[type="checkbox"]:focus + label {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .checkbox-option label {
          cursor: pointer;
          flex: 1;
          padding: 0.5rem 0;
          font-size: 1rem;
          line-height: 1.4;
        }

        /* Validation error */
        .validation-error {
          font-size: 0.875rem;
          color: #dc2626;
          margin-top: 0.25rem;
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
          .scale-inputs {
            gap: 0.25rem;
          }

          .scale-option {
            min-width: 40px;
          }

          .scale-option label {
            padding: 0.5rem 0.125rem;
            font-size: 0.75rem;
          }
        }

        /* High contrast mode */
        @media (prefers-contrast: high) {
          .text-input,
          .number-input,
          .textarea-input {
            border-width: 2px;
          }

          .scale-option label,
          .radio-option label,
          .checkbox-option label {
            border: 1px solid #000;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          * {
            transition-duration: 0.01ms !important;
          }
        }
      </style>

      <div class="question-container">
        <div class="question-header">
          <label class="question-label" for="question-${this.config.question.id}">
            ${questionText}
            ${isRequired ? '<span class="required-indicator" aria-label="required">*</span>' : ''}
          </label>
          ${helpText ? `<p class="help-text">${helpText}</p>` : ''}
        </div>

        <div class="input-wrapper" id="input-wrapper-${this.config.question.id}">
          ${this.renderQuestionInput()}
        </div>

        <div id="validation-error-${this.config.question.id}" class="validation-error" role="alert" aria-live="polite"></div>
      </div>
    `;

    this.questionElement = this.shadowRoot.querySelector('.question-container');
  }

  private renderQuestionInput(): string {
    const { question, language } = this.config;
    const questionId = question.id;

    switch (question.type) {
    case 'text':
      return this.renderTextInput(question, questionId);
    case 'textarea':
      return this.renderTextareaInput(question, questionId);
    case 'number':
      return this.renderNumberInput(question, questionId);
    case 'scale':
      return this.renderScaleInput(question, questionId, language);
    case 'single_choice':
      return this.renderSingleChoiceInput(question, questionId, language);
    case 'multiple_choice':
      return this.renderMultipleChoiceInput(question, questionId, language);
    default:
      return this.renderTextInput(question, questionId);
    }
  }

  private renderTextInput(
    question: QuestionConfig,
    questionId: string,
  ): string {
    const maxLength = question.validation?.max_length;
    const required = question.validation?.required || false;

    return `
      <input
        type="text"
        id="question-${questionId}"
        class="text-input"
        maxlength="${maxLength || ''}"
        placeholder="${translations[this.config.language]['questionnaire.type_placeholder'] || 'Your answer...'}"
        ${required ? 'required' : ''}
        aria-describedby="${questionId}-help ${questionId}-error"
        data-question-id="${questionId}"
      />
      ${
  maxLength
    ? `
        <div class="char-counter" id="${questionId}-counter">
          <span class="char-count">0</span>/${maxLength}
        </div>
      `
    : ''
}
    `;
  }

  private renderTextareaInput(
    question: QuestionConfig,
    questionId: string,
  ): string {
    const maxLength = question.validation?.max_length;
    const required = question.validation?.required || false;

    return `
      <textarea
        id="question-${questionId}"
        class="textarea-input"
        rows="4"
        maxlength="${maxLength || ''}"
        placeholder="${translations[this.config.language]['questionnaire.type_placeholder'] || 'Your answer...'}"
        ${required ? 'required' : ''}
        aria-describedby="${questionId}-help ${questionId}-error"
        data-question-id="${questionId}"
      ></textarea>
      ${
  maxLength
    ? `
        <div class="char-counter" id="${questionId}-counter">
          <span class="char-count">0</span>/${maxLength}
        </div>
      `
    : ''
}
    `;
  }

  private renderNumberInput(
    question: QuestionConfig,
    questionId: string,
  ): string {
    const minValue = question.validation?.min_value;
    const maxValue = question.validation?.max_value;
    const required = question.validation?.required || false;

    return `
      <input
        type="number"
        id="question-${questionId}"
        class="number-input"
        min="${minValue || ''}"
        max="${maxValue || ''}"
        placeholder="${translations[this.config.language]['questionnaire.type_placeholder'] || 'Enter a number'}"
        ${required ? 'required' : ''}
        aria-describedby="${questionId}-help ${questionId}-error"
        data-question-id="${questionId}"
      />
    `;
  }

  private renderScaleInput(
    question: QuestionConfig,
    questionId: string,
    language: Language,
  ): string {
    const minValue = question.validation?.min_value || 1;
    const maxValue = question.validation?.max_value || 5;
    const required = question.validation?.required || false;

    const scaleLabels =
      question.options ||
      this.generateDefaultScaleLabels(minValue, maxValue, language);

    return `
      <div class="scale-container">
        <div class="scale-labels">
          <span>${scaleLabels[0].label[language]}</span>
          <span>${scaleLabels[scaleLabels.length - 1].label[language]}</span>
        </div>
        <div class="scale-inputs" role="radiogroup" aria-required="${required}">
          ${Array.from({ length: maxValue - minValue + 1 }, (_, i) => {
    const value = i + minValue;
    const label = scaleLabels[i]?.label[language] || value.toString();
    return `
              <div class="scale-option">
                <input
                  type="radio"
                  id="scale-${questionId}-${value}"
                  name="question-${questionId}"
                  value="${value}"
                  ${required ? 'required' : ''}
                  aria-describedby="${questionId}-help ${questionId}-error"
                />
                <label for="scale-${questionId}-${value}">${label}</label>
              </div>
            `;
  }).join('')}
        </div>
      </div>
    `;
  }

  private renderSingleChoiceInput(
    question: QuestionConfig,
    questionId: string,
    language: Language,
  ): string {
    const required = question.validation?.required || false;

    return `
      <div class="radio-group" role="radiogroup" aria-required="${required}">
        ${
  question.options
    ?.map(
      (option, index) => `
          <div class="radio-option">
            <input
              type="radio"
              id="choice-${questionId}-${index}"
              name="question-${questionId}"
              value="${option.value}"
              ${required ? 'required' : ''}
              aria-describedby="${questionId}-help ${questionId}-error"
            />
            <label for="choice-${questionId}-${index}">${option.label[language]}</label>
          </div>
        `,
    )
    .join('') || ''
}
      </div>
    `;
  }

  private renderMultipleChoiceInput(
    question: QuestionConfig,
    questionId: string,
    language: Language,
  ): string {
    return `
      <div class="checkbox-group" role="group" aria-required="${question.validation?.required || false}">
        ${
  question.options
    ?.map(
      (option, index) => `
          <div class="checkbox-option">
            <input
              type="checkbox"
              id="checkbox-${questionId}-${index}"
              name="question-${questionId}"
              value="${option.value}"
              aria-describedby="${questionId}-help ${questionId}-error"
            />
            <label for="checkbox-${questionId}-${index}">${option.label[language]}</label>
          </div>
        `,
    )
    .join('') || ''
}
      </div>
    `;
  }

  private generateDefaultScaleLabels(
    min: number,
    max: number,
    _language: Language,
  ): Array<{ value: string; label: { pl: string; en: string } }> {
    const labels: Array<{ value: string; label: { pl: string; en: string } }> =
      [];

    for (let i = min; i <= max; i++) {
      labels.push({
        value: i.toString(),
        label: {
          pl: i.toString(),
          en: i.toString(),
        },
      });
    }

    return labels;
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;

    const { question } = this.config;
    const questionId = question.id;

    // Find input elements based on question type
    let inputElements: NodeListOf<HTMLElement> | null = null;

    switch (question.type) {
    case 'text':
    case 'number':
      inputElements = this.shadowRoot.querySelectorAll(
        `input[data-question-id="${questionId}"]`,
      );
      break;
    case 'textarea':
      inputElements = this.shadowRoot.querySelectorAll(
        `textarea[data-question-id="${questionId}"]`,
      );
      break;
    case 'scale':
    case 'single_choice':
      inputElements = this.shadowRoot.querySelectorAll(
        `input[name="question-${questionId}"]`,
      );
      break;
    case 'multiple_choice':
      inputElements = this.shadowRoot.querySelectorAll(
        `input[name="question-${questionId}"]`,
      );
      break;
    }

    inputElements?.forEach(element => {
      element.addEventListener('change', this.handleChange.bind(this));
      element.addEventListener('input', this.handleInput.bind(this));
    });

    // Setup character counter for text/textarea inputs
    if (question.type === 'text' || question.type === 'textarea') {
      const counter = this.shadowRoot?.getElementById(`${questionId}-counter`);
      const input = this.shadowRoot?.querySelector(
        `[data-question-id="${questionId}"]`,
      ) as HTMLInputElement;

      if (counter && input && input.maxLength) {
        this.updateCharacterCounter(input, counter);
        input.addEventListener('input', () =>
          this.updateCharacterCounter(input, counter),
        );
      }
    }
  }

  private handleChange(event: Event) {
    const target = event.target as HTMLElement;
    const questionId =
      target.getAttribute('data-question-id') ||
      target.getAttribute('name')?.replace('question-', '');

    if (!questionId) return;

    const value = this.getValueFromElement(target);
    this.currentValue = value;

    // Clear validation error when user changes value
    this.clearValidationError();

    // Notify parent component
    if (this.config.onChange) {
      this.config.onChange(questionId, value);
    }
  }

  private handleInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const questionId = target.getAttribute('data-question-id');

    if (!questionId) return;

    const value = this.getValueFromElement(target);

    // Validate on input for immediate feedback
    if (this.shouldValidateOnInput()) {
      this.validateValue(value);
    }

    // For text/textarea inputs, also call onChange for auto-save
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      if (this.config.onChange) {
        this.config.onChange(questionId, value);
      }
    }
  }

  private getValueFromElement(element: HTMLElement): unknown {
    const { question } = this.config;

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      if (element.type === 'checkbox') {
        // For multiple choice, collect all checked values
        if (question.type === 'multiple_choice') {
          const checkboxes = this.shadowRoot?.querySelectorAll(
            `input[name="question-${question.id}"]:checked`,
          );
          return Array.from(checkboxes || []).map(
            cb => (cb as HTMLInputElement).value,
          );
        }
        return (element as HTMLInputElement).checked;
      } else if ((element as HTMLInputElement).type === 'radio') {
        return (element as HTMLInputElement).value;
      } else if ((element as HTMLInputElement).type === 'number') {
        return (element as HTMLInputElement).value
          ? Number((element as HTMLInputElement).value)
          : null;
      } else {
        return (element as HTMLInputElement | HTMLTextAreaElement).value;
      }
    }

    return null;
  }

  private updateCharacterCounter(
    input: HTMLInputElement | HTMLTextAreaElement,
    counter: HTMLElement,
  ) {
    const currentLength = input.value.length;
    const maxLength = input.maxLength;
    const charCountElement = counter.querySelector('.char-count');

    if (charCountElement) {
      charCountElement.textContent = currentLength.toString();

      // Update styling based on percentage
      const percentage = (currentLength / maxLength) * 100;
      counter.classList.remove('warning', 'error');

      if (percentage >= 100) {
        counter.classList.add('error');
      } else if (percentage >= 90) {
        counter.classList.add('warning');
      }
    }
  }

  private shouldValidateOnInput(): boolean {
    const { question } = this.config;

    // Validate immediately for number inputs and character limits
    return (
      question.type === 'number' ||
      question.validation?.max_length !== undefined
    );
  }

  private validateValue(value: unknown): boolean {
    const { question } = this.config;
    const errorElement = this.shadowRoot?.getElementById(
      `validation-error-${question.id}`,
    );
    const inputElement = this.shadowRoot?.querySelector(
      `[data-question-id="${question.id}"]`,
    ) as HTMLElement;

    if (!errorElement || !inputElement) return true;

    // Clear previous errors
    errorElement.textContent = '';
    inputElement.classList.remove('error');

    // Required validation
    if (question.validation?.required && (!value || value === '')) {
      this.showValidationError(
        translations[this.config.language]['validation.required'],
      );
      return false;
    }

    // Length validation
    if (typeof value === 'string') {
      const { min_length, max_length } = question.validation || {};

      if (min_length && value.length < min_length) {
        this.showValidationError(
          translations[this.config.language]['validation.min_length'].replace(
            '{{min}}',
            min_length.toString(),
          ),
        );
        return false;
      }

      if (max_length && value.length > max_length) {
        this.showValidationError(
          translations[this.config.language]['validation.max_length'].replace(
            '{{max}}',
            max_length.toString(),
          ),
        );
        return false;
      }
    }

    // Number validation
    if (question.type === 'number' && value !== null) {
      const numValue = Number(value);
      const { min_value, max_value } = question.validation || {};

      if (min_value !== undefined && numValue < min_value) {
        this.showValidationError(
          translations[this.config.language]['validation.min_value'].replace(
            '{{min}}',
            min_value.toString(),
          ),
        );
        return false;
      }

      if (max_value !== undefined && numValue > max_value) {
        this.showValidationError(
          translations[this.config.language]['validation.max_value'].replace(
            '{{max}}',
            max_value.toString(),
          ),
        );
        return false;
      }
    }

    return true;
  }

  private showValidationError(message: string) {
    const { question } = this.config;
    const errorElement = this.shadowRoot?.getElementById(
      `validation-error-${question.id}`,
    );
    const inputElement = this.shadowRoot?.querySelector(
      `[data-question-id="${question.id}"]`,
    ) as HTMLElement;

    if (errorElement && inputElement) {
      errorElement.textContent = message;
      inputElement.classList.add('error');
    }
  }

  private clearValidationError() {
    const { question } = this.config;
    const errorElement = this.shadowRoot?.getElementById(
      `validation-error-${question.id}`,
    );
    const inputElement = this.shadowRoot?.querySelector(
      `[data-question-id="${question.id}"]`,
    ) as HTMLElement;

    if (errorElement && inputElement) {
      errorElement.textContent = '';
      inputElement.classList.remove('error');
    }
  }

  private updateValue() {
    if (this.currentValue === undefined || this.currentValue === null) return;

    const { question } = this.config;
    const questionId = question.id;

    // Update the form element with the current value
    switch (question.type) {
    case 'text':
    case 'textarea': {
      const textInput = this.shadowRoot?.querySelector(
        `[data-question-id="${questionId}"]`,
      ) as HTMLInputElement;
      if (textInput) {
        textInput.value = typeof this.currentValue === 'string' ? this.currentValue : String(this.currentValue || '');
        // Update character counter if present
        const counter = this.shadowRoot?.getElementById(
          `${questionId}-counter`,
        );
        if (counter && textInput.maxLength) {
          this.updateCharacterCounter(textInput, counter);
        }
      }
      break;
    }

    case 'number': {
      const numberInput = this.shadowRoot?.querySelector(
        `[data-question-id="${questionId}"]`,
      ) as HTMLInputElement;
      if (numberInput) {
        numberInput.value = this.currentValue?.toString() || '';
      }
      break;
    }

    case 'scale':
    case 'single_choice': {
      const radioInput = this.shadowRoot?.querySelector(
        `input[name="question-${questionId}"][value="${this.currentValue}"]`,
      ) as HTMLInputElement;
      if (radioInput) {
        radioInput.checked = true;
      }
      break;
    }

    case 'multiple_choice':
      if (Array.isArray(this.currentValue)) {
        this.currentValue.forEach((value: string) => {
          const checkboxInput = this.shadowRoot?.querySelector(
            `input[name="question-${questionId}"][value="${value}"]`,
          ) as HTMLInputElement;
          if (checkboxInput) {
            checkboxInput.checked = true;
          }
        });
      }
      break;
    }
  }

  // Public methods
  getValue(): unknown {
    return this.currentValue;
  }

  setValue(value: unknown): void {
    this.currentValue = value;
    this.updateValue();
  }

  validate(): boolean {
    return this.validateValue(this.currentValue);
  }

  // Static method for element definition
  static get tagName() {
    return 'question-renderer';
  }
}

// Register the custom element
if (!customElements.get(QuestionRenderer.tagName)) {
  customElements.define(QuestionRenderer.tagName, QuestionRenderer);
}
