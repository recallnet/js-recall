import { eq, sql } from "drizzle-orm";
import { Logger } from "pino";

import { airdropClaims, merkleMetadata } from "../schema/airdrop/defs.js";
import { Database } from "../types.js";

/**
 * Database service for airdrop data operations
 * Replaces file-based data storage with PostgreSQL
 */
export class AirdropRepository {
  // TODO: I just copied these functions from the airdrop claims portal repo.
  // We probably want methods more specific to our use case.

  readonly #db: Database;
  readonly #logger: Logger;

  constructor(db: Database, logger: Logger) {
    this.#db = db;
    this.#logger = logger;
  }

  /**
   * Get claim data for a specific address
   */
  async getClaimByAddress(address: string) {
    try {
      const normalizedAddress = address.toLowerCase();

      const result = await this.#db
        .select()
        .from(airdropClaims)
        .where(eq(airdropClaims.address, normalizedAddress))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const claim = result[0];
      if (!claim) {
        throw new Error(`Claim not found for address ${address}`);
      }

      // Parse the proof JSON string back to array
      let proofArray: string[] = [];
      try {
        proofArray = JSON.parse(claim.proof);
      } catch (e) {
        this.#logger.error("Failed to parse proof JSON:", e);
        proofArray = [];
      }

      return {
        address: claim.address,
        amount: claim.amount,
        season: claim.season,
        proof: proofArray,
        category: claim.category || "",
        sybilClassification: claim.sybilClassification as
          | "approved"
          | "maybe-sybil"
          | "sybil",
        flaggedAt: claim.flaggedAt || null,
        flaggingReason: claim.flaggingReason || null,
        powerUser: claim.powerUser || false,
        recallSnapper: claim.recallSnapper || false,
        aiBuilder: claim.aiBuilder || false,
        aiExplorer: claim.aiExplorer || false,
      };
    } catch (error) {
      this.#logger.error("Error fetching claim by address:", error);
      throw error;
    }
  }

  /**
   * Get multiple claims for batch processing
   */
  async getClaimsByAddresses(addresses: string[]) {
    try {
      const normalizedAddresses = addresses.map((a) => a.toLowerCase());

      const results = await this.#db
        .select()
        .from(airdropClaims)
        .where(sql`${airdropClaims.address} = ANY(${normalizedAddresses})`);

      return results.map((claim) => ({
        address: claim.address,
        amount: claim.amount,
        season: claim.season,
        proof: JSON.parse(claim.proof),
        category: claim.category || "",
        sybilClassification: claim.sybilClassification as
          | "approved"
          | "maybe-sybil"
          | "sybil",
        flaggedAt: claim.flaggedAt || null,
        flaggingReason: claim.flaggingReason || null,
        powerUser: claim.powerUser || false,
        recallSnapper: claim.recallSnapper || false,
        aiBuilder: claim.aiBuilder || false,
        aiExplorer: claim.aiExplorer || false,
      }));
    } catch (error) {
      this.#logger.error("Error fetching claims by addresses:", error);
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
      this.#logger.error("Error fetching merkle metadata:", error);
      throw error;
    }
  }

  /**
   * Get full airdrop data (metadata + specific claim)
   * This mimics the structure of the original JSON file for backward compatibility
   */
  async getAirdropData(address?: string) {
    try {
      const metadata = await this.getMerkleMetadata();

      if (!metadata) {
        return null;
      }

      // If no address specified, just return metadata without claims
      if (!address) {
        return {
          merkleRoot: metadata.merkleRoot,
          totalAmount: metadata.totalAmount,
          totalRows: metadata.totalRows,
          uniqueAddresses: metadata.uniqueAddresses,
          claims: [],
        };
      }

      // Get the specific claim for the address
      const claim = await this.getClaimByAddress(address);

      return {
        merkleRoot: metadata.merkleRoot,
        totalAmount: metadata.totalAmount,
        totalRows: metadata.totalRows,
        uniqueAddresses: metadata.uniqueAddresses,
        claims: claim ? [claim] : [],
      };
    } catch (error) {
      this.#logger.error("Error fetching airdrop data:", error);
      throw error;
    }
  }

