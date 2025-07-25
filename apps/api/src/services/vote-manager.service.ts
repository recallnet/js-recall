import { v4 as uuidv4 } from "uuid";

import { findById as findAgentById } from "@/database/repositories/agent-repository.js";
import { isAgentActiveInCompetition } from "@/database/repositories/competition-repository.js";
import { findById as findCompetitionById } from "@/database/repositories/competition-repository.js";
import {
  countVotesByAgent,
  createVote,
  findVotesByUser,
  getUserVoteForCompetition,
  getVoteCountsByCompetition,
  hasUserVotedInCompetition,
} from "@/database/repositories/vote-repository.js";
import {
  InsertVote,
  SelectCompetition,
  SelectVote,
} from "@/database/schema/core/types.js";
import { serviceLogger } from "@/lib/logger.js";
import {
  COMPETITION_STATUS,
  CompetitionVotingStatus,
  UserVoteInfo,
  VOTE_ERROR_TYPES,
  VoteError,
} from "@/types/index.js";

/**
 * Vote Manager Service
 * Manages non-staking votes for competition agents with business logic validation
 */
export class VoteManager {
  /**
   * Cast a vote for an agent in a competition
   * @param userId The user casting the vote
   * @param agentId The agent being voted for
   * @param competitionId The competition the agent is participating in
   * @returns The created vote record
   * @throws VoteError for various validation failures
   */
  async castVote(
    userId: string,
    agentId: string,
    competitionId: string,
  ): Promise<SelectVote> {
    try {
      // Validate vote eligibility
      await this.validateVoteEligibility(userId, agentId, competitionId);

      // Create the vote
      const voteData: InsertVote = {
        id: uuidv4(),
        userId,
        agentId,
        competitionId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const vote = await createVote(voteData);

      serviceLogger.debug(
        `[VoteManager] User ${userId} successfully voted for agent ${agentId} in competition ${competitionId}`,
      );

      return vote;
    } catch (error) {
      serviceLogger.error("[VoteManager] Error in castVote:", error);
      throw error;
    }
  }

  /**
   * Get all votes by a user, optionally filtered by competition
   * @param userId The user ID
   * @param competitionId Optional competition ID to filter by
   * @returns Array of vote records
   */
  async getUserVotes(
    userId: string,
    competitionId?: string,
  ): Promise<SelectVote[]> {
    try {
      return await findVotesByUser(userId, competitionId);
    } catch (error) {
      serviceLogger.error("[VoteManager] Error in getUserVotes:", error);
      throw error;
    }
  }

  /**
   * Get vote counts for all agents in a competition
   * @param competitionId The competition ID
   * @returns Map of agent ID to vote count
   */
  async getVoteCountsByCompetition(
    competitionId: string,
  ): Promise<Map<string, number>> {
    try {
      const voteCounts = await getVoteCountsByCompetition(competitionId);
      const voteMap = new Map<string, number>();

      for (const { agentId, voteCount } of voteCounts) {
        voteMap.set(agentId, voteCount);
      }

      return voteMap;
    } catch (error) {
      serviceLogger.error(
        "[VoteManager] Error in getVoteCountsByCompetition:",
        error,
      );
      throw error;
    }
  }

  /**
   * Check if a user has voted for a specific agent in a competition
   * @param userId The user ID
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @returns True if user has voted for this specific agent
   */
  async hasUserVoted(
    userId: string,
    agentId: string,
    competitionId: string,
  ): Promise<boolean> {
    try {
      const userVote = await getUserVoteForCompetition(userId, competitionId);
      return userVote?.agentId === agentId;
    } catch (error) {
      serviceLogger.error("[VoteManager] Error in hasUserVoted:", error);
      throw error;
    }
  }

  /**
   * Get the user's vote for a specific competition (if any)
   * @param userId The user ID
   * @param competitionId The competition ID
   * @returns The vote record if found, null otherwise
   */
  async getUserVoteForCompetition(
    userId: string,
    competitionId: string,
  ): Promise<SelectVote | null> {
    try {
      const vote = await getUserVoteForCompetition(userId, competitionId);
      return vote || null;
    } catch (error) {
      serviceLogger.error(
        "[VoteManager] Error in getUserVoteForCompetition:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get comprehensive voting state for a user in a competition
   * @param userId The user ID
   * @param competitionId The competition ID
   * @returns Complete voting state information
   */
  async getCompetitionVotingState(
    userId: string,
    competitionId: string,
  ): Promise<CompetitionVotingStatus> {
    try {
      // Get competition to check status
      const competition = await findCompetitionById(competitionId);
      if (!competition) {
        return {
          canVote: false,
          reason: "Competition not found",
          info: { hasVoted: false },
        };
      }

      // Check if user has already voted
      const userVote = await getUserVoteForCompetition(userId, competitionId);
      const hasVoted = !!userVote;

      // Check if voting is allowed based on competition status
      if (!this.checkCompetitionVotingStatus(competition)) {
        return {
          canVote: false,
          reason: `Competition status does not allow voting (${competition.status})`,
          info: { hasVoted },
        };
      }

      const userVoteInfo: UserVoteInfo = {
        hasVoted,
        agentId: userVote?.agentId,
        votedAt: userVote?.createdAt,
      };

      // Check voting dates if they are set
      const dateValid = this.checkCompetitionVotingDates(competition);
      if (!dateValid.canVote) {
        return { info: userVoteInfo, ...dateValid };
      }

      if (hasVoted) {
        return {
          canVote: false,
          reason: "You have already voted in this competition",
          info: userVoteInfo,
        };
      }

      return {
        canVote: true,
        info: userVoteInfo,
      };
    } catch (error) {
      serviceLogger.error(
        "[VoteManager] Error in getCompetitionVotingState:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get vote count for a specific agent in a competition
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @returns Number of votes for the agent
   */
  async getAgentVoteCount(
    agentId: string,
    competitionId: string,
  ): Promise<number> {
    try {
      return await countVotesByAgent(agentId, competitionId);
    } catch (error) {
      serviceLogger.error("[VoteManager] Error in getAgentVoteCount:", error);
      throw error;
    }
  }

  /**
   * Validate vote eligibility with comprehensive checks
   * @param userId The user ID
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @throws VoteError for various validation failures
   */
  private async validateVoteEligibility(
    userId: string,
    agentId: string,
    competitionId: string,
  ): Promise<void> {
    // Check if competition exists
    const competition = await findCompetitionById(competitionId);
    if (!competition) {
      const error = new Error("Competition not found") as VoteError;
      error.type = VOTE_ERROR_TYPES.COMPETITION_NOT_FOUND;
      error.code = 404;
      throw error;
    }

    // Check if agent exists
    const agent = await findAgentById(agentId);
    if (!agent) {
      const error = new Error("Agent not found") as VoteError;
      error.type = VOTE_ERROR_TYPES.AGENT_NOT_FOUND;
      error.code = 404;
      throw error;
    }

    // Check if agent is actively participating in the competition
    const agentActiveInCompetition = await isAgentActiveInCompetition(
      competitionId,
      agentId,
    );
    if (!agentActiveInCompetition) {
      const error = new Error(
        "Agent is not actively participating in this competition",
      ) as VoteError;
      error.type = VOTE_ERROR_TYPES.AGENT_NOT_IN_COMPETITION;
      error.code = 400;
      throw error;
    }

    // Check if competition status allows voting
    if (!this.checkCompetitionVotingStatus(competition)) {
      const error = new Error(
        `Competition status does not allow voting: ${competition.status}`,
      ) as VoteError;
      error.type = VOTE_ERROR_TYPES.COMPETITION_VOTING_DISABLED;
      error.code = 400;
      throw error;
    }

    // Check voting dates if they are set
    const dateValid = this.checkCompetitionVotingDates(competition);
    if (!dateValid.canVote) {
      const error = new Error(dateValid.reason) as VoteError;
      error.type = VOTE_ERROR_TYPES.VOTING_NOT_OPEN;
      error.code = 400;
      throw error;
    }

    // Check if user has already voted in this competition (for any agent)
    const hasVoted = await hasUserVotedInCompetition(userId, competitionId);
    if (hasVoted) {
      const error = new Error(
        "You have already voted in this competition",
      ) as VoteError;
      error.type = VOTE_ERROR_TYPES.USER_ALREADY_VOTED;
      error.code = 409;
      throw error;
    }
  }

  /**
   * Check if competition status allows voting
   * If competition is "ended" then voting is not allowed
   * Note: Voting date checks are handled separately in validation methods
   * @param competition The competition record
   * @returns True if competition status allows voting
   */
  private checkCompetitionVotingStatus(
    competition: SelectCompetition,
  ): boolean {
    const votingEnabledStatuses: Array<SelectCompetition["status"]> = [
      COMPETITION_STATUS.PENDING,
      COMPETITION_STATUS.ACTIVE,
    ];

    return votingEnabledStatuses.includes(competition.status);
  }

  /**
   * Check if competition voting dates allows voting
   * @param competition The competition record
   * @returns True if competition status allows voting
   */
  private checkCompetitionVotingDates(competition: SelectCompetition) {
    const now = new Date();

    // If at least one voting date is not set, voting for the comp is disabled
    if (!competition.votingStartDate || !competition.votingEndDate) {
      return {
        canVote: false,
        reason: "voting is not enabled for this competition",
      };
    }

    // If voting start date is set and we haven't reached it, voting is not allowed
    if (competition.votingStartDate && now < competition.votingStartDate) {
      return {
        canVote: false,
        reason: `Voting has not started yet. Voting begins on ${competition.votingStartDate.toISOString()}`,
      };
    }

    // If voting end date is set and we've passed it, voting is not allowed
    if (competition.votingEndDate && now > competition.votingEndDate) {
      return {
        canVote: false,
        reason: `Voting has ended. Voting ended on ${competition.votingEndDate.toISOString()}`,
      };
    }

    return { canVote: true, reason: "voting is open" };
  }
}
