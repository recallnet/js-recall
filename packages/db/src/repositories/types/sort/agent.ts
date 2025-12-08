import { z } from "zod";

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
  "simpleReturn",
  "maxDrawdown",
] as const;

/**
 * Build a Zod schema that accepts
 *   "field" | "-field"
 * for any field name in the supplied list.
 * @param fields - The list of fields to accept
 * @returns A Zod schema that accepts "field" | "-field" for any field name in the supplied list
 */
export function makeSortFieldSchema<const FIELDS extends readonly string[]>(
  fields: FIELDS,
) {
  const fieldSet = new Set<string>(fields as readonly string[]);
  return z.string().refine((val) => {
    const core = val.startsWith("-") ? val.slice(1) : val;
    return fieldSet.has(core);
  }, "Invalid sort field");
}

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