  /**
   * Get all claims with a specific sybil classification
   */
  async getClaimsByClassification(
    classification: "approved" | "maybe-sybil" | "sybil",
  ) {
    try {
      const results = await this.#db
        .select()
        .from(airdropClaims)
        .where(eq(airdropClaims.sybilClassification, classification));

      return results.map((claim) => ({
        address: claim.address,
        amount: claim.amount,
        season: claim.season,
        proof: JSON.parse(claim.proof),
        category: claim.category || "",
        sybilClassification: claim.sybilClassification as
          | "approved"
          | "maybe-sybil"
          | "sybil",
        flaggedAt: claim.flaggedAt || null,
        flaggingReason: claim.flaggingReason || null,
        powerUser: claim.powerUser || false,
        recallSnapper: claim.recallSnapper || false,
        aiBuilder: claim.aiBuilder || false,
        aiExplorer: claim.aiExplorer || false,
      }));
    } catch (error) {
      this.#logger.error("Error fetching claims by classification:", error);
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
          classification: airdropClaims.sybilClassification,
          count: sql<number>`count(*)::int`,
        })
        .from(airdropClaims)
        .groupBy(airdropClaims.sybilClassification);

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
      this.#logger.error("Error fetching statistics:", error);
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
        .from(airdropClaims)
        .where(eq(airdropClaims.address, normalizedAddress));

      return (result[0]?.count || 0) > 0;
    } catch (error) {
      this.#logger.error("Error checking address existence:", error);
      throw error;
    }
  }

  /**
   * Get paginated claims (useful for admin interfaces)
   */
  async getClaimsPaginated(offset: number = 0, limit: number = 100) {
    try {
      const results = await this.#db
        .select()
        .from(airdropClaims)
        .offset(offset)
        .limit(limit);

      const claims = results.map((claim) => ({
        address: claim.address,
        amount: claim.amount,
        season: claim.season,
        proof: JSON.parse(claim.proof),
        category: claim.category || "",
        sybilClassification: claim.sybilClassification as
          | "approved"
          | "maybe-sybil"
          | "sybil",
        flaggedAt: claim.flaggedAt || null,
        flaggingReason: claim.flaggingReason || null,
      }));

      // Get total count for pagination
      const countResult = await this.#db
        .select({ count: sql<number>`count(*)::int` })
        .from(airdropClaims);

      return {
        claims,
        total: countResult[0]?.count || 0,
        offset,
        limit,
      };
    } catch (error) {
      this.#logger.error("Error fetching paginated claims:", error);
      throw error;
    }
  }

  /**
   * Insert claims in batches
   */
  async insertClaimsBatch(
    claims: Array<{
      address: string;
      amount: string;
      season: number;
      proof: string[];
      category: string;
      sybilClassification: string;
      flaggedAt: string | null;
      flaggingReason: string | null;
      powerUser: boolean;
      recallSnapper: boolean;
      aiBuilder: boolean;
      aiExplorer: boolean;
    }>,
    batchSize: number = 1000,
  ): Promise<void> {
    this.#logger.info(
      `Inserting ${claims.length} claims in batches of ${batchSize}`,
    );

    for (let i = 0; i < claims.length; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);

      const values = batch.map((claim) => ({
        address: claim.address.toLowerCase(),
        amount: BigInt(claim.amount),
        season: claim.season,
        proof: JSON.stringify(claim.proof),
        category: claim.category || "",
        sybilClassification: claim.sybilClassification || "approved",
        flaggedAt: claim.flaggedAt ? new Date(claim.flaggedAt) : undefined,
        flaggingReason: claim.flaggingReason || undefined,
        powerUser: claim.powerUser,
        recallSnapper: claim.recallSnapper,
        aiBuilder: claim.aiBuilder,
        aiExplorer: claim.aiExplorer,
      }));

      await this.#db.insert(airdropClaims).values(values);

      this.#logger.info(
        `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(claims.length / batchSize)}`,
      );
    }

    this.#logger.info("All claims inserted successfully");
  }

  /**
   * Insert or update merkle metadata
   */
  async upsertMetadata(metadata: {
    merkleRoot: string;
    totalAmount: string;
    totalRows: number;
    uniqueAddresses: number;
  }): Promise<void> {
    this.#logger.info("Upserting merkle metadata");

    await this.#db
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
}
