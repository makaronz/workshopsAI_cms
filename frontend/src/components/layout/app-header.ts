import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import t from '../../services/i18n';
import authService from '../../services/auth';

@customElement('app-header')
export class AppHeader extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
      box-shadow: var(--shadow-sm);
    }

    .header-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 var(--space-4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 4rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: var(--space-6);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      text-decoration: none;
      color: var(--color-text-primary);
      font-weight: var(--font-weight-semibold);
      font-size: var(--font-size-lg);
    }

    .logo:hover {
      color: var(--color-primary-600);
    }

    .logo-icon {
      width: 2rem;
      height: 2rem;
      background: var(--color-primary-600);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }

    .navigation {
      display: none;
      align-items: center;
      gap: var(--space-6);
    }

    .nav-link {
      color: var(--color-text-secondary);
      text-decoration: none;
      font-weight: var(--font-weight-medium);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      transition: var(--transition-colors);
      position: relative;
    }

    .nav-link:hover,
    .nav-link:focus {
      color: var(--color-text-primary);
      background: var(--color-surface-hover);
    }

    .nav-link.active {
      color: var(--color-primary-600);
      background: var(--color-primary-50);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .language-switcher {
      position: relative;
    }

    .language-button {
      background: transparent;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-2);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      transition: var(--transition-colors);
    }

    .language-button:hover,
    .language-button:focus {
      background: var(--color-surface-hover);
      color: var(--color-text-primary);
    }

    .user-menu {
      position: relative;
    }

    .user-button {
      background: transparent;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      padding: var(--space-2);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      transition: var(--transition-colors);
      min-width: 2.5rem;
      height: 2.5rem;
    }

    .user-button:hover,
    .user-button:focus {
      background: var(--color-surface-hover);
      color: var(--color-text-primary);
    }

    .user-avatar {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: var(--color-primary-600);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: var(--font-weight-medium);
      font-size: var(--font-size-sm);
    }

    .mobile-menu-button {
      display: none;
      background: transparent;
      border: none;
      padding: var(--space-2);
      cursor: pointer;
      color: var(--color-text-primary);
    }

    .mobile-menu-button:hover,
    .mobile-menu-button:focus {
      background: var(--color-surface-hover);
      border-radius: var(--radius-md);
    }

    .mobile-menu {
      display: none;
      position: fixed;
      top: 4rem;
      left: 0;
      right: 0;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      box-shadow: var(--shadow-lg);
      z-index: var(--z-dropdown);
    }

    .mobile-menu.open {
      display: block;
    }

    .mobile-navigation {
      padding: var(--space-4);
    }

    .mobile-nav-link {
      display: block;
      padding: var(--space-3) 0;
      color: var(--color-text-primary);
      text-decoration: none;
      font-weight: var(--font-weight-medium);
      border-bottom: 1px solid var(--color-border);
    }

    .mobile-nav-link:last-child {
      border-bottom: none;
    }

    .mobile-nav-link:hover,
    .mobile-nav-link:focus {
      color: var(--color-primary-600);
    }

    .mobile-nav-link.active {
      color: var(--color-primary-600);
    }

    /* Responsive */
    @media (min-width: 768px) {
      .navigation {
        display: flex;
      }

      .mobile-menu-button {
        display: none;
      }
    }

    @media (max-width: 767px) {
      .navigation {
        display: none;
      }

      .mobile-menu-button {
        display: block;
      }

      .language-switcher,
      .user-menu {
        display: none;
      }
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .nav-link,
      .language-button,
      .user-button,
      .mobile-menu-button {
        border-width: 2px;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .nav-link,
      .language-button,
      .user-button,
      .mobile-menu-button,
      .mobile-menu {
        transition: none;
      }
    }
  `;

  @property({ type: Boolean })
  isAuthenticated: boolean = false;

  @property({ type: Object })
  user: any = null;

  @state()
  private isMobileMenuOpen: boolean = false;

  @state()
  private currentPath: string = window.location.pathname;

  connectedCallback() {
    super.connectedCallback();
    this.updateCurrentPath();
    window.addEventListener('popstate', this.updateCurrentPath.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('popstate', this.updateCurrentPath.bind(this));
  }

  private updateCurrentPath() {
    this.currentPath = window.location.pathname;
  }

  private toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  private closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  private handleNavigation(event: Event) {
    event.preventDefault();
    const link = event.target as HTMLAnchorElement;
    const href = link.getAttribute('href');

    if (href) {
      // Update current path for active state
      this.currentPath = href;
      this.closeMobileMenu();

      // Navigate (this would integrate with router)
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  private handleLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const language = target.value;

    // Emit custom event for language change
    this.dispatchEvent(new CustomEvent('language-change', {
      detail: { language },
      bubbles: true
    }));
  }

  private handleLogout() {
    // Emit custom event for logout
    this.dispatchEvent(new CustomEvent('logout', {
      bubbles: true
    }));
  }

  private getUserInitials(): string {
    if (!this.user) return 'U';

    const firstName = this.user.firstName || '';
    const lastName = this.user.lastName || '';

    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }

    if (firstName) return firstName[0].toUpperCase();
    if (lastName) return lastName[0].toUpperCase();

    return this.user.email?.[0]?.toUpperCase() || 'U';
  }

  private isActivePath(path: string): boolean {
    return this.currentPath === path;
  }

  render(): TemplateResult {
    const { isAuthenticated, user, isMobileMenuOpen } = this;

    return html`
      <header class="header-container" role="banner">
        <div class="header-left">
          <a href="/" class="logo" @click=${this.handleNavigation}>
            <div class="logo-icon">W</div>
            <span>${t('app.title')}</span>
          </a>

          <nav class="navigation" role="navigation" aria-label="${t('accessibility.openMenu')}">
            <a
              href="/dashboard"
              class="nav-link ${classMap({ active: this.isActivePath('/dashboard') })}"
              @click=${this.handleNavigation}
            >
              ${t('navigation.dashboard')}
            </a>
            ${isAuthenticated ? html`
              <a
                href="/workshops"
                class="nav-link ${classMap({ active: this.isActivePath('/workshops') })}"
                @click=${this.handleNavigation}
              >
                ${t('navigation.workshops')}
              </a>
              <a
                href="/questionnaires"
                class="nav-link ${classMap({ active: this.isActivePath('/questionnaires') })}"
                @click=${this.handleNavigation}
              >
                ${t('navigation.questionnaires')}
              </a>
              ${user && authService.canViewAnalytics() ? html`
                <a
                  href="/analysis"
                  class="nav-link ${classMap({ active: this.isActivePath('/analysis') })}"
                  @click=${this.handleNavigation}
                >
                  ${t('navigation.analysis')}
                </a>
              ` : ''}
            ` : ''}
          </nav>
        </div>

        <div class="header-right">
          ${isAuthenticated ? html`
            <div class="language-switcher">
              <select
                class="language-button"
                @change=${this.handleLanguageChange}
                aria-label="${t('accessibility.toggleLanguage')}"
              >
                <option value="en">English</option>
                <option value="pl">Polski</option>
              </select>
            </div>

            <div class="user-menu">
              <button
                class="user-button"
                aria-label="User menu"
                aria-expanded="false"
                aria-haspopup="true"
              >
                <div class="user-avatar">${this.getUserInitials()}</div>
                <span class="sr-only">${user?.firstName || user?.email}</span>
              </button>
            </div>
          ` : html`
            <div class="language-switcher">
              <select
                class="language-button"
                @change=${this.handleLanguageChange}
                aria-label="${t('accessibility.toggleLanguage')}"
              >
                <option value="en">English</option>
                <option value="pl">Polski</option>
              </select>
            </div>
          `}

          <button
            class="mobile-menu-button"
            @click=${this.toggleMobileMenu}
            aria-label="${t('accessibility.openMenu')}"
            aria-expanded=${isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>

      <div
        id="mobile-menu"
        class="mobile-menu ${classMap({ open: isMobileMenuOpen })}"
        role="navigation"
        aria-label="${t('accessibility.openMenu')}"
      >
        <nav class="mobile-navigation">
          ${isAuthenticated ? html`
            <a
              href="/dashboard"
              class="mobile-nav-link ${classMap({ active: this.isActivePath('/dashboard') })}"
              @click=${this.handleNavigation}
            >
              ${t('navigation.dashboard')}
            </a>
            <a
              href="/workshops"
              class="mobile-nav-link ${classMap({ active: this.isActivePath('/workshops') })}"
              @click=${this.handleNavigation}
            >
              ${t('navigation.workshops')}
            </a>
            <a
              href="/questionnaires"
              class="mobile-nav-link ${classMap({ active: this.isActivePath('/questionnaires') })}"
              @click=${this.handleNavigation}
            >
              ${t('navigation.questionnaires')}
            </a>
            ${user && authService.canViewAnalytics() ? html`
              <a
                href="/analysis"
                class="mobile-nav-link ${classMap({ active: this.isActivePath('/analysis') })}"
                @click=${this.handleNavigation}
              >
                ${t('navigation.analysis')}
              </a>
            ` : ''}
            <a
              href="/profile"
              class="mobile-nav-link ${classMap({ active: this.isActivePath('/profile') })}"
              @click=${this.handleNavigation}
            >
              ${t('navigation.profile')}
            </a>
            <a
              href="#"
              class="mobile-nav-link"
              @click=${(e: Event) => { e.preventDefault(); this.handleLogout(); }}
            >
              ${t('auth.logout')}
            </a>
          ` : html`
            <a
              href="/login"
              class="mobile-nav-link ${classMap({ active: this.isActivePath('/login') })}"
              @click=${this.handleNavigation}
            >
              ${t('auth.login')}
            </a>
            <a
              href="/register"
              class="mobile-nav-link ${classMap({ active: this.isActivePath('/register') })}"
              @click=${this.handleNavigation}
            >
              ${t('auth.register')}
            </a>
          `}
        </nav>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-header': AppHeader;
  }
}