import {
  and,
  countDistinct,
  count as drizzleCount,
  eq,
  inArray,
  sum,
} from "drizzle-orm";

import { db } from "@/database/db.js";
import {
  agents,
  competitionAgents,
  competitions,
  votes,
} from "@/database/schema/core/defs.js";
import { trades } from "@/database/schema/trading/defs.js";
import {
  ACTOR_STATUS,
  COMPETITION_STATUS,
  CompetitionType,
} from "@/types/index.js";

/**
 * Leaderboard Repository
 * Handles database operations for leaderboards
 */

/**
 * Get global statistics for a specific competition type across all relevant competitions.
 * Relevant competitions are those with status 'active' or 'ended'.
 * @param type The type of competition (e.g., 'trading')
 * @returns Object containing the total number of active agents, trades, volume,
 * competitions, and competition IDs for active or ended competitions.
 */
export async function getGlobalStats(type: CompetitionType): Promise<{
  activeAgents: number;
  totalTrades: number;
  totalVolume: number;
  totalCompetitions: number;
  totalVotes: number;
  competitionIds: string[];
}> {
  console.log("[CompetitionRepository] getGlobalStats called for type:", type);

  // Filter competitions by `type` and `status` IN ['active', 'ended'].
  const relevantCompetitions = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(
      and(
        eq(competitions.type, type),
        inArray(competitions.status, [
          COMPETITION_STATUS.ACTIVE,
          COMPETITION_STATUS.ENDED,
        ]),
      ),
    );

  if (relevantCompetitions.length === 0) {
    return {
      activeAgents: 0,
      totalTrades: 0,
      totalVolume: 0,
      totalCompetitions: 0,
      totalVotes: 0,
      competitionIds: [],
    };
  }

  const relevantCompetitionIds = relevantCompetitions.map((c) => c.id);

  // Count distinct active agents participating in these competitions.
  const activeAgentsResult = await db
    .select({ count: countDistinct(competitionAgents.agentId) })
    .from(competitionAgents)
    .innerJoin(agents, eq(competitionAgents.agentId, agents.id))
    .where(
      and(
        inArray(competitionAgents.competitionId, relevantCompetitionIds),
        eq(agents.status, ACTOR_STATUS.ACTIVE),
      ),
    );

  // Sum up total trades and total volume from these competitions.
  const tradeStatsResult = await db
    .select({
      totalTrades: drizzleCount(trades.id),
      totalVolume: sum(trades.tradeAmountUsd).mapWith(Number),
    })
    .from(trades)
    .where(inArray(trades.competitionId, relevantCompetitionIds));

  const voteStatsResult = await db
    .select({
      totalVotes: drizzleCount(votes.id),
    })
    .from(votes)
    .where(inArray(votes.competitionId, relevantCompetitionIds));

  return {
    activeAgents: activeAgentsResult[0]?.count ?? 0,
    totalTrades: tradeStatsResult[0]?.totalTrades ?? 0,
    totalVolume: tradeStatsResult[0]?.totalVolume ?? 0,
    totalCompetitions: relevantCompetitions.length,
    totalVotes: voteStatsResult[0]?.totalVotes ?? 0,
    competitionIds: relevantCompetitionIds,
  };
}
