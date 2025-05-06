import cors from "cors";
import express from "express";

import { config } from "@/config/index.js";
import { initializeDatabase } from "@/database/index.js";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import errorHandler from "@/middleware/errorHandler.js";
import { rateLimiterMiddleware } from "@/middleware/rate-limiter.middleware.js";
// Import routes
import * as accountRoutes from "@/routes/account.routes.js";
import * as adminRoutes from "@/routes/admin.routes.js";
import * as competitionRoutes from "@/routes/competition.routes.js";
import * as docsRoutes from "@/routes/docs.routes.js";
import * as healthRoutes from "@/routes/health.routes.js";
import * as priceRoutes from "@/routes/price.routes.js";
import * as publicRoutes from "@/routes/public.routes.js";
import * as tradeRoutes from "@/routes/trade.routes.js";
import { services } from "@/services/index.js";

// Import the console interceptor instead of the logger
import { interceptConsole } from "./utils/console-interceptor.js";

// Initialize console interception immediately
interceptConsole();

// Create Express app
const app = express();

// Get base route prefix from environment or use default
const API_PREFIX = process.env.API_PREFIX || "testing-grounds";
const apiBasePath = `/${API_PREFIX}`;

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define protected routes
const protectedRoutes = [
  `${apiBasePath}/api/account`,
  `${apiBasePath}/api/trade`,
  `${apiBasePath}/api/competition`,
  `${apiBasePath}/api/price`,
];

// Apply authentication middleware to protected routes FIRST
// This ensures req.teamId is set before rate limiting
app.use(
  protectedRoutes,
  authMiddleware(services.teamManager, services.competitionManager),
);

// Apply rate limiting middleware AFTER authentication
// This ensures we can properly rate limit by team ID
app.use(rateLimiterMiddleware);

// Create a router for all API routes
const apiRouter = express.Router();

// Apply routes to the apiRouter
apiRouter.use("/api/account", accountRoutes.default);
apiRouter.use("/api/trade", tradeRoutes.default);
apiRouter.use("/api/price", priceRoutes.default);
apiRouter.use("/api/competition", competitionRoutes.default);
apiRouter.use("/api/admin", adminRoutes.default);
apiRouter.use("/api/health", healthRoutes.default);
apiRouter.use("/api/docs", docsRoutes.default);
apiRouter.use("/api/public", publicRoutes.default);

// Legacy health check endpoint for backward compatibility
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Root endpoint redirects to API documentation
apiRouter.get("/", (_req, res) => {
  res.redirect(`${apiBasePath}/api/docs`);
});

// Mount the apiRouter under the prefix
app.use(apiBasePath, apiRouter);

// Apply error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  const PORT = config.server.port;
  let databaseInitialized = false;

  try {
    // Initialize database
    console.log("Checking database connection...");
    await initializeDatabase();
    console.log("Database connection and schema verification completed");
    databaseInitialized = true;

    // Load competition-specific configuration settings
    await services.configurationService.loadCompetitionSettings();
    console.log("Competition-specific configuration settings loaded");

    // Start snapshot scheduler
    services.scheduler.startSnapshotScheduler();
    console.log("Portfolio snapshot scheduler started");
  } catch (error) {
    console.error("Database initialization error:", error);
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "WARNING: Starting server without successful database initialization. " +
          "Some functionality may be limited until database connection is restored.",
      );
    } else {
      console.error(
        "Failed to start server due to database initialization error. Exiting...",
      );
      process.exit(1);
    }
  }

  // Start HTTP server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n========================================`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${config.server.nodeEnv}`);
    console.log(`API Prefix: ${apiBasePath}`);
    console.log(
      `Database: ${databaseInitialized ? "Connected" : "Error - Limited functionality"}`,
    );
    console.log(
      `API documentation: http://localhost:${PORT}${apiBasePath}/api/docs`,
    );
    console.log(`========================================\n`);
  });
};

// Start the server
startServer();

export default app;
