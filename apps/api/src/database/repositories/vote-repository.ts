import { and, count as drizzleCount, eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { votes } from "@/database/schema/core/defs.js";
import { InsertVote, SelectVote } from "@/database/schema/core/types.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

/**
 * Vote Repository
 * Handles database operations for non-staking votes in competitions
 */

/**
 * Create a new vote
 * @param vote Vote data to create
 * @returns The created vote record
 * @throws Error if vote creation fails or if duplicate vote exists
 */
async function createVoteImpl(vote: InsertVote): Promise<SelectVote> {
  try {
    const now = new Date();
    const data: InsertVote = {
      id: vote.id || uuidv4(),
      userId: vote.userId,
      agentId: vote.agentId,
      competitionId: vote.competitionId,
      createdAt: vote.createdAt || now,
      updatedAt: vote.updatedAt || now,
    };

    const [result] = await db.insert(votes).values(data).returning();

    if (!result) {
      throw new Error("Failed to create vote - no result returned");
    }

    repositoryLogger.debug(
      `Created vote ${result.id} for user ${result.userId} on agent ${result.agentId} in competition ${result.competitionId}`,
    );
    return result;
  } catch (error) {
    console.error("[VoteRepository] Error in createVote:", error);
    throw error;
  }
}

/**
 * Find a specific vote by user, agent, and competition
 * @param userId The user ID
 * @param agentId The agent ID
 * @param competitionId The competition ID
 * @returns The vote record if found, undefined otherwise
 */
async function findVoteByUserAgentCompetitionImpl(
  userId: string,
  agentId: string,
  competitionId: string,
): Promise<SelectVote | undefined> {
  try {
    const [result] = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.userId, userId),
          eq(votes.agentId, agentId),
          eq(votes.competitionId, competitionId),
        ),
      )
      .limit(1);

    return result;
  } catch (error) {
    console.error(
      "[VoteRepository] Error in findVoteByUserAgentCompetition:",
      error,
    );
    throw error;
  }
}

/**
 * Find all votes by a user, optionally filtered by competition
 * @param userId The user ID
 * @param competitionId Optional competition ID to filter by
 * @returns Array of vote records
 */
async function findVotesByUserImpl(
  userId: string,
  competitionId?: string,
): Promise<SelectVote[]> {
  try {
    const whereConditions = [eq(votes.userId, userId)];

    if (competitionId) {
      whereConditions.push(eq(votes.competitionId, competitionId));
    }

    const result = await db
      .select()
      .from(votes)
      .where(and(...whereConditions))
      .orderBy(votes.createdAt);

    return result;
  } catch (error) {
    console.error("[VoteRepository] Error in findVotesByUser:", error);
    throw error;
  }
}

/**
 * Find all votes in a specific competition
 * @param competitionId The competition ID
 * @returns Array of vote records
 */
async function findVotesByCompetitionImpl(
  competitionId: string,
): Promise<SelectVote[]> {
  try {
    const result = await db
      .select()
      .from(votes)
      .where(eq(votes.competitionId, competitionId))
      .orderBy(votes.createdAt);

    return result;
  } catch (error) {
    console.error("[VoteRepository] Error in findVotesByCompetition:", error);
    throw error;
  }
}

/**
 * Count votes for a specific agent in a competition
 * @param agentId The agent ID
 * @param competitionId The competition ID
 * @returns Number of votes for the agent in the competition
 */
async function countVotesByAgentImpl(
  agentId: string,
  competitionId: string,
): Promise<number> {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(votes)
      .where(
        and(eq(votes.agentId, agentId), eq(votes.competitionId, competitionId)),
      );

    return result?.count || 0;
  } catch (error) {
    console.error("[VoteRepository] Error in countVotesByAgent:", error);
    throw error;
  }
}

/**
 * Get vote counts for all agents in a competition
 * @param competitionId The competition ID
 * @returns Array of objects with agentId and voteCount
 */
async function getVoteCountsByCompetitionImpl(
  competitionId: string,
): Promise<{ agentId: string; voteCount: number }[]> {
  try {
    const result = await db
      .select({
        agentId: votes.agentId,
        voteCount: drizzleCount(),
      })
      .from(votes)
      .where(eq(votes.competitionId, competitionId))
      .groupBy(votes.agentId)
      .orderBy(sql`${drizzleCount()} DESC`);

    return result.map((row) => ({
      agentId: row.agentId,
      voteCount: row.voteCount,
    }));
  } catch (error) {
    console.error(
      "[VoteRepository] Error in getVoteCountsByCompetition:",
      error,
    );
    throw error;
  }
}

