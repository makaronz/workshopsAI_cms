import { injectAxe, checkA11y, configureAxe } from 'axe-core';

export interface AccessibilityCheck {
  violations: any[];
  passes: any[];
  incomplete: any[];
  url: string;
  timestamp: Date;
}

class AccessibilityService {
  private static instance: AccessibilityService;
  private isInitialized: boolean = false;
  private checkHistory: AccessibilityCheck[] = [];

  private constructor() {}

  public static getInstance(): AccessibilityService {
    if (!AccessibilityService.instance) {
      AccessibilityService.instance = new AccessibilityService();
    }
    return AccessibilityService.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Inject axe-core into the page
      await injectAxe();

      // Configure axe rules for WCAG 2.2 AA compliance
      configureAxe({
        rules: {
          // Enable WCAG 2.2 AA specific rules
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-order-semantics': { enabled: true },
          'focus-trap': { enabled: true },
          'aria-labels': { enabled: true },
          'role-supported': { enabled: true },
          'landmark-one-main': { enabled: true },
          'page-has-heading-one': { enabled: true },
          'skip-link': { enabled: true },

          // Disable rules that don't apply to our app
          'bypass': { enabled: false },
          'html-has-lang': { enabled: false }, // We set this in index.html
        },
        reporter: 'v2',
        runOnly: {
          type: 'tag',
          values: ['wcag2aa', 'wcag21aa', 'wcag22aa']
        }
      });

      // Set up automated checks
      this.setupAutomatedChecks();

      this.isInitialized = true;
      console.log('Accessibility service initialized');
    } catch (error) {
      console.error('Failed to initialize accessibility service:', error);
    }
  }

  private setupAutomatedChecks(): void {
    // Run checks on route changes
    window.addEventListener('popstate', () => {
      this.scheduleCheck(1000); // Wait for content to settle
    });

    // Run checks on DOM mutations
    if ('MutationObserver' in window) {
      const observer = new MutationObserver(() => {
        this.scheduleCheck(1000);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-label', 'aria-describedby', 'role', 'tabindex']
      });
    }

    // Run initial check
    this.scheduleCheck(2000);
  }

  private checkTimeout: number | null = null;

  private scheduleCheck(delay: number): void {
    if (this.checkTimeout) {
      clearTimeout(this.checkTimeout);
    }

    this.checkTimeout = window.setTimeout(() => {
      this.performCheck().catch(console.error);
    }, delay);
  }

  public async performCheck(context?: string): Promise<AccessibilityCheck> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const results = await checkA11y(context || undefined, {
        detailedReport: true,
        detailedReportOptions: {
          html: true
        }
      });

      const check: AccessibilityCheck = {
        violations: results.violations || [],
        passes: results.passes || [],
        incomplete: results.incomplete || [],
        url: window.location.href,
        timestamp: new Date()
      };

      this.checkHistory.push(check);

      // Keep only last 50 checks
      if (this.checkHistory.length > 50) {
        this.checkHistory = this.checkHistory.slice(-50);
      }

      // Log violations in development
      if (import.meta.env.DEV && check.violations.length > 0) {
        console.group('♿ Accessibility Violations');
        check.violations.forEach(violation => {
          console.warn(violation.id, violation.description, violation.nodes);
        });
        console.groupEnd();
      }

      return check;
    } catch (error) {
      console.error('Accessibility check failed:', error);
      throw error;
    }
  }

  public async checkComponent(element: Element): Promise<AccessibilityCheck> {
    return this.performCheck(`#${element.id || 'unknown'}`);
  }

  public getRecentChecks(limit: number = 10): AccessibilityCheck[] {
    return this.checkHistory.slice(-limit);
  }

  public getCurrentViolations(): any[] {
    const latest = this.checkHistory[this.checkHistory.length - 1];
    return latest?.violations || [];
  }

  public getViolationCount(): number {
    return this.getCurrentViolations().length;
  }

  public hasCriticalIssues(): boolean {
    return this.getCurrentViolations().some(violation =>
      violation.impact === 'critical' || violation.impact === 'serious'
    );
  }

  // Helper methods for common accessibility tasks
  public announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
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
    document.body.appendChild(announcement);

    // Remove after announcement is read
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  public trapFocus(container: Element): () => void {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) {
      return () => {};
    }

    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          event.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Focus the first element
    firstFocusable.focus();

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  public skipToContent(): void {
    const mainContent = document.querySelector('main, [role="main"]');
    if (mainContent) {
      (mainContent as HTMLElement).focus();
    }
  }

  public validateColorContrast(element: Element): { ratio: number; aa: boolean; aaa: boolean } {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;

    // This is a simplified implementation
    // In a real app, you'd use a proper color contrast library
    return {
      ratio: 4.5, // Placeholder
      aa: true,
      aaa: false
    };
  }

  // Accessibility testing helpers
  public generateAccessibilityReport(): string {
    const latest = this.checkHistory[this.checkHistory.length - 1];
    if (!latest) {
      return 'No accessibility checks performed yet.';
    }

    const { violations, passes, incomplete, url, timestamp } = latest;

    let report = `Accessibility Report\n`;
    report += `=====================\n`;
    report += `URL: ${url}\n`;
    report += `Date: ${timestamp.toLocaleString()}\n\n`;

    report += `Summary:\n`;
    report += `- Violations: ${violations.length}\n`;
    report += `- Passes: ${passes.length}\n`;
    report += `- Incomplete: ${incomplete.length}\n\n`;

    if (violations.length > 0) {
      report += `Violations:\n`;
      violations.forEach((violation, index) => {
        report += `${index + 1}. ${violation.description}\n`;
        report += `   Impact: ${violation.impact}\n`;
        report += `   Help: ${violation.help}\n`;
        report += `   Help URL: ${violation.helpUrl}\n`;
        if (violation.nodes && violation.nodes.length > 0) {
          report += `   Affected elements: ${violation.nodes.length}\n`;
        }
        report += '\n';
      });
    }

    return report;
  }

  public exportReport(): void {
    const report = this.generateAccessibilityReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default AccessibilityService.getInstance();