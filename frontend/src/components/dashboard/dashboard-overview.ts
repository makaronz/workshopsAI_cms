import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import dashboardApiService, { DashboardMetrics } from '../../services/dashboard-api';

@customElement('dashboard-overview')
export class DashboardOverview extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .dashboard-header {
      margin-bottom: 2rem;
    }

    .dashboard-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #1f2937;
    }

    .dashboard-subtitle {
      color: #6b7280;
      margin: 0;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .metric-card {
      padding: 1.5rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      position: relative;
      overflow: hidden;
    }

    .metric-card.loading {
      opacity: 0.7;
      pointer-events: none;
    }

    .metric-card.error {
      border-left: 4px solid #ef4444;
    }

    .metric-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .metric-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #6b7280;
      margin: 0;
    }

    .metric-value {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0;
      transition: color 0.3s ease;
    }

    .metric-value.workshops { color: #2563eb; }
    .metric-value.questionnaires { color: #10b981; }
    .metric-value.responses { color: #f59e0b; }
    .metric-value.analysis-jobs { color: #8b5cf6; }

    .metric-description {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0.5rem 0 0 0;
    }

    .metric-submetrics {
      display: flex;
      gap: 1rem;
      margin-top: 0.75rem;
      font-size: 0.75rem;
      color: #6b7280;
    }

    .metric-submetric {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .metric-submetric-value {
      font-weight: 600;
    }

    .loading-skeleton {
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .loading-value {
      width: 80px;
      height: 40px;
    }

    .error-message {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: #fee2e2;
      color: #991b1b;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .refresh-button {
      background: none;
      border: none;
      color: #6b7280;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 4px;
      transition: all 0.2s ease;
      margin-left: 0.5rem;
    }

    .refresh-button:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .refresh-button.spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 0.5rem;
    }

    .status-indicator.healthy { background-color: #10b981; }
    .status-indicator.degraded { background-color: #f59e0b; }
    .status-indicator.unhealthy { background-color: #ef4444; }

    .quick-actions {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }

    .quick-actions-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 1rem 0;
      color: #1f2937;
    }

    .quick-actions-buttons {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .quick-action-button {
      padding: 0.75rem 1.5rem;
      background: #2563eb;
      color: white;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      transition: background-color 0.2s ease;
    }

    .quick-action-button:hover {
      background: #1d4ed8;
    }

    .system-status {
      margin-top: 2rem;
      padding: 1.5rem;
      background: #dbeafe;
      border-left: 4px solid #2563eb;
      border-radius: 4px;
    }

    .system-status-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      color: #1e40af;
    }

    .system-status-list {
      margin: 0;
      padding-left: 1.5rem;
      color: #1e40af;
    }

    .system-status-list li {
      margin-bottom: 0.25rem;
    }

    .last-updated {
      text-align: right;
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 1rem;
    }
  `;

  @state()
  private metrics: DashboardMetrics | null = null;

  @state()
  private loading = false;

  @state()
  private error: string | null = null;

  @state()
  private lastRefreshed: Date | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadMetrics();

    // Auto-refresh every 5 minutes
    setInterval(() => {
      this.loadMetrics(false);
    }, 5 * 60 * 1000);
  }

  private async loadMetrics(showLoading: boolean = true) {
    if (showLoading) {
      this.loading = true;
      this.error = null;
    }

    try {
      console.log('🔄 [DASHBOARD] Loading metrics...');
      this.metrics = await dashboardApiService.fetchDashboardMetrics();
      this.lastRefreshed = new Date();
      console.log('✅ [DASHBOARD] Metrics loaded successfully');
    } catch (err: any) {
      console.error('❌ [DASHBOARD] Failed to load metrics:', err);
      this.error = err.message || 'Failed to load dashboard metrics';
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
  }

  private async handleRefresh() {
    console.log('🔄 [DASHBOARD] Manual refresh triggered');
    await this.loadMetrics(true);
  }

  private formatDate(date: Date): string {
    return date.toLocaleString();
  }

  private getStatusClass(status: string): string {
    switch (status) {
      case 'healthy': return 'healthy';
      case 'degraded': return 'degraded';
      case 'unhealthy': return 'unhealthy';
      default: return 'unhealthy';
    }
  }

  private renderMetricCard(
    title: string,
    value: number,
    description: string,
    valueClass: string,
    submetrics?: Array<{ label: string; value: number | string }>
  ) {
    return html`
      <div class="metric-card ${this.loading ? 'loading' : ''} ${this.error ? 'error' : ''}">
        ${this.error ? html`<div class="error-message">Error loading data</div>` : ''}
        <button
          class="refresh-button ${this.loading ? 'spinning' : ''}"
          @click=${this.handleRefresh}
          title="Refresh metrics"
        >
          ⟳
        </button>
        <div class="metric-header">
          <h3 class="metric-title">${title}</h3>
        </div>
        <p class="metric-value ${valueClass}">
          ${this.loading && value === 0 ?
            html`<div class="loading-skeleton loading-value"></div>` :
            value.toLocaleString()
          }
        </p>
        <p class="metric-description">${description}</p>
        ${submetrics ? html`
          <div class="metric-submetrics">
            ${submetrics.map(sub => html`
              <div class="metric-submetric">
                <span class="metric-submetric-value">${sub.value}</span>
                <span>${sub.label}</span>
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }

  render() {
    return html`
      <div class="dashboard-header">
        <h1 class="dashboard-title">Dashboard</h1>
        <p class="dashboard-subtitle">
          Welcome to WorkshopsAI CMS - Content Management System for Sociologists
        </p>
      </div>

      <div class="metrics-grid">
        ${this.renderMetricCard(
          'WORKSHOPS',
          this.metrics?.workshops.total || 0,
          'Total workshops',
          'workshops',
          [
            { label: 'Published', value: this.metrics?.workshops.published || 0 },
            { label: 'Draft', value: this.metrics?.workshops.draft || 0 }
          ]
        )}

        ${this.renderMetricCard(
          'QUESTIONNAIRES',
          this.metrics?.questionnaires.total || 0,
          'Active questionnaires',
          'questionnaires',
          [
            { label: 'Active', value: this.metrics?.questionnaires.active || 0 },
            { label: 'Draft', value: this.metrics?.questionnaires.draft || 0 }
          ]
        )}

        ${this.renderMetricCard(
          'RESPONSES',
          this.metrics?.responses.total || 0,
          'Total responses',
          'responses',
          [
            { label: 'This month', value: this.metrics?.responses.thisMonth || 0 },
            { label: 'This week', value: this.metrics?.responses.thisWeek || 0 }
          ]
        )}

        ${this.renderMetricCard(
          'ANALYSIS JOBS',
          this.metrics?.analysisJobs.total || 0,
          'Completed analyses',
          'analysis-jobs',
          [
            { label: 'Completed', value: this.metrics?.analysisJobs.completed || 0 },
            { label: 'Processing', value: this.metrics?.analysisJobs.processing || 0 }
          ]
        )}
      </div>

      <div class="quick-actions">
        <h2 class="quick-actions-title">Quick Actions</h2>
        <div class="quick-actions-buttons">
          <a href="/dashboard/workshops/new" class="quick-action-button">
            + Create Workshop
          </a>
          <a href="/dashboard/questionnaires/new" class="quick-action-button">
            + Create Questionnaire
          </a>
          <a href="/api/v1" target="_blank" class="quick-action-button">
            API Documentation
          </a>
        </div>
      </div>

      <div class="system-status">
        <h3 class="system-status-title">
          <span class="status-indicator ${this.getStatusClass(this.metrics?.systemHealth.status || 'unhealthy')}"></span>
          System Status: ${this.metrics?.systemHealth.status === 'healthy' ? 'Fully Operational' :
                         this.metrics?.systemHealth.status === 'degraded' ? 'Partially Operational' :
                         'System Issues Detected'}
        </h3>
        <ul class="system-status-list">
          <li>✅ Backend API: ${this.metrics?.systemHealth.database === 'connected' ? 'Connected' : 'Disconnected'}</li>
          <li>✅ Database: ${this.metrics?.systemHealth.database === 'connected' ? 'PostgreSQL connected' : 'Connection failed'}</li>
          <li>✅ Redis Cache: ${this.metrics?.systemHealth.redis === 'connected' ? 'Active' : 'Inactive'}</li>
          <li>✅ Frontend: Running</li>
          <li>✅ OpenAI: ${this.metrics?.systemHealth.llmProviders.openai === 'healthy' ? 'Healthy' : 'Issues detected'}</li>
          <li>✅ Anthropic: ${this.metrics?.systemHealth.llmProviders.anthropic === 'healthy' ? 'Healthy' : 'Issues detected'}</li>
        </ul>
        ${this.lastRefreshed ? html`
          <div class="last-updated">
            Last updated: ${this.formatDate(this.lastRefreshed)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-overview': DashboardOverview;
  }
}