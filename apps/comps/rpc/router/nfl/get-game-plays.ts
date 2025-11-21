import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getGamePlays = base
  .input(
    z.object({
      competitionId: z.uuid(),
      gameId: z.uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
      latest: z.boolean().default(false),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 3, // Play-by-play updates very frequently
      getTags: (input) => [`nfl-game-plays-${input.gameId}`],
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const allPlays =
        await context.sportsService.gamePlaysRepository.findByGameId(
          input.gameId,
          {
            limit: input.limit,
            offset: input.offset,
            sort: "-createdAt",
          },
        );

      if (input.latest) {
        // Return only the latest play
        const latestPlay = allPlays[allPlays.length - 1];
        return {
          play: latestPlay || null,
        };
      }

      // Return paginated plays
      const paginatedPlays = allPlays.slice(
        input.offset,
        input.offset + input.limit,
      );

      return {
        plays: paginatedPlays,
        pagination: {
          total: allPlays.length,
          limit: input.limit,
          offset: input.offset,
          hasMore: input.offset + input.limit < allPlays.length,
        },
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

      throw errors.INTERNAL({ message: "Failed to get game plays." });
    }
  });

export type GetGamePlaysType = typeof getGamePlays;
