import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { Design } from './design-browser';
import './design-browser';
import './visualizations/radar-chart';

@customElement('workshop-compare')
export class WorkshopCompare extends LitElement {
    @state() designA: Design | null = null;
    @state() designB: Design | null = null;
    @state() scoreA: any = null;
    @state() scoreB: any = null;
    @state() showBrowserA = false;
    @state() showBrowserB = false;

    static override styles = css`
    :host { display: block; padding: 2rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
    .card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { margin-bottom: 2rem; }
    .score { font-size: 2rem; font-weight: bold; color: #2563eb; }
    button { 
      padding: 0.5rem 1rem; 
      cursor: pointer; 
      background: #2563eb; 
      color: white; 
      border: none; 
      border-radius: 4px; 
      font-weight: 500;
    }
    button:hover { background: #1d4ed8; }
    .diff-positive { color: green; font-weight: bold; }
    .diff-negative { color: red; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    td, th { padding: 0.75rem; border-bottom: 1px solid #eee; text-align: left; }
    th { font-weight: 600; color: #4b5563; }
  `;

    async fetchScore(params: any) {
        const res = await fetch('/api/v2/workshop/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        const data = await res.json();
        return data.data;
    }

    async selectDesignA(e: CustomEvent<Design>) {
        this.designA = e.detail;
        this.scoreA = await this.fetchScore(this.designA!.parameters);
    }

    async selectDesignB(e: CustomEvent<Design>) {
        this.designB = e.detail;
        this.scoreB = await this.fetchScore(this.designB!.parameters);
    }

    override render() {
        return html`
      <div class="header">
        <h1>Design Comparison</h1>
        <p>Compare two workshop designs side-by-side.</p>
      </div>

      <div class="grid">
        <!-- Design A -->
        <div class="card">
          <h2>Design A</h2>
          ${this.designA ? html`
            <h3>${this.designA.name}</h3>
            <p>${this.designA.description || 'No description'}</p>
            <button @click=${() => this.showBrowserA = true}>Change Design</button>
            
            ${this.scoreA ? html`
              <div class="score">Score: ${this.scoreA.score}</div>
              <workshop-radar-chart .data=${this.scoreA.breakdown}></workshop-radar-chart>
            ` : ''}
          ` : html`
            <div style="text-align: center; padding: 2rem;">
              <button @click=${() => this.showBrowserA = true}>Select Design A</button>
            </div>
          `}
        </div>

        <!-- Design B -->
        <div class="card">
          <h2>Design B</h2>
          ${this.designB ? html`
            <h3>${this.designB.name}</h3>
            <p>${this.designB.description || 'No description'}</p>
            <button @click=${() => this.showBrowserB = true}>Change Design</button>
            
            ${this.scoreB ? html`
              <div class="score">Score: ${this.scoreB.score}</div>
              <workshop-radar-chart .data=${this.scoreB.breakdown}></workshop-radar-chart>
            ` : ''}
          ` : html`
            <div style="text-align: center; padding: 2rem;">
              <button @click=${() => this.showBrowserB = true}>Select Design B</button>
            </div>
          `}
        </div>
      </div>

      ${this.designA && this.designB ? html`
        <div class="card" style="margin-top: 2rem;">
          <h2>Parameter Comparison</h2>
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>${this.designA.name}</th>
                <th>${this.designB.name}</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(this.designA.parameters).map(key => {
            const valA = this.designA!.parameters[key];
            const valB = this.designB!.parameters[key];
            const diff = valB - valA;
            return html`
                  <tr>
                    <td>${key.replace(/_/g, ' ')}</td>
                    <td>${valA}</td>
                    <td>${valB}</td>
                    <td class="${diff > 0 ? 'diff-positive' : (diff < 0 ? 'diff-negative' : '')}">
                      ${diff > 0 ? '+' : ''}${diff}
                    </td>
                  </tr>
                `;
        })}
            </tbody>
          </table>
        </div>
      ` : ''}

      <design-browser 
        .open=${this.showBrowserA} 
        @close=${() => this.showBrowserA = false}
        @design-selected=${this.selectDesignA}
      ></design-browser>

      <design-browser 
        .open=${this.showBrowserB} 
        @close=${() => this.showBrowserB = false}
        @design-selected=${this.selectDesignB}
      ></design-browser>
    `;
    }
}
