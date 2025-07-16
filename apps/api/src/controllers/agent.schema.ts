import { z } from "zod/v4";

import { AgentFilterSchema, PagingParamsSchema } from "@/types/index.js";

/**
 * Query schema for getting agents with optional filter and paging.
 * @example { filter: { name: "foo" }, limit: 10, offset: 0 }
 */
export const AgentGetAgentsQuerySchema = PagingParamsSchema.extend({
  filter: AgentFilterSchema.optional(),
});

/**
 * Update agent profile (from an non-user request) parameters schema
 */
export const UpdateAgentProfileBodySchema = z
  .object({
    name: z
      .string("Invalid name format")
      .trim()
      .min(1, { message: "Name must be at least 1 character" })
      .optional(),
    description: z
      .string("Invalid description format")
      .trim()
      .min(1, { message: "Description must be at least 1 character" })
      .optional(),
    imageUrl: z.url("Invalid image URL format").optional(),
  })
  .strict();
