/**
 * Workshop Preview Web Component
 * Provides live preview of workshop from participant and facilitator perspectives
 * Includes mobile-responsive preview, print-friendly layout, and interactive questionnaire preview
 */

import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import {
  WorkshopData,
  WorkshopSession,
  PreviewOptions,
  SessionPreview,
  WorkshopPreview as WorkshopPreviewData,
  Language,
} from './WorkshopTypes.js';

/**
 * Workshop Preview Component
 */
@customElement('workshop-preview')
export class WorkshopPreview extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .preview-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f9fafb;
    }

    /* Preview Header */
    .preview-header {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .preview-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .preview-controls {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .view-selector {
      display: flex;
      background: #f3f4f6;
      border-radius: 8px;
      padding: 0.25rem;
      gap: 0.25rem;
    }

    .view-btn {
      padding: 0.5rem 1rem;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: #6b7280;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .view-btn.active {
      background: white;
      color: #111827;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .device-selector {
      display: flex;
      gap: 0.5rem;
    }

    .device-btn {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem 0.75rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      color: #6b7280;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    }

    .device-btn.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }

    .device-btn:hover:not(.active) {
      background: #f3f4f6;
      border-color: #9ca3af;
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .action-btn.primary {
      background: #3b82f6;
      color: white;
    }

    .action-btn.primary:hover {
      background: #2563eb;
    }

    .action-btn.secondary {
      background: white;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }

    .action-btn.secondary:hover {
      background: #f3f4f6;
    }

    /* Preview Content */
    .preview-content {
      flex: 1;
      overflow-y: auto;
      padding: 2rem;
      transition: all 0.3s ease;
    }

    /* Device Frames */
    .device-frame {
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .device-frame.desktop {
      width: 100%;
      max-width: 1200px;
      min-height: 800px;
    }

    .device-frame.tablet {
      width: 768px;
      min-height: 1024px;
    }

    .device-frame.mobile {
      width: 375px;
      min-height: 667px;
    }

    .device-frame.print {
      width: 100%;
      max-width: 210mm;
      min-height: 297mm;
      background: white;
      box-shadow: none;
      border: 1px solid #e5e7eb;
    }

    /* Preview Modes */
    .preview-workspace {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    /* Participant View */
    .participant-view {
      flex: 1;
      overflow-y: auto;
    }

    .welcome-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 3rem 2rem;
      text-align: center;
    }

    .welcome-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }

    .welcome-subtitle {
      font-size: 1.125rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }

    .welcome-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }

    .info-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 1.5rem;
      backdrop-filter: blur(10px);
    }

    .info-label {
      font-size: 0.875rem;
      opacity: 0.8;
      margin-bottom: 0.5rem;
    }

    .info-value {
      font-size: 1.125rem;
      font-weight: 600;
    }

    .content-section {
      padding: 2rem;
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .timeline-preview {
      position: relative;
      padding-left: 2rem;
    }

    .timeline-preview::before {
      content: '';
      position: absolute;
      left: 0.5rem;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e5e7eb;
    }

    .session-preview {
      position: relative;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .session-preview::before {
      content: '';
      position: absolute;
      left: -2.25rem;
      top: 2rem;
      width: 1rem;
      height: 1rem;
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 50%;
    }

    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .session-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      background: #3b82f6;
      color: white;
      border-radius: 50%;
      font-size: 0.875rem;
      font-weight: 600;
      margin-right: 0.75rem;
    }

    .session-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }

    .session-duration {
      background: #f3f4f6;
      color: #6b7280;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .session-description {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 1rem;
    }

    .session-materials {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .material-tag {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.75rem;
      background: #f0f9ff;
      color: #0369a1;
      border-radius: 6px;
      font-size: 0.813rem;
      font-weight: 500;
    }

    /* Facilitator View */
    .facilitator-view {
      flex: 1;
      overflow-y: auto;
      background: #f8fafc;
    }

    .facilitator-header {
      background: #1e293b;
      color: white;
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .facilitator-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }

    .timing-info {
      display: flex;
      gap: 2rem;
      font-size: 0.875rem;
    }

    .timing-item {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .timing-value {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .timing-label {
      opacity: 0.8;
    }

    .session-plan {
      padding: 2rem;
    }

    .session-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      position: relative;
    }

    .session-card::before {
      content: attr(data-time);
      position: absolute;
      left: -3rem;
      top: 1.5rem;
      background: #3b82f6;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .session-notes {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 1rem;
      margin-top: 1rem;
      font-size: 0.875rem;
      color: #92400e;
    }

    .checklist-section {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }

    .checklist-title {
      font-weight: 600;
      color: #111827;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .checklist-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .checklist-checkbox {
      width: 1.25rem;
      height: 1.25rem;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    /* Print Styles */
    .print-view {
      background: white;
      color: black;
      font-size: 12pt;
      line-height: 1.4;
    }

    .print-header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid black;
    }

    .print-title {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }

    .print-meta {
      font-size: 10pt;
      color: #666;
    }

    .print-section {
      margin-bottom: 1.5rem;
      page-break-inside: avoid;
    }

    .print-section-title {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid #ccc;
      padding-bottom: 0.25rem;
    }

    /* Loading State */
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .preview-header {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .preview-controls {
        flex-wrap: wrap;
        justify-content: center;
      }

      .device-frame.tablet {
        width: 100%;
        max-width: 100%;
      }

      .device-frame.mobile {
        width: 100%;
        max-width: 375px;
      }

      .welcome-section {
        padding: 2rem 1.5rem;
      }

      .welcome-title {
        font-size: 1.5rem;
      }

      .session-preview {
        padding: 1rem;
      }

      .facilitator-header {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
        text-align: center;
      }

      .timing-info {
        justify-content: space-around;
      }
    }

    /* Print-specific styles */
    @media print {
      .preview-header,
      .loading-overlay {
        display: none;
      }

      .preview-content {
        padding: 0;
      }

      .device-frame {
        box-shadow: none;
        border: none;
        margin: 0;
        max-width: none;
      }

      .session-preview {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  `;

  // Properties
  @property({ type: Object }) workshopData: WorkshopData = {
    slug: '',
    titleI18n: { pl: '', en: '' },
    descriptionI18n: { pl: '', en: '' },
    status: 'draft',
    language: 'pl',
    materials: [],
  };
  @property({ type: Array }) sessions: WorkshopSession[] = [];
  @property({ type: Object }) options: PreviewOptions = {
    mode: 'participant',
    language: 'pl',
    showSessionDetails: true,
    showMaterials: true,
    showTimings: true,
    showProgress: true,
    includeQuestionnaires: true,
  };

  // Internal state
  @state() private deviceMode: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  @state() private isLoading = false;
  @state() private workshopPreview?: WorkshopPreviewData;

  connectedCallback() {
    super.connectedCallback();
    this.generatePreview();
  }

  protected override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    if (
      changedProperties.has('workshopData') ||
      changedProperties.has('sessions') ||
      changedProperties.has('options')
    ) {
      this.generatePreview();
    }
  }

  private async generatePreview() {
    this.isLoading = true;

    try {
      // Simulate preview generation
      await new Promise(resolve => setTimeout(resolve, 500));

      this.workshopPreview = this.createPreviewData();
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private createPreviewData(): WorkshopPreviewData {
    const totalDuration = this.sessions.reduce(
      (sum, session) => sum + session.duration,
      0,
    );

    const sessionPreviews: SessionPreview[] = this.sessions.map(
      (session, index) => {
        const startTime = this.calculateSessionStartTime(session);
        const endTime = new Date(
          startTime.getTime() + session.duration * 60000,
        );

        return {
          session,
          order: index + 1,
          startTime,
          endTime,
          duration: session.duration,
          materials:
            this.workshopData.materials?.filter(
              m => m.sessionId === session.id,
            ) || [],
          activities: this.createSessionActivities(session),
          transitions: this.createSessionTransitions(session, index),
        };
      },
    );

    return {
      id: 'preview_' + Date.now(),
      workshopData: this.workshopData,
      sessions: this.sessions,
      totalDuration,
      estimatedTime: {
        min: totalDuration,
        max: Math.round(totalDuration * 1.2),
      },
      participantView: {
        welcomeMessage: {
          pl: 'Witaj na warsztacie!',
          en: 'Welcome to the workshop!',
        },
        sessionFlow: sessionPreviews,
        materials: this.workshopData.materials || [],
        questionnaires: [],
      },
      facilitatorView: {
        sessionPlan: sessionPreviews,
        timing: {
          total: totalDuration,
          perSession: this.sessions.map(s => s.duration),
          buffer: Math.round(totalDuration * 0.1),
        },
        notes: [
          'Prepare welcome materials 15 minutes before start',
          'Check technical equipment before each session',
          'Have backup materials ready for technical issues',
        ],
        checklist: [
          'Test all equipment and connections',
          'Prepare welcome area and materials',
          'Review participant list and requirements',
          'Set up break area with refreshments',
          'Check emergency exits and procedures',
        ],
      },
    };
  }

  private createSessionActivities(session: WorkshopSession): any[] {
    // Generate sample activities based on session type
    const activities = [];

    switch (session.type) {
    case 'introduction':
      activities.push({
        id: 'welcome',
        type: 'instruction',
        title: { pl: 'Przywitanie', en: 'Welcome' },
        description: {
          pl: 'Przedstawienie prowadzącego i celów warsztatu',
          en: 'Introduce facilitator and workshop goals',
        },
        duration: 10,
        order: 1,
        materials: [],
        instructions: [],
      });
      break;
    case 'activity':
      activities.push({
        id: 'main-activity',
        type: 'exercise',
        title: { pl: 'Główna aktywność', en: 'Main Activity' },
        description: { pl: 'Praktyczne ćwiczenie', en: 'Practical exercise' },
        duration: session.duration - 10,
        order: 1,
        materials: [],
        instructions: [],
      });
      break;
    }

    return activities;
  }

  private createSessionTransitions(
    session: WorkshopSession,
    index: number,
  ): any[] {
    const transitions = [];

    if (index < this.sessions.length - 1) {
      const nextSession = this.sessions[index + 1];
      transitions.push({
        fromSession: session.id,
        toSession: nextSession.id,
        type: 'sequential',
        description: {
          pl: 'Przejście do następnej sesji',
          en: 'Transition to next session',
        },
        duration: 5,
      });
    }

    return transitions;
  }

  private calculateSessionStartTime(session: WorkshopSession): Date {
    const previousSessions = this.sessions
      .filter(s => s.orderIndex < session.orderIndex)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    let startTime = new Date();
    for (const prevSession of previousSessions) {
      startTime = new Date(startTime.getTime() + prevSession.duration * 60000);
    }

    return startTime;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString(
      this.options.language === 'pl' ? 'pl-PL' : 'en-US',
      {
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString(
      this.options.language === 'pl' ? 'pl-PL' : 'en-US',
      {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      },
    );
  }

  private printPreview() {
    window.print();
  }

  private exportPreview() {
    // Export preview as PDF or other format
    const exportData = {
      workshop: this.workshopData,
      sessions: this.sessions,
      preview: this.workshopPreview,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.workshopData.slug || 'workshop'}-preview.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected override render() {
    const { mode, language } = this.options;
    const previewData = this.workshopPreview;

    return html`
      <div class="preview-container">
        <!-- Preview Header -->
        <div class="preview-header">
          <h2 class="preview-title">👁️ Workshop Preview</h2>

          <div class="preview-controls">
            <!-- View Selector -->
            <div class="view-selector">
              <button
                class="view-btn ${classMap({ active: mode === 'participant' })}"
                @click=${() =>
    (this.options = { ...this.options, mode: 'participant' })}
              >
                👤 Participant
              </button>
              <button
                class="view-btn ${classMap({ active: mode === 'facilitator' })}"
                @click=${() =>
    (this.options = { ...this.options, mode: 'facilitator' })}
              >
                🎯 Facilitator
              </button>
              <button
                class="view-btn ${classMap({ active: mode === 'print' })}"
                @click=${() =>
    (this.options = { ...this.options, mode: 'print' })}
              >
                🖨️ Print
              </button>
            </div>

            <!-- Device Selector (hidden in print mode) -->
            ${mode !== 'print'
    ? html`
                  <div class="device-selector">
                    <button
                      class="device-btn ${classMap({
    active: this.deviceMode === 'desktop',
  })}"
                      @click=${() => (this.deviceMode = 'desktop')}
                    >
                      💻 Desktop
                    </button>
                    <button
                      class="device-btn ${classMap({
    active: this.deviceMode === 'tablet',
  })}"
                      @click=${() => (this.deviceMode = 'tablet')}
                    >
                      📱 Tablet
                    </button>
                    <button
                      class="device-btn ${classMap({
    active: this.deviceMode === 'mobile',
  })}"
                      @click=${() => (this.deviceMode = 'mobile')}
                    >
                      📱 Mobile
                    </button>
                  </div>
                `
    : ''}

            <!-- Action Buttons -->
            <button class="action-btn secondary" @click=${this.exportPreview}>
              📥 Export
            </button>
            ${mode === 'print'
    ? html`
                  <button
                    class="action-btn primary"
                    @click=${this.printPreview}
                  >
                    🖨️ Print
                  </button>
                `
    : ''}
          </div>
        </div>

        <!-- Preview Content -->
        <div class="preview-content">
          ${this.isLoading
    ? html`
                <div class="loading-overlay">
                  <div class="loading-spinner"></div>
                </div>
              `
    : ''}

          <!-- Device Frame -->
          <div class="device-frame ${mode} ${this.deviceMode}">
            ${previewData
    ? this.renderPreviewContent(previewData)
    : html`
                  <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-title">Preview not available</div>
                    <div class="empty-description">
                      Please add some content to generate a preview
                    </div>
                  </div>
                `}
          </div>
        </div>
      </div>
    `;
  }

  private renderPreviewContent(previewData: WorkshopPreviewData) {
    const { mode, language } = this.options;

    switch (mode) {
    case 'participant':
      return this.renderParticipantView(previewData);
    case 'facilitator':
      return this.renderFacilitatorView(previewData);
    case 'print':
      return this.renderPrintView(previewData);
    default:
      return this.renderParticipantView(previewData);
    }
  }

  private renderParticipantView(previewData: WorkshopPreviewData) {
    const { workshopData, participantView } = previewData;
    const { language } = this.options;

    return html`
      <div class="preview-workspace">
        <div class="participant-view">
          <!-- Welcome Section -->
          <div class="welcome-section">
            <h1 class="welcome-title">
              ${workshopData.titleI18n[language] || 'Untitled Workshop'}
            </h1>
            <p class="welcome-subtitle">
              ${workshopData.descriptionI18n[language] ||
              'Workshop description'}
            </p>

            <div class="welcome-info">
              <div class="info-card">
                <div class="info-label">Duration</div>
                <div class="info-value">
                  ${Math.ceil(previewData.totalDuration / 60)} hours
                </div>
              </div>
              <div class="info-card">
                <div class="info-label">Sessions</div>
                <div class="info-value">${previewData.sessions.length}</div>
              </div>
              <div class="info-card">
                <div class="info-label">Language</div>
                <div class="info-value">${language.toUpperCase()}</div>
              </div>
              ${workshopData.startDate
    ? html`
                    <div class="info-card">
                      <div class="info-label">Start Date</div>
                      <div class="info-value">
                        ${this.formatDate(new Date(workshopData.startDate))}
                      </div>
                    </div>
                  `
    : ''}
            </div>
          </div>

          <!-- Workshop Content -->
          <div class="content-section">
            <h2 class="section-title">📅 Workshop Schedule</h2>

            ${this.options.showSessionDetails
    ? html`
                  <div class="timeline-preview">
                    ${participantView.sessionFlow.map(
    (sessionPreview, index) => html`
                        <div class="session-preview">
                          <div class="session-header">
                            <div style="display: flex; align-items: center;">
                              <span class="session-number">${index + 1}</span>
                              <h3 class="session-title">
                                ${sessionPreview.session.titleI18n[language]}
                              </h3>
                            </div>
                            <span class="session-duration">
                              ⏱️ ${sessionPreview.duration} min
                            </span>
                          </div>

                          ${sessionPreview.session.descriptionI18n?.[language]
    ? html`
                                <div class="session-description">
                                  ${sessionPreview.session.descriptionI18n[
    language
  ]}
                                </div>
                              `
    : ''}
                          ${this.options.showTimings && sessionPreview.startTime
    ? html`
                                <div
                                  style="font-size: 0.875rem; color: #6b7280; margin-bottom: 1rem;"
                                >
                                  🕐
                                  ${this.formatTime(sessionPreview.startTime)} -
                                  ${this.formatTime(sessionPreview.endTime!)}
                                </div>
                              `
    : ''}
                          ${this.options.showMaterials &&
                          sessionPreview.materials.length > 0
    ? html`
                                <div class="session-materials">
                                  ${sessionPreview.materials.map(
    material => html`
                                      <div class="material-tag">
                                        📎 ${material.name}
                                      </div>
                                    `,
  )}
                                </div>
                              `
    : ''}
                        </div>
                      `,
  )}
                  </div>
                `
    : ''}

            <!-- Materials Section -->
            ${this.options.showMaterials &&
            workshopData.materials &&
            workshopData.materials.length > 0
    ? html`
                  <h2 class="section-title" style="margin-top: 2rem;">
                    📁 Workshop Materials
                  </h2>
                  <div style="display: grid; gap: 1rem;">
                    ${workshopData.materials.map(
    material => html`
                        <div
                          style="padding: 1rem; background: white; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; gap: 0.75rem;"
                        >
                          <span style="font-size: 1.25rem;">📎</span>
                          <div>
                            <div style="font-weight: 500; color: #111827;">
                              ${material.name}
                            </div>
                            <div style="font-size: 0.875rem; color: #6b7280;">
                              ${material.type}
                            </div>
                          </div>
                        </div>
                      `,
  )}
                  </div>
                `
    : ''}
          </div>
        </div>
      </div>
    `;
  }

  private renderFacilitatorView(previewData: WorkshopPreviewData) {
    const { workshopData, facilitatorView } = previewData;
    const { language } = this.options;

    return html`
      <div class="preview-workspace">
        <div class="facilitator-view">
          <!-- Facilitator Header -->
          <div class="facilitator-header">
            <h2 class="facilitator-title">
              📋 ${workshopData.titleI18n[language] || 'Workshop'} - Facilitator
              Guide
            </h2>

            <div class="timing-info">
              <div class="timing-item">
                <div class="timing-value">
                  ${Math.ceil(previewData.totalDuration / 60)}
                </div>
                <div class="timing-label">Total Hours</div>
              </div>
              <div class="timing-item">
                <div class="timing-value">${previewData.sessions.length}</div>
                <div class="timing-label">Sessions</div>
              </div>
              <div class="timing-item">
                <div class="timing-value">${facilitatorView.timing.buffer}</div>
                <div class="timing-label">Buffer (min)</div>
              </div>
            </div>
          </div>

          <!-- Session Plan -->
          <div class="session-plan">
            <h2 class="section-title">📅 Session Timeline</h2>

            ${facilitatorView.sessionPlan.map((sessionPreview, index) => {
    const startTime = this.formatTime(sessionPreview.startTime!);
    return html`
                <div class="session-card" data-time="${startTime}">
                  <div class="session-header">
                    <h3 class="session-title">
                      ${index + 1}.
                      ${sessionPreview.session.titleI18n[language]}
                    </h3>
                    <span class="session-duration">
                      ${sessionPreview.duration} minutes
                    </span>
                  </div>

                  ${sessionPreview.session.descriptionI18n?.[language]
    ? html`
                        <div class="session-description">
                          ${sessionPreview.session.descriptionI18n[language]}
                        </div>
                      `
    : ''}

                  <div
                    style="font-size: 0.875rem; color: #6b7280; margin: 0.5rem 0;"
                  >
                    <strong>Time:</strong> ${startTime} -
                    ${this.formatTime(sessionPreview.endTime!)}
                  </div>

                  ${sessionPreview.materials.length > 0
    ? html`
                        <div style="margin-top: 1rem;">
                          <strong>Materials:</strong>
                          <div
                            style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;"
                          >
                            ${sessionPreview.materials.map(
    material => html`
                                <span
                                  style="padding: 0.25rem 0.5rem; background: #f0f9ff; color: #0369a1; border-radius: 4px; font-size: 0.75rem;"
                                >
                                  📎 ${material.name}
                                </span>
                              `,
  )}
                          </div>
                        </div>
                      `
    : ''}
                  ${index === 0
    ? html`
                        <div class="session-notes">
                          <strong>Opening Notes:</strong>
                          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                            <li>Welcome participants and introduce yourself</li>
                            <li>Review workshop agenda and goals</li>
                            <li>Establish ground rules and expectations</li>
                          </ul>
                        </div>
                      `
    : ''}
                  ${index === facilitatorView.sessionPlan.length - 1
    ? html`
                        <div class="session-notes">
                          <strong>Closing Notes:</strong>
                          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                            <li>Summarize key takeaways</li>
                            <li>Collect feedback</li>
                            <li>Provide next steps and resources</li>
                          </ul>
                        </div>
                      `
    : ''}
                </div>
              `;
  })}

            <!-- Preparation Checklist -->
            <div class="checklist-section">
              <h3 class="checklist-title">✅ Pre-Workshop Checklist</h3>
              ${facilitatorView.checklist.map(
    item => html`
                  <div class="checklist-item">
                    <div class="checklist-checkbox"></div>
                    <div>${item}</div>
                  </div>
                `,
  )}
            </div>

            <!-- Facilitator Notes -->
            <div class="checklist-section">
              <h3 class="checklist-title">📝 Important Notes</h3>
              ${facilitatorView.notes.map(
    note => html`
                  <div
                    style="margin-bottom: 0.5rem; padding: 0.75rem; background: #fef3c7; border-radius: 6px; color: #92400e;"
                  >
                    ${note}
                  </div>
                `,
  )}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderPrintView(previewData: WorkshopPreviewData) {
    const { workshopData, sessions } = previewData;
    const { language } = this.options;

    return html`
      <div class="preview-workspace print-view">
        <!-- Print Header -->
        <div class="print-header">
          <div class="print-title">
            ${workshopData.titleI18n[language] || 'Workshop'}
          </div>
          <div class="print-meta">
            Generated on ${this.formatDate(new Date())} • ${sessions.length}
            sessions • ${Math.ceil(previewData.totalDuration / 60)} hours
          </div>
        </div>

        <!-- Workshop Overview -->
        <div class="print-section">
          <div class="print-section-title">Workshop Overview</div>
          <p>
            <strong>Description:</strong> ${workshopData.descriptionI18n[
    language
  ] || 'No description'}
          </p>
          <p><strong>Language:</strong> ${language.toUpperCase()}</p>
          <p>
            <strong>Duration:</strong> ${Math.ceil(
    previewData.totalDuration / 60,
  )}
            hours
          </p>
          <p><strong>Sessions:</strong> ${sessions.length}</p>
          ${workshopData.startDate
    ? html`
                <p>
                  <strong>Start Date:</strong> ${this.formatDate(
    new Date(workshopData.startDate),
  )}
                </p>
              `
    : ''}
        </div>

        <!-- Session Schedule -->
        <div class="print-section">
          <div class="print-section-title">Session Schedule</div>
          ${sessions.map((session, index) => {
    const startTime = this.calculateSessionStartTime(session);
    return html`
              <div
                style="margin-bottom: 1rem; padding: 0.75rem; border-left: 3px solid #3b82f6; background: #f8fafc;"
              >
                <div style="font-weight: 600; margin-bottom: 0.25rem;">
                  ${index + 1}. ${session.titleI18n[language]}
                </div>
                <div
                  style="font-size: 0.875rem; color: #666; margin-bottom: 0.25rem;"
                >
                  ${this.formatTime(startTime)} -
                  ${this.formatTime(
    new Date(startTime.getTime() + session.duration * 60000),
  )}
                  • ${session.duration} minutes
                </div>
                ${session.descriptionI18n?.[language]
    ? html`
                      <div style="font-size: 0.875rem; margin-top: 0.5rem;">
                        ${session.descriptionI18n[language]}
                      </div>
                    `
    : ''}
              </div>
            `;
  })}
        </div>

        <!-- Materials -->
        ${workshopData.materials && workshopData.materials.length > 0
    ? html`
              <div class="print-section">
                <div class="print-section-title">Workshop Materials</div>
                ${workshopData.materials.map(
    material => html`
                    <div style="margin-bottom: 0.5rem;">
                      • ${material.name} (${material.type})
                    </div>
                  `,
  )}
              </div>
            `
    : ''}

        <!-- Notes -->
        <div class="print-section">
          <div class="print-section-title">Notes</div>
          <div
            style="border: 1px solid #ccc; padding: 1rem; min-height: 100px;"
          >
            <!-- Space for handwritten notes -->
          </div>
        </div>
      </div>
    `;
  }
}

// Register the custom element
if (!customElements.get('workshop-preview')) {
  customElements.define('workshop-preview', WorkshopPreview);
}
