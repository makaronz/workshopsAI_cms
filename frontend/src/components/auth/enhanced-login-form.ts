import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import authService, { LoginCredentials, AuthResponse } from '../../services/auth';
import i18nService from '../../services/i18n';
import { ValidationSchemas, realTimeValidator, InputSanitizer } from '../../utils/validation';

@customElement('enhanced-login-form')
export class EnhancedLoginForm extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      background: linear-gradient(135deg, #eef2ff, #e0f2fe);
    }

    .login-card {
      width: min(480px, 100%);
      padding: 2.5rem;
      border-radius: 16px;
      background: var(--surface-color, #ffffff);
      box-shadow:
        0 10px 15px -3px rgba(15, 23, 42, 0.15),
        0 4px 6px -4px rgba(15, 23, 42, 0.1);
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
      position: relative;
    }

    .form-label {
      display: block;
      font-weight: 500;
      color: var(--text-color, #1f2937);
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }

    .input-wrapper {
      position: relative;
    }

    .form-input {
      width: 100%;
      padding: 0.75rem 1rem;
      padding-right: 2.5rem;
      border: 2px solid var(--border-color, #d1d5db);
      border-radius: 8px;
      font-size: 1rem;
      transition: all 0.15s ease;
      background: var(--input-bg, #ffffff);
      color: var(--text-color, #1f2937);
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary-color, #2563eb);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .form-input.valid {
      border-color: var(--success-color, #059669);
    }

    .form-input.error {
      border-color: var(--error-color, #dc2626);
    }

    .validation-icon {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: bold;
      color: white;
    }

    .validation-icon.valid {
      background: var(--success-color, #059669);
    }

    .validation-icon.invalid {
      background: var(--error-color, #dc2626);
    }

    .form-error {
      color: var(--error-color, #dc2626);
      font-size: 0.875rem;
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .form-error::before {
      content: '⚠';
      font-size: 1rem;
    }

    .field-hint {
      font-size: 0.75rem;
      color: var(--text-color-secondary, #6b7280);
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
      padding: 0.875rem 1.5rem;
      background: var(--primary-color, #2563eb);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
      overflow: hidden;
    }

    .login-button:hover:not(:disabled) {
      background: var(--primary-hover, #1d4ed8);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }

    .login-button:active:not(:disabled) {
      transform: translateY(0);
    }

    .login-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .login-button.loading {
      color: transparent;
      pointer-events: none;
    }

    .login-button.loading::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 1.25rem;
      height: 1.25rem;
      margin: -0.625rem 0 0 -0.625rem;
      border: 2px solid transparent;
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .security-info {
      background: var(--info-bg, #eff6ff);
      border: 1px solid var(--info-border, #bfdbfe);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
      color: var(--info-color, #1e40af);
    }

    .security-info h4 {
      margin: 0 0 0.5rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .security-info h4::before {
      content: '🔒';
      font-size: 1rem;
    }

    .security-info ul {
      margin: 0.5rem 0 0 0;
      padding-left: 1.5rem;
    }

    .security-info li {
      margin-bottom: 0.25rem;
    }

    .forgot-password-link {
      text-align: center;
      margin-top: 1rem;
    }

    .forgot-password-link a {
      color: var(--primary-color, #2563eb);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
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
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
      border: 1px solid var(--error-border, #fecaca);
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .error-message::before {
      content: '❌';
      flex-shrink: 0;
      font-size: 1rem;
    }

    .success-message {
      background: var(--success-bg, #d1fae5);
      color: var(--success-color, #059669);
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
      border: 1px solid var(--success-border, #a7f3d0);
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .success-message::before {
      content: '✅';
      flex-shrink: 0;
      font-size: 1rem;
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .form-input {
        border-width: 3px;
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

    /* Focus visible for keyboard navigation */
    .form-input:focus-visible,
    .login-button:focus-visible {
      outline: 2px solid var(--focus-color, #2563eb);
      outline-offset: 2px;
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
  private fieldValidation: Record<string, { isValid: boolean; message?: string }> = {};

  @state()
  private isLoading: boolean = false;

  @state()
  private serverError: string = '';

  @state()
  private serverSuccess: string = '';

  @state()
  private showSecurityInfo: boolean = false;

  @state()
  private loginAttempts: number = 0;

  @state()
  private isBlocked: boolean = false;

  @state()
  private blockTimeLeft: number = 0;

  private formId = 'enhanced-login-form';

  connectedCallback() {
    super.connectedCallback();
    // Register validator for this form
    realTimeValidator.registerValidator(this.formId, ValidationSchemas.login);

    // Check for existing block from previous failed attempts
    this.checkLoginBlock();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Cleanup is handled by the global validator instance
  }

  private checkLoginBlock(): void {
    const blockedUntil = localStorage.getItem('loginBlockedUntil');
    if (blockedUntil) {
      const blockTime = parseInt(blockedUntil);
      if (Date.now() < blockTime) {
        this.isBlocked = true;
        this.blockTimeLeft = Math.ceil((blockTime - Date.now()) / 1000);
        this.startBlockCountdown();
      } else {
        localStorage.removeItem('loginBlockedUntil');
        localStorage.removeItem('loginAttempts');
        this.loginAttempts = 0;
      }
    } else {
      const attempts = localStorage.getItem('loginAttempts');
      this.loginAttempts = attempts ? parseInt(attempts) : 0;
    }
  }

  private startBlockCountdown(): void {
    const countdown = setInterval(() => {
      this.blockTimeLeft--;
      if (this.blockTimeLeft <= 0) {
        clearInterval(countdown);
        this.isBlocked = false;
        this.loginAttempts = 0;
        localStorage.removeItem('loginBlockedUntil');
        localStorage.removeItem('loginAttempts');
      }
    }, 1000);
  }

  private handleLoginFailure(): void {
    this.loginAttempts++;
    localStorage.setItem('loginAttempts', this.loginAttempts.toString());

    // Block after 5 failed attempts for 15 minutes
    if (this.loginAttempts >= 5) {
      const blockUntil = Date.now() + (15 * 60 * 1000);
      localStorage.setItem('loginBlockedUntil', blockUntil.toString());
      this.isBlocked = true;
      this.blockTimeLeft = 15 * 60;
      this.startBlockCountdown();

      this.serverError = 'Too many failed login attempts. Please try again later.';
      this.announceToScreenReader(this.serverError, 'assertive');
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
      this.errors = { ...this.errors, [name]: '' };
    }

    // Clear server messages when user makes changes
    if (this.serverError || this.serverSuccess) {
      this.serverError = '';
      this.serverSuccess = '';
    }

    // Real-time validation with debouncing
    if (name !== 'rememberMe') {
      realTimeValidator.validateField(
        this.formId,
        name,
        value,
        this.formData,
        300,
        (result) => {
          this.fieldValidation = {
            ...this.fieldValidation,
            [name]: {
              isValid: result.isValid,
              message: result.error
            }
          };
        }
      );
    }
  }

  private validateForm(): boolean {
    const result = realTimeValidator.validateForm(this.formId, this.formData);

    this.errors = result.errors;
    this.fieldValidation = Object.keys(result.errors).reduce((acc, key) => {
      acc[key] = {
        isValid: false,
        message: result.errors[key]
      };
      return acc;
    }, {} as Record<string, { isValid: boolean; message?: string }>);

    return result.isValid;
  }

  private async handleSubmit(event: Event) {
    event.preventDefault();

    if (this.isBlocked || this.isLoading) {
      return;
    }

    if (!this.validateForm()) {
      this.serverError = 'Please correct the errors below.';
      this.announceToScreenReader(this.serverError, 'assertive');
      return;
    }

    this.isLoading = true;
    this.serverError = '';
    this.serverSuccess = '';

    try {
      const response: AuthResponse = await authService.login(this.formData);

      // Reset login attempts on successful login
      this.loginAttempts = 0;
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('loginBlockedUntil');

      // Emit success event
      this.dispatchEvent(new CustomEvent('login-success', {
        detail: { user: response.user },
        bubbles: true
      }));

      this.serverSuccess = 'Signed in successfully! Redirecting...';
      this.announceToScreenReader(this.serverSuccess, 'polite');

    } catch (error) {
      this.handleLoginFailure();
      this.serverError = error instanceof Error ? error.message : 'Unable to sign in right now. Please try again.';
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
      if (this.shadowRoot?.contains(announcement)) {
        this.shadowRoot.removeChild(announcement);
      }
    }, 1000);
  }

  private formatBlockTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  render(): TemplateResult {
    const { email, password, rememberMe } = this.formData;
    const { errors, isLoading, serverError, serverSuccess, fieldValidation, isBlocked, blockTimeLeft } = this;

    return html`
      <div class="login-card">
        <form @submit=${this.handleSubmit} novalidate autocomplete="off">
          <div class="login-header">
            <h1 class="login-title">WorkshopsAI CMS</h1>
            <p class="login-subtitle">Sign in to manage your research workflows</p>
          </div>

          ${this.showSecurityInfo ? html`
            <div class="security-info" role="region" aria-labelledby="security-title">
              <h4 id="security-title">Security Features</h4>
              <ul>
                <li>Input validation and sanitization</li>
                <li>Rate limiting and brute force protection</li>
                <li>Secure session management</li>
                <li>HTTPS encrypted communication</li>
              </ul>
            </div>
          ` : ''}

          ${serverError ? html`
            <div class="error-message" role="alert" aria-live="assertive">
              ${serverError}
            </div>
          ` : ''}

          ${serverSuccess ? html`
            <div class="success-message" role="status" aria-live="polite">
              ${serverSuccess}
            </div>
          ` : ''}

          ${isBlocked ? html`
            <div class="error-message" role="alert" aria-live="assertive">
              Account temporarily locked due to multiple failed login attempts.
              Please try again in ${this.formatBlockTime(blockTimeLeft)}.
            </div>
          ` : ''}

          <div class="form-group">
            <label for="email" class="form-label">
              Email address
              <span aria-label="required">*</span>
            </label>
            <div class="input-wrapper">
              <input
                id="email"
                name="email"
                type="email"
                data-testid="email-input"
                class=${classMap({
                  'form-input': true,
                  'valid': fieldValidation.email?.isValid === true,
                  'error': fieldValidation.email?.isValid === false
                })}
                value=${email}
                @input=${this.handleInputChange}
                @blur=${() => this.handleInputChange({ target: { name: 'email', value: email } } as any)}
                autocomplete="email"
                required
                aria-required="true"
                aria-describedby=${errors.email ? 'email-error' : ''}
                aria-invalid=${!!errors.email}
                ?disabled=${isBlocked || isLoading}
              />
              ${fieldValidation.email?.isValid !== undefined ? html`
                <div class="validation-icon ${fieldValidation.email.isValid ? 'valid' : 'invalid'}" aria-hidden="true">
                  ${fieldValidation.email.isValid ? '✓' : '✕'}
                </div>
              ` : ''}
            </div>
            ${fieldValidation.email?.message ? html`
              <div id="email-error" class="form-error" role="alert">
                ${fieldValidation.email.message}
              </div>
            ` : ''}
            ${!fieldValidation.email?.message && !fieldValidation.email?.isValid ? html`
              <div class="field-hint">Enter your work email address</div>
            ` : ''}
          </div>

          <div class="form-group">
            <label for="password" class="form-label">
              Password
              <span aria-label="required">*</span>
            </label>
            <div class="input-wrapper">
              <input
                id="password"
                name="password"
                type="password"
                data-testid="password-input"
                class=${classMap({
                  'form-input': true,
                  'valid': fieldValidation.password?.isValid === true,
                  'error': fieldValidation.password?.isValid === false
                })}
                value=${password}
                @input=${this.handleInputChange}
                @blur=${() => this.handleInputChange({ target: { name: 'password', value: password } } as any)}
                autocomplete="current-password"
                required
                aria-required="true"
                aria-describedby=${errors.password ? 'password-error' : ''}
                aria-invalid=${!!errors.password}
                ?disabled=${isBlocked || isLoading}
              />
              ${fieldValidation.password?.isValid !== undefined ? html`
                <div class="validation-icon ${fieldValidation.password.isValid ? 'valid' : 'invalid'}" aria-hidden="true">
                  ${fieldValidation.password.isValid ? '✓' : '✕'}
                </div>
              ` : ''}
            </div>
            ${fieldValidation.password?.message ? html`
              <div id="password-error" class="form-error" role="alert">
                ${fieldValidation.password.message}
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
              ?disabled=${isBlocked || isLoading}
            />
            <label for="remember-me" class="checkbox-label">
              Remember me on this device
            </label>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              data-testid="login-button"
              class=${classMap({
                'login-button': true,
                'loading': isLoading
              })}
              ?disabled=${isBlocked || isLoading || !this.validateForm()}
              aria-describedby=${serverError ? 'server-error' : ''}
            >
              ${isLoading ? 'Signing in…' : (isBlocked ? 'Account Locked' : 'Sign In')}
            </button>
          </div>

          <div class="forgot-password-link">
            <a href="/forgot-password" @click=${(e: Event) => {
              e.preventDefault();
              this.dispatchEvent(new CustomEvent('forgot-password', { bubbles: true }));
            }}>
              Forgot password?
            </a>
          </div>
        </form>

        <div class="register-link">
          <span>Need an account?</span>
          <a href="/register" @click=${(e: Event) => {
            e.preventDefault();
            this.dispatchEvent(new CustomEvent('navigate-to-register', { bubbles: true }));
          }}>
            Create an account
          </a>
        </div>

        <div style="text-align: center; margin-top: 1rem;">
          <button
            type="button"
            class="form-checkbox-label"
            style="background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 0.75rem;"
            @click=${() => this.showSecurityInfo = !this.showSecurityInfo}
            aria-expanded=${this.showSecurityInfo}
            aria-controls="security-info"
          >
            ${this.showSecurityInfo ? 'Hide' : 'Show'} Security Information
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'enhanced-login-form': EnhancedLoginForm;
  }
}