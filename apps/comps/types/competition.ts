import { CompetitionStatus } from "./enums";

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
  walletAddress?: string;
  roi?: number;
  trades?: number;
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

export interface CompetitionResponse {
  id: string;
  name: string;
  description: string;
  type: string[];
  skills: string[];
  rewards: Reward[];
  startDate: string;
  endDate: string;
  minStake: string;
  imageUrl: string;
  metadata: CompetitionMetadata;
  status: CompetitionStatus;
  registeredAgents: number;
  agentStatus: AgentStatus[];
  summary?: TradingCompetitionSummary;
}

export interface CompetitionsMetadata {
  total: number;
  limit: number;
  offset: number;
}

export interface CompetitionsResponse {
  metadata: CompetitionsMetadata;
  competitions: CompetitionResponse[];
}

export interface Competition extends CompetitionResponse {
  registeredAgentIds: string[];
}
