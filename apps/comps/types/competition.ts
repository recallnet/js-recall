import {Agent} from "./agent";
import {PaginationResponse} from "./api";
import {CompetitionStatus, CrossChainTradingType} from "./enums";

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
    totalTrades: number;
    totalAgents: number;
    totalVolume: number;
    totalVotes: number;
    uniqueTokens: number;
  };
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
  totalTrades?: number;
  bestPlacement?: {
    rank?: number;
    totalAgents?: number;
  };
  rewards?: {
    rank: number;
    reward: number;
    agentId?: string;
  }[];
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
