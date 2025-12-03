import { z } from "zod/v4";

import {
  allocationUnit,
  displayState,
  engineType,
} from "@recallnet/db/schema/core/defs";
import {
  AgentHandleSchema,
  AgentMetadataSchema,
  CompetitionTypeSchema,
  CrossChainTradingTypeSchema,
  EvaluationMetricSchema,
  SpecificChainSchema,
  TradingConstraintsSchema,
  UuidSchema,
} from "@recallnet/services/types";

/**
 * Admin setup schema for initial admin account creation
 */
export const AdminSetupSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.email("Invalid email format"),
});

/**
 * Wallet address schema (Ethereum hex address)
 */
export const WalletAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address");

/**
 * Admin register user schema for creating users and optionally their first agent
 */
export const AdminRegisterUserSchema = z.object({
  walletAddress: WalletAddressSchema,
  embeddedWalletAddress: WalletAddressSchema.optional(),
  privyId: z.string().optional(),
  name: z.string().optional(),
  email: z.email().optional(),
  userImageUrl: z.url().optional(),
  userMetadata: z.record(z.string(), z.unknown()).optional(),
  agentName: z.string().optional(),
  agentHandle: AgentHandleSchema.optional(),
  agentDescription: z.string().optional(),
  agentImageUrl: z.url().optional(),
  agentMetadata: AgentMetadataSchema.optional(),
  agentWalletAddress: WalletAddressSchema.optional(),
});

/**
 * Rewards Schema (enforces that the key and value are both numbers)
 */
export const RewardsSchema = z
  .record(z.string().regex(/^\d+$/), z.number())
  .transform((val) => {
    const result: Record<number, number> = {};
    for (const [key, value] of Object.entries(val)) {
      result[parseInt(key, 10)] = value;
    }
    return result;
  })
  .optional();

/**
 * Perps provider configuration schema
 */
export const PerpsProviderSchema = z.object({
  provider: z.enum(["symphony", "hyperliquid"]).default("symphony"),
  initialCapital: z.number().positive().default(500), // Default $500 initial capital
  selfFundingThreshold: z.number().min(0).default(0), // Default 0 (no self-funding allowed)
  minFundingThreshold: z.number().min(0).optional(), // Optional minimum portfolio balance
  apiUrl: z.string().url().optional(),
});

/**
 * Protocol filter input schema - Admin provides protocol name + chain only
 * System resolves router address, event signature, and factory address from constants
 */
export const ProtocolFilterInputSchema = z.object({
  protocol: z.string().min(1, "Protocol name is required"),
  chain: SpecificChainSchema,
});

/**
 * Token whitelist input schema - Admin provides address + specificChain
 * System validates token is tradeable and fetches symbol via price API
 */
export const TokenWhitelistInputSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token address format"),
  specificChain: SpecificChainSchema,
});

/**
 * Spot live data source configuration schema
 *
 * For Alchemy: Only `type`, `provider`, and `chains` are required.
 * The API key is read from ALCHEMY_API_KEY env var, URLs are auto-constructed.
 *
 * @example
 * // Minimal Alchemy config:
 * { type: "rpc_direct", provider: "alchemy", chains: ["base", "arbitrum"] }
 */
export const SpotLiveDataSourceConfigSchema = z.object({
  type: z.enum(["rpc_direct", "envio_indexing", "hybrid"]),
  provider: z
    .enum(["alchemy", "quicknode", "infura"])
    .optional()
    .describe(
      "RPC provider - API key read from environment (e.g., ALCHEMY_API_KEY)",
    ),
  rpcUrls: z
    .record(z.string(), z.string().url())
    .optional()
    .describe(
      "Custom RPC URLs by chain (optional - Alchemy auto-constructs URLs)",
    ),
  graphqlUrl: z.string().url().optional(),
  chains: z.array(SpecificChainSchema).min(1, "At least one chain is required"),
});

/**
 * Spot live configuration schema for competition creation
 */
