import {
  AnyColumn,
  and,
  count as drizzleCount,
  eq,
  getTableColumns,
  ilike,
  sql,
} from "drizzle-orm";
import { Logger } from "pino";

import { arenas, competitions } from "../schema/core/defs.js";
import { InsertArena, SelectArena } from "../schema/core/types.js";
import { Database, Transaction } from "../types.js";
import { PagingParams } from "./types/index.js";
import { getSort } from "./util/query.js";

/**
 * Classification filter parameters for arena search
 */
export interface ClassificationFilters {
  category?: string;
  skill?: string;
  venues?: string[];
  chains?: string[];
}

/**
 * Allowable order by database columns
 */
const arenaOrderByFields: Record<string, AnyColumn> = {
  id: arenas.id,
  name: arenas.name,
  createdAt: arenas.createdAt,
  updatedAt: arenas.updatedAt,
};

/**
 * Arena Repository
 * Handles database operations for arenas
 */
export class ArenaRepository {
  readonly #db: Database;
  readonly #dbRead: Database;
  readonly #logger: Logger;

  constructor(database: Database, readDatabase: Database, logger: Logger) {
    this.#db = database;
    this.#dbRead = readDatabase;
    this.#logger = logger;
  }

  /**
   * Create a new arena
   * @param arena Arena to create
   * @param tx Optional database transaction
   * @returns Created arena
   */
  async create(arena: InsertArena, tx?: Transaction): Promise<SelectArena> {
    try {
      const executor = tx || this.#db;
      const now = new Date();
      const [result] = await executor
        .insert(arenas)
        .values({
          ...arena,
          createdAt: arena.createdAt || now,
          updatedAt: arena.updatedAt || now,
        })
        .returning();

      if (!result) {
        throw new Error("Failed to create arena");
      }

      return result;
    } catch (error) {
      this.#logger.error("[ArenaRepository] Error in create:", error);
      throw error;
    }
  }

  /**
   * Find an arena by ID
   * @param id Arena ID
   * @returns Arena if found, undefined otherwise
   */
  async findById(id: string): Promise<SelectArena | undefined> {
    try {
      const [result] = await this.#dbRead
        .select()
        .from(arenas)
        .where(eq(arenas.id, id))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error(`[ArenaRepository] Error in findById (${id}):`, error);
      throw error;
    }
  }

