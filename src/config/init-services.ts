import { Express } from 'express';
import { Server } from 'http';
import { WebSocketService } from '../services/websocketService';
import { PreviewService } from '../services/previewService';
import { initializePreviewRoutes } from '../routes/api/preview';

export interface ServiceContainer {
  webSocketService: WebSocketService | null;
  previewService: PreviewService | null;
}

export const initializeServices = async (app: Express, server: Server): Promise<ServiceContainer> => {
  const container: ServiceContainer = {
    webSocketService: null,
    previewService: null,
  };

  // Initialize WebSocket and Preview
  try {
    console.log('🔌 Initializing WebSocket service...');
    container.webSocketService = new WebSocketService(server);
    console.log('✅ WebSocket service initialized');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to initialize WebSocket service:', message);
  }

  try {
    console.log('👁️ Initializing Preview service...');
    if (container.webSocketService) {
      container.previewService = new PreviewService(container.webSocketService);
      console.log('✅ Preview service initialized');
    } else {
      console.log('⚠️  Preview service skipped (WebSocket not available)');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to initialize Preview service:', message);
  }

  // Initialize Routes that depend on services
  if (container.previewService) {
    try {
      console.log('🛣️ Initializing Preview routes...');
      const previewRouter = initializePreviewRoutes(container.previewService);
      app.use('/api/v1/preview', previewRouter);
      console.log('✅ Preview routes initialized');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to initialize Preview routes:', message);
    }
  }

  return container;
};

export const shutdownServices = async (container: ServiceContainer) => {
  console.log('🔄 Shutting down services...');
  
  const shutdownPromises = [];

  if (container.webSocketService) {
    shutdownPromises.push(
      Promise.resolve()
        .then(() => container.webSocketService!.shutdown())
        .catch(err => console.error('Error shutting down WebSocket Service:', err))
    );
  }

  // Use Promise.allSettled to ensure all shutdowns are attempted
  await Promise.allSettled(shutdownPromises);
  console.log('✅ Services shutdown sequence completed');
};
