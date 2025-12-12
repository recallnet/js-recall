// ABOUTME: Tests for trade execution parameter validation in multi-competition architecture
// ABOUTME: Verifies competitionId validation, non-existent competition handling, and agent authorization
import { describe, expect, test } from "vitest";

import {
  BlockchainType,
  CROSS_CHAIN_TRADING_TYPE,
  ErrorResponse,
  StartCompetitionResponse,
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { config } from "@/config/index.js";

describe("Trade Execution Validation", () => {
  test("POST /trade/execute returns 400 when competitionId is missing", async () => {
    const adminApiKey = await getAdminApiKey();

    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Test Missing CompId Agent",
      agentDescription: "Agent to test missing competitionId validation",
    });

    // Use raw axios to bypass TypeScript type checking and test missing parameter
    try {
      await agentClient["axiosInstance"].post("/trade/execute", {
        fromToken: config.specificChainTokens.svm.usdc,
        toToken: config.specificChainTokens.svm.sol,
        amount: "100",
        // competitionId: INTENTIONALLY MISSING
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Testing missing competitionId validation",
      });

      // If we get here, the test should fail
      expect.fail("Expected request to fail with 400 error");
    } catch (error: unknown) {
      // Verify this is an axios error with the expected response
      expect(error).toBeDefined();
      const axiosError = error as {
        response?: {
          status: number;
          data: { success: boolean; error: string };
        };
      };
      expect(axiosError.response).toBeDefined();
      expect(axiosError.response?.status).toBe(400);
      expect(axiosError.response?.data.success).toBe(false);
      expect(axiosError.response?.data.error).toContain(
        "Missing required parameter: competitionId. Use POST /api/trade/execute with competitionId in body",
      );
    }
  });

  test("POST /trade/execute returns 404 when competitionId references non-existent competition", async () => {
    const adminApiKey = await getAdminApiKey();

    // Start a competition and register an agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Test Invalid CompId Agent",
      agentDescription: "Agent to test non-existent competitionId",
    });

    // Try to execute trade with non-existent competition UUID
    const tradeResponse = await agentClient.executeTrade({
      fromToken: config.specificChainTokens.svm.usdc,
      toToken: config.specificChainTokens.svm.sol,
      amount: "100",
      competitionId: "00000000-0000-0000-0000-000000000000", // Non-existent competition
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Testing non-existent competition",
    });

    expect(tradeResponse.success).toBe(false);
    const tradeError = tradeResponse as ErrorResponse;

    // Should return 404 when competition doesn't exist
    expect(tradeError.status).toBe(404);
    expect(tradeError.error.toLowerCase()).toContain("competition");
    expect(tradeError.error.toLowerCase()).toMatch(/not found|does not exist/);
  });

  test("POST /trade/execute returns 403 when agent not registered in competition", async () => {
    const adminApiKey = await getAdminApiKey();
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create agent 1 and start competition with ONLY agent 1
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 1 - In Competition",
      agentDescription: "Agent registered in competition",
    });

    const competitionResponse = (await adminClient.startCompetition({
      name: `Test Competition ${Date.now()}`,
      agentIds: [agent1.id], // Only agent1 registered
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    })) as StartCompetitionResponse;
    const competitionId = competitionResponse.competition.id;

    // Create agent 2 (NOT in competition)
    const { client: agent2Client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 2 - Not In Competition",
      agentDescription: "Agent NOT registered in competition",
    });

    // Agent 2 tries to trade in agent 1's competition
    const tradeResponse = await agent2Client.executeTrade({
      fromToken: config.specificChainTokens.svm.usdc,
      toToken: config.specificChainTokens.svm.sol,
      amount: "100",
      competitionId, // Valid competition, but agent2 not registered
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Testing unauthorized agent trading",
    });

    expect(tradeResponse.success).toBe(false);
    const tradeError = tradeResponse as ErrorResponse;

    // Should return 403 Forbidden when agent not authorized
    expect(tradeError.status).toBe(403);
    expect(tradeError.error.toLowerCase()).toMatch(
      /not (?:in|registered|part of)|not authorized|access denied/,
    );
  });
});
