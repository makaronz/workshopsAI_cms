/**
 * Workshop Editor TypeScript Interfaces
 * Defines types for workshop editor components and data structures
 */

import {
  Language,
  type Language as LanguageType,
} from '../../i18n/translations.js';

export type { LanguageType as Language };

// Core Workshop Types
export interface WorkshopData {
  id?: string;
  slug: string;
  titleI18n: Record<LanguageType, string>;
  subtitleI18n?: Record<LanguageType, string>;
  descriptionI18n: Record<LanguageType, string>;
  shortDescriptionI18n?: Record<LanguageType, string>;
  status: 'draft' | 'published' | 'archived' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  seatLimit?: number;
  enableWaitingList?: boolean;
  templateTheme?: 'integracja' | 'konflikty' | 'well-being' | 'custom';
  language: Language;
  price?: number;
  currency?: string;
  imageUrl?: string;
  gallery?: string[];
  requirementsI18n?: Record<LanguageType, string[]>;
  objectivesI18n?: Record<LanguageType, string[]>;
  materials?: WorkshopMaterial[];
  tagIds?: string[];
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WorkshopMaterial {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'video' | 'image' | 'document' | 'link' | 'audio';
  size?: number;
  sessionId?: string;
}

// Session Management Types
export interface WorkshopSession {
  id: string;
  workshopId: string;
  titleI18n: Record<LanguageType, string>;
  descriptionI18n?: Record<LanguageType, string>;
  type: SessionType;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  orderIndex: number;
  location?: string;
  materials: WorkshopMaterial[];
  isRequired: boolean;
  maxParticipants?: number;
  questionnaireId?: string;
  dependencies?: string[]; // session IDs that must be completed first
  breakDuration?: number; // for break sessions
  settings?: SessionSettings;
}

export type SessionType =
  | 'introduction'
  | 'activity'
  | 'break'
  | 'discussion'
  | 'presentation'
  | 'exercise'
  | 'conclusion'
  | 'feedback'
  | 'custom';

export interface SessionSettings {
  allowReordering?: boolean;
  autoCalculateDuration?: boolean;
  showProgress?: boolean;
  enableCollaboration?: boolean;
  timeWarnings?: {
    warning5min?: boolean;
    warning2min?: boolean;
  };
}

export interface SessionTemplate {
  id: string;
  name: Record<LanguageType, string>;
  description: Record<LanguageType, string>;
  type: SessionType;
  duration: number;
  materials: WorkshopMaterial[];
  questionnaireId?: string;
  settings: SessionSettings;
  category: 'icebreaker' | 'main' | 'wrapup' | 'break' | 'custom';
}

// Template System Types
export interface WorkshopTemplate {
  id: string;
  name: Record<LanguageType, string>;
  description: Record<LanguageType, string>;
  category: TemplateCategory;
  thumbnail?: string;
  duration: number; // total duration in minutes
  sessionCount: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  participantRange: {
    min: number;
    max: number;
  };
  tags: string[];
  sessions: SessionTemplate[];
  materials: WorkshopMaterial[];
  questionnaireIds?: string[];
  settings: WorkshopTemplateSettings;
  createdBy: string;
  isPublic: boolean;
  usageCount: number;
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateCategory =
  | 'team-building'
  | 'conflict-resolution'
  | 'communication'
  | 'leadership'
  | 'creativity'
  | 'decision-making'
  | 'onboarding'
  | 'community'
  | 'custom';

export interface WorkshopTemplateSettings {
  allowCustomization: boolean;
  requireAllSessions: boolean;
  adaptableDuration: boolean;
  languageSupport: Language[];
  targetAudience: string[];
  prerequisites?: string[];
  learningObjectives?: Record<LanguageType, string[]>;
}

// File Upload Types
export interface FileUploadOptions {
  accept: string[];
  maxSize: number; // in bytes
  maxFiles: number;
  multiple: boolean;
  autoUpload: boolean;
  uploadUrl: string;
  headers?: Record<string, string>;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  url?: string;
}

export interface CloudStorageConfig {
  provider: 's3' | 'gcs' | 'azure';
  bucket: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  endpoint?: string;
  publicUrl?: string;
}

// Preview Types
export interface PreviewOptions {
  mode: 'participant' | 'facilitator' | 'print';
  language: Language;
  showSessionDetails: boolean;
  showMaterials: boolean;
  showTimings: boolean;
  showProgress: boolean;
  includeQuestionnaires: boolean;
  theme?: 'light' | 'dark' | 'print';
}

export interface WorkshopPreview {
  id: string;
  workshopData: WorkshopData;
  sessions: WorkshopSession[];
  totalDuration: number;
  estimatedTime: {
    min: number;
    max: number;
  };
  participantView: {
    welcomeMessage: Record<LanguageType, string>;
    sessionFlow: SessionPreview[];
    materials: WorkshopMaterial[];
    questionnaires: any[];
  };
  facilitatorView: {
    sessionPlan: SessionPreview[];
    timing: {
      total: number;
      perSession: number[];
      buffer: number;
    };
    notes: string[];
    checklist: string[];
  };
}

export interface SessionPreview {
  session: WorkshopSession;
  order: number;
  startTime?: Date;
  endTime?: Date;
  duration: number;
  materials: WorkshopMaterial[];
  activities: SessionActivity[];
  transitions?: TransitionInfo[];
}

export interface SessionActivity {
  id: string;
  type: 'instruction' | 'exercise' | 'discussion' | 'break' | 'presentation';
  title: Record<LanguageType, string>;
  description?: Record<LanguageType, string>;
  duration: number;
  order: number;
  materials: string[];
  instructions?: Record<LanguageType, string[]>;
}

export interface TransitionInfo {
  fromSession: string;
  toSession: string;
  type: 'sequential' | 'conditional' | 'parallel';
  description?: Record<LanguageType, string>;
  duration?: number;
}

// Publishing and Validation Types
export interface PublishingChecklist {
  id: string;
  workshopId: string;
  isComplete: boolean;
  sections: ChecklistSection[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  canPublish: boolean;
  lastChecked: Date;
}

export interface ChecklistSection {
  id: string;
  title: Record<LanguageType, string>;
  description?: Record<LanguageType, string>;
  items: ChecklistItem[];
  isComplete: boolean;
  required: boolean;
}

export interface ChecklistItem {
  id: string;
  title: Record<LanguageType, string>;
  description?: Record<LanguageType, string>;
  isComplete: boolean;
  required: boolean;
  validator?: () => boolean;
  error?: string;
}

export interface ValidationError {
  id: string;
  field: string;
  message: Record<LanguageType, string>;
  severity: 'error' | 'warning';
  code: string;
  context?: any;
}

export interface ValidationWarning {
  id: string;
  field: string;
  message: Record<LanguageType, string>;
  suggestion?: Record<LanguageType, string>;
  code: string;
}

// Auto-save Types
export interface AutoSaveConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  debounceMs: number;
  maxRetries: number;
  conflictResolution: 'merge' | 'prompt' | 'server-wins';
  storage: 'local' | 'cloud' | 'hybrid';
}

export interface AutoSaveStatus {
  isEnabled: boolean;
  lastSaved?: Date;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  conflictCount: number;
  saveCount: number;
  error?: string;
}

export interface SaveConflict {
  id: string;
  timestamp: Date;
  localVersion: number;
  serverVersion: number;
  conflicts: ConflictDetail[];
}

export interface ConflictDetail {
  field: string;
  localValue: any;
  serverValue: any;
  type: 'value' | 'structure' | 'reference';
}

// Accessibility and WCAG Types
export interface AccessibilitySettings {
  enableScreenReader: boolean;
  enableKeyboardNavigation: boolean;
  enableHighContrast: boolean;
  enableReducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  language: Language;
  announceChanges: boolean;
}

export interface WCAGValidation {
  score: number; // 0-100
  level: 'A' | 'AA' | 'AAA' | 'non-compliant';
  violations: WCAGViolation[];
  recommendations: WCAGRecommendation[];
}

export interface WCAGViolation {
  id: string;
  principle: string;
  guideline: string;
  level: 'A' | 'AA' | 'AAA';
  description: Record<LanguageType, string>;
  element?: string;
  fix?: Record<LanguageType, string>;
}

export interface WCAGRecommendation {
  id: string;
  category: string;
  description: Record<LanguageType, string>;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
}

// Component Event Types
export interface WorkshopEditorEvents {
  // Workshop events
  workshopChange: (data: Partial<WorkshopData>) => void;
  workshopSave: (data: WorkshopData) => void;
  workshopPublish: (data: WorkshopData) => void;

