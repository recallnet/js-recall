import * as Sentry from "@sentry/node";

import {
  CompetitionConfig,
  createCompetitionPayload,
  createTgeCompetitionPayload,
} from "../utils/competition-utils.js";
import {
  createDisallowedCrossChainTrade,
  createMalformedTrade,
  createOverdrawnTrade,
} from "../utils/error-patterns.js";
import {
  Balance,
  catchupTradePattern,
  normalTradePattern,
  panicSellPattern,
  tgeFomoPattern,
  whaleTradePattern,
} from "../utils/trade-patterns.js";
import { generateUserAndAgent } from "../utils/user-generator.js";

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: "perf-testing",
  tracesSampleRate: 1.0, // Capture 100% of transactions for load testing
  integrations: [Sentry.httpIntegration()],
});

// Artillery types
type ArtilleryContext = {
  vars: {
    users?: { userId: string; agentId: string; apiKey: string }[];
    [key: string]: unknown;
  };
};

/**
 * Core Functions - Setup and Management
 */

// Generate random user and agent data
export function generateRandomUserAndAgent(
  requestParams: unknown,
  context: ArtilleryContext,
  events: unknown,
  done: () => void,
) {
  const userData = generateUserAndAgent();
  Object.assign(context.vars, userData);
  return done();
}

// Set standard competition payload
export function setCompetitionPayload(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const config = context.vars.competitionConfig as
    | CompetitionConfig
    | undefined;
  requestParams.json = createCompetitionPayload(config);
  return next();
}

// Set TGE-specific competition payload
export function setTgeCompetitionPayload(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  requestParams.json = createTgeCompetitionPayload();
  return next();
}

