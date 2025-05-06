import { and, count as drizzleCount, eq, ilike } from "drizzle-orm";

import {
  InsertTeam,
  competitionTeams,
  teams,
} from "@recallnet/comps-db/schema";

import { db } from "@/database/db.js";

/**
 * Team Repository
 * Handles database operations for teams
 */

/**
 * Create a new team
 * @param team Team to create
 */
export async function create(team: InsertTeam) {
  try {
    const [result] = await db.insert(teams).values(team).returning();

    if (!result) {
      throw new Error("Failed to create team - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[TeamRepository] Error in create:", error);
    throw error;
  }
}

/**
 * Find all teams
 */
export async function findAll() {
  return await db.query.teams.findMany();
}

/**
 * Find a team by ID
 * @param id The ID to search for
 */
export async function findById(id: string) {
  return await db.query.teams.findFirst({
    where: eq(teams.id, id),
  });
}

/**
 * Find a team by email
 * @param email The email to search for
 */
export async function findByEmail(email: string) {
  try {
    const [result] = await db
      .select()
      .from(teams)
      .where(ilike(teams.email, email))
      .limit(1);

    return result;
  } catch (error) {
    console.error("[TeamRepository] Error in findByEmail:", error);
    throw error;
  }
}

/**
 * Count all teams
 */
export async function count() {
  const [result] = await db.select({ count: drizzleCount() }).from(teams);
  return result?.count ?? 0;
}

/**
 * Update an existing team
 * @param team Team to update
 */
export async function update(team: InsertTeam) {
  try {
    const [result] = await db
      .update(teams)
      .set({
        name: team.name,
        email: team.email,
        contactPerson: team.contactPerson,
        apiKey: team.apiKey,
        walletAddress: team.walletAddress,
        bucketAddresses: team.bucketAddresses,
        metadata: team.metadata,
        isAdmin: team.isAdmin,
        active: team.active,
        deactivationReason: team.deactivationReason,
        deactivationDate: team.deactivationDate,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id))
      .returning();

    if (!result) {
      throw new Error(`Team with ID ${team.id} not found`);
    }

    return result;
  } catch (error) {
    console.error("[TeamRepository] Error in update:", error);
    throw error;
  }
}

/**
 * Find a team by API key
 * @param apiKey The API key to search for
 */
export async function findByApiKey(apiKey: string) {
  try {
    const [result] = await db
      .select()
      .from(teams)
      .where(eq(teams.apiKey, apiKey));

    return result;
  } catch (error) {
    console.error("[TeamRepository] Error in findByApiKey:", error);
    throw error;
  }
}

/**
 * Check if a team exists in a competition
 * @param teamId Team ID
 * @param competitionId Competition ID
 */
export async function isTeamInCompetition(
  teamId: string,
  competitionId: string,
) {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(competitionTeams)
      .where(
        and(
          eq(competitionTeams.teamId, teamId),
          eq(competitionTeams.competitionId, competitionId),
        ),
      )
      .limit(1);

    return !!result?.count;
  } catch (error) {
    console.error("[TeamRepository] Error in isTeamInCompetition:", error);
    throw error;
  }
}

/**
 * Deactivate a team
 * @param teamId Team ID to deactivate
 * @param reason Reason for deactivation
 */
export async function deactivateTeam(teamId: string, reason: string) {
  try {
    const [result] = await db
      .update(teams)
      .set({
        active: false,
        deactivationReason: reason,
        deactivationDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return result;
  } catch (error) {
    console.error("[TeamRepository] Error in deactivateTeam:", error);
    throw error;
  }
}

/**
 * Reactivate a team
 * @param teamId Team ID to reactivate
 */
export async function reactivateTeam(teamId: string) {
  try {
    const [result] = await db
      .update(teams)
      .set({
        active: true,
        deactivationReason: null,
        deactivationDate: null,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return result;
  } catch (error) {
    console.error("[TeamRepository] Error in reactivateTeam:", error);
    throw error;
  }
}

/**
 * Find all inactive teams
 */
export async function findInactiveTeams() {
  try {
    return await db.select().from(teams).where(eq(teams.active, false));
  } catch (error) {
    console.error("[TeamRepository] Error in findInactiveTeams:", error);
    throw error;
  }
}

/**
 * Delete a team by ID
 * @param teamId The team ID to delete
 * @returns true if team was deleted, false otherwise
 */
export async function deleteTeam(teamId: string) {
  try {
    const [result] = await db
      .delete(teams)
      .where(eq(teams.id, teamId))
      .returning();

    return !!result;
  } catch (error) {
    console.error("[TeamRepository] Error in delete:", error);
    throw error;
  }
}
