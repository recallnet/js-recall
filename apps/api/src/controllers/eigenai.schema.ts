import { z } from "zod/v4";

import { UuidSchema } from "@recallnet/services/types";

/**
 * Schema for submitting an EigenAI signature for verification
 */
export const SubmitSignatureSchema = z.object({
  competitionId: UuidSchema,
  requestPrompt: z
    .string()
    .min(1, "Request prompt is required")
    .describe("Concatenated content from all request messages"),
  responseModel: z
    .string()
    .min(1, "Response model is required")
    .describe("Model ID from EigenAI response (e.g., gpt-oss-120b-f16)"),
  responseOutput: z
    .string()
    .min(1, "Response output is required")
    .describe("Full output content from EigenAI response"),
  signature: z
    .string()
    .regex(
      /^(0x)?[a-fA-F0-9]{130}$/,
      "Invalid signature format (expected 65-byte hex)",
    )
    .describe("65-byte hex signature from EigenAI response"),
});

/**
 * Schema for getting badge status query params
 */
export const GetBadgeStatusQuerySchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Schema for competition stats path params
 */
export const CompetitionStatsParamsSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Schema for getting agent submissions query params
 */
export const GetAgentSubmissionsQuerySchema = z.object({
  competitionId: UuidSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
  status: z.enum(["verified", "invalid", "pending"]).optional(),
});
