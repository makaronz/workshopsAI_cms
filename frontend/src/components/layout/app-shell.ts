import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Router } from '@vaadin/router';
import authService from '../../services/auth';
import t from '../../services/i18n';
import './app-header';
import './app-footer';

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--bg-color, #f9fafb);
    }

    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .app-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    main {
      flex: 1;
      padding: 0;
      background: var(--bg-color, #f9fafb);
    }

    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      flex-direction: column;
      gap: 1rem;
    }

    .loading-spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid var(--border-color, #e5e7eb);
      border-top-color: var(--primary-color, #2563eb);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-text {
      color: var(--text-color-secondary, #6b7280);
      font-size: 0.875rem;
    }

    .error-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      flex-direction: column;
      gap: 1rem;
      text-align: center;
      padding: 2rem;
    }

    .error-icon {
      width: 3rem;
      height: 3rem;
      color: var(--error-color, #dc2626);
    }

    .error-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color, #1f2937);
      margin: 0;
    }

    .error-message {
      color: var(--text-color-secondary, #6b7280);
      max-width: 400px;
      line-height: 1.5;
    }

    .error-actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .error-button {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-color, #d1d5db);
      border-radius: 6px;
      background: var(--surface-color, #ffffff);
      color: var(--text-color, #1f2937);
      text-decoration: none;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.15s;
    }

    .error-button:hover {
      background: var(--surface-hover, #f3f4f6);
      border-color: var(--border-hover, #9ca3af);
    }

    .error-button.primary {
      background: var(--primary-color, #2563eb);
      color: white;
      border-color: var(--primary-color, #2563eb);
    }

    .error-button.primary:hover {
      background: var(--primary-hover, #1d4ed8);
      border-color: var(--primary-hover, #1d4ed8);
    }

    /* Skip link for accessibility */
    .skip-link {
      position: absolute;
      top: -40px;
      left: 6px;
      background: var(--primary-color, #2563eb);
      color: white;
      padding: 8px;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      z-index: 1000;
      transition: top 0.2s;
    }

    .skip-link:focus {
      top: 6px;
    }

    /* Responsive design */
    @media (max-width: 768px) {
      main {
        padding: 0;
      }

      .error-container {
        padding: 1rem;
      }

      .error-actions {
        flex-direction: column;
        width: 100%;
      }

      .error-button {
        width: 100%;
        text-align: center;
      }
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .error-button {
        border-width: 2px;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .loading-spinner,
      .skip-link {
        transition: none;
        animation: none;
      }
    }
  `;

  @state()
  private isLoading: boolean = true;

  @state()
  private isAuthenticated: boolean = false;

  @state()
  private currentUser: any = null;

  @state()
  private error: string | null = null;

  @property()
  router: Router | null = null;

  private authUnsubscribe: (() => void) | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.initializeApp();
    this.setupAuthListener();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
  }

  private async initializeApp() {
    try {
      this.isLoading = true;
      this.error = null;

      // Check authentication status
      const isAuth = await authService.isAuthenticated();
      const user = await authService.getCurrentUser();

      this.isAuthenticated = isAuth;
      this.currentUser = user;

      // Initialize router with current auth state
      this.initializeRouter();

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.error = 'Failed to initialize application. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  private setupAuthListener() {
    this.authUnsubscribe = authService.subscribeToAuthChanges((user) => {
      this.isAuthenticated = !!user;
      this.currentUser = user;

      // Update router navigation based on auth state
      this.updateNavigation();
    });
  }

  private initializeRouter() {
    // This would be handled by the main router setup
    // This is just a placeholder for demonstration
  }

  private updateNavigation() {
    // Emit custom event for navigation components to listen to
    this.dispatchEvent(new CustomEvent('auth-changed', {
      detail: {
        isAuthenticated: this.isAuthenticated,
        user: this.currentUser
      }
    }));
  }

  private handleRetry() {
    this.initializeApp();
  }

  private handleLogout() {
    authService.logout().then(() => {
      window.location.href = '/login';
    });
  }

  private renderLoading(): TemplateResult {
    return html`
      <div class="loading-container" role="status" aria-live="polite">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p class="loading-text">${t('common.loading')}</p>
      </div>
    `;
  }

  private renderError(): TemplateResult {
    return html`
      <div class="error-container" role="alert">
        <svg class="error-icon" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <h2 class="error-title">${t('app.error')}</h2>
        <p class="error-message">${this.error || t('common.error')}</p>
        <div class="error-actions">
          <button class="error-button primary" @click=${this.handleRetry}>
            ${t('app.retry')}
          </button>
          ${this.isAuthenticated ? html`
            <button class="error-button" @click=${this.handleLogout}>
              ${t('auth.logout')}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderContent(): TemplateResult {
    return html`
      <div class="app-container">
        <a href="#main" class="skip-link">${t('accessibility.skipToContent')}</a>

        <app-header ?isAuthenticated=${this.isAuthenticated} .user=${this.currentUser}></app-header>

        <div class="app-content">
          <main id="main" role="main">
            <slot></slot>
          </main>
        </div>

        <app-footer></app-footer>
      </div>
    `;
  }

  render(): TemplateResult {
    if (this.isLoading) {
      return this.renderLoading();
    }

    if (this.error) {
      return this.renderError();
    }

    return this.renderContent();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell;
  }
}