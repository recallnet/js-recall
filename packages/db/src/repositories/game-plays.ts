import { AnyColumn, and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Logger } from "pino";

import { gamePlays } from "../schema/sports/defs.js";
import { InsertGamePlay, SelectGamePlay } from "../schema/sports/types.js";
import { Database } from "../types.js";
import { PagingParams } from "./types/index.js";
import { getSort } from "./util/query.js";

const gamePlaysFields: Record<string, AnyColumn> = {
  sequence: gamePlays.sequence,
  createdAt: gamePlays.createdAt,
};

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
   * Find plays by game ID
   * @param gameId Game ID
   * @returns Array of plays
   */
  async findByGameId(
    gameId: string,
    params: PagingParams,
  ): Promise<SelectGamePlay[]> {
    try {
      const { limit, offset } = params;

      let query = this.#db
        .select()
        .from(gamePlays)
        .where(eq(gamePlays.gameId, gameId))
        .$dynamic();

      if (params.sort) {
        query = getSort(query, params.sort, gamePlaysFields);
      }
      query = query.limit(limit).offset(offset);

      const results = await query.execute();

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByGameId");
      throw error;
    }
  }
}
