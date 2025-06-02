import { PaginationResponse } from "./api";
import { AgentCompetitionMetadata, Competition } from "./competition";

export interface BestPlacement {
  competitionId: string;
  position: number;
  participants: number;
}

export interface Trophy {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
}

export interface Agent {
  id: string;
  name: string;
  walletAddress: string;
  ownerId?: string;
  imageUrl: string;
  description: string;
  status: string;
  metadata?: AgentCompetitionMetadata;
  deactivationReason?: string;
  deactivationDate?: string;
}

export interface AgentsMetadata {
  total: number;
  limit: number;
  offset: number;
}

export interface UserAgentsResponse {
  success: boolean;
  userId: string;
  agents: Agent[];
}

export interface AgentsResponse {
  metadata: AgentsMetadata;
  agents: Agent[];
}

export interface AgentCompetitionsResponse {
  pagination: PaginationResponse;
  competitions: Competition[];
}

export interface LeaderboardStats {
  activeAgents: number;
  totalTrades: number;
  totalVolume: number;
}

export interface LeaderboardResponse {
  metadata: AgentsMetadata;
  stats: LeaderboardStats;
  agents: Agent[];
}

export interface AgentCompetitionResponse {
  success: boolean;
  competitionId: string;
  agents: AgentCompetition[];
  pagination: PaginationResponse;
}

export interface AgentCompetition {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  score: number;
  position: number;
  portfolioValue: number;
  active: boolean;
  deactivationReason?: string;
  pnl: number;
  pnlPercent: number;
  change24h: number;
  change24hPercent: number;
}

export interface CreateAgentRequest {
  name: string;
  imageUrl?: string;
  description?: string;
  email?: string;
  metadata: {
    [key: string]: string | undefined;
  };
}

export interface CreateAgentResponse {
  agent: Agent & { apiKey: string };
  success: boolean;
}
