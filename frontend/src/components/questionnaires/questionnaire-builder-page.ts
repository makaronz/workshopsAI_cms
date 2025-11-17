/**
 * Questionnaire Builder Page Component
 * Full page wrapper for the questionnaire builder with navigation
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { QuestionnaireManager } from '../questionnaire/questionnaire-manager.js';

@customElement('questionnaire-builder-page')
export class QuestionnaireBuilderPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: #f9fafb;
    }

    .page-container {
      padding-top: 4rem; /* Account for fixed header */
      min-height: 100vh;
    }

    .page-header {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      padding: 1rem 2rem;
      margin-bottom: 2rem;
    }

    .header-content {
      max-width: 1200px;
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

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .breadcrumb-link {
      color: #3b82f6;
      text-decoration: none;
    }

    .breadcrumb-link:hover {
      text-decoration: underline;
    }

    .breadcrumb-separator {
      color: #9ca3af;
    }

    @media (max-width: 640px) {
      .page-header {
        padding: 1rem;
      }

      .header-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }
  `;

  @property({ type: String })
  questionnaireId?: string;

  @property({ type: String })
  language: 'pl' | 'en' = 'en';

  connectedCallback() {
    super.connectedCallback();

    // Extract questionnaire ID from URL path
    const path = window.location.pathname;
    const match = path.match(/\/dashboard\/questionnaires\/(?:edit\/)?([^\/]+)/);
    if (match && match[1]) {
      this.questionnaireId = match[1];
    }
  }

  private async handleNavigateBack(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    
    // Navigate back to dashboard using pushState
    window.history.pushState({}, '', '/dashboard');
    
    // Trigger routing update
    const appElement = document.getElementById('app');
    if (appElement) {
      // Import and call initializeRouting dynamically
      try {
        const module = await import('../../main-simple');
        if (module.initializeRouting) {
          await module.initializeRouting(appElement, '/dashboard');
        } else {
          // Fallback: reload page
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('Error navigating back:', error);
        // Fallback: reload page
        window.location.href = '/dashboard';
      }
    }
  }

  render() {
    return html`
      <div class="page-container">
        <div class="page-header">
          <div class="header-content">
            <div class="breadcrumb">
              <a href="/dashboard" class="breadcrumb-link" @click=${(e: Event) => this.handleNavigateBack(e)}>
                ${this.language === 'pl' ? 'Dashboard' : 'Dashboard'}
              </a>
              <span class="breadcrumb-separator">/</span>
              <a href="/dashboard/questionnaires" class="breadcrumb-link" @click=${(e: Event) => this.handleNavigateBack(e)}>
                ${this.language === 'pl' ? 'Kwestionariusze' : 'Questionnaires'}
              </a>
              <span class="breadcrumb-separator">/</span>
              <span>
                ${this.questionnaireId ?
                  (this.language === 'pl' ? 'Edytuj kwestionariusz' : 'Edit Questionnaire') :
                  (this.language === 'pl' ? 'Nowy kwestionariusz' : 'New Questionnaire')
                }
              </span>
            </div>
            <button 
              class="back-button" 
              @click=${(e: Event) => this.handleNavigateBack(e)}
              style="padding: 0.5rem 1rem; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 0.875rem; color: #374151;"
            >
              ← ${this.language === 'pl' ? 'Wróć' : 'Back'}
            </button>
            <h1 class="page-title">
              ${this.language === 'pl' ? 'Edytor kwestionariusza' : 'Questionnaire Builder'}
            </h1>
          </div>
        </div>

        <questionnaire-manager
          .questionnaireId=${this.questionnaireId}
          .language=${this.language}
          .apiBaseUrl="/api/v1/questionnaires"
          .readonly=${false}
        ></questionnaire-manager>
      </div>
    `;
  }
}

export default QuestionnaireBuilderPage;