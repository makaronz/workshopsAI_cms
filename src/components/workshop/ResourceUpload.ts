/**
 * Resource Upload Web Component
 * Handles file uploads, organization, and management for workshop materials
 * Supports multiple file types, progress tracking, and cloud storage integration
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import {
  WorkshopMaterial,
  UploadProgress,
  FileUploadOptions,
  WorkshopSession,
  CloudStorageConfig,
  Language,
} from './WorkshopTypes.js';

/**
 * Resource Upload Component
 */
@customElement('resource-upload')
export class ResourceUpload extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .upload-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* Upload Area */
    .upload-area {
      border: 2px dashed #d1d5db;
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
      background: #f9fafb;
      transition: all 0.3s ease;
      cursor: pointer;
      position: relative;
    }

    .upload-area:hover {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .upload-area.dragover {
      border-color: #3b82f6;
      background: #dbeafe;
      transform: scale(1.02);
    }

    .upload-area.uploading {
      border-color: #10b981;
      background: #d1fae5;
    }

    .upload-icon {
      font-size: 3rem;
      color: #9ca3af;
      margin-bottom: 1rem;
    }

    .upload-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .upload-description {
      color: #6b7280;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }

    .upload-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .upload-button:hover {
      background: #2563eb;
    }

    .upload-input {
      display: none;
    }

    /* File Type Restrictions */
    .file-types {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 1rem;
      font-size: 0.75rem;
      color: #6b7280;
    }

    .file-type {
      padding: 0.25rem 0.5rem;
      background: #e5e7eb;
      border-radius: 4px;
      font-weight: 500;
    }

    /* Upload Progress */
    .upload-progress {
      margin-top: 1.5rem;
    }

    .progress-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 0.75rem;
    }

    .progress-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .progress-info {
      flex: 1;
      min-width: 0;
    }

    .progress-filename {
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .progress-details {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .progress-bar-container {
      flex: 1;
      max-width: 200px;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: #3b82f6;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .progress-percentage {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      min-width: 3rem;
      text-align: right;
    }

    .progress-item.success {
      border-color: #10b981;
      background: #f0fdf4;
    }

    .progress-item.error {
      border-color: #ef4444;
      background: #fef2f2;
    }

    .progress-item.success .progress-icon {
      color: #10b981;
    }

    .progress-item.error .progress-icon {
      color: #ef4444;
    }

    /* Materials List */
    .materials-section {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
    }

    .materials-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .materials-title {
      font-size: 1rem;
      font-weight: 600;
      color: #374151;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .materials-count {
      font-size: 0.875rem;
      color: #6b7280;
      font-weight: normal;
    }

    .materials-controls {
      display: flex;
      gap: 0.5rem;
    }

    .control-btn {
      padding: 0.5rem 0.75rem;
      background: white;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
    }

    .control-btn:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
      color: #374151;
    }

    .control-btn.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }

    .materials-content {
      max-height: 400px;
      overflow-y: auto;
    }

    .material-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #f3f4f6;
      transition: background 0.2s;
      cursor: pointer;
    }

    .material-item:hover {
      background: #f9fafb;
    }

    .material-item:last-child {
      border-bottom: none;
    }

    .material-icon {
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f3f4f6;
      border-radius: 8px;
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .material-info {
      flex: 1;
      min-width: 0;
    }

    .material-name {
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .material-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.75rem;
      color: #6b7280;
    }

    .material-size {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .material-type {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .material-session {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .material-actions {
      display: flex;
      gap: 0.5rem;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .material-item:hover .material-actions {
      opacity: 1;
    }

    .material-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.875rem;
    }

    .material-action-btn:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
      color: #374151;
    }

    .material-action-btn.delete:hover {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #dc2626;
    }

    /* Filter and Search */
    .materials-filter {
      padding: 1rem 1.5rem;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .filter-row {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .search-input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.875rem;
      min-width: 0;
    }

    .filter-select {
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.875rem;
      background: white;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #6b7280;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .empty-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .empty-description {
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }

    /* Storage Info */
    .storage-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .storage-usage {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .storage-bar {
      width: 200px;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }

    .storage-used {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #10b981);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    /* Session Organization */
    .session-organization {
      margin-top: 1.5rem;
      padding: 1rem;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
    }

    .session-org-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 0.75rem;
    }

    .session-assign {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .session-chip {
      padding: 0.25rem 0.75rem;
      background: #fde68a;
      color: #78350f;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .session-chip:hover {
      background: #fcd34d;
    }

    .session-chip.assigned {
      background: #dc2626;
      color: white;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .upload-area {
        padding: 1.5rem;
      }

      .materials-header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .filter-row {
        flex-direction: column;
      }

      .search-input {
        width: 100%;
      }

      .material-item {
        padding: 0.75rem;
      }

      .material-meta {
        flex-direction: column;
        gap: 0.25rem;
        align-items: flex-start;
      }

      .storage-info {
        flex-direction: column;
        gap: 0.75rem;
        text-align: center;
      }

      .storage-bar {
        width: 100%;
      }
    }
  `;

  // Properties
  @property() workshopId?: string;
  @property() materials: WorkshopMaterial[] = [];
  @property() sessions: WorkshopSession[] = [];
  @property() language: Language = 'pl';

  // Internal state
  @state() private uploadProgress: UploadProgress[] = [];
  @state() private isUploading = false;
  @state() private filterType: string = 'all';
  @state() private filterSession: string = 'all';
  @state() private searchTerm: string = '';
  @state() private viewMode: 'grid' | 'list' = 'list';
  @state() private storageUsed = 0;
  @state() private storageLimit = 5 * 1024 * 1024 * 1024; // 5GB

  // File upload configuration
  private uploadOptions: FileUploadOptions = {
    accept: [
      'image/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'video/*',
      'audio/*',
      'text/plain',
      'application/zip',
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 10,
    multiple: true,
    autoUpload: true,
    uploadUrl: '/api/v1/materials/upload',
  };

  // Cloud storage configuration
  private cloudConfig: CloudStorageConfig = {
    provider: 's3',
    bucket: 'workshops-materials',
    region: 'eu-west-1',
    publicUrl: 'https://cdn.workshopsai.com',
  };

  @query('.upload-area') uploadArea!: HTMLElement;
  @query('.upload-input') uploadInput!: HTMLInputElement;

  override connectedCallback() {
    super.connectedCallback();
    this.setupDragAndDrop();
    this.loadStorageInfo();
  }

  override disconnectedCallback() {
    this.cleanupDragAndDrop();
    super.disconnectedCallback();
  }

  private setupDragAndDrop() {
    const area = this.uploadArea;
    if (!area) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      area.classList.add('dragover');
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      area.classList.remove('dragover');
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      area.classList.remove('dragover');

      const files = Array.from(e.dataTransfer?.files || []);
      this.handleFiles(files);
    };

    area.addEventListener('dragover', handleDragOver);
    area.addEventListener('dragleave', handleDragLeave);
    area.addEventListener('drop', handleDrop);

    // Store event listeners for cleanup
    (this as any)._dragListeners = [
      { element: area, event: 'dragover', handler: handleDragOver },
      { element: area, event: 'dragleave', handler: handleDragLeave },
      { element: area, event: 'drop', handler: handleDrop },
    ];
  }

  private cleanupDragAndDrop() {
    const listeners = (this as any)._dragListeners || [];
    listeners.forEach(({ element, event, handler }: any) => {
      element.removeEventListener(event, handler);
    });
    (this as any)._dragListeners = [];
  }

  private async loadStorageInfo() {
    try {
      const response = await fetch('/api/v1/materials/storage-info');
      if (response.ok) {
        const data = await response.json();
        this.storageUsed = data.used || 0;
        this.storageLimit = data.limit || this.storageLimit;
      }
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  }

  private handleFileSelect() {
    this.uploadInput?.click();
  }

  private handleFileInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    this.handleFiles(files);
    target.value = ''; // Reset input
  }

  private async handleFiles(files: File[]) {
    if (files.length === 0) return;

    // Validate files
    const validFiles = files.filter(file => this.validateFile(file));
    if (validFiles.length !== files.length) {
      alert('Some files were rejected due to size or type restrictions');
    }

    if (validFiles.length === 0) return;

    // Check storage limit
    const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
    if (this.storageUsed + totalSize > this.storageLimit) {
      alert(
        'Not enough storage space. Please upgrade your plan or delete some files.',
      );
      return;
    }

    this.isUploading = true;

    // Create upload progress items
    const uploadItems: UploadProgress[] = validFiles.map(file => ({
      fileId: this.generateId(),
      fileName: file.name,
      progress: 0,
      status: 'pending' as const,
    }));

    this.uploadProgress = [...this.uploadProgress, ...uploadItems];

    // Upload files
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const progressItem = uploadItems[i];

      try {
        await this.uploadFile(file, progressItem);
      } catch (error) {
        console.error('Upload failed:', error);
        this.uploadProgress = this.uploadProgress.map(item =>
          item.fileId === progressItem.fileId
            ? {
              ...item,
              status: 'error',
              error: error instanceof Error ? error.message : 'Upload failed',
            }
            : item,
        );
      }
    }

    this.isUploading = false;
    this.loadStorageInfo();
  }

  private validateFile(file: File): boolean {
    // Check file type
    const isValidType = this.uploadOptions.accept.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -2));
      }
      return file.type === type;
    });

    if (!isValidType) {
      alert(`Invalid file type: ${file.type}`);
      return false;
    }

    // Check file size
    if (file.size > this.uploadOptions.maxSize) {
      alert(`File too large: ${file.name} (${this.formatFileSize(file.size)})`);
      return false;
    }

    return true;
  }

  private async uploadFile(
    file: File,
    progressItem: UploadProgress,
  ): Promise<void> {
    // Update status to uploading
    this.uploadProgress = this.uploadProgress.map(item =>
      item.fileId === progressItem.fileId
        ? { ...item, status: 'uploading' }
        : item,
    );

    const formData = new FormData();
    formData.append('file', file);
    formData.append('workshopId', this.workshopId || '');
    formData.append('fileType', this.getFileType(file));

    const response = await fetch(this.uploadOptions.uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Update progress to success
    this.uploadProgress = this.uploadProgress.map(item =>
      item.fileId === progressItem.fileId
        ? { ...item, status: 'success', progress: 100, url: result.url }
        : item,
    );

    // Add to materials list
    const newMaterial: WorkshopMaterial = {
      id: this.generateId(),
      name: file.name,
      url: result.url,
      type: this.getFileType(file) as WorkshopMaterial['type'],
      size: file.size,
    };

    this.materials = [...this.materials, newMaterial];
    this.dispatchMaterialsChange();
  }

  private getFileType(file: File): string {
    const type = file.type.toLowerCase();

    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf') return 'pdf';
    if (type.includes('word') || type.includes('document')) return 'document';
    if (type.includes('powerpoint') || type.includes('presentation'))
      return 'document';
    if (type === 'text/plain') return 'document';
    if (type.includes('zip')) return 'link';

    return 'document';
  }

  private getFileIcon(type: WorkshopMaterial['type']): string {
    const icons: Record<WorkshopMaterial['type'], string> = {
      pdf: '📄',
      video: '🎥',
      image: '🖼️',
      document: '📝',
      link: '🔗',
      audio: '🎵',
    };

    return icons[type] || '📎';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private deleteMaterial(materialId: string) {
    if (confirm('Are you sure you want to delete this file?')) {
      this.materials = this.materials.filter(m => m.id !== materialId);
      this.dispatchMaterialsChange();
    }
  }

  private downloadMaterial(material: WorkshopMaterial) {
    const link = document.createElement('a');
    link.href = material.url;
    link.download = material.name;
    link.click();
  }

  private assignToSession(materialId: string, sessionId?: string) {
    this.materials = this.materials.map(material =>
      material.id === materialId ? { ...material, sessionId } : material,
    );
    this.dispatchMaterialsChange();
  }

  private getFilteredMaterials(): WorkshopMaterial[] {
    let filtered = [...this.materials];

    // Filter by type
    if (this.filterType !== 'all') {
      filtered = filtered.filter(m => m.type === this.filterType);
    }

    // Filter by session
    if (this.filterSession !== 'all') {
      if (this.filterSession === 'unassigned') {
        filtered = filtered.filter(m => !m.sessionId);
      } else {
        filtered = filtered.filter(m => m.sessionId === this.filterSession);
      }
    }

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(m => m.name.toLowerCase().includes(term));
    }

    return filtered;
  }

  private dispatchMaterialsChange() {
    this.dispatchEvent(
      new CustomEvent('materials-change', {
        detail: { materials: this.materials },
        bubbles: true,
      }),
    );
  }

  private generateId(): string {
    return 'material_' + Math.random().toString(36).substr(2, 9);
  }

  private getStorageUsagePercentage(): number {
    return Math.min((this.storageUsed / this.storageLimit) * 100, 100);
  }

  protected override render() {
    const filteredMaterials = this.getFilteredMaterials();
    const storagePercentage = this.getStorageUsagePercentage();

    return html`
      <div class="upload-container">
        <!-- Upload Area -->
        <div
          class="upload-area ${classMap({
    dragover: false,
    uploading: this.isUploading,
  })}"
          @click=${this.handleFileSelect}
        >
          <div class="upload-icon">☁️</div>
          <div class="upload-title">Upload Workshop Materials</div>
          <div class="upload-description">
            Drag and drop files here or click to browse
          </div>
          <button
            class="upload-button"
            @click=${(e: Event) => e.stopPropagation()}
          >
            📁 Choose Files
          </button>
          <input
            type="file"
            class="upload-input"
            multiple
            accept="${this.uploadOptions.accept.join(',')}"
            @change=${this.handleFileInputChange}
          />
          <div class="file-types">
            <span class="file-type">Images</span>
            <span class="file-type">PDFs</span>
            <span class="file-type">Documents</span>
            <span class="file-type">Videos</span>
            <span class="file-type">Audio</span>
            <span class="file-type"
              >Max ${this.formatFileSize(this.uploadOptions.maxSize)}</span
            >
          </div>
        </div>

        <!-- Upload Progress -->
        ${this.uploadProgress.length > 0
    ? html`
              <div class="upload-progress">
                ${this.uploadProgress.map(
    item => html`
                    <div
                      class="progress-item ${classMap({
    success: item.status === 'success',
    error: item.status === 'error',
  })}"
                    >
                      <div class="progress-icon">
                        ${item.status === 'success'
    ? '✅'
    : item.status === 'error'
      ? '❌'
      : '⏳'}
                      </div>
                      <div class="progress-info">
                        <div class="progress-filename">${item.fileName}</div>
                        <div class="progress-details">
                          ${item.status === 'success'
    ? 'Upload complete'
    : item.status === 'error'
      ? item.error || 'Upload failed'
      : 'Uploading...'}
                        </div>
                      </div>
                      ${item.status === 'uploading'
    ? html`
                            <div class="progress-bar-container">
                              <div
                                class="progress-bar"
                                style=${styleMap({
    width: `${item.progress}%`,
  })}
                              ></div>
                            </div>
                            <div class="progress-percentage">
                              ${item.progress}%
                            </div>
                          `
    : ''}
                    </div>
                  `,
  )}
              </div>
            `
    : ''}

        <!-- Materials List -->
        <div class="materials-section">
          <div class="materials-header">
            <h3 class="materials-title">
              📁 Materials
              <span class="materials-count">(${this.materials.length})</span>
            </h3>
            <div class="materials-controls">
              <button
                class="control-btn ${classMap({
    active: this.viewMode === 'list',
  })}"
                @click=${() => (this.viewMode = 'list')}
              >
                📋 List
              </button>
              <button
                class="control-btn ${classMap({
    active: this.viewMode === 'grid',
  })}"
                @click=${() => (this.viewMode = 'grid')}
              >
                ⚏ Grid
              </button>
            </div>
          </div>

          <!-- Filter Controls -->
          <div class="materials-filter">
            <div class="filter-row">
              <input
                type="text"
                class="search-input"
                placeholder="Search files..."
                .value=${this.searchTerm}
                @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.searchTerm = target.value;
  }}
              />
              <select
                class="filter-select"
                .value=${this.filterType}
                @change=${(e: Event) => {
    const target = e.target as HTMLSelectElement;
    this.filterType = target.value;
  }}
              >
                <option value="all">All Types</option>
                <option value="pdf">PDFs</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="document">Documents</option>
                <option value="audio">Audio</option>
                <option value="link">Links</option>
              </select>
              <select
                class="filter-select"
                .value=${this.filterSession}
                @change=${(e: Event) => {
    const target = e.target as HTMLSelectElement;
    this.filterSession = target.value;
  }}
              >
                <option value="all">All Sessions</option>
                <option value="unassigned">Unassigned</option>
                ${this.sessions.map(
    session => html`
                    <option value="${session.id}">
                      ${session.titleI18n[this.language]}
                    </option>
                  `,
  )}
              </select>
            </div>
          </div>

          <!-- Materials List -->
          <div class="materials-content">
            ${filteredMaterials.length === 0
    ? html`
                  <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-title">No materials found</div>
                    <div class="empty-description">
                      ${this.materials.length === 0
    ? 'Upload some files to get started'
    : 'Try adjusting your filters or search term'}
                    </div>
                  </div>
                `
    : filteredMaterials.map(material => {
      const session = material.sessionId
        ? this.sessions.find(s => s.id === material.sessionId)
        : null;

      return html`
                    <div class="material-item">
                      <div class="material-icon">
                        ${this.getFileIcon(material.type)}
                      </div>
                      <div class="material-info">
                        <div class="material-name">${material.name}</div>
                        <div class="material-meta">
                          <div class="material-size">
                            📦
                            ${material.size
    ? this.formatFileSize(material.size)
    : 'Unknown size'}
                          </div>
                          <div class="material-type">🏷️ ${material.type}</div>
                          ${session
    ? html`
                                <div class="material-session">
                                  📅 ${session.titleI18n[this.language]}
                                </div>
                              `
    : ''}
                        </div>
                      </div>
                      <div class="material-actions">
                        <button
                          class="material-action-btn"
                          @click=${() => this.downloadMaterial(material)}
                          title="Download"
                        >
                          ⬇️
                        </button>
                        <button
                          class="material-action-btn delete"
                          @click=${() => this.deleteMaterial(material.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  `;
    })}
          </div>
        </div>

        <!-- Storage Information -->
        <div class="storage-info">
          <div class="storage-usage">
            <span>Storage Used:</span>
            <div class="storage-bar">
              <div
                class="storage-used"
                style=${styleMap({ width: `${storagePercentage}%` })}
              ></div>
            </div>
            <span
              >${this.formatFileSize(this.storageUsed)} /
              ${this.formatFileSize(this.storageLimit)}</span
            >
          </div>
          <div>
            ${storagePercentage > 80
    ? '⚠️ Running low on storage'
    : '✅ Storage available'}
          </div>
        </div>
      </div>
    `;
  }
}

// Register the custom element
if (!customElements.get('resource-upload')) {
  customElements.define('resource-upload', ResourceUpload);
}
