import { AnyColumn, and, count as drizzleCount, eq, ilike } from "drizzle-orm";
import { Logger } from "pino";

import { competitionPartners, partners } from "../schema/core/defs.js";
import {
  InsertPartner,
  SelectCompetitionPartner,
  SelectPartner,
} from "../schema/core/types.js";
import { Database, Transaction } from "../types.js";
import { PagingParams } from "./types/index.js";
import { getSort } from "./util/query.js";

/**
 * Allowable order by database columns
 */
const partnerOrderByFields: Record<string, AnyColumn> = {
  id: partners.id,
  name: partners.name,
  createdAt: partners.createdAt,
  updatedAt: partners.updatedAt,
};

/**
 * Partner Repository
 * Handles database operations for partners and their competition associations
 */
export class PartnerRepository {
  readonly #db: Database;
  readonly #dbRead: Database;
  readonly #logger: Logger;

  constructor(database: Database, readDatabase: Database, logger: Logger) {
    this.#db = database;
    this.#dbRead = readDatabase;
    this.#logger = logger;
  }

  /**
   * Create a new partner
   * @param partner Partner to create
   * @param tx Optional database transaction
   * @returns Created partner
   */
  async create(
    partner: InsertPartner,
    tx?: Transaction,
  ): Promise<SelectPartner> {
    try {
      const executor = tx || this.#db;
      const now = new Date();
      const [result] = await executor
        .insert(partners)
        .values({
          ...partner,
          createdAt: partner.createdAt || now,
          updatedAt: partner.updatedAt || now,
        })
        .returning();

      if (!result) {
        throw new Error("Failed to create partner");
      }

      return result;
    } catch (error) {
      this.#logger.error("[PartnerRepository] Error in create:", error);
      throw error;
    }
  }

  /**
   * Find a partner by ID
   * @param id Partner ID
   * @returns Partner if found, undefined otherwise
   */
  async findById(id: string): Promise<SelectPartner | undefined> {
    try {
      const [result] = await this.#dbRead
        .select()
        .from(partners)
        .where(eq(partners.id, id))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error(
        `[PartnerRepository] Error in findById (${id}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find a partner by name (exact match, case-sensitive)
   * Useful for checking if partner already exists
   * @param name Partner name
   * @returns Partner if found, undefined otherwise
   */
  async findByName(name: string): Promise<SelectPartner | undefined> {
    try {
      const [result] = await this.#dbRead
        .select()
        .from(partners)
        .where(eq(partners.name, name))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error(
        `[PartnerRepository] Error in findByName (${name}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find all partners with pagination and optional filtering
   * @param params Pagination and sorting parameters
   * @param nameFilter Optional name filter (case-insensitive partial match)
   * @returns Object containing partners array and total count
   */
  async findAll(
    params: PagingParams,
    nameFilter?: string,
  ): Promise<{ partners: SelectPartner[]; total: number }> {
    try {
      const conditions = [];

      if (nameFilter) {
        conditions.push(ilike(partners.name, `%${nameFilter}%`));
      }

      // Build count query
      let countQuery = this.#dbRead
        .select({ count: drizzleCount() })
        .from(partners)
        .$dynamic();

      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }

      // Build data query
      let dataQuery = this.#dbRead.select().from(partners).$dynamic();

      if (conditions.length > 0) {
        dataQuery = dataQuery.where(and(...conditions));
      }

      if (params.sort) {
        dataQuery = getSort(dataQuery, params.sort, partnerOrderByFields);
      }

      // Execute count and data queries in parallel
      const [results, countResult] = await Promise.all([
        dataQuery.limit(params.limit).offset(params.offset),
        countQuery,
      ]);

      return { partners: results, total: countResult[0]?.count ?? 0 };
    } catch (error) {
      this.#logger.error("[PartnerRepository] Error in findAll:", error);
      throw error;
    }
  }

  /**
   * Update an existing partner
   * @param id Partner ID
   * @param data Partner data to update
   * @param tx Optional database transaction
   * @returns Updated partner
   */
  async update(
    id: string,
    data: Partial<Omit<InsertPartner, "id">>,
    tx?: Transaction,
  ): Promise<SelectPartner> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .update(partners)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(partners.id, id))
        .returning();

      if (!result) {
        throw new Error(`Partner with ID ${id} not found`);
      }

      return result;
    } catch (error) {
      this.#logger.error(`[PartnerRepository] Error in update (${id}):`, error);
      throw error;
    }
  }

