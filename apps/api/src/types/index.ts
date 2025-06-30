import { Request } from "express";
import { IronSession } from "iron-session";
import { SiweMessage } from "siwe";
import { z } from "zod/v4";

/**
 * Token information interface
 */
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  price?: number;
  lastUpdated?: Date;
}

/**
 * Blockchain type enum
 */
export enum BlockchainType {
  SVM = "svm",
  EVM = "evm",
}

// type for specific chains
export type SpecificChain =
  | "eth" // Ethereum Mainnet
  | "polygon" // Polygon
  | "bsc" // Binance Smart Chain
  | "arbitrum" // Arbitrum
  | "optimism" // Optimism
  | "avalanche" // Avalanche
  | "base" // Base
  | "linea" // Linea
  | "zksync" // zkSync Era
  | "scroll" // Scroll
  | "mantle" // Mantle
  | "svm"; // Solana (for consistency)

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
  getPrice(
    tokenAddress: string,
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<PriceReport | null>;
  supports(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): Promise<boolean>;
}

export interface PriceReport {
  token: string;
  price: number;
  timestamp: Date;
  chain: BlockchainType;
  specificChain: SpecificChain;
  symbol: string;
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
 * User's metadata interface
 */
export interface UserMetadata {
  website?: string;
  [key: string]: unknown;
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
  totalVotes: z.number(),
  bestPlacement: z
    .object({
      competitionId: z.string(),
      rank: z.number(),
      score: z.number(),
      totalAgents: z.number(),
    })
    .optional(),
  rank: z.number().optional(),
  score: z.number().optional(),
});

export type AgentStats = z.infer<typeof AgentStatsSchema>;

/**
 * Agent's metadata
 */
