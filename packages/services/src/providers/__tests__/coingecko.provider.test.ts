import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/index.js";
import { withRetry } from "../../lib/retry-helper.js";
import { BlockchainType } from "../../types/index.js";
import { CoinGeckoProvider } from "../price/coingecko.provider.js";
import {
  MockCoinGeckoClient,
  coingeckoConfig,
  commonMockResponses,
  createMockResponseForAddress,
  mockBatchTokenPrices,
  mockTokenPrice,
  mockTokenPriceError,
  setupCoinGeckoMock,
} from "./mocks/coingecko.js";

vi.mock("@coingecko/coingecko-typescript");
vi.mock("../../lib/retry-helper.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/retry-helper.js")>();
  return {
    ...actual,
    withRetry: vi.fn(actual.withRetry),
  };
});

const {
  svm: solanaTokens,
  eth: ethereumTokens,
  base: baseTokens,
} = specificChainTokens;
const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("CoinGeckoProvider", () => {
  let provider: CoinGeckoProvider;
  let mockCoinGeckoInstance: MockCoinGeckoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCoinGeckoInstance = setupCoinGeckoMock();
    provider = new CoinGeckoProvider(coingeckoConfig, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic functionality", () => {
    it("should have correct name", () => {
      expect(provider.getName()).toBe("CoinGecko");
    });
  });

  describe("Solana token price fetching", () => {
    it("should fetch SOL price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.sol);

      const priceReport = await provider.getPrice(
        solanaTokens.sol,
        BlockchainType.SVM,
        "svm",
      );

      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledWith(solanaTokens.sol, {
        network: "solana",
        include_composition: true,
        include: "top_pools",
      });
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(231.86);
      expect(priceReport?.symbol).toBe("SOL");
      expect(priceReport?.volume?.h24).toBe(10888054716);
      expect(priceReport?.fdv).toBe(141671307261);
      expect(priceReport?.liquidity?.usd).toBe(13326272597);
      expect(priceReport?.pairCreatedAt).toBe(
        new Date("2023-07-05T14:34:02Z").getTime(),
      );
    });

    it("should fetch USDC price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdc);

      const priceReport = await provider.getPrice(
        solanaTokens.usdc,
        BlockchainType.SVM,
        "svm",
      );

      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledWith(solanaTokens.usdc, {
        network: "solana",
        include_composition: true,
        include: "top_pools",
      });
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(1.0002548824);
      expect(priceReport?.symbol).toBe("USDC"); // Should be uppercase
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });
  });

  describe("Ethereum token price fetching", () => {
    it("should fetch ETH price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledWith(ethereumTokens.eth.toLowerCase(), {
        network: "eth",
        include_composition: true,
        include: "top_pools",
      });
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(4473.03);
      expect(priceReport?.symbol).toBe("WETH");
    });

    it("should fetch USDC price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdc);

      const priceReport = await provider.getPrice(
        ethereumTokens.usdc,
        BlockchainType.EVM,
        "eth",
      );

      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledWith(ethereumTokens.usdc.toLowerCase(), {
        network: "eth",
        include_composition: true,
        include: "top_pools",
      });
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(1.0002548824);
      expect(priceReport?.symbol).toBe("USDC");
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });

    it("should fetch ETH price above $1000 on Ethereum mainnet", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(4473.03);
      expect(priceReport?.price).toBeGreaterThan(1000); // ETH should be above $1000
    });

    it("should fetch USDT price close to $1 on Ethereum mainnet", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdt);

      const priceReport = await provider.getPrice(
        ethereumTokens.usdt,
        BlockchainType.EVM,
        "eth",
      );

      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledWith(ethereumTokens.usdt.toLowerCase(), {
        network: "eth",
        include_composition: true,
        include: "top_pools",
      });
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0.9977046221);
      expect(priceReport?.symbol).toBe("USDT");
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDT should be close to $1
    });
  });

  describe("Base token price fetching", () => {
    it("should fetch ETH on Base", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        baseTokens.eth,
        BlockchainType.EVM,
        "base",
      );

      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledWith(baseTokens.eth, {
        network: "base",
        include_composition: true,
        include: "top_pools",
      });
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(4473.03);
      expect(priceReport?.symbol).toBe("WETH");
    });

    it("should fetch USDC on Base", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdc);

      const priceReport = await provider.getPrice(
        baseTokens.usdc,
        BlockchainType.EVM,
        "base",
      );

      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledWith(baseTokens.usdc.toLowerCase(), {
        network: "base",
        include_composition: true,
        include: "top_pools",
      });
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(1.0002548824);
      expect(priceReport?.symbol).toBe("USDC");
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });
  });

  describe("Chain detection", () => {
    it("should detect Solana addresses correctly", () => {
      const chain = provider.determineChain(solanaTokens.sol);
      expect(chain).toBe(BlockchainType.SVM);
    });

    it("should detect Ethereum addresses correctly", () => {
      const chain = provider.determineChain(ethereumTokens.eth);
      expect(chain).toBe(BlockchainType.EVM);
    });
  });

  describe("Batch price fetching", () => {
    it("should fetch batch prices for Ethereum tokens", async () => {
      const tokens = [
        ethereumTokens.eth,
        ethereumTokens.usdc,
        ethereumTokens.usdt,
      ];

      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.eth,
        commonMockResponses.usdc,
        commonMockResponses.usdt,
      ]);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      // Should call the batch API
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses,
      ).toHaveBeenCalledWith(tokens.map((t) => t.toLowerCase()).join(","), {
        network: "eth",
        include_composition: true,
        include: "top_pools",
      });

      expect(results.size).toBe(tokens.length);

      // Check ETH
      const ethInfo = results.get(ethereumTokens.eth);
      expect(ethInfo).not.toBeNull();
      expect(ethInfo?.price).toBe(4473.03);
      expect(ethInfo?.volume?.h24).toBe(1008244928);

      // Check USDC
      const usdcInfo = results.get(ethereumTokens.usdc);
      expect(usdcInfo).not.toBeNull();
      expect(usdcInfo?.price).toBe(1.0002548824);
      expect(usdcInfo?.volume?.h24).toBe(1493569547);

      // Check USDT
      const usdtInfo = results.get(ethereumTokens.usdt);
      expect(usdtInfo).not.toBeNull();
      expect(usdtInfo?.price).toBe(0.9977046221);
      expect(usdtInfo?.volume?.h24).toBe(1717852681);
    });

    it("should fetch batch prices for Base tokens", async () => {
      const tokens = [baseTokens.eth, baseTokens.usdc];

      // Create responses with lowercase addresses (as returned by CoinGecko)
      mockBatchTokenPrices(mockCoinGeckoInstance, [
        createMockResponseForAddress(baseTokens.eth.toLowerCase(), {
          symbol: "WETH",
          priceUsd: 4473.03,
        }),
        createMockResponseForAddress(baseTokens.usdc.toLowerCase(), {
          symbol: "USDC",
          priceUsd: 1.0002548824,
        }),
      ]);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "base",
      );

      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses,
      ).toHaveBeenCalledTimes(1);

      expect(results.size).toBe(tokens.length);

      for (const token of tokens) {
        const priceInfo = results.get(token);
        expect(priceInfo).not.toBeNull();
        if (priceInfo) {
          expect(typeof priceInfo.price).toBe("number");
          expect(priceInfo.price).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Burn address handling", () => {
    it("should return price of 0 for EVM burn addresses", async () => {
      const burnAddress1 = "0x000000000000000000000000000000000000dead";
      const burnAddress2 = "0x000000000000000000000000000000000000DEAD";

      // The provider should not even make an API call for burn addresses
      const priceReport = await provider.getPrice(
        burnAddress1,
        BlockchainType.EVM,
        "eth",
      );
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).not.toHaveBeenCalled();
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0);
      expect(priceReport?.symbol).toBe("BURN");
      const priceReport2 = await provider.getPrice(
        burnAddress2,
        BlockchainType.EVM,
        "eth",
      );
      expect(priceReport2).not.toBeNull();
      expect(priceReport2?.price).toBe(0);
      expect(priceReport2?.symbol).toBe("BURN");
    });

    it("should return price of 0 for Solana burn addresses", async () => {
      const solanaBurnAddress = "1nc1nerator11111111111111111111111111111111";
      const priceReport = await provider.getPrice(
        solanaBurnAddress,
        BlockchainType.SVM,
        "svm",
      );
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).not.toHaveBeenCalled();
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0);
      expect(priceReport?.symbol).toBe("BURN");
    });

    it("should handle burn addresses in batch requests", async () => {
      const tokens = [
        "0x000000000000000000000000000000000000dead",
        ethereumTokens.usdc,
      ];

      // Only non-burn addresses should trigger batch API calls
      mockBatchTokenPrices(mockCoinGeckoInstance, [commonMockResponses.usdc]);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      // Burn addresses are handled separately, only USDC goes to batch API
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses,
      ).toHaveBeenCalledTimes(1);
      expect(results.size).toBe(2);
      expect(results.get(tokens[0]!)?.price).toBe(0);
      expect(results.get(tokens[0]!)?.symbol).toBe("BURN");
      expect(results.get(ethereumTokens.usdc)?.price).toBe(1.0002548824);
    });

    it("should fallback to individual requests when batch fails", async () => {
      const tokens = [ethereumTokens.eth, ethereumTokens.usdc];

      // Mock batch API to always fail with a network-retryable error
      mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses.mockImplementation(
        async () => {
          const error: Error & { response?: { status: number } } = new Error(
            "Batch API timeout",
          );
          error.response = { status: 429 };
          throw error;
        },
      );

      // Mock individual API calls for fallback
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdc);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      // Batch API should have been called (multiple times due to retry)
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses,
      ).toHaveBeenCalled();

      // Individual API should have been called as fallback
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledTimes(2);

      // Results should still be returned via fallback
      expect(results.size).toBe(2);
      expect(results.get(ethereumTokens.eth)?.price).toBe(4473.03);
      expect(results.get(ethereumTokens.usdc)?.price).toBe(1.0002548824);

      // Verify warning was logged for fallback
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenCount: 2,
          network: "eth",
        }),
        expect.stringContaining("falling back to individual requests"),
      );
    }, 10000);

    it("should handle partial failures in fallback mode", async () => {
      const tokens = [ethereumTokens.eth, ethereumTokens.usdc];

      // Mock batch API to always fail with a network-retryable error
      mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses.mockImplementation(
        async () => {
          const error: Error & { response?: { status: number } } = new Error(
            "Batch API timeout",
          );
          error.response = { status: 429 };
          throw error;
        },
      );

      // Mock individual calls: ETH succeeds, USDC fails with network error (triggering retries)
      mockCoinGeckoInstance.onchain.networks.tokens.getAddress.mockImplementation(
        async (address: string) => {
          if (address === ethereumTokens.eth.toLowerCase()) {
            return commonMockResponses.eth;
          }
          const error: Error & { response?: { status: number } } = new Error(
            "Individual API error",
          );
          error.response = { status: 429 };
          throw error;
        },
      );

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      // Results should have one success and one null
      expect(results.size).toBe(2);
      expect(results.get(ethereumTokens.eth)?.price).toBe(4473.03);
      expect(results.get(ethereumTokens.usdc)).toBeNull();
    }, 15000);
  });

  describe("Stablecoin detection", () => {
    it("should identify USDC as a stablecoin", () => {
      expect(provider.isStablecoin(ethereumTokens.usdc, "eth")).toBe(true);
    });

    it("should identify USDT as a stablecoin", () => {
      expect(provider.isStablecoin(ethereumTokens.usdt, "eth")).toBe(true);
    });

    it("should not identify non-stablecoins", () => {
      expect(provider.isStablecoin(ethereumTokens.eth, "eth")).toBe(false);
    });

    it("should handle case-insensitive stablecoin checks on EVM", () => {
      const lowercaseUsdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
      const uppercaseUsdc = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
      const mixedCaseUsdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      expect(provider.isStablecoin(lowercaseUsdc, "eth")).toBe(true);
      expect(provider.isStablecoin(uppercaseUsdc, "eth")).toBe(true);
      expect(provider.isStablecoin(mixedCaseUsdc, "eth")).toBe(true);
    });

    it("should return false for unsupported chains", () => {
      expect(
        // We want to test the error handling for unsupported chains
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provider.isStablecoin(ethereumTokens.usdc, "unsupported" as any),
      ).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should return null for invalid token addresses", async () => {
      const invalidToken = "0xinvalid";

      mockTokenPriceError(mockCoinGeckoInstance, "Invalid contract address");

      const priceReport = await provider.getPrice(
        invalidToken,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).toBeNull();
    });

    it("should return empty map for empty batch request", async () => {
      const results = await provider.getBatchPrices(
        [],
        BlockchainType.EVM,
        "eth",
      );

      expect(results.size).toBe(0);
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).not.toHaveBeenCalled();
    });

    it("should handle unsupported chains gracefully", async () => {
      const tokens = [ethereumTokens.eth];
      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        // We want to test the error handling for unsupported chains
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "unsupported" as any,
      );
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).not.toHaveBeenCalled();
      expect(results.size).toBe(1);
      expect(results.get(ethereumTokens.eth)).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      mockTokenPriceError(mockCoinGeckoInstance, "API error after retries");

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledTimes(1);
      expect(priceReport).toBeNull();
    });

    it("should handle successful response after SDK retries", async () => {
      // Since the SDK handles retries internally, we just mock a successful response using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      // Should have been called once (SDK handles retries internally)
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).toHaveBeenCalledTimes(1);
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(4473.03);
    });

    it("should handle invalid addresses gracefully in single requests", async () => {
      const invalidAddress = "invalid-address-format";

      const priceReport = await provider.getPrice(
        invalidAddress,
        BlockchainType.SVM,
        "svm",
      );

      // Should not make API call for invalid address
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).not.toHaveBeenCalled();
      expect(priceReport).toBeNull();
    });

    it("should handle invalid addresses in batch requests without failing entire batch", async () => {
      const tokens = [
        solanaTokens.usdc,
        // The remaining addresses are invalid
        "abc",
        "",
        "0xinvalid",
      ];

      // Mock the batch call with just the valid token
      mockBatchTokenPrices(mockCoinGeckoInstance, [
        createMockResponseForAddress(solanaTokens.usdc, {
          symbol: "USDC",
          priceUsd: 1.0002548824,
        }),
      ]);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.SVM,
        "svm",
      );

      // Verify all tokens have results (some valid, some null)
      expect(results.get(solanaTokens.usdc)?.price).toBe(1.0002548824);
      // Should call batch API once for valid token
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses,
      ).toHaveBeenCalledTimes(1);
      expect(results.size).toBe(4);
      expect(results.get(tokens[1]!)).toBeNull();
      expect(results.get(tokens[2]!)).toBeNull();
      expect(results.get(tokens[3]!)).toBeNull();
    });
  });

  describe("Retry logic", () => {
    it("should use withRetry for API calls", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      await provider.getPrice(ethereumTokens.eth, BlockchainType.EVM, "eth");

      expect(withRetry).toHaveBeenCalled();
    });

    it("should invoke onRetry callback when retries occur", async () => {
      // Mock to fail twice, then succeed
      let callCount = 0;
      mockCoinGeckoInstance.onchain.networks.tokens.getAddress.mockImplementation(
        async () => {
          callCount++;
          if (callCount <= 2) {
            const error: Error & { response?: { status: number } } = new Error(
              "Rate limit exceeded",
            );
            error.response = { status: 429 };
            throw error;
          }
          return commonMockResponses.eth;
        },
      );

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      // Should eventually succeed after retries
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(4473.03);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: expect.any(Number),
          nextDelayMs: expect.any(Number),
          error: expect.stringContaining("Rate limit"),
        }),
        "Retrying CoinGecko API call",
      );
    });

    it("should handle exhausted retries gracefully", async () => {
      // Mock to always fail with 429
      mockCoinGeckoInstance.onchain.networks.tokens.getAddress.mockImplementation(
        async () => {
          const error: Error & { response?: { status: number } } = new Error(
            "Rate limit exceeded",
          );
          error.response = { status: 429 };
          throw error;
        },
      );

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          tokenAddress: ethereumTokens.eth.toLowerCase(),
          network: "eth",
        }),
        "Error fetching price",
      );
    }, 10000);
  });

  describe("Batch chunking", () => {
    it("should process batches in chunks of 30 tokens (demo mode)", async () => {
      // Create a batch of 120 tokens (should create 4 chunks: 30+30+30+30 in demo mode)
      const tokens = Array.from(
        { length: 120 },
        (_, i) => `0x${i.toString().padStart(40, "0")}`,
      );

      // Normalize addresses for proper matching
      const normalizedTokens = tokens.map((t) => t.toLowerCase());

      // Create responses with matching normalized addresses (4 batches of 30)
      const batch1 = normalizedTokens
        .slice(0, 30)
        .map((addr) => createMockResponseForAddress(addr, { priceUsd: 100 }));
      const batch2 = normalizedTokens
        .slice(30, 60)
        .map((addr) => createMockResponseForAddress(addr, { priceUsd: 100 }));
      const batch3 = normalizedTokens
        .slice(60, 90)
        .map((addr) => createMockResponseForAddress(addr, { priceUsd: 100 }));
      const batch4 = normalizedTokens
        .slice(90, 120)
        .map((addr) => createMockResponseForAddress(addr, { priceUsd: 100 }));

      mockBatchTokenPrices(mockCoinGeckoInstance, batch1);
      mockBatchTokenPrices(mockCoinGeckoInstance, batch2);
      mockBatchTokenPrices(mockCoinGeckoInstance, batch3);
      mockBatchTokenPrices(mockCoinGeckoInstance, batch4);

      // Also mock individual retries for any tokens that might not be found in batch
      for (let i = 0; i < 120; i++) {
        mockTokenPrice(
          mockCoinGeckoInstance,
          createMockResponseForAddress(normalizedTokens[i]!, { priceUsd: 100 }),
        );
      }

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      // Should call batch API 4 times (demo mode batch size is 30)
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses,
      ).toHaveBeenCalledTimes(4);
      expect(results.size).toBe(120);
      for (let i = 0; i < 120; i++) {
        expect(results.get(tokens[i]!)).not.toBeNull();
      }
    });

    it("should handle errors in chunked batches without failing entire batch", async () => {
      // Create 60 tokens (2 chunks: 50, 10)
      const tokens = Array.from(
        { length: 60 },
        (_, i) => `0x${i.toString().padStart(40, "0")}`,
      );

      // Normalize addresses for proper matching
      const normalizedTokens = tokens.map((t) => t.toLowerCase());

      // Create responses with matching normalized addresses (demo mode: 30 tokens per batch)
      const firstBatchResponses = normalizedTokens
        .slice(0, 30)
        .map((addr) => createMockResponseForAddress(addr, { priceUsd: 100 }));
      const secondBatchResponses = normalizedTokens
        .slice(30, 60)
        .map((addr) => createMockResponseForAddress(addr, { priceUsd: 100 }));

      mockBatchTokenPrices(mockCoinGeckoInstance, firstBatchResponses);
      mockBatchTokenPrices(mockCoinGeckoInstance, secondBatchResponses);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(results.size).toBe(60);
      // All tokens should have prices
      for (let i = 0; i < 60; i++) {
        expect(results.get(tokens[i]!)).not.toBeNull();
      }
      // Should call batch API twice (30 + 30 in demo mode), no individual retries
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.multi.getAddresses,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockCoinGeckoInstance.onchain.networks.tokens.getAddress,
      ).not.toHaveBeenCalled();
    });
  });
});
