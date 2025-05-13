import { and, asc, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/database/db.js";
import { prices } from "@/database/schema/trading/defs.js";
import { InsertPrice } from "@/database/schema/trading/types.js";
import { SpecificChain } from "@/types/index.js";

/**
 * Repository for price data storage and retrieval
 */

/**
 * Create a new price record
 * @param priceData The price data to store
 * @returns The created price record
 */
export async function create(priceData: InsertPrice) {
  console.log(
    `[PriceRepository] Storing price for ${priceData.token}: $${priceData.price}${priceData.chain ? ` on chain ${priceData.chain}` : ""}${priceData.specificChain ? ` (${priceData.specificChain})` : ""}`,
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
    console.error("[PriceRepository] Error creating price record:", error);
    throw error;
  }
}

/**
 * Get the latest price for a token
 * @param token The token address
 * @param specificChain Specific chain to filter by
 * @returns The latest price record or null if not found
 */
export async function getLatestPrice(
  token: string,
  specificChain: SpecificChain,
) {
  console.log(
    `[PriceRepository] Getting latest price for ${token}${specificChain ? ` on ${specificChain}` : ""}`,
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
    console.error(`[PriceRepository] Error getting latest price:`, error);
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
export async function getPriceHistory(
  token: string,
  hours: number,
  specificChain?: SpecificChain,
) {
  console.log(
    `[PriceRepository] Getting price history for ${token}${specificChain ? ` on ${specificChain}` : ""} (last ${hours} hours)`,
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
export async function getAveragePrice(
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
export async function getPriceChangePercentage(
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
export async function count() {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prices);

    return result?.count ?? 0;
  } catch (error) {
    console.error("[PriceRepository] Error in count:", error);
    throw error;
  }
}
