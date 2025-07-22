import { z } from "zod/v4";

import {
  AgentMetadataSchema,
  CompetitionTypeSchema,
  CrossChainTradingTypeSchema,
  SyncDataTypeSchema,
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
  agentDescription: z.string().optional(),
  agentImageUrl: z.url().optional(),
  agentMetadata: AgentMetadataSchema.optional(),
  agentWalletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
});

/**
 * Trading Constraint Schema
 */
const TradingConstraintsSchema = z
  .object({
    minimumPairAgeHours: z.number().min(0),
    minimum24hVolumeUsd: z.number().min(0),
    minimumLiquidityUsd: z.number().min(0),
    minimumFdvUsd: z.number().min(0),
  })
  .optional();

/**
 * Admin create competition schema
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
    endDate: z.iso.datetime().optional(),
    votingStartDate: z.iso.datetime().optional(),
    votingEndDate: z.iso.datetime().optional(),
    joinStartDate: z.iso.datetime().optional(),
    joinEndDate: z.iso.datetime().optional(),
    tradingConstraints: TradingConstraintsSchema,
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
    tradingConstraints: TradingConstraintsSchema,
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
 * Admin sync object index schema
 */
export const AdminSyncObjectIndexSchema = z.object({
  competitionId: UuidSchema.optional(),
  dataTypes: z.array(SyncDataTypeSchema).optional(),
});

/**
 * Admin get object index query schema
 */
export const AdminGetObjectIndexQuerySchema = z.object({
  competitionId: UuidSchema.optional(),
  agentId: UuidSchema.optional(),
  dataType: SyncDataTypeSchema.optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
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
  name: z.string().min(1, "Name must be at least 1 character").optional(),
  description: z.string().optional(),
  imageUrl: z.url("Invalid image URL format").optional(),
  email: z.email("Invalid email format").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
