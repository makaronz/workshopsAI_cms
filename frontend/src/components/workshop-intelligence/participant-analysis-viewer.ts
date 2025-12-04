/**
 * Workshop Intelligence Participant Analysis Viewer
 * Participant component for viewing shared workshop analyses
 */

import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

// Types (same as admin viewer but simplified)
interface SharedAnalysis {
  id: string;
  modelName: string;
  completedAt: string;
  results?: {
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
  };
}

@customElement('participant-analysis-viewer')
export class ParticipantAnalysisViewer extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 32px;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .header p {
      font-size: 16px;
      color: #6b7280;
    }

    .analysis-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
    }

    .analysis-meta {
      text-align: center;
      padding-bottom: 16px;
      margin-bottom: 24px;
      border-bottom: 2px solid #e5e7eb;
    }

    .analysis-model {
      font-size: 18px;
      font-weight: 600;
      color: #3b82f6;
      margin-bottom: 8px;
    }

    .analysis-date {
      font-size: 14px;
      color: #6b7280;
    }

    .results-section {
      margin-bottom: 32px;
    }

    .results-section:last-child {
      margin-bottom: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f3f4f6;
    }

    .section-icon {
      font-size: 24px;
    }

    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
    }

    .summary-text {
      font-size: 15px;
      line-height: 1.7;
      color: #374151;
      white-space: pre-wrap;
    }

    .insight-item,
    .theme-item,
    .recommendation-item {
      background: #f9fafb;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin-bottom: 12px;
      border-radius: 0 4px 4px 0;
    }

    .insight-item.priority-high {
      border-left-color: #ef4444;
      background: #fef2f2;
    }

    .insight-item.priority-medium {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }

    .insight-item.priority-low {
      border-left-color: #10b981;
      background: #f0fdf4;
    }

    .priority-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      margin-left: 8px;
    }

    .priority-high {
      background: #ef4444;
      color: white;
    }

    .priority-medium {
      background: #f59e0b;
      color: white;
    }

    .priority-low {
      background: #10b981;
      color: white;
    }

    .item-title {
      font-weight: 600;
      font-size: 16px;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .item-description {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.6;
    }

    .theme-frequency {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      margin-left: 8px;
    }

    .theme-examples {
      margin-top: 12px;
      padding: 12px;
      background: white;
      border-radius: 4px;
      font-size: 13px;
      color: #6b7280;
      font-style: italic;
    }

    .activity-item {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      margin-bottom: 16px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .activity-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 12px;
    }

    .activity-title {
      font-weight: 600;
      font-size: 18px;
    }

    .activity-duration {
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
    }

    .activity-description {
      font-size: 15px;
      line-height: 1.6;
      opacity: 0.95;
    }

    .plan-intro,
    .plan-conclusion {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin-bottom: 20px;
      border-radius: 0 4px 4px 0;
      font-size: 15px;
      line-height: 1.7;
      color: #1e40af;
    }

    .empty-state {
      text-align: center;
      padding: 64px 24px;
      color: #6b7280;
    }

    .empty-state-icon {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state-text {
      font-size: 18px;
      margin-bottom: 8px;
    }

    .empty-state-subtext {
      font-size: 14px;
    }

    .loading {
      text-align: center;
      padding: 64px;
      color: #6b7280;
    }

    .loading-spinner {
      font-size: 48px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;

  @property({ type: String })
  workshopId = '';

  @state()
  private analyses: SharedAnalysis[] = [];

  @state()
  private loading = false;

  connectedCallback() {
    super.connectedCallback();
    if (this.workshopId) {
      this.loadSharedAnalyses();
    }
  }

  private async loadSharedAnalyses() {
    this.loading = true;
    try {
      // Get all analyses for workshop
      const response = await fetch(
        `/api/v1/workshop-intelligence/workshops/${this.workshopId}/analyses`,
      );

      if (response.ok) {
        const allAnalyses = await response.json();

        // Filter for shared and completed analyses
        const sharedAnalyses = allAnalyses.filter(
          (a: any) => a.isSharedWithParticipants && a.status === 'completed',
        );

        // Load full details for each shared analysis
        const detailedAnalyses = await Promise.all(
          sharedAnalyses.map(async (a: any) => {
            const detailResponse = await fetch(
              `/api/v1/workshop-intelligence/analyses/${a.id}`,
            );
            return detailResponse.ok ? await detailResponse.json() : a;
          }),
        );

        this.analyses = detailedAnalyses;
      }
    } catch (error) {
      console.error('Error loading shared analyses:', error);
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <div class="loading-spinner">⚙️</div>
          <p>Loading workshop insights...</p>
        </div>
      `;
    }

    if (this.analyses.length === 0) {
      return html`
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">No Workshop Insights Available Yet</div>
          <div class="empty-state-subtext">
            Your facilitator will share AI-generated insights when ready
          </div>
        </div>
      `;
    }

    return html`
      <div class="header">
        <h1>Workshop Insights</h1>
        <p>AI-powered analysis of participant responses</p>
      </div>

      ${this.analyses.map((analysis) => this.renderAnalysis(analysis))}
    `;
  }

  private renderAnalysis(analysis: SharedAnalysis): TemplateResult {
    const results = analysis.results;

    return html`
      <div class="analysis-card">
        <div class="analysis-meta">
          <div class="analysis-model">
            ${this.getModelLabel(analysis.modelName)} Analysis
          </div>
          <div class="analysis-date">
            Generated: ${new Date(analysis.completedAt).toLocaleString()}
          </div>
        </div>

        ${results?.summary
          ? html`
              <div class="results-section">
                <div class="section-header">
                  <div class="section-icon">📝</div>
                  <div class="section-title">Summary</div>
                </div>
                <div class="summary-text">${results.summary.text}</div>
              </div>
            `
          : ''}

        ${results?.insights && results.insights.insights.length > 0
          ? html`
              <div class="results-section">
                <div class="section-header">
                  <div class="section-icon">💡</div>
                  <div class="section-title">Key Insights</div>
                </div>
                ${results.insights.insights.map(
                  (insight) => html`
                    <div class="insight-item priority-${insight.priority}">
                      <div class="item-title">
                        ${insight.title}
                        <span class="priority-badge priority-${insight.priority}">
                          ${insight.priority}
                        </span>
                      </div>
                      <div class="item-description">${insight.description}</div>
                    </div>
                  `,
                )}
              </div>
            `
          : ''}

        ${results?.themes && results.themes.themes.length > 0
          ? html`
              <div class="results-section">
                <div class="section-header">
                  <div class="section-icon">🎯</div>
                  <div class="section-title">Common Themes</div>
                </div>
                ${results.themes.themes.map(
                  (theme) => html`
                    <div class="theme-item">
                      <div class="item-title">
                        ${theme.theme}
                        <span class="theme-frequency">
                          ${theme.frequency} participant${theme.frequency !== 1 ? 's' : ''}
                        </span>
                      </div>
                      ${theme.examples.length > 0
                        ? html`
                            <div class="theme-examples">
                              Examples: "${theme.examples.join('", "')}"
                            </div>
                          `
                        : ''}
                    </div>
                  `,
                )}
              </div>
            `
          : ''}

        ${results?.recommendations && results.recommendations.recommendations.length > 0
          ? html`
              <div class="results-section">
                <div class="section-header">
                  <div class="section-icon">✅</div>
                  <div class="section-title">Recommendations</div>
                </div>
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
                <div class="section-header">
                  <div class="section-icon">📅</div>
                  <div class="section-title">Suggested Workshop Plan</div>
                </div>

                <div class="plan-intro">${results.plan.plan.introduction}</div>

                ${results.plan.plan.activities.map(
                  (activity) => html`
                    <div class="activity-item">
                      <div class="activity-header">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-duration">${activity.duration}</div>
                      </div>
                      <div class="activity-description">${activity.description}</div>
                    </div>
                  `,
                )}

                <div class="plan-conclusion">${results.plan.plan.conclusion}</div>
              </div>
            `
          : ''}
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
    'participant-analysis-viewer': ParticipantAnalysisViewer;
  }
}