  // Session events
  sessionAdd: (session: WorkshopSession) => void;
  sessionUpdate: (sessionId: string, data: Partial<WorkshopSession>) => void;
  sessionDelete: (sessionId: string) => void;
  sessionReorder: (sessionIds: string[]) => void;

  // File events
  fileUpload: (files: File[]) => void;
  fileDelete: (fileId: string) => void;
  fileProgress: (progress: UploadProgress[]) => void;

  // Template events
  templateSelect: (template: WorkshopTemplate) => void;
  templateCustomize: (template: WorkshopTemplate, customizations: any) => void;

  // Preview events
  previewUpdate: (options: PreviewOptions) => void;
  previewPrint: () => void;

  // Validation events
  validationChange: (isValid: boolean, errors: ValidationError[]) => void;

  // Auto-save events
  autoSaveChange: (status: AutoSaveStatus) => void;
  conflictDetected: (conflict: SaveConflict) => void;
}

// UI State Types
export interface EditorUIState {
  activeTab:
    | 'basic'
    | 'sessions'
    | 'materials'
    | 'questionnaires'
    | 'preview'
    | 'settings';
  isDirty: boolean;
  isSaving: boolean;
  isValid: boolean;
  selectedSession?: string;
  selectedMaterial?: string;
  previewMode: PreviewOptions;
  sidebarCollapsed: boolean;
  showValidation: boolean;
  language: Language;
  accessibilityMode: boolean;
}

// Integration Types
export interface QuestionnaireReference {
  id: string;
  title: Record<LanguageType, string>;
  type: 'pre-workshop' | 'post-workshop' | 'session-feedback' | 'custom';
  sessionId?: string;
  isRequired: boolean;
}

export interface APIEndpoints {
  workshops: {
    base: string;
    create: string;
    update: string;
    delete: string;
    publish: string;
    checklist: string;
  };
  sessions: {
    base: string;
    reorder: string;
  };
  materials: {
    upload: string;
    delete: string;
  };
  templates: {
    base: string;
    preview: string;
  };
  questionnaires: {
    base: string;
    link: string;
  };
}

// Error Types
export interface WorkshopEditorError {
  code: string;
  message: Record<LanguageType, string>;
  details?: any;
  recoverable: boolean;
  suggestions?: Record<LanguageType, string[]>;
}

// Export utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type OptionalId<T> = Omit<T, 'id'> & { id?: string };

export type CreateWorkshopData = OptionalId<WorkshopData>;

export type UpdateWorkshopData = DeepPartial<WorkshopData>;

export type CreateSessionData = OptionalId<WorkshopSession>;

export type UpdateSessionData = DeepPartial<WorkshopSession>;
