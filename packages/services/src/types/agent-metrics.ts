import type { AgentPublic, AgentStats, AgentTrophy } from "./index.js";

// Re-export for convenience
export type { AgentPublic } from "./index.js";

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

  /** Trade counts per agent (paper trading) */
  tradeCounts: Array<{
    agentId: string;
    totalTrades: number;
  }>;

  /** Position counts per agent (perpetual futures) */
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

/**
 * Transformed agent metrics data ready for service layer consumption
 * This is the processed version of RawAgentMetricsQueryResult
 *
 * Note: This type uses `null` for missing values following database conventions,
 * where NULL represents the absence of data. This differs from the public API
 * schema (AgentStats) which uses `undefined` for optional fields to minimize
 * JSON payload size and follow REST best practices.
 */
export interface AgentMetricsData {
  agentId: string;
  completedCompetitions: number;
  totalTrades: number;
  totalPositions: number;
  bestPlacement: {
    competitionId: string;
    rank: number;
    score: number;
    totalAgents: number;
  } | null;
  bestPnl: number | null;
  totalRoi: number | null;
  globalRank: number | null;
  globalScore: number | null;
}

/**
 * Enhanced agent with all metrics attached
 * This is the final output format for API responses
 */
export interface AgentWithMetrics extends AgentPublic {
  stats: AgentStats;
  trophies: AgentTrophy[];
  skills: string[];
  hasUnclaimedRewards: boolean;
}

/**
 * Raw trophy query result from repository layer
 */
export interface RawAgentTrophyResult {
  agentId: string;
  trophies: AgentTrophy[];
}