export const SpotLiveConfigSchema = z.object({
  dataSource: z.enum(["rpc_direct", "envio_indexing", "hybrid"]),
  dataSourceConfig: SpotLiveDataSourceConfigSchema,
  chains: z
    .array(SpecificChainSchema)
    .min(1, "At least one chain is required")
    .describe("Chains enabled for this competition"),
  allowedProtocols: z
    .array(ProtocolFilterInputSchema)
    .optional()
    .describe(
      "Protocol whitelist - Admin provides name + chain, system resolves addresses",
    ),
  allowedTokens: z
    .array(TokenWhitelistInputSchema)
    .min(2, "At least 2 tokens required for trading")
    .optional()
    .describe(
      "Token whitelist - Admin provides address + chain, system validates and fetches symbol",
    ),
  selfFundingThresholdUsd: z
    .number()
    .min(0)
    .default(10)
    .describe("Threshold for flagging self-funding violations (USD)"),
  minFundingThreshold: z
    .number()
    .min(0)
    .optional()
    .describe(
      "Minimum portfolio balance required at competition start (USD). Agents below this threshold are removed BEFORE trading begins. Not enforced during ongoing trading.",
    ),
  syncIntervalMinutes: z
    .number()
    .int()
    .min(1)
    .default(2)
    .describe("How often to sync blockchain data (minutes)"),
});

/**
 * Partial spot live config schema for updates
 * All fields are optional - only provided fields will be updated
 */
export const SpotLiveConfigUpdateSchema = z.object({
  dataSource: z.enum(["rpc_direct", "envio_indexing", "hybrid"]).optional(),
  dataSourceConfig: SpotLiveDataSourceConfigSchema.optional(),
  chains: z
    .array(SpecificChainSchema)
    .min(1, "At least one chain is required")
    .optional()
    .describe("Chains enabled for this competition - replaces existing chains"),
  allowedProtocols: z
    .array(ProtocolFilterInputSchema)
    .optional()
    .describe(
      "Protocol whitelist - replaces existing protocols. Admin provides name + chain, system resolves addresses",
    ),
  allowedTokens: z
    .array(TokenWhitelistInputSchema)
    .min(2, "At least 2 tokens required for trading")
    .optional()
    .describe(
      "Token whitelist - replaces existing tokens. Admin provides address + chain, system validates and fetches symbol",
    ),
  selfFundingThresholdUsd: z
    .number()
    .min(0)
    .optional()
    .describe("Threshold for flagging self-funding violations (USD)"),
  minFundingThreshold: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe(
      "Minimum portfolio balance required at competition start (USD). Agents below this threshold are removed BEFORE trading begins. Not enforced during ongoing trading. Set to null to remove.",
    ),
  syncIntervalMinutes: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("How often to sync blockchain data (minutes)"),
});

/**
 * Paper trading config schema
 */
export const PaperTradingConfigSchema = z
  .object({
    maxTradePercentage: z.number().int().min(1).max(100).optional(),
  })
  .optional();

/**
 * Paper trading initial balance schema
 */
export const PaperTradingInitialBalanceSchema = z.object({
  specificChain: SpecificChainSchema,
  tokenSymbol: z.string().min(1).max(20),
  amount: z.number().gt(0),
});

/**
 * Paper trading initial balances schema (array of balances)
 */
export const PaperTradingInitialBalancesSchema = z
  .array(PaperTradingInitialBalanceSchema)
  .min(1, "At least one initial balance is required")
  .optional()
  .refine(
    (balances) => {
      if (!balances || balances.length === 0) return true;

      // Check for duplicates using Set
      const seen = new Set<string>();
      for (const balance of balances) {
        const key = `${balance.specificChain}:${balance.tokenSymbol}`;
        if (seen.has(key)) {
          return false; // Duplicate found
        }
        seen.add(key);
      }
      return true;
    },
    {
      message:
        "Duplicate entries detected: each (specificChain, tokenSymbol) pair must be unique",
    },
  );

/**
 * Admin create or update competition schema
 */
