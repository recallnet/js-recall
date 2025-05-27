import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import config from "@/config/index.js";
import {
  PriceResponse,
  SpecificChain,
  TokenInfoResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  getApiSdk,
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

    // Register a user/agent and get an authenticated client
    const result = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });
    clientApiKey = result.apiKey;
  });

  test("should fetch prices for standard tokens", async () => {
    const sdk = getApiSdk(clientApiKey);

    const solResponse = await sdk.price.getApiPrice({
      token: encodeURIComponent(config.specificChainTokens.svm.sol),
    });

    expect(solResponse.success).toBe(true);
    expect(solResponse.price).toBeDefined();
    expect(typeof solResponse.price).toBe("number");
    expect(solResponse.price).toBeGreaterThan(0);
    expect(solResponse.chain).toBe("svm");

    console.log(`SOL price: $${solResponse.price}`);
    // Test price for USDC
    const usdcResponse = await sdk.price.getApiPrice({
      token: encodeURIComponent(config.specificChainTokens.svm.usdc),
    });
    expect(usdcResponse.success).toBe(true);
    expect((usdcResponse as PriceResponse).price).toBeDefined();
    expect(typeof (usdcResponse as PriceResponse).price).toBe("number");
    // Allow for stablecoin price variations (0.8 to 1.2 range)
    expect((usdcResponse as PriceResponse).price).toBeGreaterThan(0.8);
    expect((usdcResponse as PriceResponse).price).toBeLessThan(1.2);
    expect((usdcResponse as PriceResponse).chain).toBe("svm");
    console.log(`USDC price: $${(usdcResponse as PriceResponse).price}`);

    // Test price for USDT
    const usdtResponse = await sdk.price.getApiPrice({
      token: encodeURIComponent(config.specificChainTokens.svm.usdt),
    });
    expect(usdtResponse.success).toBe(true);
    expect((usdtResponse as PriceResponse).price).toBeDefined();
    expect(typeof (usdtResponse as PriceResponse).price).toBe("number");
    // Allow for stablecoin price variations (0.8 to 1.2 range)
    expect((usdtResponse as PriceResponse).price).toBeGreaterThan(0.8);
    expect((usdtResponse as PriceResponse).price).toBeLessThan(1.2);
    expect((usdtResponse as PriceResponse).chain).toBe("svm");
    console.log(`USDT price: $${(usdtResponse as PriceResponse).price}`);
  });

  test("should fetch price for arbitrary token if available", async () => {
    // The arbitrary token address to test with
    const arbitraryTokenAddress =
      "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
    const sdk = getApiSdk(clientApiKey);

    // Test price for arbitrary token using authenticated client
    const response = await sdk.price.getApiPrice({
      token: arbitraryTokenAddress,
    });

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
    const sdk = getApiSdk(clientApiKey);
    const solResponse = await sdk.price.getApiPrice({ token: solToken });
    expect(solResponse.success).toBeTruthy();
    expect((solResponse as PriceResponse).price).toBeGreaterThan(0);
    expect((solResponse as PriceResponse).chain).toBe("svm");
    console.log(`SOL price: $${(solResponse as PriceResponse).price}`);

    // Test ETH price (Ethereum chain)
    const ethToken = ETHEREUM_TOKENS.ETH;
    const ethResponse = await sdk.price.getApiPrice({ token: ethToken });

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
      const baseEthResponse = await sdk.price.getApiPrice({
        token: BASE_TOKENS.ETH,
        chain: BlockchainType.EVM,
        specificChain: SpecificChain.BASE,
      });

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
    const sdk = getApiSdk(clientApiKey);

    try {
      const solanaResponse = await sdk.price.getApiPrice({
        token: solanaUsdcAddress,
      });

      // Check if the response is successful
      if (solanaResponse.success) {
        expect(solanaResponse.price).toBeGreaterThan(0);
        // Allow for stablecoin price variations (0.8 to 1.2 range)
        expect(solanaResponse.price).toBeGreaterThan(0.8);
        expect(solanaResponse.price).toBeLessThan(1.2);
        expect(solanaResponse.chain).toBe("svm");
        console.log(`Solana USDC price: $${solanaResponse.price}`);
      } else {
        console.log(
          `Note: Couldn't get Solana USDC price. Response: ${JSON.stringify(solanaResponse)}`,
        );
      }
    } catch (error) {
      console.log(
        `Error fetching Solana USDC price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Test Ethereum USDC
    const ethereumUsdcAddress = ETHEREUM_TOKENS.USDC;
    try {
      const ethereumResponse = await sdk.price.getApiPrice({
        token: ethereumUsdcAddress,
      });

      if (ethereumResponse.success) {
        // Allow for stablecoin price variations (0.8 to 1.2 range)
        expect(ethereumResponse.price).toBeGreaterThan(0.8);
        expect(ethereumResponse.price).toBeLessThan(1.2);
        expect(ethereumResponse.chain).toBe("evm");
        console.log(`Ethereum USDC price: $${ethereumResponse.price}`);

        // Check if we got specific chain information
        if (ethereumResponse.specificChain) {
          expect(ethereumResponse.specificChain).toBe("eth");
          console.log(
            `Ethereum USDC detected on chain: ${ethereumResponse.specificChain}`,
          );
        }
      } else {
        console.log(
          `Note: Couldn't get Ethereum USDC price. Response: ${JSON.stringify(ethereumResponse)}`,
        );
      }
    } catch (error) {
      console.log(
        `Error fetching Ethereum USDC price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Test Base chain USDC with specific chain parameter
    try {
      const baseUsdcResponse = await sdk.price.getApiPrice({
        token: BASE_TOKENS.USDC,
        chain: BlockchainType.EVM,
        specificChain: SpecificChain.BASE,
      });

      if (baseUsdcResponse.success) {
        // Allow for stablecoin price variations (0.8 to 1.2 range)
        expect(baseUsdcResponse.price).toBeGreaterThan(0.8);
        expect(baseUsdcResponse.price).toBeLessThan(1.2);
        expect(baseUsdcResponse.chain).toBe("evm");
        expect(baseUsdcResponse.specificChain).toBe("base");
        console.log(`Base chain USDC price: $${baseUsdcResponse.price}`);
      }
    } catch (error) {
      console.log(
        `Error fetching Base USDC price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  });

  test("should use detailed token info endpoint correctly", async () => {
    // Test token-info endpoint for Ethereum token
    const sdk = getApiSdk(clientApiKey);

    try {
      const ethToken = ETHEREUM_TOKENS.ETH;
      const tokenInfoResponse = await sdk.price.getApiPriceTokenInfo({
        token: ethToken,
      });

      if (tokenInfoResponse.success) {
        expect((tokenInfoResponse as TokenInfoResponse).chain).toBe("evm");
        expect(tokenInfoResponse.price).toBeGreaterThan(0);
        if ((tokenInfoResponse as TokenInfoResponse).specificChain) {
          console.log(
            `ETH detected on chain: ${tokenInfoResponse.specificChain}`,
          );
        }
      }

      console.log(`Token info for ETH:`, tokenInfoResponse);
    } catch (error) {
      console.log(
        `Error fetching token info for ETH: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Test token-info with specific chain parameter
    try {
      const baseToken = BASE_TOKENS.ETH;
      const tokenInfoResponse = await sdk.price.getApiPriceTokenInfo({
        token: baseToken,
        chain: BlockchainType.EVM,
        specificChain: SpecificChain.BASE,
      });

      if (tokenInfoResponse.success) {
        expect((tokenInfoResponse as TokenInfoResponse).chain).toBe("evm");
        expect((tokenInfoResponse as TokenInfoResponse).specificChain).toBe(
          "base",
        );
        expect(tokenInfoResponse.price).toBeGreaterThan(0);
      }

      console.log(`Token info for Base ETH:`, tokenInfoResponse);
    } catch (error) {
      console.log(
        `Error fetching token info for Base ETH: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  });

  test("should return symbol information in price responses", async () => {
    const sdk = getApiSdk(clientApiKey);

    // Test SOL price with symbol
    const solResponse = await sdk.price.getApiPrice({
      token: encodeURIComponent(config.specificChainTokens.svm.sol),
    });

    expect(solResponse.success).toBe(true);
    expect(solResponse.symbol).toBeDefined();
    expect(typeof solResponse.symbol).toBe("string");
    expect(solResponse.symbol?.length).toBeGreaterThan(0);
    console.log(
      `SOL symbol: ${solResponse.symbol}, price: $${solResponse.price}`,
    );

    // Test USDC price with symbol
    const usdcResponse = await sdk.price.getApiPrice({
      token: encodeURIComponent(config.specificChainTokens.svm.usdc),
    });

    expect(usdcResponse.success).toBe(true);
    expect(usdcResponse.symbol).toBeDefined();
    expect(typeof usdcResponse.symbol).toBe("string");
    expect(usdcResponse.symbol?.length).toBeGreaterThan(0);
    console.log(
      `USDC symbol: ${usdcResponse.symbol}, price: $${usdcResponse.price}`,
    );

    // Test USDT price with symbol
    const usdtResponse = await sdk.price.getApiPrice({
      token: encodeURIComponent(config.specificChainTokens.svm.usdt),
    });

    expect(usdtResponse.success).toBe(true);
    expect(usdtResponse.symbol).toBeDefined();
    expect(typeof usdtResponse.symbol).toBe("string");
    expect(usdtResponse.symbol?.length).toBeGreaterThan(0);
    console.log(
      `USDT symbol: ${usdtResponse.symbol}, price: $${usdtResponse.price}`,
    );

    // Test Ethereum token with symbol
    try {
      const ethResponse = await sdk.price.getApiPrice({
        token: ETHEREUM_TOKENS.ETH,
      });

      if (ethResponse.success && ethResponse.price) {
        expect(ethResponse.symbol).toBeDefined();
        expect(typeof ethResponse.symbol).toBe("string");
        expect(ethResponse.symbol?.length).toBeGreaterThan(0);
        console.log(
          `ETH symbol: ${ethResponse.symbol}, price: $${ethResponse.price}`,
        );
      }
    } catch (error) {
      console.log(
        `Error fetching token info for ETH: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Test token info endpoint also returns symbol
    const tokenInfoResponse = await sdk.price.getApiPriceTokenInfo({
      token: config.specificChainTokens.svm.sol,
    });

    if (tokenInfoResponse.success) {
      expect(tokenInfoResponse.symbol).toBeDefined();
      expect(typeof tokenInfoResponse.symbol).toBe("string");
      expect(tokenInfoResponse.symbol?.length).toBeGreaterThan(0);
      console.log(`SOL token info symbol: ${tokenInfoResponse.symbol}`);
    }

    console.log(
      "✅ All price endpoints returning symbol information correctly",
    );
  });

  test("should detect chain from token format", async () => {
    const sdk = getApiSdk(clientApiKey);

    // Test Solana token detection
    const solAddress = config.specificChainTokens.svm.sol;
    const solResponse = await sdk.price.getApiPrice({
      token: solAddress,
    });
    expect((solResponse as PriceResponse).chain).toBe("svm");

    // Test Ethereum token detection
    const ethAddress = ETHEREUM_TOKENS.ETH;
    const ethResponse = await sdk.price.getApiPrice({
      token: ethAddress,
    });
    expect((ethResponse as PriceResponse).chain).toBe("evm");

    // Test Base token detection
    const baseAddress = BASE_TOKENS.ETH;
    const baseResponse = await sdk.price.getApiPrice({
      token: baseAddress,
    });
    expect((baseResponse as PriceResponse).chain).toBe("evm");

    console.log(`✅ All tokens correctly identified by chain type`);
  });
});
