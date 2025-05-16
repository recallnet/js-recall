// GET /competitions query parameters
export interface GetCompetitionsParams {
  status?: string;
  limit?: number;
  offset?: number;
  sort?: string;
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
  filter?: string;
  sort?: string;
  limit?: number;
  offset?: number;
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
}
