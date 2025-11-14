/**
 * Preview Container Component
 *
 * Main container for real-time preview functionality with WebSocket integration
 * and collaborative features
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  PreviewSession,
  PreviewSettings,
  PreviewAnalytics,
} from '../../services/previewService';
import { logger } from '../../utils/logger';

interface PreviewContainerProps {
  sessionId: string;
  authToken: string;
  userId: string;
  userEmail: string;
  initialSession?: PreviewSession;
  onSessionUpdate?: (session: PreviewSession) => void;
  onAnalyticsEvent?: (event: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface CollaborationEvent {
  userId: string;
  userEmail: string;
  eventType: string;
  eventData: any;
  timestamp: Date;
}

interface PreviewState {
  session: PreviewSession | null;
  isConnected: boolean;
  collaborators: Map<string, any>;
  unsavedChanges: boolean;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  isFullscreen: boolean;
  showControls: boolean;
  showAnalytics: boolean;
}

const PreviewContainer: React.FC<PreviewContainerProps> = ({
  sessionId,
  authToken,
  userId,
  userEmail,
  initialSession,
  onSessionUpdate,
  onAnalyticsEvent,
  onError,
  className = '',
}) => {
  const [state, setState] = useState<PreviewState>({
    session: initialSession || null,
    isConnected: false,
    collaborators: new Map(),
    unsavedChanges: false,
    deviceType: 'desktop',
    isFullscreen: false,
    showControls: true,
    showAnalytics: false,
  });

  const [analytics, setAnalytics] = useState<PreviewAnalytics | null>(null);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  /**
   * Initialize WebSocket connection
   */
  const initializeSocket = useCallback(() => {
    try {
      const socket = io(
        process.env.REACT_APP_WS_URL || 'http://localhost:3001',
        {
          auth: {
            token: authToken,
          },
          transports: ['websocket', 'polling'],
        },
      );

      socketRef.current = socket;

      // Connection events
      socket.on('connect', () => {
        logger.info(`Preview WebSocket connected: ${socket.id}`);
        setState(prev => ({ ...prev, isConnected: true }));
        reconnectAttempts.current = 0;

        // Join preview room
        socket.emit('join_preview', {
          sessionId,
          userId,
          userEmail,
        });
      });

      socket.on('disconnect', reason => {
        logger.warn(`Preview WebSocket disconnected: ${reason}`);
        setState(prev => ({ ...prev, isConnected: false }));

        // Attempt reconnection if not intentionally disconnected
        if (
          reason !== 'io client disconnect' &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          setTimeout(
            () => {
              reconnectAttempts.current++;
              socket.connect();
            },
            Math.pow(2, reconnectAttempts.current) * 1000,
          ); // Exponential backoff
        }
      });

      socket.on('connect_error', error => {
        logger.error('Preview WebSocket connection error:', error);
        onError?.(`Connection error: ${error.message}`);
      });

      // Preview events
      socket.on('preview_state', data => {
        setState(prev => ({
          ...prev,
          session: data.data,
          unsavedChanges: false,
        }));
        onSessionUpdate?.(data.data);
      });

      socket.on('preview_updated', (data: any) => {
        if (state.session) {
          const updatedSession = {
            ...state.session,
            content: { ...state.session.content, ...data.data.content },
            updatedAt: new Date(),
          };

          setState(prev => ({
            ...prev,
            session: updatedSession,
            unsavedChanges: data.data.updatedBy !== userId,
          }));

          onSessionUpdate?.(updatedSession);
        }
      });

      socket.on('preview_settings_updated', (data: any) => {
        if (state.session) {
          const updatedSession = {
            ...state.session,
            settings: data.settings,
            updatedAt: new Date(),
          };

          setState(prev => ({
            ...prev,
            session: updatedSession,
          }));

          onSessionUpdate?.(updatedSession);
        }
      });

      // Collaboration events
      socket.on('participant_joined', data => {
        setState(prev => ({
          ...prev,
          collaborators: new Map(prev.collaborators).set(data.userId, data),
        }));
      });

      socket.on('participant_left', data => {
        const newCollaborators = new Map(state.collaborators);
        newCollaborators.delete(data.userId);
        setState(prev => ({ ...prev, collaborators: newCollaborators }));
      });

      socket.on('collaboration_event', (data: CollaborationEvent) => {
        // Handle real-time collaboration events (cursor position, selections, etc.)
        handleCollaborationEvent(data);
      });

      // Validation events
      socket.on('validation_completed', data => {
        setValidationErrors(data.errors);
      });

      // Analytics events
      socket.on('analytics_event', event => {
        onAnalyticsEvent?.(event);
      });

      return socket;
    } catch (error) {
      logger.error('Error initializing WebSocket:', error);
      onError?.('Failed to initialize real-time connection');
      return null;
    }
  }, [
    sessionId,
    authToken,
    userId,
    userEmail,
    state.session,
    state.collaborators,
    onError,
    onSessionUpdate,
    onAnalyticsEvent,
  ]);

  /**
   * Handle collaboration events
   */
  const handleCollaborationEvent = useCallback((event: CollaborationEvent) => {
    // Handle cursor position updates, text selections, etc.
    logger.info('Collaboration event:', event);

    // Update UI to show collaborator cursors, selections, etc.
    // This would be implemented based on your specific needs
  }, []);

  
  /**
   * Update preview settings
   */
  const updateSettings = useCallback(
    (settings: Partial<PreviewSettings>) => {
      if (socketRef.current && state.session) {
        socketRef.current.emit('preview_settings_change', {
          sessionId,
          settings,
          timestamp: new Date(),
        });
      }
    },
    [sessionId, state.session],
  );

  
  /**
   * Toggle device preview
   */
  const toggleDevicePreview = useCallback(
    (deviceType: 'desktop' | 'tablet' | 'mobile') => {
      setState(prev => ({ ...prev, deviceType }));

      updateSettings({
        deviceType,
        mobilePreview: deviceType === 'mobile',
        tabletPreview: deviceType === 'tablet',
      });

      if (socketRef.current) {
        socketRef.current.emit('mobile_preview_toggle', {
          sessionId,
          deviceType,
        });
      }
    },
    [updateSettings, sessionId],
  );

  /**
   * Toggle fullscreen mode
   */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && previewRef.current) {
      previewRef.current.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    setState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  }, []);

  /**
   * Run content validation
   */
  const runValidation = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('validate_content', {
        sessionId,
        timestamp: new Date(),
      });
    }
  }, [sessionId]);

  /**
   * Export preview data
   */
  const exportPreview = useCallback(
    async (format: 'json' | 'csv' | 'pdf' = 'json') => {
      try {
        const response = await fetch(
          `/api/v1/preview/sessions/${sessionId}/export?format=${format}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
        );

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `preview-${sessionId}.${format}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          throw new Error('Export failed');
        }
      } catch (error) {
        logger.error('Error exporting preview:', error);
        onError?.('Failed to export preview');
      }
    },
    [sessionId, authToken, onError],
  );

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = initializeSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [initializeSocket]);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const response = await fetch(
          `/api/v1/preview/sessions/${sessionId}/analytics`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          setAnalytics(data.data);
        }
      } catch (error) {
        logger.error('Error loading analytics:', error);
      }
    };

    loadAnalytics();
  }, [sessionId, authToken]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 's':
          e.preventDefault();
          // Save content
          break;
        case 'e':
          e.preventDefault();
          exportPreview();
          break;
        case 'd':
          e.preventDefault();
          setState(prev => ({ ...prev, showControls: !prev.showControls }));
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, exportPreview]);

  const deviceStyles = {
    desktop: { width: '100%', maxWidth: 'none' },
    tablet: { width: '768px', maxWidth: '768px', margin: '0 auto' },
    mobile: { width: '375px', maxWidth: '375px', margin: '0 auto' },
  };

  return (
    <div
      ref={previewRef}
      className={`preview-container ${state.isFullscreen ? 'fullscreen' : ''} ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: state.session?.settings.darkMode
          ? '#1a1a1a'
          : '#ffffff',
      }}
    >
      {/* Connection Status Indicator */}
      <div
        className="connection-status"
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          padding: '5px 10px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          backgroundColor: state.isConnected ? '#10b981' : '#ef4444',
          color: 'white',
        }}
      >
        {state.isConnected ? 'Connected' : 'Disconnected'}
      </div>

      {/* Preview Controls */}
      {state.showControls && (
        <div
          className="preview-controls"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: 1000,
            display: 'flex',
            gap: '10px',
            padding: '10px',
            backgroundColor: state.session?.settings.darkMode
              ? '#2d2d2d'
              : '#f3f4f6',
            borderRadius: '8px',
            border: `1px solid ${state.session?.settings.darkMode ? '#4b5563' : '#d1d5db'}`,
          }}
        >
          {/* Device Type Selector */}
          <select
            value={state.deviceType}
            onChange={e => toggleDevicePreview(e.target.value as any)}
            style={{
              padding: '5px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
            }}
          >
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="mobile">Mobile</option>
          </select>

          {/* Action Buttons */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen (Ctrl+F)"
            style={{
              padding: '5px 10px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            {state.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>

          <button
            onClick={runValidation}
            title="Validate Content"
            style={{
              padding: '5px 10px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            Validate
          </button>

          <button
            onClick={() => exportPreview()}
            title="Export (Ctrl+E)"
            style={{
              padding: '5px 10px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            Export
          </button>

          <button
            onClick={() =>
              setState(prev => ({
                ...prev,
                showAnalytics: !prev.showAnalytics,
              }))
            }
            title="Toggle Analytics"
            style={{
              padding: '5px 10px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            Analytics
          </button>
        </div>
      )}

      {/* Collaborators Indicator */}
      {state.collaborators.size > 0 && (
        <div
          className="collaborators-indicator"
          style={{
            position: 'absolute',
            top: '80px',
            right: '10px',
            zIndex: 1000,
            padding: '5px 10px',
            backgroundColor: state.session?.settings.darkMode
              ? '#2d2d2d'
              : '#f3f4f6',
            borderRadius: '8px',
            border: `1px solid ${state.session?.settings.darkMode ? '#4b5563' : '#d1d5db'}`,
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              marginBottom: '5px',
            }}
          >
            Active Collaborators ({state.collaborators.size})
          </div>
          {Array.from(state.collaborators.values()).map((collaborator: any) => (
            <div key={collaborator.userId} style={{ fontSize: '11px' }}>
              {collaborator.userEmail}
            </div>
          ))}
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div
          className="validation-errors"
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            zIndex: 1000,
            padding: '10px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            maxWidth: '300px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              marginBottom: '5px',
              color: '#991b1b',
            }}
          >
            Validation Issues ({validationErrors.length})
          </div>
          {validationErrors.slice(0, 3).map((error, index) => (
            <div
              key={error.id || index}
              style={{
                fontSize: '11px',
                color: '#991b1b',
                marginBottom: '2px',
              }}
            >
              {error.message}
            </div>
          ))}
          {validationErrors.length > 3 && (
            <div style={{ fontSize: '11px', color: '#991b1b' }}>
              ... and {validationErrors.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Analytics Panel */}
      {state.showAnalytics && analytics && (
        <div
          className="analytics-panel"
          style={{
            position: 'absolute',
            top: '80px',
            left: '10px',
            zIndex: 1000,
            padding: '15px',
            backgroundColor: state.session?.settings.darkMode
              ? '#2d2d2d'
              : '#f3f4f6',
            borderRadius: '8px',
            border: `1px solid ${state.session?.settings.darkMode ? '#4b5563' : '#d1d5db'}`,
            minWidth: '250px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '10px',
            }}
          >
            Analytics
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
              Engagement
            </div>
            <div style={{ fontSize: '11px' }}>
              Views: {analytics.engagement.totalViews}
            </div>
            <div style={{ fontSize: '11px' }}>
              Interactions: {analytics.engagement.uniqueInteractions}
            </div>
            <div style={{ fontSize: '11px' }}>
              Time Spent: {analytics.engagement.timeSpent}s
            </div>
            <div style={{ fontSize: '11px' }}>
              Completion Rate: {analytics.engagement.completionRate}%
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
              Accessibility
            </div>
            <div style={{ fontSize: '11px' }}>
              Score: {analytics.accessibility.score}%
            </div>
            <div style={{ fontSize: '11px' }}>
              Issues: {analytics.accessibility.issues.length}
            </div>
          </div>

          <button
            onClick={() =>
              setState(prev => ({ ...prev, showAnalytics: false }))
            }
            style={{
              fontSize: '11px',
              padding: '3px 6px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Preview Content */}
      <div
        className="preview-content"
        style={{
          height: '100%',
          overflow: 'auto',
          transition: 'all 0.3s ease',
          ...deviceStyles[state.deviceType],
          border: state.deviceType !== 'desktop' ? '1px solid #d1d5db' : 'none',
          boxShadow:
            state.deviceType !== 'desktop'
              ? '0 4px 6px rgba(0, 0, 0, 0.1)'
              : 'none',
        }}
      >
        {state.session ? (
          <div
            style={{
              padding: '20px',
              fontSize:
                state.session.settings.fontSize === 'small'
                  ? '14px'
                  : state.session.settings.fontSize === 'large'
                    ? '18px'
                    : '16px',
              lineHeight: state.session.settings.highContrast ? '1.8' : '1.6',
              color: state.session.settings.darkMode ? '#ffffff' : '#000000',
              backgroundColor: state.session.settings.darkMode
                ? '#1a1a1a'
                : '#ffffff',
            }}
          >
            {/* Render preview content here */}
            <div
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(state.session.content, null, 2),
              }}
            />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: (state.session as any)?.settings?.darkMode ? '#ffffff' : '#000000',
            }}
          >
            Loading preview...
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewContainer;
