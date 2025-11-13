import z from "zod/v4";

import {
  getSpecificChainBalances,
  parseEvmChains,
  specificChainTokens,
} from "@recallnet/services/lib";
import { SpecificChainSchema } from "@recallnet/services/types";

import { config as publicConfig } from "./public";

const configSchema = z.strictObject({
  evmChains: z
    .array(SpecificChainSchema)
    .default([
      "eth",
      "polygon",
      "bsc",
      "arbitrum",
      "base",
      "optimism",
      "avalanche",
      "linea",
    ]),
  specificChainBalances: z
    .partialRecord(SpecificChainSchema, z.record(z.string().min(1), z.number()))
    .default({}),
  specificChainTokens: z
    .custom<typeof specificChainTokens>()
    .default(specificChainTokens),
  watchlist: z.object({
    chainalysisApiKey: z.string().default(""),
  }),
  priceTracker: z.object({
    maxCacheSize: z.coerce.number().default(10000),
    priceTTLMs: z.coerce.number().default(60000),
  }),
  priceProvider: z.object({
    type: z.enum(["dexscreener", "coingecko"]).default("dexscreener"),
    coingecko: z.object({
      apiKey: z.string().default(""),
      mode: z.enum(["demo", "pro"]).default("demo"),
    }),
  }),
  email: z.object({
    apiKey: z.string().default(""),
    mailingListId: z.string().default(""),
    baseUrl: z.url().default("https://app.loops.so/api/v1"),
  }),
  api: z.object({
    domain: z.url().default("https://api.competitions.recall.network/"),
  }),
  security: z.object({
    rootEncryptionKey: z
      .string()
      .min(1)
      .default("default_encryption_key_do_not_use_in_production"),
  }),
  tradingConstraints: z.object({
    defaultMinimum24hVolumeUsd: z.coerce.number().default(100000),
    defaultMinimumFdvUsd: z.coerce.number().default(1000000),
    defaultMinimumLiquidityUsd: z.coerce.number().default(100000),
    defaultMinimumPairAgeHours: z.coerce.number().default(168),
  }),
  maxTradePercentage: z.coerce.number().min(1).max(100).default(25),
  rateLimiting: z.object({
    maxRequests: z.coerce.number().default(100),
    windowMs: z.coerce.number().default(60000),
  }),
  tradingApi: z.object({
    baseUrl: z.url().default("https://api.competitions.recall.network/api"),
    sandboxApiUrl: z.preprocess(
      (val) => (val ? val : undefined), // convert empty string to undefined
      z.url().optional(),
    ),
    sandboxAdminApiKey: z.string().optional(),
  }),
  healthCheck: z.object({
    apiKey: z.string().optional(),
  }),
  rewards: z.object({
    slackWebhookUrl: z.string().default(""),
    tokenContractAddress: z.string().default(""),
    contractAddress: z.string().default(""),
  }),
});

export const rawConfig = {
  evmChains: parseEvmChains(),
  specificChainBalances: getSpecificChainBalances(),
  watchlist: { chainalysisApiKey: process.env.WATCHLIST_CHAINALYSIS_API_KEY },
  priceTracker: {
    maxCacheSize: process.env.PRICE_TRACKER_MAX_CACHE_SIZE,
    priceTTLMs: process.env.PRICE_TRACKER_PRICE_TTL_MS,
  },
  priceProvider: {
    type: process.env.PRICE_PROVIDER,
    coingecko: {
      apiKey: process.env.COINGECKO_API_KEY,
      mode: process.env.COINGECKO_MODE,
    },
  },
  email: {
    apiKey: process.env.EMAIL_API_KEY,
    mailingListId: process.env.EMAIL_MAILING_LIST_ID,
    baseUrl: process.env.EMAIL_BASE_URL,
  },
  api: { domain: process.env.API_DOMAIN },
  security: { rootEncryptionKey: process.env.ROOT_ENCRYPTION_KEY },
  tradingConstraints: {
    defaultMinimum24hVolumeUsd: process.env.DEFAULT_MINIMUM_24H_VOLUME_USD,
    defaultMinimumFdvUsd: process.env.DEFAULT_MINIMUM_FDV_USD,
    defaultMinimumLiquidityUsd: process.env.DEFAULT_MINIMUM_LIQUIDITY_USD,
    defaultMinimumPairAgeHours: process.env.DEFAULT_MINIMUM_PAIR_AGE_HOURS,
  },
  maxTradePercentage: process.env.MAX_TRADE_PERCENTAGE,
  rateLimiting: {
    maxRequests: process.env.RATE_LIMITING_MAX_REQUESTS,
    windowMs: process.env.RATE_LIMITING_WINDOW_MS,
  },
  tradingApi: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    sandboxApiUrl: process.env.NEXT_PUBLIC_SANDBOX_API_URL,
    sandboxAdminApiKey: process.env.SANDBOX_ADMIN_API_KEY,
  },
  healthCheck: {
    apiKey: process.env.HEALTH_CHECK_API_KEY,
  },
  rewards: {
    slackWebhookUrl: process.env.REWARDS_SLACK_WEBHOOK_URL,
    tokenContractAddress: process.env.REWARDS_TOKEN_CONTRACT_ADDRESS,
    contractAddress: process.env.REWARDS_CONTRACT_ADDRESS,
  },
};

export const config = { ...publicConfig, ...configSchema.parse(rawConfig) };
