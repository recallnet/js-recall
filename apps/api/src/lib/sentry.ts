import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { config } from "@/config/index.js";

export function initSentry() {
  if (!config.sentry?.dsn) {
    console.log("Sentry DSN not configured, skipping initialization");
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: config.sentry.environment === "production" ? 0.1 : 1.0,
    profilesSampleRate: config.sentry.environment === "production" ? 0.1 : 1.0,
    beforeSend(event) {
      // Filter out sensitive data
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  console.log(`Sentry initialized for ${config.sentry.environment} environment`);
}
