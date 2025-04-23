import { BaseRepository } from '../base-repository';
import { Balance, SpecificChain } from '../../types';
import { DatabaseRow } from '../types';
import { PoolClient } from 'pg';
import { config } from '../../config';

/**
 * Balance Repository
 * Handles database operations for balances
 */
export class BalanceRepository extends BaseRepository<Balance> {
  constructor() {
    super('balances');
  }

  /**
   * Create or update a balance
   * @param teamId Team ID
   * @param tokenAddress Token address
   * @param amount Amount
   * @param client Optional database client for transactions
   */
  async saveBalance(
    teamId: string,
    tokenAddress: string,
    amount: number,
    client?: PoolClient,
  ): Promise<Balance> {
    try {
      const query = `
        INSERT INTO balances (team_id, token_address, amount)
        VALUES ($1, $2, $3)
        ON CONFLICT (team_id, token_address) 
        DO UPDATE SET amount = $3, updated_at = NOW()
        RETURNING id, team_id, token_address, amount, created_at, updated_at
      `;

      const values = [teamId, tokenAddress, amount];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return this.mapToEntity(this.toCamelCase(result.rows[0]));
    } catch (error) {
      console.error('[BalanceRepository] Error in saveBalance:', error);
      throw error;
    }
  }

  /**
   * Get a specific balance
   * @param teamId Team ID
   * @param tokenAddress Token address
   * @param client Optional database client for transactions
   */
  async getBalance(
    teamId: string,
    tokenAddress: string,
    client?: PoolClient,
  ): Promise<Balance | null> {
    try {
      const query = `
        SELECT id, team_id, token_address, amount, created_at, updated_at
        FROM balances
        WHERE team_id = $1 AND token_address = $2
      `;

      const values = [teamId, tokenAddress];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return result.rows.length > 0 ? this.mapToEntity(this.toCamelCase(result.rows[0])) : null;
    } catch (error) {
      console.error('[BalanceRepository] Error in getBalance:', error);
      throw error;
    }
  }

  /**
   * Get all balances for a team
   * @param teamId Team ID
   * @param client Optional database client for transactions
   */
  async getTeamBalances(teamId: string, client?: PoolClient): Promise<Balance[]> {
    try {
      const query = `
        SELECT id, team_id, token_address, amount, created_at, updated_at
        FROM balances
        WHERE team_id = $1
      `;

      const values = [teamId];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return result.rows.map((row: DatabaseRow) => this.mapToEntity(this.toCamelCase(row)));
    } catch (error) {
      console.error('[BalanceRepository] Error in getTeamBalances:', error);
      throw error;
    }
  }

  /**
   * Initialize default balances for a team
   * @param teamId Team ID
   * @param initialBalances Map of token addresses to amounts
   * @param client Optional database client for transactions
   */
  async initializeTeamBalances(
    teamId: string,
    initialBalances: Map<string, number>,
    client?: PoolClient,
  ): Promise<void> {
    try {
      // Use a transaction if no client is provided
      if (!client) {
        await this.db.transaction(async (transactionClient) => {
          await this.initializeBalancesInTransaction(teamId, initialBalances, transactionClient);
        });
      } else {
        await this.initializeBalancesInTransaction(teamId, initialBalances, client);
      }
    } catch (error) {
      console.error('[BalanceRepository] Error in initializeTeamBalances:', error);
      throw error;
    }
  }

  /**
   * Initialize balances within a transaction
   * @param teamId Team ID
   * @param initialBalances Map of token addresses to amounts
   * @param client Database client for the transaction
   */
  private async initializeBalancesInTransaction(
    teamId: string,
    initialBalances: Map<string, number>,
    client: PoolClient,
  ): Promise<void> {
    for (const [tokenAddress, amount] of initialBalances.entries()) {
      // Determine the specific chain for this token
      const specificChain = this.getTokenSpecificChain(tokenAddress);

      const query = `
        INSERT INTO balances (team_id, token_address, amount, specific_chain)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (team_id, token_address) 
        DO UPDATE SET amount = $3, specific_chain = $4, updated_at = NOW()
      `;

      await client.query(query, [teamId, tokenAddress, amount, specificChain]);
    }
  }

  /**
   * Determine the specific chain for a token address based on token patterns
   * @param tokenAddress The token address
   * @returns The specific chain string or null if not determined
   */
  private getTokenSpecificChain(tokenAddress: string): string | null {
    const token = tokenAddress.toLowerCase();

    // Check each chain's tokens to find a match
    const specificChainTokens = config.specificChainTokens;

    for (const [chain, tokens] of Object.entries(specificChainTokens)) {
      // Check all tokens for this chain
      for (const [symbol, address] of Object.entries(tokens)) {
        if (address.toLowerCase() === token) {
          return chain;
        }
      }
    }

    console.log(
      `[BalanceRepository] Could not determine specific chain for token: ${tokenAddress}`,
    );
    return null;
  }

  /**
   * Reset balances for a team
   * @param teamId Team ID
   * @param initialBalances Map of token addresses to amounts
   * @param client Optional database client for transactions
   */
  async resetTeamBalances(
    teamId: string,
    initialBalances: Map<string, number>,
    client?: PoolClient,
  ): Promise<void> {
    try {
      // Use a transaction if no client is provided
      if (!client) {
        await this.db.transaction(async (transactionClient) => {
          // First delete all current balances
          await transactionClient.query('DELETE FROM balances WHERE team_id = $1', [teamId]);

          // Then initialize new ones
          await this.initializeBalancesInTransaction(teamId, initialBalances, transactionClient);
        });
      } else {
        // First delete all current balances
        await client.query('DELETE FROM balances WHERE team_id = $1', [teamId]);

        // Then initialize new ones
        await this.initializeBalancesInTransaction(teamId, initialBalances, client);
      }
    } catch (error) {
      console.error('[BalanceRepository] Error in resetTeamBalances:', error);
      throw error;
    }
  }

  /**
   * Map database row to Balance entity
   * @param data Row data with camelCase keys
   */
  protected mapToEntity(data: DatabaseRow): Balance {
    return {
      token: data.tokenAddress as string,
      amount: parseFloat(String(data.amount)),
    };
  }
}
