import { LitElement, html, css, TemplateResult, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { i18n } from '@/services/i18n';
import type { WorkshopFormData, ValidationErrors, Language } from '@/types/workshop';
import '@/components/ui/button';
import '@/components/ui/input';
import '@/components/ui/textarea';
import '@/components/ui/select';
import '@/components/ui/checkbox';
import '@/components/ui/file-upload';

/**
 * WorkshopForm - Handles workshop metadata editing
 * Features:
 * - Multi-language support (PL/EN)
 * - Form validation
 * - Auto-slug generation
 * - Image upload
 * - Material management
 * - Accessibility compliance
 */
@customElement('workshop-form')
export class WorkshopForm extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .form-grid {
      display: grid;
      gap: var(--spacing-6);
    }

    .form-section {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-5);
      background: white;
    }

    .section-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-4) 0;
      padding-bottom: var(--spacing-3);
      border-bottom: 1px solid var(--color-border);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-4);
      align-items: start;
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
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
    }

    .required {
      color: var(--color-error-600);
    }

    .help-text {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      margin-top: var(--spacing-1);
    }

    input, textarea, select {
      padding: var(--spacing-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: var(--font-size-base);
      font-family: var(--font-family-sans);
      transition: all 0.2s ease;
      background: white;
    }

    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px var(--color-primary-100);
    }

    input:disabled, textarea:disabled, select:disabled {
      background: var(--color-gray-50);
      color: var(--color-gray-500);
      cursor: not-allowed;
    }

    textarea {
      resize: vertical;
      min-height: 100px;
    }

    .error {
      border-color: var(--color-error-500) !important;
      box-shadow: 0 0 0 3px var(--color-error-100) !important;
    }

    .error-message {
      color: var(--color-error-600);
      font-size: var(--font-size-xs);
      margin-top: var(--spacing-1);
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
    }

    /* Bilingual Inputs */
    .bilingual-container {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .bilingual-header {
      display: flex;
      background: var(--color-gray-50);
      border-bottom: 1px solid var(--color-border);
    }

    .language-tab {
      flex: 1;
      padding: var(--spacing-2) var(--spacing-3);
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
    }

    .language-tab:hover {
      background: var(--color-gray-100);
    }

    .language-tab.active {
      background: white;
      color: var(--color-primary-600);
      border-bottom-color: var(--color-primary-600);
    }

    .language-content {
      padding: var(--spacing-3);
    }

    .language-flag {
      font-size: var(--font-size-base);
      margin-right: var(--spacing-1);
    }

    /* Materials Management */
    .materials-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .material-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-gray-50);
    }

    .material-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    }

    .material-name {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }

    .material-type {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      text-transform: uppercase;
    }

    .material-actions {
      display: flex;
      gap: var(--spacing-2);
    }

    .add-material {
      display: flex;
      gap: var(--spacing-2);
      margin-top: var(--spacing-3);
    }

    .add-material input {
      flex: 1;
    }

    /* Image Upload */
    .image-upload-container {
      display: flex;
      gap: var(--spacing-4);
      align-items: start;
    }

    .image-preview {
      width: 120px;
      height: 120px;
      border: 2px dashed var(--color-border);
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: var(--color-gray-50);
      flex-shrink: 0;
    }

    .image-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-placeholder {
      color: var(--color-gray-400);
      font-size: var(--font-size-2xl);
    }

    .image-upload-form {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    }

    /* Theme Selection */
    .theme-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing-3);
    }

    .theme-option {
      position: relative;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-4);
      cursor: pointer;
      transition: all 0.2s ease;
      background: white;
    }

    .theme-option:hover {
      border-color: var(--color-primary-300);
    }

    .theme-option.selected {
      border-color: var(--color-primary-600);
      box-shadow: 0 0 0 3px var(--color-primary-100);
    }

    .theme-option input[type="radio"] {
      position: absolute;
      opacity: 0;
    }

    .theme-preview {
      width: 100%;
      height: 60px;
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: white;
    }

    .theme-name {
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin-bottom: var(--spacing-1);
    }

    .theme-description {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    }

    .theme-integracja .theme-preview {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .theme-konflikty .theme-preview {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .theme-well-being .theme-preview {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .theme-custom .theme-preview {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    /* Tags Management */
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-2);
      margin-top: var(--spacing-2);
    }

    .tag-item {
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

    .tag-remove {
      background: none;
      border: none;
      color: var(--color-primary-600);
      cursor: pointer;
      padding: 0;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-full);
    }

    .tag-remove:hover {
      background: var(--color-primary-200);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
      }

      .bilingual-header {
        flex-direction: column;
      }

      .image-upload-container {
        flex-direction: column;
      }

      .image-preview {
        width: 100%;
        height: 200px;
      }

      .theme-grid {
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
      .form-section {
        border-width: 2px;
      }

      input, textarea, select {
        border-width: 2px;
      }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      input, textarea, select,
      .language-tab,
      .theme-option {
        transition: none;
      }
    }
  `;

  @property({ type: Object })
  formData: Partial<WorkshopFormData> = {};

  @property({ type: Object })
  errors: ValidationErrors = {};

  @property({ type: Boolean })
  readonly: boolean = false;

  @state()
  private activeLanguage: Language = 'pl';

  @state()
  private newMaterial = {
    name: '',
    url: '',
    type: 'document'
  };

  @state()
  private availableTags = [
    { id: '1', name: 'Integracja', category: 'theme' as const },
    { id: '2', name: 'Konflikty', category: 'theme' as const },
    { id: '3', name: 'Well-being', category: 'theme' as const },
    { id: '4', name: 'Początkujący', category: 'level' as const },
    { id: '5', name: 'Zaawansowany', category: 'level' as const },
    { id: '6', name: 'Online', category: 'format' as const },
    { id: '7', name: 'Stacjonarny', category: 'format' as const },
  ];

  @state()
  private selectedTags: string[] = [];

  private themes = [
    {
      value: 'integracja' as const,
      name: 'Integracja',
      description: 'Warsztaty budujące więzi i współpracę',
      class: 'theme-integracja'
    },
    {
      value: 'konflikty' as const,
      name: 'Konflikty',
      description: 'Narzędzia do rozwiązywania konfliktów',
      class: 'theme-konflikty'
    },
    {
      value: 'well-being' as const,
      name: 'Well-being',
      description: 'Dbanie o dobrostan psychiczny',
      class: 'theme-well-being'
    },
    {
      value: 'custom' as const,
      name: 'Własny',
      description: 'Dostosuj warsztat do swoich potrzeb',
      class: 'theme-custom'
    }
  ];

  private generateSlug() {
    const title = this.formData.titleI18n?.[this.activeLanguage] || '';
    if (!title) return;

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    this.formData = { ...this.formData, slug };
    this.dispatchEvent(new CustomEvent('change', {
      detail: this.formData,
      bubbles: true,
      composed: true
    }));
  }

  private handleInputChange(field: keyof WorkshopFormData, value: any) {
    this.formData = { ...this.formData, [field]: value };
    this.dispatchEvent(new CustomEvent('change', {
      detail: this.formData,
      bubbles: true,
      composed: true
    }));

    // Clear error when user starts typing
    if (this.errors[field]) {
      const newErrors = { ...this.errors };
      delete newErrors[field];
      this.dispatchEvent(new CustomEvent('errors-change', {
        detail: newErrors,
        bubbles: true,
        composed: true
      }));
    }
  }

  private handleLanguageChange(field: string, language: Language, value: string) {
    const i18nField = field.replace('I18n', '') + 'I18n';
    const currentI18n = (this.formData as any)[i18nField] || {};

    this.formData = {
      ...this.formData,
      [i18nField]: {
        ...currentI18n,
        [language]: value
      }
    };

    this.dispatchEvent(new CustomEvent('change', {
      detail: this.formData,
      bubbles: true,
      composed: true
    }));
  }

  private handleArrayFieldChange(field: string, language: Language, index: number, value: string) {
    const currentArray = this.formData[field as keyof WorkshopFormData] as Record<string, string[]> || {};
    const languageArray = [...(currentArray[language] || [])];
    languageArray[index] = value;

    this.formData = {
      ...this.formData,
      [field]: {
        ...currentArray,
        [language]: languageArray
      }
    };

    this.dispatchEvent(new CustomEvent('change', {
      detail: this.formData,
      bubbles: true,
      composed: true
    }));
  }

  private addArrayItem(field: string, language: Language) {
    const currentArray = this.formData[field as keyof WorkshopFormData] as Record<string, string[]> || {};
    const languageArray = [...(currentArray[language] || [])];
    languageArray.push('');

    this.formData = {
      ...this.formData,
      [field]: {
        ...currentArray,
        [language]: languageArray
      }
    };

    this.dispatchEvent(new CustomEvent('change', {
      detail: this.formData,
      bubbles: true,
      composed: true
    }));
  }

  private removeArrayItem(field: string, language: Language, index: number) {
    const currentArray = this.formData[field as keyof WorkshopFormData] as Record<string, string[]> || {};
    const languageArray = [...(currentArray[language] || [])];
    languageArray.splice(index, 1);

    this.formData = {
      ...this.formData,
      [field]: {
        ...currentArray,
        [language]: languageArray
      }
    };

    this.dispatchEvent(new CustomEvent('change', {
      detail: this.formData,
      bubbles: true,
      composed: true
    }));
  }

  private addMaterial() {
    if (!this.newMaterial.name || !this.newMaterial.url) return;

    const materials = [...(this.formData.materials || [])];
    materials.push({ ...this.newMaterial });

    this.formData = { ...this.formData, materials };
    this.newMaterial = { name: '', url: '', type: 'document' };

    this.dispatchEvent(new CustomEvent('change', {
      detail: this.formData,
      bubbles: true,
      composed: true
    }));
  }

  private removeMaterial(index: number) {
    const materials = [...(this.formData.materials || [])];
    materials.splice(index, 1);

    this.formData = { ...this.formData, materials };

    this.dispatchEvent(new CustomEvent('change', {
      detail: this.formData,
      bubbles: true,
      composed: true
    }));
  }

  private toggleTag(tagId: string) {
    const tags = new Set(this.selectedTags);
    if (tags.has(tagId)) {
      tags.delete(tagId);
    } else {
      tags.add(tagId);
    }
    this.selectedTags = Array.from(tags);

    this.formData = { ...this.formData, tagIds: this.selectedTags };

    this.dispatchEvent(new CustomEvent('change', {
      detail: this.formData,
      bubbles: true,
      composed: true
    }));
  }

  private renderBilingualInput(
    field: string,
    label: string,
    required: boolean = false,
    type: 'input' | 'textarea' = 'input',
    placeholder?: string
  ): TemplateResult {
    const i18nField = field.replace('I18n', '') + 'I18n';
    const i18nData = (this.formData as any)[i18nField] || {};
    const error = this.errors[field.replace('I18n', '')];

    return html`
      <div class="form-group full-width">
        <label>
          ${label} ${required ? html`<span class="required">*</span>` : ''}
        </label>
        <div class="bilingual-container">
          <div class="bilingual-header" role="tablist">
            <button
              class=${classMap({
                'language-tab': true,
                'active': this.activeLanguage === 'pl'
              })}
              role="tab"
              aria-selected=${this.activeLanguage === 'pl' ? 'true' : 'false'}
              @click=${() => this.activeLanguage = 'pl'}
            >
              <span class="language-flag">🇵🇱</span>
              Polski
            </button>
            <button
              class=${classMap({
                'language-tab': true,
                'active': this.activeLanguage === 'en'
              })}
              role="tab"
              aria-selected=${this.activeLanguage === 'en' ? 'true' : 'false'}
              @click=${() => this.activeLanguage = 'en'}
            >
              <span class="language-flag">🇬🇧</span>
              English
            </button>
          </div>
          <div class="language-content">
            ${['pl', 'en'].map(lang => html`
              <div style="${this.activeLanguage === lang ? '' : 'display: none;'}">
                ${type === 'textarea' ? html`
                  <textarea
                    .value=${i18nData[lang] || ''}
                    @input=${(e: any) => this.handleLanguageChange(field, lang as Language, e.target.value)}
                    placeholder="${placeholder}"
                    class=${error ? 'error' : ''}
                    ?disabled=${this.readonly}
                    aria-label="${label} (${lang === 'pl' ? 'Polski' : 'English'})"
                    rows="${field.includes('Description') ? '4' : '2'}"
                  ></textarea>
                ` : html`
                  <input
                    type="text"
                    .value=${i18nData[lang] || ''}
                    @input=${(e: any) => this.handleLanguageChange(field, lang as Language, e.target.value)}
                    placeholder="${placeholder}"
                    class=${error ? 'error' : ''}
                    ?disabled=${this.readonly}
                    aria-label="${label} (${lang === 'pl' ? 'Polski' : 'English'})"
                  >
                `}
              </div>
            `)}
          </div>
        </div>
        ${error ? html`
          <div class="error-message">
            ⚠️ ${i18n.t(error)}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderArrayField(
    field: string,
    label: string,
    required: boolean = false
  ): TemplateResult {
    const currentArray = this.formData[field as keyof WorkshopFormData] as Record<string, string[]> || {};

    return html`
      <div class="form-group full-width">
        <label>
          ${label} ${required ? html`<span class="required">*</span>` : ''}
        </label>
        <div class="bilingual-container">
          <div class="bilingual-header" role="tablist">
            <button
              class=${classMap({
                'language-tab': true,
                'active': this.activeLanguage === 'pl'
              })}
              role="tab"
              aria-selected=${this.activeLanguage === 'pl' ? 'true' : 'false'}
              @click=${() => this.activeLanguage = 'pl'}
            >
              <span class="language-flag">🇵🇱</span>
              Polski
            </button>
            <button
              class=${classMap({
                'language-tab': true,
                'active': this.activeLanguage === 'en'
              })}
              role="tab"
              aria-selected=${this.activeLanguage === 'en' ? 'true' : 'false'}
              @click=${() => this.activeLanguage = 'en'}
            >
              <span class="language-flag">🇬🇧</span>
              English
            </button>
          </div>
          <div class="language-content">
            ${['pl', 'en'].map(lang => html`
              <div style="${this.activeLanguage === lang ? '' : 'display: none;'}">
                ${(currentArray[lang] || []).map((item, index) => html`
                  <div style="display: flex; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                    <input
                      type="text"
                      .value=${item}
                      @input=${(e: any) => this.handleArrayFieldChange(field, lang as Language, index, e.target.value)}
                      placeholder="${i18n.t('workshop.array_item_placeholder')}"
                      ?disabled=${this.readonly}
                      style="flex: 1;"
                    >
                    <ui-button
                      variant="ghost"
                      size="small"
                      @click=${() => this.removeArrayItem(field, lang as Language, index)}
                      ?disabled=${this.readonly}
                      aria-label="${i18n.t('action.remove_item')}"
                    >
                      ✕
                    </ui-button>
                  </div>
                `)}
                <ui-button
                  variant="outline"
                  size="small"
                  @click=${() => this.addArrayItem(field, lang as Language)}
                  ?disabled=${this.readonly}
                >
                  + ${i18n.t('action.add_item')}
                </ui-button>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private renderBasicInfo(): TemplateResult {
    return html`
      <div class="form-section">
        <h2 class="section-title">${i18n.t('workshop.sections.basic_info')}</h2>

        <div class="form-group">
          <label>
            ${i18n.t('workshop.slug')} <span class="required">*</span>
          </label>
          <input
            type="text"
            .value=${this.formData.slug || ''}
            @input=${(e: any) => this.handleInputChange('slug', e.target.value)}
            placeholder="${i18n.t('workshop.slug_placeholder')}"
            class=${this.errors.slug ? 'error' : ''}
            ?disabled=${this.readonly}
            pattern="[a-z0-9-]+"
            aria-describedby="slug-help"
          >
          <div id="slug-help" class="help-text">
            ${i18n.t('workshop.slug_help')}
          </div>
          ${this.errors.slug ? html`
            <div class="error-message">
              ⚠️ ${i18n.t(this.errors.slug)}
            </div>
          ` : ''}
        </div>

        ${this.renderBilingualInput(
          'titleI18n',
          i18n.t('workshop.title'),
          true,
          'input',
          i18n.t('workshop.title_placeholder')
        )}

        ${this.renderBilingualInput(
          'subtitleI18n',
          i18n.t('workshop.subtitle'),
          false,
          'input',
          i18n.t('workshop.subtitle_placeholder')
        )}

        ${this.renderBilingualInput(
          'descriptionI18n',
          i18n.t('workshop.description'),
          true,
          'textarea',
          i18n.t('workshop.description_placeholder')
        )}

        ${this.renderBilingualInput(
          'shortDescriptionI18n',
          i18n.t('workshop.short_description'),
          false,
          'textarea',
          i18n.t('workshop.short_description_placeholder')
        )}
      </div>
    `;
  }

  private renderSchedule(): TemplateResult {
    return html`
      <div class="form-section">
        <h2 class="section-title">${i18n.t('workshop.sections.schedule')}</h2>

        <div class="form-row">
          <div class="form-group">
            <label>${i18n.t('workshop.start_date')}</label>
            <input
              type="datetime-local"
              .value=${this.formData.startDate || ''}
              @change=${(e: any) => this.handleInputChange('startDate', e.target.value)}
              ?disabled=${this.readonly}
            >
          </div>

          <div class="form-group">
            <label>${i18n.t('workshop.end_date')}</label>
            <input
              type="datetime-local"
              .value=${this.formData.endDate || ''}
              @change=${(e: any) => this.handleInputChange('endDate', e.target.value)}
              ?disabled=${this.readonly}
            >
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>${i18n.t('workshop.language')}</label>
            <select
              .value=${this.formData.language || 'pl'}
              @change=${(e: any) => this.handleInputChange('language', e.target.value)}
              ?disabled=${this.readonly}
            >
              <option value="pl">🇵🇱 Polski</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>

          <div class="form-group">
            <label>${i18n.t('workshop.template_theme')}</label>
            <select
              .value=${this.formData.templateTheme || 'custom'}
              @change=${(e: any) => this.handleInputChange('templateTheme', e.target.value)}
              ?disabled=${this.readonly}
            >
              ${this.themes.map(theme => html`
                <option value="${theme.value}">${theme.name}</option>
              `)}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>${i18n.t('workshop.seat_limit')}</label>
            <input
              type="number"
              min="1"
              .value=${this.formData.seatLimit || ''}
              @input=${(e: any) => this.handleInputChange('seatLimit', parseInt(e.target.value) || undefined)}
              placeholder="${i18n.t('workshop.seat_limit_placeholder')}"
              ?disabled=${this.readonly}
            >
          </div>

          <div class="form-group">
            <label>${i18n.t('workshop.enable_waiting_list')}</label>
            <input
              type="checkbox"
              .checked=${this.formData.enableWaitingList ?? true}
              @change=${(e: any) => this.handleInputChange('enableWaitingList', e.target.checked)}
              ?disabled=${this.readonly}
            >
          </div>
        </div>
      </div>
    `;
  }

  private renderPricing(): TemplateResult {
    return html`
      <div class="form-section">
        <h2 class="section-title">${i18n.t('workshop.sections.pricing')}</h2>

        <div class="form-row">
          <div class="form-group">
            <label>${i18n.t('workshop.price')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              .value=${this.formData.price || ''}
              @input=${(e: any) => this.handleInputChange('price', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              ?disabled=${this.readonly}
            >
          </div>

          <div class="form-group">
            <label>${i18n.t('workshop.currency')}</label>
            <select
              .value=${this.formData.currency || 'PLN'}
              @change=${(e: any) => this.handleInputChange('currency', e.target.value)}
              ?disabled=${this.readonly}
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

  private renderThemeSelection(): TemplateResult {
    return html`
      <div class="form-section">
        <h2 class="section-title">${i18n.t('workshop.sections.theme')}</h2>

        <div class="theme-grid">
          ${this.themes.map(theme => html`
            <div
              class=${classMap({
                'theme-option': true,
                'selected': this.formData.templateTheme === theme.value,
                [theme.class]: true
              })}
              @click=${() => !this.readonly && this.handleInputChange('templateTheme', theme.value)}
              role="button"
              tabindex=${this.readonly ? '-1' : '0'}
              aria-pressed=${this.formData.templateTheme === theme.value ? 'true' : 'false'}
            >
              <input
                type="radio"
                name="theme"
                .value=${theme.value}
                .checked=${this.formData.templateTheme === theme.value}
                ?disabled=${this.readonly}
              >
              <div class="theme-preview">
                ${theme.name}
              </div>
              <div class="theme-name">${theme.name}</div>
              <div class="theme-description">${theme.description}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderRequirements(): TemplateResult {
    return html`
      <div class="form-section">
        <h2 class="section-title">${i18n.t('workshop.sections.requirements')}</h2>

        ${this.renderArrayField('requirementsI18n', i18n.t('workshop.requirements'))}

        ${this.renderArrayField('objectivesI18n', i18n.t('workshop.objectives'))}
      </div>
    `;
  }

  private renderMaterials(): TemplateResult {
    return html`
      <div class="form-section">
        <h2 class="section-title">${i18n.t('workshop.sections.materials')}</h2>

        <div class="materials-list">
          ${repeat(this.formData.materials || [], (material, index) => html`
            <div class="material-item">
              <div class="material-info">
                <div class="material-name">${material.name}</div>
                <div class="material-type">${material.type}</div>
                <div style="font-size: var(--font-size-xs); color: var(--color-primary-600);">
                  ${material.url}
                </div>
              </div>
              <div class="material-actions">
                <ui-button
                  variant="ghost"
                  size="small"
                  href="${material.url}"
                  target="_blank"
                  ?disabled=${this.readonly}
                >
                  ${i18n.t('action.open')}
                </ui-button>
                <ui-button
                  variant="ghost"
                  size="small"
                  @click=${() => this.removeMaterial(index)}
                  ?disabled=${this.readonly}
                  aria-label="${i18n.t('action.remove_material')}"
                >
                  ✕
                </ui-button>
              </div>
            </div>
          `)}
        </div>

        <div class="add-material">
          <input
            type="text"
            .value=${this.newMaterial.name}
            @input=${(e: any) => this.newMaterial.name = e.target.value}
            placeholder="${i18n.t('workshop.material_name_placeholder')}"
            ?disabled=${this.readonly}
          >
          <input
            type="url"
            .value=${this.newMaterial.url}
            @input=${(e: any) => this.newMaterial.url = e.target.value}
            placeholder="${i18n.t('workshop.material_url_placeholder')}"
            ?disabled=${this.readonly}
          >
          <select
            .value=${this.newMaterial.type}
            @change=${(e: any) => this.newMaterial.type = e.target.value}
            ?disabled=${this.readonly}
          >
            <option value="document">${i18n.t('workshop.material_types.document')}</option>
            <option value="video">${i18n.t('workshop.material_types.video')}</option>
            <option value="link">${i18n.t('workshop.material_types.link')}</option>
            <option value="template">${i18n.t('workshop.material_types.template')}</option>
          </select>
          <ui-button
            variant="outline"
            @click=${this.addMaterial}
            ?disabled=${this.readonly || !this.newMaterial.name || !this.newMaterial.url}
          >
            + ${i18n.t('action.add')}
          </ui-button>
        </div>
      </div>
    `;
  }

  render(): TemplateResult {
    return html`
      <div class="form-grid">
        ${this.renderBasicInfo()}
        ${this.renderSchedule()}
        ${this.renderThemeSelection()}
        ${this.renderPricing()}
        ${this.renderRequirements()}
        ${this.renderMaterials()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workshop-form': WorkshopForm;
  }
}