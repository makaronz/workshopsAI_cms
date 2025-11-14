/**
 * Questionnaire Manager Integration Component
 * Full integration example with backend API and auto-save functionality
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type {
  Questionnaire,
  QuestionnaireBuilderConfig,
  QuestionnairePreviewConfig
} from './index.js';

import { QuestionnaireBuilder } from './questionnaire-builder.js';
import { QuestionnairePreview } from './questionnaire-preview.js';

/**
 * Questionnaire Manager Component
 */
@customElement('questionnaire-manager')
export class QuestionnaireManager extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #374151;
    }

    .manager-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .manager-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .manager-title {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
      color: #111827;
    }

    .manager-description {
      font-size: 1.125rem;
      color: #6b7280;
      margin: 0;
    }

    .tabs {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .tab {
      padding: 0.75rem 1rem;
      border: none;
      background: none;
      color: #6b7280;
      font-weight: 500;
      cursor: pointer;
      position: relative;
      transition: color 0.2s ease;
    }

    .tab:hover {
      color: #374151;
    }

    .tab.active {
      color: #3b82f6;
    }

    .tab.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: #3b82f6;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 0;
      margin-top: 2rem;
      border-top: 1px solid #e5e7eb;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .status-indicator.saving {
      color: #f59e0b;
    }

    .status-indicator.saved {
      color: #10b981;
    }

    .status-indicator.error {
      color: #dc2626;
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

    .notification {
      position: fixed;
      top: 1rem;
      right: 1rem;
      padding: 1rem 1.5rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 400px;
      z-index: 1000;
      transform: translateX(500px);
      transition: transform 0.3s ease;
    }

    .notification.show {
      transform: translateX(0);
    }

    .notification.success {
      border-left: 4px solid #10b981;
    }

    .notification.error {
      border-left: 4px solid #dc2626;
    }

    .notification.warning {
      border-left: 4px solid #f59e0b;
    }

    .notification-title {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .notification-message {
      font-size: 0.875rem;
      color: #6b7280;
    }

    /* Loading overlay */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }

    .loading-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .loading-content {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .spinner {
      width: 3rem;
      height: 3rem;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .manager-container {
        padding: 1rem;
      }

      .tabs {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .action-bar {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .notification {
        left: 1rem;
        right: 1rem;
        max-width: none;
      }
    }
  `;

  @property({ type: String })
  questionnaireId?: string;

  @property({ type: String })
  language: 'pl' | 'en' = 'en';

  @property({ type: String })
  apiBaseUrl: string = '/api/v1/questionnaires';

  @property({ type: Boolean })
  readonly: boolean = false;

  @state()
  private questionnaire: Questionnaire | null = null;

  @state()
  private activeTab: 'builder' | 'preview' | 'responses' = 'builder';

  @state()
  private isLoading: boolean = false;

  @state()
  private saveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';

  @state()
  private notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }> = [];

  connectedCallback() {
    super.connectedCallback();

    if (this.questionnaireId) {
      this.loadQuestionnaire();
    } else {
      this.createNewQuestionnaire();
    }
  }

  private async loadQuestionnaire() {
    this.isLoading = true;

    try {
      const response = await fetch(`${this.apiBaseUrl}/${this.questionnaireId}`);

      if (!response.ok) {
        throw new Error('Failed to load questionnaire');
      }

      const data = await response.json();
      this.questionnaire = data;
      this.showNotification('success', 'Success', 'Questionnaire loaded successfully');
    } catch (error) {
      console.error('Error loading questionnaire:', error);
      this.showNotification('error', 'Error', 'Failed to load questionnaire');
    } finally {
      this.isLoading = false;
    }
  }

  private createNewQuestionnaire() {
    // Import the utility function
    import('./index.js').then(({ createEmptyQuestionnaire }) => {
      this.questionnaire = createEmptyQuestionnaire(this.language);
    });
  }

  private async saveQuestionnaire(questionnaire: Questionnaire) {
    this.saveStatus = 'saving';

    try {
      const url = this.questionnaireId ?
        `${this.apiBaseUrl}/${this.questionnaireId}` :
        this.apiBaseUrl;

      const method = this.questionnaireId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers here if needed
          // 'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(questionnaire)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save questionnaire');
      }

      const savedQuestionnaire = await response.json();

      if (!this.questionnaireId) {
        this.questionnaireId = savedQuestionnaire.id;
        // Update URL without page reload
        window.history.replaceState({}, '', `/questionnaires/${this.questionnaireId}/edit`);
      }

      this.questionnaire = savedQuestionnaire;
      this.saveStatus = 'saved';

      this.showNotification('success', 'Saved', 'Questionnaire saved successfully');

      // Reset saved status after 2 seconds
      setTimeout(() => {
        if (this.saveStatus === 'saved') {
          this.saveStatus = 'idle';
        }
      }, 2000);

    } catch (error) {
      console.error('Error saving questionnaire:', error);
      this.saveStatus = 'error';
      this.showNotification('error', 'Error', 'Failed to save questionnaire');

      // Reset error status after 3 seconds
      setTimeout(() => {
        if (this.saveStatus === 'error') {
          this.saveStatus = 'idle';
        }
      }, 3000);
    }
  }

  private async publishQuestionnaire() {
    if (!this.questionnaire) return;

    this.isLoading = true;

    try {
      const response = await fetch(`${this.apiBaseUrl}/${this.questionnaire.id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers here if needed
        }
      });

      if (!response.ok) {
        throw new Error('Failed to publish questionnaire');
      }

      const updatedQuestionnaire = await response.json();
      this.questionnaire = updatedQuestionnaire;

      this.showNotification('success', 'Published', 'Questionnaire published successfully');
    } catch (error) {
      console.error('Error publishing questionnaire:', error);
      this.showNotification('error', 'Error', 'Failed to publish questionnaire');
    } finally {
      this.isLoading = false;
    }
  }

  private showNotification(type: 'success' | 'error' | 'warning', title: string, message: string) {
    const notification = {
      id: Date.now().toString(),
      type,
      title,
      message
    };

    this.notifications = [...this.notifications, notification];

    // Auto-remove after 5 seconds
    setTimeout(() => {
      this.removeNotification(notification.id);
    }, 5000);
  }

  private removeNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  private handleTabChange(tab: 'builder' | 'preview' | 'responses') {
    this.activeTab = tab;
  }

  private handleExport() {
    if (!this.questionnaire) return;

    const dataStr = JSON.stringify(this.questionnaire, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `questionnaire-${this.questionnaire.id}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    this.showNotification('success', 'Exported', 'Questionnaire exported successfully');
  }

  private async handleImport(file: File) {
    try {
      const text = await file.text();
      const { importQuestionnaire } = await import('./index.js');
      const importedQuestionnaire = importQuestionnaire(text);

      this.questionnaire = {
        ...importedQuestionnaire,
        id: this.questionnaire?.id || `questionnaire_${Date.now()}`,
        createdAt: this.questionnaire?.createdAt || new Date(),
        updatedAt: new Date()
      };

      this.showNotification('success', 'Imported', 'Questionnaire imported successfully');
    } catch (error) {
      console.error('Error importing questionnaire:', error);
      this.showNotification('error', 'Import Failed', 'Invalid questionnaire file');
    }
  }

  private renderNotifications() {
    return html`
      ${this.notifications.map(notification => html`
        <div class="notification ${notification.type} ${classMap({ show: true })}">
          <div class="notification-title">${notification.title}</div>
          <div class="notification-message">${notification.message}</div>
          <button
            type="button"
            style="position: absolute; top: 0.5rem; right: 0.5rem; border: none; background: none; cursor: pointer; font-size: 1.25rem; color: #6b7280;"
            @click=${() => this.removeNotification(notification.id)}
          >
            ×
          </button>
        </div>
      `)}
    `;
  }

  private renderLoadingOverlay() {
    if (!this.isLoading) return '';

    return html`
      <div class="loading-overlay active">
        <div class="loading-content">
          <div class="spinner"></div>
          <div>Loading...</div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.questionnaire) {
      return html`
        <div class="loading-overlay active">
          <div class="loading-content">
            <div class="spinner"></div>
            <div>Loading questionnaire...</div>
          </div>
        </div>
      `;
    }

    const builderConfig: QuestionnaireBuilderConfig = {
      questionnaire: this.questionnaire,
      language: this.language,
      readonly: this.readonly,
      autoSave: true,
      onSave: (questionnaire) => this.saveQuestionnaire(questionnaire),
      onPreview: (questionnaire) => {
        this.handleTabChange('preview');
      }
    };

    const previewConfig: QuestionnairePreviewConfig = {
      questionnaire: this.questionnaire,
      language: this.language,
      mode: 'preview',
      readonly: this.readonly
    };

    return html`
      ${this.renderLoadingOverlay()}
      ${this.renderNotifications()}

      <div class="manager-container">
        <div class="manager-header">
          <h1 class="manager-title">
            ${this.questionnaire.title[this.language] || 'Untitled Questionnaire'}
          </h1>
          <p class="manager-description">
            ${this.questionnaire.description?.[this.language] || ''}
          </p>
        </div>

        <div class="tabs">
          <button
            type="button"
            class="tab ${classMap({ active: this.activeTab === 'builder' })}"
            @click=${() => this.handleTabChange('builder')}
          >
            ${this.language === 'pl' ? 'Edytor' : 'Builder'}
          </button>
          <button
            type="button"
            class="tab ${classMap({ active: this.activeTab === 'preview' })}"
            @click=${() => this.handleTabChange('preview')}
          >
            ${this.language === 'pl' ? 'Podgląd' : 'Preview'}
          </button>
          <button
            type="button"
            class="tab ${classMap({ active: this.activeTab === 'responses' })}"
            @click=${() => this.handleTabChange('responses')}
          >
            ${this.language === 'pl' ? 'Odpowiedzi' : 'Responses'}
          </button>
        </div>

        <div class="tab-content ${classMap({ active: this.activeTab === 'builder' })}">
          <questionnaire-builder
            .config=${builderConfig}
          ></questionnaire-builder>
        </div>

        <div class="tab-content ${classMap({ active: this.activeTab === 'preview' })}">
          <questionnaire-preview
            .config=${previewConfig}
          ></questionnaire-preview>
        </div>

        <div class="tab-content ${classMap({ active: this.activeTab === 'responses' })}">
          <!-- Responses content would go here -->
          <div style="text-align: center; padding: 3rem; color: #6b7280;">
            <h3>${this.language === 'pl' ? 'Analiza odpowiedzi' : 'Response Analysis'}</h3>
            <p>${this.language === 'pl' ? 'Funkcja analizy odpowiedzi będzie dostępna wkrótce' : 'Response analysis feature coming soon'}</p>
          </div>
        </div>

        <div class="action-bar">
          <div class="status-indicator ${classMap({ [this.saveStatus]: this.saveStatus !== 'idle' })}">
            ${this.saveStatus === 'saving' ? html`
              <span>⏳</span>
              <span>Saving...</span>
            ` : this.saveStatus === 'saved' ? html`
              <span>✅</span>
              <span>Saved</span>
            ` : this.saveStatus === 'error' ? html`
              <span>❌</span>
              <span>Save failed</span>
            ` : ''}
          </div>

          <div class="action-buttons">
            <input
              type="file"
              id="import-file"
              accept=".json"
              style="display: none;"
              @change=${(e: Event) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) this.handleImport(file);
              }}
            />
            <button
              type="button"
              class="button button-secondary"
              @click=${() => {
                const fileInput = this.shadowRoot?.getElementById('import-file') as HTMLInputElement;
                fileInput?.click();
              }}
            >
              <span>📥</span>
              <span>${this.language === 'pl' ? 'Importuj' : 'Import'}</span>
            </button>

            <button
              type="button"
              class="button button-secondary"
              @click=${this.handleExport}
            >
              <span>📤</span>
              <span>${this.language === 'pl' ? 'Eksportuj' : 'Export'}</span>
            </button>

            ${!this.readonly ? html`
              <button
                type="button"
                class="button button-primary"
                @click=${this.publishQuestionnaire}
                ?disabled=${this.questionnaire.status === 'published'}
              >
                <span>🚀</span>
                <span>
                  ${this.questionnaire.status === 'published' ?
                    (this.language === 'pl' ? 'Opublikowany' : 'Published') :
                    (this.language === 'pl' ? 'Opublikuj' : 'Publish')
                  }
                </span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

export default QuestionnaireManager;