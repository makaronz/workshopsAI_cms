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
import '@/components/workshop/WorkshopForm';
import '@/components/workshop/SessionManager';
import '@/components/workshop/WorkshopPreview';

/**
 * Workshop Editor - Main component for creating and editing workshops
 * Features:
 * - Step-based editing interface
 * - Auto-save functionality
 * - Real-time preview
 * - Multi-language support
 * - Accessibility compliance (WCAG 2.2 AA)
 */
@customElement('workshop-editor')
export class WorkshopEditor extends LitElement implements WorkshopEditorProps {
  static styles = css`
    :host {
      display: block;
      padding: var(--spacing-6);
      max-width: 1200px;
      margin: 0 auto;
      font-family: var(--font-family-sans);
    }

    .editor-container {
      display: grid;
      grid-template-columns: 1fr 320px;
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

    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-6);
      padding-bottom: var(--spacing-4);
      border-bottom: 1px solid var(--color-border);
    }

    .editor-title {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
      margin: 0;
    }

    .editor-subtitle {
      font-size: var(--font-size-base);
      color: var(--color-text-secondary);
      margin: var(--spacing-1) 0 0 0;
    }

    /* Step Navigation */
    .step-navigation {
      display: flex;
      gap: var(--spacing-2);
      margin-bottom: var(--spacing-6);
      padding: var(--spacing-1);
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
    }

    .step-nav-button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-3) var(--spacing-4);
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--color-text-secondary);
      text-decoration: none;
      min-width: 120px;
    }

    .step-nav-button:hover:not(:disabled) {
      background: var(--color-surface-hover);
      color: var(--color-text-primary);
    }

    .step-nav-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .step-nav-button.active {
      background: var(--color-primary-100);
      color: var(--color-primary-700);
      font-weight: var(--font-weight-medium);
    }

    .step-nav-button.completed {
      color: var(--color-success-600);
    }

    .step-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      border: 2px solid var(--color-border);
      background: var(--color-surface);
    }

    .step-nav-button.active .step-number {
      background: var(--color-primary-600);
      color: white;
      border-color: var(--color-primary-600);
    }

    .step-nav-button.completed .step-number {
      background: var(--color-success-600);
      color: white;
      border-color: var(--color-success-600);
    }

    .step-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      text-align: center;
    }

    /* Progress Indicator */
    .progress-section {
      background: white;
      border-radius: var(--radius-lg);
      padding: var(--spacing-4);
      border: 1px solid var(--color-border);
      margin-bottom: var(--spacing-4);
    }

    .progress-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-3) 0;
    }

    .progress-bar {
      height: 8px;
      background: var(--color-border);
      border-radius: var(--radius-full);
      overflow: hidden;
      margin-bottom: var(--spacing-2);
    }

    .progress-fill {
      height: 100%;
      background: var(--color-primary-600);
      transition: width 0.3s ease;
      border-radius: var(--radius-full);
    }

    .progress-text {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Auto-save Status */
    .autosave-status {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      transition: all 0.2s ease;
    }

    .autosave-status.idle {
      background: var(--color-gray-100);
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

    .autosave-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .autosave-status.saved .autosave-icon,
    .autosave-status.error .autosave-icon {
      animation: none;
    }

    /* Actions */
    .actions {
      display: flex;
      gap: var(--spacing-3);
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-4) 0;
      border-top: 1px solid var(--color-border);
    }

    .actions-left,
    .actions-right {
      display: flex;
      gap: var(--spacing-3);
      align-items: center;
    }

    /* Floating Actions */
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

    /* Form Sections */
    .form-section {
      background: white;
      border-radius: var(--radius-lg);
      padding: var(--spacing-6);
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-sm);
    }

    .section-header {
      margin-bottom: var(--spacing-4);
    }

    .section-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-1) 0;
    }

    .section-description {
      font-size: var(--font-size-base);
      color: var(--color-text-secondary);
      margin: 0;
    }

    /* Loading State */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
    }

    /* Error State */
    .error-state {
      text-align: center;
      padding: var(--spacing-8);
      color: var(--color-error-600);
    }

    .error-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      margin: 0 0 var(--spacing-2) 0;
    }

    .error-message {
      margin: 0 0 var(--spacing-4) 0;
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

    /* Responsive Design */
    @media (max-width: 1024px) {
      .editor-container {
        grid-template-columns: 1fr;
      }

      .sidebar {
        position: static;
        order: -1;
      }

      .step-navigation {
        flex-wrap: wrap;
      }

      .step-nav-button {
        min-width: 100px;
        padding: var(--spacing-2) var(--spacing-3);
      }
    }

    @media (max-width: 640px) {
      :host {
        padding: var(--spacing-4);
      }

      .editor-header {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--spacing-2);
      }

      .actions {
        flex-direction: column;
        gap: var(--spacing-3);
      }

      .actions-left,
      .actions-right {
        width: 100%;
        justify-content: center;
      }

      .floating-actions {
        bottom: var(--spacing-4);
        right: var(--spacing-4);
      }
    }

    /* High Contrast Mode */
    @media (prefers-contrast: high) {
      .form-section {
        border-width: 2px;
      }

      .step-nav-button {
        border: 2px solid var(--color-border);
      }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .progress-fill,
      .autosave-status,
      .autosave-icon {
        transition: none;
        animation: none;
      }
    }
  `;

