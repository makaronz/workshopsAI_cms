/**
 * Choice Input Question Type Component
 * Handles single choice (radio) and multiple choice (checkbox) questions
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { Question, BilingualText, QuestionOption } from '../questionnaire-builder.js';

export interface ChoiceInputConfig {
  question: Question;
  value?: string | string[];
  language: 'pl' | 'en';
  onChange?: (value: string | string[]) => void;
  onBlur?: (value: string | string[]) => void;
  readonly?: boolean;
  layout?: 'vertical' | 'horizontal' | 'grid';
  maxSelections?: number;
}

/**
 * Choice Input Component
 */
@customElement('question-choice-input')
export class QuestionChoiceInput extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .choice-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .choice-group {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .choice-group.horizontal {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .choice-group.grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .choice-option {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 6px;
      transition: background-color 0.15s ease;
    }

    .choice-option:hover {
      background: #f9fafb;
    }

    .choice-option.selected {
      background: #eff6ff;
    }

    .choice-option.disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .choice-input {
      width: 1.25rem;
      height: 1.25rem;
      margin-top: 0.125rem;
      cursor: pointer;
      accent-color: #3b82f6;
    }

    .choice-content {
      flex: 1;
      min-width: 0;
    }

    .choice-label {
      display: block;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1.4;
      color: #374151;
      word-break: break-word;
    }

    .choice-description {
      display: block;
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 0.25rem;
      line-height: 1.3;
    }

    .choice-icon {
      font-size: 1.5rem;
      margin-left: auto;
      opacity: 0.8;
    }

    /* Card-style choice options */
    .choice-card {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: white;
    }

    .choice-card:hover {
      border-color: #d1d5db;
      background: #f9fafb;
    }

    .choice-card.selected {
      border-color: #3b82f6;
      background: #eff6ff;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .choice-card.selected .choice-label {
      color: #1e40af;
      font-weight: 500;
    }

    .choice-card.disabled {
      border-color: #f3f4f6;
      background: #f9fafb;
      opacity: 0.6;
      cursor: not-allowed;
    }

    .choice-input-card {
      width: 1.25rem;
      height: 1.25rem;
      margin-top: 0.125rem;
      accent-color: #3b82f6;
    }

    /* Visual enhancement for selected items */
    .selection-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      background: #3b82f6;
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      margin-left: auto;
      opacity: 0;
      transform: scale(0);
      transition: all 0.2s ease;
    }

    .choice-card.selected .selection-indicator {
      opacity: 1;
      transform: scale(1);
    }

    /* Multiple choice selection counter */
    .selection-counter {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.75rem;
      background: #f3f4f6;
      border-radius: 6px;
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 1rem;
    }

    .counter-text {
      font-weight: 500;
    }

    .counter-number {
      background: #3b82f6;
      color: white;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
    }

    /* Search/Filter for long lists */
    .choice-filter {
      position: relative;
      margin-bottom: 1rem;
    }

    .filter-input {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 2.5rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }

