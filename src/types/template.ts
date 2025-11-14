/**
 * Template Management System Type Definitions
 * Comprehensive types for workshop and questionnaire templates
 */

export interface BaseTemplate {
  id: string;
  slug: string;
  title: { pl: string; en: string };
  description?: { pl: string; en: string };
  category: TemplateCategory;
  type: TemplateType;
  status: TemplateStatus;
  language: 'pl' | 'en' | 'both';
  creatorId: number;
  creator?: TemplateAuthor;
  tags: string[];
  featured: boolean;
  rating: number;
  usageCount: number;
  averageRating: number;
  totalReviews: number;
  estimatedDuration: number; // in minutes
  difficulty: TemplateDifficulty;
  targetAudience: string[];
  prerequisites: string[];
  learningObjectives: string[];
  materials: TemplateMaterial[];
  imageUrl?: string;
  thumbnailUrl?: string;
  metadata: TemplateMetadata;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface WorkshopTemplate extends BaseTemplate {
  type: 'workshop';
  templateData: WorkshopTemplateData;
  settings: WorkshopTemplateSettings;
}

export interface QuestionnaireTemplate extends BaseTemplate {
  type: 'questionnaire';
  templateData: QuestionnaireTemplateData;
  settings: QuestionnaireTemplateSettings;
}

export type Template = WorkshopTemplate | QuestionnaireTemplate;

export interface WorkshopTemplateData {
  sessions: WorkshopSession[];
  activities: WorkshopActivity[];
  resources: WorkshopResource[];
  schedule: WorkshopSchedule;
  evaluation: WorkshopEvaluation;
  followUp: WorkshopFollowUp;
}

export interface WorkshopSession {
  id: string;
  title: { pl: string; en: string };
  description?: { pl: string; en: string };
  duration: number; // in minutes
  order: number;
  activities: string[]; // Activity IDs
  materials: string[]; // Material IDs
  objectives: string[];
  methods: string[];
  notes?: string;
}

export interface WorkshopActivity {
  id: string;
  name: { pl: string; en: string };
  type: ActivityType;
  description: { pl: string; en: string };
  duration: number; // in minutes
  groupSize: GroupSize;
  instructions: { pl: string; en: string };
  materials: string[];
  preparation?: { pl: string; en: string };
  variations?: ActivityVariation[];
  debriefing?: { pl: string; en: string };
  order: number;
}

export interface WorkshopResource {
  id: string;
  name: { pl: string; en: string };
  type: ResourceType;
  url?: string;
  content?: string;
  description?: { pl: string; en: string };
  required: boolean;
  downloadable: boolean;
  order: number;
}

export interface WorkshopSchedule {
  totalDuration: number; // in minutes
  breaks: ScheduleBreak[];
  flexibility: number; // percentage of flexible time
  adaptationOptions: string[];
}

export interface ScheduleBreak {
  id: string;
  title: { pl: string; en: string };
  duration: number; // in minutes
  type: 'coffee' | 'lunch' | 'short' | 'long';
  optional: boolean;
  afterSession?: string; // session ID
}

export interface WorkshopEvaluation {
  methods: EvaluationMethod[];
  criteria: EvaluationCriteria[];
  feedback: FeedbackMethod[];
  certificates: boolean;
}

export interface EvaluationMethod {
  type:
    | 'observation'
    | 'self-assessment'
    | 'peer-review'
    | 'test'
    | 'presentation';
  description: { pl: string; en: string };
  weight: number; // percentage
  optional: boolean;
}

export interface EvaluationCriteria {
  name: { pl: string; en: string };
  description?: { pl: string; en: string };
  levels: CriterionLevel[];
}

export interface CriterionLevel {
  level: number;
  name: { pl: string; en: string };
  description: { pl: string; en: string };
}

export interface FeedbackMethod {
  type: 'written' | 'verbal' | 'rating' | 'discussion';
  timing: 'during' | 'after' | 'delayed';
  anonymous: boolean;
  structured: boolean;
}

export interface WorkshopFollowUp {
  recommendations: FollowUpRecommendation[];
  resources: FollowUpResource[];
  nextSteps: string[];
  evaluationDelay: number; // days after workshop
}

export interface FollowUpRecommendation {
  category: 'reading' | 'practice' | 'observation' | 'application';
  description: { pl: string; en: string };
  priority: 'high' | 'medium' | 'low';
  timeframe: string;
}

export interface FollowUpResource {
  title: { pl: string; en: string };
  type: 'book' | 'article' | 'video' | 'tool' | 'template';
  url?: string;
  description?: { pl: string; en: string };
}

export interface QuestionnaireTemplateData {
  sections: QuestionnaireSection[];
  settings: QuestionnaireDataSettings;
  variables: TemplateVariable[];
  logic: QuestionnaireLogic;
  scoring?: QuestionnaireScoring;
}

export interface QuestionnaireSection {
  id: string;
  title: { pl: string; en: string };
  description?: { pl: string; en: string };
  order: number;
  questions: QuestionnaireQuestion[];
  conditional?: ConditionalLogic;
  uiConfig: SectionUIConfig;
}

export interface QuestionnaireQuestion {
  id: string;
  text: { pl: string; en: string };
  type: QuestionType;
  options?: QuestionOption[];
  validation: QuestionValidation;
  conditional?: ConditionalLogic;
  helpText?: { pl: string; en: string };
  placeholder?: { pl: string; en: string };
  order: number;
  metadata: QuestionMetadata;
}

export interface QuestionOption {
  value: string;
  label: { pl: string; en: string };
  description?: { pl: string; en: string };
  score?: number;
  order: number;
}

export interface QuestionValidation {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customValidation?: string;
}

export interface ConditionalLogic {
  showIf: ConditionalRule[];
  hideIf?: ConditionalRule[];
  enableIf?: ConditionalRule[];
}

export interface ConditionalRule {
  questionId: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'is_empty'
    | 'is_not_empty';
  value: any;
  logicalOperator?: 'and' | 'or';
}

export interface SectionUIConfig {
  collapsible: boolean;
  defaultCollapsed: boolean;
  showProgress: boolean;
  icon?: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface QuestionnaireDataSettings {
  anonymous: boolean;
  allowSave: boolean;
  allowEdit: boolean;
  showProgress: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  timeLimit?: number; // in minutes
  pageBreak: boolean;
  showQuestionNumbers: boolean;
}

export interface QuestionnaireLogic {
  skipLogic: ConditionalLogic[];
  branching: BranchingRule[];
  calculations: CalculationRule[];
  customActions: CustomAction[];
}

export interface BranchingRule {
  id: string;
  name: { pl: string; en: string };
  conditions: ConditionalRule[];
  target: string; // section ID or end
}

export interface CalculationRule {
  id: string;
  name: { pl: string; en: string };
  formula: string;
  targetVariable: string;
  description?: { pl: string; en: string };
}

export interface CustomAction {
  id: string;
  trigger: 'submit' | 'save' | 'question_change' | 'section_complete';
  action: 'send_email' | 'webhook' | 'calculate' | 'redirect' | 'custom';
  parameters: Record<string, any>;
  condition?: ConditionalRule;
}

export interface QuestionnaireScoring {
  enabled: boolean;
  method: 'sum' | 'average' | 'weighted' | 'custom';
  categories: ScoringCategory[];
  passingScore?: number;
  showScore: boolean;
  showResults: boolean;
  certificateThreshold?: number;
}

export interface ScoringCategory {
  id: string;
  name: { pl: string; en: string };
  description?: { pl: string; en: string };
  questions: string[]; // question IDs
  weight: number;
  minScore?: number;
  maxScore?: number;
}

export interface TemplateVariable {
  id: string;
  name: string;
  type: VariableType;
  defaultValue?: any;
  description?: { pl: string; en: string };
  required: boolean;
  options?: VariableOption[];
  validation?: VariableValidation;
}

export interface VariableOption {
  value: any;
  label: { pl: string; en: string };
}

export interface VariableValidation {
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'url';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface WorkshopTemplateSettings {
  maxParticipants: number;
  minParticipants: number;
  facilitatorCount: number;
  roomRequirements: string[];
  equipment: string[];
  flexibility: number; // percentage
  adaptation: AdaptationSettings;
  languages: string[];
  accessibility: AccessibilitySettings;
}

export interface QuestionnaireTemplateSettings {
  responseRetention: number; // days
  anonymousResponses: boolean;
  emailNotifications: boolean;
  dataAnalysis: boolean;
  exportFormats: ExportFormat[];
  integration: IntegrationSettings;
  privacy: PrivacySettings;
}

export interface AdaptationSettings {
  allowDurationChanges: boolean;
  allowActivityModifications: boolean;
  allowGroupSizeChanges: boolean;
  customContentEnabled: boolean;
  levelAdaptation: boolean;
}

export interface AccessibilitySettings {
  wheelchairAccessible: boolean;
  visualAids: boolean;
  hearingAssistance: boolean;
  cognitiveSupport: boolean;
  languageSupport: string[];
  customAccommodations: string[];
}

export interface ExportFormat {
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'xml';
  enabled: boolean;
  options: Record<string, any>;
}

export interface IntegrationSettings {
  googleDrive: boolean;
  dropbox: boolean;
  slack: boolean;
  teams: boolean;
  webhook: boolean;
  api: boolean;
}

export interface PrivacySettings {
  gdprCompliant: boolean;
  dataEncryption: boolean;
  anonymization: boolean;
  retentionPolicy: number; // days
  dataProcessing: { pl: string; en: string };
}

export interface TemplateMetadata {
  version: string;
  changelog: string[];
  source: 'official' | 'community' | 'custom' | 'imported';
  license: TemplateLicense;
  attribution?: string;
  lastModified: Date;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'needs_review';
  reviewNotes?: string;
  tags: MetadataTag[];
  analytics: TemplateAnalytics;
}

export interface TemplateAnalytics {
  views: number;
  downloads: number;
  uses: number;
  averageRating: number;
  feedbackCount: number;
  lastUsed?: Date;
  completionRate: number;
  averageTime: number; // in minutes
  popularityScore: number;
  demographics: {
    regions: Record<string, number>;
    roles: Record<string, number>;
    organizations: Record<string, number>;
  };
}

export interface MetadataTag {
  key: string;
  value: string;
  weight: number;
}

// Enums and Utility Types
export type TemplateCategory =
  | 'team-building'
  | 'conflict-resolution'
  | 'icebreakers'
  | 'communication'
  | 'leadership'
  | 'problem-solving'
  | 'decision-making'
  | 'creativity'
  | 'time-management'
  | 'stress-management'
  | 'diversity-inclusion'
  | 'feedback'
  | 'goal-setting'
  | 'change-management'
  | 'trust-building'
  | 'collaboration'
  | 'negotiation'
  | 'presentation-skills'
  | 'emotional-intelligence'
  | 'critical-thinking'
  | 'custom';

export type TemplateType = 'workshop' | 'questionnaire';

export type TemplateStatus =
  | 'draft'
  | 'review'
  | 'published'
  | 'archived'
  | 'deprecated';

export type TemplateDifficulty =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

export type ActivityType =
  | 'icebreaker'
  | 'discussion'
  | 'exercise'
  | 'role-play'
  | 'presentation'
  | 'brainstorming'
  | 'problem-solving'
  | 'reflection'
  | 'assessment'
  | 'team-building'
  | 'case-study'
  | 'simulation'
  | 'game'
  | 'creative'
  | 'outdoor';

export type GroupSize =
  | { type: 'individual' }
  | { type: 'pairs' }
  | { type: 'small'; min: number; max: number }
  | { type: 'large'; min: number; max: number }
  | { type: 'whole' };

export type ResourceType =
  | 'document'
  | 'presentation'
  | 'video'
  | 'audio'
  | 'image'
  | 'link'
  | 'template'
  | 'tool'
  | 'checklist'
  | 'guide';

export type QuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'url'
  | 'phone'
  | 'date'
  | 'time'
  | 'rating'
  | 'scale'
  | 'likert'
  | 'single-choice'
  | 'multiple-choice'
  | 'dropdown'
  | 'checkbox'
  | 'file'
  | 'image'
  | 'signature';

export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'time'
  | 'email'
  | 'url'
  | 'array'
  | 'object';

export type TemplateLicense =
  | 'cc0'
  | 'cc-by'
  | 'cc-by-sa'
  | 'cc-by-nd'
  | 'cc-by-nc'
  | 'cc-by-nc-sa'
  | 'cc-by-nc-nd'
  | 'proprietary'
  | 'custom';

export interface ActivityVariation {
  name: { pl: string; en: string };
  description: { pl: string; en: string };
  duration?: number;
  groupSize?: GroupSize;
  materials: string[];
}

export interface QuestionMetadata {
  category?: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  estimatedTime?: number; // seconds
  explanation?: { pl: string; en: string };
  references?: string[];
}

export interface TemplateAuthor {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  organization?: string;
  website?: string;
  expertise: string[];
}

export interface TemplateMaterial {
  id: string;
  name: { pl: string; en: string };
  type: ResourceType;
  description?: { pl: string; en: string };
  url?: string;
  downloadable: boolean;
  required: boolean;
  order: number;
}

export interface TemplateReview {
  id: string;
  templateId: string;
  reviewerId: number;
  reviewer: string;
  rating: number;
  comment: string;
  approved: boolean;
  createdAt: Date;
  helpful: number;
}

export interface TemplateComment {
  id: string;
  templateId: string;
  authorId: number;
  author: string;
  content: string;
  parentId?: string; // for replies
  createdAt: Date;
  updatedAt: Date;
  resolved: boolean;
}

export interface TemplateFilter {
  category?: TemplateCategory[];
  type?: TemplateType[];
  status?: TemplateStatus[];
  difficulty?: TemplateDifficulty[];
  duration?: {
    min: number;
    max: number;
  };
  rating?: {
    min: number;
  };
  language?: ('pl' | 'en' | 'both')[];
  tags?: string[];
  featured?: boolean;
  creator?: number[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface TemplateSearch {
  query: string;
  filters?: TemplateFilter;
  sort: SearchSort;
  page: number;
  limit: number;
}

export type SearchSort =
  | 'relevance'
  | 'newest'
  | 'oldest'
  | 'rating'
  | 'popularity'
  | 'usage'
  | 'name'
  | 'updated';

export interface TemplateSearchResult {
  templates: Template[];
  total: number;
  page: number;
  limit: number;
  facets: SearchFacets;
  suggestions?: string[];
}

export interface SearchFacets {
  categories: Record<TemplateCategory, number>;
  types: Record<TemplateType, number>;
  difficulties: Record<TemplateDifficulty, number>;
  ratings: Record<string, number>;
  tags: Record<string, number>;
}

export interface TemplateUsage {
  id: string;
  templateId: string;
  userId: number;
  workshopId?: string;
  questionnaireId?: string;
  context: 'workshop' | 'questionnaire' | 'preview' | 'test';
  adaptations: TemplateAdaptation[];
  feedback?: string;
  rating?: number;
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in minutes
}

export interface TemplateAdaptation {
  field: string;
  originalValue: any;
  newValue: any;
  reason?: string;
}

export interface TemplateShare {
  id: string;
  templateId: string;
  sharedBy: number;
  sharedWith?: number; // specific user, null for public
  shareType: 'public' | 'organization' | 'team' | 'user';
  permissions: SharePermissions;
  expiresAt?: Date;
  shareToken?: string;
  createdAt: Date;
  lastAccessed?: Date;
  accessCount: number;
}

export interface SharePermissions {
  canView: boolean;
  canCopy: boolean;
  canEdit: boolean;
  canShare: boolean;
  canDownload: boolean;
  canComment: boolean;
}

export interface TemplateCollection {
  id: string;
  name: { pl: string; en: string };
  description?: { pl: string; en: string };
  owner: number;
  templates: string[];
  isPublic: boolean;
  collaborators: CollectionCollaborator[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionCollaborator {
  userId: number;
  role: 'viewer' | 'editor' | 'owner';
  joinedAt: Date;
}
