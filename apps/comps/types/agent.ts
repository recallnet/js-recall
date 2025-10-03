import { PaginationResponse } from "./api";
import { AgentCompetitionMetadata, Competition } from "./competition";

export interface BestPlacement {
  competitionId: string;
  rank: number;
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
  handle: string;
  walletAddress?: string;
  isVerified: boolean;
  ownerId?: string;
  imageUrl?: string;
  description?: string;
  email?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    bestPlacement?: {
      competitionId: string;
      rank: number;
      score: number;
      totalAgents: number;
    };
    bestPnl?: number;
    totalVotes: number;
    totalTrades: number;
    completedCompetitions: number;
    score?: number;
    totalRoi?: number;
    rank?: number;
    totalPositions: number;
  };

  skills?: string[];
  metadata?: AgentCompetitionMetadata;
  trophies?: unknown[];
  hasUnclaimedRewards?: boolean;
  deactivationReason?: string;
  deactivationDate?: string;
}

export interface AgentWithOwnerResponse {
  success: boolean;
  agent: Agent;
  owner: {
    id: string;
    name: string;
    walletAddress: string;
  };
}

export interface LeaderboardAgent extends Agent {
  // TODO: the actual response is a subset of the `Agent` type
  // id: string;
  // name: string;
  // metadata: AgentCompetitionMetadata;
  rank: number;
  score: number;
  voteCount: number;
  numCompetitions: number;
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
  totalCompetitions: number;
  totalTrades: number;
  totalVolume: number;
  totalVotes: number;
}

export interface LeaderboardResponse {
  success?: boolean; // Optional to handle both API response and direct data
  stats: LeaderboardStats;
  agents: LeaderboardAgent[];
  pagination: PaginationResponse;
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
  handle: string;
  description: string;
  imageUrl: string;
  score: number;
  rank: number;
  portfolioValue: number;
  active: boolean;
  deactivationReason?: string;
  pnl: number;
  pnlPercent: number;
  change24h: number;
  change24hPercent: number;
  voteCount: number;
  // Risk metrics (returned by backend for perps competitions)
  calmarRatio?: number | null;
  simpleReturn?: number | null;
  maxDrawdown?: number | null;
  hasRiskMetrics?: boolean;
}

export interface CreateAgentRequest {
  name: string;
  handle: string;
  imageUrl?: string;
  description?: string;
  email?: string;
  metadata: {
    [key: string]: string | string[] | undefined;
    skills: string[];
  };
}

export interface CreateAgentResponse {
  agent: Omit<Agent, "stats" | "skills" | "trophies" | "hasUnclaimedRewards">;
}

export interface UpdateAgentRequest {
  agentId: string;
  params: {
    name?: string;
    description?: string;
    imageUrl?: string;
    email?: string;
    metadata?: {
      [key: string]: string | string[] | undefined;
    };
  };
}

export interface UpdateAgentResponse {
  agent: Omit<Agent, "stats" | "skills" | "trophies" | "hasUnclaimedRewards">;
}

export interface AgentApiKeyResponse {
  agentId: string;
  agentName: string;
  agentHandle: string;
  apiKey: string;
}
