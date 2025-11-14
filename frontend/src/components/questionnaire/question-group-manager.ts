/**
 * Question Group Manager Web Component
 * Manages questionnaire sections/groups with drag-and-drop functionality
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';

// Import types from the main builder
import type { QuestionGroup, Question, BilingualText } from './questionnaire-builder.js';

export interface QuestionGroupManagerConfig {
  groups: QuestionGroup[];
  language: 'pl' | 'en';
  onGroupsChange?: (groups: QuestionGroup[]) => void;
  onGroupEdit?: (group: QuestionGroup) => void;
  onQuestionEdit?: (groupId: string, question: Question) => void;
  onQuestionDelete?: (groupId: string, questionId: string) => void;
  readonly?: boolean;
}

/**
 * Question Group Manager Component
 */
@customElement('question-group-manager')
export class QuestionGroupManager extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #374151;
    }

    .groups-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .group-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.2s ease;
      position: relative;
    }

    .group-card.drag-over {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .group-card.dragging {
      opacity: 0.5;
      transform: rotate(2deg);
    }

    .group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.2s ease;
    }

    .group-header:hover {
      background: #f3f4f6;
    }

    .group-header.drag-handle {
      cursor: grab;
    }

    .group-header.drag-handle:active {
      cursor: grabbing;
    }

    .group-title-section {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
      min-width: 0;
    }

    .drag-handle {
      display: flex;
      flex-direction: column;
      gap: 2px;
      cursor: grab;
      padding: 0.5rem;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .drag-handle-dot {
      width: 4px;
      height: 4px;
      background: #9ca3af;
      border-radius: 50%;
    }

    .group-icon {
      width: 2.5rem;
      height: 2.5rem;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: white;
      font-size: 1.125rem;
    }

    .group-title-content {
      flex: 1;
      min-width: 0;
    }

    .group-title {
      font-weight: 600;
      font-size: 1.125rem;
      margin: 0 0 0.25rem 0;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .group-description {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .group-stats {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .group-actions {
      display: flex;
      gap: 0.25rem;
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
      transition: max-height 0.3s ease, opacity 0.3s ease;
      max-height: 2000px;
      opacity: 1;
    }

    .group.collapsed .group-content {
      max-height: 0;
      opacity: 0;
      overflow: hidden;
    }

    .questions-list {
      padding: 1rem 1.5rem;
    }

    .question-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
      cursor: move;
      transition: all 0.2s ease;
      position: relative;
    }

    .question-item:hover {
      border-color: #d1d5db;
      background: #f3f4f6;
    }

    .question-item.dragging {
      opacity: 0.5;
      transform: rotate(1deg);
    }

    .question-item.drag-over {
      border-color: #3b82f6;
      background: #eff6ff;
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
      line-height: 1.4;
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
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .question-required {
      color: #dc2626;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .question-actions {
      display: flex;
      gap: 0.25rem;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .question-item:hover .question-actions {
      opacity: 1;
    }

    .empty-questions {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }

    .empty-questions-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      opacity: 0.5;
    }

    .add-question-button {
      width: 100%;
      padding: 0.75rem;
      margin: 1rem 1.5rem;
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
      padding: 1.5rem;
      border: 2px dashed #d1d5db;
      background: transparent;
      border-radius: 12px;
      cursor: pointer;
      color: #6b7280;
      font-weight: 500;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      font-size: 1rem;
    }

    .add-group-button:hover {
      border-color: #3b82f6;
      color: #3b82f6;
      background: #f0f9ff;
    }

    .add-group-icon {
      font-size: 1.5rem;
    }

    .progress-bar {
      height: 4px;
      background: #e5e7eb;
      border-radius: 2px;
      margin: 0.5rem 0;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #059669);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    /* Drag preview */
    .drag-preview {
      position: fixed;
      pointer-events: none;
      z-index: 1000;
      opacity: 0.9;
      transform: rotate(2deg);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      background: white;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 0.75rem;
      max-width: 200px;
      font-size: 0.875rem;
    }

    /* Drop zone */
    .drop-zone {
      min-height: 4rem;
      border: 2px dashed transparent;
      border-radius: 8px;
      transition: all 0.2s ease;
      margin: 0.5rem 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .drop-zone.active {
      border-color: #3b82f6;
      background: #eff6ff;
      color: #3b82f6;
    }

    /* Group settings panel */
    .group-settings {
      padding: 1rem 1.5rem;
      background: #fafafa;
      border-top: 1px solid #e5e7eb;
      display: none;
    }

    .group.settings-open .group-settings {
      display: block;
    }

    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0;
    }

    .setting-label {
      font-weight: 500;
      color: #374151;
      font-size: 0.875rem;
    }

    .toggle-switch {
      position: relative;
      width: 2.5rem;
      height: 1.25rem;
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
      border-radius: 1.25rem;
      transition: background 0.2s ease;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 0.875rem;
      width: 0.875rem;
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
      transform: translateX(1.25rem);
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .group-header {
        padding: 0.75rem 1rem;
      }

      .group-stats {
        display: none;
      }

      .questions-list {
        padding: 0.75rem 1rem;
      }

      .question-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .question-actions {
        opacity: 1;
        align-self: flex-end;
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
      .group-card, .question-item {
        border-width: 2px;
      }
    }

    /* Keyboard navigation */
    .group-card:focus-within,
    .question-item:focus-within {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    /* Loading state */
    .loading {
      opacity: 0.6;
      pointer-events: none;
    }

    .spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid #e5e7eb;
      border-top: 2px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  @property({ type: Object })
  config: QuestionGroupManagerConfig = {
    groups: [],
    language: 'en'
  };

  @state()
  private draggedItem: { type: 'group' | 'question'; groupId: string; questionId?: string; index: number } | null = null;

  @state()
  private draggedOverElement: { type: 'group' | 'question'; groupId: string; questionId?: string } | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.setupDragAndDrop();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeDragAndDrop();
  }

  private setupDragAndDrop() {
    // This would be implemented with actual drag and drop event handlers
    // For now, it's a placeholder for the interface
  }

  private removeDragAndDrop() {
    // Clean up drag and drop event listeners
  }

  private handleGroupEdit(group: QuestionGroup) {
    if (this.config.onGroupEdit) {
      this.config.onGroupEdit(group);
    }
  }

  private handleQuestionEdit(groupId: string, question: Question) {
    if (this.config.onQuestionEdit) {
      this.config.onQuestionEdit(groupId, question);
    }
  }

  private handleQuestionDelete(groupId: string, questionId: string) {
    if (this.config.onQuestionDelete) {
      this.config.onQuestionDelete(groupId, questionId);
    }
  }

  private handleGroupToggle(groupId: string) {
    const groups = [...this.config.groups];
    const group = groups.find(g => g.id === groupId);
    if (group) {
      group.uiConfig.collapsed = !group.uiConfig.collapsed;
      this.updateGroups(groups);
    }
  }

  private handleGroupSettings(groupId: string) {
    const groups = [...this.config.groups];
    const group = groups.find(g => g.id === groupId);
    if (group) {
      // Toggle settings panel
      this.updateGroups(groups);
    }
  }

  private moveGroup(fromIndex: number, toIndex: number) {
    const groups = [...this.config.groups];
    const [movedGroup] = groups.splice(fromIndex, 1);
    groups.splice(toIndex, 0, movedGroup);

    // Update order indices
    groups.forEach((group, index) => {
      group.orderIndex = index;
    });

    this.updateGroups(groups);
  }

  private moveQuestion(groupId: string, fromIndex: number, toIndex: number) {
    const groups = [...this.config.groups];
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const questions = [...group.questions];
    const [movedQuestion] = questions.splice(fromIndex, 1);
    questions.splice(toIndex, 0, movedQuestion);

    // Update order indices
    questions.forEach((question, index) => {
      question.orderIndex = index;
    });

    group.questions = questions;
    this.updateGroups(groups);
  }

  private updateGroups(groups: QuestionGroup[]) {
    if (this.config.onGroupsChange) {
      this.config.onGroupsChange(groups);
    }
    this.requestUpdate();
  }

  private getQuestionTypeLabel(type: Question['type']): string {
    const labels = {
      text: this.config.language === 'pl' ? 'Krótka' : 'Short',
      textarea: this.config.language === 'pl' ? 'Długa' : 'Long',
      number: this.config.language === 'pl' ? 'Liczba' : 'Number',
      scale: this.config.language === 'pl' ? 'Skala' : 'Scale',
      single_choice: this.config.language === 'pl' ? 'Pojedynczy' : 'Single',
      multiple_choice: this.config.language === 'pl' ? 'Wielokrotny' : 'Multiple'
    };
    return labels[type] || type;
  }

  private calculateGroupProgress(group: QuestionGroup): number {
    if (group.questions.length === 0) return 0;
    const requiredQuestions = group.questions.filter(q => q.validation?.required);
    if (requiredQuestions.length === 0) return 100;

    // This would need to be connected to actual response data
    // For now, return a placeholder
    return 0;
  }

  private renderGroup(group: QuestionGroup) {
    const progress = this.calculateGroupProgress(group);

    return html`
      <div class="group-card ${classMap({ collapsed: group.uiConfig.collapsed })}"
           data-group-id="${group.id}">
        <div class="group-header drag-handle">
          <div class="drag-handle">
            <div class="drag-handle-dot"></div>
            <div class="drag-handle-dot"></div>
            <div class="drag-handle-dot"></div>
          </div>

          <div class="group-title-section">
            <div class="group-icon">
              ${group.uiConfig.icon || String.fromCharCode(65 + group.orderIndex)}
            </div>
            <div class="group-title-content">
              <h3 class="group-title">
                ${group.title[this.config.language] || group.title.en}
              </h3>
              ${group.description ? html`
                <p class="group-description">
                  ${group.description[this.config.language] || group.description.en}
                </p>
              ` : ''}
            </div>
          </div>

          <div class="group-stats">
            <div class="stat-item">
              <span>📝</span>
              <span>${group.questions.length} ${this.config.language === 'pl' ? 'pytań' : 'questions'}</span>
            </div>
            ${group.uiConfig.showProgress ? html`
              <div class="stat-item">
                <span>📊</span>
                <span>${progress}%</span>
              </div>
            ` : ''}
          </div>

          <div class="group-actions">
            <button
              class="icon-button"
              @click=${() => this.handleGroupSettings(group.id)}
              title="Group settings"
            >
              ⚙️
            </button>
            <button
              class="icon-button danger"
              @click=${() => this.handleGroupEdit(group)}
              title="Delete group"
            >
              🗑️
            </button>
            <button
              class="icon-button"
              @click=${() => this.handleGroupToggle(group.id)}
              title="${group.uiConfig.collapsed ? 'Expand' : 'Collapse'}"
            >
              ${group.uiConfig.collapsed ? '📂' : '📁'}
            </button>
          </div>
        </div>

        <div class="group-content">
          ${group.uiConfig.showProgress ? html`
            <div style="padding: 0 1.5rem;">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
            </div>
          ` : ''}

          <div class="questions-list">
            ${group.questions.length > 0 ?
              repeat(group.questions, (question) => question.id, (question, index) =>
                this.renderQuestion(group, question, index)
              ) : html`
                <div class="empty-questions">
                  <div class="empty-questions-icon">📝</div>
                  <div>${this.config.language === 'pl' ? 'Brak pytań w tej sekcji' : 'No questions in this section'}</div>
                </div>
              `
            }

            ${!this.config.readonly ? html`
              <button class="add-question-button" @click=${() => this.handleQuestionEdit(group.id, {} as Question)}>
                <span>➕</span>
                <span>${this.config.language === 'pl' ? 'Dodaj pytanie' : 'Add Question'}</span>
              </button>
            ` : ''}
          </div>

          <div class="group-settings">
            <div class="setting-item">
              <span class="setting-label">${this.config.language === 'pl' ? 'Pokaż postęp' : 'Show progress'}</span>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  ?checked=${group.uiConfig.showProgress}
                  @change=${(e: Event) => {
                    group.uiConfig.showProgress = (e.target as HTMLInputElement).checked;
                    this.updateGroups(this.config.groups);
                  }}
                  ?disabled=${this.config.readonly}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-item">
              <span class="setting-label">${this.config.language === 'pl' ? 'Zwinięty domyślnie' : 'Collapsed by default'}</span>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  ?checked=${group.uiConfig.collapsed}
                  @change=${(e: Event) => {
                    group.uiConfig.collapsed = (e.target as HTMLInputElement).checked;
                    this.updateGroups(this.config.groups);
                  }}
                  ?disabled=${this.config.readonly}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderQuestion(group: QuestionGroup, question: Question, index: number) {
    return html`
      <div class="question-item" data-question-id="${question.id}">
        <div class="question-header">
          <div class="question-content">
            <div class="question-text">
              ${question.text[this.config.language] || question.text.en}
            </div>
            <div class="question-meta">
              <span class="question-type">${this.getQuestionTypeLabel(question.type)}</span>
              ${question.validation?.required ? html`
                <span class="question-required">
                  <span>❗</span>
                  <span>${this.config.language === 'pl' ? 'Wymagane' : 'Required'}</span>
                </span>
              ` : ''}
            </div>
          </div>
          <div class="question-actions">
            ${!this.config.readonly ? html`
              <button
                class="icon-button"
                @click=${() => this.handleQuestionEdit(group.id, question)}
                title="Edit question"
              >
                ✏️
              </button>
              <button
                class="icon-button danger"
                @click=${() => this.handleQuestionDelete(group.id, question.id)}
                title="Delete question"
              >
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="groups-container">
        ${this.config.groups.length > 0 ?
          repeat(this.config.groups, (group) => group.id, (group) =>
            this.renderGroup(group)
          ) : html`
            <div class="empty-questions">
              <div class="empty-questions-icon" style="font-size: 3rem;">📋</div>
              <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">
                ${this.config.language === 'pl' ? 'Brak sekcji' : 'No Sections'}
              </div>
              <div>
                ${this.config.language === 'pl' ?
                  'Rozpocznij od dodania pierwszej sekcji, aby zorganizować pytania' :
                  'Start by adding a section to organize your questions'
                }
              </div>
            </div>
          `
        }

        ${!this.config.readonly ? html`
          <button class="add-group-button" @click=${() => this.handleGroupEdit({
            id: `group_${Date.now()}`,
            title: {
              pl: `Nowa sekcja ${this.config.groups.length + 1}`,
              en: `New Section ${this.config.groups.length + 1}`
            },
            description: {
              pl: '',
              en: ''
            },
            orderIndex: this.config.groups.length,
            uiConfig: {
              collapsed: false,
              showProgress: true,
              icon: null
            },
            questions: []
          })}>
            <span class="add-group-icon">➕</span>
            <span>${this.config.language === 'pl' ? 'Dodaj sekcję' : 'Add Section'}</span>
          </button>
        ` : ''}
      </div>
    `;
  }
}

export default QuestionGroupManager;