import { Express } from 'express';
import { Server } from 'http';
import { WebSocketService } from '../services/websocketService';
import { PreviewService } from '../services/previewService';
import { initializePerformanceSystem } from './performance-integration';
import { DatabaseOptimizationIntegration } from '../services/database-optimization-integration';
import { StreamingLLMAnalysisWorker } from '../services/streaming-llm-worker';
import { getLLMAnalysisWorker } from '../services/llm-worker';
import { initializePreviewRoutes } from '../routes/api/preview';

export interface ServiceContainer {
  webSocketService: WebSocketService | null;
  previewService: PreviewService | null;
  performanceSystem: any;
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
  } catch (error: any) {
    console.error('❌ Failed to initialize Performance System:', error.message);
  }

  // Initialize Database Optimization
  try {
    console.log('🗄️ Initializing Database Optimization System...');
    container.dbOptimization = new DatabaseOptimizationIntegration();
    await container.dbOptimization.initialize();
    console.log('✅ Database Optimization System initialized');
  } catch (error: any) {
    console.error('❌ Failed to initialize Database Optimization:', error.message);
  }

  // Initialize LLM Workers
  try {
    console.log('🚀 Initializing LLM Analysis Worker...');
    container.llmAnalysisWorker = getLLMAnalysisWorker();
    console.log('✅ LLM Analysis Worker initialized');
  } catch (error: any) {
    console.error('❌ Failed to initialize LLM Analysis Worker:', error.message);
  }

  try {
    console.log('🚀 Initializing Streaming LLM Worker...');
    container.streamingWorker = new StreamingLLMAnalysisWorker();
    await container.streamingWorker.initialize();
    console.log('✅ Streaming LLM Worker initialized');
  } catch (error: any) {
    console.error('❌ Failed to initialize Streaming LLM Worker:', error.message);
  }

  // Initialize WebSocket and Preview
  try {
    console.log('🔌 Initializing WebSocket service...');
    container.webSocketService = new WebSocketService(server);
    console.log('✅ WebSocket service initialized');
  } catch (error: any) {
    console.error('❌ Failed to initialize WebSocket service:', error.message);
  }

  try {
    console.log('👁️ Initializing Preview service...');
    if (container.webSocketService) {
      container.previewService = new PreviewService(container.webSocketService);
      console.log('✅ Preview service initialized');
    } else {
      console.log('⚠️  Preview service skipped (WebSocket not available)');
    }
  } catch (error: any) {
    console.error('❌ Failed to initialize Preview service:', error.message);
  }

  // Initialize Routes that depend on services
  if (container.previewService) {
    try {
      console.log('🛣️ Initializing Preview routes...');
      const previewRouter = initializePreviewRoutes(container.previewService);
      app.use('/api/v1/preview', previewRouter);
      console.log('✅ Preview routes initialized');
    } catch (error: any) {
      console.error('❌ Failed to initialize Preview routes:', error.message);
    }
  }

  return container;
};

export const shutdownServices = async (container: ServiceContainer) => {
  console.log('🔄 Shutting down services...');
  
  if (container.dbOptimization) {
    await container.dbOptimization.shutdown();
  }
  
  if (container.streamingWorker) {
    await container.streamingWorker.shutdown();
  }

  if (container.llmAnalysisWorker) {
    await container.llmAnalysisWorker.shutdown();
  }
};
