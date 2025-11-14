import React, { useState } from 'react';
import { TemplateImport } from '../components/TemplateImport';
import { TemplatePreview } from '../components/TemplatePreview';

/**
 * Example usage of the PDF Template Import System
 * This demonstrates how to integrate the template import and preview components
 */
export const TemplateUsageExample: React.FC = () => {
  const [activeView, setActiveView] = useState<'import' | 'preview'>('import');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleImportSuccess = (
    templateId: string,
    questionnaireId?: string,
  ) => {
    setSelectedTemplateId(templateId);
    setActiveView('preview');
    showNotification(
      'success',
      `Template imported successfully! ${questionnaireId ? `Questionnaire ID: ${questionnaireId}` : ''}`,
    );
  };

  const handleImportError = (error: string) => {
    showNotification('error', `Import failed: ${error}`);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Template Management System
          </h1>
          <p className="text-gray-600 mt-2">
            Import, preview, and manage questionnaire templates
          </p>
        </div>

        {/* Navigation tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveView('import')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === 'import'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Import Template
            </button>
            <button
              onClick={() => setActiveView('preview')}
              disabled={!selectedTemplateId}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === 'preview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              Preview Template
            </button>
          </nav>
        </div>

        {/* Notification */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-md ${
              notification.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p
                  className={`text-sm font-medium ${
                    notification.type === 'success'
                      ? 'text-green-800'
                      : 'text-red-800'
                  }`}
                >
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        {activeView === 'import' ? (
          <TemplateImport
            onImportSuccess={handleImportSuccess}
            onImportError={handleImportError}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Template Preview
              </h2>
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveView('import')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Import Another Template
                </button>
              </div>
            </div>

            <TemplatePreview
              templateId={selectedTemplateId || undefined}
              showMetadata={true}
              readonly={true}
            />
          </div>
        )}

        {/* Quick actions sidebar */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => {
                // Create questionnaire from NASZA (NIE)UTOPIA template
                fetch('/api/v1/templates/predefined/nasza-nieutopia/create', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                  },
                })
                  .then(res => res.json())
                  .then(result => {
                    if (result.success) {
                      showNotification(
                        'success',
                        'Questionnaire created from NASZA (NIE)UTOPIA template',
                      );
                      setSelectedTemplateId('nasza_nieutopia_v1');
                      setActiveView('preview');
                    } else {
                      showNotification(
                        'error',
                        result.error || 'Failed to create questionnaire',
                      );
                    }
                  })
                  .catch(error => {
                    showNotification('error', error.message);
                  });
              }}
              className="w-full text-left px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create NASZA (NIE)UTOPIA Questionnaire
            </button>

            <button
              onClick={() => {
                // View template analytics
                if (selectedTemplateId) {
                  fetch(`/api/v1/templates/${selectedTemplateId}/analytics`)
                    .then(res => res.json())
                    .then(result => {
                      if (result.success) {
                        console.log('Template analytics:', result.data);
                        showNotification(
                          'success',
                          'Analytics loaded - check console',
                        );
                      } else {
                        showNotification(
                          'error',
                          result.error || 'Failed to load analytics',
                        );
                      }
                    })
                    .catch(error => {
                      showNotification('error', error.message);
                    });
                } else {
                  showNotification('error', 'Please select a template first');
                }
              }}
              className="w-full text-left px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              View Template Analytics
            </button>

            <button
              onClick={() => {
                // Export template
                if (selectedTemplateId) {
                  fetch(`/api/v1/templates/${selectedTemplateId}/export`)
                    .then(res => res.blob())
                    .then(blob => {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.style.display = 'none';
                      a.href = url;
                      a.download = `${selectedTemplateId}.json`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      showNotification(
                        'success',
                        'Template exported successfully',
                      );
                    })
                    .catch(error => {
                      showNotification('error', error.message);
                    });
                } else {
                  showNotification('error', 'Please select a template first');
                }
              }}
              className="w-full text-left px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Export Template
            </button>
          </div>
        </div>

        {/* API usage examples */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            API Usage Examples
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                1. Get all templates:
              </h4>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                <code>{`GET /api/v1/templates
Authorization: Bearer <token>`}</code>
              </pre>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                2. Import PDF template:
              </h4>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                <code>{`POST /api/v1/templates/import/pdf
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
- file: <PDF file>
- title: {"pl": "Mój kwestionariusz", "en": "My questionnaire"}
- category: "community"
- language: "pl"`}</code>
              </pre>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                3. Create questionnaire from template:
              </h4>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                <code>{`POST /api/v1/templates/:templateId/create-questionnaire
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "workshopId": null,
  "title": {"pl": "Ankieta dla warsztatu", "en": "Workshop questionnaire"}
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
