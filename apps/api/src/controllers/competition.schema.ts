import { z } from "zod/v4";

import {
  CompetitionStatusSchema,
  PagingParamsSchema,
  UuidSchema,
} from "@/types/index.js";

/**
 * Query schema for leaderboard and status endpoints (competitionId optional)
 * @example { competitionId: "uuid-string" }
 */
export const CompetitionIdOptionalSchema = z.object({
  competitionId: UuidSchema.optional(),
});

/**
 * Query schema for getCompetitions endpoint (status, paging)
 */
export const CompetitionListQuerySchema = PagingParamsSchema.extend({
  status: CompetitionStatusSchema.optional(),
});

/**
 * Query schema for getCompetitionAgents endpoint (filter, sort, paging)
 */
export const CompetitionAgentsQuerySchema = z.object({
  filter: z.string().optional(),
  sort: z.string().default("rank"),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
