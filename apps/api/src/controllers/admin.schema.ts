import { z } from "zod/v4";

import {
  AgentHandleSchema,
  AgentMetadataSchema,
  CompetitionTypeSchema,
  CrossChainTradingTypeSchema,
  TradingConstraintsSchema,
  UuidSchema,
} from "@/types/index.js";

/**
 * Admin setup schema for initial admin account creation
 */
export const AdminSetupSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.email("Invalid email format"),
});

/**
 * Admin register user schema for creating users and optionally their first agent
 */
export const AdminRegisterUserSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address"),
  name: z.string().optional(),
  email: z.email().optional(),
  userImageUrl: z.url().optional(),
  userMetadata: z.record(z.string(), z.unknown()).optional(),
  agentName: z.string().optional(),
  agentHandle: AgentHandleSchema.optional(),
  agentDescription: z.string().optional(),
  agentImageUrl: z.url().optional(),
  agentMetadata: AgentMetadataSchema.optional(),
  agentWalletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
});

/**
 * Rewards Schema (enforces that the key and value are both numbers)
 */
export const RewardsSchema = z
  .record(z.string().regex(/^\d+$/), z.number())
  .transform((val) => {
    const result: Record<number, number> = {};
    for (const [key, value] of Object.entries(val)) {
      result[parseInt(key, 10)] = value;
    }
    return result;
  })
  .optional();

/**
 * Admin create or update competition schema
 */
export const AdminCreateCompetitionSchema = z
  .object({
    name: z.string().min(1, "Competition name is required"),
    description: z.string().optional(),
    tradingType: CrossChainTradingTypeSchema.optional(),
    sandboxMode: z.boolean().optional(),
    externalUrl: z.url().optional(),
    imageUrl: z.url().optional(),
    type: CompetitionTypeSchema.optional(),
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
    votingStartDate: z.iso.datetime().optional(),
    votingEndDate: z.iso.datetime().optional(),
    joinStartDate: z.iso.datetime().optional(),
    joinEndDate: z.iso.datetime().optional(),
    tradingConstraints: TradingConstraintsSchema,
    rewards: RewardsSchema,
  })
  .refine(
    (data) => {
      if (data.joinStartDate && data.joinEndDate) {
        return new Date(data.joinStartDate) <= new Date(data.joinEndDate);
      }
      return true;
    },
    {
      message: "joinStartDate must be before or equal to joinEndDate",
      path: ["joinStartDate"],
    },
  );

/**
 * Admin update competition schema (note: mostly the same as competition creation, but with optional name)
 */
export const AdminUpdateCompetitionSchema = AdminCreateCompetitionSchema.omit({
  name: true,
}).extend({
  name: z.string().optional(),
});

/**
 * Admin start competition schema
 */
export const AdminStartCompetitionSchema = z
  .object({
    competitionId: UuidSchema.optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    agentIds: z.array(UuidSchema).default([]),
    tradingType: CrossChainTradingTypeSchema.optional(),
    sandboxMode: z.boolean().optional(),
    externalUrl: z.url().optional(),
    imageUrl: z.url().optional(),
    endDate: z.iso.datetime().optional(),
    votingStartDate: z.iso.datetime().optional(),
    votingEndDate: z.iso.datetime().optional(),
    joinStartDate: z.iso.datetime().optional(),
    joinEndDate: z.iso.datetime().optional(),
    tradingConstraints: TradingConstraintsSchema,
    rewards: RewardsSchema,
  })
  .refine((data) => data.competitionId || data.name, {
    message: "Either competitionId or name must be provided",
  });

/**
 * Admin end competition schema
 */
export const AdminEndCompetitionSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Admin get performance reports query schema
 */
export const AdminGetPerformanceReportsQuerySchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Admin get competition snapshots params and query schema
 */
export const AdminGetCompetitionSnapshotsParamsSchema = z.object({
  competitionId: UuidSchema,
});

export const AdminGetCompetitionSnapshotsQuerySchema = z.object({
  agentId: UuidSchema.optional(),
});

/**
 * Admin deactivate agent params and body schema
 */
export const AdminDeactivateAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

export const AdminDeactivateAgentBodySchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

/**
 * Admin reactivate agent params schema
 */
export const AdminReactivateAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin get agent params schema
 */
export const AdminGetAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin remove agent from competition params and body schema
 */
export const AdminRemoveAgentFromCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
  agentId: UuidSchema,
});

export const AdminRemoveAgentFromCompetitionBodySchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

/**
 * Admin reactivate agent in competition params schema
 */
export const AdminReactivateAgentInCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
  agentId: UuidSchema,
});

/**
 * Admin get agent API key params schema
 */
export const AdminGetAgentApiKeyParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin update competition params schema
 */
export const AdminUpdateCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Admin delete agent params schema
 */
export const AdminDeleteAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin add agent to competition params schema
 */
export const AdminAddAgentToCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
  agentId: UuidSchema,
});

/**
 * Admin update agent params schema
 */
export const AdminUpdateAgentParamsSchema = z.object({
  agentId: UuidSchema,
});

/**
 * Admin update agent body schema
 */
export const AdminUpdateAgentBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name must be at least 1 character")
    .max(100)
    .optional(),
  handle: AgentHandleSchema.optional(),
  description: z.string().optional(),
  imageUrl: z.url("Invalid image URL format").optional(),
  email: z.email("Invalid email format").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
