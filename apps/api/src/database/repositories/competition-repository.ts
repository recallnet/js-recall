import { desc, eq, sql } from "drizzle-orm";

import {
  InsertCompetition,
  type InsertPortfolioSnapshot,
  type InsertPortfolioTokenValue,
  competitionTeams,
  competitions,
  portfolioSnapshots,
  portfolioTokenValues,
} from "@recallnet/comps-db/schema";

import { BaseRepository } from "@/database/base-repository.js";
import { db } from "@/database/db.js";
import { CompetitionStatus } from "@/types/index.js";

/**
 * Competition Repository
 * Handles database operations for competitions
 */
export class CompetitionRepository extends BaseRepository {
  constructor() {
    super();
  }

  /**
   * Find all competitions
   */
  async findAll() {
    return await db.query.competitions.findMany();
  }

  /**
   * Find a competition by ID
   * @param id The ID to search for
   */
  async findById(id: string) {
    return await db.query.competitions.findFirst({
      where: eq(competitions.id, id),
    });
  }

  /**
   * Create a new competition
   * @param competition Competition to create
   */
  async create(competition: InsertCompetition) {
    try {
      const [result] = await db
        .insert(competitions)
        .values(competition)
        .returning();

      if (!result) {
        throw new Error("Failed to create competition - no result returned");
      }

      return result;
    } catch (error) {
      console.error("[CompetitionRepository] Error in create:", error);
      throw error;
    }
  }

  /**
   * Update an existing competition
   * @param competition Competition to update
   */
  async update(competition: InsertCompetition) {
    try {
      const [result] = await db
        .update(competitions)
        .set({
          name: competition.name,
          description: competition.description,
          startDate: competition.startDate,
          endDate: competition.endDate,
          status: competition.status,
          updatedAt: new Date(),
        })
        .where(eq(competitions.id, competition.id))
        .returning();

      if (!result) {
        throw new Error(`Competition with ID ${competition.id} not found`);
      }

      return result;
    } catch (error) {
      console.error("[CompetitionRepository] Error in update:", error);
      throw error;
    }
  }

  /**
   * Add a single team to a competition
   * @param competitionId Competition ID
   * @param teamId Team ID to add
   */
  async addTeamToCompetition(competitionId: string, teamId: string) {
    try {
      await db
        .insert(competitionTeams)
        .values({
          competitionId,
          teamId,
        })
        .onConflictDoNothing();
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
   */
  async addTeams(competitionId: string, teamIds: string[]) {
    try {
      await db.transaction(async (tx) => {
        for (const teamId of teamIds) {
          await tx
            .insert(competitionTeams)
            .values({
              competitionId,
              teamId,
            })
            .onConflictDoNothing();
        }
      });
    } catch (error) {
      console.error("[CompetitionRepository] Error in addTeams:", error);
      throw error;
    }
  }

  /**
   * Get teams in a competition
   * @param competitionId Competition ID
   */
  async getTeams(competitionId: string) {
    try {
      const result = await db
        .select({ teamId: competitionTeams.teamId })
        .from(competitionTeams)
        .where(eq(competitionTeams.competitionId, competitionId));

      return result.map((row) => row.teamId);
    } catch (error) {
      console.error("[CompetitionRepository] Error in getTeams:", error);
      throw error;
    }
  }

  /**
   * Alias for getTeams for better semantic naming
   * @param competitionId Competition ID
   */
  async getCompetitionTeams(competitionId: string) {
    return this.getTeams(competitionId);
  }

  /**
   * Find active competition
   */
  async findActive() {
    try {
      const [result] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.status, CompetitionStatus.ACTIVE))
        .limit(1);

      return result;
    } catch (error) {
      console.error("[CompetitionRepository] Error in findActive:", error);
      throw error;
    }
  }

  /**
   * Create a portfolio snapshot
   * @param snapshot Portfolio snapshot data
   */
  async createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot) {
    try {
      const [result] = await db
        .insert(portfolioSnapshots)
        .values(snapshot)
        .returning();

      if (!result) {
        throw new Error(
          "Failed to create portfolio snapshot - no result returned",
        );
      }

      return result;
    } catch (error) {
      console.error(
        "[CompetitionRepository] Error in createPortfolioSnapshot:",
        error,
      );
      throw error;
    }
  }

  /**
   * Create a portfolio token value
   * @param tokenValue Portfolio token value data
   */
  async createPortfolioTokenValue(tokenValue: InsertPortfolioTokenValue) {
    try {
      const [result] = await db
        .insert(portfolioTokenValues)
        .values(tokenValue)
        .returning();

      if (!result) {
        throw new Error(
          "Failed to create portfolio token value - no result returned",
        );
      }

      return result;
    } catch (error) {
      console.error(
        "[CompetitionRepository] Error in createPortfolioTokenValue:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get latest portfolio snapshots for all teams in a competition
   * @param competitionId Competition ID
   */
  async getLatestPortfolioSnapshots(competitionId: string) {
    try {
      const subquery = db
        .select({
          teamId: portfolioSnapshots.teamId,
          maxTimestamp: sql<Date>`MAX(${portfolioSnapshots.timestamp})`.as(
            "max_timestamp",
          ),
        })
        .from(portfolioSnapshots)
        .where(eq(portfolioSnapshots.competitionId, competitionId))
        .groupBy(portfolioSnapshots.teamId)
        .as("latest_snapshots");

      const result = await db
        .select()
        .from(portfolioSnapshots)
        .innerJoin(
          subquery,
          sql`${portfolioSnapshots.teamId} = ${subquery.teamId} AND ${portfolioSnapshots.timestamp} = ${subquery.maxTimestamp}`,
        )
        .where(eq(portfolioSnapshots.competitionId, competitionId));

      return result.map((row) => row.portfolio_snapshots);
    } catch (error) {
      console.error(
        "[CompetitionRepository] Error in getLatestPortfolioSnapshots:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get portfolio snapshots for a team in a competition
   * @param competitionId Competition ID
   * @param teamId Team ID
   */
  async getTeamPortfolioSnapshots(competitionId: string, teamId: string) {
    try {
      return await db
        .select()
        .from(portfolioSnapshots)
        .where(
          sql`${portfolioSnapshots.competitionId} = ${competitionId} AND ${portfolioSnapshots.teamId} = ${teamId}`,
        )
        .orderBy(desc(portfolioSnapshots.timestamp));
    } catch (error) {
      console.error(
        "[CompetitionRepository] Error in getTeamPortfolioSnapshots:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get portfolio token values for a snapshot
   * @param snapshotId Snapshot ID
   */
  async getPortfolioTokenValues(snapshotId: number) {
    try {
      return await db
        .select()
        .from(portfolioTokenValues)
        .where(eq(portfolioTokenValues.portfolioSnapshotId, snapshotId));
    } catch (error) {
      console.error(
        "[CompetitionRepository] Error in getPortfolioTokenValues:",
        error,
      );
      throw error;
    }
  }

  /**
   * Count total number of competitions
   */
  async count() {
    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(competitions);

      return result?.count ?? 0;
    } catch (error) {
      console.error("[CompetitionRepository] Error in count:", error);
      throw error;
    }
  }

  /**
   * Find competitions by status
   * @param status Competition status
   */
  async findByStatus(status: CompetitionStatus) {
    try {
      return await db
        .select()
        .from(competitions)
        .where(eq(competitions.status, status));
    } catch (error) {
      console.error("[CompetitionRepository] Error in findByStatus:", error);
      throw error;
    }
  }
}
