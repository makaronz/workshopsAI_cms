/**
 * workshopsAI CMS - Language Switcher Component
 * Mobile-first, accessible language switcher
 */

import i18n, { Language } from './index';

export class LanguageSwitcher {
  private container: HTMLElement;
  private currentLanguage: Language;
  private isOpen = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.currentLanguage = i18n.getCurrentLanguage();
    this.render();
    this.setupEventListeners();
  }

  private render() {
    const languages = i18n.getAvailableLanguages();
    const currentLang = languages.find(
      lang => lang.code === this.currentLanguage,
    );

    this.container.innerHTML = `
      <div class="language-switcher" role="group" aria-label="${i18n.t('nav.language')}">
        <button
          type="button"
          class="language-switcher__toggle"
          aria-expanded="${this.isOpen}"
          aria-haspopup="true"
          aria-label="${i18n.t('lang.switch')}: ${currentLang?.nativeName}"
          data-language-toggle
        >
          <span class="language-switcher__current" aria-hidden="true">
            ${this.currentLanguage.toUpperCase()}
          </span>
          <svg
            class="language-switcher__arrow"
            width="12"
            height="8"
            viewBox="0 0 12 8"
            aria-hidden="true"
          >
            <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="language-switcher__menu" role="menu" aria-label="${i18n.t('lang.switch')}">
          ${languages
    .map(
      lang => `
            <button
              type="button"
              class="language-switcher__option ${lang.code === this.currentLanguage ? 'language-switcher__option--active' : ''}"
              role="menuitem"
              data-language="${lang.code}"
              aria-current="${lang.code === this.currentLanguage ? 'true' : 'false'}"
              aria-label="${lang.nativeName}"
            >
              <span class="language-switcher__flag">${lang.code.toUpperCase()}</span>
              <span class="language-switcher__name">${lang.nativeName}</span>
              ${
  lang.code === this.currentLanguage
    ? `
                <svg class="language-switcher__check" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M13.5 4.5L6 12l-3.5-3.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              `
    : ''
}
            </button>
          `,
    )
    .join('')}
        </div>
      </div>
    `;

    this.injectStyles();
  }

  private injectStyles() {
    const styleId = 'language-switcher-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = this.getStyles();
      document.head.appendChild(style);
    }
  }

  private getStyles(): string {
    return `
      .language-switcher {
        position: relative;
        display: inline-block;
        font-family: var(--font-family, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif);
      }

      .language-switcher__toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: transparent;
        border: 1px solid var(--color-gray-300, #d1d5db);
        border-radius: var(--radius, 6px);
        cursor: pointer;
        transition: var(--transition, all 0.2s ease-in-out);
        color: var(--color-gray-700, #374151);
        font-size: 14px;
        font-weight: 500;
        min-width: 60px;
        justify-content: center;
      }

      .language-switcher__toggle:hover {
        background-color: var(--color-gray-50, #f9fafb);
        border-color: var(--color-gray-400, #9ca3af);
      }

      .language-switcher__toggle:focus-visible {
        outline: 2px solid var(--color-primary, #3b82f6);
        outline-offset: 2px;
      }

      .language-switcher__toggle[aria-expanded="true"] .language-switcher__arrow {
        transform: rotate(180deg);
      }

      .language-switcher__current {
        font-weight: 600;
        letter-spacing: 0.5px;
      }

      .language-switcher__arrow {
        transition: transform 0.2s ease;
        color: var(--color-gray-500, #6b7280);
      }

      .language-switcher__menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        min-width: 140px;
        background: white;
        border: 1px solid var(--color-gray-200, #e5e7eb);
        border-radius: var(--radius-md, 8px);
        box-shadow: var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-8px);
        transition: all 0.2s ease;
        overflow: hidden;
      }

      .language-switcher__menu[aria-hidden="false"] {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .language-switcher__option {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 12px;
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        transition: background-color 0.15s ease;
        color: var(--color-gray-700, #374151);
        font-size: 14px;
        line-height: 1.4;
      }

      .language-switcher__option:hover {
        background-color: var(--color-gray-50, #f9fafb);
      }

      .language-switcher__option:focus-visible {
        outline: none;
        background-color: var(--color-primary, #3b82f6);
        color: white;
      }

      .language-switcher__option--active {
        background-color: var(--color-primary, #3b82f6);
        color: white;
        font-weight: 500;
      }

      .language-switcher__flag {
        font-size: 12px;
        font-weight: 600;
        padding: 2px 4px;
        background: var(--color-gray-100, #f3f4f6);
        border-radius: 3px;
        min-width: 24px;
        text-align: center;
        letter-spacing: 0.5px;
      }

      .language-switcher__option--active .language-switcher__flag {
        background: rgba(255, 255, 255, 0.2);
      }

      .language-switcher__name {
        flex: 1;
      }

      .language-switcher__check {
        color: var(--color-success, #10b981);
        margin-left: auto;
      }

      /* Mobile responsive */
      @media (max-width: 640px) {
        .language-switcher__toggle {
          padding: 10px 14px;
          font-size: 16px;
          min-width: 70px;
        }

        .language-switcher__menu {
          min-width: 160px;
          right: -8px;
        }

        .language-switcher__option {
          padding: 12px 14px;
          font-size: 16px;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .language-switcher__toggle {
          border-width: 2px;
          border-color: ButtonText;
        }

        .language-switcher__option:focus-visible {
          border: 2px solid ButtonText;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .language-switcher__toggle,
        .language-switcher__arrow,
        .language-switcher__menu,
        .language-switcher__option {
          transition: none;
        }
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .language-switcher__toggle {
          background-color: var(--color-gray-800, #1f2937);
          border-color: var(--color-gray-600, #4b5563);
          color: var(--color-gray-200, #e5e7eb);
        }

        .language-switcher__toggle:hover {
          background-color: var(--color-gray-700, #374151);
        }

        .language-switcher__menu {
          background: var(--color-gray-800, #1f2937);
          border-color: var(--color-gray-600, #4b5563);
        }

        .language-switcher__option {
          color: var(--color-gray-200, #e5e7eb);
        }

        .language-switcher__option:hover {
          background-color: var(--color-gray-700, #374151);
        }

        .language-switcher__flag {
          background: var(--color-gray-700, #374151);
        }
      }
    `;
  }

  private setupEventListeners() {
    const toggle = this.container.querySelector(
      '[data-language-toggle]',
    ) as HTMLButtonElement;
    const menu = this.container.querySelector(
      '.language-switcher__menu',
    ) as HTMLElement;
    const options = this.container.querySelectorAll('[data-language]');

    if (!toggle || !menu) return;

    // Toggle menu
    toggle.addEventListener('click', () => {
      this.isOpen = !this.isOpen;
      this.updateMenuState();
    });

    // Handle language selection
    options.forEach(option => {
      option.addEventListener('click', e => {
        const lang = (e.currentTarget as HTMLElement).dataset
          .language as Language;
        if (lang) {
          this.selectLanguage(lang);
        }
      });
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!this.container.contains(e.target as Node)) {
        this.close();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        toggle.focus();
      }
    });

    // Keyboard navigation within menu
    menu.addEventListener('keydown', e => {
      if (!this.isOpen) return;

      const focusableOptions = Array.from(options) as HTMLElement[];
      const currentIndex = focusableOptions.indexOf(
        document.activeElement as HTMLElement,
      );

      switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex =
            currentIndex < focusableOptions.length - 1 ? currentIndex + 1 : 0;
        focusableOptions[nextIndex].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex =
            currentIndex > 0 ? currentIndex - 1 : focusableOptions.length - 1;
        focusableOptions[prevIndex].focus();
        break;
      case 'Home':
        e.preventDefault();
        focusableOptions[0].focus();
        break;
      case 'End':
        e.preventDefault();
        focusableOptions[focusableOptions.length - 1].focus();
        break;
      }
    });
  }

  private selectLanguage(language: Language) {
    if (language !== this.currentLanguage) {
      i18n.setLanguage(language);
      this.currentLanguage = language;
      this.render();
      this.setupEventListeners(); // Re-setup listeners after re-render
    }
    this.close();
  }

  private close() {
    this.isOpen = false;
    this.updateMenuState();
  }

  private updateMenuState() {
    const toggle = this.container.querySelector(
      '[data-language-toggle]',
    ) as HTMLButtonElement;
    const menu = this.container.querySelector(
      '.language-switcher__menu',
    ) as HTMLElement;

    if (toggle && menu) {
      toggle.setAttribute('aria-expanded', this.isOpen.toString());
      menu.setAttribute('aria-hidden', (!this.isOpen).toString());
    }
  }

  /**
   * Public method to update the switcher when language changes externally
   */
  update() {
    this.currentLanguage = i18n.getCurrentLanguage();
    this.render();
    this.setupEventListeners();
  }

  /**
   * Destroy the component and clean up listeners
   */
  destroy() {
    this.container.innerHTML = '';
  }
}

// Auto-initialize language switchers
document.addEventListener('DOMContentLoaded', () => {
  const containers = document.querySelectorAll('[data-language-switcher]');
  containers.forEach(container => {
    new LanguageSwitcher(container as HTMLElement);
  });

  // Subscribe to language changes
  i18n.subscribe(() => {
    // Update all language switchers
    const switchers = document.querySelectorAll('[data-language-switcher]');
    switchers.forEach(container => {
      // Re-render to update current language display
      (container as any).languageSwitcher?.update?.();
    });
  });
});

export default LanguageSwitcher;
