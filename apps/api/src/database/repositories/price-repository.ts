import { BaseRepository } from '../base-repository';
import { BlockchainType, SpecificChain } from '../../types';
import { PriceRecord, DatabaseRow } from '../types';
import { PoolClient } from 'pg';

/**
 * Type for SQL query parameters
 */
type SqlParams = (string | number | Date | null | undefined)[];

/**
 * Repository for price data storage and retrieval
 */
export class PriceRepository extends BaseRepository<PriceRecord> {
  constructor() {
    super('prices');
    console.log('[PriceRepository] Initialized');
  }

  /**
   * Create a new price record
   * @param priceData The price data to store
   * @returns The created price record
   */
  async create(priceData: PriceRecord): Promise<PriceRecord> {
    console.log(
      `[PriceRepository] Storing price for ${priceData.token}: $${priceData.price}${priceData.chain ? ` on chain ${priceData.chain}` : ''}${priceData.specificChain ? ` (${priceData.specificChain})` : ''}`,
    );

    try {
      let query: string;
      let values: SqlParams;

      query = `
          INSERT INTO prices (token, price, timestamp, chain, specific_chain)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, token, price, timestamp, chain, specific_chain
        `;

      values = [
        priceData.token,
        priceData.price,
        priceData.timestamp,
        priceData.chain,
        priceData.specificChain,
      ];

      const result = await this.db.query(query, values);
      return this.mapToEntity(this.toCamelCase(result.rows[0]));
    } catch (error) {
      console.error('[PriceRepository] Error creating price record:', error);
      throw error;
    }
  }

