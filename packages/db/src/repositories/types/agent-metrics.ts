/**
 * Raw query results from repository layer for bulk agent metrics
 * This represents the unprocessed data returned from database queries
 */
export interface RawAgentMetricsQueryResult {
  /** Basic agent information with global scores */
  agentRanks: Array<{
    agentId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    metadata: unknown;
    globalScore: number | null;
  }>;

  /** Competition participation counts per agent */
  competitionCounts: Array<{
    agentId: string;
    completedCompetitions: number;
  }>;

  /** Trade counts per agent */
  tradeCounts: Array<{
    agentId: string;
    totalTrades: number;
  }>;

  /** Position counts per agent (for perpetual futures competitions) */
  positionCounts: Array<{
    agentId: string;
    totalPositions: number;
  }>;

  /** Best placement data per agent */
  bestPlacements: Array<{
    agentId: string;
    competitionId: string;
    rank: number;
    score: number;
    totalAgents: number;
  }>;

  /** Best PnL data per agent */
  bestPnls: Array<{
    agentId: string;
    competitionId: string;
    pnl: number;
  }>;

  /** Total ROI raw data per agent */
  totalRois: Array<{
    agentId: string;
    totalPnl: string | null;
    totalStartingValue: string | null;
  }>;

  /** All agent scores for rank calculation - raw data from agentScore table */
  allAgentScores: Array<{
    agentId: string;
    ordinal: number | null;
  }>;
}