  /**
   * Delete a partner
   * Note: Will cascade delete all competition_partners associations
   * @param id Partner ID
   * @param tx Optional database transaction
   * @returns True if deleted successfully
   */
  async delete(id: string, tx?: Transaction): Promise<boolean> {
    try {
      const executor = tx || this.#db;
      const result = await executor
        .delete(partners)
        .where(eq(partners.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      this.#logger.error(`[PartnerRepository] Error in delete (${id}):`, error);
      throw error;
    }
  }

  /**
   * Find all partners associated with a competition (ordered by position)
   * @param competitionId Competition ID
   * @returns Array of partners with their position for the competition
   */
  async findByCompetition(competitionId: string): Promise<
    Array<
      SelectPartner & {
        position: number;
        competitionPartnerId: string;
      }
    >
  > {
    try {
      const results = await this.#dbRead
        .select({
          id: partners.id,
          name: partners.name,
          url: partners.url,
          logoUrl: partners.logoUrl,
          details: partners.details,
          createdAt: partners.createdAt,
          updatedAt: partners.updatedAt,
          position: competitionPartners.position,
          competitionPartnerId: competitionPartners.id,
        })
        .from(competitionPartners)
        .innerJoin(partners, eq(competitionPartners.partnerId, partners.id))
        .where(eq(competitionPartners.competitionId, competitionId))
        .orderBy(competitionPartners.position);

      return results;
    } catch (error) {
      this.#logger.error(
        `[PartnerRepository] Error in findByCompetition (${competitionId}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add a partner to a competition
   * Creates or updates the junction table record
   * @param competitionId Competition ID
   * @param partnerId Partner ID
   * @param position Display position
   * @param tx Optional database transaction
   * @returns Created competition partner association
   */
  async addToCompetition(
    competitionId: string,
    partnerId: string,
    position: number,
    tx?: Transaction,
  ): Promise<SelectCompetitionPartner> {
    try {
      const executor = tx || this.#db;
      const now = new Date();
      const [result] = await executor
        .insert(competitionPartners)
        .values({
          competitionId,
          partnerId,
          position,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [
            competitionPartners.competitionId,
            competitionPartners.partnerId,
          ],
          set: {
            position,
          },
        })
        .returning();

      if (!result) {
        throw new Error("Failed to add partner to competition");
      }

      return result;
    } catch (error) {
      this.#logger.error(
        `[PartnerRepository] Error in addToCompetition (comp: ${competitionId}, partner: ${partnerId}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove a partner from a competition
   * @param competitionId Competition ID
   * @param partnerId Partner ID
   * @param tx Optional database transaction
   * @returns True if removed successfully
   */
  async removeFromCompetition(
    competitionId: string,
    partnerId: string,
    tx?: Transaction,
  ): Promise<boolean> {
    try {
      const executor = tx || this.#db;
      const result = await executor
        .delete(competitionPartners)
        .where(
          and(
            eq(competitionPartners.competitionId, competitionId),
            eq(competitionPartners.partnerId, partnerId),
          ),
        )
        .returning();

      return result.length > 0;
    } catch (error) {
      this.#logger.error(
        `[PartnerRepository] Error in removeFromCompetition (comp: ${competitionId}, partner: ${partnerId}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update partner position in a competition
   * @param competitionId Competition ID
   * @param partnerId Partner ID
   * @param newPosition New display position
   * @param tx Optional database transaction
   * @returns Updated competition partner association
   */
  async updatePosition(
    competitionId: string,
    partnerId: string,
    newPosition: number,
    tx?: Transaction,
  ): Promise<SelectCompetitionPartner> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .update(competitionPartners)
        .set({
          position: newPosition,
        })
        .where(
          and(
            eq(competitionPartners.competitionId, competitionId),
            eq(competitionPartners.partnerId, partnerId),
          ),
        )
        .returning();

      if (!result) {
        throw new Error(
          `Partner association not found (comp: ${competitionId}, partner: ${partnerId})`,
        );
      }

      return result;
    } catch (error) {
      this.#logger.error(
        `[PartnerRepository] Error in updatePosition (comp: ${competitionId}, partner: ${partnerId}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get count of competitions associated with a partner
   * Useful for determining if a partner can be safely deleted
   * @param partnerId Partner ID
   * @returns Number of competitions the partner is associated with
   */
  async getCompetitionCount(partnerId: string): Promise<number> {
    try {
      const result = await this.#dbRead
        .select({ count: drizzleCount() })
        .from(competitionPartners)
        .where(eq(competitionPartners.partnerId, partnerId));

      return result[0]?.count ?? 0;
    } catch (error) {
      this.#logger.error(
        `[PartnerRepository] Error in getCompetitionCount (${partnerId}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Replace all partners for a competition atomically
   * Deletes existing associations and creates new ones in a transaction
   * @param competitionId Competition ID
   * @param partnerData Array of partner info with positions
   * @param tx Optional database transaction
   * @returns Array of created competition partner associations
   */
  async replaceCompetitionPartners(
    competitionId: string,
    partnerData: Array<{
      partnerId: string;
      position: number;
    }>,
    tx?: Transaction,
  ): Promise<SelectCompetitionPartner[]> {
    try {
      // If transaction provided, use it directly; otherwise create new transaction
      if (tx) {
        // Use provided transaction directly (no nesting)
        await tx
          .delete(competitionPartners)
          .where(eq(competitionPartners.competitionId, competitionId));

        if (partnerData.length === 0) {
          return [];
        }

        const now = new Date();
        const results = await tx
          .insert(competitionPartners)
          .values(
            partnerData.map((p) => ({
              competitionId,
              partnerId: p.partnerId,
              position: p.position,
              createdAt: now,
            })),
          )
          .returning();

        return results;
      }

      // No transaction provided, create a new one
      return await this.#db.transaction(async (txn) => {
        // Delete existing associations
        await txn
          .delete(competitionPartners)
          .where(eq(competitionPartners.competitionId, competitionId));

        // Create new associations
        if (partnerData.length === 0) {
          return [];
        }

        const now = new Date();
        const results = await txn
          .insert(competitionPartners)
          .values(
            partnerData.map((p) => ({
              competitionId,
              partnerId: p.partnerId,
              position: p.position,
              createdAt: now,
            })),
          )
          .returning();

        return results;
      });
    } catch (error) {
      this.#logger.error(
        `[PartnerRepository] Error in replaceCompetitionPartners (${competitionId}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find or create a partner by name (idempotent)
   * Checks if partner exists first, creates if not
   * @param partnerData Partner data
   * @param tx Optional database transaction
   * @returns Existing or newly created partner
   */
  async findOrCreate(
    partnerData: Omit<InsertPartner, "id" | "createdAt" | "updatedAt">,
    tx?: Transaction,
  ): Promise<SelectPartner> {
    try {
      // Check if partner already exists
      const existing = await this.findByName(partnerData.name);
      if (existing) {
        return existing;
      }

      // Create new partner
      return await this.create(partnerData, tx);
    } catch (error) {
      this.#logger.error(
        `[PartnerRepository] Error in findOrCreate (${partnerData.name}):`,
        error,
      );
      throw error;
    }
  }
}
