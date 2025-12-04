import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';

export interface Design {
    id: string;
    name: string;
    description: string;
    updatedAt: string;
    parameters: any;
}

@customElement('design-browser')
export class DesignBrowser extends LitElement {
    @property({ type: Boolean }) open = false;
    @state() designs: Design[] = [];
    @state() loading = false;

    static override styles = css`
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100;
    }
    .modal-content {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .design-item {
      padding: 1rem;
      border: 1px solid #e5e7eb;
      margin-bottom: 0.5rem;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .design-item:hover {
      background: #f3f4f6;
      border-color: #2563eb;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .close-btn {
      cursor: pointer;
      font-size: 1.5rem;
      color: #6b7280;
      line-height: 1;
    }
    .close-btn:hover {
      color: #1f2937;
    }
    h2 {
      margin: 0;
      font-size: 1.5rem;
      color: #1f2937;
    }
    .meta {
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 0.25rem;
    }
    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }
  `;

    async fetchDesigns() {
        this.loading = true;
        try {
            const res = await fetch('/api/v2/workshop/designs');
            const data = await res.json();
            if (data.success) {
                this.designs = data.data;
            }
        } catch (e) {
            console.error(e);
        } finally {
            this.loading = false;
        }
    }

    override updated(changedProperties: Map<string, any>) {
        if (changedProperties.has('open') && this.open) {
            this.fetchDesigns();
        }
    }

    selectDesign(design: Design) {
        this.dispatchEvent(new CustomEvent('design-selected', {
            detail: design,
            bubbles: true,
            composed: true
        }));
        this.close();
    }

    close() {
        this.open = false;
        this.dispatchEvent(new CustomEvent('close'));
    }

    override render() {
        if (!this.open) return null;

        return html`
      <div class="modal-overlay" @click=${() => this.close()}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <h2>Load Design</h2>
            <span class="close-btn" @click=${() => this.close()}>&times;</span>
          </div>
          
          ${this.loading ? html`<p>Loading...</p>` : ''}
          
          ${!this.loading && this.designs.length === 0 ? html`
            <div class="empty-state">No saved designs found.</div>
          ` : ''}

          ${this.designs.map(d => html`
            <div class="design-item" @click=${() => this.selectDesign(d)}>
              <div style="font-weight: 600; color: #1f2937">${d.name}</div>
              ${d.description ? html`<div class="meta">${d.description}</div>` : ''}
              <div class="meta">Last updated: ${new Date(d.updatedAt).toLocaleDateString()}</div>
            </div>
          `)}
        </div>
      </div>
    `;
    }
}
