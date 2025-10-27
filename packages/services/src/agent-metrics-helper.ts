import { Decimal } from "decimal.js";

import type { RawAgentMetricsQueryResult } from "@recallnet/db/repositories/types";

import type {
  AgentMetricsData,
  AgentPublic,
  AgentRankByType,
  AgentWithMetrics,
} from "./types/agent-metrics.js";
import type { AgentMetadata, AgentStats, AgentTrophy } from "./types/index.js";

/**
 * Helper class for transforming and processing agent metrics
 * Encapsulates business logic for metrics calculations and transformations
 *
 * This class handles the conversion between different representations of agent metrics:
 * 1. RawAgentMetricsQueryResult - Raw database query results
 * 2. AgentMetricsData - Internal service layer representation (uses null for missing values)
 * 3. AgentStats - Public API schema (uses undefined for optional fields)
 *
 * The separation allows us to follow database conventions internally while
 * providing clean, minimal JSON responses to API clients.
 */
export class AgentMetricsHelper {
  /**
   * Transform raw database query results into structured agent metrics data
   * @param agentIds List of agent IDs to process
   * @param rawResults Raw query results from repository layer
   * @returns Array of transformed agent metrics
   */
  static transformRawMetricsToAgentMetrics(
    agentIds: string[],
    rawResults: RawAgentMetricsQueryResult,
  ): AgentMetricsData[] {
    // Create lookup maps for efficient access
    const competitionCountsMap = new Map(
      rawResults.competitionCounts.map((row) => [
        row.agentId,
        row.completedCompetitions,
      ]),
    );

    const tradeCountsMap = new Map(
      rawResults.tradeCounts.map((row) => [row.agentId, row.totalTrades]),
    );

    const positionCountsMap = new Map(
      rawResults.positionCounts.map((row) => [row.agentId, row.totalPositions]),
    );

    const bestPlacementMap = new Map<
      string,
      {
        competitionId: string;
        rank: number;
        score: number;
        totalAgents: number;
      }
    >(
      rawResults.bestPlacements.map((row) => [
        row.agentId,
        {
          competitionId: row.competitionId,
          rank: row.rank,
          score: row.score,
          totalAgents: row.totalAgents,
        },
      ]),
    );

    const bestPnlMap = new Map<
      string,
      {
        competitionId: string;
        pnl: number;
      }
    >(
      rawResults.bestPnls.map((row) => [
        row.agentId,
        {
          competitionId: row.competitionId,
          pnl: row.pnl,
        },
      ]),
    );

    // Build ranks map for each agent (ranks now calculated in SQL)
    const agentRanksMap = new Map<string, AgentRankByType[]>();

    rawResults.agentRanks.forEach((rankData) => {
      if (!agentRanksMap.has(rankData.agentId)) {
        agentRanksMap.set(rankData.agentId, []);
      }

      agentRanksMap.get(rankData.agentId)!.push({
        type: rankData.type,
        rank: rankData.rank,
        score: rankData.ordinal,
      });
    });

    // Calculate total ROI with business logic
    const totalRoiMap = new Map(
      rawResults.totalRois.map((row) => {
        if (!row.totalPnl || !row.totalStartingValue) {
          return [row.agentId, null];
        }
        try {
          const totalPnl = new Decimal(row.totalPnl);
          const totalStartingValue = new Decimal(row.totalStartingValue);
          if (totalStartingValue.lessThanOrEqualTo(0)) {
            return [row.agentId, null];
          }
          const roiPercent = totalPnl.dividedBy(totalStartingValue).toNumber();
          return [row.agentId, roiPercent];
        } catch {
          return [row.agentId, null];
        }
      }),
    );

    // Combine all data for each agent
    return agentIds.map((agentId) => {
      const ranks = agentRanksMap.get(agentId) ?? [];

      return {
        agentId,
        completedCompetitions: competitionCountsMap.get(agentId) ?? 0,
        totalTrades: tradeCountsMap.get(agentId) ?? 0,
        totalPositions: positionCountsMap.get(agentId) ?? 0,
        bestPlacement: bestPlacementMap.get(agentId) ?? null,
        bestPnl: bestPnlMap.get(agentId)?.pnl ?? null,
        totalRoi: totalRoiMap.get(agentId) ?? null,
        ranks,
      };
    });
  }

  /**
   * Transform raw metrics data into AgentStats format
   *
   * This method converts between two similar but intentionally different types:
   * - AgentMetricsData: Internal service layer type that uses `null` for missing values
   *   (following database conventions where NULL represents absence of data)
   * - AgentStats: Public API schema that uses `undefined` for optional fields
   *   (following REST/JSON best practices where missing fields are omitted)
   *
   * The transformation from null -> undefined ensures that API responses don't include
   * null-valued fields, keeping payloads smaller and cleaner for clients.
   *
   * @param metrics Processed metrics data from the service layer
   * @returns AgentStats object conforming to the public API schema
   */
  static transformToStats(metrics: AgentMetricsData): AgentStats {
    return {
      completedCompetitions: metrics.completedCompetitions,
      totalTrades: metrics.totalTrades,
      totalPositions: metrics.totalPositions,
      bestPlacement: metrics.bestPlacement ?? undefined,
      totalRoi: metrics.totalRoi ?? undefined,
      bestPnl: metrics.bestPnl ?? undefined,
      ranks: metrics.ranks ?? undefined,
    };
  }

  /**
   * Attach metrics to a single agent
   * @param agent Sanitized agent data
   * @param metricsData Processed metrics data
   * @param trophies Agent trophies
   * @returns Agent with attached metrics
   */
  static attachMetricsToAgent(
    agent: AgentPublic,
    metricsData: AgentMetricsData,
    trophies: AgentTrophy[],
  ): AgentWithMetrics {
    const metadata = agent.metadata as AgentMetadata;

    return {
      ...agent,
      stats: this.transformToStats(metricsData),
      trophies,
      skills: metadata?.skills || [],
      hasUnclaimedRewards: metadata?.hasUnclaimedRewards || false,
    };
  }

  /**
   * Create empty metrics data for an agent
   * Used as fallback when no metrics are found
   * @param agentId Agent ID
   * @returns Empty metrics data
   */
  static createEmptyMetrics(agentId: string): AgentMetricsData {
    return {
      agentId,
      completedCompetitions: 0,
      totalTrades: 0,
      totalPositions: 0,
      bestPlacement: null,
      bestPnl: null,
      totalRoi: null,
      ranks: null,
    };
  }
}
