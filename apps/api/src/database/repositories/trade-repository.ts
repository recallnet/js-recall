import { count, desc, eq, sql } from "drizzle-orm";

import { InsertTrade, trades } from "@recallnet/comps-db/schema";

import { BaseRepository } from "@/database/base-repository.js";

/**
 * Trade Repository
 * Handles database operations for trades
 */
export class TradeRepository extends BaseRepository {
  constructor() {
    super();
  }

  /**
   * Create a new trade
   * @param trade Trade to create
   */
  async create(trade: InsertTrade) {
    try {
      const [result] = await this.dbConn.db
        .insert(trades)
        .values(trade)
        .returning();

      if (!result) {
        throw new Error("Failed to create trade - no result returned");
      }

      return result;
    } catch (error) {
      console.error("[TradeRepository] Error in create:", error);
      throw error;
    }
  }

  /**
   * Get trades for a team
   * @param teamId Team ID
   * @param limit Optional result limit
   * @param offset Optional result offset
   */
  async getTeamTrades(teamId: string, limit?: number, offset?: number) {
    try {
      const query = this.dbConn.db
        .select()
        .from(trades)
        .where(eq(trades.teamId, teamId))
        .orderBy(desc(trades.timestamp));

      if (limit !== undefined) {
        query.limit(limit);
      }

      if (offset !== undefined) {
        query.offset(offset);
      }

      return await query;
    } catch (error) {
      console.error("[TradeRepository] Error in getTeamTrades:", error);
      throw error;
    }
  }

  /**
   * Get trades for a competition
   * @param competitionId Competition ID
   * @param limit Optional result limit
   * @param offset Optional result offset
   */
  async getCompetitionTrades(
    competitionId: string,
    limit?: number,
    offset?: number,
  ) {
    try {
      const query = this.dbConn.db
        .select()
        .from(trades)
        .where(eq(trades.competitionId, competitionId))
        .orderBy(desc(trades.timestamp));

      if (limit !== undefined) {
        query.limit(limit);
      }

      if (offset !== undefined) {
        query.offset(offset);
      }

      return await query;
    } catch (error) {
      console.error("[TradeRepository] Error in getCompetitionTrades:", error);
      throw error;
    }
  }

  /**
   * Count trades for a team
   * @param teamId Team ID
   */
  async countTeamTrades(teamId: string) {
    try {
      const [result] = await this.dbConn.db
        .select({ count: sql<number>`count(*)` })
        .from(trades)
        .where(eq(trades.teamId, teamId));

      return result?.count ?? 0;
    } catch (error) {
      console.error("[TradeRepository] Error in countTeamTrades:", error);
      throw error;
    }
  }

  /**
   * Count all trades
   */
  async count() {
    try {
      const [result] = await this.dbConn.db
        .select({ count: count() })
        .from(trades);

      return result?.count ?? 0;
    } catch (error) {
      console.error("[TradeRepository] Error in count:", error);
      throw error;
    }
  }
}
