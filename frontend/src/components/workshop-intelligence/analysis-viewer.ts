/**
 * Workshop Intelligence Analysis Viewer (Admin)
 * Admin component for viewing and managing LLM analyses
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

// Types
interface Analysis {
  id: string;
  workshopId: string;
  userId: string;
  modelName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  isSharedWithParticipants: boolean;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  results?: AnalysisResults;
}

interface AnalysisResults {
  summary?: { text: string };
  insights?: {
    insights: Array<{
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  };
  themes?: {
    themes: Array<{
      theme: string;
      frequency: number;
      examples: string[];
    }>;
  };
  recommendations?: {
    recommendations: Array<{
      title: string;
      description: string;
      actionable: boolean;
    }>;
  };
  plan?: {
    plan: {
      introduction: string;
      activities: Array<{
        title: string;
        duration: string;
        description: string;
      }>;
      conclusion: string;
    };
  };
}

@customElement('analysis-viewer')
export class AnalysisViewer extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 600;
      color: #1f2937;
      margin: 0;
    }

    .new-analysis-btn {
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .new-analysis-btn:hover {
      background: #2563eb;
    }

    .analyses-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .analysis-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .analysis-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 16px;
    }

    .analysis-meta {
      flex: 1;
    }

    .analysis-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .analysis-info {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
    }

    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }

    .status-processing {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-completed {
      background: #d1fae5;
      color: #065f46;
    }

    .status-failed {
      background: #fee2e2;
      color: #991b1b;
    }

    .analysis-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 8px 16px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      background: white;
    }

    .btn:hover {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .btn-primary:hover {
      background: #2563eb;
      border-color: #2563eb;
    }

    .btn-success {
      background: #10b981;
      color: white;
      border-color: #10b981;
    }

    .btn-success:hover {
      background: #059669;
      border-color: #059669;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
      border-color: #ef4444;
    }

    .btn-danger:hover {
      background: #dc2626;
      border-color: #dc2626;
    }

    .results-container {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }

    .results-section {
      margin-bottom: 24px;
    }

    .results-section h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 12px;
    }

    .summary-text {
      font-size: 15px;
      line-height: 1.6;
      color: #374151;
      white-space: pre-wrap;
    }

    .insight-item,
    .theme-item,
    .recommendation-item {
      background: #f9fafb;
      border-left: 3px solid #3b82f6;
      padding: 12px 16px;
      margin-bottom: 12px;
      border-radius: 4px;
    }

    .insight-item.priority-high {
      border-left-color: #ef4444;
    }

    .insight-item.priority-medium {
      border-left-color: #f59e0b;
    }

    .insight-item.priority-low {
      border-left-color: #10b981;
    }

    .item-title {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .item-description {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }

    .theme-frequency {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }

    .theme-examples {
      margin-top: 8px;
      font-size: 13px;
      color: #6b7280;
      font-style: italic;
    }

    .activity-item {
      background: #f9fafb;
      padding: 16px;
      margin-bottom: 12px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .activity-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .activity-title {
      font-weight: 600;
      color: #1f2937;
    }

    .activity-duration {
      color: #6b7280;
      font-size: 14px;
    }

    .activity-description {
      font-size: 14px;
      color: #374151;
      line-height: 1.5;
    }

    .empty-state {
      text-align: center;
      padding: 48px;
      color: #6b7280;
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .loading {
      text-align: center;
      padding: 48px;
      color: #6b7280;
    }

    .error-message {
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 12px 16px;
      margin-top: 12px;
      color: #991b1b;
      font-size: 14px;
    }

    .modal-overlay {
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
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #1f2937;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
    }

    .form-select,
    .form-textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
    }

    .form-textarea {
      resize: vertical;
      min-height: 100px;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
    }
  `;

  @property({ type: String })
  workshopId = '';

  @state()
  private analyses: Analysis[] = [];

  @state()
  private selectedAnalysis: Analysis | null = null;

  @state()
  private loading = false;

  @state()
  private showNewAnalysisModal = false;

  @state()
  private newAnalysisModel = 'gpt-4';

  @state()
  private newAnalysisInstructions = '';

  connectedCallback() {
    super.connectedCallback();
    if (this.workshopId) {
      this.loadAnalyses();
      // Poll for updates every 10 seconds
      setInterval(() => this.loadAnalyses(), 10000);
    }
  }

  private async loadAnalyses() {
    try {
      const response = await fetch(
        `/api/v1/workshop-intelligence/workshops/${this.workshopId}/analyses`,
      );
      if (response.ok) {
        this.analyses = await response.json();
      }
    } catch (error) {
      console.error('Error loading analyses:', error);
    }
  }

  private async viewAnalysis(analysisId: string) {
    this.loading = true;
    try {
      const response = await fetch(`/api/v1/workshop-intelligence/analyses/${analysisId}`);
      if (response.ok) {
        this.selectedAnalysis = await response.json();
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
    } finally {
      this.loading = false;
    }
  }

  private async shareAnalysis(analysisId: string) {
    try {
      const response = await fetch(
        `/api/v1/workshop-intelligence/analyses/${analysisId}/share`,
        { method: 'PUT' },
      );
      if (response.ok) {
        await this.loadAnalyses();
        alert('Analysis shared with participants');
      }
    } catch (error) {
      console.error('Error sharing analysis:', error);
    }
  }

  private async hideAnalysis(analysisId: string) {
    try {
      const response = await fetch(
        `/api/v1/workshop-intelligence/analyses/${analysisId}/hide`,
        { method: 'PUT' },
      );
      if (response.ok) {
        await this.loadAnalyses();
        alert('Analysis hidden from participants');
      }
    } catch (error) {
      console.error('Error hiding analysis:', error);
    }
  }

  private async createAnalysis() {
    try {
      const response = await fetch(
        `/api/v1/workshop-intelligence/workshops/${this.workshopId}/analyses`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelName: this.newAnalysisModel,
            customInstructions: this.newAnalysisInstructions || undefined,
          }),
        },
      );

      if (response.ok) {
        this.showNewAnalysisModal = false;
        this.newAnalysisInstructions = '';
        await this.loadAnalyses();
        alert('Analysis started! Check back in a few moments for results.');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating analysis:', error);
      alert('Failed to create analysis');
    }
  }

  render() {
    if (this.selectedAnalysis) {
      return this.renderAnalysisDetails();
    }

    return html`
      <div class="header">
        <h1>Workshop Analyses</h1>
        <button class="new-analysis-btn" @click=${() => (this.showNewAnalysisModal = true)}>
          + New Analysis
        </button>
      </div>

      ${this.analyses.length === 0
        ? html`
            <div class="empty-state">
              <div class="empty-state-icon">📊</div>
              <p>No analyses yet. Create your first analysis to get AI-powered insights.</p>
            </div>
          `
        : html`
            <div class="analyses-list">
              ${repeat(
                this.analyses,
                (a) => a.id,
                (analysis) => this.renderAnalysisCard(analysis),
              )}
            </div>
          `}

      ${this.showNewAnalysisModal ? this.renderNewAnalysisModal() : ''}
    `;
  }

  private renderAnalysisCard(analysis: Analysis): TemplateResult {
    return html`
      <div class="analysis-card">
        <div class="analysis-header">
          <div class="analysis-meta">
            <div class="analysis-title">
              ${this.getModelLabel(analysis.modelName)} Analysis
            </div>
            <div class="analysis-info">
              Created: ${new Date(analysis.createdAt).toLocaleString()}
            </div>
            ${analysis.completedAt
              ? html`
                  <div class="analysis-info">
                    Completed: ${new Date(analysis.completedAt).toLocaleString()}
                  </div>
                `
              : ''}
            <div class="analysis-info">
              <span class="status-badge status-${analysis.status}">${analysis.status}</span>
              ${analysis.isSharedWithParticipants
                ? html`<span class="status-badge status-completed">Shared</span>`
                : ''}
            </div>
          </div>

          <div class="analysis-actions">
            ${analysis.status === 'completed'
              ? html`
                  <button class="btn btn-primary" @click=${() => this.viewAnalysis(analysis.id)}>
                    View Results
                  </button>
                  ${analysis.isSharedWithParticipants
                    ? html`
                        <button class="btn btn-danger" @click=${() => this.hideAnalysis(analysis.id)}>
                          Hide
                        </button>
                      `
                    : html`
                        <button class="btn btn-success" @click=${() => this.shareAnalysis(analysis.id)}>
                          Share
                        </button>
                      `}
                `
              : ''}
          </div>
        </div>

        ${analysis.errorMessage
          ? html`<div class="error-message">Error: ${analysis.errorMessage}</div>`
          : ''}
      </div>
    `;
  }

  private renderAnalysisDetails(): TemplateResult {
    if (!this.selectedAnalysis) return html``;

    const results = this.selectedAnalysis.results;

    return html`
      <div>
        <button class="btn" @click=${() => (this.selectedAnalysis = null)}>← Back to List</button>

        <div class="analysis-card" style="margin-top: 16px;">
          <div class="analysis-title">
            ${this.getModelLabel(this.selectedAnalysis.modelName)} Analysis Results
          </div>
          <div class="analysis-info">
            Completed: ${new Date(this.selectedAnalysis.completedAt!).toLocaleString()}
          </div>

          ${results?.summary
            ? html`
                <div class="results-container">
                  <div class="results-section">
                    <h3>📝 Summary</h3>
                    <div class="summary-text">${results.summary.text}</div>
                  </div>
                </div>
              `
            : ''}

          ${results?.insights
            ? html`
                <div class="results-section">
                  <h3>💡 Key Insights</h3>
                  ${results.insights.insights.map(
                    (insight) => html`
                      <div class="insight-item priority-${insight.priority}">
                        <div class="item-title">${insight.title}</div>
                        <div class="item-description">${insight.description}</div>
                      </div>
                    `,
                  )}
                </div>
              `
            : ''}

          ${results?.themes
            ? html`
                <div class="results-section">
                  <h3>🎯 Recurring Themes</h3>
                  ${results.themes.themes.map(
                    (theme) => html`
                      <div class="theme-item">
                        <div class="item-title">
                          ${theme.theme}
                          <span class="theme-frequency">${theme.frequency}</span>
                        </div>
                        ${theme.examples.length > 0
                          ? html`
                              <div class="theme-examples">
                                "${theme.examples.join('", "')}"
                              </div>
                            `
                          : ''}
                      </div>
                    `,
                  )}
                </div>
              `
            : ''}

          ${results?.recommendations
            ? html`
                <div class="results-section">
                  <h3>✅ Recommendations</h3>
                  ${results.recommendations.recommendations.map(
                    (rec) => html`
                      <div class="recommendation-item">
                        <div class="item-title">${rec.title}</div>
                        <div class="item-description">${rec.description}</div>
                      </div>
                    `,
                  )}
                </div>
              `
            : ''}

          ${results?.plan
            ? html`
                <div class="results-section">
                  <h3>📅 Suggested Workshop Plan</h3>
                  <div class="summary-text">${results.plan.plan.introduction}</div>
                  <div style="margin-top: 16px;">
                    ${results.plan.plan.activities.map(
                      (activity) => html`
                        <div class="activity-item">
                          <div class="activity-header">
                            <span class="activity-title">${activity.title}</span>
                            <span class="activity-duration">${activity.duration}</span>
                          </div>
                          <div class="activity-description">${activity.description}</div>
                        </div>
                      `,
                    )}
                  </div>
                  <div class="summary-text" style="margin-top: 16px;">
                    ${results.plan.plan.conclusion}
                  </div>
                </div>
              `
            : ''}
        </div>
      </div>
    `;
  }

  private renderNewAnalysisModal(): TemplateResult {
    return html`
      <div class="modal-overlay" @click=${() => (this.showNewAnalysisModal = false)}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <h2 class="modal-header">Create New Analysis</h2>

          <div class="form-group">
            <label class="form-label">AI Model</label>
            <select
              class="form-select"
              .value=${this.newAnalysisModel}
              @change=${(e: Event) =>
                (this.newAnalysisModel = (e.target as HTMLSelectElement).value)}
            >
              <option value="gpt-4">GPT-4 (Most Capable)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo (Faster)</option>
              <option value="gpt-4o">GPT-4o (Optimized)</option>
              <option value="gpt-4o-mini">GPT-4o Mini (Cost-Effective)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Custom Instructions (Optional)</label>
            <textarea
              class="form-textarea"
              .value=${this.newAnalysisInstructions}
              @input=${(e: Event) =>
                (this.newAnalysisInstructions = (e.target as HTMLTextAreaElement).value)}
              placeholder="Add any specific instructions for the AI analysis..."
            ></textarea>
          </div>

          <div class="modal-actions">
            <button class="btn" @click=${() => (this.showNewAnalysisModal = false)}>
              Cancel
            </button>
            <button class="btn btn-primary" @click=${this.createAnalysis}>
              Start Analysis
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private getModelLabel(modelName: string): string {
    const labels: Record<string, string> = {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'claude-3-opus': 'Claude 3 Opus',
      'claude-3-sonnet': 'Claude 3 Sonnet',
      'gemini-pro': 'Gemini Pro',
    };
    return labels[modelName] || modelName;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'analysis-viewer': AnalysisViewer;
  }
}
