import { Express } from 'express';
import { Server } from 'http';
import { WebSocketService } from '../services/websocketService';
import { PreviewService } from '../services/previewService';
import { initializePerformanceSystem, PerformanceSystem } from './performance-integration';
import { DatabaseOptimizationIntegration } from '../services/database-optimization-integration';
import { StreamingLLMAnalysisWorker } from '../services/streaming-llm-worker';
import { getLLMAnalysisWorker } from '../services/llm-worker';
import { initializePreviewRoutes } from '../routes/api/preview';

export interface ServiceContainer {
  webSocketService: WebSocketService | null;
  previewService: PreviewService | null;
  performanceSystem: PerformanceSystem | null;
  dbOptimization: DatabaseOptimizationIntegration | null;
  streamingWorker: StreamingLLMAnalysisWorker | null;
  llmAnalysisWorker: ReturnType<typeof getLLMAnalysisWorker> | null;
}

export const initializeServices = async (app: Express, server: Server): Promise<ServiceContainer> => {
  const container: ServiceContainer = {
    webSocketService: null,
    previewService: null,
    performanceSystem: null,
    dbOptimization: null,
    streamingWorker: null,
    llmAnalysisWorker: null,
  };

  // Initialize Performance Optimization Services
  try {
    console.log('⚡ Initializing Performance Optimization System...');
    container.performanceSystem = await initializePerformanceSystem(app, server);
    console.log('✅ Performance Optimization System initialized');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to initialize Performance System:', message);
  }

  // Initialize Database Optimization
  try {
    console.log('🗄️ Initializing Database Optimization System...');
    container.dbOptimization = new DatabaseOptimizationIntegration();
    await container.dbOptimization.initialize();
    console.log('✅ Database Optimization System initialized');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to initialize Database Optimization:', message);
  }

  // Initialize LLM Workers
  try {
    console.log('🚀 Initializing LLM Analysis Worker...');
    container.llmAnalysisWorker = getLLMAnalysisWorker();
    console.log('✅ LLM Analysis Worker initialized');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to initialize LLM Analysis Worker:', message);
  }

  try {
    console.log('🚀 Initializing Streaming LLM Worker...');
    container.streamingWorker = new StreamingLLMAnalysisWorker();
    await container.streamingWorker.initialize();
    console.log('✅ Streaming LLM Worker initialized');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to initialize Streaming LLM Worker:', message);
  }

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

  if (container.performanceSystem) {
    shutdownPromises.push(
      Promise.resolve()
        .then(() => container.performanceSystem!.shutdown())
        .catch(err => console.error('Error shutting down Performance System:', err))
    );
  }

  if (container.dbOptimization) {
    shutdownPromises.push(
      Promise.resolve()
        .then(() => container.dbOptimization!.shutdown())
        .catch(err => console.error('Error shutting down Database Optimization:', err))
    );
  }
  
  if (container.streamingWorker) {
    shutdownPromises.push(
      Promise.resolve()
        .then(() => container.streamingWorker!.shutdown())
        .catch(err => console.error('Error shutting down Streaming LLM Worker:', err))
    );
  }

  if (container.llmAnalysisWorker) {
    shutdownPromises.push(
      Promise.resolve()
        .then(() => container.llmAnalysisWorker!.shutdown())
        .catch(err => console.error('Error shutting down LLM Analysis Worker:', err))
    );
  }

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
