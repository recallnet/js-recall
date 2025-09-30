import {
  CompetitionConfig,
  createCompetitionPayload,
  createTgeCompetitionPayload,
} from "../utils/competition-utils.js";
import {
  createMalformedTrade,
  createOverdrawnTrade,
} from "../utils/error-patterns.js";
import {
  captureError,
  flushSentry,
  initializeSentry,
  trackHttpRequest,
  trackHttpRequestSpan,
  trackScenarioExecution as trackScenarioMetric,
  trackSetupDuration,
  trackTestStart,
  trackTradeFlow as trackTradeFlowMetric,
} from "../utils/sentry-metrics.js";
import {
  Balance,
  catchupTradePattern,
  normalTradePattern,
  panicSellPattern,
  tgeFomoPattern,
  whaleTradePattern,
} from "../utils/trade-patterns.js";
import { generateUserAndAgent } from "../utils/user-generator.js";

// Initialize Sentry on module load
initializeSentry();

// Artillery types
type ArtilleryContext = {
  vars: {
    users?: { userId: string; agentId: string; apiKey: string }[];
    _testStartTime?: number;
    _setupStartTime?: number;
    _scenarioCount?: number;
    _tradeFlowCount?: number;
    [key: string]: unknown;
  };
};

/**
 * Core Functions - Setup and Management
 */

// Start test and emit metric
export function startTestMetrics(
  context: ArtilleryContext,
  events: unknown,
  done: () => void,
) {
  context.vars._testStartTime = Date.now();
  trackTestStart();
  console.log(`📊 Started load test metrics tracking`);
  return done();
}

// Start setup phase metrics
export function startSetupPhase(
  context: ArtilleryContext,
  events: unknown,
  done: () => void,
) {
  context.vars._setupStartTime = Date.now();
  console.log("🏗️  Started setup phase");
  return done();
}

// Finish setup phase and emit duration metric
export function finishSetupPhase(
  context: ArtilleryContext,
  events: unknown,
  done: () => void,
) {
  const setupDuration =
    Date.now() - ((context.vars._setupStartTime as number) || Date.now());
  const agentsCreated =
    (context.vars.users as { userId: string }[] | undefined)?.length || 0;
  const competitionId = String(context.vars.competitionId || "unknown");

  // Store in context.vars for scenarios to access
  context.vars._setupDurationMs = setupDuration;
  context.vars._agentsCreated = agentsCreated;

  trackSetupDuration();

  console.log(
    `✅ Finished setup phase (${setupDuration}ms, ${agentsCreated} agents, competition: ${competitionId})`,
  );

  return done();
}

// Cleanup: Flush Sentry spans before process exits
export async function cleanupSentry() {
  console.log("🧹 Flushing Sentry spans...");
  await flushSentry();
  console.log("✅ Sentry cleanup complete");
}

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

// Track scenario execution
export function trackScenarioExecution(
  context: ArtilleryContext,
  events: unknown,
  done: () => void,
) {
  const agentId = String(context.vars.agentId || "unknown");
  trackScenarioMetric(agentId);
  return done();
}

// Track trade flow start
export function startTradeFlow(
  context: ArtilleryContext,
  events: unknown,
  done: () => void,
) {
  context.vars._flowStartTime = Date.now();
  context.vars._flowHasError = false;
  return done();
}

// Track trade flow completion
export function finishTradeFlow(
  context: ArtilleryContext,
  events: unknown,
  done: () => void,
) {
  const flowDuration =
    Date.now() - ((context.vars._flowStartTime as number) || Date.now());
  const hasError = context.vars._flowHasError === true;
  const agentId = String(context.vars.agentId || "unknown");

  trackTradeFlowMetric(flowDuration, hasError, agentId);

  delete context.vars._flowStartTime;
  delete context.vars._flowHasError;

  return done();
}

/**
 * Sentry Performance Tracking Functions
 */

// Track load test metrics
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
  const isError = statusCode >= 400;
  const responseTime = response.timings?.response || 0;

  // Get URL and method from requestParams
  const fullUrl = requestParams?.url || "unknown";
  const method = requestParams?.method || "GET";
  const urlPath = fullUrl.replace(/^https?:\/\/[^/]+/, "") || fullUrl;
  const agentId = String(context.vars.agentId || "unknown");

  // Track errors in flow
  if (isError) {
    context.vars._flowHasError = true;
  }

  // Track HTTP request metrics
  trackHttpRequest(urlPath, method, statusCode, responseTime);

  // Sample HTTP request spans (1% or always on error)
  trackHttpRequestSpan(
    urlPath,
    method,
    statusCode,
    responseTime,
    agentId,
    isError,
    context,
  );

  // Log errors for debugging
  if (isError) {
    console.error(`🚨 HTTP ${statusCode} Error - ${method} ${urlPath}`);
    console.error(`Agent ID: ${agentId}`);
    if (requestParams?.json) {
      console.error(
        `Request Body:`,
        JSON.stringify(requestParams.json, null, 2),
      );
    }
    if (response.body) {
      console.error(`Response Body:`, JSON.stringify(response.body, null, 2));
    }

    // Capture error message
    captureError(
      `Load Test Error: ${method} ${urlPath}`,
      statusCode >= 500 ? "error" : "warning",
      {
        "http.status_code": statusCode,
        "load_test.agent_id": agentId,
        endpoint: urlPath,
      },
    );
  }

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
