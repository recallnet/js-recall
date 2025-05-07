import { and, desc, eq, max, sql } from "drizzle-orm";

import {
  InsertCompetition,
  type InsertPortfolioSnapshot,
  type InsertPortfolioTokenValue,
  competitionTeams,
  competitions,
  portfolioSnapshots,
  portfolioTokenValues,
} from "@recallnet/comps-db/schema";

import { db } from "@/database/db.js";
import { CompetitionStatus } from "@/types/index.js";

import { PartialExcept } from "./types.js";

/**
 * Competition Repository
 * Handles database operations for competitions
 */

/**
 * Find all competitions
 */
export async function findAll() {
  return await db.query.competitions.findMany();
}

/**
 * Find a competition by ID
 * @param id The ID to search for
 */
export async function findById(id: string) {
  return await db.query.competitions.findFirst({
    where: eq(competitions.id, id),
  });
}

/**
 * Create a new competition
 * @param competition Competition to create
 */
export async function create(competition: InsertCompetition) {
  try {
    const now = new Date();
    const [result] = await db
      .insert(competitions)
      .values({
        ...competition,
        createdAt: competition.createdAt || now,
        updatedAt: competition.updatedAt || now,
      })
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
export async function update(
  competition: PartialExcept<InsertCompetition, "id">,
) {
  try {
    const [result] = await db
      .update(competitions)
      .set({
        ...competition,
        updatedAt: competition.updatedAt || new Date(),
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
export async function addTeamToCompetition(
  competitionId: string,
  teamId: string,
) {
  try {
    await db
      .insert(competitionTeams)
      .values({
        competitionId,
        teamId,
        createdAt: new Date(),
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
export async function addTeams(competitionId: string, teamIds: string[]) {
  const createdAt = new Date();
  const values = teamIds.map((teamId) => ({
    competitionId,
    teamId,
    createdAt,
  }));
  try {
    await db.insert(competitionTeams).values(values).onConflictDoNothing();
  } catch (error) {
    console.error("[CompetitionRepository] Error in addTeams:", error);
    throw error;
  }
}

/**
 * Get teams in a competition
 * @param competitionId Competition ID
 */
export async function getTeams(competitionId: string) {
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
export async function getCompetitionTeams(competitionId: string) {
  return getTeams(competitionId);
}

/**
 * Find active competition
 */
export async function findActive() {
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
export async function createPortfolioSnapshot(
  snapshot: InsertPortfolioSnapshot,
) {
  try {
    const [result] = await db
      .insert(portfolioSnapshots)
      .values({
        ...snapshot,
        timestamp: snapshot.timestamp || new Date(),
      })
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
export async function createPortfolioTokenValue(
  tokenValue: InsertPortfolioTokenValue,
) {
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
export async function getLatestPortfolioSnapshots(competitionId: string) {
  try {
    const subquery = db
      .select({
        teamId: portfolioSnapshots.teamId,
        maxTimestamp: max(portfolioSnapshots.timestamp),
      })
      .from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.competitionId, competitionId))
      .groupBy(portfolioSnapshots.teamId)
      .as("subquery");

    const result = await db
      .select()
      .from(portfolioSnapshots)
      .innerJoin(
        subquery,
        and(
          eq(portfolioSnapshots.teamId, subquery.teamId),
          eq(portfolioSnapshots.timestamp, subquery.maxTimestamp),
        ),
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
export async function getTeamPortfolioSnapshots(
  competitionId: string,
  teamId: string,
) {
  try {
    return await db
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.competitionId, competitionId),
          eq(portfolioSnapshots.teamId, teamId),
        ),
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
export async function getPortfolioTokenValues(snapshotId: number) {
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
export async function count() {
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
export async function findByStatus(status: CompetitionStatus) {
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
