import { z } from "zod/v4";

import { BlockchainType, SpecificChain } from "./chains.js";

/**
 * Trading constraints for token validation
 */
export interface TradingConstraints {
  minimumPairAgeHours: number;
  minimum24hVolumeUsd: number;
  minimumLiquidityUsd: number;
  minimumFdvUsd: number;
  minTradesPerDay: number | null;
}

/**
 * Zod schema for trading constraints
 */
export const TradingConstraintsSchema = z.object({
  minimumPairAgeHours: z.number(),
  minimum24hVolumeUsd: z.number(),
  minimumLiquidityUsd: z.number(),
  minimumFdvUsd: z.number(),
  minTradesPerDay: z.number().nullable(),
});

/**
 * Balance in a specific chain
 */
export interface Balance {
  token: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
  specificChain: SpecificChain;
  symbol: string;
}

/**
 * Trade record
 */
export interface Trade {
  id: string;
  timestamp: Date;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  price: number;
  tradeAmountUsd: number;
  toTokenSymbol: string;
  success: boolean;
  agentId: string;
  competitionId: string;
  reason: string;
  error?: string;
  fromChain: BlockchainType;
  toChain: BlockchainType;
  fromSpecificChain: SpecificChain;
  toSpecificChain: SpecificChain;
}

/**
 * Trade execution result
 */
export interface TradeResult {
  success: boolean;
  error?: string;
  trade?: Trade;
}

/**
 * Token price request
 */
export interface TokenPriceRequest {
  tokenAddress: string;
  specificChain: SpecificChain;
}

/**
 * Price report from a provider
 */
export interface PriceReport {
  token: string;
  price: number;
  timestamp: Date;
  chain: BlockchainType;
  specificChain: SpecificChain;
  symbol: string;
  pairCreatedAt?: number;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
}

/**
 * Token information from price providers
 */
export interface TokenInfo {
  price: number;
  symbol: string;
  pairCreatedAt?: number;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
}

/**
 * Specific chain balances mapping
 */
export type SpecificChainBalances = {
  [K in SpecificChain]?: Record<string, number>;
};

/**
 * Available price providers
 */
export type PriceProvider = "dexscreener" | "coingecko";

/**
 * CoinGecko API mode
 */
export type CoinGeckoMode = "demo" | "pro";
