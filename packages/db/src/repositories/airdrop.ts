import { and, eq, gt, lte, sql } from "drizzle-orm";
import { Logger } from "pino";

import {
  airdropAllocations,
  merkleMetadata,
  seasons,
} from "../schema/airdrop/defs.js";
import { NewAirdropAllocation, NewSeason } from "../schema/airdrop/types.js";
import { Database, Transaction } from "../types.js";

/**
 * Database service for airdrop data operations
 * Replaces file-based data storage with PostgreSQL
 */
export class AirdropRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(db: Database, logger: Logger) {
    this.#db = db;
    this.#logger = logger;
  }

  /**
   * Get allocation data for a specific address
   */
  async getAllocationByAddress(address: string) {
    try {
      const normalizedAddress = address.toLowerCase();

      const result = await this.#db
        .select()
        .from(airdropAllocations)
        .where(eq(airdropAllocations.address, normalizedAddress))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const allocation = result[0];
      if (!allocation) {
        throw new Error(`Allocation not found for address ${address}`);
      }

      return {
        address: allocation.address,
        amount: allocation.amount,
        airdrop: allocation.airdrop,
        proof: allocation.proof,
        category: allocation.category || "",
        sybilClassification: allocation.sybilClassification as
          | "approved"
          | "maybe-sybil"
          | "sybil",
        flaggedAt: allocation.flaggedAt || null,
        flaggingReason: allocation.flaggingReason || null,
        powerUser: allocation.powerUser || false,
        recallSnapper: allocation.recallSnapper || false,
        aiBuilder: allocation.aiBuilder || false,
        aiExplorer: allocation.aiExplorer || false,
      };
    } catch (error) {
      this.#logger.error({ error }, "Error fetching allocation by address");
      throw error;
    }
  }

  /**
   * Get multiple allocations for batch processing
   */
  async getAllocationsByAddresses(addresses: string[]) {
    try {
      const normalizedAddresses = addresses.map((a) => a.toLowerCase());

      const results = await this.#db
        .select()
        .from(airdropAllocations)
        .where(
          sql`${airdropAllocations.address} = ANY(${normalizedAddresses})`,
        );

      return results.map((allocation) => ({
        address: allocation.address,
        amount: allocation.amount,
        airdrop: allocation.airdrop,
        proof: allocation.proof,
        category: allocation.category || "",
        sybilClassification: allocation.sybilClassification as
          | "approved"
          | "maybe-sybil"
          | "sybil",
        flaggedAt: allocation.flaggedAt || null,
        flaggingReason: allocation.flaggingReason || null,
        powerUser: allocation.powerUser || false,
        recallSnapper: allocation.recallSnapper || false,
        aiBuilder: allocation.aiBuilder || false,
        aiExplorer: allocation.aiExplorer || false,
      }));
    } catch (error) {
      this.#logger.error({ error }, "Error fetching allocations by addresses");
      throw error;
    }
  }

  /**
   * Get merkle tree metadata
   */
  async getMerkleMetadata() {
    try {
      const result = await this.#db
        .select()
        .from(merkleMetadata)
        .where(eq(merkleMetadata.id, 1))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0];
    } catch (error) {
      this.#logger.error({ error }, "Error fetching merkle metadata");
      throw error;
    }
  }

  /**
   * Get full airdrop data (metadata + specific allocation)
   * This mimics the structure of the original JSON file for backward compatibility
   */
  async getAirdropData(address?: string) {
    try {
      const metadata = await this.getMerkleMetadata();

      if (!metadata) {
        return null;
      }

      // If no address specified, just return metadata without allocations
      if (!address) {
        return {
          merkleRoot: metadata.merkleRoot,
          totalAmount: metadata.totalAmount,
          totalRows: metadata.totalRows,
          uniqueAddresses: metadata.uniqueAddresses,
          allocations: [],
        };
      }

      // Get the specific allocation for the address
      const allocation = await this.getAllocationByAddress(address);

      return {
        merkleRoot: metadata.merkleRoot,
        totalAmount: metadata.totalAmount,
        totalRows: metadata.totalRows,
        uniqueAddresses: metadata.uniqueAddresses,
        allocations: allocation ? [allocation] : [],
      };
    } catch (error) {
      this.#logger.error({ error }, "Error fetching airdrop data");
      throw error;
    }
  }

  /**
   * Get all allocations with a specific sybil classification
   */
  async getAllocationsByClassification(
    classification: "approved" | "maybe-sybil" | "sybil",
  ) {
    try {
      const results = await this.#db
        .select()
        .from(airdropAllocations)
        .where(eq(airdropAllocations.sybilClassification, classification));

      return results.map((allocation) => ({
        address: allocation.address,
        amount: allocation.amount,
        airdrop: allocation.airdrop,
        proof: allocation.proof,
        category: allocation.category || "",
        sybilClassification: allocation.sybilClassification as
          | "approved"
          | "maybe-sybil"
          | "sybil",
        flaggedAt: allocation.flaggedAt || null,
        flaggingReason: allocation.flaggingReason || null,
        powerUser: allocation.powerUser || false,
        recallSnapper: allocation.recallSnapper || false,
        aiBuilder: allocation.aiBuilder || false,
        aiExplorer: allocation.aiExplorer || false,
      }));
    } catch (error) {
      this.#logger.error(
        { error },
        "Error fetching allocations by classification",
      );
      throw error;
    }
  }

  /**
   * Get total statistics for the airdrop
   */
  async getStatistics() {
    try {
      const metadata = await this.getMerkleMetadata();

      if (!metadata) {
        return null;
      }

      // Get classification counts
      const classificationCounts = await this.#db
        .select({
          classification: airdropAllocations.sybilClassification,
          count: sql<number>`count(*)::int`,
        })
        .from(airdropAllocations)
        .groupBy(airdropAllocations.sybilClassification);

      // Convert to object
      const counts = classificationCounts.reduce(
        (acc, row) => {
          acc[row.classification] = row.count;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        merkleRoot: metadata.merkleRoot,
        totalAmount: metadata.totalAmount,
        totalRows: metadata.totalRows,
        uniqueAddresses: metadata.uniqueAddresses,
        classificationCounts: {
          approved: counts["approved"] || 0,
          "maybe-sybil": counts["maybe-sybil"] || 0,
          sybil: counts["sybil"] || 0,
        },
        generatedAt: metadata.generatedAt,
      };
    } catch (error) {
      this.#logger.error({ error }, "Error fetching statistics");
      throw error;
    }
  }

  /**
   * Check if address exists in the airdrop
   */
  async addressExists(address: string) {
    try {
      const normalizedAddress = address.toLowerCase();

      const result = await this.#db
        .select({ count: sql<number>`count(*)::int` })
        .from(airdropAllocations)
        .where(eq(airdropAllocations.address, normalizedAddress));

      return (result[0]?.count || 0) > 0;
    } catch (error) {
      this.#logger.error({ error }, "Error checking address existence");
      throw error;
    }
  }

  /**
   * Get paginated allocations (useful for admin interfaces)
   */
  async getAllocationsPaginated(offset: number = 0, limit: number = 100) {
    try {
      const results = await this.#db
        .select()
        .from(airdropAllocations)
        .offset(offset)
        .limit(limit);

      const allocations = results.map((allocation) => ({
        address: allocation.address,
        amount: allocation.amount,
        airdrop: allocation.airdrop,
        proof: allocation.proof,
        category: allocation.category || "",
        sybilClassification: allocation.sybilClassification as
          | "approved"
          | "maybe-sybil"
          | "sybil",
        flaggedAt: allocation.flaggedAt || null,
        flaggingReason: allocation.flaggingReason || null,
      }));

      // Get total count for pagination
      const countResult = await this.#db
        .select({ count: sql<number>`count(*)::int` })
        .from(airdropAllocations);

      return {
        allocations,
        total: countResult[0]?.count || 0,
        offset,
        limit,
      };
    } catch (error) {
      this.#logger.error({ error }, "Error fetching paginated allocations");
      throw error;
    }
  }

  /**
   * Insert allocations in batches
   */
  async insertAllocationsBatch(
    allocations: NewAirdropAllocation[],
    batchSize: number = 1000,
    tx?: Transaction,
  ): Promise<void> {
    this.#logger.info(
      `Inserting ${allocations.length} allocations in batches of ${batchSize}`,
    );

    const executor = tx ?? this.#db;

    for (let i = 0; i < allocations.length; i += batchSize) {
      const batch = allocations.slice(i, i + batchSize);
      await executor
        .insert(airdropAllocations)
        .values(batch)
        .onConflictDoNothing();
      this.#logger.info(
        `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allocations.length / batchSize)}`,
      );
    }

    this.#logger.info("All allocations inserted successfully");
  }

  /**
   * Get all allocations data for a specific address across all seasons
   */
  async getAllAllocationsForAddress(address: string) {
    try {
      const normalizedAddress = address.toLowerCase();

      const res = await this.#db
        .select()
        .from(airdropAllocations)
        .where(eq(airdropAllocations.address, normalizedAddress));

      const allocations = res.map((claim) => ({
        ...claim,
        sybilClassification: claim.sybilClassification as
          | "approved"
          | "maybe-sybil"
          | "sybil",
      }));

      return allocations;
    } catch (error) {
      this.#logger.error({ error }, "Error fetching all claims for address");
      throw error;
    }
  }

  /**
   * Insert or update merkle metadata
   */
  async upsertMetadata(
    metadata: {
      merkleRoot: string;
      totalAmount: string;
      totalRows: number;
      uniqueAddresses: number;
    },
    tx?: Transaction,
  ): Promise<void> {
    this.#logger.info("Upserting merkle metadata");

    const executor = tx ?? this.#db;
    await executor
      .insert(merkleMetadata)
      .values({
        id: 1,
        merkleRoot: metadata.merkleRoot,
        totalAmount: metadata.totalAmount,
        totalRows: metadata.totalRows,
        uniqueAddresses: metadata.uniqueAddresses,
      })
      .onConflictDoUpdate({
        target: merkleMetadata.id,
        set: {
          merkleRoot: metadata.merkleRoot,
          totalAmount: metadata.totalAmount,
          totalRows: metadata.totalRows,
          uniqueAddresses: metadata.uniqueAddresses,
        },
      });

    this.#logger.info("Merkle metadata upserted successfully");
  }

  async newSeason(newSeason: NewSeason, tx?: Transaction) {
    const executor = tx ?? this.#db;
    const [res] = await executor
      .insert(seasons)
      .values(newSeason)
      .returning()
      .onConflictDoNothing();
    if (res && res.number > 1) {
      await executor
        .update(seasons)
        .set({ endDate: res.startDate })
        .where(eq(seasons.number, res.number - 1));
    }
  }

  async getSeasons(tx?: Transaction) {
    const executor = tx ?? this.#db;
    return await executor.select().from(seasons);
  }

  /**
   * Get the current season based on the current timestamp.
   * A season is current if now() >= start_date AND now() < end_date.
   *
   * @param tx - Optional transaction
   * @returns The current season or null if no season matches the current date
   */
  async getCurrentSeason(tx?: Transaction) {
    const executor = tx ?? this.#db;
    const [result] = await executor
      .select()
      .from(seasons)
      .where(
        and(
          lte(seasons.startDate, sql`now()`),
          gt(seasons.endDate, sql`now()`),
        ),
      )
      .limit(1);

    return result ?? null;
  }

  /**
   * Get a season by its number.
   *
   * @param seasonNumber - The season number to look up
   * @param tx - Optional transaction
   * @returns The season or null if not found
   */
  async getSeasonByNumber(seasonNumber: number, tx?: Transaction) {
    const executor = tx ?? this.#db;
    const [result] = await executor
      .select()
      .from(seasons)
      .where(eq(seasons.number, seasonNumber))
      .limit(1);

    return result ?? null;
  }
}
