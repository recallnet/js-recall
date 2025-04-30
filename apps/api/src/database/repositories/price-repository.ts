import { and, asc, desc, eq, sql } from "drizzle-orm";

import {
  InsertPrice,
  type SelectPrice,
  prices,
} from "@recallnet/comps-db/schema";

import { BaseRepository } from "@/database/base-repository.js";
import { SpecificChain } from "@/types/index.js";

/**
 * Repository for price data storage and retrieval
 */
export class PriceRepository extends BaseRepository {
  constructor() {
    super();
    console.log("[PriceRepository] Initialized");
  }

  /**
   * Create a new price record
   * @param priceData The price data to store
   * @returns The created price record
   */
  async create(priceData: InsertPrice): Promise<SelectPrice> {
    console.log(
      `[PriceRepository] Storing price for ${priceData.token}: $${priceData.price}${priceData.chain ? ` on chain ${priceData.chain}` : ""}${priceData.specificChain ? ` (${priceData.specificChain})` : ""}`,
    );

    try {
      const result = await this.dbConn.db
        .insert(prices)
        .values(priceData)
        .returning();

      if (!result[0]) {
        throw new Error("No price record returned");
      }

      return result[0];
    } catch (error) {
      console.error("[PriceRepository] Error creating price record:", error);
      throw error;
    }
  }

  /**
   * Get the latest price for a token
   * @param token The token address
   * @param specificChain Optional specific chain to filter by
   * @returns The latest price record or null if not found
   */
  async getLatestPrice(
    token: string,
    specificChain?: SpecificChain,
  ): Promise<SelectPrice | null> {
    console.log(
      `[PriceRepository] Getting latest price for ${token}${specificChain ? ` on ${specificChain}` : ""}`,
    );

    try {
      const query = this.dbConn.db
        .select()
        .from(prices)
        .where(
          specificChain
            ? and(
                eq(prices.token, token),
                eq(prices.specificChain, specificChain),
              )
            : eq(prices.token, token),
        )
        .orderBy(desc(prices.timestamp))
        .limit(1);

      const result = await query;
      return result[0] || null;
    } catch (error) {
      console.error("[PriceRepository] Error getting latest price:", error);
      throw error;
    }
  }

  /**
   * Get price history for a token
   * @param token The token address
   * @param hours The number of hours to look back
   * @param specificChain Optional specific chain to filter by
   * @returns Array of price records
   */
  async getPriceHistory(
    token: string,
    hours: number,
    specificChain?: SpecificChain,
  ): Promise<SelectPrice[]> {
    console.log(
      `[PriceRepository] Getting price history for ${token}${specificChain ? ` on ${specificChain}` : ""} (last ${hours} hours)`,
    );

    try {
      const query = this.dbConn.db
        .select()
        .from(prices)
        .where(
          and(
            eq(prices.token, token),
            sql`${prices.timestamp} > NOW() - INTERVAL '${hours} hours'`,
            ...(specificChain ? [eq(prices.specificChain, specificChain)] : []),
          ),
        )
        .orderBy(asc(prices.timestamp));

      return await query;
    } catch (error) {
      console.error("[PriceRepository] Error getting price history:", error);
      throw error;
    }
  }

  /**
   * Get average price for a token over a time period
   * @param token The token address
   * @param hours The number of hours to look back
   * @param specificChain Optional specific chain to filter by
   * @returns The average price or null if no data
   */
  async getAveragePrice(
    token: string,
    hours: number,
    specificChain?: SpecificChain,
  ): Promise<number | null> {
    try {
      const result = await this.dbConn.db
        .select({
          avgPrice: sql<number>`AVG(${prices.price})`,
        })
        .from(prices)
        .where(
          and(
            eq(prices.token, token),
            sql`${prices.timestamp} > NOW() - INTERVAL '${hours} hours'`,
            ...(specificChain ? [eq(prices.specificChain, specificChain)] : []),
          ),
        );

      return result[0]?.avgPrice ?? null;
    } catch (error) {
      console.error("[PriceRepository] Error getting average price:", error);
      throw error;
    }
  }

  /**
   * Get price change percentage for a token over a time period
   * @param token The token address
   * @param hours The number of hours to look back
   * @param specificChain Optional specific chain to filter by
   * @returns The price change percentage or null if insufficient data
   */
  async getPriceChangePercentage(
    token: string,
    hours: number,
    specificChain?: SpecificChain,
  ): Promise<number | null> {
    try {
      const result = await this.dbConn.db
        .select({
          firstPrice: sql<number>`FIRST_VALUE(${prices.price}) OVER (ORDER BY ${prices.timestamp} ASC)`,
          lastPrice: sql<number>`FIRST_VALUE(${prices.price}) OVER (ORDER BY ${prices.timestamp} DESC)`,
        })
        .from(prices)
        .where(
          and(
            eq(prices.token, token),
            sql`${prices.timestamp} > NOW() - INTERVAL '${hours} hours'`,
            ...(specificChain ? [eq(prices.specificChain, specificChain)] : []),
          ),
        )
        .limit(1);

      if (!result[0]) {
        return null;
      }

      const { firstPrice, lastPrice } = result[0];
      if (!firstPrice || !lastPrice) {
        return null;
      }

      return ((lastPrice - firstPrice) / firstPrice) * 100;
    } catch (error) {
      console.error(
        "[PriceRepository] Error getting price change percentage:",
        error,
      );
      throw error;
    }
  }

  /**
   * Count total number of price records
   */
  async count(): Promise<number> {
    try {
      const result = await this.dbConn.db
        .select({ count: sql<number>`count(*)` })
        .from(prices);

      return result[0]?.count ?? 0;
    } catch (error) {
      console.error("[PriceRepository] Error in count:", error);
      throw error;
    }
  }
}
