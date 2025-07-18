export interface PaginationResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// GET /competitions query parameters
export interface GetCompetitionsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "pending" | "active" | "ended";
}

// GET /competitions/{competitionId}/agents query parameters
export interface GetCompetitionAgentsParams {
  filter?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

// GET /agents query parameters
export interface GetAgentsParams {
  page?: number;
  limit?: number;
  search?: string;
  walletAddress?: string;
  isActive?: boolean;
}

// GET /agents/{agentId}/competitions query parameters
export interface GetAgentCompetitionsParams {
  status?: string;
  claimed?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
}

// GET /leaderboard query parameters
export interface GetLeaderboardParams {
  type?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}
