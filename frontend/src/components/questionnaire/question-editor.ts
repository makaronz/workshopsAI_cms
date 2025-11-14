/**
 * Question Editor Web Component
 * Advanced editor for individual questions with comprehensive validation and options
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';

// Import types from the main builder
import type { Question, BilingualText, QuestionOption, QuestionValidation, ConditionalLogic } from './questionnaire-builder.js';

export interface QuestionEditorConfig {
  question?: Question;
  language: 'pl' | 'en';
  availableQuestions?: Question[]; // For conditional logic
  onSave?: (question: Question) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  readonly?: boolean;
}

/**
 * Question Editor Component
 */
@customElement('question-editor')
export class QuestionEditor extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #374151;
    }

    .editor-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 800px;
      margin: 0 auto;
      overflow: hidden;
    }

    .editor-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .editor-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
      color: #111827;
    }

    .editor-actions {
      display: flex;
      gap: 0.5rem;
    }

    .icon-button {
      width: 2rem;
      height: 2rem;
      border: none;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease;
      color: #6b7280;
    }

    .icon-button:hover {
      background: #e5e7eb;
    }

    .icon-button.danger:hover {
      background: #fef2f2;
      color: #dc2626;
    }

    .editor-content {
      padding: 1.5rem;
    }

    .form-section {
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 1rem 0;
      color: #111827;
    }

    .bilingual-inputs {
      display: grid;
      gap: 1rem;
    }

    .language-input {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .language-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
    }

    .input, .textarea, .select {
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }

    .input:focus, .textarea:focus, .select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .textarea {
      resize: vertical;
      min-height: 100px;
    }

    .type-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }

    .type-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
    }

    .type-option:hover {
      border-color: #d1d5db;
      background: #f9fafb;
    }

    .type-option.selected {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .type-option input[type="radio"] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .type-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .type-name {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .type-description {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .validation-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .validation-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .validation-label {
      font-weight: 500;
      color: #374151;
      font-size: 0.875rem;
    }

    .toggle-switch {
      position: relative;
      width: 3rem;
      height: 1.5rem;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: #d1d5db;
      border-radius: 1.5rem;
      transition: background 0.2s ease;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 1.125rem;
      width: 1.125rem;
      left: 0.1875rem;
      bottom: 0.1875rem;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s ease;
    }

    .toggle-switch input:checked + .toggle-slider {
      background: #3b82f6;
    }

    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(1.5rem);
    }

    .options-list {
      margin: 1rem 0;
    }

    .option-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      margin-bottom: 0.5rem;
    }

    .option-inputs {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .option-actions {
      display: flex;
      gap: 0.25rem;
    }

    .add-option-button {
      width: 100%;
      padding: 0.75rem;
      border: 2px dashed #d1d5db;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      color: #6b7280;
      font-weight: 500;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .add-option-button:hover {
      border-color: #3b82f6;
      color: #3b82f6;
      background: #f0f9ff;
    }

    .conditional-logic {
      background: #f0f9ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
    }

    .logic-grid {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 0.75rem;
      align-items: center;
    }

    .action-buttons {
      display: flex;
      gap: 1rem;
      padding: 1.5rem;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
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

    .button-danger {
      background: #dc2626;
      color: white;
    }

    .button-danger:hover {
      background: #b91c1c;
    }

    .scale-config {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
    }

    .scale-preview {
      display: flex;
      justify-content: space-between;
      margin: 1rem 0;
    }

    .scale-point {
      text-align: center;
      flex: 1;
    }

    .scale-value {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .scale-label {
      font-size: 0.875rem;
      color: #6b7280;
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .editor-content {
        padding: 1rem;
      }

      .type-grid {
        grid-template-columns: 1fr;
      }

      .validation-grid {
        grid-template-columns: 1fr;
      }

      .logic-grid {
        grid-template-columns: 1fr;
        gap: 0.5rem;
      }

      .option-inputs {
        grid-template-columns: 1fr;
      }

      .action-buttons {
        flex-direction: column;
      }

      .button {
        width: 100%;
        justify-content: center;
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
      .input, .textarea, .select {
        border-width: 2px;
      }

      .type-option {
        border-width: 2px;
      }
    }
  `;

  @property({ type: Object })
  config: QuestionEditorConfig = {
    language: 'en'
  };

  @state()
  private question: Question = this.createEmptyQuestion();

  @state()
  private currentLanguage: 'pl' | 'en' = 'en';

  @state()
  private scaleConfig = {
    min: 1,
    max: 5,
    labels: {
      pl: ['Bardzo źle', 'Źle', 'Średnio', 'Dobrze', 'Bardzo dobrze'],
      en: ['Very Poor', 'Poor', 'Fair', 'Good', 'Very Good']
    }
  };

  connectedCallback() {
    super.connectedCallback();
    this.currentLanguage = this.config.language || 'en';

    if (this.config.question) {
      this.question = { ...this.config.question };
      if (this.question.type === 'scale' && this.question.options) {
        this.initializeScaleConfig();
      }
    }
  }

  private createEmptyQuestion(): Question {
    return {
      id: `question_${Date.now()}`,
      text: { pl: '', en: '' },
      type: 'text',
      validation: {
        required: false
      },
      orderIndex: 0,
      helpText: { pl: '', en: '' }
    };
  }

  private initializeScaleConfig() {
    if (this.question.type === 'scale' && this.question.options) {
      const options = this.question.options;
      this.scaleConfig.min = parseInt(options[0].value);
      this.scaleConfig.max = parseInt(options[options.length - 1].value);

      // Extract labels
      this.scaleConfig.labels.pl = options.map(opt => opt.label.pl);
      this.scaleConfig.labels.en = options.map(opt => opt.label.en);
    }
  }

  private handleTextChange(language: 'pl' | 'en', value: string) {
    this.question.text[language] = value;
  }

  private handleHelpTextChange(language: 'pl' | 'en', value: string) {
    if (!this.question.helpText) {
      this.question.helpText = { pl: '', en: '' };
    }
    this.question.helpText[language] = value;
  }

  private handleTypeChange(type: Question['type']) {
    this.question.type = type;

    // Reset type-specific properties
    if (type !== 'single_choice' && type !== 'multiple_choice') {
      this.question.options = undefined;
    }

    if (type !== 'scale') {
      // Reset scale-specific validation
      if (this.question.validation) {
        delete this.question.validation.minValue;
        delete this.question.validation.maxValue;
      }
    }

    // Initialize default options for choice types
    if (type === 'single_choice' || type === 'multiple_choice') {
      this.question.options = this.getDefaultOptions(type);
    }

    this.requestUpdate();
  }

  private getDefaultOptions(type: 'single_choice' | 'multiple_choice'): QuestionOption[] {
    const baseOptions = [
      { value: 'option1', label: { pl: 'Opcja 1', en: 'Option 1' } },
      { value: 'option2', label: { pl: 'Opcja 2', en: 'Option 2' } }
    ];

    if (type === 'single_choice') {
      baseOptions.push(
        { value: 'option3', label: { pl: 'Opcja 3', en: 'Option 3' } }
      );
    }

    return baseOptions.map((opt, index) => ({
      ...opt,
      id: `option_${Date.now()}_${index}`
    }));
  }

  private handleValidationChange(key: keyof QuestionValidation, value: any) {
    if (!this.question.validation) {
      this.question.validation = {};
    }
    (this.question.validation as any)[key] = value;
  }

  private addOption() {
    if (!this.question.options) {
      this.question.options = [];
    }

    const newOption: QuestionOption = {
      id: `option_${Date.now()}`,
      value: `option${this.question.options.length + 1}`,
      label: {
        pl: `Opcja ${this.question.options.length + 1}`,
        en: `Option ${this.question.options.length + 1}`
      }
    };

    this.question.options.push(newOption);
    this.requestUpdate();
  }

  private removeOption(optionId: string) {
    if (!this.question.options) return;

    this.question.options = this.question.options.filter(opt => opt.id !== optionId);
    this.requestUpdate();
  }

  private handleOptionChange(optionId: string, field: 'value' | 'pl' | 'en', value: string) {
    if (!this.question.options) return;

    const option = this.question.options.find(opt => opt.id === optionId);
    if (!option) return;

    if (field === 'value') {
      option.value = value;
    } else {
      option.label[field as 'pl' | 'en'] = value;
    }

    this.requestUpdate();
  }

  private handleScaleConfigChange() {
    if (this.question.type !== 'scale') return;

    const options: QuestionOption[] = [];
    for (let i = this.scaleConfig.min; i <= this.scaleConfig.max; i++) {
      const index = i - this.scaleConfig.min;
      options.push({
        id: `scale_${i}`,
        value: i.toString(),
        label: {
          pl: this.scaleConfig.labels.pl[index] || i.toString(),
          en: this.scaleConfig.labels.en[index] || i.toString()
        }
      });
    }

    this.question.options = options;

    // Update validation
    if (!this.question.validation) {
      this.question.validation = {};
    }
    this.question.validation.minValue = this.scaleConfig.min;
    this.question.validation.maxValue = this.scaleConfig.max;
  }

  private updateScaleLabel(index: number, language: 'pl' | 'en', value: string) {
    this.scaleConfig.labels[language][index] = value;
    this.handleScaleConfigChange();
  }

  private handleSave() {
    if (this.config.onSave) {
      this.config.onSave(this.question);
    }
  }

  private handleCancel() {
    if (this.config.onCancel) {
      this.config.onCancel();
    }
  }

  private handleDelete() {
    if (this.config.onDelete) {
      this.config.onDelete();
    }
  }

  private renderQuestionTypes() {
    const types = [
      {
        value: 'text',
        icon: '📝',
        name: this.currentLanguage === 'pl' ? 'Krótka odpowiedź' : 'Short Answer',
        description: this.currentLanguage === 'pl' ? 'Jeden wiersz tekstu' : 'Single line of text'
      },
      {
        value: 'textarea',
        icon: '📄',
        name: this.currentLanguage === 'pl' ? 'Długa odpowiedź' : 'Long Answer',
        description: this.currentLanguage === 'pl' ? 'Wiele wierszy tekstu' : 'Multiple lines of text'
      },
      {
        value: 'number',
        icon: '🔢',
        name: this.currentLanguage === 'pl' ? 'Liczba' : 'Number',
        description: this.currentLanguage === 'pl' ? 'Wartość numeryczna' : 'Numeric value'
      },
      {
        value: 'scale',
        icon: '📊',
        name: this.currentLanguage === 'pl' ? 'Skala' : 'Scale',
        description: this.currentLanguage === 'pl' ? 'Ocena w skali' : 'Rating scale'
      },
      {
        value: 'single_choice',
        icon: '⭕',
        name: this.currentLanguage === 'pl' ? 'Wybór pojedynczy' : 'Single Choice',
        description: this.currentLanguage === 'pl' ? 'Wybierz jedną opcję' : 'Choose one option'
      },
      {
        value: 'multiple_choice',
        icon: '☑️',
        name: this.currentLanguage === 'pl' ? 'Wybór wielokrotny' : 'Multiple Choice',
        description: this.currentLanguage === 'pl' ? 'Wybierz wiele opcji' : 'Choose multiple options'
      }
    ];

    return html`
      <div class="type-grid">
        ${types.map(type => html`
          <label class="type-option ${classMap({ selected: this.question.type === type.value })}">
            <input
              type="radio"
              name="question-type"
              .value=${type.value}
              @change=${() => this.handleTypeChange(type.value as Question['type'])}
              ?disabled=${this.config.readonly}
              ?checked=${this.question.type === type.value}
            />
            <div class="type-icon">${type.icon}</div>
            <div class="type-name">${type.name}</div>
            <div class="type-description">${type.description}</div>
          </label>
        `)}
      </div>
    `;
  }

  private renderValidationOptions() {
    if (!this.question.validation) {
      this.question.validation = {};
    }

    return html`
      <div class="validation-grid">
        <div class="validation-item">
          <label class="toggle-switch">
            <input
              type="checkbox"
              ?checked=${this.question.validation?.required || false}
              @change=${(e: Event) =>
                this.handleValidationChange('required', (e.target as HTMLInputElement).checked)}
              ?disabled=${this.config.readonly}
            />
            <span class="toggle-slider"></span>
          </label>
          <span class="validation-label">
            ${this.currentLanguage === 'pl' ? 'Wymagane' : 'Required'}
          </span>
        </div>

        ${(this.question.type === 'text' || this.question.type === 'textarea') ? html`
          <div class="validation-item">
            <label class="validation-label">
              ${this.currentLanguage === 'pl' ? 'Min. znaków' : 'Min. characters'}
            </label>
            <input
              type="number"
              class="input"
              min="0"
              .value=${this.question.validation?.minLength || ''}
              @input=${(e: Event) =>
                this.handleValidationChange('minLength', parseInt((e.target as HTMLInputElement).value) || undefined)}
              ?disabled=${this.config.readonly}
            />
          </div>

          <div class="validation-item">
            <label class="validation-label">
              ${this.currentLanguage === 'pl' ? 'Max. znaków' : 'Max. characters'}
            </label>
            <input
              type="number"
              class="input"
              min="1"
              .value=${this.question.validation?.maxLength || ''}
              @input=${(e: Event) =>
                this.handleValidationChange('maxLength', parseInt((e.target as HTMLInputElement).value) || undefined)}
              ?disabled=${this.config.readonly}
            />
          </div>
        ` : ''}

        ${this.question.type === 'number' ? html`
          <div class="validation-item">
            <label class="validation-label">
              ${this.currentLanguage === 'pl' ? 'Min. wartość' : 'Min. value'}
            </label>
            <input
              type="number"
              class="input"
              .value=${this.question.validation?.minValue || ''}
              @input=${(e: Event) =>
                this.handleValidationChange('minValue', parseFloat((e.target as HTMLInputElement).value) || undefined)}
              ?disabled=${this.config.readonly}
            />
          </div>

          <div class="validation-item">
            <label class="validation-label">
              ${this.currentLanguage === 'pl' ? 'Max. wartość' : 'Max. value'}
            </label>
            <input
              type="number"
              class="input"
              .value=${this.question.validation?.maxValue || ''}
              @input=${(e: Event) =>
                this.handleValidationChange('maxValue', parseFloat((e.target as HTMLInputElement).value) || undefined)}
              ?disabled=${this.config.readonly}
            />
          </div>
        ` : ''}

        ${this.question.type === 'text' ? html`
          <div class="validation-item">
            <label class="validation-label">
              ${this.currentLanguage === 'pl' ? 'Wzorzec' : 'Pattern'}
            </label>
            <input
              type="text"
              class="input"
              placeholder="^[a-zA-Z0-9]+$"
              .value=${this.question.validation?.pattern || ''}
              @input=${(e: Event) =>
                this.handleValidationChange('pattern', (e.target as HTMLInputElement).value || undefined)}
              ?disabled=${this.config.readonly}
            />
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderOptionsEditor() {
    if (!this.question.options || (this.question.type !== 'single_choice' && this.question.type !== 'multiple_choice')) {
      return '';
    }

    return html`
      <div class="options-list">
        ${repeat(this.question.options, (option) => option.id, (option, index) => html`
          <div class="option-item">
            <div class="option-inputs">
              <input
                type="text"
                class="input"
                placeholder="${this.currentLanguage === 'pl' ? 'Wartość' : 'Value'}"
                .value=${option.value}
                @input=${(e: Event) =>
                  this.handleOptionChange(option.id, 'value', (e.target as HTMLInputElement).value)}
                ?disabled=${this.config.readonly}
              />
              <input
                type="text"
                class="input"
                placeholder="${this.currentLanguage === 'pl' ? 'Etykieta PL' : 'Label PL'}"
                .value=${option.label.pl}
                @input=${(e: Event) =>
                  this.handleOptionChange(option.id, 'pl', (e.target as HTMLInputElement).value)}
                ?disabled=${this.config.readonly}
              />
              <input
                type="text"
                class="input"
                placeholder="${this.currentLanguage === 'pl' ? 'Etykieta EN' : 'Label EN'}"
                .value=${option.label.en}
                @input=${(e: Event) =>
                  this.handleOptionChange(option.id, 'en', (e.target as HTMLInputElement).value)}
                ?disabled=${this.config.readonly}
              />
            </div>
            <div class="option-actions">
              ${!this.config.readonly && this.question.options && this.question.options.length > 2 ? html`
                <button class="icon-button danger" @click=${() => this.removeOption(option.id)}>
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>
        `)}

        ${!this.config.readonly ? html`
          <button class="add-option-button" @click=${this.addOption}>
            <span>➕</span>
            <span>${this.currentLanguage === 'pl' ? 'Dodaj opcję' : 'Add Option'}</span>
          </button>
        ` : ''}
      </div>
    `;
  }

  private renderScaleConfig() {
    if (this.question.type !== 'scale') {
      return '';
    }

    return html`
      <div class="scale-config">
        <h4 style="margin: 0 0 1rem 0; font-weight: 600;">
          ${this.currentLanguage === 'pl' ? 'Konfiguracja skali' : 'Scale Configuration'}
        </h4>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">
              ${this.currentLanguage === 'pl' ? 'Minimum' : 'Minimum'}
            </label>
            <input
              type="number"
              class="input"
              min="1"
              max="10"
              .value=${this.scaleConfig.min}
              @input=${(e: Event) => {
                this.scaleConfig.min = parseInt((e.target as HTMLInputElement).value) || 1;
                this.handleScaleConfigChange();
              }}
              ?disabled=${this.config.readonly}
            />
          </div>

          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">
              ${this.currentLanguage === 'pl' ? 'Maximum' : 'Maximum'}
            </label>
            <input
              type="number"
              class="input"
              min="2"
              max="10"
              .value=${this.scaleConfig.max}
              @input=${(e: Event) => {
                this.scaleConfig.max = parseInt((e.target as HTMLInputElement).value) || 5;
                this.handleScaleConfigChange();
              }}
              ?disabled=${this.config.readonly}
            />
          </div>
        </div>

        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">
            ${this.currentLanguage === 'pl' ? 'Etykiety skali' : 'Scale Labels'}
          </label>

          <div class="scale-preview">
            ${Array.from({ length: this.scaleConfig.max - this.scaleConfig.min + 1 }, (_, i) => {
              const value = this.scaleConfig.min + i;
              const index = i;
              return html`
                <div class="scale-point">
                  <div class="scale-value">${value}</div>
                  <input
                    type="text"
                    class="input"
                    style="font-size: 0.875rem; padding: 0.25rem; text-align: center;"
                    .value=${this.scaleConfig.labels[this.currentLanguage][index] || value.toString()}
                    @input=${(e: Event) => this.updateScaleLabel(index, this.currentLanguage, (e.target as HTMLInputElement).value)}
                    ?disabled=${this.config.readonly}
                  />
                </div>
              `;
            })}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="editor-container">
        <div class="editor-header">
          <h2 class="editor-title">
            ${this.config.question ?
              (this.currentLanguage === 'pl' ? 'Edytuj pytanie' : 'Edit Question') :
              (this.currentLanguage === 'pl' ? 'Nowe pytanie' : 'New Question')
            }
          </h2>
          <div class="editor-actions">
            ${this.config.question && !this.config.readonly ? html`
              <button class="icon-button danger" @click=${this.handleDelete} title="Delete question">
                🗑️
              </button>
            ` : ''}
            <button class="icon-button" @click=${this.handleCancel} title="Cancel">
              ❌
            </button>
          </div>
        </div>

        <div class="editor-content">
          <div class="form-section">
            <h3 class="section-title">
              ${this.currentLanguage === 'pl' ? 'Treść pytania' : 'Question Text'}
            </h3>

            <div class="bilingual-inputs">
              <div class="language-input">
                <label class="language-label">Polski</label>
                <textarea
                  class="textarea"
                  placeholder="${this.currentLanguage === 'pl' ? 'Wprowadź treść pytania...' : 'Enter question text...'}"
                  .value=${this.question.text.pl}
                  @input=${(e: Event) =>
                    this.handleTextChange('pl', (e.target as HTMLTextAreaElement).value)}
                  ?disabled=${this.config.readonly}
                ></textarea>
              </div>
              <div class="language-input">
                <label class="language-label">English</label>
                <textarea
                  class="textarea"
                  placeholder="${this.currentLanguage === 'pl' ? 'Wprowadź treść pytania...' : 'Enter question text...'}"
                  .value=${this.question.text.en}
                  @input=${(e: Event) =>
                    this.handleTextChange('en', (e.target as HTMLTextAreaElement).value)}
                  ?disabled=${this.config.readonly}
                ></textarea>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h3 class="section-title">
              ${this.currentLanguage === 'pl' ? 'Typ pytania' : 'Question Type'}
            </h3>
            ${this.renderQuestionTypes()}
          </div>

          <div class="form-section">
            <h3 class="section-title">
              ${this.currentLanguage === 'pl' ? 'Tekst pomocy' : 'Help Text'}
            </h3>
            <div class="bilingual-inputs">
              <div class="language-input">
                <label class="language-label">Polski</label>
                <textarea
                  class="textarea"
                  placeholder="${this.currentLanguage === 'pl' ? 'Opcjonalny tekst pomocy...' : 'Optional help text...'}"
                  .value=${this.question.helpText?.pl || ''}
                  @input=${(e: Event) =>
                    this.handleHelpTextChange('pl', (e.target as HTMLTextAreaElement).value)}
                  ?disabled=${this.config.readonly}
                ></textarea>
              </div>
              <div class="language-input">
                <label class="language-label">English</label>
                <textarea
                  class="textarea"
                  placeholder="${this.currentLanguage === 'pl' ? 'Opcjonalny tekst pomocy...' : 'Optional help text...'}"
                  .value=${this.question.helpText?.en || ''}
                  @input=${(e: Event) =>
                    this.handleHelpTextChange('en', (e.target as HTMLTextAreaElement).value)}
                  ?disabled=${this.config.readonly}
                ></textarea>
              </div>
            </div>
          </div>

          ${this.renderScaleConfig()}

          ${this.renderOptionsEditor()}

          <div class="form-section">
            <h3 class="section-title">
              ${this.currentLanguage === 'pl' ? 'Walidacja' : 'Validation'}
            </h3>
            ${this.renderValidationOptions()}
          </div>
        </div>

        ${!this.config.readonly ? html`
          <div class="action-buttons">
            <button class="button button-primary" @click=${this.handleSave}>
              <span>💾</span>
              <span>${this.currentLanguage === 'pl' ? 'Zapisz' : 'Save'}</span>
            </button>
            <button class="button button-secondary" @click=${this.handleCancel}>
              <span>❌</span>
              <span>${this.currentLanguage === 'pl' ? 'Anuluj' : 'Cancel'}</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }
}

export default QuestionEditor;