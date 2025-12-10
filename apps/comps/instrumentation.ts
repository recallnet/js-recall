import * as Sentry from "@sentry/nextjs";
import { createLogger } from "lib/logger";

import { config } from "@/config/private";

const logger = createLogger("Bootstrap");

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Log database connection info during server bootstrap
    const dbUrl = config.database.mainUrl;
    if (dbUrl) {
      try {
        // Create a safe connection string without password
        const safeUrl = new URL(dbUrl);
        safeUrl.password = "***";
        logger.info(`Connected to database: ${safeUrl.toString()}`);
      } catch (error) {
        logger.error({ error }, "Failed to parse database URL");
      }
    } else {
      logger.warn("Database URL is not set");
    }

    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