/**
 * Get all votes by a user for a specific competition
 * Note: In the current design, a user can only vote once per competition,
 * but this method returns an array for future extensibility
 * @param userId The user ID
 * @param competitionId The competition ID
 * @returns Array of vote records (should be 0 or 1 in current design)
 */
async function getUserVotesForCompetitionImpl(
  userId: string,
  competitionId: string,
): Promise<SelectVote[]> {
  try {
    const result = await db
      .select()
      .from(votes)
      .where(
        and(eq(votes.userId, userId), eq(votes.competitionId, competitionId)),
      )
      .orderBy(votes.createdAt);

    return result;
  } catch (error) {
    console.error(
      "[VoteRepository] Error in getUserVotesForCompetition:",
      error,
    );
    throw error;
  }
}

/**
 * Check if a user has already voted in a specific competition (for any agent)
 * @param userId The user ID
 * @param competitionId The competition ID
 * @returns True if user has voted in the competition, false otherwise
 */
async function hasUserVotedInCompetitionImpl(
  userId: string,
  competitionId: string,
): Promise<boolean> {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(votes)
      .where(
        and(eq(votes.userId, userId), eq(votes.competitionId, competitionId)),
      );

    return (result?.count || 0) > 0;
  } catch (error) {
    console.error(
      "[VoteRepository] Error in hasUserVotedInCompetition:",
      error,
    );
    throw error;
  }
}

/**
 * Get the user's vote for a specific competition (if any)
 * @param userId The user ID
 * @param competitionId The competition ID
 * @returns The vote record if found, undefined otherwise
 */
async function getUserVoteForCompetitionImpl(
  userId: string,
  competitionId: string,
): Promise<SelectVote | undefined> {
  try {
    const [result] = await db
      .select()
      .from(votes)
      .where(
        and(eq(votes.userId, userId), eq(votes.competitionId, competitionId)),
      )
      .limit(1);

    return result;
  } catch (error) {
    console.error(
      "[VoteRepository] Error in getUserVoteForCompetition:",
      error,
    );
    throw error;
  }
}

/**
 * Count total votes in the system
 * @returns Total number of votes
 */
async function countImpl(): Promise<number> {
  try {
    const [result] = await db.select({ count: drizzleCount() }).from(votes);
    return result?.count || 0;
  } catch (error) {
    console.error("[VoteRepository] Error in count:", error);
    throw error;
  }
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const createVote = createTimedRepositoryFunction(
  createVoteImpl,
  "VoteRepository",
  "createVote",
);

export const findVoteByUserAgentCompetition = createTimedRepositoryFunction(
  findVoteByUserAgentCompetitionImpl,
  "VoteRepository",
  "findVoteByUserAgentCompetition",
);

export const findVotesByUser = createTimedRepositoryFunction(
  findVotesByUserImpl,
  "VoteRepository",
  "findVotesByUser",
);

export const findVotesByCompetition = createTimedRepositoryFunction(
  findVotesByCompetitionImpl,
  "VoteRepository",
  "findVotesByCompetition",
);

export const countVotesByAgent = createTimedRepositoryFunction(
  countVotesByAgentImpl,
  "VoteRepository",
  "countVotesByAgent",
);

export const getVoteCountsByCompetition = createTimedRepositoryFunction(
  getVoteCountsByCompetitionImpl,
  "VoteRepository",
  "getVoteCountsByCompetition",
);

export const getUserVotesForCompetition = createTimedRepositoryFunction(
  getUserVotesForCompetitionImpl,
  "VoteRepository",
  "getUserVotesForCompetition",
);

export const hasUserVotedInCompetition = createTimedRepositoryFunction(
  hasUserVotedInCompetitionImpl,
  "VoteRepository",
  "hasUserVotedInCompetition",
);

export const getUserVoteForCompetition = createTimedRepositoryFunction(
  getUserVoteForCompetitionImpl,
  "VoteRepository",
  "getUserVoteForCompetition",
);

export const count = createTimedRepositoryFunction(
  countImpl,
  "VoteRepository",
  "count",
);
