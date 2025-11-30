/**
 * Workshop Intelligence Form Builder
 * Admin component for creating and managing workshop forms
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

// Types
export interface FormQuestion {
  id: string;
  questionText: string;
  questionType: 'text' | 'textarea' | 'multiple_choice' | 'single_choice' | 'rating' | 'yes_no';
  options?: string[];
  isRequired: boolean;
  displayOrder: number;
}

export interface WorkshopForm {
  id: string;
  workshopId: string;
  isEditable: boolean;
  questions: FormQuestion[];
}

@customElement('workshop-form-builder')
export class WorkshopFormBuilder extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 24px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }

    .header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #1f2937;
    }

    .actions {
      display: flex;
      gap: 12px;
    }

    button {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-secondary {
      background: #e5e7eb;
      color: #374151;
    }

    .btn-secondary:hover {
      background: #d1d5db;
    }

    .questions-list {
      margin-bottom: 24px;
    }

    .question-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: start;
      transition: box-shadow 0.2s;
    }

    .question-item:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .question-content {
      flex: 1;
    }

    .question-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .question-type-badge {
      padding: 4px 12px;
      background: #dbeafe;
      color: #1e40af;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .question-text {
      font-size: 16px;
      font-weight: 500;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .question-options {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .option-chip {
      padding: 4px 12px;
      background: #f3f4f6;
      border-radius: 12px;
      font-size: 13px;
      color: #6b7280;
    }

    .question-actions {
      display: flex;
      gap: 8px;
    }

    .btn-icon {
      padding: 8px;
      background: transparent;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      color: #6b7280;
    }

    .btn-icon:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .btn-delete {
      color: #dc2626;
    }

    .btn-delete:hover {
      background: #fee2e2;
      border-color: #fecaca;
    }

    .add-question-section {
      background: #f9fafb;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 24px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
    }

    .form-group textarea {
      resize: vertical;
      min-height: 80px;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .checkbox-group input[type="checkbox"] {
      width: auto;
    }

    .options-editor {
      margin-top: 12px;
    }

    .option-input-group {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .option-input-group input {
      flex: 1;
    }

    .btn-remove-option {
      padding: 8px 12px;
      background: #fee2e2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: #6b7280;
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  `;

  @property({ type: String })
  workshopId = '';

  @state()
  private form: WorkshopForm | null = null;

  @state()
  private questions: FormQuestion[] = [];

  @state()
  private newQuestion: Partial<FormQuestion> = {
    questionText: '',
    questionType: 'text',
    options: [],
    isRequired: false,
    displayOrder: 0,
  };

  @state()
  private loading = false;

  @state()
  private showAddQuestion = false;

  connectedCallback() {
    super.connectedCallback();
    if (this.workshopId) {
      this.loadForm();
    }
  }

  private async loadForm() {
    this.loading = true;
    try {
      const response = await fetch(`/api/v1/workshop-intelligence/forms/${this.workshopId}`);

      if (response.ok) {
        const data = await response.json();
        this.form = data;
        this.questions = data.questions || [];
      } else if (response.status === 404) {
        // Form doesn't exist, create new one
        await this.createForm();
      }
    } catch (error) {
      console.error('Error loading form:', error);
    } finally {
      this.loading = false;
    }
  }

  private async createForm() {
    try {
      const response = await fetch('/api/v1/workshop-intelligence/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId: this.workshopId }),
      });

      if (response.ok) {
        const data = await response.json();
        this.form = data;
        this.questions = [];
      }
    } catch (error) {
      console.error('Error creating form:', error);
    }
  }

  private async addQuestion() {
    if (!this.form || !this.newQuestion.questionText) return;

    try {
      const response = await fetch(`/api/v1/workshop-intelligence/forms/${this.form.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.newQuestion,
          displayOrder: this.questions.length,
        }),
      });

      if (response.ok) {
        const question = await response.json();
        this.questions = [...this.questions, question];
        this.resetNewQuestion();
        this.showAddQuestion = false;
      }
    } catch (error) {
      console.error('Error adding question:', error);
    }
  }

  private async deleteQuestion(questionId: string) {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const response = await fetch(`/api/v1/workshop-intelligence/questions/${questionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        this.questions = this.questions.filter(q => q.id !== questionId);
      }
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  }

  private resetNewQuestion() {
    this.newQuestion = {
      questionText: '',
      questionType: 'text',
      options: [],
      isRequired: false,
      displayOrder: 0,
    };
  }

  private addOption() {
    this.newQuestion = {
      ...this.newQuestion,
      options: [...(this.newQuestion.options || []), ''],
    };
  }

  private updateOption(index: number, value: string) {
    const options = [...(this.newQuestion.options || [])];
    options[index] = value;
    this.newQuestion = { ...this.newQuestion, options };
  }

  private removeOption(index: number) {
    const options = [...(this.newQuestion.options || [])];
    options.splice(index, 1);
    this.newQuestion = { ...this.newQuestion, options };
  }

  private getQuestionTypeName(type: string): string {
    const names: Record<string, string> = {
      text: 'Short Text',
      textarea: 'Long Text',
      multiple_choice: 'Multiple Choice',
      single_choice: 'Single Choice',
      rating: 'Rating',
      yes_no: 'Yes/No',
    };
    return names[type] || type;
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading form...</div>`;
    }

    return html`
      <div class="header">
        <h2>Workshop Form Builder</h2>
        <div class="actions">
          <button class="btn-secondary" @click=${() => this.dispatchEvent(new CustomEvent('preview'))}>
            Preview
          </button>
        </div>
      </div>

      ${this.questions.length === 0 ? this.renderEmptyState() : this.renderQuestions()}

      ${this.showAddQuestion ? this.renderAddQuestion() : this.renderAddButton()}
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <h3>No questions yet</h3>
        <p>Start building your workshop form by adding questions</p>
      </div>
    `;
  }

  private renderQuestions() {
    return html`
      <div class="questions-list">
        ${repeat(
          this.questions,
          (q) => q.id,
          (question) => html`
            <div class="question-item">
              <div class="question-content">
                <div class="question-header">
                  <span class="question-type-badge">${this.getQuestionTypeName(question.questionType)}</span>
                  ${question.isRequired ? html`<span style="color: #dc2626;">*</span>` : ''}
                </div>
                <div class="question-text">${question.questionText}</div>
                ${question.options && question.options.length > 0
                  ? html`
                      <div class="question-options">
                        ${question.options.map((opt) => html`<span class="option-chip">${opt}</span>`)}
                      </div>
                    `
                  : ''}
              </div>
              <div class="question-actions">
                <button class="btn-icon btn-delete" @click=${() => this.deleteQuestion(question.id)}>
                  🗑️
                </button>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  private renderAddButton() {
    return html`
      <button class="btn-primary" @click=${() => (this.showAddQuestion = true)}>
        ➕ Add Question
      </button>
    `;
  }

  private renderAddQuestion() {
    const needsOptions = ['multiple_choice', 'single_choice'].includes(this.newQuestion.questionType || '');

    return html`
      <div class="add-question-section">
        <h3>Add New Question</h3>

        <div class="form-group">
          <label>Question Text *</label>
          <textarea
            .value=${this.newQuestion.questionText || ''}
            @input=${(e: Event) => {
              this.newQuestion = { ...this.newQuestion, questionText: (e.target as HTMLTextAreaElement).value };
            }}
            placeholder="Enter your question here..."
          ></textarea>
        </div>

        <div class="form-group">
          <label>Question Type</label>
          <select
            .value=${this.newQuestion.questionType || 'text'}
            @change=${(e: Event) => {
              this.newQuestion = { ...this.newQuestion, questionType: (e.target as HTMLSelectElement).value as any };
            }}
          >
            <option value="text">Short Text</option>
            <option value="textarea">Long Text</option>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="single_choice">Single Choice</option>
            <option value="rating">Rating (1-5)</option>
            <option value="yes_no">Yes/No</option>
          </select>
        </div>

        ${needsOptions ? this.renderOptionsEditor() : ''}

        <div class="checkbox-group">
          <input
            type="checkbox"
            id="required"
            .checked=${this.newQuestion.isRequired || false}
            @change=${(e: Event) => {
              this.newQuestion = { ...this.newQuestion, isRequired: (e.target as HTMLInputElement).checked };
            }}
          />
          <label for="required">Required</label>
        </div>

        <div class="actions" style="margin-top: 16px;">
          <button class="btn-primary" @click=${this.addQuestion}>Add Question</button>
          <button
            class="btn-secondary"
            @click=${() => {
              this.showAddQuestion = false;
              this.resetNewQuestion();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    `;
  }

  private renderOptionsEditor() {
    return html`
      <div class="options-editor">
        <label>Options</label>
        ${(this.newQuestion.options || []).map(
          (option, index) => html`
            <div class="option-input-group">
              <input
                type="text"
                .value=${option}
                @input=${(e: Event) => this.updateOption(index, (e.target as HTMLInputElement).value)}
                placeholder="Option ${index + 1}"
              />
              <button class="btn-remove-option" @click=${() => this.removeOption(index)}>Remove</button>
            </div>
          `
        )}
        <button class="btn-secondary" style="margin-top: 8px;" @click=${this.addOption}>+ Add Option</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workshop-form-builder': WorkshopFormBuilder;
  }
}