export const AgentMetadataSchema = z.looseObject({
  stats: AgentStatsSchema.optional(),
  skills: z.array(z.string()).optional(),
  trophies: z.array(z.string()).optional(),
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
  name?: string;
  email?: string;
  imageUrl?: string;
  metadata?: UserMetadata;
  status: ActorStatus;
  createdAt: Date;
  updatedAt: Date;
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
 * Cross-chain trading types values for zod or database enum.
 */
export const CROSS_CHAIN_TRADING_TYPE_VALUES = [
  "disallowAll",
  "disallowXParent",
  "allow",
] as const;

/**
 * Cross-chain trading types values.
 */
export const CROSS_CHAIN_TRADING_TYPE = {
  DISALLOW_ALL: "disallowAll",
  DISALLOW_X_PARENT: "disallowXParent",
  ALLOW: "allow",
} as const;

/**
 * Zod schema for the cross-chain trading type.
 */
export const CrossChainTradingTypeSchema = z.enum(
  CROSS_CHAIN_TRADING_TYPE_VALUES,
);

/**
 * Cross-chain trading type.
 */
export type CrossChainTradingType = z.infer<typeof CrossChainTradingTypeSchema>;

/**
 * Competition interface
 */
export interface Competition {
  id: string;
  name: string;
  description?: string;
  externalUrl?: string;
  imageUrl?: string;
  startDate: Date | null;
  endDate: Date | null;
  votingStartDate: Date | null;
  votingEndDate: Date | null;
  status: CompetitionStatus;
  crossChainTradingType: CrossChainTradingType; // Controls cross-chain trading behavior
  sandboxMode: boolean; // Controls automatic agent joining behavior
  type: CompetitionType;
  createdAt: Date;
  updatedAt: Date;
}

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
  // Agent-specific metrics
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
 * Agent's portfolio value
 */
export interface PortfolioValue {
  agentId: string;
  competitionId: string;
  timestamp: Date;
  totalValue: number;
  valuesByToken: Record<string, { amount: number; valueUsd: number }>;
}

/**
 * API Key authentication information
 */
export interface ApiAuth {
  agentId: string;
  key: string;
}

/**
 * Extended Request interface for authenticated requests
 */
export interface AuthenticatedRequest extends Request {
  session?: IronSession<SessionData>;
  agentId?: string;
  userId?: string;
  adminId?: string;
  wallet?: string;
  isAdmin?: boolean;
  admin?: {
    id: string;
    name: string;
  };
}

/**
 * Session data interface
 */
export interface SessionData {
  nonce?: string;
  siwe?: SiweMessage;
  agentId?: string;
  userId?: string;
  adminId?: string;
  wallet?: string;
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
 * Actor (user, agent, admin) status values for zod or database enum.
 */
export const ACTOR_STATUS_VALUES = [
  "active",
  "inactive",
  "suspended",
  "deleted",
] as const;

/**
 * Actor (user, agent, admin) statuses.
 */
export const ACTOR_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  DELETED: "deleted",
} as const;

/**
 * Zod schema for the status of a user, agent, or admin.
 */
export const ActorStatusSchema = z.enum(ACTOR_STATUS_VALUES);

/**
 * Status of a user, agent, or admin.
 */
export type ActorStatus = z.infer<typeof ActorStatusSchema>;

/**
 * Agent information Object
 */
export const AgentSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
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
 * Pulic Agent information Object, omits apiKey
 */
export const AgentPublicSchema = AgentSchema.omit({ apiKey: true }).extend({
  isVerified: z.boolean(),
});
export type AgentPublic = z.infer<typeof AgentPublicSchema>;

/**
 * Competition status values for zod or database enum.
 */
export const COMPETITION_STATUS_VALUES = [
  "pending",
  "active",
  "ended",
] as const;

/**
 * Competition statuses.
 */
export const COMPETITION_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  ENDED: "ended",
} as const;

/**
 * Zod schema for the status of a competition.
 */
export const CompetitionStatusSchema = z.enum(COMPETITION_STATUS_VALUES);

/**
 * Status of a competition.
 */
export type CompetitionStatus = z.infer<typeof CompetitionStatusSchema>;

/**
 * Competition agent status values for zod or database enum.
 */
export const COMPETITION_AGENT_STATUS_VALUES = [
  "active",
  "withdrawn",
  "disqualified",
] as const;

/**
 * Competition agent statuses.
 */
export const COMPETITION_AGENT_STATUS = {
  ACTIVE: "active",
  WITHDRAWN: "withdrawn",
  DISQUALIFIED: "disqualified",
} as const;

/**
 * Zod schema for the status of an agent within a competition.
 */
export const CompetitionAgentStatusSchema = z.enum(
  COMPETITION_AGENT_STATUS_VALUES,
);

/**
 * Status of an agent within a competition.
 */
export type CompetitionAgentStatus = z.infer<
  typeof CompetitionAgentStatusSchema
>;

/**
 * Competition status values for zod or database enum.
 */
export const COMPETITION_TYPE_VALUES = ["trading"] as const;

/**
 * Competition statuses.
 */
export const COMPETITION_TYPE = {
  TRADING: "trading",
} as const;

/**
 * Zod schema for the status of a competition.
 */
export const CompetitionTypeSchema = z.enum(COMPETITION_TYPE_VALUES);

/**
 * Status of a competition.
 */
export type CompetitionType = z.infer<typeof CompetitionTypeSchema>;

/**
 * Sync data type values for zod or database enum.
 */
export const SYNC_DATA_TYPE_VALUES = [
  "trade",
  "agent_rank_history",
  "agent_rank",
  "competitions_leaderboard",
  "portfolio_snapshot",
] as const;

/**
 * Sync data types.
 */
export const SYNC_DATA_TYPE = {
  TRADE: "trade",
  AGENT_RANK_HISTORY: "agent_rank_history",
  AGENT_RANK: "agent_rank",
  COMPETITIONS_LEADERBOARD: "competitions_leaderboard",
  PORTFOLIO_SNAPSHOT: "portfolio_snapshot",
} as const;

/**
 * Zod schema for sync data types.
 */
export const SyncDataTypeSchema = z.enum(SYNC_DATA_TYPE_VALUES);

/**
 * Sync data type.
 */
export type SyncDataType = z.infer<typeof SyncDataTypeSchema>;

export const CompetitionAllowedUpdateSchema = z.strictObject({
  name: z.string().optional(),
  description: z.string().optional(),
  type: CompetitionTypeSchema.optional(),
  externalUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  votingStartDate: z.date().optional(),
  votingEndDate: z.date().optional(),
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
  sort: z.string().default("position"),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
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

export const AgentCompetitionsParamsSchema = PagingParamsSchema.extend({
  status: z.optional(CompetitionStatusSchema),
  claimed: z.optional(z.boolean()),
});

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
    email: z.email("Invalid email format").optional(),
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
 * Create agent parameters schema
 */
export const CreateAgentBodySchema = z
  .object({
    name: z
      .string("Invalid name format")
      .trim()
      .min(1, { message: "Name is required" }),
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
      .optional(),
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
    name: z
      .string("Invalid name format")
      .trim()
      .min(1, { message: "Name must be at least 1 character" })
      .optional(),
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
  "votes",
  "-votes",
] as const;

/**
 * Query string parameters for global leaderboard rankings
 */
export const LeaderboardParamsSchema = z.object({
  type: z.enum(COMPETITION_TYPE_VALUES).default(COMPETITION_TYPE.TRADING),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  sort: z.string().optional().default("rank"), // Default to rank ascending
});

export type LeaderboardParams = z.infer<typeof LeaderboardParamsSchema>;

/**
 * Structure for an agent entry in the global leaderboard
 */
export interface LeaderboardAgent
  extends Pick<Agent, "id" | "name" | "description" | "imageUrl" | "metadata"> {
  rank: number;
  score: number;
  numCompetitions: number;
  voteCount: number;
}

// ===========================
// Vote-related types and schemas
// ===========================

/**
 * Vote interface for non-staking competition votes
 */
export interface Vote {
  id: string;
  userId: string;
  agentId: string;
  competitionId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vote request body schema for creating votes
 */
export const CreateVoteBodySchema = z
  .object({
    agentId: z.uuid("Invalid agent ID format"),
    competitionId: z.uuid("Invalid competition ID format"),
  })
  .strict();

/**
 * Create vote parameters schema (includes userId from auth)
 */
export const CreateVoteSchema = z
  .object({
    userId: z.uuid("Invalid user ID format"),
    body: CreateVoteBodySchema,
  })
  .strict();

export type CreateVoteRequest = z.infer<typeof CreateVoteSchema>;

/**
 * Vote response interface
 */
export interface VoteResponse {
  id: string;
  userId: string;
  agentId: string;
  competitionId: string;
  createdAt: Date;
}

/**
 * Agent with vote information
 */
export interface AgentWithVotes extends Agent {
  voteCount: number;
  userHasVoted?: boolean;
}

/**
 * User's vote information for a competition
 */
export interface UserVoteInfo {
  hasVoted: boolean;
  agentId?: string;
  votedAt?: Date;
}

/**
 * Competition voting status for a user
 */
export interface CompetitionVotingStatus {
  canVote: boolean;
  reason?: string; // Why voting is disabled (e.g., "Competition not started", "User already voted")
  info: UserVoteInfo;
}

/**
 * Vote count result interface
 */
export interface VoteCount {
  agentId: string;
  voteCount: number;
}

/**
 * Competition with voting information
 */
export interface CompetitionWithVotes extends Competition {
  votingEnabled: boolean; // Based on competition status
  agents: AgentWithVotes[];
  userVotingInfo?: CompetitionVotingStatus; // Only if user is authenticated
}

/**
 * Vote error types for specific error handling
 */
export const VOTE_ERROR_TYPES = {
  COMPETITION_NOT_FOUND: "COMPETITION_NOT_FOUND",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  AGENT_NOT_IN_COMPETITION: "AGENT_NOT_IN_COMPETITION",
  COMPETITION_VOTING_DISABLED: "COMPETITION_VOTING_DISABLED",
  VOTING_NOT_OPEN: "VOTING_NOT_OPEN",
  USER_ALREADY_VOTED: "USER_ALREADY_VOTED",
  VOTING_CUTOFF_EXCEEDED: "VOTING_CUTOFF_EXCEEDED",
  DUPLICATE_VOTE: "DUPLICATE_VOTE",
} as const;

export type VoteErrorType = keyof typeof VOTE_ERROR_TYPES;

/**
 * Vote error interface
 */
export interface VoteError extends Error {
  type: VoteErrorType;
  code: number;
}

/**
 * Voting state params schema for getting competition voting state
 */
export const VotingStateParamsSchema = z.object({
  competitionId: z.uuid("Invalid competition ID format"),
});

export type VotingStateParams = z.infer<typeof VotingStateParamsSchema>;

/**
 * User votes query params schema
 */
export const UserVotesParamsSchema = z.object({
  competitionId: z.uuid("Invalid competition ID format").optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type UserVotesParams = z.infer<typeof UserVotesParamsSchema>;

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
    name: z.string(),
    email: z.string().optional(),
    walletAddress: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    metadata: z.nullish(AgentMetadataSchema),
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
  searchType: z.enum(["both", "join"]).default("both"),
});

export type AdminSearchUsersAndAgentsQuery = z.infer<
  typeof AdminSearchUsersAndAgentsQuerySchema
>;
