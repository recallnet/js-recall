import { z } from "zod/v4";

// Import types needed locally
import {
  type ActorStatus,
  ActorStatusSchema,
  type AgentMetadata,
  AgentMetadataSchema,
  AgentSearchParamsSchema,
  BlockchainType,
  type CompetitionStatus,
  CompetitionStatusSchema,
  type CompetitionType,
  CompetitionTypeSchema,
  PagingParamsSchema,
  type PriceReport,
  type SpecificChain,
  type TokenInfo,
  type Trade,
  TradingConstraintsSchema,
  UserSearchParamsSchema,
} from "@recallnet/contracts";
import {
  type UserMetadata,
  allocationUnit,
  displayState,
  engineType,
} from "@recallnet/db/schema/core/defs";
import { MAX_HANDLE_LENGTH } from "@recallnet/db/schema/core/defs";
import type {
  SelectAgent,
  SelectCompetition,
  SelectUser,
} from "@recallnet/db/schema/core/types";
import { evaluationMetricEnum } from "@recallnet/db/schema/trading/defs";

import { specificChainTokens } from "../lib/config-utils.js";

export * from "./sort/index.js";
export * from "./agent-metrics.js";
export * from "./perps.js";
export * from "./rpc.js";
export * from "./spot-live.js";
export * from "./unified-leaderboard.js";

// Re-export canonical types from contracts for backwards compatibility
export {
  // Chain types
  BlockchainType,
  SPECIFIC_CHAIN_NAMES,
  SpecificChainSchema,
  type SpecificChain,
  chainTypeMapping,
  getBlockchainType,
  isEvmChain,

  // Status types
  ACTOR_STATUSES,
  ActorStatusSchema,
  type ActorStatus,
  COMPETITION_STATUSES,
  CompetitionStatusSchema,
  type CompetitionStatus,
  COMPETITION_TYPES,
  CompetitionTypeSchema,
  type CompetitionType,
  COMPETITION_AGENT_STATUSES,
  CompetitionAgentStatusSchema,
  type CompetitionAgentStatus,
  CROSS_CHAIN_TRADING_TYPES,
  CrossChainTradingTypeSchema,
  type CrossChainTradingType,

  // Agent types
  AgentRankSchema,
  type AgentRank,
  BestPlacementSchema,
  type BestPlacement,
  AgentStatsSchema,
  type AgentStats,
  AgentTrophySchema,
  type AgentTrophy,
  AgentMetadataSchema,
  type AgentMetadata,
  type AgentSocial,
  type AgentRef,

  // Trading types
  TradingConstraintsSchema,
  type TradingConstraints,
  type Balance,
  type Trade,
  type TradeResult,
  type TokenPriceRequest,
  type PriceReport,
  type TokenInfo,
  type SpecificChainBalances,
  type PriceProvider,
  type CoinGeckoMode,

  // Common schemas
  UuidSchema,
  TimestampSchema,
  PagingParamsSchema,
  type PagingParams,
  SnapshotSchema,
  type Snapshot,
  SnapshotDbSchema,
  type SnapshotDb,
  BestPlacementDbSchema,
  type BestPlacementDb,
  UserSearchParamsSchema,
  type UserSearchParams,
  AgentSearchParamsSchema,
  type AgentSearchParams,
  type SearchAdminsParams,
} from "@recallnet/contracts";

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

/**
 * API Agent type (output of toApiAgent)
 */
export type ApiAgent = z.infer<typeof AgentSchema>;

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
  registeredParticipants: number;
  maxParticipants: number | null;
  portfolioValue: number;
  pnl: number;
  pnlPercent: number;
  competitionType?: CompetitionType;
  totalTrades?: number;
  totalPositions?: number;
  calmarRatio: number | null;
  simpleReturn: number | null;
  maxDrawdown: number | null;
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
 * Converts a database User object to API User format
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
 * Converts a database Agent object to API Agent format
 */
export function toApiAgent(dbAgent: SelectAgent): z.infer<typeof AgentSchema> {
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
 * Account state interface
 */
export interface AccountState {
  balances: Map<string, number>;
  trades: Trade[];
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
 * Agent type alias
 */
export type Agent = SelectAgent;

/**
 * Competition type alias
 */
export type Competition = SelectCompetition;

/**
 * Zod schema for creating a competition.
 */
export const CompetitionCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: CompetitionTypeSchema,
  externalUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
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

  // Rank-based prizes
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

export type CompetitionCreate = z.infer<typeof CompetitionCreateSchema>;

export const CompetitionAllowedUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
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
  })
  .strict();

export type CompetitionAllowedUpdate = z.infer<
  typeof CompetitionAllowedUpdateSchema
>;

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
