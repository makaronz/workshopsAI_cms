import { LitElement, html, css, nothing, TemplateResult } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { Router } from '@vaadin/router';
import { i18n } from '@/services/i18n';
import { AuthService } from '@/services/auth';
import { workshopService } from '@/services/workshop';
import type {
  Workshop,
  WorkshopSession,
  WorkshopModule,
  WorkshopFormData,
  PublishingChecklist,
  ValidationErrors,
  AutoSaveStatus,
  WorkshopEditorProps
} from '@/types/workshop';
import '@/components/ui/button';
import '@/components/ui/input';
import '@/components/ui/textarea';
import '@/components/ui/select';
import '@/components/ui/modal';
import '@/components/ui/loading';
import '@/components/ui/notification';


@customElement('workshop-editor')
export class WorkshopEditor extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--spacing-6);
      max-width: 1200px;
      margin: 0 auto;
    }

    .editor-container {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: var(--spacing-8);
      margin-top: var(--spacing-6);
    }

    .main-content {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-6);
    }

    .sidebar {
      position: sticky;
      top: var(--spacing-4);
      height: fit-content;
    }

    .progress-indicator {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
      padding: var(--spacing-4);
      background: var(--color-primary-50);
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-6);
    }

    .progress-bar {
      flex: 1;
      height: 8px;
      background: var(--color-primary-200);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--color-primary-600);
      transition: width 0.3s ease;
    }

    .step-indicator {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      font-weight: 500;
    }

    .step-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--color-primary-600);
      color: white;
      border-radius: var(--radius-full);
      font-weight: 600;
    }

    .step-number.active {
      background: var(--color-primary-700);
      box-shadow: 0 0 0 4px var(--color-primary-100);
    }

    .step-number.completed {
      background: var(--color-green-600);
    }

    .form-section {
      background: white;
      border-radius: var(--radius-lg);
      padding: var(--spacing-6);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--color-gray-200);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: between;
      margin-bottom: var(--spacing-4);
    }

    .section-title {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--color-gray-900);
    }

    .section-description {
      color: var(--color-gray-600);
      margin-top: var(--spacing-1);
    }

    .bilingual-inputs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-4);
    }

    .language-label {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      font-weight: 500;
      margin-bottom: var(--spacing-2);
    }

    .language-flag {
      font-size: var(--font-size-lg);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-4);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
    }

    .form-group.full-width {
      grid-column: 1 / -1;
    }

    label {
      font-weight: 500;
      color: var(--color-gray-700);
    }

    .required {
      color: var(--color-red-600);
    }

    input, textarea, select {
      padding: var(--spacing-3);
      border: 1px solid var(--color-gray-300);
      border-radius: var(--radius-md);
      font-size: var(--font-size-base);
      transition: all 0.2s ease;
    }

    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px var(--color-primary-100);
    }

    .error {
      border-color: var(--color-red-500) !important;
      box-shadow: 0 0 0 3px var(--color-red-100) !important;
    }

    .error-message {
      color: var(--color-red-600);
      font-size: var(--font-size-sm);
      margin-top: var(--spacing-1);
    }

    .actions {
      display: flex;
      gap: var(--spacing-4);
      justify-content: flex-end;
      margin-top: var(--spacing-6);
    }

    .autosave-status {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--color-gray-100);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      color: var(--color-gray-600);
    }

    .autosave-status.saving {
      background: var(--color-yellow-100);
      color: var(--color-yellow-700);
    }

    .autosave-status.saved {
      background: var(--color-green-100);
      color: var(--color-green-700);
    }

    .autosave-status.error {
      background: var(--color-red-100);
      color: var(--color-red-700);
    }

    .floating-actions {
      position: fixed;
      bottom: var(--spacing-6);
      right: var(--spacing-6);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
      z-index: 40;
    }

    .preview-toggle {
      position: fixed;
      top: var(--spacing-20);
      right: var(--spacing-6);
      z-index: 30;
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
      margin-top: var(--spacing-4);
    }

    .timeline-item {
      display: flex;
      gap: var(--spacing-4);
      position: relative;
    }

    .timeline-item::before {
      content: '';
      position: absolute;
      left: 20px;
      top: 40px;
      width: 2px;
      height: calc(100% + var(--spacing-4));
      background: var(--color-gray-200);
    }

    .timeline-item:last-child::before {
      display: none;
    }

    .timeline-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: var(--color-primary-100);
      border: 2px solid var(--color-primary-600);
      border-radius: var(--radius-full);
      font-weight: 600;
      color: var(--color-primary-700);
      flex-shrink: 0;
      z-index: 1;
    }

    .timeline-marker.completed {
      background: var(--color-green-600);
      border-color: var(--color-green-600);
      color: white;
    }

    .timeline-marker.active {
      background: var(--color-primary-600);
      color: white;
      box-shadow: 0 0 0 4px var(--color-primary-100);
    }

    .timeline-content {
      flex: 1;
      background: white;
      padding: var(--spacing-4);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-gray-200);
    }

    .timeline-title {
      font-weight: 600;
      margin-bottom: var(--spacing-1);
    }

    .timeline-description {
      color: var(--color-gray-600);
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-3);
    }

    .time-estimate {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      color: var(--color-gray-500);
      font-size: var(--font-size-sm);
    }

    @media (max-width: 1024px) {
      .editor-container {
        grid-template-columns: 1fr;
      }

      .sidebar {
        position: static;
        order: -1;
      }

      .bilingual-inputs {
        grid-template-columns: 1fr;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      :host {
        padding: var(--spacing-4);
      }

      .floating-actions {
        bottom: var(--spacing-4);
        right: var(--spacing-4);
      }
    }
  `;

  @property({ type: String })
  workshopId?: string;

  @state()
  private currentStep = 1;

  @state()
  private formData: Partial<WorkshopFormData> = {
    language: 'pl',
    titleI18n: { pl: '', en: '' },
    subtitleI18n: { pl: '', en: '' },
    descriptionI18n: { pl: '', en: '' },
    shortDescriptionI18n: { pl: '', en: '' },
    requirementsI18n: { pl: [], en: [] },
    objectivesI18n: { pl: [], en: [] },
    materials: [],
    enableWaitingList: true,
    currency: 'PLN',
    templateTheme: 'custom'
  };

  @state()
  private sessions: WorkshopSession[] = [];

  @state()
  private modules: WorkshopModule[] = [];

  @state()
  private isSaving = false;

  @state()
  private lastSaved?: Date;

  @state()
  private saveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';

  @state()
  private errors: Record<string, string> = {};

  @state()
  private showPreview = false;

  @state()
  private publishingChecklist: any = null;

  @state()
  private isValid = false;

  private autosaveTimer?: number;
  private workshopService = new WorkshopService();

  connectedCallback() {
    super.connectedCallback();
    this.loadWorkshop();
    this.startAutosave();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAutosave();
  }

  private async loadWorkshop() {
    if (!this.workshopId) return;

    try {
      const workshop = await this.workshopService.getWorkshop(this.workshopId);
      if (workshop) {
        this.formData = { ...this.formData, ...workshop };
        this.sessions = workshop.sessions || [];
        this.modules = workshop.modules || [];
      }
    } catch (error) {
      console.error('Failed to load workshop:', error);
      this.showError('workshop.load_error');
    }
  }

  private startAutosave() {
    this.autosaveTimer = window.setInterval(() => {
      this.autosave();
    }, 30000); // 30 seconds
  }

  private stopAutosave() {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
    }
  }

  private async autosave() {
    if (this.isSaving || !this.isValid) return;

    this.saveStatus = 'saving';
    try {
      await this.saveWorkshop(true);
      this.saveStatus = 'saved';
      this.lastSaved = new Date();
      setTimeout(() => {
        this.saveStatus = 'idle';
      }, 2000);
    } catch (error) {
      this.saveStatus = 'error';
      console.error('Autosave failed:', error);
    }
  }

  private async saveWorkshop(isAutosave = false) {
    if (this.isSaving) return;

    this.isSaving = true;
    try {
      if (!this.validateStep()) {
        this.isSaving = false;
        return;
      }

      const workshopData = {
        ...this.formData,
        sessions: this.sessions,
        modules: this.modules,
        status: 'draft'
      };

      let savedWorkshop: Workshop;
      if (this.workshopId) {
        savedWorkshop = await this.workshopService.updateWorkshop(this.workshopId, workshopData);
      } else {
        savedWorkshop = await this.workshopService.createWorkshop(workshopData);
        this.workshopId = savedWorkshop.id;
        Router.go(`/workshops/${this.workshopId}/edit`);
      }

      if (!isAutosave) {
        this.showSuccess('workshop.saved');
      }
    } catch (error) {
      console.error('Save failed:', error);
      this.showError('workshop.save_error');
    } finally {
      this.isSaving = false;
    }
  }

  private validateStep(): boolean {
    this.errors = {};

    switch (this.currentStep) {
      case 1: // Metadata
        if (!this.formData.slug) {
          this.errors.slug = 'validation.required';
        }
        if (!this.formData.titleI18n?.pl || !this.formData.titleI18n?.en) {
          this.errors.title = 'validation.required';
        }
        if (!this.formData.descriptionI18n?.pl || !this.formData.descriptionI18n?.en) {
          this.errors.description = 'validation.required';
        }
        break;
      case 2: // Sessions
        if (this.sessions.length === 0) {
          this.errors.sessions = 'workshop.at_least_one_session';
        }
        break;
      case 3: // Modules
        if (this.modules.length === 0) {
          this.errors.modules = 'workshop.at_least_one_module';
        }
        break;
    }

    this.isValid = Object.keys(this.errors).length === 0;
    return this.isValid;
  }

  private nextStep() {
    if (this.validateStep()) {
      this.currentStep = Math.min(this.currentStep + 1, 4);
    }
  }

  private previousStep() {
    this.currentStep = Math.max(this.currentStep - 1, 1);
  }

  private goToStep(step: number) {
    if (step <= this.currentStep || this.validateStep()) {
      this.currentStep = step;
    }
  }

  private handleFieldChange(field: string, value: any, language?: string) {
    if (language && field.includes('I18n')) {
      this.formData = {
        ...this.formData,
        [field]: {
          ...this.formData[field as keyof WorkshopFormData],
          [language]: value
        }
      };
    } else {
      this.formData = {
        ...this.formData,
        [field]: value
      };
    }

    // Clear error when user starts typing
    if (this.errors[field]) {
      const newErrors = { ...this.errors };
      delete newErrors[field];
      this.errors = newErrors;
    }
  }

  private handleSessionsChange(sessions: WorkshopSession[]) {
    this.sessions = sessions;
    if (this.errors.sessions) {
      const newErrors = { ...this.errors };
      delete newErrors.sessions;
      this.errors = newErrors;
    }
  }

  private handleModulesChange(modules: WorkshopModule[]) {
    this.modules = modules;
    if (this.errors.modules) {
      const newErrors = { ...this.errors };
      delete newErrors.modules;
      this.errors = newErrors;
    }
  }

  private async handlePublish() {
    if (!this.workshopId) return;

    try {
      this.publishingChecklist = await this.workshopService.getPublishingChecklist(this.workshopId);

      // Show publishing modal
      this.shadowRoot?.querySelector('app-modal')?.show();
    } catch (error) {
      console.error('Failed to get publishing checklist:', error);
      this.showError('workshop.publish_checklist_error');
    }
  }

  private async confirmPublish() {
    if (!this.workshopId) return;

    try {
      await this.workshopService.publishWorkshop(this.workshopId);
      this.showSuccess('workshop.published');
      Router.go(`/workshops/${this.workshopId}`);
    } catch (error) {
      console.error('Publish failed:', error);
      this.showError('workshop.publish_error');
    }
  }

  private showSuccess(message: string) {
    // Show success notification
    const notification = document.createElement('ui-notification');
    notification.type = 'success';
    notification.message = i18n.t(message);
    document.body.appendChild(notification);
  }

  private showError(message: string) {
    // Show error notification
    const notification = document.createElement('ui-notification');
    notification.type = 'error';
    notification.message = i18n.t(message);
    document.body.appendChild(notification);
  }

  private renderStepIndicator() {
    const steps = [
      { number: 1, title: i18n.t('workshop.steps.metadata'), time: '10min' },
      { number: 2, title: i18n.t('workshop.steps.sessions'), time: '15min' },
      { number: 3, title: i18n.t('workshop.steps.modules'), time: '10min' },
      { number: 4, title: i18n.t('workshop.steps.review'), time: '10min' }
    ];

    return html`
      <div class="timeline">
        ${steps.map(step => html`
          <div class="timeline-item">
            <div class="timeline-marker ${step.number === this.currentStep ? 'active' : step.number < this.currentStep ? 'completed' : ''}">
              ${step.number < this.currentStep ? '✓' : step.number}
            </div>
            <div class="timeline-content">
              <div class="timeline-title">${step.title}</div>
              <div class="timeline-description">
                ${i18n.t(`workshop.step_descriptions.${step.number}`)}
              </div>
              <div class="time-estimate">
                ⏱️ ${step.time}
              </div>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderStepContent() {
    switch (this.currentStep) {
      case 1:
        return this.renderMetadataStep();
      case 2:
        return this.renderSessionsStep();
      case 3:
        return this.renderModulesStep();
      case 4:
        return this.renderReviewStep();
      default:
        return nothing;
    }
  }

  private renderMetadataStep() {
    return html`
      <div class="form-section">
        <div class="section-header">
          <h2 class="section-title">${i18n.t('workshop.metadata.title')}</h2>
          <p class="section-description">${i18n.t('workshop.metadata.description')}</p>
        </div>

        <div class="form-group full-width">
          <label>
            ${i18n.t('workshop.slug')} <span class="required">*</span>
          </label>
          <input
            type="text"
            value="${this.formData.slug || ''}"
            @input=${(e: any) => this.handleFieldChange('slug', e.target.value)}
            class="${this.errors.slug ? 'error' : ''}"
            placeholder="${i18n.t('workshop.slug_placeholder')}"
          />
          ${this.errors.slug ? html`<div class="error-message">${i18n.t(this.errors.slug)}</div>` : ''}
        </div>

        <div class="bilingual-inputs">
          <div class="form-group">
            <div class="language-label">
              <span class="language-flag">🇵🇱</span>
              <span>${i18n.t('workshop.title')} (PL) <span class="required">*</span></span>
            </div>
            <input
              type="text"
              value="${this.formData.titleI18n?.pl || ''}"
              @input=${(e: any) => this.handleFieldChange('titleI18n', e.target.value, 'pl')}
              class="${this.errors.title ? 'error' : ''}"
              placeholder="${i18n.t('workshop.title_placeholder')}"
            />
          </div>

          <div class="form-group">
            <div class="language-label">
              <span class="language-flag">🇬🇧</span>
              <span>${i18n.t('workshop.title')} (EN) <span class="required">*</span></span>
            </div>
            <input
              type="text"
              value="${this.formData.titleI18n?.en || ''}"
              @input=${(e: any) => this.handleFieldChange('titleI18n', e.target.value, 'en')}
              class="${this.errors.title ? 'error' : ''}"
              placeholder="${i18n.t('workshop.title_placeholder')}"
            />
          </div>
        </div>

        <div class="bilingual-inputs">
          <div class="form-group">
            <div class="language-label">
              <span class="language-flag">🇵🇱</span>
              <span>${i18n.t('workshop.description')} (PL) <span class="required">*</span></span>
            </div>
            <textarea
              rows="4"
              value="${this.formData.descriptionI18n?.pl || ''}"
              @input=${(e: any) => this.handleFieldChange('descriptionI18n', e.target.value, 'pl')}
              class="${this.errors.description ? 'error' : ''}"
              placeholder="${i18n.t('workshop.description_placeholder')}"
            ></textarea>
          </div>

          <div class="form-group">
            <div class="language-label">
              <span class="language-flag">🇬🇧</span>
              <span>${i18n.t('workshop.description')} (EN) <span class="required">*</span></span>
            </div>
            <textarea
              rows="4"
              value="${this.formData.descriptionI18n?.en || ''}"
              @input=${(e: any) => this.handleFieldChange('descriptionI18n', e.target.value, 'en')}
              class="${this.errors.description ? 'error' : ''}"
              placeholder="${i18n.t('workshop.description_placeholder')}"
            ></textarea>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>${i18n.t('workshop.start_date')}</label>
            <input
              type="datetime-local"
              value="${this.formData.startDate || ''}"
              @input=${(e: any) => this.handleFieldChange('startDate', e.target.value)}
            />
          </div>

          <div class="form-group">
            <label>${i18n.t('workshop.end_date')}</label>
            <input
              type="datetime-local"
              value="${this.formData.endDate || ''}"
              @input=${(e: any) => this.handleFieldChange('endDate', e.target.value)}
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>${i18n.t('workshop.seat_limit')}</label>
            <input
              type="number"
              min="1"
              value="${this.formData.seatLimit || ''}"
              @input=${(e: any) => this.handleFieldChange('seatLimit', parseInt(e.target.value) || undefined)}
            />
          </div>

          <div class="form-group">
            <label>${i18n.t('workshop.template_theme')}</label>
            <select
              value="${this.formData.templateTheme || 'custom'}"
              @change=${(e: any) => this.handleFieldChange('templateTheme', e.target.value)}
            >
              <option value="integracja">${i18n.t('workshop.themes.integracja')}</option>
              <option value="konflikty">${i18n.t('workshop.themes.konflikty')}</option>
              <option value="well-being">${i18n.t('workshop.themes.well_being')}</option>
              <option value="custom">${i18n.t('workshop.themes.custom')}</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>${i18n.t('workshop.price')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value="${this.formData.price || ''}"
              @input=${(e: any) => this.handleFieldChange('price', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div class="form-group">
            <label>${i18n.t('workshop.currency')}</label>
            <select
              value="${this.formData.currency || 'PLN'}"
              @change=${(e: any) => this.handleFieldChange('currency', e.target.value)}
            >
              <option value="PLN">PLN (zł)</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  private renderSessionsStep() {
    return html`
      <div class="form-section">
        <div class="section-header">
          <h2 class="section-title">${i18n.t('workshop.sessions.title')}</h2>
          <p class="section-description">${i18n.t('workshop.sessions.description')}</p>
        </div>

        <session-manager
          .sessions=${this.sessions}
          @sessions-changed=${(e: CustomEvent) => this.handleSessionsChange(e.detail.sessions)}
        ></session-manager>

        ${this.errors.sessions ? html`<div class="error-message">${i18n.t(this.errors.sessions)}</div>` : ''}
      </div>
    `;
  }

  private renderModulesStep() {
    return html`
      <div class="form-section">
        <div class="section-header">
          <h2 class="section-title">${i18n.t('workshop.modules.title')}</h2>
          <p class="section-description">${i18n.t('workshop.modules.description')}</p>
        </div>

        <module-builder
          .modules=${this.modules}
          @modules-changed=${(e: CustomEvent) => this.handleModulesChange(e.detail.modules)}
        ></module-builder>

        ${this.errors.modules ? html`<div class="error-message">${i18n.t(this.errors.modules)}</div>` : ''}
      </div>
    `;
  }

  private renderReviewStep() {
    return html`
      <div class="form-section">
        <div class="section-header">
          <h2 class="section-title">${i18n.t('workshop.review.title')}</h2>
          <p class="section-description">${i18n.t('workshop.review.description')}</p>
        </div>

        <publishing-checklist
          .workshopId=${this.workshopId}
          @publish-request=${() => this.handlePublish()}
        ></publishing-checklist>
      </div>
    `;
  }

  private renderSidebar() {
    return html`
      <div class="sidebar">
        <div class="form-section">
          <h3 class="section-title">${i18n.t('workshop.progress.title')}</h3>
          <div class="progress-indicator">
            <div class="step-indicator">
              <span class="step-number active">${this.currentStep}</span>
              <span>${i18n.t('workshop.progress.step', { current: this.currentStep, total: 4 })}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(this.currentStep / 4) * 100}%"></div>
            </div>
          </div>
        </div>

        <div class="autosave-status ${this.saveStatus}">
          ${this.saveStatus === 'saving' ? '💾' : this.saveStatus === 'saved' ? '✓' : '⚠️'}
          ${this.saveStatus === 'saving' ? i18n.t('workshop.autosave.saving') :
            this.saveStatus === 'saved' ? i18n.t('workshop.autosave.saved', { time: this.lastSaved }) :
            i18n.t('workshop.autosave.error')}
        </div>

        ${this.renderStepIndicator()}
      </div>
    `;
  }

  private renderActions() {
    return html`
      <div class="actions">
        ${this.currentStep > 1 ? html`
          <ui-button
            variant="outline"
            @click=${() => this.previousStep()}
          >
            ${i18n.t('action.previous')}
          </ui-button>
        ` : ''}

        ${this.currentStep < 4 ? html`
          <ui-button
            variant="primary"
            @click=${() => this.nextStep()}
          >
            ${i18n.t('action.next')}
          </ui-button>
        ` : ''}

        ${this.currentStep === 4 ? html`
          <ui-button
            variant="primary"
            @click=${() => this.handlePublish()}
          >
            ${i18n.t('action.publish')}
          </ui-button>
        ` : ''}

        <ui-button
          variant="outline"
          @click=${() => this.saveWorkshop()}
          ?disabled=${this.isSaving}
        >
          ${this.isSaving ? i18n.t('action.saving') : i18n.t('action.save')}
        </ui-button>
      </div>
    `;
  }

  render() {
    return html`
      <div class="editor-container">
        <div class="main-content">
          ${this.renderStepContent()}
          ${this.renderActions()}
        </div>

        ${this.renderSidebar()}
      </div>

      <div class="preview-toggle">
        <ui-button
          variant="outline"
          size="small"
          @click=${() => this.showPreview = !this.showPreview}
        >
          👁️ ${this.showPreview ? i18n.t('action.hide_preview') : i18n.t('action.show_preview')}
        </ui-button>
      </div>

      <div class="floating-actions">
        <ui-button
          variant="primary"
          size="small"
          @click=${() => this.autosave()}
        >
          💾 ${i18n.t('workshop.save_now')}
        </ui-button>
      </div>

      ${this.showPreview ? html`
        <preview-panel
          .workshopData=${{
            ...this.formData,
            sessions: this.sessions,
            modules: this.modules
          }}
          @close=${() => this.showPreview = false}
        ></preview-panel>
      ` : ''}

      <app-modal>
        <publishing-checklist
          .workshopId=${this.workshopId}
          .checklist=${this.publishingChecklist}
          @confirm-publish=${() => this.confirmPublish()}
        ></publishing-checklist>
      </app-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workshop-editor': WorkshopEditor;
  }
}