import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './visualizations/radar-chart';
import './visualizations/sentiment-graph';
import './design-browser';
import { Design } from './design-browser';

interface DesignParams {
  private_space_m2: number;
  integration_level: number;
  rent_price: number;
  standard_level: number;
  rules_strictness: number;
}

interface FeasibilityScore {
  score: number;
  breakdown: {
    financial: number;
    social: number;
    legal: number;
  };
  warnings: string[];
}

interface SimulationResult {
  scenario: string;
  narrative: string;
  impact: {
    satisfaction: number;
    financial_health: number;
    social_cohesion: number;
  };
  triggered_conflicts: string[];
}

@customElement('workshop-control-room')
export class WorkshopControlRoom extends LitElement {
  static override styles = css`
    :host {
      display: block;
      padding: 2rem;
      background: #f8fafc;
      border-radius: 12px;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .controls, .results, .simulation {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .simulation {
        grid-column: 1 / -1;
        margin-top: 2rem;
    }

    .slider-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #334155;
    }

    input[type="range"] {
      width: 100%;
      accent-color: #2563eb;
    }

    .value-display {
      float: right;
      font-weight: bold;
      color: #2563eb;
    }

    .score-card {
      text-align: center;
      margin-bottom: 2rem;
    }

    .score-value {
      font-size: 3rem;
      font-weight: 800;
      color: #2563eb;
    }

    .breakdown {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .warning {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 1rem;
      margin-bottom: 0.5rem;
      color: #991b1b;
    }
    
    .sim-controls {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    
    button {
        padding: 0.75rem 1.5rem;
        background: #e2e8f0;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    button:hover {
        background: #cbd5e1;
    }
    
    button.active {
        background: #2563eb;
        color: white;
    }
    
    .narrative {
        background: #f1f5f9;
        padding: 1.5rem;
        border-radius: 8px;
        border-left: 4px solid #64748b;
        margin-bottom: 1.5rem;
        font-style: italic;
        line-height: 1.6;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 8px;
        z-index: 10;
    }
    
    .results {
        position: relative;
    }
  `;

  @state()
  private params: DesignParams = {
    private_space_m2: 15,
    integration_level: 50,
    rent_price: 2000,
    standard_level: 50,
    rules_strictness: 50
  };

  @state()
  private result: FeasibilityScore | null = null;

  @state()
  private simulationResult: SimulationResult | null = null;

  @state()
  private isLoading = false;

  @state()
  private isSimulating = false;

  @state()
  private showBrowser = false;

  private debounceTimer: any;

  override connectedCallback() {
    super.connectedCallback();
    this.auditDesign();
  }