export const AdminCreateCompetitionSchema = z
  .object({
    name: z.string().min(1, "Competition name is required"),
    description: z.string().optional(),
    tradingType: CrossChainTradingTypeSchema.optional(),
    sandboxMode: z.boolean().optional(),
    externalUrl: z.url().optional(),
    imageUrl: z.url().optional(),
    type: CompetitionTypeSchema.optional(),
    startDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    endDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    boostStartDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    boostEndDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    joinStartDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    joinEndDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    maxParticipants: z.number().int().min(1).optional(),
    minimumStake: z.number().min(0).optional(),
    tradingConstraints: TradingConstraintsSchema,
    rewards: RewardsSchema,
    evaluationMetric: EvaluationMetricSchema.optional().describe(
      "Metric used for ranking agents. Defaults to calmar_ratio for perps, simple_return for spot trading",
    ),
    perpsProvider: PerpsProviderSchema.optional(), // Only required for perps competitions
    spotLiveConfig: SpotLiveConfigSchema.optional(), // Only required for spot_live_trading competitions
    prizePools: z
      .object({
        agent: z.number().min(0),
        users: z.number().min(0),
      })
      .optional(),
    rewardsIneligible: z.array(z.string()).optional(),

    // Arena and engine routing
    arenaId: z.string().min(1, "Arena ID is required"),
    engineId: z.enum(engineType.enumValues).optional(),
    engineVersion: z.string().optional(),

    // Participation rules
    vips: z.array(z.string()).optional(),
    allowlist: z.array(z.string()).optional(),
    blocklist: z.array(z.string()).optional(),
    minRecallRank: z.number().int().optional(),
    allowlistOnly: z.boolean().optional(),

    // Reward allocation
    agentAllocation: z.number().optional(),
    agentAllocationUnit: z.enum(allocationUnit.enumValues).optional(),
    boosterAllocation: z.number().optional(),
    boosterAllocationUnit: z.enum(allocationUnit.enumValues).optional(),
    rewardRules: z.string().optional(),
    rewardDetails: z.string().optional(),
    boostTimeDecayRate: z
      .number()
      .min(0.1)
      .max(0.9)
      .optional()
      .describe(
        "Decay rate for boost time calculations. Must be between 0.1 and 0.9.",
      ),

    // Display
    displayState: z.enum(displayState.enumValues).optional(),

    // NFL schedule
    gameIds: z.array(UuidSchema).optional(),

    // Paper trading configuration
    paperTradingConfig: PaperTradingConfigSchema,
    paperTradingInitialBalances: PaperTradingInitialBalancesSchema,
  })
  .refine(
    (data) => {
      if (data.joinStartDate && data.joinEndDate) {
        return data.joinStartDate <= data.joinEndDate;
      }
      return true;
    },
    {
      message: "joinStartDate must be before or equal to joinEndDate",
      path: ["joinStartDate"],
    },
  );

/**
 * Admin update competition schema (note: mostly the same as competition creation, but with optional name)
 * Note: Validation for perpsProvider requirement when changing type to perpetual_futures
 * is handled in the service layer, as it requires knowing the current competition type
 */
export const AdminUpdateCompetitionSchema = AdminCreateCompetitionSchema.omit({
  name: true,
  arenaId: true,
  spotLiveConfig: true, // Use partial version for updates
  paperTradingInitialBalances: true,
}).extend({
  name: z.string().optional(),
  spotLiveConfig: SpotLiveConfigUpdateSchema.optional(), // Partial updates supported
  arenaId: z.string().min(1, "Arena ID is required").optional(),
  paperTradingInitialBalances: PaperTradingInitialBalancesSchema.optional(),
});

/**
 * Admin start competition schema
 */
export const AdminStartCompetitionSchema = z
  .object({
    competitionId: UuidSchema.optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    agentIds: z.array(UuidSchema).default([]),
    tradingType: CrossChainTradingTypeSchema.optional(),
    sandboxMode: z.boolean().optional(),
    externalUrl: z.url().optional(),
    imageUrl: z.url().optional(),
    type: CompetitionTypeSchema.optional(),
    startDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    endDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    boostStartDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    boostEndDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    joinStartDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    joinEndDate: z.iso.datetime().pipe(z.coerce.date()).optional(),
    minimumStake: z.number().min(0).optional(),
    tradingConstraints: TradingConstraintsSchema,
    rewards: RewardsSchema,
    evaluationMetric: EvaluationMetricSchema.optional().describe(
      "Metric used for ranking agents. Defaults to calmar_ratio for perps, simple_return for spot trading",
    ),
    perpsProvider: PerpsProviderSchema.optional(), // Only required for perps competitions
    spotLiveConfig: SpotLiveConfigSchema.optional(), // Only required for spot_live_trading competitions
    prizePools: z
      .object({
        agent: z.number().min(0),
        users: z.number().min(0),
      })
      .optional(),
    rewardsIneligible: z.array(z.string()).optional(),

    // Arena and engine routing
    arenaId: z.string().min(1, "Arena ID is required").optional(),
    engineId: z.enum(engineType.enumValues).optional(),
    engineVersion: z.string().optional(),

    // Participation rules
    vips: z.array(z.string()).optional(),
    allowlist: z.array(z.string()).optional(),
    blocklist: z.array(z.string()).optional(),
    minRecallRank: z.number().int().optional(),
    allowlistOnly: z.boolean().optional(),

    // Reward allocation
    agentAllocation: z.number().optional(),
    agentAllocationUnit: z.enum(allocationUnit.enumValues).optional(),
    boosterAllocation: z.number().optional(),
    boosterAllocationUnit: z.enum(allocationUnit.enumValues).optional(),
    rewardRules: z.string().optional(),
    rewardDetails: z.string().optional(),
    boostTimeDecayRate: z
      .number()
      .min(0.1)
      .max(0.9)
      .optional()
      .describe(
        "Decay rate for boost time calculations. Must be between 0.1 and 0.9.",
      ),

    // Display
    displayState: z.enum(displayState.enumValues).optional(),

    // Paper trading configuration
    paperTradingConfig: PaperTradingConfigSchema,
    paperTradingInitialBalances: PaperTradingInitialBalancesSchema,
  })
  .refine((data) => data.competitionId || data.name, {
    message: "Either competitionId or name must be provided",
  })
  .refine(
    (data) => {
      // If creating a new competition (no competitionId), arenaId is required
      if (!data.competitionId && !data.arenaId) {
        return false;
      }
      return true;
    },
    {
      message: "Arena ID is required when creating a new competition",
      path: ["arenaId"],
    },
  );

