import { z } from "zod/v4";

import { PagingParamsSchema } from "@recallnet/contracts";

import {
  actorStatus,
  competitionAgentStatus,
  competitionStatus,
  competitionType,
} from "../../schema/core/defs.js";

// =============================================================================
// Re-export chain types from contracts (source of truth)
// =============================================================================
export { SpecificChainSchema, type SpecificChain } from "@recallnet/contracts";

// =============================================================================
// Re-export common schemas from contracts (source of truth)
// =============================================================================
export {
  PagingParamsSchema,
  type PagingParams,
  UuidSchema,
  TimestampSchema,
  SnapshotSchema,
  SnapshotDbSchema,
  BestPlacementDbSchema,
  UserSearchParamsSchema,
  type UserSearchParams,
  AgentSearchParamsSchema,
  type AgentSearchParams,
  type SearchAdminsParams,
} from "@recallnet/contracts";

// =============================================================================
// Re-export agent types from contracts (source of truth)
// =============================================================================
export { type AgentTrophy } from "@recallnet/contracts";

// =============================================================================
// DB-specific types derived from Drizzle pgEnum definitions
// These must stay here because they derive from the database schema
// =============================================================================

/**
 * Zod schema for the status of a user, agent, or admin.
 */
export const ActorStatusSchema = z.enum(actorStatus.enumValues);

/**
 * Status of a user, agent, or admin.
 */
export type ActorStatus = z.infer<typeof ActorStatusSchema>;

/**
 * Zod schema for the status of a competition.
 */
export const CompetitionStatusSchema = z.enum(competitionStatus.enumValues);

/**
 * Status of a competition.
 */
export type CompetitionStatus = z.infer<typeof CompetitionStatusSchema>;

/**
 * Zod schema for the status of an agent within a competition.
 */
export const CompetitionAgentStatusSchema = z.enum(
  competitionAgentStatus.enumValues,
);

/**
 * Status of an agent within a competition.
 */
export type CompetitionAgentStatus = z.infer<
  typeof CompetitionAgentStatusSchema
>;

/**
 * Zod schema for the status of a competition.
 */
export const CompetitionTypeSchema = z.enum(competitionType.enumValues);

/**
 * Status of a competition.
 */
export type CompetitionType = z.infer<typeof CompetitionTypeSchema>;

export const AgentCompetitionsParamsSchema = PagingParamsSchema.extend({
  status: z.optional(CompetitionStatusSchema),
  claimed: z.optional(z.boolean()),
});

export type AgentCompetitionsParams = z.infer<
  typeof AgentCompetitionsParamsSchema
>;

// Export agent metrics types
export type { RawAgentMetricsQueryResult } from "./agent-metrics.js";
