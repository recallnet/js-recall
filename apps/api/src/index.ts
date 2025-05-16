import cors from "cors";
import express from "express";

import { config } from "@/config/index.js";
import { makeAccountController } from "@/controllers/account.controller.js";
import { makeAdminController } from "@/controllers/admin.controller.js";
import { makeCompetitionController } from "@/controllers/competition.controller.js";
import { makeDocsController } from "@/controllers/docs.controller.js";
import { makeHealthController } from "@/controllers/health.controller.js";
import { makePriceController } from "@/controllers/price.controller.js";
import { makeTradeController } from "@/controllers/trade.controller.js";
import { migrateDb } from "@/database/db.js";
import { adminAuthMiddleware } from "@/middleware/admin-auth.middleware.js";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import errorHandler from "@/middleware/errorHandler.js";
import { rateLimiterMiddleware } from "@/middleware/rate-limiter.middleware.js";
import { configureAccountRoutes } from "@/routes/account.routes.js";
import { configureAdminRoutes } from "@/routes/admin.routes.js";
import { configureCompetitionRoutes } from "@/routes/competition.routes.js";
import { configureDocsRoutes } from "@/routes/docs.routes.js";
import { configureHealthRoutes } from "@/routes/health.routes.js";
import { configurePriceRoutes } from "@/routes/price.routes.js";
import { configureTradeRoutes } from "@/routes/trade.routes.js";
import { ServiceRegistry } from "@/services/index.js";

import { configureAdminSetupRoutes } from "./routes/admin-setup.routes.js";

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define protected routes
const protectedRoutes = [
  "/api/account",
  "/api/trade",
  "/api/competition",
  "/api/price",
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

const adminMiddleware = adminAuthMiddleware(services.teamManager);

const accountController = makeAccountController(services);
const adminController = makeAdminController(services);
const competitionController = makeCompetitionController(services);
const docsController = makeDocsController();
const healthController = makeHealthController();
const priceController = makePriceController(services);
const tradeController = makeTradeController(services);

const accountRoutes = configureAccountRoutes(accountController);
const adminRoutes = configureAdminRoutes(adminController, adminMiddleware);
const adminSetupRoutes = configureAdminSetupRoutes(adminController);
const competitionRoutes = configureCompetitionRoutes(competitionController);
const docsRoutes = configureDocsRoutes(docsController);
const healthRoutes = configureHealthRoutes(healthController);
const priceRoutes = configurePriceRoutes(priceController);
const tradeRoutes = configureTradeRoutes(tradeController);

// Apply routes
app.use("/api/account", accountRoutes);
app.use("/api/trade", tradeRoutes);
app.use("/api/price", priceRoutes);
app.use("/api/competition", competitionRoutes);
app.use("/api/admin/setup", adminSetupRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/docs", docsRoutes);

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
