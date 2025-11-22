import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient } from '../../services/api';

interface WorkshopFormData {
    slug: string;
    titleI18n: { pl: string; en: string };
    subtitleI18n?: { pl: string; en: string };
    descriptionI18n: { pl: string; en: string };
    shortDescriptionI18n?: { pl: string; en: string };
    startDate?: string;
    endDate?: string;
    seatLimit?: number;
    enableWaitingList?: boolean;
    templateTheme?: string;
    language?: string;
    price?: number;
    currency?: string;
    imageUrl?: string;
}

@customElement('workshop-creator')
export class WorkshopCreator extends LitElement {
    @state() private formData: WorkshopFormData = {
        slug: '',
        titleI18n: { pl: '', en: '' },
        descriptionI18n: { pl: '', en: '' },
        language: 'pl',
        currency: 'PLN',
        enableWaitingList: true
    };

    @state() private loading = false;
    @state() private error: string | null = null;
    @state() private success = false;

    static override styles = css`
    :host {
      display: block;
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #1f2937;
    }

    .subtitle {
      color: #6b7280;
      margin-bottom: 2rem;
    }

    .form-container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .form-section {
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }

    input, textarea, select {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #2563eb;
      ring: 2px solid rgba(37, 99, 235, 0.1);
    }

    textarea {
      min-height: 100px;
      resize: vertical;
    }

    .lang-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .lang-tab {
      padding: 0.5rem 1rem;
      background: #f3f4f6;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      color: #6b7280;
      transition: all 0.2s;
    }

    .lang-tab.active {
      background: #2563eb;
      color: white;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .checkbox-group input[type="checkbox"] {
      width: auto;
    }

    .button-group {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }

    button {
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
      border: none;
      font-size: 1rem;
    }

    button:hover:not(:disabled) {
      opacity: 0.9;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #2563eb;
      color: white;
    }

    .btn-secondary {
      background: #6b7280;
      color: white;
    }

    .error {
      padding: 1rem;
      background: #fee2e2;
      border-left: 4px solid #dc2626;
      border-radius: 4px;
      color: #991b1b;
      margin-bottom: 1.5rem;
    }

    .success {
      padding: 1rem;
      background: #d1fae5;
      border-left: 4px solid #10b981;
      border-radius: 4px;
      color: #065f46;
      margin-bottom: 1.5rem;
    }

    .help-text {
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 0.25rem;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 640px) {
      .row {
        grid-template-columns: 1fr;
      }
    }
  `;