    .filter-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .filter-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      pointer-events: none;
    }

    /* No results message */
    .no-results {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }

    .no-results-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      opacity: 0.5;
    }

    /* Other/Custom option */
    .custom-option {
      margin-top: 1rem;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .custom-input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .custom-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
      .choice-card {
        border-width: 2px;
      }
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .choice-group.grid {
        grid-template-columns: 1fr;
      }

      .choice-group.horizontal {
        flex-direction: column;
        gap: 0.75rem;
      }

      .choice-card {
        padding: 0.75rem;
      }
    }

    /* Touch-friendly improvements */
    @media (pointer: coarse) {
      .choice-option, .choice-card {
        padding: 0.75rem;
        min-height: 48px;
        display: flex;
        align-items: center;
      }
    }
  `;

  @property({ type: Object })
  config: ChoiceInputConfig;

  @state()
  private internalValue: string | string[] = '';

  @state()
  private isValid = true;

  @state()
  private validationMessage = '';

  @state()
  private filterText = '';

  @state()
  private customValue = '';

  @state()
  private showCustomOption = false;

  connectedCallback() {
    super.connectedCallback();

    if (this.config.question.type === 'single_choice') {
      this.internalValue = this.config.value || '';
    } else {
      this.internalValue = Array.isArray(this.config.value) ? [...this.config.value] : [];
    }

    this.validate();
  }

  private get isMultipleChoice(): boolean {
    return this.config.question.type === 'multiple_choice';
  }

  private get isRequired(): boolean {
    return this.config.question.validation?.required || false;
  }

  private get maxSelections(): number {
    return this.config.maxSelections || Infinity;
  }

  private getSelectedCount(): number {
    return Array.isArray(this.internalValue) ? this.internalValue.length : (this.internalValue ? 1 : 0);
  }

  private getFilteredOptions(): QuestionOption[] {
    if (!this.filterText) {
      return this.config.question.options || [];
    }

    const filterLower = this.filterText.toLowerCase();
    return (this.config.question.options || []).filter(option =>
      option.label.pl.toLowerCase().includes(filterLower) ||
      option.label.en.toLowerCase().includes(filterLower) ||
      option.value.toLowerCase().includes(filterLower)
    );
  }

  private handleChange(value: string) {
    if (this.isMultipleChoice) {
      const currentValue = Array.isArray(this.internalValue) ? [...this.internalValue] : [];
      const index = currentValue.indexOf(value);

      if (index > -1) {
        currentValue.splice(index, 1);
      } else {
        if (currentValue.length < this.maxSelections) {
          currentValue.push(value);
        } else {
          // Max selections reached
          return;
        }
      }

      this.internalValue = currentValue;
    } else {
      this.internalValue = value;
    }

    this.validate();

    if (this.config.onChange) {
      this.config.onChange(this.internalValue);
    }
  }

  private handleCustomInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.customValue = target.value;

    if (this.isMultipleChoice) {
      const currentValue = Array.isArray(this.internalValue) ? [...this.internalValue] : [];
      const customIndex = currentValue.findIndex(val => val.startsWith('custom:'));

      if (customIndex > -1) {
        currentValue[customIndex] = `custom:${this.customValue}`;
      } else if (this.customValue) {
        currentValue.push(`custom:${this.customValue}`);
      }

      this.internalValue = currentValue;
    } else {
      this.internalValue = this.customValue;
    }

    this.validate();

    if (this.config.onChange) {
      this.config.onChange(this.internalValue);
    }
  }

  private handleBlur() {
    this.validate();

    if (this.config.onBlur) {
      this.config.onBlur(this.internalValue);
    }
  }

  private validate(): boolean {
    const errors: string[] = [];

    // Required validation
    if (this.isRequired) {
      if (this.isMultipleChoice) {
        if (!Array.isArray(this.internalValue) || this.internalValue.length === 0) {
          errors.push(this.config.language === 'pl' ? 'Wybierz co najmniej jedną opcję' : 'Please select at least one option');
        }
      } else {
        if (!this.internalValue) {
          errors.push(this.config.language === 'pl' ? 'Wybierz opcję' : 'Please select an option');
        }
      }
    }

    this.isValid = errors.length === 0;
    this.validationMessage = errors[0] || '';

    return this.isValid;
  }

  private isSelected(option: QuestionOption): boolean {
    if (this.isMultipleChoice) {
      const values = Array.isArray(this.internalValue) ? this.internalValue : [];
      return values.includes(option.value);
    } else {
      return this.internalValue === option.value;
    }
  }

  private isOptionDisabled(option: QuestionOption): boolean {
    if (this.config.readonly) return true;

    if (this.isMultipleChoice) {
      const values = Array.isArray(this.internalValue) ? this.internalValue : [];
      return values.length >= this.maxSelections && !this.isSelected(option);
    }

    return false;
  }

  private getSelectionCounter(): TemplateResult | null {
    if (!this.isMultipleChoice || this.maxSelections === Infinity) {
      return null;
    }

    const count = this.getSelectedCount();
    const max = this.maxSelections;

    return html`
      <div class="selection-counter">
        <span class="counter-text">
          ${this.config.language === 'pl' ? 'Wybrane:' : 'Selected:'}
        </span>
        <span class="counter-number">${count}/${max}</span>
      </div>
    `;
  }

  private renderChoiceOption(option: QuestionOption): TemplateResult {
    const isSelected = this.isSelected(option);
    const isDisabled = this.isOptionDisabled(option);
    const inputId = `choice-${this.config.question.id}-${option.value}`;
    const useCardStyle = (this.config.question.options?.length || 0) <= 6;

    if (useCardStyle) {
      return html`
        <label class="choice-card ${classMap({ selected: isSelected, disabled: isDisabled })}"
               for="${inputId}">
          <input
            type="${this.isMultipleChoice ? 'checkbox' : 'radio'}"
            class="choice-input-card"
            id="${inputId}"
            name="choice-${this.config.question.id}"
            .value=${option.value}
            @change=${() => this.handleChange(option.value)}
            @blur=${this.handleBlur}
            ?checked=${isSelected}
            ?disabled=${isDisabled}
          />
          <div class="choice-content">
            <span class="choice-label">
              ${option.label[this.config.language]}
            </span>
          </div>
          <div class="selection-indicator">
            ✓
          </div>
        </label>
      `;
    }

    return html`
      <label class="choice-option ${classMap({ selected: isSelected, disabled: isDisabled })}"
             for="${inputId}">
        <input
          type="${this.isMultipleChoice ? 'checkbox' : 'radio'}"
          class="choice-input"
          id="${inputId}"
          name="choice-${this.config.question.id}"
          .value=${option.value}
          @change=${() => this.handleChange(option.value)}
          @blur=${this.handleBlur}
          ?checked=${isSelected}
          ?disabled=${isDisabled}
        />
        <div class="choice-content">
          <span class="choice-label">
            ${option.label[this.config.language]}
          </span>
        </div>
      </label>
    `;
  }

  private renderCustomOption(): TemplateResult | null {
    if (!this.showCustomOption) {
      return null;
    }

    return html`
      <div class="custom-option">
        <label class="choice-option" for="custom-${this.config.question.id}">
          <input
            type="${this.isMultipleChoice ? 'checkbox' : 'radio'}"
            class="choice-input"
            id="custom-${this.config.question.id}"
            name="choice-${this.config.question.id}"
            value="custom"
            @change=${() => this.handleChange('custom')}
            ?checked=${this.isMultipleChoice ?
              Array.isArray(this.internalValue) && this.internalValue.some(val => val.startsWith('custom:')) :
              this.internalValue === this.customValue}
            ?disabled=${this.config.readonly}
          />
          <div class="choice-content">
            <span class="choice-label">
              ${this.config.language === 'pl' ? 'Inna opcja (specyfikuj):' : 'Other (please specify):'}
            </span>
          </div>
        </label>
        <input
          type="text"
          class="custom-input"
          placeholder="${this.config.language === 'pl' ? 'Wpisz swoją odpowiedź...' : 'Type your answer...'}"
          .value=${this.customValue}
          @input=${this.handleCustomInputChange}
          ?disabled=${this.config.readonly}
        />
      </div>
    `;
  }

  private renderNoResults(): TemplateResult {
    return html`
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <div>${this.config.language === 'pl' ? 'Brak wyników' : 'No results found'}</div>
        <div style="font-size: 0.875rem; margin-top: 0.25rem;">
          ${this.config.language === 'pl' ? 'Spróbuj zmienić kryteria wyszukiwania' : 'Try changing your search criteria'}
        </div>
      </div>
    `;
  }

  render() {
    const options = this.getFilteredOptions();
    const hasOptions = options.length > 0;
    const useCardStyle = (this.config.question.options?.length || 0) <= 6;
    const layout = this.config.layout || 'vertical';

    return html`
      <div class="choice-container">
        ${this.getSelectionCounter()}

        ${this.config.question.options && this.config.question.options.length > 7 ? html`
          <div class="choice-filter">
            <span class="filter-icon">🔍</span>
            <input
              type="text"
              class="filter-input"
              placeholder="${this.config.language === 'pl' ? 'Szukaj opcji...' : 'Search options...'}"
              .value=${this.filterText}
              @input=${(e: Event) => {
                this.filterText = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        ` : ''}

        ${hasOptions ? html`
          <div class="choice-group ${layout}" role="${this.isMultipleChoice ? 'group' : 'radiogroup'}">
            ${options.map(option => this.renderChoiceOption(option))}
          </div>
        ` : this.renderNoResults()}

        ${this.renderCustomOption()}

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

export default QuestionChoiceInput;