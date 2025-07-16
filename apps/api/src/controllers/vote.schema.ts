import { z } from "zod/v4";

import { UuidSchema } from "@/types/index.js";

/**
 * Body schema for casting a vote.
 * @example { agentId: "uuid", competitionId: "uuid" }
 */
export const CreateVoteBodySchema = z
  .object({
    agentId: UuidSchema,
    competitionId: UuidSchema,
  })
  .strict();

/**
 * Query schema for getting user votes.
 * @example { competitionId: "uuid", limit: 50, offset: 0 }
 */
export const UserVotesParamsSchema = z.object({
  competitionId: UuidSchema.optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * Params schema for voting state endpoint.
 * @example { competitionId: "uuid" }
 */
export const VotingStateParamsSchema = z.object({
  competitionId: UuidSchema,
});