  // Properties
  @property({ type: String })
  workshopId?: string;

  @property({ type: Boolean })
  readonly: boolean = false;

  // State
  @state()
  private currentStep = 1;

  @state()
  private workshop?: Workshop;

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
  private isLoading = false;

  @state()
  private isDirty = false;

  @state()
  private isValid = false;

  @state()
  private errors: ValidationErrors = {};

  @state()
  private autoSaveStatus: AutoSaveStatus = { status: 'idle' };

  @state()
  private showPreview = false;

  @state()
  private publishingChecklist?: PublishingChecklist;

  @state()
  private loadError?: Error;

  // Auto-save timer
  private autosaveTimer?: number;

  // Callbacks
  @property({ type: Function })
  onSave?: (workshop: Workshop) => void;

  @property({ type: Function })
  onPublish?: (workshop: Workshop) => void;

  @property({ type: Function })
  onCancel?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.loadWorkshop();
    this.startAutosave();
    this.setupKeyboardNavigation();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAutosave();
    this.removeKeyboardNavigation();
  }

  private setupKeyboardNavigation() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private removeKeyboardNavigation() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.saveWorkshop();
    }

    // Ctrl/Cmd + P to preview
    if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
      event.preventDefault();
      this.togglePreview();
    }

    // Escape to close preview
    if (event.key === 'Escape' && this.showPreview) {
      this.togglePreview();
    }

    // Alt + arrow keys for step navigation
    if (event.altKey) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.nextStep();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.previousStep();
      }
    }
  };

  private async loadWorkshop() {
    if (!this.workshopId) return;

    this.isLoading = true;
    this.loadError = undefined;

    try {
      const workshop = await workshopService.getWorkshop(this.workshopId);
      this.workshop = workshop;
      this.formData = { ...this.formData, ...workshop };
      this.sessions = workshop.sessions || [];
      this.validateCurrentStep();
      this.isDirty = false;
    } catch (error) {
      console.error('Failed to load workshop:', error);
      this.loadError = error as Error;
    } finally {
      this.isLoading = false;
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
    if (this.isDirty && this.isValid && !this.isLoading) {
      this.autoSaveStatus = { status: 'saving' };

      try {
        await this.saveWorkshop(true);
        this.autoSaveStatus = {
          status: 'saved',
          lastSaved: new Date()
        };

        setTimeout(() => {
          if (this.autoSaveStatus.status === 'saved') {
            this.autoSaveStatus = { status: 'idle' };
          }
        }, 3000);
      } catch (error) {
        console.error('Autosave failed:', error);
        this.autoSaveStatus = {
          status: 'error',
          error: (error as Error).message
        };

        setTimeout(() => {
          if (this.autoSaveStatus.status === 'error') {
            this.autoSaveStatus = { status: 'idle' };
          }
        }, 5000);
      }
    }
  }

  private async saveWorkshop(isAutosave = false): Promise<Workshop> {
    if (this.isLoading || this.readonly) {
      throw new Error('Cannot save in current state');
    }

    if (!this.validateCurrentStep()) {
      throw new Error('Validation failed');
    }

    const workshopData = {
      ...this.formData,
      sessions: this.sessions,
      modules: this.modules
    } as WorkshopFormData;

    try {
      let savedWorkshop: Workshop;

      if (this.workshopId && this.workshop) {
        savedWorkshop = await workshopService.updateWorkshop(this.workshopId, workshopData);
      } else {
        savedWorkshop = await workshopService.createWorkshop(workshopData);
        this.workshopId = savedWorkshop.id;
        Router.go(`/workshops/${this.workshopId}/edit`);
      }

      this.workshop = savedWorkshop;
      this.isDirty = false;

      if (!isAutosave) {
        this.onSave?.(savedWorkshop);
        this.showNotification('workshop.saved', 'success');
      }

      return savedWorkshop;
    } catch (error) {
      console.error('Save failed:', error);
      if (!isAutosave) {
        this.showNotification('workshop.save_error', 'error');
      }
      throw error;
    }
  }

  private validateCurrentStep(): boolean {
    this.errors = {};

    switch (this.currentStep) {
      case 1: // Metadata
        if (!this.formData.slug) {
          this.errors.slug = 'workshop.validation.required';
        } else if (!/^[a-z0-9-]+$/.test(this.formData.slug)) {
          this.errors.slug = 'workshop.validation.slug_format';
        }

        if (!this.formData.titleI18n?.pl || !this.formData.titleI18n?.en) {
          this.errors.title = 'workshop.validation.required';
        }

        if (!this.formData.descriptionI18n?.pl || !this.formData.descriptionI18n?.en) {
          this.errors.description = 'workshop.validation.required';
        }
        break;

      case 2: // Sessions
        if (this.sessions.length === 0) {
          this.errors.sessions = 'workshop.at_least_one_session';
        }

        // Validate session dates and order
        for (const session of this.sessions) {
          if (new Date(session.startTime) >= new Date(session.endTime)) {
            this.errors[`session_${session.id}_time`] = 'workshop.session.invalid_time';
          }
        }
        break;

      case 3: // Modules
        const hasRequiredModules = this.sessions.some(session =>
          session.modules && session.modules.length > 0
        );

        if (!hasRequiredModules) {
          this.errors.modules = 'workshop.at_least_one_module';
        }
        break;
    }

    this.isValid = Object.keys(this.errors).length === 0;
    return this.isValid;
  }

  private nextStep() {
    if (this.validateCurrentStep()) {
      this.currentStep = Math.min(this.currentStep + 1, 4);
    }
  }

  private previousStep() {
    this.currentStep = Math.max(this.currentStep - 1, 1);
  }

  private goToStep(step: number) {
    if (step <= this.currentStep || this.validateCurrentStep()) {
      this.currentStep = step;
    }
  }

  private handleFormDataChange(data: Partial<WorkshopFormData>) {
    this.formData = { ...this.formData, ...data };
    this.isDirty = true;
    this.validateCurrentStep();
  }

  private handleSessionsChange(sessions: WorkshopSession[]) {
    this.sessions = sessions;
    this.isDirty = true;
    this.validateCurrentStep();
  }

  private handleModulesChange(modules: WorkshopModule[]) {
    this.modules = modules;
    this.isDirty = true;
    this.validateCurrentStep();
  }

  private togglePreview() {
    this.showPreview = !this.showPreview;
  }

  private async handlePublish() {
    if (!this.workshopId) return;

    try {
      this.publishingChecklist = await workshopService.getPublishingChecklist(this.workshopId);

      if (this.publishingChecklist.canPublish) {
        await this.confirmPublish();
      } else {
        // Show checklist modal
        this.shadowRoot?.querySelector('ui-modal')?.show();
      }
    } catch (error) {
      console.error('Failed to get publishing checklist:', error);
      this.showNotification('workshop.publish_checklist_error', 'error');
    }
  }

  private async confirmPublish() {
    if (!this.workshopId || !this.workshop) return;

    try {
      // First save any pending changes
      await this.saveWorkshop();

      // Then publish
      const publishedWorkshop = await workshopService.publishWorkshop(this.workshopId);
      this.workshop = publishedWorkshop;

      this.onPublish?.(publishedWorkshop);
      this.showNotification('workshop.published', 'success');
      Router.go(`/workshops/${this.workshopId}`);
    } catch (error) {
      console.error('Publish failed:', error);
      this.showNotification('workshop.publish_error', 'error');
    }
  }

  private showNotification(message: string, type: 'success' | 'error') {
    // Create and show notification component
    const notification = document.createElement('ui-notification');
    notification.type = type;
    notification.message = i18n.t(message);
    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  private getStepCompletionStatus() {
    const steps = [
      this.workshop && this.workshop.title && this.workshop.description,
      this.sessions.length > 0,
      this.modules.length > 0 || this.sessions.some(s => s.modules && s.modules.length > 0),
      this.publishingChecklist?.isComplete || false
    ];
    return steps;
  }

  private renderStepNavigation(): TemplateResult {
    const steps = [
      { number: 1, title: i18n.t('workshop.steps.metadata'), key: 'metadata' },
      { number: 2, title: i18n.t('workshop.steps.sessions'), key: 'sessions' },
      { number: 3, title: i18n.t('workshop.steps.modules'), key: 'modules' },
      { number: 4, title: i18n.t('workshop.steps.review'), key: 'review' }
    ];

    const completionStatus = this.getStepCompletionStatus();

    return html`
      <nav class="step-navigation" role="tablist" aria-label="${i18n.t('workshop.step_navigation')}">
        ${steps.map((step, index) => {
          const isCompleted = step.number < this.currentStep || completionStatus[index];
          const isActive = step.number === this.currentStep;

          return html`
            <button
              class=${classMap({
                'step-nav-button': true,
                'active': isActive,
                'completed': isCompleted
              })}
              role="tab"
              aria-selected=${isActive ? 'true' : 'false'}
              aria-controls=${`step-${step.number}`}
              aria-disabled=${step.number > this.currentStep ? 'true' : 'false'}
              @click=${() => this.goToStep(step.number)}
              ?disabled=${this.readonly}
            >
              <div class="step-number">
                ${isCompleted ? '✓' : step.number}
              </div>
              <div class="step-label">${step.title}</div>
            </button>
          `;
        })}
      </nav>
    `;
  }

  private renderProgressSection(): TemplateResult {
    const progress = (this.currentStep / 4) * 100;
    const completionStatus = this.getStepCompletionStatus();
    const completedSteps = completionStatus.filter(Boolean).length;

    return html`
      <div class="progress-section">
        <h2 class="progress-title">${i18n.t('workshop.progress.title')}</h2>
        <div class="progress-bar" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="progress-text">
          <span>${i18n.t('workshop.progress.step', { current: this.currentStep, total: 4 })}</span>
          <span>${completedSteps}/4 ${i18n.t('workshop.progress.completed')}</span>
        </div>
      </div>
    `;
  }

  private renderAutoSaveStatus(): TemplateResult {
    const { status, lastSaved, error } = this.autoSaveStatus;

    let statusText = '';
    let icon = '';

    switch (status) {
      case 'saving':
        statusText = i18n.t('workshop.autosave.saving');
        icon = '⏳';
        break;
      case 'saved':
        statusText = i18n.t('workshop.autosave.saved', {
          time: lastSaved ? new Date(lastSaved).toLocaleTimeString() : ''
        });
        icon = '✓';
        break;
      case 'error':
        statusText = i18n.t('workshop.autosave.error') + (error ? `: ${error}` : '');
        icon = '⚠️';
        break;
      default:
        statusText = this.isDirty ? i18n.t('workshop.autosave.pending') : i18n.t('workshop.autosave.up_to_date');
        icon = this.isDirty ? '💾' : '';
    }

    return html`
      <div class="autosave-status ${status}" aria-live="polite">
        ${icon ? html`<span class="autosave-icon" aria-hidden="true">${icon}</span>` : ''}
        <span>${statusText}</span>
      </div>
    `;
  }

  private renderStepContent(): TemplateResult {
    switch (this.currentStep) {
      case 1:
        return html`
          <div class="form-section" id="step-1" role="tabpanel">
            <div class="section-header">
              <h2 class="section-title">${i18n.t('workshop.steps.metadata')}</h2>
              <p class="section-description">${i18n.t('workshop.metadata.description')}</p>
            </div>
            <workshop-form
              .formData=${this.formData}
              .errors=${this.errors}
              .readonly=${this.readonly}
              @change=${(e: CustomEvent) => this.handleFormDataChange(e.detail)}
            ></workshop-form>
          </div>
        `;

      case 2:
        return html`
          <div class="form-section" id="step-2" role="tabpanel">
            <div class="section-header">
              <h2 class="section-title">${i18n.t('workshop.steps.sessions')}</h2>
              <p class="section-description">${i18n.t('workshop.sessions.description')}</p>
            </div>
            <session-manager
              .workshopId=${this.workshopId}
              .sessions=${this.sessions}
              .readonly=${this.readonly}
              @sessions-changed=${(e: CustomEvent) => this.handleSessionsChange(e.detail.sessions)}
            ></session-manager>
          </div>
        `;

      case 3:
        return html`
          <div class="form-section" id="step-3" role="tabpanel">
            <div class="section-header">
              <h2 class="section-title">${i18n.t('workshop.steps.modules')}</h2>
              <p class="section-description">${i18n.t('workshop.modules.description')}</p>
            </div>
            <p>${i18n.t('workshop.modules.note')}</p>
          </div>
        `;

      case 4:
        return html`
          <div class="form-section" id="step-4" role="tabpanel">
            <div class="section-header">
              <h2 class="section-title">${i18n.t('workshop.steps.review')}</h2>
              <p class="section-description">${i18n.t('workshop.review.description')}</p>
            </div>
            <div class="review-content">
              ${this.publishingChecklist ? this.renderPublishingChecklist() : this.renderReviewSummary()}
            </div>
          </div>
        `;

      default:
        return nothing;
    }
  }

  private renderPublishingChecklist(): TemplateResult {
    if (!this.publishingChecklist) return nothing;

    return html`
      <div class="publishing-checklist">
        <h3>${i18n.t('workshop.publish_checklist.title')}</h3>
        <div class="checklist-items">
          ${this.publishingChecklist.items.map(item => html`
            <div class="checklist-item ${item.completed ? 'completed' : 'pending'}">
              <div class="checklist-indicator">
                ${item.completed ? '✓' : '○'}
              </div>
              <div class="checklist-content">
                <h4>${item.title}</h4>
                <p>${item.description}</p>
                ${item.required ? html`<span class="required-badge">${i18n.t('common.required')}</span>` : ''}
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderReviewSummary(): TemplateResult {
    return html`
      <div class="review-summary">
        <div class="summary-section">
          <h3>${i18n.t('workshop.review.summary')}</h3>
          <p>${i18n.t('workshop.review.session_count', { count: this.sessions.length })}</p>
          <p>${i18n.t('workshop.review.module_count', { count: this.modules.length })}</p>
        </div>
      </div>
    `;
  }

  private renderActions(): TemplateResult {
    if (this.readonly) {
      return html`
        <div class="actions">
          <div class="actions-right">
            <ui-button
              variant="outline"
              @click=${() => Router.go(`/workshops/${this.workshopId}`)}
            >
              ${i18n.t('action.close')}
            </ui-button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="actions">
        <div class="actions-left">
          ${this.currentStep > 1 ? html`
            <ui-button
              variant="secondary"
              @click=${() => this.previousStep()}
            >
              ← ${i18n.t('action.previous')}
            </ui-button>
          ` : ''}
        </div>

        <div class="actions-right">
          ${this.currentStep < 4 ? html`
            <ui-button
              variant="primary"
              @click=${() => this.nextStep()}
              ?disabled=${!this.isValid}
            >
              ${i18n.t('action.next')} →
            </ui-button>
          ` : ''}

          ${this.currentStep === 4 ? html`
            <ui-button
              variant="success"
              @click=${() => this.handlePublish()}
              ?disabled=${!this.isValid}
            >
              🚀 ${i18n.t('action.publish')}
            </ui-button>
          ` : ''}

          <ui-button
            variant="outline"
            @click=${() => this.saveWorkshop()}
            ?disabled=${this.isLoading}
          >
            💾 ${this.isLoading ? i18n.t('action.saving') : i18n.t('action.save')}
          </ui-button>
        </div>
      </div>
    `;
  }

  private renderLoadingState(): TemplateResult {
    return html`
      <div class="loading-overlay" role="status" aria-label="${i18n.t('common.loading')}">
        <ui-loading size="large"></ui-loading>
        <p>${i18n.t('workshop.loading')}</p>
      </div>
    `;
  }

  private renderErrorState(): TemplateResult {
    return html`
      <div class="error-state">
        <h2 class="error-title">${i18n.t('error.title')}</h2>
        <p class="error-message">${this.loadError?.message || i18n.t('error.unknown')}</p>
        <ui-button
          variant="primary"
          @click=${() => this.loadWorkshop()}
        >
          ${i18n.t('action.retry')}
        </ui-button>
      </div>
    `;
  }

  render(): TemplateResult {
    if (this.isLoading && !this.workshop) {
      return this.renderLoadingState();
    }

    if (this.loadError) {
      return this.renderErrorState();
    }

    return html`
      <div class="editor-container">
        <div class="main-content">
          <header class="editor-header">
            <div>
              <h1 class="editor-title">
                ${this.workshop ?
                  i18n.t('workshop.edit_title', { title: this.workshop.titleI18n[i18n.getCurrentLanguage()] }) :
                  i18n.t('workshop.create_title')
                }
              </h1>
              <p class="editor-subtitle">${i18n.t('workshop.editor_description')}</p>
            </div>
          </header>

          ${this.renderStepNavigation()}
          ${this.renderStepContent()}
          ${this.renderActions()}
        </div>

        <aside class="sidebar">
          ${this.renderProgressSection()}
          ${this.renderAutoSaveStatus()}
        </aside>
      </div>

      <div class="preview-toggle">
        <ui-button
          variant="outline"
          size="small"
          @click=${() => this.togglePreview()}
          aria-label=${this.showPreview ? i18n.t('action.hide_preview') : i18n.t('action.show_preview')}
        >
          👁️ ${this.showPreview ? i18n.t('action.hide_preview') : i18n.t('action.show_preview')}
        </ui-button>
      </div>

      <div class="floating-actions">
        <ui-button
          variant="outline"
          size="small"
          @click=${() => this.autosave()}
          ?disabled=${this.autoSaveStatus.status === 'saving'}
          aria-label=${i18n.t('workshop.save_now')}
        >
          💾 ${i18n.t('workshop.save_now')}
        </ui-button>
      </div>

      ${this.showPreview && this.workshop ? html`
        <workshop-preview
          .workshop=${{ ...this.workshop, ...this.formData }}
          .sessions=${this.sessions}
          .modules=${this.modules}
          @close=${() => this.togglePreview()}
        ></workshop-preview>
      ` : ''}

      <ui-modal id="publish-modal">
        ${this.publishingChecklist ? this.renderPublishingChecklist() : ''}
        <div class="modal-actions">
          <ui-button variant="outline" @click=${() => this.shadowRoot?.querySelector('ui-modal')?.hide()}>
            ${i18n.t('action.cancel')}
          </ui-button>
          <ui-button
            variant="primary"
            @click=${() => this.confirmPublish()}
            ?disabled=${!this.publishingChecklist.canPublish}
          >
            ${i18n.t('action.publish_anyway')}
          </ui-button>
        </div>
      </ui-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workshop-editor': WorkshopEditor;
  }
}