/**
 * Admin end competition schema
 */
export const AdminEndCompetitionSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Admin get performance reports query schema
 */
export const AdminGetPerformanceReportsQuerySchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Admin get competition snapshots params and query schema
 */
export const AdminGetCompetitionSnapshotsParamsSchema = z.object({
  competitionId: UuidSchema,
});

export const AdminGetCompetitionSnapshotsQuerySchema = z.object({
  agentId: UuidSchema.optional(),
});

/**
 * Admin deactivate agent params and body schema
 */
export const AdminDeactivateAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

export const AdminDeactivateAgentBodySchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

/**
 * Admin reactivate agent params schema
 */
export const AdminReactivateAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin get agent params schema
 */
export const AdminGetAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin remove agent from competition params and body schema
 */
export const AdminRemoveAgentFromCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
  agentId: UuidSchema,
});

export const AdminRemoveAgentFromCompetitionBodySchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

/**
 * Admin reactivate agent in competition params schema
 */
export const AdminReactivateAgentInCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
  agentId: UuidSchema,
});

/**
 * Admin get agent API key params schema
 */
export const AdminGetAgentApiKeyParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin update competition params schema
 */
export const AdminUpdateCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Admin delete agent params schema
 */
export const AdminDeleteAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin add agent to competition params schema
 */
export const AdminAddAgentToCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
  agentId: UuidSchema,
});

/**
 * Admin update agent params schema
 */
export const AdminUpdateAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin update agent body schema
 */
export const AdminUpdateAgentBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name must be at least 1 character")
    .max(100)
    .optional(),
  handle: AgentHandleSchema.optional(),
  description: z.string().optional(),
  imageUrl: z.url("Invalid image URL format").optional(),
  email: z.email("Invalid email format").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  isRewardsIneligible: z.boolean().optional(),
  rewardsIneligibilityReason: z.string().optional(),
});

/**
 * Admin list all agents query schema
 */
export const AdminListAllAgentsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .min(1)
    .max(1000)
    .default(50)
    .optional()
    .describe("Number of agents to return (default: 50, max: 1000)"),
  offset: z.coerce
    .number()
    .min(0)
    .default(0)
    .optional()
    .describe("Number of agents to skip for pagination"),
  sort: z
    .string()
    .default("-createdAt")
    .optional()
    .describe("Sort order (e.g., '-createdAt' for desc, 'name' for asc)"),
});

/**
 * Admin get competition transfer violations params schema
 */
export const AdminGetCompetitionTransferViolationsParamsSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Admin get spot live self-funding alerts query schema
 */
export const AdminGetSpotLiveAlertsQuerySchema = z.object({
  reviewed: z.enum(["true", "false", "all"]).optional().default("false"),
  violationType: z
    .enum(["deposit", "withdrawal_exceeds_limit", "all"])
    .optional(),
});

/**
 * Admin review spot live self-funding alert params schema
 */
export const AdminReviewSpotLiveAlertParamsSchema = z.object({
  competitionId: UuidSchema,
  alertId: UuidSchema,
});

/**
 * Admin review spot live self-funding alert body schema
 */
export const AdminReviewSpotLiveAlertBodySchema = z.object({
  reviewNote: z.string().min(1, "Review note is required"),
  actionTaken: z.enum(["dismissed", "disqualified", "warning"]),
});

/**
 * Admin rewards allocation schema
 */
export const AdminRewardsAllocationSchema = z.object({
  competitionId: UuidSchema.describe(
    "The competition ID to allocate rewards for",
  ),
  startTimestamp: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "The timestamp from which rewards can be claimed (optional, defaults to competition end date + 1 hour)",
    ),
});