    private generateSlug(title: string) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    private async handleSubmit(e: Event) {
        e.preventDefault();

        this.loading = true;
        this.error = null;
        this.success = false;

        try {
            // Auto-generate slug if empty
            if (!this.formData.slug && this.formData.titleI18n.pl) {
                this.formData.slug = this.generateSlug(this.formData.titleI18n.pl);
            }

            console.log('📝 Creating workshop:', this.formData);

            const response = await apiClient.post('/workshops', this.formData);

            console.log('✅ Workshop created:', response.data);

            this.success = true;

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);

        } catch (error: any) {
            console.error('❌ Error creating workshop:', error);
            this.error = error.response?.data?.message || error.message || 'Failed to create workshop';
        } finally {
            this.loading = false;
        }
    }

    private updateField(field: keyof WorkshopFormData, value: any) {
        this.formData = { ...this.formData, [field]: value };
    }

    private updateI18nField(field: 'titleI18n' | 'subtitleI18n' | 'descriptionI18n' | 'shortDescriptionI18n', lang: 'pl' | 'en', value: string) {
        const currentValue = this.formData[field] || { pl: '', en: '' };
        this.formData = {
            ...this.formData,
            [field]: { ...currentValue, [lang]: value }
        };
    }

    override render() {
        return html`
      <h1>Create New Workshop</h1>
      <p class="subtitle">Fill in the details to create a new workshop for sociologists</p>

      ${this.error ? html`
        <div class="error">
          <strong>⚠️ Error</strong>
          <p>${this.error}</p>
        </div>
      ` : ''}

      ${this.success ? html`
        <div class="success">
          <strong>✅ Success!</strong>
          <p>Workshop created successfully. Redirecting to dashboard...</p>
        </div>
      ` : ''}

      <form @submit="${this.handleSubmit}" class="form-container">
        
        <!-- Basic Information -->
        <div class="form-section">
          <h2 class="section-title">Basic Information</h2>
          
          <div class="form-group">
            <label>URL Slug *</label>
            <input
              type="text"
              .value="${this.formData.slug}"
              @input="${(e: Event) => this.updateField('slug', (e.target as HTMLInputElement).value)}"
              pattern="[a-z0-9-]+"
              required
            />
            <p class="help-text">Lowercase letters, numbers, and hyphens only</p>
          </div>

          <div class="form-group">
            <label>Title (Polish) *</label>
            <input
              type="text"
              .value="${this.formData.titleI18n.pl}"
              @input="${(e: Event) => this.updateI18nField('titleI18n', 'pl', (e.target as HTMLInputElement).value)}"
              required
            />
          </div>

          <div class="form-group">
            <label>Title (English)</label>
            <input
              type="text"
              .value="${this.formData.titleI18n.en}"
              @input="${(e: Event) => this.updateI18nField('titleI18n', 'en', (e.target as HTMLInputElement).value)}"
            />
          </div>

          <div class="form-group">
            <label>Description (Polish) *</label>
            <textarea
              .value="${this.formData.descriptionI18n.pl}"
              @input="${(e: Event) => this.updateI18nField('descriptionI18n', 'pl', (e.target as HTMLTextAreaElement).value)}"
              required
            ></textarea>
          </div>

          <div class="form-group">
            <label>Description (English)</label>
            <textarea
              .value="${this.formData.descriptionI18n.en}"
              @input="${(e: Event) => this.updateI18nField('descriptionI18n', 'en', (e.target as HTMLTextAreaElement).value)}"
            ></textarea>
          </div>
        </div>

        <!-- Workshop Details -->
        <div class="form-section">
          <h2 class="section-title">Workshop Details</h2>
          
          <div class="row">
            <div class="form-group">
              <label>Start Date</label>
              <input
                type="datetime-local"
                .value="${this.formData.startDate || ''}"
                @input="${(e: Event) => this.updateField('startDate', (e.target as HTMLInputElement).value)}"
              />
            </div>

            <div class="form-group">
              <label>End Date</label>
              <input
                type="datetime-local"
                .value="${this.formData.endDate || ''}"
                @input="${(e: Event) => this.updateField('endDate', (e.target as HTMLInputElement).value)}"
              />
            </div>
          </div>

          <div class="row">
            <div class="form-group">
              <label>Seat Limit</label>
              <input
                type="number"
                min="1"
                .value="${this.formData.seatLimit?.toString() || ''}"
                @input="${(e: Event) => this.updateField('seatLimit', parseInt((e.target as HTMLInputElement).value) || undefined)}"
              />
            </div>

            <div class="form-group">
              <label>Language</label>
              <select
                .value="${this.formData.language}"
                @change="${(e: Event) => this.updateField('language', (e.target as HTMLSelectElement).value)}"
              >
                <option value="pl">Polish</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <div class="form-group checkbox-group">
            <input
              type="checkbox"
              id="waitingList"
              ?checked="${this.formData.enableWaitingList}"
              @change="${(e: Event) => this.updateField('enableWaitingList', (e.target as HTMLInputElement).checked)}"
            />
            <label for="waitingList">Enable waiting list</label>
          </div>
        </div>

        <!-- Pricing -->
        <div class="form-section">
          <h2 class="section-title">Pricing</h2>
          
          <div class="row">
            <div class="form-group">
              <label>Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                .value="${this.formData.price?.toString() || ''}"
                @input="${(e: Event) => this.updateField('price', parseFloat((e.target as HTMLInputElement).value) || undefined)}"
              />
            </div>

            <div class="form-group">
              <label>Currency</label>
              <select
                .value="${this.formData.currency}"
                @change="${(e: Event) => this.updateField('currency', (e.target as HTMLSelectElement).value)}"
              >
                <option value="PLN">PLN</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        </div>

        <div class="button-group">
          <button type="submit" class="btn-primary" ?disabled="${this.loading}">
            ${this.loading ? 'Creating...' : 'Create Workshop'}
          </button>
          <button type="button" class="btn-secondary" @click="${() => window.location.href = '/dashboard'}">
            Cancel
          </button>
        </div>
      </form>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'workshop-creator': WorkshopCreator;
    }
}
