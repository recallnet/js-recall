import cors from "cors";
import express from "express";

import { config } from "@/config/index.js";
import { makeAdminController } from "@/controllers/admin.controller.js";
import { makeAgentController } from "@/controllers/agent.controller.js";
import { makeAuthController } from "@/controllers/auth.controller.js";
import { makeCompetitionController } from "@/controllers/competition.controller.js";
import { makeDocsController } from "@/controllers/docs.controller.js";
import { makeHealthController } from "@/controllers/health.controller.js";
import { makeLeaderboardController } from "@/controllers/leaderboard.controller.js";
import { makePriceController } from "@/controllers/price.controller.js";
import { makeTradeController } from "@/controllers/trade.controller.js";
import { makeUserController } from "@/controllers/user.controller.js";
import { makeVoteController } from "@/controllers/vote.controller.js";
import { migrateDb } from "@/database/db.js";
import { adminAuthMiddleware } from "@/middleware/admin-auth.middleware.js";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import errorHandler from "@/middleware/errorHandler.js";
import { optionalAuthMiddleware } from "@/middleware/optional-auth.middleware.js";
import { rateLimiterMiddleware } from "@/middleware/rate-limiter.middleware.js";
import { siweSessionMiddleware } from "@/middleware/siwe.middleware.js";
import { configureAdminSetupRoutes } from "@/routes/admin-setup.routes.js";
import { configureAdminRoutes } from "@/routes/admin.routes.js";
import { configureAgentRoutes } from "@/routes/agent.routes.js";
import { configureAgentsRoutes } from "@/routes/agents.routes.js";
import { configureAuthRoutes } from "@/routes/auth.routes.js";
import { configureCompetitionsRoutes } from "@/routes/competitions.routes.js";
import { configureDocsRoutes } from "@/routes/docs.routes.js";
import { configureHealthRoutes } from "@/routes/health.routes.js";
import { configurePriceRoutes } from "@/routes/price.routes.js";
import { configureTradeRoutes } from "@/routes/trade.routes.js";
import { configureUserRoutes } from "@/routes/user.routes.js";
import { ServiceRegistry } from "@/services/index.js";

import { configureLeaderboardRoutes } from "./routes/leaderboard.routes.js";

// Create Express app
const app = express();

// Create the API router
const apiRouter = express.Router();

const PORT = config.server.port;
let databaseInitialized = false;

// Set up API prefix configuration
const apiBasePath = `/${config.server.apiPrefix}`;

// Only run migrations in development, not production
if (process.env.NODE_ENV !== "production") {
  try {
    // Migrate the database if needed
    console.log("Checking database connection...");
    await migrateDb();
    console.log("Database connection and schema verification completed");
    databaseInitialized = true;
  } catch (error) {
    console.error("Database initialization error:", error);
    console.error(
      "Failed to start server due to database initialization error. Exiting...",
    );
    process.exit(1);
  }
} else {
  console.log("Production mode: Skipping automatic database migrations");
  databaseInitialized = true; // Assume database is already set up in production
}

const services = new ServiceRegistry();

// Load competition-specific configuration settings
await services.configurationService.loadCompetitionSettings();
console.log("Competition-specific configuration settings loaded");

// Start snapshot scheduler
services.scheduler.startSnapshotScheduler();
console.log("Portfolio snapshot scheduler started");

// Configure middleware
app.use(
  cors({
    origin: config.app.url,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define different types of protected routes with their authentication needs
const agentApiKeyRoutes = [
  `${apiBasePath}/api/agent`,
  `${apiBasePath}/api/trade`,
  `${apiBasePath}/api/price`,
];

const userSessionRoutes = [`${apiBasePath}/api/user`];

// Apply agent API key authentication to agent routes
app.use(
  agentApiKeyRoutes,
  authMiddleware(
    services.agentManager,
    services.userManager,
    services.adminManager,
    services.competitionManager,
  ),
);

// Apply SIWE session authentication to user routes
app.use(
  userSessionRoutes,
  siweSessionMiddleware, // Apply SIWE session middleware first to populate req.session
  authMiddleware(
    services.agentManager,
    services.userManager,
    services.adminManager,
    services.competitionManager,
  ),
);

// Apply rate limiting middleware AFTER authentication
// This ensures we can properly rate limit by agent/user ID
app.use(rateLimiterMiddleware);

const adminMiddleware = adminAuthMiddleware(services.adminManager);
const optionalAuth = optionalAuthMiddleware(
  services.agentManager,
  services.adminManager,
);

const adminController = makeAdminController(services);
const authController = makeAuthController(services);
const competitionController = makeCompetitionController(services);
const docsController = makeDocsController();
const healthController = makeHealthController();
const priceController = makePriceController(services);
const tradeController = makeTradeController(services);
const userController = makeUserController(services);
const agentController = makeAgentController(services);
const leaderboardController = makeLeaderboardController(services);
const voteController = makeVoteController(services);

const adminRoutes = configureAdminRoutes(adminController, adminMiddleware);
const adminSetupRoutes = configureAdminSetupRoutes(adminController);
const authRoutes = configureAuthRoutes(authController, siweSessionMiddleware);
const competitionsRoutes = configureCompetitionsRoutes(
  competitionController,
  optionalAuth,
  siweSessionMiddleware,
  authMiddleware(
    services.agentManager,
    services.userManager,
    services.adminManager,
    services.competitionManager,
  ),
);
const docsRoutes = configureDocsRoutes(docsController);
const healthRoutes = configureHealthRoutes(healthController);
const priceRoutes = configurePriceRoutes(priceController);
const tradeRoutes = configureTradeRoutes(tradeController);
const userRoutes = configureUserRoutes(userController, voteController);
const agentRoutes = configureAgentRoutes(agentController);
const agentsRoutes = configureAgentsRoutes(agentController);
const leaderboardRoutes = configureLeaderboardRoutes(leaderboardController);

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
apiRouter.use("/leaderboard", leaderboardRoutes);

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
app.get("/", (_req, res) => {
  res.redirect(`${apiBasePath}/api/docs`);
});

// Apply error handler
app.use(errorHandler);

// Start HTTP server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n========================================`);
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${config.server.nodeEnv}`);
  console.log(
    `Database: ${databaseInitialized ? "Connected" : "Error - Limited functionality"}`,
  );
  console.log(
    `API documentation: http://localhost:${PORT}${apiBasePath}/api/docs`,
  );
  console.log(`========================================\n`);
});
