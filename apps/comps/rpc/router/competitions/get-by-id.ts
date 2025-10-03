import { ORPCError } from "@orpc/client";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { userMiddleware } from "@/rpc/middleware/user";

export const getById = base
  .use(userMiddleware)
  .input(
    z.object({
      id: z.uuid(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const res = await context.competitionService.getCompetitionById({
        competitionId: input.id,
        userId: context.user?.id,
      });
      return res.competition;
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle ApiError instances from service layer
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

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to get agent API key" });
    }
  });

export type GetByIdType = typeof getById;
