/**
 * Single Page Questionnaire Web Component
 * Implements responsive, mobile-first questionnaire interface with all questions visible
 * Features: auto-save, progress tracking, offline capability, bilingual support
 */

import { QuestionRenderer } from './QuestionRenderer';
import { ProgressTracker } from './ProgressTracker';
import { SaveStatus } from './SaveStatus';
import { AutoSaveManager } from '../services/AutoSaveManager';
import { OfflineStorage } from '../services/offlineStorage';
import { translations, type Language } from '../i18n/translations';

interface QuestionnaireConfig {
  id: string;
  title: { pl: string; en: string };
  instructions: { pl: string; en: string };
  settings: {
    show_all_questions: boolean;
    allow_edit: boolean;
    require_consent: boolean;
    anonymous: boolean;
    question_style: 'first_person_plural' | 'third_person';
  };
  questionGroups: QuestionGroup[];
}

interface QuestionGroup {
  id: string;
  title: { pl: string; en: string };
  description?: { pl: string; en: string };
  orderIndex: number;
  questions: Question[];
}

interface Question {
  id: string;
  text: { pl: string; en: string };
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'scale'
    | 'single_choice'
    | 'multiple_choice';
  options?: Array<{ value: string; label: { pl: string; en: string } }>;
  validation?: {
    required?: boolean;
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
    pattern?: string;
  };
  orderIndex: number;
  helpText?: { pl: string; en: string };
}

interface ConsentData {
  ai_processing: boolean;
  data_processing: boolean;
  anonymous_sharing: boolean;
}

export class SinglePageQuestionnaire extends HTMLElement {
  private config: QuestionnaireConfig | null = null;
  private currentLanguage: Language = 'pl';
  private answers: Record<string, any> = {};
  private consent: ConsentData | null = null;
  private isSubmitting = false;

  // Component instances
  private progressTracker: ProgressTracker | null = null;
  private saveStatus: SaveStatus | null = null;
  private autoSaveManager: AutoSaveManager | null = null;
  private offlineStorage: OfflineStorage | null = null;

