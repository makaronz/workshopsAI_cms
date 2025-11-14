/**
 * Progress Tracker Web Component
 * Visual completion status for questionnaires with percentage and count display
 */

import { type Language, translations } from '../i18n/translations.js';

interface ProgressState {
  answered: number;
  total: number;
  percentage: number;
}

export class ProgressTracker extends HTMLElement {
  private currentState: ProgressState = {
    answered: 0,
    total: 0,
    percentage: 0,
  };

  private progressBar: HTMLElement | null = null;
  private progressText: HTMLElement | null = null;
  private progressAria: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .progress-label {
          font-weight: 500;
        }

        .progress-text {
          font-weight: 600;
          color: #374151;
        }

        .progress-container {
          width: 100%;
          height: 8px;
          background-color: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 4px;
          transition: width 0.5s ease-in-out;
          min-width: 0%;
          position: relative;
        }

        .progress-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* Completion states */
        .progress-bar.complete {
          background: linear-gradient(90deg, #10b981 0%, #059669 100%);
        }

        .progress-bar.warning {
          background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
          .progress-header {
            font-size: 0.75rem;
          }

          .progress-container {
            height: 6px;
          }
        }

        /* High contrast mode */
        @media (prefers-contrast: high) {
          .progress-container {
            border: 2px solid #000;
            height: 12px;
          }

          .progress-bar {
            background: #000;
          }

          .progress-bar.complete {
            background: #006600;
          }

          .progress-bar.warning {
            background: #ff8c00;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .progress-bar {
            transition: width 0.1s ease-in-out;
          }

          .progress-bar::after {
            animation: none;
          }
        }

        /* Focus visible for accessibility */
        :host:focus-visible .progress-container {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
      </style>

      <div class="progress-header">
        <span class="progress-label" role="status" aria-live="polite">
          <span data-i18n="questionnaire.progress">Progress</span>
        </span>
        <span class="progress-text" id="progress-text" aria-label="Progress status">0/0 (0%)</span>
      </div>

      <div class="progress-container" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" tabindex="0">
        <div class="progress-bar" id="progress-bar" style="width: 0%"></div>
      </div>
    `;

    this.progressBar = this.shadowRoot.getElementById('progress-bar');
    this.progressText = this.shadowRoot.getElementById('progress-text');
    this.progressAria = this.shadowRoot.querySelector('[role="progressbar"]');

    // Initialize with current state
    this.updateProgress();
  }

  /**
   * Update progress display
   * @param answered Number of answered questions
   * @param total Total number of questions
   */
  update(answered: number, total: number): void {
    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;

    this.currentState = {
      answered,
      total,
      percentage,
    };

    this.updateProgress();
  }

  /**
   * Get current progress state
   */
  getState(): ProgressState {
    return { ...this.currentState };
  }

  /**
   * Reset progress to zero
   */
  reset(): void {
    this.update(0, 0);
  }

  private updateProgress(): void {
    const { answered, total, percentage } = this.currentState;

    // Update progress bar width
    if (this.progressBar) {
      this.progressBar.style.width = `${percentage}%`;

      // Add state classes
      this.progressBar.classList.remove('complete', 'warning');

      if (percentage === 100 && total > 0) {
        this.progressBar.classList.add('complete');
      } else if (percentage > 0 && percentage < 25) {
        this.progressBar.classList.add('warning');
      }
    }

    // Update progress text
    if (this.progressText) {
      const progressText =
        total > 0
          ? `${answered}/${total} (${percentage}%)`
          : translations[this.getCurrentLanguage()][
            'questionnaire.no_questions'
          ] || 'No questions';

      this.progressText.textContent = progressText;
      this.progressText.setAttribute(
        'aria-label',
        `${answered} of ${total} questions answered, ${percentage} percent complete`,
      );
    }

    // Update ARIA attributes
    if (this.progressAria) {
      this.progressAria.setAttribute('aria-valuenow', percentage.toString());
      this.progressAria.setAttribute(
        'aria-valuetext',
        `${percentage} percent complete`,
      );

      if (total === 0) {
        this.progressAria.setAttribute('aria-label', 'No questions to answer');
      } else {
        this.progressAria.setAttribute(
          'aria-label',
          `Questionnaire progress: ${answered} of ${total} questions answered`,
        );
      }
    }
  }

  private getCurrentLanguage(): Language {
    // Try to get language from document or default to Polish
    const htmlLang = document.documentElement.lang || 'pl';
    return (htmlLang === 'en' ? 'en' : 'pl') as Language;
  }

  /**
   * Animate progress to new values
   * @param targetAnswered Target answered questions
   * @param targetTotal Target total questions
   * @param duration Animation duration in milliseconds
   */
  animateTo(
    targetAnswered: number,
    targetTotal: number,
    duration: number = 500,
  ): void {
    const targetPercentage =
      targetTotal > 0 ? Math.round((targetAnswered / targetTotal) * 100) : 0;
    const startPercentage = this.currentState.percentage;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeInOutQuad = (t: number): number => {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      };

      const currentPercentage =
        startPercentage +
        (targetPercentage - startPercentage) * easeInOutQuad(progress);
      const currentAnswered = Math.round(
        (currentPercentage / 100) * targetTotal,
      );

      this.update(currentAnswered, targetTotal);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Set custom color theme for progress bar
   * @param primaryColor Primary color for progress bar
   * @param completeColor Color for completed state (optional)
   */
  setColors(primaryColor: string, completeColor?: string): void {
    if (!this.shadowRoot) return;

    const styleSheet = this.shadowRoot.styleSheets[0];
    if (!styleSheet) return;

    // Remove existing color rules
    const existingRules = Array.from(styleSheet.cssRules);
    existingRules.forEach((rule, index) => {
      if (
        rule instanceof CSSStyleRule &&
        rule.selectorText === '.progress-bar'
      ) {
        styleSheet.deleteRule(index);
      }
    });

    // Add new color rules
    styleSheet.insertRule(
      `
      .progress-bar {
        background: linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor}dd 100%);
      }
    `,
      styleSheet.cssRules.length,
    );

    if (completeColor) {
      styleSheet.insertRule(
        `
        .progress-bar.complete {
          background: linear-gradient(90deg, ${completeColor} 0%, ${completeColor}dd 100%);
        }
      `,
        styleSheet.cssRules.length,
      );
    }
  }

  /**
   * Show/hide progress tracker
   */
  setVisible(visible: boolean): void {
    if (this.style.display !== (visible ? 'block' : 'none')) {
      this.style.display = visible ? 'block' : 'none';
    }
  }

  /**
   * Get accessibility information for screen readers
   */
  getAccessibilityInfo(): {
    label: string;
    description: string;
    current: string;
    } {
    const { answered, total, percentage } = this.currentState;

    return {
      label: 'Questionnaire Progress',
      description: 'Shows completion status of the questionnaire',
      current: `${answered} of ${total} questions answered, ${percentage} percent complete`,
    };
  }

  // Static method for element definition
  static get tagName() {
    return 'progress-tracker';
  }
}

// Register the custom element
if (!customElements.get(ProgressTracker.tagName)) {
  customElements.define(ProgressTracker.tagName, ProgressTracker);
}