  /**
   * Check if a column exists in a table
   * @param tableName The table name
   * @param columnName The column name
   * @returns True if the column exists, false otherwise
   */
  private async checkIfColumnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = $1
            AND column_name = $2
        ) as column_exists;
      `;

      const result = await this.db.query(query, [tableName, columnName]);
      return result.rows[0].column_exists as boolean;
    } catch (error) {
      console.error(
        `[PriceRepository] Error checking if column ${columnName} exists in table ${tableName}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get the latest price for a token
   * @param token The token address
   * @param specificChain Optional specific chain to filter by
   * @returns The latest price record or null if not found
   */
  async getLatestPrice(token: string, specificChain?: SpecificChain): Promise<PriceRecord | null> {
    console.log(
      `[PriceRepository] Getting latest price for ${token}${specificChain ? ` on ${specificChain}` : ''}`,
    );

    try {
      // Check if specific_chain column exists
      const specificChainColumnExists = await this.checkIfColumnExists('prices', 'specific_chain');

      let query: string;
      let values: SqlParams;

      if (specificChainColumnExists && specificChain) {
        // If we have specific chain column and a specific chain is requested
        query = `
          SELECT id, token, price, timestamp, chain, specific_chain
          FROM prices
          WHERE token = $1 AND specific_chain = $2
          ORDER BY timestamp DESC
          LIMIT 1
        `;
        values = [token, specificChain];
      } else if (specificChainColumnExists) {
        // If specific_chain column exists but no specific chain is requested
        query = `
          SELECT id, token, price, timestamp, chain, specific_chain
          FROM prices
          WHERE token = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `;
        values = [token];
      } else {
        // If specific_chain column doesn't exist, use only available columns
        query = `
          SELECT id, token, price, timestamp, chain
          FROM prices
          WHERE token = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `;
        values = [token];
      }

      const result = await this.db.query(query, values);
      if (result.rows.length === 0) return null;

      return this.mapToEntity(this.toCamelCase(result.rows[0]));
    } catch (error) {
      console.error('[PriceRepository] Error getting latest price:', error);
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
  ): Promise<PriceRecord[]> {
    console.log(
      `[PriceRepository] Getting price history for ${token}${specificChain ? ` on ${specificChain}` : ''} (last ${hours} hours)`,
    );

    try {
      // Check if specific_chain column exists
      const specificChainColumnExists = await this.checkIfColumnExists('prices', 'specific_chain');

      let query: string;
      let values: SqlParams;

      if (specificChainColumnExists && specificChain) {
        // If we have specific chain column and a specific chain is requested
        query = `
          SELECT id, token, price, timestamp, chain, specific_chain
          FROM prices
          WHERE token = $1 
            AND specific_chain = $2
            AND timestamp > NOW() - INTERVAL '${hours} hours'
          ORDER BY timestamp ASC
        `;
        values = [token, specificChain];
      } else if (specificChainColumnExists) {
        // If specific_chain column exists but no specific chain is requested
        query = `
          SELECT id, token, price, timestamp, chain, specific_chain
          FROM prices
          WHERE token = $1
            AND timestamp > NOW() - INTERVAL '${hours} hours'
          ORDER BY timestamp ASC
        `;
        values = [token];
      } else {
        // If specific_chain column doesn't exist, use only available columns
        query = `
          SELECT id, token, price, timestamp, chain
          FROM prices
          WHERE token = $1
            AND timestamp > NOW() - INTERVAL '${hours} hours'
          ORDER BY timestamp ASC
        `;
        values = [token];
      }

      const result = await this.db.query(query, values);
      return result.rows.map((row: DatabaseRow) => this.mapToEntity(this.toCamelCase(row)));
    } catch (error) {
      console.error('[PriceRepository] Error getting price history:', error);
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
      // Check if specific_chain column exists
      const specificChainColumnExists = await this.checkIfColumnExists('prices', 'specific_chain');

      let query: string;
      let values: SqlParams;

      if (specificChainColumnExists && specificChain) {
        query = `
          SELECT AVG(price) as avg_price
          FROM prices
          WHERE token = $1
            AND specific_chain = $2
            AND timestamp > NOW() - INTERVAL '${hours} hours'
        `;
        values = [token, specificChain];
      } else {
        query = `
          SELECT AVG(price) as avg_price
          FROM prices
          WHERE token = $1
            AND timestamp > NOW() - INTERVAL '${hours} hours'
        `;
        values = [token];
      }

      const result = await this.db.query(query, values);
      if (!result.rows[0].avg_price) return null;

      return parseFloat(result.rows[0].avg_price as string);
    } catch (error) {
      console.error(`[PriceRepository] Error getting average price for ${token}:`, error);
      return null;
    }
  }

  /**
   * Get price change percentage for a token
   * @param token The token address
   * @param hours The number of hours to compare
   * @param specificChain Optional specific chain to filter by
   * @returns The price change percentage or null if not enough data
   */
  async getPriceChangePercentage(
    token: string,
    hours: number,
    specificChain?: SpecificChain,
  ): Promise<number | null> {
    try {
      // First, get the latest price
      const latestPriceRecord = await this.getLatestPrice(token, specificChain);
      if (!latestPriceRecord) return null;

      // Check if specific_chain column exists
      const specificChainColumnExists = await this.checkIfColumnExists('prices', 'specific_chain');

      let query: string;
      let values: SqlParams;

      // Then get the earliest price in the specified time period
      if (specificChainColumnExists && specificChain) {
        query = `
          SELECT price
          FROM prices
          WHERE token = $1
            AND specific_chain = $2
            AND timestamp > NOW() - INTERVAL '${hours} hours'
          ORDER BY timestamp ASC
          LIMIT 1
        `;
        values = [token, specificChain];
      } else {
        query = `
          SELECT price
          FROM prices
          WHERE token = $1
            AND timestamp > NOW() - INTERVAL '${hours} hours'
          ORDER BY timestamp ASC
          LIMIT 1
        `;
        values = [token];
      }

      const result = await this.db.query(query, values);
      if (result.rows.length === 0) return null;

      const earliestPrice = parseFloat(result.rows[0].price as string);
      const latestPrice = latestPriceRecord.price;

      // Calculate percentage change
      return ((latestPrice - earliestPrice) / earliestPrice) * 100;
    } catch (error) {
      console.error(`[PriceRepository] Error calculating price change for ${token}:`, error);
      return null;
    }
  }

  /**
   * Count the number of price records
   * @returns The count of price records
   */
  async count(): Promise<number> {
    try {
      const query = `SELECT COUNT(*) FROM prices`;
      const result = await this.db.query(query);
      return parseInt(result.rows[0].count as string, 10);
    } catch (error) {
      console.error('[PriceRepository] Error counting records:', error);
      throw error;
    }
  }

  /**
   * Map database row to PriceRecord entity
   * @param data Row data with camelCase keys
   */
  protected mapToEntity(data: DatabaseRow): PriceRecord {
    return {
      id: data.id as number | undefined,
      token: data.token as string,
      price: parseFloat(String(data.price)),
      timestamp: new Date(data.timestamp as string | number | Date),
      chain: data.chain as BlockchainType,
      specificChain: data.specificChain as SpecificChain,
    };
  }
}
