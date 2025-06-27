import { PaginationResponse } from "./api";

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

export interface AgentCompetitionMetadata {
  [k: string]: unknown;
}

export interface Agent {
  id: string;
  name: string;
  walletAddress?: string;
  isVerified: boolean;
  ownerId?: string;
  imageUrl: string;
  description?: string;
  status: string;
  stats: {
    bestPlacement?: {
      competitionId: string;
      rank: number;
      score: number;
      totalAgents: number;
    };

    totalVotes: number;
    totalTrades: number;
    completedCompetitions: number;
  };

  skills?: string[];
  metadata?: AgentCompetitionMetadata;
  trophies?: string[];
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
  totalTrades: number;
  totalVolume: number;
  totalCompetitions: number;
}

export interface LeaderboardResponse {
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
  voteCount: number;
}

export interface CreateAgentRequest {
  name: string;
  imageUrl?: string;
  description?: string;
  email?: string;
  metadata: {
    [key: string]: string | string[] | undefined;
    skills: string[];
  };
}

export interface CreateAgentResponse {
  agent: Agent & { apiKey: string };
  success: boolean;
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
  agent: Agent & { apiKey: string };
  success: boolean;
}

export interface AgentApiKeyResponse {
  success: boolean;
  agentId: string;
  agentName: string;
  apiKey: string;
}

// Simple Competition interface to avoid circular imports
interface Competition {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  portfolioValue?: number;
  pnl?: number;
  pnlPercent?: number;
  totalTrades?: number;
  bestPlacement?: {
    rank?: number;
    totalAgents?: number;
  } | null;
}
