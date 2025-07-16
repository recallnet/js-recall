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
 * Admin create competition schema
 */
export const AdminCreateCompetitionSchema = z.object({
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
  })
  .refine((data) => data.competitionId || data.name, {
    message: "Either competitionId or name must be provided",
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

export const AdminGetCompetitionSnapshotsQuerySchema = z.object({
  agentId: UuidSchema.optional(),
});

export const AdminDeactivateAgentBodySchema = z.object({
  reason: z.string().min(1, "Reason is required"),
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
