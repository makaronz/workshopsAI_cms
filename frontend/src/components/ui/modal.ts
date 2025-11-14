import { LitElement, html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
// import { createRef, ref, Ref } from 'lit/directives/ref.js';

export interface ModalProps {
  open?: boolean;
  closable?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  title?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

@customElement('ui-modal')
export class Modal extends LitElement implements ModalProps {
  static styles: CSSResultGroup = css`
    :host {
      display: contents;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: var(--spacing-4);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease, visibility 0.2s ease;
    }

    .modal-overlay.open {
      opacity: 1;
      visibility: visible;
    }

    .modal {
      background: white;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      max-width: 90vw;
      max-height: 90vh;
      overflow: hidden;
      transform: scale(0.9) translateY(-20px);
      transition: transform 0.2s ease;
      display: flex;
      flex-direction: column;
    }

    .modal-overlay.open .modal {
      transform: scale(1) translateY(0);
    }

    /* Size variants */
    .modal--sm {
      width: 400px;
    }

    .modal--md {
      width: 600px;
    }

    .modal--lg {
      width: 800px;
    }

    .modal--xl {
      width: 1200px;
    }

    .modal--full {
      width: 100%;
      height: 100%;
      max-width: 100vw;
      max-height: 100vh;
      border-radius: 0;
    }

    /* Modal Header */
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-6);
      border-bottom: 1px solid var(--color-border);
      background: var(--color-gray-50);
    }

    .modal-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin: 0;
      line-height: 1.4;
    }

    .modal-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      color: var(--color-gray-500);
      font-size: var(--font-size-lg);
      transition: all 0.2s ease;
    }

    .modal-close:hover {
      background: var(--color-gray-100);
      color: var(--color-gray-700);
    }

    .modal-close:focus {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    /* Modal Body */
    .modal-body {
      flex: 1;
      padding: var(--spacing-6);
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .modal-body--no-padding {
      padding: 0;
    }

    /* Modal Footer */
    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--spacing-3);
      padding: var(--spacing-6);
      border-top: 1px solid var(--color-border);
      background: var(--color-gray-50);
    }

    /* No header/footer variants */
    .modal--no-header {
      border-top-left-radius: var(--radius-lg);
      border-top-right-radius: var(--radius-lg);
    }

    .modal--no-footer {
      border-bottom-left-radius: var(--radius-lg);
      border-bottom-right-radius: var(--radius-lg);
    }

    /* Backdrop variants */
    .modal-backdrop--dark {
      background: rgba(0, 0, 0, 0.8);
    }

    .modal-backdrop--light {
      background: rgba(255, 255, 255, 0.8);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .modal-overlay {
        padding: var(--spacing-2);
      }

      .modal--sm,
      .modal--md,
      .modal--lg,
      .modal--xl {
        width: 100%;
        max-width: 100%;
      }

      .modal-header,
      .modal-body,
      .modal-footer {
        padding: var(--spacing-4);
      }

      .modal-title {
        font-size: var(--font-size-lg);
      }
    }

    /* High Contrast Mode */
    @media (prefers-contrast: high) {
      .modal-overlay {
        background: rgba(0, 0, 0, 0.9);
      }

      .modal {
        border: 2px solid var(--color-text-primary);
      }

      .modal-header,
      .modal-footer {
        border-width: 2px;
      }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .modal-overlay,
      .modal,
      .modal-close {
        transition: none;
      }
    }
  `;

  @property({ type: Boolean })
  open: boolean = false;

  @property({ type: Boolean })
  closable: boolean = true;

  @property({ type: Boolean })
  closeOnEscape: boolean = true;

  @property({ type: Boolean })
  closeOnBackdrop: boolean = true;

  @property({ type: String })
  size: ModalProps['size'] = 'md';

  @property({ type: Boolean })
  showCloseButton: boolean = true;

  @property({ type: String })
  title?: ModalProps['title'];

  @property({ type: String })
  ariaLabel?: ModalProps['ariaLabel'];

  @property({ type: String })
  ariaDescribedBy?: ModalProps['ariaDescribedBy'];

  @state()
  private isVisible = false;

  private modalRef: HTMLElement | null = null;

  connectedCallback() {
    super.connectedCallback();
    if (this.closeOnEscape) {
      document.addEventListener('keydown', this.handleKeyDown);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.closeOnEscape) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    if (changedProperties.has('open')) {
      if (this.open) {
        this.show();
      } else {
        this.hide();
      }
    }
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.open && this.closable) {
      event.preventDefault();
      this.close();
    }
  };

  private handleBackdropClick = (event: MouseEvent) => {
    if (event.target === this.modalRef.value && this.closeOnBackdrop && this.closable) {
      this.close();
    }
  };

  show() {
    this.isVisible = true;
    document.body.style.overflow = 'hidden';

    // Focus management
    requestAnimationFrame(() => {
      if (this.modalRef.value) {
        const focusableElements = this.modalRef.value.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0] as HTMLElement;
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }
    });

    this.dispatchEvent(new CustomEvent('show', {
      bubbles: true,
      composed: true
    }));
  }

  hide() {
    this.isVisible = false;
    document.body.style.overflow = '';

    this.dispatchEvent(new CustomEvent('hide', {
      bubbles: true,
      composed: true
    }));
  }

  close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', {
      bubbles: true,
      composed: true
    }));
  }

  private getModalClasses() {
    return [
      'modal',
      `modal--${this.size}`,
      !this.title ? 'modal--no-header' : '',
      !this.querySelector('[slot="footer"]') ? 'modal--no-footer' : ''
    ].filter(Boolean).join(' ');
  }

  private hasHeaderSlot(): boolean {
    return !!this.querySelector('[slot="header"]');
  }

  private hasFooterSlot(): boolean {
    return !!this.querySelector('[slot="footer"]');
  }

  render(): TemplateResult {
    const hasHeader = this.title || this.hasHeaderSlot();
    const hasFooter = this.hasFooterSlot();

    return html`
      <div
        ${ref(this.modalRef)}
        class=${classMap({
          'modal-overlay': true,
          'open': this.isVisible
        })}
        @click=${this.handleBackdropClick}
        role="dialog"
        aria-modal=${this.open}
        aria-label=${this.ariaLabel || (this.title ? undefined : i18n.t('modal.dialog'))}
        aria-describedby=${this.ariaDescribedBy}
      >
        <div class=${this.getModalClasses()}>
          ${hasHeader ? html`
            <div class="modal-header">
              <slot name="header">
                <h2 class="modal-title">${this.title}</h2>
              </slot>
              ${this.showCloseButton && this.closable ? html`
                <button
                  class="modal-close"
                  @click=${this.close}
                  aria-label=${i18n.t('action.close')}
                >
                  ✕
                </button>
              ` : ''}
            </div>
          ` : ''}

          <div class="modal-body ${!hasHeader && !hasFooter ? 'modal-body--no-padding' : ''}">
            <slot></slot>
          </div>

          ${hasFooter ? html`
            <div class="modal-footer">
              <slot name="footer"></slot>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-modal': Modal;
  }
}