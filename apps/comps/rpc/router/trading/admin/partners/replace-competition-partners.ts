import { ORPCError } from "@orpc/server";

import {
  AdminCompetitionParamsSchema,
  AdminReplaceCompetitionPartnersSchema,
  ApiError,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Replace all partners for a competition
 */
export const replaceCompetitionPartners = base
  .use(adminMiddleware)
  .input(
    AdminCompetitionParamsSchema.merge(AdminReplaceCompetitionPartnersSchema),
  )
  .route({
    method: "PUT",
    path: "/admin/competitions/{competitionId}/partners/replace",
    summary: "Replace all competition partners",
    description: "Replace all partners for a competition in a single operation",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
      // Replace all partners
      const associations =
        await context.partnerService.replaceCompetitionPartners(
          input.competitionId,
          input.partners,
        );

      return {
        success: true,
        partners: associations,
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

      throw errors.INTERNAL({
        message: "Failed to replace competition partners",
      });
    }
  });

export type ReplaceCompetitionPartnersType = typeof replaceCompetitionPartners;
