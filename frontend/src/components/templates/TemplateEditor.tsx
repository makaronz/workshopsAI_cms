/**
 * TemplateEditor - Advanced Template Builder
 * Comprehensive template editor for workshops and questionnaires
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  BookmarkIcon,
  Cog6ToothIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  ArrowsUpDownIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ChartBarIcon,
  FolderIcon,
  TagIcon,
  GlobeAltIcon,
  LanguageIcon,
  ShieldCheckIcon,
  CalculatorIcon,
  ArrowPathIcon,
  PlayIcon,
  PauseIcon,
  Square2StackIcon,
  LinkIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  DocumentIcon,
  CodeBracketIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { templateService } from '../../../src/services/templateService';
import {
  Template,
  WorkshopTemplate,
  QuestionnaireTemplate,
  TemplateType,
  TemplateCategory,
  TemplateDifficulty,
  WorkshopSession,
  WorkshopActivity,
  QuestionnaireSection,
  QuestionnaireQuestion,
  QuestionType,
  ConditionalLogic,
  TemplateVariable,
  SearchSort,
} from '../../../src/types/template';

interface TemplateEditorProps {
  template?: Template;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSave: () => void;
  className?: string;
}

type EditorTab = 'basic' | 'content' | 'settings' | 'preview' | 'variables' | 'logic';
type EditorView = 'form' | 'visual' | 'code';

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  mode,
  onClose,
  onSave,
  className = '',
}) => {
  // State Management
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(template || null);
  const [activeTab, setActiveTab] = useState<EditorTab>('basic');
  const [editorView, setEditorView] = useState<EditorView>('form');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showPreview, setShowPreview] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | 'warning'>('valid');

  // Form state
  const [formData, setFormData] = useState({
    title: { pl: '', en: '' },
    description: { pl: '', en: '' },
    category: 'team-building' as TemplateCategory,
    type: 'workshop' as TemplateType,
    difficulty: 'beginner' as TemplateDifficulty,
    language: 'both' as 'pl' | 'en' | 'both',
    tags: [] as string[],
    featured: false,
    estimatedDuration: 60,
    targetAudience: [] as string[],
    prerequisites: [] as string[],
    learningObjectives: [] as string[],
    imageUrl: '',
    settings: {},
  });

  // Initialize form data from template
  useEffect(() => {
    if (template) {
      setFormData({
        title: template.title,
        description: template.description || { pl: '', en: '' },
        category: template.category,
        type: template.type,
        difficulty: template.difficulty,
        language: template.language,
        tags: template.tags,
        featured: template.featured,
        estimatedDuration: template.estimatedDuration,
        targetAudience: template.targetAudience,
        prerequisites: template.prerequisites,
        learningObjectives: template.learningObjectives,
        imageUrl: template.imageUrl || '',
        settings: (template as any).settings || {},
      });
    }
  }, [template]);

  // Autosave effect
  useEffect(() => {
    if (!hasUnsavedChanges || mode === 'create') return;

    const timer = setTimeout(() => {
      handleAutoSave();
    }, 2000); // Auto-save after 2 seconds

    return () => clearTimeout(timer);
  }, [formData, hasUnsavedChanges]);

  // Form validation
  useEffect(() => {
    validateTemplate();
  }, [formData]);

  // Content-specific state
  const [workshopContent, setWorkshopContent] = useState({
    sessions: [] as WorkshopSession[],
    activities: [] as WorkshopActivity[],
    resources: [] as any[],
    schedule: {
      totalDuration: 60,
      breaks: [],
      flexibility: 10,
      adaptationOptions: [],
    },
  });

  const [questionnaireContent, setQuestionnaireContent] = useState({
    sections: [] as QuestionnaireSection[],
    settings: {
      anonymous: false,
      allowSave: true,
      allowEdit: true,
      showProgress: true,
      randomizeQuestions: false,
      randomizeOptions: false,
      timeLimit: null,
      pageBreak: false,
      showQuestionNumbers: true,
    },
    variables: [] as TemplateVariable[],
    logic: {
      skipLogic: [],
      branching: [],
      calculations: [],
      customActions: [],
    },
    scoring: {
      enabled: false,
      method: 'sum',
      categories: [],
      passingScore: null,
      showScore: true,
      showResults: true,
      certificateThreshold: null,
    },
  });

  // Form handlers
  const updateFormData = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    clearFieldErrors(field);
  }, []);

  const updateNestedFormData = useCallback((path: string, value: any) => {
    setFormData(prev => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return updated;
    });
    setHasUnsavedChanges(true);
  }, []);

  // Validation
  const validateTemplate = useCallback(() => {
    const newErrors: Record<string, string[]> = {};
    const newWarnings: string[] = [];

    // Basic validation
    if (!formData.title.pl.trim()) {
      newErrors.title = ['Polish title is required'];
    }
    if (!formData.title.en.trim()) {
      newErrors.title = [...(newErrors.title || []), 'English title is required'];
    }

    if (formData.estimatedDuration < 5) {
      newErrors.estimatedDuration = ['Duration must be at least 5 minutes'];
    }
    if (formData.estimatedDuration > 480) {
      newErrors.estimatedDuration = [...(newErrors.estimatedDuration || []), 'Duration cannot exceed 8 hours'];
    }

    // Content-specific validation
    if (formData.type === 'workshop') {
      if (workshopContent.sessions.length === 0) {
        newErrors.sessions = ['At least one session is required'];
      }
    } else if (formData.type === 'questionnaire') {
      if (questionnaireContent.sections.length === 0) {
        newErrors.sections = ['At least one section is required'];
      }

      let totalQuestions = 0;
      questionnaireContent.sections.forEach(section => {
        totalQuestions += section.questions.length;
      });

      if (totalQuestions === 0) {
        newErrors.questions = ['At least one question is required'];
      }
    }

    // Warnings
    if (!formData.description.pl.trim()) {
      newWarnings.push('Polish description is recommended');
    }
    if (!formData.description.en.trim()) {
      newWarnings.push('English description is recommended');
    }
    if (formData.tags.length === 0) {
      newWarnings.push('Adding tags will improve template discoverability');
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
    setValidationStatus(
      Object.keys(newErrors).length > 0 ? 'invalid' :
      newWarnings.length > 0 ? 'warning' : 'valid'
    );

    return Object.keys(newErrors).length === 0;
  }, [formData, workshopContent, questionnaireContent]);

  const clearFieldErrors = useCallback((field: string) => {
    setErrors(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }, []);

  // Save operations
  const handleSave = useCallback(async () => {
    if (!validateTemplate()) {
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        ...formData,
        templateData: formData.type === 'workshop' ? workshopContent : questionnaireContent,
        settings: formData.settings,
      };

      let savedTemplate;
      if (mode === 'create') {
        if (formData.type === 'workshop') {
          savedTemplate = await templateService.createWorkshopTemplate(templateData as any);
        } else {
          savedTemplate = await templateService.createQuestionnaireTemplate(templateData as any);
        }
      } else {
        savedTemplate = await templateService.updateTemplate(currentTemplate!.id, templateData);
      }

      setCurrentTemplate(savedTemplate);
      setHasUnsavedChanges(false);
      onSave();
    } catch (error) {
      console.error('Failed to save template:', error);
      // Show error notification
    } finally {
      setSaving(false);
    }
  }, [formData, workshopContent, questionnaireContent, mode, currentTemplate, validateTemplate, onSave]);

  const handleAutoSave = useCallback(async () => {
    if (mode === 'create') return; // Don't auto-save new templates

    setAutosaveStatus('saving');
    try {
      await templateService.updateTemplate(currentTemplate!.id, {
        ...formData,
        templateData: formData.type === 'workshop' ? workshopContent : questionnaireContent,
      });
      setAutosaveStatus('saved');
      setTimeout(() => setAutosaveStatus('idle'), 2000);
    } catch (error) {
      setAutosaveStatus('error');
      console.error('Auto-save failed:', error);
    }
  }, [formData, workshopContent, questionnaireContent, mode, currentTemplate]);

  // Content handlers
  const addWorkshopSession = useCallback(() => {
    const newSession: WorkshopSession = {
      id: `session_${Date.now()}`,
      title: { pl: 'Nowa Sesja', en: 'New Session' },
      description: { pl: '', en: '' },
      duration: 60,
      order: workshopContent.sessions.length,
      activities: [],
      materials: [],
      objectives: [],
      methods: [],
      notes: '',
    };
    setWorkshopContent(prev => ({
      ...prev,
      sessions: [...prev.sessions, newSession],
    }));
    setHasUnsavedChanges(true);
  }, [workshopContent.sessions.length]);

  const addQuestionnaireSection = useCallback(() => {
    const newSection: QuestionnaireSection = {
      id: `section_${Date.now()}`,
      title: { pl: 'Nowa Sekcja', en: 'New Section' },
      description: { pl: '', en: '' },
      order: questionnaireContent.sections.length,
      questions: [],
      uiConfig: {
        collapsible: false,
        defaultCollapsed: false,
        showProgress: true,
        icon: null,
      },
    };
    setQuestionnaireContent(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setHasUnsavedChanges(true);
  }, [questionnaireContent.sections.length]);

  // Render components
  const renderBasicInfo = useCallback(() => (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Template Title</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Polish</label>
            <input
              type="text"
              value={formData.title.pl}
              onChange={(e) => updateFormData('title', { ...formData.title, pl: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Wpisz tytuł szablonu..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">English</label>
            <input
              type="text"
              value={formData.title.en}
              onChange={(e) => updateFormData('title', { ...formData.title, en: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter template title..."
            />
          </div>
        </div>
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.join(', ')}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Polish</label>
            <textarea
              value={formData.description.pl}
              onChange={(e) => updateFormData('description', { ...formData.description, pl: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Opisz szablon..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">English</label>
            <textarea
              value={formData.description.en}
              onChange={(e) => updateFormData('description', { ...formData.description, en: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the template..."
            />
          </div>
        </div>
      </div>

      {/* Basic Properties */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
          <select
            value={formData.type}
            onChange={(e) => updateFormData('type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="workshop">Workshop</option>
            <option value="questionnaire">Questionnaire</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={formData.category}
            onChange={(e) => updateFormData('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="team-building">Team Building</option>
            <option value="conflict-resolution">Conflict Resolution</option>
            <option value="icebreakers">Icebreakers</option>
            <option value="communication">Communication</option>
            <option value="leadership">Leadership</option>
            <option value="problem-solving">Problem Solving</option>
            <option value="decision-making">Decision Making</option>
            <option value="creativity">Creativity</option>
            <option value="time-management">Time Management</option>
            <option value="stress-management">Stress Management</option>
            <option value="diversity-inclusion">Diversity & Inclusion</option>
            <option value="feedback">Feedback</option>
            <option value="goal-setting">Goal Setting</option>
            <option value="change-management">Change Management</option>
            <option value="trust-building">Trust Building</option>
            <option value="collaboration">Collaboration</option>
            <option value="negotiation">Negotiation</option>
            <option value="presentation-skills">Presentation Skills</option>
            <option value="emotional-intelligence">Emotional Intelligence</option>
            <option value="critical-thinking">Critical Thinking</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
          <select
            value={formData.difficulty}
            onChange={(e) => updateFormData('difficulty', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
          <input
            type="number"
            value={formData.estimatedDuration}
            onChange={(e) => updateFormData('estimatedDuration', parseInt(e.target.value))}
            min="5"
            max="480"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.estimatedDuration ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.estimatedDuration && (
            <p className="mt-1 text-sm text-red-600">{errors.estimatedDuration.join(', ')}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
          <select
            value={formData.language}
            onChange={(e) => updateFormData('language', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="pl">Polish</option>
            <option value="en">English</option>
            <option value="both">Both</option>
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="featured"
            checked={formData.featured}
            onChange={(e) => updateFormData('featured', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="featured" className="ml-2 text-sm text-gray-700">
            Featured template
          </label>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
        <TagInput
          value={formData.tags}
          onChange={(tags) => updateFormData('tags', tags)}
          placeholder="Add tags to improve discoverability..."
        />
      </div>

      {/* Image URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Template Image URL</label>
        <input
          type="url"
          value={formData.imageUrl}
          onChange={(e) => updateFormData('imageUrl', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://example.com/image.jpg"
        />
      </div>

      {/* Learning Objectives */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Learning Objectives</label>
        <EditableList
          value={formData.learningObjectives}
          onChange={(objectives) => updateFormData('learningObjectives', objectives)}
          placeholder="Add learning objective..."
        />
      </div>

      {/* Target Audience */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
        <EditableList
          value={formData.targetAudience}
          onChange={(audience) => updateFormData('targetAudience', audience)}
          placeholder="Add target audience..."
        />
      </div>

      {/* Prerequisites */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Prerequisites</label>
        <EditableList
          value={formData.prerequisites}
          onChange={(prerequisites) => updateFormData('prerequisites', prerequisites)}
          placeholder="Add prerequisite..."
        />
      </div>
    </div>
  ), [formData, errors, updateFormData]);

  const renderWorkshopContent = useCallback(() => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Workshop Sessions</h3>
        <button
          onClick={addWorkshopSession}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5" />
          Add Session
        </button>
      </div>

      {workshopContent.sessions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <AcademicCapIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h4>
          <p className="text-gray-600 mb-4">Start building your workshop by adding sessions</p>
          <button
            onClick={addWorkshopSession}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Your First Session
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {workshopContent.sessions.map((session, index) => (
            <WorkshopSessionEditor
              key={session.id}
              session={session}
              index={index}
              onUpdate={(updatedSession) => {
                setWorkshopContent(prev => ({
                  ...prev,
                  sessions: prev.sessions.map(s => s.id === session.id ? updatedSession : s),
                }));
                setHasUnsavedChanges(true);
              }}
              onDelete={() => {
                setWorkshopContent(prev => ({
                  ...prev,
                  sessions: prev.sessions.filter(s => s.id !== session.id),
                }));
                setHasUnsavedChanges(true);
              }}
              onDuplicate={() => {
                const duplicated: WorkshopSession = {
                  ...session,
                  id: `session_${Date.now()}`,
                  title: {
                    pl: `${session.title.pl} (Copy)`,
                    en: `${session.title.en} (Copy)`,
                  },
                };
                setWorkshopContent(prev => ({
                  ...prev,
                  sessions: [...prev.sessions.slice(0, index + 1), duplicated, ...prev.sessions.slice(index + 1)],
                }));
                setHasUnsavedChanges(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  ), [workshopContent.sessions, addWorkshopSession]);

  const renderQuestionnaireContent = useCallback(() => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Questionnaire Sections</h3>
        <button
          onClick={addQuestionnaireSection}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5" />
          Add Section
        </button>
      </div>

      {questionnaireContent.sections.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No sections yet</h4>
          <p className="text-gray-600 mb-4">Start building your questionnaire by adding sections</p>
          <button
            onClick={addQuestionnaireSection}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Your First Section
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {questionnaireContent.sections.map((section, index) => (
            <QuestionnaireSectionEditor
              key={section.id}
              section={section}
              index={index}
              onUpdate={(updatedSection) => {
                setQuestionnaireContent(prev => ({
                  ...prev,
                  sections: prev.sections.map(s => s.id === section.id ? updatedSection : s),
                }));
                setHasUnsavedChanges(true);
              }}
              onDelete={() => {
                setQuestionnaireContent(prev => ({
                  ...prev,
                  sections: prev.sections.filter(s => s.id !== section.id),
                }));
                setHasUnsavedChanges(true);
              }}
              onDuplicate={() => {
                const duplicated: QuestionnaireSection = {
                  ...section,
                  id: `section_${Date.now()}`,
                  title: {
                    pl: `${section.title.pl} (Copy)`,
                    en: `${section.title.en} (Copy)`,
                  },
                };
                setQuestionnaireContent(prev => ({
                  ...prev,
                  sections: [...prev.sections.slice(0, index + 1), duplicated, ...prev.sections.slice(index + 1)],
                }));
                setHasUnsavedChanges(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  ), [questionnaireContent.sections, addQuestionnaireSection]);

  const renderPreview = useCallback(() => {
    if (!currentTemplate && !formData.title.pl) {
      return (
        <div className="text-center py-12">
          <EyeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Preview not available</h3>
          <p className="text-gray-600">Add content to see a preview of your template</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {formData.title.pl || 'Untitled Template'}
          </h2>
          <p className="text-gray-600 mb-4">
            {formData.description.pl || 'No description provided'}
          </p>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              formData.type === 'workshop'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {formData.type}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800`}>
              {formData.difficulty}
            </span>
            <span className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              {formData.estimatedDuration} minutes
            </span>
            <span className="flex items-center gap-1">
              <LanguageIcon className="w-4 h-4" />
              {formData.language.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="p-6">
          {formData.type === 'workshop' ? (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Workshop Sessions</h3>
              {workshopContent.sessions.length > 0 ? (
                <div className="space-y-4">
                  {workshopContent.sessions.map((session, index) => (
                    <div key={session.id} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">
                          Session {index + 1}: {session.title.pl}
                        </h4>
                        <span className="text-sm text-gray-500">{session.duration} min</span>
                      </div>
                      {session.description.pl && (
                        <p className="text-gray-600 text-sm">{session.description.pl}</p>
                      )}
                      {session.objectives.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm font-medium text-gray-700 mb-1">Objectives:</h5>
                          <ul className="list-disc list-inside text-sm text-gray-600">
                            {session.objectives.map((objective, i) => (
                              <li key={i}>{objective}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No sessions added yet</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Questionnaire Sections</h3>
              {questionnaireContent.sections.length > 0 ? (
                <div className="space-y-4">
                  {questionnaireContent.sections.map((section, index) => (
                    <div key={section.id} className="border-l-4 border-green-500 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">
                          Section {index + 1}: {section.title.pl}
                        </h4>
                        <span className="text-sm text-gray-500">{section.questions.length} questions</span>
                      </div>
                      {section.description.pl && (
                        <p className="text-gray-600 text-sm mb-2">{section.description.pl}</p>
                      )}
                      {section.questions.length > 0 && (
                        <div className="space-y-2">
                          {section.questions.slice(0, 3).map((question, i) => (
                            <div key={question.id} className="text-sm text-gray-600 pl-4">
                              {i + 1}. {question.text.pl}
                              <span className="ml-2 text-xs text-gray-400">({question.type})</span>
                            </div>
                          ))}
                          {section.questions.length > 3 && (
                            <div className="text-sm text-gray-400 pl-4">
                              ... and {section.questions.length - 3} more questions
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No sections added yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, [currentTemplate, formData, workshopContent, questionnaireContent]);

  return (
    <div className={`template-editor ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {mode === 'create' ? 'Create Template' : 'Edit Template'}
                </h1>
                <p className="text-sm text-gray-600">
                  {formData.type === 'workshop' ? 'Workshop Template' : 'Questionnaire Template'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Autosave status */}
              {mode === 'edit' && (
                <div className="flex items-center gap-2">
                  {autosaveStatus === 'saving' && (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-gray-600">Saving...</span>
                    </>
                  )}
                  {autosaveStatus === 'saved' && (
                    <>
                      <CheckIcon className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600">Saved</span>
                    </>
                  )}
                  {autosaveStatus === 'error' && (
                    <>
                      <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-600">Save failed</span>
                    </>
                  )}
                </div>
              )}

              {/* View mode switcher */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setEditorView('form')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    editorView === 'form'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Form
                </button>
                <button
                  onClick={() => setEditorView('visual')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    editorView === 'visual'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Visual
                </button>
                <button
                  onClick={() => setEditorView('code')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    editorView === 'code'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Code
                </button>
              </div>

              {/* Actions */}
              <button
                onClick={handleSave}
                disabled={saving || validationStatus === 'invalid'}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    {mode === 'create' ? 'Create' : 'Save'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation status */}
          {warnings.length > 0 && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <InformationCircleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-yellow-800">
                  {warnings.length} warning{warnings.length > 1 ? 's' : ''}. Review before saving.
                </p>
              </div>
            </div>
          )}

          {validationStatus === 'invalid' && Object.keys(errors).length > 0 && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-800">
                  Please fix {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? 's' : ''} before saving.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex space-x-8">
            {[
              { id: 'basic', label: 'Basic Info', icon: DocumentTextIcon },
              { id: 'content', label: 'Content', icon: FolderIcon },
              { id: 'settings', label: 'Settings', icon: Cog6ToothIcon },
              { id: 'preview', label: 'Preview', icon: EyeIcon },
              { id: 'variables', label: 'Variables', icon: CalculatorIcon, show: formData.type === 'questionnaire' },
              { id: 'logic', label: 'Logic', icon: CpuChipIcon, show: formData.type === 'questionnaire' },
            ].filter(tab => tab.show !== false).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as EditorTab)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {activeTab === 'basic' && renderBasicInfo()}
          {activeTab === 'content' && formData.type === 'workshop' && renderWorkshopContent()}
          {activeTab === 'content' && formData.type === 'questionnaire' && renderQuestionnaireContent()}
          {activeTab === 'settings' && <TemplateSettingsEditor formData={formData} onChange={updateFormData} />}
          {activeTab === 'preview' && renderPreview()}
          {activeTab === 'variables' && formData.type === 'questionnaire' && (
            <TemplateVariablesEditor
              variables={questionnaireContent.variables}
              onChange={(variables) => setQuestionnaireContent(prev => ({ ...prev, variables }))}
            />
          )}
          {activeTab === 'logic' && formData.type === 'questionnaire' && (
            <TemplateLogicEditor
              logic={questionnaireContent.logic}
              onChange={(logic) => setQuestionnaireContent(prev => ({ ...prev, logic }))}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Helper components
const TagInput: React.FC<{
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = inputValue.trim();
      if (tag && !value.includes(tag)) {
        onChange([...value, tag]);
        setInputValue('');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      {value.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="hover:text-blue-900"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 min-w-0 px-1 py-1 border-none outline-none text-sm"
      />
    </div>
  );
};

const EditableList: React.FC<{
  value: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    const item = newItem.trim();
    if (item) {
      onChange([...value, item]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, item: string) => {
    const updated = [...value];
    updated[index] = item;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => removeItem(index)}
            className="p-2 text-red-600 hover:text-red-800"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={addItem}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// Placeholder components for specialized editors
const WorkshopSessionEditor: React.FC<{
  session: WorkshopSession;
  index: number;
  onUpdate: (session: WorkshopSession) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ session, index, onUpdate, onDelete, onDuplicate }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900">
          Session {index + 1}: {session.title.pl}
        </h4>
        <div className="flex items-center gap-2">
          <button
            onClick={onDuplicate}
            className="p-2 text-gray-400 hover:text-purple-500"
            title="Duplicate session"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-500"
            title="Delete session"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Session editor content would go here */}
      <div className="text-gray-500 italic">Session editor content placeholder</div>
    </div>
  );
};

const QuestionnaireSectionEditor: React.FC<{
  section: QuestionnaireSection;
  index: number;
  onUpdate: (section: QuestionnaireSection) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ section, index, onUpdate, onDelete, onDuplicate }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900">
          Section {index + 1}: {section.title.pl}
        </h4>
        <div className="flex items-center gap-2">
          <button
            onClick={onDuplicate}
            className="p-2 text-gray-400 hover:text-purple-500"
            title="Duplicate section"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-500"
            title="Delete section"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Section editor content would go here */}
      <div className="text-gray-500 italic">Section editor content placeholder</div>
    </div>
  );
};

const TemplateSettingsEditor: React.FC<{
  formData: any;
  onChange: (field: string, value: any) => void;
}> = ({ formData, onChange }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Settings</h3>
      <div className="text-gray-500 italic">Settings editor content placeholder</div>
    </div>
  );
};

const TemplateVariablesEditor: React.FC<{
  variables: TemplateVariable[];
  onChange: (variables: TemplateVariable[]) => void;
}> = ({ variables, onChange }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Variables</h3>
      <div className="text-gray-500 italic">Variables editor content placeholder</div>
    </div>
  );
};

const TemplateLogicEditor: React.FC<{
  logic: any;
  onChange: (logic: any) => void;
}> = ({ logic, onChange }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Questionnaire Logic</h3>
      <div className="text-gray-500 italic">Logic editor content placeholder</div>
    </div>
  );
};

export default TemplateEditor;