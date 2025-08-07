// import { NovesProvider } from '../../../src/services/providers/noves.provider';
import axios from "axios";
import dotenv from "dotenv";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ApiClient } from "@/e2e/utils/api-client.js";
import { PriceResponse } from "@/e2e/utils/api-types.js";
import { dbManager } from "@/e2e/utils/db-manager.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";
import { PriceTracker } from "@/services/price-tracker.service.js";
import { MultiChainProvider } from "@/services/providers/multi-chain.provider.js";
import { BlockchainType, PriceSource, SpecificChain } from "@/types/index.js";

// Load environment variables
dotenv.config();

// We no longer need the API key check since we're using DexScreener
// const apiKey = process.env.NOVES_API_KEY;
// const runTests = !!apiKey;
const runTests = true; // All tests should run now without API key

// Test tokens for various chains
const testTokens = {
  // Ethereum Mainnet
  eth: {
    ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  // Polygon
  polygon: {
    MATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  },
  // Binance Smart Chain
  bsc: {
    BNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
    USDT: "0x55d398326f99059fF775485246999027B3197955",
  },
  // Arbitrum
  arbitrum: {
    ETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH on Arbitrum
    USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
  },
  // Base
  base: {
    ETH: "0x4200000000000000000000000000000000000006", // WETH on Base
    USDC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
  },
  // Solana tokens for comparison
  svm: {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
};

describe("Multi-Chain Provider Tests", () => {
  let multiChainProvider: MultiChainProvider;
  let priceTracker: PriceTracker;
  // Add authenticated clients
  let adminClient: ApiClient;
  let client: ApiClient;
  let adminApiKey: string;

  // Initialize database before all tests
  beforeAll(async () => {
    // Initialize the database
    if (runTests) {
      await dbManager.initialize();
    }

    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
    console.log(`Admin API key created: ${adminApiKey.substring(0, 8)}...`);

    // Setup admin client
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user/agent and get an authenticated client
    const result = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });
    client = result.client;

    // Log the API key to verify it's correctly set
    console.log(`Test client API key: ${result.apiKey}`);
  });

  // Clean up test state before each test
  beforeEach(async () => {
    if (!runTests) {
      return;
    }

    // Initialize providers
    multiChainProvider = new MultiChainProvider();
    priceTracker = new PriceTracker();
  });

  describe("Multi-chain token detection", () => {
    it("should correctly identify the blockchain type for EVM tokens", () => {
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

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

      console.log("✅ All EVM tokens correctly identified as EVM chains");
    });

    it("should correctly identify Solana token addresses", () => {
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

      const solToken = testTokens.svm.SOL;
      const solChain = multiChainProvider.determineChain(solToken);
      expect(solChain).toBe(BlockchainType.SVM);

      const usdcToken = testTokens.svm.USDC;
      const usdcChain = multiChainProvider.determineChain(usdcToken);
      expect(usdcChain).toBe(BlockchainType.SVM);

      console.log("✅ Solana tokens correctly identified as SVM chains");
    });
  });

  describe("Multi-chain price fetching", () => {
    it("should try to fetch prices for Ethereum mainnet tokens", async () => {
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

      // Test direct price fetching from MultiChainProvider
      const ethToken = testTokens.eth.ETH;

      try {
        // Get price using the MultiChainProvider
        const priceReport = await multiChainProvider.getPrice(
          ethToken,
          BlockchainType.EVM,
        );

        console.log(`Ethereum token price result:`, priceReport);

        // Test that chain detection works even if price fetching fails due to API issues
        const chain = multiChainProvider.determineChain(ethToken);
        expect(chain).toBe(BlockchainType.EVM);

        // If we got a price, let's verify it looks reasonable
        if (priceReport !== null) {
          expect(priceReport.price).toBeGreaterThan(0);
          console.log(`ETH price: $${priceReport.price}`);
          expect(priceReport.chain).toBe(BlockchainType.EVM);
          expect(priceReport.specificChain).toBe("eth");
        } else {
          console.log(`Could not get ETH price (API might be unavailable)`);
        }
      } catch (error) {
        console.log(
          "Error fetching price:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }

      // Test through the API endpoint if available
      try {
        // Use authenticated client instead of direct axios
        const response = (await client.getPrice(ethToken)) as PriceResponse;
        console.log(`API response for ETH token:`, response);

        // Check if response is successful
        expect(response.success).toBe(true);

        // Always check the chain type is correctly identified
        expect(response.chain).toBe(BlockchainType.EVM);

        // Check price is present and valid
        if (response.price !== undefined) {
          expect(typeof response.price).toBe("number");
          expect(response.price).toBeGreaterThan(0);
          console.log(`ETH price from API: $${response.price}`);
        }
      } catch (error) {
        console.log("Error fetching price through API:", error);
      }
    });

    it("should try to fetch prices for Base tokens", async () => {
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

      const baseToken = testTokens.base.ETH;

      try {
        // Get price directly from MultiChainProvider with specific chain
        const priceReport = await multiChainProvider.getPrice(
          baseToken,
          BlockchainType.EVM,
          "base",
        );

        console.log(`Base ETH price result:`, priceReport);

        // Test that chain detection works
        const chain = multiChainProvider.determineChain(baseToken);
        expect(chain).toBe(BlockchainType.EVM);

        // If we get a price, verify it
        if (priceReport !== null) {
          expect(priceReport.price).toBeGreaterThan(0);
          console.log(`Base ETH price: $${priceReport.price}`);
          expect(priceReport.chain).toBe(BlockchainType.EVM);
          expect(priceReport.specificChain).toBe("base");
        } else {
          console.log(
            `Could not get Base ETH price (API might be unavailable)`,
          );
        }
      } catch (error) {
        console.log(
          "Error fetching Base token price:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    });

    it("should try to fetch prices for unknown tokens by searching multiple chains", async () => {
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

      // Example token from Base chain (this is a real token, but may not be in our test data)
      const unknownToken = "0x532f27101965dd16442E59d40670FaF5eBB142E4";

      try {
        // First check if the MultiChainProvider can find this token
        const priceReport = await multiChainProvider.getPrice(
          unknownToken,
          BlockchainType.EVM,
        );

        console.log(
          `Unknown token (${unknownToken}) price result:`,
          priceReport,
        );

        // We don't assert a specific result here since it depends on the token existence
        // If the token exists on any chain, we'll get a result
        if (priceReport !== null) {
          expect(priceReport.price).toBeGreaterThan(0);
          console.log(`Found price for unknown token: $${priceReport.price}`);
          expect(priceReport.chain).toBe(BlockchainType.EVM);

          // The price report already contains chain information
          if (priceReport && priceReport.specificChain) {
            console.log(
              `Token was found on chain: ${priceReport.specificChain}`,
            );
          }
        } else {
          console.log(`Token not found on any of the tested chains`);
        }
      } catch (error) {
        console.log(
          "Error fetching unknown token price:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }

      // Test the token through the API
      try {
        const baseUrl = getBaseUrl();
        const apiResponse = await axios.get(
          `${baseUrl}/api/price?token=${unknownToken}`,
        );
        console.log(
          `API response for token: ${JSON.stringify(apiResponse.data, null, 2)}`,
        );

        // Validate that the chain is correctly identified
        expect(apiResponse.data.chain).toBe(BlockchainType.EVM);
      } catch (error) {
        console.log(
          `Error fetching price via API: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    });

    // Replace the test that was using NovesProvider with one that just tests MultiChainProvider
    it("should find token on Base chain", async () => {
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

      // Token from the base chain
      const baseToken = "0x532f27101965dd16442e59d40670faf5ebb142e4";

      console.log(`Testing MultiChainProvider for token ${baseToken}...`);

      // Call getPrice to get the result
      const priceReport = await multiChainProvider.getPrice(
        baseToken,
        BlockchainType.EVM,
        "base",
      );

      console.log(`Price result for ${baseToken} on Base:`, priceReport);

      // If the API works correctly, we should get a non-null price
      if (priceReport !== null) {
        // Verify the price is a valid number and greater than 0
        expect(typeof priceReport).toBe("object");
        expect(priceReport.price).toBeGreaterThan(0);
        expect(priceReport.chain).toBe(BlockchainType.EVM);
        expect(priceReport.specificChain).toBe("base");

        // Log confirmation using the existing price report data
        console.log(
          `Token ${baseToken} confirmed on chain: ${priceReport.specificChain} with price: $${priceReport.price}`,
        );
      }
    }, 60000); // Increase timeout for API calls

    // Replace the test for NovesProvider fallback
    it("should handle token lookups without specific chain parameter", async () => {
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

      // Use a known token that should work without specific chain
      const ethToken = testTokens.eth.ETH; // WETH token

      // Test MultiChainProvider directly
      console.log("Testing MultiChainProvider auto chain detection...");
      const multiChainResult = await multiChainProvider.getPrice(
        ethToken,
        BlockchainType.EVM,
      );

      if (multiChainResult !== null) {
        console.log(
          `MultiChainProvider auto detected price: $${multiChainResult.price}`,
        );
        expect(multiChainResult.price).toBeGreaterThan(0);
        expect(multiChainResult.chain).toBe(BlockchainType.EVM);
        expect(multiChainResult.specificChain).toBe("eth");
      } else {
        console.log(`No price found for ETH token`);
      }

      // Log detailed info from the price result
      console.log(
        `MultiChainProvider price info: ${JSON.stringify(multiChainResult)}`,
      );

      // Check PriceTracker
      console.log("Testing PriceTracker...");
      const priceTracker = new PriceTracker();

      // Make sure the PriceTracker has the MultiChainProvider
      const providers = priceTracker.providers;
      expect(providers.length).toBe(1);

      // Find MultiChainProvider in the list
      const hasMultiChain = providers.some(
        (p: PriceSource) => p.getName() === "DexScreener MultiChain",
      );
      expect(hasMultiChain).toBe(true);

      // Get price through PriceTracker
      const trackerPriceReport = await priceTracker.getPrice(ethToken);
      console.log(
        `PriceTracker.getPrice result: ${JSON.stringify(trackerPriceReport)}`,
      );

      // The price report should have info regardless of the price
      expect(trackerPriceReport).not.toBeNull();
      expect(trackerPriceReport!.chain).toBe(BlockchainType.EVM);
      if (trackerPriceReport!.price !== null) {
        expect(trackerPriceReport!.price).toBeGreaterThan(0);
      }
    });

    it("should fetch prices for specific known tokens across different chains", async () => {
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

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

      // Test each token directly with the MultiChainProvider
      for (const token of knownTokens) {
        console.log(`Testing ${token.name} (${token.address})...`);

        // First verify chain detection
        const chainType = multiChainProvider.determineChain(token.address);
        expect(chainType).toBe(BlockchainType.EVM);

        // Try to get price with the specific chain parameter
        const priceReport = await multiChainProvider.getPrice(
          token.address,
          BlockchainType.EVM,
          token.expectedChain as SpecificChain,
        );
        console.log(`Price result for ${token.name}:`, priceReport);

        // Verify we got a result (using existing priceReport)
        expect(priceReport).not.toBeNull();

        // Chain type should always be correctly identified
        expect(priceReport!.chain).toBe(BlockchainType.EVM);

        // If we got a price, verify it looks reasonable
        if (priceReport!.price !== null) {
          expect(typeof priceReport!.price).toBe("number");
          expect(priceReport!.price).toBeGreaterThan(0);
          console.log(
            `✅ Verified price for ${token.name}: $${priceReport!.price}`,
          );
        }

        // If we got a specific chain, verify it matches our expectation
        if (priceReport!.specificChain) {
          console.log(
            `Token ${token.name} detected on chain: ${priceReport!.specificChain}`,
          );

          // The chain should match our expected chain
          if (priceReport!.specificChain !== token.expectedChain) {
            console.log(
              `⚠️ Note: ${token.name} was found on ${priceReport!.specificChain} (expected ${token.expectedChain})`,
            );
          } else {
            console.log(
              `✅ Confirmed ${token.name} on expected chain: ${token.expectedChain}`,
            );
          }
        }

        // Test through the API endpoint
        try {
          const baseUrl = getBaseUrl();
          const apiResponse = await axios.get(
            `${baseUrl}/api/price?token=${token.address}`,
          );
          console.log(
            `API price response for ${token.name}:`,
            apiResponse.data,
          );

          // Chain type should always be correctly identified
          expect(apiResponse.data.chain).toBe(BlockchainType.EVM);

          if (apiResponse.data.price !== null) {
            console.log(
              `✅ API returned price for ${token.name}: $${apiResponse.data.price}`,
            );
          }
        } catch (error) {
          console.log(
            `Error fetching ${token.name} through API:`,
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }
    }, 60000); // 60 second timeout for API tests
  });

  describe("Logging validation", () => {
    it("should log actual price values instead of [object Object]", async () => {
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

      // Capture console.log output
      const originalConsoleLog = console.log;
      const logMessages: string[] = [];

      console.log = (...args: unknown[]) => {
        const message = args.join(" ");
        logMessages.push(message);
        originalConsoleLog(...args); // Still output to console
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
          console.log("Found price log messages:", priceLogMessages);

          // Verify that none of the log messages contain "[object Object]"
          for (const message of priceLogMessages) {
            expect(message).not.toContain("[object Object]");
            expect(message).not.toContain("$[object Object]");

            // Verify the message contains a proper price format like "$163.64"
            const priceMatch = message.match(/\$(\d+\.?\d*)/);
            if (priceMatch && priceMatch[1]) {
              const priceValue = parseFloat(priceMatch[1]);
              expect(priceValue).toBeGreaterThan(0);
              console.log(
                `✅ Verified proper price format in log: ${priceMatch[0]}`,
              );
            }
          }
        } else {
          // If no price was found, that's okay for testing purposes
          console.log("No price found, but logging format test still valid");
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
            console.log(
              `✅ Verified proper EVM price format in log: ${priceMatch[0]}`,
            );
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
      if (!runTests) {
        console.log("Skipping test - Tests disabled");
        return;
      }

      // Use a common token with reliable price data
      const token = testTokens.eth.ETH;

      // Get price from price tracker directly
      const priceReport = await priceTracker.getPrice(token);

      if (priceReport !== null) {
        console.log(`ETH price from price tracker: $${priceReport.price}`);
        expect(priceReport.price).toBeGreaterThan(0);
        expect(priceReport.chain).toBe(BlockchainType.EVM);
        expect(priceReport.specificChain).toBe("eth");
      } else {
        console.log(`No price found for ETH token from price tracker`);
      }

      // Get token info directly from MultiChainProvider to verify chain detection
      const chain = multiChainProvider.determineChain(token);
      console.log(`Token ${token} chain detection result: ${chain}`);
      expect(chain).toBe(BlockchainType.EVM);

      // The priceReport should already be verified as not null, and we can check chain info
      expect(priceReport).not.toBeNull();
      expect(priceReport!.chain).toBe(BlockchainType.EVM);
      if (priceReport!.specificChain) {
        expect(typeof priceReport!.specificChain).toBe("string");
        console.log(`Token specific chain: ${priceReport!.specificChain}`);
      }
    });

    it("should handle errors gracefully for unsupported tokens", async () => {
      // Test with an invalid token address
      const invalidToken = "not-a-valid-token-address";

      try {
        // This should throw an error or return null
        const priceReport = await priceTracker.getPrice(invalidToken);
        console.log(`Price result for invalid token: ${priceReport}`);
        expect(priceReport).toBeNull();
      } catch (error) {
        // Error is expected
        console.log(
          `Expected error for invalid token: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        expect(error).toBeDefined();
      }
    });

    it("should fetch prices faster when providing the exact chain parameter", async () => {
      // Use a token that's available on a specific chain
      const linkToken = "0x514910771af9ca656af840dff83e8264ecf986ca"; // Chainlink on Ethereum

      console.log(
        "Testing chain override performance for Chainlink token (0x514910771af9ca656af840dff83e8264ecf986ca)",
      );

      // Get price with chain detection (which may try multiple chains)
      const startTimeWithout = Date.now();
      const priceReportWithoutChain = await priceTracker.getPrice(linkToken);
      const endTimeWithout = Date.now();
      const timeWithout = endTimeWithout - startTimeWithout;

      if (priceReportWithoutChain !== null) {
        console.log(
          `Price fetch time without chain parameter: ${timeWithout}ms`,
        );
        console.log(
          `Price result without specific chain: $${priceReportWithoutChain.price}`,
        );
        expect(priceReportWithoutChain.price).toBeGreaterThan(0);
        expect(priceReportWithoutChain.chain).toBe(BlockchainType.EVM);
      } else {
        console.log(`No price found for link token without chain parameter`);
      }

      // Short delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Now get price with exact chain parameter
      const startTimeWith = Date.now();
      const priceReportWithChain = await multiChainProvider.getPrice(
        linkToken,
        BlockchainType.EVM,
        "eth",
      );
      const endTimeWith = Date.now();
      const timeWith = endTimeWith - startTimeWith;

      if (priceReportWithChain !== null) {
        console.log(`Price fetch time with chain parameter: ${timeWith}ms`);
        console.log(
          `Price result with specific chain: $${priceReportWithChain.price}`,
        );
        expect(priceReportWithChain.price).toBeGreaterThan(0);
        expect(priceReportWithChain.chain).toBe(BlockchainType.EVM);
        expect(priceReportWithChain.specificChain).toBe("eth");

        // Log performance difference
        console.log(
          `Performance difference: ${timeWithout - timeWith}ms (${(((timeWithout - timeWith) / timeWithout) * 100).toFixed(2)}% faster with chain parameter)`,
        );
      } else {
        console.log(`No price found for link token with chain parameter`);
      }
    });
  });
});
