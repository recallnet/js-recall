import { z } from "zod";

import { makeSortFieldSchema } from "../../lib/sort.js";
import { PagingSchema } from "./shared.js";

/**
 * Agent database fields that can be used for sorting
 */
export const AGENT_DB_FIELDS = [
  "id",
  "ownerId",
  "walletAddress",
  "name",
  "handle",
  "status",
  "createdAt",
  "updatedAt",
] as const;

/**
 * Agent database sort fields schema
 */
export const AgentDbSortFields = makeSortFieldSchema(AGENT_DB_FIELDS);

/**
 * Agent database sort fields type
 */
export type TAgentDbSortFields = z.infer<typeof AgentDbSortFields>;

/**
 * Agent computed fields (post-query aggregation) that can be used for sorting
 */
export const AGENT_COMPUTED_FIELDS = [
  "rank",
  "score",
  "portfolioValue",
  "pnl",
  "pnlPercent",
  "change24h",
  "change24hPercent",
  "calmarRatio",
  "sortinoRatio",
  "simpleReturn",
  "maxDrawdown",
  "downsideDeviation",
] as const;

/**
 * Agent computed sort fields schema
 */
export const AgentComputedSortFields = makeSortFieldSchema(
  AGENT_COMPUTED_FIELDS,
).default("rank");

/**
 * Agent computed sort fields type
 */
export type TAgentComputedSortFields = z.infer<typeof AgentComputedSortFields>;

/**
 * Agent sort field schema (database fields and computed fields)
 */
export const AgentSortField = makeSortFieldSchema([
  ...AGENT_DB_FIELDS,
  ...AGENT_COMPUTED_FIELDS,
]).default("rank");

/**
 * Agent query schema (database fields and computed fields)
 */
export const AgentQuerySchema = PagingSchema.extend({
  sort: AgentSortField.optional(),
  filter: z.string().optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((val) => (val === "true" ? true : false)),
});

/**
 * Agent query parameters (database fields and computed fields)
 */
export type AgentQueryParams = z.infer<typeof AgentQuerySchema>;
