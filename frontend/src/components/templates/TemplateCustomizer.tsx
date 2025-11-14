/**
 * TemplateCustomizer - Template Personalization
 * Advanced template customization and adaptation interface
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ChartBarIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  BookmarkIcon,
  ShareIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  TagIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  CalculatorIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
} from '@heroicons/react/24/outline';
import { templateService } from '../../../src/services/templateService';
import {
  Template,
  WorkshopTemplate,
  QuestionnaireTemplate,
  TemplateType,
  TemplateDifficulty,
  WorkshopSession,
  WorkshopActivity,
  QuestionnaireSection,
  QuestionnaireQuestion,
  TemplateVariable,
  ConditionalLogic,
} from '../../../src/types/template';

interface TemplateCustomizerProps {
  template: Template;
  onClose: () => void;
  onApply: () => void;
  className?: string;
}

type CustomizationStep = 'overview' | 'basics' | 'content' | 'timing' | 'participants' | 'advanced' | 'preview';

export const TemplateCustomizer: React.FC<TemplateCustomizerProps> = ({
  template,
  onClose,
  onApply,
  className = '',
}) => {
  // State Management
  const [currentStep, setCurrentStep] = useState<CustomizationStep>('overview');
  const [customizedTemplate, setCustomizedTemplate] = useState<Template>(JSON.parse(JSON.stringify(template)));
  const [changes, setChanges] = useState<Record<string, any>>({});
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  // Customization parameters
  const [targetAudience, setTargetAudience] = useState({
    groupSize: { min: 10, max: 20, current: 15 },
    experienceLevel: 'beginner' as TemplateDifficulty,
    language: 'both' as 'pl' | 'en' | 'both',
    ageGroup: 'adults' as 'children' | 'teens' | 'adults' | 'mixed',
    context: 'corporate' as 'corporate' | 'education' | 'community' | 'therapy',
    setting: 'indoor' as 'indoor' | 'outdoor' | 'virtual' | 'hybrid',
  });

  const [timing, setTiming] = useState({
    totalDuration: customizedTemplate.estimatedDuration,
    sessions: customizedTemplate.type === 'workshop' ?
      (customizedTemplate as WorkshopTemplate).templateData.sessions.length : 1,
    breaksIncluded: true,
    flexibility: 15, // percentage
    timeConstraints: {
      minDuration: 30,
      maxDuration: 480,
      preferredTimes: ['morning', 'afternoon'],
    },
  });

  const [content, setContent] = useState({
    focusAreas: [] as string[],
    customObjectives: [] as string[],
    excludedActivities: [] as string[],
    additionalResources: [] as any[],
    assessmentMethod: 'self-assessment' as string,
    followUpRequired: true,
    customizationLevel: 'basic' as 'basic' | 'moderate' | 'advanced',
  });

  const [advanced, setAdvanced] = useState({
    enableAnalytics: true,
    accessibilityMode: false,
    multilingualSupport: template.language === 'both',
    offlineMode: false,
    integrationRequired: false,
    customBranding: false,
    certification: false,
    automatedReminders: true,
  });

  // Effects
  useEffect(() => {
    generateRecommendations();
    validateCustomization();
  }, [targetAudience, timing, content, advanced]);

  // AI-powered suggestions
  const generateRecommendations = useCallback(async () => {
    const suggestions: string[] = [];

    // Duration recommendations
    if (targetAudience.groupSize.current > 25 && timing.totalDuration < 120) {
      suggestions.push('Consider increasing duration for larger groups to ensure effective participation');
    }

    if (targetAudience.experienceLevel === 'beginner' && content.customizationLevel === 'advanced') {
      suggestions.push('Simplify content complexity for beginner-level participants');
    }

    // Setting recommendations
    if (targetAudience.setting === 'virtual' && !content.focusAreas.includes('engagement')) {
      suggestions.push('Add virtual engagement activities for online delivery');
    }

    // Accessibility recommendations
    if (targetAudience.ageGroup === 'children' && !advanced.accessibilityMode) {
      suggestions.push('Enable accessibility mode for better experience with children');
    }

    // Timing recommendations
    if (timing.sessions > 4 && timing.totalDuration < 180) {
      suggestions.push('Consider adding breaks between sessions for longer workshops');
    }

    // Language recommendations
    if (targetAudience.language === 'both' && !advanced.multilingualSupport) {
      suggestions.push('Enable multilingual support for bilingual delivery');
    }

    setRecommendations(suggestions);
  }, [targetAudience, timing, content, advanced]);

  // Validation
  const validateCustomization = useCallback(() => {
    const errors: Record<string, string[]> = {};

    // Group size validation
    if (targetAudience.groupSize.current < targetAudience.groupSize.min) {
      errors.groupSize = [`Group size cannot be less than ${targetAudience.groupSize.min}`];
    }
    if (targetAudience.groupSize.current > targetAudience.groupSize.max) {
      errors.groupSize = [...(errors.groupSize || []), `Group size cannot exceed ${targetAudience.groupSize.max}`];
    }

    // Duration validation
    if (timing.totalDuration < timing.timeConstraints.minDuration) {
      errors.duration = [`Duration must be at least ${timing.timeConstraints.minDuration} minutes`];
    }
    if (timing.totalDuration > timing.timeConstraints.maxDuration) {
      errors.duration = [...(errors.duration || []), `Duration cannot exceed ${timing.timeConstraints.maxDuration} minutes`];
    }

    // Content validation
    if (content.customObjectives.length === 0 && template.type === 'workshop') {
      errors.objectives = ['At least one learning objective is required'];
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [targetAudience, timing, content, template]);

  // Template customization functions
  const adjustForGroupSize = useCallback(() => {
    const updatedTemplate = { ...customizedTemplate };
    const groupSize = targetAudience.groupSize.current;

    if (template.type === 'workshop') {
      const workshopData = (updatedTemplate as WorkshopTemplate).templateData;

      // Adjust activity group sizes
      workshopData.activities = workshopData.activities.map(activity => ({
        ...activity,
        groupSize: adjustActivityGroupSize(activity.groupSize, groupSize),
      }));

      // Adjust materials quantities
      workshopData.resources = workshopData.resources.map(resource => ({
        ...resource,
        quantity: Math.ceil(resource.quantity * (groupSize / 15)), // Base 15 participants
      }));
    }

    setCustomizedTemplate(updatedTemplate);
    trackChange('groupSize', { original: template.targetAudience, new: targetAudience.groupSize.current });
  }, [customizedTemplate, targetAudience, template]);

  const adjustForDuration = useCallback(() => {
    const updatedTemplate = { ...customizedTemplate };
    const durationRatio = timing.totalDuration / template.estimatedDuration;

    if (template.type === 'workshop') {
      const workshopData = (updatedTemplate as WorkshopTemplate).templateData;

      // Adjust session durations
      workshopData.sessions = workshopData.sessions.map(session => ({
        ...session,
        duration: Math.round(session.duration * durationRatio),
      }));

      // Update total duration
      workshopData.schedule.totalDuration = timing.totalDuration;
    }

    updatedTemplate.estimatedDuration = timing.totalDuration;
    setCustomizedTemplate(updatedTemplate);
    trackChange('duration', { original: template.estimatedDuration, new: timing.totalDuration });
  }, [customizedTemplate, timing, template]);

  const adjustContentFocus = useCallback(() => {
    const updatedTemplate = { ...customizedTemplate };

    // Update learning objectives
    if (content.customObjectives.length > 0) {
      updatedTemplate.learningObjectives = [
        ...template.learningObjectives,
        ...content.customObjectives,
      ];
    }

    // Filter activities based on excluded areas
    if (template.type === 'workshop' && content.excludedActivities.length > 0) {
      const workshopData = (updatedTemplate as WorkshopTemplate).templateData;
      workshopData.activities = workshopData.activities.filter(activity =>
        !content.excludedActivities.includes(activity.name.pl)
      );
    }

    // Add additional resources
    if (content.additionalResources.length > 0) {
      if (template.type === 'workshop') {
        const workshopData = (updatedTemplate as WorkshopTemplate).templateData;
        workshopData.resources = [
          ...workshopData.resources,
          ...content.additionalResources,
        ];
      }
    }

    setCustomizedTemplate(updatedTemplate);
    trackChange('content', { focusAreas: content.focusAreas, exclusions: content.excludedActivities });
  }, [customizedTemplate, content, template]);

  const applyAdvancedSettings = useCallback(() => {
    const updatedTemplate = { ...customizedTemplate };

    // Update language settings
    updatedTemplate.language = targetAudience.language;

    // Update settings based on advanced options
    const settings = { ...updatedTemplate.settings };

    if (template.type === 'questionnaire') {
      const questionnaireData = (updatedTemplate as QuestionnaireTemplate).templateData;

      // Update questionnaire settings
      questionnaireData.settings = {
        ...questionnaireData.settings,
        allowSave: !advanced.offlineMode,
        showProgress: advanced.enableAnalytics,
        pageBreak: timing.sessions > 1,
      };
    }

    updatedTemplate.settings = settings;
    setCustomizedTemplate(updatedTemplate);
    trackChange('advanced', advanced);
  }, [customizedTemplate, targetAudience, advanced, template, timing]);

  const adjustActivityGroupSize = (originalGroupSize: any, targetSize: number): any => {
    // Logic to adjust group sizes based on target group size
    if (typeof originalGroupSize === 'object' && originalGroupSize.type) {
      if (originalGroupSize.type === 'pairs') {
        return targetSize <= 30 ? originalGroupSize : { type: 'small', min: 4, max: 6 };
      } else if (originalGroupSize.type === 'small') {
        return { type: 'small', min: 4, max: Math.ceil(targetSize / 3) };
      } else if (originalGroupSize.type === 'large') {
        return { type: 'large', min: Math.ceil(targetSize / 2), max: targetSize };
      }
    }
    return originalGroupSize;
  };

  const trackChange = (field: string, change: any) => {
    setChanges(prev => ({ ...prev, [field]: change }));
  };

  // Apply customization
  const handleApplyCustomization = useCallback(async () => {
    if (!validateCustomization()) {
      return;
    }

    setApplying(true);
    try {
      // Apply all customizations in sequence
      await adjustForGroupSize();
      await adjustForDuration();
      await adjustContentFocus();
      await applyAdvancedSettings();

      // Save the customized template
      const savedTemplate = await templateService.duplicateTemplate(template.id, {
        pl: `${template.title.pl} (Customized)`,
        en: `${template.title.en} (Customized)`,
      });

      // Apply customizations to the new template
      await templateService.updateTemplate(savedTemplate.id, customizedTemplate);

      onApply();
    } catch (error) {
      console.error('Failed to apply customization:', error);
    } finally {
      setApplying(false);
    }
  }, [validateCustomization, adjustForGroupSize, adjustDuration, adjustContentFocus, applyAdvancedSettings, template, customizedTemplate, onApply]);

  // Navigation
  const steps: Array<{ id: CustomizationStep; label: string; icon: React.ComponentType<any>; description: string }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: InformationCircleIcon,
      description: 'Review template details and customization options'
    },
    {
      id: 'basics',
      label: 'Basics',
      icon: UserGroupIcon,
      description: 'Set target audience and delivery parameters'
    },
    {
      id: 'content',
      label: 'Content',
      icon: DocumentTextIcon,
      description: 'Customize content focus and objectives'
    },
    {
      id: 'timing',
      label: 'Timing',
      icon: ClockIcon,
      description: 'Adjust duration and scheduling'
    },
    {
      id: 'participants',
      label: 'Participants',
      icon: ChatBubbleLeftRightIcon,
      description: 'Configure participant-specific settings'
    },
    {
      id: 'advanced',
      label: 'Advanced',
      icon: Cog6ToothIcon,
      description: 'Advanced customization and technical settings'
    },
    {
      id: 'preview',
      label: 'Preview',
      icon: EyeIcon,
      description: 'Review and confirm customizations'
    },
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const canGoNext = currentStepIndex < steps.length - 1;
  const canGoBack = currentStepIndex > 0;

  const goToNextStep = () => {
    if (canGoNext) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const goToPreviousStep = () => {
    if (canGoBack) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'overview':
        return renderOverviewStep();
      case 'basics':
        return renderBasicsStep();
      case 'content':
        return renderContentStep();
      case 'timing':
        return renderTimingStep();
      case 'participants':
        return renderParticipantsStep();
      case 'advanced':
        return renderAdvancedStep();
      case 'preview':
        return renderPreviewStep();
      default:
        return null;
    }
  };

  const renderOverviewStep = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Template Customization Overview</h3>
            <p className="text-blue-800 mb-4">
              This wizard will help you customize the "{template.title.pl}" template to match your specific needs.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <h4 className="font-medium text-gray-900 mb-2">Original Template</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>Type: {template.type}</div>
                  <div>Duration: {template.estimatedDuration} minutes</div>
                  <div>Difficulty: {template.difficulty}</div>
                  <div>Category: {template.category}</div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <h4 className="font-medium text-gray-900 mb-2">Customization Options</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>✓ Target audience adaptation</div>
                  <div>✓ Duration adjustment</div>
                  <div>✓ Content focus customization</div>
                  <div>✓ Advanced settings</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Template Preview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Description</h4>
            <p className="text-gray-600">{template.description?.pl}</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Key Features</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• {template.learningObjectives[0]}</li>
              <li>• Estimated duration: {template.estimatedDuration} minutes</li>
              <li>• Target audience: {template.targetAudience.join(', ')}</li>
              <li>• Language: {template.language.toUpperCase()}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <SparklesIcon className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">AI Recommendations</h3>
              <p className="text-yellow-800 mb-3">Based on your template selection, we recommend:</p>
              <ul className="space-y-2">
                {recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start gap-2 text-yellow-800">
                    <CheckIcon className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderBasicsStep = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Target Audience Settings</h3>

        {/* Group Size */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Group Size: {targetAudience.groupSize.current} participants
          </label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{targetAudience.groupSize.min}</span>
            <input
              type="range"
              min={targetAudience.groupSize.min}
              max={targetAudience.groupSize.max}
              value={targetAudience.groupSize.current}
              onChange={(e) => setTargetAudience(prev => ({
                ...prev,
                groupSize: { ...prev.groupSize, current: parseInt(e.target.value) }
              }))}
              className="flex-1"
            />
            <span className="text-sm text-gray-500">{targetAudience.groupSize.max}</span>
          </div>
          {validationErrors.groupSize && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.groupSize.join(', ')}</p>
          )}
        </div>

        {/* Experience Level */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Experience Level</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['beginner', 'intermediate', 'advanced', 'expert'].map(level => (
              <button
                key={level}
                onClick={() => setTargetAudience(prev => ({ ...prev, experienceLevel: level as TemplateDifficulty }))}
                className={`px-4 py-2 rounded-lg border capitalize ${
                  targetAudience.experienceLevel === level
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
          <div className="grid grid-cols-3 gap-3">
            {['pl', 'en', 'both'].map(lang => (
              <button
                key={lang}
                onClick={() => setTargetAudience(prev => ({ ...prev, language: lang as any }))}
                className={`px-4 py-2 rounded-lg border ${
                  targetAudience.language === lang
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {lang === 'pl' ? 'Polish' : lang === 'en' ? 'English' : 'Both'}
              </button>
            ))}
          </div>
        </div>

        {/* Age Group */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Age Group</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['children', 'teens', 'adults', 'mixed'].map(age => (
              <button
                key={age}
                onClick={() => setTargetAudience(prev => ({ ...prev, ageGroup: age as any }))}
                className={`px-4 py-2 rounded-lg border capitalize ${
                  targetAudience.ageGroup === age
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {age}
              </button>
            ))}
          </div>
        </div>

        {/* Context */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Context</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['corporate', 'education', 'community', 'therapy'].map(context => (
              <button
                key={context}
                onClick={() => setTargetAudience(prev => ({ ...prev, context: context as any }))}
                className={`px-4 py-2 rounded-lg border capitalize ${
                  targetAudience.context === context
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {context}
              </button>
            ))}
          </div>
        </div>

        {/* Setting */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Setting</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['indoor', 'outdoor', 'virtual', 'hybrid'].map(setting => (
              <button
                key={setting}
                onClick={() => setTargetAudience(prev => ({ ...prev, setting: setting as any }))}
                className={`px-4 py-2 rounded-lg border capitalize ${
                  targetAudience.setting === setting
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {setting}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContentStep = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Customization</h3>

        {/* Focus Areas */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Focus Areas</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              'team-building', 'communication', 'problem-solving',
              'leadership', 'creativity', 'conflict-resolution',
              'time-management', 'decision-making', 'trust-building'
            ].map(area => (
              <label key={area} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={content.focusAreas.includes(area)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setContent(prev => ({ ...prev, focusAreas: [...prev.focusAreas, area] }));
                    } else {
                      setContent(prev => ({ ...prev, focusAreas: prev.focusAreas.filter(a => a !== area) }));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 capitalize">{area.replace('-', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Objectives */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Custom Learning Objectives</label>
          <div className="space-y-2">
            {content.customObjectives.map((objective, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={objective}
                  onChange={(e) => {
                    const updated = [...content.customObjectives];
                    updated[index] = e.target.value;
                    setContent(prev => ({ ...prev, customObjectives: updated }));
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter learning objective..."
                />
                <button
                  onClick={() => {
                    setContent(prev => ({ ...prev, customObjectives: prev.customObjectives.filter((_, i) => i !== index) }));
                  }}
                  className="p-2 text-red-600 hover:text-red-800"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                setContent(prev => ({ ...prev, customObjectives: [...prev.customObjectives, ''] }));
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <PlusIcon className="w-4 h-4" />
              Add Objective
            </button>
          </div>
          {validationErrors.objectives && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.objectives.join(', ')}</p>
          )}
        </div>

        {/* Customization Level */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Customization Level</label>
          <div className="grid grid-cols-3 gap-3">
            {['basic', 'moderate', 'advanced'].map(level => (
              <button
                key={level}
                onClick={() => setContent(prev => ({ ...prev, customizationLevel: level as any }))}
                className={`px-4 py-2 rounded-lg border capitalize ${
                  content.customizationLevel === level
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Assessment Method */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Method</label>
          <select
            value={content.assessmentMethod}
            onChange={(e) => setContent(prev => ({ ...prev, assessmentMethod: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="self-assessment">Self-Assessment</option>
            <option value="peer-review">Peer Review</option>
            <option value="facilitator-evaluation">Facilitator Evaluation</option>
            <option value="quiz">Quiz/Test</option>
            <option value="presentation">Presentation</option>
            <option value="project">Project-based</option>
          </select>
        </div>

        {/* Follow-up */}
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={content.followUpRequired}
              onChange={(e) => setContent(prev => ({ ...prev, followUpRequired: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Include follow-up activities</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Add post-workshop reinforcement materials and activities</p>
        </div>
      </div>
    </div>
  );

  const renderTimingStep = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Timing Configuration</h3>

        {/* Total Duration */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Duration: {timing.totalDuration} minutes
          </label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{timing.timeConstraints.minDuration}</span>
            <input
              type="range"
              min={timing.timeConstraints.minDuration}
              max={timing.timeConstraints.maxDuration}
              value={timing.totalDuration}
              onChange={(e) => setTiming(prev => ({ ...prev, totalDuration: parseInt(e.target.value) }))}
              className="flex-1"
            />
            <span className="text-sm text-gray-500">{timing.timeConstraints.maxDuration}</span>
          </div>
          <div className="text-center mt-2">
            <span className="text-lg font-medium text-gray-900">
              {Math.floor(timing.totalDuration / 60)}h {timing.totalDuration % 60}m
            </span>
          </div>
          {validationErrors.duration && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.duration.join(', ')}</p>
          )}
        </div>

        {/* Sessions */}
        {template.type === 'workshop' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Number of Sessions</label>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(sessions => (
                <button
                  key={sessions}
                  onClick={() => setTiming(prev => ({ ...prev, sessions }))}
                  className={`px-4 py-2 rounded-lg border ${
                    timing.sessions === sessions
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {sessions} {sessions === 1 ? 'Session' : 'Sessions'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Breaks */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={timing.breaksIncluded}
              onChange={(e) => setTiming(prev => ({ ...prev, breaksIncluded: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Include break periods</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Add appropriate break times for longer sessions</p>
        </div>

        {/* Flexibility */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Schedule Flexibility: {timing.flexibility}%
          </label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">0%</span>
            <input
              type="range"
              min="0"
              max="50"
              value={timing.flexibility}
              onChange={(e) => setTiming(prev => ({ ...prev, flexibility: parseInt(e.target.value) }))}
              className="flex-1"
            />
            <span className="text-sm text-gray-500">50%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Buffer time for adjustments and unexpected delays</p>
        </div>

        {/* Preferred Times */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Time Slots</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['morning', 'midday', 'afternoon', 'evening'].map(time => (
              <label key={time} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={timing.timeConstraints.preferredTimes.includes(time)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTiming(prev => ({
                        ...prev,
                        timeConstraints: {
                          ...prev.timeConstraints,
                          preferredTimes: [...prev.timeConstraints.preferredTimes, time]
                        }
                      }));
                    } else {
                      setTiming(prev => ({
                        ...prev,
                        timeConstraints: {
                          ...prev.timeConstraints,
                          preferredTimes: prev.timeConstraints.preferredTimes.filter(t => t !== time)
                        }
                      }));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 capitalize">{time}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderParticipantsStep = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Participant Configuration</h3>
        <div className="text-gray-500 italic">
          Participant-specific settings would be implemented here
        </div>
      </div>
    </div>
  );

  const renderAdvancedStep = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Settings</h3>

        {/* Analytics */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={advanced.enableAnalytics}
              onChange={(e) => setAdvanced(prev => ({ ...prev, enableAnalytics: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Enable analytics and tracking</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Collect data on engagement and effectiveness</p>
        </div>

        {/* Accessibility */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={advanced.accessibilityMode}
              onChange={(e) => setAdvanced(prev => ({ ...prev, accessibilityMode: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Enable accessibility mode</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">WCAG 2.2 AA compliance and enhanced accessibility features</p>
        </div>

        {/* Multilingual */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={advanced.multilingualSupport}
              onChange={(e) => setAdvanced(prev => ({ ...prev, multilingualSupport: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Multilingual support</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Display content in multiple languages based on user preference</p>
        </div>

        {/* Offline Mode */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={advanced.offlineMode}
              onChange={(e) => setAdvanced(prev => ({ ...prev, offlineMode: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Offline mode support</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Allow participants to access content without internet connection</p>
        </div>

        {/* Integration */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={advanced.integrationRequired}
              onChange={(e) => setAdvanced(prev => ({ ...prev, integrationRequired: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">External integrations</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Connect with third-party tools and platforms</p>
        </div>

        {/* Custom Branding */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={advanced.customBranding}
              onChange={(e) => setAdvanced(prev => ({ ...prev, customBranding: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Custom branding</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Apply organization branding and customization</p>
        </div>

        {/* Certification */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={advanced.certification}
              onChange={(e) => setAdvanced(prev => ({ ...prev, certification: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Completion certificates</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Generate certificates for successful completion</p>
        </div>

        {/* Automated Reminders */}
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={advanced.automatedReminders}
              onChange={(e) => setAdvanced(prev => ({ ...prev, automatedReminders: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Automated reminders</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Send automatic reminders and notifications to participants</p>
        </div>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Customization Summary</h3>
        <p className="text-blue-800 mb-4">Review your customization choices before applying:</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Target Audience</h4>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-600">Group Size:</span> {targetAudience.groupSize.current} participants</div>
              <div><span className="text-gray-600">Experience Level:</span> {targetAudience.experienceLevel}</div>
              <div><span className="text-gray-600">Language:</span> {targetAudience.language}</div>
              <div><span className="text-gray-600">Age Group:</span> {targetAudience.ageGroup}</div>
              <div><span className="text-gray-600">Context:</span> {targetAudience.context}</div>
              <div><span className="text-gray-600">Setting:</span> {targetAudience.setting}</div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Timing & Content</h4>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-600">Duration:</span> {Math.floor(timing.totalDuration / 60)}h {timing.totalDuration % 60}m</div>
              {template.type === 'workshop' && (
                <div><span className="text-gray-600">Sessions:</span> {timing.sessions}</div>
              )}
              <div><span className="text-gray-600">Flexibility:</span> {timing.flexibility}%</div>
              <div><span className="text-gray-600">Focus Areas:</span> {content.focusAreas.length > 0 ? content.focusAreas.join(', ') : 'None'}</div>
              <div><span className="text-gray-600">Custom Objectives:</span> {content.customObjectives.length}</div>
              <div><span className="text-gray-600">Assessment:</span> {content.assessmentMethod}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Changes Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Applied Changes</h3>
        <div className="space-y-3">
          {Object.entries(changes).map(([key, change]) => (
            <div key={key} className="flex items-start gap-3">
              <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-gray-900 capitalize">{key}</div>
                <div className="text-sm text-gray-600">
                  Changed from "{change.original}" to "{change.new}"
                </div>
              </div>
            </div>
          ))}
          {Object.keys(changes).length === 0 && (
            <div className="text-gray-500 italic">No changes have been applied yet</div>
          )}
        </div>
      </div>

      {/* Final Validation */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Validation Errors</h3>
          <p className="text-red-800 mb-3">Please fix the following issues before applying:</p>
          <ul className="space-y-2">
            {Object.entries(validationErrors).map(([field, errors]) => (
              <li key={field} className="flex items-start gap-2 text-red-800">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium capitalize">{field}</div>
                  <ul className="text-sm">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className={`template-customizer ${className}`}>
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
                <h1 className="text-xl font-semibold text-gray-900">Customize Template</h1>
                <p className="text-sm text-gray-600">Personalize "{template.title.pl}" for your needs</p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="hidden md:flex items-center gap-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      currentStep === step.id
                        ? 'bg-blue-100 text-blue-700'
                        : index < currentStepIndex
                        ? 'text-green-600 hover:text-green-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {index < currentStepIndex ? (
                      <CheckIcon className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                    <span className="hidden md:inline">{step.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-px mx-2 ${
                      index < currentStepIndex ? 'bg-green-400' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Progress */}
          <div className="md:hidden mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Step {currentStepIndex + 1} of {steps.length}</span>
              <span className="font-medium text-gray-900">{steps[currentStepIndex].label}</span>
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {renderStepContent()}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {canGoBack && (
              <button
                onClick={goToPreviousStep}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                Previous
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* AI Suggestions */}
            <button
              onClick={() => setShowAiSuggestions(!showAiSuggestions)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${
                showAiSuggestions
                  ? 'border-purple-300 bg-purple-50 text-purple-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <SparklesIcon className="w-5 h-5" />
              AI Assistant
            </button>

            {currentStep === 'preview' ? (
              <button
                onClick={handleApplyCustomization}
                disabled={applying || Object.keys(validationErrors).length > 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Apply Customization
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goToNextStep}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Suggestions Panel */}
      {showAiSuggestions && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-lg border-l border-gray-200 z-40 overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">AI Assistant</h3>
              <button
                onClick={() => setShowAiSuggestions(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {recommendations.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700">Recommendations</h4>
                {recommendations.map((recommendation, index) => (
                  <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">{recommendation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No recommendations at this time</p>
            )}

            <div className="mt-6">
              <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                Get More Suggestions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateCustomizer;