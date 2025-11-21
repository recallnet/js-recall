import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getLeaderboard = base
  .input(
    z.object({
      competitionId: z.uuid(),
      gameId: z.uuid().optional(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 10,
      getTags: (input) => [
        CacheTags.competition(input.competitionId),
        input.gameId
          ? `nfl-leaderboard-${input.competitionId}-${input.gameId}`
          : `nfl-leaderboard-${input.competitionId}`,
      ],
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const leaderboard = input.gameId
        ? await context.sportsService.gameScoringService.getGameLeaderboard(
            input.competitionId,
            input.gameId,
          )
        : await context.sportsService.gameScoringService.getCompetitionLeaderboard(
            input.competitionId,
          );

      return {
        leaderboard: leaderboard.map((entry) => ({
          agentId: entry.agentId,
          rank: entry.rank,
          ...("timeWeightedBrierScore" in entry
            ? {
                timeWeightedBrierScore: entry.timeWeightedBrierScore,
                finalPrediction: entry.finalPrediction,
                finalConfidence: entry.finalConfidence,
                predictionCount: entry.predictionCount,
              }
            : {
                averageBrierScore: entry.averageBrierScore,
                gamesScored: entry.gamesScored,
              }),
        })),
        gameId: input.gameId,
      };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to get leaderboard." });
    }
  });

export type GetLeaderboardType = typeof getLeaderboard;
