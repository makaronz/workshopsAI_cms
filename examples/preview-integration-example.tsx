/**
 * Preview Integration Example
 *
 * Complete example demonstrating how to integrate real-time preview functionality
 * into a workshop or questionnaire editor
 */

import React, { useState, useEffect } from 'react';
import PreviewManager, { PreviewCreator, PreviewSession, usePreviewManager } from '../src/components/preview/PreviewManager';

// Example workshop data structure
interface WorkshopData {
  id: string;
  title: string;
  description: string;
  sections: WorkshopSection[];
  settings: WorkshopSettings;
}

interface WorkshopSection {
  id: string;
  type: 'text' | 'video' | 'quiz' | 'discussion';
  title: string;
  content: any;
  duration: number;
}

interface WorkshopSettings {
  allowComments: boolean;
  showProgress: boolean;
  enableRealTimeCollaboration: boolean;
  autoSave: boolean;
}

// Main Workshop Editor Component with Preview Integration
const WorkshopEditorWithPreview: React.FC = () => {
  const [workshop, setWorkshop] = useState<WorkshopData | null>(null);
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User authentication data (in real app, get from auth context)
  const userAuth = {
    token: 'your-jwt-token-here',
    userId: 'user-123',
    userEmail: 'user@example.com'
  };

  // Load workshop data
  useEffect(() => {
    const loadWorkshop = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/v1/workshops/workshop-123');
        const data = await response.json();
        setWorkshop(data);
      } catch (err) {
        setError('Failed to load workshop');
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkshop();
  }, []);

  // Handle workshop content changes
  const handleContentChange = async (updatedContent: any) => {
    if (!workshop) return;

    try {
      // Update workshop in database
      await fetch(`/api/v1/workshops/${workshop.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAuth.token}`
        },
        body: JSON.stringify({
          ...workshop,
          ...updatedContent
        })
      });

      // Update local state
      setWorkshop(prev => prev ? { ...prev, ...updatedContent } : null);

      // If preview session is active, update preview content
      if (previewSessionId) {
        await fetch(`/api/v1/preview/sessions/${previewSessionId}/content`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAuth.token}`
          },
          body: JSON.stringify({
            content: { ...workshop, ...updatedContent },
            changeDescription: 'Updated workshop content'
          })
        });
      }
    } catch (err) {
      setError('Failed to save changes');
    }
  };

  // Handle workshop settings changes
  const handleSettingsChange = async (updatedSettings: Partial<WorkshopSettings>) => {
    if (!workshop) return;

    try {
      await fetch(`/api/v1/workshops/${workshop.id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAuth.token}`
        },
        body: JSON.stringify(updatedSettings)
      });

      setWorkshop(prev => prev ? {
        ...prev,
        settings: { ...prev.settings, ...updatedSettings }
      } : null);
    } catch (err) {
      setError('Failed to update settings');
    }
  };

  // Create preview session
  const createPreviewSession = async () => {
    if (!workshop) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/preview/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAuth.token}`
        },
        body: JSON.stringify({
          type: 'workshop',
          resourceId: workshop.id,
          title: `Preview: ${workshop.title}`,
          description: 'Real-time preview of workshop content',
          initialContent: workshop
        })
      });

      const data = await response.json();
      setPreviewSessionId(data.data.id);
    } catch (err) {
      setError('Failed to create preview session');
    } finally {
      setIsLoading(false);
    }
  };

  // Close preview session
  const closePreviewSession = async () => {
    if (!previewSessionId) return;

    try {
      await fetch(`/api/v1/preview/sessions/${previewSessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userAuth.token}`
        }
      });

      setPreviewSessionId(null);
    } catch (err) {
      setError('Failed to close preview session');
    }
  };

  if (isLoading) {
    return <div>Loading workshop...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!workshop) {
    return <div>No workshop data available</div>;
  }

  return (
    <PreviewManager
      authToken={userAuth.token}
      userId={userAuth.userId}
      userEmail={userAuth.userEmail}
    >
      <div style={{ display: 'flex', height: '100vh' }}>
        {/* Editor Panel */}
        <div style={{ flex: 1, padding: '20px', borderRight: '1px solid #ddd', overflow: 'auto' }}>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Workshop Editor</h2>
            <div>
              {previewSessionId ? (
                <button
                  onClick={closePreviewSession}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Close Preview
                </button>
              ) : (
                <button
                  onClick={createPreviewSession}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Start Preview
                </button>
              )}
            </div>
          </div>

          {/* Workshop Title */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Title
            </label>
            <input
              type="text"
              value={workshop.title}
              onChange={(e) => handleContentChange({ title: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          {/* Workshop Description */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Description
            </label>
            <textarea
              value={workshop.description}
              onChange={(e) => handleContentChange({ description: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Workshop Sections */}
          <div style={{ marginBottom: '20px' }}>
            <h3>Sections</h3>
            {workshop.sections.map((section, index) => (
              <div key={section.id} style={{ marginBottom: '15px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Section {index + 1} Title
                  </label>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => {
                      const updatedSections = [...workshop.sections];
                      updatedSections[index] = { ...section, title: e.target.value };
                      handleContentChange({ sections: updatedSections });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Type
                  </label>
                  <select
                    value={section.type}
                    onChange={(e) => {
                      const updatedSections = [...workshop.sections];
                      updatedSections[index] = { ...section, type: e.target.value as any };
                      handleContentChange({ sections: updatedSections });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="text">Text</option>
                    <option value="video">Video</option>
                    <option value="quiz">Quiz</option>
                    <option value="discussion">Discussion</option>
                  </select>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={section.duration}
                    onChange={(e) => {
                      const updatedSections = [...workshop.sections];
                      updatedSections[index] = { ...section, duration: parseInt(e.target.value) };
                      handleContentChange({ sections: updatedSections });
                    }}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </div>
            ))}

            <button
              onClick={() => {
                const newSection: WorkshopSection = {
                  id: `section-${Date.now()}`,
                  type: 'text',
                  title: 'New Section',
                  content: {},
                  duration: 10
                };
                handleContentChange({
                  sections: [...workshop.sections, newSection]
                });
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Add Section
            </button>
          </div>

          {/* Workshop Settings */}
          <div style={{ marginBottom: '20px' }}>
            <h3>Settings</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={workshop.settings.allowComments}
                  onChange={(e) => handleSettingsChange({ allowComments: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Allow Comments
              </label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={workshop.settings.showProgress}
                  onChange={(e) => handleSettingsChange({ showProgress: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Show Progress
              </label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={workshop.settings.enableRealTimeCollaboration}
                  onChange={(e) => handleSettingsChange({ enableRealTimeCollaboration: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Enable Real-time Collaboration
              </label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={workshop.settings.autoSave}
                  onChange={(e) => handleSettingsChange({ autoSave: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Auto Save
              </label>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {previewSessionId && (
          <div style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #ddd', backgroundColor: 'white' }}>
              <h2>Live Preview</h2>
              <p style={{ color: '#666', margin: 0 }}>
                Real-time preview of your workshop. Changes are synchronized automatically.
              </p>
            </div>
            <PreviewSession
              sessionId={previewSessionId}
              authToken={userAuth.token}
              userId={userAuth.userId}
              userEmail={userAuth.userEmail}
              onSessionUpdate={(session) => {
                console.log('Preview session updated:', session);
              }}
              onAnalyticsEvent={(event) => {
                console.log('Analytics event:', event);
              }}
              onError={(error) => {
                console.error('Preview error:', error);
              }}
            />
          </div>
        )}
      </div>
    </PreviewManager>
  );
};

// Example Usage in Questionnaire Builder
const QuestionnaireBuilderWithPreview: React.FC = () => {
  const [questionnaire, setQuestionnaire] = useState({
    id: 'questionnaire-123',
    title: 'Sample Questionnaire',
    description: 'This is a sample questionnaire for testing',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What is your favorite color?',
        options: ['Red', 'Blue', 'Green', 'Yellow'],
        required: true
      }
    ]
  });

  const userAuth = {
    token: 'your-jwt-token-here',
    userId: 'user-123',
    userEmail: 'user@example.com'
  };

  return (
    <PreviewManager
      authToken={userAuth.token}
      userId={userAuth.userId}
      userEmail={userAuth.userEmail}
    >
      <div style={{ padding: '20px' }}>
        <h1>Questionnaire Builder with Live Preview</h1>

        <div style={{ marginBottom: '20px' }}>
          <PreviewCreator
            onSessionCreated={(sessionId) => {
              console.log('Preview session created:', sessionId);
            }}
            onError={(error) => {
              console.error('Preview creation error:', error);
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3>Questionnaire Editor</h3>
          <input
            type="text"
            value={questionnaire.title}
            onChange={(e) => setQuestionnaire(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Questionnaire title"
            style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
          />

          <textarea
            value={questionnaire.description}
            onChange={(e) => setQuestionnaire(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Questionnaire description"
            rows={3}
            style={{ width: '100%', padding: '10px', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
          />

          <div style={{ padding: '20px', border: '2px dashed #ddd', borderRadius: '4px', textAlign: 'center', color: '#666' }}>
            Drag and drop questionnaire questions here, or use the questionnaire builder interface
          </div>
        </div>

        <div style={{ marginTop: '40px' }}>
          <h3>Existing Preview Sessions</h3>
          <p>Create a preview session above to see the real-time preview functionality.</p>
        </div>
      </div>
    </PreviewManager>
  );
};

// Export components for use in your application
export { WorkshopEditorWithPreview, QuestionnaireBuilderWithPreview };

// Usage example:
/*
import { WorkshopEditorWithPreview } from './preview-integration-example';

function App() {
  return (
    <div className="App">
      <WorkshopEditorWithPreview />
    </div>
  );
}
*/

export default WorkshopEditorWithPreview;