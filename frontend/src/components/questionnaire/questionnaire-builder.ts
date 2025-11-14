/**
 * Questionnaire Builder Web Component
 * Core interface for creating and managing questionnaires with drag-and-drop functionality
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { i18nService } from '../../services/i18n';

// Types and interfaces
export interface BilingualText {
  pl: string;
  en: string;
}

export interface QuestionValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
}

export interface QuestionOption {
  id: string;
  value: string;
  label: BilingualText;
}

export interface ConditionalLogic {
  showIf: {
    questionId: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
}

export interface Question {
  id: string;
  text: BilingualText;
  type: 'text' | 'textarea' | 'number' | 'scale' | 'single_choice' | 'multiple_choice';
  options?: QuestionOption[];
  validation?: QuestionValidation;
  conditionalLogic?: ConditionalLogic;
  orderIndex: number;
  helpText?: BilingualText;
}

export interface QuestionGroup {
  id: string;
  title: BilingualText;
  description?: BilingualText;
  orderIndex: number;
  uiConfig: {
    collapsed: boolean;
    showProgress: boolean;
    icon: string | null;
  };
  questions: Question[];
}

export interface Questionnaire {
  id: string;
  title: BilingualText;
  description?: BilingualText;
  instructions?: BilingualText;
  settings: {
    anonymous: boolean;
    requireConsent: boolean;
    maxResponses?: number;
    closeAfterWorkshop: boolean;
    showAllQuestions: boolean;
    allowEdit: boolean;
    questionStyle: 'first_person_plural' | 'third_person';
  };
  status: 'draft' | 'review' | 'published' | 'closed' | 'analyzed';
  groups: QuestionGroup[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionnaireBuilderConfig {
  questionnaire?: Questionnaire;
  language: 'pl' | 'en';
  readonly?: boolean;
  autoSave?: boolean;
  onSave?: (questionnaire: Questionnaire) => Promise<void>;
  onPreview?: (questionnaire: Questionnaire) => void;
}

/**
 * Main Questionnaire Builder Component
 */
