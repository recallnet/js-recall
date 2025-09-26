import { Agent } from "./agent";
import { PaginationResponse } from "./api";
import { CompetitionStatus, CrossChainTradingType } from "./enums";

export interface Reward {
  name: string;
  amount: string;
  claimed?: string | null;
}

export interface CompetitionMetadata {
  discordUrl?: string;
  [k: string]: unknown;
}

export interface TradingCompetitionSummary {
  totalTrades?: number;
  volume?: string;
}

export interface AgentCompetitionMetadata {
  [k: string]: unknown;
}

export interface AgentStatus {
  agentId: string;
  name: string;
  score: number;
  rank: number;
  joinedDate: string;
  rewards: Reward[];
  metadata: {
    trades?: number;
    roi?: number;
    [k: string]: unknown;
  };
}

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  externalUrl: string | null;
  imageUrl: string | null;
  type: string;
  status: CompetitionStatus;
  crossChainTradingType: CrossChainTradingType;
  startDate: string | null;
  endDate: string | null;
  joinStartDate: string | null;
  joinEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalTrades?: number; // Only for paper trading competitions
    totalAgents: number;
    totalVolume?: number; // May not be present for all competition types
    totalVotes: number;
    uniqueTokens?: number; // Only for paper trading competitions
    totalPositions?: number; // Only for perpetual futures competitions
    averageEquity?: number; // Only for perpetual futures competitions
  };
  openForBoosting: boolean;
  votingEnabled: boolean;
  votingStartDate: string | null;
  votingEndDate: string | null;
  userVotingInfo?: {
    canVote: boolean;
    reason?: string;
    info: {
      hasVoted: boolean;
      agentId?: string;
      votedAt?: string;
    };
  };
  portfolioValue?: number;
  pnl?: number;
  pnlPercent?: number;
  totalTrades?: number; // Agent's total trades (paper trading competitions)
  totalPositions?: number; // Agent's total positions (perpetual futures competitions)
  bestPlacement?: {
    rank?: number;
    totalAgents?: number;
  };
  // Risk metrics for perpetual futures competitions
  calmarRatio?: number | null;
  simpleReturn?: number | null;
  maxDrawdown?: number | null;
  hasRiskMetrics?: boolean;
  rewards?: {
    rank: number;
    reward: number;
    agentId?: string;
  }[];
  // Registration limit fields
  maxParticipants: number | null;
  registeredParticipants: number;
}

export interface CompetitionResponse {
  success: boolean;
  competition: Competition;
}

export interface CompetitionTimelineResponse {
  success: boolean;
  competitionId: string;
  timeline: {
    agentId: string;
    agentName: string;
    timeline: {
      timestamp: string;
      totalValue: number;
    }[];
  }[];
}

export interface CompetitionsMetadata {
  total: number;
  limit: number;
  offset: number;
}

export interface CompetitionsResponse {
  pagination: PaginationResponse;
  competitions: Competition[];
}

export interface UserCompetitionsResponse {
  success: boolean;
  total: number;
  pagination: PaginationResponse;
  competitions: UserCompetition[];
}

export interface UserAgentCompetition extends Agent {
  rank: number;
}

export interface UserCompetition extends Competition {
  agents: UserAgentCompetition[];
}

export interface JoinCompetitionResponse {
  success: boolean;
  message: string;
}

export interface CompetitionRulesResponse {
  success: boolean;
  competition?: Competition; // Optional, included in response
  rules: CompetitionRules;
}

export interface CompetitionRules {
  tradingRules: string[];
  rateLimits: string[];
  availableChains: {
    svm: boolean;
    evm: string[];
  };
  slippageFormula: string;
  portfolioSnapshots: {
    interval: string;
  };
  tradingConstraints?: {
    minimumPairAgeHours: number;
    minimum24hVolumeUsd: number;
    minimumLiquidityUsd: number;
    minimumFdvUsd: number;
    minTradesPerDay?: number | null;
  };
}

export interface Trade {
  id: string;
  competitionId: string;
  agentId: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  fromTokenSymbol: string;
  toTokenSymbol: string;
  fromSpecificChain: string;
  toSpecificChain: string;
  tradeAmountUsd: number;
  timestamp: string;
  reason?: string;
  agent: {
    id: string;
    name: string;
    imageUrl: string;
    description: string;
  };
}

export interface GetCompetitionTradesParams {
  limit?: number;
  offset?: number;
}

export interface GetCompetitionPerpsPositionsParams {
  limit?: number;
  offset?: number;
  status?: string; // Optional filter: "Open", "Closed", "Liquidated"
}

export interface CompetitionTradesResponse {
  success: boolean;
  trades: Trade[];
  pagination: PaginationResponse;
}

export interface PerpsPosition {
  id: string;
  competitionId: string;
  agentId: string;
  positionId: string | null;
  marketId: string | null;
  marketSymbol: string | null;
  asset: string;
  isLong: boolean;
  leverage: number;
  size: number;
  collateral: number;
  averagePrice: number;
  markPrice: number;
  liquidationPrice: number | null;
  unrealizedPnl: number;
  pnlPercentage: number;
  realizedPnl: number;
  status?: string;
  openedAt: string;
  closedAt: string | null;
  timestamp: string;
  agent?: {
    id: string;
    name: string;
    imageUrl: string;
    handle?: string;
    description?: string;
  };
}

export interface CompetitionPerpsPositionsResponse {
  success: boolean;
  positions: PerpsPosition[];
  pagination: PaginationResponse;
}

export interface CompetitionPerpsSummaryResponse {
  success: boolean;
  competitionId: string;
  summary: {
    totalAgents: number;
    totalPositions: number;
    totalVolume: number;
    averageEquity: number;
  };
  timestamp: string;
}