  /**
   * Find all arenas with pagination and optional filtering
   * @param params Pagination and sorting parameters
   * @param nameFilter Optional name filter (case-insensitive partial match)
   * @returns Object containing arenas array and total count
   */
  async findAll(
    params: PagingParams,
    nameFilter?: string,
  ): Promise<{ arenas: SelectArena[]; total: number }> {
    try {
      const conditions = [];

      if (nameFilter) {
        conditions.push(ilike(arenas.name, `%${nameFilter}%`));
      }

      // Count query
      let countQuery = this.#dbRead
        .select({ count: drizzleCount() })
        .from(arenas)
        .$dynamic();

      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }

      const countResult = await countQuery;
      const total = countResult[0]?.count ?? 0;

      // Data query
      let dataQuery = this.#dbRead.select().from(arenas).$dynamic();

      if (conditions.length > 0) {
        dataQuery = dataQuery.where(and(...conditions));
      }

      if (params.sort) {
        dataQuery = getSort(dataQuery, params.sort, arenaOrderByFields);
      }

      const results = await dataQuery.limit(params.limit).offset(params.offset);

      return { arenas: results, total };
    } catch (error) {
      this.#logger.error("[ArenaRepository] Error in findAll:", error);
      throw error;
    }
  }

  /**
   * Update an existing arena
   * @param id Arena ID
   * @param data Arena data to update
   * @param tx Optional database transaction
   * @returns Updated arena
   */
  async update(
    id: string,
    data: Partial<Omit<InsertArena, "id">>,
    tx?: Transaction,
  ): Promise<SelectArena> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .update(arenas)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(arenas.id, id))
        .returning();

      if (!result) {
        throw new Error(`Arena with ID ${id} not found`);
      }

      return result;
    } catch (error) {
      this.#logger.error(`[ArenaRepository] Error in update (${id}):`, error);
      throw error;
    }
  }

  /**
   * Delete an arena
   * Note: Will fail if arena has associated competitions due to FK constraint
   * @param id Arena ID
   * @param tx Optional database transaction
   * @returns True if deleted successfully
   */
  async delete(id: string, tx?: Transaction): Promise<boolean> {
    try {
      const executor = tx || this.#db;
      const result = await executor
        .delete(arenas)
        .where(eq(arenas.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      this.#logger.error(`[ArenaRepository] Error in delete (${id}):`, error);
      throw error;
    }
  }

  /**
   * Find arenas by category
   * @param category Category value from classification JSONB
   * @returns Array of matching arenas
   */
  async findByCategory(category: string): Promise<SelectArena[]> {
    try {
      const results = await this.#dbRead
        .select()
        .from(arenas)
        .where(sql`${arenas.classification}->>'category' = ${category}`);

      return results;
    } catch (error) {
      this.#logger.error(
        `[ArenaRepository] Error in findByCategory (${category}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find arenas by skill
   * @param skill Skill value from classification JSONB
   * @returns Array of matching arenas
   */
  async findBySkill(skill: string): Promise<SelectArena[]> {
    try {
      const results = await this.#dbRead
        .select()
        .from(arenas)
        .where(sql`${arenas.classification}->>'skill' = ${skill}`);

      return results;
    } catch (error) {
      this.#logger.error(
        `[ArenaRepository] Error in findBySkill (${skill}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Search arenas by classification filters
   * Supports filtering by category, skill, venues, and chains
   * @param filters Classification filter parameters
   * @returns Array of matching arenas
   */
  async searchByClassification(
    filters: ClassificationFilters,
  ): Promise<SelectArena[]> {
    try {
      const conditions = [];

      if (filters.category) {
        conditions.push(
          sql`${arenas.classification}->>'category' = ${filters.category}`,
        );
      }

      if (filters.skill) {
        conditions.push(
          sql`${arenas.classification}->>'skill' = ${filters.skill}`,
        );
      }

      if (filters.venues && filters.venues.length > 0) {
        conditions.push(
          sql`${arenas.classification}->'venues' ?| array[${sql.join(
            filters.venues.map((v) => sql`${v}`),
            sql`, `,
          )}]`,
        );
      }

      if (filters.chains && filters.chains.length > 0) {
        conditions.push(
          sql`${arenas.classification}->'chains' ?| array[${sql.join(
            filters.chains.map((c) => sql`${c}`),
            sql`, `,
          )}]`,
        );
      }

      let query = this.#dbRead.select().from(arenas).$dynamic();

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const results = await query;
      return results;
    } catch (error) {
      this.#logger.error(
        "[ArenaRepository] Error in searchByClassification:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get the count of competitions associated with an arena
   * @param arenaId Arena ID
   * @returns Number of competitions in the arena
   */
  async getCompetitionCount(arenaId: string): Promise<number> {
    try {
      const result = await this.#dbRead
        .select({ count: drizzleCount() })
        .from(competitions)
        .where(eq(competitions.arenaId, arenaId));

      return result[0]?.count ?? 0;
    } catch (error) {
      this.#logger.error(
        `[ArenaRepository] Error in getCompetitionCount (${arenaId}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if an arena can be safely deleted
   * An arena can only be deleted if it has no associated competitions
   * @param arenaId Arena ID
   * @returns True if arena can be deleted, false otherwise
   */
  async canDelete(arenaId: string): Promise<boolean> {
    try {
      const count = await this.getCompetitionCount(arenaId);
      return count === 0;
    } catch (error) {
      this.#logger.error(
        `[ArenaRepository] Error in canDelete (${arenaId}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all arenas with their competition counts
   * Useful for admin dashboards
   * @param params Pagination parameters
   * @returns Object containing arenas with competition counts and total count
   */
  async findAllWithCompetitionCounts(params: PagingParams): Promise<{
    arenas: Array<SelectArena & { competitionCount: number }>;
    total: number;
  }> {
    try {
      // Count query
      const countResult = await this.#dbRead
        .select({ count: drizzleCount() })
        .from(arenas);
      const total = countResult[0]?.count ?? 0;

      // Data query with competition count
      let query = this.#dbRead
        .select({
          ...getTableColumns(arenas),
          competitionCount: sql<number>`count(${competitions.id})::int`,
        })
        .from(arenas)
        .leftJoin(competitions, eq(arenas.id, competitions.arenaId))
        .groupBy(arenas.id)
        .$dynamic();

      if (params.sort) {
        query = getSort(query, params.sort, arenaOrderByFields);
      }

      const results = await query.limit(params.limit).offset(params.offset);

      return { arenas: results, total };
    } catch (error) {
      this.#logger.error(
        "[ArenaRepository] Error in findAllWithCompetitionCounts:",
        error,
      );
      throw error;
    }
  }
}