// Extract user and agent info from response
export function extractUserAndAgentInfo(
  requestParams: unknown,
  response: { body: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const body =
    typeof response.body === "string"
      ? JSON.parse(response.body)
      : response.body;

  if (!context.vars.users) {
    context.vars.users = [];
  }

  if (body.user && body.agent) {
    context.vars.users.push({
      userId: body.user.id,
      agentId: body.agent.id,
      apiKey: body.agent.apiKey,
    });
    console.log(
      `Added user ${body.user.id} with agent ${body.agent.id} to pool. Total: ${context.vars.users.length}`,
    );
  } else {
    console.log("No user or agent in response body:", body);
  }

  return next();
}

// Global counter for round-robin selection
let agentSelectionCounter = 0;

// Select agent in round-robin fashion to prevent collisions
export function selectRandomAgent(
  context: ArtilleryContext,
  events: unknown,
  done: () => void,
) {
  if (!context.vars.users || context.vars.users.length === 0) {
    console.log("No users available");
    return done();
  }

  // Use round-robin instead of random to ensure even distribution
  const selectedIndex = agentSelectionCounter % context.vars.users.length;
  agentSelectionCounter++;

  const selectedUser = context.vars.users[selectedIndex];

  if (selectedUser) {
    context.vars.agentId = selectedUser.agentId;
    context.vars.apiKey = selectedUser.apiKey;
    context.vars.userId = selectedUser.userId;
    console.log(
      `Round-robin selected agent ${selectedIndex + 1}/${context.vars.users.length}: ${selectedUser.agentId}`,
    );
  }

  return done();
}

/**
 * Sentry Performance Tracking Functions
 */

// Track load test metrics with proper transactions
export function trackLoadTestMetrics(
  requestParams: { url?: string; method?: string; json?: unknown },
  response: {
    statusCode?: number;
    timings?: { response?: number };
    body?: unknown;
  },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const statusCode = response.statusCode || 0;

  // Get URL and method from requestParams (which has the correct data)
  const fullUrl = requestParams?.url || "unknown";
  const method = requestParams?.method || "GET";

  // Extract just the path from the full URL for cleaner span names
  const urlPath = fullUrl.replace(/^https?:\/\/[^/]+/, "") || fullUrl;

  const responseTime = response.timings?.response || 0;
  const agentId = String(context.vars.agentId || "unknown");
  const userId = String(context.vars.userId || "unknown");

  // Create a Sentry transaction for this HTTP request
  Sentry.withScope((scope) => {
    // Set comprehensive tags
    scope.setTag("http.status_code", statusCode);
    scope.setTag("http.method", method);
    scope.setTag("http.url", urlPath);
    scope.setTag("test.framework", "artillery");
    scope.setTag("test.agent_count", process.env.AGENTS_COUNT || "1");
    scope.setTag("load_test.agent_id", agentId);
    scope.setTag("load_test.user_id", userId);

    // Set useful context data
    scope.setContext("http_request", {
      method: method,
      url: fullUrl,
      path: urlPath,
      status_code: statusCode,
      response_time_ms: responseTime,
    });

    scope.setContext("load_test", {
      agent_id: agentId,
      user_id: userId,
      test_framework: "artillery",
      agent_count: parseInt(process.env.AGENTS_COUNT || "1"),
      trades_count: parseInt(process.env.TRADES_COUNT || "1"),
    });

    // Add request body for POST requests
    if (method === "POST" && requestParams?.json) {
      scope.setContext("request_body", {
        payload: requestParams.json,
      });
    }

    // Create a span with proper duration using async simulation
    Sentry.startSpan(
      {
        name: `Load Test: ${method.toUpperCase()} ${urlPath}`,
        op: "load_test.http_request",
        attributes: {
          "http.method": method,
          "http.url": urlPath,
          "http.status_code": statusCode,
          "http.response_time_ms": responseTime,
          "load_test.agent_id": agentId,
          "load_test.user_id": userId,
        },
      },
      async (span) => {
        // Set span status based on HTTP status
        if (statusCode >= 400) {
          span.setStatus({ code: 2, message: `HTTP ${statusCode}` }); // ERROR

          // Log 4xx errors for debugging
          console.error(`🚨 HTTP ${statusCode} Error - ${method} ${urlPath}`);
          console.error(`Agent ID: ${agentId}`);
          if (requestParams?.json) {
            console.error(
              `Request Body:`,
              JSON.stringify(requestParams.json, null, 2),
            );
          }
          if (response.body) {
            console.error(
              `Response Body:`,
              JSON.stringify(response.body, null, 2),
            );
          }

          // Also capture as an error for visibility
          Sentry.captureMessage(`Load Test Error: ${method} ${urlPath}`, {
            level: statusCode >= 500 ? "error" : "warning",
            tags: {
              "http.status_code": statusCode,
              "load_test.agent_id": agentId,
            },
          });
        } else {
          span.setStatus({ code: 1 }); // OK
        }

        // Note: Duration simulation disabled for faster testing
        // For production, uncomment to simulate actual request duration:
        // const duration = Math.min(responseTime, 5000);
        // await new Promise(resolve => setTimeout(resolve, duration));
      },
    );
  });

  return next();
}

/**
 * Trading Pattern Functions
 */

// Normal trading with rebalancing logic
export function normalTrade(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const balances = (context.vars.balances as Balance[]) || [];
  const usdcToken =
    (context.vars.usdcToken as string) ||
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const wethToken =
    (context.vars.wethToken as string) ||
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

  const trade = normalTradePattern(balances, usdcToken, wethToken);

  if (trade) {
    requestParams.json = trade;
  } else {
    // Default small trade if no rebalancing needed
    requestParams.json = {
      fromToken: usdcToken,
      toToken: wethToken,
      amount: "10",
      reason: "Regular trading activity",
      fromChain: "EVM",
      toChain: "EVM",
    };
  }

  return next();
}

// TGE FOMO trading pattern
export function tgeFomoTrade(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const balances = (context.vars.balances as Balance[]) || [];
  const usdcToken =
    (context.vars.usdcToken as string) ||
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const targetToken =
    (context.vars.tgeToken as string) ||
    (context.vars.wethToken as string) ||
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

  requestParams.json = tgeFomoPattern(balances, usdcToken, targetToken);
  return next();
}

// Whale trading pattern
export function whaleTrade(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const balances = (context.vars.balances as Balance[]) || [];
  const usdcToken =
    (context.vars.usdcToken as string) ||
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const targetToken =
    (context.vars.wethToken as string) ||
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

  requestParams.json = whaleTradePattern(balances, usdcToken, targetToken);
  return next();
}

// Catchup trading pattern
export function catchupTrade(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const balances = (context.vars.balances as Balance[]) || [];
  const usdcToken =
    (context.vars.usdcToken as string) ||
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const targetToken =
    (context.vars.wethToken as string) ||
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

  requestParams.json = catchupTradePattern(balances, usdcToken, targetToken);
  return next();
}

// Panic selling pattern
export function panicSell(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const balances = (context.vars.balances as Balance[]) || [];
  const wethToken =
    (context.vars.wethToken as string) ||
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  const usdcToken =
    (context.vars.usdcToken as string) ||
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  const trade = panicSellPattern(balances, wethToken, usdcToken);

  if (trade) {
    requestParams.json = trade;
  } else {
    // If no WETH to sell, skip
    context.vars.skipTrade = true;
  }

  return next();
}

/**
 * Error and Resilience Testing Functions
 */

// Intentional overdraw attempt
export function overdrawnTrade(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const usdcToken =
    (context.vars.usdcToken as string) ||
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const wethToken =
    (context.vars.wethToken as string) ||
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

  requestParams.json = createOverdrawnTrade(usdcToken, wethToken);
  return next();
}

// Malformed request attempt
export function malformedTrade(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  requestParams.json = createMalformedTrade();
  return next();
}

// Cross-chain trade when disallowed
export function disallowedCrossChainTrade(
  requestParams: { json: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  requestParams.json = createDisallowedCrossChainTrade();
  return next();
}

/**
 * Utility Functions
 */

// Capture balance response for trading decisions
export function captureBalances(
  requestParams: unknown,
  response: { body: unknown },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const body =
    typeof response.body === "string"
      ? JSON.parse(response.body)
      : response.body;

  if (body.balances) {
    context.vars.balances = body.balances;
  }

  return next();
}

// Health check function (just checks balance, no trading)
export function healthCheck(
  context: ArtilleryContext,
  events: unknown,
  done: () => void,
) {
  // Simply select an agent and let the balance check happen
  selectRandomAgent(context, events, () => {
    context.vars.healthCheckOnly = true;
    done();
  });
}

// Log metrics for monitoring
export function logMetrics(
  requestParams: unknown,
  response: { body: unknown; statusCode?: number },
  context: ArtilleryContext,
  ee: unknown,
  next: () => void,
) {
  const timestamp = new Date().toISOString();
  const statusCode = response.statusCode || 0;
  const agentId = context.vars.agentId;

  if (statusCode >= 400) {
    console.log(`[${timestamp}] ERROR - Agent ${agentId}: ${statusCode}`);
  } else if (context.vars.debug) {
    console.log(`[${timestamp}] SUCCESS - Agent ${agentId}: ${statusCode}`);
  }

  return next();
}
