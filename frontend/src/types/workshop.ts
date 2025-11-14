/**
 * Type definitions for Workshop Editor components
 * These align with the backend schema and provide frontend type safety
 */

export interface Workshop {
  id: string;
  slug: string;
  titleI18n: Record<string, string>;
  subtitleI18n?: Record<string, string>;
  descriptionI18n: Record<string, string>;
  shortDescriptionI18n?: Record<string, string>;
  status: 'draft' | 'published' | 'archived' | 'cancelled';
  startDate?: string;
  endDate?: string;
  seatLimit?: number;
  seatReserved?: number;
  enableWaitingList?: boolean;
  waitingListCount?: number;
  templateTheme: 'integracja' | 'konflikty' | 'well-being' | 'custom';
  language: 'pl' | 'en';
  price?: number;
  currency?: string;
  imageUrl?: string;
  gallery?: string[];
  requirementsI18n?: Record<string, string[]>;
  objectivesI18n?: Record<string, string[]>;
  materials?: WorkshopMaterial[];
  createdBy: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  sessions?: WorkshopSession[];
  tags?: WorkshopTag[];
  facilitators?: WorkshopFacilitator[];
}

export interface WorkshopSession {
  id: string;
  workshopId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration?: number; // in minutes
  order: number;
  location?: string;
  materials?: WorkshopMaterial[];
  isRequired?: boolean;
  maxParticipants?: number;
  modules?: WorkshopModule[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopModule {
  id: string;
  sessionId: string;
  title?: string;
  type: 'text' | 'video' | 'quiz' | 'exercise' | 'discussion' | 'presentation' | 'file' | 'questionnaire';
  content: ModuleContent;
  duration?: number; // in minutes
  order: number;
  isRequired?: boolean;
  resources?: WorkshopMaterial[];
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleContent {
  text?: string;
  html?: string;
  url?: string;
  questions?: any[];
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  questionnaireId?: string;
  [key: string]: any;
}

export interface WorkshopMaterial {
  name: string;
  url: string;
  type: string;
  description?: string;
}

export interface WorkshopTag {
  id: string;
  name: string;
  slug: string;
  category: 'theme' | 'skill' | 'level' | 'format' | 'audience';
  color?: string;
}

export interface WorkshopFacilitator {
  id: string;
  userId: number;
  slug: string;
  title?: string;
  organization?: string;
  role: 'lead' | 'assistant' | 'guest';
}

export interface WorkshopFormData {
  slug: string;
  titleI18n: Record<string, string>;
  subtitleI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  shortDescriptionI18n: Record<string, string>;
  startDate?: string;
  endDate?: string;
  seatLimit?: number;
  enableWaitingList?: boolean;
  templateTheme: 'integracja' | 'konflikty' | 'well-being' | 'custom';
  language: 'pl' | 'en';
  price?: number;
  currency?: string;
  requirementsI18n: Record<string, string[]>;
  objectivesI18n: Record<string, string[]>;
  materials: WorkshopMaterial[];
  tagIds?: string[];
}

export interface PublishingChecklist {
  isComplete: boolean;
  items: ChecklistItem[];
  canPublish: boolean;
  missingItems: string[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
  category: 'content' | 'metadata' | 'sessions' | 'questionnaires' | 'logistics';
}

export interface ValidationErrors {
  [key: string]: string | string[];
}

export interface AutoSaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved?: Date;
  error?: string;
}

export interface WorkshopEditorState {
  workshop?: Workshop;
  formData: Partial<WorkshopFormData>;
  sessions: WorkshopSession[];
  modules: WorkshopModule[];
  isValid: boolean;
  errors: ValidationErrors;
  autoSaveStatus: AutoSaveStatus;
  currentStep: number;
  isDirty: boolean;
  isLoading: boolean;
  showPreview: boolean;
}

export interface WorkshopEditorProps {
  workshopId?: string;
  initialData?: Partial<WorkshopFormData>;
  onSave?: (workshop: Workshop) => void;
  onPublish?: (workshop: Workshop) => void;
  onCancel?: () => void;
  readonly?: boolean;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

// Translation keys for i18n
export interface WorkshopTranslationKeys {
  'workshop.title': string;
  'workshop.slug': string;
  'workshop.description': string;
  'workshop.status': string;
  'workshop.steps.metadata': string;
  'workshop.steps.sessions': string;
  'workshop.steps.modules': string;
  'workshop.steps.review': string;
  'workshop.autosave.saving': string;
  'workshop.autosave.saved': string;
  'workshop.autosave.error': string;
  'workshop.validation.required': string;
  'workshop.validation.slug_format': string;
  'workshop.validation.url_format': string;
  'workshop.publish_checklist.title': string;
  'workshop.publish_checklist.description': string;
}

export type Language = 'pl' | 'en';
export type Theme = 'integracja' | 'konflikty' | 'well-being' | 'custom';
export type WorkshopStatus = 'draft' | 'published' | 'archived' | 'cancelled';
export type ModuleType = 'text' | 'video' | 'quiz' | 'exercise' | 'discussion' | 'presentation' | 'file' | 'questionnaire';
export type ChecklistCategory = 'content' | 'metadata' | 'sessions' | 'questionnaires' | 'logistics';

// Event types for component communication
export interface WorkshopEditorEvent {
  type: 'workshop-changed' | 'session-added' | 'session-updated' | 'session-deleted' |
        'module-added' | 'module-updated' | 'module-deleted' | 'save-requested' |
        'publish-requested' | 'preview-toggled' | 'validation-changed';
  detail: any;
}

export interface SessionChangeEvent extends WorkshopEditorEvent {
  type: 'session-added' | 'session-updated' | 'session-deleted';
  detail: {
    session: WorkshopSession;
    sessions: WorkshopSession[];
  };
}

export interface ModuleChangeEvent extends WorkshopEditorEvent {
  type: 'module-added' | 'module-updated' | 'module-deleted';
  detail: {
    module: WorkshopModule;
    sessionId: string;
    modules: WorkshopModule[];
  };
}