import { BaseRepository } from '../base-repository';
import { Trade, BlockchainType, SpecificChain } from '../../types';
import { DatabaseRow } from '../types';
import { PoolClient } from 'pg';

/**
 * Trade Repository
 * Handles database operations for trades
 */
export class TradeRepository extends BaseRepository<Trade> {
  constructor() {
    super('trades');
  }

  /**
   * Create a new trade
   * @param trade Trade to create
   * @param client Optional database client for transactions
   */
  async create(trade: Trade, client?: PoolClient): Promise<Trade> {
    try {
      const query = `
        INSERT INTO trades (
          id, team_id, competition_id, from_token, to_token, 
          from_amount, to_amount, price, success, error, reason, timestamp,
          from_chain, to_chain, from_specific_chain, to_specific_chain
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
      `;

      const values = [
        trade.id,
        trade.teamId,
        trade.competitionId,
        trade.fromToken,
        trade.toToken,
        trade.fromAmount,
        trade.toAmount,
        trade.price,
        trade.success,
        trade.error || null,
        trade.reason,
        trade.timestamp,
        trade.fromChain || null,
        trade.toChain || null,
        trade.fromSpecificChain || null,
        trade.toSpecificChain || null,
      ];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return this.mapToEntity(this.toCamelCase(result.rows[0]));
    } catch (error) {
      console.error('[TradeRepository] Error in create:', error);
      throw error;
    }
  }

  /**
   * Get trades for a team
   * @param teamId Team ID
   * @param limit Optional result limit
   * @param offset Optional result offset
   * @param client Optional database client for transactions
   */
  async getTeamTrades(
    teamId: string,
    limit?: number,
    offset?: number,
    client?: PoolClient,
  ): Promise<Trade[]> {
    try {
      let query = `
        SELECT * FROM trades
        WHERE team_id = $1
        ORDER BY timestamp DESC
      `;

      const values: (string | number)[] = [teamId];

      // Add pagination if requested
      if (limit !== undefined) {
        query += ` LIMIT $${values.length + 1}`;
        values.push(limit);
      }

      if (offset !== undefined) {
        query += ` OFFSET $${values.length + 1}`;
        values.push(offset);
      }

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return result.rows.map((row: DatabaseRow) => this.mapToEntity(this.toCamelCase(row)));
    } catch (error) {
      console.error('[TradeRepository] Error in getTeamTrades:', error);
      throw error;
    }
  }

  /**
   * Get trades for a competition
   * @param competitionId Competition ID
   * @param limit Optional result limit
   * @param offset Optional result offset
   * @param client Optional database client for transactions
   */
  async getCompetitionTrades(
    competitionId: string,
    limit?: number,
    offset?: number,
    client?: PoolClient,
  ): Promise<Trade[]> {
    try {
      let query = `
        SELECT * FROM trades
        WHERE competition_id = $1
        ORDER BY timestamp DESC
      `;

      const values: (string | number)[] = [competitionId];

      // Add pagination if requested
      if (limit !== undefined) {
        query += ` LIMIT $${values.length + 1}`;
        values.push(limit);
      }

      if (offset !== undefined) {
        query += ` OFFSET $${values.length + 1}`;
        values.push(offset);
      }

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return result.rows.map((row: DatabaseRow) => this.mapToEntity(this.toCamelCase(row)));
    } catch (error) {
      console.error('[TradeRepository] Error in getCompetitionTrades:', error);
      throw error;
    }
  }

  /**
   * Count trades for a team
   * @param teamId Team ID
   * @param client Optional database client for transactions
   */
  async countTeamTrades(teamId: string, client?: PoolClient): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count FROM trades
        WHERE team_id = $1
      `;

      const values = [teamId];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('[TradeRepository] Error in countTeamTrades:', error);
      throw error;
    }
  }

  /**
   * Map database row to Trade entity
   * @param data Row data with camelCase keys
   */
  protected mapToEntity(data: DatabaseRow): Trade {
    return {
      id: data.id as string,
      teamId: data.teamId as string,
      competitionId: data.competitionId as string,
      fromToken: data.fromToken as string,
      toToken: data.toToken as string,
      fromAmount: parseFloat(String(data.fromAmount)),
      toAmount: parseFloat(String(data.toAmount)),
      price: parseFloat(String(data.price)),
      success: Boolean(data.success),
      error: data.error as string | undefined,
      reason: data.reason as string,
      timestamp: new Date(data.timestamp as string | number | Date),
      // Map chain fields from database to the Trade interface
      fromChain: data.fromChain as BlockchainType,
      toChain: data.toChain as BlockchainType,
      fromSpecificChain: data.fromSpecificChain as SpecificChain,
      toSpecificChain: data.toSpecificChain as SpecificChain,
    };
  }
}
