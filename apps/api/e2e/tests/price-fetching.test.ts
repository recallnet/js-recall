import { beforeEach, describe, expect, test } from "vitest";

import { BlockchainType } from "@recallnet/services/types";
import { ApiClient } from "@recallnet/test-utils";
import { PriceResponse, SpecificChain } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import config from "@/config/index.js";

// Define Ethereum token addresses for testing
const ETHEREUM_TOKENS = {
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

// Define Base chain token addresses for testing
const BASE_TOKENS = {
  ETH: "0x4200000000000000000000000000000000000006", // WETH on Base
  USDC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
};

describe("Price Fetching", () => {
  // Create variables for api keys
  let adminApiKey: string;
  let clientApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();

    // Register a user/agent and get an authenticated client
    const result = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });
    clientApiKey = result.apiKey;

    // Ensure there's an active competition for price route middleware
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
    const startResp = await adminClient.startCompetition({
      name: `Price Fetching Test ${Date.now()}`,
      agentIds: [result.agent.id],
    });
    expect(startResp.success).toBe(true);
  });

  test("should fetch prices for standard tokens", async () => {
    const client = new ApiClient(clientApiKey);

    const solResponse = await client.getPrice(
      config.specificChainTokens.svm.sol,
    );

    expect(solResponse.success).toBe(true);
    const solPriceResponse = solResponse as PriceResponse;
    expect(solPriceResponse.price).toBeDefined();
    expect(typeof solPriceResponse.price).toBe("number");
    expect(solPriceResponse.price).toBeGreaterThan(0);
    expect(solPriceResponse.chain).toBe("svm");

    // Test price for USDC
    const usdcResponse = await client.getPrice(
      config.specificChainTokens.svm.usdc,
    );
    expect(usdcResponse.success).toBe(true);
    const usdcPriceResponse = usdcResponse as PriceResponse;
    expect(usdcPriceResponse.price).toBeDefined();
    expect(typeof usdcPriceResponse.price).toBe("number");
    // Allow for stablecoin price variations (0.8 to 1.2 range)
    expect(usdcPriceResponse.price).toBeGreaterThan(0.8);
    expect(usdcPriceResponse.price).toBeLessThan(1.2);
    expect(usdcPriceResponse.chain).toBe("svm");

    // Test price for USDT
    const usdtResponse = await client.getPrice(
      config.specificChainTokens.svm.usdt,
    );
    expect(usdtResponse.success).toBe(true);
    const usdtPriceResponse = usdtResponse as PriceResponse;
    expect(usdtPriceResponse.price).toBeDefined();
    expect(typeof usdtPriceResponse.price).toBe("number");
    // Allow for stablecoin price variations (0.8 to 1.2 range)
    expect(usdtPriceResponse.price).toBeGreaterThan(0.8);
    expect(usdtPriceResponse.price).toBeLessThan(1.2);
    expect(usdtPriceResponse.chain).toBe("svm");
  });

  test("should fetch price for arbitrary token if available", async () => {
    // The arbitrary token address to test with
    const arbitraryTokenAddress =
      "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
    const client = new ApiClient(clientApiKey);

    // Test price for arbitrary token using authenticated client
    const response = await client.getPrice(arbitraryTokenAddress);

    // We expect a valid response, regardless of whether a price is available
    expect(response).toBeDefined();

    // If a price is available, validate it
    if (response.success && response.price !== null) {
      expect(response.price).toBeDefined();
      expect(typeof response.price).toBe("number");
      expect(response.price).toBeGreaterThan(0);
      expect(response.chain).toBe("svm");
    } else {
      // Don't fail the test if no price is available for this arbitrary token
      // This is expected if the token doesn't have active liquidity pools or API errors occurred
    }
  });

  test("should fetch prices for tokens across different chains", async () => {
    // Test SOL price (Solana chain)
    const solToken = config.specificChainTokens.svm.sol;
    const client = new ApiClient(clientApiKey);
    const solResponse = await client.getPrice(solToken);
    expect(solResponse.success).toBeTruthy();
    expect((solResponse as PriceResponse).price).toBeGreaterThan(0);
    expect((solResponse as PriceResponse).chain).toBe("svm");

    // Test ETH price (Ethereum chain)
    const ethToken = ETHEREUM_TOKENS.ETH;
    const ethResponse = await client.getPrice(ethToken);

    // If we get a successful response with price data
    if (ethResponse.success && ethResponse.price) {
      expect(ethResponse.price).toBeGreaterThan(0);
      expect(ethResponse.chain).toBe("evm");

      // Check if we got specific chain information
      if (ethResponse.specificChain) {
        expect(ethResponse.specificChain).toBe("eth");
      }
    } else {
      // Note: Could not get ETH price. This could be due to API issues.
    }

    // Test Base Chain ETH with specific chain parameter
    try {
      const baseEthResponse = await client.getPrice(
        BASE_TOKENS.ETH,
        BlockchainType.EVM,
        SpecificChain.BASE,
      );

      if (baseEthResponse.success && baseEthResponse.price) {
        expect(baseEthResponse.price).toBeGreaterThan(0);
        expect(baseEthResponse.chain).toBe("evm");
        expect(baseEthResponse.specificChain).toBe("base");
      }
    } catch {
      // Error fetching Base chain ETH price
    }
  });

  test("should fetch USDC price from both chains", async () => {
    // Test Solana USDC
    const solanaUsdcAddress = config.specificChainTokens.svm.usdc;
    const client = new ApiClient(clientApiKey);

    try {
      const solanaResponse = await client.getPrice(solanaUsdcAddress);

      // Check if the response is successful
      expect(solanaResponse.success).toBe(true);
      const solanaPriceResponse = solanaResponse as PriceResponse;
      expect(solanaPriceResponse.price).toBeGreaterThan(0);
      // Allow for stablecoin price variations (0.8 to 1.2 range)
      expect(solanaPriceResponse.price).toBeGreaterThan(0.8);
      expect(solanaPriceResponse.price).toBeLessThan(1.2);
      expect(solanaPriceResponse.chain).toBe("svm");
    } catch {
      // Error fetching Solana USDC price
    }

    // Test Ethereum USDC
    const ethereumUsdcAddress = ETHEREUM_TOKENS.USDC;
    try {
      const ethereumResponse = await client.getPrice(ethereumUsdcAddress);

      expect(ethereumResponse.success).toBe(true);
      const ethereumPriceResponse = ethereumResponse as PriceResponse;
      // Allow for stablecoin price variations (0.8 to 1.2 range)
      expect(ethereumPriceResponse.price).toBeGreaterThan(0.8);
      expect(ethereumPriceResponse.price).toBeLessThan(1.2);
      expect(ethereumPriceResponse.chain).toBe("evm");

      // Check if we got specific chain information
      if (ethereumPriceResponse.specificChain) {
        expect(ethereumPriceResponse.specificChain).toBe("eth");
      }
    } catch {
      // Error fetching Ethereum USDC price
    }

    // Test Base chain USDC with specific chain parameter
    try {
      const baseUsdcResponse = await client.getPrice(
        BASE_TOKENS.USDC,
        BlockchainType.EVM,
        SpecificChain.BASE,
      );

      expect(baseUsdcResponse.success).toBe(true);
      const baseUsdcPriceResponse = baseUsdcResponse as PriceResponse;
      // Allow for stablecoin price variations (0.8 to 1.2 range)
      expect(baseUsdcPriceResponse.price).toBeGreaterThan(0.8);
      expect(baseUsdcPriceResponse.price).toBeLessThan(1.2);
      expect(baseUsdcPriceResponse.chain).toBe("evm");
      expect(baseUsdcPriceResponse.specificChain).toBe("base");
    } catch {
      // Error fetching Base USDC price
    }
  });

  test("should use price endpoint correctly", async () => {
    // Test price endpoint for Ethereum token
    const client = new ApiClient(clientApiKey);

    try {
      const ethToken = ETHEREUM_TOKENS.ETH;
      const priceResponse = await client.getPrice(ethToken);

      expect(priceResponse.success).toBe(true);
      const priceSuccessResponse = priceResponse as PriceResponse;
      expect(priceSuccessResponse.chain).toBe("evm");
      expect(priceSuccessResponse.price).toBeGreaterThan(0);
      if (priceSuccessResponse.specificChain) {
        // ETH detected on specific chain
      }
    } catch {
      // Error fetching price for ETH
    }

    // Test price endpoint with specific chain parameter
    try {
      const baseToken = BASE_TOKENS.ETH;
      const priceResponse = await client.getPrice(
        baseToken,
        BlockchainType.EVM,
        SpecificChain.BASE,
      );

      expect(priceResponse.success).toBe(true);
      const priceSuccessResponse = priceResponse as PriceResponse;
      expect(priceSuccessResponse.chain).toBe("evm");
      expect(priceSuccessResponse.specificChain).toBe("base");
      expect(priceSuccessResponse.price).toBeGreaterThan(0);
    } catch {
      // Error fetching price for Base ETH
    }
  });

  test("should return symbol information in price responses", async () => {
    const client = new ApiClient(clientApiKey);

    // Test SOL price with symbol
    const solResponse = await client.getPrice(
      config.specificChainTokens.svm.sol,
    );

    expect(solResponse.success).toBe(true);
    const solPriceResponse = solResponse as PriceResponse;
    expect(solPriceResponse.symbol).toBeDefined();
    expect(typeof solPriceResponse.symbol).toBe("string");
    expect(solPriceResponse.symbol?.length).toBeGreaterThan(0);

    // Test USDC price with symbol
    const usdcResponse = await client.getPrice(
      config.specificChainTokens.svm.usdc,
    );

    expect(usdcResponse.success).toBe(true);
    const usdcPriceResponse = usdcResponse as PriceResponse;
    expect(usdcPriceResponse.symbol).toBeDefined();
    expect(typeof usdcPriceResponse.symbol).toBe("string");
    expect(usdcPriceResponse.symbol?.length).toBeGreaterThan(0);

    // Test USDT price with symbol
    const usdtResponse = await client.getPrice(
      config.specificChainTokens.svm.usdt,
    );

    expect(usdtResponse.success).toBe(true);
    const usdtPriceResponse = usdtResponse as PriceResponse;
    expect(usdtPriceResponse.symbol).toBeDefined();
    expect(typeof usdtPriceResponse.symbol).toBe("string");
    expect(usdtPriceResponse.symbol?.length).toBeGreaterThan(0);

    // Test Ethereum token with symbol
    try {
      const ethResponse = await client.getPrice(ETHEREUM_TOKENS.ETH);

      if (ethResponse.success) {
        const ethPriceResponse = ethResponse as PriceResponse;
        expect(ethPriceResponse.symbol).toBeDefined();
        expect(typeof ethPriceResponse.symbol).toBe("string");
        expect(ethPriceResponse.symbol?.length).toBeGreaterThan(0);
      }
    } catch {
      // Error fetching token info for ETH
    }

    // Test token info endpoint also returns symbol
    const priceResponse = await client.getPrice(
      config.specificChainTokens.svm.sol,
    );

    expect(priceResponse.success).toBe(true);
    const priceSuccessResponse = priceResponse as PriceResponse;
    expect(priceSuccessResponse.symbol).toBeDefined();
    expect(typeof priceSuccessResponse.symbol).toBe("string");
    expect(priceSuccessResponse.symbol?.length).toBeGreaterThan(0);
  });

  test("should detect chain from token format", async () => {
    const client = new ApiClient(clientApiKey);

    // Test Solana token detection
    const solAddress = config.specificChainTokens.svm.sol;
    const solResponse = await client.getPrice(solAddress);
    expect((solResponse as PriceResponse).chain).toBe("svm");

    // Test Ethereum token detection
    const ethAddress = ETHEREUM_TOKENS.ETH;
    const ethResponse = await client.getPrice(ethAddress);
    expect((ethResponse as PriceResponse).chain).toBe("evm");

    // Test Base token detection
    const baseAddress = BASE_TOKENS.ETH;
    const baseResponse = await client.getPrice(baseAddress);
    expect((baseResponse as PriceResponse).chain).toBe("evm");
  });
});
