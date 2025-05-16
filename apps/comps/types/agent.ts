import {
  AgentCompetitionMetadata,
  CompetitionResponse,
  Reward,
} from "./competition";

export interface User {
  address: string;
  loggedIn: boolean;
}

export interface BestPlacement {
  competitionId: string;
  position: number;
  participants: number;
}

export interface AgentStats {
  eloAvg: number;
  bestPlacement?: BestPlacement;
  completedCompetitions: number;
  provenSkills: string[];
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
  userId?: string;
  imageUrl: string;
  metadata: AgentCompetitionMetadata;
  stats?: AgentStats;
  trophies?: Trophy[];
  skills: string[];
  hasUnclaimedRewards?: boolean;
  score?: number;
  rewards?: Reward[];
  apiKey: string;
  registeredCompetitionIds: string[];
}

export interface AgentsMetadata {
  total: number;
  limit: number;
  offset: number;
}

export interface AgentsResponse {
  metadata: AgentsMetadata;
  agents: AgentResponse[];
}

export interface AgentCompetitionsResponse {
  metadata: AgentsMetadata;
  competitions: CompetitionResponse[];
}

export interface LeaderboardStats {
  activeAgents: number;
  totalTrades: number;
  totalVolume: number;
}

export interface LeaderboardResponse {
  metadata: AgentsMetadata;
  stats: LeaderboardStats;
  agents: LeaderboardAgent[];
}

export interface Agent extends AgentResponse {}
export interface LeaderboardAgent extends AgentResponse {
  rank: number;
}

export interface CreateAgentRequest {
  name: string;
  imageUrl?: string;
  walletAddress: string;
  skills: string[];
  description?: string;
  email?: string;
  repositoryUrl?: string;
  metadata: {
    [key: string]: string;
  };
}

export interface CreateAgentResponse {
  agentId: string;
  apiKey: string;
}
