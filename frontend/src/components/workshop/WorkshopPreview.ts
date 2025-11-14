import { LitElement, html, css, TemplateResult, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { i18n } from '@/services/i18n';
import type { Workshop, WorkshopSession, WorkshopModule } from '@/types/workshop';
import '@/components/ui/button';
import '@/components/ui/card';
import '@/components/ui/badge';

/**
 * WorkshopPreview - Live preview of workshop for sociologists
 * Features:
 * - Real-time preview updates
 * - Mobile and desktop view modes
 * - Print-friendly layout
 * - Accessibility compliance
 * - Multi-language display
 */
@customElement('workshop-preview')
export class WorkshopPreview extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      overflow-y: auto;
      padding: var(--spacing-4);
    }

    .preview-container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      overflow: hidden;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-6);
      background: var(--color-gray-50);
      border-bottom: 1px solid var(--color-border);
    }

    .preview-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin: 0;
    }

    .preview-subtitle {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin: var(--spacing-1) 0 0 0;
    }

    .preview-actions {
      display: flex;
      gap: var(--spacing-2);
    }

    .preview-content {
      display: flex;
      flex-direction: column;
    }

    .view-modes {
      display: flex;
      gap: var(--spacing-2);
      padding: var(--spacing-4);
      background: var(--color-gray-50);
      border-bottom: 1px solid var(--color-border);
    }

    .view-mode {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-2) var(--spacing-3);
      background: white;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    .view-mode:hover {
      border-color: var(--color-primary-300);
      color: var(--color-primary-600);
    }

    .view-mode.active {
      background: var(--color-primary-600);
      color: white;
      border-color: var(--color-primary-600);
    }

    .language-selector {
      margin-left: auto;
      display: flex;
      gap: var(--spacing-1);
    }

    .language-option {
      padding: var(--spacing-1) var(--spacing-2);
      background: white;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: var(--font-size-xs);
      transition: all 0.2s ease;
    }

    .language-option:hover {
      border-color: var(--color-primary-300);
    }

    .language-option.active {
      background: var(--color-primary-600);
      color: white;
      border-color: var(--color-primary-600);
    }

    .preview-body {
      padding: var(--spacing-6);
    }

    /* Workshop Header */
    .workshop-header {
      text-align: center;
      margin-bottom: var(--spacing-8);
      padding-bottom: var(--spacing-6);
      border-bottom: 1px solid var(--color-border);
    }

    .workshop-title {
      font-size: var(--font-size-3xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-3) 0;
      line-height: 1.2;
    }

    .workshop-subtitle {
      font-size: var(--font-size-xl);
      color: var(--color-text-secondary);
      margin: 0 0 var(--spacing-4) 0;
      line-height: 1.4;
    }

    .workshop-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--spacing-4);
      margin-bottom: var(--spacing-4);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    .workshop-badges {
      display: flex;
      justify-content: center;
      gap: var(--spacing-2);
      flex-wrap: wrap;
    }

    /* Workshop Description */
    .workshop-description {
      margin-bottom: var(--spacing-8);
    }

    .section-title {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-4) 0;
      padding-bottom: var(--spacing-2);
      border-bottom: 2px solid var(--color-primary-600);
    }

    .description-text {
      font-size: var(--font-size-base);
      line-height: 1.7;
      color: var(--color-text-secondary);
      white-space: pre-wrap;
    }

    /* Workshop Requirements */
    .workshop-requirements {
      margin-bottom: var(--spacing-8);
    }

    .requirements-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .requirement-item {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-3);
      padding: var(--spacing-3);
      background: var(--color-gray-50);
      border-radius: var(--radius-md);
      border-left: 4px solid var(--color-primary-600);
    }

    .requirement-bullet {
      color: var(--color-primary-600);
      font-weight: var(--font-weight-bold);
      flex-shrink: 0;
      margin-top: 2px;
    }

    .requirement-text {
      flex: 1;
      line-height: 1.6;
    }

    /* Sessions Timeline */
    .sessions-timeline {
      margin-bottom: var(--spacing-8);
    }

    .timeline {
      position: relative;
      padding-left: var(--spacing-6);
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 16px;
      top: 24px;
      bottom: 0;
      width: 2px;
      background: var(--color-border);
    }

    .timeline-item {
      position: relative;
      margin-bottom: var(--spacing-6);
    }

    .timeline-marker {
      position: absolute;
      left: -28px;
      top: 8px;
      width: 32px;
      height: 32px;
      background: var(--color-primary-600);
      color: white;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: var(--font-weight-semibold);
      font-size: var(--font-size-sm);
      z-index: 1;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .timeline-content {
      background: white;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-5);
      box-shadow: var(--shadow-sm);
    }

    .session-header {
      margin-bottom: var(--spacing-3);
    }

    .session-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-2) 0;
    }

    .session-time {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    .session-duration {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--color-primary-100);
      color: var(--color-primary-700);
      border-radius: var(--radius-full);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
    }

    .session-description {
      margin: var(--spacing-3) 0;
      line-height: 1.6;
      color: var(--color-text-secondary);
    }

    .session-details {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-3);
      margin-top: var(--spacing-3);
    }

    .session-detail {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    /* Materials */
    .materials-section {
      margin-bottom: var(--spacing-8);
    }

    .materials-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: var(--spacing-4);
    }

    .material-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-4);
      background: white;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      transition: all 0.2s ease;
    }

    .material-card:hover {
      border-color: var(--color-primary-300);
      box-shadow: var(--shadow-md);
    }

    .material-icon {
      width: 40px;
      height: 40px;
      background: var(--color-primary-100);
      color: var(--color-primary-600);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-size-lg);
      flex-shrink: 0;
    }

    .material-info {
      flex: 1;
      min-width: 0;
    }

    .material-name {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-1) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .material-type {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      text-transform: uppercase;
    }

    /* Status Bar */
    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-4) var(--spacing-6);
      background: var(--color-gray-50);
      border-top: 1px solid var(--color-border);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--color-gray-200);
      color: var(--color-gray-700);
      border-radius: var(--radius-full);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
    }

    .status-badge.draft {
      background: var(--color-yellow-100);
      color: var(--color-yellow-700);
    }

    .status-badge.published {
      background: var(--color-green-100);
      color: var(--color-green-700);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      :host {
        padding: var(--spacing-2);
      }

      .preview-container {
        border-radius: var(--radius-md);
      }

      .preview-header {
        flex-direction: column;
        gap: var(--spacing-3);
        text-align: center;
      }

      .view-modes {
        flex-direction: column;
      }

      .language-selector {
        margin-left: 0;
        justify-content: center;
      }

      .workshop-meta {
        flex-direction: column;
        align-items: center;
      }

      .materials-grid {
        grid-template-columns: 1fr;
      }

      .session-time {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--spacing-1);
      }

      .status-bar {
        flex-direction: column;
        gap: var(--spacing-2);
      }
    }

    /* Print Styles */
    @media print {
      :host {
        position: static;
        background: white;
        padding: 0;
      }

      .preview-header,
      .view-modes,
      .status-bar {
        display: none;
      }

      .preview-container {
        box-shadow: none;
        border-radius: 0;
      }

      .timeline::before {
        left: 8px;
      }

      .timeline-marker {
        left: -20px;
        width: 16px;
        height: 16px;
        font-size: 10px;
      }
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

    /* High Contrast Mode */
    @media (prefers-contrast: high) {
      .preview-container {
        border: 2px solid var(--color-text-primary);
      }

      .timeline-content,
      .material-card {
        border-width: 2px;
      }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .preview-container {
        animation: none;
      }

      .view-mode,
      .language-option,
      .material-card {
        transition: none;
      }
    }
  `;

  @property({ type: Object })
  workshop: Partial<Workshop> = {};

  @property({ type: Array })
  sessions: WorkshopSession[] = [];

  @property({ type: Array })
  modules: WorkshopModule[] = [];

  @property({ type: Function })
  onClose?: () => void;

  @state()
  private viewMode: 'desktop' | 'mobile' = 'desktop';

  @state()
  private currentLanguage: 'pl' | 'en' = 'pl';

  @state()
  private isPrinting = false;

  connectedCallback() {
    super.connectedCallback();
    this.setupKeyboardNavigation();
    this.currentLanguage = i18n.getCurrentLanguage() as 'pl' | 'en';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeKeyboardNavigation();
  }

  private setupKeyboardNavigation() {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('beforeprint', this.handleBeforePrint);
    document.addEventListener('afterprint', this.handleAfterPrint);
  }

  private removeKeyboardNavigation() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('beforeprint', this.handleBeforePrint);
    document.removeEventListener('afterprint', this.handleAfterPrint);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.handleClose();
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
      event.preventDefault();
      this.handlePrint();
    }
  };

  private handleBeforePrint = () => {
    this.isPrinting = true;
    this.requestUpdate();
  };

  private handleAfterPrint = () => {
    this.isPrinting = false;
    this.requestUpdate();
  };

  private handleClose() {
    this.onClose?.();
  }

  private handlePrint() {
    window.print();
  }

  private handleLanguageChange(language: 'pl' | 'en') {
    this.currentLanguage = language;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(this.currentLanguage, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString(this.currentLanguage, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private getLocalizedText(i18nObject: Record<string, string> | undefined): string {
    if (!i18nObject) return '';
    return i18nObject[this.currentLanguage] || i18nObject[i18n.getCurrentLanguage()] || Object.values(i18nObject)[0] || '';
  }

  private getLocalizedArray(i18nArray: Record<string, string[]> | undefined): string[] {
    if (!i18nArray) return [];
    return i18nArray[this.currentLanguage] || i18nArray[i18n.getCurrentLanguage()] || Object.values(i18nArray)[0] || [];
  }

  private renderWorkshopHeader(): TemplateResult {
    const title = this.getLocalizedText(this.workshop.titleI18n);
    const subtitle = this.getLocalizedText(this.workshop.subtitleI18n);

    return html`
      <div class="workshop-header">
        <h1 class="workshop-title">${title}</h1>
        ${subtitle ? html`<h2 class="workshop-subtitle">${subtitle}</h2>` : ''}

        <div class="workshop-meta">
          ${this.workshop.startDate ? html`
            <div class="meta-item">
              📅 ${this.formatDate(this.workshop.startDate)}
            </div>
          ` : ''}

          ${this.workshop.startDate && this.workshop.endDate ? html`
            <div class="meta-item">
              ⏰ ${this.formatTime(this.workshop.startDate)} - ${this.formatTime(this.workshop.endDate)}
            </div>
          ` : ''}

          ${this.workshop.language ? html`
            <div class="meta-item">
              🌐 ${this.workshop.language === 'pl' ? 'Polski' : 'English'}
            </div>
          ` : ''}

          ${this.workshop.templateTheme ? html`
            <div class="meta-item">
              🎨 ${i18n.t(`workshop.themes.${this.workshop.templateTheme}`)}
            </div>
          ` : ''}

          ${this.workshop.seatLimit ? html`
            <div class="meta-item">
              👥 ${this.workshop.seatLimit} ${i18n.t('workshop.participants')}
            </div>
          ` : ''}

          ${this.workshop.price && this.workshop.price > 0 ? html`
            <div class="meta-item">
              💰 ${new Intl.NumberFormat(this.currentLanguage, {
                style: 'currency',
                currency: this.workshop.currency || 'PLN'
              }).format(this.workshop.price)}
            </div>
          ` : ''}
        </div>

        <div class="workshop-badges">
          <div class="status-badge ${this.workshop.status || 'draft'}">
            ${i18n.t(`workshop.status.${this.workshop.status || 'draft'}`)}
          </div>

          ${this.workshop.enableWaitingList ? html`
            <div class="status-badge">
              📋 ${i18n.t('workshop.waiting_list_available')}
            </div>
          ` : ''}

          <div class="status-badge">
            📚 ${this.sessions.length} ${i18n.t('workshop.sessions_count', { count: this.sessions.length })}
          </div>
        </div>
      </div>
    `;
  }

  private renderWorkshopDescription(): TemplateResult {
    const description = this.getLocalizedText(this.workshop.descriptionI18n);
    const shortDescription = this.getLocalizedText(this.workshop.shortDescriptionI18n);

    if (!description && !shortDescription) return nothing;

    return html`
      <section class="workshop-description">
        <h2 class="section-title">${i18n.t('workshop.about')}</h2>

        ${shortDescription ? html`
          <p style="font-size: var(--font-size-lg); font-weight: var(--font-weight-medium); color: var(--color-text-primary); margin-bottom: var(--spacing-4);">
            ${shortDescription}
          </p>
        ` : ''}

        ${description ? html`
          <div class="description-text">${description}</div>
        ` : ''}
      </section>
    `;
  }

  private renderWorkshopRequirements(): TemplateResult {
    const requirements = this.getLocalizedArray(this.workshop.requirementsI18n);
    const objectives = this.getLocalizedArray(this.workshop.objectivesI18n);

    if (requirements.length === 0 && objectives.length === 0) return nothing;

    return html`
      <section class="workshop-requirements">
        ${requirements.length > 0 ? html`
          <h2 class="section-title">${i18n.t('workshop.requirements')}</h2>
          <div class="requirements-list">
            ${requirements.map((requirement, index) => html`
              <div class="requirement-item">
                <span class="requirement-bullet">•</span>
                <span class="requirement-text">${requirement}</span>
              </div>
            `)}
          </div>
        ` : ''}

        ${objectives.length > 0 ? html`
          <h2 class="section-title" style="${requirements.length > 0 ? 'margin-top: var(--spacing-8);' : ''}">${i18n.t('workshop.objectives')}</h2>
          <div class="requirements-list">
            ${objectives.map((objective, index) => html`
              <div class="requirement-item">
                <span class="requirement-bullet">✓</span>
                <span class="requirement-text">${objective}</span>
              </div>
            `)}
          </div>
        ` : ''}
      </section>
    `;
  }

  private renderSessionsTimeline(): TemplateResult {
    if (this.sessions.length === 0) return nothing;

    return html`
      <section class="sessions-timeline">
        <h2 class="section-title">${i18n.t('workshop.schedule')}</h2>

        <div class="timeline">
          ${repeat(this.sessions, (session) => session.id, (session, index) => html`
            <div class="timeline-item">
              <div class="timeline-marker">${index + 1}</div>
              <div class="timeline-content">
                <div class="session-header">
                  <h3 class="session-title">${session.title}</h3>
                  <div class="session-time">
                    <span>📅 ${this.formatDate(session.startTime)}</span>
                    <span>⏰ ${this.formatTime(session.startTime)} - ${this.formatTime(session.endTime)}</span>
                    ${session.duration ? html`
                      <span class="session-duration">⏱️ ${session.duration} min</span>
                    ` : ''}
                  </div>
                </div>

                ${session.description ? html`
                  <div class="session-description">${session.description}</div>
                ` : ''}

                <div class="session-details">
                  ${session.location ? html`
                    <div class="session-detail">
                      📍 ${session.location}
                    </div>
                  ` : ''}

                  <div class="session-detail">
                    ${session.isRequired ? '✅' : '⚪'} ${session.isRequired ? i18n.t('session.required') : i18n.t('session.optional')}
                  </div>

                  ${session.maxParticipants ? html`
                    <div class="session-detail">
                      👥 ${i18n.t('session.max_participants')}: ${session.maxParticipants}
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          `)}
        </div>
      </section>
    `;
  }

  private renderMaterials(): TemplateResult {
    if (!this.workshop.materials || this.workshop.materials.length === 0) return nothing;

    return html`
      <section class="materials-section">
        <h2 class="section-title">${i18n.t('workshop.materials')}</h2>

        <div class="materials-grid">
          ${this.workshop.materials.map((material, index) => html`
            <div class="material-card">
              <div class="material-icon">
                ${this.getMaterialIcon(material.type)}
              </div>
              <div class="material-info">
                <div class="material-name">${material.name}</div>
                <div class="material-type">${material.type}</div>
              </div>
            </div>
          `)}
        </div>
      </section>
    `;
  }

  private getMaterialIcon(type: string): string {
    const icons: Record<string, string> = {
      document: '📄',
      video: '🎥',
      link: '🔗',
      template: '📋',
      presentation: '📊',
      pdf: '📕',
      image: '🖼️',
      audio: '🎵',
      zip: '📦'
    };

    return icons[type.toLowerCase()] || '📄';
  }

  private renderPreviewControls(): TemplateResult {
    if (this.isPrinting) return nothing;

    return html`
      <div class="view-modes">
        <button
          class=${classMap({
            'view-mode': true,
            'active': this.viewMode === 'desktop'
          })}
          @click=${() => this.viewMode = 'desktop'}
        >
          💻 ${i18n.t('preview.desktop')}
        </button>

        <button
          class=${classMap({
            'view-mode': true,
            'active': this.viewMode === 'mobile'
          })}
          @click=${() => this.viewMode = 'mobile'}
        >
          📱 ${i18n.t('preview.mobile')}
        </button>

        <div class="language-selector">
          <button
            class=${classMap({
              'language-option': true,
              'active': this.currentLanguage === 'pl'
            })}
            @click=${() => this.handleLanguageChange('pl')}
          >
            🇵🇱 PL
          </button>

          <button
            class=${classMap({
              'language-option': true,
              'active': this.currentLanguage === 'en'
            })}
            @click=${() => this.handleLanguageChange('en')}
          >
            🇬🇧 EN
          </button>
        </div>
      </div>
    `;
  }

  render(): TemplateResult {
    return html`
      <div class="preview-container" style="${this.viewMode === 'mobile' ? 'max-width: 600px;' : ''}">
        <div class="preview-header">
          <div>
            <h1 class="preview-title">${i18n.t('preview.title')}</h1>
            <p class="preview-subtitle">${i18n.t('preview.subtitle')}</p>
          </div>

          ${!this.isPrinting ? html`
            <div class="preview-actions">
              <ui-button
                variant="outline"
                size="small"
                @click=${this.handlePrint}
              >
                🖨️ ${i18n.t('action.print')}
              </ui-button>

              <ui-button
                variant="outline"
                size="small"
                @click=${this.handleClose}
              >
                ✕ ${i18n.t('action.close')}
              </ui-button>
            </div>
          ` : ''}
        </div>

        ${this.renderPreviewControls()}

        <div class="preview-body">
          ${this.renderWorkshopHeader()}
          ${this.renderWorkshopDescription()}
          ${this.renderWorkshopRequirements()}
          ${this.renderSessionsTimeline()}
          ${this.renderMaterials()}
        </div>

        <div class="status-bar">
          <div>
            ${i18n.t('preview.last_updated')}: ${this.workshop.updatedAt ? this.formatDate(this.workshop.updatedAt) : i18n.t('preview.never')}
          </div>

          <div>
            ${i18n.t('preview.generated_by')} WorkshopsAI CMS
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workshop-preview': WorkshopPreview;
  }
}