@customElement('questionnaire-builder')
export class QuestionnaireBuilder extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #374151;
    }

    .builder-container {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .main-panel {
      min-width: 0;
    }

    .side-panel {
      background: #f9fafb;
      border-radius: 12px;
      padding: 1.5rem;
      height: fit-content;
      position: sticky;
      top: 2rem;
    }

    .builder-header {
      margin-bottom: 2rem;
    }

    .builder-title {
      font-size: 1.875rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
      color: #111827;
    }

    .builder-description {
      color: #6b7280;
      margin: 0;
      font-size: 1rem;
    }

    .language-toggle {
      display: flex;
      background: #f3f4f6;
      border-radius: 8px;
      padding: 0.25rem;
      margin-bottom: 1.5rem;
    }

    .language-button {
      flex: 1;
      padding: 0.5rem 1rem;
      border: none;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .language-button.active {
      background: white;
      color: #3b82f6;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .form-section {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid #e5e7eb;
    }

    .form-section-title {
      font-size: 1.25rem;
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

    .input, .textarea {
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }

    .input:focus, .textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .textarea {
      resize: vertical;
      min-height: 100px;
    }

    .groups-container {
      margin: 1.5rem 0;
    }

    .group-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .group-card.drag-over {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      cursor: pointer;
    }

    .group-title-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
    }

    .group-icon {
      width: 2rem;
      height: 2rem;
      background: #e5e7eb;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: #6b7280;
    }

    .group-title {
      font-weight: 600;
      margin: 0;
      color: #374151;
    }

    .group-actions {
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

    .group-content {
      padding: 1.5rem;
    }

    .group.collapsed .group-content {
      display: none;
    }

    .questions-list {
      margin: 1rem 0;
    }

    .question-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
      cursor: move;
      transition: all 0.2s ease;
    }

    .question-item:hover {
      border-color: #d1d5db;
    }

    .question-item.dragging {
      opacity: 0.5;
    }

    .question-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .question-content {
      flex: 1;
      min-width: 0;
    }

    .question-text {
      font-weight: 500;
      margin: 0 0 0.25rem 0;
      color: #374151;
      word-break: break-word;
    }

    .question-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .question-type {
      background: #e5e7eb;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .question-required {
      color: #dc2626;
      font-weight: 500;
    }

    .question-actions {
      display: flex;
      gap: 0.25rem;
    }

    .add-question-button {
      width: 100%;
      padding: 0.75rem;
      border: 2px dashed #d1d5db;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      color: #6b7280;
      font-weight: 500;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .add-question-button:hover {
      border-color: #3b82f6;
      color: #3b82f6;
      background: #f0f9ff;
    }

    .add-group-button {
      width: 100%;
      padding: 1rem;
      border: 2px dashed #d1d5db;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      color: #6b7280;
      font-weight: 500;
      transition: all 0.2s ease;
      margin-top: 1rem;
    }

    .add-group-button:hover {
      border-color: #3b82f6;
      color: #3b82f6;
      background: #f0f9ff;
    }

    .settings-panel {
      margin-top: 1.5rem;
    }

    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .setting-item:last-child {
      border-bottom: none;
    }

    .setting-label {
      font-weight: 500;
      color: #374151;
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

    .action-buttons {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
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

    .auto-save-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 1rem;
    }

    .auto-save-indicator.saving {
      color: #f59e0b;
    }

    .auto-save-indicator.saved {
      color: #10b981;
    }

    .auto-save-indicator.error {
      color: #dc2626;
    }

    .dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: #6b7280;
    }

    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .empty-state-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #374151;
    }

    .empty-state-text {
      margin-bottom: 1.5rem;
    }

    /* Mobile responsive */
    @media (max-width: 1024px) {
      .builder-container {
        grid-template-columns: 1fr;
        gap: 1rem;
        padding: 1rem;
      }

      .side-panel {
        position: static;
        order: -1;
      }
    }

    @media (max-width: 640px) {
      .builder-container {
        padding: 0.5rem;
      }

      .form-section {
        padding: 1rem;
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
      .form-section, .group-card, .question-item {
        border-width: 2px;
      }

      .input, .textarea {
        border-width: 2px;
      }
    }

    /* Drag and drop visual feedback */
    .drag-preview {
      background: #3b82f6;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 500;
      position: fixed;
      pointer-events: none;
      z-index: 1000;
      opacity: 0.9;
    }

    .drop-zone {
      min-height: 4rem;
      border: 2px dashed transparent;
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .drop-zone.active {
      border-color: #3b82f6;
      background: #f0f9ff;
    }
  `;

  @property({ type: Object })
  config: QuestionnaireBuilderConfig = {
    language: 'en',
    readonly: false,
    autoSave: true
  };

  @state()
  private questionnaire: Questionnaire = this.createEmptyQuestionnaire();

  @state()
  private currentLanguage: 'pl' | 'en' = 'en';

  @state()
  private autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';

  @state()
  private draggedItem: { type: 'group' | 'question'; id: string; index: number } | null = null;

  private autoSaveTimer: number | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.currentLanguage = this.config.language || 'en';

    if (this.config.questionnaire) {
      this.questionnaire = { ...this.config.questionnaire };
    }

    // Setup auto-save if enabled
    if (this.config.autoSave && !this.config.readonly) {
      this.setupAutoSave();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
  }

  private createEmptyQuestionnaire(): Questionnaire {
    return {
      id: `questionnaire_${Date.now()}`,
      title: { pl: '', en: '' },
      description: { pl: '', en: '' },
      instructions: { pl: '', en: '' },
      settings: {
        anonymous: false,
        requireConsent: true,
        closeAfterWorkshop: true,
        showAllQuestions: true,
        allowEdit: true,
        questionStyle: 'first_person_plural'
      },
      status: 'draft',
      groups: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private setupAutoSave() {
    this.addEventListener('questionnaire-changed', () => {
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
      }

      this.autoSaveStatus = 'idle';

      this.autoSaveTimer = window.setTimeout(() => {
        this.autoSave();
      }, 2000); // Auto-save after 2 seconds of inactivity
    });
  }

  private async autoSave() {
    if (!this.config.onSave || this.config.readonly) return;

    try {
      this.autoSaveStatus = 'saving';
      await this.config.onSave(this.questionnaire);
      this.autoSaveStatus = 'saved';

      // Clear saved status after 2 seconds
      setTimeout(() => {
        if (this.autoSaveStatus === 'saved') {
          this.autoSaveStatus = 'idle';
        }
      }, 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      this.autoSaveStatus = 'error';

      // Clear error status after 3 seconds
      setTimeout(() => {
        if (this.autoSaveStatus === 'error') {
          this.autoSaveStatus = 'idle';
        }
      }, 3000);
    }
  }

  private notifyChange() {
    this.questionnaire.updatedAt = new Date();
    this.dispatchEvent(new CustomEvent('questionnaire-changed', {
      detail: { questionnaire: this.questionnaire }
    }));
    this.requestUpdate();
  }

  private handleLanguageToggle(language: 'pl' | 'en') {
    this.currentLanguage = language;
    this.requestUpdate();
  }

  private handleTitleChange(language: 'pl' | 'en', value: string) {
    this.questionnaire.title[language] = value;
    this.notifyChange();
  }

  private handleDescriptionChange(language: 'pl' | 'en', value: string) {
    this.questionnaire.description[language] = value;
    this.notifyChange();
  }

  private handleInstructionsChange(language: 'pl' | 'en', value: string) {
    this.questionnaire.instructions[language] = value;
    this.notifyChange();
  }

  private handleSettingChange(setting: string, value: any) {
    (this.questionnaire.settings as any)[setting] = value;
    this.notifyChange();
  }

  private addGroup() {
    const newGroup: QuestionGroup = {
      id: `group_${Date.now()}`,
      title: {
        pl: `Nowa sekcja ${this.questionnaire.groups.length + 1}`,
        en: `New Section ${this.questionnaire.groups.length + 1}`
      },
      description: {
        pl: '',
        en: ''
      },
      orderIndex: this.questionnaire.groups.length,
      uiConfig: {
        collapsed: false,
        showProgress: true,
        icon: null
      },
      questions: []
    };

    this.questionnaire.groups.push(newGroup);
    this.notifyChange();
  }

  private addQuestion(groupId: string) {
    const group = this.questionnaire.groups.find(g => g.id === groupId);
    if (!group) return;

    const newQuestion: Question = {
      id: `question_${Date.now()}`,
      text: {
        pl: 'Nowe pytanie',
        en: 'New Question'
      },
      type: 'text',
      validation: {
        required: false
      },
      orderIndex: group.questions.length,
      helpText: {
        pl: '',
        en: ''
      }
    };

    group.questions.push(newQuestion);
    this.notifyChange();
  }

  private deleteGroup(groupId: string) {
    this.questionnaire.groups = this.questionnaire.groups.filter(g => g.id !== groupId);
    // Update order indices
    this.questionnaire.groups.forEach((group, index) => {
      group.orderIndex = index;
    });
    this.notifyChange();
  }

  private deleteQuestion(groupId: string, questionId: string) {
    const group = this.questionnaire.groups.find(g => g.id === groupId);
    if (!group) return;

    group.questions = group.questions.filter(q => q.id !== questionId);
    // Update order indices
    group.questions.forEach((question, index) => {
      question.orderIndex = index;
    });
    this.notifyChange();
  }

  private toggleGroupCollapse(groupId: string) {
    const group = this.questionnaire.groups.find(g => g.id === groupId);
    if (!group) return;

    group.uiConfig.collapsed = !group.uiConfig.collapsed;
    this.notifyChange();
  }

  private moveGroup(fromIndex: number, toIndex: number) {
    const groups = [...this.questionnaire.groups];
    const [movedGroup] = groups.splice(fromIndex, 1);
    groups.splice(toIndex, 0, movedGroup);

    // Update order indices
    groups.forEach((group, index) => {
      group.orderIndex = index;
    });

    this.questionnaire.groups = groups;
    this.notifyChange();
  }

  private handlePreview() {
    if (this.config.onPreview) {
      this.config.onPreview(this.questionnaire);
    }
  }

  private async handleSave() {
    if (this.config.onSave) {
      try {
        await this.config.onSave(this.questionnaire);
        this.autoSaveStatus = 'saved';
      } catch (error) {
        console.error('Save failed:', error);
        this.autoSaveStatus = 'error';
      }
    }
  }

  private renderAutoSaveIndicator() {
    if (!this.config.autoSave || this.config.readonly) return '';

    const statusConfig = {
      idle: { icon: '💾', text: 'Auto-save enabled' },
      saving: { icon: '⏳', text: 'Saving...', class: 'saving' },
      saved: { icon: '✅', text: 'Saved', class: 'saved' },
      error: { icon: '❌', text: 'Save failed', class: 'error' }
    };

    const config = statusConfig[this.autoSaveStatus];

    return html`
      <div class="auto-save-indicator ${config.class || ''}">
        <span class="dot"></span>
        <span>${config.icon} ${config.text}</span>
      </div>
    `;
  }

  private renderLanguageToggle() {
    return html`
      <div class="language-toggle">
        <button
          class=${classMap({ 'language-button': true, 'active': this.currentLanguage === 'pl' })}
          @click=${() => this.handleLanguageToggle('pl')}
        >
          Polski
        </button>
        <button
          class=${classMap({ 'language-button': true, 'active': this.currentLanguage === 'en' })}
          @click=${() => this.handleLanguageToggle('en')}
        >
          English
        </button>
      </div>
    `;
  }

  private renderBilingualInput(
    label: string,
    plValue: string,
    enValue: string,
    plChange: (value: string) => void,
    enChange: (value: string) => void,
    placeholder: { pl: string; en: string } = { pl: '', en: '' },
    type: 'input' | 'textarea' = 'input'
  ) {
    const inputTag = type === 'textarea' ? 'textarea' : 'input';

    return html`
      <div class="bilingual-inputs">
        <div class="language-input">
          <label class="language-label">Polski</label>
          <${inputTag}
            class="${type}"
            .value=${plValue}
            placeholder=${placeholder.pl}
            @input=${(e: Event) => plChange((e.target as HTMLInputElement).value)}
            ?disabled=${this.config.readonly}
          />
        </div>
        <div class="language-input">
          <label class="language-label">English</label>
          <${inputTag}
            class="${type}"
            .value=${enValue}
            placeholder=${placeholder.en}
            @input=${(e: Event) => enChange((e.target as HTMLInputElement).value)}
            ?disabled=${this.config.readonly}
          />
        </div>
      </div>
    `;
  }

  private renderGroup(group: QuestionGroup) {
    return html`
      <div class="group-card ${classMap({ collapsed: group.uiConfig.collapsed })}"
           data-group-id="${group.id}">
        <div class="group-header" @click=${() => this.toggleGroupCollapse(group.id)}>
          <div class="group-title-section">
            <div class="group-icon">
              ${group.uiConfig.icon || String.fromCharCode(65 + group.orderIndex)}
            </div>
            <h3 class="group-title">
              ${group.title[this.currentLanguage] || group.title.en}
            </h3>
          </div>
          <div class="group-actions">
            ${!this.config.readonly ? html`
              <button class="icon-button danger" @click=${(e: Event) => {
                e.stopPropagation();
                this.deleteGroup(group.id);
              }} title="Delete group">
                🗑️
              </button>
            ` : ''}
            <button class="icon-button" @click=${(e: Event) => {
              e.stopPropagation();
              this.toggleGroupCollapse(group.id);
            }} title="Toggle collapse">
              ${group.uiConfig.collapsed ? '📂' : '📁'}
            </button>
          </div>
        </div>

        <div class="group-content">
          ${group.questions.length > 0 ? html`
            <div class="questions-list">
              ${repeat(group.questions, (question) => question.id, (question) =>
                this.renderQuestion(group, question)
              )}
            </div>
          ` : html`
            <div class="empty-state">
              <div class="empty-state-text">
                No questions in this section yet.
              </div>
            </div>
          `}

          ${!this.config.readonly ? html`
            <button class="add-question-button" @click=${() => this.addQuestion(group.id)}>
              <span>➕</span>
              <span>Add Question</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderQuestion(group: QuestionGroup, question: Question) {
    const typeLabels = {
      text: this.currentLanguage === 'pl' ? 'Krótka odpowiedź' : 'Short Answer',
      textarea: this.currentLanguage === 'pl' ? 'Długa odpowiedź' : 'Long Answer',
      number: this.currentLanguage === 'pl' ? 'Liczba' : 'Number',
      scale: this.currentLanguage === 'pl' ? 'Skala' : 'Scale',
      single_choice: this.currentLanguage === 'pl' ? 'Wybór pojedynczy' : 'Single Choice',
      multiple_choice: this.currentLanguage === 'pl' ? 'Wybór wielokrotny' : 'Multiple Choice'
    };

    return html`
      <div class="question-item" data-question-id="${question.id}">
        <div class="question-header">
          <div class="question-content">
            <div class="question-text">
              ${question.text[this.currentLanguage] || question.text.en}
            </div>
            <div class="question-meta">
              <span class="question-type">${typeLabels[question.type]}</span>
              ${question.validation?.required ?
                html`<span class="question-required">Required</span>` : ''}
            </div>
          </div>
          <div class="question-actions">
            ${!this.config.readonly ? html`
              <button class="icon-button" title="Edit question">
                ✏️
              </button>
              <button class="icon-button danger" @click=${() =>
                this.deleteQuestion(group.id, question.id)} title="Delete question">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  private renderSettings() {
    const settingLabels = {
      anonymous: {
        pl: 'Anonimowe odpowiedzi',
        en: 'Anonymous responses'
      },
      requireConsent: {
        pl: 'Wymagaj zgody RODO',
        en: 'Require GDPR consent'
      },
      closeAfterWorkshop: {
        pl: 'Zamknij po warsztatach',
        en: 'Close after workshop'
      },
      showAllQuestions: {
        pl: 'Pokaż wszystkie pytania',
        en: 'Show all questions'
      },
      allowEdit: {
        pl: 'Pozwól edytować odpowiedzi',
        en: 'Allow editing answers'
      }
    };

    return html`
      <div class="settings-panel">
        <h3 class="form-section-title">Settings</h3>
        ${Object.entries(settingLabels).map(([key, labels]) => html`
          <div class="setting-item">
            <span class="setting-label">${labels[this.currentLanguage]}</span>
            <label class="toggle-switch">
              <input
                type="checkbox"
                ?checked=${(this.questionnaire.settings as any)[key]}
                @change=${(e: Event) =>
                  this.handleSettingChange(key, (e.target as HTMLInputElement).checked)}
                ?disabled=${this.config.readonly}
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        `)}
      </div>
    `;
  }

  render() {
    return html`
      <div class="builder-container">
        <div class="main-panel">
          <div class="builder-header">
            <h1 class="builder-title">Questionnaire Builder</h1>
            <p class="builder-description">
              Create and manage questionnaires with drag-and-drop functionality
            </p>
          </div>

          ${this.renderLanguageToggle()}

          <div class="form-section">
            <h2 class="form-section-title">Basic Information</h2>
            ${this.renderBilingualInput(
              'Title',
              this.questionnaire.title.pl,
              this.questionnaire.title.en,
              (value) => this.handleTitleChange('pl', value),
              (value) => this.handleTitleChange('en', value),
              { pl: 'Wprowadź tytuł kwestionariusza', en: 'Enter questionnaire title' }
            )}

            ${this.renderBilingualInput(
              'Description',
              this.questionnaire.description?.pl || '',
              this.questionnaire.description?.en || '',
              (value) => this.handleDescriptionChange('pl', value),
              (value) => this.handleDescriptionChange('en', value),
              { pl: 'Wprowadź opis kwestionariusza', en: 'Enter questionnaire description' },
              'textarea'
            )}

            ${this.renderBilingualInput(
              'Instructions',
              this.questionnaire.instructions?.pl || '',
              this.questionnaire.instructions?.en || '',
              (value) => this.handleInstructionsChange('pl', value),
              (value) => this.handleInstructionsChange('en', value),
              { pl: 'Wprowadź instrukcje dla uczestników', en: 'Enter instructions for participants' },
              'textarea'
            )}
          </div>

          <div class="form-section">
            <h2 class="form-section-title">Question Sections</h2>
            <div class="groups-container">
              ${this.questionnaire.groups.length > 0 ?
                repeat(this.questionnaire.groups, (group) => group.id, (group) =>
                  this.renderGroup(group)
                ) : html`
                  <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-title">No sections yet</div>
                    <div class="empty-state-text">
                      Start by adding a section to organize your questions
                    </div>
                  </div>
                `
              }

              ${!this.config.readonly ? html`
                <button class="add-group-button" @click=${this.addGroup}>
                  <span>➕</span>
                  <span>Add Section</span>
                </button>
              ` : ''}
            </div>
          </div>

          ${!this.config.readonly ? html`
            <div class="action-buttons">
              <button class="button button-primary" @click=${this.handleSave}>
                <span>💾</span>
                <span>Save Questionnaire</span>
              </button>
              <button class="button button-secondary" @click=${this.handlePreview}>
                <span>👁️</span>
                <span>Preview</span>
              </button>
            </div>
          ` : ''}
        </div>

        <div class="side-panel">
          ${this.renderSettings()}
          ${this.renderAutoSaveIndicator()}
        </div>
      </div>
    `;
  }
}

export default QuestionnaireBuilder;