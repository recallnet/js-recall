import z from "zod/v4";

import {
  getSpecificChainBalances,
  parseEvmChains,
  specificChainTokens,
} from "@recallnet/services/lib";
import { SpecificChainSchema } from "@recallnet/services/types";

import { config as publicConfig } from "./public";

const configSchema = z.strictObject({
  server: z.object({
    nodeEnv: z.string().default("development"),
  }),
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
    // Whether to use the externally owned account allocator
    eoaEnabled: z.boolean().default(false),
    // Private key for the rewards allocator account
    eoaPrivateKey: z.string().default(""),

    // Whether to use the Safe transaction proposer
    safeProposerEnabled: z.boolean().default(false),
    // Private key for the Safe transaction proposer
    safeProposerPrivateKey: z.string().default(""),
    // Address of the Safe contract
    safeAddress: z.string().default(""),
    // API key for the Safe API
    safeApiKey: z.string().default(""),

    // Contract address for the rewards contract
    contractAddress: z.string().default(""),
    // Contract address of the ERC20 token
    tokenContractAddress: z.string().default(""),
    // RPC provider URL for blockchain interactions
    rpcProvider: z.string().default(""),
    // Network for the rewards allocator
    network: z.string().default(""),
    // Slack webhook URL for rewards notifications
    slackWebhookUrl: z.string().default(""),
    // Decay rate for boost time calculations
    boostTimeDecayRate: z.float64(),
  }),
  stakeIndexingEnabled: z.coerce.boolean().default(false),
});

const rawConfig = {
  server: z.object({
    nodeEnv: process.env.NODE_ENV,
  }),
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
    // Whether to use the externally owned account allocator
    eoaEnabled: process.env.REWARDS_EOA_ENABLED === "true",
    // Private key for the rewards allocator account
    eoaPrivateKey: process.env.REWARDS_EOA_PRIVATE_KEY,

    // Whether to use the Safe transaction proposer
    safeProposerEnabled: process.env.REWARDS_SAFE_PROPOSER_ENABLED === "true",
    // Private key for the Safe transaction proposer
    safeProposerPrivateKey: process.env.REWARDS_SAFE_PROPOSER_PRIVATE_KEY,
    // Address of the Safe contract
    safeAddress: process.env.REWARDS_SAFE_ADDRESS,
    // API key for the Safe API
    safeApiKey: process.env.REWARDS_SAFE_API_KEY,

    // Contract address for the rewards contract
    contractAddress: process.env.REWARDS_CONTRACT_ADDRESS,
    // Contract address of the ERC20 token
    tokenContractAddress: process.env.REWARDS_TOKEN_CONTRACT_ADDRESS,
    // RPC provider URL for blockchain interactions
    rpcProvider: process.env.RPC_PROVIDER,
    // Network for the rewards allocator
    network: process.env.REWARDS_NETWORK || "baseSepolia",
    // Slack webhook URL for rewards notifications
    slackWebhookUrl: process.env.REWARDS_SLACK_WEBHOOK_URL,
    // Decay rate for boost time calculations
    boostTimeDecayRate: process.env.REWARDS_BOOST_TIME_DECAY_RATE
      ? parseFloat(process.env.REWARDS_BOOST_TIME_DECAY_RATE)
      : 0.5,
  },
  stakeIndexingEnabled: process.env.INDEXING_ENABLED,
};

const StakingIndexConfig = z.object({
  stakingContract: z.string().min(10),
  rewardsContract: z.string().min(10),
  convictionClaimsContract: z
    .string()
    .min(10)
    .default("0x6A3044c1Cf077F386c9345eF84f2518A2682Dfff"),
  eventStartBlock: z.coerce.number().int().positive().default(27459229),
  transactionsStartBlock: z.coerce.number().int().positive().default(36800000),
  hypersyncUrl: z.url(),
  hypersyncBearerToken: z.string().min(1),
  delayMs: z.coerce.number().int().positive().default(3000),
});

export type StakingIndexConfig = z.infer<typeof StakingIndexConfig>;

export const config = {
  ...publicConfig,
  ...configSchema.parse(rawConfig),

  getStakingIndexConfig(): StakingIndexConfig {
    return StakingIndexConfig.parse({
      stakingContract: process.env.INDEXING_STAKING_CONTRACT,
      rewardsContract: process.env.INDEXING_REWARDS_CONTRACT,
      convictionClaimsContract: process.env.INDEXING_CONVICTION_CLAIMS_CONTRACT,
      eventStartBlock: process.env.INDEXING_EVENTS_START_BLOCK,
      transactionsStartBlock: process.env.INDEXING_TRANSACTIONS_START_BLOCK,
      hypersyncUrl: process.env.INDEXING_HYPERSYNC_URL,
      hypersyncBearerToken: process.env.INDEXING_HYPERSYNC_BEARER_TOKEN!,
      delayMs: process.env.INDEXING_DELAY,
    });
  },
};
