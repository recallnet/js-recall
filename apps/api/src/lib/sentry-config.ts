// API-specific Sentry configuration
import * as Sentry from "@sentry/node";

import { SentrySamplingContext } from "@/types/sentry.js";

// API sampling rate defaults (production-safe values)
// These rates are conservative to prevent Sentry quota exhaustion
export const API_SENTRY_SAMPLING = {
  DEFAULT_TRACES_RATE: 0.005, // 0.5% - Minimal baseline for all transactions
  DEFAULT_CRITICAL_RATE: 0.1, // 10% - Higher visibility for business-critical operations (trading/admin)
  DEFAULT_API_RATE: 0.01, // 1% - Standard API calls, balance between visibility and volume
  DEFAULT_DATABASE_RATE: 0.01, // 1% - Database-heavy operations like leaderboards (high volume)
} as const;

// Helper to get sampling rate from env with fallback
function getSamplingRate(
  envVar: string | undefined,
  defaultRate: number,
): number {
  if (!envVar) return defaultRate;
  const parsed = parseFloat(envVar);
  return isNaN(parsed) ? defaultRate : parsed;
}

// API-specific configuration object
export interface ApiSentryConfig {
  dsn: string | undefined;
  environment: string;
  enabled: boolean;
  dbMonitoringEnabled: boolean;
  sampling: {
    traces: number;
    critical: number;
    api: number;
    database: number;
  };
}

// Create API Sentry config from environment variables
export function createSentryConfig(): ApiSentryConfig {
  const dsn = process.env.SENTRY_DSN;

  return {
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    enabled: !!dsn,
    dbMonitoringEnabled:
      !!dsn && process.env.ENABLE_SENTRY_DB_MONITORING === "true",
    sampling: {
      traces: getSamplingRate(
        process.env.SENTRY_TRACES_SAMPLE_RATE,
        API_SENTRY_SAMPLING.DEFAULT_TRACES_RATE,
      ),
      critical: getSamplingRate(
        process.env.SENTRY_CRITICAL_SAMPLE_RATE,
        API_SENTRY_SAMPLING.DEFAULT_CRITICAL_RATE,
      ),
      api: getSamplingRate(
        process.env.SENTRY_API_SAMPLE_RATE,
        API_SENTRY_SAMPLING.DEFAULT_API_RATE,
      ),
      database: getSamplingRate(
        process.env.SENTRY_DATABASE_SAMPLE_RATE,
        API_SENTRY_SAMPLING.DEFAULT_DATABASE_RATE,
      ),
    },
  };
}

// API-specific transaction sampling logic
export function createTracesSampler(config: ApiSentryConfig) {
  return (samplingContext: SentrySamplingContext) => {
    const transactionName =
      samplingContext.transactionContext?.name || samplingContext.name;

    // Critical business operations: higher sampling for trading and admin
    if (
      transactionName?.includes("/trade") ||
      transactionName?.includes("/competitions") ||
      transactionName?.includes("/admin/")
    ) {
      return config.sampling.critical;
    }

    // Health checks and metrics: no sampling to reduce noise
    if (
      transactionName?.includes("/health") ||
      transactionName?.includes("/metrics")
    ) {
      return 0;
    }

    // Database-heavy endpoints: reduced sampling due to volume
    if (transactionName?.includes("/leaderboard")) {
      return config.sampling.database;
    }

    // All other API routes: standard sampling
    return config.sampling.api;
  };
}

// API server-side event filtering
export function createServerBeforeSend(config: ApiSentryConfig) {
  return (event: Sentry.ErrorEvent) => {
    // Filter out sensitive authentication data
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }

    // Filter database query spans if DB monitoring is disabled
    if (
      !config.dbMonitoringEnabled &&
      event.contexts?.trace?.op === "db.query"
    ) {
      return null;
    }

    // Filter noisy database connection events
    if (event.contexts?.trace?.op === "db.connection") {
      return null;
    }

    return event;
  };
}
