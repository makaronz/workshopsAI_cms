import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface TemplateImportProps {
  onImportSuccess: (templateId: string, questionnaireId?: string) => void;
  onImportError: (error: string) => void;
}

interface ImportFormData {
  title: {
    pl: string;
    en: string;
  };
  category: string;
  language: string;
  autoDetectQuestions: boolean;
  targetLanguage: 'pl' | 'en' | 'both';
}

export const TemplateImport: React.FC<TemplateImportProps> = ({
  onImportSuccess,
  onImportError,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'pdf' | 'json' | 'predefined'>(
    'pdf',
  );
  const [formData, setFormData] = useState<ImportFormData>({
    title: {
      pl: '',
      en: '',
    },
    category: 'general',
    language: 'pl',
    autoDetectQuestions: true,
    targetLanguage: 'both',
  });

  // Predefined templates
  const predefinedTemplates = [
    {
      id: 'nasza_nieutopia_v1',
      name: 'NASZA (NIE)UTOPIA',
      description:
        'Kwestionariusz do tworzenia wizji wspólnoty mieszkaniowej oparty na 4 kluczowych obszarach',
      language: 'pl',
      estimatedTime: 30,
      questions: 23,
      sections: 4,
      category: 'community',
    },
  ];

  // File dropzone for PDF upload
  const onDropPDF = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (!formData.title.pl || !formData.category || !formData.language) {
        onImportError('Please fill in all required fields before uploading');
        return;
      }

      setIsImporting(true);
      setImportProgress(0);

      try {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append(
          'title',
          JSON.stringify({
            pl: formData.title.pl,
            en: formData.title.en,
          }),
        );
        uploadFormData.append('category', formData.category);
        uploadFormData.append('language', formData.language);
        uploadFormData.append(
          'autoDetectQuestions',
          String(formData.autoDetectQuestions),
        );
        uploadFormData.append('targetLanguage', formData.targetLanguage);

        const response = await fetch('/api/v1/templates/import/pdf', {
          method: 'POST',
          body: uploadFormData,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        const result = await response.json();

        if (result.success) {
          setImportProgress(100);
          onImportSuccess(
            result.data.template_id,
            result.data.questionnaire_id,
          );
        } else {
          onImportError(result.error || 'Failed to import PDF');
        }
      } catch (error) {
        onImportError(error instanceof Error ? error.message : 'Import failed');
      } finally {
        setIsImporting(false);
        setImportProgress(0);
      }
    },
    [formData, onImportSuccess, onImportError],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropPDF,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: false,
    disabled: isImporting,
  });

  // JSON import
  const handleJSONImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const jsonText = await file.text();
      setImportProgress(50);

      const response = await fetch('/api/v1/templates/import/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ jsonData: jsonText }),
      });

      const result = await response.json();

      if (result.success) {
        setImportProgress(100);
        onImportSuccess(result.data.template_id);
      } else {
        onImportError(result.error || 'Failed to import JSON');
      }
    } catch (error) {
      onImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  // Predefined template selection
  const handlePredefinedTemplateSelect = async (templateId: string) => {
    setIsImporting(true);
    setImportProgress(0);

    try {
      const response = await fetch(
        `/api/v1/templates/predefined/${templateId}/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            workshopId: null,
            title: undefined, // Use default title
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        setImportProgress(100);
        onImportSuccess(templateId, result.data.questionnaire.id);
      } else {
        onImportError(
          result.error || 'Failed to create questionnaire from template',
        );
      }
    } catch (error) {
      onImportError(
        error instanceof Error
          ? error.message
          : 'Failed to create questionnaire',
      );
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Import Template</h2>

      {/* Tab navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('predefined')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'predefined'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Predefined Templates
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pdf'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Upload PDF
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'json'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Import JSON
          </button>
        </nav>
      </div>

      {/* Progress indicator */}
      {isImporting && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Importing...
            </span>
            <span className="text-sm font-medium text-gray-700">
              {importProgress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Predefined Templates Tab */}
      {activeTab === 'predefined' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Available Templates
          </h3>
          {predefinedTemplates.map(template => (
            <div
              key={template.id}
              className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-gray-900">
                    {template.name}
                  </h4>
                  <p className="text-gray-600 mt-2">{template.description}</p>
                  <div className="flex items-center space-x-6 mt-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {template.sections} sections
                    </span>
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {template.questions} questions
                    </span>
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      ~{template.estimatedTime} min
                    </span>
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {template.language.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handlePredefinedTemplateSelect(template.id)}
                  disabled={isImporting}
                  className="ml-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Creating...' : 'Use Template'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Upload Tab */}
      {activeTab === 'pdf' && (
        <div className="space-y-6">
          {/* Form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="title-pl"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Title (Polish) *
              </label>
              <input
                type="text"
                id="title-pl"
                value={formData.title.pl}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    title: { ...prev.title, pl: e.target.value },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter template title in Polish"
              />
            </div>
            <div>
              <label
                htmlFor="title-en"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Title (English)
              </label>
              <input
                type="text"
                id="title-en"
                value={formData.title.en}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    title: { ...prev.title, en: e.target.value },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter template title in English"
              />
            </div>
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Category *
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={e =>
                  setFormData(prev => ({ ...prev, category: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="general">General</option>
                <option value="community">Community</option>
                <option value="education">Education</option>
                <option value="business">Business</option>
                <option value="health">Health</option>
                <option value="technology">Technology</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Primary Language *
              </label>
              <select
                id="language"
                value={formData.language}
                onChange={e =>
                  setFormData(prev => ({ ...prev, language: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pl">Polish</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {/* Advanced options */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Advanced Options
            </h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto-detect"
                  checked={formData.autoDetectQuestions}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      autoDetectQuestions: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="auto-detect"
                  className="ml-2 text-sm text-gray-700"
                >
                  Auto-detect questions from PDF
                </label>
              </div>
              <div>
                <label
                  htmlFor="target-language"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Target Language for Auto-detection
                </label>
                <select
                  id="target-language"
                  value={formData.targetLanguage}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      targetLanguage: e.target.value as 'pl' | 'en' | 'both',
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="both">Polish & English</option>
                  <option value="pl">Polish only</option>
                  <option value="en">English only</option>
                </select>
              </div>
            </div>
          </div>

          {/* File dropzone */}
          <div className="border-t border-gray-200 pt-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              } ${isImporting ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input {...getInputProps()} />
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isDragActive
                  ? 'Drop the PDF file here'
                  : 'Drag and drop PDF file here, or click to select'}
              </p>
              <p className="text-sm text-gray-500">
                PDF files up to 10MB. The system will automatically extract
                questions and structure.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Tab */}
      {activeTab === 'json' && (
        <div className="space-y-6">
          <div>
            <label
              htmlFor="json-file"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select JSON Template File
            </label>
            <input
              type="file"
              id="json-file"
              accept=".json"
              onChange={handleJSONImport}
              disabled={isImporting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              JSON Format Requirements:
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Exported template format from workshopsAI CMS</li>
              <li>
                • Must include template object with sections and questions
              </li>
              <li>• Valid JSON structure with all required fields</li>
              <li>• Maximum file size: 5MB</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
