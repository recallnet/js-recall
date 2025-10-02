import { Coingecko } from "@coingecko/coingecko-typescript";
import { vi } from "vitest";

/**
 * Common test tokens used across multiple tests
 */
export const testTokens = {
  solana: {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  },
  ethereum: {
    ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    SHIB: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
  },
  base: {
    ETH: "0x4200000000000000000000000000000000000006", // WETH on Base
    USDC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
  },
  polygon: {
    MATIC: "0x0000000000000000000000000000000000001010",
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  },
};

/**
 * Specific chain tokens configuration for provider initialization
 */
export const specificChainTokens = {
  svm: {
    sol: testTokens.solana.SOL,
    usdc: testTokens.solana.USDC,
  },
  eth: {
    eth: testTokens.ethereum.ETH,
    usdc: testTokens.ethereum.USDC,
  },
  base: {
    eth: testTokens.base.ETH,
    usdc: testTokens.base.USDC,
  },
  polygon: {
    matic: testTokens.polygon.MATIC,
    usdc: testTokens.polygon.USDC,
  },
};

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
  symbol: params.symbol,
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
  SOL: createMockCoinResponse({
    id: "solana",
    symbol: "sol",
    name: "Solana",
    priceUsd: 150.75,
    volumeUsd: 2500000000,
    fdvUsd: 85000000000,
  }),
  ETH: createMockCoinResponse({
    id: "weth",
    symbol: "weth",
    name: "Wrapped Ether",
    priceUsd: 2850.45,
    volumeUsd: 12000000000,
    fdvUsd: 350000000000,
  }),
  USDC: createMockCoinResponse({
    id: "usd-coin",
    symbol: "usdc",
    name: "USD Coin",
    priceUsd: 0.9998,
    volumeUsd: 8000000000,
    fdvUsd: 45000000000,
  }),
  USDT: createMockCoinResponse({
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

  // Mock the CoinGecko constructor to return our mock instance
  vi.mocked(Coingecko).mockImplementation(
    () => mockInstance as unknown as Coingecko,
  );

  return mockInstance;
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
