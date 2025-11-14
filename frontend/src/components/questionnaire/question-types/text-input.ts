/**
 * Text Input Question Type Component
 * Handles short text and long text (textarea) question types
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { Question, BilingualText } from '../questionnaire-builder.js';

export interface TextInputConfig {
  question: Question;
  value?: string;
  language: 'pl' | 'en';
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  readonly?: boolean;
  showCharCount?: boolean;
}

/**
 * Text Input Component
 */
@customElement('question-text-input')
export class QuestionTextInput extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .text-input-container {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .input-wrapper {
      position: relative;
    }

    .text-input, .textarea-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 1rem;
      font-family: inherit;
      line-height: 1.5;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
      resize: vertical;
    }

    .text-input:focus, .textarea-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .text-input.error, .textarea-input.error {
      border-color: #dc2626;
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
    }

    .text-input:disabled, .textarea-input:disabled {
      background: #f9fafb;
      color: #6b7280;
      cursor: not-allowed;
    }

    .textarea-input {
      min-height: 120px;
    }

    .character-counter {
      font-size: 0.75rem;
      color: #6b7280;
      text-align: right;
      margin-top: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
    }

    .character-counter.warning {
      color: #f59e0b;
    }

    .character-counter.error {
      color: #dc2626;
    }

    .character-count {
      font-weight: 500;
    }

    .validation-message {
      font-size: 0.875rem;
      color: #dc2626;
      margin-top: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .input-icon {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: #6b7280;
      pointer-events: none;
    }

    .input-wrapper.has-icon .text-input {
      padding-right: 2.5rem;
    }

    .input-suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #d1d5db;
      border-top: none;
      border-radius: 0 0 6px 6px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 100;
      max-height: 200px;
      overflow-y: auto;
    }

    .suggestion-item {
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .suggestion-item:hover {
      background: #f3f4f6;
    }

    .suggestion-item.selected {
      background: #3b82f6;
      color: white;
    }

    .formatting-toolbar {
      display: flex;
      gap: 0.25rem;
      padding: 0.5rem;
      background: #f9fafb;
      border: 1px solid #d1d5db;
      border-bottom: none;
      border-radius: 6px 6px 0 0;
    }

    .toolbar-button {
      padding: 0.25rem 0.5rem;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.15s ease;
    }

    .toolbar-button:hover {
      background: #f3f4f6;
    }

    .toolbar-button.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      * {
        transition-duration: 0.01ms !important;
      }
    }

    @media (prefers-contrast: high) {
      .text-input, .textarea-input {
        border-width: 2px;
      }
    }
  `;

  @property({ type: Object })
  config: TextInputConfig;

  @state()
  private internalValue = '';

  @state()
  private isValid = true;

  @state()
  private validationMessage = '';

  @state()
  private showSuggestions = false;

  @state()
  private selectedSuggestionIndex = -1;

  @state()
  private isComposing = false; // For IME input support

  connectedCallback() {
    super.connectedCallback();
    this.internalValue = this.config.value || '';
    this.validate();
  }

  private get maxLength(): number {
    return this.config.question.validation?.maxLength || 0;
  }

  private get minLength(): number {
    return this.config.question.validation?.minLength || 0;
  }

  private get isRequired(): boolean {
    return this.config.question.validation?.required || false;
  }

  private get placeholder(): string {
    const placeholders = {
      pl: {
        text: 'Wpisz swoją odpowiedź tutaj...',
        textarea: 'Wpisz swoją odpowiedź tutaj...'
      },
      en: {
        text: 'Type your answer here...',
        textarea: 'Type your answer here...'
      }
    };
    return placeholders[this.config.language][this.config.question.type] || '';
  }

  private handleInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.internalValue = target.value;

    // Validate immediately for real-time feedback
    this.validate();

    // Call onChange callback
    if (this.config.onChange) {
      this.config.onChange(this.internalValue);
    }
  }

  private handleChange(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.internalValue = target.value;

    // Final validation on change
    this.validate();

    // Call onChange callback
    if (this.config.onChange) {
      this.config.onChange(this.internalValue);
    }
  }

  private handleBlur(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.internalValue = target.value;

    // Final validation on blur
    this.validate();

    // Hide suggestions if shown
    this.showSuggestions = false;

    // Call onBlur callback
    if (this.config.onBlur) {
      this.config.onBlur(this.internalValue);
    }
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (!this.showSuggestions) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedSuggestionIndex = Math.min(
          this.selectedSuggestionIndex + 1,
          this.getSuggestions().length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedSuggestionIndex >= 0) {
          this.selectSuggestion(this.getSuggestions()[this.selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        this.showSuggestions = false;
        this.selectedSuggestionIndex = -1;
        break;
    }
  }

  private handleCompositionStart() {
    this.isComposing = true;
  }

  private handleCompositionEnd(event: CompositionEvent) {
    this.isComposing = false;
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.internalValue = target.data || target.value;
    this.validate();
  }

  private validate(): boolean {
    const value = this.internalValue.trim();
    const errors: string[] = [];

    // Required validation
    if (this.isRequired && value.length === 0) {
      errors.push(this.config.language === 'pl' ? 'To pole jest wymagane' : 'This field is required');
    }

    // Length validation (only if there's content)
    if (value.length > 0) {
      if (this.minLength > 0 && value.length < this.minLength) {
        errors.push(
          this.config.language === 'pl' ?
            `Minimalna długość: ${this.minLength} znaków` :
            `Minimum length: ${this.minLength} characters`
        );
      }

      if (this.maxLength > 0 && value.length > this.maxLength) {
        errors.push(
          this.config.language === 'pl' ?
            `Maksymalna długość: ${this.maxLength} znaków` :
            `Maximum length: ${this.maxLength} characters`
        );
      }
    }

    // Pattern validation (if specified)
    const pattern = this.config.question.validation?.pattern;
    if (pattern && value.length > 0) {
      try {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
          errors.push(
            this.config.language === 'pl' ? 'Nieprawidłowy format' : 'Invalid format'
          );
        }
      } catch (error) {
        console.warn('Invalid regex pattern:', pattern);
      }
    }

    this.isValid = errors.length === 0;
    this.validationMessage = errors[0] || '';

    return this.isValid;
  }

  private getSuggestions(): string[] {
    // This would be implemented with actual suggestion logic
    // For now, return empty array
    return [];
  }

  private selectSuggestion(suggestion: string) {
    this.internalValue = suggestion;
    this.showSuggestions = false;
    this.selectedSuggestionIndex = -1;
    this.validate();

    if (this.config.onChange) {
      this.config.onChange(this.internalValue);
    }
  }

  private getCharacterCountClass(): string {
    if (!this.maxLength) return '';

    const percentage = (this.internalValue.length / this.maxLength) * 100;
    if (percentage >= 100) return 'error';
    if (percentage >= 90) return 'warning';
    return '';
  }

  private getCharacterCountText(): string {
    if (!this.maxLength) return '';

    return `${this.internalValue.length}/${this.maxLength}`;
  }

  private insertText(text: string) {
    const textarea = this.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    const newValue = value.substring(0, start) + text + value.substring(end);
    this.internalValue = newValue;

    // Restore cursor position
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    });

    this.validate();

    if (this.config.onChange) {
      this.config.onChange(this.internalValue);
    }
  }

  private renderFormattingToolbar(): TemplateResult | null {
    if (this.config.question.type !== 'textarea' || this.config.readonly) {
      return null;
    }

    return html`
      <div class="formatting-toolbar">
        <button
          type="button"
          class="toolbar-button"
          @click=${() => this.insertText('**bold text**')}
          title="${this.config.language === 'pl' ? 'Pogrubienie' : 'Bold'}"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          class="toolbar-button"
          @click=${() => this.insertText('*italic text*')}
          title="${this.config.language === 'pl' ? 'Kursywa' : 'Italic'}"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          class="toolbar-button"
          @click=${() => this.insertText('\n• ' + (this.config.language === 'pl' ? 'punkt listy' : 'list item'))}
          title="${this.config.language === 'pl' ? 'Lista punktowana' : 'Bullet List'}"
        >
          •
        </button>
        <button
          type="button"
          class="toolbar-button"
          @click=${() => this.insertText('\n1. ' + (this.config.language === 'pl' ? 'punkt listy' : 'list item'))}
          title="${this.config.language === 'pl' ? 'Lista numerowana' : 'Numbered List'}"
        >
          1.
        </button>
      </div>
    `;
  }

  render() {
    const showCharCount = this.config.showCharCount !== false && this.maxLength > 0;
    const inputId = `input-${this.config.question.id}`;

    return html`
      <div class="text-input-container">
        ${this.renderFormattingToolbar()}

        <div class="input-wrapper ${classMap({ 'has-icon': false })}">
          ${this.config.question.type === 'textarea' ? html`
            <textarea
              id="${inputId}"
              class="textarea-input ${classMap({ error: !this.isValid })}"
              .value=${this.internalValue}
              placeholder=${this.placeholder}
              maxlength=${this.maxLength > 0 ? this.maxLength : null}
              ?disabled=${this.config.readonly}
              ?required=${this.isRequired}
              @input=${this.handleInput}
              @change=${this.handleChange}
              @blur=${this.handleBlur}
              @keydown=${this.handleKeyDown}
              @compositionstart=${this.handleCompositionStart}
              @compositionend=${this.handleCompositionEnd}
            ></textarea>
          ` : html`
            <input
              type="text"
              id="${inputId}"
              class="text-input ${classMap({ error: !this.isValid })}"
              .value=${this.internalValue}
              placeholder=${this.placeholder}
              maxlength=${this.maxLength > 0 ? this.maxLength : null}
              ?disabled=${this.config.readonly}
              ?required=${this.isRequired}
              @input=${this.handleInput}
              @change=${this.handleChange}
              @blur=${this.handleBlur}
              @keydown=${this.handleKeyDown}
              @compositionstart=${this.handleCompositionStart}
              @compositionend=${this.handleCompositionEnd}
            />
          `}

          ${this.showSuggestions && this.getSuggestions().length > 0 ? html`
            <div class="input-suggestions">
              ${this.getSuggestions().map((suggestion, index) => html`
                <div
                  class="suggestion-item ${classMap({ selected: index === this.selectedSuggestionIndex })}"
                  @click=${() => this.selectSuggestion(suggestion)}
                >
                  ${suggestion}
                </div>
              `)}
            </div>
          ` : ''}
        </div>

        ${showCharCount ? html`
          <div class="character-counter ${this.getCharacterCountClass()}">
            <span class="character-count">${this.getCharacterCountText()}</span>
          </div>
        ` : ''}

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

export default QuestionTextInput;