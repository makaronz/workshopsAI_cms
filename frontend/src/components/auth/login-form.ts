import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { t } from '../../services/i18n';
import authService, { LoginCredentials, AuthResponse } from '../../services/auth';

@customElement('login-form')
export class LoginForm extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      max-width: 400px;
      margin: 0 auto;
      padding: 2rem;
      background: var(--surface-color, #ffffff);
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .login-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .login-title {
      font-size: 1.875rem;
      font-weight: 700;
      color: var(--text-color, #1f2937);
      margin: 0 0 0.5rem 0;
    }

    .login-subtitle {
      color: var(--text-color-secondary, #6b7280);
      margin: 0;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-weight: 500;
      color: var(--text-color, #1f2937);
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }

    .form-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-color, #d1d5db);
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.15s, box-shadow 0.15s;
      background: var(--input-bg, #ffffff);
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary-color, #2563eb);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .form-input.error {
      border-color: var(--error-color, #dc2626);
    }

    .form-error {
      color: var(--error-color, #dc2626);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .form-checkbox-group {
      display: flex;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .form-checkbox {
      width: 1rem;
      height: 1rem;
      margin-right: 0.5rem;
      accent-color: var(--primary-color, #2563eb);
    }

    .checkbox-label {
      font-size: 0.875rem;
      color: var(--text-color, #1f2937);
    }

    .form-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .login-button {
      width: 100%;
      padding: 0.75rem 1.5rem;
      background: var(--primary-color, #2563eb);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .login-button:hover:not(:disabled) {
      background: var(--primary-hover, #1d4ed8);
    }

    .login-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .login-button.loading {
      position: relative;
      color: transparent;
    }

    .login-button.loading::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 1rem;
      height: 1rem;
      margin: -0.5rem 0 0 -0.5rem;
      border: 2px solid transparent;
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .forgot-password-link {
      text-align: center;
      margin-top: 1rem;
    }

    .forgot-password-link a {
      color: var(--primary-color, #2563eb);
      text-decoration: none;
      font-size: 0.875rem;
    }

    .forgot-password-link a:hover {
      text-decoration: underline;
    }

    .register-link {
      text-align: center;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border-color, #d1d5db);
      font-size: 0.875rem;
      color: var(--text-color-secondary, #6b7280);
    }

    .register-link a {
      color: var(--primary-color, #2563eb);
      text-decoration: none;
      font-weight: 500;
    }

    .register-link a:hover {
      text-decoration: underline;
    }

    .error-message {
      background: var(--error-bg, #fee2e2);
      color: var(--error-color, #dc2626);
      padding: 0.75rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      border: 1px solid var(--error-border, #fecaca);
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .form-input {
        border-width: 2px;
      }

      .login-button {
        border: 2px solid transparent;
      }
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .login-button,
      .form-input,
      .login-button.loading::after {
        transition: none;
        animation: none;
      }
    }

    /* Mobile responsive */
    @media (max-width: 480px) {
      :host {
        padding: 1rem;
      }

      .login-title {
        font-size: 1.5rem;
      }
    }
  `;

  @state()
  private formData: LoginCredentials = {
    email: '',
    password: '',
    rememberMe: false
  };

  @state()
  private errors: Record<string, string> = {};

  @state()
  private isLoading: boolean = false;

  @state()
  private serverError: string = '';

  @state()
  private autoFocus: boolean = true;

  firstUpdated() {
    // Auto-focus email field when component loads
    const emailInput = this.shadowRoot?.querySelector('#email') as HTMLInputElement;
    if (emailInput && this.autoFocus) {
      // Use setTimeout to ensure focus trap doesn't interfere
      setTimeout(() => emailInput.focus(), 100);
    }
  }

  private handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const { name, value, type, checked } = target;

    this.formData = {
      ...this.formData,
      [name]: type === 'checkbox' ? checked : value
    };

    // Clear errors for this field when user starts typing
    if (this.errors[name]) {
      this.errors = {
        ...this.errors,
        [name]: ''
      };
    }

    // Clear server error when user makes changes
    if (this.serverError) {
      this.serverError = '';
    }
  }

  private validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!this.formData.email) {
      errors.email = t('forms.validation.required');
    } else if (!this.isValidEmail(this.formData.email)) {
      errors.email = t('forms.validation.email');
    }

    if (!this.formData.password) {
      errors.password = t('forms.validation.required');
    }

    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async handleSubmit(event: Event) {
    event.preventDefault();

    if (!this.validateForm() || this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.serverError = '';

    try {
      const response: AuthResponse = await authService.login(this.formData);

      // Emit success event
      this.dispatchEvent(new CustomEvent('login-success', {
        detail: { user: response.user },
        bubbles: true
      }));

      // Announce success to screen readers
      this.announceToScreenReader(t('auth.loginSuccess'));

    } catch (error) {
      this.serverError = error instanceof Error ? error.message : t('auth.loginError');

      // Announce error to screen readers
      this.announceToScreenReader(this.serverError, 'assertive');
    } finally {
      this.isLoading = false;
    }
  }

  private announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = message;

    this.shadowRoot?.appendChild(announcement);
    setTimeout(() => {
      this.shadowRoot?.removeChild(announcement);
    }, 1000);
  }

  private handleKeyDown(event: KeyboardEvent) {
    // Handle Enter key on form fields
    if (event.key === 'Enter' && !this.isLoading) {
      this.handleSubmit(event);
    }
  }

  render(): TemplateResult {
    const { email, password, rememberMe } = this.formData;
    const { errors, isLoading, serverError } = this;

    return html`
      <form @submit=${this.handleSubmit} @keydown=${this.handleKeyDown} novalidate>
        <div class="login-header">
          <h1 class="login-title">${t('auth.login')}</h1>
          <p class="login-subtitle">${t('app.title')}</p>
        </div>

        ${serverError ? html`
          <div class="error-message" role="alert" aria-live="polite">
            ${serverError}
          </div>
        ` : ''}

        <div class="form-group">
          <label for="email" class="form-label">
            ${t('auth.email')}
            <span aria-label="required">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            class=${classMap({
              'form-input': true,
              'error': !!errors.email
            })}
            value=${email}
            @input=${this.handleInputChange}
            autocomplete="email"
            required
            aria-required="true"
            aria-describedby=${errors.email ? 'email-error' : ''}
            aria-invalid=${!!errors.email}
          />
          ${errors.email ? html`
            <div id="email-error" class="form-error" role="alert">
              ${errors.email}
            </div>
          ` : ''}
        </div>

        <div class="form-group">
          <label for="password" class="form-label">
            ${t('auth.password')}
            <span aria-label="required">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            class=${classMap({
              'form-input': true,
              'error': !!errors.password
            })}
            value=${password}
            @input=${this.handleInputChange}
            autocomplete="current-password"
            required
            aria-required="true"
            aria-describedby=${errors.password ? 'password-error' : ''}
            aria-invalid=${!!errors.password}
          />
          ${errors.password ? html`
            <div id="password-error" class="form-error" role="alert">
              ${errors.password}
            </div>
          ` : ''}
        </div>

        <div class="form-checkbox-group">
          <input
            id="remember-me"
            name="rememberMe"
            type="checkbox"
            class="form-checkbox"
            ?checked=${rememberMe}
            @change=${this.handleInputChange}
          />
          <label for="remember-me" class="checkbox-label">
            ${t('auth.rememberMe')}
          </label>
        </div>

        <div class="form-actions">
          <button
            type="submit"
            class=${classMap({
              'login-button': true,
              'loading': isLoading
            })}
            ?disabled=${isLoading}
            aria-describedby=${serverError ? 'server-error' : ''}
          >
            ${isLoading ? t('common.loading') : t('auth.login')}
          </button>
        </div>

        <div class="forgot-password-link">
          <a href="/forgot-password" @click=${(e: Event) => {
            e.preventDefault();
            this.dispatchEvent(new CustomEvent('forgot-password', { bubbles: true }));
          }}>
            ${t('auth.forgotPassword')}
          </a>
        </div>
      </form>

      <div class="register-link">
        <span>${t('auth.noAccount')} </span>
        <a href="/register" @click=${(e: Event) => {
          e.preventDefault();
          this.dispatchEvent(new CustomEvent('navigate-to-register', { bubbles: true }));
        }}>
          ${t('auth.register')}
        </a>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'login-form': LoginForm;
  }
}