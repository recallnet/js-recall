import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { Logger } from "pino";

import { gamePlays } from "../schema/sports/defs.js";
import { InsertGamePlay, SelectGamePlay } from "../schema/sports/types.js";
import { Database } from "../types.js";

/**
 * Game Plays Repository
 * Handles database operations for game plays
 */
export class GamePlaysRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Insert a new game play
   * @param play Play data to insert
   * @returns The inserted play
   */
  async insert(play: InsertGamePlay): Promise<SelectGamePlay> {
    try {
      const now = new Date();
      const data = {
        ...play,
        createdAt: play.createdAt || now,
        updatedAt: now,
      };

      const [result] = await this.#db
        .insert(gamePlays)
        .values(data)
        .returning();

      if (!result) {
        throw new Error("Failed to insert game play - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in insert");
      throw error;
    }
  }

  /**
   * Upsert a game play by gameId and sequence
   * @param play Play data to insert or update
   * @returns The upserted play
   */
  async upsert(play: InsertGamePlay): Promise<SelectGamePlay> {
    try {
      const now = new Date();
      const data = {
        ...play,
        createdAt: play.createdAt || now,
        updatedAt: now,
      };

      const [result] = await this.#db
        .insert(gamePlays)
        .values(data)
        .onConflictDoUpdate({
          target: [gamePlays.gameId, gamePlays.sequence],
          set: {
            providerPlayId: data.providerPlayId,
            quarterName: data.quarterName,
            timeRemainingMinutes: data.timeRemainingMinutes,
            timeRemainingSeconds: data.timeRemainingSeconds,
            playTime: data.playTime,
            down: data.down,
            distance: data.distance,
            yardLine: data.yardLine,
            yardLineTerritory: data.yardLineTerritory,
            yardsToEndZone: data.yardsToEndZone,
            playType: data.playType,
            team: data.team,
            opponent: data.opponent,
            description: data.description,
            lockTime: data.lockTime,
            status: data.status,
            actualOutcome: data.actualOutcome,
            updatedAt: now,
          },
        })
        .returning();

      if (!result) {
        throw new Error("Failed to upsert game play - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in upsert");
      throw error;
    }
  }

  /**
   * Find a play by ID
   * @param id Play ID
   * @returns The play or undefined
   */
  async findById(id: string): Promise<SelectGamePlay | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(gamePlays)
        .where(eq(gamePlays.id, id))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findById");
      throw error;
    }
  }

  /**
   * Find open plays for specific games
   * Only returns plays where actualOutcome is null (predictable plays that haven't been resolved)
   * @param gameIds Array of game IDs
   * @param limit Maximum number of plays to return
   * @param offset Offset for pagination
   * @returns Array of open plays
   */
  async findOpenByGameIds(
    gameIds: string[],
    limit: number = 50,
    offset: number = 0,
  ): Promise<SelectGamePlay[]> {
    try {
      if (gameIds.length === 0) {
        return [];
      }

      const results = await this.#db
        .select()
        .from(gamePlays)
        .where(
          and(
            inArray(gamePlays.gameId, gameIds),
            eq(gamePlays.status, "open"),
            isNull(gamePlays.actualOutcome), // Only predictable plays
          ),
        )
        .orderBy(gamePlays.lockTime)
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findOpenByGameIds");
      throw error;
    }
  }

  /**
   * Count open plays for specific games
   * @param gameIds Array of game IDs
   * @returns Count of open plays
   */
  async countOpenByGameIds(gameIds: string[]): Promise<number> {
    try {
      if (gameIds.length === 0) {
        return 0;
      }

      const [result] = await this.#db
        .select({ count: sql<number>`count(*)::int` })
        .from(gamePlays)
        .where(
          and(inArray(gamePlays.gameId, gameIds), eq(gamePlays.status, "open")),
        );

      return result?.count || 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in countOpenByGameIds");
      throw error;
    }
  }

  /**
   * Update play status to locked for plays past their lock time
   * @returns Number of plays updated
   */
  async lockExpiredPlays(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.#db
        .update(gamePlays)
        .set({ status: "locked", updatedAt: now })
        .where(and(eq(gamePlays.status, "open"), lte(gamePlays.lockTime, now)));

      return result.rowCount || 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in lockExpiredPlays");
      throw error;
    }
  }

  /**
   * Resolve a play with the actual outcome
   * @param id Play ID
   * @param outcome Actual outcome (run or pass)
   * @returns The updated play
   */
  async resolve(id: string, outcome: "run" | "pass"): Promise<SelectGamePlay> {
    try {
      const [result] = await this.#db
        .update(gamePlays)
        .set({
          status: "resolved",
          actualOutcome: outcome,
          updatedAt: new Date(),
        })
        .where(eq(gamePlays.id, id))
        .returning();

      if (!result) {
        throw new Error("Failed to resolve play - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in resolve");
      throw error;
    }
  }

  /**
   * Find plays by game ID
   * @param gameId Game ID
   * @returns Array of plays
   */
  async findByGameId(gameId: string): Promise<SelectGamePlay[]> {
    try {
      const results = await this.#db
        .select()
        .from(gamePlays)
        .where(eq(gamePlays.gameId, gameId))
        .orderBy(gamePlays.sequence);

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByGameId");
      throw error;
    }
  }
}
