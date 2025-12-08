import type { RouterOutputs } from "@/rpc/router";

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

// Extract LeaderboardAgent from RPC return type
export type LeaderboardAgent =
  RouterOutputs["leaderboard"]["getGlobal"]["agents"][number];

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
}

export interface LeaderboardResponse {
  stats: LeaderboardStats;
  agents: LeaderboardAgent[];
  pagination: PaginationResponse;
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
