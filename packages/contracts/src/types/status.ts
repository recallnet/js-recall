import { z } from "zod/v4";

/**
 * Actor status values (source of truth)
 * Used for users, agents, and admins
 * DB imports this array to create pgEnum definitions
 */
export const ACTOR_STATUSES = [
  "active",
  "inactive",
  "suspended",
  "deleted",
] as const;

/**
 * Zod schema for actor status validation
 */
export const ActorStatusSchema = z.enum(ACTOR_STATUSES);

/**
 * Actor status type
 */
export type ActorStatus = z.infer<typeof ActorStatusSchema>;

/**
 * Competition status values (source of truth)
 * DB imports this array to create pgEnum definitions
 */
export const COMPETITION_STATUSES = [
  "pending",
  "active",
  "ending",
  "ended",
] as const;

/**
 * Zod schema for competition status validation
 */
export const CompetitionStatusSchema = z.enum(COMPETITION_STATUSES);

/**
 * Competition status type
 */
export type CompetitionStatus = z.infer<typeof CompetitionStatusSchema>;

/**
 * Competition type values (source of truth)
 * DB imports this array to create pgEnum definitions
 */
export const COMPETITION_TYPES = [
  "trading",
  "perpetual_futures",
  "spot_live_trading",
  "sports_prediction",
] as const;

/**
 * Zod schema for competition type validation
 */
export const CompetitionTypeSchema = z.enum(COMPETITION_TYPES);

/**
 * Competition type
 */
export type CompetitionType = z.infer<typeof CompetitionTypeSchema>;

/**
 * Competition agent status values (source of truth)
 * DB imports this array to create pgEnum definitions
 */
export const COMPETITION_AGENT_STATUSES = [
  "active",
  "withdrawn",
  "disqualified",
] as const;

/**
 * Zod schema for competition agent status validation
 */
export const CompetitionAgentStatusSchema = z.enum(COMPETITION_AGENT_STATUSES);

/**
 * Competition agent status type
 */
export type CompetitionAgentStatus = z.infer<
  typeof CompetitionAgentStatusSchema
>;

/**
 * Cross-chain trading type values (source of truth)
 * DB imports this array to create pgEnum definitions
 */
export const CROSS_CHAIN_TRADING_TYPES = [
  "disallowAll",
  "disallowXParent",
  "allow",
] as const;

/**
 * Zod schema for cross-chain trading type validation
 */
export const CrossChainTradingTypeSchema = z.enum(CROSS_CHAIN_TRADING_TYPES);

/**
 * Cross-chain trading type
 */
export type CrossChainTradingType = z.infer<typeof CrossChainTradingTypeSchema>;
