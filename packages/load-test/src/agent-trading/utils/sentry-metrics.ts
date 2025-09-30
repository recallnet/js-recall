/**
 * Sentry Metrics Utility
 * Centralized Sentry integration for load testing metrics
 */
import * as Sentry from "@sentry/node";

// Initialize Sentry once
let sentryInitialized = false;

export function initializeSentry() {
  if (sentryInitialized) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: "perf-testing",
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE || "0.01",
    ), // Default 1% SDK sampling
    integrations: [Sentry.httpIntegration()],
  });

  sentryInitialized = true;
  console.log("📊 Initialized Sentry for load testing");
}

// Get common metric tags
export function getMetricTags() {
  return {
    test_profile: process.env.TEST_PROFILE || "stress",
    environment: process.env.API_HOST || "unknown",
    agents_count: process.env.AGENTS_COUNT || "1",
  };
}

// Sampling rate for HTTP request spans
const HTTP_SPAN_SAMPLE_RATE = parseFloat(
  process.env.SENTRY_SAMPLE_REQUEST || "0.01",
); // 1%

export function shouldSampleRequest(isError: boolean = false): boolean {
  if (isError) return true; // Always capture errors
  return Math.random() < HTTP_SPAN_SAMPLE_RATE;
}

/**
 * Custom Metrics Functions
 * Using Sentry span attributes - searchable, aggregatable, and queryable
 */

// Track counter (increment) on active span
export function trackCounter(
  name: string,
  value: number,
  tags?: Record<string, string>,
) {
  const span = Sentry.getActiveSpan();
  if (span) {
    span.setAttribute(name, value);
    // Add tags as separate attributes
    if (tags) {
      Object.entries(tags).forEach(([key, val]) => {
        span.setAttribute(`${name}.${key}`, val);
      });
    }
  }
}

// Track distribution (timing/histogram) on active span
export function trackDistribution(
  name: string,
  value: number,
  tags?: Record<string, string>,
) {
  const span = Sentry.getActiveSpan();
  if (span) {
    span.setAttribute(name, value);
    span.setAttribute(
      `${name}.unit`,
      name.includes("_ms") ? "millisecond" : "count",
    );
    // Add tags as separate attributes
    if (tags) {
      Object.entries(tags).forEach(([key, val]) => {
        span.setAttribute(`${name}.${key}`, val);
      });
    }
  }
}

// Track gauge (snapshot value) on active span
export function trackGauge(
  name: string,
  value: number,
  tags?: Record<string, string>,
) {
  const span = Sentry.getActiveSpan();
  if (span) {
    span.setAttribute(name, value);
    span.setAttribute(`${name}.type`, "gauge");
    // Add tags as separate attributes
    if (tags) {
      Object.entries(tags).forEach(([key, val]) => {
        span.setAttribute(`${name}.${key}`, val);
      });
    }
  }
}

/**
 * Load Test Specific Metrics
 */

type ArtilleryContextVars = {
  _setupDurationMs?: number;
  _agentsCreated?: number;
  competitionId?: string;
  [key: string]: unknown;
};

// Get test metadata - combines env vars with dynamic context
export function getTestMetadata(context?: {
  vars?: ArtilleryContextVars;
}): Record<string, string | number> {
  return {
    "load_test.started": 1,
    "load_test.duration_seconds": process.env.TEST_DURATION || "60",
    "load_test.request_rate": process.env.REQUEST_RATE || "8",
    "load_test.trade_amount": process.env.TRADE_AMOUNT || "0.1",
    "load_test.setup.duration_ms": context?.vars?._setupDurationMs || 0,
    "load_test.setup.agents_created": context?.vars?._agentsCreated || 0,
    "load_test.setup.competition_id": context?.vars?.competitionId || "unknown",
  };
}

export function trackTestStart() {
  // Test metadata is static from env vars, nothing to store
}

export function trackSetupDuration() {
  // These values are stored in Artillery context.vars by the processor
  // This function is kept for API compatibility but has no implementation
}

export function trackScenarioExecution(agentId: string) {
  trackCounter("load_test.scenario.executed", 1, {
    ...getMetricTags(),
    agent_id: agentId,
  });
}

export function trackTradeFlow(
  durationMs: number,
  hasError: boolean,
  agentId: string,
) {
  trackDistribution("load_test.trade_flow.duration_ms", durationMs, {
    ...getMetricTags(),
    agent_id: agentId,
    success: String(!hasError),
  });

  trackCounter(
    hasError ? "load_test.trade_flow.failed" : "load_test.trade_flow.completed",
    1,
    getMetricTags(),
  );
}

export function trackHttpRequest(
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
) {
  trackDistribution("load_test.http.response_time_ms", responseTimeMs, {
    ...getMetricTags(),
    endpoint,
    method,
    status_code: String(statusCode),
  });

  trackCounter("load_test.http.requests", 1, {
    ...getMetricTags(),
    endpoint,
    method,
    status: statusCode >= 400 ? "error" : "success",
  });
}

export function trackHttpRequestSpan(
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  agentId: string,
  isError: boolean,
  context?: { vars?: ArtilleryContextVars },
) {
  if (!shouldSampleRequest(isError)) {
    return;
  }

  Sentry.startSpan(
    {
      name: `${method.toUpperCase()} ${endpoint}`,
      op: "http.client",
      attributes: {
        "http.method": method,
        "http.url": endpoint,
        "http.status_code": statusCode,
        "http.response_time_ms": responseTimeMs,
        "load_test.agent_id": agentId,
        ...getMetricTags(),
        ...getTestMetadata(context), // Include all test-level metrics
      },
    },
    (span) => {
      // Set the span duration explicitly
      span.setStatus({ code: statusCode >= 400 ? 2 : 1 }); // 1 = OK, 2 = ERROR
    },
  );
}

// Flush Sentry to ensure spans are sent before process exits
export async function flushSentry() {
  await Sentry.flush(2000); // Wait up to 2 seconds
}

export function captureError(
  message: string,
  level: "error" | "warning",
  tags?: Record<string, string | number>,
) {
  Sentry.captureMessage(message, {
    level,
    tags: {
      ...getMetricTags(),
      ...tags,
    },
  });
}
