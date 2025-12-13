import { ORPCError } from "@orpc/server";

import { ApiError, CreateAgentBodySchema } from "@recallnet/services/types";

import { CacheTags, invalidateCacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";

export const createAgent = base
  .use(authMiddleware)
  .input(CreateAgentBodySchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const agent = await context.agentService.createAgent({
        ownerId: context.user.id,
        name: input.name,
        handle: input.handle,
        description: input.description,
        imageUrl: input.imageUrl,
        metadata: input.metadata,
        email: input.email,
      });

      // Return sanitized agent
      const sanitizedAgent = {
        ...context.agentService.sanitizeAgent(agent),
        email: agent.email,
        deactivationReason: agent.deactivationReason,
        deactivationDate: agent.deactivationDate,
      };

      invalidateCacheTags([
        CacheTags.agentList(),
        CacheTags.publicUserAgents(context.user.id),
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
      throw errors.INTERNAL({ message: "Failed to create agent" });
    }
  });
