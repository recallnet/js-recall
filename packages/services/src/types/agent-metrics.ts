import type {
  CompetitionType,
  RawAgentMetricsQueryResult,
} from "@recallnet/db/repositories/types";

import type { AgentPublic, AgentStats, AgentTrophy } from "./index.js";

// Re-export for convenience
export type { AgentPublic } from "./index.js";
export type { RawAgentMetricsQueryResult };

/**
 * Score information for a specific competition type
 */
export interface AgentRankByType {
  type: CompetitionType;
  rank: number;
  score: number;
}

/**
 * Transformed agent metrics data ready for service layer consumption
 * This is the processed version of RawAgentMetricsQueryResult
 *
 * Note: This type uses `null` for missing values following database conventions,
 * where NULL represents the absence of data. This differs from the public API
 * schema (AgentStats) which uses `undefined` for optional fields to minimize
 * JSON payload size and follow REST best practices.
 * @param agentId Agent ID
 * @param completedCompetitions Number of competitions completed
 * @param totalTrades Number of trades
 * @param totalPositions Number of positions
 * @param bestPlacement Best placement
 * @param bestPnl Best PnL
 * @param totalRoi Total ROI
 * @param ranks Ranks by competition type
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
  ranks: AgentRankByType[];
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
