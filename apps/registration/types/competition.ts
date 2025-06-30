

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
  description?: string;
  imageUrl?: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  maxParticipants?: number;
  currentParticipants: number;
  prizePool?: string;
  rules?: string;
  metadata?: {
    website?: string;
    twitter?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionResponse {
  success: boolean;
  competition: Competition;
}

export interface CompetitionsResponse {
  success: boolean;
  competitions: Competition[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserCompetitionsResponse {
  success: boolean;
  competitions: Competition[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
