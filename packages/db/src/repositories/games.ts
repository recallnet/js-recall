import { eq, inArray } from "drizzle-orm";
import { Logger } from "pino";

import { games } from "../schema/sports/defs.js";
import { InsertGame, SelectGame } from "../schema/sports/types.js";
import { Database } from "../types.js";

/**
 * Games Repository
 * Handles database operations for NFL games
 */
export class GamesRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Upsert a game by globalGameId
   * @param game Game data to insert or update
   * @returns The upserted game
   */
  async upsert(game: InsertGame): Promise<SelectGame> {
    try {
      const now = new Date();
      const data = {
        ...game,
        createdAt: game.createdAt || now,
        updatedAt: now,
      };

      const [result] = await this.#db
        .insert(games)
        .values(data)
        .onConflictDoUpdate({
          target: games.globalGameId,
          set: {
            gameKey: data.gameKey,
            startTime: data.startTime,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            venue: data.venue,
            status: data.status,
            updatedAt: now,
          },
        })
        .returning();

      if (!result) {
        throw new Error("Failed to upsert game - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error("Error in upsert:", error);
      throw error;
    }
  }

  /**
   * Find a game by ID
   * @param id Game ID
   * @returns The game or undefined
   */
  async findById(id: string): Promise<SelectGame | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(games)
        .where(eq(games.id, id))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error("Error in findById:", error);
      throw error;
    }
  }

  /**
   * Find a game by global game ID
   * @param globalGameId SportsDataIO global game ID
   * @returns The game or undefined
   */
  async findByGlobalGameId(
    globalGameId: number,
  ): Promise<SelectGame | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(games)
        .where(eq(games.globalGameId, globalGameId))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error("Error in findByGlobalGameId:", error);
      throw error;
    }
  }

  /**
   * Find a game by game key
   * @param gameKey SportsDataIO game key (e.g., "202510106")
   * @returns The game or undefined
   */
  async findByGameKey(gameKey: string): Promise<SelectGame | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(games)
        .where(eq(games.gameKey, gameKey))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error("Error in findByGameKey:", error);
      throw error;
    }
  }

  /**
   * Find games by IDs
   * @param ids Array of game IDs
   * @returns Array of games
   */
  async findByIds(ids: string[]): Promise<SelectGame[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      const results = await this.#db
        .select()
        .from(games)
        .where(inArray(games.id, ids));

      return results;
    } catch (error) {
      this.#logger.error("Error in findByIds:", error);
      throw error;
    }
  }

  /**
   * Update game status
   * @param id Game ID
   * @param status New status
   * @returns The updated game
   */
  async updateStatus(
    id: string,
    status: "scheduled" | "in_progress" | "final",
  ): Promise<SelectGame> {
    try {
      const [result] = await this.#db
        .update(games)
        .set({ status, updatedAt: new Date() })
        .where(eq(games.id, id))
        .returning();

      if (!result) {
        throw new Error("Failed to update game status - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error("Error in updateStatus:", error);
      throw error;
    }
  }
}
