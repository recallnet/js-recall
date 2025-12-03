import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Log database connection info during server bootstrap
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        // Create a safe connection string without password
        const safeUrl = new URL(dbUrl);
        safeUrl.password = "***";
        console.log(`[Bootstrap] Connected to database: ${safeUrl.toString()}`);
      } catch (error) {
        console.error("[Bootstrap] Failed to parse database URL:", error);
      }
    } else {
      console.warn("[Bootstrap] No DATABASE_URL environment variable found");
    }

    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
