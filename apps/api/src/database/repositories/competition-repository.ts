import { BaseRepository } from '../base-repository';
import { Competition, CompetitionStatus, SpecificChain } from '../../types';
import { PortfolioSnapshot, PortfolioTokenValue, DatabaseRow } from '../types';
import { PoolClient } from 'pg';

/**
 * Competition Repository
 * Handles database operations for competitions
 */
export class CompetitionRepository extends BaseRepository<Competition> {
  constructor() {
    super('competitions');
  }

  /**
   * Create a new competition
   * @param competition Competition to create
   * @param client Optional database client for transactions
   */
  async create(competition: Competition, client?: PoolClient): Promise<Competition> {
    try {
      const query = `
        INSERT INTO competitions (
          id, name, description, start_date, end_date, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *
      `;

      const values = [
        competition.id,
        competition.name,
        competition.description || null,
        competition.startDate,
        competition.endDate,
        competition.status,
        competition.createdAt,
        competition.updatedAt,
      ];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return this.mapToEntity(this.toCamelCase(result.rows[0]));
    } catch (error) {
      console.error('[CompetitionRepository] Error in create:', error);
      throw error;
    }
  }

  /**
   * Update an existing competition
   * @param competition Competition to update
   * @param client Optional database client for transactions
   */
  async update(competition: Competition, client?: PoolClient): Promise<Competition> {
    try {
      const query = `
        UPDATE competitions SET
          name = $1,
          description = $2,
          start_date = $3,
          end_date = $4,
          status = $5,
          updated_at = $6
        WHERE id = $7
        RETURNING *
      `;

      const values = [
        competition.name,
        competition.description || null,
        competition.startDate,
        competition.endDate,
        competition.status,
        new Date(),
        competition.id,
      ];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error(`Competition with ID ${competition.id} not found`);
      }

      return this.mapToEntity(this.toCamelCase(result.rows[0]));
    } catch (error) {
      console.error('[CompetitionRepository] Error in update:', error);
      throw error;
    }
  }

  /**
   * Add a single team to a competition
   * @param competitionId Competition ID
   * @param teamId Team ID to add
   * @param client Optional database client for transactions
   */
  async addTeamToCompetition(
    competitionId: string,
    teamId: string,
    client?: PoolClient,
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO competition_teams (competition_id, team_id)
        VALUES ($1, $2)
        ON CONFLICT (competition_id, team_id) DO NOTHING
      `;

      if (client) {
        await client.query(query, [competitionId, teamId]);
      } else {
        await this.db.query(query, [competitionId, teamId]);
      }
    } catch (error) {
      console.error(
        `[CompetitionRepository] Error adding team ${teamId} to competition ${competitionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add teams to a competition
   * @param competitionId Competition ID
   * @param teamIds Array of team IDs
   * @param client Optional database client for transactions
   */
  async addTeams(competitionId: string, teamIds: string[], client?: PoolClient): Promise<void> {
    try {
      // Use a transaction if no client is provided
      if (!client) {
        await this.db.transaction(async (transactionClient) => {
          await this.addTeamsInTransaction(competitionId, teamIds, transactionClient);
        });
      } else {
        await this.addTeamsInTransaction(competitionId, teamIds, client);
      }
    } catch (error) {
      console.error('[CompetitionRepository] Error in addTeams:', error);
      throw error;
    }
  }

  /**
   * Add teams to a competition within a transaction
   * @param competitionId Competition ID
   * @param teamIds Array of team IDs
   * @param client Database client for the transaction
   */
  private async addTeamsInTransaction(
    competitionId: string,
    teamIds: string[],
    client: PoolClient,
  ): Promise<void> {
    for (const teamId of teamIds) {
      const query = `
        INSERT INTO competition_teams (competition_id, team_id)
        VALUES ($1, $2)
        ON CONFLICT (competition_id, team_id) DO NOTHING
      `;

      await client.query(query, [competitionId, teamId]);
    }
  }

  /**
   * Get teams in a competition
   * @param competitionId Competition ID
   * @param client Optional database client for transactions
   */
  async getTeams(competitionId: string, client?: PoolClient): Promise<string[]> {
    try {
      const query = `
        SELECT team_id FROM competition_teams
        WHERE competition_id = $1
      `;

      const result = client
        ? await client.query(query, [competitionId])
        : await this.db.query(query, [competitionId]);

      return result.rows.map((row: { team_id: string }) => row.team_id);
    } catch (error) {
      console.error('[CompetitionRepository] Error in getTeams:', error);
      throw error;
    }
  }

  /**
   * Alias for getTeams for better semantic naming
   * @param competitionId Competition ID
   */
  async getCompetitionTeams(competitionId: string): Promise<string[]> {
    return this.getTeams(competitionId);
  }

  /**
   * Find active competition
   * @param client Optional database client for transactions
   */
  async findActive(client?: PoolClient): Promise<Competition | null> {
    try {
      const query = `
        SELECT * FROM competitions
        WHERE status = $1
        LIMIT 1
      `;

      const result = client
        ? await client.query(query, [CompetitionStatus.ACTIVE])
        : await this.db.query(query, [CompetitionStatus.ACTIVE]);

      return result.rows.length > 0 ? this.mapToEntity(this.toCamelCase(result.rows[0])) : null;
    } catch (error) {
      console.error('[CompetitionRepository] Error in findActive:', error);
      throw error;
    }
  }

  /**
   * Create a portfolio snapshot
   * @param snapshot The portfolio snapshot to create
   * @param client Optional database client for transactions
   */
  async createPortfolioSnapshot(
    snapshot: Omit<PortfolioSnapshot, 'id'>,
    client?: PoolClient,
  ): Promise<PortfolioSnapshot> {
    try {
      const query = `
        INSERT INTO portfolio_snapshots (
          team_id, competition_id, timestamp, total_value
        ) VALUES (
          $1, $2, $3, $4
        ) RETURNING *
      `;

      const values = [
        snapshot.teamId,
        snapshot.competitionId,
        snapshot.timestamp,
        snapshot.totalValue,
      ];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      const row = this.toCamelCase(result.rows[0]);
      return {
        id: row.id as number,
        teamId: row.teamId as string,
        competitionId: row.competitionId as string,
        timestamp: new Date(row.timestamp as string | number | Date),
        totalValue: parseFloat(String(row.totalValue)),
      };
    } catch (error) {
      console.error('[CompetitionRepository] Error creating portfolio snapshot:', error);
      throw error;
    }
  }

  /**
   * Create a portfolio token value record
   * @param tokenValue The token value to create
   * @param client Optional database client for transactions
   */
  async createPortfolioTokenValue(
    tokenValue: Omit<PortfolioTokenValue, 'id'>,
    client?: PoolClient,
  ): Promise<PortfolioTokenValue> {
    try {
      const query = `
        INSERT INTO portfolio_token_values (
          portfolio_snapshot_id, token_address, amount, value_usd, price, specific_chain
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        ) RETURNING *
      `;

      const values = [
        tokenValue.portfolioSnapshotId,
        tokenValue.tokenAddress,
        tokenValue.amount,
        tokenValue.valueUsd,
        tokenValue.price,
        tokenValue.specificChain,
      ];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      const row = this.toCamelCase(result.rows[0]);
      return {
        id: row.id as number,
        portfolioSnapshotId: row.portfolioSnapshotId as number,
        tokenAddress: row.tokenAddress as string,
        amount: parseFloat(String(row.amount)),
        valueUsd: parseFloat(String(row.valueUsd)),
        price: parseFloat(String(row.price)),
        specificChain: row.specificChain as SpecificChain,
      };
    } catch (error) {
      console.error('[CompetitionRepository] Error creating portfolio token value:', error);
      throw error;
    }
  }

  /**
   * Get the latest portfolio snapshots for each team in a competition
   * @param competitionId The competition ID
   * @param client Optional database client for transactions
   */
  async getLatestPortfolioSnapshots(
    competitionId: string,
    client?: PoolClient,
  ): Promise<PortfolioSnapshot[]> {
    try {
      // This query gets the latest snapshot for each team
      const query = `
        WITH latest_snapshots AS (
          SELECT 
            team_id,
            MAX(timestamp) as latest_timestamp
          FROM portfolio_snapshots
          WHERE competition_id = $1
          GROUP BY team_id
        )
        SELECT ps.*
        FROM portfolio_snapshots ps
        JOIN latest_snapshots ls
          ON ps.team_id = ls.team_id
          AND ps.timestamp = ls.latest_timestamp
        WHERE ps.competition_id = $1
      `;

      const result = client
        ? await client.query(query, [competitionId])
        : await this.db.query(query, [competitionId]);

      return result.rows.map((row: DatabaseRow) => {
        const camelRow = this.toCamelCase(row);
        return {
          id: camelRow.id as number,
          teamId: camelRow.teamId as string,
          competitionId: camelRow.competitionId as string,
          timestamp: new Date(camelRow.timestamp as string | number | Date),
          totalValue: parseFloat(String(camelRow.totalValue)),
        };
      });
    } catch (error) {
      console.error(
        `[CompetitionRepository] Error getting latest portfolio snapshots for competition ${competitionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get portfolio snapshots for a team in a competition
   * @param competitionId The competition ID
   * @param teamId The team ID
   * @param client Optional database client for transactions
   */
  async getTeamPortfolioSnapshots(
    competitionId: string,
    teamId: string,
    client?: PoolClient,
  ): Promise<PortfolioSnapshot[]> {
    try {
      const query = `
        SELECT *
        FROM portfolio_snapshots
        WHERE competition_id = $1 AND team_id = $2
        ORDER BY timestamp ASC
      `;

      const result = client
        ? await client.query(query, [competitionId, teamId])
        : await this.db.query(query, [competitionId, teamId]);

      return result.rows.map((row: DatabaseRow) => {
        const camelRow = this.toCamelCase(row);
        return {
          id: camelRow.id as number,
          teamId: camelRow.teamId as string,
          competitionId: camelRow.competitionId as string,
          timestamp: new Date(camelRow.timestamp as string | number | Date),
          totalValue: parseFloat(String(camelRow.totalValue)),
        };
      });
    } catch (error) {
      console.error(
        `[CompetitionRepository] Error getting team portfolio snapshots for team ${teamId} in competition ${competitionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get token values for a portfolio snapshot
   * @param snapshotId The portfolio snapshot ID
   * @param client Optional database client for transactions
   */
  async getPortfolioTokenValues(
    snapshotId: number,
    client?: PoolClient,
  ): Promise<PortfolioTokenValue[]> {
    try {
      const query = `
        SELECT *
        FROM portfolio_token_values
        WHERE portfolio_snapshot_id = $1
      `;

      const result = client
        ? await client.query(query, [snapshotId])
        : await this.db.query(query, [snapshotId]);

      return result.rows.map((row: DatabaseRow) => {
        const camelRow = this.toCamelCase(row);
        return {
          id: camelRow.id as number,
          portfolioSnapshotId: camelRow.portfolioSnapshotId as number,
          tokenAddress: camelRow.tokenAddress as string,
          amount: parseFloat(camelRow.amount as string),
          valueUsd: parseFloat(camelRow.valueUsd as string),
          price: parseFloat(camelRow.price as string),
          specificChain: camelRow.specificChain as SpecificChain,
        };
      });
    } catch (error) {
      console.error(
        `[CompetitionRepository] Error getting portfolio token values for snapshot ${snapshotId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Count the number of competitions
   * @returns The count of competitions
   */
  async count(): Promise<number> {
    try {
      const query = `SELECT COUNT(*) FROM competitions`;
      const result = await this.db.query(query);
      return parseInt(result.rows[0].count as string, 10);
    } catch (error) {
      console.error('[CompetitionRepository] Error counting competitions:', error);
      throw error;
    }
  }

  /**
   * Map database row to Competition entity
   * @param data Row data with camelCase keys
   */
  protected mapToEntity(data: DatabaseRow): Competition {
    return {
      id: data.id as string,
      name: data.name as string,
      description: data.description as string | undefined,
      startDate: data.startDate ? new Date(data.startDate as string | number | Date) : null,
      endDate: data.endDate ? new Date(data.endDate as string | number | Date) : null,
      status: data.status as CompetitionStatus,
      createdAt: new Date(data.createdAt as string | number | Date),
      updatedAt: new Date(data.updatedAt as string | number | Date),
    };
  }
}
