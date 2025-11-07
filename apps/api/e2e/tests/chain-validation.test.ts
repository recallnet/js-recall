import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { BlockchainType } from "@recallnet/services/types";
import { QuoteResponse } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  noTradingConstraints,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";

describe("Chain Parameter Validation", () => {
  let adminApiKey: string;

  // Solana token addresses for testing
  const SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";
  const USDC_TOKEN_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
  });

  test("rejects 'mainnet' as fromSpecificChain with 400 and validation error", async () => {
    // Setup
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Test Agent",
    });

    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Test Agent 2",
    });

    await startTestCompetition({
      adminClient,
      name: `Chain Validation Test ${Date.now()}`,
      agentIds: [agent.id],
      tradingConstraints: noTradingConstraints,
    });

    await wait(500);

    // Execute trade with invalid fromSpecificChain
    try {
      await client.executeTrade({
        fromToken: USDC_TOKEN_ADDRESS,
        toToken: SOL_TOKEN_ADDRESS,
        amount: "100",
        fromSpecificChain: "mainnet" as any, // Invalid value
        toSpecificChain: "svm",
        reason: "Testing invalid fromSpecificChain",
      });

      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // Should return 400, not 500
        expect(error.response.status).toBe(400);

        // Should have validation error structure
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error).toBe("Validation failed");
        expect(error.response.data.details).toBeDefined();
        expect(Array.isArray(error.response.data.details)).toBe(true);

        // Find the fromSpecificChain error
        const chainError = error.response.data.details.find(
          (d: any) => d.field === "fromSpecificChain",
        );
        expect(chainError).toBeDefined();
        expect(chainError.message).toContain("Invalid enum value");

        // Should include list of valid values
        expect(chainError.validValues).toBeDefined();
        expect(Array.isArray(chainError.validValues)).toBe(true);
        expect(chainError.validValues).toContain("svm");
        expect(chainError.validValues).toContain("eth");
        expect(chainError.validValues).toContain("polygon");
        expect(chainError.validValues).not.toContain("mainnet");
      } else {
        throw error;
      }
    }
  });

  test("rejects 'mainnet' as toSpecificChain with 400 and validation error", async () => {
    // Setup
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Test Agent",
    });

    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Test Agent 2",
    });

    await startTestCompetition({
      adminClient,
      name: `Chain Validation Test ${Date.now()}`,
      agentIds: [agent.id],
      tradingConstraints: noTradingConstraints,
    });

    await wait(500);

    // Execute trade with invalid toSpecificChain
    try {
      await client.executeTrade({
        fromToken: USDC_TOKEN_ADDRESS,
        toToken: SOL_TOKEN_ADDRESS,
        amount: "100",
        fromSpecificChain: "svm",
        toSpecificChain: "mainnet" as any, // Invalid value
        reason: "Testing invalid toSpecificChain",
      });

      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe("Validation failed");

        const chainError = error.response.data.details.find(
          (d: any) => d.field === "toSpecificChain",
        );
        expect(chainError).toBeDefined();
        expect(chainError.validValues).toContain("svm");
        expect(chainError.validValues).not.toContain("mainnet");
      } else {
        throw error;
      }
    }
  });

  test("rejects 'mainnet' as fromChain with 400 and validation error", async () => {
    // Setup
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Test Agent",
    });

    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Test Agent 2",
    });

    await startTestCompetition({
      adminClient,
      name: `Chain Validation Test ${Date.now()}`,
      agentIds: [agent.id],
      tradingConstraints: noTradingConstraints,
    });

    await wait(500);

    // Execute trade with invalid fromChain
    try {
      await client.executeTrade({
        fromToken: USDC_TOKEN_ADDRESS,
        toToken: SOL_TOKEN_ADDRESS,
        amount: "100",
        fromChain: "mainnet" as any, // Invalid value
        toChain: BlockchainType.SVM,
        reason: "Testing invalid fromChain",
      });

      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe("Validation failed");

        const chainError = error.response.data.details.find(
          (d: any) => d.field === "fromChain",
        );
        expect(chainError).toBeDefined();
        expect(chainError.message).toContain("Invalid enum value");
      } else {
        throw error;
      }
    }
  });

  test("rejects 'mainnet' as toChain with 400 and validation error", async () => {
    // Setup
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Test Agent",
    });

    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Test Agent 2",
    });

    await startTestCompetition({
      adminClient,
      name: `Chain Validation Test ${Date.now()}`,
      agentIds: [agent.id],
      tradingConstraints: noTradingConstraints,
    });

    await wait(500);

    // Execute trade with invalid toChain
    try {
      await client.executeTrade({
        fromToken: USDC_TOKEN_ADDRESS,
        toToken: SOL_TOKEN_ADDRESS,
        amount: "100",
        fromChain: BlockchainType.SVM,
        toChain: "mainnet" as any, // Invalid value
        reason: "Testing invalid toChain",
      });

      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe("Validation failed");

        const chainError = error.response.data.details.find(
          (d: any) => d.field === "toChain",
        );
        expect(chainError).toBeDefined();
      } else {
        throw error;
      }
    }
  });

  test("rejects 'mainnet' in GET /api/trade/quote fromSpecificChain parameter", async () => {
    // Setup
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Quote Test Agent",
    });

    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Validation Quote Test Agent 2",
    });

    await startTestCompetition({
      adminClient,
      name: `Chain Validation Quote Test ${Date.now()}`,
      agentIds: [agent.id],
      tradingConstraints: noTradingConstraints,
    });

    await wait(500);

    // Get quote with invalid fromSpecificChain
    try {
      await client.getQuote(
        USDC_TOKEN_ADDRESS,
        SOL_TOKEN_ADDRESS,
        "100",
        undefined,
        "mainnet" as any, // Invalid fromSpecificChain
      );

      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe("Validation failed");

        const chainError = error.response.data.details.find(
          (d: any) => d.field === "fromSpecificChain",
        );
        expect(chainError).toBeDefined();
        expect(chainError.validValues).toBeDefined();
        expect(chainError.validValues).not.toContain("mainnet");
      } else {
        throw error;
      }
    }
  });

  test("accepts valid chain values like 'svm' and 'eth'", async () => {
    // Setup
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Valid Chain Test Agent",
    });

    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Valid Chain Test Agent 2",
    });

    await startTestCompetition({
      adminClient,
      name: `Valid Chain Test ${Date.now()}`,
      agentIds: [agent.id],
      tradingConstraints: noTradingConstraints,
    });

    await wait(500);

    // Test with valid 'svm' chain
    const svmQuote = (await client.getQuote(
      USDC_TOKEN_ADDRESS,
      SOL_TOKEN_ADDRESS,
      "100",
      undefined,
      "svm",
    )) as QuoteResponse;

    expect(svmQuote).toBeDefined();
    expect("error" in svmQuote).toBe(false);
  });
});
