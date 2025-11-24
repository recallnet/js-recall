import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Update an agent
 */
export const updateAgent = base
  .use(adminMiddleware)
  .input(
    z.object({
      agentId: z.string().uuid(),
      name: z.string().optional(),
      handle: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      email: z.string().email().optional(),
      metadata: z.record(z.any()).optional(),
      isRewardsIneligible: z.boolean().optional(),
      rewardsIneligibilityReason: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { agentId, ...updateData } = input;

      // Get the current agent
      const agent = await context.agentService.getAgent(agentId);
      if (!agent) {
        throw errors.NOT_FOUND({ message: "Agent not found" });
      }

      // Update with only provided fields
      const updatedAgent = await context.agentService.updateAgent({
        ...agent,
        name: updateData.name ?? agent.name,
        handle: updateData.handle ?? agent.handle,
        description: updateData.description ?? agent.description,
        imageUrl: updateData.imageUrl ?? agent.imageUrl,
        email: updateData.email ?? agent.email,
        metadata: updateData.metadata ?? agent.metadata,
        isRewardsIneligible:
          updateData.isRewardsIneligible ?? agent.isRewardsIneligible,
        rewardsIneligibilityReason:
          updateData.rewardsIneligibilityReason ??
          agent.rewardsIneligibilityReason,
      });

      return { success: true, agent: updatedAgent };
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

      throw errors.INTERNAL({ message: "Failed to update agent" });
    }
  });

export type UpdateAgentType = typeof updateAgent;
