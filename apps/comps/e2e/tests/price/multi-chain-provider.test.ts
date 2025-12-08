import dotenv from "dotenv";
import { beforeEach, describe, expect, it } from "vitest";

import { PriceTrackerService } from "@recallnet/services";
import { MultiChainProvider } from "@recallnet/services/providers";
import {
  BlockchainType,
  PriceSource,
  SpecificChain,
} from "@recallnet/services/types";
import { PriceResponse } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { config } from "@/config/private";
import { createLogger } from "@/lib/logger";

const logger = createLogger("MultiChainProviderTest");

// Load environment variables
dotenv.config();

// Test tokens for various chains
const testTokens = {
  // Ethereum Mainnet
  eth: {
    ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  // Polygon
  polygon: {
    MATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  // Binance Smart Chain
  bsc: {
    BNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
    USDT: "0x55d398326f99059fF775485246999027B3197955",
  },
  // Arbitrum
  arbitrum: {
    ETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  },
  // Optimism
  optimism: {
    ETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },
  // Base
  base: {
    ETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  // Solana tokens for comparison
  svm: {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
};

describe("Multi-Chain Provider Tests", () => {
  let multiChainProvider: MultiChainProvider;
  let priceTracker: PriceTrackerService;
  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();

    // Initialize providers
    multiChainProvider = new MultiChainProvider(config, logger);
    priceTracker = new PriceTrackerService(multiChainProvider, config, logger);
  });

  describe("Multi-chain token detection", () => {
    it("should correctly identify the blockchain type for EVM tokens", () => {
      // Test Ethereum mainnet token
      const ethToken = testTokens.eth.ETH;
      const ethChain = multiChainProvider.determineChain(ethToken);
      expect(ethChain).toBe(BlockchainType.EVM);

      // Test Polygon token
      const polygonToken = testTokens.polygon.MATIC;
      const polygonChain = multiChainProvider.determineChain(polygonToken);
      expect(polygonChain).toBe(BlockchainType.EVM);

      // Test BSC token
      const bscToken = testTokens.bsc.BNB;
      const bscChain = multiChainProvider.determineChain(bscToken);
      expect(bscChain).toBe(BlockchainType.EVM);
    });

    it("should correctly identify Solana token addresses", () => {
      const solToken = testTokens.svm.SOL;
      const solChain = multiChainProvider.determineChain(solToken);
      expect(solChain).toBe(BlockchainType.SVM);

      const usdcToken = testTokens.svm.USDC;
      const usdcChain = multiChainProvider.determineChain(usdcToken);
      expect(usdcChain).toBe(BlockchainType.SVM);
    });
  });

  describe("Multi-chain price fetching", () => {
    it("should try to fetch prices for Ethereum mainnet tokens", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Ensure there is an active competition (required by price route middleware)
      const { agent, client } = await registerUserAndAgentAndGetClient({
        adminApiKey,
      });
      const startResp = await adminClient.startCompetition({
        name: `Eth Token Price Test ${Date.now()}`,
        agentIds: [agent.id],
      });
      expect(startResp.success).toBe(true);

      // Test direct price fetching from MultiChainProvider
      const ethToken = testTokens.eth.ETH;

      // Get price using the MultiChainProvider
      const priceReport = await multiChainProvider.getPrice(
        ethToken,
        BlockchainType.EVM,
      );

      // Test that chain detection works
      const chain = multiChainProvider.determineChain(ethToken);
      expect(chain).toBe(BlockchainType.EVM);

      // We should always get a price report for a valid ETH token
      expect(priceReport).not.toBeNull();
      expect(priceReport!.price).toBeGreaterThan(0);
      expect(priceReport!.chain).toBe(BlockchainType.EVM);
      expect(priceReport!.specificChain).toBe("eth");

      // Test through the API endpoint
      const response = (await client.getPrice(ethToken)) as PriceResponse;

      // Check if response is successful
      expect(response.success).toBe(true);
      expect(response.chain).toBe(BlockchainType.EVM);
      expect(response.price).toBeDefined();
      expect(typeof response.price).toBe("number");
      expect(response.price).toBeGreaterThan(0);
    });

    it("should try to fetch prices for Base tokens", async () => {
      const baseToken = testTokens.base.ETH;

      // Get price directly from MultiChainProvider with specific chain
      const priceReport = await multiChainProvider.getPrice(
        baseToken,
        BlockchainType.EVM,
        "base",
      );

      // Test that chain detection works
      const chain = multiChainProvider.determineChain(baseToken);
      expect(chain).toBe(BlockchainType.EVM);

      // We should always get a price report for a valid Base ETH token
      expect(priceReport).not.toBeNull();
      expect(priceReport!.price).toBeGreaterThan(0);
      expect(priceReport!.chain).toBe(BlockchainType.EVM);
      expect(priceReport!.specificChain).toBe("base");
    });

    it("should try to fetch prices for unknown tokens by searching multiple chains", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Ensure there is an active competition (required by price route middleware)
      const { agent, client } = await registerUserAndAgentAndGetClient({
        adminApiKey,
      });
      const startResp = await adminClient.startCompetition({
        name: `Unknown Token Price Test ${Date.now()}`,
        agentIds: [agent.id],
      });
      expect(startResp.success).toBe(true);

      // Example token from Base chain (this is a real token, but may not be in our test data)
      const unknownToken = "0x532f27101965dd16442E59d40670FaF5eBB142E4";

      // First check if the MultiChainProvider can find this token
      const priceReport = await multiChainProvider.getPrice(
        unknownToken,
        BlockchainType.EVM,
      );

      // We don't assert a specific result here since it depends on the token existence
      // If the token exists on any chain, we'll get a result
      if (priceReport !== null) {
        expect(priceReport.price).toBeGreaterThan(0);
        expect(priceReport.chain).toBe(BlockchainType.EVM);
        expect(priceReport.specificChain).toBeDefined();
      }

      // Test the token through the API
      const apiResponse = (await client.getPrice(
        unknownToken,
      )) as PriceResponse;

      // Validate that the chain is correctly identified
      expect(apiResponse.success).toBe(true);
      expect(apiResponse.chain).toBe(BlockchainType.EVM);
    });

    it("should find token on Base chain", async () => {
      // Token from the base chain
      const baseToken = "0x532f27101965dd16442e59d40670faf5ebb142e4";

      // Call getPrice to get the result
      const priceReport = await multiChainProvider.getPrice(
        baseToken,
        BlockchainType.EVM,
        "base",
      );

      // The API should work correctly and return a non-null price
      expect(priceReport).not.toBeNull();
      expect(typeof priceReport).toBe("object");
      expect(priceReport!.price).toBeGreaterThan(0);
      expect(priceReport!.chain).toBe(BlockchainType.EVM);
      expect(priceReport!.specificChain).toBe("base");
    }, 60000); // Increase timeout for API calls

    it("should handle token lookups without specific chain parameter", async () => {
      // Use a known token that should work without specific chain
      const ethToken = testTokens.eth.ETH; // WETH token

      // Test MultiChainProvider directly
      const multiChainResult = await multiChainProvider.getPrice(
        ethToken,
        BlockchainType.EVM,
      );

      // MultiChainProvider should find the ETH token
      expect(multiChainResult).not.toBeNull();
      expect(multiChainResult!.price).toBeGreaterThan(0);
      expect(multiChainResult!.chain).toBe(BlockchainType.EVM);
      expect(multiChainResult!.specificChain).toBe("eth");

      // Check PriceTracker
      const priceTracker = new PriceTrackerService(
        multiChainProvider,
        config,
        logger,
      );

      // Make sure the PriceTracker has the MultiChainProvider
      const providers = priceTracker.providers;
      expect(providers.length).toBe(1);

      // Find MultiChainProvider in the list
      const hasMultiChain = providers.some((p: PriceSource) =>
        p.getName().includes("MultiChain"),
      );
      expect(hasMultiChain).toBe(true);

      // Get price through PriceTracker
      const trackerPriceReport = await priceTracker.getPrice(ethToken);

      // The price report should have info regardless of the price
      expect(trackerPriceReport).not.toBeNull();
      expect(trackerPriceReport!.chain).toBe(BlockchainType.EVM);
      if (trackerPriceReport!.price !== null) {
        expect(trackerPriceReport!.price).toBeGreaterThan(0);
      }
    });

    it("should fetch prices for specific known tokens across different chains", async () => {
      // List of known tokens that should work with DexScreener
      const knownTokens = [
        {
          address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
          name: "Arbitrum (ARB)",
          expectedChain: "arbitrum",
        },
        {
          address: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
          name: "TOSHI Token",
          expectedChain: "base",
        },
        {
          address: "0x514910771af9ca656af840dff83e8264ecf986ca",
          name: "Chainlink (LINK)",
          expectedChain: "eth",
        },
      ];

      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Ensure there is an active competition (required by price route middleware)
      const { agent, client } = await registerUserAndAgentAndGetClient({
        adminApiKey,
      });
      const startResp = await adminClient.startCompetition({
        name: `Different Chain Price Test ${Date.now()}`,
        agentIds: [agent.id],
      });
      expect(startResp.success).toBe(true);

      // Test each token directly with the MultiChainProvider
      for (const token of knownTokens) {
        // First verify chain detection
        const chainType = multiChainProvider.determineChain(token.address);
        expect(chainType).toBe(BlockchainType.EVM);

        // Try to get price with the specific chain parameter
        const priceReport = await multiChainProvider.getPrice(
          token.address,
          BlockchainType.EVM,
          token.expectedChain as SpecificChain,
        );

        // We should get a valid price report for known tokens
        expect(priceReport).not.toBeNull();
        expect(priceReport!.chain).toBe(BlockchainType.EVM);

        // Price should not be null and should be valid
        expect(priceReport!.price).not.toBeNull();
        expect(typeof priceReport!.price).toBe("number");
        expect(priceReport!.price).toBeGreaterThan(0);

        // Chain should match our expectation
        expect(priceReport!.specificChain).toBeDefined();
        expect(priceReport!.specificChain).toBe(token.expectedChain);

        // Test through the API endpoint
        const apiResponse = (await client.getPrice(
          token.address,
        )) as PriceResponse;

        // Chain type should always be correctly identified
        expect(apiResponse.chain).toBe(BlockchainType.EVM);
        expect(apiResponse.price).toBeGreaterThan(0);
      }
    }, 60000); // 60 second timeout for API tests
  });

  describe("Logging validation", () => {
    it("should log actual price values instead of [object Object]", async () => {
      // Capture console.log output
      const originalConsoleLog = console.log;
      const logMessages: string[] = [];

      console.log = (...args: unknown[]) => {
        const message = args.join(" ");
        logMessages.push(message);
      };

      try {
        // Use a known Solana token to trigger the Solana logging path
        const solToken = testTokens.svm.SOL;

        await multiChainProvider.getPrice(solToken, BlockchainType.SVM, "svm");

        // Find log messages that contain price information
        const priceLogMessages = logMessages.filter(
          (msg) =>
            msg.includes("[MultiChainProvider]") &&
            msg.includes("Successfully found") &&
            msg.includes("$"),
        );

        if (priceLogMessages.length > 0) {
          // Verify that none of the log messages contain "[object Object]"
          for (const message of priceLogMessages) {
            expect(message).not.toContain("[object Object]");
            expect(message).not.toContain("$[object Object]");

            // Verify the message contains a proper price format like "$163.64"
            const priceMatch = message.match(/\$(\d+\.?\d*)/);
            if (priceMatch && priceMatch[1]) {
              const priceValue = parseFloat(priceMatch[1]);
              expect(priceValue).toBeGreaterThan(0);
            }
          }
        }

        // Also test with an EVM token to check those logging paths
        const ethToken = testTokens.eth.ETH;
        await multiChainProvider.getPrice(ethToken, BlockchainType.EVM, "eth");

        // Check for EVM price log messages too
        const evmPriceLogMessages = logMessages.filter(
          (msg) =>
            msg.includes("[MultiChainProvider]") &&
            msg.includes("Successfully found") &&
            msg.includes("$") &&
            !priceLogMessages.includes(msg), // Exclude already checked messages
        );

        for (const message of evmPriceLogMessages) {
          expect(message).not.toContain("[object Object]");
          expect(message).not.toContain("$[object Object]");

          const priceMatch = message.match(/\$(\d+\.?\d*)/);
          if (priceMatch && priceMatch[1]) {
            const priceValue = parseFloat(priceMatch[1]);
            expect(priceValue).toBeGreaterThan(0);
          }
        }
      } finally {
        // Restore original console.log
        console.log = originalConsoleLog;
      }
    }, 30000);
  });

  describe("API integration for multi-chain price fetching", () => {
    it("should fetch token price using price tracker service", async () => {
      // Use a common token with reliable price data
      const token = testTokens.eth.ETH;

      // Get price from price tracker directly
      const priceReport = await priceTracker.getPrice(token);

      // Price tracker should find the ETH token
      expect(priceReport).not.toBeNull();
      expect(priceReport!.price).not.toBeNull();
      expect(priceReport!.price).toBeGreaterThan(0);
      expect(priceReport!.chain).toBe(BlockchainType.EVM);
      expect(priceReport!.specificChain).toBe("eth");

      // Get token info directly from MultiChainProvider to verify chain detection
      const chain = multiChainProvider.determineChain(token);
      expect(chain).toBe(BlockchainType.EVM);

      // The priceReport should already be verified as not null, and we can check chain info
      expect(priceReport).not.toBeNull();
      expect(priceReport!.chain).toBe(BlockchainType.EVM);
      if (priceReport!.specificChain) {
        expect(typeof priceReport!.specificChain).toBe("string");
      }
    });

    it("should handle errors gracefully for unsupported tokens", async () => {
      // Test with an invalid token address
      const invalidToken = "not-a-valid-token-address";

      // This should throw an error for invalid token
      const priceReport = await priceTracker.getPrice(invalidToken);
      expect(priceReport).toBeNull();
    });
  });

  describe("Native USDC pairing verification", () => {
    it("should correctly pair tokens with native USDC on Polygon", async () => {
      const linkOnPolygon = "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39";

      const priceReport = await multiChainProvider.getPrice(
        linkOnPolygon,
        BlockchainType.EVM,
        "polygon",
      );

      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.specificChain).toBe("polygon");
    }, 15000);

    it("should fetch native USDC price on Polygon", async () => {
      const priceReport = await multiChainProvider.getPrice(
        testTokens.polygon.USDC,
        BlockchainType.EVM,
        "polygon",
      );

      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBeCloseTo(1, 1);
      expect(priceReport?.specificChain).toBe("polygon");
    }, 15000);

    it("should fetch native USDC price on Arbitrum", async () => {
      const priceReport = await multiChainProvider.getPrice(
        testTokens.arbitrum.USDC,
        BlockchainType.EVM,
        "arbitrum",
      );

      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBeCloseTo(1, 1);
      expect(priceReport?.specificChain).toBe("arbitrum");
    }, 15000);

    it("should fetch native USDC price on Optimism", async () => {
      const priceReport = await multiChainProvider.getPrice(
        testTokens.optimism.USDC,
        BlockchainType.EVM,
        "optimism",
      );

      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBeCloseTo(1, 1);
      expect(priceReport?.specificChain).toBe("optimism");
    }, 15000);
  });
});
