import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getPredictions = base
  .input(
    z.object({
      competitionId: z.uuid(),
      gameId: z.uuid(),
      agentId: z.uuid().optional(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 5,
      getTags: (input) =>
        [
          `nfl-predictions-${input.gameId}`,
          input.agentId
            ? `nfl-predictions-${input.gameId}-${input.agentId}`
            : null,
        ].filter(Boolean) as string[],
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const predictions = input.agentId
        ? await context.sportsService.gamePredictionsRepository.findByGameAndAgent(
            input.gameId,
            input.agentId,
          )
        : await context.sportsService.gamePredictionsRepository.findByGame(
            input.gameId,
          );

      return {
        predictions: predictions.map((p) => ({
          id: p.id,
          agentId: p.agentId,
          predictedWinner: p.predictedWinner,
          confidence: Number(p.confidence),
          createdAt: p.createdAt.toISOString(),
        })),
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

      throw errors.INTERNAL({ message: "Failed to get predictions." });
    }
  });

export type GetPredictionsType = typeof getPredictions;
