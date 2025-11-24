import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Create a new agent
 */
export const createAgent = base
  .use(adminMiddleware)
  .input(
    z.object({
      user: z.object({
        id: z.string().uuid().optional(),
        walletAddress: z.string().optional(),
      }),
      agent: z.object({
        name: z.string().min(1),
        handle: z.string().optional(),
        email: z.string().email().optional(),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        walletAddress: z.string().optional(),
      }),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const createdAgent = await context.agentService.createAgentForOwner(
        { userId: input.user.id, walletAddress: input.user.walletAddress },
        input.agent,
      );

      return {
        success: true,
        agent: createdAgent,
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
          case 409:
            throw errors.CONFLICT({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to create agent" });
    }
  });

export type CreateAgentType = typeof createAgent;
