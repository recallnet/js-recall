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
  teamId: string;
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
 * Social media information for a team's agent
 */
export interface AgentSocial {
  name?: string;
  email?: string;
  twitter?: string;
}

/**
 * Reference information for a team's agent
 */
export interface AgentRef {
  name: string;
  version: string;
  url?: string;
}

/**
 * Team's agent metadata
 */
export interface AgentMetadata {
  ref?: AgentRef;
  description?: string;
  social?: AgentSocial;
}

/**
 * Team interface
 */
export interface Team {
  id: string;
  name: string;
  email: string;
  contactPerson: string;
  apiKey: string;
  walletAddress: string;
  bucket_addresses?: string[];
  metadata?: AgentMetadata; // Agent-specific metadata
  imageUrl?: string; // URL to team's image
  isAdmin?: boolean;
  active?: boolean;
  deactivationReason?: string;
  deactivationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team search parameters interface
 */
export interface TeamSearchParams {
  email?: string;
  name?: string;
  walletAddress?: string;
  contactPerson?: string;
  active?: boolean;
  includeAdmins?: boolean;
}

/**
 * Competition status enum
 */
export enum CrossChainTradingType {
  disallowAll = "disallowAll",
  disallowXParent = "disallowXParent",
  allow = "allow",
}

/**
 * Competition interface
 */
export interface Competition {
  id: string;
  name: string;
  description?: string;
  externalLink?: string;
  imageUrl?: string;
  startDate: Date | null;
  endDate: Date | null;
  status: CompetitionStatus;
  crossChainTradingType: CrossChainTradingType; // Controls cross-chain trading behavior
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team's portfolio value
 */
export interface PortfolioValue {
  teamId: string;
  competitionId: string;
  timestamp: Date;
  totalValue: number;
  valuesByToken: Record<string, { amount: number; valueUsd: number }>;
}

/**
 * API Key authentication information
 */
export interface ApiAuth {
  teamId: string;
  key: string;
}

/**
 * Extended Request interface for authenticated requests
 */
export interface AuthenticatedRequest extends Request {
  session?: IronSession<SessionData>;
  teamId?: string;
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
  teamId?: string;
  wallet?: string;
}

/**
 * Login response upon successful SIWE authentication
 */
export interface LoginResponse {
  success: boolean;
  teamId?: string;
  wallet?: string;
}

// Zod definitions allow user input validation at runtime and define types

/**
 * Competition status enum
 */
export enum CompetitionStatus {
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
}
// TODO: zod discourages using typescript enums https://zod.dev/api?id=enums https://www.totaltypescript.com/why-i-dont-like-typescript-enums
export const CompetitionStatusSchema = z.enum(CompetitionStatus);

/**
 * Querystring parameters that handle sorting and pagination
 */
export const PagingParamsSchema = z.object({
    sort: z.string().default(""),
    limit: z.number().min(1).max(100).default(10),
    offset: z.number().min(0).default(0)
});

export type PagingParams = z.infer<typeof PagingParamsSchema>;
