import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { eq, and } from 'drizzle-orm';
import { enhancedLLMAnalysisWorker } from './enhanced-llm-worker';
import {
  analysisJobs,
  llmAnalyses,
  questionnaires,
  users,
} from '../models/llm-schema';
import { logger } from '../utils/logger';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
}

export class AnalysisWebSocketService {
  private io: SocketIOServer;
  private jobSubscriptions: Map<string, Set<string>> = new Map();
  private progressIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupAuthentication();
    this.setupEventHandlers();
    this.startProgressMonitoring();
  }

  /**
   * Setup JWT authentication for WebSocket connections
   */
  private setupAuthentication(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        // Verify user exists
        const user = await db.query.users.findFirst({
          where: eq(users.id, decoded.userId),
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.userEmail = user.email;
        next();

      } catch (error) {
        logger.warn('WebSocket authentication failed', { error: error.message });
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info('WebSocket client connected', {
        userId: socket.userId,
        socketId: socket.id,
      });

      // Handle job subscription
      socket.on('subscribe-job', async (data: { jobId: string }) => {
        await this.handleJobSubscription(socket, data);
      });

      // Handle job unsubscription
      socket.on('unsubscribe-job', (data: { jobId: string }) => {
        await this.handleJobUnsubscription(socket, data);
      });

      // Handle questionnaire subscription
      socket.on('subscribe-questionnaire', async (data: { questionnaireId: string }) => {
        await this.handleQuestionnaireSubscription(socket, data);
      });

      // Handle questionnaire unsubscription
      socket.on('unsubscribe-questionnaire', (data: { questionnaireId: string }) => {
        await this.handleQuestionnaireUnsubscription(socket, data);
      });

      // Handle request for current status
      socket.on('get-status', async (data: { jobId?: string; questionnaireId?: string }) => {
        await this.handleStatusRequest(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
    });
  }

  /**
   * Handle job subscription
   */
  private async handleJobSubscription(socket: AuthenticatedSocket, data: { jobId: string }): Promise<void> {
    const { jobId } = data;

    try {
      // Verify user has access to the job
      const job = await db.query.analysisJobs.findFirst({
        where: and(
          eq(analysisJobs.id, jobId),
          eq(analysisJobs.triggeredBy, socket.userId),
        ),
      });

      if (!job) {
        socket.emit('error', { message: 'Job not found or access denied' });
        return;
      }

      // Add socket to job subscription list
      if (!this.jobSubscriptions.has(jobId)) {
        this.jobSubscriptions.set(jobId, new Set());
      }
      this.jobSubscriptions.get(jobId)!.add(socket.id);

      // Join socket room
      socket.join(`job-${jobId}`);

      // Send current status
      const status = await enhancedLLMAnalysisWorker.getJobStatus(jobId);
      socket.emit('job-status', {
        jobId,
        status,
        timestamp: new Date().toISOString(),
      });

      // Send related analyses
      const analyses = await db.query.llmAnalyses.findMany({
        where: eq(llmAnalyses.questionnaireId, job.questionnaireId),
        orderBy: desc(llmAnalyses.createdAt),
      });

      socket.emit('job-analyses', {
        jobId,
        analyses,
        timestamp: new Date().toISOString(),
      });

      logger.info('User subscribed to job', {
        userId: socket.userId,
        jobId,
        socketId: socket.id,
      });

    } catch (error) {
      logger.error('Error handling job subscription', { error, jobId, userId: socket.userId });
      socket.emit('error', { message: 'Failed to subscribe to job' });
    }
  }

  /**
   * Handle job unsubscription
   */
  private async handleJobUnsubscription(socket: AuthenticatedSocket, data: { jobId: string }): Promise<void> {
    const { jobId } = data;

    // Remove socket from job subscription list
    const subscriptions = this.jobSubscriptions.get(jobId);
    if (subscriptions) {
      subscriptions.delete(socket.id);
      if (subscriptions.size === 0) {
        this.jobSubscriptions.delete(jobId);
      }
    }

    // Leave socket room
    socket.leave(`job-${jobId}`);

    logger.info('User unsubscribed from job', {
      userId: socket.userId,
      jobId,
      socketId: socket.id,
    });
  }

  /**
   * Handle questionnaire subscription
   */
  private async handleQuestionnaireSubscription(socket: AuthenticatedSocket, data: { questionnaireId: string }): Promise<void> {
    const { questionnaireId } = data;

    try {
      // Verify user owns the questionnaire
      const questionnaire = await db.query.questionnaires.findFirst({
        where: and(
          eq(questionnaires.id, questionnaireId),
          eq(questionnaires.createdBy, socket.userId),
        ),
      });

      if (!questionnaire) {
        socket.emit('error', { message: 'Questionnaire not found or access denied' });
        return;
      }

      // Join questionnaire room
      socket.join(`questionnaire-${questionnaireId}`);

      // Send current analyses
      const analyses = await db.query.llmAnalyses.findMany({
        where: eq(llmAnalyses.questionnaireId, questionnaireId),
        orderBy: desc(llmAnalyses.createdAt),
      });

      socket.emit('questionnaire-analyses', {
        questionnaireId,
        analyses,
        timestamp: new Date().toISOString(),
      });

      // Send active jobs for questionnaire
      const activeJobs = await db.query.analysisJobs.findMany({
        where: and(
          eq(analysisJobs.questionnaireId, questionnaireId),
          eq(analysisJobs.triggeredBy, socket.userId),
          // @ts-ignore
          inArray(analysisJobs.status, ['queued', 'processing']),
        ),
        orderBy: desc(analysisJobs.createdAt),
      });

      socket.emit('questionnaire-jobs', {
        questionnaireId,
        jobs: activeJobs,
        timestamp: new Date().toISOString(),
      });

      logger.info('User subscribed to questionnaire', {
        userId: socket.userId,
        questionnaireId,
        socketId: socket.id,
      });

    } catch (error) {
      logger.error('Error handling questionnaire subscription', {
        error,
        questionnaireId,
        userId: socket.userId,
      });
      socket.emit('error', { message: 'Failed to subscribe to questionnaire' });
    }
  }

  /**
   * Handle questionnaire unsubscription
   */
  private async handleQuestionnaireUnsubscription(socket: AuthenticatedSocket, data: { questionnaireId: string }): Promise<void> {
    const { questionnaireId } = data;

    // Leave questionnaire room
    socket.leave(`questionnaire-${questionnaireId}`);

    logger.info('User unsubscribed from questionnaire', {
      userId: socket.userId,
      questionnaireId,
      socketId: socket.id,
    });
  }

  /**
   * Handle status request
   */
  private async handleStatusRequest(socket: AuthenticatedSocket, data: { jobId?: string; questionnaireId?: string }): Promise<void> {
    try {
      if (data.jobId) {
        // Verify user has access to the job
        const job = await db.query.analysisJobs.findFirst({
          where: and(
            eq(analysisJobs.id, data.jobId),
            eq(analysisJobs.triggeredBy, socket.userId),
          ),
        });

        if (job) {
          const status = await enhancedLLMAnalysisWorker.getJobStatus(data.jobId);
          socket.emit('job-status', {
            jobId: data.jobId,
            status,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (data.questionnaireId) {
        // Verify user owns the questionnaire
        const questionnaire = await db.query.questionnaires.findFirst({
          where: and(
            eq(questionnaires.id, data.questionnaireId),
            eq(questionnaires.createdBy, socket.userId),
          ),
        });

        if (questionnaire) {
          const analyses = await db.query.llmAnalyses.findMany({
            where: eq(llmAnalyses.questionnaireId, data.questionnaireId),
            orderBy: desc(llmAnalyses.createdAt),
          });

          const activeJobs = await db.query.analysisJobs.findMany({
            where: and(
              eq(analysisJobs.questionnaireId, data.questionnaireId),
              eq(analysisJobs.triggeredBy, socket.userId),
              // @ts-ignore
              inArray(analysisJobs.status, ['queued', 'processing']),
            ),
            orderBy: desc(analysisJobs.createdAt),
          });

          socket.emit('questionnaire-status', {
            questionnaireId: data.questionnaireId,
            analyses,
            activeJobs,
            timestamp: new Date().toISOString(),
          });
        }
      }

    } catch (error) {
      logger.error('Error handling status request', {
        error,
        data,
        userId: socket.userId,
      });
      socket.emit('error', { message: 'Failed to get status' });
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    logger.info('WebSocket client disconnected', {
      userId: socket.userId,
      socketId: socket.id,
    });

    // Clean up subscriptions
    for (const [jobId, subscriptions] of this.jobSubscriptions.entries()) {
      subscriptions.delete(socket.id);
      if (subscriptions.size === 0) {
        this.jobSubscriptions.delete(jobId);
      }
    }
  }

  /**
   * Start progress monitoring
   */
  private startProgressMonitoring(): void {
    // Monitor job progress every 5 seconds
    setInterval(async () => {
      await this.checkJobProgress();
    }, 5000);

    // Monitor queue statistics every 30 seconds
    setInterval(async () => {
      await this.broadcastQueueStats();
    }, 30000);
  }

  /**
   * Check job progress and notify subscribed clients
   */
  private async checkJobProgress(): Promise<void> {
    for (const [jobId, subscriptions] of this.jobSubscriptions.entries()) {
      if (subscriptions.size === 0) continue;

      try {
        const job = await db.query.analysisJobs.findFirst({
          where: eq(analysisJobs.id, jobId),
        });

        if (!job) continue;

        // Get current status from queue
        const status = await enhancedLLMAnalysisWorker.getJobStatus(jobId);

        // Broadcast to subscribed clients
        this.io.to(`job-${jobId}`).emit('job-progress', {
          jobId,
          progress: job.progress,
          status: job.status,
          queueStatus: status.status,
          timestamp: new Date().toISOString(),
        });

        // If job completed, get final analyses
        if (job.status === 'completed' || job.status === 'failed') {
          const analyses = await db.query.llmAnalyses.findMany({
            where: eq(llmAnalyses.questionnaireId, job.questionnaireId),
            orderBy: desc(llmAnalyses.createdAt),
          });

          this.io.to(`job-${jobId}`).emit('job-completed', {
            jobId,
            status: job.status,
            analyses,
            timestamp: new Date().toISOString(),
          });

          // Clean up subscription after completion
          setTimeout(() => {
            this.jobSubscriptions.delete(jobId);
          }, 60000); // Keep for 1 minute after completion
        }

      } catch (error) {
        logger.error('Error checking job progress', { error, jobId });
      }
    }
  }

  /**
   * Broadcast queue statistics
   */
  private async broadcastQueueStats(): Promise<void> {
    try {
      const queueStats = await enhancedLLMAnalysisWorker.getQueueStats();
      const costStats = await enhancedLLMAnalysisWorker.getCostStats();

      this.io.emit('queue-stats', {
        queue: queueStats,
        costs: costStats,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error broadcasting queue stats', { error });
    }
  }

  /**
   * Notify clients about new analysis
   */
  public notifyNewAnalysis(questionnaireId: string, analysis: any): void {
    this.io.to(`questionnaire-${questionnaireId}`).emit('new-analysis', {
      questionnaireId,
      analysis,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify clients about job status change
   */
  public notifyJobStatusChange(jobId: string, status: string, data?: any): void {
    this.io.to(`job-${jobId}`).emit('job-status-change', {
      jobId,
      status,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get active connections count
   */
  public getActiveConnectionsCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Get subscription statistics
   */
  public getSubscriptionStats(): {
    totalJobSubscriptions: number;
    jobSubscriptionDetails: Array<{ jobId: string; subscriberCount: number }>;
    } {
    const jobSubscriptionDetails: Array<{ jobId: string; subscriberCount: number }> = [];

    for (const [jobId, subscriptions] of this.jobSubscriptions.entries()) {
      jobSubscriptionDetails.push({
        jobId,
        subscriberCount: subscriptions.size,
      });
    }

    return {
      totalJobSubscriptions: Array.from(this.jobSubscriptions.values())
        .reduce((sum, set) => sum + set.size, 0),
      jobSubscriptionDetails,
    };
  }

  /**
   * Gracefully shutdown the service
   */
  public shutdown(): void {
    logger.info('Shutting down WebSocket service');
    this.io.close();
  }
}

export default AnalysisWebSocketService;
