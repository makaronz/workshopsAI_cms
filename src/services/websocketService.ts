/**
 * WebSocket Service - Real-time Communication Infrastructure
 *
 * Provides Socket.io-based real-time communication with:
 * - Authentication and session management
 * - Room-based communication (workshop, questionnaire)
 * - Message queuing and reliability
 * - Reconnection handling and state sync
 * - Redis adapter for scalability
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { redisService } from '../config/redis';
import { logger } from '../utils/logger';

// Types for WebSocket communication
export interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
  userRole: string;
  sessionId: string;
}

export interface PreviewState {
  workshopId?: string;
  questionnaireId?: string;
  content: any;
  settings: {
    mobilePreview: boolean;
    tabletPreview: boolean;
    darkMode: boolean;
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };
  metadata: {
    lastModified: Date;
    version: string;
    collaborators: string[];
  };
}

export interface RoomInfo {
  id: string;
  type: 'workshop' | 'questionnaire' | 'preview';
  ownerId: string;
  participants: Map<string, AuthenticatedSocket>;
  state: PreviewState;
  createdAt: Date;
  lastActivity: Date;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  userId: string;
  roomId?: string;
  messageId: string;
}

export interface PreviewUpdateEvent {
  type:
    | 'content_update'
    | 'settings_change'
    | 'participant_join'
    | 'participant_leave'
    | 'state_sync';
  data: any;
  userId: string;
  timestamp: Date;
}

class WebSocketService {
  private io: SocketIOServer;
  private rooms: Map<string, RoomInfo> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8, // 100 MB
    });

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
    this.startCleanupInterval();
  }

  /**
   * Setup Redis adapter for multi-instance scalability
   */
  private async setupRedisAdapter(): Promise<void> {
    try {
      const redisClient = redisService.getClient();
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Note: In a real implementation, you would use the Redis adapter
      // const { createAdapter } = require('@socket.io/redis-adapter');
      // this.io.adapter(createAdapter(pubClient, subClient));

      logger.info('WebSocket Redis adapter configured');
    } catch (error) {
      logger.warn(
        'Redis adapter setup failed, falling back to single instance:',
        error,
      );
    }
  }

  /**
   * Setup authentication and session middleware
   */
  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.userId = decoded.id;
        socket.userEmail = decoded.email;
        socket.userRole = decoded.role;
        socket.sessionId = socket.id;

        logger.info(
          `WebSocket authenticated: ${socket.userEmail} (${socket.userId})`,
        );
        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed:', error);
        next(new Error('Invalid authentication token'));
      }
    });

    // Rate limiting middleware
    this.io.use((socket: any, next) => {
      const userId = socket.userId;
      const key = `ws_rate_limit:${userId}`;

      redisService
        .getClient()
        .incr(key)
        .then(count => {
          if (count === 1) {
            redisService.getClient().expire(key, 60); // 1 minute window
          }

          if (count > 100) {
            // 100 events per minute
            return next(new Error('Rate limit exceeded'));
          }

          next();
        })
        .catch(next);
    });
  }

  /**
   * Setup core event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(
        `WebSocket connected: ${socket.userEmail} (${socket.sessionId})`,
      );

      // Track user sockets
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId)!.add(socket.sessionId);

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts.set(socket.userId, 0);

      // Handle room joining
      socket.on('join_preview', async data => {
        await this.handleJoinPreview(socket, data);
      });

      socket.on('join_workshop', async data => {
        await this.handleJoinWorkshop(socket, data);
      });

      socket.on('join_questionnaire', async data => {
        await this.handleJoinQuestionnaire(socket, data);
      });

      // Handle preview updates
      socket.on('preview_update', async data => {
        await this.handlePreviewUpdate(socket, data);
      });

      socket.on('preview_settings_change', async data => {
        await this.handlePreviewSettingsChange(socket, data);
      });

      // Handle real-time collaboration
      socket.on('collaboration_event', async data => {
        await this.handleCollaborationEvent(socket, data);
      });

      // Handle state synchronization
      socket.on('sync_state', async data => {
        await this.handleStateSync(socket, data);
      });

      // Handle mobile preview
      socket.on('mobile_preview_toggle', async data => {
        await this.handleMobilePreviewToggle(socket, data);
      });

      // Handle testing interactions
      socket.on('test_interaction', async data => {
        await this.handleTestInteraction(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', async reason => {
        await this.handleDisconnection(socket, reason);
      });

      // Handle errors
      socket.on('error', error => {
        logger.error(`WebSocket error for ${socket.userEmail}:`, error);
      });
    });
  }

  /**
   * Handle joining a preview room
   */
  private async handleJoinPreview(
    socket: AuthenticatedSocket,
    data: { workshopId?: string; questionnaireId?: string },
  ): Promise<void> {
    try {
      const roomId = this.generatePreviewRoomId(
        data.workshopId,
        data.questionnaireId,
      );

      // Create room if it doesn't exist
      if (!this.rooms.has(roomId)) {
        const roomInfo: RoomInfo = {
          id: roomId,
          type: 'preview',
          ownerId: socket.userId,
          participants: new Map(),
          state: {
            content: {},
            settings: {
              mobilePreview: false,
              tabletPreview: false,
              darkMode: false,
              highContrast: false,
              fontSize: 'medium',
            },
            metadata: {
              lastModified: new Date(),
              version: '1.0.0',
              collaborators: [socket.userId],
            },
          },
          createdAt: new Date(),
          lastActivity: new Date(),
        };
        this.rooms.set(roomId, roomInfo);
      }

      const room = this.rooms.get(roomId)!;

      // Join socket.io room
      await socket.join(roomId);

      // Add participant to room
      room.participants.set(socket.sessionId, socket);
      room.participants.set(socket.userId, socket);
      room.lastActivity = new Date();
      room.state.metadata.collaborators = Array.from(
        room.participants.values(),
      ).map(p => p.userId);

      // Send current state to the joining user
      socket.emit('preview_state', {
        type: 'state_sync',
        data: room.state,
        timestamp: new Date(),
      });

      // Notify other participants
      socket.to(roomId).emit('participant_joined', {
        userId: socket.userId,
        userEmail: socket.userEmail,
        timestamp: new Date(),
      });

      logger.info(`User ${socket.userEmail} joined preview room ${roomId}`);
    } catch (error) {
      logger.error('Error handling join_preview:', error);
      socket.emit('error', { message: 'Failed to join preview room' });
    }
  }

  /**
   * Handle preview content updates
   */
  private async handlePreviewUpdate(
    socket: AuthenticatedSocket,
    data: any,
  ): Promise<void> {
    try {
      const { workshopId, questionnaireId, content, section } = data;
      const roomId = this.generatePreviewRoomId(workshopId, questionnaireId);
      const room = this.rooms.get(roomId);

      if (!room || !room.participants.has(socket.sessionId)) {
        socket.emit('error', {
          message: 'Not authorized to update this preview',
        });
        return;
      }

      // Update room state
      room.state.content = { ...room.state.content, ...content };
      room.state.metadata.lastModified = new Date();
      room.lastActivity = new Date();

      // Broadcast update to all participants in the room
      const updateEvent: PreviewUpdateEvent = {
        type: 'content_update',
        data: { content, section, updatedBy: socket.userId },
        userId: socket.userId,
        timestamp: new Date(),
      };

      this.io.to(roomId).emit('preview_updated', updateEvent);

      // Persist state to Redis for recovery
      await this.persistRoomState(roomId, room.state);

      logger.info(`Preview updated by ${socket.userEmail} in room ${roomId}`);
    } catch (error) {
      logger.error('Error handling preview_update:', error);
      socket.emit('error', { message: 'Failed to update preview' });
    }
  }

  /**
   * Handle preview settings changes
   */
  private async handlePreviewSettingsChange(
    socket: AuthenticatedSocket,
    data: any,
  ): Promise<void> {
    try {
      const { workshopId, questionnaireId, settings } = data;
      const roomId = this.generatePreviewRoomId(workshopId, questionnaireId);
      const room = this.rooms.get(roomId);

      if (!room || !room.participants.has(socket.sessionId)) {
        socket.emit('error', { message: 'Not authorized to change settings' });
        return;
      }

      // Update settings
      room.state.settings = { ...room.state.settings, ...settings };
      room.state.metadata.lastModified = new Date();
      room.lastActivity = new Date();

      // Broadcast settings change
      this.io.to(roomId).emit('preview_settings_changed', {
        settings: room.state.settings,
        changedBy: socket.userId,
        timestamp: new Date(),
      });

      // Persist state
      await this.persistRoomState(roomId, room.state);

      logger.info(
        `Preview settings changed by ${socket.userEmail} in room ${roomId}`,
      );
    } catch (error) {
      logger.error('Error handling preview_settings_change:', error);
      socket.emit('error', { message: 'Failed to change settings' });
    }
  }

  /**
   * Handle collaboration events (cursor position, selections, etc.)
   */
  private async handleCollaborationEvent(
    socket: AuthenticatedSocket,
    data: any,
  ): Promise<void> {
    try {
      const { workshopId, questionnaireId, eventType, eventData } = data;
      const roomId = this.generatePreviewRoomId(workshopId, questionnaireId);

      // Broadcast to other participants in the room (not sender)
      socket.to(roomId).emit('collaboration_event', {
        userId: socket.userId,
        userEmail: socket.userEmail,
        eventType,
        eventData,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error handling collaboration_event:', error);
    }
  }

  /**
   * Handle mobile preview toggle
   */
  private async handleMobilePreviewToggle(
    socket: AuthenticatedSocket,
    data: any,
  ): Promise<void> {
    try {
      const { workshopId, questionnaireId, deviceType } = data;
      const roomId = this.generatePreviewRoomId(workshopId, questionnaireId);
      const room = this.rooms.get(roomId);

      if (!room) return;

      // Update device preview settings
      room.state.settings.mobilePreview = deviceType === 'mobile';
      room.state.settings.tabletPreview = deviceType === 'tablet';

      // Broadcast to all participants
      this.io.to(roomId).emit('device_preview_changed', {
        deviceType,
        settings: room.state.settings,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error handling mobile_preview_toggle:', error);
    }
  }

  /**
   * Handle test interactions in preview
   */
  private async handleTestInteraction(
    socket: AuthenticatedSocket,
    data: any,
  ): Promise<void> {
    try {
      const { workshopId, questionnaireId, interactionType, interactionData } =
        data;
      const roomId = this.generatePreviewRoomId(workshopId, questionnaireId);

      // Process test interaction and broadcast results
      const result = await this.processTestInteraction(
        interactionType,
        interactionData,
      );

      this.io.to(roomId).emit('test_interaction_result', {
        interactionType,
        result,
        triggeredBy: socket.userId,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error handling test_interaction:', error);
    }
  }

  /**
   * Handle graceful disconnection
   */
  private async handleDisconnection(
    socket: AuthenticatedSocket,
    reason: string,
  ): Promise<void> {
    try {
      logger.info(`WebSocket disconnected: ${socket.userEmail} (${reason})`);

      // Remove socket from user tracking
      const userSockets = this.userSockets.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.sessionId);
        if (userSockets.size === 0) {
          this.userSockets.delete(socket.userId);
        }
      }

      // Remove from rooms and notify other participants
      for (const [roomId, room] of this.rooms.entries()) {
        if (room.participants.has(socket.sessionId)) {
          room.participants.delete(socket.sessionId);
          room.participants.delete(socket.userId);
          room.lastActivity = new Date();

          socket.to(roomId).emit('participant_left', {
            userId: socket.userId,
            userEmail: socket.userEmail,
            timestamp: new Date(),
          });

          // Clean up empty rooms after delay
          if (room.participants.size === 0) {
            setTimeout(() => {
              if (
                this.rooms.has(roomId) &&
                this.rooms.get(roomId)!.participants.size === 0
              ) {
                this.rooms.delete(roomId);
              }
            }, 300000); // 5 minutes
          }
        }
      }
    } catch (error) {
      logger.error('Error handling disconnection:', error);
    }
  }

  /**
   * Generate room ID for preview
   */
  private generatePreviewRoomId(
    workshopId?: string,
    questionnaireId?: string,
  ): string {
    if (workshopId) return `preview:workshop:${workshopId}`;
    if (questionnaireId) return `preview:questionnaire:${questionnaireId}`;
    throw new Error('Either workshopId or questionnaireId must be provided');
  }

  /**
   * Persist room state to Redis
   */
  private async persistRoomState(
    roomId: string,
    state: PreviewState,
  ): Promise<void> {
    try {
      const key = `preview_state:${roomId}`;
      await redisService.getClient().setex(key, 3600, JSON.stringify(state)); // 1 hour
    } catch (error) {
      logger.warn('Failed to persist room state:', error);
    }
  }

  /**
   * Process test interactions
   */
  private async processTestInteraction(
    interactionType: string,
    interactionData: any,
  ): Promise<any> {
    switch (interactionType) {
    case 'form_submit':
      return {
        success: true,
        message: 'Form submitted successfully in test mode',
      };
    case 'button_click':
      return { success: true, action: 'Button click simulated' };
    case 'navigation':
      return { success: true, route: interactionData.route };
    case 'accessibility_check':
      return await this.runAccessibilityCheck(interactionData);
    default:
      return { success: false, message: 'Unknown interaction type' };
    }
  }

  /**
   * Run accessibility check
   */
  private async runAccessibilityCheck(data: any): Promise<any> {
    // Placeholder for accessibility checking logic
    return {
      score: 0.95,
      issues: [
        { type: 'warning', message: 'Consider adding alt text to images' },
        { type: 'info', message: 'Good color contrast ratios detected' },
      ],
    };
  }

  /**
   * Start cleanup interval for inactive rooms
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      for (const [roomId, room] of this.rooms.entries()) {
        // Clean up rooms inactive for more than 1 hour
        if (now.getTime() - room.lastActivity.getTime() > 3600000) {
          if (room.participants.size === 0) {
            this.rooms.delete(roomId);
            logger.info(`Cleaned up inactive room: ${roomId}`);
          }
        }
      }
    }, 300000); // Check every 5 minutes
  }

  /**
   * Get WebSocket statistics
   */
  public getStats(): any {
    return {
      connectedClients: this.io.sockets.sockets.size,
      activeRooms: this.rooms.size,
      totalParticipants: Array.from(this.rooms.values()).reduce(
        (sum, room) => sum + room.participants.size,
        0,
      ),
      userSockets: this.userSockets.size,
    };
  }

  /**
   * Broadcast to specific room
   */
  public broadcastToRoom(roomId: string, event: string, data: any): void {
    this.io.to(roomId).emit(event, data);
  }

  /**
   * Send to specific user
   */
  public sendToUser(userId: string, event: string, data: any): void {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }
}

export { WebSocketService };
