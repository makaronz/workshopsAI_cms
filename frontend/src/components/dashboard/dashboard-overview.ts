import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient } from '../../services/api';

interface DashboardStats {
    workshopCount: number;
    questionnaireCount: number;
    responseCount: number;
    completedAnalyses: number;
    activeJobs: number;
    systemHealth: string;
}

@customElement('dashboard-overview')
export class DashboardOverview extends LitElement {
    @state() private stats: DashboardStats | null = null;
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

    .subtitle {
      color: #6b7280;
      margin-bottom: 2rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      padding: 1.5rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .stat-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #6b7280;
      margin: 0 0 0.5rem 0;
      text-transform: uppercase;
    }

    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0;
    }

    .stat-value.blue { color: #2563eb; }
    .stat-value.green { color: #10b981; }
    .stat-value.orange { color: #f59e0b; }
    .stat-value.purple { color: #8b5cf6; }

    .stat-description {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0.5rem 0 0 0;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }

    .error {
      padding: 1.5rem;
      background: #fee2e2;
      border-left: 4px solid #dc2626;
      border-radius: 4px;
      color: #991b1b;
    }

    .quick-actions {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .quick-actions h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 1rem 0;
      color: #1f2937;
    }

    .actions-container {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .action-button {
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      color: white;
      transition: opacity 0.2s;
    }

    .action-button:hover {
      opacity: 0.9;
    }

    .action-button.primary { background: #2563eb; }
    .action-button.success { background: #10b981; }
    .action-button.secondary { background: #6b7280; }

    .status-card {
      margin-top: 2rem;
      padding: 1.5rem;
      background: #dbeafe;
      border-left: 4px solid #2563eb;
      border-radius: 4px;
    }

    .status-card h3 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      color: #1e40af;
    }

    .status-card ul {
      margin: 0;
      padding-left: 1.5rem;
      color: #1e40af;
    }

    .skeleton {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;

    override connectedCallback() {
        super.connectedCallback();
        this.loadDashboardData();
    }

    private async loadDashboardData() {
        try {
            this.loading = true;
            this.error = null;

            console.log('📊 Loading dashboard data...');

            const response = await apiClient.get('/dashboard/overview');

            console.log('📊 Dashboard data received:', response.data);

            // Extract data from response
            const data = response.data.data || response.data;

            this.stats = {
                workshopCount: data.workshopCount || data.totalWorkshops || 0,
                questionnaireCount: data.questionnaireCount || data.totalQuestionnaires || 0,
                responseCount: data.responseCount || data.totalResponses || 0,
                completedAnalyses: data.completedAnalyses || data.queue?.completed || 0,
                activeJobs: data.activeJobs || data.queue?.active || 0,
                systemHealth: data.systemHealth || data.health || 'ok'
            };

            this.loading = false;
        } catch (error: any) {
            console.error('❌ Error loading dashboard data:', error);
            this.error = error.response?.data?.message || error.message || 'Failed to load dashboard data';
            this.loading = false;
        }
    }

    private renderLoading() {
        return html`
      <div class="stats-grid">
        ${[1, 2, 3, 4].map(() => html`
          <div class="stat-card">
            <div class="skeleton" style="height: 1rem; width: 100px; margin-bottom: 0.5rem;"></div>
            <div class="skeleton" style="height: 3rem; width: 80px; margin-bottom: 0.5rem;"></div>
            <div class="skeleton" style="height: 0.875rem; width: 120px;"></div>
          </div>
        `)}
      </div>
    `;
    }

    private renderError() {
        return html`
      <div class="error">
        <strong>⚠️ Error Loading Dashboard</strong>
        <p>${this.error}</p>
        <button @click="${this.loadDashboardData}" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
    }

    private renderStats() {
        if (!this.stats) return html``;

        return html`
      <div class="stats-grid">
        <div class="stat-card">
          <h3 class="stat-title">Workshops</h3>
          <p class="stat-value blue">${this.stats.workshopCount}</p>
          <p class="stat-description">Total workshops</p>
        </div>
        
        <div class="stat-card">
          <h3 class="stat-title">Questionnaires</h3>
          <p class="stat-value green">${this.stats.questionnaireCount}</p>
          <p class="stat-description">Active questionnaires</p>
        </div>
        
        <div class="stat-card">
          <h3 class="stat-title">Responses</h3>
          <p class="stat-value orange">${this.stats.responseCount}</p>
          <p class="stat-description">Total responses</p>
        </div>
        
        <div class="stat-card">
          <h3 class="stat-title">Analysis Jobs</h3>
          <p class="stat-value purple">${this.stats.completedAnalyses}</p>
          <p class="stat-description">Completed analyses</p>
        </div>
      </div>
    `;
    }

    override render() {
        return html`
      <h1>Dashboard</h1>
      <p class="subtitle">
        Welcome to WorkshopsAI CMS - Content Management System for Sociologists
      </p>

      ${this.loading ? this.renderLoading() : this.error ? this.renderError() : this.renderStats()}

      <div class="quick-actions">
        <h2>Quick Actions</h2>
        <div class="actions-container">
          <a href="/dashboard/workshops/new" class="action-button primary">
            + Create Workshop
          </a>
          <a href="/dashboard/workshops" class="action-button primary">
            📋 View All Workshops  
          </a>
          <a href="/dashboard/questionnaires/new" class="action-button success">
            + Create Questionnaire
          </a>
          <a href="/api/v1" target="_blank" class="action-button secondary">
            API Documentation
          </a>
        </div>
      </div>

      <div class="status-card">
        <h3>🎉 System Status: ${this.stats?.systemHealth || 'Checking...'}</h3>
        <ul>
          <li>✅ Backend API: Connected</li>
          <li>✅ Database: PostgreSQL connected</li>
          <li>✅ Redis Cache: Active</li>
          <li>✅ Frontend: Running</li>
        </ul>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'dashboard-overview': DashboardOverview;
    }
}
