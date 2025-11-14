/**
 * Questionnaire Preview Web Component
 * Provides real-time preview of questionnaire functionality
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';

// Import types from the main builder
import type { Questionnaire, QuestionGroup, Question, BilingualText } from './questionnaire-builder.js';

export interface QuestionnairePreviewConfig {
  questionnaire: Questionnaire;
  language: 'pl' | 'en';
  mode?: 'edit' | 'preview' | 'test';
  onResponse?: (responses: Record<string, any>) => void;
  readonly?: boolean;
}

/**
 * Questionnaire Preview Component
 */
@customElement('questionnaire-preview')
export class QuestionnairePreview extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #374151;
    }

    .preview-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .preview-header {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      padding: 2rem;
      text-align: center;
    }

    .preview-title {
      font-size: 1.875rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
    }

    .preview-description {
      font-size: 1.125rem;
      opacity: 0.9;
      margin: 0;
      line-height: 1.5;
    }

    .preview-instructions {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 1rem 1.5rem;
      margin: 1.5rem;
      border-radius: 0 8px 8px 0;
    }

    .preview-instructions h3 {
      margin: 0 0 0.5rem 0;
      color: #1e40af;
      font-size: 1rem;
      font-weight: 600;
    }

    .preview-instructions p {
      margin: 0;
      color: #1e40af;
      font-size: 0.875rem;
    }

    .preview-content {
      padding: 0 1.5rem 2rem 1.5rem;
    }

    .progress-section {
      margin: 1.5rem 0;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 8px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .progress-title {
      font-weight: 600;
      color: #374151;
    }

    .progress-stats {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .progress-bar {
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #059669);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .group-section {
      margin: 2rem 0;
    }

    .group-header {
      margin-bottom: 1.5rem;
    }

    .group-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .group-icon {
      width: 2rem;
      height: 2rem;
      background: #3b82f6;
      color: white;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .group-description {
      color: #6b7280;
      margin: 0;
    }

    .questions-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .question-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.5rem;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .question-card:hover {
      border-color: #d1d5db;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .question-card:focus-within {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .question-header {
      margin-bottom: 1rem;
    }

    .question-text {
      font-size: 1.125rem;
      font-weight: 500;
      color: #111827;
      margin: 0 0 0.5rem 0;
      line-height: 1.4;
    }

    .question-required {
      color: #dc2626;
      font-weight: 600;
      margin-left: 0.25rem;
    }

    .question-help {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0;
      line-height: 1.4;
    }

    .question-input {
      margin-top: 0.75rem;
    }

    .text-input, .textarea-input, .number-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }

    .text-input:focus, .textarea-input:focus, .number-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .textarea-input {
      resize: vertical;
      min-height: 120px;
    }

    .scale-container {
      margin-top: 1rem;
    }

    .scale-labels {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .scale-options {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .scale-option {
      flex: 1;
      text-align: center;
    }

    .scale-option input[type="radio"] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    .scale-option label {
      display: block;
      padding: 0.75rem 0.5rem;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: 500;
      background: white;
    }

    .scale-option input[type="radio"]:checked + label {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .scale-option label:hover {
      border-color: #9ca3af;
    }

    .scale-option input[type="radio"]:checked + label:hover {
      background: #2563eb;
      border-color: #2563eb;
    }

    .radio-group, .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .radio-option, .checkbox-option {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      cursor: pointer;
    }

    .radio-option input[type="radio"],
    .checkbox-option input[type="checkbox"] {
      margin-top: 0.25rem;
      width: 1.25rem;
      height: 1.25rem;
      cursor: pointer;
    }

    .radio-option input[type="radio"]:focus + label,
    .checkbox-option input[type="checkbox"]:focus + label {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    .radio-option label,
    .checkbox-option label {
      cursor: pointer;
      flex: 1;
      padding: 0.5rem 0;
      font-size: 1rem;
      line-height: 1.4;
    }

    .character-counter {
      font-size: 0.75rem;
      color: #6b7280;
      text-align: right;
      margin-top: 0.25rem;
    }

    .character-counter.warning {
      color: #f59e0b;
    }

    .character-counter.error {
      color: #dc2626;
    }

    .validation-error {
      font-size: 0.875rem;
      color: #dc2626;
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .preview-actions {
      padding: 1.5rem;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .action-buttons {
      display: flex;
      gap: 1rem;
    }

    .button {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .button-primary {
      background: #3b82f6;
      color: white;
    }

    .button-primary:hover {
      background: #2563eb;
    }

    .button-secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .button-secondary:hover {
      background: #e5e7eb;
    }

    .preview-mode-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #fef3c7;
      color: #92400e;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .empty-questions {
      text-align: center;
      padding: 3rem 2rem;
      color: #6b7280;
    }

    .empty-questions-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .empty-questions-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #374151;
    }

    .consent-section {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 2rem 0;
    }

    .consent-title {
      font-weight: 600;
      color: #991b1b;
      margin: 0 0 0.75rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .consent-description {
      color: #7f1d1d;
      font-size: 0.875rem;
      line-height: 1.5;
      margin: 0 0 1rem 0;
    }

    .consent-checkbox {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .consent-checkbox input[type="checkbox"] {
      width: 1.25rem;
      height: 1.25rem;
      margin-top: 0.125rem;
    }

    .consent-checkbox label {
      font-size: 0.875rem;
      color: #7f1d1d;
      cursor: pointer;
      line-height: 1.4;
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .preview-container {
        margin: 0 0.5rem;
        border-radius: 8px;
      }

      .preview-header {
        padding: 1.5rem;
      }

      .preview-title {
        font-size: 1.5rem;
      }

      .preview-content {
        padding: 0 1rem 1rem 1rem;
      }

      .scale-options {
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .scale-option label {
        padding: 0.5rem 0.25rem;
        font-size: 0.875rem;
      }

      .action-buttons {
        flex-direction: column;
        width: 100%;
      }

      .button {
        width: 100%;
        justify-content: center;
      }

      .preview-actions {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }
    }

    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    @media (prefers-contrast: high) {
      .question-card {
        border-width: 2px;
      }

      .text-input, .textarea-input, .number-input {
        border-width: 2px;
      }

      .scale-option label,
      .radio-option label,
      .checkbox-option label {
        border: 1px solid #000;
      }
    }

    /* RTL support */
    :host([dir="rtl"]) {
      direction: rtl;
    }

    :host([dir="rtl"]) .scale-options {
      direction: rtl;
    }

    :host([dir="rtl"]) .radio-option,
    :host([dir="rtl"]) .checkbox-option {
      flex-direction: row-reverse;
    }

    /* Print styles */
    @media print {
      .preview-actions {
        display: none;
      }

      .preview-container {
        box-shadow: none;
        border: 1px solid #e5e7eb;
      }

      .preview-header {
        background: white !important;
        color: black !important;
      }
    }
  `;

  @property({ type: Object })
  config: QuestionnairePreviewConfig = {
    questionnaire: {} as Questionnaire,
    language: 'en',
    mode: 'preview'
  };

  @state()
  private responses: Record<string, any> = {};

  @state()
  private validationErrors: Record<string, string> = {};

  @state()
  private currentGroupIndex = 0;

  @state()
  private consentGiven = false;

  connectedCallback() {
    super.connectedCallback();
    this.initializeResponses();
  }

  private initializeResponses() {
    this.responses = {};
    this.validationErrors = {};

    this.config.questionnaire.groups.forEach(group => {
      group.questions.forEach(question => {
        // Set default values based on question type
        if (question.type === 'multiple_choice') {
          this.responses[question.id] = [];
        } else {
          this.responses[question.id] = '';
        }
      });
    });
  }

  private handleResponseChange(questionId: string, value: any) {
    this.responses[questionId] = value;

    // Clear validation error when user changes value
    if (this.validationErrors[questionId]) {
      delete this.validationErrors[questionId];
      this.requestUpdate();
    }

    // Auto-save responses if in test mode
    if (this.config.mode === 'test' && this.config.onResponse) {
      this.config.onResponse(this.responses);
    }
  }

  private validateQuestion(question: Question): boolean {
    const value = this.responses[question.id];
    const errors: string[] = [];

    // Required validation
    if (question.validation?.required) {
      if (question.type === 'multiple_choice') {
        if (!Array.isArray(value) || value.length === 0) {
          errors.push('This field is required');
        }
      } else if (!value || value === '') {
        errors.push('This field is required');
      }
    }

    // Length validation for text inputs
    if ((question.type === 'text' || question.type === 'textarea') && typeof value === 'string') {
      if (question.validation?.minLength && value.length < question.validation.minLength) {
        errors.push(`Minimum ${question.validation.minLength} characters required`);
      }
      if (question.validation?.maxLength && value.length > question.validation.maxLength) {
        errors.push(`Maximum ${question.validation.maxLength} characters allowed`);
      }
    }

    // Number validation
    if (question.type === 'number' || question.type === 'scale') {
      const numValue = Number(value);
      if (question.validation?.minValue !== undefined && numValue < question.validation.minValue) {
        errors.push(`Minimum value is ${question.validation.minValue}`);
      }
      if (question.validation?.maxValue !== undefined && numValue > question.validation.maxValue) {
        errors.push(`Maximum value is ${question.validation.maxValue}`);
      }
    }

    if (errors.length > 0) {
      this.validationErrors[question.id] = errors[0];
      return false;
    }

    delete this.validationErrors[question.id];
    return true;
  }

  private validateAllQuestions(): boolean {
    let isValid = true;

    this.config.questionnaire.groups.forEach(group => {
      group.questions.forEach(question => {
        if (!this.validateQuestion(question)) {
          isValid = false;
        }
      });
    });

    // Check consent if required
    if (this.config.questionnaire.settings.requireConsent && !this.consentGiven) {
      isValid = false;
    }

    return isValid;
  }

  private handleSubmit() {
    if (!this.validateAllQuestions()) {
      // Scroll to first error
      const firstErrorId = Object.keys(this.validationErrors)[0];
      if (firstErrorId) {
        const element = this.querySelector(`[data-question-id="${firstErrorId}"]`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (this.config.onResponse) {
      this.config.onResponse(this.responses);
    }

    // Show success message
    this.dispatchEvent(new CustomEvent('questionnaire-submitted', {
      detail: { responses: this.responses }
    }));
  }

  private getCharacterCount(questionId: string): number {
    const value = this.responses[questionId];
    return typeof value === 'string' ? value.length : 0;
  }

  private getCharacterLimit(question: Question): number | null {
    return question.validation?.maxLength || null;
  }

  private getCharacterCounterClass(questionId: string, question: Question): string {
    const count = this.getCharacterCount(questionId);
    const limit = this.getCharacterLimit(question);

    if (!limit) return '';

    const percentage = (count / limit) * 100;
    if (percentage >= 100) return 'error';
    if (percentage >= 90) return 'warning';
    return '';
  }

  private getTotalProgress(): number {
    const totalQuestions = this.config.questionnaire.groups.reduce(
      (total, group) => total + group.questions.length, 0
    );

    const answeredQuestions = Object.keys(this.responses).filter(id => {
      const value = this.responses[id];
      return value !== '' && value !== null && value !== undefined;
    }).length;

    return totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  }

  private renderQuestionInput(question: Question): TemplateResult {
    const value = this.responses[question.id];
    const hasError = this.validationErrors[question.id];

    switch (question.type) {
      case 'text':
        return this.renderTextInput(question, value, hasError);
      case 'textarea':
        return this.renderTextareaInput(question, value, hasError);
      case 'number':
        return this.renderNumberInput(question, value, hasError);
      case 'scale':
        return this.renderScaleInput(question, value, hasError);
      case 'single_choice':
        return this.renderSingleChoiceInput(question, value, hasError);
      case 'multiple_choice':
        return this.renderMultipleChoiceInput(question, value, hasError);
      default:
        return this.renderTextInput(question, value, hasError);
    }
  }

  private renderTextInput(question: Question, value: string, hasError: boolean): TemplateResult {
    const maxLength = this.getCharacterLimit(question);
    const charCount = this.getCharacterCount(question.id);
    const counterClass = this.getCharacterCounterClass(question.id, question);

    return html`
      <div class="question-input">
        <input
          type="text"
          class="text-input ${hasError ? 'error' : ''}"
          .value=${value || ''}
          placeholder="${this.config.language === 'pl' ? 'Twoja odpowiedź...' : 'Your answer...'}"
          maxlength="${maxLength || ''}"
          @input=${(e: Event) => this.handleResponseChange(question.id, (e.target as HTMLInputElement).value)}
          data-question-id="${question.id}"
        />
        ${maxLength ? html`
          <div class="character-counter ${counterClass}">
            ${charCount}/${maxLength}
          </div>
        ` : ''}
        ${hasError ? html`
          <div class="validation-error">
            <span>❌</span>
            <span>${this.validationErrors[question.id]}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderTextareaInput(question: Question, value: string, hasError: boolean): TemplateResult {
    const maxLength = this.getCharacterLimit(question);
    const charCount = this.getCharacterCount(question.id);
    const counterClass = this.getCharacterCounterClass(question.id, question);

    return html`
      <div class="question-input">
        <textarea
          class="textarea-input ${hasError ? 'error' : ''}"
          rows="4"
          .value=${value || ''}
          placeholder="${this.config.language === 'pl' ? 'Twoja odpowiedź...' : 'Your answer...'}"
          maxlength="${maxLength || ''}"
          @input=${(e: Event) => this.handleResponseChange(question.id, (e.target as HTMLTextAreaElement).value)}
          data-question-id="${question.id}"
        ></textarea>
        ${maxLength ? html`
          <div class="character-counter ${counterClass}">
            ${charCount}/${maxLength}
          </div>
        ` : ''}
        ${hasError ? html`
          <div class="validation-error">
            <span>❌</span>
            <span>${this.validationErrors[question.id]}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderNumberInput(question: Question, value: number | string, hasError: boolean): TemplateResult {
    return html`
      <div class="question-input">
        <input
          type="number"
          class="number-input ${hasError ? 'error' : ''}"
          .value=${value || ''}
          placeholder="${this.config.language === 'pl' ? 'Wprowadź liczbę...' : 'Enter a number...'}"
          @input=${(e: Event) => this.handleResponseChange(question.id, (e.target as HTMLInputElement).value)}
          data-question-id="${question.id}"
        />
        ${hasError ? html`
          <div class="validation-error">
            <span>❌</span>
            <span>${this.validationErrors[question.id]}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderScaleInput(question: Question, value: string, hasError: boolean): TemplateResult {
    const min = question.validation?.minValue || 1;
    const max = question.validation?.maxValue || 5;
    const labels = question.options || this.generateDefaultScaleLabels(min, max);

    return html`
      <div class="question-input">
        <div class="scale-container">
          ${labels.length > 0 ? html`
            <div class="scale-labels">
              <span>${labels[0].label[this.config.language]}</span>
              <span>${labels[labels.length - 1].label[this.config.language]}</span>
            </div>
          ` : ''}
          <div class="scale-options">
            ${Array.from({ length: max - min + 1 }, (_, i) => {
              const scaleValue = i + min;
              const label = labels[i]?.label[this.config.language] || scaleValue.toString();
              return html`
                <div class="scale-option">
                  <input
                    type="radio"
                    id="scale-${question.id}-${scaleValue}"
                    name="question-${question.id}"
                    .value=${scaleValue}
                    @change=${() => this.handleResponseChange(question.id, scaleValue)}
                    ?checked=${value === scaleValue.toString()}
                  />
                  <label for="scale-${question.id}-${scaleValue}">
                    ${label}
                  </label>
                </div>
              `;
            })}
          </div>
        </div>
        ${hasError ? html`
          <div class="validation-error">
            <span>❌</span>
            <span>${this.validationErrors[question.id]}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderSingleChoiceInput(question: Question, value: string, hasError: boolean): TemplateResult {
    return html`
      <div class="question-input">
        <div class="radio-group" role="radiogroup">
          ${question.options?.map((option, index) => html`
            <div class="radio-option">
              <input
                type="radio"
                id="choice-${question.id}-${index}"
                name="question-${question.id}"
                .value=${option.value}
                @change=${() => this.handleResponseChange(question.id, option.value)}
                ?checked=${value === option.value}
              />
              <label for="choice-${question.id}-${index}">
                ${option.label[this.config.language]}
              </label>
            </div>
          `)}
        </div>
        ${hasError ? html`
          <div class="validation-error">
            <span>❌</span>
            <span>${this.validationErrors[question.id]}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderMultipleChoiceInput(question: Question, value: string[], hasError: boolean): TemplateResult {
    return html`
      <div class="question-input">
        <div class="checkbox-group" role="group">
          ${question.options?.map((option, index) => html`
            <div class="checkbox-option">
              <input
                type="checkbox"
                id="checkbox-${question.id}-${index}"
                name="question-${question.id}"
                .value=${option.value}
                @change=${(e: Event) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  const currentValues = Array.isArray(value) ? [...value] : [];

                  if (checked) {
                    currentValues.push(option.value);
                  } else {
                    const index = currentValues.indexOf(option.value);
                    if (index > -1) {
                      currentValues.splice(index, 1);
                    }
                  }

                  this.handleResponseChange(question.id, currentValues);
                }}
                ?checked=${Array.isArray(value) && value.includes(option.value)}
              />
              <label for="checkbox-${question.id}-${index}">
                ${option.label[this.config.language]}
              </label>
            </div>
          `)}
        </div>
        ${hasError ? html`
          <div class="validation-error">
            <span>❌</span>
            <span>${this.validationErrors[question.id]}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  private generateDefaultScaleLabels(min: number, max: number): Array<{ value: string; label: BilingualText }> {
    const labels = [];
    for (let i = min; i <= max; i++) {
      labels.push({
        value: i.toString(),
        label: {
          pl: i.toString(),
          en: i.toString()
        }
      });
    }
    return labels;
  }

  private renderConsentSection(): TemplateResult {
    if (!this.config.questionnaire.settings.requireConsent) return '';

    return html`
      <div class="consent-section">
        <h3 class="consent-title">
          <span>🔒</span>
          <span>${this.config.language === 'pl' ? 'Zgoda na przetwarzanie danych' : 'Data Processing Consent'}</span>
        </h3>
        <p class="consent-description">
          ${this.config.language === 'pl' ?
            'Wypełniając ten kwestionariusz, wyrażasz zgodę na przetwarzanie Twoich danych osobowych. Twoje odpowiedzi mogą być analizowane za pomocą sztucznej inteligencji w celach badawczych. Wszystkie dane zostaną zanonimizowane.' :
            'By completing this questionnaire, you consent to the processing of your personal data. Your responses may be analyzed using artificial intelligence for research purposes. All data will be anonymized.'
          }
        </p>
        <div class="consent-checkbox">
          <input
            type="checkbox"
            id="consent-checkbox"
            @change=${(e: Event) => {
              this.consentGiven = (e.target as HTMLInputElement).checked;
              this.requestUpdate();
            }}
          />
          <label for="consent-checkbox">
            ${this.config.language === 'pl' ?
              'Wyrażam zgodę na przetwarzanie moich danych osobowych w celach badawczych.' :
              'I consent to the processing of my personal data for research purposes.'
            }
          </label>
        </div>
      </div>
    `;
  }

  render() {
    const questionnaire = this.config.questionnaire;
    const totalProgress = this.getTotalProgress();

    return html`
      <div class="preview-container">
        <div class="preview-header">
          <h1 class="preview-title">
            ${questionnaire.title[this.config.language] || questionnaire.title.en}
          </h1>
          ${questionnaire.description ? html`
            <p class="preview-description">
              ${questionnaire.description[this.config.language] || questionnaire.description.en}
            </p>
          ` : ''}
        </div>

        ${questionnaire.instructions ? html`
          <div class="preview-instructions">
            <h3>${this.config.language === 'pl' ? 'Instrukcje' : 'Instructions'}</h3>
            <p>${questionnaire.instructions[this.config.language] || questionnaire.instructions.en}</p>
          </div>
        ` : ''}

        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-title">
              ${this.config.language === 'pl' ? 'Postęp' : 'Progress'}
            </span>
            <span class="progress-stats">${totalProgress}% ${this.config.language === 'pl' ? 'ukończono' : 'completed'}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${totalProgress}%"></div>
          </div>
        </div>

        <div class="preview-content">
          ${questionnaire.groups.length > 0 ?
            questionnaire.groups.map((group, groupIndex) => html`
              <div class="group-section">
                <div class="group-header">
                  <h2 class="group-title">
                    <span class="group-icon">${group.uiConfig.icon || String.fromCharCode(65 + groupIndex)}</span>
                    <span>${group.title[this.config.language] || group.title.en}</span>
                  </h2>
                  ${group.description ? html`
                    <p class="group-description">
                      ${group.description[this.config.language] || group.description.en}
                    </p>
                  ` : ''}
                </div>

                <div class="questions-container">
                  ${group.questions.map(question => html`
                    <div class="question-card" data-question-id="${question.id}">
                      <div class="question-header">
                        <div class="question-text">
                          ${question.text[this.config.language] || question.text.en}
                          ${question.validation?.required ? html`<span class="question-required">*</span>` : ''}
                        </div>
                        ${question.helpText ? html`
                          <p class="question-help">
                            ${question.helpText[this.config.language] || question.helpText.en}
                          </p>
                        ` : ''}
                      </div>
                      ${this.renderQuestionInput(question)}
                    </div>
                  `)}
                </div>
              </div>
            `) : html`
              <div class="empty-questions">
                <div class="empty-questions-icon">📝</div>
                <div class="empty-questions-title">
                  ${this.config.language === 'pl' ? 'Brak pytań' : 'No Questions'}
                </div>
                <div>
                  ${this.config.language === 'pl' ?
                    'Ten kwestionariusz nie zawiera jeszcze żadnych pytań.' :
                    'This questionnaire doesn\'t contain any questions yet.'
                  }
                </div>
              </div>
            `
          }

          ${this.renderConsentSection()}
        </div>

        <div class="preview-actions">
          <div class="preview-mode-badge">
            <span>👁️</span>
            <span>
              ${this.config.mode === 'edit' ? (this.config.language === 'pl' ? 'Tryb edycji' : 'Edit Mode') :
                this.config.mode === 'preview' ? (this.config.language === 'pl' ? 'Podgląd' : 'Preview') :
                (this.config.language === 'pl' ? 'Test' : 'Test Mode')
              }
            </span>
          </div>

          ${this.config.mode === 'test' ? html`
            <div class="action-buttons">
              <button class="button button-primary" @click=${this.handleSubmit}>
                <span>📤</span>
                <span>${this.config.language === 'pl' ? 'Prześlij odpowiedzi' : 'Submit Responses'}</span>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

export default QuestionnairePreview;