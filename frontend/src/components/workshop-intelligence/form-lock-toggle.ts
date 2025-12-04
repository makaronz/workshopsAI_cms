/**
 * Workshop Form Lock Toggle
 * Admin component for locking/unlocking workshop forms
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('form-lock-toggle')
export class FormLockToggle extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }

    .toggle-container {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .toggle-container:hover {
      background: #f3f4f6;
    }

    .toggle-switch {
      position: relative;
      width: 48px;
      height: 24px;
      background: #d1d5db;
      border-radius: 12px;
      cursor: pointer;
      transition: background-color 0.3s;
    }

    .toggle-switch.locked {
      background: #dc2626;
    }

    .toggle-switch.unlocked {
      background: #10b981;
    }

    .toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.3s;
    }

    .toggle-switch.locked::after {
      transform: translateX(24px);
    }

    .toggle-label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .toggle-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #6b7280;
    }

    .status-icon {
      font-size: 16px;
    }

    .status-locked {
      color: #dc2626;
    }

    .status-unlocked {
      color: #10b981;
    }

    .loading {
      opacity: 0.6;
      pointer-events: none;
    }

    .error {
      color: #dc2626;
      font-size: 12px;
      margin-top: 4px;
    }

    .description {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
  `;

  @property({ type: String })
  workshopId = '';

  @property({ type: Boolean })
  isEditable = true;

  @state()
  private loading = false;

  @state()
  private error = '';

  connectedCallback() {
    super.connectedCallback();
    if (this.workshopId) {
      this.loadFormStatus();
    }
  }

  private async loadFormStatus() {
    this.loading = true;
    this.error = '';

    try {
      const response = await fetch(`/api/v1/workshop-intelligence/forms/${this.workshopId}`);

      if (response.ok) {
        const data = await response.json();
        this.isEditable = data.isEditable;
      }
    } catch (error) {
      console.error('Error loading form status:', error);
      this.error = 'Failed to load form status';
    } finally {
      this.loading = false;
    }
  }

  private async toggleLock() {
    if (this.loading) return;

    this.loading = true;
    this.error = '';

    const endpoint = this.isEditable ? 'lock' : 'unlock';

    try {
      const response = await fetch(
        `/api/v1/workshop-intelligence/forms/${this.workshopId}/${endpoint}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.isEditable = data.isEditable;

        this.dispatchEvent(
          new CustomEvent('lock-changed', {
            detail: { isEditable: this.isEditable },
            bubbles: true,
            composed: true,
          })
        );
      } else {
        throw new Error('Failed to toggle lock');
      }
    } catch (error) {
      console.error('Error toggling lock:', error);
      this.error = 'Failed to update form lock status';
    } finally {
      this.loading = false;
    }
  }

  render() {
    const isLocked = !this.isEditable;

    return html`
      <div class="toggle-container ${this.loading ? 'loading' : ''}">
        <div
          class="toggle-switch ${isLocked ? 'locked' : 'unlocked'}"
          @click=${this.toggleLock}
          role="switch"
          aria-checked=${!isLocked}
        ></div>

        <div>
          <div class="toggle-label">Form Submissions</div>
          <div class="toggle-status ${isLocked ? 'status-locked' : 'status-unlocked'}">
            <span class="status-icon">${isLocked ? '🔒' : '🔓'}</span>
            <span>${isLocked ? 'Locked' : 'Open'}</span>
          </div>
          ${isLocked
            ? html`<div class="description">Participants cannot edit their responses</div>`
            : html`<div class="description">Participants can edit their responses</div>`}
        </div>
      </div>

      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'form-lock-toggle': FormLockToggle;
  }
}
