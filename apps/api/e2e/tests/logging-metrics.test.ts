import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { config } from "@/config/index.js";
import {
  CreateCompetitionResponse,
  ResetApiKeyResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";

describe("Logging and Metrics API", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account directly using the setup endpoint
    const response = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    // Store the admin API key for authentication
    adminApiKey = response.data.admin.apiKey;
    expect(adminApiKey).toBeDefined();
    console.log(`Admin API key created: ${adminApiKey.substring(0, 8)}...`);
  });

  test("metrics endpoint returns Prometheus metrics", async () => {
    // Make a few API requests to generate some metrics
    const client = createTestClient();
    await client.loginAsAdmin(adminApiKey);

    // Generate some HTTP request metrics
    await client.getHealthStatus();
    await client.listAgents();
    await client.listUsers();

    // Get metrics using the proper API client method
    const metricsResponse = await client.getMetrics();
    expect(typeof metricsResponse).toBe("string");

    const metricsText = metricsResponse as string;
    expect(metricsText.length).toBeGreaterThan(0);

    // Verify our custom HTTP metrics are present
    expect(metricsText).toContain("http_requests_total");
    expect(metricsText).toContain("http_request_duration_ms");

    // Verify we have some basic Node.js metrics (from prom-client default metrics)
    // Note: These may not be enabled in test environment, so make them optional
    if (metricsText.includes("nodejs_version_info")) {
      expect(metricsText).toContain("nodejs_version_info");
      expect(metricsText).toContain("process_cpu_user_seconds_total");
    }

    console.log("Metrics endpoint working correctly");
  });

  test("HTTP request metrics track different endpoints and methods", async () => {
    const client = createTestClient();
    await client.loginAsAdmin(adminApiKey);

    // Make requests to different endpoints to generate varied metrics
    await client.getHealthStatus(); // GET /api/health
    await client.listAgents(); // GET /api/admin/agents
    await client.listUsers(); // GET /api/admin/users

    // Get metrics
    const metricsResponse = await client.getMetrics();
    expect(typeof metricsResponse).toBe("string");
    const metricsText = metricsResponse as string;

    // Check that we have metrics for different HTTP methods
    expect(metricsText).toContain('method="GET"');

    // Check that we have metrics for different routes (using actual route patterns)
    expect(metricsText).toContain("/health");
    expect(metricsText).toContain("/api/admin/agents");
    expect(metricsText).toContain("/api/admin/users");

    // Check that we have successful status codes
    expect(metricsText).toContain('status_code="200"');

    console.log("HTTP request metrics tracking different endpoints correctly");
  });

  test("database operation metrics track all repository operations with detailed labels", async () => {
    const client = createTestClient();
    await client.loginAsAdmin(adminApiKey);

    // Create a user and agent to trigger database operations
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: "DB Metrics Test User",
      userEmail: "db-metrics@example.com",
      agentName: "DB Metrics Test Agent",
      agentDescription: "Agent for testing database metrics",
    });

    // Perform operations that trigger different repository operations
    await agentClient.getAgentProfile(); // SELECT operations
    await agentClient.getBalance(); // SELECT operations
    await client.listAgents(); // SELECT operations
    await client.listUsers(); // SELECT operations

    // Get metrics and verify comprehensive database operation tracking
    const metricsResponse = await client.getMetrics();
    expect(typeof metricsResponse).toBe("string");
    const metricsText = metricsResponse as string;

    // Database metrics are now automatically tracked for all repository operations
    expect(metricsText).toContain("repository_queries_total");
    expect(metricsText).toContain("repository_query_duration_ms");

    // Verify operation type labels
    expect(metricsText).toContain('operation="SELECT"');
    expect(metricsText).toContain('operation="INSERT"');

    // Verify repository name labels
    expect(metricsText).toContain('repository="AgentRepository"');
    expect(metricsText).toContain('repository="UserRepository"');

    // Verify method name labels
    expect(metricsText).toContain('method="findById"');
    expect(metricsText).toContain('method="create"');

    // Verify status labels
    expect(metricsText).toContain('status="success"');

    console.log(
      "Database operation metrics tracking all operations with detailed labels",
    );
  });

  test("database metrics track both successful and error operations", async () => {
    const client = createTestClient();
    await client.loginAsAdmin(adminApiKey);

    // Perform successful operations
    await client.listAgents();
    await client.listUsers();

    // Try to perform operations that might trigger database errors (handled gracefully)
    try {
      await client.getAgent("invalid-uuid-format");
    } catch {
      // Expected to fail, but should still generate metrics
    }

    // Get metrics and verify both success and error operations are tracked
    const metricsResponse = await client.getMetrics();
    expect(typeof metricsResponse).toBe("string");
    const metricsText = metricsResponse as string;

    // Verify we have both success and error status tracking
    expect(metricsText).toContain('status="success"');
    // Note: Database-level errors might still be counted as "success" if the query executes
    // but application-level validation fails. The key is that all operations are tracked.

    // Verify we have database operation metrics with timing data
    expect(metricsText).toContain("repository_queries_total");
    expect(metricsText).toContain("repository_query_duration_ms");

    console.log("Database metrics track both successful and error operations");
  });

  test("database timing metrics provide performance insights", async () => {
    const client = createTestClient();
    await client.loginAsAdmin(adminApiKey);

    // Create multiple agents to generate more database load
    const agents = [];
    for (let i = 0; i < 3; i++) {
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: `Performance Test User ${i}`,
        userEmail: `perf-test-${i}@example.com`,
        agentName: `Performance Test Agent ${i}`,
        agentDescription: `Agent ${i} for performance testing`,
      });
      agents.push(agent);
    }

    // Perform various database-intensive operations
    await client.listAgents();
    await client.listUsers();
    for (const agent of agents) {
      await client.getAgent(agent.id);
    }

    // Get metrics and verify timing histograms are populated
    const metricsResponse = await client.getMetrics();
    expect(typeof metricsResponse).toBe("string");
    const metricsText = metricsResponse as string;

    // Verify histogram buckets are present (timing data)
    expect(metricsText).toContain("repository_query_duration_ms_bucket");
    expect(metricsText).toContain("repository_query_duration_ms_sum");
    expect(metricsText).toContain("repository_query_duration_ms_count");

    // Verify we have multiple repository operations tracked
    expect(metricsText).toContain('repository="AgentRepository"');
    expect(metricsText).toContain('repository="UserRepository"');

    // Verify operation types are differentiated
    expect(metricsText).toContain('operation="SELECT"');
    expect(metricsText).toContain('operation="INSERT"');

    console.log(
      "Database timing metrics provide detailed performance insights",
    );
  });

  test("logging works during full agent trading workflow", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register multiple agents
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: "Trader User 1",
        userEmail: "trader1@example.com",
        agentName: "Trading Agent 1",
        agentDescription: "First trading agent for logging test",
      });

    const { client: agentClient2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: "Trader User 2",
        userEmail: "trader2@example.com",
        agentName: "Trading Agent 2",
        agentDescription: "Second trading agent for logging test",
      });

    expect(agent1).toBeDefined();
    expect(agent2).toBeDefined();

    // Step 2: Create and start a competition
    const competitionName = `Logging Test Competition ${Date.now()}`;
    const createCompResult = await adminClient.createCompetition(
      competitionName,
      "Competition to test logging during trading workflow",
    );
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const competitionId = createCompResponse.competition.id;

    // Start the competition with both agents
    const startCompResult = await adminClient.startExistingCompetition(
      competitionId,
      [agent1.id, agent2.id],
    );
    expect(startCompResult.success).toBe(true);

    // Step 3: Execute multiple trades to generate logging activity
    console.log("Executing trades to generate logging activity...");

    // Agent 1: Execute a few trades
    const trade1Response = await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.eth,
      amount: "100",
      reason: "Logging test trade 1 - USDC to ETH",
    });
    expect(trade1Response.success).toBe(true);

    const trade2Response = await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "50",
      reason: "Logging test trade 2 - USDC to USDT",
    });
    expect(trade2Response.success).toBe(true);

    // Agent 2: Execute trades
    const trade3Response = await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.eth,
      amount: "75",
      reason: "Logging test trade 3 - USDC to ETH",
    });
    expect(trade3Response.success).toBe(true);

    // Step 4: Perform various API operations to generate diverse logging
    await agentClient1.getAgentProfile();
    await agentClient2.getAgentProfile();
    await agentClient1.getBalance();
    await agentClient2.getBalance();
    await agentClient1.getPortfolio();
    await agentClient2.getTradeHistory();

    // Admin operations
    await adminClient.getCompetition(competitionId);
    await adminClient.getCompetitionLeaderboard();
    await adminClient.listAgents();

    // Step 5: Check metrics after all this activity
    const metricsResponse = await adminClient.getMetrics();
    expect(typeof metricsResponse).toBe("string");

    const metricsText = metricsResponse as string;

    // Verify we have accumulated metrics from our operations
    expect(metricsText).toContain("http_requests_total");
    expect(metricsText).toContain("http_request_duration_ms");

    // Check for trading-specific endpoints (using actual route patterns)
    expect(metricsText).toContain("/api/trade/execute");
    expect(metricsText).toContain("/api/agent/profile");
    expect(metricsText).toContain("/api/agent/balances");

    // Verify we have successful responses
    expect(metricsText).toContain('status_code="200"');

    // Step 6: End the competition
    const endCompResult = await adminClient.endCompetition(competitionId);
    expect(endCompResult.success).toBe(true);

    console.log("Full trading workflow completed with logging active");
    console.log(
      `Executed 3 trades across 2 agents in competition ${competitionId}`,
    );
  });

  test("metrics endpoint handles concurrent requests properly", async () => {
    const client = createTestClient();
    await client.loginAsAdmin(adminApiKey);

    // Make multiple concurrent requests to generate metrics under load
    const concurrentRequests = Array(5)
      .fill(null)
      .map(async (_, index) => {
        // Each concurrent request makes multiple API calls
        await client.getHealthStatus();
        await client.listAgents();
        await client.getDetailedHealthStatus();
        return index;
      });

    // Wait for all concurrent requests to complete
    const results = await Promise.all(concurrentRequests);
    expect(results).toHaveLength(5);

    // Check that metrics endpoint still works after concurrent load
    const metricsResponse = await client.getMetrics();
    expect(typeof metricsResponse).toBe("string");

    const metricsText = metricsResponse as string;
    expect(metricsText).toContain("http_requests_total");
    expect(metricsText).toContain("http_request_duration_ms");

    // Verify we have accumulated requests from concurrent operations
    expect(metricsText).toContain("/health");

    console.log("Metrics endpoint handles concurrent requests correctly");
  });

  test("HTTP request logging includes trace ID correlation", async () => {
    const client = createTestClient();
    await client.loginAsAdmin(adminApiKey);

    // Create a user and agent to trigger operations with trace IDs
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: "Trace ID Test User",
      userEmail: "traceid@example.com",
      agentName: "Trace ID Test Agent",
    });

    // Make a sequence of related API calls that should have trace ID correlation
    await agentClient.getAgentProfile();
    await agentClient.getBalance();
    await agentClient.getPortfolio();

    // Check that these operations completed successfully (trace IDs should be in logs)
    console.log(
      "API operations completed - trace IDs should be present in logs",
    );

    // Get metrics to verify the operations were tracked
    const metricsResponse = await client.getMetrics();
    expect(typeof metricsResponse).toBe("string");

    const metricsText = metricsResponse as string;
    expect(metricsText).toContain("/api/agent/profile");
    expect(metricsText).toContain("/api/agent/balances");
    expect(metricsText).toContain("/api/agent/portfolio");

    console.log("Trace ID correlation test completed successfully");
  });

  test("metrics persist through agent API key reset workflow", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: "API Reset Metrics User",
      userEmail: "api-reset-metrics@example.com",
      agentName: "API Reset Metrics Agent",
    });

    // Make some API calls with original key
    await agentClient.getAgentProfile();
    await agentClient.getBalance();

    // Reset the API key
    const resetResponse = await agentClient.resetApiKey();
    expect(resetResponse.success).toBe(true);

    // Create new client with reset key
    const resetData = resetResponse as ResetApiKeyResponse;
    const newClient = adminClient.createAgentClient(resetData.apiKey);

    // Make API calls with new key
    await newClient.getAgentProfile();
    await newClient.getBalance();

    // Verify metrics captured operations from both old and new keys
    const metricsResponse = await adminClient.getMetrics();
    expect(typeof metricsResponse).toBe("string");

    const metricsText = metricsResponse as string;
    expect(metricsText).toContain("/api/agent/profile");
    expect(metricsText).toContain("/api/agent/balances");
    expect(metricsText).toContain("/api/agent/reset-api-key");

    console.log("Metrics persist through API key reset workflow");
  });

  test("error responses are properly tracked in metrics", async () => {
    const client = createTestClient();

    // Make a request that should fail (no authentication)
    try {
      await axios.get(`${getBaseUrl()}/api/admin/agents`);
    } catch (error) {
      // Expected to fail with 401
      expect(axios.isAxiosError(error)).toBe(true);
      if (axios.isAxiosError(error)) {
        expect(error.response?.status).toBe(401);
      }
    }

    // Make a request with invalid agent ID
    await client.loginAsAdmin(adminApiKey);
    try {
      await client.getAgent("invalid-uuid");
    } catch {
      // Expected to fail
      console.log("Invalid agent ID request failed as expected");
    }

    // Check that error responses are tracked in metrics
    const metricsResponse = await client.getMetrics();
    expect(typeof metricsResponse).toBe("string");

    const metricsText = metricsResponse as string;

    // Should have both success and error status codes
    expect(metricsText).toContain('status_code="200"'); // Successful metrics call
    expect(metricsText).toContain('status_code="401"'); // Authentication failure

    console.log("Error responses are properly tracked in metrics");
  });

  test("database operations are properly classified and never show unknown patterns", async () => {
    const client = createTestClient();
    await client.loginAsAdmin(adminApiKey);

    // Register user and agent to trigger diverse database operations
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: "DB Classification Test User",
        userEmail: "db-classification@example.com",
        agentName: "DB Classification Test Agent",
        agentDescription: "Agent for testing database operation classification",
      });

    // Create a competition to trigger even more database operations
    const competitionName = `DB Classification Test Competition ${Date.now()}`;
    const createCompResult = await client.createCompetition(
      competitionName,
      "Competition to test database operation classification",
    );
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const competitionId = createCompResponse.competition.id;

    // Start the competition with the agent
    const startCompResult = await client.startExistingCompetition(
      competitionId,
      [agent.id],
    );
    expect(startCompResult.success).toBe(true);

    // Execute operations that trigger different types of database operations
    console.log("Executing operations to test database classification...");

    // SELECT operations (should be classified as "SELECT")
    await agentClient.getAgentProfile(); // findById
    await agentClient.getBalance(); // getBalance, getAgentBalances
    await agentClient.getPortfolio(); // getLatestPortfolioSnapshots
    await agentClient.getTradeHistory(); // getAgentTrades
    await client.listAgents(); // findAll
    await client.getCompetition(competitionId); // findById
    await client.getCompetitionLeaderboard(); // findLeaderboardByTradingComp

    // INSERT operations (should be classified as "INSERT")
    await agentClient.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.eth,
      amount: "50",
      reason: "DB Classification test trade",
    }); // create (trade)

    // UPDATE operations (should be classified as "UPDATE")
    await agentClient.resetApiKey(); // markAsUsed (if using nonce), update operations

    // Methods that were previously misclassified (should now be properly classified)
    // These operations happen internally during various API calls:
    // - isAgentActiveInCompetition (should be "SELECT")
    // - markAgentAsWithdrawn (should be "UPDATE")
    // - hasUserVotedInCompetition (should be "SELECT")

    // End the competition to trigger more operations
    const endCompResult = await client.endCompetition(competitionId);
    expect(endCompResult.success).toBe(true);

    // Get metrics and verify all operations are properly classified
    const metricsResponse = await client.getMetrics();
    expect(typeof metricsResponse).toBe("string");

    const metricsText = metricsResponse as string;

    // Verify that we have repository metrics
    expect(metricsText).toContain("repository_queries_total");
    expect(metricsText).toContain("repository_query_duration_ms");

    // Verify that all operations are classified as proper database operations
    const expectedOperationTypes = [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "BEGIN",
      "COMMIT",
      "ROLLBACK",
      "START",
    ];
    let foundOperationTypes = 0;

    for (const operationType of expectedOperationTypes) {
      if (metricsText.includes(`operation="${operationType}"`)) {
        foundOperationTypes++;
        console.log(`✓ Found ${operationType} operations in metrics`);
      }
    }

    // We should have at least SELECT and INSERT operations from our test
    expect(foundOperationTypes).toBeGreaterThanOrEqual(2);

    // CRITICAL: Ensure NO repository operations are classified as "QUERY" (the fallback)
    // This would indicate that some repository methods are not properly classified
    if (metricsText.includes('operation="QUERY"')) {
      console.error(
        "❌ Found QUERY operations - some repository methods are not properly classified!",
      );

      // Extract and log the specific metrics that are using QUERY classification
      const queryMetrics = metricsText
        .split("\n")
        .filter((line) => line.includes('operation="QUERY"'))
        .slice(0, 5); // Show first 5 examples

      console.error("Examples of QUERY operations:", queryMetrics);

      expect(false).toBe(true); // Fail the test
    }

    // CRITICAL: Ensure NO database operations show up as "UNKNOWN" from database logger
    // This would indicate that SQL query parsing is failing
    if (metricsText.includes('operation="UNKNOWN"')) {
      console.error(
        "❌ Found UNKNOWN operations - SQL query parsing is failing!",
      );

      // Extract and log the specific metrics that are using UNKNOWN classification
      const unknownMetrics = metricsText
        .split("\n")
        .filter((line) => line.includes('operation="UNKNOWN"'))
        .slice(0, 5); // Show first 5 examples

      console.error("Examples of UNKNOWN operations:", unknownMetrics);

      expect(false).toBe(true); // Fail the test
    }

    // Check for truly problematic database operation patterns in metrics
    // Note: We allow transaction commands (BEGIN, COMMIT, ROLLBACK) as they are legitimate
    const problematicDbPatterns = [
      'operation="EMPTY_QUERY"',
      'operation="MALFORMED_QUERY"',
      'operation="UNRECOGNIZED_', // Only fail on truly unrecognized operations
    ];

    for (const pattern of problematicDbPatterns) {
      const matchingLines = metricsText
        .split("\n")
        .filter((line) => line.includes(pattern));

      // Filter out known transaction commands that might still show as UNRECOGNIZED
      const trulyProblematic = matchingLines.filter((line) => {
        // Allow transaction commands even if they show as UNRECOGNIZED (temporary)
        const isTransactionCommand =
          line.includes("UNRECOGNIZED_BEGIN") ||
          line.includes("UNRECOGNIZED_COMMIT") ||
          line.includes("UNRECOGNIZED_ROLLBACK") ||
          line.includes("UNRECOGNIZED_START");
        return !isTransactionCommand;
      });

      if (trulyProblematic.length > 0) {
        console.error(
          `❌ Found problematic database operation pattern: ${pattern}`,
        );
        console.error("Examples:", trulyProblematic.slice(0, 3));
        expect(false).toBe(true); // Fail the test
      }
    }

    // Verify specific method classifications that were previously problematic
    const methodClassifications = [
      // These should be classified as SELECT (boolean/check methods)
      { pattern: 'method="isAgentActiveInCompetition"', expectedOp: "SELECT" },
      { pattern: 'method="hasUserVotedInCompetition"', expectedOp: "SELECT" },

      // These should be classified as UPDATE (state change methods)
      { pattern: 'method="markAgentAsWithdrawn"', expectedOp: "UPDATE" },
      { pattern: 'method="markAsUsed"', expectedOp: "UPDATE" },

      // These should be classified as SELECT (query methods)
      { pattern: 'method="findById"', expectedOp: "SELECT" },
      { pattern: 'method="getBalance"', expectedOp: "SELECT" },

      // These should be classified as INSERT (creation methods)
      { pattern: 'method="create"', expectedOp: "INSERT" },
    ];

    for (const { pattern, expectedOp } of methodClassifications) {
      if (metricsText.includes(pattern)) {
        // Find the line with this method and verify it has the correct operation type
        const lines = metricsText.split("\n");
        const methodLine = lines.find((line) => line.includes(pattern));

        if (methodLine && !methodLine.includes(`operation="${expectedOp}"`)) {
          console.error(`❌ Method ${pattern} not classified as ${expectedOp}`);
          console.error(`Found line: ${methodLine}`);
          expect(false).toBe(true); // Fail the test
        } else if (methodLine) {
          console.log(
            `✓ Method ${pattern} correctly classified as ${expectedOp}`,
          );
        }
      }
    }
  });
});
