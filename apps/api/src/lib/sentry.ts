import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import { config } from "@/config/index.js";
import {
  createServerBeforeSend,
  createTracesSampler,
} from "@/lib/sentry-config.js";

export function initSentry(options?: {
  enableProfiling?: boolean;
  profileSessionSampleRate?: number;
}) {
  if (!config.sentry?.dsn) {
    console.log("Sentry DSN not configured, skipping initialization");
    return;
  }

  const enableProfiling = options?.enableProfiling ?? false;
  const integrations = [];

  // Only enable profiling if explicitly enabled
  if (enableProfiling) {
    integrations.push(nodeProfilingIntegration());
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    integrations,
    tracesSampler: createTracesSampler(config.sentry),
    beforeSend: createServerBeforeSend(config.sentry),
    ...(enableProfiling &&
      options?.profileSessionSampleRate !== undefined && {
        profileSessionSampleRate: options.profileSessionSampleRate,
      }),
  });

  console.log(
    `Sentry initialized for ${config.sentry.environment} environment`,
  );
}
