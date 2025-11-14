/**
 * Template Selector Web Component
 * Provides workshop template selection, preview, and customization functionality
 * Supports template categories, search, and custom template creation
 */

import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import {
  WorkshopTemplate,
  TemplateCategory,
  Language,
} from './WorkshopTypes.js';

/**
 * Template Selector Component
 */
@customElement('template-selector')
export class TemplateSelector extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .template-selector {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* Search and Filter Header */
    .search-header {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .search-bar {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .search-input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .search-btn {
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .search-btn:hover {
      background: #2563eb;
    }

    /* Filter Controls */
    .filter-controls {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .category-filter {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .category-chip {
      padding: 0.5rem 1rem;
      background: #f3f4f6;
      border: 1px solid transparent;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
    }

    .category-chip:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .category-chip.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }

    .sort-select {
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.875rem;
      background: white;
      cursor: pointer;
    }

    .view-toggle {
      display: flex;
      background: #f3f4f6;
      border-radius: 6px;
      padding: 0.25rem;
      gap: 0.25rem;
      margin-left: auto;
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

    /* Templates Grid */
    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .templates-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Template Card */
    .template-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    }

    .template-card:hover {
      border-color: #3b82f6;
      box-shadow: 0 10px 25px rgba(59, 130, 246, 0.15);
      transform: translateY(-2px);
    }

    .template-card.selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .template-thumbnail {
      height: 160px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
      overflow: hidden;
    }

    .template-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .template-badge {
      position: absolute;
      top: 1rem;
      right: 1rem;
      padding: 0.375rem 0.75rem;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      backdrop-filter: blur(10px);
    }

    .template-content {
      padding: 1.25rem;
    }

    .template-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .template-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
      line-height: 1.3;
    }

    .template-rating {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .template-description {
      color: #6b7280;
      font-size: 0.875rem;
      line-height: 1.5;
      margin-bottom: 1rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .template-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid #f3f4f6;
      font-size: 0.813rem;
      color: #6b7280;
    }

    .template-stats {
      display: flex;
      gap: 1rem;
    }

    .template-stat {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .template-actions {
      display: flex;
      gap: 0.5rem;
    }

    .template-action {
      padding: 0.375rem 0.75rem;
      background: #f3f4f6;
      border: none;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 500;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
    }

    .template-action:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .template-action.primary {
      background: #3b82f6;
      color: white;
    }

    .template-action.primary:hover {
      background: #2563eb;
    }

    /* Template List View */
    .template-list-item {
      display: flex;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s;
    }

    .template-list-item:hover {
      border-color: #3b82f6;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
    }

    .template-list-item.selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .template-list-thumbnail {
      width: 120px;
      height: 120px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      flex-shrink: 0;
    }

    .template-list-content {
      flex: 1;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .template-list-header {
      margin-bottom: 0.75rem;
    }

    .template-list-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
      margin: 0 0 0.5rem 0;
    }

    .template-list-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .template-list-description {
      color: #6b7280;
      font-size: 0.875rem;
      line-height: 1.4;
      margin-bottom: 1rem;
    }

    .template-list-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Template Modal */
    .template-modal {
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

    .template-modal.hidden {
      display: none;
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 800px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 700;
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
      border-radius: 6px;
      transition: all 0.2s;
    }

    .modal-close:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .modal-body {
      padding: 1.5rem;
      flex: 1;
      overflow-y: auto;
    }

    .modal-section {
      margin-bottom: 2rem;
    }

    .modal-section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .template-overview {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .overview-item {
      padding: 1rem;
      background: #f9fafb;
      border-radius: 8px;
      text-align: center;
    }

    .overview-label {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }

    .overview-value {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
    }

    .session-preview {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }

    .session-preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .session-preview-title {
      font-weight: 600;
      color: #111827;
    }

    .session-preview-duration {
      background: #f3f4f6;
      color: #6b7280;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.813rem;
    }

    .modal-footer {
      padding: 1.5rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
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

    .empty-action {
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .empty-action:hover {
      background: #2563eb;
    }

    /* Loading State */
    .loading-overlay {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 3rem;
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
      .search-bar {
        flex-direction: column;
      }

      .search-input {
        width: 100%;
      }

      .filter-controls {
        flex-direction: column;
        align-items: stretch;
      }

      .view-toggle {
        margin-left: 0;
        align-self: flex-end;
      }

      .templates-grid {
        grid-template-columns: 1fr;
      }

      .template-list-item {
        flex-direction: column;
      }

      .template-list-thumbnail {
        width: 100%;
        height: 200px;
      }

      .template-overview {
        grid-template-columns: 1fr 1fr;
      }

      .modal-footer {
        flex-direction: column;
      }
    }
  `;

  // Properties
  @property({ type: String }) language: Language = 'pl';

  // Internal state
  @state() private templates: WorkshopTemplate[] = [];
  @state() private selectedTemplate?: WorkshopTemplate;
  @state() private filteredTemplates: WorkshopTemplate[] = [];
  @state() private isLoading = false;
  @state() private searchTerm = '';
  @state() private selectedCategory: TemplateCategory | 'all' = 'all';
  @state() private sortBy: 'name' | 'rating' | 'usage' | 'newest' = 'rating';
  @state() private viewMode: 'grid' | 'list' = 'grid';
  @state() private showTemplateModal = false;

  // Template categories
  private categories: {
    value: TemplateCategory | 'all';
    label: Record<Language, string>;
  }[] = [
      { value: 'all', label: { pl: 'Wszystkie', en: 'All' } },
      {
        value: 'team-building',
        label: { pl: 'Budowanie zespołu', en: 'Team Building' },
      },
      {
        value: 'conflict-resolution',
        label: { pl: 'Rozwiązywanie konfliktów', en: 'Conflict Resolution' },
      },
      {
        value: 'communication',
        label: { pl: 'Komunikacja', en: 'Communication' },
      },
      { value: 'leadership', label: { pl: 'Przywództwo', en: 'Leadership' } },
      { value: 'creativity', label: { pl: 'Kreatywność', en: 'Creativity' } },
      {
        value: 'decision-making',
        label: { pl: 'Podejmowanie decyzji', en: 'Decision Making' },
      },
      { value: 'onboarding', label: { pl: 'Wdrożenie', en: 'Onboarding' } },
      { value: 'community', label: { pl: 'Wspólnota', en: 'Community' } },
      { value: 'custom', label: { pl: 'Niestandardowe', en: 'Custom' } },
    ];

  connectedCallback() {
    super.connectedCallback();
    this.loadTemplates();
  }

  protected override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    if (
      changedProperties.has('templates') ||
      changedProperties.has('searchTerm') ||
      changedProperties.has('selectedCategory') ||
      changedProperties.has('sortBy')
    ) {
      this.filterTemplates();
    }
  }

  private async loadTemplates() {
    this.isLoading = true;

    try {
      // Load templates from API or use sample data
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      this.templates = this.getSampleTemplates();
      this.filteredTemplates = [...this.templates];
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private getSampleTemplates(): WorkshopTemplate[] {
    return [
      {
        id: 'team-integration',
        name: {
          pl: 'Integracja Zespołu',
          en: 'Team Integration',
        },
        description: {
          pl: 'Warsztat mający na celu budowanie relacji i integrację nowego zespołu',
          en: 'Workshop focused on building relationships and integrating a new team',
        },
        category: 'team-building',
        duration: 180,
        sessionCount: 4,
        difficulty: 'beginner',
        participantRange: { min: 6, max: 20 },
        tags: ['integration', 'team', 'communication'],
        sessions: [
          {
            id: 'session1',
            name: { pl: 'Lodołamacz', en: 'Icebreaker' },
            description: {
              pl: 'Poznanie się',
              en: 'Getting to know each other',
            },
            type: 'introduction',
            duration: 30,
            materials: [],
            category: 'icebreaker',
            settings: { allowReordering: true },
          },
          {
            id: 'session2',
            name: { pl: 'Aktywności zespołowe', en: 'Team Activities' },
            description: {
              pl: 'Współpraca w grupach',
              en: 'Group collaboration',
            },
            type: 'activity',
            duration: 60,
            materials: [],
            category: 'main',
            settings: { allowReordering: true },
          },
        ],
        materials: [],
        settings: {
          allowCustomization: true,
          requireAllSessions: false,
          adaptableDuration: true,
          languageSupport: ['pl', 'en'],
          targetAudience: ['teams', 'organizations'],
          learningObjectives: {
            pl: ['Integracja zespołu', 'Poprawa komunikacji'],
            en: ['Team integration', 'Improve communication'],
          },
        },
        createdBy: 'system',
        isPublic: true,
        usageCount: 156,
        rating: 4.8,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'conflict-workshop',
        name: {
          pl: 'Rozwiązywanie Konfliktów',
          en: 'Conflict Resolution',
        },
        description: {
          pl: 'Narzędzia i techniki rozwiązywania konfliktów w zespole',
          en: 'Tools and techniques for conflict resolution in teams',
        },
        category: 'conflict-resolution',
        duration: 240,
        sessionCount: 5,
        difficulty: 'intermediate',
        participantRange: { min: 8, max: 16 },
        tags: ['conflict', 'communication', 'mediation'],
        sessions: [],
        materials: [],
        settings: {
          allowCustomization: true,
          requireAllSessions: true,
          adaptableDuration: false,
          languageSupport: ['pl', 'en'],
          targetAudience: ['managers', 'teams'],
        },
        createdBy: 'system',
        isPublic: true,
        usageCount: 89,
        rating: 4.6,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'creativity-lab',
        name: {
          pl: 'Laboratorium Kreatywności',
          en: 'Creativity Lab',
        },
        description: {
          pl: 'Warsztat rozwijający kreatywne myślenie i innowacyjność',
          en: 'Workshop developing creative thinking and innovation',
        },
        category: 'creativity',
        duration: 150,
        sessionCount: 3,
        difficulty: 'beginner',
        participantRange: { min: 4, max: 25 },
        tags: ['creativity', 'innovation', 'brainstorming'],
        sessions: [],
        materials: [],
        settings: {
          allowCustomization: true,
          requireAllSessions: false,
          adaptableDuration: true,
          languageSupport: ['pl', 'en'],
          targetAudience: ['creative', 'teams'],
        },
        createdBy: 'system',
        isPublic: true,
        usageCount: 124,
        rating: 4.9,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  private filterTemplates() {
    let filtered = [...this.templates];

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        template =>
          template.name[this.language].toLowerCase().includes(term) ||
          template.description[this.language].toLowerCase().includes(term) ||
          template.tags.some(tag => tag.toLowerCase().includes(term)),
      );
    }

    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(
        template => template.category === this.selectedCategory,
      );
    }

    // Sort templates
    filtered.sort((a, b) => {
      switch (this.sortBy) {
      case 'name':
        return a.name[this.language].localeCompare(b.name[this.language]);
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'usage':
        return b.usageCount - a.usageCount;
      case 'newest':
        return b.createdAt.getTime() - a.createdAt.getTime();
      default:
        return 0;
      }
    });

    this.filteredTemplates = filtered;
  }

  private selectTemplate(template: WorkshopTemplate) {
    this.selectedTemplate = template;
    this.showTemplateModal = true;
  }

  private applyTemplate() {
    if (this.selectedTemplate) {
      this.dispatchEvent(
        new CustomEvent('template-selected', {
          detail: { template: this.selectedTemplate },
          bubbles: true,
        }),
      );

      this.showTemplateModal = false;
    }
  }

  private customizeTemplate() {
    if (this.selectedTemplate) {
      this.dispatchEvent(
        new CustomEvent('template-customize', {
          detail: { template: this.selectedTemplate },
          bubbles: true,
        }),
      );
    }
  }

  private createCustomTemplate() {
    this.dispatchEvent(
      new CustomEvent('create-custom-template', {
        detail: {},
        bubbles: true,
      }),
    );
  }

  private renderStars(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      '⭐'.repeat(fullStars) +
      (hasHalfStar ? '✨' : '') +
      '☆'.repeat(emptyStars)
    );
  }

  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
  }

  protected override render() {
    const {
      isLoading,
      filteredTemplates,
      searchTerm,
      selectedCategory,
      sortBy,
      viewMode,
    } = this;

    return html`
      <div class="template-selector">
        <!-- Search and Filter Header -->
        <div class="search-header">
          <div class="search-bar">
            <input
              type="text"
              class="search-input"
              placeholder="Search templates..."
              .value=${searchTerm}
              @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.searchTerm = target.value;
  }}
            />
            <button class="search-btn">🔍 Search</button>
          </div>

          <div class="filter-controls">
            <div class="category-filter">
              ${this.categories.map(
    category => html`
                  <button
                    class="category-chip ${classMap({
    active: selectedCategory === category.value,
  })}"
                    @click=${() => (this.selectedCategory = category.value)}
                  >
                    ${category.label[this.language]}
                  </button>
                `,
  )}
            </div>

            <select
              class="sort-select"
              .value=${sortBy}
              @change=${(e: Event) => {
    const target = e.target as HTMLSelectElement;
    this.sortBy = target.value as any;
  }}
            >
              <option value="rating">Highest Rated</option>
              <option value="usage">Most Used</option>
              <option value="newest">Newest</option>
              <option value="name">Name</option>
            </select>

            <div class="view-toggle">
              <button
                class="view-btn ${classMap({ active: viewMode === 'grid' })}"
                @click=${() => (this.viewMode = 'grid')}
              >
                ⚏ Grid
              </button>
              <button
                class="view-btn ${classMap({ active: viewMode === 'list' })}"
                @click=${() => (this.viewMode = 'list')}
              >
                📋 List
              </button>
            </div>
          </div>
        </div>

        <!-- Templates Display -->
        ${isLoading
    ? html`
              <div class="loading-overlay">
                <div class="loading-spinner"></div>
              </div>
            `
    : filteredTemplates.length === 0
      ? html`
                <div class="empty-state">
                  <div class="empty-icon">📭</div>
                  <div class="empty-title">No templates found</div>
                  <div class="empty-description">
                    Try adjusting your search or filters, or create a custom
                    template
                  </div>
                  <button
                    class="empty-action"
                    @click=${this.createCustomTemplate}
                  >
                    ➕ Create Custom Template
                  </button>
                </div>
              `
      : html`
                ${viewMode === 'grid'
    ? this.renderGridView()
    : this.renderListView()}
              `}

        <!-- Template Modal -->
        ${this.selectedTemplate ? this.renderTemplateModal() : ''}
      </div>
    `;
  }

  private renderGridView() {
    return html`
      <div class="templates-grid">
        ${this.filteredTemplates.map(
    template => html`
            <div
              class="template-card ${classMap({
    selected: this.selectedTemplate?.id === template.id,
  })}"
              @click=${() => this.selectTemplate(template)}
            >
              <div class="template-thumbnail">
                ${template.thumbnail
    ? html`
                      <img
                        src="${template.thumbnail}"
                        alt="${template.name[this.language]}"
                      />
                    `
    : ''}
                <div class="template-badge">${template.category}</div>
              </div>

              <div class="template-content">
                <div class="template-header">
                  <h3 class="template-title">
                    ${template.name[this.language]}
                  </h3>
                  <div class="template-rating">
                    ${this.renderStars(template.rating || 0)}
                    <span>(${template.rating || 0})</span>
                  </div>
                </div>

                <p class="template-description">
                  ${template.description[this.language]}
                </p>

                <div class="template-meta">
                  <div class="template-stats">
                    <div class="template-stat">
                      ⏱️ ${this.formatDuration(template.duration)}
                    </div>
                    <div class="template-stat">
                      📊 ${template.sessionCount} sessions
                    </div>
                    <div class="template-stat">
                      👥
                      ${template.participantRange.min}-${template
  .participantRange.max}
                    </div>
                  </div>

                  <div class="template-actions">
                    <button
                      class="template-action"
                      @click=${(e: Event) => {
    e.stopPropagation();
    this.selectTemplate(template);
  }}
                    >
                      👁️ Preview
                    </button>
                    <button
                      class="template-action primary"
                      @click=${(e: Event) => {
    e.stopPropagation();
    this.selectedTemplate = template;
    this.applyTemplate();
  }}
                    >
                      ✨ Use
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `,
  )}
      </div>
    `;
  }

  private renderListView() {
    return html`
      <div class="templates-list">
        ${this.filteredTemplates.map(
    template => html`
            <div
              class="template-list-item ${classMap({
    selected: this.selectedTemplate?.id === template.id,
  })}"
              @click=${() => this.selectTemplate(template)}
            >
              <div class="template-list-thumbnail">
                ${template.thumbnail
    ? html`
                      <img
                        src="${template.thumbnail}"
                        alt="${template.name[this.language]}"
                      />
                    `
    : ''}
              </div>

              <div class="template-list-content">
                <div class="template-list-header">
                  <h3 class="template-list-title">
                    ${template.name[this.language]}
                  </h3>
                  <div class="template-list-meta">
                    <span>⭐ ${template.rating || 0}</span>
                    <span>⏱️ ${this.formatDuration(template.duration)}</span>
                    <span
                      >👥
                      ${template.participantRange.min}-${template
  .participantRange.max}</span
                    >
                    <span>📊 ${template.usageCount} uses</span>
                  </div>
                </div>

                <p class="template-list-description">
                  ${template.description[this.language]}
                </p>

                <div class="template-list-footer">
                  <div>
                    <span
                      style="padding: 0.25rem 0.75rem; background: #f3f4f6; border-radius: 9999px; font-size: 0.813rem; color: #6b7280;"
                    >
                      ${template.category}
                    </span>
                    <span
                      style="padding: 0.25rem 0.75rem; background: #f3f4f6; border-radius: 9999px; font-size: 0.813rem; color: #6b7280; margin-left: 0.5rem;"
                    >
                      ${template.difficulty}
                    </span>
                  </div>

                  <div class="template-actions">
                    <button
                      class="template-action"
                      @click=${(e: Event) => {
    e.stopPropagation();
    this.selectTemplate(template);
  }}
                    >
                      👁️ Preview
                    </button>
                    <button
                      class="template-action primary"
                      @click=${(e: Event) => {
    e.stopPropagation();
    this.selectedTemplate = template;
    this.applyTemplate();
  }}
                    >
                      ✨ Use Template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `,
  )}
      </div>
    `;
  }

  private renderTemplateModal() {
    if (!this.selectedTemplate || !this.showTemplateModal) return html``;

    const template = this.selectedTemplate;

    return html`
      <div class="template-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">${template.name[this.language]}</h2>
            <button
              class="modal-close"
              @click=${() => (this.showTemplateModal = false)}
            >
              ×
            </button>
          </div>

          <div class="modal-body">
            <!-- Template Overview -->
            <div class="modal-section">
              <h3 class="modal-section-title">📊 Template Overview</h3>
              <div class="template-overview">
                <div class="overview-item">
                  <div class="overview-label">Duration</div>
                  <div class="overview-value">
                    ${this.formatDuration(template.duration)}
                  </div>
                </div>
                <div class="overview-item">
                  <div class="overview-label">Sessions</div>
                  <div class="overview-value">${template.sessionCount}</div>
                </div>
                <div class="overview-item">
                  <div class="overview-label">Participants</div>
                  <div class="overview-value">
                    ${template.participantRange.min}-${template.participantRange
  .max}
                  </div>
                </div>
                <div class="overview-item">
                  <div class="overview-label">Difficulty</div>
                  <div class="overview-value">${template.difficulty}</div>
                </div>
                <div class="overview-item">
                  <div class="overview-label">Rating</div>
                  <div class="overview-value">
                    ${this.renderStars(template.rating || 0)}
                  </div>
                </div>
                <div class="overview-item">
                  <div class="overview-label">Used</div>
                  <div class="overview-value">${template.usageCount} times</div>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="modal-section">
              <h3 class="modal-section-title">📝 Description</h3>
              <p style="line-height: 1.6; color: #6b7280;">
                ${template.description[this.language]}
              </p>
            </div>

            <!-- Sessions -->
            <div class="modal-section">
              <h3 class="modal-section-title">📅 Sessions</h3>
              ${template.sessions.map(
    (session, index) => html`
                  <div class="session-preview">
                    <div class="session-preview-header">
                      <div class="session-preview-title">
                        ${index + 1}. ${session.name[this.language]}
                      </div>
                      <div class="session-preview-duration">
                        ${session.duration} min
                      </div>
                    </div>
                    <div style="color: #6b7280; font-size: 0.875rem;">
                      ${session.description[this.language]}
                    </div>
                  </div>
                `,
  )}
            </div>

            <!-- Tags -->
            <div class="modal-section">
              <h3 class="modal-section-title">🏷️ Tags</h3>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${template.tags.map(
    tag => html`
                    <span
                      style="padding: 0.375rem 0.75rem; background: #f0f9ff; color: #0369a1; border-radius: 6px; font-size: 0.875rem;"
                    >
                      ${tag}
                    </span>
                  `,
  )}
              </div>
            </div>

            <!-- Settings -->
            <div class="modal-section">
              <h3 class="modal-section-title">⚙️ Settings</h3>
              <div style="display: grid; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span>🔧</span>
                  <span
                    >Customizable:
                    ${template.settings.allowCustomization ? 'Yes' : 'No'}</span
                  >
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span>⏰</span>
                  <span
                    >Adaptable Duration:
                    ${template.settings.adaptableDuration ? 'Yes' : 'No'}</span
                  >
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span>🌐</span>
                  <span
                    >Languages:
                    ${template.settings.languageSupport.join(', ')}</span
                  >
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button
              class="btn btn-secondary"
              @click=${() => (this.showTemplateModal = false)}
            >
              Cancel
            </button>
            <button
              class="btn btn-secondary"
              @click=${() => {
    this.customizeTemplate();
    this.showTemplateModal = false;
  }}
            >
              ✏️ Customize
            </button>
            <button
              class="btn btn-primary"
              @click=${() => this.applyTemplate()}
            >
              ✨ Use Template
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// Register the custom element
if (!customElements.get('template-selector')) {
  customElements.define('template-selector', TemplateSelector);
}
