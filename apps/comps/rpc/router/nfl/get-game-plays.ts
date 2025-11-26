import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import type { SelectGamePlay } from "@recallnet/db/schema/sports/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

const buildGamePlayMetadata = (play?: SelectGamePlay | null) => ({
  homeScore: play?.homeScore ?? null,
  awayScore: play?.awayScore ?? null,
  quarterName: play?.quarterName ?? null,
  timeRemainingMinutes: play?.timeRemainingMinutes ?? null,
  timeRemainingSeconds: play?.timeRemainingSeconds ?? null,
  down: play?.down ?? null,
  distance: play?.distance ?? null,
  yardLine: play?.yardLine ?? null,
  yardLineTerritory: play?.yardLineTerritory ?? null,
});

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
      const pagingParams = input.latest
        ? {
            limit: 1,
            offset: 0,
            sort: "-createdAt" as const,
          }
        : {
            limit: input.limit,
            offset: input.offset,
            sort: "-createdAt" as const,
          };

      const plays =
        await context.sportsService.gamePlaysRepository.findByGameId(
          input.gameId,
          pagingParams,
        );

      if (input.latest) {
        // Return only the latest play
        const latestPlay = plays[0];
        return {
          metadata: buildGamePlayMetadata(latestPlay),
          play: latestPlay || null,
        };
      }

      // Get total count for accurate pagination metadata
      const [totalCount, latestSnapshot] = await Promise.all([
        context.sportsService.gamePlaysRepository.countByGameId(input.gameId),
        context.sportsService.gamePlaysRepository.findByGameId(input.gameId, {
          limit: 1,
          offset: 0,
          sort: "-createdAt",
        }),
      ]);
      const metadataPlay = latestSnapshot[0];

      // Return paginated plays (already paginated by the repository)
      return {
        plays,
        metadata: buildGamePlayMetadata(metadataPlay),
        pagination: {
          total: totalCount,
          limit: input.limit,
          offset: input.offset,
          hasMore: input.offset + input.limit < totalCount,
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
