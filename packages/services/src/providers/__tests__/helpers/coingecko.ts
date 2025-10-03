import { Coingecko } from "@coingecko/coingecko-typescript";
import { vi } from "vitest";

import { MultiChainProviderConfig } from "../../multi-chain.provider.js";
import { CoinGeckoProviderConfig } from "../../price/coingecko.provider.js";
import { specificChainTokens } from "./tokens.js";

/**
 * Type for mocking CoinGecko client
 */
export interface MockCoinGeckoClient {
  coins: {
    contract: {
      get: ReturnType<typeof vi.fn>;
    };
  };
  simple: {
    tokenPrice: {
      getID: ReturnType<typeof vi.fn>;
    };
  };
}

/**
 * Mock response builder for CoinGecko coin contract data
 */
export const createMockCoinResponse = (params: {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  volumeUsd?: number;
  fdvUsd?: number;
}) => ({
  id: params.id,
  symbol: params.symbol.toUpperCase(),
  name: params.name,
  market_data: {
    current_price: { usd: params.priceUsd },
    total_volume: params.volumeUsd ? { usd: params.volumeUsd } : undefined,
    fully_diluted_valuation: params.fdvUsd ? { usd: params.fdvUsd } : undefined,
  },
});

/**
 * Common mock responses for frequently used tokens
 */
export const commonMockResponses = {
  sol: createMockCoinResponse({
    id: "solana",
    symbol: "sol",
    name: "Solana",
    priceUsd: 150.75,
    volumeUsd: 2500000000,
    fdvUsd: 85000000000,
  }),
  eth: createMockCoinResponse({
    id: "weth",
    symbol: "weth",
    name: "Wrapped Ether",
    priceUsd: 2850.45,
    volumeUsd: 12000000000,
    fdvUsd: 350000000000,
  }),
  usdc: createMockCoinResponse({
    id: "usd-coin",
    symbol: "usdc",
    name: "USD Coin",
    priceUsd: 0.9998,
    volumeUsd: 8000000000,
    fdvUsd: 45000000000,
  }),
  usdt: createMockCoinResponse({
    id: "tether",
    symbol: "usdt",
    name: "Tether",
    priceUsd: 1.0002,
    volumeUsd: 65000000000,
    fdvUsd: 100000000000,
  }),
};

/**
 * Creates a mock CoinGecko client instance
 */
export const createMockCoinGeckoClient = (): MockCoinGeckoClient => ({
  coins: {
    contract: {
      get: vi.fn(),
    },
  },
  simple: {
    tokenPrice: {
      getID: vi.fn(),
    },
  },
});

/**
 * Sets up CoinGecko SDK mock for testing
 * @returns Mock CoinGecko client instance
 */
export const setupCoinGeckoMock = (): MockCoinGeckoClient => {
  const mockInstance = createMockCoinGeckoClient();
  vi.mocked(Coingecko).mockImplementation(
    () => mockInstance as unknown as Coingecko,
  );

  return mockInstance;
};

/**
 * Typical config for a CoinGecko provider
 */
export const coingeckoConfig: CoinGeckoProviderConfig = {
  apiKey: "test-api-key",
  mode: "demo",
  specificChainTokens,
};

/**
 * Typical config for a MultiChainProvider with a CoinGecko provider
 */
export const multichainCoinGeckoConfig: MultiChainProviderConfig = {
  priceProvider: {
    type: "coingecko",
    coingecko: { apiKey: coingeckoConfig.apiKey, mode: coingeckoConfig.mode },
  },
  evmChains: ["eth", "base", "svm"],
  specificChainTokens,
};

/**
 * Helper to mock a successful price fetch for a single token
 */
export const mockTokenPrice = (
  mockClient: MockCoinGeckoClient,
  response: ReturnType<typeof createMockCoinResponse>,
) => {
  mockClient.coins.contract.get.mockResolvedValueOnce(response);
};

/**
 * Helper to mock multiple token prices in sequence
 */
export const mockBatchTokenPrices = (
  mockClient: MockCoinGeckoClient,
  responses: Array<ReturnType<typeof createMockCoinResponse>>,
) => {
  responses.forEach((response) => {
    mockClient.coins.contract.get.mockResolvedValueOnce(response);
  });
};

/**
 * Helper to mock an API error
 */
export const mockTokenPriceError = (
  mockClient: MockCoinGeckoClient,
  errorMessage = "API error",
) => {
  mockClient.coins.contract.get.mockRejectedValueOnce(new Error(errorMessage));
};
