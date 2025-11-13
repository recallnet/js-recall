import * as Sentry from "@sentry/node";
import cors from "cors";
import express from "express";

import { ApiError } from "@recallnet/services/types";

import { config } from "@/config/index.js";
import { makeAdminController } from "@/controllers/admin.controller.js";
import { makeAgentController } from "@/controllers/agent.controller.js";
import { makeArenaController } from "@/controllers/arena.controller.js";
import { makeAuthController } from "@/controllers/auth.controller.js";
import { makeCompetitionController } from "@/controllers/competition.controller.js";
import { makeDocsController } from "@/controllers/docs.controller.js";
import { makeHealthController } from "@/controllers/health.controller.js";
import { makeLeaderboardController } from "@/controllers/leaderboard.controller.js";
import { makePriceController } from "@/controllers/price.controller.js";
import { makeRewardsController } from "@/controllers/rewards.controller.js";
import { makeTradeController } from "@/controllers/trade.controller.js";
import { makeUserController } from "@/controllers/user.controller.js";
import { closeDb, migrateDb } from "@/database/db.js";
import { apiLogger } from "@/lib/logger.js";
import { initSentry } from "@/lib/sentry.js";
import { adminAuthMiddleware } from "@/middleware/admin-auth.middleware.js";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import errorHandler from "@/middleware/errorHandler.js";
import { loggingMiddleware } from "@/middleware/logging.middleware.js";
import { optionalAuthMiddleware } from "@/middleware/optional-auth.middleware.js";
import { rateLimiterMiddleware } from "@/middleware/rate-limiter.middleware.js";
import { configureAdminSetupRoutes } from "@/routes/admin-setup.routes.js";
import { configureAdminRoutes } from "@/routes/admin.routes.js";
import { configureAgentRoutes } from "@/routes/agent.routes.js";
import { configureAgentsRoutes } from "@/routes/agents.routes.js";
import { configureArenaRoutes } from "@/routes/arena.routes.js";
import { configureAuthRoutes } from "@/routes/auth.routes.js";
import { configureCompetitionsRoutes } from "@/routes/competitions.routes.js";
import { configureDocsRoutes } from "@/routes/docs.routes.js";
import { configureHealthRoutes } from "@/routes/health.routes.js";
import { configureNflRoutes } from "@/routes/nfl.routes.js";
import { configurePriceRoutes } from "@/routes/price.routes.js";
import { configureTradeRoutes } from "@/routes/trade.routes.js";
import { configureUserRoutes } from "@/routes/user.routes.js";
import { startMetricsServer } from "@/servers/metrics.server.js";
import { ServiceRegistry } from "@/services/index.js";

import { makeBoostController } from "./controllers/boost.controller.js";
import { configureLeaderboardRoutes } from "./routes/leaderboard.routes.js";

// Sentry configuration defaults
const SENTRY_DEFAULTS = {
  PROFILE_SAMPLE_RATE: 0.01, // 1% - minimal tracking by default
} as const;

// Initialize Sentry before creating the Express app
initSentry({
  enableProfiling: process.env.ENABLE_SENTRY_PROFILING === "true",
  profileSessionSampleRate: process.env.SENTRY_PROFILE_SAMPLE_RATE
    ? parseFloat(process.env.SENTRY_PROFILE_SAMPLE_RATE)
    : SENTRY_DEFAULTS.PROFILE_SAMPLE_RATE,
});

// Create Express app
const app = express();

// Create the API router
const apiRouter = express.Router();

const PORT = config.server.port;

// Set up API prefix configuration
const apiBasePath = config.server.apiPrefix
  ? `/${config.server.apiPrefix}`
  : "";

// Run migrations with distributed lock coordination
try {
  apiLogger.info("Attempting to run database migrations...");
  await migrateDb();
  apiLogger.info("Database migrations completed successfully");
} catch (error) {
  apiLogger.error(`Database initialization error: ${error}`);
  apiLogger.error("Exiting...");
  process.exit(1);
}

const services = new ServiceRegistry();

// Configure middleware
// Trust proxy to get real IP addresses (important for rate limiting)
app.set("trust proxy", true);

