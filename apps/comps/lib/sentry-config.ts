// Frontend-specific Sentry configuration
import * as Sentry from "@sentry/nextjs";

import { SentrySamplingContext } from "../types/sentry";

// Frontend sampling rate defaults (production-safe values)
// Frontend gets higher rates than backend since it has lower overall volume
export const FRONTEND_SENTRY_SAMPLING = {
  DEFAULT_TRACES_RATE: 0.005, // 0.5% - Page loads generate many events, keep very low
  DEFAULT_CRITICAL_RATE: 0.2, // 20% - Critical user flows (trading/portfolio) need high visibility
  DEFAULT_API_RATE: 0.02, // 2% - Next.js API routes, higher than backend for debugging
  DEFAULT_NAVIGATION_RATE: 0.01, // 1% - Client-side navigation, moderate sampling
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

// Frontend-specific configuration object
export interface FrontendSentryConfig {
  dsn: string | undefined;
  environment: string;
  enabled: boolean;
  sampling: {
    traces: number;
    critical: number;
    api: number;
    navigation: number;
  };
}

// Create frontend Sentry config from environment variables
export function createSentryConfig(): FrontendSentryConfig {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  return {
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    enabled: !!dsn,
    sampling: {
      traces: getSamplingRate(
        process.env.SENTRY_TRACES_SAMPLE_RATE,
        FRONTEND_SENTRY_SAMPLING.DEFAULT_TRACES_RATE,
      ),
      critical: getSamplingRate(
        process.env.SENTRY_CRITICAL_SAMPLE_RATE,
        FRONTEND_SENTRY_SAMPLING.DEFAULT_CRITICAL_RATE,
      ),
      api: getSamplingRate(
        process.env.SENTRY_API_SAMPLE_RATE,
        FRONTEND_SENTRY_SAMPLING.DEFAULT_API_RATE,
      ),
      navigation: getSamplingRate(
        process.env.SENTRY_NAVIGATION_SAMPLE_RATE,
        FRONTEND_SENTRY_SAMPLING.DEFAULT_NAVIGATION_RATE,
      ),
    },
  };
}

// Frontend-specific transaction sampling logic
export function createTracesSampler(config: FrontendSentryConfig) {
  return (samplingContext: SentrySamplingContext) => {
    const transactionName =
      samplingContext.transactionContext?.name || samplingContext.name;

    // Critical user flows: competitions, admin pages
    if (
      transactionName?.includes("/competitions") ||
      transactionName?.includes("/admin")
    ) {
      return config.sampling.critical;
    }

    // API routes (Next.js API routes): higher sampling than page loads
    if (transactionName?.startsWith("/api/")) {
      return config.sampling.api;
    }

    // Page navigation events
    if (
      transactionName?.startsWith("/") &&
      !transactionName?.startsWith("/api/") &&
      !transactionName?.startsWith("/_next/")
    ) {
      return config.sampling.navigation;
    }

    // Everything else (page loads, etc.): minimal sampling
    return config.sampling.traces;
  };
}

// Client-side event filtering for resource monitoring and performance
export function createClientBeforeSend() {
  return (event: Sentry.ErrorEvent) => {
    // Filter resource loading events that create noise
    if (event.contexts?.trace?.op?.startsWith("resource.")) return null;

    // Filter browser performance events
    if (event.contexts?.trace?.op === "ui.long-animation-frame") return null;
    if (event.contexts?.trace?.op === "mark") return null;
    if (event.contexts?.trace?.op === "paint") return null;
    if (event.contexts?.trace?.op === "navigation") return null;

    // Filter Next.js build artifacts and static assets
    if (event.transaction?.includes("/_next/")) return null;
    if (event.transaction?.includes("/favicon.ico")) return null;
    if (event.transaction?.includes(".map")) return null;

    // Filter common browser extension errors
    if (event.exception?.values?.[0]?.value?.includes("chrome-extension://"))
      return null;
    if (event.exception?.values?.[0]?.value?.includes("moz-extension://"))
      return null;

    return event;
  };
}

// Server-side filtering for Next.js SSR/API routes
export function createServerBeforeSend() {
  return (event: Sentry.ErrorEvent) => {
    // Filter sensitive headers for SSR requests
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }

    // Filter Next.js build-time errors
    if (event.transaction?.includes("/_next/")) return null;

    return event;
  };
}
