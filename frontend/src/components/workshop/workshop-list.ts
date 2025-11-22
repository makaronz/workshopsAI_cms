import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient } from '../../services/api';

interface Workshop {
    id: string;
    slug: string;
    titleI18n: { pl: string; en: string };
    descriptionI18n?: { pl: string; en: string };
    status?: string;
    startDate?: string;
    endDate?: string;
    seatLimit?: number;
    createdAt: string;
}

@customElement('workshop-list')
export class WorkshopList extends LitElement {
    @state() private workshops: Workshop[] = [];
    @state() private loading = true;
    @state() private error: string | null = null;

    static override styles = css`
    :host {
      display: block;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #1f2937;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .create-btn {
      padding: 0.75rem 1.5rem;
      background: #2563eb;
      color: white;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .create-btn:hover {
      opacity: 0.9;
    }

    .workshops-grid {
      display: grid;
      gap: 1.5rem;
    }

    .workshop-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: shadow 0.2s;
    }

    .workshop-card:hover {
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .workshop-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 0.5rem;
    }

    .workshop-description {
      color: #6b7280;
      margin-bottom: 1rem;
    }

    .workshop-meta {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .status {
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .status.draft { background: #fef3c7; color: #92400e; }
    .status.published { background: #d1fae5; color: #065f46; }

    .loading, .error, .empty {
      text-align: center;
      padding: 3rem;
      color: #6b7280;
    }

    .error {
      color: #dc2626;
    }
  `;

    override connectedCallback() {
        super.connectedCallback();
        this.loadWorkshops();
    }

    private async loadWorkshops() {
        try {
            this.loading = true;
            this.error = null;

            const response = await apiClient.get('/workshops');

            this.workshops = response.data.data?.workshops || response.data.workshops || [];
            this.loading = false;
        } catch (error: any) {
            console.error('Error loading workshops:', error);
            this.error = error.response?.data?.message || 'Failed to load workshops';
            this.loading = false;
        }
    }

    override render() {
        return html`
      <div class="header">
        <h1>Workshops</h1>
        <a href="/dashboard/workshops/new" class="create-btn">+ Create Workshop</a>
      </div>

      ${this.loading ? html`
        <div class="loading">Loading workshops...</div>
      ` : this.error ? html`
        <div class="error">
          <strong>Error:</strong> ${this.error}
          <br><button @click="${this.loadWorkshops}">Retry</button>
        </div>
      ` : this.workshops.length === 0 ? html`
        <div class="empty">
          No workshops yet. Create your first workshop!
        </div>
      ` : html`
        <div class="workshops-grid">
          ${this.workshops.map(workshop => html`
            <div class="workshop-card">
              <h2 class="workshop-title">${workshop.titleI18n?.pl || workshop.titleI18n?.en || 'Untitled'}</h2>
              <p class="workshop-description">
                ${workshop.descriptionI18n?.pl || workshop.descriptionI18n?.en || 'No description'}
              </p>
              <div class="workshop-meta">
                <span class="status ${workshop.status || 'draft'}">${workshop.status || 'Draft'}</span>
                <span>📅 ${workshop.startDate ? new Date(workshop.startDate).toLocaleDateString() : 'TBD'}</span>
                ${workshop.seatLimit ? html`<span>👥 ${workshop.seatLimit} seats</span>` : ''}
              </div>
            </div>
          `)}
        </div>
      `}
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'workshop-list': WorkshopList;
    }
}
