import { z } from "zod/v4";

import {
  type UserMetadata,
  actorStatus,
  allocationUnit,
  competitionAgentStatus,
  competitionStatus,
  competitionType,
  displayState,
  engineType,
} from "@recallnet/db/schema/core/defs";
import { MAX_HANDLE_LENGTH } from "@recallnet/db/schema/core/defs";
import {
  SelectAgent,
  SelectCompetition,
  SelectUser,
} from "@recallnet/db/schema/core/types";
import {
  crossChainTradingType,
  evaluationMetricEnum,
} from "@recallnet/db/schema/trading/defs";

import { specificChainTokens } from "../lib/config-utils.js";

/**
 * Trading constraints for token validation
 */
export interface TradingConstraints {
  /** Minimum age of trading pair in hours */
  minimumPairAgeHours: number;
  /** Minimum 24-hour trading volume in USD */
  minimum24hVolumeUsd: number;
  /** Minimum liquidity in USD */
  minimumLiquidityUsd: number;
  /** Minimum fully diluted valuation in USD */
  minimumFdvUsd: number;
  /** Minimum trades per day (null = no constraint) */
  minTradesPerDay: number | null;
}

/**
 * Custom error class with HTTP status code
 */
export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export type SpecificChainBalances = {
  [K in SpecificChain]?: Record<string, number>;
};

type TokenDict = Record<string, string>;
type KnownChains = keyof typeof specificChainTokens;

/**
 * Standard chain tokens with optional additional tokens
 */
export type SpecificChainTokens = Partial<{
  [K in KnownChains]: Partial<(typeof specificChainTokens)[K]> & TokenDict;
}> &
  Record<string, TokenDict>;

/**
 * Blockchain type enum
 */
export enum BlockchainType {
  SVM = "svm",
  EVM = "evm",
}

/**
 * Array of supported specific chain names
 */
export const SPECIFIC_CHAIN_NAMES = [
  "eth",
  "polygon",
  "bsc",
  "arbitrum",
  "optimism",
  "avalanche",
  "base",
  "linea",
  "zksync",
  "scroll",
  "mantle",
  "svm",
] as const;

// Zod schema for SpecificChain validation
export const SpecificChainSchema = z.enum(SPECIFIC_CHAIN_NAMES);

// Type derived from the Zod schema
export type SpecificChain = z.infer<typeof SpecificChainSchema>;

// Mapping from SpecificChain to BlockchainType
export const chainTypeMapping: Record<SpecificChain, BlockchainType> = {
  eth: BlockchainType.EVM,
  polygon: BlockchainType.EVM,
  bsc: BlockchainType.EVM,
  arbitrum: BlockchainType.EVM,
  optimism: BlockchainType.EVM,
  avalanche: BlockchainType.EVM,
  base: BlockchainType.EVM,
  linea: BlockchainType.EVM,
  zksync: BlockchainType.EVM,
  scroll: BlockchainType.EVM,
  mantle: BlockchainType.EVM,
  svm: BlockchainType.SVM,
};

// Get general chain type from specific chain
export function getBlockchainType(
  specificChain: SpecificChain,
): BlockchainType {
  return chainTypeMapping[specificChain] || BlockchainType.EVM;
}

// Helper to determine if a chain is EVM compatible
export function isEvmChain(chain: SpecificChain | BlockchainType): boolean {
  if (typeof chain === "string" && chain in chainTypeMapping) {
    return chainTypeMapping[chain as SpecificChain] === BlockchainType.EVM;
  }
  return chain === BlockchainType.EVM;
}

/**
 * Request structure for fetching token prices with chain specificity
 * Used by getBulkPrices to fetch prices for token+chain combinations
 */
export interface TokenPriceRequest {
  /** Token contract address */
  tokenAddress: string;
  /** Specific blockchain where the token exists */
  specificChain: SpecificChain;
}

/**
 * Balance interface
 */
export interface Balance {
  token: string; // Token address
  amount: number;
  createdAt: Date;
  updatedAt: Date;
  specificChain: SpecificChain;
  symbol: string; // Token symbol
}

/**
 * Trade interface
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

  // Chain information
  fromChain: BlockchainType;
  toChain: BlockchainType;
  fromSpecificChain: SpecificChain;
  toSpecificChain: SpecificChain;
}

/**
 * Price source interface for different providers
 */
