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
  position: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionResponse {
  success: boolean;
  competition: Competition;
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
