/**
 * Questionnaire Preview Page Component
 * Full page wrapper for the questionnaire preview
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { QuestionnairePreview } from '../questionnaire/questionnaire-preview.js';

@customElement('questionnaire-preview-page')
export class QuestionnairePreviewPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: #f9fafb;
    }

    .page-container {
      padding-top: 4rem; /* Account for fixed header */
      padding-bottom: 2rem;
    }

    .preview-header {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      padding: 1rem 2rem;
      margin-bottom: 2rem;
      position: sticky;
      top: 4rem;
      z-index: 100;
    }

    .header-content {
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .page-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0;
      color: #111827;
    }

    .preview-actions {
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
      text-decoration: none;
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

    .preview-wrapper {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .loading-message {
      text-align: center;
      padding: 3rem;
      color: #6b7280;
    }

    .error-message {
      text-align: center;
      padding: 3rem;
      color: #dc2626;
    }

    .error-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    @media (max-width: 640px) {
      .preview-header {
        padding: 1rem;
      }

      .header-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .preview-actions {
        width: 100%;
      }

      .button {
        flex: 1;
        justify-content: center;
      }
    }
  `;

  @property({ type: String })
  questionnaireId?: string;

  @property({ type: String })
  language: 'pl' | 'en' = 'en';

  @state()
  private questionnaire: any = null;

  @state()
  private isLoading: boolean = true;

  @state()
  private error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadQuestionnaire();
  }

  private async loadQuestionnaire() {
    if (!this.questionnaireId) {
      this.error = 'No questionnaire ID provided';
      this.isLoading = false;
      return;
    }

    try {
      const response = await fetch(`/api/v1/questionnaires/${this.questionnaireId}`);

      if (!response.ok) {
        throw new Error('Failed to load questionnaire');
      }

      const data = await response.json();
      this.questionnaire = data;
    } catch (error) {
      console.error('Error loading questionnaire:', error);
      this.error = error.message || 'Failed to load questionnaire';
    } finally {
      this.isLoading = false;
    }
  }

  private handleStartTest() {
    // Navigate to test mode
    window.location.href = `/questionnaires/${this.questionnaireId}/test`;
  }

  private handleShare() {
    // Copy share link to clipboard
    const shareUrl = `${window.location.origin}/questionnaires/${this.questionnaireId}`;

    if (navigator.share) {
      navigator.share({
        title: this.questionnaire?.title?.[this.language] || 'Questionnaire',
        url: shareUrl
      });
    } else {
      navigator.clipboard.writeText(shareUrl);

      // Show temporary notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
      `;
      notification.textContent = this.language === 'pl' ? 'Link skopiowany!' : 'Link copied!';
      document.body.appendChild(notification);

      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    }
  }

  render() {
    if (this.isLoading) {
      return html`
        <div class="page-container">
          <div class="loading-message">
            <div style="font-size: 2rem; margin-bottom: 1rem;">⏳</div>
            <div>${this.language === 'pl' ? 'Ładowanie kwestionariusza...' : 'Loading questionnaire...'}</div>
          </div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="page-container">
          <div class="error-message">
            <div class="error-title">
              ${this.language === 'pl' ? 'Błąd ładowania' : 'Loading Error'}
            </div>
            <div>${this.error}</div>
            <button class="button button-primary" style="margin-top: 1rem;" @click=${() => this.loadQuestionnaire()}>
              ${this.language === 'pl' ? 'Spróbuj ponownie' : 'Try Again'}
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="page-container">
        <div class="preview-header">
          <div class="header-content">
            <h1 class="page-title">
              ${this.questionnaire?.title?.[this.language] || 'Questionnaire Preview'}
            </h1>
            <div class="preview-actions">
              <button class="button button-secondary" @click=${this.handleShare}>
                <span>📤</span>
                <span>${this.language === 'pl' ? 'Udostępnij' : 'Share'}</span>
              </button>
              <button class="button button-primary" @click=${this.handleStartTest}>
                <span>▶️</span>
                <span>${this.language === 'pl' ? 'Rozpocznij test' : 'Start Test'}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="preview-wrapper">
          <questionnaire-preview
            .questionnaire=${this.questionnaire}
            .language=${this.language}
            .mode="preview"
            .readonly=${true}
          ></questionnaire-preview>
        </div>
      </div>
    `;
  }
}

export default QuestionnairePreviewPage;