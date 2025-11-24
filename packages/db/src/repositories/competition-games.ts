import { and, eq } from "drizzle-orm";
import { Logger } from "pino";

import { competitionGames } from "../schema/sports/defs.js";
import {
  InsertCompetitionGame,
  SelectCompetitionGame,
} from "../schema/sports/types.js";
import { Database, Transaction } from "../types.js";

/**
 * Competition Games Repository
 * Handles database operations for linking competitions to games
 */
export class CompetitionGamesRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Link a game to a competition
   * @param data Competition-game link data
   * @param tx Optional transaction
   * @returns The created link
   */
  async create(
    data: InsertCompetitionGame,
    tx?: Transaction,
  ): Promise<SelectCompetitionGame> {
    try {
      const executor = tx || this.#db;
      const now = new Date();
      const insertData = {
        ...data,
        createdAt: data.createdAt || now,
      };

      const [result] = await executor
        .insert(competitionGames)
        .values(insertData)
        .onConflictDoNothing()
        .returning();

      if (!result) {
        const existing = await this.findByCompetitionAndGame(
          data.competitionId,
          data.gameId,
        );
        if (existing) {
          return existing;
        }
        throw new Error(
          "Failed to create competition-game link - no result returned",
        );
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in create");
      throw error;
    }
  }

  /**
   * Link multiple games to competitions
   * @param data Array of competition-game link data
   * @returns Array of created links
   */
  async createMany(
    data: InsertCompetitionGame[],
  ): Promise<SelectCompetitionGame[]> {
    try {
      if (data.length === 0) {
        return [];
      }

      const now = new Date();
      const insertData = data.map((item) => ({
        ...item,
        createdAt: item.createdAt || now,
      }));

      const results = await this.#db
        .insert(competitionGames)
        .values(insertData)
        .onConflictDoNothing()
        .returning();

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in createMany");
      throw error;
    }
  }

  /**
   * Find all games for a competition
   * @param competitionId Competition ID
   * @returns Array of game IDs
   */
  async findGameIdsByCompetitionId(competitionId: string): Promise<string[]> {
    try {
      const results = await this.#db
        .select({ gameId: competitionGames.gameId })
        .from(competitionGames)
        .where(eq(competitionGames.competitionId, competitionId));

      return results.map((r) => r.gameId);
    } catch (error) {
      this.#logger.error({ error }, "Error in findGameIdsByCompetitionId");
      throw error;
    }
  }

  /**
   * Find all competitions that include a game
   * @param gameId Game ID
   * @returns Array of competition IDs
   */
  async findCompetitionIdsByGameId(gameId: string): Promise<string[]> {
    try {
      const results = await this.#db
        .select({ competitionId: competitionGames.competitionId })
        .from(competitionGames)
        .where(eq(competitionGames.gameId, gameId));

      return results.map((r) => r.competitionId);
    } catch (error) {
      this.#logger.error({ error }, "Error in findCompetitionIdsByGameId");
      throw error;
    }
  }

  /**
   * Find a specific competition-game link
   * @param competitionId Competition ID
   * @param gameId Game ID
   * @returns The link or undefined
   */
  async findByCompetitionAndGame(
    competitionId: string,
    gameId: string,
  ): Promise<SelectCompetitionGame | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(competitionGames)
        .where(
          and(
            eq(competitionGames.competitionId, competitionId),
            eq(competitionGames.gameId, gameId),
          ),
        )
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByCompetitionAndGame");
      throw error;
    }
  }

  /**
   * Remove a game from a competition
   * @param competitionId Competition ID
   * @param gameId Game ID
   * @returns Number of rows deleted
   */
  async delete(competitionId: string, gameId: string): Promise<number> {
    try {
      const result = await this.#db
        .delete(competitionGames)
        .where(
          and(
            eq(competitionGames.competitionId, competitionId),
            eq(competitionGames.gameId, gameId),
          ),
        );

      return result.rowCount || 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in delete");
      throw error;
    }
  }
}
