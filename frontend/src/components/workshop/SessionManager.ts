import { LitElement, html, css, TemplateResult, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { i18n } from '@/services/i18n';
import { workshopService } from '@/services/workshop';
import type { WorkshopSession } from '@/types/workshop';
import '@/components/ui/button';
import '@/components/ui/input';
import '@/components/ui/textarea';
import '@/components/ui/select';
import '@/components/ui/modal';
import '@/components/ui/loading';
import '@/components/ui/card';

/**
 * SessionManager - Handles workshop session CRUD operations
 * Features:
 * - Drag and drop reordering
 * - Session creation and editing
 * - Time validation
 * - Module management integration
 * - Accessibility compliance
 */
@customElement('session-manager')
export class SessionManager extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .sessions-container {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
    }

    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-4);
    }

    .session-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin: 0;
    }

    .session-count {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-left: var(--spacing-2);
    }

    /* Session List */
    .sessions-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
    }

    .session-item {
      background: white;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .session-item:hover {
      box-shadow: var(--shadow-md);
    }

    .session-item.dragging {
      opacity: 0.5;
      transform: rotate(2deg);
      box-shadow: var(--shadow-lg);
    }

    .session-item.drag-over {
      border-color: var(--color-primary-500);
      background: var(--color-primary-50);
    }

    .session-main {
      display: flex;
      align-items: center;
      padding: var(--spacing-4);
      gap: var(--spacing-3);
    }

    .session-drag-handle {
      display: flex;
      flex-direction: column;
      gap: 2px;
            padding: var(--spacing-2);
      cursor: grab;
      color: var(--color-gray-400);
      border-radius: var(--radius-sm);
      transition: all 0.2s ease;
    }

    .session-drag-handle:hover {
      background: var(--color-gray-100);
      color: var(--color-gray-600);
    }

    .session-drag-handle:active {
      cursor: grabbing;
    }

    .session-drag-handle::before,
    .session-drag-handle::after {
      content: '';
      width: 4px;
      height: 4px;
      background: currentColor;
      border-radius: 50%;
    }

    .session-order {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--color-primary-100);
      color: var(--color-primary-700);
      border-radius: var(--radius-full);
      font-weight: var(--font-weight-semibold);
      font-size: var(--font-size-sm);
      flex-shrink: 0;
    }

    .session-content {
      flex: 1;
      min-width: 0;
    }

    .session-name {
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-1) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .session-time {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .session-duration {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--color-gray-100);
      color: var(--color-gray-600);
      border-radius: var(--radius-full);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
    }

    .session-status {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .session-badge {
      padding: var(--spacing-1) var(--spacing-2);
      border-radius: var(--radius-full);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
    }

    .session-badge.required {
      background: var(--color-green-100);
      color: var(--color-green-700);
    }

    .session-badge.optional {
      background: var(--color-gray-100);
      color: var(--color-gray-600);
    }

    .session-actions {
      display: flex;
      gap: var(--spacing-2);
    }

    .session-details {
      border-top: 1px solid var(--color-border);
      background: var(--color-gray-50);
      padding: var(--spacing-4);
      display: none;
    }

    .session-details.expanded {
      display: block;
    }

    .session-description {
      margin: 0 0 var(--spacing-3) 0;
      color: var(--color-text-secondary);
      line-height: 1.6;
    }

    .session-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing-3);
      margin-bottom: var(--spacing-3);
    }

    .session-info-item {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    }

    .session-info-label {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
      text-transform: uppercase;
    }

    .session-info-value {
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
    }

    /* Session Form */
    .session-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-4);
    }

    .form-row.full-width {
      grid-template-columns: 1fr;
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
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
    }

    .required {
      color: var(--color-error-600);
    }

    input, textarea, select {
      padding: var(--spacing-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: var(--font-size-base);
      font-family: var(--font-family-sans);
      transition: all 0.2s ease;
    }

    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px var(--color-primary-100);
    }

    .error {
      border-color: var(--color-error-500) !important;
      box-shadow: 0 0 0 3px var(--color-error-100) !important;
    }

    .error-message {
      color: var(--color-error-600);
      font-size: var(--font-size-xs);
      margin-top: var(--spacing-1);
    }

    /* Add Session Button */
    .add-session {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-4);
      border: 2px dashed var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-gray-50);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all 0.2s ease;
      gap: var(--spacing-2);
    }

    .add-session:hover {
      border-color: var(--color-primary-300);
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: var(--spacing-8);
      color: var(--color-text-secondary);
    }

    .empty-state-icon {
      font-size: var(--font-size-4xl);
      margin-bottom: var(--spacing-3);
      opacity: 0.5;
    }

    .empty-state-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      margin: 0 0 var(--spacing-2) 0;
      color: var(--color-text-primary);
    }

    .empty-state-description {
      margin: 0 0 var(--spacing-4) 0;
      max-width: 400px;
      margin-left: auto;
          margin-right: auto;
    }

    /* Modal Content */
    .modal-header {
      margin-bottom: var(--spacing-4);
    }

    .modal-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin: 0;
    }

    .modal-description {
      color: var(--color-text-secondary);
      margin: var(--spacing-1) 0 0 0;
    }

    .modal-actions {
      display: flex;
      gap: var(--spacing-3);
      justify-content: flex-end;
      margin-top: var(--spacing-6);
      padding-top: var(--spacing-4);
      border-top: 1px solid var(--color-border);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .session-main {
        flex-direction: column;
        align-items: flex-start;
      }

      .session-content {
        width: 100%;
      }

      .session-actions {
        width: 100%;
        justify-content: flex-end;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .session-info-grid {
        grid-template-columns: 1fr;
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
      .session-item {
        border-width: 2px;
      }

      input, textarea, select {
        border-width: 2px;
      }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .session-item,
      .session-drag-handle,
      .add-session,
      input,
      textarea,
      select {
        transition: none;
      }
    }
  `;

  @property({ type: String })
  workshopId?: string;

  @property({ type: Array })
  sessions: WorkshopSession[] = [];

  @property({ type: Boolean })
  readonly: boolean = false;

  @state()
  private isLoading = false;

  @state()
  private error?: Error;

  @state()
  private expandedSessions = new Set<string>();

  @state()
  private editingSession?: WorkshopSession;

  @state()
  private showCreateModal = false;

  @state()
  private draggedSession?: WorkshopSession;

  @state()
  private draggedOverSession?: WorkshopSession;

  @state()
  private formErrors: Record<string, string> = {};

  private formData: Partial<WorkshopSession> = {
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    isRequired: true,
    maxParticipants: undefined
  };

  connectedCallback() {
    super.connectedCallback();
    this.setupKeyboardNavigation();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeKeyboardNavigation();
  }

  private setupKeyboardNavigation() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private removeKeyboardNavigation() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.closeModals();
    }
  };

  private closeModals() {
    this.showCreateModal = false;
    this.editingSession = undefined;
    this.formErrors = {};
    this.formData = {
      title: '',
      description: '',
      startTime: '',
      endTime: '',
      location: '',
      isRequired: true,
      maxParticipants: undefined
    };
  }

  private toggleSessionExpanded(sessionId: string) {
    const expanded = new Set(this.expandedSessions);
    if (expanded.has(sessionId)) {
      expanded.delete(sessionId);
    } else {
      expanded.add(sessionId);
    }
    this.expandedSessions = expanded;
  }

  private startEditSession(session: WorkshopSession) {
    this.editingSession = session;
    this.formData = { ...session };
    this.formErrors = {};
  }

  private handleDragStart(session: WorkshopSession) {
    this.draggedSession = session;
  }

  private handleDragOver(event: DragEvent, session: WorkshopSession) {
    event.preventDefault();
    if (this.draggedSession && this.draggedSession.id !== session.id) {
      this.draggedOverSession = session;
    }
  }

  private handleDrop(event: DragEvent, targetSession: WorkshopSession) {
    event.preventDefault();
    if (!this.draggedSession || this.draggedSession.id === targetSession.id) {
      return;
    }

    const sessions = [...this.sessions];
    const draggedIndex = sessions.findIndex(s => s.id === this.draggedSession!.id);
    const targetIndex = sessions.findIndex(s => s.id === targetSession.id);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [draggedSession] = sessions.splice(draggedIndex, 1);
      sessions.splice(targetIndex, 0, draggedSession);

      // Update order values
      sessions.forEach((session, index) => {
        session.order = index;
      });

      this.sessions = sessions;
      this.emitSessionsChange();
    }

    this.draggedSession = undefined;
    this.draggedOverSession = undefined;
  }

  private handleDragEnd() {
    this.draggedSession = undefined;
    this.draggedOverSession = undefined;
  }

  private validateSessionForm(): boolean {
    this.formErrors = {};

    if (!this.formData.title) {
      this.formErrors.title = 'validation.required';
    }

    if (!this.formData.startTime) {
      this.formErrors.startTime = 'validation.required';
    }

    if (!this.formData.endTime) {
      this.formErrors.endTime = 'validation.required';
    }

    if (this.formData.startTime && this.formData.endTime) {
      const start = new Date(this.formData.startTime);
      const end = new Date(this.formData.endTime);

      if (start >= end) {
        this.formErrors.endTime = 'session.invalid_time_range';
      }

      if (start < new Date()) {
        this.formErrors.startTime = 'session.past_start_time';
      }
    }

    if (this.formData.maxParticipants !== undefined && this.formData.maxParticipants <= 0) {
      this.formErrors.maxParticipants = 'session.invalid_participants';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  private async saveSession() {
    if (!this.validateSessionForm()) {
      return;
    }

    this.isLoading = true;

    try {
      let savedSession: WorkshopSession;

      const sessionData = {
        ...this.formData,
        duration: this.calculateDuration(
          this.formData.startTime!,
          this.formData.endTime!
        )
      } as WorkshopSession;

      if (this.editingSession && this.workshopId) {
        savedSession = await workshopService.updateSession(
          this.workshopId,
          this.editingSession.id,
          sessionData
        );
      } else if (this.workshopId) {
        savedSession = await workshopService.createSession(this.workshopId, sessionData);
      } else {
        // For new workshops, add to local array
        savedSession = {
          ...sessionData,
          id: `temp-${Date.now()}`,
          workshopId: '',
          order: this.sessions.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      if (this.editingSession) {
        // Update existing session in array
        const index = this.sessions.findIndex(s => s.id === this.editingSession!.id);
        if (index !== -1) {
          this.sessions[index] = savedSession;
        }
      } else {
        // Add new session to array
        this.sessions = [...this.sessions, savedSession];
      }

      this.emitSessionsChange();
      this.closeModals();
    } catch (error) {
      console.error('Failed to save session:', error);
      this.error = error as Error;
    } finally {
      this.isLoading = false;
    }
  }

  private async deleteSession(sessionId: string) {
    if (!confirm(i18n.t('session.confirm_delete'))) {
      return;
    }

    this.isLoading = true;

    try {
      if (this.workshopId) {
        await workshopService.deleteSession(this.workshopId, sessionId);
      }

      this.sessions = this.sessions.filter(s => s.id !== sessionId);
      this.emitSessionsChange();
    } catch (error) {
      console.error('Failed to delete session:', error);
      this.error = error as Error;
    } finally {
      this.isLoading = false;
    }
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
  }

  private formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString(i18n.getCurrentLanguage(), {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.getCurrentLanguage(), {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  private formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString(i18n.getCurrentLanguage(), {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private emitSessionsChange() {
    this.dispatchEvent(new CustomEvent('sessions-changed', {
      detail: { sessions: this.sessions },
      bubbles: true,
      composed: true
    }));
  }

  private renderSessionItem(session: WorkshopSession): TemplateResult {
    const isExpanded = this.expandedSessions.has(session.id);
    const isDragging = this.draggedSession?.id === session.id;
    const isDragOver = this.draggedOverSession?.id === session.id;

    return html`
      <div class=${classMap({
        'session-item': true,
        'dragging': isDragging,
        'drag-over': isDragOver
      })}
        draggable=${!this.readonly}
        @dragstart=${() => this.handleDragStart(session)}
        @dragover=${(e: DragEvent) => this.handleDragOver(e, session)}
        @drop=${(e: DragEvent) => this.handleDrop(e, session)}
        @dragend=${this.handleDragEnd}
      >
        <div class="session-main">
          <div class="session-drag-handle" title="${i18n.t('action.drag_to_reorder')}">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>

          <div class="session-order">
            ${session.order + 1}
          </div>

          <div class="session-content">
            <h3 class="session-name">${session.title}</h3>
            <div class="session-time">
              <span>
                📅 ${this.formatDate(session.startTime)}
              </span>
              <span>
                ⏰ ${this.formatTime(session.startTime)} - ${this.formatTime(session.endTime)}
              </span>
              ${session.duration ? html`
                <span class="session-duration">
                  ⏱️ ${session.duration}min
                </span>
              ` : ''}
            </div>
          </div>

          <div class="session-status">
            <div class=${classMap({
              'session-badge': true,
              'required': session.isRequired,
              'optional': !session.isRequired
            })}>
              ${session.isRequired ? i18n.t('session.required') : i18n.t('session.optional')}
            </div>
          </div>

          <div class="session-actions">
            <ui-button
              variant="ghost"
              size="small"
              @click=${() => this.toggleSessionExpanded(session.id)}
              aria-label="${isExpanded ? i18n.t('action.collapse') : i18n.t('action.expand')}"
            >
              ${isExpanded ? '▲' : '▼'}
            </ui-button>

            <ui-button
              variant="ghost"
              size="small"
              @click=${() => this.startEditSession(session)}
              ?disabled=${this.readonly}
              aria-label="${i18n.t('action.edit')}"
            >
              ✏️
            </ui-button>

            <ui-button
              variant="ghost"
              size="small"
              @click=${() => this.deleteSession(session.id)}
              ?disabled=${this.readonly}
              aria-label="${i18n.t('action.delete')}"
            >
              🗑️
            </ui-button>
          </div>
        </div>

        <div class=${classMap({
          'session-details': true,
          'expanded': isExpanded
        })}>
          ${session.description ? html`
            <p class="session-description">${session.description}</p>
          ` : ''}

          <div class="session-info-grid">
            ${session.location ? html`
              <div class="session-info-item">
                <div class="session-info-label">${i18n.t('session.location')}</div>
                <div class="session-info-value">📍 ${session.location}</div>
              </div>
            ` : ''}

            ${session.maxParticipants ? html`
              <div class="session-info-item">
                <div class="session-info-label">${i18n.t('session.max_participants')}</div>
                <div class="session-info-value">👥 ${session.maxParticipants}</div>
              </div>
            ` : ''}

            <div class="session-info-item">
              <div class="session-info-label">${i18n.t('session.created')}</div>
              <div class="session-info-value">${this.formatDateTime(session.createdAt)}</div>
            </div>

            <div class="session-info-item">
              <div class="session-info-label">${i18n.t('session.updated')}</div>
              <div class="session-info-value">${this.formatDateTime(session.updatedAt)}</div>
            </div>
          </div>

          ${session.materials && session.materials.length > 0 ? html`
            <div style="margin-top: var(--spacing-3);">
              <div class="session-info-label">${i18n.t('session.materials')}</div>
              <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-2); margin-top: var(--spacing-1);">
                ${session.materials.map(material => html`
                  <span style="padding: var(--spacing-1) var(--spacing-2); background: var(--color-gray-100); border-radius: var(--radius-md); font-size: var(--font-size-xs);">
                    📎 ${material.name}
                  </span>
                `)}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderSessionForm(): TemplateResult {
    return html`
      <div class="session-form">
        <div class="form-row full-width">
          <div class="form-group">
            <label>
              ${i18n.t('session.title')} <span class="required">*</span>
            </label>
            <input
              type="text"
              .value=${this.formData.title || ''}
              @input=${(e: any) => this.formData.title = e.target.value}
              placeholder="${i18n.t('session.title_placeholder')}"
              class=${this.formErrors.title ? 'error' : ''}
              ?disabled=${this.isLoading}
              aria-describedby="title-error"
            >
            ${this.formErrors.title ? html`
              <div id="title-error" class="error-message">
                ⚠️ ${i18n.t(this.formErrors.title)}
              </div>
            ` : ''}
          </div>
        </div>

        <div class="form-row full-width">
          <div class="form-group">
            <label>${i18n.t('session.description')}</label>
            <textarea
              rows="3"
              .value=${this.formData.description || ''}
              @input=${(e: any) => this.formData.description = e.target.value}
              placeholder="${i18n.t('session.description_placeholder')}"
              ?disabled=${this.isLoading}
            ></textarea>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>
              ${i18n.t('session.start_time')} <span class="required">*</span>
            </label>
            <input
              type="datetime-local"
              .value=${this.formData.startTime || ''}
              @input=${(e: any) => this.formData.startTime = e.target.value}
              class=${this.formErrors.startTime ? 'error' : ''}
              ?disabled=${this.isLoading}
              aria-describedby="start-time-error"
            >
            ${this.formErrors.startTime ? html`
              <div id="start-time-error" class="error-message">
                ⚠️ ${i18n.t(this.formErrors.startTime)}
              </div>
            ` : ''}
          </div>

          <div class="form-group">
            <label>
              ${i18n.t('session.end_time')} <span class="required">*</span>
            </label>
            <input
              type="datetime-local"
              .value=${this.formData.endTime || ''}
              @input=${(e: any) => this.formData.endTime = e.target.value}
              class=${this.formErrors.endTime ? 'error' : ''}
              ?disabled=${this.isLoading}
              aria-describedby="end-time-error"
            >
            ${this.formErrors.endTime ? html`
              <div id="end-time-error" class="error-message">
                ⚠️ ${i18n.t(this.formErrors.endTime)}
              </div>
            ` : ''}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>${i18n.t('session.location')}</label>
            <input
              type="text"
              .value=${this.formData.location || ''}
              @input=${(e: any) => this.formData.location = e.target.value}
              placeholder="${i18n.t('session.location_placeholder')}"
              ?disabled=${this.isLoading}
            >
          </div>

          <div class="form-group">
            <label>${i18n.t('session.max_participants')}</label>
            <input
              type="number"
              min="1"
              .value=${this.formData.maxParticipants || ''}
              @input=${(e: any) => this.formData.maxParticipants = parseInt(e.target.value) || undefined}
              placeholder="${i18n.t('session.max_participants_placeholder')}"
              class=${this.formErrors.maxParticipants ? 'error' : ''}
              ?disabled=${this.isLoading}
              aria-describedby="max-participants-error"
            >
            ${this.formErrors.maxParticipants ? html`
              <div id="max-participants-error" class="error-message">
                ⚠️ ${i18n.t(this.formErrors.maxParticipants)}
              </div>
            ` : ''}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>
              <input
                type="checkbox"
                .checked=${this.formData.isRequired ?? true}
                @change=${(e: any) => this.formData.isRequired = e.target.checked}
                ?disabled=${this.isLoading}
              >
              ${i18n.t('session.required')}
            </label>
          </div>
        </div>
      </div>
    `;
  }

  private renderEmptyState(): TemplateResult {
    return html`
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h3 class="empty-state-title">${i18n.t('session.empty_title')}</h3>
        <p class="empty-state-description">${i18n.t('session.empty_description')}</p>
        <ui-button
          variant="primary"
          @click=${() => this.showCreateModal = true}
          ?disabled=${this.readonly}
        >
          + ${i18n.t('session.create_first')}
        </ui-button>
      </div>
    `;
  }

  render(): TemplateResult {
    return html`
      <div class="sessions-container">
        <div class="session-header">
          <div style="display: flex; align-items: center; gap: var(--spacing-2);">
            <h2 class="session-title">${i18n.t('session.title')}</h2>
            <span class="session-count">(${this.sessions.length})</span>
          </div>

          <ui-button
            variant="outline"
            @click=${() => this.showCreateModal = true}
            ?disabled=${this.readonly}
          >
            + ${i18n.t('session.add')}
          </ui-button>
        </div>

        ${this.sessions.length > 0 ? html`
          <div class="sessions-list" role="list">
            ${repeat(this.sessions, (session) => session.id, (session) => this.renderSessionItem(session))}
          </div>

          <div class="add-session" @click=${() => this.showCreateModal = true} ?disabled=${this.readonly}>
            <span style="font-size: var(--font-size-lg);">+</span>
            <span>${i18n.t('session.add_another')}</span>
          </div>
        ` : this.renderEmptyState()}

        <!-- Create Session Modal -->
        <ui-modal ?open=${this.showCreateModal} @close=${this.closeModals}>
          <div class="modal-header">
            <h3 class="modal-title">${i18n.t('session.create_title')}</h3>
            <p class="modal-description">${i18n.t('session.create_description')}</p>
          </div>

          ${this.renderSessionForm()}

          <div class="modal-actions">
            <ui-button
              variant="outline"
              @click=${this.closeModals}
            >
              ${i18n.t('action.cancel')}
            </ui-button>

            <ui-button
              variant="primary"
              @click=${this.saveSession}
              ?disabled=${this.isLoading}
            >
              ${this.isLoading ? i18n.t('action.saving') : i18n.t('session.create')}
            </ui-button>
          </div>
        </ui-modal>

        <!-- Edit Session Modal -->
        <ui-modal ?open=${!!this.editingSession} @close=${this.closeModals}>
          <div class="modal-header">
            <h3 class="modal-title">${i18n.t('session.edit_title')}</h3>
            <p class="modal-description">${i18n.t('session.edit_description')}</p>
          </div>

          ${this.renderSessionForm()}

          <div class="modal-actions">
            <ui-button
              variant="outline"
              @click=${this.closeModals}
            >
              ${i18n.t('action.cancel')}
            </ui-button>

            <ui-button
              variant="primary"
              @click=${this.saveSession}
              ?disabled=${this.isLoading}
            >
              ${this.isLoading ? i18n.t('action.saving') : i18n.t('session.save')}
            </ui-button>
          </div>
        </ui-modal>

        ${this.isLoading ? html`
          <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, 0.8); display: flex; align-items: center; justify-content: center; z-index: 100;">
            <ui-loading size="large"></ui-loading>
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-manager': SessionManager;
  }
}