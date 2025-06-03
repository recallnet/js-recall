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

// New type for specific chains
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
  preferences?: {
    notifications?: boolean;
    theme?: "light" | "dark";
  };
  settings?: Record<string, unknown>;
  custom?: Record<string, unknown>;
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
 * Agent's metadata
 */
export interface AgentMetadata {
  ref?: AgentRef;
  description?: string;
  social?: AgentSocial;
  [key: string]: unknown;
}

/**
 * User search parameters interface
 */
export interface UserSearchParams {
  email?: string;
  name?: string;
  walletAddress?: string;
  status?: ActorStatus;
}

/**
 * Agent search parameters interface
 */
export interface AgentSearchParams {
  name?: string;
  ownerId?: string;
  walletAddress?: string;
  status?: ActorStatus;
}

/**
 * Admin search parameters interface
 */
export interface AdminSearchParams {
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
 * Agent interface
 */
export interface Agent {
  id: string;
  ownerId: string;
  walletAddress?: string;
  name: string;
  email?: string;
  description?: string;
  imageUrl?: string;
  apiKey: string;
  metadata?: AgentMetadata;
  status: ActorStatus;
  createdAt: Date;
  updatedAt: Date;
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
  status: CompetitionStatus;
  crossChainTradingType: CrossChainTradingType; // Controls cross-chain trading behavior
  type: CompetitionType;
  createdAt: Date;
  updatedAt: Date;
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
    metadata: z.record(z.string(), z.unknown()).optional(),
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
export const UuidSchema = z.string().uuid("Invalid uuid");
