import { Coingecko } from "@coingecko/coingecko-typescript";
import { TokenGetAddressResponse } from "@coingecko/coingecko-typescript/resources/onchain/networks/tokens/tokens.mjs";
import { vi } from "vitest";

import { specificChainTokens } from "../../../lib/index.js";
import { MultiChainProviderConfig } from "../../multi-chain.provider.js";
import { CoinGeckoProviderConfig } from "../../price/coingecko.provider.js";

/**
 * Type for mocking CoinGecko client
 */
export interface MockCoinGeckoClient {
  onchain: {
    networks: {
      tokens: {
        getAddress: ReturnType<typeof vi.fn>;
      };
    };
  };
}

/**
 * Mock response builder for CoinGecko onchain API response
 */
export const createMockOnchainResponse = (params: {
  address: string;
  symbol: string;
  priceUsd: number;
  volumeUsd: number;
  liquidityUsd: number;
  fdvUsd: number;
  poolCreatedAt?: string;
}): TokenGetAddressResponse => ({
  data: {
    id: `${params.address}`,
    type: "token",
    attributes: {
      address: params.address,
      name: params.symbol,
      symbol: params.symbol,
      decimals: 18,
      image_url: "",
      coingecko_coin_id: params.symbol.toLowerCase(),
      total_supply: "0",
      normalized_total_supply: "0",
      price_usd: params.priceUsd.toString(),
      fdv_usd: params.fdvUsd.toString(),
      total_reserve_in_usd: params.liquidityUsd.toString(),
      volume_usd: {
        h24: params.volumeUsd.toString(),
      },
      market_cap_usd: "0",
    },
    relationships: {
      top_pools: {
        data: [
          {
            id: "pool_1",
            type: "pool",
          },
        ],
      },
    },
  },
  included: [
    {
      id: "pool_1",
      type: "pool",
      attributes: {
        base_token_price_usd: "0",
        base_token_price_native_currency: "0",
        base_token_balance: "0",
        base_token_liquidity_usd: "0",
        quote_token_price_usd: "0",
        quote_token_price_native_currency: "0",
        quote_token_balance: "0",
        quote_token_liquidity_usd: "0",
        base_token_price_quote_token: "0",
        quote_token_price_base_token: "0",
        address: "0xpool1",
        name: "Mock Pool",
        pool_created_at: params.poolCreatedAt || "2024-01-01T00:00:00Z",
        token_price_usd: params.priceUsd.toString(),
        fdv_usd: params.fdvUsd.toString(),
        market_cap_usd: "0",
        price_change_percentage: {
          m5: "0",
          m15: "0",
          m30: "0",
          h1: "0",
          h6: "0",
          h24: "0",
        },
        transactions: {
          m5: { buys: 0, sells: 0, buyers: 0, sellers: 0 },
          m15: { buys: 0, sells: 0, buyers: 0, sellers: 0 },
          m30: { buys: 0, sells: 0, buyers: 0, sellers: 0 },
          h1: { buys: 0, sells: 0, buyers: 0, sellers: 0 },
          h6: { buys: 0, sells: 0, buyers: 0, sellers: 0 },
          h24: { buys: 0, sells: 0, buyers: 0, sellers: 0 },
        },
        volume_usd: {
          m5: "0",
          m15: "0",
          m30: "0",
          h1: "0",
          h6: "0",
          h24: params.volumeUsd.toString(),
        },
        reserve_in_usd: params.liquidityUsd.toString(),
      },
      relationships: {
        base_token: {
          data: {
            id: params.address,
            type: "token",
          },
        },
        quote_token: {
          data: {
            id: "quote_token",
            type: "token",
          },
        },
        dex: {
          data: {
            id: "mock_dex",
            type: "dex",
          },
        },
      },
    },
  ],
});

/**
 * Common mock responses for frequently used tokens
 * Based on real CoinGecko onchain API responses
 */
export const commonMockResponses = {
  sol: createMockOnchainResponse({
    address: specificChainTokens.svm.sol,
    symbol: "SOL",
    priceUsd: 231.86,
    volumeUsd: 10888054716,
    liquidityUsd: 13326272597,
    fdvUsd: 141671307261,
    poolCreatedAt: "2023-07-05T14:34:02Z",
  }),
  eth: createMockOnchainResponse({
    address: specificChainTokens.eth.eth,
    symbol: "WETH",
    priceUsd: 4473.03,
    volumeUsd: 1008244928,
    liquidityUsd: 2033804297,
    fdvUsd: 10956636957,
    poolCreatedAt: "2021-12-29T12:35:14Z",
  }),
  usdc: createMockOnchainResponse({
    address: specificChainTokens.eth.usdc,
    symbol: "USDC",
    priceUsd: 1.0002548824,
    volumeUsd: 1493569547,
    liquidityUsd: 32854366393,
    fdvUsd: 47961725354,
    poolCreatedAt: "2025-09-18T08:28:30Z",
  }),
  usdt: createMockOnchainResponse({
    address: specificChainTokens.eth.usdt,
    symbol: "USDT",
    priceUsd: 0.9977046221,
    volumeUsd: 1717852681,
    liquidityUsd: 427337930,
    fdvUsd: 96553301896,
    poolCreatedAt: "2025-09-18T08:28:30Z",
  }),
};

/**
 * Creates a mock CoinGecko client instance
 */
export const createMockCoinGeckoClient = (): MockCoinGeckoClient => ({
  onchain: {
    networks: {
      tokens: {
        getAddress: vi.fn(),
      },
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
  response: TokenGetAddressResponse,
) => {
  mockClient.onchain.networks.tokens.getAddress.mockResolvedValueOnce(response);
};

/**
 * Helper to mock multiple token prices in sequence
 */
export const mockBatchTokenPrices = (
  mockClient: MockCoinGeckoClient,
  responses: TokenGetAddressResponse[],
) => {
  responses.forEach((response) => {
    mockClient.onchain.networks.tokens.getAddress.mockResolvedValueOnce(
      response,
    );
  });
};

/**
 * Helper to mock an API error
 */
export const mockTokenPriceError = (
  mockClient: MockCoinGeckoClient,
  errorMessage = "API error",
) => {
  mockClient.onchain.networks.tokens.getAddress.mockRejectedValueOnce(
    new Error(errorMessage),
  );
};
