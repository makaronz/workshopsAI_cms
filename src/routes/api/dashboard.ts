import { Router } from 'express';
import { dashboardController } from '../../controllers/dashboard-controller';
import { authenticateToken } from '../../middleware/auth';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for dashboard endpoints
const dashboardRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many dashboard requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(dashboardRateLimit);

/**
 * GET /api/dashboard/overview
 * Get dashboard overview with key metrics
 */
router.get('/overview', dashboardController.getOverview.bind(dashboardController));

/**
 * GET /api/dashboard/jobs/:jobId
 * Get detailed job information
 */
router.get('/jobs/:jobId', dashboardController.getJobDetails.bind(dashboardController));

/**
 * GET /api/dashboard/costs
 * Get cost analysis with breakdowns
 */
router.get('/costs', dashboardController.getCostAnalysis.bind(dashboardController));

/**
 * GET /api/dashboard/performance
 * Get performance metrics with detailed breakdowns
 */
router.get('/performance', dashboardController.getPerformanceMetrics.bind(dashboardController));

/**
 * GET /api/dashboard/jobs
 * Get active jobs with detailed information
 */
router.get('/jobs', dashboardController.getActiveJobs.bind(dashboardController));

/**
 * GET /api/dashboard/websockets
 * Get WebSocket connection statistics
 */
router.get('/websockets', dashboardController.getWebSocketStats.bind(dashboardController));

/**
 * GET /api/dashboard/health
 * Get system health check
 */
router.get('/health', dashboardController.getHealthCheck.bind(dashboardController));

/**
 * GET /api/dashboard/api-usage
 * Get API usage statistics
 */
router.get('/api-usage', dashboardController.getApiUsage.bind(dashboardController));

/**
 * GET /api/dashboard/exports
 * Get export statistics
 */
router.get('/exports', dashboardController.getExportStats.bind(dashboardController));

export default router;