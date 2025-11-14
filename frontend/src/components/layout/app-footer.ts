import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import t from '../../services/i18n';

@customElement('app-footer')
export class AppFooter extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      margin-top: auto;
    }

    .footer-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-4);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: var(--space-8);
    }

    .footer-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .footer-title {
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      font-size: var(--font-size-base);
      margin: 0;
    }

    .footer-links {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .footer-link {
      color: var(--color-text-secondary);
      text-decoration: none;
      font-size: var(--font-size-sm);
      transition: var(--transition-colors);
    }

    .footer-link:hover,
    .footer-link:focus {
      color: var(--color-primary-600);
    }

    .footer-bottom {
      grid-column: 1 / -1;
      padding-top: var(--space-6);
      border-top: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      align-items: center;
      text-align: center;
    }

    .footer-copyright {
      color: var(--color-text-tertiary);
      font-size: var(--font-size-sm);
    }

    .footer-legal-links {
      display: flex;
      gap: var(--space-6);
      flex-wrap: wrap;
      justify-content: center;
    }

    .footer-logo {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-primary);
      text-decoration: none;
      font-weight: var(--font-weight-semibold);
    }

    .footer-logo:hover {
      color: var(--color-primary-600);
    }

    .footer-logo-icon {
      width: 1.5rem;
      height: 1.5rem;
      background: var(--color-primary-600);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: var(--font-size-xs);
    }

    .footer-contact {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .footer-contact-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .footer-contact-icon {
      width: 1rem;
      height: 1rem;
      color: var(--color-primary-600);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .footer-container {
        padding: var(--space-6) var(--space-4);
        gap: var(--space-6);
      }

      .footer-bottom {
        gap: var(--space-3);
      }

      .footer-legal-links {
        gap: var(--space-4);
      }
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .footer-link {
        text-decoration: underline;
      }
    }
  `;

  private currentYear: number = new Date().getFullYear();

  private handleNavigation(event: Event) {
    event.preventDefault();
    const link = event.target as HTMLAnchorElement;
    const href = link.getAttribute('href');

    if (href && href.startsWith('#')) {
      // Handle anchor links
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (href) {
      // Handle page navigation
      window.location.href = href;
    }
  }

  render(): TemplateResult {
    return html`
      <footer class="footer-container" role="contentinfo">
        <div class="footer-section">
          <a href="/" class="footer-logo" @click=${this.handleNavigation}>
            <div class="footer-logo-icon">W</div>
            <span>${t('app.title')}</span>
          </a>
          <p class="footer-copyright">
            © ${this.currentYear} WorkshopsAI. ${t('footer.allRightsReserved')}
          </p>
        </div>

        <div class="footer-section">
          <h3 class="footer-title">${t('footer.product')}</h3>
          <nav class="footer-links" aria-label="${t('footer.product')}">
            <a href="/features" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.features')}
            </a>
            <a href="/workshops" class="footer-link" @click=${this.handleNavigation}>
              ${t('navigation.workshops')}
            </a>
            <a href="/pricing" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.pricing')}
            </a>
            <a href="/api" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.api')}
            </a>
          </nav>
        </div>

        <div class="footer-section">
          <h3 class="footer-title">${t('footer.resources')}</h3>
          <nav class="footer-links" aria-label="${t('footer.resources')}">
            <a href="/docs" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.documentation')}
            </a>
            <a href="/help" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.help')}
            </a>
            <a href="/blog" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.blog')}
            </a>
            <a href="/tutorials" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.tutorials')}
            </a>
          </nav>
        </div>

        <div class="footer-section">
          <h3 class="footer-title">${t('footer.contact')}</h3>
          <div class="footer-contact">
            <a href="mailto:support@workshopsai.example.com" class="footer-contact-item">
              <svg class="footer-contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
              support@workshopsai.example.com
            </a>
            <a href="tel:+48123456789" class="footer-contact-item">
              <svg class="footer-contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
              +48 123 456 789
            </a>
          </div>
        </div>

        <div class="footer-bottom">
          <nav class="footer-legal-links" aria-label="${t('footer.legal')}">
            <a href="/privacy" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.privacy')}
            </a>
            <a href="/terms" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.terms')}
            </a>
            <a href="/cookies" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.cookies')}
            </a>
            <a href="/accessibility" class="footer-link" @click=${this.handleNavigation}>
              ${t('footer.accessibility')}
            </a>
          </nav>
        </div>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-footer': AppFooter;
  }
}