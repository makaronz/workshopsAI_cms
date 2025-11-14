/**
 * Questionnaire Builder Page Component
 * Full page wrapper for the questionnaire builder with navigation
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Router } from '@vaadin/router';

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

    // Extract questionnaire ID from URL
    const router = (document as any).router as Router;
    if (router) {
      const location = router.location;
      const params = location?.params;
      if (params?.id) {
        this.questionnaireId = params.id;
      }
    }
  }

  private handleNavigateBack() {
    const router = (document as any).router as Router;
    if (router) {
      router.navigate('/questionnaires');
    }
  }

  render() {
    return html`
      <div class="page-container">
        <div class="page-header">
          <div class="header-content">
            <div class="breadcrumb">
              <a href="/questionnaires" class="breadcrumb-link" @click=${(e: Event) => {
                e.preventDefault();
                this.handleNavigateBack();
              }}>
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