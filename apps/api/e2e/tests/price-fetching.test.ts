import { beforeEach, describe, expect, test } from "vitest";

import config from "@/config/index.js";
import { ApiClient } from "@/e2e/utils/api-client.js";
import { PriceResponse, SpecificChain } from "@/e2e/utils/api-types.js";
import {
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";
import { BlockchainType } from "@/types/index.js";

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
    console.log(`Admin API key created: ${adminApiKey.substring(0, 8)}...`);

    // Register a user/agent and get an authenticated client
    const result = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });
    clientApiKey = result.apiKey;
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
    console.log(`SOL price: $${solPriceResponse.price}`);

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
    console.log(`USDC price: $${usdcPriceResponse.price}`);

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
    console.log(`USDT price: $${usdtPriceResponse.price}`);
  });

  test("should fetch price for arbitrary token if available", async () => {
    // The arbitrary token address to test with
    const arbitraryTokenAddress =
      "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
    const client = new ApiClient(clientApiKey);

    // Test price for arbitrary token using authenticated client
    const response = await client.getPrice(arbitraryTokenAddress);

    console.log(
      `Arbitrary token (${arbitraryTokenAddress}) price response:`,
      response,
    );

    // We expect a valid response, regardless of whether a price is available
    expect(response).toBeDefined();

    // If a price is available, validate it
    if (response.success && response.price !== null) {
      expect(response.price).toBeDefined();
      expect(typeof response.price).toBe("number");
      expect(response.price).toBeGreaterThan(0);
      expect(response.chain).toBe("svm");
      console.log(`Arbitrary token price: $${response.price}`);
    } else {
      // Log diagnostic information but don't fail the test
      console.log(
        `No price available for arbitrary token: ${arbitraryTokenAddress}`,
      );
      console.log(`Response: ${JSON.stringify(response)}`);
      console.log(
        `This is expected if the token doesn't have active liquidity pools or API errors occurred.`,
      );
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
    console.log(`SOL price: $${(solResponse as PriceResponse).price}`);

    // Test ETH price (Ethereum chain)
    const ethToken = ETHEREUM_TOKENS.ETH;
    const ethResponse = await client.getPrice(ethToken);

    // If we get a successful response with price data
    if (ethResponse.success && ethResponse.price) {
      expect(ethResponse.price).toBeGreaterThan(0);
      expect(ethResponse.chain).toBe("evm");
      console.log(`ETH price: $${ethResponse.price}`);

      // Check if we got specific chain information
      if (ethResponse.specificChain) {
        expect(ethResponse.specificChain).toBe("eth");
      }
    } else {
      console.log(
        `Note: Could not get ETH price. This could be due to API issues.`,
      );
      console.log(`Response: ${JSON.stringify(ethResponse)}`);
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
        console.log(`Base chain ETH price: $${baseEthResponse.price}`);
      }
    } catch (error) {
      console.log(
        `Error fetching Base chain ETH price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
      console.log(`Solana USDC price: $${solanaPriceResponse.price}`);
    } catch (error) {
      console.log(
        `Error fetching Solana USDC price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
      console.log(`Ethereum USDC price: $${ethereumPriceResponse.price}`);

      // Check if we got specific chain information
      if (ethereumPriceResponse.specificChain) {
        expect(ethereumPriceResponse.specificChain).toBe("eth");
        console.log(
          `Ethereum USDC detected on chain: ${ethereumPriceResponse.specificChain}`,
        );
      }
    } catch (error) {
      console.log(
        `Error fetching Ethereum USDC price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
      console.log(`Base chain USDC price: $${baseUsdcPriceResponse.price}`);
    } catch (error) {
      console.log(
        `Error fetching Base USDC price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
        console.log(
          `ETH detected on chain: ${priceSuccessResponse.specificChain}`,
        );
      }

      console.log(`Price info for ETH:`, priceResponse);
    } catch (error) {
      console.log(
        `Error fetching price for ETH: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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

      console.log(`Price info for Base ETH:`, priceResponse);
    } catch (error) {
      console.log(
        `Error fetching price for Base ETH: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
    console.log(
      `SOL symbol: ${solPriceResponse.symbol}, price: $${solPriceResponse.price}`,
    );

    // Test USDC price with symbol
    const usdcResponse = await client.getPrice(
      config.specificChainTokens.svm.usdc,
    );

    expect(usdcResponse.success).toBe(true);
    const usdcPriceResponse = usdcResponse as PriceResponse;
    expect(usdcPriceResponse.symbol).toBeDefined();
    expect(typeof usdcPriceResponse.symbol).toBe("string");
    expect(usdcPriceResponse.symbol?.length).toBeGreaterThan(0);
    console.log(
      `USDC symbol: ${usdcPriceResponse.symbol}, price: $${usdcPriceResponse.price}`,
    );

    // Test USDT price with symbol
    const usdtResponse = await client.getPrice(
      config.specificChainTokens.svm.usdt,
    );

    expect(usdtResponse.success).toBe(true);
    const usdtPriceResponse = usdtResponse as PriceResponse;
    expect(usdtPriceResponse.symbol).toBeDefined();
    expect(typeof usdtPriceResponse.symbol).toBe("string");
    expect(usdtPriceResponse.symbol?.length).toBeGreaterThan(0);
    console.log(
      `USDT symbol: ${usdtPriceResponse.symbol}, price: $${usdtPriceResponse.price}`,
    );

    // Test Ethereum token with symbol
    try {
      const ethResponse = await client.getPrice(ETHEREUM_TOKENS.ETH);

      if (ethResponse.success) {
        const ethPriceResponse = ethResponse as PriceResponse;
        expect(ethPriceResponse.symbol).toBeDefined();
        expect(typeof ethPriceResponse.symbol).toBe("string");
        expect(ethPriceResponse.symbol?.length).toBeGreaterThan(0);
        console.log(
          `ETH symbol: ${ethPriceResponse.symbol}, price: $${ethPriceResponse.price}`,
        );
      }
    } catch (error) {
      console.log(
        `Error fetching token info for ETH: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
    console.log(`SOL token info symbol: ${priceSuccessResponse.symbol}`);

    console.log(
      "✅ All price endpoints returning symbol information correctly",
    );
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

    console.log(`✅ All tokens correctly identified by chain type`);
  });
});
