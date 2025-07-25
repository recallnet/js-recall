import { and, asc, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/database/db.js";
import { prices } from "@/database/schema/trading/defs.js";
import { InsertPrice } from "@/database/schema/trading/types.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import { SpecificChain } from "@/types/index.js";

/**
 * Repository for price data storage and retrieval
 */

/**
 * Create a new price record
 * @param priceData The price data to store
 * @returns The created price record
 */
async function createImpl(priceData: InsertPrice) {
  repositoryLogger.debug(
    `Storing price for ${priceData.token}: $${priceData.price}${priceData.chain ? ` on chain ${priceData.chain}` : ""}${priceData.specificChain ? ` (${priceData.specificChain})` : ""}`,
  );

  try {
    const [result] = await db
      .insert(prices)
      .values({
        ...priceData,
        timestamp: priceData.timestamp || new Date(),
      })
      .returning();

    if (!result) {
      throw new Error("No price record returned");
    }

    return result;
  } catch (error) {
    repositoryLogger.error("Error creating price record:", error);
    throw error;
  }
}

/**
 * Create multiple price records in a single batch operation
 * @param pricesData Array of price data to store
 * @returns Array of created price records
 */
export async function createBatch(pricesData: InsertPrice[]) {
  if (pricesData.length === 0) {
    return [];
  }

  repositoryLogger.debug(`Storing ${pricesData.length} price records in batch`);

  try {
    const results = await db
      .insert(prices)
      .values(
        pricesData.map((priceData) => ({
          ...priceData,
          timestamp: priceData.timestamp || new Date(),
        })),
      )
      .returning();

    return results;
  } catch (error) {
    repositoryLogger.error("Error creating price records in batch:", error);
    throw error;
  }
}

/**
 * Get the latest price for a token
 * @param token The token address
 * @param specificChain Specific chain to filter by
 * @returns The latest price record or null if not found
 */
async function getLatestPriceImpl(token: string, specificChain: SpecificChain) {
  repositoryLogger.debug(
    `Getting latest price for ${token}${specificChain ? ` on ${specificChain}` : ""}`,
  );

  try {
    const result = await db
      .select()
      .from(prices)
      .where(
        and(eq(prices.token, token), eq(prices.specificChain, specificChain)),
      )
      .orderBy(desc(prices.timestamp))
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    const priceRecord = result[0]!;
    return priceRecord;
  } catch (error) {
    repositoryLogger.error(`Error getting latest price:`, error);
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
async function getPriceHistoryImpl(
  token: string,
  hours: number,
  specificChain?: SpecificChain,
) {
  repositoryLogger.debug(
    `Getting price history for ${token}${specificChain ? ` on ${specificChain}` : ""} (last ${hours} hours)`,
  );

  try {
    return await db
      .select()
      .from(prices)
      .where(
        and(
          eq(prices.token, token),
          gt(prices.timestamp, sql`now() - interval '${hours} hours'`),
          ...(specificChain ? [eq(prices.specificChain, specificChain)] : []),
        ),
      )
      .orderBy(asc(prices.timestamp));
  } catch (error) {
    repositoryLogger.error("Error getting price history:", error);
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
async function getAveragePriceImpl(
  token: string,
  hours: number,
  specificChain?: SpecificChain,
) {
  try {
    const [result] = await db
      .select({
        avgPrice: sql<number>`AVG(${prices.price})`,
      })
      .from(prices)
      .where(
        and(
          eq(prices.token, token),
          gt(prices.timestamp, sql`now() - interval '${hours} hours'`),
          ...(specificChain ? [eq(prices.specificChain, specificChain)] : []),
        ),
      );

    return result?.avgPrice;
  } catch (error) {
    repositoryLogger.error("Error getting average price:", error);
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
async function getPriceChangePercentageImpl(
  token: string,
  hours: number,
  specificChain?: SpecificChain,
) {
  try {
    const [result] = await db
      .select({
        firstPrice: sql<number>`FIRST_VALUE(${prices.price}) OVER (ORDER BY ${prices.timestamp} ASC)`,
        lastPrice: sql<number>`FIRST_VALUE(${prices.price}) OVER (ORDER BY ${prices.timestamp} DESC)`,
      })
      .from(prices)
      .where(
        and(
          eq(prices.token, token),
          gt(prices.timestamp, sql`now() - interval '${hours} hours'`),
          ...(specificChain ? [eq(prices.specificChain, specificChain)] : []),
        ),
      )
      .limit(1);

    if (!result) {
      return undefined;
    }

    const { firstPrice, lastPrice } = result;

    return ((lastPrice - firstPrice) / firstPrice) * 100;
  } catch (error) {
    repositoryLogger.error("Error getting price change percentage:", error);
    throw error;
  }
}

/**
 * Count total number of price records
 */
async function countImpl() {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prices);

    return result?.count ?? 0;
  } catch (error) {
    repositoryLogger.error("Error in count:", error);
    throw error;
  }
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const create = createTimedRepositoryFunction(
  createImpl,
  "PriceRepository",
  "create",
);

export const getLatestPrice = createTimedRepositoryFunction(
  getLatestPriceImpl,
  "PriceRepository",
  "getLatestPrice",
);

export const getPriceHistory = createTimedRepositoryFunction(
  getPriceHistoryImpl,
  "PriceRepository",
  "getPriceHistory",
);

export const getAveragePrice = createTimedRepositoryFunction(
  getAveragePriceImpl,
  "PriceRepository",
  "getAveragePrice",
);

export const getPriceChangePercentage = createTimedRepositoryFunction(
  getPriceChangePercentageImpl,
  "PriceRepository",
  "getPriceChangePercentage",
);

export const count = createTimedRepositoryFunction(
  countImpl,
  "PriceRepository",
  "count",
);
