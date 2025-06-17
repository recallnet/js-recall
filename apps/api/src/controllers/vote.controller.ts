import { NextFunction, Request, Response } from "express";

import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  CreateVoteBodySchema,
  UserVotesParamsSchema,
  VOTE_ERROR_TYPES,
  VoteError,
  VotingStateParamsSchema,
} from "@/types/index.js";

/**
 * Vote Controller
 * Handles vote operations with SIWE session authentication
 * All endpoints require authenticated user session (req.userId)
 */
export function makeVoteController(services: ServiceRegistry) {
  return {
    /**
     * Cast a vote for an agent in a competition
     * POST /api/user/vote
     * @param req Express request with userId from session and vote data in body
     * @param res Express response
     * @param next Express next function
     */
    async castVote(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.userId as string;

        // Validate request body
        const { success, data, error } = CreateVoteBodySchema.safeParse(
          req.body,
        );
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }

        const { agentId, competitionId } = data;

        try {
          // Cast the vote using VoteManager
          const vote = await services.voteManager.castVote(
            userId,
            agentId,
            competitionId,
          );

          // Return the created vote
          res.status(201).json({
            success: true,
            message: "Vote cast successfully",
            vote: {
              id: vote.id,
              userId: vote.userId,
              agentId: vote.agentId,
              competitionId: vote.competitionId,
              createdAt: vote.createdAt,
            },
          });
        } catch (voteError) {
          // Handle specific vote validation errors
          if (voteError instanceof Error && "type" in voteError) {
            const error = voteError as VoteError;
            switch (error.type) {
              // TODO: it's a bit cumbersome to have to keep all these cases in
              //  sync with all the voting error types. Can we just do somthing
              //  like `throw new ApiError(error.code, error.message);`?
              case VOTE_ERROR_TYPES.COMPETITION_NOT_FOUND:
              case VOTE_ERROR_TYPES.AGENT_NOT_FOUND:
                throw new ApiError(404, error.message);
              case VOTE_ERROR_TYPES.AGENT_NOT_IN_COMPETITION:
              case VOTE_ERROR_TYPES.COMPETITION_VOTING_DISABLED:
              case VOTE_ERROR_TYPES.VOTING_NOT_OPEN:
                throw new ApiError(400, error.message);
              case VOTE_ERROR_TYPES.USER_ALREADY_VOTED:
              case VOTE_ERROR_TYPES.DUPLICATE_VOTE:
                throw new ApiError(409, error.message);
              default:
                throw new ApiError(500, "Failed to cast vote");
            }
          }
          throw voteError;
        }
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get user's votes, optionally filtered by competition
     * GET /api/user/votes?competitionId=uuid&limit=50&offset=0
     * @param req Express request with userId from session and optional query params
     * @param res Express response
     * @param next Express next function
     */
    async getUserVotes(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.userId as string;

        // Validate query parameters
        const { success, data, error } = UserVotesParamsSchema.safeParse(
          req.query,
        );
        if (!success) {
          throw new ApiError(400, `Invalid query parameters: ${error.message}`);
        }

        const { competitionId, limit, offset } = data;

        // Get user's votes
        const votes = await services.voteManager.getUserVotes(
          userId,
          competitionId,
        );

        // Apply pagination
        const paginatedVotes = votes.slice(offset, offset + limit);

        res.status(200).json({
          success: true,
          votes: paginatedVotes.map((vote) => ({
            id: vote.id,
            agentId: vote.agentId,
            competitionId: vote.competitionId,
            createdAt: vote.createdAt,
          })),
          pagination: {
            total: votes.length,
            limit,
            offset,
            hasMore: offset + limit < votes.length,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get voting state for a user in a specific competition
     * GET /api/user/votes/:competitionId/state
     * @param req Express request with userId from session and competitionId in params
     * @param res Express response
     * @param next Express next function
     */
    async getVotingState(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.userId as string;

        // Validate path parameters
        const { success, data, error } = VotingStateParamsSchema.safeParse(
          req.params,
        );
        if (!success) {
          throw new ApiError(400, `Invalid competition ID: ${error.message}`);
        }

        const { competitionId } = data;

        // Get voting state
        const votingState =
          await services.voteManager.getCompetitionVotingState(
            userId,
            competitionId,
          );

        res.status(200).json({
          success: true,
          votingState,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type VoteController = ReturnType<typeof makeVoteController>;
