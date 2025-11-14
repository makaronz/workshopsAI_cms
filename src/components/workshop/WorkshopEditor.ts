/**
 * Workshop Editor Web Component
 * Main editor interface for creating and managing workshops with drag-and-drop functionality
 * Connects to backend APIs and provides comprehensive workshop creation workflow
 */

import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { updateWhenLocaleChanges } from '@lit/localize';

import {
  WorkshopData,
  WorkshopSession,
  WorkshopTemplate,
  PublishingChecklist,
  AutoSaveStatus,
  EditorUIState,
  Language,
  TemplateCategory,
} from './WorkshopTypes.js';

import { translations } from '../../i18n/translations.js';
import { AutoSaveManager } from '../../services/AutoSaveManager.js';
import { OfflineStorage } from '../../services/offlineStorage.js';

/**
 * Main workshop editor component
 */
@customElement('workshop-editor')
export class WorkshopEditor extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #374151;
      --primary-color: #3b82f6;
      --primary-hover: #2563eb;
      --secondary-color: #6b7280;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --error-color: #ef4444;
      --border-color: #e5e7eb;
      --background-color: #f9fafb;
      --card-background: #ffffff;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --border-radius: 8px;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
      --transition: all 0.2s ease-in-out;
    }

    * {
      box-sizing: border-box;
    }

    .editor-container {
      display: grid;
      grid-template-columns: 280px 1fr 320px;
      height: 100vh;
      background: var(--background-color);
    }

    /* Sidebar Navigation */
    .sidebar {
      background: var(--card-background);
      border-right: 1px solid var(--border-color);
      padding: 1.5rem 1rem;
      overflow-y: auto;
      position: relative;
    }

    .sidebar.collapsed {
      grid-column: 1;
      width: 60px;
      padding: 1rem 0.5rem;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
      padding: 0.5rem;
      border-radius: var(--border-radius);
      font-weight: 700;
      font-size: 1.125rem;
      color: var(--text-primary);
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--primary-color), #8b5cf6);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      flex-shrink: 0;
    }

    .logo-text {
      transition: opacity 0.2s;
    }

    .sidebar.collapsed .logo-text {
      opacity: 0;
      width: 0;
      overflow: hidden;
    }

    .nav-menu {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .nav-item {
      margin-bottom: 0.25rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--border-radius);
      text-decoration: none;
      color: var(--text-secondary);
      transition: var(--transition);
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .nav-link:hover {
      background: var(--background-color);
      color: var(--text-primary);
    }

    .nav-link.active {
      background: var(--primary-color);
      color: white;
    }

    .nav-link.active:hover {
      background: var(--primary-hover);
    }

    .nav-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .nav-text {
      transition: opacity 0.2s;
    }

    .sidebar.collapsed .nav-text {
      opacity: 0;
      width: 0;
      overflow: hidden;
    }

    /* Main Content Area */
    .main-content {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .header {
      background: var(--card-background);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-sm);
      position: relative;
      z-index: 10;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .toggle-sidebar {
      background: none;
      border: none;
      padding: 0.5rem;
      border-radius: var(--border-radius);
      cursor: pointer;
      color: var(--text-secondary);
      transition: var(--transition);
    }

    .toggle-sidebar:hover {
      background: var(--background-color);
      color: var(--text-primary);
    }

    .workshop-title-input {
      font-size: 1.25rem;
      font-weight: 600;
      border: 1px solid transparent;
      padding: 0.5rem 0.75rem;
      border-radius: var(--border-radius);
      background: transparent;
      color: var(--text-primary);
      transition: var(--transition);
      min-width: 300px;
    }

    .workshop-title-input:hover {
      background: var(--background-color);
    }

    .workshop-title-input:focus {
      outline: none;
      border-color: var(--primary-color);
      background: var(--card-background);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .language-switcher {
      display: flex;
      background: var(--background-color);
      border-radius: var(--border-radius);
      padding: 0.25rem;
      gap: 0.25rem;
    }

    .lang-button {
      padding: 0.5rem 0.75rem;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .lang-button.active {
      background: var(--card-background);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }

    .save-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--border-radius);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .save-status.saving {
      background: #fef3c7;
      color: #92400e;
    }

    .save-status.saved {
      background: #d1fae5;
      color: #065f46;
    }

    .save-status.error {
      background: #fee2e2;
      color: #991b1b;
    }

    .save-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .btn {
      padding: 0.625rem 1.25rem;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
    }

    .btn-primary {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-hover);
      border-color: var(--primary-hover);
    }

    .btn-secondary {
      background: var(--card-background);
      color: var(--text-primary);
    }

    .btn-secondary:hover {
      background: var(--background-color);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Content Area */
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .tab-content {
      display: none;
      animation: fadeIn 0.2s ease-in-out;
    }

    .tab-content.active {
      display: block;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Form Styles */
    .form-section {
      background: var(--card-background);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-sm);
      margin-bottom: 1.5rem;
      overflow: hidden;
    }

    .section-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
      background: var(--background-color);
    }

    .section-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-content {
      padding: 1.5rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .required-indicator {
      color: var(--error-color);
    }

    .form-input,
    .form-textarea,
    .form-select {
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: 0.875rem;
      transition: var(--transition);
      background: var(--card-background);
      color: var(--text-primary);
    }

    .form-input:focus,
    .form-textarea:focus,
    .form-select:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 100px;
    }

    .form-help {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .form-error {
      font-size: 0.75rem;
      color: var(--error-color);
    }

    /* Right Sidebar */
    .right-sidebar {
      background: var(--card-background);
      border-left: 1px solid var(--border-color);
      padding: 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .sidebar-section {
      background: var(--background-color);
      border-radius: var(--border-radius);
      padding: 1rem;
    }

    .sidebar-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 1rem 0;
    }

    /* Checklist Styles */
    .checklist {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .checklist-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.5rem;
      border-radius: var(--border-radius);
      transition: var(--transition);
    }

    .checklist-item:hover {
      background: var(--card-background);
    }

    .checklist-checkbox {
      width: 18px;
      height: 18px;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
      flex-shrink: 0;
      margin-top: 2px;
    }

    .checklist-checkbox.checked {
      background: var(--success-color);
      border-color: var(--success-color);
      color: white;
    }

    .checklist-text {
      flex: 1;
      font-size: 0.813rem;
      color: var(--text-primary);
      line-height: 1.4;
    }

    .checklist-text.optional {
      color: var(--text-secondary);
    }

    /* Progress Indicator */
    .progress-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .progress-bar {
      height: 8px;
      background: var(--border-color);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(
        90deg,
        var(--success-color),
        var(--primary-color)
      );
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-stats {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    /* Quick Actions */
    .quick-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .quick-action {
      padding: 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--card-background);
      color: var(--text-primary);
      text-decoration: none;
      font-size: 0.813rem;
      font-weight: 500;
      text-align: center;
      transition: var(--transition);
      cursor: pointer;
      border: none;
    }

    .quick-action:hover {
      background: var(--background-color);
      border-color: var(--primary-color);
    }

    .quick-action.primary {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
      grid-column: 1 / -1;
    }

    .quick-action.primary:hover {
      background: var(--primary-hover);
    }

    /* Responsive Design */
    @media (max-width: 1200px) {
      .editor-container {
        grid-template-columns: 60px 1fr;
      }

      .right-sidebar {
        position: fixed;
        right: -320px;
        top: 0;
        height: 100vh;
        width: 320px;
        z-index: 100;
        box-shadow: var(--shadow-lg);
        transition: right 0.3s ease;
      }

      .right-sidebar.open {
        right: 0;
      }

      .sidebar {
        padding: 1rem 0.5rem;
      }
    }

    @media (max-width: 768px) {
      .editor-container {
        grid-template-columns: 1fr;
      }

      .sidebar {
        position: fixed;
        left: -280px;
        top: 0;
        height: 100vh;
        width: 280px;
        z-index: 100;
        box-shadow: var(--shadow-lg);
        transition: left 0.3s ease;
      }

      .sidebar.open {
        left: 0;
      }

      .sidebar.collapsed {
        display: none;
      }

      .header {
        padding: 0.75rem 1rem;
      }

      .workshop-title-input {
        min-width: 200px;
        font-size: 1rem;
      }

      .content {
        padding: 1rem;
      }

      .form-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .quick-actions {
        grid-template-columns: 1fr;
      }
    }

    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    @media (prefers-contrast: high) {
      :host {
        --border-color: #000000;
        --text-secondary: #000000;
      }

      .form-input,
      .form-textarea,
      .form-select {
        border-width: 2px;
      }

      .btn {
        border-width: 2px;
      }
    }

    /* Loading State */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--border-color);
      border-top: 4px solid var(--primary-color);
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

    /* Print Styles */
    @media print {
      .sidebar,
      .right-sidebar,
      .header {
        display: none;
      }

      .editor-container {
        grid-template-columns: 1fr;
        height: auto;
      }

      .content {
        overflow: visible;
        padding: 0;
      }

      .form-section {
        break-inside: avoid;
        box-shadow: none;
        border: 1px solid #000;
      }
    }
  `;

  // Properties
  @property({ type: String }) workshopId?: string;
  @property({ type: Object }) workshopData: WorkshopData = {
    slug: '',
    titleI18n: { pl: '', en: '' },
    descriptionI18n: { pl: '', en: '' },
    status: 'draft',
    language: 'pl',
    materials: [],
  };

  // Internal state
  @state() private currentLanguage: Language = 'pl';
  @state() private uiState: EditorUIState = {
    activeTab: 'basic',
    isDirty: false,
    isSaving: false,
    isValid: false,
    previewMode: {
      mode: 'participant',
      language: 'pl',
      showSessionDetails: true,
      showMaterials: true,
      showTimings: true,
      showProgress: true,
      includeQuestionnaires: true,
    },
    sidebarCollapsed: false,
    showValidation: false,
    language: 'pl',
    accessibilityMode: false,
  };
  @state() private sessions: WorkshopSession[] = [];
  @state() private selectedTemplate?: WorkshopTemplate;
  @state() private publishingChecklist?: PublishingChecklist;
  @state() private autoSaveStatus: AutoSaveStatus = {
    isEnabled: true,
    isSaving: false,
    hasUnsavedChanges: false,
    saveCount: 0,
    conflictCount: 0,
  };

  // Services
  private autoSaveManager?: AutoSaveManager;
  private offlineStorage?: OfflineStorage;

  // Component queries
  @query('.main-content') mainContent!: HTMLElement;
  @query('.right-sidebar') rightSidebar!: HTMLElement;

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  override async connectedCallback() {
    super.connectedCallback();
    await this.initializeServices();
    await this.loadWorkshopData();
    this.setupEventListeners();
    this.startAutoSave();
  }

  override disconnectedCallback() {
    this.cleanup();
    super.disconnectedCallback();
  }

  private async initializeServices() {
    try {
      this.offlineStorage = new OfflineStorage();
      this.autoSaveManager = new AutoSaveManager({
        interval: 30000, // 30 seconds
        debounceMs: 1000,
        maxRetries: 3,
        conflictResolution: 'merge',
        storage: 'hybrid',
        onSave: this.handleAutoSave.bind(this),
        onError: this.handleSaveError.bind(this),
        onConflict: this.handleSaveConflict.bind(this),
      });
    } catch (error) {
      console.error('Failed to initialize services:', error);
      this.showError('Failed to initialize workshop editor');
    }
  }

  private async loadWorkshopData() {
    try {
      if (this.workshopId) {
        // Load existing workshop from API
        const response = await fetch(`/api/v1/workshops/${this.workshopId}`);
        if (!response.ok) {
          throw new Error('Failed to load workshop');
        }
        const data = await response.json();
        this.workshopData = data.data;
        this.sessions = data.data.sessions || [];
      } else {
        // Create new workshop with defaults
        this.workshopData = {
          slug: '',
          titleI18n: { pl: '', en: '' },
          descriptionI18n: { pl: '', en: '' },
          status: 'draft',
          language: 'pl',
          materials: [],
        };
      }

      this.validateWorkshop();
    } catch (error) {
      console.error('Failed to load workshop data:', error);
      this.showError('Failed to load workshop data');
    }
  }

  private setupEventListeners() {
    // Global keyboard shortcuts
    document.addEventListener(
      'keydown',
      this.handleKeyboardShortcuts.bind(this),
    );

    // Beforeunload to warn about unsaved changes
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // Online/offline detection
    window.addEventListener('online', this.handleOnlineStatus.bind(this));
    window.addEventListener('offline', this.handleOfflineStatus.bind(this));
  }

  private handleKeyboardShortcuts(event: KeyboardEvent) {
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

    // Escape to close modals or sidebars
    if (event.key === 'Escape') {
      this.closeModals();
    }
  }

  private handleBeforeUnload(event: BeforeUnloadEvent) {
    if (this.uiState.isDirty && this.autoSaveStatus.hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue =
        'You have unsaved changes. Are you sure you want to leave?';
    }
  }

  private handleOnlineStatus() {
    this.showSuccess('Connection restored');
    this.autoSaveManager?.resume();
  }

  private handleOfflineStatus() {
    this.showWarning('Connection lost. Working in offline mode.');
    this.autoSaveManager?.pause();
  }

  private startAutoSave() {
    if (this.autoSaveManager && this.autoSaveStatus.isEnabled) {
      this.autoSaveManager.start();
    }
  }

  private async handleAutoSave(): Promise<void> {
    this.autoSaveStatus = { ...this.autoSaveStatus, isSaving: true };

    try {
      await this.saveWorkshop(true); // silent save
      this.autoSaveStatus = {
        ...this.autoSaveStatus,
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
        saveCount: this.autoSaveStatus.saveCount + 1,
      };
    } catch (error) {
      this.autoSaveStatus = {
        ...this.autoSaveStatus,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Save failed',
      };
      throw error;
    }
  }

  private handleSaveError(error: Error): void {
    console.error('Auto-save error:', error);
    this.autoSaveStatus = {
      ...this.autoSaveStatus,
      isSaving: false,
      error: error.message,
    };
    this.showError('Auto-save failed: ' + error.message);
  }

  private handleSaveConflict(conflict: any): void {
    console.warn('Save conflict detected:', conflict);
    this.autoSaveStatus = {
      ...this.autoSaveStatus,
      conflictCount: this.autoSaveStatus.conflictCount + 1,
    };

    // Show conflict resolution dialog
    this.showConflictResolution(conflict);
  }

  private async saveWorkshop(silent = false): Promise<void> {
    if (this.uiState.isSaving) return;

    this.uiState = { ...this.uiState, isSaving: true };

    try {
      const url = this.workshopId
        ? `/api/v1/workshops/${this.workshopId}`
        : '/api/v1/workshops';

      const method = this.workshopId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...this.workshopData,
          sessions: this.sessions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save workshop');
      }

      const data = await response.json();

      if (!this.workshopId) {
        this.workshopId = data.data.id;
        this.workshopData = data.data;
      }

      this.uiState = { ...this.uiState, isDirty: false, isSaving: false };

      if (!silent) {
        this.showSuccess('Workshop saved successfully');
      }
    } catch (error) {
      this.uiState = { ...this.uiState, isSaving: false };
      if (!silent) {
        this.showError('Failed to save workshop');
      }
      throw error;
    }
  }

  private async validateWorkshop(): Promise<boolean> {
    try {
      if (!this.workshopId) return false;

      const response = await fetch(
        `/api/v1/workshops/${this.workshopId}/publish-checklist`,
      );
      if (!response.ok) {
        throw new Error('Failed to validate workshop');
      }

      const data = await response.json();
      this.publishingChecklist = data.data;

      const isValid = this.publishingChecklist.canPublish;
      this.uiState = { ...this.uiState, isValid };

      return isValid;
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  }

  private async publishWorkshop(): Promise<void> {
    if (!this.workshopId) return;

    // Validate before publishing
    const isValid = await this.validateWorkshop();
    if (!isValid) {
      this.showError('Please fix validation errors before publishing');
      return;
    }

    try {
      const response = await fetch(`/api/v1/workshops/${this.workshopId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'published',
          publishedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to publish workshop');
      }

      this.workshopData = { ...this.workshopData, status: 'published' };
      this.showSuccess('Workshop published successfully');
    } catch (error) {
      this.showError('Failed to publish workshop');
    }
  }

  private updateWorkshopData(field: keyof WorkshopData, value: any) {
    this.workshopData = { ...this.workshopData, [field]: value };
    this.uiState = { ...this.uiState, isDirty: true };
    this.autoSaveManager?.triggerSave();
    this.validateWorkshop();
  }

  private switchTab(tab: EditorUIState['activeTab']) {
    this.uiState = { ...this.uiState, activeTab: tab };
  }

  private toggleSidebar() {
    this.uiState = {
      ...this.uiState,
      sidebarCollapsed: !this.uiState.sidebarCollapsed,
    };
  }

  private togglePreview() {
    this.uiState = { ...this.uiState, activeTab: 'preview' };
  }

  private closeModals() {
    // Close any open modals or sidebars
    const sidebar = this.rightSidebar;
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
    }
  }

  private switchLanguage(language: Language) {
    this.currentLanguage = language;
    this.uiState = { ...this.uiState, language };
    document.documentElement.lang = language;
  }

  private showSuccess(message: string) {
    // Implementation would show a success notification
    console.log('Success:', message);
  }

  private showError(message: string) {
    // Implementation would show an error notification
    console.error('Error:', message);
  }

  private showWarning(message: string) {
    // Implementation would show a warning notification
    console.warn('Warning:', message);
  }

  private showConflictResolution(conflict: any) {
    // Implementation would show a conflict resolution dialog
    console.log('Conflict detected:', conflict);
  }

  private cleanup() {
    this.autoSaveManager?.stop();
    document.removeEventListener(
      'keydown',
      this.handleKeyboardShortcuts.bind(this),
    );
    window.removeEventListener(
      'beforeunload',
      this.handleBeforeUnload.bind(this),
    );
  }

  protected override render() {
    const { activeTab, isDirty, isSaving, sidebarCollapsed } = this.uiState;
    const { autoSaveStatus } = this;

    return html`
      <div class="editor-container">
        <!-- Left Sidebar Navigation -->
        <aside class="sidebar ${classMap({ collapsed: sidebarCollapsed })}">
          <div class="logo">
            <div class="logo-icon">W</div>
            <div class="logo-text">Workshop Editor</div>
          </div>

          <nav>
            <ul class="nav-menu">
              <li class="nav-item">
                <button
                  class="nav-link ${classMap({
    active: activeTab === 'basic',
  })}"
                  @click=${() => this.switchTab('basic')}
                >
                  <span class="nav-icon">📝</span>
                  <span class="nav-text">Basic Info</span>
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link ${classMap({
    active: activeTab === 'sessions',
  })}"
                  @click=${() => this.switchTab('sessions')}
                >
                  <span class="nav-icon">📅</span>
                  <span class="nav-text">Sessions</span>
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link ${classMap({
    active: activeTab === 'materials',
  })}"
                  @click=${() => this.switchTab('materials')}
                >
                  <span class="nav-icon">📁</span>
                  <span class="nav-text">Materials</span>
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link ${classMap({
    active: activeTab === 'questionnaires',
  })}"
                  @click=${() => this.switchTab('questionnaires')}
                >
                  <span class="nav-icon">📋</span>
                  <span class="nav-text">Questionnaires</span>
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link ${classMap({
    active: activeTab === 'preview',
  })}"
                  @click=${() => this.switchTab('preview')}
                >
                  <span class="nav-icon">👁️</span>
                  <span class="nav-text">Preview</span>
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link ${classMap({
    active: activeTab === 'settings',
  })}"
                  @click=${() => this.switchTab('settings')}
                >
                  <span class="nav-icon">⚙️</span>
                  <span class="nav-text">Settings</span>
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <!-- Main Content Area -->
        <main class="main-content">
          <!-- Header -->
          <header class="header">
            <div class="header-left">
              <button
                class="toggle-sidebar"
                @click=${this.toggleSidebar}
                aria-label="Toggle sidebar"
              >
                ☰
              </button>
              <input
                type="text"
                class="workshop-title-input"
                placeholder="Workshop Title"
                value=${this.workshopData.titleI18n[this.currentLanguage] || ''}
                @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.updateWorkshopData('titleI18n', {
      ...this.workshopData.titleI18n,
      [this.currentLanguage]: target.value,
    });
  }}
              />
            </div>

            <div class="header-actions">
              <!-- Language Switcher -->
              <div class="language-switcher">
                <button
                  class="lang-button ${classMap({
    active: this.currentLanguage === 'pl',
  })}"
                  @click=${() => this.switchLanguage('pl')}
                >
                  PL
                </button>
                <button
                  class="lang-button ${classMap({
    active: this.currentLanguage === 'en',
  })}"
                  @click=${() => this.switchLanguage('en')}
                >
                  EN
                </button>
              </div>

              <!-- Save Status -->
              <div
                class="save-status ${classMap({
    saving: autoSaveStatus.isSaving,
    saved: autoSaveStatus.lastSaved && !autoSaveStatus.error,
    error: autoSaveStatus.error,
  })}"
              >
                <div class="save-indicator"></div>
                <span>
                  ${autoSaveStatus.isSaving
    ? 'Saving...'
    : autoSaveStatus.lastSaved
      ? 'Saved'
      : autoSaveStatus.error
        ? 'Error'
        : 'Ready'}
                </span>
              </div>

              <!-- Action Buttons -->
              <button
                class="btn btn-secondary"
                @click=${() => this.saveWorkshop()}
                ?disabled=${isSaving || !isDirty}
              >
                💾 Save
              </button>

              <button
                class="btn btn-primary"
                @click=${() => this.publishWorkshop()}
                ?disabled=${!this.uiState.isValid || isSaving}
              >
                🚀 Publish
              </button>
            </div>
          </header>

          <!-- Content Area -->
          <div class="content">
            <!-- Basic Information Tab -->
            <div
              class="tab-content ${classMap({ active: activeTab === 'basic' })}"
            >
              <div class="form-section">
                <div class="section-header">
                  <h2 class="section-title">📋 Basic Information</h2>
                </div>
                <div class="section-content">
                  <div class="form-grid">
                    <div class="form-group">
                      <label class="form-label">
                        Slug
                        <span class="required-indicator">*</span>
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        placeholder="workshop-url-slug"
                        value=${this.workshopData.slug || ''}
                        @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.updateWorkshopData('slug', target.value);
  }}
                      />
                      <div class="form-help">
                        URL-friendly identifier for the workshop
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label"> Status </label>
                      <select
                        class="form-select"
                        .value=${this.workshopData.status}
                        @change=${(e: Event) => {
    const target = e.target as HTMLSelectElement;
    this.updateWorkshopData(
      'status',
                            target.value as WorkshopData['status'],
    );
  }}
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div class="form-group">
                      <label class="form-label">
                        Subtitle (${this.currentLanguage.toUpperCase()})
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        placeholder="Workshop subtitle"
                        value=${this.workshopData.subtitleI18n?.[
    this.currentLanguage
  ] || ''}
                        @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.updateWorkshopData('subtitleI18n', {
      ...this.workshopData.subtitleI18n,
      [this.currentLanguage]: target.value,
    });
  }}
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label"> Language </label>
                      <select
                        class="form-select"
                        .value=${this.workshopData.language}
                        @change=${(e: Event) => {
    const target = e.target as HTMLSelectElement;
    this.updateWorkshopData(
      'language',
                            target.value as Language,
    );
  }}
                      >
                        <option value="pl">Polish</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-group" style="margin-top: 1.5rem;">
                    <label class="form-label">
                      Description (${this.currentLanguage.toUpperCase()})
                      <span class="required-indicator">*</span>
                    </label>
                    <textarea
                      class="form-textarea"
                      placeholder="Describe your workshop..."
                      rows="4"
                      value=${this.workshopData.descriptionI18n[
    this.currentLanguage
  ] || ''}
                      @input=${(e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    this.updateWorkshopData('descriptionI18n', {
      ...this.workshopData.descriptionI18n,
      [this.currentLanguage]: target.value,
    });
  }}
                    ></textarea>
                  </div>

                  <div class="form-grid" style="margin-top: 1.5rem;">
                    <div class="form-group">
                      <label class="form-label"> Start Date </label>
                      <input
                        type="datetime-local"
                        class="form-input"
                        value=${this.workshopData.startDate
    ? new Date(this.workshopData.startDate)
      .toISOString()
      .slice(0, 16)
    : ''}
                        @change=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.updateWorkshopData(
      'startDate',
      target.value ? new Date(target.value) : undefined,
    );
  }}
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label"> End Date </label>
                      <input
                        type="datetime-local"
                        class="form-input"
                        value=${this.workshopData.endDate
    ? new Date(this.workshopData.endDate)
      .toISOString()
      .slice(0, 16)
    : ''}
                        @change=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.updateWorkshopData(
      'endDate',
      target.value ? new Date(target.value) : undefined,
    );
  }}
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label"> Seat Limit </label>
                      <input
                        type="number"
                        class="form-input"
                        placeholder="Unlimited"
                        min="1"
                        value=${this.workshopData.seatLimit || ''}
                        @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.updateWorkshopData(
      'seatLimit',
      target.value ? parseInt(target.value) : undefined,
    );
  }}
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label"> Template Theme </label>
                      <select
                        class="form-select"
                        .value=${this.workshopData.templateTheme || 'custom'}
                        @change=${(e: Event) => {
    const target = e.target as HTMLSelectElement;
    this.updateWorkshopData(
      'templateTheme',
                            target.value as WorkshopData['templateTheme'],
    );
  }}
                      >
                        <option value="custom">Custom</option>
                        <option value="integracja">Integration</option>
                        <option value="konflikty">Conflict Resolution</option>
                        <option value="well-being">Well-being</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sessions Tab -->
            <div
              class="tab-content ${classMap({
    active: activeTab === 'sessions',
  })}"
            >
              <session-manager
                .workshopId=${this.workshopId}
                .sessions=${this.sessions}
                .language=${this.currentLanguage}
                @sessions-change=${(e: CustomEvent) => {
    this.sessions = e.detail.sessions;
    this.uiState = { ...this.uiState, isDirty: true };
    this.autoSaveManager?.triggerSave();
  }}
              ></session-manager>
            </div>

            <!-- Materials Tab -->
            <div
              class="tab-content ${classMap({
    active: activeTab === 'materials',
  })}"
            >
              <resource-upload
                .workshopId=${this.workshopId}
                .materials=${this.workshopData.materials || []}
                .sessions=${this.sessions}
                @materials-change=${(e: CustomEvent) => {
    this.updateWorkshopData('materials', e.detail.materials);
  }}
              ></resource-upload>
            </div>

            <!-- Questionnaires Tab -->
            <div
              class="tab-content ${classMap({
    active: activeTab === 'questionnaires',
  })}"
            >
              <div class="form-section">
                <div class="section-header">
                  <h2 class="section-title">📋 Questionnaires</h2>
                </div>
                <div class="section-content">
                  <p>
                    Questionnaire management interface will be implemented here.
                  </p>
                  <p>Connect to existing questionnaire system.</p>
                </div>
              </div>
            </div>

            <!-- Preview Tab -->
            <div
              class="tab-content ${classMap({
    active: activeTab === 'preview',
  })}"
            >
              <workshop-preview
                .workshopData=${this.workshopData}
                .sessions=${this.sessions}
                .options=${this.uiState.previewMode}
                @options-change=${(e: CustomEvent) => {
    this.uiState = {
      ...this.uiState,
      previewMode: e.detail.options,
    };
  }}
              ></workshop-preview>
            </div>

            <!-- Settings Tab -->
            <div
              class="tab-content ${classMap({
    active: activeTab === 'settings',
  })}"
            >
              <div class="form-section">
                <div class="section-header">
                  <h2 class="section-title">⚙️ Settings</h2>
                </div>
                <div class="section-content">
                  <p>
                    Workshop settings and configuration options will be
                    implemented here.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        <!-- Right Sidebar -->
        <aside class="right-sidebar">
          <!-- Publishing Checklist -->
          ${this.publishingChecklist
    ? html`
                <div class="sidebar-section">
                  <h3 class="sidebar-title">Publishing Checklist</h3>
                  <div class="checklist">
                    ${this.publishingChecklist.sections.map(
    section => html`
                        <div class="checklist-item">
                          <div
                            class="checklist-checkbox ${classMap({
    checked: section.isComplete,
  })}"
                          >
                            ${section.isComplete ? '✓' : ''}
                          </div>
                          <div
                            class="checklist-text ${classMap({
    optional: !section.required,
  })}"
                          >
                            ${section.title[this.currentLanguage]}
                          </div>
                        </div>
                      `,
  )}
                  </div>
                </div>
              `
    : ''}

          <!-- Progress Indicator -->
          <div class="sidebar-section">
            <h3 class="sidebar-title">Progress</h3>
            <div class="progress-section">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  style=${styleMap({ width: '75%' })}
                ></div>
              </div>
              <div class="progress-stats">
                <span>75% Complete</span>
                <span>3 of 4 sections</span>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="sidebar-section">
            <h3 class="sidebar-title">Quick Actions</h3>
            <div class="quick-actions">
              <button
                class="quick-action"
                @click=${() => this.switchTab('sessions')}
              >
                Add Session
              </button>
              <button
                class="quick-action"
                @click=${() => this.switchTab('materials')}
              >
                Upload Files
              </button>
              <button class="quick-action" @click=${() => this.saveWorkshop()}>
                Save Draft
              </button>
              <button class="quick-action" @click=${this.togglePreview}>
                Preview
              </button>
              <button
                class="quick-action primary"
                @click=${() => this.publishWorkshop()}
                ?disabled=${!this.uiState.isValid}
              >
                Publish Workshop
              </button>
            </div>
          </div>
        </aside>
      </div>
    `;
  }
}

// Register the custom element
if (!customElements.get('workshop-editor')) {
  customElements.define('workshop-editor', WorkshopEditor);
}
