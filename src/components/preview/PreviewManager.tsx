/**
 * Preview Manager Component
 *
 * Orchestrates preview sessions, manages WebSocket connections,
 * and provides a unified interface for preview functionality
 */

import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react';
import PreviewContainer from './PreviewContainer';
import type { PreviewSession, PreviewSettings } from '../../services/previewService';

interface PreviewManagerContextType {
  createSession: (
    type: 'workshop' | 'questionnaire',
    resourceId: string,
    title: string,
  ) => Promise<string>;
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: (sessionId: string) => Promise<void>;
  updateContent: (sessionId: string, content: any) => Promise<void>;
  updateSettings: (
    sessionId: string,
    settings: Partial<PreviewSettings>,
  ) => Promise<void>;
  currentSession: PreviewSession | null;
  isConnected: boolean;
  activeCollaborators: string[];
}

const PreviewManagerContext = createContext<PreviewManagerContextType | null>(
  null,
);

interface PreviewManagerProps {
  authToken: string;
  userId: string;
  userEmail: string;
  children?: React.ReactNode;
  className?: string;
}

interface SessionState {
  id: string;
  session: PreviewSession;
  isActive: boolean;
}

const PreviewManager: React.FC<PreviewManagerProps> = ({
  authToken,
  userId,
  userEmail,
  children,
  className = '',
}) => {
  const [sessions, setSessions] = useState<Map<string, SessionState>>(
    new Map(),
  );
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeCollaborators, setActiveCollaborators] = useState<string[]>([]);

  const currentSession = currentSessionId
    ? sessions.get(currentSessionId)?.session
    : null;

  /**
   * Create a new preview session
   */
  const createSession = useCallback(
    async (
      type: 'workshop' | 'questionnaire',
      resourceId: string,
      title: string,
    ): Promise<string> => {
      try {
        const response = await fetch('/api/v1/preview/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            type,
            resourceId,
            title,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create preview session');
        }

        const data = await response.json();
        const sessionId = data.data.id;

        // Add to sessions map
        setSessions(prev =>
          new Map(prev).set(sessionId, {
            id: sessionId,
            session: data.data,
            isActive: false,
          }),
        );

        return sessionId;
      } catch (error) {
        console.error('Error creating preview session:', error);
        throw error;
      }
    },
    [authToken],
  );

  /**
   * Join an existing preview session
   */
  const joinSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        // Get session details
        const response = await fetch(`/api/v1/preview/sessions/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to join preview session');
        }

        const data = await response.json();

        // Set as current session
        setCurrentSessionId(sessionId);
        setSessions(prev => {
          const newMap = new Map(prev);
          if (newMap.has(sessionId)) {
            newMap.get(sessionId)!.isActive = true;
            newMap.get(sessionId)!.session = data.data;
          } else {
            newMap.set(sessionId, {
              id: sessionId,
              session: data.data,
              isActive: true,
            });
          }
          return newMap;
        });

        setIsConnected(true);
      } catch (error) {
        console.error('Error joining preview session:', error);
        throw error;
      }
    },
    [authToken],
  );

  /**
   * Leave a preview session
   */
  const leaveSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        // Deactivate session
        setSessions(prev => {
          const newMap = new Map(prev);
          if (newMap.has(sessionId)) {
            newMap.get(sessionId)!.isActive = false;
          }
          return newMap;
        });

        // Clear current session if it's the one we're leaving
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setIsConnected(false);
          setActiveCollaborators([]);
        }
      } catch (error) {
        console.error('Error leaving preview session:', error);
        throw error;
      }
    },
    [currentSessionId],
  );

  /**
   * Update session content
   */
  const updateContent = useCallback(
    async (sessionId: string, content: any): Promise<void> => {
      try {
        const response = await fetch(
          `/api/v1/preview/sessions/${sessionId}/content`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              content,
              changeDescription: 'Content updated via preview manager',
            }),
          },
        );

        if (!response.ok) {
          throw new Error('Failed to update preview content');
        }

        const data = await response.json();

        // Update local session state
        setSessions(prev => {
          const newMap = new Map(prev);
          if (newMap.has(sessionId)) {
            newMap.get(sessionId)!.session = data.data;
          }
          return newMap;
        });
      } catch (error) {
        console.error('Error updating preview content:', error);
        throw error;
      }
    },
    [authToken],
  );

  /**
   * Update session settings
   */
  const updateSettings = useCallback(
    async (
      sessionId: string,
      settings: Partial<PreviewSettings>,
    ): Promise<void> => {
      try {
        const response = await fetch(
          `/api/v1/preview/sessions/${sessionId}/settings`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              settings,
            }),
          },
        );

        if (!response.ok) {
          throw new Error('Failed to update preview settings');
        }

        const data = await response.json();

        // Update local session state
        setSessions(prev => {
          const newMap = new Map(prev);
          if (newMap.has(sessionId)) {
            newMap.get(sessionId)!.session = data.data;
          }
          return newMap;
        });
      } catch (error) {
        console.error('Error updating preview settings:', error);
        throw error;
      }
    },
    [authToken],
  );

  /**
   * Handle session updates from WebSocket
   */
  const handleSessionUpdate = useCallback((updatedSession: PreviewSession) => {
    setSessions(prev => {
      const newMap = new Map(prev);
      if (newMap.has(updatedSession.id)) {
        newMap.get(updatedSession.id)!.session = updatedSession;
      }
      return newMap;
    });
  }, []);

  /**
   * Handle analytics events from WebSocket
   */
  const handleAnalyticsEvent = useCallback((event: any) => {
    // Process analytics events
    console.log('Analytics event:', event);
  }, []);

  /**
   * Handle errors from WebSocket
   */
  const handleError = useCallback((error: string) => {
    console.error('Preview error:', error);
    // Handle error state, show notification, etc.
  }, []);

  /**
   * Handle participant join/leave events
   */

  // Context value
  const contextValue: PreviewManagerContextType = {
    createSession,
    joinSession,
    leaveSession,
    updateContent,
    updateSettings,
    currentSession: currentSession || null,
    isConnected,
    activeCollaborators,
  };

  return (
    <PreviewManagerContext.Provider value={contextValue}>
      <div className={`preview-manager ${className}`}>
        {children ||
          (currentSessionId && (
            <PreviewContainer
              sessionId={currentSessionId}
              authToken={authToken}
              userId={userId}
              userEmail={userEmail}
              initialSession={currentSession || undefined}
              onSessionUpdate={handleSessionUpdate}
              onAnalyticsEvent={handleAnalyticsEvent}
              onError={handleError}
            />
          ))}
      </div>
    </PreviewManagerContext.Provider>
  );
};

/**
 * Hook to use the Preview Manager context
 */
export const usePreviewManager = (): PreviewManagerContextType => {
  const context = useContext(PreviewManagerContext);
  if (!context) {
    throw new Error('usePreviewManager must be used within a PreviewManager');
  }
  return context;
};

/**
 * Preview Session Component - Individual session wrapper
 */
interface PreviewSessionComponentProps {
  sessionId: string;
  authToken: string;
  userId: string;
  userEmail: string;
  className?: string;
  onSessionUpdate?: (session: any) => void;
  onAnalyticsEvent?: (event: any) => void;
  onError?: (error: string) => void;
}

export const PreviewSessionComponent: React.FC<PreviewSessionComponentProps> = ({
  sessionId,
  authToken,
  userId,
  userEmail,
  className,
  onSessionUpdate,
  onAnalyticsEvent,
  onError,
}) => {
  const { joinSession, leaveSession } = usePreviewManager();

  useEffect(() => {
    joinSession(sessionId);

    return () => {
      leaveSession(sessionId);
    };
  }, [sessionId, joinSession, leaveSession]);

  return (
    <PreviewContainer
      sessionId={sessionId}
      authToken={authToken}
      userId={userId}
      userEmail={userEmail}
      onSessionUpdate={onSessionUpdate}
      onAnalyticsEvent={onAnalyticsEvent}
      onError={onError}
      className={className}
    />
  );
};

/**
 * Preview Creator Component - Interface for creating new preview sessions
 */
interface PreviewCreatorProps {
  onSessionCreated?: (sessionId: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export const PreviewCreator: React.FC<PreviewCreatorProps> = ({
  onSessionCreated,
  onError,
  className,
}) => {
  const { createSession } = usePreviewManager();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    type: 'workshop' as 'workshop' | 'questionnaire',
    resourceId: '',
    title: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.resourceId || !formData.title) {
      onError?.('Please fill in all required fields');
      return;
    }

    setIsCreating(true);

    try {
      const sessionId = await createSession(
        formData.type,
        formData.resourceId,
        formData.title,
      );
      onSessionCreated?.(sessionId);

      // Reset form
      setFormData({
        type: 'workshop',
        resourceId: '',
        title: '',
        description: '',
      });
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : 'Failed to create session',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className={`preview-creator ${className}`}
      style={{
        padding: '20px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        backgroundColor: '#ffffff',
      }}
    >
      <h3 style={{ marginBottom: '15px' }}>Create Preview Session</h3>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '5px',
              fontWeight: 'bold',
            }}
          >
            Type
          </label>
          <select
            value={formData.type}
            onChange={e =>
              setFormData(prev => ({ ...prev, type: e.target.value as any }))
            }
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
            }}
          >
            <option value="workshop">Workshop</option>
            <option value="questionnaire">Questionnaire</option>
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '5px',
              fontWeight: 'bold',
            }}
          >
            Resource ID *
          </label>
          <input
            type="text"
            value={formData.resourceId}
            onChange={e =>
              setFormData(prev => ({ ...prev, resourceId: e.target.value }))
            }
            placeholder="Enter workshop or questionnaire ID"
            required
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '5px',
              fontWeight: 'bold',
            }}
          >
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={e =>
              setFormData(prev => ({ ...prev, title: e.target.value }))
            }
            placeholder="Enter preview session title"
            required
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '5px',
              fontWeight: 'bold',
            }}
          >
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={e =>
              setFormData(prev => ({ ...prev, description: e.target.value }))
            }
            placeholder="Enter optional description"
            rows={3}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              resize: 'vertical',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isCreating}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isCreating ? 'not-allowed' : 'pointer',
            opacity: isCreating ? 0.7 : 1,
          }}
        >
          {isCreating ? 'Creating...' : 'Create Preview Session'}
        </button>
      </form>
    </div>
  );
};

export default PreviewManager;