/**
 * Admin create arena schema
 */
export const AdminCreateArenaSchema = z.object({
  id: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      "Arena ID must be lowercase kebab-case (e.g., 'aerodrome-base-weekly')",
    )
    .min(3)
    .max(80),
  name: z.string().min(4).max(80),
  createdBy: z.string().min(1),
  category: z.string().min(1),
  skill: z.string().min(1),
  venues: z.array(z.string()).optional(),
  chains: z.array(z.string()).optional(),
});

/**
 * Admin update arena schema
 */
export const AdminUpdateArenaSchema = z.object({
  name: z.string().min(4).max(80).optional(),
  category: z.string().min(1).optional(),
  skill: z.string().min(1).optional(),
  venues: z.array(z.string()).optional(),
  chains: z.array(z.string()).optional(),
});

/**
 * Admin arena params schema (for :id in path)
 */
export const AdminArenaParamsSchema = z.object({
  id: z.string().min(1),
});

/**
 * Admin list arenas query schema
 */
export const AdminListArenasQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().default(""),
  nameFilter: z.string().optional(),
});

/**
 * Admin create partner schema
 */
export const AdminCreatePartnerSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  details: z.string().max(500).optional(),
});

/**
 * Admin update partner schema
 */
export const AdminUpdatePartnerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  details: z.string().max(500).optional(),
});

/**
 * Admin partner params schema (for :id in path)
 */
export const AdminPartnerParamsSchema = z.object({
  id: UuidSchema,
});

/**
 * Admin list partners query schema
 */
export const AdminListPartnersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().default(""),
  nameFilter: z.string().optional(),
});

/**
 * Admin add partner to competition schema
 */
export const AdminAddPartnerToCompetitionSchema = z.object({
  partnerId: UuidSchema,
  position: z.number().int().min(1),
});

/**
 * Admin update partner position schema
 */
export const AdminUpdatePartnerPositionSchema = z.object({
  position: z.number().int().min(1),
});

/**
 * Admin replace competition partners schema
 */
export const AdminReplaceCompetitionPartnersSchema = z.object({
  partners: z.array(
    z.object({
      partnerId: UuidSchema,
      position: z.number().int().min(1),
    }),
  ),
});

/**
 * Admin competition params schema (for :competitionId in path)
 */
export const AdminCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Admin competition partner params schema (for :competitionId/:partnerId in path)
 */
export const AdminCompetitionPartnerParamsSchema = z.object({
  competitionId: UuidSchema,
  partnerId: UuidSchema,
});

/**
 * Schema for a single bonus boost item in batch add request
 */
export const AdminBonusBoostItemSchema = z.object({
  wallet: WalletAddressSchema,
  amount: z
    .string()
    .regex(/^\d+$/, "Amount must be a valid numeric string")
    .refine(
      (val) => BigInt(val) > 0n,
      "Amount must be positive (greater than zero)",
    )
    .refine(
      (val) => BigInt(val) <= BigInt("1000000000000000000"), // 10^18 max
      "Amount exceeds maximum allowed value (10^18)",
    ),
  expiresAt: z.iso
    .datetime()
    .pipe(z.coerce.date())
    .refine(
      (date) => date.getTime() > Date.now() + 60000, // At least 1 minute in future
      "Expiration date must be at least 1 minute in the future",
    ),
  meta: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .refine(
      (obj) => JSON.stringify(obj).length <= 1000,
      "Meta object must not exceed 1000 characters when serialized",
    )
    .optional(),
});

/**
 * Admin add bonus boost schema
 * Accepts an array of boost items to add
 */
export const AdminAddBonusBoostSchema = z
  .object({
    boosts: z
      .array(AdminBonusBoostItemSchema)
      .min(1, "At least one boost item is required")
      .max(100, "Cannot process more than 100 boosts at once"),
  })
  .refine(
    (data) => {
      const wallets = data.boosts.map((b) => b.wallet.toLowerCase());
      const uniqueWallets = new Set(wallets);
      return wallets.length === uniqueWallets.size;
    },
    {
      message: "Duplicate wallet addresses found in batch",
      path: ["boosts"],
    },
  );

/**
 * Admin revoke bonus boost schema
 * Accepts an array of boost IDs to revoke
 */
export const AdminRevokeBonusBoostSchema = z.object({
  boostIds: z
    .array(UuidSchema)
    .min(1, "At least one boost ID is required")
    .max(100, "Cannot revoke more than 100 boosts at once"),
});
