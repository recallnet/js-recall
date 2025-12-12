import { z } from "zod/v4";

import { ActorStatusSchema } from "../types/status.js";

/**
 * UUID validation schema
 */
export const UuidSchema = z.uuid("Invalid uuid");

/**
 * Timestamp validation schema (coerces to Date)
 */
export const TimestampSchema = z.coerce.date();

/**
 * Query parameters for pagination
 */
export const PagingParamsSchema = z.object({
  sort: z.string().default(""),
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

export type PagingParams = z.infer<typeof PagingParamsSchema>;

/**
 * Portfolio snapshot schema (camelCase)
 */
export const SnapshotSchema = z.object({
  id: z.number(),
  competitionId: UuidSchema,
  agentId: UuidSchema,
  timestamp: TimestampSchema,
  totalValue: z.number(),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

/**
 * Portfolio snapshot schema (snake_case for DB queries)
 */
export const SnapshotDbSchema = z.object({
  id: z.number(),
  competition_id: UuidSchema,
  agent_id: UuidSchema,
  timestamp: TimestampSchema,
  total_value: z.coerce.number(),
});

export type SnapshotDb = z.infer<typeof SnapshotDbSchema>;

/**
 * Best placement result schema (snake_case for DB queries)
 */
export const BestPlacementDbSchema = z.looseObject({
  competition_id: z.string(),
  rank: z.coerce.number(),
  total_agents: z.coerce.number(),
});

export type BestPlacementDb = z.infer<typeof BestPlacementDbSchema>;

/**
 * User search parameters
 */
export const UserSearchParamsSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  walletAddress: z.string().optional(),
  status: ActorStatusSchema.optional(),
});

export type UserSearchParams = z.infer<typeof UserSearchParamsSchema>;

/**
 * Agent search parameters
 */
export const AgentSearchParamsSchema = z.object({
  name: z.string().optional(),
  handle: z.string().optional(),
  ownerId: z.string().optional(),
  walletAddress: z.string().optional(),
  status: ActorStatusSchema.optional(),
});

export type AgentSearchParams = z.infer<typeof AgentSearchParamsSchema>;

/**
 * Admin search parameters
 */
export interface SearchAdminsParams {
  username?: string;
  email?: string;
  name?: string;
  status?: z.infer<typeof ActorStatusSchema>;
}