app.use(
  cors({
    origin: function (origin, fn) {
      // Allow any localhost port in development mode
      if (config.server.nodeEnv === "development") {
        const localhostRegex = /^http?:\/\/localhost(:\d+)?$/i;
        if (!origin || localhostRegex.test(origin)) {
          fn(null, true);
        } else {
          fn(new ApiError(403, "Forbidden"));
        }
        return;
      }

      // See Express CORS docs for details: https://expressjs.com/en/resources/middleware/cors.html#configuration-options
      const baseDomain = config?.app?.domain?.startsWith(".")
        ? config?.app?.domain?.substring(1)
        : config?.app?.domain;
      const escapedDomain = baseDomain?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const domainRegex = new RegExp(`${escapedDomain}$`, "i");
      if (!origin || domainRegex.test(origin)) {
        fn(null, true);
      } else {
        fn(new ApiError(403, "Forbidden"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Add logging middleware after basic setup but before authentication
app.use(loggingMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define different types of protected routes with their authentication needs
const agentApiKeyRoutes = [
  `${apiBasePath}/api/agent`,
  `${apiBasePath}/api/trade`,
  `${apiBasePath}/api/price`,
  `${apiBasePath}/api/nfl`,
];

const userSessionRoutes = [`${apiBasePath}/api/user`];
const authMiddlewareInstance = authMiddleware(
  services.agentService,
  services.userService,
  services.adminService,
);

// Apply agent API key authentication to agent routes
app.use(agentApiKeyRoutes, authMiddlewareInstance);

// Apply session authentication to user routes
app.use(userSessionRoutes, authMiddlewareInstance);

// Apply rate limiting middleware AFTER authentication
// This ensures we can properly rate limit by agent/user ID
app.use(rateLimiterMiddleware);

const adminMiddleware = adminAuthMiddleware(services.adminService);
const optionalAuth = optionalAuthMiddleware(
  services.agentService,
  services.userService,
  services.adminService,
);

const adminController = makeAdminController(services);
const authController = makeAuthController(services);
const arenaController = makeArenaController(services);
const competitionController = makeCompetitionController(services);
const docsController = makeDocsController();
const healthController = makeHealthController();
const priceController = makePriceController(services);
const rewardsController = makeRewardsController(services);
const tradeController = makeTradeController(services);
const userController = makeUserController(
  services,
  config.boost.noStakeBoostAmount ? false : true,
);
const agentController = makeAgentController(services);
const leaderboardController = makeLeaderboardController(services);
const boostController = makeBoostController(services);

const adminRoutes = configureAdminRoutes(adminController, adminMiddleware);
const adminSetupRoutes = configureAdminSetupRoutes(adminController);
const arenaRoutes = configureArenaRoutes(arenaController);
const authRoutes = configureAuthRoutes(authController, authMiddlewareInstance);
const competitionsRoutes = configureCompetitionsRoutes(
  competitionController,
  boostController,
  optionalAuth,
  authMiddlewareInstance,
);
const docsRoutes = configureDocsRoutes(docsController);
const healthRoutes = configureHealthRoutes(healthController);
const priceRoutes = configurePriceRoutes(priceController);
const tradeRoutes = configureTradeRoutes(tradeController);
const userRoutes = configureUserRoutes(userController, rewardsController);
const agentRoutes = configureAgentRoutes(agentController);
const agentsRoutes = configureAgentsRoutes(agentController);
const leaderboardRoutes = configureLeaderboardRoutes(leaderboardController);
const nflRoutes = configureNflRoutes(services);

// Apply routes to the API router
apiRouter.use("/auth", authRoutes);
apiRouter.use("/trade", tradeRoutes);
apiRouter.use("/price", priceRoutes);
apiRouter.use("/competitions", competitionsRoutes);
apiRouter.use("/admin/setup", adminSetupRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/health", healthRoutes);
apiRouter.use("/docs", docsRoutes);
apiRouter.use("/user", userRoutes);
apiRouter.use("/agent", agentRoutes);
apiRouter.use("/agents", agentsRoutes);
apiRouter.use("/arenas", arenaRoutes);
apiRouter.use("/leaderboard", leaderboardRoutes);
apiRouter.use("/nfl", nflRoutes);

// Mount the API router with the prefix + /api path
app.use(`${apiBasePath}/api`, apiRouter);

// Health check endpoint
app.get(`${apiBasePath}/health`, (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Legacy
app.get(`${apiBasePath}/api/health`, (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Root endpoint redirects to API documentation
app.get(`${apiBasePath}`, (_req, res) => {
  res.redirect(`${apiBasePath}/api/docs`);
});

// Apply Sentry error handler before our custom error handler
if (config.sentry?.enabled) {
  app.use(Sentry.expressErrorHandler());
}

// Apply error handler
app.use(errorHandler);

// Start HTTP server
const mainServer = app.listen(PORT, "0.0.0.0", () => {
  apiLogger.info(`\n========================================`);
  apiLogger.info(`Server is running on port ${PORT}`);
  apiLogger.info(`Environment: ${config.server.nodeEnv}`);
  apiLogger.info(
    `API documentation: http://localhost:${PORT}${apiBasePath}/api/docs`,
  );
  apiLogger.info(`========================================\n`);
});

// Start dedicated metrics server on separate port
const metricsServer = startMetricsServer();

let shuttingDown = false;
// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;

  apiLogger.info(
    `\n[${signal}] Received shutdown signal, closing servers gracefully...`,
  );

  // Close both servers
  mainServer.close(async () => {
    apiLogger.info("[Shutdown] Main server closed");

    metricsServer.close(async () => {
      apiLogger.info("[Shutdown] Metrics server closed");

      // Close database connections
      try {
        await closeDb();
        apiLogger.info("[Shutdown] Database connections closed");
      } catch (error) {
        apiLogger.error(
          { error },
          "[Shutdown] Error closing database connections:",
        );
      }

      clearTimeout(timeout);
      process.exit(0);
    });
  });
  const timeout = setTimeout(function () {
    apiLogger.error("Forcing exit after timeout");
    process.exit(1);
  }, 10000);
};

// Handle process termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart
