import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
  overlay?: boolean;
  text?: string;
}

@customElement('ui-loading')
export class Loading extends LitElement implements LoadingProps {
  static styles: CSSResultGroup = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .loading {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
    }

    .loading--overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      z-index: 1000;
      flex-direction: column;
    }

    .spinner {
      border: 2px solid var(--color-gray-200);
      border-radius: 50%;
      border-top: 2px solid var(--color-primary-600);
      animation: spin 1s linear infinite;
      display: block;
    }

    .spinner--sm {
      width: 16px;
      height: 16px;
    }

    .spinner--md {
      width: 24px;
      height: 24px;
    }

    .spinner--lg {
      width: 32px;
      height: 32px;
    }

    .spinner--color-secondary {
      border-top-color: var(--color-gray-600);
    }

    .spinner--color-white {
      border-top-color: white;
      border-color: rgba(255, 255, 255, 0.3);
    }

    .loading-text {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-top: var(--spacing-3);
    }

    .loading-text--overlay {
      font-size: var(--font-size-base);
      color: var(--color-text-primary);
      margin-top: var(--spacing-4);
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation: none;
        border-top-color: transparent;
        border-right-color: transparent;
        border-bottom-color: var(--color-primary-600);
        border-left-color: var(--color-primary-600);
      }
    }
  `;

  @property({ type: String })
  size: LoadingProps['size'] = 'md';

  @property({ type: String })
  color: LoadingProps['color'] = 'primary';

  @property({ type: Boolean })
  overlay: boolean = false;

  @property({ type: String })
  text?: LoadingProps['text'];

  private getSpinnerClasses() {
    return [
      'spinner',
      `spinner--${this.size}`,
      this.color !== 'primary' ? `spinner--color-${this.color}` : ''
    ].filter(Boolean).join(' ');
  }

  private getLoadingClasses() {
    return [
      'loading',
      this.overlay ? 'loading--overlay' : ''
    ].filter(Boolean).join(' ');
  }

  private getTextClasses() {
    return [
      'loading-text',
      this.overlay ? 'loading-text--overlay' : ''
    ].filter(Boolean).join(' ');
  }

  render(): TemplateResult {
    return html`
      <div class=${this.getLoadingClasses()} role="status" aria-label="Loading">
        <div class=${this.getSpinnerClasses()}></div>
        ${this.text ? html`
          <div class=${this.getTextClasses()}>${this.text}</div>
        ` : ''}
        <slot name="text">${this.text ? '' : html`
          <div class="sr-only">Loading...</div>
        `}</slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-loading': Loading;
  }
}