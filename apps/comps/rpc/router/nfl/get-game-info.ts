import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getGameInfo = base
  .input(
    z.object({
      competitionId: z.uuid(),
      gameId: z.uuid(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 5,
      getTags: (input) => [`nfl-game-${input.gameId}`],
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const game = await context.sportsService.gamesRepository.findById(
        input.gameId,
      );

      if (!game) {
        throw errors.NOT_FOUND({ message: "Game not found" });
      }

      return game;
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

      throw errors.INTERNAL({ message: "Failed to get game info." });
    }
  });

export type GetGameInfoType = typeof getGameInfo;
