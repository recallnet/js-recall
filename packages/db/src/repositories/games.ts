import { eq, inArray } from "drizzle-orm";
import { Logger } from "pino";

import { games } from "../schema/sports/defs.js";
import {
  InsertGame,
  NflGameStatus,
  NflTeam,
  SelectGame,
} from "../schema/sports/types.js";
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
   * Upsert a game by providerGameId
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
          target: games.providerGameId,
          set: {
            season: data.season,
            week: data.week,
            startTime: data.startTime,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            spread: data.spread,
            overUnder: data.overUnder,
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
      this.#logger.error({ error }, "Error in upsert");
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
      this.#logger.error({ error }, "Error in findById");
      throw error;
    }
  }

  /**
   * Find game by provider game ID (from SportsDataIO)
   * @param providerGameId SportsDataIO provider game ID
   * @returns Game or undefined
   */
  async findByProviderGameId(
    providerGameId: number,
  ): Promise<SelectGame | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(games)
        .where(eq(games.providerGameId, providerGameId))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByProviderGameId");
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
      this.#logger.error({ error }, "Error in findByIds");
      throw error;
    }
  }

  /**
   * Update game status
   * @param id Game ID
   * @param status New status
   * @returns The updated game
   */
  async updateStatus(id: string, status: NflGameStatus): Promise<SelectGame> {
    try {
      const [result] = await this.#db
        .update(games)
        .set({ status, updatedAt: new Date() })
        .where(eq(games.id, id))
        .returning();

      if (!result) {
        throw new Error("Game not found");
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in updateStatus");
      throw error;
    }
  }

  /**
   * Update game end time and winner when game finalizes
   * @param id Game ID
   * @param endTime End time of the game
   * @param winner Winning team ticker
   * @returns Updated game
   */
  async finalizeGame(
    id: string,
    endTime: Date,
    winner: NflTeam,
  ): Promise<SelectGame> {
    try {
      const [result] = await this.#db
        .update(games)
        .set({
          status: "final",
          endTime,
          winner,
          updatedAt: new Date(),
        })
        .where(eq(games.id, id))
        .returning();

      if (!result) {
        throw new Error("Game not found");
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in finalizeGame");
      throw error;
    }
  }
}
