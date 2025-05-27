import cors from "cors";
import express from "express";

import { config } from "@/config/index.js";
import { makeAdminController } from "@/controllers/admin.controller.js";
import { makeAgentController } from "@/controllers/agent.controller.js";
import { makeAuthController } from "@/controllers/auth.controller.js";
import { makeCompetitionController } from "@/controllers/competition.controller.js";
import { makeDocsController } from "@/controllers/docs.controller.js";
import { makeHealthController } from "@/controllers/health.controller.js";
import { makePriceController } from "@/controllers/price.controller.js";
import { makeTradeController } from "@/controllers/trade.controller.js";
import { makeUserController } from "@/controllers/user.controller.js";
import { migrateDb } from "@/database/db.js";
import { adminAuthMiddleware } from "@/middleware/admin-auth.middleware.js";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import errorHandler from "@/middleware/errorHandler.js";
import { rateLimiterMiddleware } from "@/middleware/rate-limiter.middleware.js";
import { siweSessionMiddleware } from "@/middleware/siwe.middleware.js";
import { configureAdminSetupRoutes } from "@/routes/admin-setup.routes.js";
import { configureAdminRoutes } from "@/routes/admin.routes.js";
import { configureAgentRoutes } from "@/routes/agent.routes.js";
import { configureAuthRoutes } from "@/routes/auth.routes.js";
import { configureCompetitionsRoutes } from "@/routes/competitions.routes.js";
import { configureDocsRoutes } from "@/routes/docs.routes.js";
import { configureHealthRoutes } from "@/routes/health.routes.js";
import { configurePriceRoutes } from "@/routes/price.routes.js";
import { configureTradeRoutes } from "@/routes/trade.routes.js";
import { configureUserRoutes } from "@/routes/user.routes.js";
import { ServiceRegistry } from "@/services/index.js";

// Create Express app
const app = express();

const PORT = config.server.port;
let databaseInitialized = false;

try {
  // Migrate the database if needed
  console.log("Checking database connection...");
  await migrateDb();
  console.log("Database connection and schema verification completed");
  databaseInitialized = true;
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
  "/api/agent",
  "/api/trade", // Trade operations use agent API keys
];

const userSessionRoutes = [
  "/api/user", // User operations use SIWE sessions
];

const legacyRoutes = [
  "/api/account", // Legacy routes that still need both types
  "/api/competition",
  "/api/competitions",
  "/api/price",
];

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

// Apply combined authentication to legacy routes (supports both)
app.use(
  legacyRoutes,
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

const adminController = makeAdminController(services);
const authController = makeAuthController(services);
const competitionController = makeCompetitionController(services);
const docsController = makeDocsController();
const healthController = makeHealthController();
const priceController = makePriceController(services);
const tradeController = makeTradeController(services);
const userController = makeUserController(services);
const agentController = makeAgentController(services);

const adminRoutes = configureAdminRoutes(adminController, adminMiddleware);
const adminSetupRoutes = configureAdminSetupRoutes(adminController);
const authRoutes = configureAuthRoutes(authController, siweSessionMiddleware);
const competitionsRoutes = configureCompetitionsRoutes(competitionController);
const docsRoutes = configureDocsRoutes(docsController);
const healthRoutes = configureHealthRoutes(healthController);
const priceRoutes = configurePriceRoutes(priceController);
const tradeRoutes = configureTradeRoutes(tradeController);
const userRoutes = configureUserRoutes(userController);
const agentRoutes = configureAgentRoutes(agentController);

// Apply routes
app.use("/api/auth", authRoutes);
app.use("/api/trade", tradeRoutes);
app.use("/api/price", priceRoutes);
app.use("/api/competitions", competitionsRoutes);
app.use("/api/admin/setup", adminSetupRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/docs", docsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/agent", agentRoutes);

// Legacy health check endpoint for backward compatibility
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Root endpoint redirects to API documentation
app.get("/", (_req, res) => {
  res.redirect("/api/docs");
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
  console.log(`API documentation: http://localhost:${PORT}/api/docs`);
  console.log(`========================================\n`);
});
