/**
 * Workshop Intelligence Participant Form
 * Participant component for filling out workshop forms
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

// Types
interface FormQuestion {
  id: string;
  questionText: string;
  questionType: 'text' | 'textarea' | 'multiple_choice' | 'single_choice' | 'rating' | 'yes_no';
  options?: string[];
  isRequired: boolean;
  displayOrder: number;
}

interface Answer {
  questionId: string;
  answerData: any;
}

interface Contribution {
  id: string;
  status: 'draft' | 'submitted';
  answers: Answer[];
}

@customElement('participant-workshop-form')
export class ParticipantWorkshopForm extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
    }

    .header {
      text-align: center;
      margin-bottom: 32px;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .header p {
      color: #6b7280;
      font-size: 16px;
    }

    .form-locked-message {
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: center;
      color: #991b1b;
    }

    .question-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .question-number {
      display: inline-block;
      width: 28px;
      height: 28px;
      line-height: 28px;
      text-align: center;
      background: #3b82f6;
      color: white;
      border-radius: 50%;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .question-text {
      font-size: 18px;
      font-weight: 500;
      color: #1f2937;
      margin-bottom: 16px;
    }

    .required-indicator {
      color: #dc2626;
      margin-left: 4px;
    }

    .question-type-hint {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 12px;
    }

    input[type="text"],
    textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 15px;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    input[type="text"]:focus,
    textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    textarea {
      resize: vertical;
      min-height: 120px;
    }

    .radio-option,
    .checkbox-option {
      display: flex;
      align-items: center;
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .radio-option:hover,
    .checkbox-option:hover {
      background: #f9fafb;
      border-color: #3b82f6;
    }

    .radio-option input[type="radio"],
    .checkbox-option input[type="checkbox"] {
      margin-right: 12px;
      cursor: pointer;
    }

    .rating-container {
      display: flex;
      gap: 12px;
      justify-content: center;
      padding: 16px 0;
    }

    .rating-button {
      width: 48px;
      height: 48px;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      background: white;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .rating-button:hover {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .rating-button.selected {
      border-color: #3b82f6;
      background: #3b82f6;
      color: white;
    }

    .yes-no-container {
      display: flex;
      gap: 16px;
      justify-content: center;
    }

    .yes-no-button {
      flex: 1;
      max-width: 200px;
      padding: 16px 24px;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      background: white;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .yes-no-button:hover {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .yes-no-button.selected {
      border-color: #3b82f6;
      background: #3b82f6;
      color: white;
    }

    .actions {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 2px solid #e5e7eb;
    }

    button {
      padding: 12px 32px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-save {
      background: #e5e7eb;
      color: #374151;
    }

    .btn-save:hover {
      background: #d1d5db;
    }

    .btn-submit {
      background: #3b82f6;
      color: white;
    }

    .btn-submit:hover {
      background: #2563eb;
    }

    .btn-submit:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .success-message {
      background: #d1fae5;
      border: 1px solid #6ee7b7;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: center;
      color: #065f46;
    }

    .loading {
      text-align: center;
      padding: 48px;
      color: #6b7280;
    }

    .progress-indicator {
      margin-bottom: 24px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
    }

    .progress-bar {
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s;
    }
  `;

  @property({ type: String })
  workshopId = '';

  @state()
  private questions: FormQuestion[] = [];

  @state()
  private answers: Map<string, any> = new Map();

  @state()
  private contribution: Contribution | null = null;

  @state()
  private loading = false;

  @state()
  private isEditable = true;

  @state()
  private submitted = false;

  @state()
  private autoSaveTimeout: any = null;

  connectedCallback() {
    super.connectedCallback();
    if (this.workshopId) {
      this.loadForm();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
  }

  private async loadForm() {
    this.loading = true;

    try {
      // Load form and questions
      const formResponse = await fetch(`/api/v1/workshop-intelligence/forms/${this.workshopId}`);
      const formData = await formResponse.json();

      this.questions = formData.questions || [];
      this.isEditable = formData.isEditable;

      // Get or create contribution
      const contributionResponse = await fetch('/api/v1/workshop-intelligence/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId: this.workshopId }),
      });

      this.contribution = await contributionResponse.json();

      // Load existing answers
      if (this.contribution && this.contribution.answers) {
        this.contribution.answers.forEach((answer) => {
          this.answers.set(answer.questionId, answer.answerData);
        });
      }

      this.submitted = this.contribution?.status === 'submitted';
    } catch (error) {
      console.error('Error loading form:', error);
    } finally {
      this.loading = false;
    }
  }

  private updateAnswer(questionId: string, value: any) {
    this.answers.set(questionId, value);
    this.requestUpdate();
    this.scheduleAutoSave(questionId);
  }

  private scheduleAutoSave(questionId: string) {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(() => {
      this.saveAnswer(questionId);
    }, 1000);
  }

  private async saveAnswer(questionId: string) {
    if (!this.contribution || !this.isEditable) return;

    const answerData = this.answers.get(questionId);

    try {
      await fetch('/api/v1/workshop-intelligence/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributionId: this.contribution.id,
          questionId,
          answerData,
        }),
      });
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  }

  private async submitForm() {
    if (!this.contribution) return;

    // Validate required questions
    const missingAnswers = this.questions
      .filter((q) => q.isRequired && !this.answers.has(q.id))
      .map((q) => q.questionText);

    if (missingAnswers.length > 0) {
      alert('Please answer all required questions:\n' + missingAnswers.join('\n'));
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/workshop-intelligence/contributions/${this.contribution.id}/submit`,
        { method: 'POST' }
      );

      if (response.ok) {
        this.submitted = true;
        this.dispatchEvent(new CustomEvent('form-submitted', { bubbles: true, composed: true }));
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  }

  private getProgress(): number {
    if (this.questions.length === 0) return 0;
    return (this.answers.size / this.questions.length) * 100;
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading form...</div>`;
    }

    if (this.submitted) {
      return html`
        <div class="success-message">
          <h2>✓ Thank you for your submission!</h2>
          <p>Your responses have been recorded successfully.</p>
        </div>
      `;
    }

    return html`
      <div class="header">
        <h1>Workshop Preparation Form</h1>
        <p>Share your ideas, expectations, and challenges</p>
      </div>

      ${!this.isEditable
        ? html`
            <div class="form-locked-message">
              🔒 This form is now locked. You can no longer edit your responses.
            </div>
          `
        : ''}

      <div class="progress-indicator">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${this.getProgress()}%"></div>
        </div>
        <div>${Math.round(this.getProgress())}% completed</div>
      </div>

      ${repeat(
        this.questions,
        (q) => q.id,
        (question, index) => this.renderQuestion(question, index)
      )}

      ${this.isEditable
        ? html`
            <div class="actions">
              <button class="btn-save" @click=${() => this.loadForm()}>Save Draft</button>
              <button class="btn-submit" @click=${this.submitForm}>Submit</button>
            </div>
          `
        : ''}
    `;
  }

  private renderQuestion(question: FormQuestion, index: number): TemplateResult {
    return html`
      <div class="question-card">
        <div class="question-number">${index + 1}</div>
        <div class="question-text">
          ${question.questionText}
          ${question.isRequired ? html`<span class="required-indicator">*</span>` : ''}
        </div>
        ${this.renderQuestionInput(question)}
      </div>
    `;
  }

  private renderQuestionInput(question: FormQuestion): TemplateResult {
    const currentValue = this.answers.get(question.id);

    switch (question.questionType) {
      case 'text':
        return html`
          <input
            type="text"
            .value=${currentValue || ''}
            @input=${(e: Event) => this.updateAnswer(question.id, (e.target as HTMLInputElement).value)}
            ?disabled=${!this.isEditable}
            placeholder="Your answer..."
          />
        `;

      case 'textarea':
        return html`
          <textarea
            .value=${currentValue || ''}
            @input=${(e: Event) => this.updateAnswer(question.id, (e.target as HTMLTextAreaElement).value)}
            ?disabled=${!this.isEditable}
            placeholder="Your detailed answer..."
          ></textarea>
        `;

      case 'single_choice':
        return html`
          ${question.options?.map(
            (option) => html`
              <label class="radio-option">
                <input
                  type="radio"
                  name=${question.id}
                  .checked=${currentValue === option}
                  @change=${() => this.updateAnswer(question.id, option)}
                  ?disabled=${!this.isEditable}
                />
                <span>${option}</span>
              </label>
            `
          )}
        `;

      case 'multiple_choice':
        return html`
          ${question.options?.map(
            (option) => html`
              <label class="checkbox-option">
                <input
                  type="checkbox"
                  .checked=${(currentValue || []).includes(option)}
                  @change=${(e: Event) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    const current = currentValue || [];
                    const updated = checked
                      ? [...current, option]
                      : current.filter((v: string) => v !== option);
                    this.updateAnswer(question.id, updated);
                  }}
                  ?disabled=${!this.isEditable}
                />
                <span>${option}</span>
              </label>
            `
          )}
        `;

      case 'rating':
        return html`
          <div class="rating-container">
            ${[1, 2, 3, 4, 5].map(
              (rating) => html`
                <button
                  class="rating-button ${currentValue === rating ? 'selected' : ''}"
                  @click=${() => this.updateAnswer(question.id, rating)}
                  ?disabled=${!this.isEditable}
                >
                  ${rating}
                </button>
              `
            )}
          </div>
        `;

      case 'yes_no':
        return html`
          <div class="yes-no-container">
            <button
              class="yes-no-button ${currentValue === true ? 'selected' : ''}"
              @click=${() => this.updateAnswer(question.id, true)}
              ?disabled=${!this.isEditable}
            >
              Yes
            </button>
            <button
              class="yes-no-button ${currentValue === false ? 'selected' : ''}"
              @click=${() => this.updateAnswer(question.id, false)}
              ?disabled=${!this.isEditable}
            >
              No
            </button>
          </div>
        `;

      default:
        return html`<div>Unsupported question type</div>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'participant-workshop-form': ParticipantWorkshopForm;
  }
}
