import { LitElement, html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

export interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  placeholder?: string;
  buttonText?: string;
  showPreview?: boolean;
}

interface FileInfo {
  file: File;
  id: string;
  url?: string;
  error?: string;
}

@customElement('ui-file-upload')
export class FileUpload extends LitElement implements FileUploadProps {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
    }

    .file-upload {
      border: 2px dashed var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-6);
      text-align: center;
      transition: all 0.2s ease;
      background: var(--color-gray-50);
    }

    .file-upload:hover:not(.file-upload--disabled) {
      border-color: var(--color-primary-500);
      background: var(--color-primary-50);
    }

    .file-upload--drag-over {
      border-color: var(--color-primary-600);
      background: var(--color-primary-100);
    }

    .file-upload--disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .file-upload--error {
      border-color: var(--color-error-500);
      background: var(--color-error-50);
    }

    .file-input {
      display: none;
    }

    .upload-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-3);
    }

    .upload-icon {
      width: 48px;
      height: 48px;
      color: var(--color-gray-400);
      font-size: var(--font-size-3xl);
    }

    .upload-text {
      font-size: var(--font-size-base);
      color: var(--color-text-primary);
      margin: 0;
    }

    .upload-subtext {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin: 0;
    }

    .upload-button {
      margin-top: var(--spacing-2);
    }

    /* File List */
    .file-list {
      margin-top: var(--spacing-4);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
    }

    .file-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3);
      background: white;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      transition: all 0.2s ease;
    }

    .file-item--error {
      border-color: var(--color-error-500);
      background: var(--color-error-50);
    }

    .file-icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-gray-100);
      border-radius: var(--radius-md);
      font-size: var(--font-size-lg);
      color: var(--color-gray-600);
      flex-shrink: 0;
    }

    .file-info {
      flex: 1;
      min-width: 0;
    }

    .file-name {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-1) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-details {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    }

    .file-error {
      font-size: var(--font-size-xs);
      color: var(--color-error-600);
      margin-top: var(--spacing-1);
    }

    .file-actions {
      display: flex;
      gap: var(--spacing-1);
      flex-shrink: 0;
    }

    .file-remove {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      color: var(--color-gray-400);
      transition: all 0.2s ease;
    }

    .file-remove:hover {
      background: var(--color-gray-100);
      color: var(--color-gray-600);
    }

    .file-remove:focus {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    /* Progress */
    .file-progress {
      margin-top: var(--spacing-2);
      height: 4px;
      background: var(--color-gray-200);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .file-progress-bar {
      height: 100%;
      background: var(--color-primary-600);
      transition: width 0.3s ease;
    }

    /* Preview */
    .file-preview {
      width: 60px;
      height: 60px;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 1px solid var(--color-border);
      background: var(--color-gray-100);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .file-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Responsive Design */
    @media (max-width: 640px) {
      .file-upload {
        padding: var(--spacing-4);
      }

      .file-item {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--spacing-2);
      }

      .file-info {
        width: 100%;
      }

      .file-actions {
        align-self: flex-end;
      }
    }

    /* High Contrast Mode */
    @media (prefers-contrast: high) {
      .file-upload {
        border-width: 3px;
      }

      .file-item {
        border-width: 2px;
      }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .file-upload,
      .file-item,
      .file-remove,
      .file-progress-bar {
        transition: none;
      }
    }
  `;

  @property({ type: String })
  accept?: FileUploadProps['accept'];

  @property({ type: Boolean })
  multiple: boolean = false;

  @property({ type: Boolean })
  disabled: boolean = false;

  @property({ type: Boolean })
  required: boolean = false;

  @property({ type: Number })
  maxSize?: FileUploadProps['maxSize'];

  @property({ type: Number })
  maxFiles?: FileUploadProps['maxFiles'];

  @property({ type: String })
  placeholder?: FileUploadProps['placeholder'];

  @property({ type: String })
  buttonText?: FileUploadProps['buttonText'];

  @property({ type: Boolean })
  showPreview: boolean = true;

  @state()
  private files: FileInfo[] = [];

  @state()
  private isDragOver = false;

  @state()
  private hasError = false;

  private inputRef: HTMLInputElement | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.setupDragAndDrop();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeDragAndDrop();
  }

  private setupDragAndDrop() {
    this.addEventListener('dragover', this.handleDragOver);
    this.addEventListener('dragleave', this.handleDragLeave);
    this.addEventListener('drop', this.handleDrop);
  }

  private removeDragAndDrop() {
    this.removeEventListener('dragover', this.handleDragOver);
    this.removeEventListener('dragleave', this.handleDragLeave);
    this.removeEventListener('drop', this.handleDrop);
  }

  private handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    this.isDragOver = true;
  };

  private handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    this.isDragOver = false;
  };

  private handleDrop = (event: DragEvent) => {
    event.preventDefault();
    this.isDragOver = false;

    if (this.disabled) return;

    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    this.addFiles(droppedFiles);
  };

  private handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const selectedFiles = Array.from(target.files || []);
    this.addFiles(selectedFiles);
  };

  private addFiles(newFiles: File[]) {
    if (this.disabled) return;

    const validFiles: FileInfo[] = [];
    let hasError = false;

    // Check max files limit
    if (this.maxFiles && (this.files.length + newFiles.length) > this.maxFiles) {
      hasError = true;
    }

    for (const file of newFiles) {
      // Check file type
      if (this.accept && !this.isFileAccepted(file)) {
        hasError = true;
        continue;
      }

      // Check file size
      if (this.maxSize && file.size > this.maxSize) {
        hasError = true;
        continue;
      }

      validFiles.push({
        file,
        id: Math.random().toString(36).substr(2, 9),
        url: this.createFileUrl(file)
      });
    }

    if (!this.multiple) {
      this.files = validFiles.slice(0, 1);
    } else {
      this.files = [...this.files, ...validFiles];
    }

    this.hasError = hasError;

    this.dispatchEvent(new CustomEvent('change', {
      detail: { files: this.files.map(f => f.file) },
      bubbles: true,
      composed: true
    }));
  }

  private removeFile(fileId: string) {
    this.files = this.files.filter(f => f.id !== fileId);

    this.dispatchEvent(new CustomEvent('change', {
      detail: { files: this.files.map(f => f.file) },
      bubbles: true,
      composed: true
    }));
  }

  private isFileAccepted(file: File): boolean {
    if (!this.accept) return true;

    const acceptTypes = this.accept.split(',').map(type => type.trim());
    return acceptTypes.some(type => {
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      } else if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      } else {
        return file.type === type;
      }
    });
  }

  private createFileUrl(file: File): string | undefined {
    if (this.showPreview && file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return undefined;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getFileIcon(file: File): string {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type.startsWith('video/')) return '🎥';
    if (file.type.startsWith('audio/')) return '🎵';
    if (file.type.includes('pdf')) return '📄';
    if (file.type.includes('word')) return '📝';
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) return '📊';
    if (file.type.includes('powerpoint') || file.type.includes('presentation')) return '📋';
    if (file.type.includes('zip') || file.type.includes('compressed')) return '📦';
    return '📎';
  }

  private getUploadClasses() {
    return [
      'file-upload',
      this.isDragOver ? 'file-upload--drag-over' : '',
      this.disabled ? 'file-upload--disabled' : '',
      this.hasError ? 'file-upload--error' : ''
    ].filter(Boolean).join(' ');
  }

  render(): TemplateResult {
    return html`
      <div class=${this.getUploadClasses()}>
        <input
          type="file"
          class="file-input"
          .accept=${this.accept}
          .multiple=${this.multiple}
          .disabled=${this.disabled}
          @change=${this.handleFileSelect}
        >

        <div class="upload-content" @click=${() => !this.disabled && this.inputRef?.click()}>
          <div class="upload-icon">📁</div>
          <p class="upload-text">${this.placeholder || i18n.t('file_upload.drag_drop')}</p>
          <p class="upload-subtext">${i18n.t('file_upload.or')}</p>
          <div class="upload-button">
            <app-button variant="outline" ?disabled=${this.disabled}>
              ${this.buttonText || i18n.t('file_upload.select_files')}
            </app-button>
          </div>
        </div>

        ${this.files.length > 0 ? html`
          <div class="file-list">
            ${this.files.map(fileInfo => html`
              <div class="file-item ${fileInfo.error ? 'file-item--error' : ''}">
                ${this.showPreview && fileInfo.url ? html`
                  <div class="file-preview">
                    <img src=${fileInfo.url} alt="${fileInfo.file.name}">
                  </div>
                ` : html`
                  <div class="file-icon">
                    ${this.getFileIcon(fileInfo.file)}
                  </div>
                `}

                <div class="file-info">
                  <div class="file-name">${fileInfo.file.name}</div>
                  <div class="file-details">
                    ${this.formatFileSize(fileInfo.file.size)} • ${fileInfo.file.type}
                  </div>
                  ${fileInfo.error ? html`
                    <div class="file-error">${fileInfo.error}</div>
                  ` : ''}
                </div>

                <div class="file-actions">
                  <button
                    class="file-remove"
                    @click=${() => this.removeFile(fileInfo.id)}
                    aria-label=${i18n.t('action.remove_file')}
                  >
                    ✕
                  </button>
                </div>
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-file-upload': FileUpload;
  }
}