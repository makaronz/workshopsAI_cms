import React, { useState, useEffect } from 'react';

interface Question {
  id: string;
  order: number;
  label: string;
  text: {
    pl: string;
    en?: string;
  };
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'scale'
    | 'single_choice'
    | 'multiple_choice';
  required: boolean;
  validation?: {
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
  };
  help_text?: {
    pl?: string;
    en?: string;
  };
  options?: Array<{
    value: string;
    label: { pl: string; en?: string };
  }>;
}

interface Section {
  id: string;
  order: number;
  title: {
    pl: string;
    en?: string;
  };
  description?: {
    pl: string;
    en?: string;
  };
  icon?: string;
  questions: Question[];
}

interface TemplatePreviewProps {
  templateId?: string;
  template?: any; // ParsedTemplate
  language?: 'pl' | 'en';
  showMetadata?: boolean;
  readonly?: boolean;
  className?: string;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  templateId,
  template,
  language = 'pl',
  showMetadata = true,
  readonly = false,
  className = '',
}) => {
  const [loading, setLoading] = useState(true);
  const [templateData, setTemplateData] = useState<any>(null);
  const [currentLanguage, setCurrentLanguage] = useState<'pl' | 'en'>(language);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (template) {
      setTemplateData(template);
      setLoading(false);
      // Auto-expand all sections by default
      if (template.sections) {
        setExpandedSections(
          new Set(template.sections.map((s: Section) => s.id)),
        );
      }
    } else if (templateId) {
      loadTemplate();
    }
  }, [template, templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/templates/${templateId}`);
      const result = await response.json();

      if (result.success) {
        setTemplateData(result.data.template);
        // Auto-expand all sections
        if (result.data.template.sections) {
          setExpandedSections(
            new Set(result.data.template.sections.map((s: Section) => s.id)),
          );
        }
      }
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const getSectionIcon = (iconName?: string) => {
    const iconMap: Record<string, string> = {
      flag: '🏳️',
      home: '🏠',
      cube: '📦',
      people: '👥',
      organization: '🏢',
      'document-text': '📄',
    };

    return iconName ? iconMap[iconName] || '📄' : '📄';
  };

  const renderQuestionInput = (question: Question) => {
    const commonProps = {
      disabled: readonly,
      className: `w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        readonly ? 'bg-gray-50' : ''
      }`,
    };

    switch (question.type) {
    case 'text':
      return (
        <input
          type="text"
          placeholder={
            currentLanguage === 'pl'
              ? 'Wpisz odpowiedź...'
              : 'Type your answer...'
          }
          {...commonProps}
          maxLength={question.validation?.max_length}
        />
      );

    case 'textarea':
      return (
        <textarea
          placeholder={
            currentLanguage === 'pl'
              ? 'Wpisz odpowiedź...'
              : 'Type your answer...'
          }
          {...commonProps}
          rows={4}
          maxLength={question.validation?.max_length}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          placeholder={
            currentLanguage === 'pl' ? 'Wpisz liczbę...' : 'Enter a number...'
          }
          {...commonProps}
          min={question.validation?.min_value}
          max={question.validation?.max_value}
        />
      );

    case 'scale':
      return (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {question.validation?.min_value || 1}
          </span>
          <input
            type="range"
            min={question.validation?.min_value || 1}
            max={question.validation?.max_value || 10}
            disabled={readonly}
            className="flex-1"
          />
          <span className="text-sm text-gray-500">
            {question.validation?.max_value || 10}
          </span>
        </div>
      );

    case 'single_choice':
      return (
        <div className="space-y-2">
          {question.options?.map(option => (
            <label
              key={option.value}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <input
                type="radio"
                name={question.id}
                value={option.value}
                disabled={readonly}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">
                {option.label[currentLanguage] ||
                    option.label.pl ||
                    option.label.en}
              </span>
            </label>
          ))}
        </div>
      );

    case 'multiple_choice':
      return (
        <div className="space-y-2">
          {question.options?.map(option => (
            <label
              key={option.value}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <input
                type="checkbox"
                value={option.value}
                disabled={readonly}
                className="text-blue-600 focus:ring-blue-500 rounded"
              />
              <span className="text-gray-700">
                {option.label[currentLanguage] ||
                    option.label.pl ||
                    option.label.en}
              </span>
            </label>
          ))}
        </div>
      );

    default:
      return (
        <input
          type="text"
          placeholder={
            currentLanguage === 'pl'
              ? 'Wpisz odpowiedź...'
              : 'Type your answer...'
          }
          {...commonProps}
        />
      );
    }
  };

  const getValidationInfo = (question: Question) => {
    const info: string[] = [];
    const validation = question.validation;

    if (!validation) return null;

    if (validation.min_length) {
      info.push(
        `${currentLanguage === 'pl' ? 'Min' : 'Min'}: ${validation.min_length} ${currentLanguage === 'pl' ? 'znaków' : 'characters'}`,
      );
    }

    if (validation.max_length) {
      info.push(
        `${currentLanguage === 'pl' ? 'Max' : 'Max'}: ${validation.max_length} ${currentLanguage === 'pl' ? 'znaków' : 'characters'}`,
      );
    }

    if (validation.min_value !== undefined) {
      info.push(
        `${currentLanguage === 'pl' ? 'Min' : 'Min'}: ${validation.min_value}`,
      );
    }

    if (validation.max_value !== undefined) {
      info.push(
        `${currentLanguage === 'pl' ? 'Max' : 'Max'}: ${validation.max_value}`,
      );
    }

    if (info.length === 0) return null;

    return <span className="text-xs text-gray-500">{info.join(' • ')}</span>;
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="space-y-3">
                {[1, 2].map(j => (
                  <div key={j}>
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!templateData) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">
          {currentLanguage === 'pl'
            ? 'Nie znaleziono szablonu'
            : 'Template not found'}
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {templateData.title[currentLanguage] ||
                templateData.title.pl ||
                templateData.title.en}
            </h2>
            {templateData.description && (
              <p className="text-gray-600 mt-2">
                {templateData.description[currentLanguage] ||
                  templateData.description.pl ||
                  templateData.description.en}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {/* Language switcher */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentLanguage('pl')}
                className={`px-3 py-1 text-sm rounded-md ${
                  currentLanguage === 'pl'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                PL
              </button>
              <button
                onClick={() => setCurrentLanguage('en')}
                className={`px-3 py-1 text-sm rounded-md ${
                  currentLanguage === 'en'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      {templateData.instructions && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 m-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                {templateData.instructions[currentLanguage] ||
                  templateData.instructions.pl ||
                  templateData.instructions.en}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      {showMetadata && (
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-6">
              <span>
                {templateData.sections?.length || 0}{' '}
                {currentLanguage === 'pl' ? 'sekcji' : 'sections'}
              </span>
              <span>
                {templateData.metadata?.total_questions ||
                  templateData.sections?.reduce(
                    (acc: number, s: Section) => acc + s.questions.length,
                    0,
                  ) ||
                  0}{' '}
                {currentLanguage === 'pl' ? 'pytań' : 'questions'}
              </span>
              {templateData.estimated_time_minutes && (
                <span>
                  ~{templateData.estimated_time_minutes}{' '}
                  {currentLanguage === 'pl' ? 'minut' : 'minutes'}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {templateData.settings?.show_all_questions && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {currentLanguage === 'pl'
                    ? 'Wszystkie widoczne'
                    : 'All visible'}
                </span>
              )}
              {templateData.settings?.allow_edit && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {currentLanguage === 'pl'
                    ? 'Edycja dozwolona'
                    : 'Edit allowed'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="p-6 space-y-6">
        {templateData.sections?.map(
          (section: Section, sectionIndex: number) => (
            <div key={section.id} className="border border-gray-200 rounded-lg">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {getSectionIcon(section.icon)}
                  </span>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {section.title[currentLanguage] ||
                        section.title.pl ||
                        section.title.en}
                    </h3>
                    {section.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {section.description[currentLanguage] ||
                          section.description.pl ||
                          section.description.en}
                      </p>
                    )}
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transform transition-transform ${
                    expandedSections.has(section.id) ? 'rotate-180' : ''
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* Section questions */}
              {expandedSections.has(section.id) && (
                <div className="border-t border-gray-200">
                  <div className="p-6 space-y-6">
                    {section.questions.map(
                      (question: Question, questionIndex: number) => (
                        <div key={question.id} className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-500">
                                  {sectionIndex + 1}.{questionIndex + 1}
                                </span>
                                {question.required && (
                                  <span className="text-red-500 text-xs">
                                    *
                                  </span>
                                )}
                                {question.label && (
                                  <span className="text-sm font-medium text-gray-700">
                                    {question.label}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-gray-900 font-medium">
                                {question.text[currentLanguage] ||
                                  question.text.pl ||
                                  question.text.en}
                              </p>
                              {question.help_text && (
                                <p className="mt-1 text-sm text-gray-500">
                                  {question.help_text[currentLanguage] ||
                                    question.help_text.pl ||
                                    question.help_text.en}
                                </p>
                              )}
                              {getValidationInfo(question)}
                            </div>
                          </div>
                          {renderQuestionInput(question)}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
};