  // UI elements
  private questionnaireContent: HTMLElement | null = null;
  private consentModal: HTMLElement | null = null;
  private successMessage: HTMLElement | null = null;
  private languageSwitcher: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.initializeComponent();
  }

  disconnectedCallback() {
    this.cleanup();
  }

  private async initializeComponent() {
    // Initialize services
    this.offlineStorage = new OfflineStorage();
    this.autoSaveManager = new AutoSaveManager({
      interval: 30000, // 30 seconds
      onSave: this.handleAutoSave.bind(this),
      onError: this.handleSaveError.bind(this),
    });

    // Load saved data
    await this.loadSavedData();

    // Render component
    this.render();
    this.setupEventListeners();
    this.setupLanguageSwitcher();

    // Start auto-save if questionnaire is loaded
    if (this.config) {
      this.autoSaveManager?.start();
    }
  }

  private async loadSavedData() {
    if (!this.offlineStorage) return;

    try {
      const questionnaireId = this.getAttribute('questionnaire-id');
      if (!questionnaireId) return;

      const saved =
        await this.offlineStorage.getQuestionnaireData(questionnaireId);
      if (saved) {
        this.answers = saved.answers || {};
        this.consent = saved.consent || null;
        this.currentLanguage = saved.language || 'pl';
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #374151;
        }

        * {
          box-sizing: border-box;
        }

        .container {
          max-width: 1024px;
          margin: 0 auto;
          padding: 1rem;
        }

        /* Mobile-first responsive design */
        @media (min-width: 768px) {
          .container {
            padding: 2rem;
          }
        }

        @media (min-width: 1024px) {
          .container {
            display: grid;
            grid-template-columns: 250px 1fr;
            gap: 2rem;
            padding: 2rem;
          }
        }

        /* Header Styles */
        .header {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 1.5rem;
          margin-bottom: 2rem;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        @media (min-width: 1024px) {
          .header {
            grid-column: 1 / -1;
          }
        }

        .title {
          font-size: 1.875rem;
          font-weight: 700;
          color: #111827;
          margin: 0 0 0.5rem 0;
          line-height: 1.2;
        }

        .instructions {
          color: #6b7280;
          margin: 0 0 1.5rem 0;
        }

        /* Progress and Controls */
        .progress-controls {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          align-items: stretch;
        }

        @media (min-width: 768px) {
          .progress-controls {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
        }

        /* Question Groups */
        .question-groups {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .question-group {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 1.5rem;
          scroll-margin-top: 120px;
        }

        .group-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.5rem 0;
        }

        .group-description {
          color: #6b7280;
          margin: 0 0 1.5rem 0;
        }

        .questions {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Consent Modal */
        .consent-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 50;
        }

        .consent-modal.hidden {
          display: none;
        }

        .consent-content {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          max-width: 600px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .consent-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 1.5rem 0;
        }

        .consent-options {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .consent-option {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 1rem;
        }

        .consent-label {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          cursor: pointer;
        }

        .consent-checkbox {
          margin-top: 0.25rem;
        }

        .consent-option-title {
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .consent-option-description {
          font-size: 0.875rem;
          color: #6b7280;
          line-height: 1.5;
        }

        .consent-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        /* Success Message */
        .success-message {
          text-align: center;
          padding: 4rem 2rem;
        }

        .success-icon {
          color: #10b981;
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .success-title {
          font-size: 2rem;
          font-weight: 700;
          margin: 0 0 1rem 0;
        }

        .success-text {
          color: #6b7280;
          font-size: 1.125rem;
        }

        /* Language Switcher */
        .language-switcher {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 20;
        }

        .language-button {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .language-button:hover {
          background: #f9fafb;
        }

        /* Accessibility */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* Focus management */
        :focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .header,
          .question-group,
          .consent-content {
            border: 2px solid #000;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      </style>

      <div class="language-switcher">
        <button class="language-button" onclick="this.parentElement.parentElement.toggleLanguage()">
          <span class="lang-icon">🌐</span>
          <span class="lang-text">${this.currentLanguage === 'pl' ? 'EN' : 'PL'}</span>
        </button>
      </div>

      <div class="container">
        <header class="header">
          <h1 class="title" id="questionnaire-title"></h1>
          <p class="instructions" id="questionnaire-instructions"></p>

          <div class="progress-controls">
            <div id="progress-tracker"></div>
            <div id="save-status"></div>
          </div>
        </header>

        <main id="questionnaire-content" class="question-groups">
          <!-- Question groups will be rendered here -->
        </main>

        <div id="consent-modal" class="consent-modal hidden">
          <div class="consent-content">
            <h2 class="consent-title" data-i18n="gdpr.title"></h2>

            <div class="consent-options">
              <div class="consent-option">
                <label class="consent-label">
                  <input type="checkbox" id="ai-processing" class="consent-checkbox">
                  <div>
                    <div class="consent-option-title" data-i18n="gdpr.ai_processing"></div>
                    <div class="consent-option-description" data-i18n="gdpr.ai_description"></div>
                  </div>
                </label>
              </div>

              <div class="consent-option">
                <label class="consent-label">
                  <input type="checkbox" id="data-processing" class="consent-checkbox" checked>
                  <div>
                    <div class="consent-option-title" data-i18n="gdpr.data_processing"></div>
                    <div class="consent-option-description" data-i18n="gdpr.anonymous_description"></div>
                  </div>
                </label>
              </div>

              <div class="consent-option">
                <label class="consent-label">
                  <input type="checkbox" id="anonymous-sharing" class="consent-checkbox">
                  <div>
                    <div class="consent-option-title" data-i18n="gdpr.anonymous_sharing"></div>
                    <div class="consent-option-description" data-i18n="gdpr.data_retention_description"></div>
                  </div>
                </label>
              </div>
            </div>

            <div class="consent-actions">
              <button type="button" class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.parentElement.handleConsentCancel()">
                <span data-i18n="action.cancel"></span>
              </button>
              <button type="button" class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.parentElement.handleConsentAccept()">
                <span data-i18n="gdpr.i_consent"></span>
              </button>
            </div>
          </div>
        </div>

        <div id="success-message" class="success-message hidden">
          <div class="success-icon">✓</div>
          <h2 class="success-title" data-i18n="message.success"></h2>
          <p class="success-text" data-i18n="questionnaire.submission_success"></p>
        </div>
      </div>
    `;

    this.questionnaireContent = this.shadowRoot.getElementById(
      'questionnaire-content',
    );
    this.consentModal = this.shadowRoot.getElementById('consent-modal');
    this.successMessage = this.shadowRoot.getElementById('success-message');
    this.languageSwitcher = this.shadowRoot.querySelector('.language-switcher');

    // Initialize child components
    this.initializeChildComponents();

    // Update language
    this.updateLanguage();
  }

  private initializeChildComponents() {
    if (!this.shadowRoot) return;

    // Initialize Progress Tracker
    const progressContainer =
      this.shadowRoot.getElementById('progress-tracker');
    if (progressContainer) {
      this.progressTracker = new ProgressTracker();
      progressContainer.appendChild(this.progressTracker);
    }

    // Initialize Save Status
    const saveStatusContainer = this.shadowRoot.getElementById('save-status');
    if (saveStatusContainer) {
      this.saveStatus = new SaveStatus();
      saveStatusContainer.appendChild(this.saveStatus);
    }
  }

  private setupEventListeners() {
    // This method will be called after the questionnaire data is loaded
  }

  private setupLanguageSwitcher() {
    // Language switching is handled by the onclick in the template
  }

  // Public method to load questionnaire data
  async loadQuestionnaire(config: QuestionnaireConfig) {
    this.config = config;

    // Update header
    const titleElement = this.shadowRoot?.getElementById('questionnaire-title');
    const instructionsElement = this.shadowRoot?.getElementById(
      'questionnaire-instructions',
    );

    if (titleElement) {
      titleElement.textContent = config.title[this.currentLanguage];
    }
    if (instructionsElement) {
      instructionsElement.textContent =
        config.instructions[this.currentLanguage];
    }

    // Show consent modal if required
    if (config.settings.require_consent && !this.consent) {
      this.showConsentModal();
    } else {
      this.renderQuestionnaire();
    }

    // Update progress tracker
    this.updateProgress();
  }

  private renderQuestionnaire() {
    if (!this.config || !this.questionnaireContent) return;

    this.questionnaireContent.innerHTML = '';

    this.config.questionGroups.forEach(group => {
      const groupElement = this.createQuestionGroupElement(group);
      this.questionnaireContent!.appendChild(groupElement);
    });

    this.setupQuestionEventListeners();
    this.autoSaveManager?.start();
  }

  private createQuestionGroupElement(group: QuestionGroup): HTMLElement {
    const groupElement = document.createElement('div');
    groupElement.className = 'question-group';
    groupElement.id = `group-${group.id}`;

    groupElement.innerHTML = `
      <h2 class="group-title">${group.title[this.currentLanguage]}</h2>
      ${group.description ? `<p class="group-description">${group.description[this.currentLanguage]}</p>` : ''}
      <div class="questions" id="questions-${group.id}"></div>
    `;

    // Render questions
    const questionsContainer = groupElement.querySelector(
      `#questions-${group.id}`,
    );
    if (questionsContainer) {
      group.questions.forEach(question => {
        const questionRenderer = new QuestionRenderer({
          question,
          language: this.currentLanguage,
          value: this.answers[question.id],
          onChange: this.handleAnswerChange.bind(this),
        });
        questionsContainer.appendChild(questionRenderer);
      });
    }

    return groupElement;
  }

  private setupQuestionEventListeners() {
    // Event listeners are handled by QuestionRenderer components
  }

  private handleAnswerChange(questionId: string, value: any) {
    this.answers[questionId] = value;
    this.updateProgress();

    // Trigger auto-save
    this.autoSaveManager?.triggerSave();
  }

  private updateProgress() {
    if (!this.config || !this.progressTracker) return;

    const totalQuestions = this.config.questionGroups.reduce(
      (total, group) => total + group.questions.length,
      0,
    );

    const answeredQuestions = this.config.questionGroups.reduce(
      (count, group) => {
        return (
          count +
          group.questions.filter(question => {
            const answer = this.answers[question.id];
            return answer !== undefined && answer !== null && answer !== '';
          }).length
        );
      },
      0,
    );

    this.progressTracker?.update(answeredQuestions, totalQuestions);
  }

  private showConsentModal() {
    this.consentModal?.classList.remove('hidden');
  }

  private hideConsentModal() {
    this.consentModal?.classList.add('hidden');
  }

  // Public method for language switching
  toggleLanguage() {
    this.currentLanguage = this.currentLanguage === 'pl' ? 'en' : 'pl';
    this.updateLanguage();
    this.saveCurrentData();
  }

  private updateLanguage() {
    // Update language switcher button
    const langText = this.shadowRoot?.querySelector('.lang-text');
    if (langText) {
      langText.textContent = this.currentLanguage === 'pl' ? 'EN' : 'PL';
    }

    // Update all i18n elements
    const i18nElements = this.shadowRoot?.querySelectorAll('[data-i18n]');
    i18nElements?.forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        const currentLangTranslations = translations[this.currentLanguage];
        if (currentLangTranslations && typeof currentLangTranslations === 'object' && key in currentLangTranslations) {
          element.textContent = currentLangTranslations[key as keyof typeof currentLangTranslations];
        }
      }
    });

    // Re-render questionnaire if loaded
    if (this.config) {
      const titleElement = this.shadowRoot?.getElementById(
        'questionnaire-title',
      );
      const instructionsElement = this.shadowRoot?.getElementById(
        'questionnaire-instructions',
      );

      if (titleElement) {
        titleElement.textContent = this.config.title[this.currentLanguage];
      }
      if (instructionsElement) {
        instructionsElement.textContent =
          this.config.instructions[this.currentLanguage];
      }

      // Update question groups
      this.renderQuestionnaire();
    }
  }

  // Consent handling
  handleConsentAccept() {
    const aiProcessing =
      (this.shadowRoot?.getElementById('ai-processing') as HTMLInputElement)
        ?.checked || false;
    const dataProcessing =
      (this.shadowRoot?.getElementById('data-processing') as HTMLInputElement)
        ?.checked || false;
    const anonymousSharing =
      (this.shadowRoot?.getElementById('anonymous-sharing') as HTMLInputElement)
        ?.checked || false;

    if (!dataProcessing) {
      alert(translations[this.currentLanguage]['gdpr.consent_required']);
      return;
    }

    this.consent = {
      ai_processing: aiProcessing,
      data_processing: dataProcessing,
      anonymous_sharing: anonymousSharing,
    };

    this.hideConsentModal();
    this.renderQuestionnaire();
    this.saveCurrentData();
  }

  handleConsentCancel() {
    // Could redirect back or show message
    alert(translations[this.currentLanguage]['gdpr.consent_required']);
  }

  // Auto-save handling
  private async handleAutoSave() {
    this.saveStatus?.setStatus('saving');

    try {
      await this.saveCurrentData();
      this.saveStatus?.setStatus('saved');
    } catch (error) {
      this.saveStatus?.setStatus('error');
      console.error('Auto-save failed:', error);
    }
  }

  private handleSaveError(error: Error) {
    this.saveStatus?.setStatus('error');
    console.error('Save error:', error);
  }

  private async saveCurrentData() {
    if (!this.offlineStorage || !this.config) return;

    const questionnaireId = this.config.id;
    const data = {
      answers: this.answers,
      consent: this.consent || undefined,
      language: this.currentLanguage,
      lastSaved: new Date().toISOString(),
    };

    await this.offlineStorage.saveQuestionnaireData(questionnaireId, data);
  }

  // Submit questionnaire
  async submitQuestionnaire() {
    if (!this.config || this.isSubmitting) return;

    // Validate required questions
    const missingRequired = this.validateRequiredQuestions();
    if (missingRequired.length > 0) {
      const currentLangTranslations = translations[this.currentLanguage];
      if (currentLangTranslations && typeof currentLangTranslations === 'object' && 'validation.required_fields' in currentLangTranslations) {
        alert(currentLangTranslations['validation.required_fields' as keyof typeof currentLangTranslations]);
      } else {
        alert('Please fill in all required fields');
      }
      return;
    }

    this.isSubmitting = true;

    try {
      // Save final data
      await this.saveCurrentData();

      // Show success message
      this.questionnaireContent?.classList.add('hidden');
      this.successMessage?.classList.remove('hidden');

      // Stop auto-save
      this.autoSaveManager?.stop();
    } catch (error) {
      console.error('Submit failed:', error);
      alert(translations[this.currentLanguage]['message.error']);
    } finally {
      this.isSubmitting = false;
    }
  }

  private validateRequiredQuestions(): string[] {
    if (!this.config) return [];

    const missing: string[] = [];

    this.config.questionGroups.forEach(group => {
      group.questions.forEach(question => {
        if (question.validation?.required) {
          const answer = this.answers[question.id];
          if (!answer || answer === '') {
            missing.push(question.id);
          }
        }
      });
    });

    return missing;
  }

  private cleanup() {
    this.autoSaveManager?.stop();
  }

  // Static method for element definition
  static get tagName() {
    return 'single-page-questionnaire';
  }
}

// Register the custom element
if (!customElements.get(SinglePageQuestionnaire.tagName)) {
  customElements.define(
    SinglePageQuestionnaire.tagName,
    SinglePageQuestionnaire,
  );
}
