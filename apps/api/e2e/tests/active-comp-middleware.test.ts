import { describe, expect, test } from "vitest";

import { BlockchainType } from "@recallnet/services/types";
import { ErrorResponse } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  wait,
} from "@recallnet/test-utils";

import { config } from "@/config/index.js";

describe("Active Competition Middleware", () => {
  test("GET /api/price returns 403 when no active competition exists", async () => {
    await wait(100); // ensure cache is expired
    // Setup admin client and login
    const adminApiKey = await getAdminApiKey();
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register a user and agent to obtain an authenticated agent client
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "No Active Comp Agent",
      agentDescription: "Agent to test active competition middleware",
    });

    // Call price endpoint without any active competition
    const token = "0xc02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH
    const priceResponse = await agentClient.getPrice(token);

    // Expect the active competition middleware to block with 403
    expect(priceResponse.success).toBe(false);
    const error = priceResponse as ErrorResponse;
    expect(error.status).toBe(403);
    expect(error.error.toLowerCase()).toContain("no active competition");
  });

  test("POST /api/trade/execute returns 403 when no active competition exists", async () => {
    const adminApiKey = await getAdminApiKey();

    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "No Active Comp Trade Agent",
      agentDescription: "Agent to test active comp trade blocking",
    });

    const tradeResponse = await agentClient.executeTrade({
      fromToken: config.specificChainTokens.svm.usdc,
      toToken: config.specificChainTokens.svm.sol,
      amount: "100",
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Testing active competition middleware for trade",
    });

    expect(tradeResponse.success).toBe(false);
    const tradeError = tradeResponse as ErrorResponse;
    expect(tradeError.status).toBe(403);
    expect(tradeError.error.toLowerCase()).toContain("no active competition");
  });
});
