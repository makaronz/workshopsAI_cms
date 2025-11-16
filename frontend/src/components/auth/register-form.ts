import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import authService, { RegisterData, AuthResponse } from '../../services/auth';

@customElement('register-form')
export class RegisterForm extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      background: linear-gradient(135deg, #eef2ff, #e0f2fe);
    }

    .register-card {
      width: min(520px, 100%);
      padding: 2.5rem;
      border-radius: 16px;
      background: var(--surface-color, #ffffff);
      box-shadow:
        0 10px 15px -3px rgba(15, 23, 42, 0.15),
        0 4px 6px -4px rgba(15, 23, 42, 0.1);
    }

    .register-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .register-title {
      font-size: 1.875rem;
      font-weight: 700;
      color: var(--text-color, #1f2937);
      margin: 0 0 0.5rem 0;
    }

    .register-subtitle {
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
      color: var(--text-color, #1f2937);
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary-color, #2563eb);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .form-input.error {
      border-color: var(--error-color, #dc2626);
    }

    .form-select {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-color, #d1d5db);
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.15s, box-shadow 0.15s;
      background: var(--input-bg, #ffffff);
      color: var(--text-color, #1f2937);
    }

    .form-select:focus {
      outline: none;
      border-color: var(--primary-color, #2563eb);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .form-error {
      color: var(--error-color, #dc2626);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .form-checkbox-group {
      display: flex;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }

    .form-checkbox {
      width: 1rem;
      height: 1rem;
      margin-right: 0.5rem;
      margin-top: 0.125rem;
      accent-color: var(--primary-color, #2563eb);
      flex-shrink: 0;
    }

    .checkbox-label {
      font-size: 0.875rem;
      color: var(--text-color, #1f2937);
      line-height: 1.5;
    }

    .checkbox-label a {
      color: var(--primary-color, #2563eb);
      text-decoration: none;
    }

    .checkbox-label a:hover {
      text-decoration: underline;
    }

    .form-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .register-button {
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

    .register-button:hover:not(:disabled) {
      background: var(--primary-hover, #1d4ed8);
    }

    .register-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .register-button.loading {
      position: relative;
      color: transparent;
    }

    .register-button.loading::after {
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

    .login-link {
      text-align: center;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border-color, #d1d5db);
      font-size: 0.875rem;
      color: var(--text-color-secondary, #6b7280);
    }

    .login-link a {
      color: var(--primary-color, #2563eb);
      text-decoration: none;
      font-weight: 500;
    }

    .login-link a:hover {
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

    .success-message {
      background: var(--success-bg, #d1fae5);
      color: var(--success-color, #059669);
      padding: 0.75rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      border: 1px solid var(--success-border, #a7f3d0);
    }

    /* Mobile responsive */
    @media (max-width: 480px) {
      :host {
        padding: 1rem;
      }

      .register-title {
        font-size: 1.5rem;
      }
    }
  `;

  @state()
  private formData: RegisterData = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'participant',
    agreeToTerms: false,
  };

  @state()
  private errors: Partial<Record<keyof RegisterData, string>> = {};

  @state()
  private isLoading = false;

  @state()
  private serverError: string | null = null;

  @state()
  private successMessage: string | null = null;

  private handleInputChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const { name, value, type } = target;
    const checked = (target as HTMLInputElement).checked;

    if (type === 'checkbox') {
      this.formData = {
        ...this.formData,
        [name]: checked,
      };
    } else {
      this.formData = {
        ...this.formData,
        [name]: value,
      };
    }

    // Clear error for this field
    if (this.errors[name as keyof RegisterData]) {
      this.errors = {
        ...this.errors,
        [name]: undefined,
      };
    }

    this.serverError = null;
  }

  private validateForm(): boolean {
    const newErrors: Partial<Record<keyof RegisterData, string>> = {};

    if (!this.formData.name || this.formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!this.formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!this.formData.password) {
      newErrors.password = 'Password is required';
    } else if (this.formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!this.formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (this.formData.password !== this.formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!this.formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    this.errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.serverError = null;
    this.successMessage = null;

    try {
      const response = await authService.register(this.formData);
      
      this.successMessage = 'Registration successful! Redirecting...';
      
      // Dispatch success event
      this.dispatchEvent(new CustomEvent('register-success', {
        detail: response,
        bubbles: true,
      }));

      // Redirect to dashboard after short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (error: any) {
      this.serverError = error instanceof Error ? error.message : 'Registration failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.isLoading) {
      this.handleSubmit(event);
    }
  }

  render(): TemplateResult {
    const { name, email, password, confirmPassword, role, agreeToTerms } = this.formData;
    const { errors, isLoading, serverError, successMessage } = this;

    return html`
      <div class="register-card">
        <form @submit=${this.handleSubmit} @keydown=${this.handleKeyDown} novalidate>
          <div class="register-header">
            <h1 class="register-title">Create Account</h1>
            <p class="register-subtitle">Sign up for WorkshopsAI CMS</p>
          </div>

          ${serverError ? html`
            <div class="error-message" role="alert" aria-live="polite">
              ${serverError}
            </div>
          ` : ''}

          ${successMessage ? html`
            <div class="success-message" role="alert" aria-live="polite">
              ${successMessage}
            </div>
          ` : ''}

          <div class="form-group">
            <label for="name" class="form-label">
              Full Name
              <span aria-label="required">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              class=${classMap({
                'form-input': true,
                'error': !!errors.name
              })}
              value=${name}
              @input=${this.handleInputChange}
              autocomplete="name"
              required
              aria-required="true"
              aria-describedby=${errors.name ? 'name-error' : ''}
              aria-invalid=${!!errors.name}
            />
            ${errors.name ? html`
              <div id="name-error" class="form-error" role="alert">
                ${errors.name}
              </div>
            ` : ''}
          </div>

          <div class="form-group">
            <label for="email" class="form-label">
              Email address
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
            <label for="role" class="form-label">
              Role
              <span aria-label="required">*</span>
            </label>
            <select
              id="role"
              name="role"
              class="form-select"
              value=${role}
              @change=${this.handleInputChange}
              required
              aria-required="true"
            >
              <option value="participant">Participant</option>
              <option value="facilitator">Facilitator</option>
            </select>
          </div>

          <div class="form-group">
            <label for="password" class="form-label">
              Password
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
              autocomplete="new-password"
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

          <div class="form-group">
            <label for="confirmPassword" class="form-label">
              Confirm Password
              <span aria-label="required">*</span>
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              class=${classMap({
                'form-input': true,
                'error': !!errors.confirmPassword
              })}
              value=${confirmPassword}
              @input=${this.handleInputChange}
              autocomplete="new-password"
              required
              aria-required="true"
              aria-describedby=${errors.confirmPassword ? 'confirmPassword-error' : ''}
              aria-invalid=${!!errors.confirmPassword}
            />
            ${errors.confirmPassword ? html`
              <div id="confirmPassword-error" class="form-error" role="alert">
                ${errors.confirmPassword}
              </div>
            ` : ''}
          </div>

          <div class="form-checkbox-group">
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              class="form-checkbox"
              ?checked=${agreeToTerms}
              @change=${this.handleInputChange}
              aria-required="true"
              aria-invalid=${!!errors.agreeToTerms}
            />
            <label for="agreeToTerms" class="checkbox-label">
              I agree to the 
              <a href="/terms" target="_blank">Terms and Conditions</a>
              <span aria-label="required">*</span>
              ${errors.agreeToTerms ? html`
                <div class="form-error" style="margin-top: 0.25rem;">
                  ${errors.agreeToTerms}
                </div>
              ` : ''}
            </label>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class=${classMap({
                'register-button': true,
                'loading': isLoading
              })}
              ?disabled=${isLoading}
              aria-describedby=${serverError ? 'server-error' : ''}
            >
              ${isLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </div>
        </form>

        <div class="login-link">
          <span>Already have an account?</span>
          <a href="/login" @click=${(e: Event) => {
            e.preventDefault();
            this.dispatchEvent(new CustomEvent('navigate-to-login', { bubbles: true }));
          }}>
            Sign in
          </a>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'register-form': RegisterForm;
  }
}

