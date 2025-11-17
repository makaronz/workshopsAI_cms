import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import authService, { RegisterData, AuthResponse } from '../../services/auth';
import { ValidationSchemas, realTimeValidator, InputSanitizer } from '../../utils/validation';

@customElement('enhanced-register-form')
export class EnhancedRegisterForm extends LitElement {
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
      width: min(580px, 100%);
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

    .form-input,
    .form-select {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid var(--border-color, #d1d5db);
      border-radius: 8px;
      font-size: 1rem;
      transition: all 0.15s ease;
      background: var(--input-bg, #ffffff);
      color: var(--text-color, #1f2937);
    }

    .form-input:focus,
    .form-select:focus {
      outline: none;
      border-color: var(--primary-color, #2563eb);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .form-input.valid,
    .form-select.valid {
      border-color: var(--success-color, #059669);
    }

    .form-input.error,
    .form-select.error {
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

    .password-strength {
      margin-top: 0.5rem;
    }

    .password-strength-bar {
      height: 4px;
      background: var(--border-color, #d1d5db);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 0.25rem;
    }

    .password-strength-fill {
      height: 100%;
      transition: all 0.3s ease;
      border-radius: 2px;
    }

    .password-strength-fill.weak {
      background: var(--error-color, #dc2626);
      width: 25%;
    }

    .password-strength-fill.fair {
      background: var(--warning-color, #f59e0b);
      width: 50%;
    }

    .password-strength-fill.good {
      background: var(--info-color, #3b82f6);
      width: 75%;
    }

    .password-strength-fill.strong {
      background: var(--success-color, #059669);
      width: 100%;
    }

    .password-strength-text {
      font-size: 0.75rem;
      font-weight: 500;
    }

    .password-strength-text.weak {
      color: var(--error-color, #dc2626);
    }

    .password-strength-text.fair {
      color: var(--warning-color, #f59e0b);
    }

    .password-strength-text.good {
      color: var(--info-color, #3b82f6);
    }

    .password-strength-text.strong {
      color: var(--success-color, #059669);
    }

    .password-requirements {
      margin-top: 0.5rem;
      padding: 0.5rem;
      background: var(--gray-50, #f9fafb);
      border-radius: 4px;
      font-size: 0.75rem;
    }

    .password-requirements ul {
      margin: 0;
      padding-left: 1.25rem;
    }

    .password-requirements li {
      margin-bottom: 0.25rem;
      color: var(--text-color-secondary, #6b7280);
      transition: color 0.2s ease;
    }

    .password-requirements li.met {
      color: var(--success-color, #059669);
    }

    .password-requirements li.met::before {
      content: '✓ ';
      color: var(--success-color, #059669);
    }

    .password-requirements li:not(.met)::before {
      content: '○ ';
      color: var(--text-color-secondary, #6b7280);
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
      font-weight: 500;
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

    .register-button:hover:not(:disabled) {
      background: var(--primary-hover, #1d4ed8);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }

    .register-button:active:not(:disabled) {
      transform: translateY(0);
    }

    .register-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .register-button.loading {
      color: transparent;
      pointer-events: none;
    }

    .register-button.loading::after {
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

    .security-notice {
      background: var(--info-bg, #eff6ff);
      border: 1px solid var(--info-border, #bfdbfe);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
      color: var(--info-color, #1e40af);
    }

    .security-notice h4 {
      margin: 0 0 0.5rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .security-notice h4::before {
      content: '🔐';
      font-size: 1rem;
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
      .form-input,
      .form-select {
        border-width: 3px;
      }

      .register-button {
        border: 2px solid transparent;
      }
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .register-button,
      .form-input,
      .form-select,
      .register-button.loading::after,
      .password-strength-fill {
        transition: none;
        animation: none;
      }
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

    /* Focus visible for keyboard navigation */
    .form-input:focus-visible,
    .form-select:focus-visible,
    .register-button:focus-visible {
      outline: 2px solid var(--focus-color, #2563eb);
      outline-offset: 2px;
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
  private errors: Record<string, string> = {};

  @state()
  private fieldValidation: Record<string, { isValid: boolean; message?: string }> = {};

  @state()
  private isLoading = false;

  @state()
  private serverError: string = '';

  @state()
  private serverSuccess: string = '';

  @state()
  private passwordStrength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';

  @state()
  private passwordRequirements: Record<string, boolean> = {
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  };

  private formId = 'enhanced-register-form';

  connectedCallback() {
    super.connectedCallback();
    realTimeValidator.registerValidator(this.formId, ValidationSchemas.register);
  }

  private calculatePasswordStrength(password: string): {
    strength: 'weak' | 'fair' | 'good' | 'strong';
    requirements: Record<string, boolean>;
  } {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const metRequirements = Object.values(requirements).filter(Boolean).length;

    let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';
    if (metRequirements >= 5) strength = 'strong';
    else if (metRequirements >= 4) strength = 'good';
    else if (metRequirements >= 3) strength = 'fair';

    return { strength, requirements };
  }

  private handleInputChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const { name, value, type } = target;
    const checked = (target as HTMLInputElement).checked;

    this.formData = {
      ...this.formData,
      [name]: type === 'checkbox' ? checked : value,
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

    // Handle password strength calculation
    if (name === 'password') {
      const { strength, requirements } = this.calculatePasswordStrength(value);
      this.passwordStrength = strength;
      this.passwordRequirements = requirements;
    }

    // Real-time validation with debouncing
    if (name !== 'agreeToTerms') {
      realTimeValidator.validateField(
        this.formId,
        name,
        type === 'checkbox' ? checked : value,
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

  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.validateForm()) {
      this.serverError = 'Please correct the errors below.';
      this.announceToScreenReader(this.serverError, 'assertive');
      return;
    }

    this.isLoading = true;
    this.serverError = '';
    this.serverSuccess = '';

    try {
      // Sanitize form data before sending
      const sanitizedData = {
        ...this.formData,
        name: InputSanitizer.sanitizeName(this.formData.name),
        email: InputSanitizer.sanitizeEmail(this.formData.email),
      };

      const response = await authService.register(sanitizedData);

      this.serverSuccess = 'Registration successful! Redirecting to dashboard...';
      this.announceToScreenReader(this.serverSuccess, 'polite');

      // Dispatch success event
      this.dispatchEvent(new CustomEvent('register-success', {
        detail: response,
        bubbles: true,
      }));

      // Redirect after delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);

    } catch (error: any) {
      this.serverError = error instanceof Error ? error.message : 'Registration failed. Please try again.';
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

  render(): TemplateResult {
    const { name, email, password, confirmPassword, role, agreeToTerms } = this.formData;
    const { errors, isLoading, serverError, serverSuccess, fieldValidation } = this;

    return html`
      <div class="register-card">
        <form @submit=${this.handleSubmit} novalidate autocomplete="off">
          <div class="register-header">
            <h1 class="register-title">Create Account</h1>
            <p class="register-subtitle">Join WorkshopsAI CMS to manage your research workflows</p>
          </div>

          <div class="security-notice" role="region" aria-labelledby="security-title">
            <h4 id="security-title">Your Privacy & Security</h4>
            <p>We use industry-standard encryption and never share your data with third parties.</p>
          </div>

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

          <div class="form-group">
            <label for="name" class="form-label">
              Full Name
              <span aria-label="required">*</span>
            </label>
            <div class="input-wrapper">
              <input
                id="name"
                name="name"
                type="text"
                data-testid="name-input"
                class=${classMap({
                  'form-input': true,
                  'valid': fieldValidation.name?.isValid === true,
                  'error': fieldValidation.name?.isValid === false
                })}
                value=${name}
                @input=${this.handleInputChange}
                @blur=${() => this.handleInputChange({ target: { name: 'name', value: name } } as any)}
                autocomplete="name"
                required
                aria-required="true"
                aria-describedby=${errors.name ? 'name-error' : 'name-hint'}
                aria-invalid=${!!errors.name}
                ?disabled=${isLoading}
              />
              ${fieldValidation.name?.isValid !== undefined ? html`
                <div class="validation-icon ${fieldValidation.name.isValid ? 'valid' : 'invalid'}" aria-hidden="true">
                  ${fieldValidation.name.isValid ? '✓' : '✕'}
                </div>
              ` : ''}
            </div>
            ${fieldValidation.name?.message ? html`
              <div id="name-error" class="form-error" role="alert">
                ${fieldValidation.name.message}
              </div>
            ` : ''}
            <div id="name-hint" class="field-hint">Enter your legal name as it appears on official documents</div>
          </div>

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
                aria-describedby=${errors.email ? 'email-error' : 'email-hint'}
                aria-invalid=${!!errors.email}
                ?disabled=${isLoading}
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
            <div id="email-hint" class="field-hint">We'll use this for account notifications and password recovery</div>
          </div>

          <div class="form-group">
            <label for="role" class="form-label">
              Account Type
              <span aria-label="required">*</span>
            </label>
            <div class="input-wrapper">
              <select
                id="role"
                name="role"
                class=${classMap({
                  'form-select': true,
                  'valid': fieldValidation.role?.isValid === true,
                  'error': fieldValidation.role?.isValid === false
                })}
                value=${role}
                @change=${this.handleInputChange}
                required
                aria-required="true"
                aria-describedby="role-hint"
                ?disabled=${isLoading}
              >
                <option value="participant">Participant - I'll participate in workshops</option>
                <option value="facilitator">Facilitator - I'll conduct workshops</option>
              </select>
              ${fieldValidation.role?.isValid !== undefined ? html`
                <div class="validation-icon ${fieldValidation.role.isValid ? 'valid' : 'invalid'}" aria-hidden="true">
                  ${fieldValidation.role.isValid ? '✓' : '✕'}
                </div>
              ` : ''}
            </div>
            <div id="role-hint" class="field-hint">You can change this later with admin approval</div>
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
                autocomplete="new-password"
                required
                aria-required="true"
                aria-describedby=${errors.password ? 'password-error' : 'password-requirements'}
                aria-invalid=${!!errors.password}
                ?disabled=${isLoading}
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
            ${password ? html`
              <div class="password-strength">
                <div class="password-strength-bar">
                  <div class="password-strength-fill ${this.passwordStrength}"></div>
                </div>
                <div class="password-strength-text ${this.passwordStrength}">
                  Password strength: ${this.passwordStrength.charAt(0).toUpperCase() + this.passwordStrength.slice(1)}
                </div>
              </div>
              <div id="password-requirements" class="password-requirements" role="group" aria-label="Password requirements">
                <ul>
                  <li class=${this.passwordRequirements.length ? 'met' : ''}>At least 8 characters</li>
                  <li class=${this.passwordRequirements.uppercase ? 'met' : ''}>One uppercase letter</li>
                  <li class=${this.passwordRequirements.lowercase ? 'met' : ''}>One lowercase letter</li>
                  <li class=${this.passwordRequirements.number ? 'met' : ''}>One number</li>
                  <li class=${this.passwordRequirements.special ? 'met' : ''}>One special character</li>
                </ul>
              </div>
            ` : ''}
          </div>

          <div class="form-group">
            <label for="confirmPassword" class="form-label">
              Confirm Password
              <span aria-label="required">*</span>
            </label>
            <div class="input-wrapper">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                data-testid="confirm-password-input"
                class=${classMap({
                  'form-input': true,
                  'valid': fieldValidation.confirmPassword?.isValid === true,
                  'error': fieldValidation.confirmPassword?.isValid === false
                })}
                value=${confirmPassword}
                @input=${this.handleInputChange}
                autocomplete="new-password"
                required
                aria-required="true"
                aria-describedby=${errors.confirmPassword ? 'confirmPassword-error' : ''}
                aria-invalid=${!!errors.confirmPassword}
                ?disabled=${isLoading}
              />
              ${fieldValidation.confirmPassword?.isValid !== undefined ? html`
                <div class="validation-icon ${fieldValidation.confirmPassword.isValid ? 'valid' : 'invalid'}" aria-hidden="true">
                  ${fieldValidation.confirmPassword.isValid ? '✓' : '✕'}
                </div>
              ` : ''}
            </div>
            ${fieldValidation.confirmPassword?.message ? html`
              <div id="confirmPassword-error" class="form-error" role="alert">
                ${fieldValidation.confirmPassword.message}
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
              aria-describedby=${errors.agreeToTerms ? 'agreeToTerms-error' : ''}
              aria-invalid=${!!errors.agreeToTerms}
              ?disabled=${isLoading}
            />
            <label for="agreeToTerms" class="checkbox-label">
              I agree to the
              <a href="/terms" target="_blank" @click=${(e: Event) => { e.stopPropagation(); }}>Terms and Conditions</a>
              and
              <a href="/privacy" target="_blank" @click=${(e: Event) => { e.stopPropagation(); }}>Privacy Policy</a>
              <span aria-label="required">*</span>
            </label>
            ${fieldValidation.agreeToTerms?.message ? html`
              <div id="agreeToTerms-error" class="form-error" role="alert" style="margin-top: 0.5rem;">
                ${fieldValidation.agreeToTerms.message}
              </div>
            ` : ''}
          </div>

          <div class="form-actions">
            <button
              type="submit"
              data-testid="register-button"
              class=${classMap({
                'register-button': true,
                'loading': isLoading
              })}
              ?disabled=${isLoading || !this.validateForm()}
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
    'enhanced-register-form': EnhancedRegisterForm;
  }
}