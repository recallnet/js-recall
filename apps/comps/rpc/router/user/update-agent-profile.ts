import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { ApiError } from "@recallnet/services/types";

import { CacheTags, invalidateCacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { userAgentMiddleware } from "@/rpc/middleware/user-agent";

/**
 * Input schema for updateAgentProfile
 * Mirrors UpdateUserAgentProfileBodySchema from @recallnet/services/types
 * with agentId added. Defined inline to avoid Zod cross-package type issues.
 */
const UpdateAgentProfileInputSchema = z
  .object({
    agentId: z.string().uuid(),
    name: z
      .string()
      .trim()
      .min(1, { message: "Name must be at least 1 character" })
      .max(100, { message: "Name must be 100 characters or less" })
      .optional(),
    handle: z
      .string()
      .trim()
      .min(3, { message: "Handle must be at least 3 characters" })
      .max(15, { message: "Handle must be at most 15 characters" })
      .regex(/^[a-z0-9_]+$/, {
        message:
          "Handle can only contain lowercase letters, numbers, and underscores",
      })
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, { message: "Description must be at least 1 character" })
      .optional(),
    imageUrl: z.string().url().optional(),
    email: z.string().email().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const updateAgentProfile = base
  .input(UpdateAgentProfileInputSchema)
  .use(userAgentMiddleware, (input) => ({ agentId: input.agentId }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { agent } = context;

      // Update the agent
      const updatedAgent = await context.agentService.updateAgent({
        ...agent,
        ...input,
      });

      if (!updatedAgent) {
        throw errors.INTERNAL({ message: "Failed to update agent profile" });
      }

      // Remove sensitive fields, but add back the email and deactivation since the user should see them
      const sanitizedAgent = {
        ...context.agentService.sanitizeAgent(updatedAgent),
        email: updatedAgent.email,
        deactivationReason: updatedAgent.deactivationReason,
        deactivationDate: updatedAgent.deactivationDate,
      };

      invalidateCacheTags([
        CacheTags.agent(updatedAgent.id),
        CacheTags.publicUserAgents(context.user.id),
        CacheTags.agentList(),
      ]);

      return {
        agent: sanitizedAgent,
      };
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
          case 409:
            throw errors.CONFLICT({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to update agent profile" });
    }
  });
