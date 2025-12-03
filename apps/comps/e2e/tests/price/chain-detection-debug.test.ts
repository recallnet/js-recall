import dotenv from "dotenv";
import { beforeEach, describe, expect, it } from "vitest";

import { PriceTrackerService } from "@recallnet/services";
import { MultiChainProvider } from "@recallnet/services/providers";
import { BlockchainType } from "@recallnet/services/types";
import { ApiClient } from "@recallnet/test-utils";
import { PriceResponse } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { config } from "@/config/private";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ChainDetectionDebugTest");

// Load environment variables
dotenv.config();

// Test tokens - same as in other tests
const solanaTokens = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

const ethereumTokens = {
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

describe("Chain Detection Debug", () => {
  // Create variables for authenticated clients
  let adminClient: ApiClient;
  let client: ApiClient;
  let priceTracker: PriceTrackerService;
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();

    // Setup admin client
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user/agent and get an authenticated client
    const result = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });
    client = result.client;

    // Ensure there is an active competition for API price tests
    const startResp = await adminClient.startCompetition({
      name: `Chain Detection Debug ${Date.now()}`,
      agentIds: [result.agent.id],
    });
    expect(startResp.success).toBe(true);

    // Initialize price tracker
    priceTracker = new PriceTrackerService(
      new MultiChainProvider(config, logger),
      config,
      logger,
    );
  });

  describe("Local Chain Detection", () => {
    it("should correctly detect Solana chain locally", () => {
      // Test direct chain detection for Solana tokens
      const chain = priceTracker.determineChain(solanaTokens.SOL);
      expect(chain).toBe(BlockchainType.SVM);
    });

    it("should correctly detect Ethereum chain locally", () => {
      // Test direct chain detection for Ethereum tokens
      const chain = priceTracker.determineChain(ethereumTokens.ETH);
      expect(chain).toBe(BlockchainType.EVM);
    });
  });

  describe("API Tests", () => {
    it("should detect Ethereum token as EVM chain", async () => {
      const response = await client.getPrice(ethereumTokens.ETH);
      expect(response.success).toBe(true); // Type guard to narrow the type
      expect((response as PriceResponse).chain).toBe(BlockchainType.EVM);
    });
  });

  // Only run provider tests if API key is available
  describe("Direct Provider Tests", () => {
    it("should fetch Ethereum price via PriceTracker", async () => {
      // Test PriceTracker (which uses providers internally)
      const price = await priceTracker.getPrice(ethereumTokens.ETH);
      expect(price).not.toBeNull();
      expect(typeof price?.price).toBe("number");
      expect(price?.price).toBeGreaterThan(0);
    });
  });

  describe("Token Info Tests", () => {
    it("should get token info for Ethereum tokens", async () => {
      // Test the getPrice method directly since it's used for EVM tokens
      const priceReport = await priceTracker.getPrice(ethereumTokens.ETH);
      expect(priceReport).not.toBeNull();
      expect(priceReport!.price).toBeGreaterThan(0);
      expect(priceReport!.chain).toBe(BlockchainType.EVM);
    });
  });
});
