import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss";
import { createServer } from "http";
import { config } from "dotenv";

// Import routes
import workshopRoutes from "./routes/workshops";
import enrollmentRoutes from "./routes/enrollments";

// Import configuration
import { db, checkDatabaseHealth, closeDatabaseConnection } from "./config/database";

// Load environment variables
config();

const app = express();
const server = createServer(app);

// Environment variables
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === "production" ? 100 : 1000, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (CORS_ORIGIN === "*" || CORS_ORIGIN.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Data sanitization and security
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(hpp()); // Protect against HTTP Parameter Pollution

// Custom XSS protection middleware
app.use((req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  next();
});

// Compression
app.use(compression());

// Logging
if (NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const dbHealthy = await checkDatabaseHealth();

    res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: dbHealthy ? "connected" : "disconnected",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// API routes
const API_PREFIX = "/api";

app.use(`${API_PREFIX}/workshops`, workshopRoutes);
app.use(`${API_PREFIX}/enrollments`, enrollmentRoutes);

// API documentation endpoint
app.get(`${API_PREFIX}/docs`, (req, res) => {
  res.json({
    title: "workshopsAI CMS API",
    version: "1.0.0",
    description: "RESTful API for workshop management system",
    endpoints: {
      workshops: {
        "GET /api/workshops": "List workshops with filtering",
        "GET /api/workshops/:id": "Get workshop by ID",
        "GET /api/workshops/slug/:slug": "Get workshop by slug",
        "POST /api/workshops": "Create new workshop",
        "PUT /api/workshops/:id": "Update workshop",
        "POST /api/workshops/:id/publish": "Publish workshop",
        "POST /api/workshops/:id/archive": "Archive workshop",
        "DELETE /api/workshops/:id": "Delete workshop",
        "POST /api/workshops/:id/duplicate": "Duplicate workshop",
      },
      enrollments: {
        "GET /api/enrollments": "List enrollments",
        "GET /api/enrollments/:id": "Get enrollment by ID",
        "GET /api/enrollments/history": "Get user enrollment history",
        "POST /api/enrollments": "Create enrollment",
        "PUT /api/enrollments/:id": "Update enrollment",
        "POST /api/enrollments/:id/confirm": "Confirm enrollment",
        "POST /api/enrollments/:id/cancel": "Cancel enrollment",
        "POST /api/enrollments/:id/attendance": "Mark attendance",
        "GET /api/enrollments/workshop/:workshopId/stats": "Get workshop stats",
      },
    },
    authentication: {
      type: "Bearer Token (JWT)",
      description: "Include Authorization header with Bearer token for authenticated requests",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", error);

  // Don't leak error details in production
  const isDevelopment = NODE_ENV === "development";

  res.status(error.status || 500).json({
    success: false,
    error: error.name || "Internal Server Error",
    message: error.message || "An unexpected error occurred",
    ...(isDevelopment && { stack: error.stack }),
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log("HTTP server closed.");

    try {
      await closeDatabaseConnection();
      console.log("Database connections closed.");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 30000);
};

// Handle process signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

// Start server
const startServer = async () => {
  try {
    // Check database connection
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      throw new Error("Database connection failed");
    }

    server.listen(PORT, () => {
      console.log(`\n🚀 workshopsAI CMS Server is running on port ${PORT}`);
      console.log(`📖 API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔗 CORS Origin: ${CORS_ORIGIN}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;