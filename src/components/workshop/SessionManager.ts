/**
 * Session Manager Web Component
 * Handles drag-and-drop session planning with timeline management
 * Provides intuitive interface for creating and organizing workshop sessions
 */

import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import {
  WorkshopSession,
  SessionType,
  SessionTemplate,
  Language,
  SessionSettings,
} from './WorkshopTypes.js';

// Import drag and drop library
import Dragula from 'dragula';

/**
 * Session Manager Component
 */
@customElement('session-manager')
export class SessionManager extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .session-manager {
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 1.5rem;
      height: 100%;
      min-height: 600px;
    }

    /* Header */
    .manager-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e5e7eb;
    }

    .manager-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .manager-stats {
      display: flex;
      gap: 2rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .stat-value {
      font-weight: 600;
      color: #111827;
    }

    /* Control Panel */
    .control-panel {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .add-session-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .add-session-btn:hover {
      background: #2563eb;
    }

    .template-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .template-btn:hover {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    .view-toggle {
      display: flex;
      background: #f3f4f6;
      border-radius: 6px;
      padding: 0.25rem;
      gap: 0.25rem;
    }

    .view-btn {
      padding: 0.5rem 0.75rem;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: #6b7280;
      cursor: pointer;
      font-size: 0.813rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .view-btn.active {
      background: white;
      color: #111827;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    /* Timeline View */
    .timeline-container {
      flex: 1;
      overflow-x: auto;
      background: #f9fafb;
      border-radius: 8px;
      padding: 1.5rem;
      min-height: 400px;
    }

    .timeline {
      position: relative;
      min-height: 100%;
      padding-left: 3rem;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 1.5rem;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e5e7eb;
    }

    .session-item {
      position: relative;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      cursor: move;
      transition: all 0.2s;
    }

    .session-item:hover {
      border-color: #3b82f6;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    }

    .session-item.dragging {
      opacity: 0.5;
      transform: rotate(5deg);
    }

    .session-item.drag-over {
      border-color: #10b981;
      background: #f0fdf4;
    }

    .session-connector {
      position: absolute;
      left: -2.75rem;
      top: 1.5rem;
      width: 1rem;
      height: 1rem;
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 50%;
      z-index: 1;
    }

    .session-item.active .session-connector {
      background: #3b82f6;
      border-color: #3b82f6;
    }

    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .session-title-section {
      flex: 1;
    }

    .session-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      background: #3b82f6;
      color: white;
      border-radius: 50%;
      font-size: 0.75rem;
      font-weight: 600;
      margin-right: 0.75rem;
    }

    .session-title {
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
      display: inline;
    }

    .session-type {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.75rem;
      background: #f3f4f6;
      color: #6b7280;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      margin-left: 0.5rem;
    }

    .session-actions {
      display: flex;
      gap: 0.5rem;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .session-item:hover .session-actions {
      opacity: 1;
    }

    .session-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.875rem;
    }

    .session-action-btn:hover {
      background: #f9fafb;
      border-color: #9ca3af;
      color: #111827;
    }

    .session-action-btn.delete:hover {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #dc2626;
    }

    .session-content {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1rem;
      align-items: center;
    }

    .session-info {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .session-description {
      color: #6b7280;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .session-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.813rem;
      color: #6b7280;
    }

    .session-duration {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .session-time {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .session-timing {
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .session-start,
    .session-end {
      font-size: 0.813rem;
      color: #6b7280;
    }

    .session-break {
      background: #fef3c7;
      border-color: #f59e0b;
    }

    .session-break .session-type {
      background: #fef3c7;
      color: #92400e;
    }

    /* List View */
    .list-view {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .list-item {
      display: grid;
      grid-template-columns: auto 1fr auto auto auto;
      gap: 1rem;
      align-items: center;
      padding: 1rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .list-item:hover {
      border-color: #3b82f6;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
    }

    .drag-handle {
      color: #9ca3af;
      cursor: move;
      font-size: 1.25rem;
    }

    /* Session Modal */
    .session-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .session-modal.hidden {
      display: none;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
    }

    .modal-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: #6b7280;
      cursor: pointer;
      padding: 0.25rem;
      line-height: 1;
    }

    .modal-close:hover {
      color: #111827;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #111827;
      margin-bottom: 0.5rem;
    }

    .form-input,
    .form-textarea,
    .form-select {
      width: 100%;
      padding: 0.625rem 0.875rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: border-color 0.2s;
    }

    .form-input:focus,
    .form-textarea:focus,
    .form-select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 100px;
    }

    .duration-input-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .modal-footer {
      padding: 1.5rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    .btn {
      padding: 0.625rem 1.25rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .btn-secondary:hover {
      background: #e5e7eb;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    /* Templates Panel */
    .templates-panel {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .templates-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .templates-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #111827;
    }

    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .template-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 1rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .template-card:hover {
      border-color: #3b82f6;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
    }

    .template-name {
      font-weight: 600;
      color: #111827;
      margin-bottom: 0.25rem;
    }

    .template-duration {
      font-size: 0.813rem;
      color: #6b7280;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #6b7280;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .empty-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .empty-description {
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .manager-header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .control-panel {
        width: 100%;
      }

      .session-content {
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }

      .session-timing {
        text-align: left;
      }

      .list-item {
        grid-template-columns: auto 1fr auto;
        gap: 0.75rem;
      }

      .session-meta {
        flex-direction: column;
        gap: 0.25rem;
      }
    }
  `;

  // Properties
  @property({ type: String }) workshopId?: string;
  @property({ type: Array }) sessions: WorkshopSession[] = [];
  @property({ type: String }) language: Language = 'pl';

  // Internal state
  @state() private viewMode: 'timeline' | 'list' = 'timeline';
  @state() private editingSession?: WorkshopSession;
  @state() private showSessionModal = false;
  @state() private showTemplatesPanel = false;
  @state() private templates: SessionTemplate[] = [];
  @state() private draggedElement?: HTMLElement;

  // Template session types with defaults
  private sessionTypeDefaults: Record<SessionType, Partial<WorkshopSession>> = {
    introduction: {
      type: 'introduction',
      duration: 30,
      titleI18n: { pl: 'Wprowadzenie', en: 'Introduction' },
      descriptionI18n: {
        pl: 'Przedstawienie uczestników i celów warsztatu',
        en: 'Participant introductions and workshop goals',
      },
    },
    activity: {
      type: 'activity',
      duration: 60,
      titleI18n: { pl: 'Aktywność', en: 'Activity' },
      descriptionI18n: {
        pl: 'Główna aktywność warsztatowa',
        en: 'Main workshop activity',
      },
    },
    discussion: {
      type: 'discussion',
      duration: 45,
      titleI18n: { pl: 'Dyskusja', en: 'Discussion' },
      descriptionI18n: {
        pl: 'Czas na dyskusję i wymianę zdań',
        en: 'Time for discussion and exchange of ideas',
      },
    },
    break: {
      type: 'break',
      duration: 15,
      titleI18n: { pl: 'Przerwa', en: 'Break' },
      descriptionI18n: { pl: 'Krótka przerwa', en: 'Short break' },
      isRequired: false,
    },
    presentation: {
      type: 'presentation',
      duration: 30,
      titleI18n: { pl: 'Prezentacja', en: 'Presentation' },
      descriptionI18n: {
        pl: 'Prezentacja materiałów',
        en: 'Material presentation',
      },
    },
    exercise: {
      type: 'exercise',
      duration: 45,
      titleI18n: { pl: 'Ćwiczenie', en: 'Exercise' },
      descriptionI18n: { pl: 'Praktyczne ćwiczenie', en: 'Practical exercise' },
    },
    conclusion: {
      type: 'conclusion',
      duration: 20,
      titleI18n: { pl: 'Zakończenie', en: 'Conclusion' },
      descriptionI18n: { pl: 'Podsumowanie warsztatu', en: 'Workshop summary' },
    },
    feedback: {
      type: 'feedback',
      duration: 15,
      titleI18n: { pl: 'Feedback', en: 'Feedback' },
      descriptionI18n: {
        pl: 'Zebranie opinii uczestników',
        en: 'Collect participant feedback',
      },
    },
    custom: {
      type: 'custom',
      duration: 60,
      titleI18n: { pl: 'Niestandardowa sesja', en: 'Custom Session' },
      descriptionI18n: {
        pl: 'Dostosuj do swoich potrzeb',
        en: 'Customize to your needs',
      },
    },
  };

  override connectedCallback() {
    super.connectedCallback();
    this.loadTemplates();
  }

  override disconnectedCallback() {
    this.cleanupDragAndDrop();
    super.disconnectedCallback();
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    if (
      changedProperties.has('sessions') ||
      changedProperties.has('viewMode')
    ) {
      this.updateDragAndDrop();
    }
  }

  private async loadTemplates() {
    // Load session templates from API or use defaults
    this.templates = [
      {
        id: 'icebreaker',
        name: { pl: 'Lodołamacz', en: 'Icebreaker' },
        description: {
          pl: 'Aktywność przełamująca lody',
          en: 'Ice breaking activity',
        },
        type: 'introduction',
        duration: 15,
        materials: [],
        category: 'icebreaker',
        settings: { allowReordering: true },
      },
      {
        id: 'brainstorm',
        name: { pl: 'Burza mózgów', en: 'Brainstorming' },
        description: { pl: 'Sesja burzy mózgów', en: 'Brainstorming session' },
        type: 'activity',
        duration: 45,
        materials: [],
        category: 'main',
        settings: { allowReordering: true },
      },
      {
        id: 'coffee-break',
        name: { pl: 'Przerwa kawowa', en: 'Coffee Break' },
        description: { pl: '15-minutowa przerwa', en: '15-minute break' },
        type: 'break',
        duration: 15,
        materials: [],
        category: 'break',
        settings: { allowReordering: true },
      },
    ];
  }

  private updateDragAndDrop() {
    this.cleanupDragAndDrop();

    if (this.viewMode !== 'timeline') return;

    this.updateComplete.then(() => {
      const container = this.shadowRoot?.querySelector('.timeline');
      if (!container) return;

      // Initialize drag and drop
      const drake = (Dragula as any)([container], {
        moves: (el: HTMLElement) => el.classList.contains('session-item'),
        accepts: (el: HTMLElement, target: HTMLElement) =>
          target.classList.contains('timeline'),
        direction: 'vertical',
      });

      drake.on('drag', (el: HTMLElement) => {
        el.classList.add('dragging');
        this.draggedElement = el;
      });

      drake.on('dragend', (el: HTMLElement) => {
        el.classList.remove('dragging');
        this.handleSessionReorder();
      });

      drake.on('over', (el: HTMLElement, container: HTMLElement) => {
        container.classList.add('drag-over');
      });

      drake.on('out', (el: HTMLElement, container: HTMLElement) => {
        container.classList.remove('drag-over');
      });

      // Store drake instance for cleanup
      (this as any)._drake = drake;
    });
  }

  private cleanupDragAndDrop() {
    const drake = (this as any)._drake;
    if (drake) {
      drake.destroy();
      (this as any)._drake = null;
    }
  }

  private handleSessionReorder() {
    const timeline = this.shadowRoot?.querySelector('.timeline');
    if (!timeline) return;

    const sessionElements = Array.from(
      timeline.querySelectorAll('.session-item'),
    );
    const newOrder = sessionElements.map((el, index) => {
      const sessionId = (el as HTMLElement).dataset.sessionId;
      if (!sessionId) throw new Error('Session ID not found');

      const session = this.sessions.find(s => s.id === sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);

      return { ...session, orderIndex: index };
    });

    this.sessions = newOrder.sort((a, b) => a.orderIndex - b.orderIndex);
    this.dispatchSessionsChange();
  }

  private addSession(type: SessionType = 'activity') {
    const defaults = this.sessionTypeDefaults[type];
    const newSession: WorkshopSession = {
      id: this.generateId(),
      workshopId: this.workshopId || '',
      titleI18n: defaults.titleI18n || { pl: '', en: '' },
      descriptionI18n: defaults.descriptionI18n || { pl: '', en: '' },
      type,
      startTime: new Date(),
      endTime: new Date(Date.now() + (defaults.duration || 60) * 60000),
      duration: defaults.duration || 60,
      orderIndex: this.sessions.length,
      materials: [],
      isRequired: defaults.isRequired !== false,
      settings: defaults.settings as SessionSettings,
    };

    this.sessions = [...this.sessions, newSession];
    this.editingSession = newSession;
    this.showSessionModal = true;
    this.dispatchSessionsChange();
  }

  private editSession(sessionId: string) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      this.editingSession = { ...session };
      this.showSessionModal = true;
    }
  }

  private deleteSession(sessionId: string) {
    if (confirm('Are you sure you want to delete this session?')) {
      this.sessions = this.sessions.filter(s => s.id !== sessionId);
      // Reorder remaining sessions
      this.sessions = this.sessions.map((session, index) => ({
        ...session,
        orderIndex: index,
      }));
      this.dispatchSessionsChange();
    }
  }

  private saveSession() {
    if (!this.editingSession) return;

    const sessionIndex = this.sessions.findIndex(
      s => s.id === this.editingSession!.id,
    );

    if (sessionIndex >= 0) {
      // Update existing session
      this.sessions = this.sessions.map((session) =>
        session.id === this.editingSession!.id ? this.editingSession! : session,
      );
    } else {
      // Add new session
      this.sessions = [...this.sessions, this.editingSession];
    }

    this.showSessionModal = false;
    this.editingSession = undefined;
    this.dispatchSessionsChange();
  }

  private applyTemplate(template: SessionTemplate) {
    const newSession: WorkshopSession = {
      id: this.generateId(),
      workshopId: this.workshopId || '',
      titleI18n: template.name,
      descriptionI18n: template.description,
      type: template.type,
      startTime: new Date(),
      endTime: new Date(Date.now() + template.duration * 60000),
      duration: template.duration,
      orderIndex: this.sessions.length,
      materials: template.materials,
      isRequired: true,
      settings: template.settings,
    };

    this.sessions = [...this.sessions, newSession];
    this.showTemplatesPanel = false;
    this.dispatchSessionsChange();
  }

  private dispatchSessionsChange() {
    this.dispatchEvent(
      new CustomEvent('sessions-change', {
        detail: { sessions: this.sessions },
        bubbles: true,
      }),
    );
  }

  private generateId(): string {
    return 'session_' + Math.random().toString(36).substr(2, 9);
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
    });
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

  private calculateTotalDuration(): number {
    return this.sessions.reduce(
      (total, session) => total + session.duration,
      0,
    );
  }

  private getSessionTypeIcon(type: SessionType): string {
    const icons: Record<SessionType, string> = {
      introduction: '👋',
      activity: '🎯',
      discussion: '💬',
      break: '☕',
      presentation: '📊',
      exercise: '✏️',
      conclusion: '🎉',
      feedback: '📝',
      custom: '⚙️',
    };
    return icons[type] || '📋';
  }

  private renderSessionModal() {
    if (!this.showSessionModal || !this.editingSession) return html``;

    return html`
      <div class="session-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">
              ${this.editingSession.id ? 'Edit Session' : 'Add Session'}
            </h2>
            <button
              class="modal-close"
              @click=${() => {
    this.showSessionModal = false;
    this.editingSession = undefined;
  }}
            >
              ×
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Session Type</label>
              <select
                class="form-select"
                .value=${this.editingSession.type}
                @change=${(e: Event) => {
    const target = e.target as HTMLSelectElement;
    this.editingSession = {
      ...this.editingSession!,
      type: target.value as SessionType,
      titleI18n: (
                      this.sessionTypeDefaults[target.value as SessionType]
                        .titleI18n || this.editingSession!.titleI18n
                    ) as Record<Language, string>,
      descriptionI18n: (
                      this.sessionTypeDefaults[target.value as SessionType]
                        .descriptionI18n ||
                      this.editingSession!.descriptionI18n
                    ) as Record<Language, string>,
      duration:
                      this.sessionTypeDefaults[target.value as SessionType]
                        .duration || this.editingSession!.duration,
    };
  }}
              >
                <option value="introduction">Introduction</option>
                <option value="activity">Activity</option>
                <option value="discussion">Discussion</option>
                <option value="break">Break</option>
                <option value="presentation">Presentation</option>
                <option value="exercise">Exercise</option>
                <option value="conclusion">Conclusion</option>
                <option value="feedback">Feedback</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label"
                >Title (${this.language.toUpperCase()})</label
              >
              <input
                type="text"
                class="form-input"
                .value=${this.editingSession.titleI18n[this.language] || ''}
                @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.editingSession = {
      ...this.editingSession!,
      titleI18n: {
        ...this.editingSession!.titleI18n,
        [this.language]: target.value,
      },
    };
  }}
              />
            </div>

            <div class="form-group">
              <label class="form-label"
                >Description (${this.language.toUpperCase()})</label
              >
              <textarea
                class="form-textarea"
                rows="3"
                .value=${this.editingSession.descriptionI18n?.[this.language] ||
                ''}
                @input=${(e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    this.editingSession = {
      ...this.editingSession!,
      descriptionI18n: {
        ...(this.editingSession!.descriptionI18n || {}),
        [this.language]: target.value,
      } as Record<Language, string>,
    };
  }}
              ></textarea>
            </div>

            <div class="duration-input-group">
              <div class="form-group">
                <label class="form-label">Duration (minutes)</label>
                <input
                  type="number"
                  class="form-input"
                  min="5"
                  max="480"
                  .value=${this.editingSession.duration}
                  @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.editingSession = {
      ...this.editingSession!,
      duration: parseInt(target.value) || 60,
    };
  }}
                />
              </div>

              <div class="form-group">
                <label class="form-label">Max Participants</label>
                <input
                  type="number"
                  class="form-input"
                  min="1"
                  placeholder="Unlimited"
                  .value=${this.editingSession.maxParticipants || ''}
                  @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.editingSession = {
      ...this.editingSession!,
      maxParticipants: target.value
        ? parseInt(target.value)
        : undefined,
    };
  }}
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <input
                  type="checkbox"
                  .checked=${this.editingSession.isRequired}
                  @change=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.editingSession = {
      ...this.editingSession!,
      isRequired: target.checked,
    };
  }}
                />
                Required session
              </label>
            </div>

            <div class="form-group">
              <label class="form-label">Location</label>
              <input
                type="text"
                class="form-input"
                placeholder="Main room"
                .value=${this.editingSession.location || ''}
                @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.editingSession = {
      ...this.editingSession!,
      location: target.value,
    };
  }}
              />
            </div>
          </div>

          <div class="modal-footer">
            <button
              class="btn btn-secondary"
              @click=${() => {
    this.showSessionModal = false;
    this.editingSession = undefined;
  }}
            >
              Cancel
            </button>
            <button class="btn btn-primary" @click=${this.saveSession}>
              Save Session
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderTemplatesPanel() {
    if (!this.showTemplatesPanel) return html``;

    return html`
      <div class="session-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">Session Templates</h2>
            <button
              class="modal-close"
              @click=${() => (this.showTemplatesPanel = false)}
            >
              ×
            </button>
          </div>

          <div class="modal-body">
            <div class="templates-grid">
              ${this.templates.map(
    template => html`
                  <div
                    class="template-card"
                    @click=${() => this.applyTemplate(template)}
                  >
                    <div class="template-name">
                      ${template.name[this.language]}
                    </div>
                    <div class="template-duration">
                      ${template.duration} minutes
                    </div>
                    <div>
                      ${this.getSessionTypeIcon(template.type)} ${template.type}
                    </div>
                  </div>
                `,
  )}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  protected override render() {
    const totalDuration = this.calculateTotalDuration();

    return html`
      <div class="session-manager">
        <!-- Header -->
        <div class="manager-header">
          <h2 class="manager-title">📅 Workshop Sessions</h2>

          <div class="manager-stats">
            <div class="stat-item">
              <span class="stat-value">${this.sessions.length}</span>
              <span>Sessions</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${totalDuration}</span>
              <span>Minutes Total</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${Math.ceil(totalDuration / 60)}</span>
              <span>Hours</span>
            </div>
          </div>
        </div>

        <!-- Control Panel -->
        <div class="control-panel">
          <button
            class="add-session-btn"
            @click=${() => this.addSession('activity')}
          >
            ➕ Add Session
          </button>

          <button
            class="template-btn"
            @click=${() => (this.showTemplatesPanel = true)}
          >
            📋 Use Template
          </button>

          <div class="view-toggle">
            <button
              class="view-btn ${classMap({
    active: this.viewMode === 'timeline',
  })}"
              @click=${() => (this.viewMode = 'timeline')}
            >
              Timeline
            </button>
            <button
              class="view-btn ${classMap({ active: this.viewMode === 'list' })}"
              @click=${() => (this.viewMode = 'list')}
            >
              List
            </button>
          </div>
        </div>

        <!-- Content -->
        ${this.sessions.length === 0
    ? html`
              <!-- Empty State -->
              <div class="empty-state">
                <div class="empty-icon">📅</div>
                <div class="empty-title">No sessions yet</div>
                <div class="empty-description">
                  Start building your workshop by adding your first session
                </div>
                <button
                  class="add-session-btn"
                  @click=${() => this.addSession('introduction')}
                >
                  ➕ Add Your First Session
                </button>
              </div>
            `
    : html`
              ${this.viewMode === 'timeline'
    ? this.renderTimelineView()
    : this.renderListView()}
            `}

        <!-- Session Modal -->
        ${this.renderSessionModal()}

        <!-- Templates Panel -->
        ${this.renderTemplatesPanel()}
      </div>
    `;
  }

  private renderTimelineView() {
    return html`
      <div class="timeline-container">
        <div class="timeline">
          ${this.sessions.map((session, index) => {
    const startTime = this.calculateSessionStartTime(session);
    const endTime = new Date(
      startTime.getTime() + session.duration * 60000,
    );

    return html`
              <div
                class="session-item ${classMap({
    'session-break': session.type === 'break',
  })}"
                data-session-id=${session.id}
              >
                <div class="session-connector"></div>

                <div class="session-header">
                  <div class="session-title-section">
                    <span class="session-number">${index + 1}</span>
                    <h3 class="session-title">
                      ${session.titleI18n[this.language]}
                    </h3>
                    <span class="session-type">
                      ${this.getSessionTypeIcon(session.type)} ${session.type}
                    </span>
                  </div>

                  <div class="session-actions">
                    <button
                      class="session-action-btn"
                      @click=${() => this.editSession(session.id)}
                      title="Edit session"
                    >
                      ✏️
                    </button>
                    <button
                      class="session-action-btn delete"
                      @click=${() => this.deleteSession(session.id)}
                      title="Delete session"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div class="session-content">
                  <div class="session-info">
                    ${session.descriptionI18n?.[this.language]
    ? html`
                          <div class="session-description">
                            ${session.descriptionI18n[this.language]}
                          </div>
                        `
    : ''}

                    <div class="session-meta">
                      <div class="session-duration">
                        ⏱️ ${session.duration} minutes
                      </div>
                      ${session.location
    ? html`
                            <div class="session-location">
                              📍 ${session.location}
                            </div>
                          `
    : ''}
                      ${session.maxParticipants
    ? html`
                            <div class="session-participants">
                              👥 Max ${session.maxParticipants}
                            </div>
                          `
    : ''}
                    </div>
                  </div>

                  <div class="session-timing">
                    <div class="session-start">
                      Start: ${this.formatTime(startTime)}
                    </div>
                    <div class="session-end">
                      End: ${this.formatTime(endTime)}
                    </div>
                  </div>
                </div>
              </div>
            `;
  })}
        </div>
      </div>
    `;
  }

  private renderListView() {
    return html`
      <div class="list-view">
        ${this.sessions.map((session, index) => {
    const startTime = this.calculateSessionStartTime(session);
    const endTime = new Date(
      startTime.getTime() + session.duration * 60000,
    );

    return html`
            <div class="list-item">
              <div class="drag-handle">☰</div>

              <div>
                <div
                  style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;"
                >
                  <span style="font-weight: 600; color: #3b82f6;"
                    >${index + 1}.</span
                  >
                  <span style="font-weight: 600;"
                    >${session.titleI18n[this.language]}</span
                  >
                  <span class="session-type">
                    ${this.getSessionTypeIcon(session.type)} ${session.type}
                  </span>
                </div>

                ${session.descriptionI18n?.[this.language]
    ? html`
                      <div
                        style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.5rem;"
                      >
                        ${session.descriptionI18n[this.language]}
                      </div>
                    `
    : ''}

                <div class="session-meta">
                  <div class="session-duration">⏱️ ${session.duration} min</div>
                  <div class="session-time">
                    🕐 ${this.formatTime(startTime)} -
                    ${this.formatTime(endTime)}
                  </div>
                  ${session.location
    ? html`
                        <div class="session-location">
                          📍 ${session.location}
                        </div>
                      `
    : ''}
                </div>
              </div>

              <div style="text-align: center;">
                <div style="font-size: 0.813rem; color: #6b7280;">Required</div>
                <div style="font-weight: 600; color: #374151;">
                  ${session.isRequired ? 'Yes' : 'No'}
                </div>
              </div>

              <div class="session-actions">
                <button
                  class="session-action-btn"
                  @click=${() => this.editSession(session.id)}
                  title="Edit session"
                >
                  ✏️
                </button>
                <button
                  class="session-action-btn delete"
                  @click=${() => this.deleteSession(session.id)}
                  title="Delete session"
                >
                  🗑️
                </button>
              </div>
            </div>
          `;
  })}
      </div>
    `;
  }
}

// Register the custom element
if (!customElements.get('session-manager')) {
  customElements.define('session-manager', SessionManager);
}