  private handleInput(e: Event, param: keyof DesignParams) {
    const target = e.target as HTMLInputElement;
    this.params = {
      ...this.params,
      [param]: Number(target.value)
    };

    // Debounce API call
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.auditDesign(), 300);
  }

  private async auditDesign() {
    this.isLoading = true;
    try {
      const response = await fetch('/api/v2/workshop/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.params)
      });
      const data = await response.json();
      if (data.success) {
        this.result = data.data;
      }
    } catch (error) {
      console.error('Audit failed:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private async downloadReport() {
    if (!this.result) return;

    try {
      const response = await fetch('/api/v2/workshop/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          municipalityName: "Example Municipality", // In real app, this would be dynamic
          params: this.params,
          score: this.result,
          simulation: this.simulationResult
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feasibility_study_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Report generation failed:', error);
    }
  }

  private async runSimulation(scenario: string) {
    this.isSimulating = true;
    try {
      const response = await fetch('/api/v2/workshop/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          params: this.params
        })
      });
      const data = await response.json();
      if (data.success) {
        this.simulationResult = data.data;
      }
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      this.isSimulating = false;
    }
  }

  @state()
  private showSaveDialog = false;

  @state()
  private newDesignName = '';

  private async saveDesign() {
    this.showSaveDialog = true;
  }

  private async confirmSave() {
    if (!this.newDesignName) return;

    try {
      const res = await fetch('/api/v2/workshop/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.newDesignName,
          parameters: this.params
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Design saved successfully!');
        this.showSaveDialog = false;
        this.newDesignName = '';
      } else {
        alert('Failed to save: ' + data.message);
      }
    } catch (e) {
      console.error(e);
      alert('Error saving design');
    }
  }

  private handleDesignSelected(e: CustomEvent<Design>) {
    this.params = e.detail.parameters;
    this.auditDesign();
  }

  override render() {
    return html`
      <div class="grid">
        <div class="controls">
          <h2>Design Parameters</h2>
          
          <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
            <button @click=${() => this.showBrowser = true}>📂 Load</button>
            <button @click=${() => this.saveDesign()}>💾 Save</button>
          </div>

          <design-browser 
            .open=${this.showBrowser} 
            @close=${() => this.showBrowser = false}
            @design-selected=${this.handleDesignSelected}
          ></design-browser>

          ${this.showSaveDialog ? html`
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 100;">
              <div style="background: white; padding: 2rem; border-radius: 8px; width: 400px;">
                <h3 style="margin-top: 0;">Save Design</h3>
                <div style="margin-bottom: 1rem;">
                  <label style="display: block; margin-bottom: 0.5rem;">Design Name</label>
                  <input 
                    type="text" 
                    .value=${this.newDesignName}
                    @input=${(e: Event) => this.newDesignName = (e.target as HTMLInputElement).value}
                    style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"
                    placeholder="e.g. High Rent Scenario"
                  >
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                  <button @click=${() => this.showSaveDialog = false}>Cancel</button>
                  <button @click=${this.confirmSave} style="background: #2563eb; color: white;">Save</button>
                </div>
              </div>
            </div>
          ` : ''}
          
          <div class="slider-group">
            <label>
              Private Space (m²)
              <span class="value-display">${this.params.private_space_m2} m²</span>
            </label>
            <input type="range" min="5" max="50" 
              .value=${this.params.private_space_m2}
              @input=${(e: Event) => this.handleInput(e, 'private_space_m2')}
            >
          </div>

          <div class="slider-group">
            <label>
              Integration Level
              <span class="value-display">${this.params.integration_level}%</span>
            </label>
            <input type="range" min="0" max="100"
              .value=${this.params.integration_level}
              @input=${(e: Event) => this.handleInput(e, 'integration_level')}
            >
          </div>

          <div class="slider-group">
            <label>
              Rent Price (PLN)
              <span class="value-display">${this.params.rent_price} PLN</span>
            </label>
            <input type="range" min="1000" max="5000" step="100"
              .value=${this.params.rent_price}
              @input=${(e: Event) => this.handleInput(e, 'rent_price')}
            >
          </div>

           <div class="slider-group">
            <label>
              Standard Level
              <span class="value-display">${this.params.standard_level}%</span>
            </label>
            <input type="range" min="0" max="100"
              .value=${this.params.standard_level}
              @input=${(e: Event) => this.handleInput(e, 'standard_level')}
            >
          </div>
          
          <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                <button @click=${this.downloadReport} ?disabled=${!this.result} style="width: 100%; background: #0f172a; color: white;">
                📄 Download Feasibility Report
                </button>
          </div>
        </div>

        <div class="results">
          <h2>Feasibility Audit</h2>
          ${this.isLoading ? html`<div class="loading-overlay">Updating...</div>` : ''}
          
          ${this.result ? html`
            <div class="score-card">
              <div>Overall Score</div>
              <div class="score-value">${this.result.score}/100</div>
            </div>
            
            <workshop-radar-chart .data=${this.result.breakdown}></workshop-radar-chart>

            <h3>Warnings & Risks</h3>
            ${this.result.warnings.length === 0 ? html`<p style="color: green">No critical issues detected.</p>` : ''}
            ${this.result.warnings.map(w => html`
              <div class="warning">⚠️ ${w}</div>
            `)}
          ` : html`Loading...`}
        </div>
        
        <div class="simulation">
            <h2>Crisis Simulation (Stress Test)</h2>
            <div class="sim-controls">
                <button @click=${() => this.runSimulation('pandemic')} ?disabled=${this.isSimulating}>
                    ${this.isSimulating ? 'Running...' : 'Pandemic (Lockdown)'}
                </button>
                <button @click=${() => this.runSimulation('inflation')} ?disabled=${this.isSimulating}>
                    ${this.isSimulating ? 'Running...' : 'Inflation Spike'}
                </button>
                <button @click=${() => this.runSimulation('neighbor')} ?disabled=${this.isSimulating}>
                    ${this.isSimulating ? 'Running...' : 'Neighbor Conflict'}
                </button>
            </div>
            
            ${this.simulationResult ? html`
                <div class="narrative">
                    <strong>Scenario: ${this.simulationResult.scenario.toUpperCase()}</strong><br>
                    ${this.simulationResult.narrative}
                </div>
                
                <h3>Impact Analysis</h3>
                <workshop-sentiment-graph .impact=${this.simulationResult.impact}></workshop-sentiment-graph>
            ` : html`<p>Select a scenario to stress-test your design.</p>`}
        </div>
      </div>
    `;
  }
}