export interface PriceSource {
  getName(): string;

  /**
   * Get price for a single token
   */
  getPrice(
    tokenAddress: string,
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<PriceReport | null>;

  /**
   * Get prices for multiple tokens in batch
   */
  getBatchPrices(
    tokenAddresses: string[],
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<Map<string, TokenInfo | null>>;

  /**
   * Determine blockchain type from token address format
   */
  determineChain(tokenAddress: string): BlockchainType;
}

/**
 * Available price provider implementations
 */
export type PriceProvider = "dexscreener" | "coingecko";

/**
 * CoinGecko API environment (free vs. paid plan)
 */
export type CoinGeckoMode = "demo" | "pro";

// DexScreener API interfaces
export interface DexScreenerToken {
  address: string;
  symbol: string;
  name?: string;
}

export interface DexScreenerPair {
  baseToken: DexScreenerToken;
  quoteToken: DexScreenerToken;
  priceUsd: string;
  priceNative: string;
  volume?: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  priceChange?: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairAddress?: string;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
}

export type DexScreenerResponse = DexScreenerPair[];

/**
 * Token information returned by price provider API providers
 */
export interface TokenInfo {
  price: number;
  symbol: string;
  pairCreatedAt?: number;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
}

export interface PriceReport {
  token: string;
  price: number;
  timestamp: Date;
  chain: BlockchainType;
  specificChain: SpecificChain;
  symbol: string;
  // Additional data for trading constraints
  pairCreatedAt?: number;
  volume?: {
    h24?: number;
  };
  liquidity?: {
    usd?: number;
  };
  fdv?: number;
}

/**
 * Trade result interface
 */
export interface TradeResult {
  success: boolean;
  error?: string;
  trade?: Trade;
}

/**
 * Account state interface
 */
export interface AccountState {
  balances: Map<string, number>;
  trades: Trade[];
}

/**
 * Social media information for an agent
 */
export interface AgentSocial {
  name?: string;
  email?: string;
  twitter?: string;
}

/**
 * Reference information for an agent
 */
export interface AgentRef {
  name: string;
  version: string;
  url?: string;
}

/**
 * Admin's metadata interface
 */
export interface AdminMetadata {
  permissions?: string[];
  lastPasswordChange?: string;
  suspensionReason?: string;
  suspensionDate?: string;
  reactivationDate?: string;
  settings?: Record<string, unknown>;
  custom?: Record<string, unknown>;
}

/**
 * Agent's stats schema
 */
export const AgentStatsSchema = z.object({
  completedCompetitions: z.number(),
  totalTrades: z.number(),
  totalPositions: z.number(),
  bestPlacement: z
    .object({
      competitionId: z.string(),
      rank: z.number(),
      score: z.number(),
      totalAgents: z.number(),
    })
    .optional(),
  totalRoi: z.number().optional(),
  bestPnl: z.number().optional(),
  ranks: z
    .array(
      z.object({
        type: z.string(),
        rank: z.number(),
        score: z.number(),
      }),
    )
    .optional(),
});

export type AgentStats = z.infer<typeof AgentStatsSchema>;

/**
 * Agent trophy interface for ended competitions
 * Contains competition details and agent's final rank
 */
export interface AgentTrophy {
  competitionId: string;
  name: string;
  rank: number;
  imageUrl: string;
  createdAt: string;
}

/**
 * Zod schema for agent trophy validation
 */
export const AgentTrophySchema = z.object({
  competitionId: z.string(),
  name: z.string(),
  rank: z.number(),
  imageUrl: z.string(),
  createdAt: z.string(),
});

/**
 * Agent's metadata
 */
export const AgentMetadataSchema = z.looseObject({
  stats: AgentStatsSchema.optional(),
  skills: z.array(z.string()).optional(),
  trophies: z.array(AgentTrophySchema).optional(),
  hasUnclaimedRewards: z.boolean().optional(),
});

export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

/**
 * Admin search parameters interface
 */
export interface SearchAdminsParams {
  username?: string;
  email?: string;
  name?: string;
  status?: ActorStatus;
}

/**
 * User interface
 */
export interface User {
  id: string;
  walletAddress: string;
  embeddedWalletAddress?: string;
  walletLastVerifiedAt?: Date;
  name?: string;
  email?: string;
  isSubscribed: boolean;
  privyId?: string;
  imageUrl?: string;
  metadata?: UserMetadata;
  status: ActorStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

/**
 * Owner information subset for public agent profiles
 * Contains only public fields from User
 */
export interface OwnerInfo {
  id: string;
  name: string | null;
  walletAddress: string;
}

/**
 * Agent with owner information for public display
 * Extends the sanitized agent data with owner details
 */
export interface AgentWithOwner {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  metadata?: AgentMetadata;
  status: ActorStatus;
  walletAddress?: string;
  createdAt: Date;
  updatedAt: Date;
  owner: OwnerInfo | null;
}

/**
 * Admin interface
 */
export interface Admin {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  apiKey?: string;
  name?: string;
  imageUrl?: string;
  metadata?: AdminMetadata;
  status: ActorStatus;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zod schema for the cross-chain trading type.
 */
export const CrossChainTradingTypeSchema = z.enum(
  crossChainTradingType.enumValues,
);

/**
 * Cross-chain trading type.
 */
export type CrossChainTradingType = z.infer<typeof CrossChainTradingTypeSchema>;

/**
 * Competition type
 */
export type Competition = SelectCompetition;

/**
 * Agent-specific metrics for a competition
 */
export interface CompetitionMetrics {
  portfolioValue: number;
  pnl: number;
  pnlPercent: number;
  totalTrades: number;
  bestPlacement?: {
    rank: number;
    totalAgents: number;
  };
}

/**
 * Enhanced competition with agent-specific metrics
 * Based on SelectCompetition from database (without crossChainTradingType)
 */
export interface EnhancedCompetition {
  id: string;
  name: string;
  description: string | null;
  type: CompetitionType;
  externalUrl: string | null;
  imageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: CompetitionStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
  // Competition participant properties
  registeredParticipants: number;
  maxParticipants: number | null;
  // Agent-specific metrics
  portfolioValue: number;
  pnl: number;
  pnlPercent: number;
  // Competition-type specific metrics
  competitionType?: CompetitionType; // Included for client awareness
  totalTrades?: number; // For paper trading competitions
  totalPositions?: number; // For perpetual futures competitions
  // Risk metrics (for perpetual futures competitions)
  calmarRatio: number | null;
  simpleReturn: number | null;
  maxDrawdown: number | null;
  // TODO: dry out the type for best placement
  bestPlacement?: {
    rank: number;
    totalAgents: number;
  };
}

/**
 * Agent's portfolio value
 */
export interface PortfolioValue {
  agentId: string;
  competitionId: string;
  timestamp: Date;
  totalValue: number;
}

/**
 * API Key authentication information
 */
export interface ApiAuth {
  agentId: string;
  key: string;
}

/**
 * Login response upon successful SIWE authentication
 */
export interface LoginResponse {
  success: boolean;
  agentId?: string;
  userId?: string;
  wallet?: string;
}

/**
 * Zod schema for the status of a user, agent, or admin.
 */
export const ActorStatusSchema = z.enum(actorStatus.enumValues);

/**
 * Status of a user, agent, or admin.
 */
export type ActorStatus = z.infer<typeof ActorStatusSchema>;

/**
 * Minimum length of a handle.
 */
export const MIN_HANDLE_LENGTH = 3;

/**
 * Agent information Object
 */
export const AgentSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  handle: z.string(),
  walletAddress: z.nullish(z.string()),
  email: z.nullish(z.email()),
  description: z.nullish(z.string()),
  imageUrl: z.nullish(z.url()),
  apiKey: z.string(),
  metadata: z.nullish(AgentMetadataSchema),
  status: ActorStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Agent = z.infer<typeof AgentSchema>;

/**
 * Public Agent information Object, omits apiKey and email
 */
export const AgentPublicSchema = AgentSchema.omit({
  apiKey: true,
  email: true,
}).extend({
  isVerified: z.boolean(),
});
export type AgentPublic = z.infer<typeof AgentPublicSchema>;

/**
 * Runtime conversion helpers for database to API type conversion
 * These functions convert null values to undefined for API compatibility
 */

/**
 * Converts a database User object to API User format
 * @param dbUser Database user object with null values
 * @returns API user object with undefined values
 */
export function toApiUser(dbUser: SelectUser): User {
  return {
    id: dbUser.id,
    walletAddress: dbUser.walletAddress,
    embeddedWalletAddress: dbUser.embeddedWalletAddress ?? undefined,
    walletLastVerifiedAt: dbUser.walletLastVerifiedAt ?? undefined,
    name: dbUser.name ?? undefined,
    email: dbUser.email ?? undefined,
    isSubscribed: dbUser.isSubscribed,
    privyId: dbUser.privyId ?? undefined,
    imageUrl: dbUser.imageUrl ?? undefined,
    metadata: dbUser.metadata ?? undefined,
    status: dbUser.status as ActorStatus,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
    lastLoginAt: dbUser.lastLoginAt ?? undefined,
  };
}

/**
 * Converts a database Agent object to API Agent format, *including* unencrypted API credentials.
 * @param dbAgent Database agent object with null values
 * @returns API agent object with undefined values
 */
export function toApiAgent(dbAgent: SelectAgent): Agent {
  return {
    id: dbAgent.id,
    ownerId: dbAgent.ownerId,
    walletAddress: dbAgent.walletAddress ?? undefined,
    name: dbAgent.name,
    handle: dbAgent.handle,
    description: dbAgent.description ?? undefined,
    imageUrl: dbAgent.imageUrl ?? undefined,
    apiKey: dbAgent.apiKey,
    metadata: dbAgent.metadata ? (dbAgent.metadata as UserMetadata) : undefined,
    email: dbAgent.email ?? undefined,
    status: dbAgent.status as ActorStatus,
    createdAt: dbAgent.createdAt,
    updatedAt: dbAgent.updatedAt,
  };
}

/**
 * Trading Constraint Schema
 */
export const TradingConstraintsSchema = z
  .object({
    minimumPairAgeHours: z.number().min(0),
    minimum24hVolumeUsd: z.number().min(0),
    minimumLiquidityUsd: z.number().min(0),
    minimumFdvUsd: z.number().min(0),
    minTradesPerDay: z.number().min(0).nullable().optional(),
  })
  .optional();

/**
 * Zod schema for the status of a competition.
 */
export const CompetitionStatusSchema = z.enum(competitionStatus.enumValues);

/**
 * Status of a competition.
 */
export type CompetitionStatus = z.infer<typeof CompetitionStatusSchema>;

/**
 * Zod schema for the status of an agent within a competition.
 */
export const CompetitionAgentStatusSchema = z.enum(
  competitionAgentStatus.enumValues,
);

/**
 * Status of an agent within a competition.
 */
export type CompetitionAgentStatus = z.infer<
  typeof CompetitionAgentStatusSchema
>;

/**
 * Zod schema for the status of a competition.
 */
export const CompetitionTypeSchema = z.enum(competitionType.enumValues);

/**
 * Status of a competition.
 */
export type CompetitionType = z.infer<typeof CompetitionTypeSchema>;

/**
 * Zod schema for evaluation metrics used in perps competitions.
 */
export const EvaluationMetricSchema = z.enum(evaluationMetricEnum.enumValues);

/**
 * Evaluation metrics for perps competitions.
 */
export type EvaluationMetric = z.infer<typeof EvaluationMetricSchema>;

/**
 * Zod schema for engine types
 */
export const EngineTypeSchema = z.enum(engineType.enumValues);

/**
 * Engine type for competition routing
 */
export type EngineType = z.infer<typeof EngineTypeSchema>;

/**
 * Zod schema for allocation units
 */
export const AllocationUnitSchema = z.enum(allocationUnit.enumValues);

/**
 * Allocation unit for rewards
 */
export type AllocationUnit = z.infer<typeof AllocationUnitSchema>;

/**
 * Zod schema for display states
 */
export const DisplayStateSchema = z.enum(displayState.enumValues);

/**
 * Display state for UI
 */
export type DisplayState = z.infer<typeof DisplayStateSchema>;

export const CompetitionAllowedUpdateSchema = z.strictObject({
  name: z.string().optional(),
  description: z.string().optional(),
  type: CompetitionTypeSchema.optional(),
  externalUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  boostStartDate: z.date().optional(),
  boostEndDate: z.date().optional(),
  joinStartDate: z.date().optional(),
  joinEndDate: z.date().optional(),
  maxParticipants: z.number().int().min(1).optional(),
  tradingConstraints: TradingConstraintsSchema.optional(),

  // Arena and engine routing
  arenaId: z.string().optional(),
  engineId: z.enum(engineType.enumValues).optional(),
  engineVersion: z.string().optional(),

  // Participation rules (individual columns)
  minimumStake: z.number().min(0).optional(),
  vips: z.array(z.string()).optional(),
  allowlist: z.array(z.string()).optional(),
  blocklist: z.array(z.string()).optional(),
  minRecallRank: z.number().int().optional(),
  allowlistOnly: z.boolean().optional(),

  // Reward allocation (individual columns)
  agentAllocation: z.number().optional(),
  agentAllocationUnit: z.enum(allocationUnit.enumValues).optional(),
  boosterAllocation: z.number().optional(),
  boosterAllocationUnit: z.enum(allocationUnit.enumValues).optional(),
  rewardRules: z.string().optional(),
  rewardDetails: z.string().optional(),

  /**
   * Rank-based prizes stored in competition_rewards table
   * Maps rank position to reward amount (e.g., {1: 1000, 2: 500, 3: 250})
   * Accepts JSON object with string keys (JSON limitation), transforms to Record<number, number>
   * Input from API: {"1": 1000, "2": 500} → Internal type: {1: 1000, 2: 500}
   * Rank positions are conceptually numeric, transformation provides type safety
   */
  rewards: z
    .record(z.string().regex(/^\d+$/), z.number())
    .transform((val) =>
      Object.fromEntries(
        Object.entries(val).map(([k, v]) => [parseInt(k, 10), v]),
      ),
    )
    .optional(),

  // Display state
  displayState: z.enum(displayState.enumValues).optional(),
});

export type CompetitionAllowedUpdate = z.infer<
  typeof CompetitionAllowedUpdateSchema
>;

/**
 * Query string parameters that handle sorting and pagination
 */
export const PagingParamsSchema = z.object({
  sort: z.string().default(""),
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

export type PagingParams = z.infer<typeof PagingParamsSchema>;

/**
 * Query string parameters for competition agents endpoint
 */
export const CompetitionAgentsParamsSchema = z.object({
  filter: z.string().optional(),
  sort: z.string().default("rank"),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((val) => (val === "true" ? true : false)),
});

export type CompetitionAgentsParams = z.infer<
  typeof CompetitionAgentsParamsSchema
>;

/**
 * Get agents filter values, it can be any string, but the query will be name or wallet address
 */
export const AgentFilterSchema = z.string().max(100);

export type AgentFilter = z.infer<typeof AgentFilterSchema>;

/**
 * Competition join/leave URL parameters schema
 */
export const CompetitionAgentParamsSchema = z.object({
  competitionId: z.uuid("Invalid competition ID format"),
  agentId: z.uuid("Invalid agent ID format"),
});

export type CompetitionAgentParams = z.infer<
  typeof CompetitionAgentParamsSchema
>;

/**
 * Filter parameters for agent competitions (without pagination)
 */
export const AgentCompetitionsFiltersSchema = z.object({
  status: z.optional(CompetitionStatusSchema),
  claimed: z.optional(z.boolean()),
});

export type AgentCompetitionsFilters = z.infer<
  typeof AgentCompetitionsFiltersSchema
>;

/**
 * Combined parameters for agent competitions (filters + pagination)
 */
export const AgentCompetitionsParamsSchema = z.intersection(
  PagingParamsSchema,
  AgentCompetitionsFiltersSchema,
);

export type AgentCompetitionsParams = z.infer<
  typeof AgentCompetitionsParamsSchema
>;

/**
 * Update user profile parameters schema
 */
export const UpdateUserProfileBodySchema = z
  .object({
    name: z
      .string("Invalid name format")
      .trim()
      .min(1, { message: "Name must be at least 1 character" })
      .optional(),
    imageUrl: z.url("Invalid image URL format").optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/**
 * Update user profile parameters schema
 */
export const UpdateUserProfileSchema = z
  .object({
    userId: z.uuid("Invalid user ID format"),
    body: UpdateUserProfileBodySchema,
  })
  .strict();

/**
 * Agent handle validation schema
 */
export const AgentHandleSchema = z
  .string()
  .trim()
  .min(MIN_HANDLE_LENGTH, {
    message: `Handle must be at least ${MIN_HANDLE_LENGTH} characters`,
  })
  .max(MAX_HANDLE_LENGTH, {
    message: `Handle must be at most ${MAX_HANDLE_LENGTH} characters`,
  })
  .regex(new RegExp(`^[a-z0-9_]+$`), {
    message:
      "Handle can only contain lowercase letters, numbers, and underscores",
  });

/**
 * Create agent parameters schema
 */
export const CreateAgentBodySchema = z
  .object({
    name: z
      .string("Invalid name format")
      .trim()
      .min(1, { message: "Name is required" })
      .max(100, { message: "Name must be 100 characters or less" }),
    handle: AgentHandleSchema,
    description: z
      .string("Invalid description format")
      .trim()
      .min(1, { message: "Description must be at least 1 character" })
      .optional(),
    imageUrl: z.url("Invalid image URL format").optional(),
    email: z.email("Invalid email format").optional(),
    metadata: AgentMetadataSchema.optional(),
  })
  .strict();

/**
 * Create agent parameters schema
 */
export const CreateAgentSchema = z
  .object({
    userId: z.uuid("Invalid user ID format"),
    body: CreateAgentBodySchema,
  })
  .strict();

/**
 * Update user's agent profile parameters schema
 */
export const UpdateUserAgentProfileBodySchema = z
  .object({
    name: z
      .string("Invalid name format")
      .trim()
      .min(1, { message: "Name must be at least 1 character" })
      .max(100, { message: "Name must be 100 characters or less" })
      .optional(),
    handle: AgentHandleSchema.optional(),
    description: z
      .string("Invalid description format")
      .trim()
      .min(1, { message: "Description must be at least 1 character" })
      .optional(),
    imageUrl: z.url("Invalid image URL format").optional(),
    email: z.email("Invalid email format").optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/**
 * Update user's agent profile parameters schema
 */
export const UpdateUserAgentProfileSchema = z
  .object({
    userId: z.uuid("Invalid user ID format"),
    agentId: z.uuid("Invalid agent ID format"),
    body: UpdateUserAgentProfileBodySchema,
  })
  .strict();

/**
 * Update agent profile (from an non-user request) parameters schema
 */
export const UpdateAgentProfileBodySchema = z
  .object({
    description: z
      .string("Invalid description format")
      .trim()
      .min(1, { message: "Description must be at least 1 character" })
      .optional(),
    imageUrl: z.url("Invalid image URL format").optional(),
  })
  .strict();

/**
 * Update agent profile (from an non-user request) parameters schema
 */
export const UpdateAgentProfileSchema = z
  .object({
    agentId: z.uuid("Invalid agent ID format"),
    body: UpdateAgentProfileBodySchema,
  })
  .strict();

/**
 * Get agent parameters schema
 */
export const GetUserAgentSchema = z
  .object({
    userId: z.uuid("Invalid user ID format"),
    agentId: z.uuid("Invalid agent ID format"),
  })
  .strict();

/**
 * UUID parameter schema
 */
export const UuidSchema = z.uuid("Invalid uuid");

/**
 * Supported sort fields for global leaderboard
 */
export const LEADERBOARD_SORT_FIELDS = [
  "rank",
  "-rank",
  "name",
  "-name",
  "competitions",
  "-competitions",
] as const;

/**
 * Query string parameters for global leaderboard rankings
 */
export const LeaderboardParamsSchema = z.object({
  type: CompetitionTypeSchema.default("trading"),
  arenaId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type LeaderboardParams = z.infer<typeof LeaderboardParamsSchema>;

/**
 * Structure for an agent entry in the global leaderboard
 */
export interface LeaderboardAgent
  extends Pick<
    Agent,
    "id" | "name" | "handle" | "description" | "imageUrl" | "metadata"
  > {
  rank: number;
  score: number;
  numCompetitions: number;
}

/**
 * Base enriched leaderboard entry for spot trading competitions
 */
export interface BaseEnrichedLeaderboardEntry {
  agentId: string;
  competitionId: string;
  rank: number;
  pnl: number;
  startingValue: number;
  totalAgents: number;
  score: number;
  hasRiskMetrics: false;
}

/**
 * Enriched leaderboard entry for perps competitions with risk metrics
 */
export interface PerpsEnrichedLeaderboardEntry {
  agentId: string;
  competitionId: string;
  rank: number;
  pnl: number;
  startingValue: number;
  totalAgents: number;
  score: number;
  calmarRatio: number | null;
  sortinoRatio: number | null;
  simpleReturn: number | null;
  maxDrawdown: number | null;
  downsideDeviation: number | null;
  totalEquity: number;
  totalPnl: number | null;
  hasRiskMetrics: true;
}

/**
 * Union type for enriched leaderboard entries
 */
export type EnrichedLeaderboardEntry =
  | BaseEnrichedLeaderboardEntry
  | PerpsEnrichedLeaderboardEntry;

/**
 * Type guard to check if an enriched entry is a perps entry with risk metrics
 */
export function isPerpsEnrichedEntry(
  entry: EnrichedLeaderboardEntry,
): entry is PerpsEnrichedLeaderboardEntry {
  return entry.hasRiskMetrics === true;
}

/**
 * Admin create agent schema
 */
export const AdminCreateAgentSchema = z.object({
  user: z
    .object({
      id: z.uuid().optional(),
      walletAddress: z
        .string()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .optional(),
    })
    .refine((d) => (d.id ? !d.walletAddress : !!d.walletAddress), {
      message: "Must provide either user ID or user wallet address",
    }),
  agent: z.object({
    name: z
      .string()
      .max(100, { message: "Name must be 100 characters or less" }),
    handle: AgentHandleSchema.optional(),
    email: z.string().optional(),
    walletAddress: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    metadata: AgentMetadataSchema.optional(),
  }),
});

export type AdminCreateAgent = z.infer<typeof AdminCreateAgentSchema>;

/**
 * User search parameters schema
 */
export const UserSearchParamsSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  walletAddress: z.string().optional(),
  status: ActorStatusSchema.optional(),
});

export type UserSearchParams = z.infer<typeof UserSearchParamsSchema>;

/**
 * Agent search parameters schema
 */
export const AgentSearchParamsSchema = z.object({
  name: z.string().optional(),
  handle: z.string().optional(),
  ownerId: z.string().optional(),
  walletAddress: z.string().optional(),
  status: ActorStatusSchema.optional(),
});

export type AgentSearchParams = z.infer<typeof AgentSearchParamsSchema>;

/**
 * Admin search users and agents query parameters schema
 */
export const AdminSearchUsersAndAgentsQuerySchema = z.strictObject({
  user: UserSearchParamsSchema.strict().optional(),
  agent: AgentSearchParamsSchema.strict().optional(),
  join: z.preprocess((val) => {
    if (val === "") return true; // Note: allows for bare `join` instead of only `join=true`
    if (typeof val === "string") {
      if (val.toLowerCase() === "true") return true;
      if (val.toLowerCase() === "false") return false;
    }
    return val;
  }, z.boolean().default(false)),
});

export type AdminSearchUsersAndAgentsQuery = z.infer<
  typeof AdminSearchUsersAndAgentsQuerySchema
>;

/**
 * Bucket parameter schema for competition timeline queries
 * Validates that bucket is between 1 and 1440 minutes (24 hours)
 */
export const BucketParamSchema = z.coerce
  .number()
  .int("Bucket must be an integer")
  .min(1, "Bucket must be at least 1 minute")
  .max(1440, "Bucket must not exceed 1440 minutes (24 hours)")
  .default(30);

export type BucketParam = z.infer<typeof BucketParamSchema>;

export const TimestampSchema = z.coerce.date();

export const SnapshotSchema = z.object({
  id: z.number(),
  competitionId: UuidSchema,
  agentId: UuidSchema,
  timestamp: TimestampSchema,
  totalValue: z.number(),
});

/**
 * Snakecase version of the snapshot schema, this is convenient for parsing raw
 * query results.
 */
export const SnapshotDbSchema = z.object({
  id: z.number(),
  competition_id: UuidSchema,
  agent_id: UuidSchema,
  timestamp: TimestampSchema,
  total_value: z.coerce.number(),
});

export const BestPlacementDbSchema = z.looseObject({
  competition_id: z.string(),
  // Note that coerce will result in 0 for "", null, and undefined
  rank: z.coerce.number(),
  total_agents: z.coerce.number(),
});

/**
 * Privy identity token parameter schema
 */
export const PrivyIdentityTokenSchema = z.string(
  "Invalid Privy identity token",
);

export type PrivyIdentityToken = z.infer<typeof PrivyIdentityTokenSchema>;

/**
 * Link wallet request schema for custom user wallet linking
 */
export const LinkUserWalletSchema = z.strictObject({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export type LinkUserWallet = z.infer<typeof LinkUserWalletSchema>;
