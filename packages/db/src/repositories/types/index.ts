import { z } from "zod/v4";

import {
  actorStatus,
  competitionAgentStatus,
  competitionStatus,
  competitionType,
} from "../../schema/core/defs.js";

/**
 * Zod schema for the status of a user, agent, or admin.
 */
export const ActorStatusSchema = z.enum(actorStatus.enumValues);

/**
 * Status of a user, agent, or admin.
 */
export type ActorStatus = z.infer<typeof ActorStatusSchema>;

// Zod schema for SpecificChain validation
export const SpecificChainSchema = z.enum([
  "eth",
  "polygon",
  "bsc",
  "arbitrum",
  "optimism",
  "avalanche",
  "base",
  "linea",
  "zksync",
  "scroll",
  "mantle",
  "svm",
]);

// Type derived from the Zod schema
export type SpecificChain = z.infer<typeof SpecificChainSchema>;

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

/**
 * Query string parameters that handle sorting and pagination
 */
export const PagingParamsSchema = z.object({
  sort: z.string().default(""),
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

export type PagingParams = z.infer<typeof PagingParamsSchema>;

/**
 * UUID parameter schema
 */
export const UuidSchema = z.uuid("Invalid uuid");

/**
 * User search parameters schema
 */
export const UserSearchParamsSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  walletAddress: z.string().optional(),
  status: ActorStatusSchema.optional(),
});

export type UserSearchParams = z.infer<typeof UserSearchParamsSchema>;

export const TimestampSchema = z.coerce.date();

export const SnapshotSchema = z.object({
  id: z.number(),
  competitionId: UuidSchema,
  agentId: UuidSchema,
  timestamp: TimestampSchema,
  totalValue: z.number(),
});

/**
 * Snakecase version of the snapshot schema, this is convenient for parsing raw
 * query results.
 */
export const SnapshotDbSchema = z.object({
  id: z.number(),
  competition_id: UuidSchema,
  agent_id: UuidSchema,
  timestamp: TimestampSchema,
  total_value: z.coerce.number(),
});

export const BestPlacementDbSchema = z.looseObject({
  competition_id: z.string(),
  // Note that coerce will result in 0 for "", null, and undefined
  rank: z.coerce.number(),
  total_agents: z.coerce.number(),
});

/**
 * Admin search parameters interface
 */
export interface SearchAdminsParams {
  username?: string;
  email?: string;
  name?: string;
  status?: ActorStatus;
}

/**
 * Agent trophy interface for ended competitions
 * Contains competition details and agent's final rank
 */
export interface AgentTrophy {
  competitionId: string;
  name: string;
  rank: number;
  imageUrl: string;
  createdAt: string;
}

/**
 * Agent search parameters schema
 */
export const AgentSearchParamsSchema = z.object({
  name: z.string().optional(),
  handle: z.string().optional(),
  ownerId: z.string().optional(),
  walletAddress: z.string().optional(),
  status: ActorStatusSchema.optional(),
});

export type AgentSearchParams = z.infer<typeof AgentSearchParamsSchema>;

export const AgentCompetitionsParamsSchema = PagingParamsSchema.extend({
  status: z.optional(CompetitionStatusSchema),
  claimed: z.optional(z.boolean()),
});

export type AgentCompetitionsParams = z.infer<
  typeof AgentCompetitionsParamsSchema
>;

// Export agent metrics types
export type { RawAgentMetricsQueryResult } from "./agent-metrics.js";
