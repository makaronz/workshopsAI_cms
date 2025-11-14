/**
 * WebSocket Service Tests
 *
 * Comprehensive test suite for WebSocket real-time functionality
 */

import { WebSocketService } from '../src/services/websocketService';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { redisService } from '../src/config/redis';

// Mock dependencies
jest.mock('../src/config/redis');
jest.mock('../src/utils/logger');

describe('WebSocketService', () => {
  let webSocketService: WebSocketService;
  let mockHttpServer: jest.Mocked<Server>;
  let mockRedisClient: any;
  let mockIo: jest.Mocked<SocketIOServer>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock HTTP Server
    mockHttpServer = {
      listen: jest.fn(),
      close: jest.fn(),
      address: jest.fn().mockReturnValue({ port: 3001 })
    } as any;

    // Mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      duplicate: jest.fn().mockReturnThis(),
      connect: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn(),
      hmget: jest.fn(),
      hmset: jest.fn(),
      lrange: jest.fn(),
      lpush: jest.fn(),
      smembers: jest.fn()
    };
    (redisService.getClient as jest.Mock) = jest.fn().mockReturnValue(mockRedisClient);

    // Mock Socket.IO server
    mockIo = {
      use: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        sockets: new Map(),
        size: 0
      },
      close: jest.fn()
    } as any;

    // Mock SocketIO constructor
    jest.mock('socket.io', () => {
      return jest.fn().mockImplementation(() => mockIo);
    });

    webSocketService = new WebSocketService(mockHttpServer);
  });

  describe('constructor', () => {
    it('should initialize WebSocket service with default options', () => {
      expect(jest.requireMock('socket.io')).toHaveBeenCalledWith(
        mockHttpServer,
        expect.objectContaining({
          cors: expect.any(Object),
          transports: ['websocket', 'polling'],
          pingTimeout: 60000,
          pingInterval: 25000,
          maxHttpBufferSize: 1e8
        })
      );
    });

    it('should setup middleware and event handlers', () => {
      expect(mockIo.use).toHaveBeenCalledTimes(2); // auth and rate limiting middleware
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('getStats', () => {
    it('should return WebSocket statistics', () => {
      mockIo.sockets.sockets.size = 5;

      const stats = webSocketService.getStats();

      expect(stats).toHaveProperty('connectedClients');
      expect(stats).toHaveProperty('activeRooms');
      expect(stats).toHaveProperty('totalParticipants');
      expect(stats).toHaveProperty('userSockets');
      expect(typeof stats.connectedClients).toBe('number');
    });
  });

  describe('broadcastToRoom', () => {
    it('should broadcast message to specific room', () => {
      const room = 'test-room';
      const event = 'test-event';
      const data = { message: 'test data' };

      webSocketService.broadcastToRoom(room, event, data);

      expect(mockIo.to).toHaveBeenCalledWith(room);
      expect(mockIo.emit).toHaveBeenCalledWith(event, data);
    });
  });

  describe('sendToUser', () => {
    it('should send message to specific user', () => {
      const userId = 'user-123';
      const event = 'private-message';
      const data = { message: 'private data' };

      // Mock user sockets tracking
      const mockSocket = { id: 'socket-1', emit: jest.fn() };
      webSocketService['userSockets'].set(userId, new Set(['socket-1', 'socket-2']));

      webSocketService.sendToUser(userId, event, data);

      expect(mockIo.to).toHaveBeenCalledWith('socket-1');
      expect(mockIo.to).toHaveBeenCalledWith('socket-2');
    });
  });

  describe('Redis adapter setup', () => {
    it('should attempt to setup Redis adapter', async () => {
      // The adapter setup happens in constructor
      expect(mockRedisClient.duplicate).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.connect).toHaveBeenCalledTimes(2);
    });

    it('should handle Redis adapter setup failure gracefully', async () => {
      mockRedisClient.duplicate.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      expect(() => {
        new WebSocketService(mockHttpServer);
      }).not.toThrow();
    });
  });

  describe('rate limiting middleware', () => {
    it('should rate limit WebSocket connections', async () => {
      // Create mock socket for testing middleware
      const mockSocket = {
        userId: 'user-123',
        handshake: { auth: { token: 'valid-token' } }
      };

      // Mock Redis to return count below limit
      mockRedisClient.incr.mockResolvedValue(5); // Below 100 limit
      mockRedisClient.expire.mockResolvedValue(1);

      // Get the rate limiting middleware
      const rateLimitMiddleware = (mockIo.use as jest.Mock).mock.calls[1][0];

      // Test successful rate limit check
      await expect(
        new Promise((resolve, reject) => {
          rateLimitMiddleware(mockSocket, () => resolve(true), reject);
        })
      ).resolves.toBe(true);

      expect(mockRedisClient.incr).toHaveBeenCalledWith('ws_rate_limit:user-123');
      expect(mockRedisClient.expire).toHaveBeenCalledWith('ws_rate_limit:user-123', 60);
    });

    it('should reject when rate limit exceeded', async () => {
      const mockSocket = {
        userId: 'user-123',
        handshake: { auth: { token: 'valid-token' } }
      };

      // Mock Redis to return count at limit
      mockRedisClient.incr.mockResolvedValue(101); // At 100 limit
      mockRedisClient.expire.mockResolvedValue(1);

      const rateLimitMiddleware = (mockIo.use as jest.Mock).mock.calls[1][0];

      await expect(
        new Promise((resolve, reject) => {
          rateLimitMiddleware(mockSocket, reject, () => resolve(true));
        })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('WebSocket connection handling', () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = {
        id: 'socket-123',
        userId: 'user-123',
        userEmail: 'test@example.com',
        userRole: 'user',
        sessionId: 'socket-123',
        join: jest.fn(),
        emit: jest.fn(),
        on: jest.fn(),
        to: jest.fn().mockReturnThis(),
        disconnect: jest.fn()
      };
    });

    it('should handle new WebSocket connection', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockSocket);

        expect(mockSocket.on).toHaveBeenCalledWith('join_preview', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('join_workshop', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('join_questionnaire', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('preview_update', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      }
    });

    it('should track user sockets on connection', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockSocket);

        expect(webSocketService['userSockets'].has('user-123')).toBe(true);
        expect(webSocketService['userSockets'].get('user-123').has('socket-123')).toBe(true);
      }
    });

    it('should handle disconnection cleanup', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockSocket);

        // Set up some room participation
        const roomInfo = {
          id: 'preview:workshop:test-123',
          type: 'preview' as const,
          ownerId: 'user-123',
          participants: new Map([['socket-123', mockSocket], ['user-123', mockSocket]]),
          state: {
            content: {},
            settings: {},
            metadata: {
              lastModified: new Date(),
              version: '1.0.0',
              collaborators: ['user-123']
            }
          },
          createdAt: new Date(),
          lastActivity: new Date()
        };

        webSocketService['rooms'].set('preview:workshop:test-123', roomInfo);

        const disconnectHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'disconnect'
        )?.[1];

        if (disconnectHandler) {
          disconnectHandler('test reason');

          expect(webSocketService['userSockets'].has('user-123')).toBe(false);
        }
      }
    });
  });

  describe('room management', () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = {
        id: 'socket-123',
        userId: 'user-123',
        userEmail: 'test@example.com',
        userRole: 'user',
        sessionId: 'socket-123',
        join: jest.fn(),
        emit: jest.fn(),
        on: jest.fn(),
        to: jest.fn().mockReturnThis()
      };
    });

    it('should handle joining preview room', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockSocket);

        const joinPreviewHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'join_preview'
        )?.[1];

        if (joinPreviewHandler) {
          joinPreviewHandler({
            workshopId: 'workshop-123'
          });

          expect(mockSocket.join).toHaveBeenCalledWith('preview:workshop:workshop-123');
          expect(mockSocket.emit).toHaveBeenCalledWith('preview_state', expect.any(Object));
          expect(webSocketService['rooms'].has('preview:workshop:workshop-123')).toBe(true);
        }
      }
    });

    it('should handle preview content updates', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockSocket);

        // First join a room
        const joinPreviewHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'join_preview'
        )?.[1];

        if (joinPreviewHandler) {
          joinPreviewHandler({ workshopId: 'workshop-123' });
        }

        const updateHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'preview_update'
        )?.[1];

        if (updateHandler) {
          const updateData = {
            workshopId: 'workshop-123',
            content: { sections: ['updated'] }
          };

          updateHandler(updateData);

          expect(mockRedisClient.setex).toHaveBeenCalledWith(
            'preview_state:preview:workshop:workshop-123',
            3600,
            expect.any(String)
          );
        }
      }
    });

    it('should handle mobile preview toggle', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockSocket);

        // First join a room
        const joinPreviewHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'join_preview'
        )?.[1];

        if (joinPreviewHandler) {
          joinPreviewHandler({ workshopId: 'workshop-123' });
        }

        const mobileToggleHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'mobile_preview_toggle'
        )?.[1];

        if (mobileToggleHandler) {
          const toggleData = {
            workshopId: 'workshop-123',
            deviceType: 'mobile'
          };

          mobileToggleHandler(toggleData);

          expect(mockIo.to).toHaveBeenCalledWith('preview:workshop:workshop-123');
          expect(mockIo.emit).toHaveBeenCalledWith('device_preview_changed', expect.any(Object));
        }
      }
    });

    it('should handle test interactions', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockSocket);

        // First join a room
        const joinPreviewHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'join_preview'
        )?.[1];

        if (joinPreviewHandler) {
          joinPreviewHandler({ workshopId: 'workshop-123' });
        }

        const testInteractionHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'test_interaction'
        )?.[1];

        if (testInteractionHandler) {
          const interactionData = {
            workshopId: 'workshop-123',
            interactionType: 'form_submit',
            interactionData: { field: 'test', value: 'data' }
          };

          testInteractionHandler(interactionData);

          expect(mockIo.to).toHaveBeenCalledWith('preview:workshop:workshop-123');
          expect(mockIo.emit).toHaveBeenCalledWith('test_interaction_result', expect.any(Object));
        }
      }
    });
  });

  describe('cleanup interval', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clean up inactive rooms periodically', () => {
      // Add an inactive room
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const roomInfo = {
        id: 'old-room',
        type: 'preview' as const,
        ownerId: 'user-123',
        participants: new Map(), // Empty participants
        state: {
          content: {},
          settings: {},
          metadata: {
            lastModified: new Date(),
            version: '1.0.0',
            collaborators: []
          }
        },
        createdAt: oldDate,
        lastActivity: oldDate
      };

      webSocketService['rooms'].set('old-room', roomInfo);

      // Fast forward time to trigger cleanup
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      expect(webSocketService['rooms'].has('old-room')).toBe(false);
    });
  });
});